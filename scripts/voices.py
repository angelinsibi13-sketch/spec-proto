"""Split a mono recording into turns and mark which voice is lower."""

import array
import math


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def _slice(samples: array.array, rate: int, start: float, end: float) -> list[float]:
    left = max(0, int(start * rate))
    right = min(len(samples), int(end * rate))
    if right - left < 8:
        return []
    return [float(samples[index]) for index in range(left, right)]


def _pitch_ncc(frame: list[float], rate: int) -> float | None:
    if len(frame) < rate // 8:
        return None
    mean = sum(frame) / len(frame)
    centered = [value - mean for value in frame]
    min_lag = max(1, int(rate / 420))
    max_lag = min(len(centered) - 1, int(rate / 70))
    if max_lag <= min_lag + 4:
        return None
    scores: list[float] = []
    for lag in range(min_lag, max_lag):
        corr = 0.0
        left_energy = 0.0
        right_energy = 0.0
        for index in range(0, len(centered) - lag, 2):
            left = centered[index]
            right = centered[index + lag]
            corr += left * right
            left_energy += left * left
            right_energy += right * right
        if left_energy < 1 or right_energy < 1:
            scores.append(0.0)
        else:
            scores.append(corr / math.sqrt(left_energy * right_energy))
    peaks: list[tuple[int, float]] = []
    for index in range(1, len(scores) - 1):
        score = scores[index]
        if score >= 0.55 and score >= scores[index - 1] and score >= scores[index + 1]:
            peaks.append((min_lag + index, score))
    if not peaks:
        best_index = max(range(len(scores)), key=lambda index: scores[index])
        if scores[best_index] < 0.32:
            return None
        return rate / (min_lag + best_index)
    best = max(score for _lag, score in peaks)
    near = [peak for peak in peaks if peak[1] >= best - 0.012]
    lag, lag_score = min(near, key=lambda peak: peak[0])
    for other_lag, other_score in peaks:
        ratio = other_lag / lag
        if 1.85 <= ratio <= 2.15 and other_score >= 0.68 and other_score < lag_score - 0.015:
            lag = other_lag
            break
    return rate / lag


def _darkness(frame: list[float]) -> float | None:
    total = 0.0
    low = 0.0
    follow = 0.0
    for value in frame:
        follow += 0.12 * (value - follow)
        low += follow * follow
        total += value * value
    if total < 1:
        return None
    return low / total


def measure(samples: array.array, rate: int, start: float, end: float) -> tuple[float | None, float | None]:
    span = end - start
    if span < 0.12:
        return None, None
    cuts = 3 if span >= 0.45 else 1
    step = span / cuts
    pitches: list[float] = []
    darks: list[float] = []
    for index in range(cuts):
        window = _slice(samples, rate, start + index * step, start + (index + 1) * step)
        pitch = _pitch_ncc(window, rate)
        dark = _darkness(window)
        if pitch is not None and 70 <= pitch <= 450:
            pitches.append(pitch)
        if dark is not None:
            darks.append(dark)
    return (_median(pitches) if pitches else None, _median(darks) if darks else None)


def _separated(low_pitch: float, high_pitch: float, low_dark: float, high_dark: float) -> bool:
    if low_pitch <= 0:
        return False
    if high_pitch - low_pitch >= 12 and high_pitch >= low_pitch * 1.08:
        return True
    return abs(high_dark - low_dark) >= 0.045 and high_pitch >= low_pitch * 1.04


def _assign(items: list[dict], groups: list[list[int]]) -> None:
    stats = []
    for indexes in groups:
        pitches = [items[index]["pitch"] for index in indexes if items[index]["pitch"]]
        darks = [items[index]["dark"] for index in indexes if items[index]["dark"] is not None]
        if not pitches:
            return
        stats.append((_median(pitches), _median(darks) if darks else 0.0, indexes))
    stats.sort(key=lambda item: item[0])
    if not _separated(stats[0][0], stats[1][0], stats[0][1], stats[1][1]):
        return
    for voice, (_pitch, _dark, indexes) in enumerate(stats):
        for index in indexes:
            items[index]["voice"] = voice


def cluster_voices(items: list[dict]) -> None:
    voiced = [index for index, item in enumerate(items) if item.get("pitch")]
    for item in items:
        item["voice"] = None
    if len(voiced) < 2:
        return
    if len(voiced) < 4:
        ordered = sorted(voiced, key=lambda index: items[index]["pitch"])
        gap_at = 1
        gap = 0.0
        for cursor in range(1, len(ordered)):
            size = items[ordered[cursor]]["pitch"] - items[ordered[cursor - 1]]["pitch"]
            if size > gap:
                gap = size
                gap_at = cursor
        _assign(items, [ordered[:gap_at], ordered[gap_at:]])
        return

    logs = [math.log(items[index]["pitch"]) for index in voiced]
    darks = [items[index]["dark"] if items[index]["dark"] is not None else 0.5 for index in voiced]

    def scale(values: list[float], value: float) -> float:
        mean = sum(values) / len(values)
        variance = sum((item - mean) ** 2 for item in values) / len(values)
        return (value - mean) / (math.sqrt(variance) or 1)

    feats = [(scale(logs, logs[index]), scale(darks, darks[index])) for index in range(len(voiced))]
    low = min(range(len(feats)), key=lambda index: feats[index][0])
    high = max(range(len(feats)), key=lambda index: feats[index][0])
    if low == high:
        return
    centers = [feats[low], feats[high]]
    labels = [0] * len(feats)
    for _ in range(12):
        groups: list[list[tuple[float, float]]] = [[], []]
        for index, feat in enumerate(feats):
            distances = [(feat[0] - center[0]) ** 2 + (feat[1] - center[1]) ** 2 for center in centers]
            label = 0 if distances[0] <= distances[1] else 1
            labels[index] = label
            groups[label].append(feat)
        if not groups[0] or not groups[1]:
            return
        centers = [
            (
                sum(feat[0] for feat in group) / len(group),
                sum(feat[1] for feat in group) / len(group),
            )
            for group in groups
        ]
    grouped = [
        [voiced[index] for index, label in enumerate(labels) if label == 0],
        [voiced[index] for index, label in enumerate(labels) if label == 1],
    ]
    _assign(items, grouped)


def inherit_voices(items: list[dict]) -> None:
    for index, item in enumerate(items):
        if item.get("voice") is not None:
            continue
        previous = next((items[cursor] for cursor in range(index - 1, -1, -1) if items[cursor].get("voice") is not None), None)
        following = next((items[cursor] for cursor in range(index + 1, len(items)) if items[cursor].get("voice") is not None), None)
        if previous is not None and item["start"] - previous["end"] <= 0.22:
            item["voice"] = previous["voice"]
        elif following is not None and following["start"] - item["end"] <= 0.22:
            item["voice"] = following["voice"]


def group_turns(items: list[dict]) -> list[dict]:
    turns: list[dict] = []
    for item in items:
        text = " ".join(str(item.get("text") or "").split())
        if len(text) < 2:
            continue
        start = float(item["start"])
        end = float(item.get("end") or start)
        voice = item.get("voice")
        pitch = item.get("pitch")
        if turns:
            previous = turns[-1]
            gap = start - previous["end"]
            repeated = text.casefold() == previous["text"].casefold() and gap < 1.2
            same_voice = voice is not None and voice == previous.get("voice") and gap < 0.42
            if repeated or same_voice:
                if not repeated:
                    previous["text"] = f"{previous['text']} {text}"
                previous["end"] = max(previous["end"], end)
                if previous.get("pitch") is None:
                    previous["pitch"] = pitch
                continue
        turns.append(
            {
                "text": text,
                "start": start,
                "end": end,
                "pitch": round(pitch, 1) if isinstance(pitch, float) else None,
                "voice": voice if voice in (0, 1) else None,
            }
        )
    for turn in turns:
        turn["start"] = round(turn["start"], 2)
        turn["end"] = round(turn["end"], 2)
    return turns


def chunk_words(items: list[dict], pause: float = 0.28, limit: float = 1.15) -> list[dict]:
    buckets: list[list[dict]] = []
    current: list[dict] = []
    for item in items:
        if current:
            gap = float(item["start"]) - float(current[-1]["end"])
            length = float(current[-1]["end"]) - float(current[0]["start"])
            if gap > pause or length >= limit:
                buckets.append(current)
                current = []
        current.append(item)
    if current:
        buckets.append(current)
    chunks = []
    for bucket in buckets:
        text = " ".join(" ".join(str(item.get("text") or "").split()) for item in bucket).strip()
        if len(text) < 2:
            continue
        pitch = next((item.get("pitch") for item in bucket if item.get("pitch")), None)
        chunks.append(
            {
                "text": text,
                "start": float(bucket[0]["start"]),
                "end": float(bucket[-1]["end"]),
                "pitch": pitch,
            }
        )
    return chunks


def diarize(items: list[dict], samples: array.array, rate: int) -> list[dict]:
    measured = []
    for item in items:
        start = float(item["start"])
        end = float(item.get("end") or start)
        pitch, dark = measure(samples, rate, start, end)
        measured.append({**item, "start": start, "end": end, "pitch": pitch, "dark": dark})
    cluster_voices(measured)
    inherit_voices(measured)
    return group_turns(measured)
