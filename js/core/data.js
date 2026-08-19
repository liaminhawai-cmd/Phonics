// ============================================================
// js/core/data.js — window.PhonicsBank
//
// The single runtime gateway to the data bank (data/*.json).
// Everything the app knows about sounds, spellings, words and
// programs flows through here; no page hardcodes program
// content. Plain-script global (same pattern as anatomy.js) so
// the zero-build / standalone-file story keeps working.
//
//   await PhonicsBank.load();                 // bank + saved (or default) program
//   PhonicsBank.sequences();                  // index.json entries for the picker
//   await PhonicsBank.setSequence("ufli-foundations");
//   PhonicsBank.graphemeView();               // units -> graphemes -> sounds
//   PhonicsBank.phonemeView();                // sounds -> taught spellings
//   PhonicsBank.decodableWords({uptoUnit: 5});
// ============================================================

window.PhonicsBank = (() => {
  const LS_SEQ = "phonics-sequence";
  const LS_ACCENT = "phonics-accent";
  const DEFAULT_SEQ = "elc-bookmarks";

  let base = "";                    // path prefix to repo root, e.g. "" or "../"
  let phonData = null;              // data/phonemes.json
  let gpcData = null;               // data/gpcs.json
  let wordData = null;              // data/words/words.json (lazy)
  let seqIndex = null;              // data/sequences/index.json
  let seq = null;                   // active sequence file

  const phonemeById = {};           // "ay" -> phoneme record
  const unitById = {};              // "ks" -> teaching-unit record (+ id)
  const gpcById = {};               // "ai.ay" -> gpc record
  const gpcsByGrapheme = {};        // "ai"  -> [gpc, ...] (bank order)
  const gpcBySegKey = {};           // "x|k+s" -> gpc record
  const unitKeyToId = {};           // "k+s" -> "ks" (teaching units)

  let accent = null;

  const segKeyOf = (g, p) => g + "|" + (Array.isArray(p) ? p.join("+") : p);

  // The standalone build embeds the whole bank as
  // <script type="application/json" id="phonics-bank-inline">{"data/…": {…}}</script>
  // so the single-file app works from file:// where fetch() cannot.
  let inlineBank;
  function fromInline(rel) {
    if (inlineBank === undefined) {
      const el = typeof document !== "undefined" && document.getElementById("phonics-bank-inline");
      inlineBank = el ? JSON.parse(el.textContent) : null;
    }
    return inlineBank ? inlineBank[rel] : undefined;
  }

  async function fetchJson(rel) {
    const embedded = fromInline(rel);
    if (embedded !== undefined) return embedded;
    const res = await fetch(base + rel);
    if (!res.ok) throw new Error("PhonicsBank: failed to load " + rel + " (" + res.status + ")");
    return res.json();
  }

  async function load(opts = {}) {
    base = opts.base || "";
    accent = localStorage.getItem(LS_ACCENT) || "au";
    [phonData, gpcData, seqIndex] = await Promise.all([
      fetchJson("data/phonemes.json"),
      fetchJson("data/gpcs.json"),
      fetchJson("data/sequences/index.json"),
    ]);
    for (const p of phonData.phonemes) phonemeById[p.id] = p;
    for (const [uid, u] of Object.entries(phonData.teaching_units || {})) {
      if (typeof u !== "object") continue;
      unitById[uid] = Object.assign({ id: uid }, u);
      unitKeyToId[(u.phonemes || []).join("+")] = uid;
    }
    for (const g of gpcData.gpcs) {
      gpcById[g.id] = g;
      (gpcsByGrapheme[g.grapheme] = gpcsByGrapheme[g.grapheme] || []).push(g);
      gpcBySegKey[segKeyOf(g.grapheme, g.phonemes)] = g;
    }
    const wanted = opts.sequenceId || localStorage.getItem(LS_SEQ) || DEFAULT_SEQ;
    await setSequence(seqIndex.sequences.some(s => s.id === wanted) ? wanted : DEFAULT_SEQ);
  }

  async function setSequence(id) {
    const entry = seqIndex.sequences.find(s => s.id === id);
    if (!entry) throw new Error("PhonicsBank: unknown sequence " + id);
    seq = await fetchJson("data/sequences/" + entry.file);
    localStorage.setItem(LS_SEQ, id);
    return seq;
  }

  async function loadWords() {
    if (!wordData) wordData = await fetchJson("data/words/words.json");
    return wordData.words;
  }

  function setAccent(a) { accent = a; localStorage.setItem(LS_ACCENT, a); }

  // ---- lookups -------------------------------------------------
  const phoneme = id => phonemeById[id] || unitById[id] || null;
  const gpc = id => gpcById[id] || null;

  function phonemeLabel(id) {
    const p = phoneme(id);
    if (!p) return "/" + id + "/";
    const m = (p.label || "").match(/^\/[^/]+\/(?:\s*\([^)]*\))?/);
    return m ? m[0] : p.label || "/" + id + "/";
  }

  function ipa(id, acc) {
    const p = phonemeById[id];
    return p ? (p.ipa[acc || accent] || p.ipa.au) : null;
  }

  // The phoneme "group key" a GPC sorts under in phoneme-first views:
  // single sound -> that phoneme; known bundle (k+s) -> teaching unit (ks);
  // other composites (ed.ed = e+d) -> the composite key itself.
  function phonemeKeyOf(g) {
    if (!Array.isArray(g.phonemes)) return g.phonemes;
    const key = g.phonemes.join("+");
    return unitKeyToId[key] || key;
  }

  // ---- sequence views ------------------------------------------
  function taughtGPCs(uptoUnit) {
    const out = [];
    for (const u of seq.units) {
      if (uptoUnit != null && u.n > uptoUnit) break;
      for (const gid of u.teaches) if (gpcById[gid]) out.push({ gpc: gpcById[gid], unit: u });
    }
    return out;
  }

  function graphemeView(uptoUnit) {
    return seq.units
      .filter(u => uptoUnit == null || u.n <= uptoUnit)
      .map(u => {
        const byG = new Map();
        for (const gid of u.teaches) {
          const g = gpcById[gid];
          if (!g) continue;
          if (!byG.has(g.grapheme)) byG.set(g.grapheme, { grapheme: g.grapheme, display: g.display || g.grapheme, gpcs: [] });
          byG.get(g.grapheme).gpcs.push(g);
        }
        return { n: u.n, label: u.label, colour: u.colour || null, notes: u.notes || "",
                 heart_words: u.heart_words || [], review: u.review || [],
                 graphemes: [...byG.values()] };
      });
  }

  function phonemeView(uptoUnit) {
    const rows = new Map();          // phoneme key -> row, in first-taught order
    for (const { gpc: g, unit } of taughtGPCs(uptoUnit)) {
      const key = phonemeKeyOf(g);
      if (!rows.has(key)) {
        const p = phoneme(key);
        rows.set(key, {
          phoneme: key,
          label: p ? (p.label || phonemeLabel(key)) : (g.display || g.grapheme) + " (" + key.replace(/\+/g, "") + ")",
          ipa: phonemeById[key] ? ipa(key) : null,
          type: p ? p.type || "unit" : "composite",
          firstUnit: unit.n,
          spellings: [],
        });
      }
      const row = rows.get(key);
      if (!row.spellings.some(s => s.gpc.id === g.id)) row.spellings.push({ gpc: g, unit_n: unit.n });
    }
    return [...rows.values()];
  }

  // ---- words ---------------------------------------------------
  function segmentsFor(w) {
    const ov = (w.accents || {})[accent];
    return (ov && ov.segments) || w.segments;
  }

  // Map a word's segments to GPC ids; null for a segment the bank lacks.
  function wordGPCs(w) {
    return segmentsFor(w).map(s => {
      const hit = gpcBySegKey[segKeyOf(s.g, s.p)];
      return hit ? hit.id : null;
    });
  }

  // status of a word against a taught/mastered GPC-id set
  function wordStatus(w, gpcSet) {
    const missing = [];
    const segs = segmentsFor(w);
    const ids = wordGPCs(w);
    ids.forEach((gid, i) => {
      const heart = (w.heart_parts || []).includes(segs[i].g);
      if (heart) return;                       // heart parts are taught as-is
      if (!gid || !gpcSet.has(gid)) missing.push(gid || segKeyOf(segs[i].g, segs[i].p));
    });
    return { ok: missing.length === 0, missing, isHeart: (w.tags || []).includes("heart-word") };
  }

  // Every word decodable at a point in the active sequence (or vs. an
  // explicit mastered set — that's how personalised trays/lists work).
  async function decodableWords({ uptoUnit = null, gpcSet = null, includeHeart = false, tags = null } = {}) {
    const words = await loadWords();
    const set = gpcSet || new Set(taughtGPCs(uptoUnit).map(t => t.gpc.id));
    return words.filter(w => {
      if (tags && !tags.some(t => (w.tags || []).includes(t))) return false;
      const st = wordStatus(w, set);
      if (st.isHeart && !includeHeart) return false;
      return st.ok;
    });
  }

  return {
    load, setSequence, loadWords, setAccent,
    get accent() { return accent; },
    seq: () => seq,
    sequences: () => (seqIndex ? seqIndex.sequences : []),
    phoneme, phonemeLabel, ipa, gpc,
    gpcsForGrapheme: g => gpcsByGrapheme[g] || [],
    allPhonemes: () => phonData.phonemes,
    taughtGPCs, graphemeView, phonemeView,
    segmentsFor, wordGPCs, wordStatus, decodableWords,
  };
})();
