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
  // clips.json lists every recording we have, with its length. That makes
  // it an index as well as a warning list: if a path is in it the file
  // exists, if it isn't, it doesn't. Both facts save a round trip —
  // have() stops issuing a HEAD per letter, and the legacy lookup stops
  // fetching a manifest that only the Pronunciation Hub fills in.
  let tooShort = null;
  let known = null;
  (function loadClipReport() {
    if (typeof fetch !== "function") return;
    fetch(base + "recordings/clips.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        tooShort = new Set((j && j.tooShort) || []);
        known = j && j.durations ? new Set(Object.keys(j.durations)) : null;
      })
      .catch(() => { tooShort = new Set(); });
  })();

  const truncated = (rel) => !!(tooShort && tooShort.has(rel));
  // true / false when the index can answer, null when it cannot
  const indexed = (rel) => (known ? known.has(rel) : null);

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
    // That folder is the Pronunciation Hub's drop box and is empty here,
    // so don't go looking when we already have the sound ourselves.
    if (accent() !== "au" || !window.PhonicsBank) return null;
    if (indexed("recordings/au/phonemes/" + phonemeId + ".mp3")) return null;
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
  // Some graphemes are more than one phoneme: <qu> is /k/+/w/, <x> is
  // /k/+/s/, <ing> is /i/+/ng/. 33 GPCs in the bank are like this, and
  // taking phonemes[0] made every one of them play only its first sound —
  // <qu> came out as /k/. If there is no single recording of the blend,
  // the parts get played in order, close together so they read as one
  // unit rather than as separate sounds.
  const phonemesOf = (g) => (Array.isArray(g.phonemes) ? g.phonemes : [g.phonemes]).filter(Boolean);

  /* How long to leave between the pieces of a spoken reading. <ow> should
     come out as  "O · W  ——  /ow/  ——  /oa/": the letter names belong
     together as the name of one code, then a clear break before the sounds
     it makes, and a clear break between one sound and the next.
       BLEND_GAP   inside one sound that is two phonemes (<qu> = /k/+/w/)
       LETTER_GAP  between the letters of the code
       SOUND_GAP   after the last letter, and between sounds            */
  const BLEND_GAP = 90;
  const LETTER_GAP = 200;
  const SOUND_GAP = 620;

  async function playGpc(gpcOrId, opts = {}) {
    const g = typeof gpcOrId === "string" ? (window.PhonicsBank && PhonicsBank.gpc(gpcOrId)) : gpcOrId;
    const srcs = [];
    if (opts.mp4Stem) srcs.push(opts.mp4Stem + ".mp4");
    if (!g) return playChain(srcs, null);

    const phs = phonemesOf(g);
    const first = phs[0];
    const a = accent();
    // A recording of the whole blend wins when one exists (k_w.mp3).
    if (phs.length > 1) {
      const joined = "recordings/" + a + "/phonemes/" + phs.join("_") + ".mp3";
      if (!truncated(joined) && await have(joined)) return playChain([...srcs, joined], null);
      if (srcs.length && await have(srcs[0])) return playChain(srcs, null);
      return playSequence(phs.map((ph) => ({ phoneme: ph })), BLEND_GAP);
    }

    srcs.push("recordings/" + a + "/phonemes/" + first + ".mp3");
    const legacy = await legacySrcFor(first);
    if (legacy) srcs.push(legacy);
    const p = window.PhonicsBank && PhonicsBank.phoneme(first);
    const example = (g.examples && g.examples[0]) || (p && p.examples && p.examples[0]);
    return playChain(srcs, () => { if (example) speak(example); });
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
      const gap = it.gapAfter != null ? it.gapAfter : gapMs;
      if (i < items.length - 1) await new Promise((r) => setTimeout(r, gap));
    }
    return mine === runToken;
  }

  // Does a clip actually exist? (HEAD, cached) — lets callers prefer the
  // composed letter+sound reading only when the pieces are really there.
  const haveCache = {};
  async function have(rel) {
    if (truncated(rel)) return false;   // present, but not usable
    const idx = indexed(rel);
    if (idx !== null) return idx;       // the clip index already knows
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

    // Every sound this code makes, in the teacher's own voice. Inside one
    // GPC the parts sit close together, so <qu> reads as one sound rather
    // than as /k/ … /w/.
    const soundItems = [];
    for (const id of (gpcIds || [])) {
      const g = window.PhonicsBank && PhonicsBank.gpc(id);
      if (!g) continue;
      const phs = phonemesOf(g);
      phs.forEach((ph, i) => soundItems.push({
        phoneme: ph,
        gapAfter: i < phs.length - 1 ? BLEND_GAP : SOUND_GAP,
      }));
    }

    const haveLetters = letters.length && (await Promise.all(
      letters.map((c) => have("recordings/" + a + "/letters/" + c + ".mp3"))
    )).every(Boolean);

    const items = haveLetters
      ? letters.map((c, i) => ({ letter: c, gapAfter: i < letters.length - 1 ? LETTER_GAP : SOUND_GAP }))
      : [];
    items.push(...soundItems);

    if (items.length) {
      delete items[items.length - 1].gapAfter;
      return playSequence(items, opts.gapMs);
    }
    // Nothing of our own to play. The old narrated videos are the last
    // resort, not the first: one missing letter-name clip used to send the
    // whole reading to them, so <ti> played someone else's voice even
    // though /sh/ was recorded. Re-record the letter names that
    // scripts/check_recordings.py flags and the names come back.
    if (opts.mp4Stem) return playChain([opts.mp4Stem + ".mp4"], null);
    return playGpc((gpcIds && gpcIds[0]) || null, opts);
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
