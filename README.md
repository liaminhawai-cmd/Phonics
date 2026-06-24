# 🇦🇺 Australian English Vowel Trainer

A flashcard-style drill for learning Australian English vowel sounds — modelled
on bopomofo practice. You **pick the sounds you want to work on**, then go into
**flashcard mode**: hear the sound, write or type your answer, check it, and
self-grade. Sounds you've got drop out of rotation; the tricky ones keep coming
back until the deck is empty.

🔗 **Live:** https://liaminhawai-cmd.github.io/Phonics/

📥 **Download standalone apps:** https://liaminhawai-cmd.github.io/Phonics/downloads.html

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
