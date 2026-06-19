// ============================================================
// Aussie Phonics Trainer — grapheme-first, multi-sound approach
//
// Flow: pick spelling codes → flashcard drill (hear pure sound
// from MP4 → handwrite/type grapheme → reveal → self-grade)
// → learned cards drop out until deck is empty.
// ============================================================

const GRAPHEMES = [
  // ---- Single letters ----
  { grapheme: "a",  audio: "A",    sounds: [{s:"ă", ex:"at"}, {s:"ā", ex:"navy"}, {s:"ah", ex:"last"}] },
  { grapheme: "b",  audio: "B",    sounds: [{s:"b", ex:"rib"}] },
  { grapheme: "c",  audio: "C",    sounds: [{s:"k", ex:"can"}, {s:"s", ex:"cent"}] },
  { grapheme: "d",  audio: "D",    sounds: [{s:"d", ex:"lid"}] },
  { grapheme: "e",  audio: "E",    sounds: [{s:"ĕ", ex:"end"}, {s:"ē", ex:"me"}] },
  { grapheme: "f",  audio: "F",    sounds: [{s:"f", ex:"if"}] },
  { grapheme: "g",  audio: "G",    sounds: [{s:"g", ex:"bag"}, {s:"j", ex:"gem"}] },
  { grapheme: "h",  audio: "H",    sounds: [{s:"h", ex:"him"}] },
  { grapheme: "i",  audio: "I",    sounds: [{s:"ĭ", ex:"sit"}, {s:"ī", ex:"silent"}] },
  { grapheme: "j",  audio: "J",    sounds: [{s:"j", ex:"jam"}] },
  { grapheme: "k",  audio: "K",    sounds: [{s:"k", ex:"ink"}] },
  { grapheme: "l",  audio: "L",    sounds: [{s:"l", ex:"leg"}] },
  { grapheme: "m",  audio: "M",    sounds: [{s:"m", ex:"am"}] },
  { grapheme: "n",  audio: "N",    sounds: [{s:"n", ex:"in"}] },
  { grapheme: "o",  audio: "O",    sounds: [{s:"ŏ", ex:"odd"}, {s:"ō", ex:"open"}, {s:"oo", ex:"do"}] },
  { grapheme: "p",  audio: null,   sounds: [{s:"p", ex:"map"}] },
  { grapheme: "qu", audio: null,   sounds: [{s:"kw", ex:"quit"}] },
  { grapheme: "r",  audio: null,   sounds: [{s:"r", ex:"rat"}] },
  { grapheme: "s",  audio: null,   sounds: [{s:"s", ex:"us"}, {s:"z", ex:"as"}] },
  { grapheme: "t",  audio: null,   sounds: [{s:"t", ex:"bat"}] },
  { grapheme: "u",  audio: null,   sounds: [{s:"ŭ", ex:"up"}, {s:"ū", ex:"music"}, {s:"oo", ex:"put"}] },
  { grapheme: "v",  audio: null,   sounds: [{s:"v", ex:"van"}] },
  { grapheme: "w",  audio: null,   sounds: [{s:"w", ex:"win"}] },
  { grapheme: "x",  audio: null,   sounds: [{s:"ks", ex:"box"}] },
  { grapheme: "y",  audio: null,   sounds: [{s:"y", ex:"yes"}, {s:"ī", ex:"by"}, {s:"ĭ", ex:"gym"}] },
  { grapheme: "z",  audio: null,   sounds: [{s:"z", ex:"zoo"}] },

  // ---- Digraphs & trigraphs ----
  { grapheme: "ai",   audio: "Ai",   sounds: [{s:"ā", ex:"rain"}] },
  { grapheme: "ar",   audio: "Ar",   sounds: [{s:"ar", ex:"far"}] },
  { grapheme: "au",   audio: "Au",   sounds: [{s:"au", ex:"sauce"}] },
  { grapheme: "aw",   audio: "Aw",   sounds: [{s:"aw", ex:"jaw"}] },
  { grapheme: "ay",   audio: "Ay",   sounds: [{s:"ā", ex:"day"}] },
  { grapheme: "ch",   audio: "Ch",   sounds: [{s:"ch", ex:"chop"}, {s:"k", ex:"school"}, {s:"sh", ex:"chef"}] },
  { grapheme: "ci",   audio: "Ci",   sounds: [{s:"sh", ex:"social"}] },
  { grapheme: "ck",   audio: "Ck",   sounds: [{s:"k", ex:"neck"}] },
  { grapheme: "dge",  audio: "Dge",  sounds: [{s:"j", ex:"bridge"}] },
  { grapheme: "ea",   audio: "Ea",   sounds: [{s:"ē", ex:"eat"}, {s:"ĕ", ex:"head"}, {s:"ā", ex:"break"}] },
  { grapheme: "ear",  audio: "Ear",  sounds: [{s:"er", ex:"early"}] },
  { grapheme: "ed",   audio: "Ed",   sounds: [{s:"ĕd", ex:"landed"}, {s:"d", ex:"loved"}, {s:"t", ex:"picked"}] },
  { grapheme: "ee",   audio: "Ee",   sounds: [{s:"ē", ex:"see"}] },
  { grapheme: "ei",   audio: "Ei",   sounds: [{s:"ē", ex:"receive"}, {s:"ā", ex:"veil"}, {s:"ī", ex:"forfeit"}] },
  { grapheme: "eigh", audio: "Eigh", sounds: [{s:"ā", ex:"eight"}] },
  { grapheme: "er",   audio: "Er",   sounds: [{s:"er", ex:"her"}] },
  { grapheme: "ew",   audio: "Ew",   sounds: [{s:"ōō", ex:"grew"}, {s:"ū", ex:"new"}] },
  { grapheme: "ey",   audio: "Ey",   sounds: [{s:"ā", ex:"they"}, {s:"ē", ex:"key"}, {s:"ī", ex:"donkey"}] },
  { grapheme: "gn",   audio: "Gn",   sounds: [{s:"n", ex:"gnome"}] },
  { grapheme: "gu",   audio: "Gu",   sounds: [{s:"g", ex:"guess"}] },
  { grapheme: "ie",   audio: "Ie",   sounds: [{s:"ē", ex:"chief"}, {s:"ī", ex:"pie"}, {s:"ĭ", ex:"parties"}] },
  { grapheme: "igh",  audio: "Igh",  sounds: [{s:"ī", ex:"light"}] },
  { grapheme: "ir",   audio: "Ir",   sounds: [{s:"er", ex:"first"}] },
  { grapheme: "kn",   audio: "Kn",   sounds: [{s:"n", ex:"knot"}] },
  { grapheme: "ng",   audio: "Ng",   sounds: [{s:"ng", ex:"sang"}] },
  { grapheme: "oa",   audio: "Oa",   sounds: [{s:"ō", ex:"boat"}] },
  { grapheme: "oe",   audio: "Oe",   sounds: [{s:"ō", ex:"toe"}] },
  { grapheme: "oi",   audio: "Oi",   sounds: [{s:"oi", ex:"point"}] },
  { grapheme: "oo",   audio: "Oo",   sounds: [{s:"ōō", ex:"food"}, {s:"ŏŏ", ex:"cook"}] },
  { grapheme: "or",   audio: "Or",   sounds: [{s:"or", ex:"for"}] },
  { grapheme: "ou",   audio: "Ou",   sounds: [{s:"ow", ex:"round"}, {s:"ō", ex:"shoulder"}, {s:"oo", ex:"you"}, {s:"ŭ", ex:"famous"}] },
  { grapheme: "ough", audio: "Ough", sounds: [{s:"ō", ex:"though"}, {s:"ōō", ex:"through"}, {s:"ŭf", ex:"rough"}, {s:"ŏff", ex:"cough"}, {s:"aw", ex:"thought"}, {s:"ow", ex:"drought"}] },
  { grapheme: "oy",   audio: null,   sounds: [{s:"oy", ex:"boy"}] },
  { grapheme: "ph",   audio: null,   sounds: [{s:"f", ex:"phone"}] },
  { grapheme: "sh",   audio: null,   sounds: [{s:"sh", ex:"dish"}] },
  { grapheme: "si",   audio: null,   sounds: [{s:"sh", ex:"session"}, {s:"zh", ex:"vision"}] },
  { grapheme: "th",   audio: null,   sounds: [{s:"th", ex:"thin"}, {s:"th", ex:"this"}] },
  { grapheme: "ti",   audio: null,   sounds: [{s:"sh", ex:"nation"}] },
  { grapheme: "ui",   audio: null,   sounds: [{s:"ōō", ex:"fruit"}, {s:"ū", ex:"nuisance"}] },
  { grapheme: "ur",   audio: null,   sounds: [{s:"er", ex:"nurse"}] },
  { grapheme: "wh",   audio: null,   sounds: [{s:"hw", ex:"when"}] },
  { grapheme: "wr",   audio: null,   sounds: [{s:"r", ex:"wrap"}] },
];

const SINGLES = GRAPHEMES.filter(g => g.grapheme.length === 1);
const MULTIS  = GRAPHEMES.filter(g => g.grapheme.length > 1);

// ---- State ----
const selected = new Set();
let queue = [];
let current = null;
let inputMode = "write";
let learnedCount = 0;
let missed = new Set();
let sessionTotal = 0;

const $ = id => document.getElementById(id);
const screens = { select: $("selectScreen"), card: $("cardScreen"), done: $("doneScreen") };
function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
}

// ============================================================
// SCREEN 1 — selection
// ============================================================
function buildGrid(container, items) {
    items.forEach(v => {
        const idx = GRAPHEMES.indexOf(v);
        const chip = document.createElement("div");
        chip.className = "vowel-chip";
        chip.dataset.idx = idx;
        const dots = "●".repeat(v.sounds.length);
        chip.innerHTML = `<span class="gr">${v.grapheme}</span><span class="dots">${dots}</span>`;
        chip.addEventListener("click", () => toggleChip(idx, chip));
        container.appendChild(chip);
    });
}

function toggleChip(idx, chip) {
    if (selected.has(idx)) { selected.delete(idx); chip.classList.remove("selected"); }
    else { selected.add(idx); chip.classList.add("selected"); }
    refreshCount();
}

function refreshCount() {
    $("selCount").textContent = selected.size;
    $("startBtn").disabled = selected.size === 0;
}

function setAllChips(on) {
    document.querySelectorAll(".vowel-chip").forEach(chip => {
        const idx = +chip.dataset.idx;
        chip.classList.toggle("selected", on);
        if (on) selected.add(idx); else selected.delete(idx);
    });
    refreshCount();
}

// ============================================================
// SCREEN 2 — flashcard
// ============================================================
function startSession() {
    queue = [...selected].map(i => GRAPHEMES[i]);
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
    setTimeout(playCurrent, 300);
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
    $("progressFill").style.width = `${((sessionTotal - left) / sessionTotal) * 100}%`;
}

function revealAnswer() {
    $("ansGrapheme").textContent = current.grapheme;
    const html = current.sounds.map(s =>
        `<div class="sound-item"><span class="sym">${s.s}</span> <span class="ex">e.g. ${s.ex}</span></div>`
    ).join("");
    $("ansSounds").innerHTML = html;
    $("answerBox").classList.add("show");
    $("checkRow").style.display = "none";
    $("gradeRow").style.display = "flex";
}

function gradeCard(gotIt) {
    const card = queue.shift();
    if (gotIt) {
        learnedCount++;
    } else {
        missed.add(card);
        queue.push(card);
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
        `You learned <b>${sessionTotal}</b> spelling code${sessionTotal === 1 ? "" : "s"}!` +
        (tricky ? `<br><span style="color:#e8973a">${tricky}</span> needed extra goes.`
                 : `<br>Nailed every one first try! 🌟`);
    $("reviewMissedBtn").style.display = tricky ? "inline-block" : "none";
}

function reviewMissed() {
    const list = [...missed];
    selected.clear();
    list.forEach(v => selected.add(GRAPHEMES.indexOf(v)));
    startSession();
}

// ============================================================
// Audio — play the MP4 file for the current grapheme
// ============================================================
let audioEl = null;

function playCurrent() {
    if (!current) return;
    const btn = $("listenBtn");

    if (!current.audio) {
        btn.textContent = "🔇 No audio yet";
        setTimeout(() => { btn.textContent = "🔊 Play sound"; }, 1500);
        return;
    }

    if (audioEl) { audioEl.pause(); audioEl = null; }

    audioEl = new Audio(current.audio + ".mp4");
    audioEl.addEventListener("play", () => btn.classList.add("playing"));
    audioEl.addEventListener("ended", () => btn.classList.remove("playing"));
    audioEl.addEventListener("error", () => {
        btn.classList.remove("playing");
        btn.textContent = "🔇 Audio not found";
        setTimeout(() => { btn.textContent = "🔊 Play sound"; }, 1500);
    });
    audioEl.play().catch(() => {});
}

// ============================================================
// Canvas
// ============================================================
let canvas, ctx, drawing = false;
function initCanvas() {
    canvas = $("writeCanvas");
    ctx = canvas.getContext("2d");
    styleCtx();
    const pos = e => {
        const r = canvas.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return { x: (p.clientX - r.left) * (canvas.width / r.width),
                 y: (p.clientY - r.top) * (canvas.height / r.height) };
    };
    const start = e => { e.preventDefault(); drawing = true; const {x,y} = pos(e); ctx.beginPath(); ctx.moveTo(x,y); };
    const move  = e => { if (!drawing) return; e.preventDefault(); const {x,y} = pos(e); ctx.lineTo(x,y); ctx.stroke(); };
    const end   = () => { drawing = false; };
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, {passive:false});
    canvas.addEventListener("touchmove", move, {passive:false});
    canvas.addEventListener("touchend", end);
}
function styleCtx() { ctx.strokeStyle = "#333"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
function clearCanvas() { if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); styleCtx(); }

// ============================================================
// Input mode
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
    buildGrid($("gridSingle"), SINGLES);
    buildGrid($("gridMulti"), MULTIS);
    initCanvas();
    refreshCount();

    $("selectAll").addEventListener("click", () => setAllChips(true));
    $("selectNone").addEventListener("click", () => setAllChips(false));
    $("startBtn").addEventListener("click", startSession);

    $("listenBtn").addEventListener("click", playCurrent);
    $("modeWrite").addEventListener("click", () => setMode("write"));
    $("modeType").addEventListener("click", () => setMode("type"));
    $("clearCanvas").addEventListener("click", clearCanvas);
    $("checkBtn").addEventListener("click", revealAnswer);
    $("gotItBtn").addEventListener("click", () => gradeCard(true));
    $("againBtn").addEventListener("click", () => gradeCard(false));
    $("quitBtn").addEventListener("click", () => { if (audioEl) audioEl.pause(); showScreen("select"); });
    $("typeInput").addEventListener("keypress", e => { if (e.key === "Enter") revealAnswer(); });

    $("restartBtn").addEventListener("click", () => showScreen("select"));
    $("reviewMissedBtn").addEventListener("click", reviewMissed);
});
