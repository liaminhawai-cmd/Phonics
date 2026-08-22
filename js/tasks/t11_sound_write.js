// ============================================================
// js/tasks/t11_sound_write.js — T11: Sound → Handwrite.
//
// "Hear the sound, write the letters that spell it." The task
// that closes the loop between the app's three tracked skills:
// listening (§5), encoding (§7 "|encode") and letter formation
// (§9 "letter:<c>|<style>"). T4 asks a child to CHOOSE a
// grapheme from chips; this one asks them to PRODUCE it with a
// pencil, which is what a spelling test actually is.
//
// One continuous screen per item (rebuilt the way T3 was): the
// sound plays, one dotted-thirds canvas holds one lane per
// letter of the target grapheme (sh = 2 lanes, igh = 3), the
// child writes across the shared guidelines, and EVERYTHING
// stays editable — per-lane Clear, Clear all — until the single
// Confirm. Nothing is scored or recorded before Confirm.
//
// ------------------------------------------------------------
// THE TWO VERDICTS, AND HOW EACH IS DERIVED (honest constraint)
// ------------------------------------------------------------
// This app CANNOT read a child's handwriting. There is no OCR
// here and none is faked. What js/core/handwriting/score.js can
// do is COMPARE a set of strokes against ONE named letterform
// model and say how close they are — a comparison, not a
// recognition. Everything below is built on that difference.
//
// VERDICT 2 — HOW WELL THEY FORMED THE LETTERS (objective).
//   Each lane's strokes are mapped into that letter's own 0-100
//   model box and scored with PhonicsHandwriting.scoreAttempt
//   against that letter's model: stroke count, order, direction,
//   start point, shape, placement. This is measured, not
//   guessed, so it is always recorded:
//     "letter:<c>|vic-modern-cursive", correct = total >= 70.
//
// VERDICT 1 — DID THEY PICK THE RIGHT LETTERS (spelling/encode).
//   Two things must agree before the app will assert it:
//     (a) LEGIBILITY FLOOR — every lane has ink and scores at
//         least 45 against ITS OWN target letterform. A child
//         who writes "c" where "s" belongs fails this: the marks
//         do not match the model they were measured against.
//         The app still cannot say what they DID write, only
//         that it isn't a plausible rendering of the target.
//     (b) THE CHILD (or the teacher over their shoulder)
//         CONFIRMS. After Confirm the answer is revealed and the
//         app asks one plain question — "Is that what you
//         wrote?" — with two big buttons. A human eye closes the
//         gap the app cannot.
//   letterChoiceRight = (a) AND (b). Recorded as
//     "<gpcId>|encode", correct = letterChoiceRight.
//
//   THE ESCAPE. A negative verdict is the app's weakest claim,
//   so it is never forced. Whenever the verdict comes out
//   negative — the child said no, or said yes but the writing
//   was too rough to match — a "That's not what I wrote — don't
//   count it" button appears, and taking it leaves the letter
//   choice UNSCORED rather than wrong: no encode attempt is
//   recorded at all. English gives real reasons for this (the
//   child may have written another legal spelling of the same
//   sound: ee/ea, ai/ay), and a machine that cannot read should
//   not be allowed to log a spelling error over a human's "no".
//   The encode attempt is therefore held back until the verdict
//   settles; formation scores go in at Confirm regardless.
//
// The shorthand mark (gpc.short — never a slash label) names the
// SOUND, so showing it can't turn this into copying a spelling;
// it appears once the child has had a go, or on request from the
// "show me" button. For a one-letter GPC the mark and the letter
// happen to coincide, which makes it a deliberate self-check
// scaffold at exactly the moment the child has already committed
// ink. The example WORD stays hidden until Confirm — that one
// really would spell the answer out.
//
// Item selection: taught GPCs of the active program whose
// grapheme is contiguous letters (no split digraphs) that all
// exist in the letterform bank, sorted weakest-first by encode
// strength then letter-formation strength, shuffled inside that
// bias so the round isn't identical twice.
// ============================================================

// Shared registry bootstrap — identical snippet in every task file.
window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

(function () {
  "use strict";

  const STYLE_FILE = "data/handwriting/letterforms-vic-modern-cursive.json";
  const STYLE_ID = "vic-modern-cursive";

  const ROUND = 6;            // items per round
  const BIAS_POOL = 18;       // weakest N to shuffle the round out of
  const MAX_LETTERS = 4;      // eigh / ough are the longest we lay out

  const N = 48;               // resample points, model and attempt alike
  const PASS = 70;            // "well formed" — same line T9 steps up on
  const FLOOR = 45;           // legibility floor for the letter-choice verdict
  const GHOST_MS = 900;       // one model stroke per replay beat

  const CANVAS_MAX = 420;     // CSS px; shrinks to whatever the column gives
  const CANVAS_MIN = 200;
  const MAX_CANVAS_H = 300;
  const PAD_Y = 20;           // px above the top line / below the floor
  const SIDE_MODEL = 6;       // model units of margin each side of the group
  const MAX_SCALE = 2.4;      // a single letter shouldn't fill a laptop screen

  // Attempt points are mapped ALL THE WAY into each letter's model box
  // before scoring, so `thirds` is simply the model's own line set — the
  // same (safest) of the two paths score.js documents that T9 takes.
  const MODEL_THIRDS = { top: 0, mid: 33.3, base: 66.6, floor: 100 };

  const FEATURES = [
    ["strokeCount", "Strokes"],
    ["order", "Order"],
    ["direction", "Direction"],
    ["start", "Start point"],
    ["shape", "Shape"],
    ["placement", "On the lines"],
  ];

  const BANDS = {
    "great": { emoji: "🌟", text: "Beautiful writing!" },
    "good": { emoji: "👍", text: "Nice writing!" },
    "getting-there": { emoji: "💪", text: "Getting there." },
    "keep-practising": { emoji: "🌱", text: "Keep practising." },
  };

  // canvas ink
  const PAPER = "#ffffff";
  const INK = "#1f1f1f";
  const GUIDE = "#b9ac91";
  const GUIDE_FAINT = "#e0d8c6";
  const LANE_EDGE = "#e0d7c2";
  const LANE_TINT = "#fdfaf2";      // every other box, so N boxes read as N boxes
  const MODEL_GREY = "#ddd6c7";
  const GHOST_RED = "#a83232";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- the letterform file (same cache discipline as T9) --------------
  let stylePromise = null;
  function loadStyle(ctx) {
    const given = ctx && (ctx.letterforms || ctx.handwritingStyle);
    if (given && given.letters) return Promise.resolve(given);
    if (!stylePromise) {
      stylePromise = fetch(STYLE_FILE).then((r) => {
        if (!r.ok) throw new Error("letterforms failed to load (" + r.status + ")");
        return r.json();
      });
      stylePromise.catch(() => { stylePromise = null; });
    }
    return stylePromise;
  }

  // ---- mini SVG glyphs, straight from the stroke paths ----------------
  const GLYPH_GUIDES = [
    { y: 0, kind: "solid" }, { y: 33.3, kind: "dot" },
    { y: 66.6, kind: "solid" }, { y: 100, kind: "faint" },
  ];

  function glyphSvg(def, opts) {
    opts = opts || {};
    const w = typeof def.width === "number" ? def.width : 55;
    const pad = 7;
    const vbW = w + pad * 2, vbH = 100 + pad * 2;
    const h = opts.height || 34;
    const wpx = Math.max(10, Math.round(h * vbW / vbH));
    let guides = "";
    if (opts.guides !== false) {
      guides = GLYPH_GUIDES.map((g) => {
        const colour = g.kind === "faint" ? "#e6dfcf" : "#cec2a8";
        const dash = g.kind === "dot" ? ' stroke-dasharray="3 4"'
          : (g.kind === "faint" ? ' stroke-dasharray="2 5"' : "");
        return '<line x1="' + (-pad) + '" y1="' + g.y + '" x2="' + (w + pad) +
          '" y2="' + g.y + '" stroke="' + colour + '" stroke-width="1"' + dash + "/>";
      }).join("");
    }
    const paths = (def.strokes || []).map((s) =>
      '<path d="' + esc(s.path) + '" fill="none" stroke="currentColor" stroke-width="' +
      (opts.sw || 5) + '" stroke-linecap="round" stroke-linejoin="round"/>').join("");
    return '<svg class="sw-glyph" viewBox="' + (-pad) + " " + (-pad) + " " + vbW + " " + vbH +
      '" width="' + wpx + '" height="' + h + '" role="img" aria-label="' +
      esc(opts.label || "letter") + '" focusable="false">' + guides + paths + "</svg>";
  }

  // ---- styles (injected once, so T11 renders on any host page) --------
  const CSS = `
.sw-root { --sw-accent: var(--accent, #a83232); --sw-ink: var(--ink, #1f1f1f);
  --sw-muted: var(--muted, #6b6256); --sw-line: var(--line, #d8cfbb);
  --sw-soft: var(--line-soft, #e8e0cd); --sw-paper: var(--paper, #fbf7ee);
  --sw-bg: var(--bg, #f4efe6); --sw-good: var(--correct, #2f6a3e);
  --sw-good-bg: var(--good-bg, #ebf3ec); --sw-warn: var(--warn, #c8992e);
  --sw-warn-ink: var(--warn-ink, #6b5316); --sw-warn-bg: var(--warn-bg, #f8f1de);
  --sw-bad: var(--wrong, #a83232); --sw-bad-bg: var(--bad-bg, #f5eaea);
  color: var(--sw-ink); }
.sw-root [hidden] { display: none !important; }
.sw-hint { text-align: center; font-size: 12.5px; color: var(--sw-muted); margin-top: 2px; }
.sw-soundline { display: flex; justify-content: center; align-items: center;
  gap: 8px; flex-wrap: wrap; min-height: 48px; margin: 2px 0 4px; }
.sw-soundchip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px;
  border: 1px solid var(--sw-line); border-radius: 22px; background: var(--sw-bg);
  font-family: Georgia, serif; font-weight: 700; }
.sw-soundchip .sw-mark { font-size: 24px; line-height: 1.1; }
.sw-soundchip .sw-as { font-size: 12.5px; font-weight: 400; color: var(--sw-muted);
  font-family: inherit; }
.sw-canvas-wrap { width: 100%; max-width: ${CANVAS_MAX}px; margin: 4px auto 0; }
.sw-canvas { display: block; margin: 0 auto; touch-action: none; background: #fff;
  border: 1px solid var(--sw-line); border-radius: 12px; cursor: crosshair; }
.sw-lanebtns { display: flex; gap: 6px; width: 100%; max-width: ${CANVAS_MAX}px; margin: 6px auto 0; }
.sw-lanebtn { flex: 1 1 0; min-width: 44px; min-height: 46px; padding: 4px 2px;
  border: 1px dashed var(--sw-line); border-radius: 10px; background: var(--sw-bg);
  color: var(--sw-muted); font-family: inherit; font-size: 12px; font-weight: 700;
  cursor: pointer; transition: all 0.14s ease; }
.sw-rub { font-size: 17px; }
.sw-rubn { font-size: 13px; }
.sw-lanebtn:hover { border-style: solid; border-color: var(--sw-accent); color: var(--sw-accent); }
.sw-lanebtn:disabled { opacity: 0.4; cursor: not-allowed; }
.sw-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 10px; }
.sw-actions .pt-primary { margin: 0; }
.sw-btn { min-height: 44px; min-width: 44px; padding: 10px 17px; border-radius: 10px;
  border: 1px solid var(--sw-line); background: var(--sw-bg); color: var(--sw-ink);
  font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.14s ease; }
.sw-btn:hover:not(:disabled) { border-color: var(--sw-accent); color: var(--sw-accent); }
.sw-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.sw-btn.primary { background: var(--sw-accent); border-color: var(--sw-accent); color: #fff; }
.sw-btn.primary:hover:not(:disabled) { filter: brightness(1.08); color: #fff; }

.sw-vd { border: 1px solid var(--sw-soft); border-radius: 12px; background: var(--sw-paper);
  padding: 12px 13px; margin-top: 12px; }
.sw-vd-h { font-family: Georgia, serif; font-size: 11.5px; font-weight: 700; letter-spacing: 0.7px;
  text-transform: uppercase; color: var(--sw-muted); margin-bottom: 8px; }
.sw-answer { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.sw-answer-lab { font-size: 13px; color: var(--sw-muted); }
.sw-answer-g { font-family: Georgia, serif; font-size: 34px; font-weight: 700; letter-spacing: 2px; }
.sw-answer-glyphs { display: flex; align-items: flex-end; gap: 10px; color: var(--sw-ink); margin-top: 2px; }
.sw-ask-q { text-align: center; font-family: Georgia, serif; font-size: 17px; font-weight: 700;
  margin: 12px 0 8px; }
.sw-ask-btns { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.sw-ask-btns .sw-btn { min-height: 56px; font-size: 16px; padding: 10px 22px; }
.sw-btn.yes { border-color: var(--sw-good); color: var(--sw-good); background: var(--sw-good-bg); }
.sw-btn.no { border-color: var(--sw-bad); color: var(--sw-bad); background: var(--sw-bad-bg); }
.sw-vd-line { text-align: center; font-size: 15px; font-weight: 700; line-height: 1.5; margin-top: 10px; }
.sw-vd-line[data-tone="good"] { color: var(--sw-good); }
.sw-vd-line[data-tone="bad"] { color: var(--sw-bad); }
.sw-vd-line[data-tone="muted"] { color: var(--sw-muted); }
.sw-escape { display: block; margin: 10px auto 0; min-height: 44px; padding: 8px 14px;
  border: 1px dashed var(--sw-line); border-radius: 10px; background: none; color: var(--sw-muted);
  font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.sw-escape:hover { color: var(--sw-ink); border-color: var(--sw-ink); }
.sw-grown { text-align: center; font-size: 11.5px; color: var(--sw-muted); margin-top: 8px; line-height: 1.5; }

.sw-letters { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.sw-letter { display: flex; flex-direction: column; align-items: center; gap: 2px;
  min-width: 62px; padding: 7px 8px 5px; border: 1px solid var(--sw-soft); border-radius: 10px;
  background: var(--sw-bg); color: var(--sw-ink); }
.sw-letter[data-band="great"], .sw-letter[data-band="good"] { border-color: var(--sw-good); background: var(--sw-good-bg); }
.sw-letter[data-band="getting-there"] { border-color: var(--sw-warn); background: var(--sw-warn-bg); }
.sw-letter[data-band="keep-practising"], .sw-letter[data-band="none"] { border-color: var(--sw-bad); background: var(--sw-bad-bg); }
.sw-letter-num { font-size: 26px; font-family: Georgia, serif; font-weight: 700; line-height: 1.1; }
.sw-letter-key { font-size: 11px; font-weight: 700; color: var(--sw-muted); letter-spacing: 0.4px; }
.sw-total { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 11px; }
.sw-total-emoji { font-size: 24px; line-height: 1; }
.sw-total-text { font-family: Georgia, serif; font-weight: 700; font-size: 15px; }
.sw-total-num { font-family: Georgia, serif; font-weight: 700; font-size: 22px; white-space: nowrap; }
.sw-total-num small { font-size: 11px; font-weight: 400; color: var(--sw-muted); }
.sw-advice { font-size: 13.5px; line-height: 1.5; padding: 9px 11px; border-radius: 9px;
  background: var(--sw-warn-bg); color: var(--sw-warn-ink); margin-top: 10px; }
.sw-advice b { font-family: Georgia, serif; font-size: 16px; }
.sw-error { text-align: center; color: var(--sw-bad); background: var(--sw-bad-bg); border-radius: 8px;
  padding: 22px 14px; font-size: 14px; line-height: 1.5; }
@media (max-width: 400px) {
  .sw-btn { padding: 10px 13px; font-size: 13.5px; }
  .sw-answer-g { font-size: 30px; }
  .sw-letter { min-width: 54px; }
}`;

  function ensureStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById("sw-t11-styles")) return;
    const tag = document.createElement("style");
    tag.id = "sw-t11-styles";
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  // ====================================================================
  // Item selection — weakest first, shuffled inside the bias.
  // ====================================================================
  async function pickItems(bank, tracker, letters) {
    let taught = [];
    try { taught = bank.taughtGPCs() || []; } catch (e) { taught = []; }

    const pool = [];
    for (const entry of taught) {
      const g = entry && entry.gpc;
      if (!g || !g.grapheme) continue;
      const grapheme = String(g.grapheme);
      // Split digraphs (a_e) aren't contiguous letters, so there is no
      // honest "write these letters side by side" version of them.
      if (grapheme.indexOf("_") !== -1) continue;
      const chars = grapheme.split("");
      if (!chars.length || chars.length > MAX_LETTERS) continue;
      if (!chars.every((c) => letters[c])) continue;
      pool.push({ gpc: g, letters: chars, grapheme });
    }
    if (!pool.length) return [];

    let m = {};
    try { m = (await Promise.resolve(tracker.mastery())) || {}; } catch (e) { m = {}; }
    const strengthOf = (key) => {
      const rec = m[key];
      return rec && typeof rec.strength === "number" ? rec.strength : 0;
    };
    for (const it of pool) {
      it.encodeStrength = strengthOf(it.gpc.id + "|encode");
      let sum = 0;
      for (const c of it.letters) sum += strengthOf("letter:" + c + "|" + STYLE_ID);
      it.handStrength = it.letters.length ? sum / it.letters.length : 0;
    }

    // Shuffle first so the stable sort leaves equal-strength GPCs (everything,
    // on day one) in a different order every round.
    const sorted = shuffle(pool).sort((a, b) =>
      (a.encodeStrength - b.encodeStrength) || (a.handStrength - b.handStrength));

    // One item per spelling in a round — writing "th" twice in six goes is dull.
    const seen = new Set();
    const weakest = [];
    for (const it of sorted) {
      if (seen.has(it.grapheme)) continue;
      seen.add(it.grapheme);
      weakest.push(it);
      if (weakest.length >= BIAS_POOL) break;
    }
    return shuffle(weakest).slice(0, ROUND);
  }

  // ====================================================================
  async function mount(container, ctx) {
    ensureStyles();
    const PH = window.PhonicsHandwriting;
    const bank = ctx.bank;

    const root = document.createElement("div");
    root.className = "sw-root";
    container.appendChild(root);

    let disposed = false;
    const timers = [];
    const later = (fn, ms) => {
      const t = setTimeout(() => { if (!disposed) fn(); }, ms);
      timers.push(t);
      return t;
    };
    const toast = (msg) => {
      try { if (ctx && typeof ctx.toast === "function") ctx.toast(msg); } catch (e) { /* ignore */ }
    };
    const prompt = (id) => {
      try {
        if (ctx && ctx.audio && typeof ctx.audio.playPrompt === "function") {
          return Promise.resolve(ctx.audio.playPrompt(id)).catch(() => {});
        }
      } catch (e) { /* ignore */ }
      return Promise.resolve();
    };
    const fail = (html) => {
      root.innerHTML = `<div class="sw-error">${html}</div>`;
      return { destroy() { disposed = true; } };
    };

    if (!PH || typeof PH.scoreAttempt !== "function") {
      return fail(`Handwriting scoring didn't load.<br>
        Check that <code>js/core/handwriting/score.js</code> is on the page.`);
    }

    let style;
    try {
      style = await loadStyle(ctx);
    } catch (err) {
      if (disposed) return { destroy() { disposed = true; } };
      return fail(`The letter models didn't load — try refreshing.<br>
        <small>${esc(err && err.message ? err.message : String(err))}</small>`);
    }
    if (disposed) return { destroy() { disposed = true; } };

    const letters = (style && style.letters) || {};
    if (!Object.keys(letters).length) {
      return fail("No letter models in this handwriting style yet.");
    }

    const items = await pickItems(bank, ctx.tracker, letters);
    if (disposed) return { destroy() { disposed = true; } };
    if (!items.length) {
      return fail("No sounds are ready to write yet — try another activity!");
    }

    // A GPC without its own shorthand mark borrows one from another taught
    // spelling of the SAME sound (ff -> f), so the label is never slash-style.
    const shortByGpcId = {};
    try {
      for (const row of bank.phonemeView() || []) {
        let mark = null;
        for (const sp of row.spellings || []) {
          if (sp.gpc && sp.gpc.short) { mark = sp.gpc.short; break; }
        }
        for (const sp of row.spellings || []) {
          if (sp.gpc) shortByGpcId[sp.gpc.id] = sp.gpc.short || mark || null;
        }
      }
    } catch (e) { /* labels are a nicety, never a blocker */ }

    const markFor = (g) => g.short || shortByGpcId[g.id] || null;
    const exampleFor = (g) => {
      if (g.examples && g.examples.length) return g.examples[0];
      try {
        const first = Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes;
        const p = bank.phoneme(first);
        if (p && p.examples && p.examples.length) return p.examples[0];
      } catch (e) { /* ignore */ }
      return null;
    };

    // ---- round tallies ------------------------------------------------
    const tally = { scored: 0, right: 0, unscored: 0, letters: 0, lettersGood: 0 };
    const soundLabels = [];

    // ---- per-item state -----------------------------------------------
    let idx = 0;
    let item = null, defs = [], chars = [];
    let modelFine = [], modelPaths = [], hasPaths = [];
    let canvas = null, c2 = null;
    let geom = null;
    let strokes = [];              // { lane, pts: [{x,y}] } in canvas px
    let drawing = false, activePointer = null;
    let firstDownTs = 0, lastUpTs = 0;
    let phase = "write";           // write -> checked -> answered
    let labelShown = false, revealed = false;
    let askedForCheck = false;
    let results = [], formTotal = 0, legible = false;
    let encodeState = "pending";   // pending -> committed | unscored
    let ghost = null, raf = 0;

    const $ = (sel) => root.querySelector(sel);

    // ---- tracker (never crash on a rejection) --------------------------
    function record(key, correct, detail) {
      try {
        Promise.resolve(ctx.tracker.record({
          key,
          correct: !!correct,
          latencyMs: Math.max(0, (lastUpTs || Date.now()) - (firstDownTs || Date.now())),
          taskType: "t11",
          detail: detail || null,
        })).catch(() => { /* offline tracker hiccups never break practice */ });
      } catch (e) { /* ignore */ }
    }

    // ---- geometry -------------------------------------------------------
    function measure() {
      const wrap = root.querySelector(".sw-canvas-wrap");
      const avail = wrap && wrap.clientWidth ? wrap.clientWidth : CANVAS_MAX;
      return Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, Math.floor(avail)));
    }

    // One lane per letter, left to right, ALL sharing the same guidelines.
    // The scale is whatever makes the whole grapheme fit the column, so a
    // four-letter grapheme on a 375px phone shrinks instead of overflowing.
    function geomFor(w) {
      const n = chars.length;
      const gapModel = n <= 2 ? 22 : 12;
      const widths = defs.map((d) => (typeof d.width === "number" ? d.width : 55));
      let totalModelW = gapModel * (n - 1);
      for (const ww of widths) totalModelW += ww;
      const scaleX = (w - 12) / (totalModelW + SIDE_MODEL * 2);
      const scaleY = (MAX_CANVAS_H - PAD_Y * 2) / 100;
      const scale = Math.min(MAX_SCALE, scaleX, scaleY);
      const groupW = totalModelW * scale;
      const lanes = [];
      let x = (w - groupW) / 2;
      for (let i = 0; i < n; i++) {
        lanes.push({ originX: x, boxW: widths[i] * scale });
        x += widths[i] * scale + gapModel * scale;
      }
      // Hit regions: split on the midpoints between neighbouring letter centres.
      for (let i = 0; i < n; i++) {
        const c = lanes[i].originX + lanes[i].boxW / 2;
        lanes[i].centre = c;
      }
      for (let i = 0; i < n; i++) {
        lanes[i].lo = i === 0 ? 0 : (lanes[i - 1].centre + lanes[i].centre) / 2;
        lanes[i].hi = i === n - 1 ? w : (lanes[i].centre + lanes[i + 1].centre) / 2;
      }
      return { w, h: Math.round(100 * scale + PAD_Y * 2), scale, originY: PAD_Y, lanes };
    }

    const my = (v) => geom.originY + v * geom.scale;
    const laneX = (i, v) => geom.lanes[i].originX + v * geom.scale;
    const toCanvas = (i, p) => ({ x: laneX(i, p.x), y: my(p.y) });
    const toModel = (i, p) => ({
      x: (p.x - geom.lanes[i].originX) / geom.scale,
      y: (p.y - geom.originY) / geom.scale,
    });

    function laneAt(x) {
      const lanes = geom.lanes;
      for (let i = 0; i < lanes.length; i++) if (x >= lanes[i].lo && x < lanes[i].hi) return i;
      return x < 0 ? 0 : lanes.length - 1;
    }

    function laneOfStroke(s) {
      if (!s.pts.length) return 0;
      let sum = 0;
      for (const p of s.pts) sum += p.x;
      return laneAt(sum / s.pts.length);
    }

    function layout(fresh) {
      if (!canvas) return;
      const next = geomFor(measure());
      if (!fresh && strokes.length && geom && geom.scale > 0) {
        const old = geom;
        for (const s of strokes) {
          const li = Math.min(s.lane == null ? 0 : s.lane, next.lanes.length - 1);
          const oldLane = old.lanes[Math.min(li, old.lanes.length - 1)];
          s.pts = s.pts.map((p) => {
            const mxv = (p.x - oldLane.originX) / old.scale;
            const myv = (p.y - old.originY) / old.scale;
            return {
              x: next.lanes[li].originX + mxv * next.scale,
              y: next.originY + myv * next.scale,
            };
          });
        }
      }
      geom = next;
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      canvas.style.width = geom.w + "px";
      canvas.style.height = geom.h + "px";
      canvas.width = Math.round(geom.w * dpr);
      canvas.height = Math.round(geom.h * dpr);
      c2 = canvas.getContext("2d");
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The lane transform, published for anything that needs to place a
      // point on this canvas (tests, tooling) without re-deriving the maths.
      canvas.dataset.geom = JSON.stringify({
        scale: geom.scale, originY: geom.originY,
        lanes: geom.lanes.map((l) => ({ x: l.originX, w: l.boxW })),
      });
      // Each rub-out button grows to the width of the box it empties, so it
      // sits under its own box instead of near it.
      root.querySelectorAll('[data-role="lane-clear"]').forEach((b, i) => {
        const l = geom.lanes[i];
        if (l) b.style.flexGrow = String(Math.max(0.4, (l.hi - l.lo) / geom.w));
      });
      redraw();
    }

    // ---- drawing ---------------------------------------------------------
    function line(y, colour, width, dash) {
      c2.save();
      c2.setLineDash(dash || []);
      c2.strokeStyle = colour;
      c2.lineWidth = width;
      c2.beginPath();
      c2.moveTo(6, y);
      c2.lineTo(geom.w - 6, y);
      c2.stroke();
      c2.restore();
    }

    function roundRect(x, y, w, h, r) {
      c2.beginPath();
      c2.moveTo(x + r, y);
      c2.lineTo(x + w - r, y); c2.quadraticCurveTo(x + w, y, x + w, y + r);
      c2.lineTo(x + w, y + h - r); c2.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c2.lineTo(x + r, y + h); c2.quadraticCurveTo(x, y + h, x, y + h - r);
      c2.lineTo(x, y + r); c2.quadraticCurveTo(x, y, x + r, y);
      c2.closePath();
    }

    // One outlined box per letter, alternately tinted: a five-year-old has to
    // see at a glance that "sh" wants two letters and "igh" wants three.
    function drawLaneBoxes() {
      const lanes = geom.lanes;
      if (lanes.length < 2) return;
      c2.save();
      for (let i = 0; i < lanes.length; i++) {
        const x = lanes[i].lo + 2.5, w = lanes[i].hi - lanes[i].lo - 5;
        c2.setLineDash([]);
        if (i % 2) {
          c2.fillStyle = LANE_TINT;
          roundRect(x, 3.5, w, geom.h - 7, 9);
          c2.fill();
        }
        c2.setLineDash([5, 5]);
        c2.strokeStyle = LANE_EDGE;
        c2.lineWidth = 1.3;
        roundRect(x, 3.5, w, geom.h - 7, 9);
        c2.stroke();
      }
      c2.restore();
    }

    function drawGuides() {
      drawLaneBoxes();
      line(my(MODEL_THIRDS.top), GUIDE, 1.4);
      line(my(MODEL_THIRDS.mid), GUIDE, 1.1, [3, 5]);
      line(my(MODEL_THIRDS.base), GUIDE, 1.8);
      line(my(MODEL_THIRDS.floor), GUIDE_FAINT, 1.1, [2, 6]);
    }

    function strokeLetter(i, colour, widthPx) {
      c2.save();
      c2.translate(geom.lanes[i].originX, geom.originY);
      c2.scale(geom.scale, geom.scale);
      c2.lineCap = "round";
      c2.lineJoin = "round";
      c2.strokeStyle = colour;
      c2.lineWidth = widthPx / geom.scale;
      if (hasPaths[i]) {
        for (const p of modelPaths[i]) c2.stroke(p);
      } else {
        for (const pts of modelFine[i]) {
          if (!pts || pts.length < 2) continue;
          c2.beginPath();
          c2.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k < pts.length; k++) c2.lineTo(pts[k].x, pts[k].y);
          c2.stroke();
        }
      }
      c2.restore();
    }

    function drawModels() {
      for (let i = 0; i < chars.length; i++) strokeLetter(i, MODEL_GREY, 9);
    }

    function drawInk() {
      c2.save();
      c2.strokeStyle = INK;
      c2.fillStyle = INK;
      c2.lineWidth = 4.5;
      c2.lineCap = "round";
      c2.lineJoin = "round";
      for (const s of strokes) {
        const pts = s.pts;
        if (!pts.length) continue;
        if (pts.length === 1) {
          c2.beginPath();
          c2.arc(pts[0].x, pts[0].y, 2.4, 0, Math.PI * 2);
          c2.fill();
          continue;
        }
        c2.beginPath();
        c2.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) c2.lineTo(pts[i].x, pts[i].y);
        c2.stroke();
      }
      c2.restore();
    }

    function drawGhost(g) {
      c2.save();
      c2.strokeStyle = "rgba(168,50,50,0.9)";
      c2.fillStyle = GHOST_RED;
      c2.lineWidth = 5;
      c2.lineCap = "round";
      c2.lineJoin = "round";
      for (let i = 0; i <= g.upto && i < g.seq.length; i++) {
        const pts = g.seq[i];
        if (!pts || pts.length < 2) continue;
        const last = i < g.upto ? pts.length - 1
          : Math.max(1, Math.round((pts.length - 1) * g.frac));
        c2.beginPath();
        c2.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k <= last; k++) c2.lineTo(pts[k].x, pts[k].y);
        c2.stroke();
        if (i === g.upto) {
          const head = pts[last];
          c2.beginPath();
          c2.arc(head.x, head.y, 6, 0, Math.PI * 2);
          c2.fill();
        }
      }
      c2.restore();
    }

    function redraw() {
      if (!c2 || !geom) return;
      c2.save();
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, canvas.width, canvas.height);
      c2.restore();
      c2.fillStyle = PAPER;
      c2.fillRect(0, 0, geom.w, geom.h);
      drawGuides();
      if (revealed) drawModels();
      drawInk();
      if (ghost) drawGhost(ghost);
    }

    // ---- capture ----------------------------------------------------------
    function pointFrom(e) {
      const r = canvas.getBoundingClientRect();
      const kx = r.width ? geom.w / r.width : 1;
      const ky = r.height ? geom.h / r.height : 1;
      return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
    }

    function onDown(e) {
      if (disposed || phase !== "write" || (e.button != null && e.button > 0)) return;
      e.preventDefault();
      stopGhost();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      activePointer = e.pointerId;
      drawing = true;
      const p = pointFrom(e);
      strokes.push({ lane: laneAt(p.x), pts: [p] });
      if (!firstDownTs) firstDownTs = Date.now();
      redraw();
    }

    function onMove(e) {
      if (!drawing || disposed || e.pointerId !== activePointer) return;
      e.preventDefault();
      const cur = strokes[strokes.length - 1];
      if (!cur) return;
      const p = pointFrom(e);
      const last = cur.pts[cur.pts.length - 1];
      if (Math.abs(p.x - last.x) < 0.6 && Math.abs(p.y - last.y) < 0.6) return;
      cur.pts.push(p);
      c2.save();                            // live ink: just the new segment
      c2.strokeStyle = INK;
      c2.lineWidth = 4.5;
      c2.lineCap = "round";
      c2.lineJoin = "round";
      c2.beginPath();
      c2.moveTo(last.x, last.y);
      c2.lineTo(p.x, p.y);
      c2.stroke();
      c2.restore();
    }

    function onUp(e) {
      if (!drawing || e.pointerId !== activePointer) return;
      drawing = false;
      activePointer = null;
      lastUpTs = Date.now();
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const cur = strokes[strokes.length - 1];
      if (cur) cur.lane = laneOfStroke(cur);          // settle the lane on lift
      afterInkChange(true);
      redraw();
    }

    function inkedLanes() {
      const set = new Set();
      for (const s of strokes) if (s.pts.length) set.add(s.lane);
      return set;
    }

    // The shorthand mark of the SOUND appears once the child has had a go —
    // it names the sound, never its spelling, so it can't turn this into a
    // copying task.
    function afterInkChange(fromPointer) {
      const inked = inkedLanes();
      const confirmBtn = $('[data-role="confirm"]');
      if (confirmBtn) confirmBtn.disabled = phase !== "write" || inked.size === 0;
      root.querySelectorAll('[data-role="lane-clear"]').forEach((b) => {
        b.disabled = !inked.has(Number(b.dataset.lane));
      });
      const clearAll = $('[data-role="clearall"]');
      if (clearAll) clearAll.disabled = !strokes.length;
      if (fromPointer && !labelShown && inked.size) { labelShown = true; renderSoundLine(); }
      // "Check" is spoken the first time every box holds something, so a
      // child who can't read still knows what the red button is for.
      if (fromPointer && !askedForCheck && inked.size === chars.length) {
        askedForCheck = true;
        later(() => prompt("check"), 400);
      }
    }

    function clearLane(i) {
      if (phase !== "write") return;
      strokes = strokes.filter((s) => s.lane !== i);
      afterInkChange(false);
      redraw();
    }

    function clearAll() {
      if (phase !== "write") return;
      strokes = [];
      firstDownTs = 0;
      lastUpTs = 0;
      afterInkChange(false);
      redraw();
    }

    // ---- ghost replay ------------------------------------------------------
    function stopGhost() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (ghost) { ghost = null; redraw(); }
    }

    function replayGhost() {
      stopGhost();
      const seq = [];
      for (let i = 0; i < chars.length; i++) {
        for (const pts of modelFine[i]) seq.push(pts.map((p) => toCanvas(i, p)));
      }
      if (!seq.length) return;
      ghost = { seq, upto: 0, frac: 0 };
      let t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      const step = (now) => {
        if (disposed || !ghost) return;
        ghost.frac = Math.min(1, (now - t0) / GHOST_MS);
        redraw();
        if (ghost.frac >= 1) {
          ghost.upto += 1;
          t0 = now;
          if (ghost.upto >= seq.length) { ghost = null; redraw(); return; }
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    // ---- audio beats --------------------------------------------------------
    // playPhoneme is the primary voice; a GPC whose "phoneme" is really a
    // bundle (x = k+s) has no phoneme recording of its own, so it falls back
    // to playGpc, which knows how to join the ids and pick an example word.
    async function playSound() {
      const g = item.gpc;
      const single = Array.isArray(g.phonemes)
        ? (g.phonemes.length === 1 ? g.phonemes[0] : null) : g.phonemes;
      let known = false;
      try { known = !!(single && bank.phoneme(single)); } catch (e) { known = false; }
      if (known) {
        try { await ctx.audio.playPhoneme(single); return; } catch (e) { /* fall through */ }
      }
      try { await ctx.audio.playGpc(g); } catch (e) { /* ignore */ }
    }

    // Listen -> the sound -> "Write it". Tagged with the item it belongs to so
    // a fast tap on Next can never leave the last item's voice playing over
    // the next one.
    async function openingBeats() {
      const mine = idx;
      const stale = () => disposed || idx !== mine || phase !== "write";
      await prompt("listen");
      await delay(850);
      if (stale()) return;
      await playSound();
      await delay(900);
      if (stale()) return;
      await prompt("write");
    }

    // ---- markup -------------------------------------------------------------
    function renderSoundLine() {
      const holder = $('[data-role="soundline"]');
      if (!holder) return;
      const mark = markFor(item.gpc);
      if (!labelShown) {
        holder.innerHTML = mark
          ? `<button type="button" class="sw-btn" data-role="show">👀 Show me the sound</button>`
          : "";
        return;
      }
      const ex = revealed ? exampleFor(item.gpc) : null;   // an example word spells it out
      holder.innerHTML = mark
        ? `<span class="sw-soundchip">
             <span class="sw-mark">${esc(mark)}</span>
             ${ex ? `<span class="sw-as">as in <b>${esc(ex)}</b></span>` : ""}
           </span>`
        : "";
    }

    function renderItem() {
      const n = chars.length;
      const laneBtns = n > 1
        ? chars.map((c, i) => `<button type="button" class="sw-lanebtn" data-role="lane-clear"
             data-lane="${i}" disabled aria-label="Rub out box ${i + 1}"
             ><span class="sw-rub">🧽</span> <span class="sw-rubn">${i + 1}</span></button>`).join("")
        : "";
      root.innerHTML = `
        <div class="pt-progress">Sound ${idx + 1} of ${items.length}</div>
        <button type="button" class="pt-bigplay" data-role="play" aria-label="Hear the sound again">🔊</button>
        <p class="sw-hint">Tap to hear it again</p>
        <p class="pt-prompt">Write the letters that make this sound</p>
        <div class="sw-soundline" data-role="soundline"></div>
        <div class="sw-canvas-wrap">
          <canvas class="sw-canvas" data-role="canvas"
            aria-label="Writing lines with ${n} box${n === 1 ? "" : "es"}, one for each letter"></canvas>
        </div>
        <div class="sw-lanebtns" data-role="lanebtns">${laneBtns}</div>
        <div class="sw-actions" data-role="writerow">
          <button type="button" class="sw-btn" data-role="clearall" disabled>🧽 Rub it all out</button>
          <button type="button" class="pt-primary" data-role="confirm" disabled>Confirm</button>
        </div>
        <p class="sw-hint" data-role="writehint">Nothing counts until you tap Confirm.</p>
        <div class="sw-actions" data-role="afterrow" hidden>
          <button type="button" class="sw-btn" data-role="ghost">▶ Watch it written</button>
          <button type="button" class="pt-primary" data-role="next">${
            idx + 1 < items.length ? "Next sound" : "Finish"}</button>
        </div>
        <div data-role="result"></div>`;
      canvas = $('[data-role="canvas"]');
      renderSoundLine();
      layout(true);
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
    }

    function startItem() {
      item = items[idx];
      chars = item.letters;
      defs = chars.map((c) => letters[c]);
      modelFine = defs.map((d) => (d.strokes || []).map((s) => PH.pathToPoints(s.path, 96)));
      modelPaths = defs.map((d) => (d.strokes || []).map((s) => {
        try { return new Path2D(s.path); } catch (e) { return null; }
      }).filter(Boolean));
      hasPaths = defs.map((d, i) => modelPaths[i].length === (d.strokes || []).length);
      strokes = [];
      drawing = false;
      activePointer = null;
      firstDownTs = 0;
      lastUpTs = 0;
      phase = "write";
      labelShown = false;
      revealed = false;
      askedForCheck = false;
      results = [];
      formTotal = 0;
      legible = false;
      encodeState = "pending";
      stopGhost();
      root.dataset.item = item.gpc.id;
      root.dataset.grapheme = item.grapheme;
      root.dataset.phase = "write";
      renderItem();
      openingBeats();
    }

    // ---- confirm: score formation, reveal, ask the letter question ----------
    function onConfirm() {
      if (phase !== "write" || !strokes.length) {
        toast("Have a go first — write the letters on the lines.");
        return;
      }
      stopGhost();
      phase = "checked";
      root.dataset.phase = "checked";

      results = chars.map((c, i) => {
        const mine = strokes.filter((s) => s.lane === i && s.pts.length);
        if (!mine.length) return null;
        try {
          return PH.scoreAttempt({
            attemptStrokes: mine.map((s) => s.pts.map((p) => toModel(i, p))),
            letterModel: defs[i],
            thirds: MODEL_THIRDS,        // points are already in model space
            n: N,
          });
        } catch (err) { return null; }
      });

      let sum = 0;
      legible = true;
      results.forEach((r, i) => {
        const total = r ? r.total : 0;
        sum += total;
        if (!r || total < FLOOR) legible = false;
        if (r) {
          tally.letters += 1;
          if (total >= PASS) tally.lettersGood += 1;
          // Formation is measured, not guessed — it always goes in the book.
          record("letter:" + chars[i] + "|" + STYLE_ID, total >= PASS,
            { total, features: r.features, gpc: item.gpc.id });
        }
      });
      formTotal = chars.length ? Math.round(sum / chars.length) : 0;

      labelShown = true;
      revealed = true;                    // grey models appear under the ink
      renderSoundLine();
      renderResult();
      redraw();
      // The writing tools go away so the only thing left to do is answer.
      for (const rl of ["writerow", "writehint", "lanebtns"]) {
        const el = $(`[data-role="${rl}"]`);
        if (el) el.hidden = true;
      }
      scrollTo($('[data-role="result"]'));
    }

    function scrollTo(el) {
      if (!el || typeof el.scrollIntoView !== "function") return;
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { /* ignore */ }
    }

    function worstAdvice() {
      let worst = null;
      results.forEach((r, i) => {
        if (!r) return;
        for (const [f, label] of FEATURES) {
          const v = r.features[f] || 0;
          if (!worst || v < worst.v) worst = { v, f, label, i, res: r };
        }
      });
      if (!worst || worst.v >= PASS) return null;
      const line = (worst.res.advice || [])[0];
      return {
        letter: chars[worst.i],
        text: line || ("Watch your " + worst.label.toLowerCase() + " on this one."),
      };
    }

    function renderResult() {
      const box = $('[data-role="result"]');
      if (!box) return;
      const g = item.gpc;
      const display = String(g.display || g.grapheme).replace(/_/g, "-");
      const glyphs = chars.map((c) =>
        `<span>${glyphSvg(letters[c], { height: 56, sw: 5.5, label: "letter " + c })}</span>`).join("");

      const chips = chars.map((c, i) => {
        const r = results[i];
        const band = r ? (r.band || PH.gradeToBand(r.total)) : "none";
        return `<span class="sw-letter" data-band="${esc(band)}" data-letter="${esc(c)}"
             data-total="${r ? r.total : ""}">
            <span class="sw-letter-num">${r ? r.total : "–"}</span>
            <span class="sw-letter-key">letter ${esc(c)}</span>
          </span>`;
      }).join("");

      const band = BANDS[PH.gradeToBand(formTotal)] || BANDS["keep-practising"];
      const adv = worstAdvice();
      const missing = results.some((r) => !r);

      box.innerHTML = `
        <div class="sw-vd" data-role="vd-letters">
          <div class="sw-vd-h">1 · The letters</div>
          <div class="sw-answer">
            <span class="sw-answer-lab">This sound is spelled</span>
            <span class="sw-answer-g" data-role="answer">${esc(display)}</span>
            <span class="sw-answer-glyphs">${glyphs}</span>
          </div>
          <div data-role="ask">
            <div class="sw-ask-q">Is that what you wrote?</div>
            <div class="sw-ask-btns">
              <button type="button" class="sw-btn yes" data-role="yes">👍 Yes</button>
              <button type="button" class="sw-btn no" data-role="no">👎 No</button>
            </div>
            <p class="sw-grown">Grown-up: have a look at the writing before you tap.</p>
          </div>
          <div class="sw-vd-line" data-role="verdict" hidden></div>
          <button type="button" class="sw-escape" data-role="escape" hidden>
            That's not what I wrote — don't count it</button>
        </div>
        <div class="sw-vd" data-role="vd-writing">
          <div class="sw-vd-h">2 · How you formed them</div>
          <div class="sw-letters">${chips}</div>
          <div class="sw-total">
            <span class="sw-total-emoji">${band.emoji}</span>
            <span class="sw-total-text">${esc(band.text)}</span>
            <span class="sw-total-num" data-role="form-total">${formTotal}<small>/100</small></span>
          </div>
          ${missing ? `<div class="sw-advice">One box is empty — every letter needs writing in its own box.</div>` : ""}
          ${adv ? `<div class="sw-advice">On the <b>${esc(adv.letter)}</b>: ${esc(adv.text)}</div>` : ""}
        </div>`;
    }

    // ---- the letter-choice verdict -------------------------------------------
    function commitEncode(correct) {
      if (encodeState !== "pending") return;
      encodeState = "committed";
      tally.scored += 1;
      if (correct) tally.right += 1;
      record(item.gpc.id + "|encode", correct, {
        grapheme: item.grapheme, formTotal, legible,
      });
    }

    function unscoreEncode() {
      if (encodeState !== "pending") return;
      encodeState = "unscored";
      tally.unscored += 1;
    }

    function onAnswer(saidYes) {
      if (phase !== "checked") return;
      phase = "answered";
      root.dataset.phase = "answered";
      const right = saidYes && legible;
      root.dataset.letterChoice = right ? "right" : (saidYes ? "unverified" : "wrong");

      const ask = $('[data-role="ask"]');
      if (ask) ask.hidden = true;
      const vline = $('[data-role="verdict"]');
      if (vline) {
        vline.hidden = false;
        if (right) {
          vline.dataset.tone = "good";
          vline.textContent = "Yes! " + item.grapheme.split("").join("-") +
            " spells that sound. You picked the right letters.";
        } else if (saidYes) {
          vline.dataset.tone = "muted";
          vline.textContent = "I couldn't match your writing to those letters — " +
            "so I'll count the writing, not the spelling.";
        } else {
          vline.dataset.tone = "bad";
          vline.textContent = "Not this time — this sound is spelled " +
            item.grapheme.split("").join("-") + ".";
        }
      }
      const escBtn = $('[data-role="escape"]');
      if (escBtn) escBtn.hidden = right;      // only a negative verdict is escapable

      if (right) commitEncode(true);          // the only claim the app can back

      const after = $('[data-role="afterrow"]');
      if (after) after.hidden = false;

      prompt(right && formTotal >= PASS ? "well_done" : "nearly");
      // Back up to the canvas so the ghost is actually watched, with Next
      // sitting right underneath it.
      later(() => {
        if (phase !== "answered") return;
        scrollTo(canvas);
        replayGhost();
      }, 700);
    }

    function onEscape() {
      if (encodeState !== "pending") return;
      unscoreEncode();
      const escBtn = $('[data-role="escape"]');
      if (escBtn) escBtn.hidden = true;
      const vline = $('[data-role="verdict"]');
      if (vline) {
        vline.dataset.tone = "muted";
        vline.textContent = "Righto — this one doesn't count. Your writing still does.";
      }
      root.dataset.letterChoice = "unscored";
    }

    function onNext() {
      // A verdict the child never disputed is the verdict that stands.
      if (phase === "answered") commitEncode(false);
      const mark = markFor(item.gpc);
      if (mark && soundLabels.indexOf(mark) === -1) soundLabels.push(mark);
      idx += 1;
      stopGhost();
      if (idx >= items.length) finish();
      else startItem();
    }

    function finish() {
      const note = tally.letters
        ? tally.lettersGood + " of " + tally.letters + " letters well formed" +
          (tally.unscored ? " · " + tally.unscored + " not counted" : "")
        : "Come back and write some sounds!";
      const summary = {
        title: "Sound to Letters",
        correct: tally.right,
        total: tally.scored,
        note,
        sounds: soundLabels.slice(0, 14),
      };
      if (ctx && typeof ctx.exit === "function") ctx.exit({ summary });
    }

    // ---- events ---------------------------------------------------------------
    function onClick(e) {
      if (disposed) return;
      if (e.target.closest('[data-role="play"]')) { playSound(); return; }
      if (e.target.closest('[data-role="show"]')) { labelShown = true; renderSoundLine(); return; }
      const laneBtn = e.target.closest('[data-role="lane-clear"]');
      if (laneBtn && !laneBtn.disabled) { clearLane(Number(laneBtn.dataset.lane)); return; }
      const clearBtn = e.target.closest('[data-role="clearall"]');
      if (clearBtn && !clearBtn.disabled) { clearAll(); return; }
      const confirmBtn = e.target.closest('[data-role="confirm"]');
      if (confirmBtn && !confirmBtn.disabled) { onConfirm(); return; }
      if (e.target.closest('[data-role="yes"]')) { onAnswer(true); return; }
      if (e.target.closest('[data-role="no"]')) { onAnswer(false); return; }
      if (e.target.closest('[data-role="escape"]')) { onEscape(); return; }
      if (e.target.closest('[data-role="ghost"]')) { replayGhost(); return; }
      if (e.target.closest('[data-role="next"]')) { onNext(); return; }
    }

    let resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (!disposed && canvas) layout(false); }, 120);
    }

    root.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);
    startItem();

    return {
      destroy() {
        disposed = true;
        stopGhost();
        root.removeEventListener("click", onClick);
        window.removeEventListener("resize", onResize);
        clearTimeout(resizeTimer);
        for (const t of timers) clearTimeout(t);
        try { if (ctx && ctx.audio && ctx.audio.stop) ctx.audio.stop(); } catch (e) { /* ignore */ }
      },
    };
  }

  PhonicsTasks.register({
    id: "t11",
    title: "Sound to Letters",
    subtitle: "Hear a sound, write how it's spelled",
    icon: "🎧",
    order: 55,
    unlockId: null,
    mount,
  });
})();
