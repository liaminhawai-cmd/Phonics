#!/usr/bin/env python3
"""Keep third-party cue videos out of a public repo, and show what's missing.

Usage: python3 scripts/check_cues.py           report + fail on a leak
       python3 scripts/check_cues.py --todo    just list what's left to record

WHY THIS EXISTS
---------------
Recording yourself performing someone else's cue system so you can use
it with your own class is one thing. Publishing a complete free video
reference of that system, on a public site, next to the products its
publisher sells, is a different thing — and it is the one that gets a
takedown.

.gitignore keeps the two apart, but `git add -f` walks straight past a
.gitignore and so does a stray `git add -A` on a file that was already
tracked. This is the backstop: it looks at what git is ACTUALLY
tracking and fails if a system marked publish:false is in there.

Exit codes: 0 clean, 1 something restricted is tracked.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUES = os.path.join(ROOT, "cues")


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def tracked_cue_files():
    """Paths under cues/ that git has in the index — ignore rules or not."""
    try:
        out = subprocess.run(["git", "ls-files", "cues"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    return [p for p in out.splitlines() if p.strip()]


def phoneme_ids():
    return [p["id"] for p in load("data/phonemes.json")["phonemes"]]


def main():
    systems = {s["id"]: s for s in load("data/cues/index.json")["systems"]}
    todo_only = "--todo" in sys.argv

    # ---- what has been recorded -------------------------------------
    print("Recorded cue clips")
    ids = phoneme_ids()
    found_any = False
    for sid, spec in systems.items():
        if spec.get("builtin"):
            continue
        for accent in spec.get("accents", []):
            folder = os.path.join(CUES, sid, accent)
            have = set()
            if os.path.isdir(folder):
                have = {n.rsplit(".", 1)[0] for n in os.listdir(folder)
                        if n.lower().endswith((".mp4", ".webm", ".mov"))}
            if not have and todo_only:
                continue
            found_any = found_any or bool(have)
            missing = [i for i in ids if i not in have]
            flag = "" if spec.get("publish") else "   [not publishable]"
            print("  %-22s %-3s  %2d/%d recorded%s"
                  % (sid, accent, len(have), len(ids), flag))
            if missing and (have or todo_only):
                head = ", ".join(missing[:14])
                more = "" if len(missing) <= 14 else "  (+%d more)" % (len(missing) - 14)
                print("      still to do: %s%s" % (head, more))
    if not found_any and not todo_only:
        print("  (none yet — see cues/README.md)")

    if todo_only:
        return 0

    # ---- the actual guard -------------------------------------------
    tracked = tracked_cue_files()
    if tracked is None:
        print("\nNot a git checkout — skipping the tracked-file check.")
        return 0

    leaks = []
    for path in tracked:
        parts = path.split("/")
        if len(parts) < 2 or parts[1] in ("README.md",):
            continue
        spec = systems.get(parts[1])
        if spec is None:
            leaks.append((path, "no such system in data/cues/index.json"))
        elif not spec.get("publish"):
            leaks.append((path, "%s is marked publish:false" % parts[1]))

    if leaks:
        print("\n%d file(s) are tracked by git but must not be published:\n" % len(leaks))
        for path, why in leaks:
            print("   %-52s %s" % (path, why))
        print("\nThis repo is public. To take them out of the index but keep the files:")
        print("   git rm --cached -r cues/<system>")
        print("If they have already been committed, the history needs rewriting too —")
        print("deleting a file in a later commit does not remove it from the earlier one.")
        return 1

    print("\nNothing restricted is tracked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
