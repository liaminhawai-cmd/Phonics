# The Data Bank

Scope-and-sequence-agnostic phonics data. Every teaching program (ELC bookmarks,
UFLI, Letters & Sounds, custom…) is just an *ordering* over this one bank — the
bank itself never changes when you switch programs.

```
data/
├── phonemes.json        the 44 sounds (+ teaching-unit variants), AU/UK/US
├── gpcs.json            every grapheme→phoneme correspondence (the join table)
├── words/words.json     the word bank: spelling + syllables + GPC segmentation
├── sequences/*.json     scope & sequences as orderings over gpcs.json
├── rules/rules.json     spelling rules, each with a lesson + practice word sets
├── morphemes/*.json     prefixes, suffixes, Latin roots, Greek forms, matrices
└── schema/              JSON Schemas (validated by scripts/validate_data.py)
```

## ID conventions

- **Phoneme ids** are short ASCII teaching names, stable forever, filesystem-safe
  (they double as recording filenames): `p b t d k g ch j f v th dh s z sh zh h
  m n ng l r w y` · `a e i o u oo_short` · `ay ee igh oa oo_long` · `ow oy` ·
  `ar or er air ear ure` · `schwa`. See `phonemes.json` for the full records.
- **Grapheme spellings** are written as they appear (`ai`, `igh`, `dge`). Split
  digraphs use an underscore: `a_e`, `e_e`, `i_e`, `o_e`, `u_e`.
- **GPC ids** are `<grapheme>.<phoneme id(s)>`, e.g. `ai.ay`, `c.s`, `ea.e`,
  `x.ks`. One grapheme with three sounds = three GPCs. The GPC is the atomic
  unit that sequences teach and that the tracker scores.
- **Word ids** are the lowercase spelling; homographs get a suffix (`read.past`).

## Word segmentation format

Each word is a list of segments; each segment is one grapheme mapped to one (or
occasionally more) phonemes:

```json
{ "word": "boat", "syllables": 1,
  "segments": [ {"g":"b","p":"b"}, {"g":"oa","p":"oa"}, {"g":"t","p":"t"} ] }
```

- `p` is a phoneme id, or an **array** when one grapheme spells several sounds
  (`{"g":"x","p":["k","s"]}` in *box*, `{"g":"u","p":["y","oo_long"]}` in *unit*).
- **Split digraphs**: the segment carries `"split": true` and sits at the vowel's
  position; its first letter renders in place and its final `e` renders after
  the following consonant segment(s):
  `cake → [{"g":"c","p":"k"}, {"g":"a_e","p":"ay","split":true}, {"g":"k","p":"k"}]`
- **Reconstruction rule** (what the validator enforces): concatenate each
  segment's grapheme letters in order — for a `split` segment, emit all letters
  except the final `e` in place and append that `e` after the next non-split
  segment. The result must equal the word's spelling exactly.
- **Accents**: the default segmentation is Australian English. Where US/UK
  differ in *phoneme identity* (not mere realisation), add an override:
  `"accents": {"us": {"segments": [...]}}`. Mere realisation differences
  (rhotic `ar`, FACE quality) live inside `phonemes.json`, not per word.
  Different spellings (mum/mom) are different word entries linked by
  `"variant_of"`.

## Recordings

Recording filenames derive from ids — `recordings/<accent>/phonemes/<phoneme id>.mp3`
and `recordings/<accent>/words/<word id>.mp3` with `<accent>` ∈ `au | uk | us`.
The app falls back: real recording → TTS stand-in → browser speechSynthesis.
Legacy AU phoneme recordings live in `sounds/<ipa (ex[a]mple)>/`; each phoneme
record's `recording.legacy_sounds_folder` maps to them.

## Validation

`python3 scripts/validate_data.py` checks: all ids referenced anywhere exist,
every word's segments reconstruct its spelling, every GPC's example words
actually contain that GPC, and every sequence teaches only real GPC ids. Run it
after ANY data edit. CI should run it too.
