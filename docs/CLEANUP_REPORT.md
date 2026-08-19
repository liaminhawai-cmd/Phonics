# Repo Cleanup Report — 2026-08-19

This repo is a static GitHub Pages site (grapheme trainer, articulation trainer,
downloads, worksheets). It had accumulated personal teaching-resource stashes,
Windows junk files, and a few one-off documents that don't belong in a public
site repo. This pass removed those, moved one doc into `docs/`, and left
everything else — including all site assets — untouched.

Every deletion below was verified first: grepped every `.html`/`.js`/`.py`/`.md`
file in the repo for the path/filename before removing it, and confirmed zero
references from the live site (`index.html`, `app.js`, `mika.js`, `mika.html`,
`mouth.js`, `anatomy.js`, `soundwall.js`, the standalone HTML files, `downloads.html`,
`bookmarks.html`, `reversals/index.html`, `build-standalone.py`) and its GitHub
Actions workflow (`.github/workflows/static.yml`).

## Deleted

| Item | Size | Why |
|---|---|---|
| `Keira/` | 429 MB | Personal teaching-resource stash — purchased Twinkl PDFs/PPTX, photos (including `20260816_*.jpg`, a personal `.mp4`), book `.mobi` files. No code reference. |
| `Alika/` | 158 MB | Same — Twinkl poetry packs, zipped lesson packs, a non-fiction image stash. No code reference. |
| `Hop on pop Rhythms.pdf` | 7.3 MB | Dr Seuss derivative (copyright risk), not part of the app, not referenced anywhere. |
| `leveled phonics reading and writing/` (10 subfolders, 30 PDFs) | 6.2 MB | Verified byte-for-byte duplicate content of the PDFs already under `activities/level-1` … `activities/level-8` — filenames matched 1:1 (no extras to move), and while raw `md5sum` differed (the `activities/` copies were re-saved through `pypdf`, stripping "Liam / Google Sheets" metadata), page-by-page pixel rendering (PyMuPDF, all 30 pairs) was byte-identical. Folder path itself was also unreferenced in any HTML/JS. |
| `REPLY_EMAIL_TEMPLATE.txt` | 2.5 KB | Personal email draft, unrelated to the site, unreferenced. |
| 35× `desktop.ini` (all under `Keira/`, `Alika/`, `SATPIN/`, `leveled phonics reading and writing/`, and repo root) | 140 KB | Windows Explorer folder-metadata junk. |

**Total removed from the working tree: ≈ 600.6 MB** (429 + 158 + 7.3 + 6.2 + 0.14 + 0.0025 MB). Confirmed via `du -sh .` before/after: working tree went from including those folders to **27 MB** total (excluding `.git`).

## Moved

| From | To |
|---|---|
| `JAPANESE_TRAINER_SPEC.md` | `docs/JAPANESE_TRAINER_SPEC.md` |

No file referenced `JAPANESE_TRAINER_SPEC.md` by path (grepped all HTML/JS/PY/MD), so nothing needed updating.

## `.gitignore`

Removed the two stale entries that pointed at now-deleted `Keira/` files:
```
Keira/book review/books/airbender comic 1.pdf
Keira/book review/books/Unconfirmed 930461.crdownload
```
Added:
```
desktop.ini
Thumbs.db
.DS_Store
```

## Flagged but kept (not touched — for the owner to decide)

These looked like possible junk/duplicates but weren't in the explicit cleanup
list, so they were left alone:

| Item | Size | References found | Recommendation |
|---|---|---|---|
| `SATPIN/` (5 PDFs + desktop.ini, already removed) | 4.2 MB | None in any HTML/JS/MD. Filenames resemble `activities/level-1` ("aptin"/"Satpin") but content differs — `md5sum` differs **and** page-render hashes differ, so this is an older/different version of the level-1 worksheets, not a true duplicate. | Likely a superseded draft. Safe to delete if the owner confirms `activities/level-1` is the current version, but left in place since it wasn't in the explicit delete list and isn't byte/pixel-identical to anything else. |
| `bopomofo-practice.html` | 1.1 MB | Not linked from `index.html`, `downloads.html`, or any nav. Only mentioned in prose (as inspiration) in `README.md` and `docs/JAPANESE_TRAINER_SPEC.md` — no `<a href>` anywhere. | Orphaned page (self-contained with embedded base64 audio). Keep if it's a live demo the owner shares by direct link; otherwise safe to delete. |
| Root-level `*.png` grapheme images (`A.png` … `Ough.png`, 47 files, only letters A–O, plus lowercase `a.png`) | 188 KB | **Not referenced anywhere** — `app.js` and `mika.js` only use the `audio:` field to build `<grapheme>.mp4` paths; no code path builds or loads a `.png`. Coverage is also partial (stops at "O", i.e. never got to P–Z), suggesting an abandoned poster-frame/thumbnail experiment. | Orphaned leftovers. Safe to delete — recommend removing on a future pass once the owner confirms nothing external hot-links them. |
| `Phonics booklet format.pdf` | 824 KB | Unreferenced by any HTML/JS. | Likely a personal print layout, similar in kind to the kept bookmark/tracker PDFs but not on the explicit keep-list. Left alone; owner's call. |
| `phonics reading cards 1-8.pdf` | 1.7 MB | Unreferenced by any HTML/JS. | Same as above — looks like source material, not code-linked. Left alone; owner's call. |
| `how to print double sided.jpg` | 23 KB | Unreferenced by any HTML/JS. | Small; likely instructional image for the print-related PDFs. Left alone. |
| `mika-standalone.html` | 64 KB | Documented in `README-STANDALONE.md` as one of the two intended downloadable standalone apps, but **not actually linked** from `downloads.html` (only `phonics-standalone.html` and `reversals/index.html` have download buttons there). | Not junk — looks like a real gap in `downloads.html` (missing download button), not a cleanup target. Flagging for the owner since it means `mika-standalone.html` currently isn't reachable from the live site's download page despite being built for that purpose. |

Everything else was left untouched per instructions: all of `sounds/`, all of
`activities/` (including `activities/audio/`), every root `*.mp4` (all 70 are
referenced by the `audio:` field in the `GRAPHEMES` arrays of both `app.js` and
`mika.js`), `bookmarks*.pdf`, `tracker*.pdf`, `phonics tracker and bookmark*.xlsx`,
`elkonin boxes .xlsx`, `vic cursive version.xlsx`, and all core site files
(`index.html`, `app.js`, `mika.html`, `mika.js`, `mouth.js`, `anatomy.js`,
`soundwall.js`, `phonics-standalone.html`, `downloads.html`, `bookmarks.html`,
`reversals/`, `build-standalone.py`).

## A note on git history

`rm`/`mv` only remove files from the **working tree**. Every file deleted above
(all 269 files under `Keira/` and `Alika/`, `Hop on pop Rhythms.pdf`, the
`leveled phonics reading and writing/` PDFs, `REPLY_EMAIL_TEMPLATE.txt`, and the
`desktop.ini` files) still exists in every prior commit and is fully
retrievable by anyone with `git clone` / `git log` access to this repository —
including the Twinkl-licensed worksheets and the photos in `Keira/`.

Because this is a **public GitHub Pages repo**, that matters: purchased Twinkl
resources and photos sitting in git history are still effectively published.
Deleting them from `HEAD` only stops *new* clones' working tree from showing
them by default — the blobs are still fetchable from the remote. Truly
removing them requires a **history rewrite** — `git filter-repo` (or the older
`git filter-branch` / BFG) to strip the `Keira/`, `Alika/`, and
`Hop on pop Rhythms.pdf` paths from every commit, followed by a **force-push**
to `main` (and everyone with a local clone re-cloning afterward, since a
rewritten history is incompatible with their existing branch). This was **not**
done as part of this cleanup — it's a destructive, coordinated operation that
needs the owner's explicit go-ahead and a heads-up to anyone else with a clone.
Recommended as a follow-up.
