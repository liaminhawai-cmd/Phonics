# Sound recordings — drop them in, no renaming needed

One folder per sound of Australian English, named `symbol (example word)` with
**square brackets around the letters that actually make that sound**, so you
can find the right folder without reading IPA:

- `θ ([th]in)` — the *th* in **thin**, no voice
- `ð ([th]is)` — the *th* in **this**, voiced
- `ŋ (si[ng])` — the *ng* at the end
- `ʒ (vi[si]on)` — yes, the *si* is the sound
- `ɔ (h[o]t)`, `ʉː (f[oo]d)`, `ɜː (h[er])`

The brackets also settle the lookalikes at a glance — the same word appears
twice, marked differently each time:

| Consonant | Vowel |
|---|---|
| `b ([b]ed)` | `e (b[e]d)` |
| `s ([s]ee)` | `iː (s[ee])` |
| `g ([g]o)` | `əʉ (g[o])` |

**To add a recording: say the sound on its own, then drag the file into its
folder. That's it.** Any filename, any common format (mp3, m4a, wav, ogg,
webm). When the site deploys, a manifest of every file in here is generated
automatically and the Pronunciation Hub plays your recording instead of its
synthesised stand-in. If a folder has several audio files, the first
alphabetically wins — no harm in extras.

Record Australian English. The hub's accent toggle (Kiwi / UK RP / US) only
moves the synthesised stand-in; a recording is always treated as the Australian
reference.

Word recordings for listening tasks (minimal pairs like ship/sheep) go in a
`words/` subfolder inside each sound's folder — same drop-and-forget rule.

## Two things to know

**These names are Windows-safe.** The folders used to mark the target letters
with asterisks (`θ (*th*in)`), but Windows cannot create a path containing `*`,
so `git clone` failed there with `error: invalid path`. The brackets carry the
same meaning and clone cleanly on Windows, macOS and Linux. The hub reads only
the symbol before the ` (`, so playback is unaffected — don't reintroduce `*`,
`?`, `:`, `"`, `<`, `>` or `|` in folder or file names.

**The 40 folders match the hub exactly** — every sound the Pronunciation Hub
shows has a folder, and there is no folder the hub cannot play. Three sounds of
Australian English are missing from *both*, so there is nothing to record for
them yet: `/j/` (the *y* in **yes**), `/ɪə/` (**near**) and `/eː/` (**square**).
Adding them means adding them to the hub as well, which is a separate change.
