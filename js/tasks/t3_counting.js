// ============================================================
// js/tasks/t3_counting.js — T3: Word Building (count edition).
//
// Modelled on the class worksheets: clap the BEATS (syllables),
// then count the SOUNDS inside each beat — one continuous
// build-out on one canvas, not two separate steps. Everything
// stays editable (remove a beat, remove a sound, re-clap) until
// the single Confirm. Skills tracked on the FIRST confirm only:
//   "skill:count-syllables"  correct = beats right first go
//   "skill:count-phonemes"   correct = total sounds right first go
// Miscounts get the §7 SEG-OMIT / SEG-ADD feedback lines and the
// child recounts in place; the second confirm always reveals.
// The reveal distributes the graphemes into the beats with a
// one-vowel-per-beat heuristic (a doubled grapheme like bb stays
// with the first beat, other single clusters join the next) —
// beat boundaries are genuinely ambiguous in English, so ONLY
// the beat count and the sound total are graded, never the
// distribution.
// ============================================================

window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

(function () {
  const ROUND = 8;
  const WANT_TAGS = ["cvc", "cvcc", "ccvc", "multisyllable", "compound", "le-syllable"];
  const MAX_BEATS = 5;
  const MAX_SOUNDS_PER_BEAT = 6;

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

  const DOUBLED = /^([a-z])\1$/;   // bb, tt, ss … stay with the beat before

  async function pickWords(bank) {
    const all = await bank.decodableWords({ uptoUnit: null, includeHeart: false });
    const usable = all.filter((w) =>
      (w.tags || []).some((t) => WANT_TAGS.includes(t)) &&
      bank.segmentsFor(w).length >= 2 &&
      bank.segmentsFor(w).length <= 8 &&
      w.syllables >= 1 && w.syllables <= 3 &&
      bank.wordGPCs(w).every(Boolean)
    );
    const oneSyl = shuffle(usable.filter((w) => w.syllables === 1));
    const multi = shuffle(usable.filter((w) => w.syllables > 1));
    // mostly one-beat words, with a few real clapping words mixed in
    let picks = oneSyl.slice(0, 5).concat(multi.slice(0, 3));
    if (picks.length < ROUND) picks = picks.concat(oneSyl.slice(5, 5 + ROUND - picks.length));
    if (picks.length < ROUND) picks = picks.concat(multi.slice(3, 3 + ROUND - picks.length));
    return shuffle(picks).slice(0, ROUND);
  }

  // Split a word's segments into one group per syllable (heuristic — see
  // header). Returns an array of segment arrays; length === w.syllables
  // whenever the bank's syllable count and vowel nuclei line up.
  function beatGroups(bank, w) {
    const segs = bank.segmentsFor(w);
    const isVowel = (seg) => {
      const ps = Array.isArray(seg.p) ? seg.p : [seg.p];
      return ps.some((p) => {
        const rec = bank.phoneme(p);
        return (rec && rec.type === "vowel") || p === "yoo";
      });
    };
    const nuclei = [];
    segs.forEach((s, i) => { if (isVowel(s)) nuclei.push(i); });
    if (nuclei.length <= 1) return [segs];

    const groups = [];
    let start = 0;
    for (let k = 0; k < nuclei.length - 1; k++) {
      const a = nuclei[k], b = nuclei[k + 1];
      // consonant segments strictly between the two vowels
      const between = b - a - 1;
      let cut; // first index of the NEXT group
      if (between <= 0) cut = a + 1;                       // li-on
      else if (between === 1) {
        // one medial segment: doubled grapheme hugs the first beat
        cut = DOUBLED.test(segs[a + 1].g) ? a + 2 : a + 1; // rabb-it / ba-con
      } else cut = a + 2;                                  // bas-ket, mon-ster
      groups.push(segs.slice(start, cut));
      start = cut;
    }
    groups.push(segs.slice(start));
    return groups.filter((g) => g.length);
  }

  async function mount(container, ctx) {
    const bank = ctx.bank;
    let disposed = false;
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(() => { if (!disposed) fn(); }, ms); timers.push(t); };

    const words = await pickWords(bank);
    if (disposed) return;
    if (!words.length) {
      container.innerHTML = `<div class="pt-feedback warn">No counting words are ready yet — try another activity!</div>`;
      return { destroy() { disposed = true; } };
    }

    let idx = 0;
    let syllRight = 0;
    let soundRight = 0;
    const soundLabels = new Set();

    const root = document.createElement("div");
    root.className = "t3";
    container.appendChild(root);

    if (!document.getElementById("t3-styles")) {
      const st = document.createElement("style");
      st.id = "t3-styles";
      st.textContent = `
        .t3-beats { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: stretch; margin: 14px 0 6px; }
        .t3-beat { border: 2px solid #6b6256; border-radius: 12px; background: #ffffff; padding: 8px 10px 10px; min-width: 96px; position: relative; }
        .t3-beat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #6b6256; text-align: center; }
        .t3-beat-x { position: absolute; top: -10px; right: -10px; width: 26px; height: 26px; border-radius: 50%;
          border: 1.5px solid #d8cfbb; background: #fbf7ee; color: #6b6256; font-weight: 800; font-size: 13px;
          cursor: pointer; line-height: 1; font-family: inherit; }
        .t3-dots { display: flex; gap: 6px; justify-content: center; align-items: center; margin-top: 8px; min-height: 48px; flex-wrap: wrap; }
        .t3-dot { width: 40px; height: 40px; border-radius: 50%; background: #f5c33c; border: 2px solid #b8860b;
          box-shadow: inset 0 -3px 0 rgba(0,0,0,0.12); cursor: pointer; border-style: solid; font-family: Georgia, serif;
          font-weight: 700; font-size: 14px; color: #4a3305; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
        .t3-dot-add { width: 44px; height: 44px; border-radius: 50%; background: #fbf7ee; border: 2px dashed #b8860b;
          color: #b8860b; font-size: 20px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .t3-clap { min-height: 56px; padding: 10px 20px; border: none; border-radius: 14px; background: #1f1f1f;
          color: #fbf7ee; font-weight: 800; font-size: 15px; font-family: inherit; cursor: pointer; align-self: center; }
        .t3-tally { text-align: center; font-size: 12px; font-weight: 700; color: #6b6256; margin: 4px 0 8px; }
        .t3-reveal .t3-dot { cursor: default; }
      `;
      document.head.appendChild(st);
    }

    function record(key, correct, latencyMs, word) {
      try {
        Promise.resolve(ctx.tracker.record({
          key, correct, latencyMs, taskType: "t3", detail: { word: word.id },
        })).catch(() => { /* offline tracker hiccups never break play */ });
      } catch (e) { /* ignore */ }
    }

    function finish() {
      ctx.exit({
        summary: {
          title: "Sound & Syllable Counting",
          correct: syllRight + soundRight,
          total: words.length * 2,
          note: syllRight + " claps and " + soundRight + " sound counts right first go",
          sounds: Array.from(soundLabels).slice(0, 14),
        },
      });
    }

    // ---- per-word state ----
    let w, segs, beats, phase, confirms, stepStart;

    const $ = (s) => root.querySelector(s);
    const feedback = (cls, html) => {
      const el = $('[data-role="feedback"]');
      if (el) { el.className = "pt-feedback " + cls; el.innerHTML = html; }
    };

    function startWord() {
      w = words[idx];
      segs = bank.segmentsFor(w);
      beats = [];                       // [{sounds: n}], all editable till Confirm
      phase = "input";
      confirms = 0;
      stepStart = Date.now();
      for (const s of segs) {
        const first = Array.isArray(s.p) ? s.p[0] : s.p;
        try { soundLabels.add(bank.phonemeLabel(first)); } catch (e) { /* ignore */ }
      }
      root.innerHTML = `
        <div class="pt-progress">Word ${idx + 1} of ${words.length}</div>
        <button type="button" class="pt-bigplay" data-role="play" aria-label="Play the word">🔊</button>
        <div class="pt-prompt">Clap the beats, then pop a counter for every sound inside each beat.<br>
          <span style="font-size: 12px; color: #6b6256;">Change your mind any time — nothing counts until Confirm.</span></div>
        <div class="t3-beats" data-role="beats"></div>
        <div class="t3-tally" data-role="tally"></div>
        <div class="pt-feedback" data-role="feedback"></div>
        <button type="button" class="pt-primary" data-role="confirm" disabled>Confirm</button>
        <button type="button" class="pt-primary" data-role="next" hidden>
          ${idx + 1 < words.length ? "Next word" : "Finish"}</button>`;
      renderBeats();
      ctx.audio.playWord(w);
    }

    function renderBeats() {
      const row = $('[data-role="beats"]');
      if (!row) return;
      row.classList.toggle("t3-reveal", phase !== "input");
      row.innerHTML = beats.map((b, bi) => `
        <div class="t3-beat" data-beat="${bi}">
          ${phase === "input" ? `<button type="button" class="t3-beat-x" data-role="unbeat" data-beat="${bi}" aria-label="Remove this beat">&times;</button>` : ""}
          <div class="t3-beat-label">beat ${bi + 1}</div>
          <div class="t3-dots">
            ${Array.from({ length: b.sounds }, (_, di) =>
              `<button type="button" class="t3-dot" data-role="dot" data-beat="${bi}" data-dot="${di}"
                 aria-label="Remove a sound">${b.labels && b.labels[di] ? escapeHtml(b.labels[di]) : ""}</button>`).join("")}
            ${phase === "input" && b.sounds < MAX_SOUNDS_PER_BEAT
              ? `<button type="button" class="t3-dot-add" data-role="addsound" data-beat="${bi}" aria-label="Add a sound">+</button>` : ""}
          </div>
        </div>`).join("") +
        (phase === "input" && beats.length < MAX_BEATS
          ? `<button type="button" class="t3-clap" data-role="clap">👏 Clap a beat</button>` : "");
      const total = beats.reduce((n, b) => n + b.sounds, 0);
      const tally = $('[data-role="tally"]');
      if (tally) tally.textContent = beats.length
        ? `${beats.length} beat${beats.length > 1 ? "s" : ""} · ${total} sound${total !== 1 ? "s" : ""}`
        : "Start by clapping the beats you hear.";
      const confirmBtn = $('[data-role="confirm"]');
      if (confirmBtn) confirmBtn.disabled = !(beats.length && beats.every((b) => b.sounds > 0));
    }

    function onConfirm() {
      if (phase !== "input") return;
      confirms += 1;
      const total = beats.reduce((n, b) => n + b.sounds, 0);
      const syllOk = beats.length === w.syllables;
      const totalOk = total === segs.length;

      if (confirms === 1) {
        record("skill:count-syllables", syllOk, Date.now() - stepStart, w);
        record("skill:count-phonemes", totalOk, Date.now() - stepStart, w);
        if (syllOk) syllRight += 1;
        if (totalOk) soundRight += 1;
      }

      if (syllOk && totalOk) {
        feedback("good", "Yes! " + beats.length + (beats.length > 1 ? " beats" : " beat") +
          " and " + total + " sounds — great counting!");
        reveal(true);
        return;
      }
      if (confirms >= 2) {
        feedback("warn", "Let's look together — watch the sounds fill the beats.");
        reveal(false);
        return;
      }
      const lines = [];
      if (!syllOk) lines.push(beats.length > w.syllables
        ? "Too many claps — listen for the beats again."
        : "There's another beat hiding — clap it out again.");
      if (!totalOk) lines.push(ctx.errors.feedbackFor({ code: total < segs.length ? "SEG-OMIT" : "SEG-ADD" }));
      feedback("warn", lines.join(" ") + " Fix your counters, then Confirm again.");
      ctx.audio.playWord(w);
    }

    function reveal(wasRight) {
      phase = "reveal";
      const groups = beatGroups(bank, w);
      // fill the child's own beat frames when their shape matches; otherwise
      // show the heuristic shape (and say so — the count grading already stood)
      const matches = groups.length === beats.length &&
        groups.every((g, i) => g.length === beats[i].sounds);
      beats = groups.map((g) => ({ sounds: g.length, labels: g.map((s) => (s.g || "").replace(/_/g, "-")) }));
      renderBeats();
      if (!matches && wasRight) {
        feedback("good", "Great counting! Here's one way the sounds sit inside the beats.");
      }
      ctx.audio.playWord(w);
      const nextBtn = $('[data-role="next"]');
      const confirmBtn = $('[data-role="confirm"]');
      if (confirmBtn) confirmBtn.hidden = true;
      later(() => { if (nextBtn) nextBtn.hidden = false; }, 700);
    }

    function onNext() {
      idx += 1;
      if (idx >= words.length) finish();
      else startWord();
    }

    root.addEventListener("click", (e) => {
      if (disposed) return;
      if (e.target.closest('[data-role="play"]')) { ctx.audio.playWord(w); return; }
      if (phase === "input") {
        if (e.target.closest('[data-role="clap"]')) {
          beats.push({ sounds: 0 });
          renderBeats();
          return;
        }
        const un = e.target.closest('[data-role="unbeat"]');
        if (un) { beats.splice(parseInt(un.dataset.beat, 10), 1); renderBeats(); return; }
        const add = e.target.closest('[data-role="addsound"]');
        if (add) { beats[parseInt(add.dataset.beat, 10)].sounds += 1; renderBeats(); return; }
        const dot = e.target.closest('[data-role="dot"]');
        if (dot) { beats[parseInt(dot.dataset.beat, 10)].sounds -= 1; renderBeats(); return; }
        const confirmBtn = e.target.closest('[data-role="confirm"]');
        if (confirmBtn && !confirmBtn.disabled) { onConfirm(); return; }
      }
      const nextBtn = e.target.closest('[data-role="next"]');
      if (nextBtn && !nextBtn.hidden) { onNext(); return; }
    });

    startWord();

    return {
      destroy() {
        disposed = true;
        timers.forEach(clearTimeout);
      },
    };
  }

  PhonicsTasks.register({
    id: "t3",
    title: "Beats & Sounds",
    subtitle: "Clap the beats, count the sounds inside",
    icon: "👏",
    order: 10,
    unlockId: "t3",
    mount,
  });
})();
