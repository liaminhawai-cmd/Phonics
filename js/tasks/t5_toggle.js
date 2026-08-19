// ============================================================
// js/tasks/t5_toggle.js — T5: Grapheme Toggle (rule application).
//
// ARCHITECTURE.md §5 T5 / §6 L2 "toggle": the word's boxes are
// given; only the rule's target box is live — a big button that
// cycles through the target spelling and its distractors from
// rules.json toggle_sets. Screen 1 picks a rule (or "Surprise
// me", weighted towards the weakest "rule:<id>" mastery);
// screen 2 runs every toggle item of that rule, shuffled.
//
// Per item: ctx.tracker.record({key:"rule:"+rule.id,
// correct:firstTry, taskType:"t5"}); a wrong Check gets the §7
// classifyBox feedback line and one retry, then the reveal.
// ============================================================

window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

(function () {
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
  // fixed 60px boxes suit 1-2 letters; longer chunks get to breathe
  const boxStyle = (text) =>
    text.length > 2 ? ' style="width:auto;min-width:60px;padding:4px 10px"' : "";

  async function mount(container, ctx) {
    const bank = ctx.bank;
    let disposed = false;
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(() => { if (!disposed) fn(); }, ms); timers.push(t); };

    const root = document.createElement("div");
    root.className = "t5";
    container.appendChild(root);

    // Rules that actually have playable toggle items in this bank.
    const allRules = (ctx.rules && Array.isArray(ctx.rules.rules)) ? ctx.rules.rules : [];
    const playable = allRules
      .map((r) => ({
        rule: r,
        items: (r.toggle_sets || []).filter((t) => t && t.word && bank.gpc(t.target_gpc)),
      }))
      .filter((x) => x.items.length >= 1);

    if (!playable.length) {
      root.innerHTML = `<div class="pt-feedback warn">No spelling-rule games are ready yet — try another activity!</div>`;
      return { destroy() { disposed = true; } };
    }

    // Word bank lookup for real segmentations (string-split fallback otherwise).
    let wordsById = {};
    try {
      const words = await bank.loadWords();
      for (const w of words) { wordsById[w.id] = w; if (w.word) wordsById[w.word] = wordsById[w.word] || w; }
    } catch (e) { wordsById = {}; }
    if (disposed) return { destroy() { disposed = true; } };

    const $ = (sel) => root.querySelector(sel);
    const feedback = (cls, msg) => {
      const el = $('[data-role="feedback"]');
      if (el) { el.className = "pt-feedback " + cls; el.textContent = msg; }
    };

    function record(rule, correct, latencyMs, word) {
      try {
        Promise.resolve(ctx.tracker.record({
          key: "rule:" + rule.id, correct, latencyMs, taskType: "t5",
          detail: { word: word, rule: rule.id },
        })).catch(() => { /* tracker hiccups never break play */ });
      } catch (e) { /* ignore */ }
    }

    // ---- screen 1: rule picker --------------------------------------
    function renderPicker() {
      root.innerHTML = `
        <div class="pt-prompt">Which spelling rule shall we practise?</div>
        <button type="button" class="pt-primary" data-role="surprise">🎲 Surprise me</button>
        <div class="task-grid" style="margin-top:14px">
          ${playable.map((x, i) => `
            <button type="button" class="task-card" data-role="rule" data-i="${i}" data-rule-id="${escapeHtml(x.rule.id)}">
              <span class="task-icon">🔁</span>
              <span class="task-meta">
                <span class="task-title">${escapeHtml(x.rule.name || x.rule.id)}</span>
                <span class="task-sub">${escapeHtml(preview(x.rule.statement_kid || ""))}</span>
              </span>
            </button>`).join("")}
        </div>`;
    }

    function preview(s) {
      s = String(s);
      return s.length > 96 ? s.slice(0, 93).replace(/\s+\S*$/, "") + "…" : s;
    }

    // "Surprise me": pick weighted towards the weakest rule:<id> mastery —
    // fresh rules count as weakest of all.
    async function surprise() {
      let m = {};
      try { m = (await ctx.tracker.mastery()) || {}; } catch (e) { m = {}; }
      const weights = playable.map((x) => {
        const rec = m["rule:" + x.rule.id];
        const s = rec && typeof rec.strength === "number" ? rec.strength : 0;
        return Math.max(0.05, 1.05 - s);
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let t = Math.random() * total;
      for (let i = 0; i < playable.length; i++) {
        t -= weights[i];
        if (t <= 0) return startRound(i);
      }
      startRound(playable.length - 1);
    }

    // ---- screen 2: the round ------------------------------------------
    let round = null; // { rule, items, idx, right, tries, recorded, itemStart, opts, optIdx, target, seg, boxIndex, boxTotal, wordEntry }

    function startRound(i) {
      const chosen = playable[i];
      round = {
        rule: chosen.rule,
        items: shuffle(chosen.items),
        idx: 0, right: 0,
        sounds: new Set(),
      };
      startItem();
    }

    function startItem() {
      const r = round;
      const item = r.items[r.idx];
      const target = bank.gpc(item.target_gpc);
      const targetG = target.grapheme;

      // Options: target + distractors, deduped by what the child would SEE
      // (c.k and c.s both look like "c" — one button is enough).
      const seen = new Set([targetG]);
      const opts = [{ id: target.id, g: targetG, label: displayG(target.display || targetG) }];
      for (const did of item.distractors || []) {
        const d = bank.gpc(did);
        const g = d ? d.grapheme : String(did).split(".")[0]; // strip ".phoneme" if unknown
        if (!g || seen.has(g)) continue;
        seen.add(g);
        opts.push({ id: d ? d.id : did, g, label: displayG(d && d.display ? d.display : g) });
      }
      r.opts = shuffle(opts);
      // don't hand over the answer on a plate: start on a distractor when we have one
      if (r.opts.length > 1 && r.opts[0].g === targetG) {
        const k = 1 + Math.floor(Math.random() * (r.opts.length - 1));
        [r.opts[0], r.opts[k]] = [r.opts[k], r.opts[0]];
      }
      r.optIdx = 0;
      r.tries = 0;
      r.recorded = false;
      r.done = false;
      r.itemStart = Date.now();
      r.target = target;
      r.targetG = targetG;
      r.wordEntry = wordsById[item.word] || null;
      try { r.sounds.add(bank.phonemeLabel(firstPhoneme(target.phonemes))); } catch (e) { /* ignore */ }

      // Build the boxes: real bank segmentation when we have it...
      let cells = null;
      if (r.wordEntry) {
        const segs = bank.segmentsFor(r.wordEntry);
        const ids = bank.wordGPCs(r.wordEntry);
        let ti = ids.indexOf(item.target_gpc);
        if (ti < 0) {
          ti = segs.findIndex((s) => s.g === targetG && normP(s.p) === normP(target.phonemes));
        }
        if (ti >= 0) {
          cells = segs.map((s, k) => ({ text: displayG(s.g), live: k === ti }));
          r.seg = { g: targetG, p: target.phonemes };
          r.boxIndex = ti;
          r.boxTotal = segs.length;
        }
      }
      // ...else isolate the target grapheme by string split.
      if (!cells) {
        const word = item.word;
        let at = word.indexOf(targetG);
        if (at < 0) at = word.length; // shouldn't happen; park the slot at the end
        const pre = word.slice(0, at);
        const post = word.slice(at + targetG.length);
        cells = [];
        if (pre) cells.push({ text: pre, live: false });
        cells.push({ text: displayG(targetG), live: true });
        if (post) cells.push({ text: post, live: false });
        r.seg = { g: targetG, p: target.phonemes };
        r.boxIndex = pre ? 1 : 0;
        r.boxTotal = cells.length;
      }

      root.dataset.word = item.word;
      root.dataset.rule = r.rule.id;
      root.innerHTML = `
        <div class="pt-progress">${escapeHtml(r.rule.name || r.rule.id)} · word ${r.idx + 1} of ${r.items.length}</div>
        <button type="button" class="pt-bigplay" data-role="play" aria-label="Play the word">🔊</button>
        <div class="pt-prompt">Tap the red box until the spelling looks right, then Check.</div>
        <div class="pt-elk-row" data-role="boxes">
          ${cells.map((c) => c.live
            ? `<button type="button" class="pt-elk-box sel" data-role="toggle"
                 style="width:auto;min-width:60px;padding:4px 12px"
                 aria-label="Swap the spelling"></button>`
            : `<div class="pt-elk-box"${boxStyle(c.text)}>${escapeHtml(c.text)}</div>`).join("")}
        </div>
        <button type="button" class="pt-primary" data-role="check">Check</button>
        <div class="pt-feedback" data-role="feedback"></div>
        <button type="button" class="pt-primary" data-role="next" style="display:none">
          ${r.idx + 1 < r.items.length ? "Next word" : "Finish"}</button>`;
      paintToggle();
      playCurrentWord();
    }

    function playCurrentWord() {
      const item = round.items[round.idx];
      try { ctx.audio.playWord(round.wordEntry || item.word); } catch (e) { /* ignore */ }
    }

    function paintToggle() {
      const btn = $('[data-role="toggle"]');
      if (btn) btn.textContent = round.opts[round.optIdx].label;
    }

    function onToggle() {
      const r = round;
      if (!r || r.done) return;
      r.optIdx = (r.optIdx + 1) % r.opts.length;
      paintToggle();
      feedback("", "");
    }

    // Same amber-vs-red split as T4: a legal-but-wrong or position/heart
    // mistake is a near-miss (amber), not a flat wrong answer (red).
    const AMBER = new Set(["SUB-GRAPH-LEGAL", "POS-ILLEGAL", "HEART"]);

    function onCheck() {
      const r = round;
      if (!r || r.done) return;
      const item = r.items[r.idx];
      const tried = r.opts[r.optIdx].g;
      const correct = tried === r.targetG;
      if (!r.recorded) {                 // score the FIRST answer only
        r.recorded = true;
        if (correct) r.right += 1;
        record(r.rule, correct, Date.now() - r.itemStart, item.word);
      }
      const btn = $('[data-role="toggle"]');
      if (correct) {
        r.done = true;
        if (btn) { btn.classList.remove("sel", "bad"); btn.classList.add("good"); }
        feedback("good", "Yes! " + (r.rule.statement_kid || "That's the rule."));
        playCurrentWord();
        showNext();
        return;
      }
      r.tries += 1;
      if (btn) {
        btn.classList.add("bad");
        later(() => { if (btn.isConnected) btn.classList.remove("bad"); }, 500);
      }
      if (r.tries >= 2) {
        // retry spent — reveal the right spelling and say the rule
        r.done = true;
        r.optIdx = r.opts.findIndex((o) => o.g === r.targetG);
        if (r.optIdx < 0) r.optIdx = 0;
        paintToggle();
        if (btn) { btn.classList.remove("sel", "bad"); btn.classList.add("warn"); }
        feedback("warn", "It's " + displayG(r.targetG) + " — " + (r.rule.statement_kid || ""));
        playCurrentWord();
        showNext();
        return;
      }
      // one retry left: a §7-shaped hint about what the tried spelling does
      let line = "Not this one — try another spelling.";
      let cls = "bad";
      try {
        const res = ctx.errors.classifyBox({
          target: r.seg, tried, index: r.boxIndex, total: r.boxTotal,
          bank, rulesIdx: ctx.rulesIdx,
          heartParts: (r.wordEntry && r.wordEntry.heart_parts) || [],
        });
        line = ctx.errors.feedbackFor(res, { phonemeLabel: bank.phonemeLabel }) + " Try another spelling.";
        if (AMBER.has(res.code)) cls = "warn";
      } catch (e) { /* keep the generic line */ }
      feedback(cls, line);
      playCurrentWord();
    }

    function showNext() {
      const check = $('[data-role="check"]');
      if (check) check.style.display = "none";
      later(() => {
        const nb = $('[data-role="next"]');
        if (nb) nb.style.display = "";
      }, 450);
    }

    function onNext() {
      const r = round;
      r.idx += 1;
      if (r.idx < r.items.length) { startItem(); return; }
      ctx.exit({
        summary: {
          title: r.rule.name || "Grapheme Toggle",
          correct: r.right,
          total: r.items.length,
          note: r.rule.statement_kid || "",
          sounds: Array.from(r.sounds).slice(0, 14),
        },
      });
    }

    root.addEventListener("click", async (e) => {
      if (disposed) return;
      const ruleBtn = e.target.closest('[data-role="rule"]');
      if (ruleBtn) { startRound(parseInt(ruleBtn.dataset.i, 10)); return; }
      if (e.target.closest('[data-role="surprise"]')) { await surprise(); return; }
      if (e.target.closest('[data-role="play"]')) { playCurrentWord(); return; }
      if (e.target.closest('[data-role="toggle"]')) { onToggle(); return; }
      if (e.target.closest('[data-role="check"]')) { onCheck(); return; }
      if (e.target.closest('[data-role="next"]')) { onNext(); return; }
    });

    renderPicker();

    return {
      destroy() {
        disposed = true;
        for (const t of timers) clearTimeout(t);
        try { ctx.audio.stop(); } catch (e) { /* ignore */ }
      },
    };
  }

  PhonicsTasks.register({
    id: "t5",
    title: "Grapheme Toggle",
    subtitle: "Pick the spelling the rule asks for — swap until it looks right",
    icon: "🔁",
    order: 30,
    unlockId: "t5",
    mount,
  });
})();
