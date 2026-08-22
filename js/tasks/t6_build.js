// ============================================================
// js/tasks/t6_build.js — T6: Build-a-Word (drag/tap tray).
//
// ARCHITECTURE.md §5 T6 / §6 L3 "tray": hear a word, build it
// from grapheme tiles. Scaffold A (≥8 encode-mastered GPCs):
// words filtered to the learner's mastered set; scaffold B:
// anything decodable in the whole taught sequence. The tray
// holds the word's own graphemes plus 4-6 distractors — other
// spellings of the same phonemes first, then random known
// graphemes.
//
// Tap a tile to fill the next empty slot (or a slot you tapped
// first); tap a filled slot to send its tile back. Tiles also
// drag via pointer events, but tap always works. Check runs the
// §7 classifyWord taxonomy: colour the slots, say the feedback
// line, one retry, then reveal + segmented replay. Each slot
// records "<gpcId>|encode" (T4 semantics: first Check scores).
// ============================================================

window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

(function () {
  const ROUND = 6;
  const MIN_SEGS = 2, MAX_SEGS = 6, PREF_MAX_SEGS = 5;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  const normP = (p) => (Array.isArray(p) ? p.join("+") : String(p));
  const firstPhoneme = (p) => (Array.isArray(p) ? p[0] : p);
  const displayG = (g) => String(g).replace(/_/g, "-");
  // slot width hints at the grapheme length hiding inside it
  const slotWidth = (len) => Math.max(58, Math.min(126, 44 + 15 * len));

  async function pickWords(bank, mastered) {
    const scaffoldA = mastered && mastered.size >= 8;
    let pool = [];
    try {
      pool = scaffoldA
        ? await bank.decodableWords({ gpcSet: mastered })
        : await bank.decodableWords({ uptoUnit: null });
    } catch (e) { pool = []; }
    // scaffold A can be thin early on — top up from the whole sequence
    if (scaffoldA && pool.length < ROUND) {
      try {
        const extra = await bank.decodableWords({ uptoUnit: null });
        const have = new Set(pool.map((w) => w.id));
        pool = pool.concat(extra.filter((w) => !have.has(w.id)));
      } catch (e) { /* ignore */ }
    }
    const usable = pool.filter((w) => {
      const n = bank.segmentsFor(w).length;
      return n >= MIN_SEGS && n <= MAX_SEGS && bank.wordGPCs(w).every(Boolean);
    });
    const preferred = shuffle(usable.filter((w) => bank.segmentsFor(w).length <= PREF_MAX_SEGS));
    const longer = shuffle(usable.filter((w) => bank.segmentsFor(w).length > PREF_MAX_SEGS));
    return { words: preferred.concat(longer).slice(0, ROUND), scaffoldA };
  }

  // Tray distractors: other spellings of the word's phonemes first, then
  // random known graphemes; 4-6 of them, never duplicating a needed tile.
  function pickDistractors(bank, segs, mastered, scaffoldA) {
    let taught = [];
    try { taught = bank.taughtGPCs(null).map((t) => t.gpc); } catch (e) { taught = []; }
    let cands = taught;
    if (scaffoldA && mastered && mastered.size) {
      const m = taught.filter((g) => mastered.has(g.id));
      if (m.length >= 6) cands = m;    // stay in the mastered set when it's rich enough
    }
    const wordGs = new Set(segs.map((s) => s.g));
    const segKeys = new Set(segs.map((s) => normP(s.p)));
    const alternates = [], randoms = [];
    const seen = new Set();
    for (const g of shuffle(cands)) {
      if (wordGs.has(g.grapheme) || seen.has(g.grapheme)) continue;
      seen.add(g.grapheme);
      (segKeys.has(normP(g.phonemes)) ? alternates : randoms).push(g.grapheme);
    }
    const want = 4 + Math.floor(Math.random() * 3);   // 4-6
    return alternates.slice(0, want)
      .concat(randoms.slice(0, Math.max(0, want - alternates.length)));
  }

  async function mount(container, ctx) {
    const bank = ctx.bank;
    let disposed = false;
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(() => { if (!disposed) fn(); }, ms); timers.push(t); };

    const root = document.createElement("div");
    root.className = "t6";
    container.appendChild(root);

    let mastered = new Set();
    try { mastered = (await ctx.tracker.knownGpcSet("encode")) || new Set(); } catch (e) { mastered = new Set(); }
    const { words, scaffoldA } = await pickWords(bank, mastered);
    if (disposed) return { destroy() { disposed = true; } };
    if (!words.length) {
      root.innerHTML = `<div class="pt-feedback warn">No building words are ready yet — try another activity!</div>`;
      return { destroy() { disposed = true; } };
    }

    const $ = (sel) => root.querySelector(sel);
    const feedback = (cls, msg) => {
      const el = $('[data-role="feedback"]');
      if (el) { el.className = "pt-feedback " + cls; el.textContent = msg; }
    };

    function record(key, correct, latencyMs, word) {
      try {
        Promise.resolve(ctx.tracker.record({
          key, correct, latencyMs, taskType: "t6", detail: { word: word.id },
        })).catch(() => { /* tracker hiccups never break play */ });
      } catch (e) { /* ignore */ }
    }

    // round stats
    let idx = 0;
    let wordsRight = 0;
    const soundLabels = new Set();

    // ---- per-word state ----
    let w, segs, gpcIds, tiles, slots, selectedSlot, checks, phase, wordStart;
    // tiles: [{g, used}]  slots: [tileIndex|null]  phase: play|reveal|done

    function startWord() {
      w = words[idx];
      segs = bank.segmentsFor(w);
      gpcIds = bank.wordGPCs(w);
      for (const s of segs) {
        try { soundLabels.add(bank.phonemeLabel(firstPhoneme(s.p))); } catch (e) { /* ignore */ }
      }
      const distractors = pickDistractors(bank, segs, mastered, scaffoldA);
      tiles = shuffle(segs.map((s) => s.g).concat(distractors)).map((g) => ({ g, used: false }));
      slots = segs.map(() => null);
      selectedSlot = null;
      checks = 0;
      phase = "play";
      wordStart = Date.now();

      root.dataset.word = w.id;
      root.dataset.phase = phase;
      root.innerHTML = `
        <div class="pt-progress">Word ${idx + 1} of ${words.length}</div>
        <button type="button" class="pt-bigplay" data-role="play" aria-label="Play the word">🔊</button>
        <div class="pt-prompt">Build the word you hear — tap a tile for each box.</div>
        <div class="pt-elk-row" data-role="slots">
          ${segs.map((s, i) => `
            <button type="button" class="pt-elk-box" data-slot="${i}"
              style="width:${slotWidth(s.g.length)}px"
              aria-label="Box ${i + 1} of ${segs.length}"></button>`).join("")}
        </div>
        <div class="pt-chip-row" data-role="tray">
          ${tiles.map((t, j) => `
            <button type="button" class="pt-chip" data-tile="${j}" data-g="${escapeHtml(t.g)}"
              style="touch-action:none">${escapeHtml(displayG(t.g))}</button>`).join("")}
        </div>
        <div class="pt-counter">
          <button type="button" class="pt-reset" data-role="clear">↺ start again</button>
        </div>
        <button type="button" class="pt-primary" data-role="check">Check</button>
        <div class="pt-feedback" data-role="feedback"></div>
        <button type="button" class="pt-primary" data-role="next" style="display:none">
          ${idx + 1 < words.length ? "Next word" : "Finish"}</button>`;
      sync();
      try { ctx.audio.playWord(w); } catch (e) { /* ignore */ }
    }

    // Repaint slots + tray from state (play phase only clears colours).
    function sync() {
      root.querySelectorAll("[data-slot]").forEach((el) => {
        const i = parseInt(el.dataset.slot, 10);
        el.textContent = slots[i] != null ? displayG(tiles[slots[i]].g) : "";
        if (phase === "play") el.className = "pt-elk-box" + (selectedSlot === i ? " sel" : "");
      });
      root.querySelectorAll("[data-tile]").forEach((el) => {
        const j = parseInt(el.dataset.tile, 10);
        const used = tiles[j].used;
        el.style.visibility = used ? "hidden" : "visible";
        if (used) el.setAttribute("data-used", "1"); else el.removeAttribute("data-used");
        el.disabled = used || phase !== "play";
      });
    }

    function placeTile(j, slotIdx) {
      if (tiles[j].used) return;
      let i = slotIdx;
      if (i == null || slots[i] != null) {
        i = selectedSlot != null && slots[selectedSlot] == null ? selectedSlot : slots.indexOf(null);
      }
      if (i < 0 || i == null) { ctx.toast("All the boxes are full — tap a box to put a tile back."); return; }
      slots[i] = j;
      tiles[j].used = true;
      selectedSlot = null;
      feedback("", "");
      sync();
    }

    function onSlotTap(i) {
      if (phase !== "play") return;
      if (slots[i] != null) {           // return the tile to the tray
        tiles[slots[i]].used = false;
        slots[i] = null;
        selectedSlot = null;
        feedback("", "");
      } else {
        selectedSlot = selectedSlot === i ? null : i;
      }
      sync();
    }

    function onClear() {
      if (phase !== "play") return;
      slots = slots.map(() => null);
      for (const t of tiles) t.used = false;
      selectedSlot = null;
      feedback("", "");
      sync();
    }

    // ---- Check: §7 classifyWord over the slot graphemes ----------------
    function onCheck() {
      if (phase !== "play") return;
      if (slots.some((s) => s == null)) { ctx.toast("Fill every box first!"); return; }
      const answers = slots.map((j) => tiles[j].g);
      let results = [];
      try {
        results = ctx.errors.classifyWord({
          segments: segs, answers, bank, rulesIdx: ctx.rulesIdx,
          heartParts: w.heart_parts || [],
        });
      } catch (e) {
        results = segs.map((s, i) => ({ boxIndex: i, code: answers[i] === s.g ? "CORRECT" : "SUB-GRAPH-OTHER" }));
      }
      const boxes = results.filter((r) => r.boxIndex != null);
      const firstCheck = checks === 0;
      checks += 1;

      if (firstCheck) {                 // T4 semantics: first Check scores every slot
        const latency = Date.now() - wordStart;
        boxes.forEach((r) => {
          if (gpcIds[r.boxIndex]) {
            record(gpcIds[r.boxIndex] + "|encode", r.code === "CORRECT", latency, w);
          }
          // §7: a legal-but-wrong spelling choice also debits the deciding rule
          if (r.code === "SUB-GRAPH-LEGAL" && r.ruleId) {
            record("rule:" + r.ruleId, false, latency, w);
          }
        });
      }

      const wrong = boxes.filter((r) => r.code !== "CORRECT");
      boxes.forEach((r) => {
        const el = root.querySelector(`[data-slot="${r.boxIndex}"]`);
        if (el) el.classList.add(r.code === "CORRECT" ? "good" : "bad");
      });

      if (!wrong.length) {
        if (firstCheck) wordsRight += 1;
        phase = "done";
        root.dataset.phase = phase;
        feedback("good", "Yes — that spells " + w.word + "!");
        try { ctx.audio.playWord(w); } catch (e) { /* ignore */ }
        showNext();
        sync();
        return;
      }

      let line = "";
      try {
        line = ctx.errors.feedbackFor(wrong[0], { phonemeLabel: bank.phonemeLabel });
      } catch (e) { line = "Not quite — listen again."; }
      if (wrong.length > 1) line += " (" + wrong.length + " boxes to fix)";

      if (checks >= 2) { reveal(wrong, line); return; }

      // one retry: wrong tiles float back to the tray, right ones stay put
      feedback("bad", line + " Have another go!");
      try { ctx.audio.playWord(w); } catch (e) { /* ignore */ }
      later(() => {
        if (phase !== "play") return;
        for (const r of wrong) {
          const j = slots[r.boxIndex];
          if (j != null) { tiles[j].used = false; slots[r.boxIndex] = null; }
        }
        sync();
        // keep the green on the boxes that were right
        boxes.forEach((r) => {
          if (r.code === "CORRECT") {
            const el = root.querySelector(`[data-slot="${r.boxIndex}"]`);
            if (el) el.classList.add("good");
          }
        });
      }, 950);
    }

    // Reveal + segmented replay: boxes fill with the real graphemes while
    // each sound plays in turn, then the whole word (§6 L0 model).
    function reveal(wrong, line) {
      phase = "reveal";
      root.dataset.phase = phase;
      feedback("warn", line + " Watch how it's built:");
      const wrongIdx = new Set(wrong.map((r) => r.boxIndex));
      segs.forEach((s, i) => {
        const el = root.querySelector(`[data-slot="${i}"]`);
        if (!el) return;
        el.className = "pt-elk-box " + (wrongIdx.has(i) ? "warn" : "good");
        el.textContent = "";
      });
      root.querySelectorAll("[data-tile]").forEach((el) => { el.disabled = true; });
      const STEP = 700;
      segs.forEach((s, i) => {
        later(() => {
          const el = root.querySelector(`[data-slot="${i}"]`);
          if (!el) return;
          el.textContent = displayG(s.g);
          el.classList.add("lit");
          later(() => el.classList.remove("lit"), STEP - 80);
          try { if (gpcIds[i]) ctx.audio.playGpc(gpcIds[i]); } catch (e) { /* ignore */ }
        }, STEP * i);
      });
      later(() => {
        try { ctx.audio.playWord(w); } catch (e) { /* ignore */ }
        // rule-shaped miss? offer the 60-second micro-lesson before moving on
        const ruled = wrong.find((r) => r.ruleId);
        if (ruled && typeof ctx.showRuleLesson === "function") {
          Promise.resolve(ctx.showRuleLesson(ruled.ruleId)).catch(() => { /* ignore */ }).then(() => {
            if (!disposed) showNext();
          });
        } else {
          showNext();
        }
      }, STEP * segs.length + 250);
    }

    function showNext() {
      if (phase !== "done") { phase = "done"; root.dataset.phase = phase; }
      const check = $('[data-role="check"]');
      if (check) check.style.display = "none";
      const clear = $('[data-role="clear"]');
      if (clear) clear.disabled = true;
      const nb = $('[data-role="next"]');
      if (nb) nb.style.display = "";
    }

    function onNext() {
      idx += 1;
      if (idx < words.length) { startWord(); return; }
      ctx.exit({
        summary: {
          title: "Build-a-Word",
          correct: wordsRight,
          total: words.length,
          note: wordsRight + " of " + words.length + " words built right first go" +
                (scaffoldA ? " (your own sound set!)" : ""),
          sounds: Array.from(soundLabels).slice(0, 14),
        },
      });
    }

    // ---- tap wiring ----------------------------------------------------
    let suppressClick = false;          // set after a real drag-drop
    root.addEventListener("click", (e) => {
      if (disposed) return;
      if (suppressClick) { suppressClick = false; return; }
      if (e.target.closest('[data-role="play"]')) {
        try { ctx.audio.playWord(w); } catch (err) { /* ignore */ }
        return;
      }
      const tile = e.target.closest("[data-tile]");
      if (tile && phase === "play") { placeTile(parseInt(tile.dataset.tile, 10), null); return; }
      const slot = e.target.closest("[data-slot]");
      if (slot) { onSlotTap(parseInt(slot.dataset.slot, 10)); return; }
      if (e.target.closest('[data-role="clear"]')) { onClear(); return; }
      if (e.target.closest('[data-role="check"]')) { onCheck(); return; }
      if (e.target.closest('[data-role="next"]')) { onNext(); return; }
    });

    // ---- drag support (pointer events; tap keeps working without it) ---
    let drag = null;                    // {j, el, id, x, y, moved, ghost}
    function killGhost() {
      if (drag && drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
    }
    root.addEventListener("pointerdown", (e) => {
      if (disposed || phase !== "play") return;
      const el = e.target.closest("[data-tile]");
      if (!el || el.disabled) return;
      drag = { j: parseInt(el.dataset.tile, 10), el, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, ghost: null };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* fine without capture */ }
    });
    root.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (dx * dx + dy * dy < 64) return;      // 8px slop before it's a drag
        drag.moved = true;
        const ghost = document.createElement("div");
        ghost.className = "pt-chip";
        ghost.textContent = drag.el.textContent;
        ghost.style.cssText = "position:fixed;z-index:70;pointer-events:none;opacity:0.85;transform:translate(-50%,-50%);margin:0;";
        document.body.appendChild(ghost);
        drag.ghost = ghost;
        drag.el.style.opacity = "0.35";
      }
      drag.ghost.style.left = e.clientX + "px";
      drag.ghost.style.top = e.clientY + "px";
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      killGhost();
      d.el.style.opacity = "";
      drag = null;
      if (!d.moved || e.type === "pointercancel") return;   // plain tap → click handles it
      // The gesture's own synthetic click (if any) fires synchronously after
      // pointerup — suppress that one only, never a later real tap.
      suppressClick = true;
      later(() => { suppressClick = false; }, 0);
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = under && under.closest ? under.closest("[data-slot]") : null;
      if (slotEl) {
        const i = parseInt(slotEl.dataset.slot, 10);
        if (slots[i] == null) placeTile(d.j, i);
      }
    };
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);

    startWord();

    return {
      destroy() {
        disposed = true;
        for (const t of timers) clearTimeout(t);
        killGhost();
        try { ctx.audio.stop(); } catch (e) { /* ignore */ }
      },
    };
  }

  PhonicsTasks.register({
    id: "t6",
    title: "Build-a-Word",
    subtitle: "Drag or tap grapheme tiles to build the word you hear",
    icon: "🧱",
    order: 40,
    unlockId: "t6",
    mount,
  });
})();
