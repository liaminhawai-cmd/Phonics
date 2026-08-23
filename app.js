// ============================================================
// Aussie Phonics Trainer (unified)
//
// Flow: Practice mode -> View -> Code selection -> Drill -> Report
//   Practice mode : "say"  (Look & Say)  | "write" (Listen & Write)
//   View          : "year" (scope & seq) | "bookmark" (14 levels)
//
// Drill keeps wrong answers in the deck and tracks how many tries
// each code took. The report turns first-try misses into targeted
// homework: the reading/writing video + activity sheets for the
// bookmark level those codes belong to.
// ============================================================

// GRAPHEMES and BOOKMARK_LEVELS used to be hardcoded here. Now the app is
// data-bank driven (docs/ARCHITECTURE.md §2, §11): they're built from the
// ACTIVE PhonicsBank sequence on boot (see bootBank() / applySequenceData()
// near the bottom of this file), via the pure builders in
// js/core/bank-adapt.js. For the default program (elc-bookmarks) the built
// arrays reproduce these exact 70 graphemes / 14 levels — see
// data/sequences/elc-bookmarks.json.
let GRAPHEMES = [];
let BOOKMARK_LEVELS = [];

const F = "https://drive.google.com/file/d/";
const A = "activities/level-";

const BOOKMARK_RESOURCES = [
  { reading: F+"1V8Ux6hEoJTtqXd0AWvERm_Equv45BOpl/view", writing: F+"1QXFrY3GRznRow7xdJbhaZKzR215DCkcv/view", activities: [
    { name: "Initial sounds – look & write",   url: A+"1/aptin initial sounds look and write.pdf?v=2", kind: "look"  },
    { name: "End sounds – look & write",        url: A+"1/aptin end sounds look and write.pdf?v=2", kind: "look"  },
    { name: "Initial sounds – listen & write",  url: A+"1/aptin initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"1/aptin end sounds listen and write.pdf", kind: "write" },
    { name: "Reading cards",                    url: A+"1/aptin reading cards.pdf", kind: "read"  },
  ]},
  { reading: F+"1TsMeIck3VgGbhrnGcF6OHkRwxKML3Y67/view", writing: F+"1QjAY9Y6X3PtZklMj8rixuikZ58LKCJ61/view", activities: [
    { name: "Initial sounds – look & write",   url: A+"2/SMOBC initial sounds look and write.pdf", kind: "look"  },
    { name: "End sounds – look & write",        url: A+"2/SMOBC end sounds look and write.pdf", kind: "look"  },
    { name: "Initial sounds – listen & write",  url: A+"2/SMOBC initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"2/SMOBC end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"2/SMOBC Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1VVQ4G9VYTjxzRALsmljpByX4SXiizeeX/view", writing: F+"1QoqthUwCkmBlzeysnMauFZa09x8UFDrC/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"3/GHKDE initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"3/GHKDE end sounds listen and write.pdf", kind: "write" },
    { name: "Reading cards",                    url: A+"3/GHKDE reading cards.pdf", kind: "read"  },
  ]},
  { reading: F+"1VWCLqajUMABx3rwYXqi3p4_PC-r4AD7j/view", writing: F+"1QutZua5oFC5cnW42k8Mh-BEjzuKUvX8f/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"4/LFRVU initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"4/LFRVU end sounds listen and write.pdf", kind: "write" },
    { name: "Reading cards",                    url: A+"4/LFRVU reading cards.pdf", kind: "read"  },
    { name: "Reading words",                    url: A+"4/LFRVU Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1VlO4zWHFD5MJZuDYEAembv4AvVPU8fts/view", writing: F+"1Qxy117ZfgqNM9517bixJEXUWRe8u-xYY/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"5/JWZXY initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"5/JWZXY end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"5/JWZXY Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UQWCRM8jELug9m8OOkbILteSi0pbDQGw/view", writing: F+"1R5k6DPw5Cc9AHCmboOkW4V6RqM32TKqI/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"6/QuShThChAy initial sounds listen and write.pdf", kind: "write" },
    { name: "Middle sounds – listen & write",   url: A+"6/QuShThChAy middle sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"6/QuShThChAy end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"6/QuShThChAy Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UNwGUC3eFqi4sPPI9lmLJEhn5KwvosZa/view", writing: F+"1RI6qnr4swOZfthMTOZKy_e34u6Yhig2b/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"7/WhCkEeErAr initial sounds listen and write.pdf", kind: "write" },
    { name: "Middle sounds – listen & write",   url: A+"7/WhCkEeErAr middle sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"7/WhCkEeErAr end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"7/WhCkEeErAr Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UEn-tMQ4oXfrSAo9CyB8cVcvd9p30uB7/view", writing: F+"1RLRUuQgW-z5hhyd0jppVhMDIg6OoT6bb/view", activities: [
    { name: "Middle sounds – listen & write",   url: A+"8/EdOoIghAiOy middle sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"8/EdOoIghAiOy Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UElswdzVuMCZlFoewpjt05opVTscmtjJ/view", writing: null, activities: [] },
  { reading: F+"1UDhOLPyJZiptqvkCw9JYmsBPmurxWDsc/view", writing: null, activities: [] },
  { reading: F+"1UAiMkQEqVh1v7IkbsBkrMwxsiqtaqZPZ/view", writing: null, activities: [] },
  { reading: F+"1U7_IS7j8JJvvvC3iPAN9XDcffVnggmKt/view", writing: null, activities: [] },
  { reading: F+"1U-6Ij0S7B_ov5DgYyxxdDpqvQy2ZiPEI/view", writing: null, activities: [] },
  { reading: F+"1TzfD4KFQjUkxHzcQPFA9z5U1ayMD2MAN/view", writing: null, activities: [] },
];

// PHON_GROUPS used to be hardcoded here too — now built from
// PhonicsBank.phonemeView() by PhonicsBankAdapt.buildPhonGroups() (same
// group names: Short/Long/R-Controlled/Other Vowels, Stops, Nasals,
// Fricatives, Affricates, Approximants, Lateral, Other Codes).
let PHON_GROUPS = [];

// YEAR_LEVELS and BOOKMARK_RESOURCES are specific to the elc-bookmarks
// program (Victorian Pre–Yr4 scope & the printed bookmarks' Google Drive
// demo videos / activity sheets) — they stay hardcoded, but their UI only
// renders when that sequence is active (see isElcBookmarks() / the "Year
// Levels" choice card / renderRemediation()).
const YEAR_LEVELS = {
  "Pre":  ["a","p","t","i","n","s","m","o","b","c","g","h","k","d","e","l","r","f","v","u","j","w","z","x","y"],
  "Yr 1": ["qu","sh","th","ch","ay","wh","ck","ee","er","ar"],
  "Yr 2": ["ed","oo","igh","ai","oy","oi","oa","ea","ir","ow"],
  "Yr 3": ["oe","au","aw","or","wr","ph","kn","ie","ei","eigh"],
  "Yr 4": ["ou","ew","ur","ear","wor","dge","ui","ng","ey","ough","gu","ti","si","ci","gn"],
};

let graphemeIndex = {};
let graphemeToBookmark = {};

function rebuildIndexes() {
  graphemeIndex = {};
  GRAPHEMES.forEach((g, i) => { graphemeIndex[g.grapheme] = i; });

  graphemeToBookmark = {};
  BOOKMARK_LEVELS.forEach((lvl, i) => {
    lvl.graphemes.forEach((gr) => { graphemeToBookmark[gr] = i; });
  });
}

// Rebuilds GRAPHEMES / BOOKMARK_LEVELS / PHON_GROUPS from whatever sequence
// is currently active in PhonicsBank, then the indexes derived from them.
// Called once on boot and again whenever the program picker changes.
function applySequenceData() {
  const gView = PhonicsBank.graphemeView();
  const pView = PhonicsBank.phonemeView();
  GRAPHEMES = PhonicsBankAdapt.buildGraphemes(gView, PhonicsBank);
  BOOKMARK_LEVELS = PhonicsBankAdapt.buildBookmarkLevels(gView);
  PHON_GROUPS = PhonicsBankAdapt.buildPhonGroups(pView, PhonicsBank);
  rebuildIndexes();
}

function isElcBookmarks() {
  const seq = PhonicsBank.seq();
  return !!seq && seq.id === "elc-bookmarks";
}

let practiceMode = "say";
let viewMode = "bookmark";
let inputMode = "type";

const selected = new Set();
let activeLevels = new Set();
let activeCats = new Set();
let queue = [];
let current = null;
let sessionTotal = 0;
let attempts = {};
let masteredOnTry = {};
let missed = new Set();

const $ = (id) => document.getElementById(id);
const screens = {};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
  // the wall's diphthongs loop forever, so stop them when it goes out of view
  document.body.classList.toggle("wall-wide", name === "wall");
  if (window.SoundWall) { if (name === "wall") SoundWall.open(); else SoundWall.close(); }
}

function chooseMode(mode) { practiceMode = mode; showScreen("view"); }
function chooseView(view) { viewMode = view; buildSelectScreen(); showScreen("select"); }

function buildSelectScreen() {
  selected.clear(); activeLevels.clear(); activeCats.clear();
  const modeLabel = practiceMode === "say" ? "Look &amp; Say" : "Listen &amp; Write";
  $("selectTitle").innerHTML = modeLabel + " &middot; " +
    (viewMode === "year" ? "Year Levels" : "Bookmark Levels");
  buildPresetBar();
  buildCategoryBar();
  buildGrid();
  refreshCount();
}

// ---- Preset bar (year buttons or bookmark level buttons) ----

function buildPresetBar() {
  const bar = $("levelBar");
  bar.innerHTML = "";

  if (viewMode === "year") {
    Object.keys(YEAR_LEVELS).forEach((name) => {
      const btn = mkPreset(name, () => togglePreset(name, btn, YEAR_LEVELS[name]));
      bar.appendChild(btn);
    });
  } else {
    bar.style.display = "none";
    return;
  }

  const allBtn = mkPreset("All", () => {
    selectGraphemes(GRAPHEMES.map((_, i) => i), true);
    bar.querySelectorAll(".level-btn:not(.util)").forEach((b) => b.classList.add("active"));
    activeLevels = new Set(Object.keys(YEAR_LEVELS));
  });
  allBtn.classList.add("util");
  bar.appendChild(allBtn);

  const clearBtn = mkPreset("Clear", () => {
    selectGraphemes(GRAPHEMES.map((_, i) => i), false);
    bar.querySelectorAll(".level-btn:not(.util)").forEach((b) => b.classList.remove("active"));
    activeLevels.clear();
    activeCats.clear();
    syncCatButtons();
  });
  clearBtn.classList.add("util");
  bar.appendChild(clearBtn);

  bar.style.display = "";
}

function mkPreset(label, onClick) {
  const btn = document.createElement("button");
  btn.className = "level-btn";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function togglePreset(key, btn, graphemes) {
  if (activeLevels.has(key)) {
    activeLevels.delete(key);
    btn.classList.remove("active");
    graphemes.forEach((gr) => {
      const stillIn = [...activeLevels].some((k) => {
        const pg = viewMode === "year" ? YEAR_LEVELS[k] : BOOKMARK_LEVELS[k].graphemes;
        return pg.includes(gr);
      });
      if (!stillIn) {
        const idx = graphemeIndex[gr];
        if (idx !== undefined) { selected.delete(idx); updateChipVisual(idx, false); }
      }
    });
  } else {
    activeLevels.add(key);
    btn.classList.add("active");
    graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx !== undefined) { selected.add(idx); updateChipVisual(idx, true); }
    });
  }
  refreshCount();
}

// ---- Sound category bar ----
// In bookmark view the grid is organised by level, so a pill bar gives
// quick access to whole sound groups. In year view the group headings
// themselves are the toggles, so the bar is hidden.

function buildCategoryBar() {
  const bar = $("catBar");
  bar.innerHTML = "";
  activeCats.clear();

  if (viewMode !== "bookmark") { bar.style.display = "none"; return; }
  bar.style.display = "";

  PHON_GROUPS.forEach((group) => {
    const btn = document.createElement("button");
    btn.className = "cat-btn";
    btn.textContent = group.name;
    btn.addEventListener("click", () => toggleCategory(group.name, btn, group.graphemes));
    bar.appendChild(btn);
  });
}

function toggleCategory(catName, btn, graphemes) {
  if (activeCats.has(catName)) {
    activeCats.delete(catName);
    btn.classList.remove("active");
    graphemes.forEach((gr) => {
      const stillInOtherCat = [...activeCats].some((c) => PHON_GROUPS.find((g) => g.name === c).graphemes.includes(gr));
      if (!stillInOtherCat) {
        const idx = graphemeIndex[gr];
        if (idx !== undefined) { selected.delete(idx); updateChipVisual(idx, false); }
      }
    });
  } else {
    activeCats.add(catName);
    btn.classList.add("active");
    graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx !== undefined) { selected.add(idx); updateChipVisual(idx, true); }
    });
  }
  refreshCount();
}

function syncCatButtons() {
  $("catBar").querySelectorAll(".cat-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
}

// ---- Selecting / deselecting graphemes ----

function selectGraphemes(indices, on) {
  indices.forEach((idx) => {
    if (on) selected.add(idx); else selected.delete(idx);
    updateChipVisual(idx, on);
  });
  refreshCount();
}

function updateChipVisual(idx, on) {
  const sel = '.g-chip[data-idx="' + idx + '"], .tracker-cell[data-idx="' + idx + '"]';
  document.querySelectorAll(sel).forEach((el) => {
    el.classList.toggle("selected", on);
  });
}

// ---- Grid: year view uses grouped chips, bookmark view uses the tracker table ----

function buildGrid() {
  const container = $("groupContainer");
  container.innerHTML = "";

  if (viewMode === "bookmark") {
    buildTrackerGrid(container);
  } else {
    buildChipGrid(container);
  }
}

// Some bookmark colours are very pale — pick readable text per colour.
function isLightColour(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

function buildTrackerGrid(container) {
  const tracker = document.createElement("div");
  tracker.className = "tracker";

  // Every row also opens that level's printable/tappable bookmark
  // (bookmark.html) — the coloured number keeps toggling the whole row.
  const seqId = (PhonicsBank.seq() && PhonicsBank.seq().id) || "";

  BOOKMARK_LEVELS.forEach((lvl, lvlIdx) => {
    const light = isLightColour(lvl.colour);
    const textCol = light ? "#1f1f1f" : "#ffffff";

    const row = document.createElement("div");
    row.className = "tracker-row";

    const label = document.createElement("div");
    label.className = "tracker-label" + (light ? " on-light" : "");
    label.dataset.lvl = lvlIdx;
    label.style.background = lvl.colour;
    label.style.color = textCol;
    label.textContent = lvlIdx + 1;
    label.title = lvl.name + " — click to toggle all";
    label.addEventListener("click", () => toggleTrackerRow(lvlIdx, label));
    row.appendChild(label);

    const codes = document.createElement("div");
    codes.className = "tracker-codes";
    lvl.graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx === undefined) return;
      const g = GRAPHEMES[idx];
      const cell = document.createElement("div");
      cell.className = "tracker-cell";
      cell.dataset.idx = idx;
      cell.dataset.lvl = lvlIdx;
      cell.style.setProperty("--chip", lvl.colour);
      cell.style.setProperty("--cell-text", textCol);
      const dots = "●".repeat(g.sounds.length);
      cell.innerHTML = gr + '<span class="tc-dots">' + dots + '</span>';
      cell.addEventListener("click", () => toggleTrackerCell(idx, cell));
      codes.appendChild(cell);
    });
    row.appendChild(codes);

    const mark = document.createElement("a");
    mark.className = "tracker-mark";
    mark.href = "bookmark.html?seq=" + encodeURIComponent(seqId) + "&level=" + (lvlIdx + 1);
    mark.textContent = "🔖";
    mark.title = lvl.name + " — open the bookmark";
    mark.setAttribute("aria-label", lvl.name + " — open the bookmark");
    row.appendChild(mark);

    // Some programs have review/blend units that teach no new graphemes
    // (UFLI's blend lessons) — an empty numbered row is just noise.
    if (codes.childElementCount) tracker.appendChild(row);
  });
  container.appendChild(tracker);
}

function toggleTrackerRow(lvlIdx, label) {
  const lvl = BOOKMARK_LEVELS[lvlIdx];
  const allSelected = lvl.graphemes.every((gr) => {
    const idx = graphemeIndex[gr];
    return idx !== undefined && selected.has(idx);
  });

  if (allSelected) {
    activeLevels.delete(lvlIdx);
    label.classList.remove("active");
    lvl.graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx !== undefined) { selected.delete(idx); updateChipVisual(idx, false); }
    });
  } else {
    activeLevels.add(lvlIdx);
    label.classList.add("active");
    lvl.graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx !== undefined) { selected.add(idx); updateChipVisual(idx, true); }
    });
  }
  refreshCount();
}

function toggleTrackerCell(idx, cell) {
  if (selected.has(idx)) { selected.delete(idx); cell.classList.remove("selected"); }
  else { selected.add(idx); cell.classList.add("selected"); }
  refreshCount();
}

function buildChipGrid(container) {
  PHON_GROUPS.forEach((group) => {
    // The heading itself is the category toggle (tap to select the whole group).
    const label = document.createElement("div");
    label.className = "group-label group-toggle";
    label.dataset.cat = group.name;
    label.innerHTML = '<span class="grp-name">' + group.name + '</span><span class="grp-hint"></span>';
    label.addEventListener("click", () => toggleGroupHeading(group));
    container.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "grapheme-grid";
    group.graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx === undefined) return;
      const g = GRAPHEMES[idx];
      const chip = document.createElement("div");
      chip.className = "g-chip";
      chip.dataset.idx = idx;
      const dots = "●".repeat(g.sounds.length);
      chip.innerHTML = '<span class="gr">' + g.grapheme + '</span><span class="dots">' + dots + '</span>';
      chip.addEventListener("click", () => {
        if (selected.has(idx)) { selected.delete(idx); chip.classList.remove("selected"); }
        else { selected.add(idx); chip.classList.add("selected"); }
        refreshCount();
      });
      grid.appendChild(chip);
    });
    container.appendChild(grid);
  });
}

function toggleGroupHeading(group) {
  const idxs = group.graphemes.map((gr) => graphemeIndex[gr]).filter((i) => i !== undefined);
  const allSel = idxs.length && idxs.every((i) => selected.has(i));
  selectGraphemes(idxs, !allSel);
}

function setAllChips(on) {
  const allEls = document.querySelectorAll(".g-chip, .tracker-cell");
  allEls.forEach((el) => {
    const idx = +el.dataset.idx;
    el.classList.toggle("selected", on);
    if (on) selected.add(idx); else selected.delete(idx);
  });
  if (viewMode === "bookmark") {
    document.querySelectorAll(".tracker-label").forEach((l) => l.classList.toggle("active", on));
    if (on) { activeLevels = new Set(BOOKMARK_LEVELS.map((_, i) => i)); } else { activeLevels.clear(); }
  }
  refreshCount();
}

function refreshCount() {
  $("selCount").textContent = selected.size;
  $("startBtn").disabled = selected.size === 0;
  syncGroupHeadings();
}

// Keep year-mode group headings lit when their whole group is selected,
// however the selection was made (chip, heading, year preset…).
function syncGroupHeadings() {
  document.querySelectorAll(".group-toggle").forEach((label) => {
    const group = PHON_GROUPS.find((g) => g.name === label.dataset.cat);
    if (!group) return;
    const idxs = group.graphemes.map((gr) => graphemeIndex[gr]).filter((i) => i !== undefined);
    const allSel = idxs.length && idxs.every((i) => selected.has(i));
    label.classList.toggle("active", allSel);
    label.querySelector(".grp-hint").textContent = allSel ? "✓ all selected" : "tap to add all";
  });
  // Light a tracker row's number when its whole level is selected.
  document.querySelectorAll(".tracker-label").forEach((label) => {
    const lvl = BOOKMARK_LEVELS[+label.dataset.lvl];
    const allSel = lvl.graphemes.every((gr) => {
      const i = graphemeIndex[gr];
      return i !== undefined && selected.has(i);
    });
    label.classList.toggle("active", allSel);
  });
}

function startSession() {
  queue = [...selected].map((i) => GRAPHEMES[i]);
  shuffle(queue);
  sessionTotal = queue.length;
  attempts = {};
  masteredOnTry = {};
  missed = new Set();
  clearShelf();

  $("sayPanel").style.display  = practiceMode === "say"   ? "block" : "none";
  $("writePanel").style.display = practiceMode === "write" ? "block" : "none";
  $("drillModeLabel").textContent = practiceMode === "say" ? "Look & Say" : "Listen & Write";

  showScreen("card");
  nextCard();
}

function nextCard() {
  if (queue.length === 0) { finishSession(); return; }
  current = queue[0];
  resetCardUI();
  updateProgress();
  if (practiceMode === "write") setTimeout(playCurrent, 300);
}

function resetCardUI() {
  $("answerBox").classList.remove("show");

  if (practiceMode === "say") {
    $("sayGrapheme").textContent = current.grapheme;
    $("sayCheckRow").style.display = "flex";
    $("sayGradeRow").style.display = "none";
    resetMicStrip();
  } else {
    $("typeInput").value = "";
    $("typeInput").className = "";
    clearSoundAlikeHint();
    clearCanvas();
    if (inputMode === "type") {
      $("writeCheckRow").style.display = "none";
      $("writeGradeRow").style.display = "none";
    } else {
      $("writeCheckRow").style.display = "flex";
      $("writeGradeRow").style.display = "none";
    }
  }
}

function updateProgress() {
  const left = queue.length;
  $("remainingLabel").textContent = left + " card" + (left === 1 ? "" : "s") + " left";
  $("progressFill").style.width = ((sessionTotal - left) / sessionTotal) * 100 + "%";
}

function sayCheck() {
  playCurrent();
  revealAnswer();
  $("sayCheckRow").style.display = "none";
  $("sayGradeRow").style.display = "flex";
}

/* ============================================================
   LOOK & SAY: the microphone's opinion
   ============================================================
   The child still decides. The mic offers what it measured and, on
   the contrasts it genuinely cannot hear (/f/ vs /th/, where a stop
   was made), shows the picture and asks them about their own mouth.
   Nothing here auto-marks a card: an app that says "wrong" on a
   sound it cannot distinguish teaches a child to distrust it.
   ============================================================ */

function micTargets() {
  return (window.PhonicsMic && current) ? PhonicsMic.phonemesForGpcs(current.gpcIds) : [];
}

// One box per sound, drawn from the card. Boxes stay blank until they are
// filled: showing the answer defeats the point of asking.
function buildSoundBoxes() {
  const wrap = $("sayBoxes");
  if (!wrap) return;
  boxClaimed = [];
  boxPending = null;
  boxConfirm = null;
  boxPicked = null;
  lastClip = null;
  if ($("sayCompare")) $("sayCompare").hidden = true;
  boxTargets = (window.PhonicsMic && current)
    ? PhonicsMic.targetsFor(current.sounds, current.gpcIds) : [];
  wrap.hidden = !usingBoxes();
  if (!usingBoxes()) return;
  $("sayBoxHint").innerHTML = "This code makes <b>" + boxTargets.length +
    "</b> sounds. Tap one, then say it.";
  const row = $("sayBoxRow");
  row.innerHTML = "";
  boxTargets.forEach((t) => {
    const b = document.createElement("div");
    b.className = "sb";
    b.dataset.id = t.id;
    b.innerHTML = '<span class="sb-mark">?</span><span class="sb-eg"></span>';
    row.appendChild(b);
  });
  paintPicked();
}

function boxFor(id) { return $("sayBoxRow").querySelector('[data-id="' + CSS.escape(id) + '"]'); }

function fillBox(id) {
  const t = boxTargets.find((x) => x.id === id);
  const el = boxFor(id);
  if (!t || !el) return;
  if (boxClaimed.indexOf(id) === -1) boxClaimed.push(id);
  el.classList.remove("pickable", "picked");
  el.className = "sb done";
  el.querySelector(".sb-mark").textContent = t.label || "\u2713";
  el.querySelector(".sb-eg").textContent = t.eg || "";
  // Each box is its own GPC, so mastery lands where it belongs instead of
  // all three sounds of <a> sharing one score.
  if (window.PhonicsTracker && PhonicsTracker.record) {
    try { PhonicsTracker.record(id + "|decode", { correct: true }); } catch (e) {}
  }
}

// Two sounds the microphone cannot separate. Rather than pick one, mark
// both and let the child say which they meant.
//
// The boxes are blank until they are filled — showing the answer defeats
// the point of asking. But a choice between two blanks is not a choice, so
// these two reveal their example word: "food" or "put" is something a
// five-year-old can actually pick between.
function offerChoice(ids) {
  boxPending = ids.slice();
  ids.forEach((id) => {
    const t = boxTargets.find((x) => x.id === id);
    const el = boxFor(id);
    if (!el || !t || boxClaimed.indexOf(id) !== -1) return;
    el.className = "sb maybe";
    el.querySelector(".sb-mark").textContent = t.label || "?";
    el.querySelector(".sb-eg").textContent = t.eg ? "as in " + t.eg : "tap if this";
  });
}

function clearChoice() {
  (boxPending || []).forEach((id) => {
    const el = boxFor(id);
    if (el && boxClaimed.indexOf(id) === -1) {
      el.className = "sb";
      el.querySelector(".sb-mark").textContent = "?";
      el.querySelector(".sb-eg").textContent = "";
    }
  });
  boxPending = null;
}

function boxesLeft() { return boxTargets.length - boxClaimed.length; }

// The first sound on this card that is a vowel, with where it sits on the
// diagram. A card like <a> carries three; the mouth shows the one being
// practised first, and a child who says a different one still gets placed
// — they just see how far that is from this card's shape.
function firstVowelTarget() {
  if (!window.PhonicsMic || !current || !current.sounds) return null;
  for (const s of current.sounds) {
    const t = PhonicsMic.targetFor(s.s, s.ex);
    if (t) return t;
  }
  return null;
}

// The vowel diagram lives for as long as the card does: mounting it once
// per card keeps the tongue where the last animation left it, so "show
// mine" starts from the model's shape instead of snapping to neutral.
let vowelCtl = null, vowelTarget = null, vowelPose = null, vowelCancel = null;

/* ---- a grapheme that makes more than one sound ----------------------
   <a> says three sounds, <ough> says six. One attempt graded against one
   target either marks a right answer wrong or accepts anything, so each
   sound gets a box — and the boxes fill in WHATEVER ORDER the child says
   them. There is no correct order for the sounds a letter makes, and
   grading position by position would punish something that isn't an
   error. An attempt claims the box it best matches out of those still
   empty; two sounds too alike to separate claim nothing and get asked
   about, the same way /f/ and /th/ do.                                */
let boxTargets = [], boxClaimed = [], boxPending = null, boxConfirm = null;
let boxPicked = null;      // which sound this attempt is aimed at
let lastClip = null;       // what the child just said, for playing back

/* ---- say it, hear both, you decide ----------------------------------
   The app used to hand down a verdict. It cannot honestly do that for
   most sounds: 13 of the 24 consonants have no cue a microphone can
   settle, and every vowel reading is meaningless until the speaker has
   been calibrated — an uncalibrated adult gets measured against a
   child's vowel space and is told an open /ɑː/ was a close vowel.

   So the child hears the sound, hears themselves, and says whether they
   match. That works for all 44 sounds, needs no calibration, and puts
   the judgement where the evidence actually is. The measurements are
   still there on listen.html, which exists to show what the microphone
   can and cannot do.                                                  */

function usingBoxes() { return boxTargets.length > 1; }

function stopVowelAnim() { if (vowelCancel) { vowelCancel(); vowelCancel = null; } }

function resetMicStrip() {
  const strip = $("sayMicResult");
  if (!strip) return;
  buildSoundBoxes();
  strip.hidden = true;
  strip.className = "mic-result";
  $("sayMicAsk").hidden = true;
  $("sayMicPic").innerHTML = "";
  stopVowelAnim();
  $("sayMicVowel").hidden = true;
  $("sayMicConf").hidden = true;
  $("sayMicMouth").innerHTML = "";
  vowelCtl = null; vowelPose = null;
  vowelTarget = firstVowelTarget();
  const lvl = $("sayMicLevel");
  if (lvl) { lvl.hidden = true; lvl.firstElementChild.style.width = "0"; }
  const btn = $("sayMicBtn");
  if (btn) btn.hidden = !(window.PhonicsMic && PhonicsMic.supported() && micTargets().length);
}

// The place and manner the picture is drawn from. The bank is already
// loaded by the time a card is on screen, so this reads it rather than
// fetching the file a second time.
function articulationFor(phonemeId) {
  const p = window.PhonicsBank && PhonicsBank.phoneme(phonemeId);
  return (p && p.articulation) || null;
}

function drawMicPicture(host, phonemeId) {
  host.innerHTML = "";
  const a = articulationFor(phonemeId);
  if (!a || !window.Anatomy) return;
  host.innerHTML = Anatomy.svg({ place: a.place, manner: a.manner, voiced: a.voiced });
  const el = host.querySelector("svg");
  if (el) Anatomy.poseConsonant(el, a.place, a.manner, { animate: false, voiced: a.voiced });
}

const MIC_TITLES = {
  heard: "I heard that ✓",
  close: "Nearly",
  quiet: "I couldn't hear anything",
  ask: "I can't hear that one — you tell me",
};

function showMicResult(features, clip) {
  const strip = $("sayMicResult");
  lastClip = clip || null;
  if (clip && clip.buf && clip.buf.length > 2048) { showCompare(features); return; }
  if (!features) {
    strip.hidden = false;
    strip.className = "mic-result quiet";
    $("sayMicVerdict").textContent = MIC_TITLES.quiet;
    $("sayMicWhy").textContent = "Hold the button down while you make the sound.";
    return;
  }
  const cal = PhonicsMic.loadCal();
  const result = PhonicsMic.bestGrade(micTargets(), features, { calibration: cal });
  if (!result) return;

  strip.hidden = false;
  strip.className = "mic-result " + result.verdict;
  $("sayMicVerdict").textContent = MIC_TITLES[result.verdict] || result.verdict;

  // A vowel has no contact point to point at — it IS a tongue shape — so
  // instead of a still picture it gets the shape animated, then the child's
  // own shape on the same diagram.
  if (vowelTarget) { showVowelResult(features); return; }

  if (result.verdict === "ask") {
    $("sayMicWhy").textContent =
      "This sound and its partner look completely different but sound almost the same to a microphone.";
    $("sayMicQ").textContent = result.ask || "Does your mouth look like the picture?";
    drawMicPicture($("sayMicPic"), result.id);
    $("sayMicAsk").hidden = false;
    return;
  }
  $("sayMicAsk").hidden = true;
  $("sayMicWhy").textContent = result.why.length ? result.why.join(" ")
    : "Everything the microphone can check for this sound came back right.";
  // Heard it? Then hearing the model and self-marking is the next step,
  // exactly as before — the mic never marks the card on the child's behalf.
}

/* ---- vowels: show the shape, then show theirs ---------------------- */

function showVowelResult(features) {
  const strip = $("sayMicResult");
  const cal = PhonicsMic.loadCal();
  vowelPose = PhonicsListen.vowelPose(features, { calibration: cal });

  strip.hidden = false;
  $("sayMicAsk").hidden = true;
  $("sayMicVowel").hidden = false;
  if (!vowelCtl) vowelCtl = PhonicsMic.mountVowelMouth($("sayMicMouth"));

  if (!vowelPose) {
    // Nothing worth placing — a whisper, a consonant, or room noise. Say so
    // and still show the shape they were going for, which is the useful half.
    strip.className = "mic-result quiet";
    $("sayMicVerdict").textContent = "I couldn't read that one";
    $("sayMicWhy").textContent = "I need a clear, held vowel — try singing it out for a whole second.";
    $("sayMicVowelCap").textContent = "The shape to aim for";
    $("sayMicVowelTip").textContent = "Watch the tongue, then have another go.";
    $("sayMicShowMine").disabled = true;
    $("sayMicConf").hidden = true;
    playVowel("target");
    return;
  }

  const fb = PhonicsListen.vowelFeedback(vowelPose, vowelTarget.at);
  strip.className = "mic-result " + (fb.close ? "heard" : "close");
  $("sayMicVerdict").textContent = fb.close ? "That's the shape ✓" : "Nearly — look at the tongue";
  $("sayMicWhy").textContent = fb.close
    ? "Your tongue was where this sound lives."
    : fb.tip;
  $("sayMicVowelCap").textContent = "Your mouth vs the shape";
  $("sayMicVowelTip").textContent = fb.tip;
  $("sayMicShowMine").disabled = false;

  // Show the model first, then theirs, so the difference is what moves.
  playVowel("both");
  paintConfidence(vowelPose);
}

// The app must not draw a pinpoint it hasn't earned. A child's high pitch
// leaves LPC few harmonics to find F1 in, so the reading is a region — and
// when it is weak the UI says which way to read it.
function paintConfidence(pose) {
  const bar = $("sayMicConf");
  if (!bar) return;
  bar.hidden = false;
  const pct = Math.round(pose.confidence * 100);
  const how = pose.confidence >= 0.66 ? "a clear read"
            : pose.confidence >= 0.33 ? "roughly here" : "a rough guess";
  bar.innerHTML = "How sure I am: <b>" + how + "</b> — " +
    (pose.personal ? "measured against this child's own vowels"
                   : "measured against a general table; calibrate on the Listen page for a real reading") +
    '<i style="width:' + Math.max(6, pct) + '%"></i>';
}

function playVowel(which) {
  stopVowelAnim();
  if (!vowelCtl || !vowelTarget) return;
  if (which === "target") {
    vowelCancel = PhonicsMic.showTarget(vowelCtl, vowelTarget, { ms: 800 });
    return;
  }
  if (which === "mine") {
    vowelCancel = PhonicsMic.showAttempt(vowelCtl, vowelTarget, vowelPose, { ms: 700 });
    return;
  }
  // both: the model, a beat to look at it, then theirs
  vowelCancel = PhonicsMic.showTarget(vowelCtl, vowelTarget, {
    ms: 800,
    done() {
      const t = setTimeout(() => {
        if (vowelPose) vowelCancel = PhonicsMic.showAttempt(vowelCtl, vowelTarget, vowelPose, { ms: 700 });
      }, 650);
      vowelCancel = () => clearTimeout(t);
    },
  });
}

/* ---- hear both, then decide ------------------------------------------ */

function pickedTarget() {
  if (!usingBoxes()) return boxTargets[0] || null;
  if (boxPicked) {
    const t = boxTargets.find((x) => x.id === boxPicked);
    if (t && boxClaimed.indexOf(t.id) === -1) return t;
  }
  return boxTargets.find((t) => boxClaimed.indexOf(t.id) === -1) || null;
}

function paintPicked() {
  if (!usingBoxes()) return;
  const t = pickedTarget();
  boxTargets.forEach((x) => {
    const el = boxFor(x.id);
    if (!el) return;
    const done = boxClaimed.indexOf(x.id) !== -1;
    el.classList.toggle("pickable", !done);
    el.classList.toggle("picked", !done && !!t && x.id === t.id);
  });
}

async function playModel() {
  const t = pickedTarget();
  if (!t || !window.PhonicsAudio) return;
  $("cmpModel").classList.add("playing");
  try { await PhonicsAudio.playGpc(t.id); } catch (e) {}
  setTimeout(() => $("cmpModel").classList.remove("playing"), 500);
}

async function playMine() {
  if (!lastClip) return;
  $("cmpMine").classList.add("playing");
  await PhonicsMic.playClip(lastClip);
  $("cmpMine").classList.remove("playing");
}

function showCompare(features) {
  const strip = $("sayMicResult");
  const t = pickedTarget();
  strip.hidden = false;
  strip.className = "mic-result";
  $("sayMicAsk").hidden = true;
  $("sayMicVowel").hidden = true;
  $("sayMicConf").hidden = true;
  $("sayCompare").hidden = false;
  $("sayMicVerdict").textContent = "Have a listen";
  $("sayMicWhy").textContent = t && t.label
    ? "The sound, then you saying it."
    : "The sound, then you saying it.";
  $("cmpHead").textContent = t && t.label
    ? "This code's " + t.label + " sound" + (t.eg ? " (as in " + t.eg + ")" : "")
    : "Listen to both";

  // The vowel mouth still earns its place: it shows what their tongue did,
  // which is a different question from whether the sound matched.
  if (t && (t.kind === "v" || t.kind === "d") && features) {
    const attempt = PhonicsMic.attemptFrom(lastClip, { calibration: PhonicsMic.loadCal() });
    if (attempt && attempt.pose) showBoxMouth(t, attempt);
  }

  // Model first, then them, with a beat between so they are clearly two
  // things rather than one long noise.
  playModel().then(() => setTimeout(playMine, 420));
}

function judgeCompare(same) {
  const t = pickedTarget();
  const strip = $("sayMicResult");
  $("sayCompare").hidden = true;
  if (same && t) {
    if (usingBoxes()) fillBox(t.id);
    strip.className = "mic-result heard";
    const left = usingBoxes() ? boxesLeft() : 0;
    $("sayMicVerdict").textContent = left === 0 ? "That's it ✓" : "That's one ✓";
    $("sayMicWhy").textContent = left === 0
      ? "You matched every sound this code makes."
      : left + (left === 1 ? " sound to go — tap it and have a go." : " sounds to go.");
    boxPicked = null;
    paintPicked();
    return;
  }
  strip.className = "mic-result close";
  $("sayMicVerdict").textContent = "Have another go";
  $("sayMicWhy").textContent = "Play the sound again, listen to the shape of it, then try to copy it.";
}

/* ---- grading against the boxes (listen.html keeps this) -------------- */

function showBoxResult(clip) {
  const strip = $("sayMicResult");
  const cal = PhonicsMic.loadCal();
  clearChoice();
  const attempt = PhonicsMic.attemptFrom(clip, { calibration: cal });
  strip.hidden = false;
  strip.className = "mic-result";
  $("sayMicAsk").hidden = true;
  $("sayMicVowel").hidden = true;
  $("sayMicConf").hidden = true;

  if (!attempt) {
    strip.className = "mic-result quiet";
    $("sayMicVerdict").textContent = "I couldn't hear that";
    $("sayMicWhy").textContent = "Hold the button down while you make the sound.";
    return;
  }

  const m = PhonicsListen.matchSounds(boxTargets, attempt, { calibration: cal, claimed: boxClaimed });
  const left = () => boxesLeft();

  if (m.verdict === "claimed") {
    fillBox(m.claimed);
    showBoxMouth(m.scores[0] && m.scores[0].target, attempt);
    strip.className = "mic-result heard";
    $("sayMicVerdict").textContent = left() === 0 ? "All of them ✓" : "That's one of them ✓";
    $("sayMicWhy").textContent = left() === 0
      ? "You said every sound this code makes."
      : left() + (left() === 1 ? " sound to go." : " sounds to go.");
    return;
  }

  // Best match, but on cues that don't settle the sound — /θ/ beats /ð/ on
  // voicing while still being indistinguishable from /f/. The box waits for
  // the child's eyes before it fills.
  if (m.verdict === "confirm") {
    boxConfirm = m.confirm.id;
    strip.className = "mic-result ask";
    $("sayMicVerdict").textContent = "I can't hear that one — you tell me";
    $("sayMicWhy").textContent =
      "This sound and its partner look completely different but sound almost the same to a microphone.";
    $("sayMicQ").textContent = (m.confirm.grade && m.confirm.grade.ask) || "Does your mouth look like the picture?";
    drawMicPicture($("sayMicPic"), m.confirm.target.phoneme);
    $("sayMicAsk").hidden = false;
    boxFor(m.confirm.id).classList.add("near");
    return;
  }

  if (m.verdict === "ambiguous") {
    offerChoice(m.ambiguous);
    strip.className = "mic-result ask";
    $("sayMicVerdict").textContent = "Which one did you mean?";
    $("sayMicWhy").textContent =
      "Those two sounds are almost the same to a microphone — I'd be guessing. " +
      "Tap the one you said.";
    return;
  }

  if (m.verdict === "quiet") {
    strip.className = "mic-result quiet";
    $("sayMicVerdict").textContent = "Too quiet";
    $("sayMicWhy").textContent = "Try again a bit louder.";
    return;
  }

  strip.className = "mic-result close";
  $("sayMicVerdict").textContent = "Nearly";
  // Say what to change, not just that it was wrong. The nearest target
  // still has grade()'s coaching attached — "pull your tongue forward" is
  // worth more than "that isn't one of them".
  const coach = m.nearest && m.nearest.grade && m.nearest.grade.why.length
    ? m.nearest.grade.why.join(" ") : null;
  $("sayMicWhy").textContent = coach || (left() === boxTargets.length
    ? "That's not one of this code's sounds. Have another go — listen to it first if you want."
    : "That's not one of the " + left() + " still to find.");
  if (m.nearest) showBoxMouth(m.nearest.target, attempt);
}

// A vowel box still gets the mouth: their tongue against the shape of the
// sound they were nearest to. The boxes say WHICH sounds; the mouth says
// what their mouth actually did.
function showBoxMouth(target, attempt) {
  if (!target || (target.kind !== "v" && target.kind !== "d") || !attempt.pose) return;
  vowelTarget = target.kind === "d"
    ? { at: target.to, from: target.from, glide: true }
    : { at: target.at };
  vowelPose = attempt.pose;
  $("sayMicVowel").hidden = false;
  if (!vowelCtl) vowelCtl = PhonicsMic.mountVowelMouth($("sayMicMouth"));
  const fb = PhonicsListen.vowelFeedback(vowelPose, vowelTarget.at);
  $("sayMicVowelCap").textContent = "Your mouth vs " + (target.label || "the shape");
  $("sayMicVowelTip").textContent = fb ? fb.tip : "";
  $("sayMicShowMine").disabled = false;
  $("sayMicShowTarget").disabled = false;
  playVowel("both");
}

// The child settles what the microphone couldn't.
function chooseBox(id) {
  if (!boxPending || boxPending.indexOf(id) === -1) return;
  const others = boxPending.filter((x) => x !== id);
  boxPending = null;
  fillBox(id);
  others.forEach((o) => {
    const el = boxFor(o);
    if (el && boxClaimed.indexOf(o) === -1) {
      el.className = "sb";
      el.querySelector(".sb-mark").textContent = "?";
      el.querySelector(".sb-eg").textContent = "";
    }
  });
  const strip = $("sayMicResult");
  strip.className = "mic-result heard";
  $("sayMicVerdict").textContent = boxesLeft() === 0 ? "All of them ✓" : "Got it ✓";
  $("sayMicWhy").textContent = boxesLeft() === 0
    ? "You said every sound this code makes."
    : boxesLeft() + (boxesLeft() === 1 ? " sound to go." : " sounds to go.");
}

function answerMicAsk(saidYes) {
  const strip = $("sayMicResult");
  $("sayMicAsk").hidden = true;
  if (boxConfirm) {
    const id = boxConfirm;
    boxConfirm = null;
    const el = boxFor(id);
    if (el) el.classList.remove("near");
    if (saidYes) {
      fillBox(id);
      strip.className = "mic-result heard";
      $("sayMicVerdict").textContent = boxesLeft() === 0 ? "All of them ✓" : "Got it ✓";
      $("sayMicWhy").textContent = boxesLeft() === 0
        ? "You said every sound this code makes."
        : boxesLeft() + (boxesLeft() === 1 ? " sound to go." : " sounds to go.");
    } else {
      strip.className = "mic-result close";
      $("sayMicVerdict").textContent = "Have another go";
      $("sayMicWhy").textContent = "Look at the picture, copy the mouth, then try it again.";
    }
    return;
  }
  strip.className = "mic-result " + (saidYes ? "heard" : "close");
  $("sayMicVerdict").textContent = saidYes ? "Good — that's the one ✓" : "Have another go";
  $("sayMicWhy").textContent = saidYes
    ? "You checked your own mouth. That's the part the app can't do for you."
    : "Look at the picture, copy the mouth, then try it again.";
}

// Different graphemes can spell the same sound — er / ir / ur / ear / wor
// all say "er", and ai / ay / eigh all say "ā" — so the audio alone cannot
// tell a student which spelling this card wants. A typed sound-alike is not
// an error: hint at the card's example word and let them try again.
function soundAlikeOf(typed) {
  const idx = graphemeIndex[typed];
  if (idx === undefined) return false;
  const typedSounds = GRAPHEMES[idx].sounds.map((s) => s.s);
  return current.sounds.some((s) => typedSounds.includes(s.s));
}

function showSoundAlikeHint(typed) {
  const el = $("soundAlikeHint");
  if (!el) return;
  el.innerHTML = 'Right sound! But <b>' + typed + '</b> is a different way to spell it. ' +
    'This card is the spelling you hear in &ldquo;<b>' + current.sounds[0].ex + '</b>&rdquo; &mdash; try again.';
  el.style.display = "block";
}

function clearSoundAlikeHint() {
  const el = $("soundAlikeHint");
  if (el) { el.textContent = ""; el.style.display = "none"; }
}

function checkTypedAnswer() {
  if (!current) return;
  const input = $("typeInput");
  const typed = input.value.trim().toLowerCase();
  const correct = current.grapheme.toLowerCase();
  if (!typed) return;

  if (typed === correct) {
    input.className = "flash-correct";
    clearSoundAlikeHint();
    revealAnswer();
    setTimeout(() => gradeCard(true), 1000);
  } else if (typed !== correct && soundAlikeOf(typed)) {
    input.className = "flash-almost";
    showSoundAlikeHint(typed);
    input.select();
  } else {
    input.className = "flash-wrong";
    clearSoundAlikeHint();
    revealAnswer();
    setTimeout(() => gradeCard(false), 1200);
  }
}

function showWriteGrade() {
  revealAnswer();
  $("writeCheckRow").style.display = "none";
  $("writeGradeRow").style.display = "flex";
}

function revealAnswer() {
  $("ansGrapheme").textContent = current.grapheme;
  if (window.Mouth) Mouth.reset();
  $("ansSounds").innerHTML = current.sounds.map((s) =>
    '<div class="sound-item"><span class="sound-text"><span class="sym">' + s.s + '</span> <span class="ex">e.g. ' + s.ex + '</span></span>' +
    (window.Mouth ? Mouth.html(s.s, s.ex) : "") +
    '</div>'
  ).join("");
  if (window.Mouth) Mouth.activate($("ansSounds"));
  $("answerBox").classList.add("show");
}

function gradeCard(gotIt) {
  const card = queue.shift();
  const g = card.grapheme;
  attempts[g] = (attempts[g] || 0) + 1;

  if (gotIt) {
    masteredOnTry[g] = attempts[g];
    addToShelf(card);
  } else {
    missed.add(g);
    const insertAt = Math.max(1, Math.floor(queue.length / 2) + Math.floor(Math.random() * Math.ceil(queue.length / 2)));
    queue.splice(Math.min(insertAt, queue.length), 0, card);
  }
  nextCard();
}

function clearShelf() {
  $("masteredShelf").innerHTML = '<span class="shelf-empty" id="shelfEmpty">Cards you get right appear here</span>';
}

function addToShelf(card) {
  const empty = $("shelfEmpty");
  if (empty) empty.remove();
  const item = document.createElement("span");
  item.className = "shelf-item";
  item.textContent = card.grapheme;
  $("masteredShelf").appendChild(item);
}

function finishSession() {
  showScreen("report");
  renderSummary();
  renderRemediation();
  $("reportReviewBtn").style.display = missed.size ? "inline-block" : "none";
}

function renderSummary() {
  const buckets = {};
  Object.keys(masteredOnTry).forEach((g) => {
    const t = masteredOnTry[g];
    (buckets[t] = buckets[t] || []).push(g);
  });

  const firstTry = (buckets[1] || []).length;
  let html = '<div class="report-headline">You practised <b>' + sessionTotal +
    '</b> code' + (sessionTotal === 1 ? "" : "s") + ' &middot; <b>' + firstTry +
    '</b> right first try</div>';

  const tries = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  html += '<div class="report-rows">';
  tries.forEach((t) => {
    const label = t === 1 ? "First try" : t === 2 ? "Second try" : t + "th try";
    html += '<div class="report-row"><span class="rtry">' + label + '</span>' +
      '<span class="rcodes">' + buckets[t].map((g) => '<span class="rcode">' + g + '</span>').join("") + '</span></div>';
  });
  html += '</div>';

  if (missed.size === 0) {
    html += '<div class="report-perfect">Perfect run — everything right first go! 🎉</div>';
  }
  $("reportSummary").innerHTML = html;
}

function renderRemediation() {
  const box = $("reportRemediation");
  if (missed.size === 0) {
    box.innerHTML = "";
    $("practiceSheetBtn").style.display = "none";
    return;
  }

  const levelToCodes = {};
  missed.forEach((g) => {
    const lvl = graphemeToBookmark[g];
    if (lvl === undefined) return;
    (levelToCodes[lvl] = levelToCodes[lvl] || []).push(g);
  });

  let html = '<div class="remedy-title">Revise these</div>' +
    '<p class="remedy-sub">' + (practiceMode === "say"
      ? "Codes to read again — tap to watch the reading demo or open the activity sheets."
      : "Codes to write again — tap to watch the writing demo or open the activity sheets.") + '</p>';

  // The reading/writing demo videos + activity sheets are specific to the
  // elc-bookmarks program's printed levels — only look them up (and show
  // the remedy-links row) when that sequence is active.
  const withResources = isElcBookmarks();

  Object.keys(levelToCodes).map(Number).sort((a, b) => a - b).forEach((lvl) => {
    const meta = BOOKMARK_LEVELS[lvl];
    const res = withResources ? BOOKMARK_RESOURCES[lvl] : null;
    const codes = levelToCodes[lvl];

    html += '<div class="remedy-card" style="border-left-color:' + meta.colour + '">';
    html += '<div class="remedy-head"><span class="swatch" style="background:' + meta.colour + '"></span>' +
      meta.name + '</div>';
    html += '<div class="remedy-codes">' + codes.map((g) => '<span class="rcode">' + g + '</span>').join("") + '</div>';

    if (res) {
      const links = [];
      if (practiceMode === "say") {
        if (res.reading) links.push(linkBtn("▶ Reading demo", res.reading));
        res.activities.filter((a) => ["read", "look"].includes(a.kind)).forEach((a) => {
          links.push(linkBtn("📄 " + a.name, a.url));
        });
      } else {
        if (res.writing) links.push(linkBtn("▶ Writing demo", res.writing));
        res.activities.filter((a) => ["write", "look"].includes(a.kind)).forEach((a) => {
          links.push(linkBtn("📄 " + a.name, a.url));
        });
      }
      if (links.length === 0 && res.reading) links.push(linkBtn("▶ Demo", res.reading));
      html += '<div class="remedy-links">' + links.join("") + '</div>';
    }
    html += '</div>';
  });

  box.innerHTML = html;
  $("practiceSheetBtn").style.display = viewMode === "year" ? "inline-block" : "none";
}

function linkBtn(label, url) {
  return '<a class="remedy-link" href="' + url + '" target="_blank" rel="noopener">' + label + '</a>';
}

function openPracticeSheet() {
  const codes = [...missed];
  const cards = codes.map((g) => {
    const idx = graphemeIndex[g];
    const data = GRAPHEMES[idx];
    const words = data.sounds.map((s) => s.ex).join(", ");
    const sounds = data.sounds.map((s) => s.s).join("  ");
    return '<div class="ps-card"><div class="ps-code">' + g + '</div>' +
      '<div class="ps-sounds">' + sounds + '</div>' +
      '<div class="ps-words">' + words + '</div></div>';
  }).join("");

  const w = window.open("", "_blank");
  w.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Practice sheet</title><style>' +
    'body{font-family:Georgia,serif;margin:32px;color:#1f1f1f;}' +
    'h1{font-size:20px;}p{color:#555;font-size:13px;}' +
    '.ps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px;}' +
    '.ps-card{border:2px solid #1f1f1f;border-radius:10px;padding:18px;text-align:center;page-break-inside:avoid;}' +
    '.ps-code{font-size:40px;font-weight:700;}' +
    '.ps-sounds{font-size:18px;color:#a83232;margin:6px 0;letter-spacing:2px;}' +
    '.ps-words{font-size:13px;color:#555;font-style:italic;}' +
    '@media print{button{display:none;}}' +
    '</style></head><body>' +
    '<h1>Phonics practice sheet</h1>' +
    '<p>Codes to keep practising. Read each card, say the sound(s), then write a word.</p>' +
    '<button onclick="window.print()" style="padding:8px 16px;">Print</button>' +
    '<div class="ps-grid">' + cards + '</div></body></html>'
  );
  w.document.close();
}

function reviewMissed() {
  selected.clear();
  [...missed].forEach((g) => selected.add(graphemeIndex[g]));
  startSession();
}

let audioEl = null;
function playCurrent() {
  if (!current) return;
  const btn = $("listenBtn");
  if (audioEl) { audioEl.pause(); audioEl = null; }

  if (btn) btn.classList.add("playing");
  const done = () => { if (btn) btn.classList.remove("playing"); };

  // Prefer the composed reading built from the recorded letter names and
  // phonemes ("A … /a/ … /ay/ … /ah/"). It only wins when every letter of the
  // grapheme has a clip for this accent; otherwise playGraphemeReading falls
  // back to the baked <Grapheme>.mp4, then to the phoneme chain — so this is
  // exactly today's behaviour until the recordings exist.
  if (window.PhonicsAudio && PhonicsAudio.playGraphemeReading) {
    PhonicsAudio.playGraphemeReading(current.grapheme, current.gpcIds || [],
                                     { mp4Stem: current.audio || null }).then(done, done);
    return;
  }

  if (current.audio) {
    audioEl = new Audio(current.audio + ".mp4");
    if (btn) {
      audioEl.addEventListener("ended", done);
      audioEl.addEventListener("error", done);
    }
    audioEl.play().catch(done);
    return;
  }
  const gpcId = current.gpcIds && current.gpcIds[0];
  if (gpcId && window.PhonicsAudio) PhonicsAudio.playGpc(gpcId).then(done, done);
  else done();
}

let canvas, ctx, drawing = false;
function initCanvas() {
  canvas = $("writeCanvas");
  ctx = canvas.getContext("2d");
  styleCtx();
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (canvas.width / r.width), y: (p.clientY - r.top) * (canvas.height / r.height) };
  }
  function start(e) { e.preventDefault(); drawing = true; const pt = pos(e); ctx.beginPath(); ctx.moveTo(pt.x, pt.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); const pt = pos(e); ctx.lineTo(pt.x, pt.y); ctx.stroke(); }
  function end() { drawing = false; }
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
}
function styleCtx() { ctx.strokeStyle = "#1f1f1f"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
function clearCanvas() { if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); styleCtx(); }

function setInputMode(mode) {
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
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---- Program picker (data-bank sequence switcher) ----
// Year Levels / bookmark demo links are elc-bookmarks-specific (see
// isElcBookmarks()); everything else — the drill, the tracker grid, the
// grapheme grid, the report — works for whichever sequence is active.

function populateSeqPicker() {
  const sel = $("seqPicker");
  if (!sel) return;
  const activeId = PhonicsBank.seq() && PhonicsBank.seq().id;
  sel.innerHTML = "";
  PhonicsBank.sequences().forEach((s) => {
    if (!s.units) return; // skip empty templates (e.g. custom-template)
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name + (s.approximate ? " (approximate)" : "");
    if (s.id === activeId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function updateElcSpecificUI() {
  const isElc = isElcBookmarks();
  const yearBtn = $("viewYearBtn");
  if (yearBtn) yearBtn.style.display = isElc ? "" : "none";
  const bmDesc = document.querySelector("#viewBookmarkBtn .desc");
  if (bmDesc) {
    bmDesc.textContent = isElc
      ? "The 14 levels — APTIN, SMOBC, GHKDE… with the colour tracker."
      : "The levels of the active program, with the colour tracker.";
  }
}

// Reset everything session/selection state so a stale selection from the
// previous program can't leak into the new one.
function resetSessionState() {
  selected.clear();
  activeLevels = new Set();
  activeCats = new Set();
  queue = [];
  current = null;
  sessionTotal = 0;
  attempts = {};
  masteredOnTry = {};
  missed = new Set();
  // "Year Levels" is elc-bookmarks-specific — fall back to bookmark/unit
  // view for any other program.
  if (!isElcBookmarks() && viewMode === "year") viewMode = "bookmark";
}

async function onSeqPickerChange(e) {
  const id = e.target.value;
  if (!id || (PhonicsBank.seq() && PhonicsBank.seq().id === id)) return;
  try {
    await PhonicsBank.setSequence(id);
  } catch (err) {
    console.error(err);
    populateSeqPicker(); // snap the dropdown back to whatever is actually active
    return;
  }
  applySequenceData();
  resetSessionState();
  updateElcSpecificUI();
  showScreen("mode");
}

function initUI() {
  screens.mode   = $("modeScreen");
  screens.view   = $("viewScreen");
  screens.select = $("selectScreen");
  screens.card   = $("cardScreen");
  screens.report = $("reportScreen");
  screens.wall   = $("wallScreen");

  initCanvas();
  populateSeqPicker();
  updateElcSpecificUI();
  const seqPicker = $("seqPicker");
  if (seqPicker) seqPicker.addEventListener("change", onSeqPickerChange);

  $("modeSayBtn").addEventListener("click", () => chooseMode("say"));
  $("modeWriteBtn").addEventListener("click", () => chooseMode("write"));
  $("modeWallBtn").addEventListener("click", () => showScreen("wall"));
  $("wallBackBtn").addEventListener("click", () => showScreen("mode"));

  $("viewYearBtn").addEventListener("click", () => chooseView("year"));
  $("viewBookmarkBtn").addEventListener("click", () => chooseView("bookmark"));
  $("viewBackBtn").addEventListener("click", () => showScreen("mode"));

  $("selectAll").addEventListener("click", () => {
    setAllChips(true);
    activeCats = new Set(PHON_GROUPS.map((g) => g.name));
    $("catBar").querySelectorAll(".cat-btn").forEach((b) => b.classList.add("active"));
  });
  $("selectNone").addEventListener("click", () => {
    setAllChips(false);
    activeCats.clear();
    $("catBar").querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
  });
  $("startBtn").addEventListener("click", startSession);
  $("selectBackBtn").addEventListener("click", () => showScreen("view"));

  $("sayCheckBtn").addEventListener("click", sayCheck);
  $("sayGotBtn").addEventListener("click", () => gradeCard(true));
  $("sayMissedBtn").addEventListener("click", () => gradeCard(false));

  if (window.PhonicsMic && PhonicsMic.supported()) {
    const micBtn = $("sayMicBtn");
    const lvl = $("sayMicLevel");
    PhonicsMic.holdToTalk(micBtn, {
      onStart() {
        micBtn.classList.add("listening");
        micBtn.textContent = "🎤 Listening…";
        $("sayMicResult").hidden = true;
        lvl.hidden = false;
      },
      onStop() {
        micBtn.classList.remove("listening");
        micBtn.textContent = "🎤 Hold & say it";
        lvl.hidden = true;
      },
      onLevel(v) { lvl.firstElementChild.style.width = (v * 100) + "%"; },
      onError(msg) {
        const strip = $("sayMicResult");
        strip.hidden = false;
        strip.className = "mic-result quiet";
        $("sayMicVerdict").textContent = "No microphone";
        $("sayMicWhy").textContent = msg;
        micBtn.hidden = true;
      },
      onResult: showMicResult,
    });
    $("sayMicYes").addEventListener("click", () => answerMicAsk(true));
    $("sayMicNo").addEventListener("click", () => answerMicAsk(false));
    $("sayBoxRow").addEventListener("click", (e) => {
      const maybe = e.target.closest(".sb.maybe");
      if (maybe) { chooseBox(maybe.dataset.id); return; }
      const pick = e.target.closest(".sb.pickable");
      if (pick) { boxPicked = pick.dataset.id; paintPicked(); }
    });
    $("cmpModel").addEventListener("click", playModel);
    $("cmpMine").addEventListener("click", playMine);
    $("cmpSame").addEventListener("click", () => judgeCompare(true));
    $("cmpDiff").addEventListener("click", () => judgeCompare(false));
    $("sayMicShowTarget").addEventListener("click", () => playVowel("target"));
    $("sayMicShowMine").addEventListener("click", () => playVowel("mine"));
  }

  $("listenBtn").addEventListener("click", playCurrent);
  $("modeType").addEventListener("click", () => setInputMode("type"));
  $("modeWrite").addEventListener("click", () => setInputMode("write"));
  $("clearCanvas").addEventListener("click", clearCanvas);
  $("typeCheckBtn").addEventListener("click", checkTypedAnswer);
  $("typeInput").addEventListener("keypress", (e) => { if (e.key === "Enter") checkTypedAnswer(); });
  $("writeRevealBtn").addEventListener("click", showWriteGrade);
  $("gotItBtn").addEventListener("click", () => gradeCard(true));
  $("againBtn").addEventListener("click", () => gradeCard(false));

  $("quitBtn").addEventListener("click", () => { if (audioEl) audioEl.pause(); showScreen("select"); });

  $("printBtn").addEventListener("click", () => window.print());
  $("practiceSheetBtn").addEventListener("click", openPracticeSheet);
  $("reportReviewBtn").addEventListener("click", reviewMissed);
  $("reportRestartBtn").addEventListener("click", () => showScreen("mode"));
}

// ---- Boot: load the data bank, build today's runtime structures from the
// active sequence, then wire up the UI. Nothing above this point touches
// the DOM or the bank at load time — GRAPHEMES/BOOKMARK_LEVELS/PHON_GROUPS
// stay empty until this runs. ----
async function bootBank() {
  try {
    await PhonicsBank.load();
  } catch (err) {
    console.error("PhonicsBank failed to load:", err);
    const mode = $("modeScreen");
    if (mode) {
      mode.innerHTML =
        '<div class="report-headline">Sorry — the phonics data bank could not be loaded.</div>' +
        '<p class="subtitle">Check your connection and reload the page. ' +
        '(' + (err && err.message ? err.message : "unknown error") + ')</p>';
    }
    return;
  }
  applySequenceData();
  initUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootBank);
} else {
  bootBank();
}
