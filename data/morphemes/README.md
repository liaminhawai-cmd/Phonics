# Morphemes

Prefixes, suffixes, Latin roots, and Greek forms for morphological-awareness
teaching (GE 4-8 / intermediate-advanced readers) — the affix-and-root layer
that sits above phonics once students are decoding multisyllable words.

```
morphemes/
├── prefixes.json      17 prefixes: 10 frequency-ranked + 7 found only inside matrices
├── suffixes.json      15 suffixes: 10 frequency-ranked + 5 found only inside matrices
├── latin-roots.json   18 frequency-ranked Latin roots
├── greek-forms.json   20 frequency-ranked Greek forms
├── matrices.json      the 25 word-assembly matrices (18 Latin + 7 Greek)
└── word-key.json       744 assembled words, each split into its morphemes
```

## Attribution

Developed from **Morpheme Matrices: Sequential or Standalone Lessons for
Assembling Common Prefixes, Latin Roots, Greek Forms, and Suffixes** by Marn
Frank, ATLAS Literacy & STAR Coordinator (ABE Teaching and Learning
Advancement System, a program within Hamline University's College of Liberal
Arts, School of Education), expanded March 2018. The original was produced
with support from a Minnesota Department of Education (MDE) grant using
federal funding (CFDA 84.002 / Minnesota Statute §124D.522) and is distributed
as a free teacher resource. The frequency-ranked charts of prefixes, suffixes,
and roots in the source are themselves drawn from Marcia K. Henry's
*Unlocking Literacy, Effective Decoding & Spelling, 2nd Edition* (Paul H.
Brookes Publishing, 2010).

The data here was extracted from that PDF for use in this phonics/morphology
teaching app. It is not an official ATLAS/Hamline data product — see
`extraction_notes` in each file for extraction caveats.

## Schema

`prefixes.json` / `suffixes.json` / `latin-roots.json` / `greek-forms.json` are
each `{ source, extraction_notes, <key>: [...] }` where each record is:

```json
{
  "id": "in_im",
  "spellings": ["in", "im"],
  "meaning": "in, into, or toward",
  "examples": ["inform", "informs", "informed", "informing", "informer"],
  "frequency_rank": 1
}
```

`frequency_rank` follows the source's printed frequency order (1 = most
common); it is `null` for morphemes that appear only inside a matrix's own
prefix/suffix box, not on the p.3-5 frequency charts. `examples` is drawn
from `word-key.json` by cross-reference — a morpheme with no matrix-derived
example word (e.g. `un-`, `mis-`, `en-/em-`, `-ly`, none of which appear in
any of the 25 matrices) has an empty array rather than an invented one.

`matrices.json` is `{ source, extraction_notes, matrices: [...] }`, one record
per matrix:

```json
{
  "id": "matrix_01",
  "root": { "spelling": "form", "origin": "latin", "meaning": "to shape", "status": "free" },
  "prefixes": { "common": ["in", "re", "de"], "less_common": [] },
  "suffixes": { "inflectional": ["s", "ed", "ing"], "derivational": ["er", "ation", "al"] },
  "example_words": ["forms", "formed", "..."],
  "teaching_notes": "Latin-root matrix ... Follow the source's 8 explicit instruction steps ..."
}
```

Latin-root matrices (1-18, p.6-23) have `origin: "latin"` and a `prefixes`
block matching the matrix's own printed prefix boxes. Greek-form matrices
(19-25, p.25-31) have `origin: "greek"`; their `prefixes.less_common` holds
the left-column Greek forms shown in that position of the matrix (e.g. `bio`,
`chrono`, `hydro`) since the matrix structure treats them the same way as a
prefix slot. `example_words` is exactly the matrix's Word Key list, so it is
always consistent with `word-key.json`. The blank template matrix on p.32 is
a teacher worksheet with no content and is not included (25 matrices, not
26).

`word-key.json` is `{ source, extraction_notes, words: [...] }`:

```json
{ "word": "imported", "morphemes": ["im", "port", "ed"], "root": "port", "matrix": "matrix_02" }
```

`morphemes` gives the word-sum split using canonical morpheme spellings (the
`imported -> im + port + ed` convention); ordinary English spelling changes on
concatenation — silent-e drop, consonant doubling (`fer -> ferred`), y/i
shifts — are not re-inserted. `root` is the matrix's printed root/form label;
`matrix` is the matrix id it was assembled in. A handful of Word Key words use
left forms that appear nowhere in their matrix's own diagram (marked
`"(plus ...)"` in the source, e.g. Matrix 22's `homophone`/`megaphone`); these
are kept with best-effort splits and flagged in `matrices.json`'s
`extraction_notes`.

## Extraction notes (see each file for the full list)

- Segmentation of all 744 Word Key words into morphemes was done
  programmatically (prefix/root/suffix string matching, including a fallback
  for doubled-consonant spellings like `referred`), then spot-checked; a
  small number of genuinely irregular words (`suspicion`, `continent`,
  `meteorology`, the Greek "plus" bonus words) were overridden by hand and are
  called out explicitly rather than silently forced to fit.
- One source typo was corrected: Matrix 18's Word Key repeats `expounder`
  twice where the parallel word families (`impound-`, `compound-`) all follow
  an -s/-ed/-ing/-er pattern; the first occurrence was corrected to
  `expounded` by that pattern (flagged in `matrices.json`).
- `contention` and `contentions` are listed under both Matrix 15 (`tend, tent,
  tens`) and Matrix 17 (`tain, ten, tin`) in the source's own Word Key; both
  entries are kept in `word-key.json` rather than de-duplicated, since the
  source itself assembles the word from two roots.
