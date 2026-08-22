# 🇦🇺 Australian English Vowel Trainer

> **This repo is now a full phonics platform** built on one
> scope-and-sequence-agnostic data bank (`data/`: 44 phonemes with AU/UK/US
> pronunciations, 172 grapheme-phoneme correspondences, 1000+ segmented
> words, 32 spelling rules with lessons, morpheme matrices) — the master
> plan lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Pages:
>
> | | |
> |---|---|
> | `index.html` | the grapheme trainer below, now with a program picker (ELC bookmarks, UFLI, Letters & Sounds, Jolly Phonics, Sound Waves, LLLL…) |
> | `explorer.html` | any program in both views — graphemes-in-order or every-spelling-of-every-sound — with a "taught up to" slider and live decodable-word lists |
> | `practice.html` | student tasks: sound & syllable counting, listen & write with error-aware feedback and rule micro-lessons, grapheme toggle, build-a-word, handwriting, morpheme word-builder — all tracked per child |
> | `report.html` | teacher view: decode/encode mastery heatmaps, auto-written strengths & weaknesses, export/import, printable |
> | `sheets.html` | printable A4 worksheets for any program/unit/accent with QR codes that play the words aloud (`play.html`) |
> | `handwriting.html` | Victorian Modern Cursive practice with stroke-order/direction/placement scoring |
>
> Learner data stays on the device (IndexedDB) — nothing is uploaded.
> Recording checklists for AU/UK/US voices live in `recordings/`.

A flashcard-style drill for learning Australian English vowel sounds — modelled
on bopomofo practice. You **pick the sounds you want to work on**, then go into
**flashcard mode**: hear the sound, write or type your answer, check it, and
self-grade. Sounds you've got drop out of rotation; the tricky ones keep coming
back until the deck is empty.

🔗 **Live:** https://liaminhawai-cmd.github.io/Phonics/

📥 **Download standalone apps:** https://liaminhawai-cmd.github.io/Phonics/downloads.html

## Pronunciation Hub

The phoneme-map hub lives on the ELC student hub, not in this repo:
https://liaminhawai-cmd.github.io/ELC-Pages/pronunciation.html
(consonant place×manner map, playable vowel chart, diphthong glides, tongue
twisters, sound patterns). This repo hosts the grapheme trainer and will host
the per-phoneme teacher recordings the hub links to.

## How it works

1. **Pick your sounds** — tap the vowels you want to practise (or *Select all*).
2. **Drill them** — for each card:
   - 🔊 The sound auto-plays (Australian English). Tap to replay.
   - ✏️ **Handwrite** the IPA symbol on the canvas, or ⌨️ **type** it.
   - **Check answer** reveals the IPA, description and example words.
   - Self-grade: **✓ Got it** removes the card from rotation, **↻ Practise
     again** sends it to the back of the deck.
3. **Finish** — when every card is learned you get a summary, and can jump
   straight into reviewing just the tricky ones.

## Vowels included (Australian English transcription)

**Monophthongs:** `/iː/` fleece · `/ɪ/` kit · `/e/` dress · `/æ/` trap ·
`/aː/` palm · `/ɔ/` lot · `/oː/` thought · `/ʊ/` foot · `/ʉː/` goose ·
`/a/` strut · `/ɜː/` nurse · `/ə/` comma

**Diphthongs:** `/æɪ/` face · `/ɑe/` price · `/oɪ/` choice · `/æɔ/` mouth ·
`/əʉ/` goat · `/ɪə/` near · `/eː/` square · `/ʊə/` cure

Transcription follows the broad Australian English convention used by
[australianlinguistics.com](https://australianlinguistics.com/speech-sounds/vowels-au-english/).

## Running locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no dependencies — just static HTML/CSS/JS. Sound uses the
browser's built-in `en-AU` speech synthesis voice (quality varies by
browser/OS; Chrome and Edge tend to have a clear Australian voice).

## Deployment

Pushing to `main` triggers a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that publishes to GitHub Pages.

## License

MIT
