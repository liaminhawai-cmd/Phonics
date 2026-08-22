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
        const audio = new Audio(base + srcs[i++]);
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

  return { playPhoneme, playWord, playGpc, playPrompt, speak, stop, setBase };
})();
