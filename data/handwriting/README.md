# Handwriting letterforms

Stroke-level letter models that drive the handwriting task (trace → copy →
from-memory) and its scoring: stroke count, order, direction, start point,
shape ($P/DTW distance), and placement on the dotted thirds.

One file per regional style. Three exist:

| file | taught in | what makes it that style |
|---|---|---|
| `letterforms-vic-modern-cursive.json` | Australia (VIC) | unjoined cursive, exit strokes, `c` is the mother shape |
| `letterforms-uk-continuous-cursive.json` | England | every letter leads in from the baseline and exits ready to join; only a dot or a crossbar lifts the pen |
| `letterforms-us-manuscript.json` | United States | upright print, circles and straight lines, separate strokes, no entry or exit |

`js/tasks/t9_handwriting.js` picks one from the learner's accent
(`au`/`uk`/`us`), and mastery is keyed per style — writing `a` in Victorian
cursive does not show you can write it as US print.

**Whose letters these are.** Named school hands — Zaner-Bloser, D'Nealian,
Letter-join, Nelson — are commercial products; their outlines and their
names belong to their publishers. What is *not* ownable is the convention:
that US manuscript is upright with separate strokes, that English
continuous cursive leads in and exits. The two new files are drawn to those
conventions from scratch by `scripts/build_letterforms.py`. No outline is
traced and no product is named; a test fails if one ever is. Rendering
guides from these paths needs no font at all.

Later, if wanted: `nsw-foundation`, `qld-beginners`.

## Coordinate system

Letter box is 0-100 wide (advance width varies per letter via `width`), with
the **dotted-thirds lines fixed at y = 0 (top line), 33.3 (dotted mid), 66.6
(baseline), 100 (descender floor)**. x-height letters live between 33.3 and
66.6; ascenders reach toward 0; tails drop below 66.6.

## Schema

```json
{
  "style": "vic-modern-cursive",
  "display_font": { "name": "Victorian Modern Cursive", "licence": "Free for education from VIC DET; do not commit the font file unless licence confirmed" },
  "letters": {
    "a": {
      "width": 55,
      "zone": "x-height",              // x-height | ascender | descender | mixed
      "family": ["anticlockwise-loop"],
      "strokes": [
        { "path": "M 42,44 C 30,36 14,40 12,52 C 10,64 22,70 32,66 C 39,63 42,56 42,47", "dir": "anticlockwise", "start_zone": [36,50,12,12] },
        { "path": "M 42,44 L 42,62 C 42,66 46,68 50,65", "dir": "down-then-exit", "start_zone": [36,38,12,12] }
      ],
      "exit": [50,65],                 // where the joining stroke leaves (cursive styles)
      "common_errors": ["clockwise-circle", "start-at-bottom", "floating-above-baseline"]
    }
  },
  "families": {
    "anticlockwise-loop": { "letters": ["c","o","a","d","g","q"], "teach": "Start at 2 o'clock, curve up and over to the left. c is the mother shape.", "order": ["c","o","a","d","g","q"] },
    "tall-sticks":        { "letters": ["l","t","b","h","k"],      "teach": "Start at the top line, pull straight down.", "order": ["l","t","h","b","k"] },
    "tails":              { "letters": ["g","j","p","q","y"],      "teach": "The tail dives under the baseline and hooks.", "order": ["j","y","g","p","q"] },
    "humps":              { "letters": ["r","n","m","h"],          "teach": "Down, back up the same line, over the hump.", "order": ["n","m","r","h"] },
    "zigzags":            { "letters": ["v","w","x","z","k"],      "teach": "Straight lines, sharp changes.", "order": ["v","w","z","x","k"] }
  }
}
```

- `strokes` are ordered; each `path` is an SVG path in letter-box coords,
  `dir` a human label used in feedback ("you drew it clockwise — this letter
  goes the other way"), `start_zone` an [x, y, w, h] rect the first touch
  should land in.
- `family` links the letter to feature-family lessons: an error on the shared
  feature schedules the family lesson, not 26 letter lessons.
- Scoring resamples the child's strokes and the model paths to N points and
  compares (see docs/ARCHITECTURE.md §9).

Digits and capitals get `"0"–"9"`, `"A"–"Z"` keys in the same file. Vic
Modern Cursive joins are modelled by `exit` points plus per-pair join rules —
added when the joining unit ships (a later milestone; unjoined letters first).

`letterforms-vic-modern-cursive.json` currently contains the pilot set
(anticlockwise-loop family + l, t, i, n) to lock the schema; the remaining
letters are traced in milestone M5.
