# Adding a scope & sequence (the 3-step recipe)

Adding program #7 or program #57 is the same amount of work: **one shorthand
file, one command, one commit.** No app code changes — the app discovers
programs from the generated `index.json`.

## 1. Write the shorthand

Create `data/sequences/src/<id>.seq.txt`:

```
id: my-program
name: My Program
region: AU
view: grapheme_first        # how the program natively presents itself
source: Official scope & sequence chart, 2024 edition
licence: Ordering of taught correspondences (facts); no proprietary text copied
accuracy: optional "reconstructed, verify against official chart" caveat

unit Stage 1: m s f a p t
heart: the, is, a

unit Stage 2: i c b g o d ea=e th=*
review: m s
note: anything worth remembering about this unit
```

Token rules for `unit` lines:

| token | means |
|---|---|
| `s` | the grapheme's **primary** GPC (most frequent sound; the compiler warns when it guessed between several) |
| `ea=e` | exactly that correspondence (ea saying /e/ as in *head*) |
| `th=*` | **every** sound of that grapheme (voiceless *and* voiced th) |
| `ea.e` | a literal GPC id also works |

Phoneme-first programs (`view: phoneme_first`) list each unit as the sound's
spellings: `unit /ay/: ay ai a_e eigh ey` — same tokens, the unit just *means*
"one sound, its graphemes".

## 2. Compile

```
python3 scripts/new_sequence.py data/sequences/src/<id>.seq.txt
```

This resolves every token against `data/gpcs.json`, prints ambiguity
warnings (fix them with `=` tokens if the guess was wrong), writes
`data/sequences/<id>.json`, and rebuilds `index.json` so the app's program
picker includes it.

If the compiler says a GPC doesn't exist, the program teaches a
correspondence our bank lacks — add it to `data/gpcs.json` first (that's a
*bank* improvement that benefits every program, which is exactly the point
of one-bank-many-orderings).

## 3. Validate & commit

```
python3 scripts/validate_data.py
```

Zero errors = commit both the `.seq.txt` (keep it — it's the regenerable
source) and the generated `.json` + `index.json`. CI runs the same validator
plus an index freshness check, so a broken or stale sequence can't merge.

## Licensing rule of thumb

A teaching *order* (which correspondences, which grouping, what week) is
factual information — encode it, attribute it in `source`, and add an
`accuracy` note if reconstructed from memory rather than transcribed. Do NOT
copy a program's lesson text, word lists, mnemonics, characters or chart
artwork into this repo; THRASS-style proprietary charts stay out entirely
(our generic all-spellings chart derives from `gpcs.json` instead).
