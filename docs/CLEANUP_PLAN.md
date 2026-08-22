# Cleanup Plan — 2026-08-22

A follow-up to `CLEANUP_REPORT.md` (2026-08-19). That pass removed two
personal folders, 429 MB and 158 MB, each named for a child. **The larger one is
back** — re-pushed at 1.1 GB with different contents — and a 623 MB
`PNG Language Program/` folder has arrived with it. The working tree is
**1759.7 MB**; `.git` is **2.0 GB**.

> **A note on the paths below.** Two folders in this repo are named after
> children, and one file is named after its author. Because this document will
> itself be committed to a public repo — and would outlive the files it
> describes — those names are written here as `<child-first-name>/` and
> `*Resume.docx` rather than spelled out. Each still resolves to exactly one
> path; the literal names were handed to whoever runs the deletions.

This document is a *plan*, not a record: nothing here has been deleted. The
value in both folders has already been mined into `data/` (see
[What was extracted](#what-was-extracted)), so every path below can go.

**Deleting all of it frees 1736.4 MB and leaves a 23.3 MB working tree.**

---

## (a) Personal / privacy — 1107.5 MB

| Path | Size | Why |
|---|---|---|
| `<child-first-name>/` | 1106.8 MB | Folder named for a child. 405 files: a personal ebook and audiobook library plus school work. Nothing app-related. In a public repo this is the whole privacy problem in one directory. |
| `PNG Language Program/PNG Language Program/phonics differentiation materials/worksheet clipart/*Resume.docx` | 0.199 MB | **A full CV**: real name, mobile number, personal email address, complete employment history and every school worked at. Published. |
| …`/worksheet clipart/word/`, `/customXML/`, `/docProps/`, `/_rels/`, `/[Content_Types].xml` | 0.505 MB | The **same CV a second time**, unzipped into loose parts. `word/document.xml` is the CV as plain readable XML — it does not even need Word to read. |

> **This is the urgent group.** The CV is more exposing than the child's name:
> a phone number and a personal email address sitting in plaintext XML on a
> public GitHub Pages repo. It should go first, and it is the strongest single
> reason to do the history rewrite described at the end.

## (b) Copyrighted third-party — 611.6 MB

| Path | Size | Why |
|---|---|---|
| `PNG …/phonics differentiation materials/worksheet clipart/` (everything not listed in (a)) | 611.0 MB | Commercial stock art — 75 `.zip` downloads plus their extracted `.eps`/`.jpg`/`.ai`, in stock-library naming (`2209.i211.020.S.m012.c13…`, `8628714.eps`). Licensed for worksheet use, not for redistribution from a public repo. Includes 2 bundled Noto `.ttf` files. |
| `PNG …/phonics differentiation materials/pictures/dud.png` | 0.585 MB | Single worksheet image, origin unattributed. |

Also copyrighted, but already counted inside `<child-first-name>/` in group (a):

| What | Size | Why |
|---|---|---|
| 141 × `.mp3` | 919.8 MB | Complete commercial **audiobooks** (Pratchett, Douglas Adams), split into numbered parts. |
| 49 × `.mobi` + 48 × `.original_mobi` | 121.6 MB | **Kindle ebooks** and Calibre's backup copies of the same books. |
| `<child-first-name>/Persuasive/t2-e-310-persuasive-texts-checklist_ver_3.pdf` | 0.19 MB | Twinkl resource (the `t2-e-310…_ver_3` name is Twinkl's own). |
| 45 × Animorphs `.pdf`, `Where's My Cow_.pdf`, Chinese readers | ~20 MB | More commercial ebooks. |

> The previous report flagged Twinkl PDFs as a copyright risk. This is a
> different order of magnitude: a redistributable copy of someone's Audible and
> Kindle libraries.

## (c) Duplicates — 1.354 MB (+ 88.1 MB subsumed)

Exact and near-duplicates that sit **outside** groups (a) and (b), so these are
real additional savings:

| Delete | Size | Keep instead | Why |
|---|---|---|---|
| `first 4 bookmarks double sided.pdf` | 0.155 MB | `bookmarks double sided.pdf` | Its 8 pages are pages 1-8 of the full file, identical text. |
| `first 4 bookmarks.pdf` | 0.135 MB | `bookmarks.pdf` | Same 20 graphemes as page 1 of the full file, different column order only. |
| `first 2 bookmarks.pdf` | 0.073 MB | `bookmarks.pdf` | 10 graphemes — a subset of the subset. |
| `PNG …/9507.jpg` | 0.907 MB | `worksheet clipart/chair.jpg` | Byte-identical (md5 `189abc03243d`). Both in (b) territory anyway. |
| `PNG …/Tracker draft B.pdf` | 0.084 MB | `Tracker draft A.pdf` | Same tracker, but B carries the corrupted sound column (see [the xlsx note](#the-spreadsheets-sound-column-is-wrong)). A is the correct one. |

**Subsumed — no extra saving, listed for completeness.** An md5 pass over the
whole repo found **33 exact-duplicate groups totalling 88.1 MB**, and all of
them are inside folders that groups (a) and (b) already delete wholesale:

- **75 stock `.zip` files vs their own extracted contents** — every `.zip` in
  `worksheet clipart/` was unzipped in place next to itself, so the `.eps`/`.jpg`
  pair exists twice. That alone is ~157 MB of the clipart pile.
- Same image saved under two names (`8546.eps` / `8546_1.eps`, `sing.jpg` /
  `6b1a_n20l_220317.jpg`, `hip.zip` / `hip-bones-human-body.zip`, …).
- `<child-first-name>/book review/books/hw/T3W10…BW_13___.pdf` — **three identical copies**
  (2.52 MB each), plus a duplicated pair of `T3W9…`.
- The 48 `.original_mobi` files are Calibre backups of the 49 `.mobi` files.
- 61 × `desktop.ini`, all byte-identical Windows junk (`.gitignore` already
  ignores this pattern, so these are pre-existing tracked files).

## (d) Superseded by the sheet generator — 15.99 MB

`sheets.html` + `js/views/sheets.js` now generate these on demand, for **any**
program and unit, in six types: `reading`, `listen-initial`, `listen-middle`,
`listen-end`, `segment`, `choice`.

**Repo-native worksheets — 35 files, 10.12 MB. Keep 3 (1.40 MB), delete 32 (8.72 MB).**

| Keep | Size | Why this one |
|---|---|---|
| `activities/level-2/SMOBC initial sounds look and write.pdf` | 1.313 MB | The *look & write* picture layout is the one kind the generator **cannot** reproduce — it has no clipart. Keep one as the visual target if that mode is ever built. |
| `activities/level-1/aptin initial sounds listen and write.pdf` | 0.057 MB | Representative *listen & write* layout. |
| `SATPIN/Satpin reading cards.pdf` | 0.027 MB | Representative *reading cards* layout. |

Delete the other 32: the remaining 5 `look and write`, 18 `listen and write` and
9 `reading cards` / `Reading words` files across `activities/level-1` …
`activities/level-8` and `SATPIN/`.

> ⚠️ **This one breaks the site if done naively.** All 30 `activities/level-*/*.pdf`
> are wired into `BOOKMARK_RESOURCES` in **`app.js`**, and that table is mirrored
> into **`phonics-standalone.html`**, **`mika.js`** and **`mika-standalone.html`**.
> Deleting the PDFs without editing those four files leaves dead download links
> in the live app. `SATPIN/` and every root-level PDF/xlsx are unreferenced by
> any HTML or JS and can be removed freely.

**`PNG …/Bookmark QR links/` — 20 files, 7.456 MB. Keep 1 (0.184 MB), delete 19 (7.27 MB).**

Per-level initial/middle/end sound worksheets for levels 1-7 of the PNG
sequence — the same three types the generator makes, and the sequence itself is
now encoded in `data/sequences/png-language-program.json`. Keep
`Level 1/SATPIN initial sounds.pdf` as the layout reference.

---

## Keep

### Extracted this pass — the reason the folders can go

| Path | Why |
|---|---|
| `data/sequences/src/png-language-program.seq.txt` | Shorthand source for the PNG scope & sequence. Regenerable, human-editable. |
| `data/sequences/png-language-program.json` | Compiled: **16 units, 69 GPCs**. Appears in the program picker automatically. |
| `data/assessments/png-phonemic-awareness.json` | 8 levels, 94 segmenting + 122 blending items, pass mark 7/10. |
| `data/assessments/png-phonics-screener.json` | Letter names + 7 levels of grapheme sounds, with its decision rules. |
| `data/assessments/png-morphology-screener.json` | 9 sections, 77 spelling items, 70% skip threshold. |
| `data/assessments/README.md` | Provenance, schema, and the source documents' own inconsistencies. |
| `data/gpcs.json` (+4 entries) | `y_e.igh`, `ght.t`, `eu.yoo`, `gh.g` — correspondences the PNG program teaches that the bank lacked. Bank now 176 GPCs; these benefit every program, not just this one. |

### Source artefacts worth keeping (or archiving privately) — 2.33 MB

| Path | Size | Why |
|---|---|---|
| `PNG …/PNG phonics tracker and bookmarks.xlsx` | 0.497 MB | The source of the 16-level sequence. Keeping it lets the extraction be re-checked. |
| `PNG …/PNG Phonemic Awareness Assessment.docx` | 0.011 MB | Source of `png-phonemic-awareness.json`. |
| `PNG …/PNG Phonics Assessment (6).pdf` | 0.048 MB | Source of `png-phonics-screener.json`. |
| `PNG …/MorphologyScreener-1 (1).pdf` | 0.045 MB | Source of `png-morphology-screener.json`. |
| `PNG …/Tracker draft A.pdf` | 0.084 MB | The **correct** printed tracker — the tie-breaker that caught the spreadsheet's bad sound column. |
| `PNG …/Senior bookmarks.pdf` | 0.849 MB | The one visual artefact of the PNG sequence's printed bookmarks. |
| `PNG …/Bookmark QR links/Level 1/SATPIN initial sounds.pdf` | 0.184 MB | Worksheet layout reference (from group (d)). |
| 3 representative worksheets | 1.397 MB | Listed in group (d). |

> These are **third-party instruments** (all three assessments attribute
> themselves to *Reading by Science*). Their structure is now in `data/` under a
> facts-only extraction. The documents themselves are a licensing question — see
> [Decisions for a human](#decisions-for-a-human).

### Untouched — existing repo assets

Everything else stays: the site (`index.html`, `app.js`, `mika.*`, `sheets.html`,
`js/`, `data/`, `scripts/`, `tests/`), the grapheme `.mp4`/`.png` pairs and
`sounds/`, `recordings/`, `reversals/`, `design-sketches/`, and the root-level
printables that are *not* duplicates — `bookmarks.pdf`,
`bookmarks double sided.pdf`, `tracker.pdf`, `phonics reading cards 1-8.pdf`,
`Phonics booklet format.pdf`, `elkonin boxes .xlsx`, `vic cursive version.xlsx`.

---

## Decisions for a human

1. **The CV is the emergency, not the child's name.** A real mobile number and
   personal email address are readable in plaintext XML on a public repo, and
   have been since the folder was pushed. Nothing in this plan un-publishes
   them — only the history rewrite does.
2. **`<child-first-name>/` contains a commercial audiobook and ebook library** (~1.04 GB of
   Audible/Kindle content), not the "school work stash" it was described as.
   Deleting from `HEAD` does not un-distribute it.
3. **`phonics tracker and bookmark.xlsx` vs `… Vic Modern Cursive.xlsx`**
   (0.312 MB each) — verified as the same workbook: identical shared strings,
   identical 32 media files, differing only in one font declaration
   (`Vic modern cursive` added) plus incidental `docProps`/`calcChain` noise.
   Not filed as a duplicate because the font variant may be deliberate — a
   teacher may want both the print and the cursive version. Delete the plain one
   only if that is not the case.
4. **Third-party assessment documents.** The extraction in `data/assessments/` is
   facts-only and safe to publish. The source `.docx`/`.pdf` files are *Reading
   by Science* instruments; check licensing before leaving them in a public repo,
   or move them to private storage and keep only the JSON.
5. **Group (d) requires a code edit.** Decide whether to update
   `BOOKMARK_RESOURCES` in `app.js` (and its three mirrors) before or with the
   PDF deletions. Do not delete those 30 files on their own.
6. **`.gitignore` has stale entries** pointing at PNG game `.pptx` files that are
   not on disk (`Morphology Games/`, `Phonemic Awareness Games/`, `Phonics Games/`).
   Either those folders were never pushed or they were dropped — worth confirming
   nothing valuable is missing, since the assessments reference lessons and games
   1-9 that this repo does not have.

---

## What was extracted

### The spreadsheet yielded a real scope & sequence

`PNG phonics tracker and bookmarks.xlsx` is both a tracker *and* a sequence. Its
`tracker` sheet lays out **16 levels × 4 graphemes** (with overflow rows at
levels 1, 7 and 10), and the `Junior bookmarks` / `senior bookmarks` sheets print
the same 16 groups as bookmarks. Compiled to **16 units, 69 GPCs**, with no
ambiguity warnings.

Two things the cross-check settled:

- The far-right columns of the `tracker` sheet (colour bands: White, pastel
  yellow, … Red) are **not** part of this program — they are a pasted copy of
  this repo's own `elc-bookmarks` sequence (APTIN / SMOBC / GHKDE / LFRVU /
  JWZXY …), presumably for comparison. Not re-extracted.
- Level 4's third item reads `oo` in the tracker but `Oo` in both bookmark
  sheets, with the sound given as short *o*. It is the letter **o**, not the
  digraph.

#### The spreadsheet's sound column is wrong

For nine consonants the `tracker` sheet lists the **voiced partner** instead of
the sound taught: `t`→/d/, `p`→/b/, `c`→/g/, `ck`→/g/, `j`→/ch/, `f`→/v/,
`ph`→/v/, `z`→/s/, `gh`→/g/. `Tracker draft B.pdf` repeats the same corruption;
**`Tracker draft A.pdf` has the correct sounds** and matches the primary
correspondences the compiled sequence uses. Levels and grapheme order are
unaffected — only that one column. Recorded in the sequence's `accuracy_note`.

### Assessments

Structure only — item lists, order, task type, pass marks, decision rules. No
instructional prose copied. Each file carries a `source_inconsistencies` array
recording the originals' real slips (printed totals that disagree with printed
item counts, items duplicated across levels, a missing `j` in the letter-ID row,
a morphology total of /71 against sections summing to 77).

**Checked for student data: none.** Name and date fields were blank on every
copy. No child, teacher, school or email appears in anything written this pass.

### Considered and deliberately not extracted

The xlsx `Spelling guide` sheet (a sound→graphemes table with mnemonic names —
"Bouncy B", "Crunchy C", "Hissing SH"). The correspondence data it holds is
already in `data/gpcs.json` in better form, and `HOW_TO_ADD.md` explicitly rules
out copying another program's mnemonics.

### Verification

```
python3 scripts/validate_data.py            0 errors, 0 warnings — gpcs:176
python3 scripts/build_sequence_index.py --check   up to date (8 sequences)
node tests/run.js                           60 passed, 0 failed
python3 -m json.tool  on all 4 new JSON files     parse clean
```

---

## Git history — the 2.0 GB elephant

`CLEANUP_REPORT.md` recommended a history rewrite on 2026-08-19. **It was not
done.** The evidence is `.git`, which is **2.0 GB** against a 1.76 GB working
tree — it is still carrying every blob from the 429 MB `<child-first-name>/` and 158 MB
second folder that pass deleted, and it will carry these ones too.

Deleting the paths in this plan removes them from the working tree and from
future checkouts. It does **not** remove them from the repository. Every file
listed above stays fully retrievable by anyone who can clone this repo:

- the CV, with its phone number and personal email address
- the folder named for a child
- ~1.04 GB of commercial audiobooks and ebooks
- 611 MB of licensed stock art

On a **public** GitHub Pages repo, "still in history" means "still published".

Truly removing them needs **`git filter-repo`** to strip that child-name folder,
`PNG Language Program/`, the two earlier child-named folders, and
`Hop on pop Rhythms.pdf` paths from every commit, then a **force-push** to
`main`. That is destructive and coordinated: it rewrites every commit hash, so
anyone with a clone must re-clone. It needs the owner's explicit go-ahead.

Two things that should happen alongside it, and are easy to forget:

- **The exposed phone number and email address should be treated as already
  public**, because they have been. A rewrite stops further distribution; it
  does not retract what has been fetched.
- **GitHub caches unreachable objects.** After the force-push, ask GitHub Support
  to purge them, or the blobs stay reachable by direct SHA URL.
