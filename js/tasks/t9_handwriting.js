// ============================================================
// js/tasks/t9_handwriting.js — T9: Handwriting.
//
// ARCHITECTURE.md §9 (handwriting subsystem) on the §6 ladder:
// trace -> copy -> from-memory, two clean scores at a level and
// the child steps up. The maths all lives in the pure module
// js/core/handwriting/score.js; this file is only capture +
// drawing + the words around the numbers.
//
// Screen 1  family picker (from the letterform file's `families`
//           block) + every letter + the digits, each drawn as a
//           mini SVG glyph straight from its stroke paths.
// Screen 2  one letter: dotted-thirds canvas, pointer capture,
//           Check -> band + per-feature bars + advice, a ghost
//           replay of the model over the child's own attempt.
//
// COORDINATES. Attempt points are captured in canvas pixels and
// mapped ALL THE WAY into the model's 0-100 letter box before
// scoring, so `thirds` is simply the model's own line set — the
// safest of the two paths score.js documents (pass thirds in the
// same space as the points, or placement silently mis-scores).
//
// Score keys: "letter:<key>|vic-modern-cursive", taskType "t9".
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

  const N = 48;                 // resample points, model and attempt alike
  const PASS = 70;              // "good" band — the ladder's step-up line
  const HITS_TO_STEP_UP = 2;    // two clean scores at a level -> next level
  const GHOST_MS = 1200;        // one model stroke per 1.2s in the replay
  const CANVAS_MAX = 340;       // CSS px; shrinks to fit narrow phones
  const CANVAS_MIN = 232;
  const PAD_Y = 22;             // px above the top line / below the floor

  // The attempt is mapped into the model box, so these ARE the thirds.
  const MODEL_THIRDS = { top: 0, mid: 33.3, base: 66.6, floor: 100 };

  const LEVELS = [
    { id: "trace", label: "Trace",
      hint: "Trace over the grey letter — start on the green dot and follow the arrow." },
    { id: "copy", label: "Copy",
      hint: "Look at the little letter in the corner, then write it big on the lines." },
    { id: "memory", label: "From memory",
      hint: "No model this time — write it from memory." },
  ];

  const BANDS = {
    "great": { emoji: "🌟", text: "Beautiful writing!" },
    "good": { emoji: "👍", text: "Nice writing!" },
    "getting-there": { emoji: "💪", text: "Getting there — have another go." },
    "keep-practising": { emoji: "🌱", text: "Keep practising — watch the ghost, then try again." },
  };

  // score.js reports six features. ARCHITECTURE §9 lists "order & direction"
  // as one line, but they fail for completely different reasons (built in the
  // wrong order vs drawn backwards) and the fix is different too, so the child
  // sees them as two separate bars.
  const FEATURES = [
    ["strokeCount", "Strokes"],
    ["order", "Order"],
    ["direction", "Direction"],
    ["start", "Start point"],
    ["shape", "Shape"],
    ["placement", "On the lines"],
  ];

  const FAMILY_NAMES = {
    "anticlockwise-loop": "Anticlockwise loop",
    "tall-sticks": "Tall sticks",
    "tails": "Tails under the line",
    "humps": "Humps",
    "u-turns": "U-turns",
    "zigzags": "Zigzags",
    "snake-curves": "Snake curves",
    "digits-round": "Round numbers",
    "digits-straight": "Straight numbers",
  };

  // canvas ink
  const PAPER = "#ffffff";
  const INK = "#1f1f1f";
  const GUIDE = "#b9ac91";
  const GUIDE_FAINT = "#e0d8c6";
  const BOX_EDGE = "#efe8d8";
  const MODEL_GREY = "#dcd5c6";
  const MINI_INK = "#5a5348";
  const START_GREEN = "#2f6a3e";
  const GHOST_RED = "#a83232";

  const isDigit = (k) => /^[0-9]$/.test(String(k));

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function famName(key) {
    if (FAMILY_NAMES[key]) return FAMILY_NAMES[key];
    const words = String(key || "").replace(/-/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  const sayName = (k) => (isDigit(k) ? "number " + k : "letter " + k);

  // ---- the letterform file ------------------------------------------
  let stylePromise = null;
  function loadStyle(ctx) {
    const given = ctx && (ctx.letterforms || ctx.handwritingStyle);
    if (given && given.letters) return Promise.resolve(given);
    if (!stylePromise) {
      stylePromise = fetch(STYLE_FILE).then((r) => {
        if (!r.ok) throw new Error("letterforms failed to load (" + r.status + ")");
        return r.json();
      });
      // A failed load must not poison the next mount.
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
    return '<svg class="hw-glyph" viewBox="' + (-pad) + " " + (-pad) + " " + vbW + " " + vbH +
      '" width="' + wpx + '" height="' + h + '" role="img" aria-label="' +
      esc(opts.label || "letter") + '" focusable="false">' + guides + paths + "</svg>";
  }

  // ---- styles (injected once, so T9 renders on any host page) ---------
  const CSS = `
.hw-root { --hw-accent: var(--accent, #a83232); --hw-ink: var(--ink, #1f1f1f);
  --hw-muted: var(--muted, #6b6256); --hw-line: var(--line, #d8cfbb);
  --hw-soft: var(--line-soft, #e8e0cd); --hw-paper: var(--paper, #fbf7ee);
  --hw-bg: var(--bg, #f4efe6); --hw-good: var(--correct, #2f6a3e);
  --hw-warn: var(--warn, #c8992e); --hw-warn-ink: var(--warn-ink, #6b5316);
  --hw-warn-bg: var(--warn-bg, #f8f1de); --hw-bad: var(--wrong, #a83232);
  color: var(--hw-ink); }
.hw-root [hidden] { display: none !important; }
.hw-lead { font-size: 13.5px; color: var(--hw-muted); line-height: 1.55; margin: 2px 0 14px; text-align: center; }
.hw-h2 { font-family: Georgia, serif; font-size: 12px; font-weight: 700; letter-spacing: 0.7px;
  text-transform: uppercase; color: var(--hw-muted); margin: 20px 0 8px; }
.hw-fam-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 560px) { .hw-fam-grid { grid-template-columns: 1fr 1fr; } }
.hw-fam { display: block; width: 100%; text-align: left; padding: 12px 14px; min-height: 88px;
  border: 1px solid var(--hw-line); border-radius: 12px; background: var(--hw-paper);
  font-family: inherit; color: inherit; cursor: pointer; transition: all 0.16s ease; }
.hw-fam:hover { border-color: var(--hw-accent); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.07); }
.hw-fam-name { display: block; font-family: Georgia, serif; font-weight: 700; font-size: 16px; }
.hw-fam-teach { display: block; font-size: 12px; color: var(--hw-muted); line-height: 1.45; margin-top: 3px; }
.hw-fam-glyphs { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 7px; margin-top: 9px; color: var(--hw-ink); }
.hw-tiles { display: flex; flex-wrap: wrap; gap: 8px; }
.hw-tile { min-width: 50px; min-height: 62px; padding: 5px 6px 3px; border: 1px solid var(--hw-line);
  border-radius: 10px; background: var(--hw-paper); color: var(--hw-ink); cursor: pointer;
  font-family: inherit; display: flex; flex-direction: column; align-items: center; gap: 2px;
  transition: all 0.14s ease; }
.hw-tile:hover { border-color: var(--hw-accent); color: var(--hw-accent); }
.hw-tile-key { font-size: 10.5px; font-weight: 700; color: var(--hw-muted); }
.hw-tile:hover .hw-tile-key { color: var(--hw-accent); }
.hw-glyph { display: block; }
.hw-topline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.hw-back { min-height: 44px; padding: 4px 10px 4px 0; border: none; background: none; cursor: pointer;
  font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--hw-muted); }
.hw-back:hover { color: var(--hw-ink); }
.hw-crumb { font-size: 11.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--hw-muted); }
.hw-head { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 2px 0 8px; }
.hw-head-glyph { display: flex; color: var(--hw-ink); }
.hw-head-meta { font-size: 11.5px; color: var(--hw-muted); line-height: 1.4; }
.hw-head-meta b { font-family: Georgia, serif; font-size: 17px; color: var(--hw-ink); }
.hw-levels { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; margin: 6px 0 8px; }
.hw-level { min-height: 44px; padding: 6px 13px; border: 1px solid var(--hw-line); border-radius: 22px;
  background: var(--hw-bg); color: var(--hw-muted); font-family: inherit; font-weight: 700;
  font-size: 13px; cursor: pointer; transition: all 0.14s ease; }
.hw-level:hover { border-color: var(--hw-accent); color: var(--hw-accent); }
.hw-level[aria-pressed="true"] { background: var(--hw-ink); border-color: var(--hw-ink); color: #fff; }
.hw-hint { text-align: center; font-size: 13px; color: var(--hw-muted); line-height: 1.5; margin: 0 auto 10px; max-width: 340px; }
.hw-canvas-wrap { width: 100%; max-width: ${CANVAS_MAX}px; margin: 0 auto; }
.hw-canvas { display: block; margin: 0 auto; touch-action: none; background: #fff;
  border: 1px solid var(--hw-line); border-radius: 12px; cursor: crosshair; }
.hw-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 12px; }
.hw-toolrow { margin-top: 8px; }
.hw-btn { min-height: 44px; min-width: 44px; padding: 10px 17px; border-radius: 10px;
  border: 1px solid var(--hw-line); background: var(--hw-bg); color: var(--hw-ink);
  font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.14s ease; }
.hw-btn:hover:not(:disabled) { border-color: var(--hw-accent); color: var(--hw-accent); }
.hw-btn.primary { background: var(--hw-accent); border-color: var(--hw-accent); color: #fff; }
.hw-btn.primary:hover:not(:disabled) { filter: brightness(1.08); color: #fff; }
.hw-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.hw-result { margin-top: 14px; border: 1px solid var(--hw-soft); border-radius: 12px;
  background: var(--hw-paper); padding: 12px 13px; }
.hw-band { display: flex; align-items: center; gap: 10px; }
.hw-band-emoji { font-size: 26px; line-height: 1; }
.hw-band-text { flex: 1; min-width: 0; font-family: Georgia, serif; font-weight: 700; font-size: 15.5px; line-height: 1.3; }
.hw-score { font-family: Georgia, serif; font-weight: 700; font-size: 26px; line-height: 1; white-space: nowrap; }
.hw-score small { font-size: 12px; font-weight: 400; color: var(--hw-muted); }
.hw-result[data-band="great"] .hw-score, .hw-result[data-band="good"] .hw-score { color: var(--hw-good); }
.hw-result[data-band="getting-there"] .hw-score { color: var(--hw-warn-ink); }
.hw-result[data-band="keep-practising"] .hw-score { color: var(--hw-bad); }
.hw-bars { display: grid; gap: 6px; margin-top: 12px; }
.hw-bar { display: grid; grid-template-columns: 84px 1fr 30px; align-items: center; gap: 8px; font-size: 12px; }
.hw-bar-label { color: var(--hw-muted); font-weight: 700; }
.hw-bar-track { height: 9px; border-radius: 6px; background: var(--hw-soft); overflow: hidden; }
.hw-bar-fill { display: block; height: 100%; border-radius: 6px; background: var(--hw-good); transition: width 0.45s ease; }
.hw-bar[data-level="mid"] .hw-bar-fill { background: var(--hw-warn); }
.hw-bar[data-level="low"] .hw-bar-fill { background: var(--hw-bad); }
.hw-bar-num { text-align: right; font-weight: 700; color: var(--hw-muted); font-variant-numeric: tabular-nums; }
.hw-advice { list-style: none; margin: 12px 0 0; padding: 0; }
.hw-advice li { font-size: 13.5px; line-height: 1.5; padding: 8px 11px; border-radius: 9px;
  background: var(--hw-warn-bg); color: var(--hw-warn-ink); margin-top: 6px; }
.hw-note { text-align: center; font-size: 13.5px; font-weight: 700; color: var(--hw-good);
  line-height: 1.5; margin-top: 10px; min-height: 20px; }
.hw-note.warn { color: var(--hw-warn-ink); }
.hw-error { text-align: center; color: var(--hw-bad); background: #f5eaea; border-radius: 8px;
  padding: 22px 14px; font-size: 14px; line-height: 1.5; }
@media (max-width: 400px) {
  .hw-bar { grid-template-columns: 74px 1fr 28px; }
  .hw-btn { padding: 10px 13px; font-size: 13.5px; }
}`;

  function ensureStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById("hw-t9-styles")) return;
    const tag = document.createElement("style");
    tag.id = "hw-t9-styles";
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  // ====================================================================
  async function mount(container, ctx) {
    ensureStyles();
    const PH = window.PhonicsHandwriting;
    const toast = (msg) => {
      try { if (ctx && typeof ctx.toast === "function") ctx.toast(msg); } catch (e) { /* ignore */ }
    };
    const speak = (text) => {
      try { if (ctx && ctx.audio && ctx.audio.speak) ctx.audio.speak(text); } catch (e) { /* ignore */ }
    };

    const root = document.createElement("div");
    root.className = "hw-root";
    container.appendChild(root);

    let disposed = false;
    const timers = [];
    const later = (fn, ms) => {
      const t = setTimeout(() => { if (!disposed) fn(); }, ms);
      timers.push(t);
      return t;
    };

    if (!PH || typeof PH.scoreAttempt !== "function") {
      root.innerHTML = `<div class="hw-error">Handwriting scoring didn't load.<br>
        Check that <code>js/core/handwriting/score.js</code> is on the page.</div>`;
      return { destroy() { disposed = true; } };
    }

    let style;
    try {
      style = await loadStyle(ctx);
    } catch (err) {
      if (disposed) return { destroy() { disposed = true; } };
      root.innerHTML = `<div class="hw-error">The letter models didn't load — try refreshing.<br>
        <small>${esc(err && err.message ? err.message : String(err))}</small></div>`;
      return { destroy() { disposed = true; } };
    }
    if (disposed) return { destroy() { disposed = true; } };

    const letters = (style && style.letters) || {};
    const families = (style && style.families) || {};
    const allKeys = Object.keys(letters);
    const alphaKeys = allKeys.filter((k) => !isDigit(k)).sort();
    const digitKeys = allKeys.filter(isDigit).sort();

    if (!allKeys.length) {
      root.innerHTML = `<div class="hw-error">No letter models in this handwriting style yet.</div>`;
      return { destroy() { disposed = true; } };
    }

    // ladder position per letter, kept for the whole session
    const ladder = {};                       // key -> { level, hits: [0,0,0] }
    const stats = { attempts: 0, good: 0, letters: {} };
    const rung = (key) => (ladder[key] = ladder[key] || { level: 0, hits: [0, 0, 0] });

    let screen = "pick";
    let letterView = null;                   // live per-letter controller

    // ---- screen 1: the picker ---------------------------------------
    function renderPicker() {
      teardownLetter();
      screen = "pick";
      root.dataset.screen = "pick";

      const famCards = Object.keys(families).map((fk) => {
        const fam = families[fk] || {};
        const order = (fam.order && fam.order.length ? fam.order : fam.letters || [])
          .filter((k) => letters[k]);
        if (!order.length) return "";
        const glyphs = order.slice(0, 9).map((k) =>
          `<span class="hw-fam-glyph">${glyphSvg(letters[k], { height: 30, sw: 5.5, label: sayName(k) })}</span>`).join("");
        return `<button type="button" class="hw-fam" data-role="family" data-family="${esc(fk)}">
            <span class="hw-fam-name">${esc(famName(fk))}</span>
            <span class="hw-fam-teach">${esc(fam.teach || "")}</span>
            <span class="hw-fam-glyphs">${glyphs}</span>
          </button>`;
      }).join("");

      const tiles = (keys) => keys.map((k) =>
        `<button type="button" class="hw-tile" data-role="letter" data-letter="${esc(k)}"
           aria-label="Practise the ${esc(sayName(k))}">
           ${glyphSvg(letters[k], { height: 36, sw: 5.5, label: sayName(k) })}
           <span class="hw-tile-key">${esc(k)}</span>
         </button>`).join("");

      root.innerHTML = `
        <p class="hw-lead">Pick a family to practise a whole group of letters that start the same way —
          or jump straight to any letter or number.</p>
        ${famCards ? `<h3 class="hw-h2">Letter families</h3>
        <div class="hw-fam-grid" data-role="fams">${famCards}</div>` : ""}
        <h3 class="hw-h2">All letters</h3>
        <div class="hw-tiles">${tiles(alphaKeys)}</div>
        ${digitKeys.length ? `<h3 class="hw-h2">Numbers</h3>
        <div class="hw-tiles">${tiles(digitKeys)}</div>` : ""}
        <div class="hw-actions">
          <button type="button" class="hw-btn" data-role="finish">Finished for now</button>
        </div>`;
    }

    function finish() {
      const practised = Object.keys(stats.letters);
      const summary = {
        title: "Handwriting",
        correct: stats.good,
        total: stats.attempts,
        note: practised.length
          ? practised.length + (practised.length === 1 ? " letter" : " letters") + " practised"
          : "Come back and write some letters!",
        sounds: practised.slice(0, 14),
      };
      if (ctx && typeof ctx.exit === "function") ctx.exit({ summary });
      else renderPicker();
    }

    // ---- screen 2: one letter ----------------------------------------
    function openLetter(key, queue, familyKey) {
      if (!letters[key]) return;
      teardownLetter();
      screen = "letter";
      root.dataset.screen = "letter";
      letterView = buildLetterView(key, queue && queue.length ? queue : [key], familyKey || null);
    }

    function teardownLetter() {
      if (letterView && typeof letterView.destroy === "function") {
        try { letterView.destroy(); } catch (e) { /* a dying view can't hurt us */ }
      }
      letterView = null;
    }

    function buildLetterView(key, queue, familyKey) {
      const def = letters[key];
      const state = rung(key);
      const qIndex = Math.max(0, queue.indexOf(key));

      // model geometry, sampled once per letter: N points for the cues and
      // the scorer's own resolution, a finer set for drawing and the ghost.
      const modelPts = (def.strokes || []).map((s) => PH.pathToPoints(s.path, N));
      const modelFine = (def.strokes || []).map((s) => PH.pathToPoints(s.path, 96));
      const modelPaths = (def.strokes || []).map((s) => {
        try { return new Path2D(s.path); } catch (e) { return null; }
      }).filter(Boolean);
      const hasPaths = modelPaths.length === (def.strokes || []).length;

      let dead = false;
      const alive = (fn) => () => { if (!dead && !disposed) fn(); };

      let geom = { size: CANVAS_MAX, scale: 1, originX: 0, originY: PAD_Y, boxW: 0 };
      let strokes = [];             // raw {x,y} canvas points, one array per stroke
      let c2 = null, canvas = null;
      let drawing = false, activePointer = null;
      let firstDownTs = 0, lastUpTs = 0;
      let checked = false;
      let ghost = null, raf = 0;

      const mx = (v) => geom.originX + v * geom.scale;
      const my = (v) => geom.originY + v * geom.scale;
      const toCanvas = (p) => ({ x: mx(p.x), y: my(p.y) });
      const toModel = (p) => ({ x: (p.x - geom.originX) / geom.scale, y: (p.y - geom.originY) / geom.scale });

      const $ = (sel) => root.querySelector(sel);

      function html() {
        const lv = state.level;
        const inFam = queue.length > 1;
        root.innerHTML = `
          <div class="hw-topline">
            <button type="button" class="hw-back" data-role="back">&larr; All letters</button>
            <span class="hw-crumb">${familyKey ? esc(famName(familyKey)) + " · " : ""}${inFam
              ? esc((qIndex + 1) + " of " + queue.length) : ""}</span>
          </div>
          <div class="hw-head">
            <span class="hw-head-glyph">${glyphSvg(def, { height: 44, sw: 5.5, label: sayName(key) })}</span>
            <span class="hw-head-meta"><b>${esc(key)}</b> · ${esc(def.zone || "x-height")} ·
              ${(def.strokes || []).length} stroke${(def.strokes || []).length === 1 ? "" : "s"}</span>
          </div>
          <div class="hw-levels" role="group" aria-label="How much help">
            ${LEVELS.map((l, i) => `<button type="button" class="hw-level" data-role="level" data-level="${i}"
               aria-pressed="${i === lv ? "true" : "false"}">${i + 1}. ${esc(l.label)}</button>`).join("")}
          </div>
          <p class="hw-hint" data-role="hint">${esc(LEVELS[lv].hint)}</p>
          <div class="hw-canvas-wrap">
            <canvas class="hw-canvas" data-role="canvas"
              aria-label="Writing area for the ${esc(sayName(key))}"></canvas>
          </div>
          <div class="hw-actions" data-role="mainrow">
            <button type="button" class="hw-btn primary" data-role="check">Check</button>
            <button type="button" class="hw-btn" data-role="clear">Clear</button>
          </div>
          <div class="hw-actions hw-toolrow">
            <button type="button" class="hw-btn" data-role="ghost">&#9654; Replay ghost</button>
            <button type="button" class="hw-btn" data-role="say" ${lv === 2 ? "" : "hidden"}>&#128266; Say it</button>
            <button type="button" class="hw-btn" data-role="next">${queue.length > 1
              ? "Next letter &rarr;" : "Back to the letters"}</button>
          </div>
          <div class="hw-result" data-role="result" hidden></div>
          <div class="hw-note" data-role="note"></div>
          <div class="hw-actions" data-role="afterrow" hidden>
            <button type="button" class="hw-btn" data-role="again">Try again</button>
          </div>`;
        root.dataset.level = LEVELS[state.level].id;
        root.dataset.letter = key;
        canvas = $('[data-role="canvas"]');
        layout(true);
        wireCanvas();
      }

      // ---- geometry / canvas ------------------------------------------
      function measure() {
        const wrap = root.querySelector(".hw-canvas-wrap");
        const avail = wrap && wrap.clientWidth ? wrap.clientWidth : CANVAS_MAX;
        return Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, Math.floor(avail)));
      }

      function geomFor(size) {
        const scale = (size - PAD_Y * 2) / 100;
        const boxW = (typeof def.width === "number" ? def.width : 55) * scale;
        return { size, scale, originX: (size - boxW) / 2, originY: PAD_Y, boxW };
      }

      // Re-laying out mid-session would strand the ink, so points ride through
      // model space into the new geometry.
      function layout(fresh) {
        if (!canvas) return;
        const size = measure();
        const next = geomFor(size);
        if (!fresh && strokes.length && geom.scale > 0) {
          const old = geom;
          strokes = strokes.map((s) => s.map((p) => {
            const m = { x: (p.x - old.originX) / old.scale, y: (p.y - old.originY) / old.scale };
            return { x: next.originX + m.x * next.scale, y: next.originY + m.y * next.scale };
          }));
        }
        geom = next;
        const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
        canvas.style.width = geom.size + "px";
        canvas.style.height = geom.size + "px";
        canvas.width = Math.round(geom.size * dpr);
        canvas.height = Math.round(geom.size * dpr);
        c2 = canvas.getContext("2d");
        c2.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
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

      function drawGuides() {
        const x0 = 8, x1 = geom.size - 8;
        const line = (y, colour, width, dash) => {
          c2.save();
          c2.setLineDash(dash || []);
          c2.strokeStyle = colour;
          c2.lineWidth = width;
          c2.beginPath();
          c2.moveTo(x0, y);
          c2.lineTo(x1, y);
          c2.stroke();
          c2.restore();
        };
        line(my(MODEL_THIRDS.top), GUIDE, 1.4);
        line(my(MODEL_THIRDS.mid), GUIDE, 1.1, [3, 5]);
        line(my(MODEL_THIRDS.base), GUIDE, 1.7);
        line(my(MODEL_THIRDS.floor), GUIDE_FAINT, 1.1, [2, 6]);
        c2.save();
        c2.setLineDash([2, 5]);
        c2.strokeStyle = BOX_EDGE;
        c2.lineWidth = 1;
        c2.beginPath();
        c2.moveTo(geom.originX, my(-3)); c2.lineTo(geom.originX, my(103));
        c2.moveTo(geom.originX + geom.boxW, my(-3)); c2.lineTo(geom.originX + geom.boxW, my(103));
        c2.stroke();
        c2.restore();
      }

      // The model, in model space, however the browser can draw it: real
      // curves through Path2D, else the fine polyline sample.
      function strokeModel(scale, colour, widthPx) {
        c2.save();
        c2.translate(0, 0);
        c2.lineCap = "round";
        c2.lineJoin = "round";
        c2.strokeStyle = colour;
        c2.lineWidth = widthPx / scale;
        if (hasPaths) {
          modelPaths.forEach((p) => c2.stroke(p));
        } else {
          modelFine.forEach((pts) => {
            if (!pts || pts.length < 2) return;
            c2.beginPath();
            c2.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) c2.lineTo(pts[i].x, pts[i].y);
            c2.stroke();
          });
        }
        c2.restore();
      }

      // TRACE: the model as a light grey road to drive along.
      function drawModelGuide() {
        c2.save();
        c2.translate(geom.originX, geom.originY);
        c2.scale(geom.scale, geom.scale);
        strokeModel(geom.scale, MODEL_GREY, 9);
        c2.restore();
      }

      // ...plus a green pen-down dot and a direction arrow on the stroke
      // the child is expected to draw next.
      function drawStartCue() {
        const idx = Math.min(strokes.length, modelPts.length - 1);
        const pts = modelPts[idx];
        if (!pts || !pts.length) return;
        const p0 = toCanvas(pts[0]);
        c2.save();
        c2.beginPath();
        c2.fillStyle = START_GREEN;
        c2.arc(p0.x, p0.y, 7, 0, Math.PI * 2);
        c2.fill();
        c2.lineWidth = 2;
        c2.strokeStyle = "#fff";
        c2.stroke();
        c2.restore();
        // The arrow shows the FIRST thing the pencil does, so it sits a fixed
        // ~24px along the stroke: any further and a retracing letter (n, m, u)
        // would point back up the stem the child hasn't drawn yet.
        const lenPx = PH.pathLength(pts) * geom.scale;
        if (lenPx < 26) return;                              // a dot has no direction
        const frac = Math.max(0.06, Math.min(0.3, 24 / lenPx));
        const k = Math.max(1, Math.round((pts.length - 1) * frac));
        const a = toCanvas(pts[k]);
        const b = toCanvas(pts[Math.min(pts.length - 1, k + 2)]);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        c2.save();
        c2.translate(a.x, a.y);
        c2.rotate(ang);
        c2.beginPath();
        c2.moveTo(10, 0); c2.lineTo(-6, -6.5); c2.lineTo(-6, 6.5);
        c2.closePath();
        c2.fillStyle = START_GREEN;
        c2.fill();
        c2.restore();
      }

      // COPY: the model shrinks into the corner — look, then write it big.
      function drawMiniModel() {
        const w = typeof def.width === "number" ? def.width : 55;
        const free = geom.size - (geom.originX + geom.boxW);
        let ms = (Math.max(64, free) - 10) / (w + 12);
        ms = Math.max(0.36, Math.min(0.78, ms));
        const cardW = w * ms + 14, cardH = 100 * ms + 14;
        const x = geom.size - cardW - 6, y = 6;
        c2.save();
        c2.fillStyle = "#fbf7ee";
        c2.strokeStyle = "#d8cfbb";
        c2.lineWidth = 1;
        roundRect(x, y, cardW, cardH, 8);
        c2.fill();
        c2.stroke();
        const ox = x + 7, oy = y + 7;
        c2.strokeStyle = "#ddd3bd";
        c2.lineWidth = 1;
        [MODEL_THIRDS.top, MODEL_THIRDS.mid, MODEL_THIRDS.base].forEach((ly) => {
          c2.beginPath();
          c2.moveTo(x + 3, oy + ly * ms);
          c2.lineTo(x + cardW - 3, oy + ly * ms);
          c2.stroke();
        });
        c2.translate(ox, oy);
        c2.scale(ms, ms);
        strokeModel(ms, MINI_INK, 5.5);
        c2.restore();
      }

      function drawInk() {
        c2.save();
        c2.strokeStyle = INK;
        c2.fillStyle = INK;
        c2.lineWidth = 4.5;
        c2.lineCap = "round";
        c2.lineJoin = "round";
        strokes.forEach((s) => {
          if (!s.length) return;
          if (s.length === 1) {
            c2.beginPath();
            c2.arc(s[0].x, s[0].y, 2.4, 0, Math.PI * 2);
            c2.fill();
            return;
          }
          c2.beginPath();
          c2.moveTo(s[0].x, s[0].y);
          for (let i = 1; i < s.length; i++) c2.lineTo(s[i].x, s[i].y);
          c2.stroke();
        });
        c2.restore();
      }

      function drawGhost(g) {
        c2.save();
        c2.strokeStyle = "rgba(168,50,50,0.88)";
        c2.fillStyle = GHOST_RED;
        c2.lineWidth = 5;
        c2.lineCap = "round";
        c2.lineJoin = "round";
        for (let i = 0; i <= g.upto && i < g.strokes.length; i++) {
          const pts = g.strokes[i];
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
        if (!c2) return;
        c2.save();
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.clearRect(0, 0, canvas.width, canvas.height);
        c2.restore();
        c2.fillStyle = PAPER;
        c2.fillRect(0, 0, geom.size, geom.size);
        drawGuides();
        if (state.level === 0) { drawModelGuide(); drawStartCue(); }
        else if (state.level === 1) drawMiniModel();
        drawInk();
        if (ghost) drawGhost(ghost);
      }

      // ---- capture -----------------------------------------------------
      function pointFrom(e) {
        const r = canvas.getBoundingClientRect();
        const kx = r.width ? geom.size / r.width : 1;
        const ky = r.height ? geom.size / r.height : 1;
        return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
      }

      function onDown(e) {
        if (disposed || (e.button != null && e.button > 0)) return;
        e.preventDefault();
        if (checked) resetAttempt(true);       // a new go wipes the last score
        stopGhost();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
        activePointer = e.pointerId;
        drawing = true;
        const p = pointFrom(e);
        strokes.push([p]);
        if (!firstDownTs) firstDownTs = Date.now();
        redraw();
      }

      function onMove(e) {
        if (!drawing || disposed || e.pointerId !== activePointer) return;
        e.preventDefault();
        const cur = strokes[strokes.length - 1];
        if (!cur) return;
        const p = pointFrom(e);
        const last = cur[cur.length - 1];
        if (Math.abs(p.x - last.x) < 0.6 && Math.abs(p.y - last.y) < 0.6) return;
        cur.push(p);
        // live ink: just the new segment, no full repaint
        c2.save();
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
        redraw();       // repaint so the trace cue moves to the next stroke
      }

      function wireCanvas() {
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
      }

      // ---- ghost replay --------------------------------------------------
      function stopGhost() {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (ghost) { ghost = null; redraw(); }
      }

      function replayGhost() {
        stopGhost();
        const paths = modelFine.map((pts) => pts.map(toCanvas));
        if (!paths.length) return;
        ghost = { strokes: paths, upto: 0, frac: 0 };
        let t0 = (window.performance && performance.now) ? performance.now() : Date.now();
        const step = (now) => {
          if (disposed || !ghost) return;
          const frac = Math.min(1, (now - t0) / GHOST_MS);
          ghost.frac = frac;
          redraw();
          if (frac >= 1) {
            ghost.upto += 1;
            t0 = now;
            if (ghost.upto >= paths.length) { ghost = null; redraw(); return; }
          }
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }

      // ---- check ----------------------------------------------------------
      // The whole post-check panel back to a blank sheet.
      function clearScore() {
        const res = $('[data-role="result"]');
        if (res) { res.hidden = true; res.innerHTML = ""; delete res.dataset.band; delete res.dataset.total; }
        const after = $('[data-role="afterrow"]');
        if (after) after.hidden = true;
        const main = $('[data-role="mainrow"]');
        if (main) main.hidden = false;
        const next = $('[data-role="next"]');
        if (next) next.classList.remove("primary");
      }

      function resetAttempt(quiet) {
        stopGhost();
        strokes = [];
        firstDownTs = 0;
        lastUpTs = 0;
        checked = false;
        clearScore();
        if (!quiet) {
          const note = $('[data-role="note"]');
          if (note) { note.textContent = ""; note.className = "hw-note"; }
        }
        redraw();
      }

      function barLevel(v) { return v >= 85 ? "high" : (v >= PASS ? "mid" : "low"); }

      function renderResult(res) {
        const box = $('[data-role="result"]');
        if (!box) return;
        const band = BANDS[res.band] || BANDS["keep-practising"];
        const bars = FEATURES.map(([f, label]) => {
          const v = Math.round(res.features[f] || 0);
          return `<div class="hw-bar" data-feature="${f}" data-level="${barLevel(v)}" data-value="${v}">
              <span class="hw-bar-label">${esc(label)}</span>
              <span class="hw-bar-track"><span class="hw-bar-fill" style="width:${v}%"></span></span>
              <span class="hw-bar-num">${v}</span>
            </div>`;
        }).join("");
        const advice = (res.advice || []).slice(0, 3);
        box.dataset.band = res.band;
        box.dataset.total = String(res.total);
        box.innerHTML = `
          <div class="hw-band">
            <span class="hw-band-emoji">${band.emoji}</span>
            <span class="hw-band-text" data-role="band-text">${esc(band.text)}</span>
            <span class="hw-score" data-role="total">${res.total}<small>/100</small></span>
          </div>
          <div class="hw-bars">${bars}</div>
          ${advice.length ? `<ul class="hw-advice">${advice.map((a) =>
            `<li>${esc(a)}</li>`).join("")}</ul>` : ""}`;
        box.hidden = false;
      }

      function onCheck() {
        if (!strokes.length) { toast("Have a go first — write the letter on the lines."); return; }
        stopGhost();
        const attemptStrokes = strokes.map((s) => s.map(toModel));
        let res;
        try {
          res = PH.scoreAttempt({
            attemptStrokes,
            letterModel: def,
            thirds: MODEL_THIRDS,     // points are already in model space
            n: N,
          });
        } catch (err) {
          toast("Couldn't score that one — try again.");
          return;
        }
        checked = true;
        const dur = Math.max(0, (lastUpTs || Date.now()) - (firstDownTs || Date.now()));
        stats.attempts += 1;
        stats.letters[key] = true;
        const passed = res.total >= PASS;
        if (passed) stats.good += 1;

        try {
          Promise.resolve(ctx.tracker.record({
            key: "letter:" + key + "|" + STYLE_ID,
            correct: passed,
            latencyMs: dur,
            taskType: "t9",
            detail: { total: res.total, features: res.features },
          })).catch(() => { /* offline tracker hiccups never break practice */ });
        } catch (e) { /* ignore */ }

        renderResult(res);
        const main = $('[data-role="mainrow"]');
        if (main) main.hidden = true;
        const after = $('[data-role="afterrow"]');
        if (after) after.hidden = false;
        advanceLadder(passed, res);
      }

      // Two clean scores at a level -> step up the §6 ladder; a clean score at
      // the top of the ladder finishes the letter and the family moves on.
      function advanceLadder(passed, res) {
        const note = $('[data-role="note"]');
        const setNote = (cls, text) => {
          if (!note) return;
          note.className = "hw-note" + (cls ? " " + cls : "");
          note.textContent = text;
        };
        if (!passed) {
          setNote("warn", "Watch the ghost, then have another go.");
          return;
        }
        // A pass can still hide one badly failed feature (score.js gates such
        // an attempt at 79) — say so, or "Nice writing!" reads as a free pass.
        const weakest = FEATURES.map(([f, label]) => ({ label, v: (res && res.features[f]) || 0 }))
          .sort((a, b) => a.v - b.v)[0];
        const fix = weakest && weakest.v < 50
          ? " Check the red bar: " + weakest.label.toLowerCase() + "." : "";
        // Good enough to move on: the family's next letter becomes the
        // obvious button, whatever the ladder does next.
        const nextBtn = $('[data-role="next"]');
        if (nextBtn) nextBtn.classList.add("primary");
        state.hits[state.level] += 1;
        if (state.hits[state.level] < HITS_TO_STEP_UP) {
          setNote(fix ? "warn" : "", "One more like that and you'll move on." + fix);
          return;
        }
        if (state.level < LEVELS.length - 1) {
          const nextLevel = state.level + 1;
          setNote(fix ? "warn" : "", "Level up! Now try it " +
            (nextLevel === 1 ? "by copying the little letter." : "from memory.") + fix);
          later(alive(() => setLevel(nextLevel, true)), 900);
          return;
        }
        setNote(fix ? "warn" : "", "You can write " + key + " from memory. " +
          (queue.length > 1 ? "On to the next letter!" : "Pick another letter when you're ready.") + fix);
        if (queue.length > 1) later(alive(() => nextLetter()), 1400);
      }

      function setLevel(i, keepNote) {
        if (i < 0 || i >= LEVELS.length) return;
        state.level = i;
        root.dataset.level = LEVELS[i].id;
        strokes = [];
        firstDownTs = 0;
        lastUpTs = 0;
        checked = false;
        stopGhost();
        clearScore();
        const hint = $('[data-role="hint"]');
        if (hint) hint.textContent = LEVELS[i].hint;
        const say = $('[data-role="say"]');
        if (say) say.hidden = i !== 2;
        root.querySelectorAll('[data-role="level"]').forEach((b) => {
          b.setAttribute("aria-pressed", String(Number(b.dataset.level) === i));
        });
        if (!keepNote) {
          const note = $('[data-role="note"]');
          if (note) { note.textContent = ""; note.className = "hw-note"; }
        }
        redraw();
        if (i === 2) promptSpeak();
      }

      // From memory: the only cue is the spoken one.
      function promptSpeak() {
        speak(isDigit(key) ? "write the number " + key : "write the letter " + key);
      }

      function nextLetter() {
        if (queue.length <= 1) { renderPicker(); return; }
        const at = queue.indexOf(key);
        const nextKey = queue[(at + 1) % queue.length];
        if (!nextKey || nextKey === key) { renderPicker(); return; }
        openLetter(nextKey, queue, familyKey);
      }

      // ---- events -----------------------------------------------------
      function onClick(e) {
        if (disposed || screen !== "letter") return;
        const lvBtn = e.target.closest('[data-role="level"]');
        if (lvBtn) { setLevel(Number(lvBtn.dataset.level)); return; }
        if (e.target.closest('[data-role="back"]')) { renderPicker(); return; }
        if (e.target.closest('[data-role="check"]')) { onCheck(); return; }
        if (e.target.closest('[data-role="clear"]')) { resetAttempt(); return; }
        if (e.target.closest('[data-role="again"]')) { resetAttempt(); return; }
        if (e.target.closest('[data-role="ghost"]')) { replayGhost(); return; }
        if (e.target.closest('[data-role="say"]')) { promptSpeak(); return; }
        if (e.target.closest('[data-role="next"]')) { nextLetter(); return; }
      }

      let resizeTimer = 0;
      function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!dead && !disposed && screen === "letter") layout(false);
        }, 120);
      }

      html();
      root.addEventListener("click", onClick);
      window.addEventListener("resize", onResize);
      if (state.level === 2) promptSpeak();

      return {
        destroy() {
          dead = true;
          root.removeEventListener("click", onClick);
          window.removeEventListener("resize", onResize);
          clearTimeout(resizeTimer);
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          ghost = null;
        },
      };
    }

    // ---- picker events -------------------------------------------------
    function onPickerClick(e) {
      if (disposed || screen !== "pick") return;
      const fam = e.target.closest('[data-role="family"]');
      if (fam) {
        const fk = fam.dataset.family;
        const f = families[fk] || {};
        const order = (f.order && f.order.length ? f.order : f.letters || []).filter((k) => letters[k]);
        if (order.length) openLetter(order[0], order, fk);
        return;
      }
      const tile = e.target.closest('[data-role="letter"]');
      if (tile) {
        const k = tile.dataset.letter;
        openLetter(k, isDigit(k) ? digitKeys : alphaKeys, null);
        return;
      }
      if (e.target.closest('[data-role="finish"]')) { finish(); return; }
    }

    root.addEventListener("click", onPickerClick);
    renderPicker();

    return {
      destroy() {
        disposed = true;
        teardownLetter();
        root.removeEventListener("click", onPickerClick);
        for (const t of timers) clearTimeout(t);
        try { if (ctx && ctx.audio && ctx.audio.stop) ctx.audio.stop(); } catch (e) { /* ignore */ }
      },
    };
  }

  PhonicsTasks.register({
    id: "t9",
    title: "Handwriting",
    subtitle: "Trace, copy, remember",
    icon: "✍️",
    order: 50,
    unlockId: null,
    mount,
  });
})();
