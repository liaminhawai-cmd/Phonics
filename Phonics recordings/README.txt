HOW TO USE THIS FOLDER
=======================

This is a recording checklist turned into folders. Every folder still
needed is here, already named exactly what the final file should be called
— you never have to work out a filename yourself.

1. Copy the whole "to-record" folder to Google Drive.
2. Share it with whoever is recording (family, colleagues, students' families).
3. Each person opens a folder (e.g. AU/words/bridge.mp3), reads
   "HOW TO RECORD.txt" inside it, records once, and saves their file into
   that same folder. Any filename/format is fine inside — just one file per
   folder.
4. When you get the folder back, copy the whole "to-record" tree into the
   Phonics repo (next to the "recordings" folder) and run:

       python3 scripts/collect_from_folders.py to-record recordings

   That finds every folder with exactly one audio file in it, converts it
   to mp3 if needed, and moves it into recordings/<accent>/<phonemes or
   words>/<exact filename> — matching this app's naming rules. It never
   touches a folder that's still empty, so you can copy this back as many
   times as you like while recordings trickle in.

Counts (still needed):
  AU phonemes: 4
  AU words: 1007
  UK phonemes: 44
  UK words: 1007
  US phonemes: 44
  US words: 1007