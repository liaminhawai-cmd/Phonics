// ============================================================
// soundwall.js — every sound of Australian English on one page,
// each with its own vocal-tract cutaway.
//
// Consonants and vowels hold the position you make them in;
// diphthongs glide on a silent loop, because the whole point of
// a diphthong is that the mouth MOVES. Tap any sound to hear it
// and replay the movement.
//
// The codes under each sound are the trainer's own graphemes,
// worked out from GRAPHEMES in app.js — so students can see at a
// glance that er, ir, ur, ear and wor are five spellings of one
// sound, which is exactly what makes them hard to write down.
// ============================================================

window.SoundWall = (() => {

  const SECTIONS = [
    { key:"consonants", title:"Consonants",
      blurb:"The pulsing dot is where the sound happens — lips, teeth, the ridge behind your teeth, or the soft roof at the back." },
    { key:"vowels", title:"Vowels",
      blurb:"No blocking, just an open tube. What changes is where the tongue humps up and whether your lips round." },
    { key:"diphthongs", title:"Diphthongs",
      blurb:"Two vowels in one. Watch each mouth glide from the first position to the second, over and over." }
  ];

  /* Sounds whose spelling can't be shown as a tidy list of codes. */
  const NOTES = {
    "ə": "any vowel letter, in a syllable you don't stress — the commonest sound in English"
  };

  let built = false;
  let RECORDINGS = null;    // ipa -> teacher recording url (if any)
  let audioEl = null;

  // ---- level focus toggle -------------------------------------
  // "All 40+ sounds at once is scary" — so once a level is picked, sounds
  // that level's program hasn't reached yet render faint & small (still
  // there, still tappable, just clearly "not yet"). Driven entirely by the
  // ACTIVE PhonicsBank sequence's own units, so it works for any program.
  const LS_LEVEL = "phonics-soundwall-level";
  let focusLevels = "all";    // "all", or a Set of unit.n — ANY combo of levels
  let ipaLevel = {};          // ipa -> Set of every unit.n that teaches it
  let levelMapSeqId;          // which sequence id ipaLevel was built for

  function hasBank() { return typeof PhonicsBank !== "undefined" && PhonicsBank.seq && PhonicsBank.seq(); }
  function programUnits() { const s = hasBank() && PhonicsBank.seq(); return (s && s.units) || []; }

  function readLevelStore() {
    try { return JSON.parse(localStorage.getItem(LS_LEVEL)) || {}; } catch (e) { return {}; }
  }
  function storedLevelFor(seqId) {
    const store = readLevelStore();
    return Object.prototype.hasOwnProperty.call(store, seqId) ? store[seqId] : null;
  }
  function saveLevelFor(seqId, value) {
    const store = readLevelStore();
    store[seqId] = value;
    try { localStorage.setItem(LS_LEVEL, JSON.stringify(store)); } catch (e) {}
  }

  // Same rule js/core/bank-adapt.js's private shortSoundFor uses, so a
  // phoneme lines up with exactly the units its own spelling codes come
  // from — the "codes" chips already on each tile are built the same way.
  function shortSoundFor(gpc) {
    if (gpc.short) return gpc.short;
    if (Array.isArray(gpc.phonemes)) {
      return gpc.id.indexOf(".") === -1 ? gpc.id : gpc.id.slice(gpc.id.indexOf(".") + 1);
    }
    const label = PhonicsBank.phonemeLabel(gpc.phonemes) || "";
    const m = label.match(/^\/([^/]+)\//);
    return m ? m[1] : label;
  }

  // ipa -> earliest unit.n a spelling of it is taught, for the active
  // program. A sound this program's own codes never resolve to (e.g. the
  // schwa has no dedicated code) is left unmapped and always renders full
  // strength — safer than guessing it into "not taught yet".
  function buildLevelMap() {
    const map = {};
    if (!hasBank()) return map;
    PhonicsBank.taughtGPCs().forEach(({ gpc, unit }) => {
      const d = Mouth.descFor(shortSoundFor(gpc), (gpc.examples && gpc.examples[0]) || "");
      if (!d) return;
      (d.kind === "seq" ? d.parts : [d]).forEach((p) => {
        (map[p.ipa] = map[p.ipa] || new Set()).add(unit.n);
      });
    });
    return map;
  }

  function ensureLevelMap() {
    const s = hasBank() && PhonicsBank.seq();
    const id = s ? s.id : null;
    if (id !== levelMapSeqId) { ipaLevel = buildLevelMap(); levelMapSeqId = id; }
  }

  function textColourFor(hex) {
    const c = (hex || "#cccccc").replace("#", "");
    const full = c.length === 3 ? c.split("").map((ch) => ch + ch).join("") : c;
    const r = parseInt(full.substring(0, 2), 16) || 0;
    const g = parseInt(full.substring(2, 4), 16) || 0;
    const b = parseInt(full.substring(4, 6), 16) || 0;
    return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#1f1f1f" : "#ffffff";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function colourFor(unit, i) {
    return unit.colour || (hasBank() && PhonicsBank.beltColour ? PhonicsBank.beltColour(i).bg : "#cccccc");
  }

  // Stored formats seen in the wild: "all", a single number N (the old
  // "up to level N" mode — migrated to the levels 1..N it meant), or an
  // array of unit ns (the current any-combo format).
  function loadFocus(seqId) {
    const stored = storedLevelFor(seqId);
    const valid = new Set(programUnits().map((u) => u.n));
    if (Array.isArray(stored)) {
      const set = new Set(stored.filter((n) => valid.has(n)));
      return set.size ? set : "all";
    }
    if (typeof stored === "number" && valid.has(stored)) {
      return new Set([...valid].filter((n) => n <= stored));
    }
    return "all";
  }

  function updateFocusCurrent() {
    const el = document.getElementById("swFocusCurrent");
    if (!el) return;
    if (focusLevels === "all") { el.textContent = "showing every sound"; return; }
    const units = programUnits();
    const picked = units.map((u, i) => ({ u, i })).filter(({ u }) => focusLevels.has(u.n));
    if (!picked.length) { el.textContent = ""; return; }
    if (picked.length === 1) {
      const { u, i } = picked[0];
      el.innerHTML = `<span class="sw-focus-swatch" style="background:${colourFor(u, i)}"></span>${escapeHtml(u.label)}`;
      return;
    }
    el.innerHTML = picked.slice(0, 6).map(({ u, i }) =>
      `<span class="sw-focus-swatch" style="background:${colourFor(u, i)}" title="${escapeHtml(u.label)}"></span>`).join("") +
      (picked.length > 6 ? "&hellip; " : " ") + picked.length + " levels";
  }

  function renderLevelBar() {
    const mount = document.getElementById("wallFocus");
    if (!mount || !hasBank()) return;
    const seq = PhonicsBank.seq();
    const units = programUnits();
    focusLevels = loadFocus(seq.id);

    const chips = units.map((u, i) => {
      const bg = colourFor(u, i);
      const active = focusLevels !== "all" && focusLevels.has(u.n);
      return `<button type="button" class="sw-level-chip${active ? " active" : ""}"
        data-level="${u.n}" title="${escapeHtml(u.label)}" aria-pressed="${active}"
        style="background:${bg};color:${textColourFor(bg)}">${escapeHtml(String(u.n))}</button>`;
    }).join("");
    const allActive = focusLevels === "all";

    mount.innerHTML = `
      <div class="sw-focus-head">
        <span class="sw-focus-label">Focus on <span class="sw-focus-current" id="swFocusCurrent"></span></span>
        <span class="sw-focus-hint">Tap any mix of levels — sounds outside your picks fade. "All" clears.</span>
      </div>
      <div class="sw-level-row" role="group" aria-label="Focus the sound wall on any mix of levels">
        <button type="button" class="sw-level-chip all${allActive ? " active" : ""}"
          data-level="all" title="Show every sound at full strength" aria-pressed="${allActive}">All</button>
        ${chips}
      </div>`;
    updateFocusCurrent();
  }

  // A sound stays full strength if ANY selected level teaches one of its
  // spellings; sounds outside the picked mix fade. Sounds the program's
  // codes never resolve to are always full — safer than guessing.
  function applyFocus() {
    ensureLevelMap();
    const root = document.getElementById("wallBody");
    if (!root) return;
    root.querySelectorAll(".sw-tile").forEach((t) => {
      const taughtIn = ipaLevel[t.dataset.ipa];
      const outside = focusLevels !== "all" && taughtIn != null &&
        ![...taughtIn].some((n) => focusLevels.has(n));
      t.classList.toggle("sw-faint", outside);
    });
  }

  function toggleFocusLevel(seqId, value) {
    if (value === "all") {
      focusLevels = "all";
    } else if (focusLevels === "all") {
      focusLevels = new Set([value]);          // first pick starts a fresh mix
    } else if (focusLevels.has(value)) {
      focusLevels.delete(value);
      if (!focusLevels.size) focusLevels = "all";
    } else {
      focusLevels.add(value);
    }
    saveLevelFor(seqId, focusLevels === "all" ? "all" : [...focusLevels].sort((a, b) => a - b));
    renderLevelBar();
    applyFocus();
    // renderLevelBar() rebuilds the chip row from scratch, so the element a
    // keyboard user just activated is gone — hand focus to its replacement.
    const again = document.querySelector(`#wallFocus .sw-level-chip[data-level="${value}"]`);
    if (again) again.focus();
  }

  /* which trainer codes spell each phoneme */
  function codesByPhoneme() {
    const map = {};
    if (typeof GRAPHEMES === "undefined") return map;
    GRAPHEMES.forEach((g) => {
      g.sounds.forEach((s) => {
        const d = Mouth.descFor(s.s, s.ex);
        if (!d) return;
        (d.kind === "seq" ? d.parts : [d]).forEach((p) => {
          (map[p.ipa] = map[p.ipa] || []).push(g.grapheme);
        });
      });
    });
    Object.keys(map).forEach((k) => { map[k] = [...new Set(map[k])]; });
    return map;
  }

  /* teacher recordings, if the deploy has built a manifest */
  function loadRecordings() {
    return fetch("sounds/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!m) return;
        RECORDINGS = {};
        Object.keys(m).forEach((folder) => {
          const ipa = folder.split(" (")[0];
          const file = m[folder].files && m[folder].files[0];
          if (file) RECORDINGS[ipa] = "sounds/" + encodeURIComponent(folder) + "/" + encodeURIComponent(file);
        });
      })
      .catch(() => {});
  }

  // A teacher recording of the sound itself beats a recording of a code
  // that happens to spell it, so it wins when one exists.
  function audioFor(ipa, codes) {
    if (RECORDINGS && RECORDINGS[ipa]) return RECORDINGS[ipa];
    if (typeof GRAPHEMES === "undefined") return null;
    for (const c of codes || []) {
      const g = GRAPHEMES.find((x) => x.grapheme === c);
      if (g && g.audio) return g.audio + ".mp4";
    }
    return null;
  }

  function playSound(url, tile) {
    if (!url) return;
    if (audioEl) audioEl.pause();
    audioEl = new Audio(url);
    if (tile) {
      tile.classList.add("playing");
      const off = () => tile.classList.remove("playing");
      audioEl.addEventListener("ended", off);
      audioEl.addEventListener("error", off);
    }
    audioEl.play().catch(() => {});
  }

  function tile(d, codes) {
    const url = audioFor(d.ipa, codes);
    // /p/ and /b/ are made in exactly the same place — the only difference is
    // whether the voice is switched on, and that can't be drawn, so say it.
    const voice = d.kind === "c"
      ? `<div class="sw-voice ${d.voiced ? "on" : "off"}">${d.voiced ? "voice on" : "no voice"}</div>` : "";
    const codeChips = (codes || []).map((c) => `<span class="sw-code">${c}</span>`).join("");
    const spelling = codeChips
      ? `<div class="sw-codes">${codeChips}</div>`
      : `<div class="sw-note">${NOTES[d.ipa] || "–"}</div>`;
    return `<div class="sw-tile" data-ipa="${d.ipa}" ${url ? `data-audio="${url}"` : ""} tabindex="0"
                 role="button" aria-label="/${d.ipa}/ as in ${d.eg}">
      ${Mouth.figure(d, "sw-fig")}
      <div class="sw-ipa">/${d.ipa}/</div>
      <div class="sw-eg">${d.eg}</div>
      ${voice}${spelling}
    </div>`;
  }

  function build() {
    const root = document.getElementById("wallBody");
    if (!root) return;
    const inv = Mouth.inventory();
    const codes = codesByPhoneme();
    root.innerHTML = SECTIONS.map((sec) => `
      <div class="sw-section">
        <h2 class="sw-title">${sec.title} <span class="sw-count">${inv[sec.key].length}</span></h2>
        <p class="sw-blurb">${sec.blurb}</p>
        <div class="sw-grid">${inv[sec.key].map((d) => tile(d, codes[d.ipa])).join("")}</div>
      </div>`).join("");
    Mouth.activate(root);
    built = true;
    renderLevelBar();
    applyFocus();
  }

  function open() {
    if (!built) {
      // recordings first so tiles are built knowing what audio exists
      loadRecordings().then(build);
    } else {
      Mouth.resumeAll();
      // the active program may have changed since the wall was last open
      // (the seq picker doesn't rebuild the wall itself) — the tiles are
      // program-independent, but which of them are "not yet" isn't.
      renderLevelBar();
      applyFocus();
    }
  }
  function close() { Mouth.pauseAll(); if (audioEl) audioEl.pause(); }

  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".sw-level-chip");
    if (chip) {
      const seq = hasBank() && PhonicsBank.seq();
      if (seq) toggleFocusLevel(seq.id, chip.dataset.level === "all" ? "all" : parseInt(chip.dataset.level, 10));
      return;
    }
    const t = e.target.closest(".sw-tile");
    if (t && t.dataset.audio) playSound(t.dataset.audio, t);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target.closest && e.target.closest(".sw-tile");
    if (!t) return;
    e.preventDefault();
    const fig = t.querySelector("[data-mouth]");
    if (fig) Mouth.play(fig.dataset.mouth);
    if (t.dataset.audio) playSound(t.dataset.audio, t);
  });

  return { open, close, build };
})();
