#!/usr/bin/env python3
"""Generate per-accent recording checklists + CSV manifests from the data bank.

Usage: python3 scripts/build_recording_manifest.py    (from repo root)

Writes recordings/<accent>/CHECKLIST.md and manifest.csv for au, uk, us.
Never touches audio files; safe to re-run any time the bank changes.
"""
import csv, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "recordings")
ACCENTS = ["au", "uk", "us"]
AUDIO_EXTS = (".mp3", ".m4a", ".wav", ".mp4")


def jload(rel):
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def has_audio(folder, stem):
    return any(os.path.exists(os.path.join(folder, stem + ext)) for ext in AUDIO_EXTS)


phon = jload("data/phonemes.json")
words = jload("data/words/words.json")
ui = jload("data/ui-prompts.json")

# Legacy AU phoneme recordings live in sounds/<ipa (ex[a]mple)>/
legacy = {}
for p in phon["phonemes"]:
    folder = p.get("recording", {}).get("legacy_sounds_folder")
    if folder and os.path.isdir(os.path.join(ROOT, "sounds", folder)):
        legacy[p["id"]] = folder

units = phon.get("teaching_units", {})
unit_rows = [(uid, u) for uid, u in units.items() if isinstance(u, dict)]

for accent in ACCENTS:
    base = os.path.join(REC, accent)
    for sub in ("phonemes", "words", "words-segmented", "ui"):
        os.makedirs(os.path.join(base, sub), exist_ok=True)

    rows = []
    for p in phon["phonemes"]:
        stem = p["id"]
        exists = has_audio(os.path.join(base, "phonemes"), stem)
        note = p["label"]
        if not exists and accent == "au" and stem in legacy:
            exists, note = True, f"{note} (legacy sounds/{legacy[stem]}/)"
        rows.append(("phoneme", stem, f"{stem}.mp3", exists, note))
    for uid, u in unit_rows:
        exists = has_audio(os.path.join(base, "phonemes"), uid)
        rows.append(("teaching-unit", uid, f"{uid}.mp3", exists, u.get("label", "")))

    for p in (ui or {}).get("prompts", []):
        exists = has_audio(os.path.join(base, "ui"), p["id"])
        rows.append(("ui-prompt", p["id"], f"{p['id']}.mp3", exists,
                     '"' + p["text"] + '"' + (" — " + p["note"] if p.get("note") else "")))

    if words:
        for w in sorted(words["words"], key=lambda w: (w.get("tier", 9), w.get("id", w["word"]))):
            wid = w.get("id", w["word"])
            exists = has_audio(os.path.join(base, "words"), wid)
            note = f"tier {w.get('tier', '?')}"
            if accent in w.get("accents", {}):
                note += " — ACCENT-SPECIFIC pronunciation, please record"
            rows.append(("word", wid, f"{wid}.mp3", exists, note))

    with open(os.path.join(base, "manifest.csv"), "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow(["kind", "id", "filename", "exists", "notes"])
        for kind, rid, fn, exists, note in rows:
            wr.writerow([kind, rid, fn, "yes" if exists else "", note])

    done = sum(1 for r in rows if r[3])
    lines = [
        f"# Recording checklist — {accent.upper()}",
        "",
        f"**{done} / {len(rows)} recorded.** Save files into "
        f"`recordings/{accent}/phonemes/` and `recordings/{accent}/words/` — "
        "filename must match exactly. See recordings/README.md for tips.",
        "",
        "## Phonemes & teaching units",
        "",
    ]
    for kind, rid, fn, exists, note in rows:
        if kind not in ("phoneme", "teaching-unit"):
            continue
        box = "x" if exists else " "
        lines.append(f"- [{box}] `{fn}` — {note}")
    lines += ["", f"## Spoken prompts  → `recordings/{accent}/ui/`", "",
              "Short and warm — the way you'd say it across a table.", ""]
    for kind, rid, fn, exists, note in rows:
        if kind != "ui-prompt":
            continue
        box = "x" if exists else " "
        lines.append(f"- [{box}] `{fn}` — {note}")
    lines += ["", "## Words (by tier)", ""]
    for kind, rid, fn, exists, note in rows:
        if kind != "word":
            continue
        box = "x" if exists else " "
        lines.append(f"- [{box}] `{fn}` — {note}")
    if not words:
        lines.append("*(word bank not built yet — re-run once data/words/words.json exists)*")
    with open(os.path.join(base, "CHECKLIST.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"{accent}: {done}/{len(rows)} recorded — wrote CHECKLIST.md + manifest.csv")
