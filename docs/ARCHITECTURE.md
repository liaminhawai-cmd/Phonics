# The Phonics App — Architecture

*The ultimate phonics app: one data bank, every scope & sequence, every direction,
every accent, from first sounds to Greek roots.*

This document is the master plan. The data bank under `data/` is already real;
each numbered milestone at the bottom turns one more section of this document
into working software. The existing trainer (index.html + app.js), mika
(articulation face), the mouth videos, the sound wall, the bookmarks and the
worksheet PDFs are all *early versions of components described here* — nothing
is thrown away, everything gets absorbed.

---

## 1. Principles

1. **One bank, many orderings.** Phonemes, graphemes, correspondences (GPCs),
   words, rules and morphemes live in ONE scope-and-sequence-agnostic data bank
   (`data/`). A teaching program — ELC bookmarks, UFLI, Letters & Sounds, Jolly
   Phonics, Sound Waves, or a teacher's custom build — is nothing but an
   *ordering* over that bank. Toggling programs never changes content, only
   which GPCs are "taught yet" and in what groups.
2. **Every sequence has two faces.** A program is stored in its native
   orientation (UFLI/bookmarks = grapheme-first, Sound Waves = phoneme-first)
   but the app *derives the other view automatically*: any sequence can be
   browsed as "the graphemes in taught order, with their sounds" **or** "the
   phonemes, with every taught spelling of each." The generic
   all-spellings-of-every-sound chart (THRASS-style, but derived from our own
   `gpcs.json`) is just the phoneme-first view of the whole bank.
3. **Both directions, tracked separately.** Reading a grapheme → sound and
   hearing a sound → grapheme are different skills. Every GPC is tracked as two
   independent mastery records (`decode` / `encode`). Reports show both grids.
4. **Errors are information.** Every wrong answer is classified (§7) and routed:
   to a rule micro-lesson, a contrast drill, an articulation video, or just
   back into the review queue.
5. **Gradual release everywhere.** Every task family has a scaffolding ladder
   (§6) from fully-supported to independent; the app moves the learner up and
   down the ladder automatically.
6. **Accent-aware.** AU (Vic) is the base; UK and US are first-class: separate
   recordings, separate IPA realisations (in `phonemes.json`), per-word
   overrides where phoneme identity differs (BATH words, yod words), and
   accent-appropriate handwriting fonts.
7. **Offline-first, no accounts required.** Static site + PWA; learner data in
   the browser (IndexedDB) with export/import. A sync backend is a *later,
   optional* layer, never a prerequisite. No student data ever enters this
   (public) repo.

---

## 2. What already exists and where it slots in

| Existing asset | Becomes |
|---|---|
| `app.js` grapheme trainer + bookmark levels | Task T1/T2 (§5) + the `elc-bookmarks` sequence, refactored to read `data/` |
| `mouth.js` + `anatomy.js` + `i18n.js` (mika.js absorbed — now `#seq=ufli-foundations&tri=1` on the main app) | The articulation engine, driven by `phonemes.json` articulation fields |
| Root `*.mp4` mouth videos (70, all referenced) | Grapheme-level articulation clips, indexed by GPC |
| `sounds/<ipa>/` AU recordings | Legacy phoneme recordings; mapped via `recording.legacy_sounds_folder`, superseded by `recordings/au/phonemes/` |
| `soundwall.js` | The phoneme-first view of the active sequence |
| Vowel synth (in trainer) | Phoneme playground; extended to consonant articulation demos |
| `activities/*` worksheet PDFs + QR audio | Outputs of the sheet generator (§5, SHEETS) — the generator reproduces and supersedes hand-made sheets |
| `phonics tracker and bookmark*.xlsx`, bookmarks PDFs | Source of truth already encoded into `data/sequences/elc-bookmarks.json` |
| `elkonin boxes .xlsx` | Task T3/T4 layout reference |
| `reversals/` | The b/d/p/q confusion drill; wired into error routing (§7) |

---

## 3. The data bank (`data/`)

See `data/README.md` for id conventions and the segment format. Entities:

- **Phoneme** (`phonemes.json`) — 44 sounds; per-accent IPA; articulation
  features that drive mika/anatomy; lexical set; recording filename. Plus
  *teaching units* (x = /k/+/s/, qu = /k/+/w/, long-u = /y/+/oo/).
- **GPC** (`gpcs.json`) — one grapheme spelling one sound, with legal
  positions, frequency band, examples, links to rules. *The atomic unit of
  teaching and tracking.*
- **Word** (`words/words.json`) — spelling, syllable count, ordered GPC
  segments (split digraphs marked), tags, tier, heart-word parts, accent
  overrides. A word's *decodability under a sequence* is computed, never
  stored: `decodable(word, sequence, unit_n) = every segment's GPC taught by
  unit_n`. The same computation against a learner's mastery set gives
  *personal decodability* — this is what makes drag-and-drop trays, CVC
  unlocks and sheet generation automatic for ANY sequence.
- **Sequence** (`sequences/*.json`) — ordered units of GPC ids + heart words,
  with a native view flag and print colours (bookmarks keep their exact
  printed colours). **Adding sequence #7 or #57 is the same three steps**
  (`sequences/HOW_TO_ADD.md`): write a plain-text shorthand
  (`src/<id>.seq.txt`), run `scripts/new_sequence.py` (resolves graphemes to
  GPC ids, warns on ambiguity, regenerates `sequences/index.json`), run the
  validator. The app discovers programs ONLY through `index.json` — no
  program names in code, ever — and CI fails if the index is stale, a
  sequence references an unknown GPC, or a file breaks schema. Fifty more
  programs = fifty shorthand files.
- **Rule** (`rules/rules.json`) — teacher + kid statements, lesson, practice
  words, and `toggle_sets` that feed the grapheme-toggle task directly.
- **Morphemes** (`morphemes/*.json`) — prefixes/suffixes/Latin roots/Greek
  forms, 25 build-a-word matrices, 700+ word key (§10).

`scripts/validate_data.py` enforces referential integrity and that every
word's segments reconstruct its spelling exactly. Run it in CI on every push.

---

## 4. Audio & articulation subsystem

**Recording store** (see `recordings/README.md` for the full spec):

```
recordings/{au,uk,us}/phonemes/<phoneme id>.mp3     44 + teaching units per accent
recordings/{au,uk,us}/words/<word id>.mp3           one per word in the bank
recordings/{au,uk,us}/words-segmented/<word id>.mp3 optional: word said, then segmented
```

**Playback fallback chain** — the app asks for audio through one function:

```
human recording (recordings/) → pre-generated TTS file (same paths, tts/ prefix)
→ live browser speechSynthesis (en-AU / en-GB / en-US voice)
```

So the app works TODAY with synthesised voices, and every file you (AU) or
your UK/US recording partners drop in silently upgrades that item.
`scripts/tts_standin.py` pre-generates the whole store with neural TTS voices
so even the stand-in is consistent across devices.

**Articulation layer.** Every phoneme card/task can show, on demand: the mouth
video (existing mp4s), the mika face animation, and the anatomy cutaway with
the place-of-articulation marker — all keyed off `phonemes.json`
(`articulation.place` strings match `anatomy.js` SPOTS on purpose). The vowel
synth becomes a "make the sound with your mouth" explorer: drag the tongue
position, hear the formants, see the nearest phoneme.

### 4a. Listening to the child (`js/core/listen.js`, `js/core/mic-ui.js`)

The app can hear *some* of what a child says, and the design rule is that it
must say which. `listen.js` is pure analysis over `Float32Array + sampleRate`
— no DOM, no microphone — so it is testable in Node against synthesised audio
(`tests/synth.js`). `mic-ui.js` is the browser half: `getUserMedia`,
hold-to-talk, calibration storage.

| Cue | Verdict | How |
| --- | --- | --- |
| voicing (/s/–/z/, /f/–/v/, /p/–/b/) | **measured** | autocorrelation clarity + f0 |
| is there frication at all | **measured** | spectral flatness |
| sibilant place (/s/ vs /sh/) | **measured** | spectral centroid above 1500 Hz |
| vowel quality | **measured, relative** | LPC formants vs the child's own space (§4b) |
| /f/ vs /th/, /v/ vs /dh/ | **asked** | near-identical spectra; carried visually |
| stop place (/p/ vs /t/ vs /k/) | **asked** | unreliable from a lone burst |

Three decisions the measurements forced, each with a test that fails if it is
undone:

- **The sibilant centroid is taken above 1500 Hz.** A voiced fricative's voice
  bar drags the whole-spectrum centroid down by thousands of Hz, so /z/ read
  *lower* than /s/ purely for being voiced. Above the bar the place cue stands
  alone.
- **"Is there air" uses flatness, not energy-above-3kHz.** The obvious energy
  rule rejects /z/, /zh/, /v/ and even an adult /sh/: a voiced fricative's
  energy sits low while its spectrum stays noise-flat. The two groups separate
  by ~100x on flatness.
- **Children are not small adults.** A five-year-old's tract is ~2/3 an adult
  male's, so formants and fricative centroids sit far higher and adult tables
  would fail most children. `calibrate()` records the child's own /s/–/sh/
  midpoint and pitch; grading prefers that over any table, and refuses to
  build a split when the child's two sounds land on top of each other, so a
  muddle is never enshrined as their boundary.

Verdicts are `heard` / `close` / `quiet` / `ask`. `ask` is not a failure mode
— it is the honest one, and it carries a question a five-year-old can answer
about their own mouth ("Was your tongue poking out between your teeth?")
next to the zoomed articulation cutaway.

### 4b. Vowels are a tongue position, so the app draws one

A vowel has no contact point to point at — it *is* a shape — so instead of
a still picture it gets animated: the correct tongue movement first, then
the child's own on the same diagram, so the difference is the thing that
moves.

F1 rises as the mouth opens; F2 rises as the tongue comes forward. That is
the vowel quadrilateral, and `anatomy.js` already speaks it: `pose(x, y)`
with x back, y open. `vowelPose()` maps one onto the other.

Two things the numbers forced:

- **Backness is F2 − F1, not F2.** As the mouth opens F1 climbs towards F2
  and they converge, so raw F2 put a textbook `/aː/` 24 units too far
  forward — the app would have corrected a correct tongue.
- **The fit targets the diagram's own positions**, not a normalised 0–100
  box. Normalising pins `/ʉː/` to "100% back" when it lives at 72, so a
  perfect `/ʉː/` would draw a correction every time. `ANCHOR` restates
  where `/iː/`, `/aː/` and `/ʉː/` sit; a test fails if it drifts from
  `mouth.js`'s `VOW` table, since animating to one place while grading
  against another makes every correction quietly wrong.

**Certainty governs how loudly it speaks.** A child at 260 Hz gives
harmonics 260 Hz apart, so F1 near 500 Hz is described by two of them and
LPC has little to work with. `vowelPose()` returns a confidence that drops
when formants crowd, when pitch is too high to resolve F1, and when there
is no personal reference — and `vowelFeedback()` **widens its tolerance as
confidence falls**. Correcting a child on a reading already labelled "a
rough guess" is the worst thing this layer could do: they move a tongue
that was right, on the app's say-so. Nothing voiceless or fricative is
placed at all — breath and chair scrape still produce LPC peaks, and those
peaks are not a tongue.

Calibration therefore records five sounds, not three: `/s/` and `/ʃ/` for
the hiss scale, and `/iː/ /aː/ /ʉː/` for the corners of the vowel space.
Without the vowel corners a vowel can still be placed, but only roughly,
and the UI says so.

**Where it appears.** `listen.html` is the diagnostic page: point it at a real
child and see every reading behind every verdict, with a running tally. Look &
Say has a mic button that offers the same opinion — but never marks the card.
The child's Got it / Missed it is untouched, because an app that says "wrong"
about a sound it cannot distinguish teaches a child to stop believing it.

### 4b-ii. Watching the tongue move

`vowelPose()` reads one moment; `trackVowel()` reads a whole utterance, so
a child can watch their own tongue travel — live while they speak, and
replayed with their own voice afterwards.

The replay is the one that teaches. Live, a child is busy making the sound;
on the replay they can actually watch. It plays **before** the model,
deliberately: showing the target first tells them the answer before they
have looked at what they did.

Two things make a track more than a sequence of poses:

- **Smoothing.** LPC picks a wrong peak now and then, and one bad frame
  throws the tongue across the mouth. A median of three kills single-frame
  outliers without lagging; an EMA after it turns the rest into movement
  rather than jitter.
- **Gaps are gaps.** Most of a recording is not a placeable vowel —
  silence at the ends, a consonant in the middle. Those frames come back
  as `null` and the UI *holds* the last position. A tongue that flies home
  between every sound reads as a fault, not as a limit of what the mic
  can see.

`makeTracker()` is the rolling version for live audio and `trackVowel()`
the offline one; a test drives the same buffer through both and fails if
they disagree, because what a child watches live has to match what the
replay shows them. `steadiest()` finds where the tongue stopped rather than
where the sound was loudest — the loudest instant can be the attack,
mid-glide.

**This needed an FFT.** `spectrum()` was a naive DFT: 59 ms for one 2048
frame, so a full `analyse()` capped out at 16 fps — fine once per attempt,
hopeless for a tongue. The radix-2 FFT brings it to 2.8 ms (22×), and a
test checks it against the old transform, which is kept as the oracle and
as the fallback for a frame that isn't a power of two.

### 4b-iii. Framing a close-up so a child knows what they're looking at

A consonant close-up is only obvious if you already know what a mouth looks
like from the side. A child does not, so the framing has to do that work.

`WINDOWS` in `anatomy.js` gives each place of articulation a `[cx, cy, w]`
window; `PHONEME_WINDOWS` overrides it per sound, because two sounds made in
the same place can want different framing — `/t/` and `/s/` are both
alveolar, but a tap and a held hiss don't read at the same zoom.

The first pass cropped far too tight. Seen side by side in the tuner, `/t/`,
`/s/` and `/k/` were a wall of pink tongue with no landmark in frame, and a
child cannot orient in a picture whose only content is the thing that moves.
Every window is now ~25–35% wider and sits a little higher, so at least two
fixed landmarks — teeth, the palate arc, the lip line — stay in shot for the
moving part to move against. Wider is not automatically better: past about
`w=44` the contact dot shrinks to a speck and a close-up stops being one.

`/h/` has **no** window on purpose, so it shows the whole head. It is the one
consonant with no constriction in the mouth at all — just breath through an
open tract — and a close-up of a larynx tells a five-year-old nothing.

`tools/closeup-tuner.html` is where this gets decided: all 24 consonants,
each close-up beside the whole head with its crop drawn on, three sliders,
and a copyable `PHONEME_WINDOWS` table of only what you changed. It also
toggles the optional **"you are here" inset** — a small head silhouette in
the corner with a box round the part being shown, the inset-map trick.
That is off by default in the app; it reads as an abstract shape at tile
size, so it wants a teacher's eye before it ships.

Both the window table and the diagram CSS are inlined into
`phonics-standalone.html`, which is generated by `build-standalone.py`. Tests
compare both against `anatomy.js` and fail on drift — a tuning pass that only
lands in `anatomy.js` would otherwise leave that build with the old crops.

### 4b-iv. One grapheme, several sounds

`<a>` says three sounds; `<ough>` says six. 31 of the 124 graphemes in the
bank say more than one. Grading one attempt against one target either marks
a right answer wrong or accepts anything, so each sound gets its own box —
and the boxes fill **in whatever order the child says them**.

This is set matching, not sequence matching. There is no correct order for
the sounds a letter makes, and grading position by position would punish a
child for something that isn't an error. `matchSounds()` scores an attempt
against every box still empty and claims the best one. Each box is its own
GPC, so mastery lands where it belongs instead of three sounds sharing a
score.

**Three ways it refuses to guess:**

- *Too alike.* `/ʉː/` and `/ʊ/` in `<oo>` sit 15 apart on a chart whose
  honest tolerance is 18. When two boxes score within the margin, nothing is
  claimed — both light up and the child taps the one they meant. Those two
  boxes reveal their example word ("food" / "put"), because a choice between
  two blanks is not a choice.
- *Best match, weak evidence.* `<th>` says `/θ/` and `/ð/`. A voiceless
  attempt beats `/ð/` on voicing, but `grade()` still says "ask" —
  voiceless-weak-fricative is equally `/f/`. The box waits for the picture
  question. The two refusals compose rather than one overriding the other.
- *Not one of them.* The nearest target's coaching still shows: "pull your
  tongue forward" beats "that isn't one of them".

**Diphthongs are matched on the whole path.** `/eɪ/` and `/aɪ/` in `<ey>`
finish in the same place and set off 65 apart; `/aɪ/` and `/aʊ/` in `<ow>`
set off together and finish 58 apart. Either endpoint alone gets one of
those pairs wrong, so both count — start weighted 0.6, finish 0.4.

Two gates stop a vowel filling the wrong kind of box, and both were caught
by tests rather than by reading:

- A vowel that **travelled** can't fill a held-vowel box. `/aɪ/` sets off
  from exactly where `/ɑː/` lives, so without this a child saying "igh"
  fills the "ah" box and is told they were right.
- A vowel that **stayed put** can't fill a diphthong box. A held `/iː/` sits
  near both ends of `/eɪ/` and scored well enough to claim it. A diphthong
  target now requires at least half its own travel.

### 4c. Hand cues, and whose they are

The app can show a hand cue beside a sound. It ships with **no cue
content**: `data/cues/index.json` lists systems as *slots*, and the videos
that fill one live under `cues/<system>/<accent>/<phoneme id>.mp4` on the
machine of whoever recorded them.

Every system carries a `publish` flag, because two things that look
identical are not the same act:

- Recording yourself performing a cue system to use with your own class —
  which is what the training is for.
- Publishing a complete free video reference of that system, in a public
  repo, next to the books, posters and app its publisher sells.

`publish: false` means the second one is off. `.gitignore` excludes
`cues/*` and re-admits publishable systems by name — an allow-list, so a
system added later is out until someone opts it in. `scripts/check_cues.py`
is the backstop, because `.gitignore` is advice: it inspects what git is
*actually tracking* and fails on anything restricted, which catches
`git add -f` and files that were tracked before the rule existed. A test
runs it.

A restricted system must also record `rights.holder`, `rights.ask` and
`rights.why`. The reason matters most: a future reader with a deadline
will flip the flag unless the file says what breaks.

**Cued Articulation (Jane Passy)** is the worked example. Content © Jane
Passy, John Botham and Helen Botham; published by ACER Press, who also sell
their own Cued Articulation app. `publish: false` until written permission
exists, recorded in the `rights` block with date and scope.

**Accents are not just a re-record.** Cues map to phonemes, so the cue set
follows the phoneme inventory: AU and UK (SSB) are close but not identical,
and US differs more — rhotic vowels, no BATH split, the cot-caught merger.
And Cued Articulation is an AU/UK system; the US equivalents (Visual
Phonics / See the Sound, or Cued Speech, which is a different thing again —
Cornett's syllable-based system for deaf access, not articulation teaching)
are separate systems with their own rights. A US slot is a different
recording *and* a different permission conversation.

### 4d. Recordings that were cut off in export

A truncated clip is the failure mode that doesn't look like one: the file is
there, it decodes, it plays. A missing file falls through the chain above; a
50 ms fragment of someone saying "ay" does not — it plays, as a click.

`scripts/check_recordings.py` finds them by parsing MPEG frame headers (no
ffmpeg, no installs, runs in CI), reading the Xing/LAME tag for the encoder's
frame count minus its delay and padding — which is what a browser actually
plays. Walking frames alone overstates a short clip by ~60 ms of padding,
enough to make a fragment look like a real sound. Validated against Chromium's
decoder on all 93 clips, agreement within 0.1 ms.

Floors come from where this repo's recordings actually separate, not a guess:
sorted by length there is a clear gap per folder, and the clips below it are
the same ones still at 40–230% of their average peak when the file ends.
`recordings/clips.json` carries the durations and the flagged list; `audio.js`
treats a flagged clip exactly like a missing one. A test re-runs the checker
and fails if the report is stale.

---

## 5. The task engine

A task is a pure function: `generate(taskType, sequence, masterySet, accent,
options) → exercise`. All tasks draw from the same bank, so every task
automatically works for every sequence, every accent, and every learner state.

| id | Task | Core interaction |
|----|------|------------------|
| T1 | Grapheme → sound (existing trainer) | See grapheme, say/type/handwrite the sound |
| T2 | Sound → grapheme | Hear phoneme, pick/write every spelling taught so far |
| T3 | Sound & syllable counting | Hear word, tap out syllables, then push a counter per phoneme (Elkonin) |
| T4 | Listen & write (spelling) | Hear word → count sounds → one box per phoneme → best-guess grapheme per box; per-box feedback (§7) |
| T5 | Grapheme toggle | Boxes pre-segmented; tap a box to cycle candidate spellings of that phoneme (o → oa → ow → oe…); rule variants use `rules.toggle_sets` (sauce/jaw/pour: "aw does the end job") |
| T6 | Drag-and-drop decode/build | Tray of grapheme tiles — scaffold A: only mastered graphemes appear; scaffold B: full tray, slots labelled; scaffold C: full tray, no labels |
| T7 | Decoding practice | Word cards from the bank filtered to personal decodability; model audio on demand; optional self-record + compare |
| T8 | CVC → CCVC → CVCC… writing | Unlocked constructions (§8) with the learner's mastered GPCs as the default palette |
| T9 | Handwriting | Trace → copy → from-memory with live stroke scoring (§9) |
| T10 | Morpheme matrix | Build words from a matrix, split words into morphemes, match meanings (§10) |
| T11 | Sound → letters | Hear a sound, handwrite its spelling on dotted thirds — one lane per letter. Formation is scored objectively against the letterform models; the letter *choice* is credited only when the writing clears a legibility floor AND the child confirms it, because the app cannot read handwriting and must not log a spelling error over a human's "no" |
| SHEETS | Sheet generator | Renders any of the above as a printable PDF (Elkonin boxes, dotted thirds, QR to the word audio) — regenerates the whole `activities/` catalogue for ANY sequence at ANY level, including UK/US versions. Lives at `sheets.html`, not a registered practice task |

**Mistake flow (T4/T5/T8):** wrong box → immediate feedback tuned by error
type (§7) → "sound it out with me" replay (segmented audio + boxes highlight)
→ if the error was rule-shaped, a 60-second rule micro-lesson interrupt with 3
toggle items → back into the task. Rules track their own mastery, so a learner
who keeps failing `ck_after_short_vowel` gets that lesson scheduled, not just
repeated correction.

---

## 6. Gradual release ladders

Each task family defines scaffold levels; the tracker moves learners along
them (two clean sessions at a level → step up; repeated frustration → step
down). Example, spelling family (T3→T4→T5→T6→T8):

```
L0 model        watch word segmented for you (audio + boxes fill themselves)
L1 count        you count syllables & sounds; boxes appear ready-made
L2 toggle       boxes given; you choose the grapheme per box (tap-to-cycle)
L3 tray         boxes given; you drag graphemes from a limited tray
L4 full tray    all graphemes available; boxes unlabelled
L5 free         blank dotted-thirds line; you write the word by hand (T9 scoring)
```

The same ladder shape exists for decoding (modelled → shared → scaffolded
tray → independent) and handwriting (trace → copy → memory → in-words).

---

## 7. Error taxonomy → routing

Every attempt is logged as `(gpc, direction, position, errorType, taskType,
latency)`. Error types, with their routes:

| Code | Meaning | Example (target "boat") | Route |
|------|---------|--------------------------|-------|
| SEG-OMIT | missed a sound | 3 boxes for "stop" (st as one) | blend/segment drill on that cluster (T3) |
| SEG-ADD | extra sound | 5 boxes for "boat" | syllable/sound counting review |
| SUB-PHON | wrong phoneme heard | writes "bot" hearing /oa/ as /o/ | minimal-pair listening drill (boat/bot), articulation video for the pair |
| SUB-GRAPH-LEGAL | right phoneme, legal spelling, wrong choice | `oe` in the /oa/ box of "boat" | **rule micro-lesson** if a rule decides it (position, etc.); else "this word uses…" + word-specific practice; *counted as phoneme-correct in tracking* |
| SUB-GRAPH-OTHER | grapheme spells a different phoneme | `o` in the /oa/ box | feedback: "o says /o/ — we need /oa/"; contrast card o vs oa; this is your "right grapheme in the box but wrong phoneme" case |
| POS-ILLEGAL | spelling never legal there | "boaw"… `aw` medially | position-rule micro-lesson (`rules.choose_between`) |
| REV | reversal b/d/p/q, was/saw | writes "doat" | `reversals/` drill |
| HEART | tricky part of heart word wrong | "wos" for "was" | heart-word routine (tap the heart part, whole-word practice) |
| FORM | letter formed wrong (T9 signal) | correct letter, bad stroke order | handwriting family lesson (§9) |

The distinction between SUB-GRAPH-LEGAL and SUB-PHON is the pedagogical heart
of the app: a kid who writes "boet" *has segmented correctly and knows a long-o
spelling* — that's a spelling-choice error (teach the rule/convention), not a
phonemic error (teach the sound). The tracker credits the phoneme and debits
the GPC choice; feedback says so explicitly ("You heard /oa/ — yes! This word
spells it o-a.").

---

## 8. Tracking, mastery, unlocks, reports

**Store** (IndexedDB, one profile per learner; export/import as JSON file so a
teacher can move a kid between devices or email a snapshot home):

```
profile { id, name, accent, activeSequence, handwritingStyle }
attempt { ts, taskType, gpc|ruleId|wordId|letterId, direction, errorType, latencyMs, scaffoldLevel }
mastery { key: (gpc, direction) | rule | phoneme-awareness | letter-form,
          state: fresh|learning|mastered|overdue, strength 0-1, due: ts }
```

**Mastery rule** (per key): strength rises with correct-at-speed answers
(rolling window ≈ last 10), falls with errors and with time (spaced-retrieval
decay). `mastered` ≈ ≥90% rolling accuracy at target latency; `overdue` items
re-enter warm-up queues. Fast-but-wrong ≠ slow-but-right: latency is stored so
reports can separate accuracy from automaticity.

**Unlocks** are declarative predicates evaluated against mastery, e.g.:

```json
{ "task": "T8.cvc", "when": { "decode": {"count": 8, "of": "unit<=2"}, "encode": {"count": 5} } }
{ "task": "T8.ccvc", "when": { "task_done": "T8.cvc", "blends_intro": true } }
```

Defaults follow the active sequence, so "CVC writing unlocks when the first
two bookmark levels are mostly mastered" — but the same predicate works if the
learner is on UFLI. The drag-and-drop tray (T6-A) and word filters always
default to the mastered set; teachers can override per session.

**Reports.** For the teacher/parent: the two mastery heatmaps (grapheme-first
grid and phoneme-first grid — same dual view as the sequences), rule
application chart, handwriting per-letter scores, syllable/sound counting
accuracy, and an auto-written strengths/weaknesses summary ("Knows all Level
1-4 letter-sounds both ways; /oa/ vs /o/ discrimination weak; reverses b/d
under time pressure; ck-rule not yet applied when writing"). Printable, and
exportable as the same JSON the import reads.

---

## 9. Handwriting subsystem

**Rendering.** Dotted-thirds guidelines drawn on canvas (Vic convention);
letter models per regional style: `data/handwriting/letterforms-<style>.json`
with styles `vic-modern-cursive`, `nsw-foundation`, `qld-beginners`,
`uk-print`, `uk-precursive`, `us-zaner-bloser`, `us-dnealian`. Each letterform
is an ordered list of strokes; each stroke an SVG path + direction + start
zone. (Fonts for *display* are licensed per state/publisher — Vic Modern
Cursive is free from VIC DET for education; embed only fonts whose licence
allows it, else render from our own stroke paths, which we own.)

**Capture.** Pointer events on canvas → resampled polyline per stroke (time,
x, y, pressure where available).

**Scoring** (per attempt, 0-100 with per-feature breakdown):
1. *Stroke count* matches model;
2. *Order & direction* — greedy match strokes to model strokes; penalise
   wrong order/reversed direction (the classic "drew o clockwise" catch);
3. *Start point* in the model's start zone;
4. *Shape* — $P point-cloud / DTW distance against the model stroke,
   scale-normalised;
5. *Placement & size* — bounding box vs the dotted thirds (x-height letters
   inside the middle third, ascenders reach the top, tails cross the baseline).

**Lessons by feature family**, exactly as you outlined: the anticlockwise-loop
family (c → o → a → d → g → q), tall-stick family (l t b h k), tail family
(g j p q y — "tails hang below the line"), hump family (r n m h), and the
Vic-cursive entry/exit hooks as their own unit. An error in one letter
schedules the *family* lesson, because the deficit is the shared feature, not
the letter. T9 scores also flow into §7 (FORM errors during spelling tasks
don't count against the GPC).

---

## 10. Morphology layer (Morpheme Matrices)

Data from the ATLAS *Morpheme Matrices* resource (attributed in
`data/morphemes/README.md`): 10+10 high-frequency prefixes/suffixes, Latin
roots and Greek forms, 25 matrices, 700-word key.

Tasks (unlock after the phonics core, or teacher-forced for older EAL/catch-up
students who need "something different"):
- **Matrix builder** — matrix on screen (prefixes | root | suffixes); drag
  parts together; app validates against the word key; says the built word.
- **Word sums** — `im + port + ed = ?` and the reverse: split `important`.
- **Meaning hooks** — match roots to meanings; "which word means *carry
  back*?" (re + port).
- **Spelling changes at the joins** — doubling/drop-e/y→i rules (§ rules bank)
  re-taught at the morpheme boundary where they actually bite.

Tracking mirrors GPCs: each morpheme has decode ("what does this part mean")
and encode ("build/spell with it") mastery. Reports extend the same heatmap.

---

## 11. Front-end architecture

Stay **zero-build, static, GitHub Pages** — it's why the current app ships.
Restructure as ES modules:

```
js/
├── core/data.js        loads data/*.json, builds indexes, computes decodability
├── core/audio.js       the fallback chain (§4)
├── core/tracker.js     IndexedDB store, mastery updates, unlock evaluation
├── core/errors.js      error classification (§7)
├── tasks/t1_flash.js … tasks/t11_sheets.js   one module per task family
├── views/sequencePicker.js  program toggle + dual grapheme/phoneme views + custom builder
├── views/report.js
└── handwriting/{capture,score,letterforms}.js
```

- PWA: manifest + service worker precaching `data/` + active accent's
  recordings (recordings are the only big payload; cache on demand per unit).
- `build-standalone.py` keeps producing single-file offline versions per task
  bundle.
- Sheet generation stays in-browser (print CSS → PDF), reusing task
  generators, so a sheet is literally the paper form of the same exercise —
  QR codes point at the word audio like the current sheets.
- Custom sequences: the builder UI writes the same JSON schema to
  localStorage; "export sequence" downloads it for sharing/committing.

**Repo split note:** recordings will eventually outgrow this repo (three
accents × 1000 words). When that happens, move `recordings/` to a separate
repo/CDN and keep paths identical via a base-URL config. Not needed yet.

---

## 12. Privacy & deployment

- Public repo: no learner data, no student names, no photos — ever. Learner
  data lives on-device; exports are teacher-managed files.
- **Microphone audio never leaves the device and is never stored.** There is
  no speech API, no upload, no recording kept: samples go straight from
  `getUserMedia` into the analyser in memory, and what survives is a handful
  of numbers (a verdict, a centroid, a pitch). The calibration in
  `localStorage` is four numbers about a voice, not a voice. The mic track is
  released on every path out of a recording — including touchcancel and
  window blur — so the browser's recording indicator goes out when listening
  stops. This is worth being able to state plainly to a parent.
- `docs/CLEANUP_REPORT.md` lists the personal/copyright material removed from
  the working tree; a git-history rewrite (git filter-repo) is still
  recommended for the old Keira/Alika content before publicising the repo.
- CI: GitHub Action runs `scripts/validate_data.py` on every push (add to the
  existing Pages workflow).

---

## 13. Roadmap

- ✅ **M0 — Foundations.** Data bank (phonemes, GPCs, words, sequences,
  rules, morphemes), validator + CI, recordings folder + manifests, TTS
  stand-in script, repo cleanup, this document.
- ✅ **M1 — One bank, many sequences.** app.js runs on `core/data.js`;
  program picker; Sequence Explorer with dual views + taught-up-to slider;
  standalone build embeds the bank. (Custom-builder UI still pending.)
- ✅ **M2 — Ears and boxes.** practice.html: T3 sound/syllable counting,
  T4 listen & write with the full §7 taxonomy + per-box feedback + rule
  micro-lesson interrupts, T5 grapheme toggle, audio fallback chain.
- ✅ **M3 — Tracker.** core/tracker.js (IndexedDB + localStorage fallback),
  core/mastery.js, unlock predicates, T6 build-a-word with mastered tray,
  report.html (dual heatmaps, auto strengths/weaknesses, export/import).
- ✅ **M4 — Paper parity.** sheets.html: four A4 sheet types for any
  program/unit/accent, deterministic seeds, QR audio links to play.html.
- ✅ **M5 — Hands (Vic first).** core/handwriting/score.js ($P + feature
  gates), full Vic Modern Cursive letterform bank, T9 trace/copy/memory
  with ghost replay on handwriting.html + practice.html. UK/US letterform
  styles still pending.
- **M6 — Accents complete.** UK/US recording drops (checklists ready),
  yod/BATH handling verified end-to-end, per-profile accent switch (basic
  switch shipped in report.html).
- ✅ **M7 — Word parts.** T10 morpheme matrix builder + word sums over the
  ATLAS matrices, morph:* mastery tracking.
- ✅ **M8 — Ears on the child.** core/listen.js (voicing, frication,
  sibilant place, formants; child-relative calibration), core/mic-ui.js,
  listen.html diagnostic page, mic check in Look & Say, honest picture
  questions for the contrasts a microphone cannot hear (§4a).
- **M9 — Nice-to-haves.** Custom-sequence builder UI, optional sync
  backend, class dashboards, self-record-and-compare decoding.
  **Formant-based vowel feedback** is the natural next step now that the
  analyser exists: the pieces are in place (LPC formants, per-child
  calibration), and what it needs is a calibration pass that captures the
  child's own vowel corners so a new attempt can be placed against their
  space rather than an adult chart.
