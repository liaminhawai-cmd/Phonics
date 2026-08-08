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

// Colours match the printed physical bookmarks (read off bookmarks.pdf).
const BOOKMARK_LEVELS = [
  { name: "Level 1 – APTIN",  graphemes: ["a","p","t","i","n"],        colour: "#cfe0f5" },
  { name: "Level 2 – SMOBC",  graphemes: ["s","m","o","b","c"],        colour: "#5b9bd5" },
  { name: "Level 3 – GHKDE",  graphemes: ["g","h","k","d","e"],        colour: "#dcd6ec" },
  { name: "Level 4 – LRFVU",  graphemes: ["l","r","f","v","u"],        colour: "#7c64b0" },
  { name: "Level 5 – JWZXY",  graphemes: ["j","w","z","x","y"],        colour: "#d4e6c5" },
  { name: "Level 6",          graphemes: ["qu","sh","th","ch","ay"],   colour: "#84b063" },
  { name: "Level 7",          graphemes: ["wh","ck","ee","er","ar"],   colour: "#fbecc2" },
  { name: "Level 8",          graphemes: ["ed","oo","igh","ai","oy"],  colour: "#f5c33c" },
  { name: "Level 9",          graphemes: ["oi","oa","ea","ir","ow"],   colour: "#f3cbc4" },
  { name: "Level 10",         graphemes: ["oe","au","aw","or","wr"],   colour: "#d75f50" },
  { name: "Level 11",         graphemes: ["ph","kn","ie","ei","eigh"], colour: "#ededed" },
  { name: "Level 12",         graphemes: ["ou","ew","ur","ear","wor"], colour: "#d6e5ec" },
  { name: "Level 13",         graphemes: ["dge","ui","ng","ey","ough"],colour: "#97b5d7" },
  { name: "Level 14",         graphemes: ["gu","ti","si","ci","gn"],   colour: "#cacaca" },
];

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

// Sound-group names follow the Victorian Education State "44 Sounds"
// scope & sequence: vowels split into Short / Long / R-Controlled / Other,
// consonants grouped by manner of articulation.
const PHON_GROUPS = [
  { name: "Short Vowels",        graphemes: ["a","e","i","o","u"] },
  { name: "Long Vowels",         graphemes: ["ay","ai","ee","ea","ie","igh","oe","oa","ow","oo","ew","ui","ey","ei","eigh"] },
  { name: "R-Controlled Vowels", graphemes: ["ar","er","ir","ur","or","ear","wor"] },
  { name: "Other Vowels",        graphemes: ["ou","oy","oi","au","aw"] },
  { name: "Stops",               graphemes: ["p","b","t","d","k","c","g","ck","qu","x","gu"] },
  { name: "Nasals",              graphemes: ["m","n","ng","kn","gn"] },
  { name: "Fricatives",          graphemes: ["f","v","th","s","z","sh","h","ph","wh","ci","si","ti"] },
  { name: "Affricates",          graphemes: ["ch","j","dge"] },
  { name: "Approximants",        graphemes: ["w","r","y","wr"] },
  { name: "Lateral",             graphemes: ["l"] },
  { name: "Other Codes",         graphemes: ["ed","ough"] },
];

const YEAR_LEVELS = {
  "Pre":  ["a","p","t","i","n","s","m","o","b","c","g","h","k","d","e","l","r","f","v","u","j","w","z","x","y"],
  "Yr 1": ["qu","sh","th","ch","ay","wh","ck","ee","er","ar"],
  "Yr 2": ["ed","oo","igh","ai","oy","oi","oa","ea","ir","ow"],
  "Yr 3": ["oe","au","aw","or","wr","ph","kn","ie","ei","eigh"],
  "Yr 4": ["ou","ew","ur","ear","wor","dge","ui","ng","ey","ough","gu","ti","si","ci","gn"],
};

const graphemeIndex = {};
GRAPHEMES.forEach((g, i) => { graphemeIndex[g.grapheme] = i; });

const graphemeToBookmark = {};
BOOKMARK_LEVELS.forEach((lvl, i) => {
  lvl.graphemes.forEach((gr) => { graphemeToBookmark[gr] = i; });
});

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
    tracker.appendChild(row);
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
  } else {
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

function checkTypedAnswer() {
  if (!current) return;
  const input = $("typeInput");
  const typed = input.value.trim().toLowerCase();
  const correct = current.grapheme.toLowerCase();
  if (!typed) return;

  if (typed === correct) {
    input.classList.add("flash-correct");
    revealAnswer();
    setTimeout(() => gradeCard(true), 1000);
  } else {
    input.classList.add("flash-wrong");
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
  $("ansSounds").innerHTML = current.sounds.map((s) =>
    '<div class="sound-item"><span class="sym">' + s.s + '</span> <span class="ex">e.g. ' + s.ex + '</span></div>'
  ).join("");
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

  Object.keys(levelToCodes).map(Number).sort((a, b) => a - b).forEach((lvl) => {
    const meta = BOOKMARK_LEVELS[lvl];
    const res = BOOKMARK_RESOURCES[lvl];
    const codes = levelToCodes[lvl];

    html += '<div class="remedy-card" style="border-left-color:' + meta.colour + '">';
    html += '<div class="remedy-head"><span class="swatch" style="background:' + meta.colour + '"></span>' +
      meta.name + '</div>';
    html += '<div class="remedy-codes">' + codes.map((g) => '<span class="rcode">' + g + '</span>').join("") + '</div>';

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

    html += '<div class="remedy-links">' + links.join("") + '</div></div>';
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
  audioEl = new Audio(current.audio + ".mp4");
  if (btn) {
    audioEl.addEventListener("play",  () => btn.classList.add("playing"));
    audioEl.addEventListener("ended", () => btn.classList.remove("playing"));
    audioEl.addEventListener("error", () => btn.classList.remove("playing"));
  }
  audioEl.play().catch(() => {});
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

document.addEventListener("DOMContentLoaded", () => {
  screens.mode   = $("modeScreen");
  screens.view   = $("viewScreen");
  screens.select = $("selectScreen");
  screens.card   = $("cardScreen");
  screens.report = $("reportScreen");

  initCanvas();

  $("modeSayBtn").addEventListener("click", () => chooseMode("say"));
  $("modeWriteBtn").addEventListener("click", () => chooseMode("write"));

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
});
