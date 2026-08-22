// ============================================================
// js/views/sheets.js — the printable Sheet Generator (T11).
//
// docs/ARCHITECTURE.md §5 T11 / §11: "sheet generation stays
// in-browser (print CSS -> PDF), reusing task generators, so a
// sheet is literally the paper form of the same exercise — QR
// codes point at the word audio like the current sheets."
//
// This page regenerates the hand-made PDFs in activities/ for ANY
// program, ANY unit and ANY accent. Nothing about a program is
// hardcoded: units, colours, graphemes and words all come from
// window.PhonicsBank; the spelling-choice sheet reads
// data/rules/rules.json.
//
// Split in two halves, same shape as js/views/explorer.js:
//   PhonicsSheetsModel — pure, DOM-free, deterministic. Node can
//     require() this file and exercise every generator without a
//     browser (that's how the sheet contents are unit-checked).
//   the IIFE below it  — DOM wiring, only runs when `document`
//     exists.
//
// Determinism contract: (program, unit, sheet type, word count,
// accent, seed) -> exactly the same sheet, forever. Shuffle bumps
// the seed and the seed is printed in the footer + kept in the URL
// (?seed=), so a teacher can reprint the identical sheet later.
// ============================================================

window.PhonicsSheetsModel = (() => {
  // ---- CONFIG ------------------------------------------------
  // Where the printed QR codes point. One line to change if the
  // site ever moves (fork, custom domain, local server).
  const BASE_URL = "https://liaminhawai-cmd.github.io/Phonics/";

  // Pastel fallback palette for programs that don't ship printed
  // unit colours (only elc-bookmarks does). Cycled by unit index.
  const FALLBACK_PALETTE = [
    "#cfe0f5", "#d4e6c5", "#f3cbc4", "#dcd6ec", "#fbecc2",
    "#d6e5ec", "#f5c9df", "#e3ddc9", "#c9e8df", "#ece0f7",
  ];

  // ---- sheet catalogue ---------------------------------------
  // `pdfName` mirrors the naming of the hand-made sheets in
  // activities/level-*/ ("SMOBC initial sounds listen and write",
  // "LFRVU Reading words") so generated sheets slot straight into
  // the existing catalogue.
  const TYPES = [
    {
      id: "reading",
      pdfName: "Reading words",
      heading: "Reading words",
      instruction: "Read each word out loud. Say the sounds, then say the whole word.",
      kind: "cards",
    },
    {
      id: "listen-initial",
      pdfName: "initial sounds listen and write",
      heading: "Initial sounds — listen and write",
      instruction: "Listen to the word. Write the missing FIRST sound in the empty box.",
      kind: "elkonin",
      position: "initial",
    },
    {
      id: "listen-middle",
      pdfName: "middle sounds listen and write",
      heading: "Middle sounds — listen and write",
      instruction: "Listen to the word. Write the missing MIDDLE sound in the empty box.",
      kind: "elkonin",
      position: "middle",
    },
    {
      id: "listen-end",
      pdfName: "end sounds listen and write",
      heading: "End sounds — listen and write",
      instruction: "Listen to the word. Write the missing LAST sound in the empty box.",
      kind: "elkonin",
      position: "end",
    },
    {
      id: "segment",
      pdfName: "segment and spell",
      heading: "Segment and spell",
      instruction: "Colour one circle for each syllable. Write one sound in each box, then write the whole word.",
      kind: "segment",
    },
    {
      id: "choice",
      pdfName: "spelling choice",
      heading: "Spelling choice",
      instruction: "Circle the spelling that makes the word, then write the word.",
      kind: "choice",
    },
  ];

  const typeById = id => TYPES.find(t => t.id === id) || TYPES[0];

  // ---- deterministic randomness ------------------------------
  // FNV-1a over the state key -> mulberry32. Same key, same sheet,
  // on any browser, forever.
  function hashSeed(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    let a = (hashSeed(seed) + 0x6d2b79f5) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, rng) {
    const out = (list || []).slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // The key every pick hangs off. Changing any control changes the
  // sheet; changing nothing reproduces it exactly.
  const stateKey = s =>
    [s.program, s.unit, s.type, s.count, s.accent, s.rule || "", s.seed].join("|");

  // ---- unit naming -------------------------------------------
  // "Level 2 – SMOBC" -> "SMOBC"; "Level 6" (no mnemonic) ->
  // "QuShThChAy" built from the graphemes it teaches, which is
  // exactly how activities/level-6/*.pdf is named.
  function unitKey(unit, graphemes) {
    const label = (unit && unit.label) || "";
    const dash = label.match(/\s[–—-]\s+(.+)$/);
    if (dash) {
      const tail = dash[1].trim();
      if (/^[A-Za-z]{2,14}$/.test(tail)) return tail;
    }
    // Split digraphs (a_e/"a-e") mash together into unreadable soup when
    // concatenated ("O-eU-eE-e") — bail to "Unit <n>" for those, and for
    // any abbreviation that's grown too long to read as a unit name.
    const hasHyphen = (graphemes || []).some(g => /-/.test(String(g || "")));
    const seen = [];
    for (const g of graphemes || []) {
      const disp = String(g || "").replace(/[_-]/g, "");
      if (!disp || seen.includes(disp)) continue;
      seen.push(disp);
    }
    if (seen.length && !hasHyphen) {
      const key = seen
        .slice(0, 6)
        .map(g => g.charAt(0).toUpperCase() + g.slice(1))
        .join("");
      if (key.length <= 10) return key;
    }
    return "Unit " + (unit && unit.n != null ? unit.n : "?");
  }

  // activities/-style file name, also the QR's &title=.
  const sheetName = (key, typeId) => (key + " " + typeById(typeId).pdfName).trim();

  // ---- word selection ----------------------------------------
  const unitGpcIds = unit => new Set(((unit && unit.teaches) || []).filter(Boolean));

  // Words that actually exercise THIS unit: at least one segment
  // whose GPC is taught in this unit (not merely decodable by now).
  function wordsInUnit(words, gpcIds, gpcIdsOf) {
    return (words || []).filter(w => (gpcIdsOf(w) || []).some(id => id && gpcIds.has(id)));
  }

  // Deterministic order: tier 1 first (the words worth printing),
  // shuffled inside each tier so sheets vary with the seed but never
  // with the browser.
  function orderWords(pool, key) {
    const rng = makeRng(key);
    const byTier = new Map();
    for (const w of pool || []) {
      const t = w.tier || 9;
      if (!byTier.has(t)) byTier.set(t, []);
      byTier.get(t).push(w);
    }
    const out = [];
    for (const tier of [...byTier.keys()].sort((a, b) => a - b)) {
      const group = byTier.get(tier).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      out.push(...shuffled(group, rng));
    }
    return out;
  }

  const pickWords = (pool, key, count) => orderWords(pool, key).slice(0, count);

  // ---- Elkonin boxes -----------------------------------------
  // Which box is left empty for the child to fill. "middle" means
  // the middle SOUND a teacher would dictate — the interior vowel
  // (twin -> /i/, not the /w/) — so pass vowelFlags when you have
  // them; without them it falls back to the geometric middle.
  function elkoninIndex(n, position, vowelFlags) {
    if (n <= 0) return -1;
    if (position === "initial") return 0;
    if (position === "end") return n - 1;
    const mid = Math.min(Math.max(1, Math.floor((n - 1) / 2)), n - 2);
    if (!vowelFlags) return mid;
    const inner = [];
    for (let i = 1; i <= n - 2; i++) if (vowelFlags[i]) inner.push(i);
    if (!inner.length) return mid;
    return inner.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), inner[0]);
  }

  // A word can only carry a sheet if it has enough boxes for the
  // target position (a middle-sound row needs an interior sound —
  // and, when we know, an interior vowel) and few enough boxes to
  // stay on the page.
  function fitsPosition(nSegs, position, maxBoxes, vowelFlags) {
    const max = maxBoxes || 7;
    if (nSegs > max) return false;
    if (position !== "middle") return nSegs >= 2;
    if (nSegs < 3) return false;
    if (!vowelFlags) return true;
    for (let i = 1; i <= nSegs - 2; i++) if (vowelFlags[i]) return true;
    return false;
  }

  // ---- QR ------------------------------------------------------
  // play.html?words=cat,dog&accent=au&title=... — the paper sheet's
  // link back to the audio for exactly these words.
  function qrPayload({ base, words, accent, title }) {
    const list = (words || []).map(w => (typeof w === "string" ? w : w.word)).filter(Boolean);
    const q =
      "play.html?words=" + encodeURIComponent(list.join(",")) +
      "&accent=" + encodeURIComponent(accent || "au") +
      "&title=" + encodeURIComponent(title || "");
    return (base || BASE_URL) + q;
  }

  // ---- spelling-choice rules ----------------------------------
  // Rule GPC ids are parsed rather than looked up, so a rule can
  // reference a spelling gpcs.json doesn't carry yet (augh.or, ve.v)
  // without breaking the sheet.
  function splitGpcId(id) {
    const i = String(id).indexOf(".");
    return i < 0 ? { grapheme: String(id), phoneme: "" } : { grapheme: String(id).slice(0, i), phoneme: String(id).slice(i + 1) };
  }

  const segPhoneme = seg => (Array.isArray(seg.p) ? seg.p.join("+") : seg.p);

  function segMatchesGpcId(seg, id) {
    const { grapheme, phoneme } = splitGpcId(id);
    return seg.g === grapheme && segPhoneme(seg) === phoneme;
  }

  // Everything this rule could print in an option slot: its own
  // GPCs plus every toggle-set target/distractor, deduped by the
  // grapheme the child actually sees ("ed.t"/"ed.d" both print
  // "ed", so they can't be told apart on paper).
  function ruleOptionUniverse(rule, displayOf) {
    const ids = [];
    for (const id of (rule && rule.gpcs) || []) ids.push(id);
    for (const set of (rule && rule.toggle_sets) || []) {
      if (set.target_gpc) ids.push(set.target_gpc);
      for (const d of set.distractors || []) ids.push(d);
    }
    const out = [];
    const seen = new Set();
    for (const id of ids) {
      const display = (displayOf && displayOf(id)) || splitGpcId(id).grapheme.replace(/_/g, "-");
      if (seen.has(display)) continue;
      seen.add(display);
      out.push({ id, display });
    }
    return out;
  }

  // A rule can only make a "circle the right spelling" sheet if it
  // offers at least three visibly different spellings.
  const ruleIsUsable = (rule, displayOf) =>
    !!(rule && rule.toggle_sets && rule.toggle_sets.length) && ruleOptionUniverse(rule, displayOf).length >= 3;

  // Words this rule can build a row from: one segment matches a
  // rule GPC, and no OTHER segment is a split digraph (the printed
  // skeleton is built by joining the remaining graphemes, and
  // "cute" -> "c" + [option] + "u_et" reads like nonsense).
  function ruleCandidates(rule, words, segmentsOf) {
    const segsOf = segmentsOf || (w => w.segments || []);
    const targets = (rule && rule.gpcs) || [];
    const out = [];
    for (const w of words || []) {
      const segs = segsOf(w);
      let idx = -1, hitId = null;
      for (let i = 0; i < segs.length && idx < 0; i++) {
        for (const id of targets) {
          if (segMatchesGpcId(segs[i], id)) { idx = i; hitId = id; break; }
        }
      }
      if (idx < 0) continue;
      if (segs.some((s, i) => i !== idx && s.split)) continue;
      out.push({ word: w, index: idx, targetId: hitId, segs });
    }
    return out;
  }

  // Rows for the spelling-choice sheet: bank words that use one of
  // the rule's GPCs, split around the target segment.
  function ruleRows(rule, words, opts = {}) {
    const segmentsOf = opts.segmentsOf || (w => w.segments || []);
    const displayOf = opts.displayOf;
    const key = opts.key || "";
    const count = opts.count == null ? 12 : opts.count;
    const universe = ruleOptionUniverse(rule, displayOf);
    const pool = ruleCandidates(rule, words, segmentsOf);

    return pickWords(pool.map(p => p.word), key, count).map(w => {
      const p = pool.find(x => x.word === w);
      const targetDisplay =
        (displayOf && displayOf(p.targetId)) || splitGpcId(p.targetId).grapheme.replace(/_/g, "-");
      const others = universe.filter(o => o.display !== targetDisplay);
      const picked = shuffled(others, makeRng(key + "|" + w.id)).slice(0, 2);
      const options = shuffled(
        [{ display: targetDisplay, correct: true }, ...picked.map(o => ({ display: o.display, correct: false }))],
        makeRng(key + "|opt|" + w.id)
      );
      return {
        word: w,
        before: p.segs.slice(0, p.index).map(s => s.g).join(""),
        after: p.segs.slice(p.index + 1).map(s => s.g).join(""),
        options,
      };
    });
  }

  // ---- misc ---------------------------------------------------
  const paletteFor = i => FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];

  // Readable ink on a printed colour band.
  function textColourFor(hex) {
    const c = (hex || "#cccccc").replace("#", "");
    const full = c.length === 3 ? c.split("").map(ch => ch + ch).join("") : c;
    const r = parseInt(full.substring(0, 2), 16) || 0;
    const g = parseInt(full.substring(2, 4), 16) || 0;
    const b = parseInt(full.substring(4, 6), 16) || 0;
    return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#1f1f1f" : "#ffffff";
  }

  // Same number of syllable circles on every row of a sheet, so the
  // count itself never gives the answer away.
  const syllableCircles = rows =>
    Math.max(3, ...(rows || []).map(w => (w.word ? w.word.syllables : w.syllables) || 1));

  const formatDate = d => {
    const dt = d || new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return dt.getDate() + " " + months[dt.getMonth()] + " " + dt.getFullYear();
  };

  return {
    BASE_URL, FALLBACK_PALETTE, TYPES, typeById,
    hashSeed, makeRng, shuffled, stateKey,
    unitKey, sheetName,
    unitGpcIds, wordsInUnit, orderWords, pickWords,
    elkoninIndex, fitsPosition,
    qrPayload,
    splitGpcId, segMatchesGpcId, ruleOptionUniverse, ruleIsUsable, ruleCandidates, ruleRows,
    paletteFor, textColourFor, syllableCircles, formatDate,
  };
})();

// Node can require() this file to test the model half.
if (typeof module === "object" && module.exports) module.exports = window.PhonicsSheetsModel;

// ============================================================
// DOM wiring — only runs in a browser.
// ============================================================
if (typeof document !== "undefined") {
  (function () {
    const M = window.PhonicsSheetsModel;
    const bank = window.PhonicsBank;

    const A4_W_PX = 794;           // 210mm at 96dpi — for preview scaling
    const A4_H_PX = 1123;

    const els = {};
    const state = {
      program: null, unit: 1, accent: "au", type: "reading",
      count: 12, seed: 1, rule: null, dotted: false,
    };
    let rules = [];                // data/rules/rules.json
    let allWords = [];             // data/words/words.json
    const wordCache = new Map();   // "program|unit|accent" -> words[]

    const q = id => document.getElementById(id);

    // ---- tiny helpers ---------------------------------------
    function el(tag, cls, text) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }

    function status(msg, isError) {
      els.status.hidden = !msg;
      els.status.textContent = msg || "";
      els.status.classList.toggle("status-error", !!isError);
    }

    // Same inline-bank trick as core/data.js so a standalone build
    // (build-standalone.py) can print sheets from file://.
    async function loadJson(rel) {
      const tag = document.getElementById("phonics-bank-inline");
      if (tag) {
        const inline = JSON.parse(tag.textContent)[rel];
        if (inline !== undefined) return inline;
      }
      const res = await fetch(rel);
      if (!res.ok) throw new Error("failed to load " + rel + " (" + res.status + ")");
      return res.json();
    }

    const gpcDisplay = id => {
      const g = bank.gpc(id);
      return g ? g.display || g.grapheme : M.splitGpcId(id).grapheme.replace(/_/g, "-");
    };

    // Per-segment "is this a vowel sound?" — lets the middle-sounds
    // sheet blank the vowel box rather than whatever sits in the
    // geometric middle (twin -> /i/, not /w/).
    const isVowel = p => {
      const rec = bank.phoneme(p);
      if (!rec) return false;
      if (rec.type) return rec.type === "vowel";
      // teaching unit (x = /k/+/s/, long u = /y/+/oo/): vowel if any part is
      return (rec.phonemes || []).some(x => {
        const r = bank.phoneme(x);
        return !!r && r.type === "vowel";
      });
    };

    const vowelFlags = w => bank.segmentsFor(w).map(s =>
      (Array.isArray(s.p) ? s.p : [s.p]).some(isVowel));

    // ---- URL state -------------------------------------------
    function readUrl() {
      const p = new URLSearchParams(location.search);
      const num = (k, min, max, dflt) => {
        const v = parseInt(p.get(k), 10);
        return Number.isFinite(v) && v >= min && v <= max ? v : dflt;
      };
      if (p.get("program")) state.program = p.get("program");
      if (p.get("accent")) state.accent = p.get("accent");
      if (p.get("type") && M.TYPES.some(t => t.id === p.get("type"))) state.type = p.get("type");
      if (p.get("rule")) state.rule = p.get("rule");
      const count = parseInt(p.get("count"), 10);
      state.count = [8, 12, 16].includes(count) ? count : 12;
      state.seed = num("seed", 0, 999999, 1);
      state.unit = num("unit", 1, 999, 1);
      state.dotted = p.get("dotted") === "1";
    }

    function writeUrl() {
      const p = new URLSearchParams();
      p.set("program", state.program);
      p.set("unit", state.unit);
      p.set("accent", state.accent);
      p.set("type", state.type);
      p.set("count", state.count);
      p.set("seed", state.seed);
      if (state.type === "choice" && state.rule) p.set("rule", state.rule);
      if (state.dotted) p.set("dotted", "1");
      history.replaceState(null, "", location.pathname + "?" + p.toString());
    }

    // ---- controls --------------------------------------------
    function fillPrograms() {
      const list = bank.sequences().filter(s => s.units > 0);
      els.program.innerHTML = "";
      for (const s of list) {
        const o = el("option", null, s.name + (s.region ? " (" + s.region + ")" : ""));
        o.value = s.id;
        els.program.appendChild(o);
      }
      if (!list.some(s => s.id === state.program)) state.program = (bank.seq() || {}).id || list[0].id;
      els.program.value = state.program;
    }

    function fillUnits() {
      const units = bank.seq().units || [];
      els.unit.innerHTML = "";
      for (const u of units) {
        const o = el("option", null, u.n + ". " + (u.label || "Unit " + u.n));
        o.value = String(u.n);
        els.unit.appendChild(o);
      }
      if (!units.some(u => u.n === state.unit)) state.unit = units.length ? units[units.length - 1].n : 1;
      els.unit.value = String(state.unit);
    }

    function fillTypes() {
      els.type.innerHTML = "";
      for (const t of M.TYPES) {
        const o = el("option", null, t.heading);
        o.value = t.id;
        els.type.appendChild(o);
      }
      els.type.value = state.type;
    }

    // A rule can only make a sheet if it prints three tellable-apart
    // spellings AND the bank has words to hang them on.
    function usableRules() {
      return rules.filter(r =>
        M.ruleIsUsable(r, gpcDisplay) &&
        M.ruleCandidates(r, allWords, w => bank.segmentsFor(w)).length > 0);
    }

    // Rules whose GPCs this unit has actually taught go first.
    function fillRules() {
      const taught = new Set(bank.taughtGPCs(state.unit).map(t => t.gpc.id));
      const list = usableRules();
      const relevant = list.filter(r => (r.gpcs || []).some(id => taught.has(id)));
      const rest = list.filter(r => !relevant.includes(r));
      els.rule.innerHTML = "";
      const addGroup = (label, items) => {
        if (!items.length) return;
        const g = document.createElement("optgroup");
        g.label = label;
        for (const r of items) {
          const o = el("option", null, r.name || r.id);
          o.value = r.id;
          g.appendChild(o);
        }
        els.rule.appendChild(g);
      };
      addGroup("Taught by this unit", relevant);
      addGroup("Other rules", rest);
      const ordered = relevant.concat(rest);
      if (!ordered.some(r => r.id === state.rule)) state.rule = ordered.length ? ordered[0].id : null;
      if (state.rule) els.rule.value = state.rule;
    }

    function syncControlVisibility() {
      const kind = M.typeById(state.type).kind;
      els.ruleBlock.hidden = kind !== "choice";
      els.dottedBlock.hidden = kind !== "cards";
    }

    // ---- data ------------------------------------------------
    async function wordsUpTo(unitN) {
      const key = state.program + "|" + unitN + "|" + state.accent;
      if (!wordCache.has(key)) wordCache.set(key, bank.decodableWords({ uptoUnit: unitN }));
      return wordCache.get(key);
    }

    const currentUnit = () => (bank.seq().units || []).find(u => u.n === state.unit) || (bank.seq().units || [])[0];

    function unitColour(unit) {
      const units = bank.seq().units || [];
      return unit.colour || M.paletteFor(Math.max(0, units.indexOf(unit)));
    }

    function unitGraphemes(unit) {
      return ((unit && unit.teaches) || []).map(id => {
        const g = bank.gpc(id);
        return g ? g.display || g.grapheme : M.splitGpcId(id).grapheme;
      });
    }

    // Words for the sheet: decodable by this unit AND exercising a
    // GPC taught in it. Falls back to plain decodability for units
    // that teach no new GPCs (blend/review units).
    async function sheetWords(unit, type) {
      const all = await wordsUpTo(unit.n);
      const inUnit = M.wordsInUnit(all, M.unitGpcIds(unit), w => bank.wordGPCs(w));
      let pool = inUnit.length >= 4 ? inUnit : all;
      const t = M.typeById(type);
      if (t.kind === "elkonin") {
        pool = pool.filter(w => M.fitsPosition(bank.segmentsFor(w).length, t.position, 7, vowelFlags(w)));
      } else if (t.kind === "segment") {
        pool = pool.filter(w => bank.segmentsFor(w).length <= 6);
      } else if (t.kind === "cards") {
        pool = pool.filter(w => w.word.length <= 12);
      }
      return M.pickWords(pool, M.stateKey(state), state.count);
    }

    // ---- rendering -------------------------------------------
    function dottedThirds(extraClass) {
      return el("div", "thirds" + (extraClass ? " " + extraClass : ""));
    }

    function elkoninBoxes(word, blankIndex) {
      const wrap = el("div", "ek-boxes");
      const segs = bank.segmentsFor(word);
      segs.forEach((s, i) => {
        const box = el("span", "ek-box" + (i === blankIndex ? " blank" : " filled"));
        if (i !== blankIndex) {
          const gpcId = bank.wordGPCs(word)[i];
          box.textContent = gpcId ? gpcDisplay(gpcId) : s.g;
        }
        wrap.appendChild(box);
      });
      return wrap;
    }

    function renderCards(body, words) {
      const grid = el("div", "card-grid");
      grid.style.setProperty("--rows", Math.max(1, Math.ceil(words.length / 3)));
      grid.style.setProperty("--cardfont", words.length > 12 ? "24pt" : "28pt");
      for (const w of words) {
        const card = el("div", "word-card");
        const thirds = el("div", "thirds wc-thirds" + (state.dotted ? " guides" : ""));
        thirds.appendChild(el("span", "wc-word", w.word));
        card.appendChild(thirds);
        grid.appendChild(card);
      }
      body.appendChild(grid);
    }

    function renderElkonin(body, words, position) {
      const list = el("ol", "row-list");
      words.forEach((w, i) => {
        const row = el("li", "wrow");
        row.appendChild(el("span", "wnum", String(i + 1)));
        row.appendChild(elkoninBoxes(w, M.elkoninIndex(bank.segmentsFor(w).length, position, vowelFlags(w))));
        list.appendChild(row);
      });
      body.appendChild(list);
    }

    function renderSegment(body, words) {
      const circles = M.syllableCircles(words);
      const list = el("ol", "row-list");
      words.forEach((w, i) => {
        const row = el("li", "wrow");
        row.appendChild(el("span", "wnum", String(i + 1)));
        const syl = el("div", "syl-circles");
        for (let c = 0; c < circles; c++) syl.appendChild(el("i", "syl-dot"));
        row.appendChild(syl);
        const boxes = el("div", "ek-boxes");
        bank.segmentsFor(w).forEach(() => boxes.appendChild(el("span", "ek-box blank")));
        row.appendChild(boxes);
        row.appendChild(dottedThirds("guides write-line"));
        list.appendChild(row);
      });
      body.appendChild(list);
    }

    function renderChoice(body, rows, rule) {
      if (rule && rule.statement_kid) {
        const note = el("p", "rule-note");
        note.appendChild(el("b", null, rule.name || rule.id));
        note.appendChild(document.createTextNode(" — " + rule.statement_kid));
        body.appendChild(note);
      }
      const list = el("ol", "row-list");
      rows.forEach((r, i) => {
        const row = el("li", "wrow choice-row");
        row.appendChild(el("span", "wnum", String(i + 1)));
        const skeleton = el("div", "cw");
        if (r.before) skeleton.appendChild(el("span", "cw-part", r.before));
        const opts = el("span", "opt-group");
        for (const o of r.options) opts.appendChild(el("span", "opt", o.display));
        skeleton.appendChild(opts);
        if (r.after) skeleton.appendChild(el("span", "cw-part", r.after));
        row.appendChild(skeleton);
        row.appendChild(dottedThirds("guides write-line"));
        list.appendChild(row);
      });
      body.appendChild(list);
    }

    // ---- QR ---------------------------------------------------
    function renderQr(target, url) {
      target.innerHTML = "";
      const ok = typeof window.qrcode === "function";
      if (!ok) {
        const box = el("div", "qr-missing");
        box.appendChild(el("span", null, "QR unavailable"));
        target.appendChild(box);
        target.title = url;
        return false;
      }
      try {
        if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs["UTF-8"]) {
          window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
        }
        const code = window.qrcode(0, "M");
        code.addData(url);
        code.make();
        const img = new Image();
        img.className = "qr-img";
        img.alt = "QR code — hear these words";
        img.src = code.createDataURL(4, 0);
        target.appendChild(img);
        target.title = url;
        return true;
      } catch (e) {
        const box = el("div", "qr-missing");
        box.appendChild(el("span", null, "QR unavailable"));
        target.appendChild(box);
        return false;
      }
    }

    // ---- the sheet -------------------------------------------
    async function render() {
      const seq = bank.seq();
      const unit = currentUnit();
      if (!unit) { status("This program has no units.", true); return; }
      const type = M.typeById(state.type);
      const key = M.unitKey(unit, unitGraphemes(unit));
      const name = M.sheetName(key, type.id);
      const colour = unitColour(unit);

      let rowWords = [];
      let choiceRows = [];
      let rule = null;

      if (type.kind === "choice") {
        const usable = usableRules();
        rule = usable.find(r => r.id === state.rule) || usable[0] || null;
        if (!rule) { status("No spelling rules with toggle sets are available.", true); return; }
        const rowsFor = words => M.ruleRows(rule, words, {
          segmentsOf: w => bank.segmentsFor(w),
          displayOf: gpcDisplay,
          key: M.stateKey(state),
          count: state.count,
        });
        // Prefer words the learner can already read at this unit;
        // fall back to the whole bank when the rule outruns them.
        choiceRows = rowsFor(await wordsUpTo(unit.n));
        if (choiceRows.length < state.count) choiceRows = rowsFor(allWords);
        rowWords = choiceRows.map(r => r.word);
      } else {
        rowWords = await sheetWords(unit, type.id);
      }

      const page = els.page;
      page.innerHTML = "";
      page.style.setProperty("--unit", colour);
      page.style.setProperty("--unit-ink", M.textColourFor(colour));
      page.style.setProperty("--box", state.count >= 16 ? "11mm" : state.count >= 12 ? "13mm" : "16mm");
      page.style.setProperty("--rowfont", state.count >= 16 ? "13pt" : state.count >= 12 ? "15pt" : "17pt");

      // header
      const head = el("header", "sheet-head");
      const main = el("div", "head-main");
      main.appendChild(el("h2", "sheet-title", type.heading));
      main.appendChild(el("p", "sheet-instruction", type.instruction));
      head.appendChild(main);
      const badge = el("div", "head-unit");
      badge.appendChild(el("span", "unit-chip", key));
      badge.appendChild(el("span", "unit-label", unit.label || "Unit " + unit.n));
      head.appendChild(badge);
      page.appendChild(head);

      const nameLine = el("div", "name-line");
      nameLine.appendChild(el("span", "nl-label", "Name"));
      nameLine.appendChild(el("span", "nl-rule"));
      nameLine.appendChild(el("span", "nl-label", "Date"));
      nameLine.appendChild(el("span", "nl-rule short"));
      page.appendChild(nameLine);

      // body
      const body = el("section", "sheet-body");
      body.dataset.kind = type.kind;
      if (!rowWords.length) {
        body.appendChild(el("p", "empty-note", "No words in the bank match this unit yet — try a later unit or another sheet type."));
      } else if (type.kind === "cards") {
        renderCards(body, rowWords);
      } else if (type.kind === "elkonin") {
        renderElkonin(body, rowWords, type.position);
      } else if (type.kind === "segment") {
        renderSegment(body, rowWords);
      } else {
        renderChoice(body, choiceRows, rule);
      }
      page.appendChild(body);

      // footer
      const foot = el("footer", "sheet-foot");
      const ft = el("div", "foot-text");
      const line1 = el("div", "foot-line");
      line1.appendChild(el("b", null, seq.name || state.program));
      line1.appendChild(document.createTextNode(" · " + (unit.label || "Unit " + unit.n)));
      ft.appendChild(line1);
      ft.appendChild(el("div", "foot-meta",
        M.formatDate(new Date()) + " · " + state.accent.toUpperCase() + " · seed " + state.seed + " · " + name));
      foot.appendChild(ft);
      const qrWrap = el("div", "foot-qr");
      const qrSlot = el("div", "qr-slot");
      qrWrap.appendChild(qrSlot);
      qrWrap.appendChild(el("span", "qr-cap", "Scan to hear these words"));
      foot.appendChild(qrWrap);
      page.appendChild(foot);

      const url = M.qrPayload({ base: M.BASE_URL, words: rowWords, accent: state.accent, title: name });
      renderQr(qrSlot, url);

      status("");
      els.count.value = String(state.count);
      els.seedOut.textContent = String(state.seed);
      writeUrl();
      scalePreview();
    }

    // ---- preview scaling -------------------------------------
    // The preview is a real A4 page scaled to fit the screen; print
    // resets the transform so the paper output is 1:1.
    function scalePreview() {
      const avail = els.previewWrap.clientWidth;
      const scale = Math.min(1, Math.max(0.15, avail / A4_W_PX));
      els.scaler.style.transform = "scale(" + scale + ")";
      els.previewWrap.style.height = Math.ceil(A4_H_PX * scale) + "px";
    }

    // ---- events ----------------------------------------------
    function wire() {
      els.program.addEventListener("change", async () => {
        state.program = els.program.value;
        wordCache.clear();
        status("Loading program…");
        await bank.setSequence(state.program);
        state.unit = 1;
        fillUnits();
        fillRules();
        await render();
      });
      els.unit.addEventListener("change", async () => {
        state.unit = parseInt(els.unit.value, 10);
        fillRules();
        await render();
      });
      els.accent.addEventListener("change", async () => {
        state.accent = els.accent.value;
        bank.setAccent(state.accent);
        wordCache.clear();
        await render();
      });
      els.type.addEventListener("change", async () => {
        state.type = els.type.value;
        syncControlVisibility();
        await render();
      });
      els.count.addEventListener("change", async () => {
        state.count = parseInt(els.count.value, 10) || 12;
        await render();
      });
      els.rule.addEventListener("change", async () => {
        state.rule = els.rule.value;
        await render();
      });
      els.dotted.addEventListener("change", async () => {
        state.dotted = els.dotted.checked;
        await render();
      });
      els.shuffle.addEventListener("click", async () => {
        state.seed = (state.seed + 1) % 1000000;
        await render();
      });
      els.print.addEventListener("click", () => window.print());
      window.addEventListener("resize", scalePreview);
    }

    // ---- boot ------------------------------------------------
    async function init() {
      els.program = q("programSelect");
      els.unit = q("unitSelect");
      els.accent = q("accentSelect");
      els.type = q("typeSelect");
      els.count = q("countSelect");
      els.rule = q("ruleSelect");
      els.ruleBlock = q("ruleBlock");
      els.dotted = q("dottedToggle");
      els.dottedBlock = q("dottedBlock");
      els.shuffle = q("shuffleBtn");
      els.print = q("printBtn");
      els.seedOut = q("seedOut");
      els.status = q("statusBox");
      els.page = q("page");
      els.scaler = q("previewScaler");
      els.previewWrap = q("previewWrap");

      readUrl();
      try {
        await bank.load(state.program ? { sequenceId: state.program } : {});
      } catch (e) {
        status("Could not load the data bank: " + e.message, true);
        return;
      }
      state.program = (bank.seq() || {}).id || state.program;
      if (!["au", "uk", "us"].includes(state.accent)) state.accent = bank.accent || "au";
      bank.setAccent(state.accent);
      els.accent.value = state.accent;

      try {
        const data = await loadJson("data/rules/rules.json");
        rules = (data && data.rules) || [];
      } catch (e) {
        rules = [];
      }
      allWords = await bank.loadWords();

      fillPrograms();
      fillUnits();
      fillTypes();
      fillRules();
      els.count.value = String(state.count);
      els.dotted.checked = state.dotted;
      syncControlVisibility();
      wire();
      await render();
      document.body.dataset.ready = "1";
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  })();
}
