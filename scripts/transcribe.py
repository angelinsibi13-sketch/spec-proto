"""Local speech-to-text. Audio stays on this machine; nothing is sent to a paid API."""

import array
import json
import os
import sys
import wave

import av
from faster_whisper import WhisperModel

_open = av.open


def _open_compat(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return _open(*args, **kwargs)


av.open = _open_compat


def load_wav(path: str) -> tuple[array.array, int]:
    with wave.open(path, "rb") as handle:
        rate = handle.getframerate()
        width = handle.getsampwidth()
        frames = handle.readframes(handle.getnframes())
    if width != 2:
        return array.array("h"), rate
    samples = array.array("h")
    samples.frombytes(frames)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples, rate


def pitch_hz(samples: array.array, rate: int, start: float, end: float) -> float | None:
    left = max(0, int(start * rate))
    right = min(len(samples), int(end * rate))
    if right - left < rate // 5:
        return None
    window = samples[left:right]
    mid = len(window) // 2
    size = min(len(window), rate // 2)
    frame = window[max(0, mid - size // 2) : max(0, mid - size // 2) + size]
    if len(frame) < rate // 5:
        return None
    mean = sum(frame) / len(frame)
    energy = 0.0
    centered = []
    for value in frame:
        sample = value - mean
        centered.append(sample)
        energy += sample * sample
    if energy < 1:
        return None
    min_lag = max(1, int(rate / 400))
    max_lag = min(len(centered) - 1, int(rate / 70))
    scored: dict[int, float] = {}
    best_lag = 0
    best = 0.0
    for lag in range(min_lag, max_lag):
        corr = 0.0
        for index in range(0, len(centered) - lag, 2):
            corr += centered[index] * centered[index + lag]
        scored[lag] = corr
        if corr > best:
            best = corr
            best_lag = lag
    if best_lag == 0 or best / energy < 0.15:
        return None
    lag = best_lag
    while lag * 2 < max_lag and scored.get(lag * 2, 0) >= best * 0.75:
        lag *= 2
    return round(rate / lag, 1)


def utterances(segments, gap: float = 0.55):
    words = []
    loose = []
    for segment in segments:
        segment_words = getattr(segment, "words", None) or []
        if segment_words:
            for word in segment_words:
                token = (word.word or "").strip()
                if token:
                    words.append(word)
            continue
        text = (segment.text or "").strip()
        if text:
            loose.append({"start": round(segment.start, 2), "end": round(segment.end, 2), "text": text})
    if not words:
        return loose
    grouped = [[words[0]]]
    for word in words[1:]:
        if word.start - grouped[-1][-1].end > gap:
            grouped.append([word])
        else:
            grouped[-1].append(word)
    payload = []
    for group in grouped:
        text = " ".join((word.word or "").strip() for word in group).strip()
        if not text:
            continue
        payload.append(
            {
                "start": round(group[0].start, 2),
                "end": round(group[-1].end, 2),
                "text": text,
            }
        )
    return payload


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: transcribe.py AUDIO", file=sys.stderr)
        sys.exit(2)
    model_name = os.environ.get("WHISPER_MODEL", "small")
    vad = os.environ.get("WHISPER_VAD", "1") != "0"
    beam = int(os.environ.get("WHISPER_BEAM", "5"))
    hotwords = os.environ.get(
        "WHISPER_HOTWORDS",
        "коммерческое предложение, КП, созвон, встреча, договор, оплата, счёт, перезвон, документы, подпись",
    )
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    options = {
        "language": "ru",
        "vad_filter": vad,
        "beam_size": beam,
        "word_timestamps": True,
        "condition_on_previous_text": True,
        "hotwords": hotwords,
    }
    try:
        segments, _info = model.transcribe(sys.argv[1], **options)
    except TypeError:
        options.pop("hotwords", None)
        segments, _info = model.transcribe(sys.argv[1], **options)
    samples, rate = load_wav(sys.argv[1])
    payload = []
    for item in utterances(segments):
        item["pitch"] = pitch_hz(samples, rate, item["start"], item["end"])
        payload.append(item)
    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
