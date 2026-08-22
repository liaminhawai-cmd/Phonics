// ============================================================
// js/views/explorer.js — the Sequence Explorer page.
//
// Demonstrates docs/ARCHITECTURE.md principles 1-2: one bank,
// many orderings, and every sequence has two derived faces
// (grapheme-first / phoneme-first). This file never hardcodes
// program content — everything comes from window.PhonicsBank.
//
// Split in two halves on purpose:
//   PhonicsExplorerModel — pure, DOM-free functions. Easy to unit
//     test from Node (see scratchpad harness) without a browser.
//   the IIFE below it     — DOM wiring, only runs when `document`
//     exists, so this same file loads harmlessly in a headless
//     Node context for testing the model half.
// ============================================================

window.PhonicsExplorerModel = (() => {
  // Pastel fallback palette for sequences that don't ship printed
  // colours (only elc-bookmarks does — it must match the real
  // bookmarks). Cycled by unit index.
  const FALLBACK_PALETTE = [
    "#cfe0f5", "#d4e6c5", "#f3cbc4", "#dcd6ec", "#fbecc2",
    "#d6e5ec", "#f5c9df", "#e3ddc9", "#c9e8df", "#ece0f7",
  ];

  // index.json entries -> <select> options. Skips 0-unit entries
  // (the empty custom-sequence template isn't a program to browse).
  function sequenceOptions(sequences) {
    return (sequences || []).filter(s => s.units > 0);
  }

  // grapheme-first is the default; a native phoneme-first program
  // (Sound Waves) opens on the Sounds view instead.
  function pickDefaultView(entry) {
    return entry && entry.native_view === "phoneme_first" ? "sounds" : "graphemes";
  }

  // The 70 original mouth videos live at the repo root as
  // <Capitalised-grapheme>.mp4 (ai -> Ai.mp4, eigh -> Eigh.mp4).
  // We don't check the file exists; PhonicsAudio's fallback chain
  // silently skips a missing one.
  function mp4StemFor(grapheme) {
    if (!grapheme) return null;
    return grapheme.charAt(0).toUpperCase() + grapheme.slice(1);
  }

  // Fill in a fallback colour for any unit missing a printed one.
  function withFallbackColours(units, palette) {
    const pal = palette && palette.length ? palette : FALLBACK_PALETTE;
    const belt = typeof window !== "undefined" && window.PhonicsBank && window.PhonicsBank.beltColour;
    return (units || []).map((u, i) => Object.assign({}, u, {
      colour: u.colour || (belt ? belt(i).bg : pal[i % pal.length]),
    }));
  }

  // Pick readable text colour (ink or white) for a background hex.
  function textColourFor(hex) {
    const c = (hex || "#cccccc").replace("#", "");
    const full = c.length === 3 ? c.split("").map(ch => ch + ch).join("") : c;
    const r = parseInt(full.substring(0, 2), 16) || 0;
    const g = parseInt(full.substring(2, 4), 16) || 0;
    const b = parseInt(full.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#1f1f1f" : "#ffffff";
  }

  // Words containing a given grapheme, short-first. `segmentsOf`
  // lets callers pass PhonicsBank.segmentsFor (accent-aware) while
  // keeping this function itself pure/DOM-free for testing.
  function wordsForGrapheme(words, grapheme, opts = {}) {
    const limit = opts.limit == null ? 12 : opts.limit;
    const segmentsOf = opts.segmentsOf || (w => w.segments || []);
    return (words || [])
      .filter(w => segmentsOf(w).some(s => s.g === grapheme))
      .slice()
      .sort((a, b) => (a.word.length - b.word.length) || a.word.localeCompare(b.word))
      .slice(0, limit);
  }

  // Build gpc.id -> short sound label ("/ai/") from an *unbounded*
  // phonemeView() call. Reuses PhonicsBank.phonemeLabel so the
  // grouping logic for composite/teaching-unit GPCs (x -> ks, qu ->
  // kw, long-u -> yoo) never has to be duplicated here — that
  // resolution already happened inside PhonicsBank.phonemeView().
  function buildGpcSoundLabels(fullPhonemeRows, phonemeLabelFn) {
    const map = {};
    for (const row of fullPhonemeRows || []) {
      const label = phonemeLabelFn ? phonemeLabelFn(row.phoneme) : row.label;
      for (const sp of row.spellings || []) map[sp.gpc.id] = label;
    }
    return map;
  }

  return {
    FALLBACK_PALETTE,
    sequenceOptions,
    pickDefaultView,
    mp4StemFor,
    withFallbackColours,
    textColourFor,
    wordsForGrapheme,
    buildGpcSoundLabels,
  };
})();

// ============================================================
// DOM wiring — only runs in a browser. Guarded so this file can
// be loaded in a plain Node vm context (no `document`) to exercise
// the model functions above in isolation.
// ============================================================
if (typeof document !== "undefined") {
  (function () {
    const M = window.PhonicsExplorerModel;

    const els = {};
    let decodableCache = new Map(); // "seqId|unitN" -> Promise<words[]>
    let gpcLabelCache = new Map();  // seqId -> {gpcId: shortLabel}
    let state = { view: "graphemes", uptoUnit: 1, openGrapheme: null, openSpelling: null };

    function q(id) { return document.getElementById(id); }

    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[ch]));
    }

    function cacheKeyFor(unitN) {
      return (PhonicsBank.seq().id || "seq") + "|" + unitN;
    }

    // Decodable words up to a given unit, cached per (sequence, unit).
    function decodableForUnit(unitN) {
      const key = cacheKeyFor(unitN);
      if (!decodableCache.has(key)) {
        decodableCache.set(key, PhonicsBank.decodableWords({ uptoUnit: unitN }));
      }
      return decodableCache.get(key);
    }

    function gpcLabelsForActiveSeq() {
      const id = PhonicsBank.seq().id;
      if (!gpcLabelCache.has(id)) {
        const full = PhonicsBank.phonemeView(); // unbounded -> stable id->label map
        gpcLabelCache.set(id, M.buildGpcSoundLabels(full, PhonicsBank.phonemeLabel));
      }
      return gpcLabelCache.get(id);
    }

    // ---- status / error states -----------------------------------
    function setStatus(kind, html) {
      els.status.hidden = kind === "hidden";
      els.status.className = "status-box" + (kind === "error" ? " status-error" : "");
      if (kind !== "hidden") els.status.innerHTML = html;
    }

    // ---- controls ---------------------------------------------------
    function populateProgramSelect() {
      const opts = M.sequenceOptions(PhonicsBank.sequences());
      els.programSelect.innerHTML = opts.map(s => {
        const label = s.name + " (" + (s.region || "—") + ")" + (s.approximate ? " — approx." : "");
        return `<option value="${escapeHtml(s.id)}">${escapeHtml(label)}</option>`;
      }).join("");
      els.programSelect.value = PhonicsBank.seq().id;
    }

    function currentSeqEntry() {
      return PhonicsBank.sequences().find(s => s.id === PhonicsBank.seq().id);
    }

    function resetForNewSequence() {
      const entry = currentSeqEntry();
      state.view = M.pickDefaultView(entry);
      state.openGrapheme = null;
      state.openSpelling = null;
      const units = PhonicsBank.seq().units;
      state.uptoUnit = units.length ? units[units.length - 1].n : 1;
      const minN = units.length ? units[0].n : 1;
      els.slider.min = String(minN);
      els.slider.max = String(state.uptoUnit);
      els.slider.value = String(state.uptoUnit);
      updateViewButtons();
      updateApproxNote(entry);
    }

    function updateApproxNote(entry) {
      if (entry && entry.approximate) {
        const seq = PhonicsBank.seq();
        els.approxNote.hidden = false;
        els.approxNote.textContent = "⚠ " + (seq.accuracy_note ||
          "This program's unit order is reconstructed from public information — verify against the official chart before classroom use.");
      } else {
        els.approxNote.hidden = true;
      }
    }

    function updateViewButtons() {
      els.viewGraphemes.classList.toggle("active", state.view === "graphemes");
      els.viewSounds.classList.toggle("active", state.view === "sounds");
      els.graphemePanel.hidden = state.view !== "graphemes";
      els.soundPanel.hidden = state.view !== "sounds";
    }

    function updateUptoLabel() {
      const unit = PhonicsBank.seq().units.find(u => u.n === state.uptoUnit);
      els.uptoLabel.textContent = unit ? unit.label : ("unit " + state.uptoUnit);
    }

    // ---- grapheme view ------------------------------------------------
    function renderGraphemeView() {
      const units = M.withFallbackColours(PhonicsBank.graphemeView(state.uptoUnit));
      if (!units.length) {
        els.graphemePanel.innerHTML = `<p class="empty-note">No units yet at this point in the program.</p>`;
        return;
      }
      els.graphemePanel.innerHTML = units.map(renderUnitCard).join("");
      const openGrapheme = state.openGrapheme;
      if (openGrapheme) {
        const holder = els.graphemePanel.querySelector(
          `.gpc-detail[data-unit="${openGrapheme.unit}"][data-grapheme="${cssEscape(openGrapheme.grapheme)}"]`
        );
        if (holder) fillGraphemeDetail(holder, openGrapheme.unit, openGrapheme.grapheme);
      }
    }

    function cssEscape(s) {
      return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&");
    }

    function renderUnitCard(unit) {
      const textCol = M.textColourFor(unit.colour);
      const chips = unit.graphemes.map(g => {
        const active = state.openGrapheme && state.openGrapheme.unit === unit.n && state.openGrapheme.grapheme === g.grapheme;
        return `<button type="button" class="g-explorer-chip${active ? " active" : ""}"
          data-role="grapheme-chip" data-unit="${unit.n}" data-grapheme="${escapeHtml(g.grapheme)}">
          ${escapeHtml(g.display)}
        </button>`;
      }).join("");

      const heartChips = (unit.heart_words || []).map(w =>
        `<button type="button" class="heart-chip" data-role="play-word" data-word="${escapeHtml(w)}">♥ ${escapeHtml(w)}</button>`
      ).join("");

      const reviewNote = (unit.review || []).length
        ? `<div class="unit-review">Review: ${unit.review.map(gid => {
            const g = PhonicsBank.gpc(gid);
            return escapeHtml(g ? g.display : gid);
          }).join(", ")}</div>`
        : "";
      const notesNote = unit.notes ? `<div class="unit-notes">${escapeHtml(unit.notes)}</div>` : "";

      return `
      <article class="unit-card">
        <div class="unit-bar" style="background:${unit.colour};color:${textCol}">
          <span class="unit-label">${escapeHtml(unit.label)}</span>
        </div>
        <div class="unit-body">
          ${reviewNote}
          <div class="grapheme-chip-row">${chips || '<span class="empty-note">No new graphemes.</span>'}</div>
          <div class="detail-slot" data-unit-slot="${unit.n}"></div>
          ${heartChips ? `<div class="heart-row"><span class="heart-row-label">Heart words</span>${heartChips}</div>` : ""}
          ${notesNote}
        </div>
      </article>`;
    }

    function toggleGraphemeDetail(unitN, grapheme) {
      const same = state.openGrapheme && state.openGrapheme.unit === unitN && state.openGrapheme.grapheme === grapheme;
      // collapse whichever card slot currently holds a detail block
      document.querySelectorAll(".detail-slot").forEach(slot => { slot.innerHTML = ""; });
      document.querySelectorAll('[data-role="grapheme-chip"].active').forEach(el => el.classList.remove("active"));
      if (same) {
        state.openGrapheme = null;
        return;
      }
      state.openGrapheme = { unit: unitN, grapheme };
      const chip = els.graphemePanel.querySelector(
        `[data-role="grapheme-chip"][data-unit="${unitN}"][data-grapheme="${cssEscape(grapheme)}"]`
      );
      if (chip) chip.classList.add("active");
      const slot = els.graphemePanel.querySelector(`.detail-slot[data-unit-slot="${unitN}"]`);
      if (slot) fillGraphemeDetail(slot, unitN, grapheme);
    }

    function fillGraphemeDetail(slot, unitN, grapheme) {
      const units = PhonicsBank.graphemeView(unitN);
      const unit = units.find(u => u.n === unitN);
      const gEntry = unit && unit.graphemes.find(g => g.grapheme === grapheme);
      if (!gEntry) { slot.innerHTML = ""; return; }
      const labels = gpcLabelsForActiveSeq();

      const gpcRows = gEntry.gpcs.map(g => {
        const label = labels[g.id] || PhonicsBank.phonemeLabel(Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes);
        const examples = (g.examples || []).slice(0, 3).map(w =>
          `<button type="button" class="example-chip" data-role="play-word" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`
        ).join("");
        return `<div class="gpc-row" data-role="play-gpc" data-gpc="${escapeHtml(g.id)}" data-mp4stem="${escapeHtml(M.mp4StemFor(grapheme))}">
          <div class="gpc-row-head">
            <span class="gpc-sound-label">${escapeHtml(label)}</span>
          </div>
          <div class="example-row">${examples}</div>
        </div>`;
      }).join("");

      slot.innerHTML = `
        <div class="gpc-detail" data-unit="${unitN}" data-grapheme="${escapeHtml(grapheme)}">
          ${gpcRows}
          <div class="word-strip" data-role="word-strip">
            <span class="word-strip-label">Words you can read now</span>
            <span class="word-strip-body">Loading…</span>
          </div>
        </div>`;

      decodableForUnit(unitN).then(words => {
        const matches = M.wordsForGrapheme(words, grapheme, { segmentsOf: PhonicsBank.segmentsFor });
        const body = slot.querySelector(".word-strip-body");
        if (!body) return; // detail was closed/re-rendered before this resolved
        body.innerHTML = matches.length
          ? matches.map(w => `<button type="button" class="word-chip" data-role="play-word" data-word="${escapeHtml(w.id || w.word)}">${escapeHtml(w.word)}</button>`).join("")
          : `<span class="empty-note">No decodable words yet.</span>`;
      });
    }

    // ---- sounds view ------------------------------------------------
    function renderSoundView() {
      const rows = PhonicsBank.phonemeView(state.uptoUnit);
      if (!rows.length) {
        els.soundPanel.innerHTML = `<p class="empty-note">No sounds taught yet at this point in the program.</p>`;
        return;
      }
      els.soundPanel.innerHTML = rows.map(renderPhonemeRow).join("");
    }

    function renderPhonemeRow(row) {
      const ipaBadge = row.ipa ? `<span class="ipa-badge">/${escapeHtml(row.ipa)}/</span>` : "";
      const chips = row.spellings.map(sp => {
        const active = state.openSpelling === sp.gpc.id;
        return `<button type="button" class="spelling-chip${active ? " active" : ""}"
          data-role="spelling-chip" data-phoneme="${escapeHtml(row.phoneme)}" data-gpc="${escapeHtml(sp.gpc.id)}"
          data-grapheme="${escapeHtml(sp.gpc.grapheme)}" data-unit="${sp.unit_n}">
          <span class="spelling-gr">${escapeHtml(sp.gpc.display || sp.gpc.grapheme)}</span>
          <span class="spelling-unit">unit ${sp.unit_n}</span>
        </button>`;
      }).join("");
      return `
      <div class="phoneme-row" data-type="${escapeHtml(row.type || "unit")}">
        <div class="phoneme-head">
          <span class="phoneme-label">${escapeHtml(row.label)}</span>
          ${ipaBadge}
          <button type="button" class="speaker-btn" data-role="play-phoneme" data-phoneme="${escapeHtml(row.phoneme)}" aria-label="Play sound">🔊</button>
        </div>
        <div class="spelling-chip-row">${chips}</div>
        <div class="spelling-detail" data-role="spelling-detail"></div>
      </div>`;
    }

    function toggleSpellingDetail(rowEl, gpcId, grapheme) {
      const holder = rowEl.querySelector('[data-role="spelling-detail"]');
      const wasActive = state.openSpelling === gpcId;
      document.querySelectorAll(".spelling-chip.active").forEach(el => el.classList.remove("active"));
      document.querySelectorAll('[data-role="spelling-detail"]').forEach(el => { el.innerHTML = ""; });
      if (wasActive) { state.openSpelling = null; return; }
      state.openSpelling = gpcId;
      const chip = rowEl.querySelector(`.spelling-chip[data-gpc="${cssEscape(gpcId)}"]`);
      if (chip) chip.classList.add("active");
      const g = PhonicsBank.gpc(gpcId);
      if (!g || !holder) return;
      const examples = (g.examples || []).slice(0, 4).map(w =>
        `<button type="button" class="example-chip" data-role="play-word" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`
      ).join("");
      holder.innerHTML = `<div class="example-row">${examples || '<span class="empty-note">No examples recorded.</span>'}</div>`;
    }

    // ---- render -------------------------------------------------------
    function render() {
      updateUptoLabel();
      if (state.view === "graphemes") renderGraphemeView(); else renderSoundView();
    }

    // ---- event delegation ---------------------------------------------
    function wireEvents() {
      els.programSelect.addEventListener("change", async () => {
        setStatus("loading", "Switching program…");
        try {
          await PhonicsBank.setSequence(els.programSelect.value);
          resetForNewSequence();
          setStatus("hidden");
          render();
        } catch (err) {
          setStatus("error", "Couldn't load that program.<br><small>" + escapeHtml(err.message || String(err)) + "</small>");
        }
      });

      els.viewGraphemes.addEventListener("click", () => { state.view = "graphemes"; updateViewButtons(); render(); });
      els.viewSounds.addEventListener("click", () => { state.view = "sounds"; updateViewButtons(); render(); });

      els.slider.addEventListener("input", () => {
        state.uptoUnit = parseInt(els.slider.value, 10);
        state.openGrapheme = null;
        state.openSpelling = null;
        render();
      });

      els.graphemePanel.addEventListener("click", e => {
        const chip = e.target.closest('[data-role="grapheme-chip"]');
        if (chip) {
          const unitN = parseInt(chip.dataset.unit, 10);
          const grapheme = chip.dataset.grapheme;
          const unit = PhonicsBank.graphemeView(unitN).find(u => u.n === unitN);
          const gEntry = unit && unit.graphemes.find(g => g.grapheme === grapheme);
          const firstGpc = gEntry && gEntry.gpcs[0];
          if (firstGpc) PhonicsAudio.playGpc(firstGpc.id, { mp4Stem: M.mp4StemFor(grapheme) });
          toggleGraphemeDetail(unitN, grapheme);
          return;
        }
        const gpcRow = e.target.closest('[data-role="play-gpc"]');
        if (gpcRow && !e.target.closest('[data-role="play-word"]')) {
          PhonicsAudio.playGpc(gpcRow.dataset.gpc, { mp4Stem: gpcRow.dataset.mp4stem || null });
          return;
        }
        const wordBtn = e.target.closest('[data-role="play-word"]');
        if (wordBtn) { PhonicsAudio.playWord(wordBtn.dataset.word); return; }
      });

      els.soundPanel.addEventListener("click", e => {
        const speaker = e.target.closest('[data-role="play-phoneme"]');
        if (speaker) { PhonicsAudio.playPhoneme(speaker.dataset.phoneme); return; }
        const spellingChip = e.target.closest('[data-role="spelling-chip"]');
        if (spellingChip) {
          PhonicsAudio.playGpc(spellingChip.dataset.gpc, { mp4Stem: M.mp4StemFor(spellingChip.dataset.grapheme) });
          toggleSpellingDetail(spellingChip.closest(".phoneme-row"), spellingChip.dataset.gpc, spellingChip.dataset.grapheme);
          return;
        }
        const wordBtn = e.target.closest('[data-role="play-word"]');
        if (wordBtn) { PhonicsAudio.playWord(wordBtn.dataset.word); return; }
      });
    }

    // ---- boot -----------------------------------------------------------
    async function init() {
      els.status = q("statusBox");
      els.programSelect = q("programSelect");
      els.viewGraphemes = q("viewGraphemesBtn");
      els.viewSounds = q("viewSoundsBtn");
      els.slider = q("uptoSlider");
      els.uptoLabel = q("uptoLabel");
      els.approxNote = q("approxNote");
      els.graphemePanel = q("graphemePanel");
      els.soundPanel = q("soundPanel");

      setStatus("loading", "Loading the sound bank…");
      try {
        await PhonicsBank.load();
      } catch (err) {
        setStatus("error", "Couldn't load the phonics data bank. Try refreshing the page.<br><small>" + escapeHtml(err.message || String(err)) + "</small>");
        return;
      }
      populateProgramSelect();
      resetForNewSequence();
      wireEvents();
      setStatus("hidden");
      render();
    }

    document.addEventListener("DOMContentLoaded", init);
  })();
}
