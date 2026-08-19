# Sequences

A sequence is just an *ordering* over `data/gpcs.json` — it never defines new
sounds or spellings, only the order a program teaches ones that already exist
in the shared bank. Swapping the active sequence never changes what a GPC
*is*, only when a learner meets it.

## The model

- Every unit's `teaches`/`review` arrays hold GPC ids (`<grapheme>.<phoneme
  id>`), always — never raw letters or sounds, and always the same ids
  regardless of which program you're looking at.
- `native_view` records which direction the program itself teaches in:
  `grapheme_first` (letter → its sounds, most UK/AU synthetic phonics) or
  `phoneme_first` (sound → its spellings, e.g. Sound Waves). Author each file
  in its own native orientation.
- The app derives the *other* view automatically by regrouping the same GPC
  ids through gpcs.json — nobody hand-maintains both directions.
- `heart_words` reference `data/words/words.json` ids for irregular
  high-frequency words a program front-loads before the phonics catches up.
- `custom-template.json` is the empty starting point for a teacher's own
  order — same schema, any subset/order of GPCs, either native_view.

## THRASS

THRASS is a licensed commercial chart-based approach (grapheme chart, not a
teaching order); we don't ship its chart — a generic "all spellings of each
sound" chart view is derived from gpcs.json itself, which serves the same
purpose without infringing.
