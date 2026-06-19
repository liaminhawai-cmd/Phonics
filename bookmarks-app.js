const GRAPHEMES = [
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
  { grapheme: "p",  audio: "P",    sounds: [{s:"p", ex:"map"}] },
  { grapheme: "qu", audio: "Qu",   sounds: [{s:"kw", ex:"quit"}] },
  { grapheme: "r",  audio: "R",    sounds: [{s:"r", ex:"rat"}] },
  { grapheme: "s",  audio: "S",    sounds: [{s:"s", ex:"us"}, {s:"z", ex:"as"}] },
  { grapheme: "t",  audio: "T",    sounds: [{s:"t", ex:"bat"}] },
  { grapheme: "u",  audio: "U",    sounds: [{s:"ŭ", ex:"up"}, {s:"ū", ex:"music"}, {s:"oo", ex:"put"}] },
  { grapheme: "v",  audio: "V",    sounds: [{s:"v", ex:"van"}] },
  { grapheme: "w",  audio: "W",    sounds: [{s:"w", ex:"win"}] },
  { grapheme: "x",  audio: "X",    sounds: [{s:"ks", ex:"box"}] },
  { grapheme: "y",  audio: "Y",    sounds: [{s:"y", ex:"yes"}, {s:"ī", ex:"by"}, {s:"ĭ", ex:"gym"}] },
  { grapheme: "z",  audio: "Z",    sounds: [{s:"z", ex:"zoo"}] },
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
  { grapheme: "ow",   audio: "Ow",   sounds: [{s:"ow", ex:"how"}, {s:"ō", ex:"low"}] },
  { grapheme: "oy",   audio: "Oy",   sounds: [{s:"oy", ex:"boy"}] },
  { grapheme: "ph",   audio: "Ph",   sounds: [{s:"f", ex:"phone"}] },
  { grapheme: "sh",   audio: "Sh",   sounds: [{s:"sh", ex:"dish"}] },
  { grapheme: "si",   audio: "Si",   sounds: [{s:"sh", ex:"session"}, {s:"zh", ex:"vision"}] },
  { grapheme: "th",   audio: "Th",   sounds: [{s:"th", ex:"thin"}, {s:"th", ex:"this"}] },
  { grapheme: "ti",   audio: "Ti",   sounds: [{s:"sh", ex:"nation"}] },
  { grapheme: "ui",   audio: "Ui",   sounds: [{s:"ōō", ex:"fruit"}, {s:"ū", ex:"nuisance"}] },
  { grapheme: "ur",   audio: "Ur",   sounds: [{s:"er", ex:"nurse"}] },
  { grapheme: "wh",   audio: "Wh",   sounds: [{s:"hw", ex:"when"}] },
  { grapheme: "wor",  audio: "Wor",  sounds: [{s:"er", ex:"works"}] },
  { grapheme: "wr",   audio: "Wr",   sounds: [{s:"r", ex:"wrap"}] },
];

const BOOKMARK_LEVELS = [
  { name: "Level 1 – APTIN",  graphemes: ["a","p","t","i","n"] },
  { name: "Level 2 – SMOBC",  graphemes: ["s","m","o","b","c"] },
  { name: "Level 3 – GHKDE",  graphemes: ["g","h","k","d","e"] },
  { name: "Level 4 – LRFVU",  graphemes: ["l","r","f","v","u"] },
  { name: "Level 5 – JWZXY",  graphemes: ["j","w","z","x","y"] },
  { name: "Level 6",          graphemes: ["qu","sh","th","ch","ay"] },
  { name: "Level 7",          graphemes: ["wh","ck","ee","er","ar"] },
  { name: "Level 8",          graphemes: ["ed","oo","igh","ai","oy"] },
  { name: "Level 9",          graphemes: ["oi","oa","ea","ir","ow"] },
  { name: "Level 10",         graphemes: ["oe","au","aw","or","wr"] },
  { name: "Level 11",         graphemes: ["ph","kn","ie","ei","eigh"] },
  { name: "Level 12",         graphemes: ["ou","ew","ur","ear","wor"] },
  { name: "Level 13",         graphemes: ["dge","ui","ng","ey","ough"] },
  { name: "Level 14",         graphemes: ["gu","ti","si","ci","gn"] },
];

const graphemeIndex = {};
GRAPHEMES.forEach((g, i) => { graphemeIndex[g.grapheme] = i; });

const selected = new Set();
let queue = [];
let current = null;
let inputMode = "type";
let masteredList = [];
let missed = new Set();
let sessionTotal = 0;
let activeLevels = new Set();

const $ = (id) => document.getElementById(id);
const screens = {};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
}

function buildLevelBar() {
  var bar = $("levelBar");

  BOOKMARK_LEVELS.forEach(function(level, i) {
    var btn = document.createElement("button");
    btn.className = "level-btn";
    btn.textContent = "Lv " + (i + 1);
    btn.title = level.name + ": " + level.graphemes.join(", ");
    btn.addEventListener("click", function() { toggleLevel(i, btn); });
    bar.appendChild(btn);
  });

  var allBtn = document.createElement("button");
  allBtn.className = "level-btn util";
  allBtn.textContent = "All";
  allBtn.addEventListener("click", function() {
    setAllChips(true);
    bar.querySelectorAll(".level-btn:not(.util)").forEach(function(b) { b.classList.add("active"); });
    activeLevels = new Set(BOOKMARK_LEVELS.map(function(_, i) { return i; }));
  });
  bar.appendChild(allBtn);

  var clearBtn = document.createElement("button");
  clearBtn.className = "level-btn util";
  clearBtn.textContent = "Clear";
  clearBtn.addEventListener("click", function() {
    setAllChips(false);
    bar.querySelectorAll(".level-btn:not(.util)").forEach(function(b) { b.classList.remove("active"); });
    activeLevels.clear();
  });
  bar.appendChild(clearBtn);
}

function toggleLevel(levelIdx, btn) {
  if (activeLevels.has(levelIdx)) {
    activeLevels.delete(levelIdx);
    btn.classList.remove("active");
    var levelGraphemes = BOOKMARK_LEVELS[levelIdx].graphemes;
    levelGraphemes.forEach(function(gr) {
      var belongsToOther = false;
      activeLevels.forEach(function(otherIdx) {
        if (BOOKMARK_LEVELS[otherIdx].graphemes.indexOf(gr) !== -1) belongsToOther = true;
      });
      if (!belongsToOther) {
        var idx = graphemeIndex[gr];
        if (idx !== undefined) {
          selected.delete(idx);
          updateChipVisual(idx, false);
        }
      }
    });
  } else {
    activeLevels.add(levelIdx);
    btn.classList.add("active");
    var levelGraphemes = BOOKMARK_LEVELS[levelIdx].graphemes;
    levelGraphemes.forEach(function(gr) {
      var idx = graphemeIndex[gr];
      if (idx !== undefined) {
        selected.add(idx);
        updateChipVisual(idx, true);
      }
    });
  }
  refreshCount();
}

function updateChipVisual(idx, on) {
  var chip = document.querySelector('.g-chip[data-idx="' + idx + '"]');
  if (chip) chip.classList.toggle("selected", on);
}

function buildGroupedGrid() {
  var container = $("groupContainer");
  BOOKMARK_LEVELS.forEach(function(level) {
    var label = document.createElement("div");
    label.className = "group-label";
    label.textContent = level.name;
    container.appendChild(label);

    var grid = document.createElement("div");
    grid.className = "grapheme-grid";

    level.graphemes.forEach(function(gr) {
      var idx = graphemeIndex[gr];
      if (idx === undefined) return;
      var g = GRAPHEMES[idx];
      var chip = document.createElement("div");
      chip.className = "g-chip";
      chip.dataset.idx = idx;
      var dots = "";
      for (var d = 0; d < g.sounds.length; d++) dots += "●";
      chip.innerHTML = '<span class="gr">' + g.grapheme + '</span><span class="dots">' + dots + '</span>';
      chip.addEventListener("click", function() { toggleChip(idx, chip); });
      grid.appendChild(chip);
    });

    container.appendChild(grid);
  });
}

function toggleChip(idx, chip) {
  if (selected.has(idx)) {
    selected.delete(idx);
    chip.classList.remove("selected");
  } else {
    selected.add(idx);
    chip.classList.add("selected");
  }
  refreshCount();
}

function refreshCount() {
  $("selCount").textContent = selected.size;
  $("startBtn").disabled = selected.size === 0;
}

function setAllChips(on) {
  document.querySelectorAll(".g-chip").forEach(function(chip) {
    var idx = +chip.dataset.idx;
    chip.classList.toggle("selected", on);
    if (on) selected.add(idx); else selected.delete(idx);
  });
  refreshCount();
}

function startSession() {
  queue = [];
  selected.forEach(function(i) { queue.push(GRAPHEMES[i]); });
  shuffle(queue);
  sessionTotal = queue.length;
  masteredList = [];
  missed = new Set();
  clearShelf();
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
  $("typeInput").value = "";
  $("typeInput").className = "";
  clearCanvas();
  if (inputMode === "type") {
    $("writeCheckRow").style.display = "none";
    $("writeGradeRow").style.display = "none";
  } else {
    $("writeCheckRow").style.display = "flex";
    $("writeGradeRow").style.display = "none";
  }
}

function updateProgress() {
  var left = queue.length;
  $("remainingLabel").textContent = left + " card" + (left === 1 ? "" : "s") + " left";
  $("progressFill").style.width = ((sessionTotal - left) / sessionTotal) * 100 + "%";
}

function checkTypedAnswer() {
  if (!current) return;
  var input = $("typeInput");
  var typed = input.value.trim().toLowerCase();
  var correct = current.grapheme.toLowerCase();
  if (!typed) return;

  if (typed === correct) {
    input.classList.add("flash-correct");
    revealAnswer();
    setTimeout(function() { gradeCard(true); }, 1000);
  } else {
    input.classList.add("flash-wrong");
    revealAnswer();
    setTimeout(function() { gradeCard(false); }, 1200);
  }
}

function revealAnswer() {
  $("ansGrapheme").textContent = current.grapheme;
  var html = current.sounds.map(function(s) {
    return '<div class="sound-item"><span class="sym">' + s.s + '</span> <span class="ex">e.g. ' + s.ex + '</span></div>';
  }).join("");
  $("ansSounds").innerHTML = html;
  $("answerBox").classList.add("show");
}

function showWriteGrade() {
  revealAnswer();
  $("writeCheckRow").style.display = "none";
  $("writeGradeRow").style.display = "flex";
}

function gradeCard(gotIt) {
  var card = queue.shift();
  if (gotIt) {
    masteredList.push(card);
    addToShelf(card);
  } else {
    missed.add(card);
    var insertAt = Math.max(1, Math.floor(queue.length / 2) + Math.floor(Math.random() * Math.ceil(queue.length / 2)));
    queue.splice(Math.min(insertAt, queue.length), 0, card);
  }
  nextCard();
}

function clearShelf() {
  var shelf = $("masteredShelf");
  shelf.innerHTML = '<span class="shelf-empty" id="shelfEmpty">Cards you get right appear here</span>';
}

function addToShelf(card) {
  var shelf = $("masteredShelf");
  var empty = $("shelfEmpty");
  if (empty) empty.remove();
  var item = document.createElement("span");
  item.className = "shelf-item";
  item.textContent = card.grapheme;
  shelf.appendChild(item);
}

function finishSession() {
  showScreen("done");
  var tricky = missed.size;
  var html = "You mastered <b>" + sessionTotal + "</b> grapheme" + (sessionTotal === 1 ? "" : "s") + "!";
  if (tricky) {
    html += '<br><span style="color:var(--wrong)">' + tricky + '</span> needed extra practice.';
  } else {
    html += "<br>Perfect run — every one right first try.";
  }
  $("doneStats").innerHTML = html;
  $("reviewMissedBtn").style.display = tricky ? "inline-block" : "none";
}

function reviewMissed() {
  var list = [];
  missed.forEach(function(v) { list.push(v); });
  selected.clear();
  list.forEach(function(v) { selected.add(GRAPHEMES.indexOf(v)); });
  startSession();
}

var audioEl = null;

function playCurrent() {
  if (!current) return;
  var btn = $("listenBtn");
  if (audioEl) { audioEl.pause(); audioEl = null; }
  audioEl = new Audio(current.audio + ".mp4");
  audioEl.addEventListener("play", function() { btn.classList.add("playing"); });
  audioEl.addEventListener("ended", function() { btn.classList.remove("playing"); });
  audioEl.addEventListener("error", function() { btn.classList.remove("playing"); });
  audioEl.play().catch(function() {});
}

var canvas, ctx, drawing = false;

function initCanvas() {
  canvas = $("writeCanvas");
  ctx = canvas.getContext("2d");
  styleCtx();

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    var p = e.touches ? e.touches[0] : e;
    return {
      x: (p.clientX - r.left) * (canvas.width / r.width),
      y: (p.clientY - r.top) * (canvas.height / r.height)
    };
  }
  function start(e) { e.preventDefault(); drawing = true; var pt = pos(e); ctx.beginPath(); ctx.moveTo(pt.x, pt.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); var pt = pos(e); ctx.lineTo(pt.x, pt.y); ctx.stroke(); }
  function end() { drawing = false; }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, {passive: false});
  canvas.addEventListener("touchmove", move, {passive: false});
  canvas.addEventListener("touchend", end);
}

function styleCtx() {
  ctx.strokeStyle = "#1f1f1f";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function clearCanvas() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  styleCtx();
}

function setMode(mode) {
  inputMode = mode;
  $("modeType").classList.toggle("active", mode === "type");
  $("modeWrite").classList.toggle("active", mode === "write");
  $("typeWrap").classList.toggle("active", mode === "type");
  $("writeWrap").classList.toggle("active", mode === "write");
  if (mode === "type") {
    $("writeCheckRow").style.display = "none";
    $("writeGradeRow").style.display = "none";
    $("typeInput").focus();
  } else {
    $("writeCheckRow").style.display = "flex";
    $("writeGradeRow").style.display = "none";
  }
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

document.addEventListener("DOMContentLoaded", function() {
  screens.select = $("selectScreen");
  screens.card = $("cardScreen");
  screens.done = $("doneScreen");

  buildLevelBar();
  buildGroupedGrid();
  initCanvas();
  refreshCount();

  $("selectAll").addEventListener("click", function() { setAllChips(true); });
  $("selectNone").addEventListener("click", function() { setAllChips(false); });
  $("startBtn").addEventListener("click", startSession);

  $("listenBtn").addEventListener("click", playCurrent);
  $("modeType").addEventListener("click", function() { setMode("type"); });
  $("modeWrite").addEventListener("click", function() { setMode("write"); });
  $("clearCanvas").addEventListener("click", clearCanvas);

  $("typeCheckBtn").addEventListener("click", checkTypedAnswer);
  $("typeInput").addEventListener("keypress", function(e) {
    if (e.key === "Enter") checkTypedAnswer();
  });

  $("writeRevealBtn").addEventListener("click", showWriteGrade);
  $("gotItBtn").addEventListener("click", function() { gradeCard(true); });
  $("againBtn").addEventListener("click", function() { gradeCard(false); });

  $("quitBtn").addEventListener("click", function() {
    if (audioEl) audioEl.pause();
    showScreen("select");
  });

  $("restartBtn").addEventListener("click", function() { showScreen("select"); });
  $("reviewMissedBtn").addEventListener("click", reviewMissed);
});
