// Australian English Vowel Data
const vowels = [
    {
        name: "fleece",
        phonetic: "/iː/",
        description: "A long 'ee' sound (FLEECE, GREEK)",
        examples: ["fleece", "greek", "see", "team"],
        frequency: 500
    },
    {
        name: "kit",
        phonetic: "/ɪ/",
        description: "A short 'i' sound (KIT, FISH)",
        examples: ["kit", "fish", "sit", "bit"],
        frequency: 700
    },
    {
        name: "face",
        phonetic: "/eɪ/",
        description: "Diphthong from 'e' to 'i' (FACE, MAKE)",
        examples: ["face", "make", "say", "take"],
        frequency: 600
    },
    {
        name: "dress",
        phonetic: "/ɛ/",
        description: "A short 'e' sound (DRESS, BED)",
        examples: ["dress", "bed", "get", "set"],
        frequency: 650
    },
    {
        name: "trap",
        phonetic: "/æ/",
        description: "Short 'a' sound (TRAP, CAT)",
        examples: ["trap", "cat", "bad", "hand"],
        frequency: 750
    },
    {
        name: "palm",
        phonetic: "/ɑː/",
        description: "Long 'ah' sound (PALM, FATHER)",
        examples: ["palm", "father", "car", "start"],
        frequency: 400
    },
    {
        name: "thought",
        phonetic: "/ɔː/",
        description: "Long 'o' sound (THOUGHT, NORTH)",
        examples: ["thought", "north", "door", "four"],
        frequency: 550
    },
    {
        name: "foot",
        phonetic: "/ʊ/",
        description: "Short 'oo' sound (FOOT, BOOK)",
        examples: ["foot", "book", "good", "look"],
        frequency: 800
    },
    {
        name: "goose",
        phonetic: "/uː/",
        description: "Long 'oo' sound (GOOSE, BLUE)",
        examples: ["goose", "blue", "food", "tool"],
        frequency: 500
    },
    {
        name: "strut",
        phonetic: "/ʌ/",
        description: "Short 'u' sound (STRUT, CUP)",
        examples: ["strut", "cup", "but", "run"],
        frequency: 700
    },
    {
        name: "comma",
        phonetic: "/ə/",
        description: "Schwa - unstressed sound (COMMA, ABOUT)",
        examples: ["comma", "about", "sofa", "data"],
        frequency: 450
    },
    {
        name: "nurse",
        phonetic: "/ɜː/",
        description: "Long 'ur' sound (NURSE, BIRD)",
        examples: ["nurse", "bird", "turn", "work"],
        frequency: 480
    },
    {
        name: "price",
        phonetic: "/aɪ/",
        description: "Diphthong 'ai' (PRICE, LIGHT)",
        examples: ["price", "light", "my", "fight"],
        frequency: 580
    },
    {
        name: "choice",
        phonetic: "/ɔɪ/",
        description: "Diphthong 'oi' (CHOICE, VOICE)",
        examples: ["choice", "voice", "joy", "boy"],
        frequency: 520
    },
    {
        name: "mouth",
        phonetic: "/aʊ/",
        description: "Diphthong 'ou' (MOUTH, DOWN)",
        examples: ["mouth", "down", "now", "house"],
        frequency: 540
    },
    {
        name: "goat",
        phonetic: "/əʊ/",
        description: "Diphthong 'oh' (GOAT, LOAD)",
        examples: ["goat", "load", "go", "road"],
        frequency: 510
    },
    {
        name: "near",
        phonetic: "/ɪə/",
        description: "Diphthong 'ear' (NEAR, HEAR)",
        examples: ["near", "hear", "beer", "fear"],
        frequency: 490
    },
    {
        name: "square",
        phonetic: "/eə/",
        description: "Diphthong 'air' (SQUARE, CARE)",
        examples: ["square", "care", "fair", "hair"],
        frequency: 460
    },
    {
        name: "cure",
        phonetic: "/ʊə/",
        description: "Diphthong 'ure' (CURE, POOR)",
        examples: ["cure", "poor", "tour", "sure"],
        frequency: 410
    }
];

let currentVowel = null;
let score = 0;
let attempts = 0;
let isPlaying = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeVowelList();
    setupEventListeners();
});

function initializeVowelList() {
    const vowelList = document.getElementById('vowelList');
    vowels.forEach((vowel, index) => {
        const item = document.createElement('div');
        item.className = 'vowel-item';
        item.innerHTML = `<div class="phonetic">${vowel.phonetic}</div><div>${vowel.name}</div>`;
        item.addEventListener('click', () => selectVowel(index));
        vowelList.appendChild(item);
    });
}

function selectVowel(index) {
    currentVowel = vowels[index];

    // Update UI
    document.querySelectorAll('.vowel-item').forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });

    // Show vowel info and controls
    const vowelInfo = document.getElementById('vowelInfo');
    document.getElementById('vowelSymbol').textContent = currentVowel.phonetic;
    document.getElementById('ipaSymbol').textContent = currentVowel.phonetic;
    document.getElementById('vowelDescription').textContent = currentVowel.description + ' - Examples: ' + currentVowel.examples.slice(0, 3).join(', ');
    vowelInfo.style.display = 'block';

    document.getElementById('controlsSection').style.display = 'flex';

    // Clear previous inputs
    clearFeedback();
    document.getElementById('typingInput').value = '';
    document.getElementById('drawingFallback').value = '';
    clearCanvas();
}

function setupEventListeners() {
    document.getElementById('listenBtn').addEventListener('click', playSound);
    document.getElementById('typeBtn').addEventListener('click', () => switchInputMode('typing'));
    document.getElementById('drawBtn').addEventListener('click', () => switchInputMode('drawing'));
    document.getElementById('submitTyping').addEventListener('click', checkTypingAnswer);
    document.getElementById('submitDrawing').addEventListener('click', checkDrawingAnswer);
    document.getElementById('typingInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkTypingAnswer();
    });
    document.getElementById('clearCanvas').addEventListener('click', clearCanvas);

    // Drawing canvas
    const canvas = document.getElementById('drawingCanvas');
    let isDrawing = false;
    const ctx = canvas.getContext('2d');

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.stroke();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });

    // Touch support for drawing
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
            ctx.stroke();
        }
    });

    canvas.addEventListener('touchend', () => {
        isDrawing = false;
    });
}

function switchInputMode(mode) {
    document.getElementById('typingSection').classList.remove('active');
    document.getElementById('drawingSection').classList.remove('active');

    if (mode === 'typing') {
        document.getElementById('typingSection').classList.add('active');
        document.getElementById('typingInput').focus();
    } else {
        document.getElementById('drawingSection').classList.add('active');
        clearCanvas();
    }

    // Update button states
    document.getElementById('typeBtn').classList.toggle('active', mode === 'typing');
    document.getElementById('drawBtn').classList.toggle('active', mode === 'drawing');

    clearFeedback();
}

function playSound() {
    if (!currentVowel || isPlaying) return;

    isPlaying = true;
    const btn = document.getElementById('listenBtn');
    const indicator = btn.querySelector('#soundIndicator');

    // Show playing indicator
    if (indicator) {
        indicator.classList.add('playing');
    }

    // Create audio context and synthesize vowel sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Use Web Speech API for clear pronunciation
    const utterance = new SpeechSynthesisUtterance();
    utterance.text = currentVowel.examples[0]; // Speak the example word
    utterance.lang = 'en-AU'; // Australian English
    utterance.rate = 0.8; // Slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
        isPlaying = false;
        if (indicator) {
            indicator.classList.remove('playing');
        }
    };

    // Stop any previous speech
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

function checkTypingAnswer() {
    if (!currentVowel) return;

    const input = document.getElementById('typingInput').value.toLowerCase().trim();
    const correct = checkAnswer(input);

    attempts++;
    if (correct) score++;

    showFeedback(correct, input);
}

function checkDrawingAnswer() {
    // For handwriting, use the fallback text input
    const input = document.getElementById('drawingFallback').value.toLowerCase().trim();

    if (!input) {
        showMessage('Please type the phonetic symbol and example word in the text field below the canvas.', false);
        return;
    }

    const correct = checkAnswer(input);

    attempts++;
    if (correct) score++;

    showFeedback(correct, input);
}

function checkAnswer(input) {
    if (!currentVowel) return false;

    // Accept various formats
    const normalized = input.replace(/\s+/g, ' ').trim();

    // Check if input contains the phonetic symbol
    const phoneticMatch = normalized.includes(currentVowel.phonetic) ||
                         normalized.includes(currentVowel.phonetic.replace(/[/]/g, ''));

    // Check if input contains at least one example word
    const exampleMatch = currentVowel.examples.some(ex => normalized.includes(ex));

    return phoneticMatch || exampleMatch;
}

function showFeedback(isCorrect, userAnswer) {
    const feedbackEl = document.getElementById('feedback');

    if (isCorrect) {
        feedbackEl.className = 'feedback show correct';
        feedbackEl.innerHTML = `
            <strong>✅ Correct!</strong><br>
            The answer is: <strong>${currentVowel.phonetic}</strong> - ${currentVowel.description}<br>
            Examples: ${currentVowel.examples.slice(0, 4).join(', ')}<br>
            <div class="score-display">Score: ${score}/${attempts}</div>
        `;
    } else {
        feedbackEl.className = 'feedback show incorrect';
        feedbackEl.innerHTML = `
            <strong>❌ Not quite right</strong><br>
            You answered: <strong>${userAnswer}</strong><br>
            The correct answer is: <strong>${currentVowel.phonetic}</strong> - ${currentVowel.description}<br>
            Examples: ${currentVowel.examples.slice(0, 4).join(', ')}<br>
            <div class="score-display">Score: ${score}/${attempts}</div>
        `;
    }

    // Auto-scroll to feedback
    feedbackEl.scrollIntoView({ behavior: 'smooth' });
}

function showMessage(message, isSuccess) {
    const feedbackEl = document.getElementById('feedback');
    feedbackEl.className = `feedback show ${isSuccess ? 'correct' : 'incorrect'}`;
    feedbackEl.innerHTML = `<strong>${message}</strong>`;
}

function clearFeedback() {
    const feedbackEl = document.getElementById('feedback');
    feedbackEl.classList.remove('show');
}

function clearCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reset canvas styling
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

// Initialize canvas styling
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
});
