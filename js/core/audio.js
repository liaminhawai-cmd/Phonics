// ============================================================
// js/core/audio.js — window.PhonicsAudio
//
// One way to hear anything, with the fallback chain from
// docs/ARCHITECTURE.md §4:
//
//   human recording (recordings/<accent>/…)
//     -> TTS stand-in file (recordings/tts/<accent>/…)
//       -> legacy AU phoneme folders (sounds/…, via sounds/manifest.json)
//         -> live speechSynthesis in the accent's voice
//
// Drop a real recording into recordings/ and the same call sites
// silently upgrade. Depends on PhonicsBank for accent + phoneme
// metadata; degrades to speechSynthesis alone if the bank isn't
// loaded.
// ============================================================

window.PhonicsAudio = (() => {
  let base = "";
  let current = null;               // the Audio element now playing
  let soundsManifest = undefined;   // sounds/manifest.json cache (undefined = not tried)

  // ---- clips that were cut off in export -------------------------------
  // A truncated clip does not fail, it plays: a 50 ms fragment of someone
  // saying "ay" is a click, and a child hears the app make a noise that
  // isn't the sound they were asked for. That is worse than having no
  // recording at all, because a missing file falls through to the next
  // source and a click does not.
  //
  // recordings/clips.json is written by scripts/check_recordings.py and
  // lists them by path. Loading it is fire-and-forget: until it arrives
  // nothing is skipped, which is the same behaviour as before.
  let tooShort = null;
  (function loadClipReport() {
    if (typeof fetch !== "function") return;
    fetch(base + "recordings/clips.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { tooShort = new Set((j && j.tooShort) || []); })
      .catch(() => { tooShort = new Set(); });
  })();

  const truncated = (rel) => !!(tooShort && tooShort.has(rel));

  const accent = () => (window.PhonicsBank && PhonicsBank.accent) || "au";
  const LANG = { au: "en-AU", uk: "en-GB", us: "en-US" };

  function stop() {
    if (current) { current.pause(); current = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  // Try each src in order; resolve true on first that plays, else run
  // ttsFallback (if any) and resolve false.
  function playChain(srcs, ttsFallback) {
    stop();
    return new Promise(resolve => {
      let i = 0;
      const tryNext = () => {
        if (i >= srcs.length) {
          if (ttsFallback) ttsFallback();
          resolve(false);
          return;
        }
        const rel = srcs[i++];
        // Treat a clipped recording exactly like a missing one. The check is
        // synchronous against an already-loaded list on purpose: probing the
        // real duration would mean calling play() after an await, and the
        // browser's autoplay rules can refuse that once it is no longer in
        // the same turn as the child's tap.
        if (truncated(rel)) { tryNext(); return; }
        const audio = new Audio(base + rel);
        audio.onerror = tryNext;
        current = audio;
        audio.play().then(() => resolve(true)).catch(tryNext);
      };
      tryNext();
    });
  }

  function speak(text, rate = 0.85) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const lang = LANG[accent()] || "en-AU";
    utt.lang = lang;
    const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.replace("_", "-").startsWith(lang));
    if (voice) utt.voice = voice;
    utt.rate = rate;
    speechSynthesis.speak(utt);
  }

  async function legacySrcFor(phonemeId) {
    // Old AU recordings live in sounds/"<ipa (ex[a]mple)>"/ — the deploy
    // workflow writes sounds/manifest.json listing each folder's files.
    if (accent() !== "au" || !window.PhonicsBank) return null;
    const p = PhonicsBank.phoneme(phonemeId);
    const folder = p && p.recording && p.recording.legacy_sounds_folder;
    if (!folder) return null;
    if (soundsManifest === undefined) {
      try {
        const res = await fetch(base + "sounds/manifest.json");
        soundsManifest = res.ok ? await res.json() : null;
      } catch (e) { soundsManifest = null; }
    }
    const entry = soundsManifest && soundsManifest[folder];
    if (!entry || !entry.files || !entry.files.length) return null;
    return "sounds/" + encodeURIComponent(folder) + "/" + encodeURIComponent(entry.files[0]);
  }

  async function playPhoneme(id) {
    const a = accent();
    const srcs = ["recordings/" + a + "/phonemes/" + id + ".mp3"];
    const legacy = await legacySrcFor(id);
    if (legacy) srcs.push(legacy);
    const p = window.PhonicsBank ? PhonicsBank.phoneme(id) : null;
    const example = p && p.examples && p.examples[0];
    return playChain(srcs, () => { if (example) speak(example); });
  }

  function playWord(wordOrEntry) {
    const id = typeof wordOrEntry === "string" ? wordOrEntry : (wordOrEntry.id || wordOrEntry.word);
    const text = typeof wordOrEntry === "string" ? wordOrEntry : wordOrEntry.word;
    const a = accent();
    return playChain(
      ["recordings/" + a + "/words/" + id + ".mp3",
       "recordings/tts/" + a + "/words/" + id + ".mp3"],
      () => speak(text)
    );
  }

  // A grapheme's sound: the GPC's phoneme recording; optional mp4Stem plays
  // the existing root-level mouth videos first (e.g. "Ai" -> Ai.mp4).
  async function playGpc(gpcOrId, opts = {}) {
    const g = typeof gpcOrId === "string" ? (window.PhonicsBank && PhonicsBank.gpc(gpcOrId)) : gpcOrId;
    const srcs = [];
    if (opts.mp4Stem) srcs.push(opts.mp4Stem + ".mp4");
    if (g) {
      const first = Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes;
      const a = accent();
      srcs.push("recordings/" + a + "/phonemes/" + (Array.isArray(g.phonemes) ? g.phonemes.join("_") : g.phonemes) + ".mp3");
      const legacy = await legacySrcFor(first);
      if (legacy) srcs.push(legacy);
      const p = window.PhonicsBank && PhonicsBank.phoneme(first);
      const example = (g.examples && g.examples[0]) || (p && p.examples && p.examples[0]);
      return playChain(srcs, () => { if (example) speak(example); });
    }
    return playChain(srcs, null);
  }

  // A letter's NAME ("bee"), not its sound — recordings/<accent>/letters/<x>.mp3.
  // Separate namespace from phonemes/ on purpose: "bee" and /b/ share the id "b"
  // but live in different folders.
  function playLetter(ch) {
    const c = String(ch || "").toLowerCase();
    if (!/^[a-z]$/.test(c)) return Promise.resolve(false);
    return playChain(["recordings/" + accent() + "/letters/" + c + ".mp3"], null);
  }

  // Play a list of clips back to back with a gap, so a grapheme card can say
  // "A … /a/ … /ay/ … /ah/" out of the reusable letter and phoneme pieces
  // instead of one baked <Grapheme>.mp4. Stops cleanly if something else
  // starts playing (each step checks it still owns the run).
  let runToken = 0;
  async function playSequence(items, gapMs = 420) {
    const mine = ++runToken;
    for (let i = 0; i < items.length; i++) {
      if (mine !== runToken) return false;
      const it = items[i];
      if (it.letter) await playLetter(it.letter);
      else if (it.phoneme) await playPhoneme(it.phoneme);
      else if (it.word) await playWord(it.word);
      if (mine !== runToken) return false;
      if (i < items.length - 1) await new Promise((r) => setTimeout(r, gapMs));
    }
    return mine === runToken;
  }

  // Does a clip actually exist? (HEAD, cached) — lets callers prefer the
  // composed letter+sound reading only when the pieces are really there.
  const haveCache = {};
  async function have(rel) {
    if (truncated(rel)) return false;   // present, but not usable
    if (rel in haveCache) return haveCache[rel];
    try {
      const res = await fetch(base + rel, { method: "HEAD" });
      haveCache[rel] = res.ok;
    } catch (e) { haveCache[rel] = false; }
    return haveCache[rel];
  }

  // The full reading of a grapheme: its letter names, then each sound it makes.
  // Falls back to the caller's legacy mp4 when the letter clips aren't recorded
  // for this accent yet.
  async function playGraphemeReading(grapheme, gpcIds, opts = {}) {
    const letters = String(grapheme || "").replace(/[^a-z]/gi, "").toLowerCase().split("");
    const a = accent();
    const ok = letters.length && (await Promise.all(
      letters.map((c) => have("recordings/" + a + "/letters/" + c + ".mp3"))
    )).every(Boolean);
    if (!ok) {
      if (opts.mp4Stem) return playChain([opts.mp4Stem + ".mp4"], null);
      return playGpc((gpcIds && gpcIds[0]) || null, opts);
    }
    const items = letters.map((c) => ({ letter: c }));
    for (const id of (gpcIds || [])) {
      const g = window.PhonicsBank && PhonicsBank.gpc(id);
      const ph = g && (Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes);
      if (ph) items.push({ phoneme: ph });
    }
    return playSequence(items, opts.gapMs);
  }

  // Spoken interface prompts ("Write it", "Check") — the words the app says
  // to a child who can't read yet. data/ui-prompts.json carries the text;
  // a human recording in recordings/<accent>/ui/ upgrades it silently.
  let promptText = null;
  async function playPrompt(id) {
    if (promptText === null) {
      try {
        const res = await fetch(base + "data/ui-prompts.json");
        const json = res.ok ? await res.json() : { prompts: [] };
        promptText = {};
        for (const p of json.prompts || []) promptText[p.id] = p.text;
      } catch (e) { promptText = {}; }
    }
    const text = promptText[id];
    return playChain(["recordings/" + accent() + "/ui/" + id + ".mp3"],
                     () => { if (text) speak(text, 1); });
  }

  function setBase(b) { base = b || ""; }

  return { playPhoneme, playWord, playGpc, playLetter, playSequence,
           playGraphemeReading, playPrompt, speak, stop, setBase,
           // exposed so a page can show which recordings need redoing
           truncated, clipReport: () => tooShort };
})();
