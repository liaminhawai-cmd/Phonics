#!/usr/bin/env python3
"""Synthesise TTS stand-in audio for every word missing a human recording.

Usage:
    pip install edge-tts
    python3 scripts/tts_standin.py                 # all three accents
    python3 scripts/tts_standin.py --accent au uk  # just some
    python3 scripts/tts_standin.py --force         # regenerate even if present

Writes mp3s into recordings/tts/<accent>/words/<word id>.mp3 — the app's
second-preference audio source. Human recordings in recordings/<accent>/words/
always win; this script skips words that already have one.

Phonemes are NOT synthesised (TTS reads isolated sounds as letter names);
record those with a human voice — see recordings/README.md.
"""
import argparse, asyncio, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES = {"au": "en-AU-NatashaNeural", "uk": "en-GB-SoniaNeural", "us": "en-US-JennyNeural"}
AUDIO_EXTS = (".mp3", ".m4a", ".wav", ".mp4")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--accent", nargs="*", default=list(VOICES), choices=list(VOICES))
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    try:
        import edge_tts
    except ImportError:
        sys.exit("edge-tts not installed — run: pip install edge-tts")

    with open(os.path.join(ROOT, "data/words/words.json"), encoding="utf-8") as f:
        words = json.load(f)["words"]

    async def synth_all():
        for accent in args.accent:
            human_dir = os.path.join(ROOT, "recordings", accent, "words")
            out_dir = os.path.join(ROOT, "recordings", "tts", accent, "words")
            os.makedirs(out_dir, exist_ok=True)
            made = skipped = 0
            for w in words:
                wid = w.get("id", w["word"])
                out = os.path.join(out_dir, wid + ".mp3")
                have_human = any(
                    os.path.exists(os.path.join(human_dir, wid + ext)) for ext in AUDIO_EXTS
                )
                if have_human or (os.path.exists(out) and not args.force):
                    skipped += 1
                    continue
                # speak the word, slightly slowed for classroom clarity
                tts = edge_tts.Communicate(w["word"], VOICES[accent], rate="-15%")
                await tts.save(out)
                made += 1
            print(f"{accent}: synthesised {made}, skipped {skipped} (human/existing)")

    asyncio.run(synth_all())


if __name__ == "__main__":
    main()
