"""Local speech-to-text. Audio stays on this machine; nothing is sent to a paid API."""

import array
import json
import os
import sys
import wave

import av
from faster_whisper import WhisperModel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voices import chunk_words, diarize

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


def utterances(segments):
    words = []
    loose = []
    for segment in segments:
        segment_words = getattr(segment, "words", None) or []
        if segment_words:
            for word in segment_words:
                token = (word.word or "").strip()
                if token:
                    words.append(
                        {
                            "text": token,
                            "start": round(float(word.start), 2),
                            "end": round(float(word.end), 2),
                        }
                    )
            continue
        text = (segment.text or "").strip()
        if text:
            loose.append({"start": round(segment.start, 2), "end": round(segment.end, 2), "text": text})
    return chunk_words(words) if words else loose


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: transcribe.py AUDIO", file=sys.stderr)
        sys.exit(2)
    model_name = os.environ.get("WHISPER_MODEL", "large-v3")
    vad = os.environ.get("WHISPER_VAD", "1") != "0"
    beam = int(os.environ.get("WHISPER_BEAM", "5"))
    hotwords = os.environ.get(
        "WHISPER_HOTWORDS",
        "коммерческое предложение, КП, созвон, встреча, договор, оплата, счёт, перезвон, документы, подпись",
    )
    prompt = os.environ.get(
        "WHISPER_PROMPT",
        "Телефонный разговор. Алексей: Добрый день, я отправлю коммерческое предложение до пятницы. Клиент: Хорошо, давайте созвон в понедельник в 11.",
    )
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    options = {
        "language": "ru",
        "vad_filter": vad,
        "beam_size": beam,
        "patience": 1,
        "word_timestamps": True,
        "condition_on_previous_text": False,
        "hotwords": hotwords,
        "initial_prompt": prompt,
        "hallucination_silence_threshold": 2,
        "compression_ratio_threshold": 2.2,
        "no_speech_threshold": 0.45,
    }
    optional = ["hallucination_silence_threshold", "patience", "hotwords", "initial_prompt"]
    while True:
        try:
            segments, _info = model.transcribe(sys.argv[1], **options)
            break
        except TypeError:
            if not optional:
                raise
            options.pop(optional.pop(0), None)
    samples, rate = load_wav(sys.argv[1])
    json.dump(diarize(utterances(segments), samples, rate), sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
