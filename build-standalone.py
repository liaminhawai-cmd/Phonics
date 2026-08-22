#!/usr/bin/env python3
"""Build phonics-standalone.html — the offline, single-file copy of the app.

index.html loads its logic from four scripts; the standalone inlines them so
the whole trainer is one file you can email, drop on a USB stick or open from
a downloads folder with no server. Run this after changing index.html or any
of the scripts, and commit the result:

    python3 build-standalone.py

Audio and activity sheets stay as relative paths, so the standalone still
plays sounds when it sits next to the repo's .mp4 files, and still works
(silently) when it doesn't.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
SRC = HERE / "index.html"
OUT = HERE / "phonics-standalone.html"

NOTE = ("<!-- GENERATED FILE — do not edit by hand.\n"
        "     Built from index.html by build-standalone.py; edit those instead. -->\n")


def build_bank_blob() -> str:
    """Embed the whole data bank as one inline JSON script tag, keyed by the
    same relative paths js/core/data.js fetches at runtime — so the
    standalone file works from file:// where fetch() can't reach data/*.json.
    js/core/data.js reads this via document.getElementById('phonics-bank-inline').
    """
    bank: dict = {}

    def add(rel: str) -> dict:
        path = HERE / rel
        if not path.exists():
            raise SystemExit(f"build-standalone: {rel} (needed for the inline data bank) is missing")
        data = json.loads(path.read_text(encoding="utf-8"))
        bank[rel] = data
        return data

    add("data/phonemes.json")
    add("data/gpcs.json")
    seq_index = add("data/sequences/index.json")
    for entry in seq_index["sequences"]:
        add("data/sequences/" + entry["file"])
    add("data/words/words.json")

    # same escaping as inline()'s JS embed: a literal </script> in the JSON
    # would close the tag early. \/ is a valid JSON escape for /, so
    # JSON.parse reconstructs the original text exactly.
    blob = json.dumps(bank, ensure_ascii=False).replace("</script", "<\\/script")
    return f'<script type="application/json" id="phonics-bank-inline">{blob}</script>\n'


def main() -> None:
    html = SRC.read_text(encoding="utf-8")

    # Inject the bank blob right before the first inlined <script src>, so it's
    # defined before js/core/data.js (which reads it) ever runs.
    anchor = html.find('<script src="')
    if anchor == -1:
        raise SystemExit("build-standalone: no <script src> tag found to anchor the inline data bank")
    bank_tag = build_bank_blob()
    html = html[:anchor] + bank_tag + html[anchor:]

    def inline(match: re.Match) -> str:
        src = match.group(1)
        path = HERE / src
        if not path.exists():
            raise SystemExit(f"build-standalone: {src} referenced by index.html is missing")
        # a literal </script> inside the JS would close the tag early
        code = path.read_text(encoding="utf-8").replace("</script", "<\\/script")
        return f"<!-- {src} -->\n<script>\n{code}\n</script>"

    html, n = re.subn(r'<script src="([^"]+)"></script>', inline, html)
    if not n:
        raise SystemExit("build-standalone: found no <script src> tags to inline")

    OUT.write_text(NOTE + html, encoding="utf-8")
    print(f"built {OUT.name} — {n} scripts inlined, {len(bank_tag) // 1024} KB data bank, {len(html) // 1024} KB total")


if __name__ == "__main__":
    main()
