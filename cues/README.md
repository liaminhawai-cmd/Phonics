# Hand-cue videos

One folder per cue system, then per accent, then one clip per phoneme id:

```
cues/<system>/<accent>/<phoneme id>.mp4      e.g. cues/own/au/sh.mp4
```

Phoneme ids are the ones in `data/phonemes.json` — the same ids
`recordings/<accent>/phonemes/` uses, so a cue and its sound always
line up.

## Nothing in here is published unless its system says so

`data/cues/index.json` gives every system a `publish` flag.

- `publish: true`  — the content may live in the public repo.
- `publish: false` — it may exist on your machine and be used in class,
  but it must never be committed. `.gitignore` excludes it, and
  `scripts/check_cues.py` fails if something gets past that.

That distinction is the whole point of the folder. Recording yourself
performing someone else's cue system is fine for your own teaching;
publishing a complete free video reference of that system on a public
site is a different act, and it is the one that substitutes for a
product its publisher sells. The flag keeps the two apart so you can
do the first without accidentally doing the second.

If you get written permission, record it in that system's `rights`
block — who granted it, when, and what it covers — and then set
`publish: true`. Don't flip the flag on a verbal maybe.

## Recording

- Frame head and hands; the cue and the mouth should both be visible.
- Silent or with the sound — the app plays the audio separately, so a
  silent clip is fine and keeps the file small.
- 1–2 seconds. Loop-friendly: start and end in the same rest position.
- MP4/H.264, ~480px tall is plenty. Keep clips under ~200 KB so a
  whole set doesn't bloat the page.
- `scripts/check_cues.py` reports which phonemes are still missing for
  each accent, so you can work through it a sitting at a time.
