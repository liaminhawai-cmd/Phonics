// ============================================================
// Australian English Vowel Trainer — flashcard drill
// Flow: pick sounds → listen / write / check → learned cards
//        drop out of rotation until the deck is empty.
// ============================================================

const MONOPHTHONGS = [
    { ipa: "/iː/", kw: "fleece", desc: "Long 'ee' (FLEECE, GREEK)", examples: ["fleece", "see", "team", "greek"] },
    { ipa: "/ɪ/",  kw: "kit",    desc: "Short 'i' (KIT, FISH)",     examples: ["kit", "fish", "sit", "bit"] },
    { ipa: "/e/",  kw: "dress",  desc: "Short 'e' (DRESS, BED)",    examples: ["dress", "bed", "get", "set"] },
    { ipa: "/æ/",  kw: "trap",   desc: "Short 'a' (TRAP, CAT)",     examples: ["trap", "cat", "bad", "hand"] },
    { ipa: "/aː/", kw: "palm",   desc: "Long 'ah' (PALM, FATHER)",  examples: ["palm", "father", "car", "start"] },
    { ipa: "/ɔ/",  kw: "lot",    desc: "Short 'o' (LOT, DOG)",      examples: ["lot", "dog", "hot", "box"] },
    { ipa: "/oː/", kw: "thought",desc: "Long 'or' (THOUGHT, NORTH)",examples: ["thought", "north", "door", "law"] },
    { ipa: "/ʊ/",  kw: "foot",   desc: "Short 'oo' (FOOT, BOOK)",   examples: ["foot", "book", "good", "put"] },
    { ipa: "/ʉː/", kw: "goose",  desc: "Long 'oo' (GOOSE, BLUE)",   examples: ["goose", "blue", "food", "two"] },
    { ipa: "/a/",  kw: "strut",  desc: "Short 'u' (STRUT, CUP)",    examples: ["strut", "cup", "but", "run"] },
    { ipa: "/ɜː/", kw: "nurse",  desc: "Long 'er' (NURSE, BIRD)",   examples: ["nurse", "bird", "turn", "work"] },
    { ipa: "/ə/",  kw: "comma",  desc: "Schwa, unstressed (COMMA, ABOUT)", examples: ["comma", "about", "sofa", "data"] },
];

const DIPHTHONGS = [
    { ipa: "/æɪ/", kw: "face",   desc: "Glide 'ay' (FACE, MAKE)",   examples: ["face", "make", "say", "rain"] },
    { ipa: "/ɑe/", kw: "price",  desc: "Glide 'eye' (PRICE, LIGHT)",examples: ["price", "light", "my", "time"] },
    { ipa: "/oɪ/", kw: "choice", desc: "Glide 'oy' (CHOICE, VOICE)",examples: ["choice", "voice", "boy", "joy"] },
    { ipa: "/æɔ/", kw: "mouth",  desc: "Glide 'ow' (MOUTH, DOWN)",  examples: ["mouth", "down", "now", "house"] },
    { ipa: "/əʉ/", kw: "goat",   desc: "Glide 'oh' (GOAT, LOAD)",   examples: ["goat", "load", "go", "road"] },
    { ipa: "/ɪə/", kw: "near",   desc: "Glide 'ear' (NEAR, HERE)",  examples: ["near", "here", "beer", "fear"] },
    { ipa: "/eː/", kw: "square",  desc: "Long 'air' (SQUARE, CARE)", examples: ["square", "care", "fair", "hair"] },
    { ipa: "/ʊə/", kw: "cure",   desc: "Glide 'ure' (CURE, TOUR)",  examples: ["cure", "tour", "poor", "sure"] },
];

const ALL_VOWELS = [...MONOPHTHONGS, ...DIPHTHONGS];

// ---- state ----
const selected = new Set();      // indices into ALL_VOWELS
let queue = [];                  // vowels still to learn this session
let current = null;             // current card
let inputMode = "write";        // "write" | "type"
let learnedCount = 0;
let missed = new Set();          // vowels graded "again" at least once
let sessionTotal = 0;

// ---- element helpers ----
const $ = (id) => document.getElementById(id);
const screens = { select: $("selectScreen"), card: $("cardScreen"), done: $("doneScreen") };
function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
}

// ============================================================
// SCREEN 1 — selection
// ============================================================
function buildGrid(container, vowels) {
    vowels.forEach((v) => {
        const idx = ALL_VOWELS.indexOf(v);
        const chip = document.createElement("div");
        chip.className = "vowel-chip";
        chip.dataset.idx = idx;
        chip.innerHTML = `<span class="ipa">${v.ipa}</span><span class="kw">${v.kw}</span>`;
        chip.addEventListener("click", () => toggleChip(idx, chip));
        container.appendChild(chip);
    });
}

function toggleChip(idx, chip) {
    if (selected.has(idx)) { selected.delete(idx); chip.classList.remove("selected"); }
    else { selected.add(idx); chip.classList.add("selected"); }
    refreshSelectCount();
}

function refreshSelectCount() {
    $("selCount").textContent = selected.size;
    $("startBtn").disabled = selected.size === 0;
}

function setAllChips(on) {
    document.querySelectorAll(".vowel-chip").forEach((chip) => {
        const idx = +chip.dataset.idx;
        chip.classList.toggle("selected", on);
        if (on) selected.add(idx); else selected.delete(idx);
    });
    refreshSelectCount();
}

// ============================================================
// SCREEN 2 — flashcard drill
// ============================================================
function startSession() {
    queue = [...selected].map((i) => ALL_VOWELS[i]);
    shuffle(queue);
    sessionTotal = queue.length;
    learnedCount = 0;
    missed = new Set();
    showScreen("card");
    nextCard();
}

function nextCard() {
    if (queue.length === 0) { finishSession(); return; }
    current = queue[0];
    resetCardUI();
    updateProgress();
    // auto-play the sound when the card appears
    setTimeout(playCurrent, 250);
}

function resetCardUI() {
    $("answerBox").classList.remove("show");
    $("checkRow").style.display = "flex";
    $("gradeRow").style.display = "none";
    $("typeInput").value = "";
    clearCanvas();
}

function updateProgress() {
    const left = queue.length;
    $("remainingLabel").textContent = `${left} card${left === 1 ? "" : "s"} left`;
    const done = sessionTotal - left;
    $("progressFill").style.width = `${(done / sessionTotal) * 100}%`;
}

function revealAnswer() {
    $("ansIpa").textContent = current.ipa;
    $("ansDesc").textContent = current.desc;
    $("ansExamples").innerHTML = current.examples
        .map((w) => (w === current.kw ? `<b>${w}</b>` : w)).join(", ");
    $("answerBox").classList.add("show");
    $("checkRow").style.display = "none";
    $("gradeRow").style.display = "flex";
}

function gradeCard(gotIt) {
    const card = queue.shift();          // remove from front
    if (gotIt) {
        learnedCount++;                  // out of rotation for good
    } else {
        missed.add(card);
        queue.push(card);                // back of the line
    }
    nextCard();
}

// ============================================================
// SCREEN 3 — done
// ============================================================
function finishSession() {
    showScreen("done");
    const tricky = missed.size;
    $("doneStats").innerHTML =
        `You learned <b>${sessionTotal}</b> sound${sessionTotal === 1 ? "" : "s"}!` +
        (tricky ? `<br><span style="color:#e8973a;">${tricky}</span> needed a few goes.` : `<br>Nailed every one first try. 🌟`);
    $("reviewMissedBtn").style.display = tricky ? "inline-block" : "none";
}

function reviewMissed() {
    const list = [...missed];
    selected.clear();
    list.forEach((v) => selected.add(ALL_VOWELS.indexOf(v)));
    startSession();
}

// ============================================================
// Audio — Australian English via Web Speech API
// ============================================================
let auVoice = null;
function pickVoice() {
    const voices = speechSynthesis.getVoices();
    auVoice = voices.find((v) => v.lang === "en-AU")
           || voices.find((v) => v.lang && v.lang.startsWith("en-AU"))
           || voices.find((v) => v.lang && v.lang.startsWith("en"))
           || null;
}
if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
}

function playCurrent() {
    if (!current || !("speechSynthesis" in window)) return;
    const btn = $("listenBtn");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(current.kw);
    u.lang = "en-AU";
    if (auVoice) u.voice = auVoice;
    u.rate = 0.85;
    u.onstart = () => btn.classList.add("playing");
    u.onend = () => btn.classList.remove("playing");
    speechSynthesis.speak(u);
}

// ============================================================
// Handwriting canvas
// ============================================================
let canvas, ctx, drawing = false;
function initCanvas() {
    canvas = $("writeCanvas");
    ctx = canvas.getContext("2d");
    styleCtx();
    const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return {
            x: (p.clientX - r.left) * (canvas.width / r.width),
            y: (p.clientY - r.top) * (canvas.height / r.height),
        };
    };
    const start = (e) => { e.preventDefault(); drawing = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    const end = () => { drawing = false; };
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
}
function styleCtx() {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
}
function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    styleCtx();
}

// ============================================================
// Input mode toggle
// ============================================================
function setMode(mode) {
    inputMode = mode;
    $("modeWrite").classList.toggle("active", mode === "write");
    $("modeType").classList.toggle("active", mode === "type");
    $("writeWrap").classList.toggle("active", mode === "write");
    $("typeWrap").classList.toggle("active", mode === "type");
    if (mode === "type") $("typeInput").focus();
}

// ============================================================
// Utils + wiring
// ============================================================
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

document.addEventListener("DOMContentLoaded", () => {
    buildGrid($("gridMono"), MONOPHTHONGS);
    buildGrid($("gridDiph"), DIPHTHONGS);
    initCanvas();
    refreshSelectCount();

    // selection screen
    $("selectAll").addEventListener("click", () => setAllChips(true));
    $("selectNone").addEventListener("click", () => setAllChips(false));
    $("startBtn").addEventListener("click", startSession);

    // flashcard screen
    $("listenBtn").addEventListener("click", playCurrent);
    $("modeWrite").addEventListener("click", () => setMode("write"));
    $("modeType").addEventListener("click", () => setMode("type"));
    $("clearCanvas").addEventListener("click", clearCanvas);
    $("checkBtn").addEventListener("click", revealAnswer);
    $("gotItBtn").addEventListener("click", () => gradeCard(true));
    $("againBtn").addEventListener("click", () => gradeCard(false));
    $("quitBtn").addEventListener("click", () => { speechSynthesis.cancel(); showScreen("select"); });
    $("typeInput").addEventListener("keypress", (e) => { if (e.key === "Enter") revealAnswer(); });

    // done screen
    $("restartBtn").addEventListener("click", () => showScreen("select"));
    $("reviewMissedBtn").addEventListener("click", reviewMissed);
});
