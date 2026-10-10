"""Local speech-to-text. Audio stays on this machine; nothing is sent to a paid API."""

import json
import os
import sys

import av
from faster_whisper import WhisperModel

_open = av.open


def _open_compat(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return _open(*args, **kwargs)


av.open = _open_compat


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: transcribe.py AUDIO", file=sys.stderr)
        sys.exit(2)
    model_name = os.environ.get("WHISPER_MODEL", "small")
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(
        sys.argv[1],
        language="ru",
        vad_filter=True,
        beam_size=1,
    )
    payload = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        payload.append({"start": round(segment.start, 2), "end": round(segment.end, 2), "text": text})
    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
