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
import pathlib
import re

HERE = pathlib.Path(__file__).parent
SRC = HERE / "index.html"
OUT = HERE / "phonics-standalone.html"

NOTE = ("<!-- GENERATED FILE — do not edit by hand.\n"
        "     Built from index.html by build-standalone.py; edit those instead. -->\n")


def main() -> None:
    html = SRC.read_text(encoding="utf-8")

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
    print(f"built {OUT.name} — {n} scripts inlined, {len(html) // 1024} KB")


if __name__ == "__main__":
    main()
