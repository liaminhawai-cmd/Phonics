# Recordings

Human voice recordings for every phoneme and every word in the data bank, in
three accents. The app's audio fallback chain is:

**1. human recording here → 2. TTS stand-in (`tts/` subtree, generated) → 3.
live browser speechSynthesis.**

So nothing blocks on recording: drop a file in and that item upgrades itself.

## Layout & naming

```
recordings/
├── au/phonemes/<phoneme id>.mp3      e.g. ay.mp3, oo_long.mp3, dh.mp3
├── au/letters/<a-z>.mp3              the alphabet name only, e.g. letters/b.mp3 = "bee"
├── au/words/<word id>.mp3            e.g. boat.mp3, bridge.mp3
├── au/words-segmented/<word id>.mp3  optional: "boat … b-oa-t … boat"
├── uk/…                              same four folders
├── us/…                              same four folders
└── tts/{au,uk,us}/…                  machine-generated stand-ins (same names)
```

- Filenames come from ids in `data/phonemes.json` and `data/words/words.json`
  — **never rename**; the app finds audio by id.
- `letters/` is a separate namespace from `phonemes/` on purpose: the letter
  *name* ("bee") and the phoneme *sound* (/b/) are different clips that can
  share a single-character id (`b`) without colliding, because they live in
  different folders. Not app-wired yet — the plan is to splice
  `letters/<x>.mp3` + one or more `phonemes/<id>.mp3` on the fly per grapheme,
  replacing the old single-clip `<Grapheme>.mp4` recordings ("A, /a/, /ay/,
  /ah/" all said in one take) with a composed sequence built from these
  reusable pieces.
- mp3 preferred (m4a/wav/mp4 accepted; mp3 wins if duplicates exist).
- One item per file. Words: say the word once, naturally. Phonemes: the pure
  sound, ~1s, **no schwa tacked on** (say /mmm/, not "muh") — stops (p, b, t,
  d, k, g) get the shortest possible release.
- Accent owns its list: AU records everything (base accent); UK and US record
  their full phoneme sets plus every word — accent-specific pronunciations
  (BATH words, yod words) are exactly why per-accent word files exist.
- The word id is the AU spelling entry (`mum.mp3`); US-variant spellings
  (`mom`) are separate entries with their own files.

## Checklists

`python3 scripts/build_recording_manifest.py` regenerates, per accent:

- `recordings/<accent>/CHECKLIST.md` — tick-box list of every file wanted,
  split phonemes/words, marking what already exists (for AU it also credits
  the legacy `sounds/<ipa>/` recordings so you don't re-record those 40).
- `recordings/<accent>/manifest.csv` — `kind,id,filename,exists,notes` for
  spreadsheet people.

Re-run it whenever the word bank grows; it never deletes audio.

## Recording session tips

- Same mic, same room, same distance for a whole batch; phone voice-memo in a
  quiet carpeted room is genuinely fine.
- Batch by checklist order (it follows the bank), say each item twice, keep
  the better take.
- Trim silence to ~0.2s each side; keep loudness consistent (the manifest
  README links items in bank order so an editor can split a single long take).
- UK/US partners: send them their `CHECKLIST.md` + this file; any format, you
  convert with ffmpeg: `ffmpeg -i in.m4a -codec:a libmp3lame -q:a 4 out.mp3`.

## TTS stand-ins

`python3 scripts/tts_standin.py --accent au uk us` synthesises every **word**
missing a human recording into `recordings/tts/<accent>/words/` using neural
voices (edge-tts: en-AU-Natasha, en-GB-Sonia, en-US-Jenny). Isolated
**phonemes** can't be reliably synthesised (TTS insists on reading letters as
names/words) — phonemes stay human-recorded: AU already has 40/44+ in
`sounds/`; UK/US phoneme sets are the one thing partners must actually record
first. The app treats `tts/` as second preference automatically.
