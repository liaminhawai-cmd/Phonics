#!/usr/bin/env python3
"""Collect recordings out of a to-record/ folder tree (see
build_to_record's README.txt) into recordings/, converting to mp3 on the way.

    python3 scripts/collect_from_folders.py to-record recordings

Each leaf folder is named exactly as the target filename, e.g.
to-record/AU/words/bridge.mp3/. Anything dropped inside it — one file,
any name or format — gets converted (if needed) and moved to
recordings/au/words/bridge.mp3. A folder with zero or more than one
non-instruction file is skipped and reported, so partially-filled trees
are safe to run repeatedly.

Needs ffmpeg on PATH for anything that isn't already an .mp3.
"""
import shutil
import subprocess
import sys
from pathlib import Path

SKIP_NAMES = {"HOW TO RECORD.txt", "README.txt", ".DS_Store", "Thumbs.db"}
KIND_DIR = {"phonemes": "phonemes", "words": "words"}


def convert_to_mp3(src: Path, dest: Path) -> bool:
    if src.suffix.lower() == ".mp3":
        shutil.copyfile(src, dest)
        return True
    if not shutil.which("ffmpeg"):
        print(f"  SKIP (no ffmpeg on PATH to convert): {src}")
        return False
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-codec:a", "libmp3lame", "-q:a", "4", str(dest)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  FAILED to convert {src}:\n{result.stderr[-400:]}")
        return False
    return True


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    to_record, recordings = Path(sys.argv[1]), Path(sys.argv[2])

    done, empty, ambiguous, failed = [], [], [], []

    for accent_dir in sorted(to_record.iterdir()):
        if not accent_dir.is_dir():
            continue
        accent = accent_dir.name.lower()
        for kind_dir in sorted(accent_dir.iterdir()):
            if kind_dir.name not in KIND_DIR:
                continue
            for leaf in sorted(kind_dir.iterdir()):
                if not leaf.is_dir():
                    continue
                target_name = leaf.name  # e.g. "bridge.mp3"
                files = [f for f in leaf.iterdir() if f.is_file() and f.name not in SKIP_NAMES]
                if not files:
                    empty.append(leaf)
                    continue
                if len(files) > 1:
                    ambiguous.append(leaf)
                    continue
                dest_dir = recordings / accent / KIND_DIR[kind_dir.name]
                dest_dir.mkdir(parents=True, exist_ok=True)
                dest = dest_dir / target_name
                if convert_to_mp3(files[0], dest):
                    done.append(dest)

    print(f"\nCollected {len(done)} file(s) into {recordings}")
    for d in done:
        print("  +", d)
    if ambiguous:
        print(f"\n{len(ambiguous)} folder(s) had more than one file — left alone, pick one:")
        for a in ambiguous:
            print("  ?", a)
    print(f"\n{len(empty)} folder(s) still empty — nothing to do yet.")
    print("\nRe-run scripts/build_recording_manifest.py to refresh the checklists.")


if __name__ == "__main__":
    main()
