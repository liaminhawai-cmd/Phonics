# Japanese Hiragana & Katakana Learning Trainer
## Specification Document for AI Implementation

### Overview
Build a web-based flashcard trainer for Japanese hiragana and katakana characters, modeled after the Aussie Phonics Trainer. The app teaches character recognition and pronunciation through a bopomofo-style drill loop: select characters → flashcard mode → check answer → wrong answers go back in deck → mastered characters drop out → continue until all learned.

---

## Core Features

### 1. Character Sets
**Hiragana (46 base characters + 71 with diacritics)**
- Basic hiragana: あ、い、う、え、お through ん
- Voiced (dakuten): が、ぎ、ぐ、げ、ご through ぼ、ぽ
- Combinations: きゃ、しゃ、ちゃ、にゃ、ひゃ、みゃ、りゃ、ぎゃ、じゃ、びゃ、etc.

**Katakana (46 base characters + 71 with diacritics)**
- All katakana equivalents of hiragana
- Same combinations as hiragana

### 2. Practice Modes (Two-choice interface)
**Mode 1: "Sound → Write" (Listening mode)**
- App plays audio of the character's pronunciation (e.g., "a")
- Learner types or handwrites the hiragana/katakana character
- Auto-check when typed, or "Show answer" for handwritten mode
- Wrong answers go back in the deck; correct answers are mastered

**Mode 2: "See → Say" (Recognition mode)**
- App displays a hiragana/katakana character (large, clear)
- Learner says the pronunciation out loud
- Click "Listen to check" button to hear the correct pronunciation
- Grade themselves: "Got it" or "Missed it"

### 3. Selection Screen
Users can choose:
- **By group** (clickable toggles):
  - Hiragana / Katakana (learn one or both)
  - Basic characters only
  - With dakuten (voiced marks)
  - With combinations (youon like きゃ)
- **By level** (if desired, optional JLPT N5 levels or beginner-to-advanced progression)
- Selection count and "Select all" / "Clear" buttons

### 4. Drill Loop
- Shuffle selected characters into a queue
- Display current character
- Wrong answers: insert back into queue at a random position (so learner sees it again soon)
- Correct answers: move to "Mastered" shelf with pop-in animation
- Progress bar showing cards completed vs. total
- Continue until queue is empty
- Show summary report

### 5. Summary Report
After session:
- Total characters practiced
- How many correct on first try
- Breakdown by attempt count (1st try, 2nd try, 3rd try, etc.)
- List of characters that were missed (for review)
- Button to review/re-drill missed characters
- Button to print/save report

### 6. Remediation (Optional)
If characters are missed, optionally show:
- Links to external learning resources (YouTube, Memrise, etc.)
- Stroke order diagrams or writing guides (images or SVG)
- Example words using each character

---

## Data Structure

Each character object should contain:
```
{
  character: "あ",           // Hiragana or Katakana
  romanization: "a",         // Romaji (Hepburn style)
  audio: "a",                // Audio filename (e.g., "a.mp3")
  type: "hiragana",          // "hiragana" or "katakana"
  group: "basic",            // "basic", "dakuten", "youon", etc.
  jlpt: "N5",                // (Optional) JLPT level
}
```

### Character Groups (for selection toggles)
- **Basic Hiragana**: あいうえお through ん (46 characters)
- **Basic Katakana**: equivalent 46 characters
- **Hiragana Dakuten** (voiced marks): がぎぐげご through ぼぽ (25 characters)
- **Katakana Dakuten**: equivalent 25 characters
- **Hiragana Youon** (combinations): きゃきゅきょ through りゃりゅりょ (33 characters)
- **Katakana Youon**: equivalent 33 characters

---

## UI / UX

### Design Style
- Clean, minimal interface (similar to Aussie Phonics)
- Paper-like aesthetic (cream background, rounded corners)
- Japanese-friendly fonts (support for clear hiragana/katakana rendering)
- Dark ink on light paper, red accent colour for highlights

### Screens

**Screen 1: Practice Mode Selection**
- "Sound → Write" card: "Hear the character, type or handwrite it"
- "See → Say" card: "Read the character, say it out loud, then check"

**Screen 2: Character Selection**
- Toggle buttons for:
  - Hiragana / Katakana (checkboxes)
  - Basic characters (checkbox)
  - With dakuten (checkbox)
  - With youon/combinations (checkbox)
- Visual grid or checklist of all available characters
- Selection count: "X characters selected"
- "Start learning" button (disabled until ≥1 character selected)

**Screen 3: Drill (Flashcard)**
- Progress bar at top ("5 / 20 characters mastered")
- Large character display (or play button for audio)
- Input field (for typing) or canvas (for handwriting)
- Mode toggle: "Type" vs. "Handwrite" (for Sound → Write mode)
- "Check" / "Show answer" button
- Grade buttons: "Got it" / "Missed it" or "Again" / "Got it"
- "Mastered" shelf below showing learned characters
- Exit button (to return to selection screen)

**Screen 4: Report / Summary**
- "Well done!" heading
- Summary stats: "You practiced 20 characters. 15 correct on first try."
- Breakdown by attempt: "First try: あ い う え お…" / "Second try: か き く…"
- Button to review missed characters
- "New session" button to start over

---

## Technical Requirements

### Audio
- **46 × 2 = 92 MP3 or OGG files** (one for each hiragana + katakana character)
- Filenames: `a.mp3`, `ka.mp3`, `sa.mp3`, etc. (Romaji-based)
- Clear, native speaker pronunciation
- Approx. 1–2 seconds per clip

### Features to Implement
1. **Flashcard drill loop**
   - Shuffle → Display → Check → Grade → Reshuffle → Repeat
   - Wrong answers re-queued at random position
   - Correct answers removed from queue
   
2. **Input handling**
   - Text input (compare typed text case-insensitively)
   - Canvas drawing (collect handwriting; accept if user confirms or clicks "Show answer")
   - Audio playback with visual feedback (button changes state while playing)

3. **State management**
   - Track selected characters
   - Track attempts per character
   - Track which characters were missed
   - Calculate first-try accuracy
   
4. **Mastered shelf**
   - Pop-in animation when character is mastered
   - Shows all learned characters during session
   - Empowers learner with visible progress

5. **Responsive design**
   - Mobile-friendly (tablet, phone, desktop)
   - Touch support for handwriting canvas
   - Readable font sizes for small screens

6. **Offline capable**
   - All HTML/CSS/JS in single file or minimal external dependencies
   - Audio files stored locally
   - Can be used without internet once downloaded

---

## Optional Enhancements

1. **Stroke order diagrams**
   - SVG or image for each character
   - Show in report or drill screen
   - Help learners write correctly

2. **Spaced repetition mode**
   - Track learning over time (uses localStorage)
   - Show characters based on forgetting curve
   - Session history & progress graphs

3. **Themed practice sets**
   - Common words (e.g., "Food words in hiragana")
   - Sentence fragments
   - JLPT vocabulary correlated with each character

4. **Multiplayer mode**
   - Race mode: two learners compete on same characters
   - Shared session with scores

5. **Customization**
   - Dark mode
   - Font size adjustment
   - Audio speed (slow/normal/fast)
   - Japanese or English interface language

---

## File Structure

```
japanese-trainer/
├── index.html                    (Main HTML file, can be single-file standalone)
├── app.js                        (Main JavaScript, or embedded in HTML)
├── style.css                     (Styling, or embedded in HTML)
├── audio/                        (Audio files directory)
│   ├── a.mp3
│   ├── ka.mp3
│   ├── sa.mp3
│   └── ... (92 total)
└── README.md                     (Instructions for use)
```

---

## Sample Prompt for Claude/GPT/Codeex

"Build a Japanese hiragana & katakana learning trainer web app, similar to the Aussie Phonics Trainer. The app has:

1. Two practice modes:
   - Sound → Write: Play pronunciation, learner types/handwrites the character
   - See → Say: Show character, learner says pronunciation, click to check

2. Character selection with toggles for hiragana/katakana, basic/dakuten/youon

3. Bopomofo-style drill loop:
   - Shuffle selected characters
   - Wrong answers go back in deck
   - Correct answers appear in 'Mastered' shelf
   - Continue until all learned

4. Summary report with first-try accuracy, breakdown by attempt, and missed characters

5. Data: 46 basic hiragana + 46 basic katakana, plus dakuten and youon combinations (total ~200 characters)

6. Audio: MP3 files in an 'audio/' folder, filename = Romaji (a.mp3, ka.mp3, etc.)

7. Design: Paper-like aesthetic (cream bg, dark ink, red accents), mobile-friendly, offline-capable

8. Downloadable as a single-file standalone HTML with all JS embedded"

---

## Success Criteria

✅ Learner can select character sets and practice  
✅ Audio plays correctly  
✅ Typing/handwriting input works and is checked accurately  
✅ Drill loop implements spaced repetition (wrong answers requeue)  
✅ Mastered shelf animates and shows progress  
✅ Report summarizes session accurately  
✅ App works offline with audio files in same folder  
✅ Mobile & desktop responsive  
✅ Can be downloaded and shared as standalone HTML  

---

## References

- **Aussie Phonics Trainer** (original model): GitHub repo link or live demo
- **Hiragana/Katakana charts**: https://en.wikipedia.org/wiki/Hiragana (or Japanese education references)
- **Audio sources**: Google Translate, Forvo, or native speaker recordings
- **Romanization standard**: Hepburn (most common in English learning contexts)

---

## Next Steps

1. Prepare all 92+ audio files (or use TTS to generate)
2. Create a comprehensive character data file (JSON array of all hiragana + katakana)
3. Share this document + audio files with an AI (Claude, GPT, Codex)
4. AI will implement the full trainer
5. Test on desktop & mobile
6. Deploy on GitHub Pages or similar (or distribute as standalone HTML)
