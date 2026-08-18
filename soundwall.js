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
  }

  function open() {
    if (!built) {
      // recordings first so tiles are built knowing what audio exists
      loadRecordings().then(build);
    } else {
      Mouth.resumeAll();
    }
  }
  function close() { Mouth.pauseAll(); if (audioEl) audioEl.pause(); }

  document.addEventListener("click", (e) => {
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
