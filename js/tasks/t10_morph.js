// ============================================================
// js/tasks/t10_morph.js — T10: Word Builder (Morpheme Matrix).
//
// ARCHITECTURE §10: each of the 25 Marn Frank matrices is a
// word factory — a root with prefix and suffix boxes. Screen 1
// picks a matrix; screen 2 has two tabs:
//   BUILD     pick up to one prefix + one suffix around the
//             root, then "Build it" — matches are checked
//             against data/morphemes/word-key.json BY MORPHEMES
//             ARRAY (order-sensitive) so join spelling changes
//             (re+fer+ed = referred) are honoured.
//   WORD SUMS six of the matrix's example words: the word's
//             morphemes are shuffled among two decoy parts and
//             tapped back into order.
// Tracker keys: "morph:"+root spelling for whole words,
// "morph:"+affix for each affix placed in WORD SUMS.
// ============================================================

window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

(function () {
  const SUMS_ROUND = 6;
  const DATA_FILES = [
    "data/morphemes/matrices.json",
    "data/morphemes/word-key.json",
    "data/morphemes/prefixes.json",
    "data/morphemes/suffixes.json",
  ];

  // ---------------- helpers ----------------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function arraysEqual(a, b) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  // ---------------- data (fetched + cached on first mount) ----------------
  let dataPromise = null;

  function loadModel() {
    if (!dataPromise) {
      dataPromise = Promise.all(DATA_FILES.map((rel) =>
        fetch(rel).then((res) => {
          if (!res.ok) throw new Error("t10: failed to load " + rel + " (" + res.status + ")");
          return res.json();
        })
      )).then(buildModel).catch((err) => {
        dataPromise = null; // let a later mount retry
        throw err;
      });
    }
    return dataPromise;
  }

  // A chip is one tappable affix: {label:"er/or", spellings:["er","or"], meaning}.
  // Some matrices write multi-spelling affixes as "s/es" or "er_or".
  function makeChip(spelling, meaning) {
    const label = String(spelling).replace(/_/g, "/");
    return { label, spellings: label.split("/"), meaning: meaning || "" };
  }

  function buildModel(payloads) {
    const [matData, keyData, preData, sufData] = payloads;

    const preMeaning = {}; // "re" -> "back or again"
    for (const it of preData.prefixes || []) {
      for (const s of it.spellings || []) if (!(s in preMeaning)) preMeaning[s] = it.meaning;
    }
    const sufMeaning = {};
    for (const it of sufData.suffixes || []) {
      for (const s of it.spellings || []) if (!(s in sufMeaning)) sufMeaning[s] = it.meaning;
    }

    const entriesByMatrix = {};
    for (const w of keyData.words || []) {
      (entriesByMatrix[w.matrix] = entriesByMatrix[w.matrix] || []).push(w);
    }

    // Every suffix spelling anywhere, for locating a word's root chunk:
    // strip up to two known suffixes off the end and the last part left
    // is the root (verified against all 744 word-key entries).
    const suffixPool = new Set(Object.keys(sufMeaning));

    const matrices = (matData.matrices || []).map((m) => {
      const prefixChips = []
        .concat((m.prefixes.common || []).map((s) => makeChip(s, preMeaning[String(s).replace(/_/g, "/").split("/")[0]])))
        .concat((m.prefixes.less_common || []).map((d) => makeChip(d.spelling, d.meaning)));
      const suffixChips = (m.suffixes.inflectional || []).concat(m.suffixes.derivational || [])
        .map((s) => makeChip(s, sufMeaning[String(s).replace(/_/g, "/").split("/")[0]]));
      for (const c of suffixChips) for (const s of c.spellings) suffixPool.add(s);
      const variants = String(m.root.spelling).split(",").map((v) => v.trim()).filter(Boolean);
      return {
        id: m.id,
        num: parseInt(String(m.id).replace(/\D+/g, ""), 10) || 0,
        root: m.root,
        variants,
        rootLabel: variants.join(" / "),
        prefixChips,
        suffixChips,
        entries: entriesByMatrix[m.id] || [],
        exampleWords: m.example_words || [],
        reachable: null, // lazy: how many word-key words BUILD can reach
      };
    });

    return { matrices, suffixPool };
  }

  // Order-sensitive match of a (prefix chip?, suffix chip?) pick against a
  // matrix's word-key morphemes arrays. The middle part left over is the
  // root chunk by construction (entries are [prefix?]+root+[suffix x0-2]),
  // so join spelling changes like re+fer+ed = referred are honoured.
  function findMatches(entries, preChip, sufChip) {
    const out = [];
    for (const e of entries) {
      const mm = e.morphemes;
      let i = 0, j = mm.length;
      if (preChip) {
        if (preChip.spellings.indexOf(mm[0]) === -1) continue;
        i = 1;
      }
      if (sufChip) {
        if (sufChip.spellings.indexOf(mm[j - 1]) === -1) continue;
        j -= 1;
      }
      if (j - i === 1) out.push(e);
    }
    return out;
  }

  function reachableCount(mat) {
    if (mat.reachable != null) return mat.reachable;
    const found = new Set();
    const pres = [null].concat(mat.prefixChips);
    const sufs = [null].concat(mat.suffixChips);
    for (const p of pres) {
      for (const s of sufs) {
        if (!p && !s) continue;
        for (const e of findMatches(mat.entries, p, s)) found.add(e.word);
      }
    }
    mat.reachable = found.size;
    return mat.reachable;
  }

  // Index of the root chunk in a word-key morphemes array: strip up to two
  // trailing known suffixes; the last part remaining is the root.
  function rootIndex(morphemes, suffixPool) {
    let n = morphemes.length, stripped = 0;
    while (n > 1 && suffixPool.has(morphemes[n - 1]) && stripped < 2) { n -= 1; stripped += 1; }
    return n - 1;
  }

  function sumLine(morphemes, word) {
    return morphemes.join(" + ") + " = " + word;
  }

  // ---------------- one-time style (page palette vars, mobile-first) ----------------
  function injectStyle() {
    if (document.getElementById("t10-style")) return;
    const st = document.createElement("style");
    st.id = "t10-style";
    st.textContent = `
      .t10-search { display:block; width:100%; min-height:44px; padding:10px 14px; margin:8px 0 12px;
        border:1px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink);
        font-size:15px; font-family:inherit; }
      .t10-search:focus { outline:none; border-color:var(--accent); }
      .t10-grid { display:grid; grid-template-columns:1fr; gap:10px; }
      @media (min-width:560px) { .t10-grid { grid-template-columns:1fr 1fr; } }
      .t10-card { display:flex; flex-direction:column; align-items:flex-start; gap:3px; text-align:left;
        padding:12px 14px; min-height:72px; border:1px solid var(--line); border-radius:12px;
        background:var(--paper); cursor:pointer; font-family:inherit; transition:all .15s ease; }
      .t10-card:hover { border-color:var(--accent); transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.07); }
      .t10-cardroot { font-family:Georgia,serif; font-weight:700; font-size:18px; color:var(--ink); overflow-wrap:anywhere; }
      .t10-meaning { font-size:12.5px; color:var(--muted); line-height:1.4; }
      .t10-cardrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:2px; }
      .t10-badge { font-size:10px; font-weight:700; letter-spacing:.6px; text-transform:uppercase;
        border:1px solid var(--line); border-radius:10px; padding:2px 8px; color:var(--muted); background:var(--bg); }
      .t10-badge.greek { background:var(--warn-bg); color:var(--warn-ink); border-color:var(--warn); }
      .t10-count { font-size:11px; font-weight:600; color:var(--muted); }
      .t10-none { text-align:center; color:var(--muted); font-size:14px; padding:18px 8px; }
      .t10-mhead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px; }
      .t10-mtitle { font-family:Georgia,serif; font-weight:700; font-size:19px; flex:1; min-width:0; overflow-wrap:anywhere; }
      .t10-tabs { display:flex; gap:8px; margin:10px 0 4px; }
      .t10-tab { flex:1; min-height:44px; border:1px solid var(--line); border-radius:10px; background:var(--bg);
        color:var(--muted); font-family:inherit; font-weight:700; font-size:14px; cursor:pointer; transition:all .15s ease; }
      .t10-tab:hover { border-color:var(--accent); color:var(--accent); }
      .t10-tab[aria-selected="true"] { background:var(--ink); border-color:var(--ink); color:var(--paper); }
      .t10-part-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px;
        color:var(--muted); text-align:center; margin-top:10px; }
      .t10 .pt-chip[aria-pressed="true"] { background:var(--accent); border-color:var(--accent); color:#fff; }
      .t10-roottile { display:block; margin:4px auto; min-height:56px; padding:8px 24px; border:2px solid var(--ink);
        border-radius:12px; background:var(--paper); color:var(--ink); font-family:Georgia,serif;
        font-size:23px; font-weight:700; cursor:pointer; max-width:100%; overflow-wrap:anywhere; }
      .t10-roottile:active { transform:scale(0.97); }
      .t10-rootmeaning { text-align:center; font-size:13px; color:var(--muted); min-height:19px; font-weight:600; }
      .t10-sum { text-align:center; font-family:Georgia,serif; font-size:20px; font-weight:700;
        margin:10px 0 2px; overflow-wrap:anywhere; line-height:1.4; }
      .t10-joinnote { text-align:center; font-size:13px; color:var(--warn-ink); background:var(--warn-bg);
        border-radius:8px; padding:6px 10px; margin:8px auto 0; max-width:420px; font-weight:600; line-height:1.5; }
      .t10-progressline { text-align:center; font-size:12px; font-weight:700; color:var(--muted);
        text-transform:uppercase; letter-spacing:.5px; margin-top:14px; }
      .t10-found { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-top:8px; }
      .t10-foundword { border:1px solid var(--line); border-radius:14px; padding:5px 11px; font-size:13px;
        font-weight:700; font-family:Georgia,serif; background:var(--good-bg); color:var(--correct); }
      .t10-bigword { text-align:center; font-family:Georgia,serif; font-size:30px; font-weight:700;
        margin:8px 0 2px; overflow-wrap:anywhere; }
      .t10-slots { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin:12px 0 4px; }
      .t10-slot { min-width:56px; min-height:52px; padding:4px 12px; border:2px dashed var(--line); border-radius:10px;
        background:var(--bg); color:var(--muted); font-family:Georgia,serif; font-size:19px; font-weight:700;
        cursor:pointer; transition:all .15s ease; }
      .t10-slot.filled { border-style:solid; border-color:var(--ink); background:var(--paper); color:var(--ink); }
      .t10-slot.good { border-style:solid; border-color:var(--correct); background:var(--good-bg); color:var(--correct); }
      .t10-slot.warn { border-style:solid; border-color:var(--warn); background:var(--warn-bg); color:var(--warn-ink); }
      .t10-slot.bad  { border-style:solid; border-color:var(--wrong); background:var(--bad-bg); color:var(--wrong); animation:pt-shake .3s ease; }
      .t10-finishrow { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin-top:18px; }`;
    document.head.appendChild(st);
  }

  // ---------------- mount ----------------
  async function mount(container, ctx) {
    injectStyle();
    let disposed = false;
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(() => { if (!disposed) fn(); }, ms); timers.push(t); };

    const root = document.createElement("div");
    root.className = "t10";
    root.innerHTML = `<div class="status-box" data-role="loading">Loading word parts&hellip;</div>
      <div data-role="pick" hidden></div>
      <div data-role="matrix" hidden></div>`;
    container.appendChild(root);
    const $ = (sel) => root.querySelector(sel);

    function rec(key, correct, latencyMs, detail) {
      try {
        Promise.resolve(ctx.tracker.record({
          key, correct, latencyMs, taskType: "t10", detail,
        })).catch(() => { /* tracker hiccups never break play */ });
      } catch (e) { /* ignore */ }
    }

    function speak(text) {
      try { ctx.audio.speak(text); } catch (e) { /* ignore */ }
    }

    // ---- session state (spans matrices until exit) ----
    let model = null;
    let mat = null;                       // open matrix view-model
    let tab = "build";
    let query = "";
    const foundByMatrix = {};             // matrix id -> Set of found words
    const rootsBuiltIn = new Set();       // matrix ids where >= 1 word was built
    let totalBuilt = 0;
    let sumsAttempted = 0;
    let sumsFirstTry = 0;

    // ---- BUILD tab state ----
    let selPre = -1, selSuf = -1, rootMeaningOn = false, buildT0 = Date.now();

    // ---- WORD SUMS tab state ----
    let sums = null; // {items, idx, tries, slots[], tray[], settled, done}

    function finish() {
      const bits = [];
      if (totalBuilt) bits.push("built " + totalBuilt + " real word" + (totalBuilt === 1 ? "" : "s") +
        " from " + rootsBuiltIn.size + (rootsBuiltIn.size === 1 ? " matrix" : " matrices"));
      if (sumsAttempted) bits.push(sumsFirstTry + " of " + sumsAttempted + " word sums right first go");
      ctx.exit({
        summary: {
          title: "Word Builder",
          correct: totalBuilt + sumsFirstTry,
          total: totalBuilt + sumsAttempted,
          note: bits.length ? bits.join(" and ").replace(/^b/, "B") : "Had a look around the word matrices",
        },
      });
    }

    // ================= screen 1: matrix picker =================
    function showPick() {
      mat = null;
      $('[data-role="matrix"]').hidden = true;
      const pick = $('[data-role="pick"]');
      pick.hidden = false;
      pick.innerHTML = `
        <div class="pt-prompt">Pick a word matrix</div>
        <input type="search" class="t10-search" data-role="search" placeholder="Search roots or meanings&hellip;"
          value="${esc(query)}" aria-label="Search matrices">
        <div class="t10-grid" data-role="grid"></div>
        <div class="t10-finishrow">
          <button type="button" class="pt-secondary" data-role="finish">Finish &amp; see summary</button>
        </div>`;
      renderGrid();
    }

    function renderGrid() {
      const grid = $('[data-role="grid"]');
      if (!grid) return;
      const q = query.trim().toLowerCase();
      const list = model.matrices.filter((m) => {
        if (!q) return true;
        return m.root.spelling.toLowerCase().includes(q) ||
          (m.root.meaning || "").toLowerCase().includes(q) ||
          (m.root.origin || "").toLowerCase().includes(q) ||
          m.entries.some((e) => e.word.toLowerCase().startsWith(q));
      });
      if (!list.length) {
        grid.innerHTML = `<div class="t10-none" style="grid-column:1/-1">No matrices match &mdash; try another word.</div>`;
        return;
      }
      grid.innerHTML = list.map((m) => {
        const greek = (m.root.origin || "").toLowerCase() === "greek";
        return `
        <button type="button" class="t10-card" data-role="card" data-mid="${esc(m.id)}">
          <span class="t10-cardroot">${esc(m.rootLabel)}</span>
          <span class="t10-meaning">${esc(m.root.meaning)}</span>
          <span class="t10-cardrow">
            <span class="t10-badge${greek ? " greek" : ""}">${greek ? "Greek" : "Latin"}</span>
            <span class="t10-count">${m.entries.length} words</span>
          </span>
        </button>`;
      }).join("");
    }

    // ================= screen 2: one matrix, two tabs =================
    function openMatrix(mid) {
      mat = model.matrices.find((m) => m.id === mid);
      if (!mat) return;
      if (!foundByMatrix[mat.id]) foundByMatrix[mat.id] = new Set();
      selPre = -1; selSuf = -1; rootMeaningOn = false; buildT0 = Date.now();
      sums = null;
      tab = "build";
      $('[data-role="pick"]').hidden = true;
      const host = $('[data-role="matrix"]');
      host.hidden = false;
      const greek = (mat.root.origin || "").toLowerCase() === "greek";
      host.innerHTML = `
        <div class="t10-mhead">
          <button type="button" class="pt-secondary" data-role="back-pick">&larr; Matrices</button>
          <span class="t10-mtitle">${esc(mat.rootLabel)}</span>
          <span class="t10-badge${greek ? " greek" : ""}">${greek ? "Greek" : "Latin"}</span>
        </div>
        <div class="t10-tabs" role="tablist">
          <button type="button" class="t10-tab" role="tab" data-role="tab-build" aria-selected="true">🧱 Build</button>
          <button type="button" class="t10-tab" role="tab" data-role="tab-sums" aria-selected="false">➕ Word sums</button>
        </div>
        <div data-role="panel-build"></div>
        <div data-role="panel-sums" hidden></div>`;
      renderBuild();
      updateTabs();
    }

    function updateTabs() {
      const tb = $('[data-role="tab-build"]'), ts = $('[data-role="tab-sums"]');
      const pb = $('[data-role="panel-build"]'), ps = $('[data-role="panel-sums"]');
      if (!tb) return;
      tb.setAttribute("aria-selected", tab === "build" ? "true" : "false");
      ts.setAttribute("aria-selected", tab === "sums" ? "true" : "false");
      pb.hidden = tab !== "build";
      ps.hidden = tab !== "sums";
      if (tab === "sums" && !sums) startSums();
    }

    // ---------------- BUILD tab ----------------
    function renderBuild() {
      const panel = $('[data-role="panel-build"]');
      panel.innerHTML = `
        <div class="pt-prompt">Mix a prefix or suffix with the root &mdash; is it a real word?</div>
        ${mat.prefixChips.length ? `
          <div class="t10-part-label">Prefixes</div>
          <div class="pt-chip-row">
            ${mat.prefixChips.map((c, i) => `<button type="button" class="pt-chip" data-role="pre-chip"
              data-i="${i}" aria-pressed="false" title="${esc(c.meaning)}">${esc(c.label)}</button>`).join("")}
          </div>` : ""}
        <div class="t10-part-label">Root</div>
        <button type="button" class="t10-roottile" data-role="root-tile"
          aria-label="Root ${esc(mat.rootLabel)} — tap for its meaning">${esc(mat.rootLabel)}</button>
        <div class="t10-rootmeaning" data-role="root-meaning"></div>
        ${mat.suffixChips.length ? `
          <div class="t10-part-label">Suffixes</div>
          <div class="pt-chip-row">
            ${mat.suffixChips.map((c, i) => `<button type="button" class="pt-chip" data-role="suf-chip"
              data-i="${i}" aria-pressed="false" title="${esc(c.meaning)}">${esc(c.label)}</button>`).join("")}
          </div>` : ""}
        <div class="t10-sum" data-role="b-sum"></div>
        <button type="button" class="pt-primary" data-role="build-go" disabled>Build it</button>
        <div class="pt-feedback" data-role="b-feedback" aria-live="polite"></div>
        <div data-role="b-joinnote"></div>
        <div class="t10-progressline" data-role="b-progress"></div>
        <div class="t10-found" data-role="b-found"></div>`;
      refreshBuildUi();
      renderFound();
    }

    function preChip() { return selPre >= 0 ? mat.prefixChips[selPre] : null; }
    function sufChip() { return selSuf >= 0 ? mat.suffixChips[selSuf] : null; }

    function refreshBuildUi() {
      root.querySelectorAll('[data-role="pre-chip"]').forEach((b, i) =>
        b.setAttribute("aria-pressed", i === selPre ? "true" : "false"));
      root.querySelectorAll('[data-role="suf-chip"]').forEach((b, i) =>
        b.setAttribute("aria-pressed", i === selSuf ? "true" : "false"));
      const parts = [];
      if (preChip()) parts.push(preChip().label);
      parts.push(mat.rootLabel);
      if (sufChip()) parts.push(sufChip().label);
      const sum = $('[data-role="b-sum"]');
      if (sum) sum.textContent = parts.join(" + ");
      const go = $('[data-role="build-go"]');
      if (go) go.disabled = !(preChip() || sufChip());
      const rm = $('[data-role="root-meaning"]');
      if (rm) rm.textContent = rootMeaningOn ? "“" + mat.root.meaning + "”" : "";
    }

    function buildFeedback(cls, html) {
      const el = $('[data-role="b-feedback"]');
      if (el) { el.className = "pt-feedback " + cls; el.innerHTML = html; }
    }

    function renderFound() {
      const found = foundByMatrix[mat.id];
      const prog = $('[data-role="b-progress"]');
      if (prog) prog.textContent = found.size + " of " + reachableCount(mat) + " found";
      const list = $('[data-role="b-found"]');
      if (list) list.innerHTML = Array.from(found)
        .map((w) => `<span class="t10-foundword">${esc(w)}</span>`).join("");
    }

    function onBuildGo() {
      const pre = preChip(), suf = sufChip();
      if (!pre && !suf) { ctx.toast("Pick a prefix or a suffix first!"); return; }
      const jn = $('[data-role="b-joinnote"]');
      if (jn) jn.innerHTML = "";
      const matches = findMatches(mat.entries, pre, suf);
      const latency = Date.now() - buildT0;
      buildT0 = Date.now();
      if (!matches.length) {
        buildFeedback("warn", "Hmm, that&rsquo;s not a real one &mdash; try another mix!");
        return;
      }
      const found = foundByMatrix[mat.id];
      const entry = matches.find((e) => !found.has(e.word)) || matches[0];
      const already = found.has(entry.word);
      buildFeedback("good", "🎉 " + esc(sumLine(entry.morphemes, entry.word)) +
        (already ? "<br>You found that one before!" : ""));
      const joined = entry.morphemes.join("");
      if (joined !== entry.word && jn) {
        jn.innerHTML = `<div class="t10-joinnote">The spelling changes at the join:
          &ldquo;${esc(joined)}&rdquo; is written &ldquo;<strong>${esc(entry.word)}</strong>&rdquo;.</div>`;
      }
      speak(entry.word);
      if (!already) {
        found.add(entry.word);
        totalBuilt += 1;
        rootsBuiltIn.add(mat.id);
        rec("morph:" + mat.root.spelling, true, latency, { word: entry.word, matrix: mat.id, mode: "build" });
        renderFound();
      }
    }

    // ---------------- WORD SUMS tab ----------------
    function decoysFor(entry) {
      const pool = new Set();
      for (const c of mat.prefixChips) for (const s of c.spellings) pool.add(s);
      for (const c of mat.suffixChips) for (const s of c.spellings) pool.add(s);
      for (const v of mat.variants) pool.add(v);
      for (const m of entry.morphemes) pool.delete(m);
      return shuffle(Array.from(pool)).slice(0, 2);
    }

    function startSums() {
      const inKey = {};
      for (const e of mat.entries) inKey[e.word] = e;
      const items = shuffle(mat.exampleWords.map((w) => inKey[w]).filter(Boolean)).slice(0, SUMS_ROUND);
      sums = { items, idx: 0, tries: 0, slots: [], tray: [], settled: false, done: false, t0: Date.now() };
      if (!items.length) {
        $('[data-role="panel-sums"]').innerHTML =
          `<div class="pt-feedback warn">No word sums here yet &mdash; try the Build tab!</div>`;
        return;
      }
      renderSumsItem();
    }

    function renderSumsItem() {
      const entry = sums.items[sums.idx];
      sums.tries = 0;
      sums.settled = false;
      sums.t0 = Date.now();
      sums.slots = entry.morphemes.map(() => null); // indices into tray
      sums.tray = shuffle(entry.morphemes.concat(decoysFor(entry)))
        .map((text, i) => ({ text, i, used: false }));
      const panel = $('[data-role="panel-sums"]');
      panel.innerHTML = `
        <div class="pt-progress">Word ${sums.idx + 1} of ${sums.items.length}</div>
        <div class="t10-bigword" data-role="s-word">${esc(entry.word)}</div>
        <div class="pt-prompt">Tap the parts in order to make the word sum</div>
        <div class="t10-slots" data-role="s-slots"></div>
        <div class="t10-part-label">Parts</div>
        <div class="pt-chip-row" data-role="s-tray">
          ${sums.tray.map((p) => `<button type="button" class="pt-chip" data-role="tray-chip" data-i="${p.i}">${esc(p.text)}</button>`).join("")}
        </div>
        <button type="button" class="pt-primary" data-role="sums-check" disabled>Check</button>
        <div class="pt-feedback" data-role="s-feedback" aria-live="polite"></div>
        <div data-role="s-joinnote"></div>
        <button type="button" class="pt-primary" data-role="sums-next" hidden>
          ${sums.idx + 1 < sums.items.length ? "Next word" : "Done!"}</button>`;
      renderSlots();
    }

    function renderSlots(marks) {
      const row = $('[data-role="s-slots"]');
      if (!row) return;
      row.innerHTML = sums.slots.map((trayIdx, i) => {
        const filled = trayIdx != null;
        const text = filled ? sums.tray.find((p) => p.i === trayIdx).text : "";
        const mark = marks && marks[i] ? " " + marks[i] : (filled ? " filled" : "");
        return `<button type="button" class="t10-slot${mark}" data-role="slot" data-i="${i}"
          aria-label="${filled ? "Part " + esc(text) + " — tap to take it out" : "Empty slot " + (i + 1)}">
          ${filled ? esc(text) : "&nbsp;"}</button>`;
      }).join("");
      sums.tray.forEach((p) => {
        const btn = root.querySelector(`[data-role="tray-chip"][data-i="${p.i}"]`);
        if (btn) btn.disabled = p.used || sums.settled;
      });
      const check = $('[data-role="sums-check"]');
      if (check) check.disabled = sums.settled || sums.slots.some((s) => s == null);
    }

    function sumsFeedback(cls, html) {
      const el = $('[data-role="s-feedback"]');
      if (el) { el.className = "pt-feedback " + cls; el.innerHTML = html; }
    }

    function onTrayChip(i) {
      if (sums.settled) return;
      const part = sums.tray.find((p) => p.i === i);
      if (!part || part.used) return;
      const slot = sums.slots.indexOf(null);
      if (slot === -1) return;
      part.used = true;
      sums.slots[slot] = i;
      sumsFeedback("", "");
      renderSlots();
    }

    function onSlot(i) {
      if (sums.settled) return;
      const trayIdx = sums.slots[i];
      if (trayIdx == null) return;
      const part = sums.tray.find((p) => p.i === trayIdx);
      if (part) part.used = false;
      sums.slots[i] = null;
      sumsFeedback("", "");
      renderSlots();
    }

    function settleSums(entry, attempt, firstTry) {
      sums.settled = true;
      sumsAttempted += 1;
      if (firstTry) sumsFirstTry += 1;
      rec("morph:" + mat.root.spelling, firstTry, Date.now() - sums.t0,
        { word: entry.word, matrix: mat.id, mode: "sums" });
      const ri = rootIndex(entry.morphemes, model.suffixPool);
      entry.morphemes.forEach((m, i) => {
        if (i === ri) return; // affixes only — the root got its own record above
        rec("morph:" + m, attempt[i] === m, Date.now() - sums.t0,
          { word: entry.word, matrix: mat.id, mode: "sums", slot: i });
      });
      const check = $('[data-role="sums-check"]');
      if (check) check.disabled = true;
      const next = $('[data-role="sums-next"]');
      if (next) later(() => { next.hidden = false; }, 500);
    }

    function onSumsCheck() {
      if (sums.settled) return;
      const entry = sums.items[sums.idx];
      if (sums.slots.some((s) => s == null)) return;
      const attempt = sums.slots.map((trayIdx) => sums.tray.find((p) => p.i === trayIdx).text);
      const jn = $('[data-role="s-joinnote"]');
      if (arraysEqual(attempt, entry.morphemes)) {
        renderSlots(attempt.map(() => "good"));
        sumsFeedback("good", "🎉 " + esc(sumLine(entry.morphemes, entry.word)));
        if (jn && entry.morphemes.join("") !== entry.word) {
          jn.innerHTML = `<div class="t10-joinnote">See how the spelling changes when the parts join up!</div>`;
        }
        speak(entry.word);
        settleSums(entry, attempt, sums.tries === 0);
      } else if (sums.tries === 0) {
        sums.tries = 1;
        renderSlots(attempt.map((t, i) => (t === entry.morphemes[i] ? "good" : "bad")));
        sumsFeedback("warn", "Almost &mdash; check the order of the parts and try again!");
        later(() => { if (sums && !sums.settled) renderSlots(); }, 900);
      } else {
        // one retry spent — reveal the real sum
        const row = $('[data-role="s-slots"]');
        if (row) row.innerHTML = entry.morphemes.map((m) =>
          `<button type="button" class="t10-slot warn" disabled>${esc(m)}</button>`).join("");
        root.querySelectorAll('[data-role="tray-chip"]').forEach((b) => { b.disabled = true; });
        const check = $('[data-role="sums-check"]');
        if (check) check.disabled = true;
        sumsFeedback("warn", "It goes: " + esc(sumLine(entry.morphemes, entry.word)));
        speak(entry.word);
        settleSums(entry, attempt, false);
      }
    }

    function onSumsNext() {
      sums.idx += 1;
      if (sums.idx < sums.items.length) { renderSumsItem(); return; }
      sums.done = true;
      const panel = $('[data-role="panel-sums"]');
      panel.innerHTML = `
        <div class="pt-prompt">🌟 All ${sums.items.length} word sums done!</div>
        <div class="t10-finishrow">
          <button type="button" class="pt-secondary" data-role="sums-again">Play again</button>
          <button type="button" class="pt-secondary" data-role="go-build-tab">Build words</button>
          <button type="button" class="pt-primary" style="margin:0" data-role="finish">Finish</button>
        </div>`;
    }

    // ---------------- events ----------------
    root.addEventListener("click", (e) => {
      if (disposed) return;
      const hit = (role) => e.target.closest(`[data-role="${role}"]`);
      let el;
      if ((el = hit("card"))) { openMatrix(el.dataset.mid); return; }
      if (hit("back-pick")) { showPick(); return; }
      if (hit("finish")) { finish(); return; }
      if (hit("retry-load")) { boot(); return; }
      if (!mat) return;
      if (hit("tab-build")) { tab = "build"; updateTabs(); return; }
      if (hit("tab-sums")) { tab = "sums"; updateTabs(); return; }
      if (hit("go-build-tab")) { tab = "build"; updateTabs(); return; }
      if ((el = hit("pre-chip"))) {
        const i = parseInt(el.dataset.i, 10);
        selPre = selPre === i ? -1 : i;
        buildFeedback("", ""); refreshBuildUi(); return;
      }
      if ((el = hit("suf-chip"))) {
        const i = parseInt(el.dataset.i, 10);
        selSuf = selSuf === i ? -1 : i;
        buildFeedback("", ""); refreshBuildUi(); return;
      }
      if (hit("root-tile")) { rootMeaningOn = !rootMeaningOn; refreshBuildUi(); return; }
      if (hit("build-go")) { onBuildGo(); return; }
      if (!sums) return;
      if ((el = hit("tray-chip"))) { onTrayChip(parseInt(el.dataset.i, 10)); return; }
      if ((el = hit("slot"))) { onSlot(parseInt(el.dataset.i, 10)); return; }
      if (hit("sums-check")) { onSumsCheck(); return; }
      if (hit("sums-again")) { startSums(); return; }
      if (hit("sums-next")) { onSumsNext(); return; }
    });

    root.addEventListener("input", (e) => {
      if (disposed) return;
      const s = e.target.closest('[data-role="search"]');
      if (s) { query = s.value; renderGrid(); }
    });

    // ---------------- boot ----------------
    async function boot() {
      const loading = $('[data-role="loading"]');
      loading.hidden = false;
      loading.className = "status-box";
      loading.textContent = "Loading word parts…";
      try {
        model = await loadModel();
        if (disposed) return;
        loading.hidden = true;
        showPick();
      } catch (err) {
        if (disposed) return;
        loading.className = "status-box status-error";
        loading.innerHTML = `Couldn&rsquo;t load the word matrices.<small>${esc(err && err.message ? err.message : err)}</small>
          <div style="margin-top:12px"><button type="button" class="pt-secondary" data-role="retry-load">Try again</button></div>`;
      }
    }
    await boot();

    return {
      destroy() {
        disposed = true;
        for (const t of timers) clearTimeout(t);
        try { ctx.audio.stop(); } catch (e) { /* ignore */ }
      },
    };
  }

  PhonicsTasks.register({
    id: "t10",
    title: "Word Builder",
    subtitle: "Build big words from parts",
    icon: "🧱",
    order: 60,
    unlockId: null,
    mount,
  });
})();
