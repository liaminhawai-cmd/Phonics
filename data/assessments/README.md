# Assessments

Machine-readable *structure* of assessments the app should eventually be able to
administer and score: what each one tests, in what order, and how it is marked.

```
data/assessments/
├── png-phonemic-awareness.json   8 levels, blending + segmenting items
├── png-phonics-screener.json     letter names + 7 levels of grapheme sounds
└── png-morphology-screener.json  9 sections, spelling task
```

## What is and isn't in here

These files carry **facts**: item lists, the order they are given in, task type,
pass marks and decision rules. They deliberately do **not** reproduce the source
documents — no instructional prose, no page layout, no artwork. Each file's
`administration` and `scoring` objects paraphrase the rules in as few words as
the app needs to run them.

Every file also has a `source_inconsistencies` array. The originals are working
classroom documents and contain real slips — printed totals that don't match the
printed item counts, items duplicated between levels, one missing letter. These
are recorded rather than silently corrected, because a teacher comparing the app
against their paper copy needs to see the same numbers. **Fix them only against
the source program, not by guessing.**

## Provenance

All three came from the `PNG Language Program` folder that was pushed into this
repo. Their internal attribution:

| File | Attributes itself to |
|---|---|
| `png-phonemic-awareness.json` | levels follow the **Reading by Science** phonemic-awareness scope and sequence |
| `png-phonics-screener.json` | pairs with the **Reading by Science** phonics units and smartboard games |
| `png-morphology-screener.json` | titled "The Reading by Science Morphology Screener" |

So the intellectual origin of all three is **Reading by Science**, adapted and
re-titled for local use by the PNG Language Program. Treat them as third-party
instruments: attribute them, don't republish the documents themselves, and check
current licensing before shipping the assessments in a public build.

The source documents contained no student data — the name and date fields were
blank on every copy — and no names of any kind appear in these files.

## Relationship to `../sequences/`

`png-phonics-screener.json` is a 7-level intervention screener and is **not** the
same ordering as `../sequences/png-language-program.json`, which is the program's
16-level teaching scope & sequence taken from its tracker spreadsheet. They come
from the same folder and both call their groups "levels"; they are different
things and should not be merged.

## Schema notes

- `type` is one of `phonemic_awareness`, `phonics_grapheme_knowledge`,
  `morphology_spelling`.
- Blending items are stored **already segmented**, as arrays of the parts the
  assessor reads aloud: `"was"` is `["w","a","s"]`. Those parts are the source's
  own splits, which are graphemic rather than strictly phonemic in places
  (`w/a/lk`, `c/arr/y`) — that is what the assessor says, so it is preserved.
- Segmenting items are stored as plain lowercase words; the source prints some
  of them capitalised, which carries no meaning.
- `printed_out_of` / `out_of` is the denominator **as printed on the sheet**,
  which is not always the number of items. See `source_inconsistencies`.
