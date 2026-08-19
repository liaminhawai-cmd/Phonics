// ============================================================
// js/tasks/t4_listen_write.js — T4: Listen & Write (spelling).
//
// The flagship of ARCHITECTURE.md §5: hear a word, one Elkonin
// box per phoneme (scaffold L1-L2 of §6 — boxes are given), pick
// the best-guess grapheme per box from choice chips (or type it),
// then get per-box feedback from the §7 error taxonomy:
//   CORRECT          green
//   SUB-GRAPH-LEGAL  amber — right phoneme, legal spelling, wrong
//                    choice for this word -> rule micro-lesson
//                    after the word when a rule decides it
//   SUB-GRAPH-OTHER  red — that grapheme spells a different sound
//   REV              red — the flip-around letter
// Every box is one encode attempt on its GPC ("<gpcId>|encode");
// legal-substitution errors also debit the deciding rule.
// ============================================================

window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

(function () {
  const ROUND = 6;

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

  const firstPhoneme = (p) => (Array.isArray(p) ? p[0] : p);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // Mastery key for a segment, per the tracker contract:
  // "<g>.<phonemes joined, underscores dropped>|encode"
  function gpcKeyOf(seg) {
    return seg.g + "." + (Array.isArray(seg.p) ? seg.p.join("").replace(/_/g, "") : seg.p);
  }

  // ---- word choice ------------------------------------------------
  // Words the learner can attempt: their encode-mastered set when it's
  // big enough to be interesting, else everything the bank can segment.
  // HARD RULE: skip any word with a segment the bank has no GPC for.
  async function pickWords(bank, tracker) {
    let knownSet = null;
    try { knownSet = await tracker.knownGpcSet("encode"); } catch (e) { knownSet = new Set(); }
    let pool = (knownSet && knownSet.size >= 8)
      ? await bank.decodableWords({ gpcSet: knownSet })
      : await bank.decodableWords({ uptoUnit: null });
    pool = pool.filter((w) => {
      const segs = bank.segmentsFor(w);
      return segs.length >= 2 && segs.length <= 5 && bank.wordGPCs(w).every(Boolean);
    });
    // mix lengths: bucket by box count; prefer tier 1 inside each bucket
    // (shuffle first, then a stable sort by tier keeps tier-1 words on
    // top in random order)
    const buckets = new Map();
    for (const w of shuffle(pool)) {
      const n = bank.segmentsFor(w).length;
      if (!buckets.has(n)) buckets.set(n, []);
      buckets.get(n).push(w);
    }
    for (const list of buckets.values()) list.sort((a, b) => (a.tier || 9) - (b.tier || 9));
    const lengths = Array.from(buckets.keys()).sort((a, b) => a - b);
    const picks = [];
    let li = 0;
    while (picks.length < ROUND && lengths.length) {
      const list = buckets.get(lengths[li % lengths.length]);
      li += 1;
      if (list && list.length) picks.push(list.shift());
      if (li > 40) break;
    }
    return shuffle(picks).slice(0, ROUND);
  }

  async function mount(container, ctx) {
    const bank = ctx.bank;
    let disposed = false;

    const words = await pickWords(bank, ctx.tracker);
    if (disposed) return;
    if (!words.length) {
      container.innerHTML = `<div class="pt-feedback warn">No spelling words are ready yet — try another activity!</div>`;
      return { destroy() { disposed = true; } };
    }

    // ---- distractor space: every taught spelling of every phoneme ----
    const rows = bank.phonemeView();          // full active-sequence view
    const rowByGpcId = {};
    const rowByPhonemeKey = {};
    const padPool = [];
    for (const row of rows) {
      rowByPhonemeKey[row.phoneme] = row;
      for (const sp of row.spellings) {
        rowByGpcId[sp.gpc.id] = row;
        padPool.push(sp.gpc);
      }
    }

    function confusableFor(seg, seen) {
      const targ = String(firstPhoneme(seg.p));
      for (const pair of ctx.errors.CONFUSABLE) {
        const partner = pair[0] === targ ? pair[1] : (pair[1] === targ ? pair[0] : null);
        if (!partner) continue;
        const row = rowByPhonemeKey[partner];
        if (!row) continue;
        for (const sp of row.spellings) {
          if (!seen.has(sp.gpc.grapheme)) return sp.gpc;
        }
      }
      return null;
    }

    // target + up to 3 distractors: other legal spellings of the same
    // phoneme, plus one confusable-phoneme grapheme; padded with a
    // random spelling if the phoneme has no alternatives.
    function chipsFor(seg, gpcId) {
      const target = bank.gpc(gpcId);
      const chips = [{ gpc: target, kind: "target" }];
      const seen = new Set([target.grapheme]);
      const row = rowByGpcId[gpcId];
      const conf = confusableFor(seg, seen);
      const sameMax = conf ? 2 : 3;
      const same = shuffle((row ? row.spellings.map((s) => s.gpc) : [])
        .filter((g) => g.id !== gpcId && !seen.has(g.grapheme)));
      for (const g of same) {
        if (chips.length - 1 >= sameMax) break;
        chips.push({ gpc: g, kind: "same" });
        seen.add(g.grapheme);
      }
      if (conf) { chips.push({ gpc: conf, kind: "confusable" }); seen.add(conf.grapheme); }
      let guard = 0;
      while (chips.length < 4 && padPool.length && guard < 40) {
        guard += 1;
        const g = padPool[Math.floor(Math.random() * padPool.length)];
        if (!seen.has(g.grapheme)) { chips.push({ gpc: g, kind: "other" }); seen.add(g.grapheme); }
      }
      return shuffle(chips);
    }

    // ---- round state ----
    let idx = 0;
    let boxesRight = 0, boxesTotal = 0, wordsRight = 0;
    const soundLabels = new Set();

    const root = document.createElement("div");
    root.className = "t4";
    container.appendChild(root);

    // ---- per-word state ----
    let w, segs, gpcIds, boxChips, answers, sel, mode, phase, boxesShownAt;

    const $ = (s) => root.querySelector(s);
    const $$ = (s) => Array.from(root.querySelectorAll(s));
    const feedback = (cls, html) => {
      const el = $('[data-role="feedback"]');
      if (el) { el.className = "pt-feedback " + cls; el.innerHTML = html; }
    };

    function record(key, correct, latencyMs) {
      try {
        Promise.resolve(ctx.tracker.record({
          key, correct, latencyMs, taskType: "t4", detail: { word: w.id },
        })).catch(() => { /* tracker hiccups never break play */ });
      } catch (e) { /* ignore */ }
    }

    function startWord() {
      w = words[idx];
      segs = bank.segmentsFor(w);
      gpcIds = bank.wordGPCs(w);
      boxChips = segs.map((s, i) => chipsFor(s, gpcIds[i]));
      answers = segs.map(() => null);
      sel = 0;
      mode = "chips";
      phase = "input";
      boxesShownAt = Date.now();
      for (const s of segs) {
        try { soundLabels.add(bank.phonemeLabel(firstPhoneme(s.p))); } catch (e) { /* ignore */ }
      }
      root.dataset.word = w.id;
      root.dataset.lastRule = "";
      root.innerHTML = `
        <div class="pt-progress">Word ${idx + 1} of ${words.length}</div>
        <button type="button" class="pt-bigplay" data-role="play" aria-label="Play the word">🔊</button>
        <div class="pt-prompt">Listen, then build the word — one sound per box</div>
        <div class="pt-elk-row" data-role="boxes"></div>
        <div class="pt-chip-row" data-role="chips"></div>
        <div class="pt-toolrow">
          <button type="button" class="pt-secondary" data-role="mode">⌨️ Type it instead</button>
        </div>
        <div class="pt-feedback" data-role="feedback"></div>
        <button type="button" class="pt-primary" data-role="check" disabled>Check</button>
        <button type="button" class="pt-primary" data-role="next" hidden>
          ${idx + 1 < words.length ? "Next word" : "Finish"}</button>`;
      renderBoxes();
      ctx.audio.playWord(w);
    }

    function renderBoxes() {
      const row = $('[data-role="boxes"]');
      if (mode === "chips") {
        row.innerHTML = segs.map((s, i) => `
          <button type="button" class="pt-elk-box${i === sel ? " sel" : ""}" data-idx="${i}">
            <span data-role="ans">${answers[i] ? escapeHtml(answers[i].display) : "&nbsp;"}</span>
            <span class="pt-fix" data-role="fix" hidden></span>
          </button>`).join("");
        renderChips();
      } else {
        row.innerHTML = segs.map((s, i) => `
          <input class="pt-elk-input" data-idx="${i}" maxlength="4" autocomplete="off"
            autocapitalize="off" spellcheck="false"
            value="${answers[i] ? escapeHtml(answers[i].grapheme) : ""}">`).join("");
        $('[data-role="chips"]').innerHTML = "";
        const first = row.querySelector(".pt-elk-input");
        if (first) first.focus();
      }
      updateCheck();
    }

    function renderChips() {
      const holder = $('[data-role="chips"]');
      if (!holder) return;
      const chips = boxChips[sel] || [];
      holder.innerHTML = chips.map((c) => `
        <button type="button" class="pt-chip" data-role="chip" data-kind="${c.kind}"
          data-gpc="${escapeHtml(c.gpc.id)}" data-grapheme="${escapeHtml(c.gpc.grapheme)}">
          ${escapeHtml(c.gpc.display || c.gpc.grapheme)}
        </button>`).join("");
    }

    function selectBox(i) {
      if (phase !== "input" || mode !== "chips") return;
      sel = i;
      $$(".pt-elk-box").forEach((b, k) => b.classList.toggle("sel", k === i));
      renderChips();
    }

    function onChip(btn) {
      if (phase !== "input") return;
      const chips = boxChips[sel] || [];
      const chip = chips.find((c) => c.gpc.id === btn.dataset.gpc) ||
        { gpc: { id: btn.dataset.gpc, grapheme: btn.dataset.grapheme, display: btn.textContent.trim() } };
      answers[sel] = { grapheme: chip.gpc.grapheme, display: chip.gpc.display || chip.gpc.grapheme };
      const box = root.querySelector(`.pt-elk-box[data-idx="${sel}"] [data-role="ans"]`);
      if (box) box.textContent = answers[sel].display;
      const nextEmpty = answers.findIndex((a, k) => a == null && k > sel);
      const anyEmpty = answers.findIndex((a) => a == null);
      selectBox(nextEmpty !== -1 ? nextEmpty : (anyEmpty !== -1 ? anyEmpty : sel));
      updateCheck();
    }

    function toggleMode() {
      if (phase !== "input") return;
      if (mode === "type") {
        // carry typed text back into the chip answers where it matches a chip
        $$(".pt-elk-input").forEach((inp) => {
          const i = parseInt(inp.dataset.idx, 10);
          const v = inp.value.trim().toLowerCase();
          answers[i] = v ? { grapheme: v, display: v.replace(/_/g, "-") } : null;
        });
      }
      mode = mode === "chips" ? "type" : "chips";
      const btn = $('[data-role="mode"]');
      if (btn) btn.textContent = mode === "chips" ? "⌨️ Type it instead" : "🔤 Back to choices";
      renderBoxes();
    }

    function updateCheck() {
      const btn = $('[data-role="check"]');
      if (!btn) return;
      btn.disabled = phase !== "input" ? true
        : (mode === "chips" ? answers.some((a) => a == null) : false);
    }

    function boxEls() {
      return mode === "chips" ? $$(".pt-elk-box") : $$(".pt-elk-input");
    }

    const AMBER = new Set(["SUB-GRAPH-LEGAL", "POS-ILLEGAL", "HEART"]);

    async function onCheck() {
      if (phase !== "input") return;
      phase = "checked";
      const latency = Date.now() - boxesShownAt;

      const tried = mode === "chips"
        ? answers.map((a) => (a ? a.grapheme : ""))
        : $$(".pt-elk-input").map((inp) => inp.value.trim().toLowerCase());

      const results = ctx.errors.classifyWord({
        segments: segs, answers: tried, bank, rulesIdx: ctx.rulesIdx,
        heartParts: w.heart_parts || [],
      });

      // lock the UI
      $$('[data-role="chip"]').forEach((c) => { c.disabled = true; });
      $$(".pt-elk-input").forEach((inp) => { inp.disabled = true; });
      const modeBtn = $('[data-role="mode"]'); if (modeBtn) modeBtn.disabled = true;
      const checkBtn = $('[data-role="check"]'); if (checkBtn) checkBtn.hidden = true;

      const byBox = {};
      for (const r of results) if (r.boxIndex != null) byBox[r.boxIndex] = r;

      const els = boxEls();
      const lines = [];
      let firstRule = null;
      let allRight = true;

      segs.forEach((seg, i) => {
        const res = byBox[i] || { code: "OMIT" };
        const el = els[i];
        const good = res.code === "CORRECT";
        if (!good) allRight = false;
        if (el) {
          el.classList.remove("sel");
          el.classList.add(good ? "good" : (AMBER.has(res.code) ? "warn" : "bad"));
          if (!good && mode === "chips") {
            const fix = el.querySelector('[data-role="fix"]');
            if (fix) { fix.hidden = false; fix.textContent = "uses " + seg.g.replace(/_/g, "-"); }
          }
        }
        if (!good && lines.length < 2) {
          let line = ctx.errors.feedbackFor(res, { phonemeLabel: bank.phonemeLabel });
          if (res.code === "SUB-GRAPH-LEGAL") line += " This word uses " + seg.g.replace(/_/g, "-") + ".";
          if (res.code === "OMIT" && mode === "chips") line = "This box needs a sound.";
          lines.push(line);
        }
        if (!firstRule && res.ruleId) firstRule = res.ruleId;

        // one encode attempt per box on its GPC
        boxesTotal += 1;
        if (good) { boxesRight += 1; }
        record(gpcKeyOf(seg) + "|encode", good, latency);
        if (res.code === "SUB-GRAPH-LEGAL" && res.ruleId) {
          record("rule:" + res.ruleId, false, latency);
        }
      });

      if (allRight) { wordsRight += 1; feedback("good", "Yes! You built the whole word!"); }
      else feedback(AMBER.has((results.find((r) => r.code !== "CORRECT") || {}).code) ? "warn" : "bad",
        lines.map((l) => escapeHtml(l)).join("<br>"));

      root.dataset.lastRule = firstRule || "";

      // "sound it out with me": highlight each box while its phoneme plays
      await segmentedReplay(els);
      if (disposed) return;

      // rule-shaped mistake -> 60-second micro-lesson AFTER the word
      if (firstRule) {
        await ctx.showRuleLesson(firstRule);
        if (disposed) return;
      }

      const nextBtn = $('[data-role="next"]');
      if (nextBtn) nextBtn.hidden = false;
    }

    async function segmentedReplay(els) {
      for (let i = 0; i < segs.length; i++) {
        if (disposed) return;
        const el = els[i];
        if (el) el.classList.add("lit");
        try { await ctx.audio.playPhoneme(firstPhoneme(segs[i].p)); } catch (e) { /* ignore */ }
        await delay(300);
        if (el) el.classList.remove("lit");
      }
      if (!disposed) { try { ctx.audio.playWord(w); } catch (e) { /* ignore */ } }
    }

    function onNext() {
      idx += 1;
      if (idx >= words.length) {
        ctx.exit({
          summary: {
            title: "Listen & Write",
            correct: boxesRight,
            total: boxesTotal,
            note: wordsRight + " of " + words.length + " words built right first go",
            sounds: Array.from(soundLabels).slice(0, 14),
          },
        });
      } else startWord();
    }

    root.addEventListener("click", (e) => {
      if (disposed) return;
      if (e.target.closest('[data-role="play"]')) { ctx.audio.playWord(w); return; }
      const box = e.target.closest(".pt-elk-box[data-idx]");
      if (box && phase === "input") { selectBox(parseInt(box.dataset.idx, 10)); return; }
      const chip = e.target.closest('[data-role="chip"]');
      if (chip && !chip.disabled) { onChip(chip); return; }
      if (e.target.closest('[data-role="mode"]')) { toggleMode(); return; }
      const checkBtn = e.target.closest('[data-role="check"]');
      if (checkBtn && !checkBtn.disabled) { onCheck(); return; }
      const nextBtn = e.target.closest('[data-role="next"]');
      if (nextBtn && !nextBtn.hidden) { onNext(); return; }
    });

    root.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && mode === "type" && phase === "input") {
        e.preventDefault();
        onCheck();
      }
    });

    startWord();

    return {
      destroy() {
        disposed = true;
        try { ctx.audio.stop(); } catch (e) { /* ignore */ }
      },
    };
  }

  PhonicsTasks.register({
    id: "t4",
    title: "Listen & Write",
    subtitle: "Hear a word, then choose the right spelling for every sound",
    icon: "✏️",
    order: 4,
    unlockId: null,
    mount,
  });
})();
