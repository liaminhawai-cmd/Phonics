// ============================================================
// js/tasks/t3_counting.js — T3: Sound & Syllable Counting.
//
// ARCHITECTURE.md §5 T3: hear a word, tap out its syllables,
// then push a counter per phoneme (Elkonin row). Two phoneme-
// awareness skills tracked per word:
//   "skill:count-syllables"  correct = first-try
//   "skill:count-phonemes"   correct = first-try
// Miscounts get the §7 SEG-OMIT / SEG-ADD feedback lines, one
// retry, then the reveal: boxes fill with the word's graphemes
// while the audio replays.
// ============================================================

window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

(function () {
  const ROUND = 8;
  const MAX_BOXES = 8;
  const WANT_TAGS = ["cvc", "cvcc", "ccvc", "multisyllable"];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const firstPhoneme = (p) => (Array.isArray(p) ? p[0] : p);

  async function pickWords(bank) {
    const all = await bank.decodableWords({ uptoUnit: null, includeHeart: false });
    const usable = all.filter((w) =>
      (w.tags || []).some((t) => WANT_TAGS.includes(t)) &&
      bank.segmentsFor(w).length >= 2 &&
      bank.segmentsFor(w).length <= 6 &&
      w.syllables >= 1 && w.syllables <= 4 &&
      bank.wordGPCs(w).every(Boolean)   // never serve a word the bank can't segment
    );
    const oneSyl = shuffle(usable.filter((w) => w.syllables === 1));
    const twoSyl = shuffle(usable.filter((w) => w.syllables === 2));
    const rest = shuffle(usable.filter((w) => w.syllables > 2));
    // prefer 1-2 syllables: mostly single-syllable with a couple of two-beat words
    let picks = oneSyl.slice(0, 6).concat(twoSyl.slice(0, 2));
    if (picks.length < ROUND) picks = picks.concat(twoSyl.slice(2, 2 + ROUND - picks.length));
    if (picks.length < ROUND) picks = picks.concat(oneSyl.slice(6, 6 + ROUND - picks.length));
    if (picks.length < ROUND) picks = picks.concat(rest.slice(0, ROUND - picks.length));
    return shuffle(picks).slice(0, ROUND);
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

    // round stats for the summary card
    let idx = 0;
    let syllRight = 0;
    let soundRight = 0;
    const soundLabels = new Set();

    const root = document.createElement("div");
    root.className = "t3";
    container.appendChild(root);

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
    let w, segs, phase, syllTries, soundTries, stepStart;

    function startWord() {
      w = words[idx];
      segs = bank.segmentsFor(w);
      phase = "syll";
      syllTries = 0;
      soundTries = 0;
      stepStart = Date.now();
      for (const s of segs) {
        try { soundLabels.add(bank.phonemeLabel(firstPhoneme(s.p))); } catch (e) { /* ignore */ }
      }
      root.dataset.word = w.id;
      root.dataset.phase = phase;
      root.innerHTML = `
        <div class="pt-progress">Word ${idx + 1} of ${words.length}</div>
        <button type="button" class="pt-bigplay" data-role="play" aria-label="Play the word">🔊</button>
        <div class="pt-prompt" data-role="prompt">How many claps (syllables)?</div>
        <div class="pt-choices" data-role="syll">
          ${[1, 2, 3, 4].map((n) => `<button type="button" class="pt-choice" data-role="syll-btn" data-n="${n}">${n}</button>`).join("")}
        </div>
        <div data-role="elk-area" hidden>
          <div class="pt-elk-row" data-role="elkrow"></div>
          <div class="pt-counter">
            <button type="button" class="pt-plus" data-role="plus" aria-label="Add a sound">＋</button>
            <button type="button" class="pt-reset" data-role="reset">↺ start again</button>
          </div>
          <button type="button" class="pt-primary" data-role="check">Check</button>
        </div>
        <div class="pt-feedback" data-role="feedback"></div>
        <button type="button" class="pt-primary" data-role="next" hidden>
          ${idx + 1 < words.length ? "Next word" : "Finish"}</button>`;
      ctx.audio.playWord(w);
    }

    const $ = (sel) => root.querySelector(sel);
    const feedback = (cls, msg) => {
      const el = $('[data-role="feedback"]');
      if (el) { el.className = "pt-feedback " + cls; el.textContent = msg; }
    };
    const boxCount = () => root.querySelectorAll('[data-role="elkrow"] .pt-elk-box').length;

    // ---- step A: syllables ----
    function onSyllable(btn) {
      if (phase !== "syll") return;
      const n = parseInt(btn.dataset.n, 10);
      if (n === w.syllables) {
        btn.classList.add("good");
        const firstTry = syllTries === 0;
        if (firstTry) syllRight += 1;
        record("skill:count-syllables", firstTry, Date.now() - stepStart, w);
        feedback("good", w.syllables === 1 ? "Yes — one clap!" : "Yes — " + w.syllables + " claps!");
        later(startSounds, 700);
        phase = "syll-done";
        root.dataset.phase = phase;
      } else {
        syllTries += 1;
        btn.classList.add("bad");
        later(() => btn.classList.remove("bad"), 500);
        if (syllTries >= 2) {
          // reveal the right answer and move on
          const right = root.querySelector(`[data-role="syll-btn"][data-n="${w.syllables}"]`);
          if (right) right.classList.add("good");
          record("skill:count-syllables", false, Date.now() - stepStart, w);
          feedback("warn", "It has " + w.syllables + (w.syllables === 1 ? " clap" : " claps") + " — clap it with me!");
          ctx.audio.playWord(w);
          later(startSounds, 1300);
          phase = "syll-done";
          root.dataset.phase = phase;
        } else {
          feedback("bad", "Listen again — clap it out!");
          ctx.audio.playWord(w);
        }
      }
    }

    // ---- step B: sounds (Elkonin tap-counter) ----
    function startSounds() {
      phase = "sounds";
      root.dataset.phase = phase;
      stepStart = Date.now();
      const prompt = $('[data-role="prompt"]');
      if (prompt) prompt.textContent = "Tap ＋ for every sound you hear";
      const syllRow = $('[data-role="syll"]');
      if (syllRow) syllRow.hidden = true;
      const area = $('[data-role="elk-area"]');
      if (area) area.hidden = false;
      feedback("", "");
      ctx.audio.playWord(w);
    }

    function onPlus() {
      if (phase !== "sounds") return;
      if (boxCount() >= MAX_BOXES) { ctx.toast("That's a lot of sounds! Try Check."); return; }
      const box = document.createElement("div");
      box.className = "pt-elk-box";
      $('[data-role="elkrow"]').appendChild(box);
    }

    function onReset() {
      if (phase !== "sounds") return;
      $('[data-role="elkrow"]').innerHTML = "";
      feedback("", "");
    }

    function onCheck() {
      if (phase !== "sounds") return;
      const target = segs.length;
      const n = boxCount();
      if (n === 0) { ctx.toast("Tap ＋ once for each sound first!"); return; }
      if (n === target) {
        const firstTry = soundTries === 0;
        if (firstTry) soundRight += 1;
        record("skill:count-phonemes", firstTry, Date.now() - stepStart, w);
        feedback("good", "Yes — " + target + " sounds!");
        revealBoxes(true);
        showNext();
      } else {
        soundTries += 1;
        const code = n < target ? "SEG-OMIT" : "SEG-ADD";
        const line = ctx.errors.feedbackFor({ code }, { phonemeLabel: bank.phonemeLabel });
        if (soundTries >= 2) {
          // one retry spent — reveal: boxes fill with graphemes while the word replays
          record("skill:count-phonemes", false, Date.now() - stepStart, w);
          feedback("warn", line + " It has " + target + " sounds — watch:");
          revealBoxes(false);
          showNext();
        } else {
          feedback(code === "SEG-OMIT" ? "warn" : "bad", line);
          ctx.audio.playWord(w);
        }
      }
      root.dataset.phase = phase;
    }

    // Fill the row with one box per segment, showing its grapheme, while
    // the word replays — the L0 "model" end of the §6 ladder.
    function revealBoxes(wasRight) {
      phase = "reveal";
      root.dataset.phase = phase;
      const row = $('[data-role="elkrow"]');
      row.innerHTML = "";
      segs.forEach((s, i) => {
        later(() => {
          const box = document.createElement("div");
          box.className = "pt-elk-box " + (wasRight ? "good" : "warn");
          box.textContent = s.g.replace(/_/g, "-");
          row.appendChild(box);
        }, 180 * i);
      });
      ctx.audio.playWord(w);
    }

    function showNext() {
      const area = $('[data-role="elk-area"]');
      if (area) {
        const plus = $('[data-role="plus"]'), reset = $('[data-role="reset"]'), check = $('[data-role="check"]');
        if (plus) plus.disabled = true;
        if (reset) reset.disabled = true;
        if (check) check.hidden = true;
      }
      later(() => { const nb = $('[data-role="next"]'); if (nb) nb.hidden = false; }, 500);
    }

    function onNext() {
      idx += 1;
      if (idx >= words.length) finish();
      else startWord();
    }

    root.addEventListener("click", (e) => {
      if (disposed) return;
      if (e.target.closest('[data-role="play"]')) { ctx.audio.playWord(w); return; }
      const syllBtn = e.target.closest('[data-role="syll-btn"]');
      if (syllBtn) { onSyllable(syllBtn); return; }
      if (e.target.closest('[data-role="plus"]')) { onPlus(); return; }
      if (e.target.closest('[data-role="reset"]')) { onReset(); return; }
      if (e.target.closest('[data-role="check"]')) { onCheck(); return; }
      const nextBtn = e.target.closest('[data-role="next"]');
      if (nextBtn && !nextBtn.hidden) { onNext(); return; }
    });

    startWord();

    return {
      destroy() {
        disposed = true;
        for (const t of timers) clearTimeout(t);
        try { ctx.audio.stop(); } catch (e) { /* ignore */ }
      },
    };
  }

  PhonicsTasks.register({
    id: "t3",
    title: "Sound Counting",
    subtitle: "Clap the syllables, then tap out every sound you hear",
    icon: "👏",
    order: 3,
    unlockId: null,
    mount,
  });
})();
