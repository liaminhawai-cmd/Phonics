# 🇦🇺 Australian English Vowel Practice

An interactive web application for practicing Australian English vowel sounds. Learners can listen to native Australian English pronunciation and practice identifying vowels through typing or handwriting.

## Features

- **19 Australian English Vowels** - Comprehensive coverage of vowel sounds used in Australian English
- **Listen to Sounds** - Click to hear native Australian English pronunciation of example words
- **Multiple Input Methods**:
  - **Type** - Type the IPA phonetic symbol and example words
  - **Handwrite** - Sketch on a canvas (with fallback text input)
- **Instant Feedback** - Immediate validation with explanations
- **Score Tracking** - Monitor your progress across practice sessions
- **Responsive Design** - Works on desktop, tablet, and mobile devices

## Australian English Vowels Included

### Monophthongs (single vowel sounds)
- `/iː/` - fleece (FLEECE, GREEK, SEE)
- `/ɪ/` - kit (KIT, FISH, SIT)
- `/eɪ/` - face (FACE, MAKE, SAY)
- `/ɛ/` - dress (DRESS, BED, GET)
- `/æ/` - trap (TRAP, CAT, BAD)
- `/ɑː/` - palm (PALM, FATHER, CAR)
- `/ɔː/` - thought (THOUGHT, NORTH, DOOR)
- `/ʊ/` - foot (FOOT, BOOK, GOOD)
- `/uː/` - goose (GOOSE, BLUE, FOOD)
- `/ʌ/` - strut (STRUT, CUP, BUT)
- `/ə/` - comma (COMMA, ABOUT, SOFA)
- `/ɜː/` - nurse (NURSE, BIRD, TURN)

### Diphthongs (two-part vowel sounds)
- `/aɪ/` - price (PRICE, LIGHT, MY)
- `/ɔɪ/` - choice (CHOICE, VOICE, JOY)
- `/aʊ/` - mouth (MOUTH, DOWN, NOW)
- `/əʊ/` - goat (GOAT, LOAD, GO)
- `/ɪə/` - near (NEAR, HEAR, BEER)
- `/eə/` - square (SQUARE, CARE, FAIR)
- `/ʊə/` - cure (CURE, POOR, TOUR)

## Getting Started

### Prerequisites
- Modern web browser with Web Audio API support
- Internet connection (for speech synthesis)

### Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Start a local web server:

```bash
python3 -m http.server 8000
```

Or use any other local server:
```bash
# Node.js
npx http-server

# PHP
php -S localhost:8000
```

4. Open your browser to `http://localhost:8000`

## How to Use

1. **Select a Vowel** - Click on any vowel from the grid to begin
2. **Listen** - Click the 🔊 button to hear an example word pronounced in Australian English
3. **Practice** - Choose to either:
   - **Type** your answer as: `/ɪː/ example`
   - **Handwrite** on the canvas (or use the text fallback below it)
4. **Check Answer** - Click "Check Answer" to validate your response
5. **Review Feedback** - See if you're correct and learn more about the vowel
6. **Track Progress** - Monitor your score as you practice

## Answer Format

When practicing, your answer should include:
- The **IPA phonetic symbol** (e.g., `/iː/`)
- An **example word** (e.g., `fleece`)

Examples of accepted answers:
- `/iː/ fleece`
- `iː fleece`
- `fleece /iː/`
- Just `/iː/` or just `fleece`

## Technical Details

- **No backend required** - Runs entirely in the browser
- **Uses Web Speech API** - For native language speech synthesis
- **Canvas Drawing** - HTML5 Canvas for handwriting input
- **Responsive Grid** - Adapts to different screen sizes
- **Progress Tracking** - Session-based score tracking

## Browser Compatibility

Works best in modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Educational Resources

For more information on Australian English vowels, see:
- https://australianlinguistics.com/speech-sounds/vowels-au-english/
- International Phonetic Alphabet (IPA): https://www.internationalphoneticassociation.org/

## Contributing

Feel free to suggest improvements, additional vowel sets, or UI enhancements!

## License

MIT License - Feel free to use, modify, and distribute.

---

**Practice regularly** to improve your Australian English pronunciation and recognition of vowel sounds! 🎯
