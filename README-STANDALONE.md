# Downloadable Standalone Version

One fully self-contained HTML file for offline use or distribution.

## `phonics-standalone.html`
The complete **My Phonics** in a single file — every program (including
UFLI Foundations), both practice modes, the Sound Wall, and the optional
trilingual captions (English / Mandarin / Cantonese). All HTML, CSS, JS
and data embedded; nothing to fetch once it's on the device.

For Mika's setup — UFLI Foundations, trilingual captions on — open it
with the same hash the online version uses:

    phonics-standalone.html#seq=ufli-foundations&tri=1

The `#hash` is part of the URL, not a network request, so it works from
a `file://` path exactly the same as it does online. Bookmark that exact
link (or save it as a desktop shortcut) and Mika's copy always opens
straight into the right program and language, offline included.

## How to Use

1. **Download** `phonics-standalone.html` to your computer or device.
2. **Place the audio files** in the same folder:
   - `A.mp4`, `B.mp4`, `C.mp4` … `Ough.mp4` (70 MP4 audio files from the repo root)
   - the `recordings/` folder, if you want the real Australian voice recordings rather than the synthesised stand-in
3. **Open** the HTML file in any modern web browser (Chrome, Safari, Firefox, Edge, etc.).
4. **No internet required** once those are in place.

### Note on Audio
The app looks for audio files relative to the HTML file's location. If they aren't present, the app still works, but "Listen to check" and "Play sound" won't produce audio.

## For Offline Sharing

If you want to share the trainer with a group:
1. Create a folder (e.g., `Phonics-Trainer/`)
2. Put `phonics-standalone.html` in it
3. Copy the MP4 files (and `recordings/`, if using real recordings) into the same folder
4. Zip the entire folder and share
5. Recipients just extract and open the HTML file — appending `#seq=ufli-foundations&tri=1` to the file path if it's Mika's setup they want

## Remediation Links

The app includes links to:
- **Demo videos** (Google Drive links — requires internet)
- **Activity PDFs** (stored locally in the `activities/` folder — optional)

The demo video links only work with internet access and the original Drive folder shared. To make the app fully offline, remove those links or host the videos locally.
