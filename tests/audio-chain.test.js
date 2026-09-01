// ============================================================
// tests/audio-chain.test.js
//
// What does the app ACTUALLY play? Not what the source looks
// like — the earlier version of these checks matched on source
// shape and happily passed a version that had gone back to
// playing phonemes[0], and one that reached for the old narrated
// mp4 before the teacher's own recordings.
//
// So this runs js/core/audio.js for real against a fake browser
// and records the ordered list of files it reaches for.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BANK = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "phonemes.json"), "utf8"));
const GPCS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "gpcs.json"), "utf8")).gpcs;
const CLIPS = JSON.parse(fs.readFileSync(path.join(ROOT, "recordings", "clips.json"), "utf8"));

// A browser just real enough for audio.js: files that exist, files that are
// flagged short, and a log of everything it tried to play or say.
function harness(opts) {
  opts = opts || {};
  // opts.alsoRecorded: clips the teacher has since recorded. They have to go
  // into the clip index, not just onto the server — audio.js treats
  // recordings/clips.json as the complete list and never HEADs past it.
  const clips = JSON.parse(JSON.stringify(CLIPS));
  for (const f of opts.alsoRecorded || []) clips.durations[f] = 0.4;
  const exists = new Set(opts.exists || Object.keys(clips.durations));
  const played = [], spoke = [], probed = [];

  const fakeAudio = function (src) {
    this.src = src;
    played.push(src);
    this.play = () => Promise.resolve();
    this.pause = () => {};
  };
  const fakeFetch = (url, init) => {
    if (init && init.method === "HEAD") {
      probed.push(url);
      return Promise.resolve({ ok: exists.has(url) });
    }
    if (url === "recordings/clips.json") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(clips) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
  };
  const win = {
    PhonicsBank: {
      accent: "au",
      phoneme: (id) => BANK.phonemes.find((p) => p.id === id) || null,
      gpc: (id) => GPCS.find((g) => g.id === id) || null,
    },
    speechSynthesis: { cancel() {}, speak(u) { spoke.push(u.text); }, getVoices: () => [] },
  };
  win.SpeechSynthesisUtterance = function (t) { this.text = t; };

  const src = fs.readFileSync(path.join(ROOT, "js", "core", "audio.js"), "utf8");
  // In a browser everything on window is also a bare global, and audio.js
  // uses PhonicsBank that way after guarding on window.PhonicsBank. The
  // sandbox has to hand both in for the same code to run unchanged.
  new Function("window", "fetch", "Audio", "SpeechSynthesisUtterance", "speechSynthesis",
               "PhonicsBank", src)(
    win, fakeFetch, fakeAudio, win.SpeechSynthesisUtterance, win.speechSynthesis, win.PhonicsBank);
  return { api: win.PhonicsAudio, played, spoke, probed, exists };
}

const settle = async (h, ms) => {
  await new Promise((r) => setTimeout(r, ms || 60));   // let clips.json land
};

module.exports = {
  async "a grapheme that is several phonemes plays every one of them"() {
    // <qu> is /k/ then /w/. Taking phonemes[0] made it come out as /k/.
    const h = harness();
    await settle(h);
    await h.api.playGraphemeReading("qu", ["qu.kw"], { mp4Stem: "Qu", gapMs: 1 });
    const phon = h.played.filter((p) => p.indexOf("phonemes/") !== -1);
    assert.deepEqual(phon, ["recordings/au/phonemes/k.mp3", "recordings/au/phonemes/w.mp3"],
      "<qu> should say /k/ then /w/, got " + JSON.stringify(h.played));
  },

  async "a recording of the whole blend beats playing the pieces"() {
    // playGpc has always preferred k_w.mp3 over /k/ + /w/; the card reading
    // expanded every GPC into single phonemes and never looked. Two paths,
    // one preference — so the same sound came out two ways on two screens.
    // <wh> as /hw/ is where it bites: the h clip and the w clip with a gap
    // between them is "h, w", not the one voiceless w it stands for.
    const blend = "recordings/au/phonemes/h_w.mp3";
    const before = harness();
    await settle(before);
    await before.api.playGraphemeReading("wh", ["wh.hw"], { gapMs: 1 });
    assert.deepEqual(before.played.filter((p) => p.indexOf("phonemes/") !== -1),
      ["recordings/au/phonemes/h.mp3", "recordings/au/phonemes/w.mp3"],
      "with no blend recorded, /hw/ is the h clip run into the w clip");

    const after = harness({ alsoRecorded: [blend] });
    await settle(after);
    await after.api.playGraphemeReading("wh", ["wh.hw"], { gapMs: 1 });
    assert.deepEqual(after.played.filter((p) => p.indexOf("phonemes/") !== -1), [blend],
      "once h_w.mp3 exists it should play instead of the two pieces, got " +
      JSON.stringify(after.played));
  },

  async "<x> says /k/ then /s/, not just /k/"() {
    const h = harness();
    await settle(h);
    await h.api.playGraphemeReading("x", ["x.ks"], { mp4Stem: "X", gapMs: 1 });
    const phon = h.played.filter((p) => p.indexOf("phonemes/") !== -1);
    assert.deepEqual(phon, ["recordings/au/phonemes/k.mp3", "recordings/au/phonemes/s.mp3"]);
  },

  async "a card with several sounds plays all of them, in order"() {
    const h = harness();
    await settle(h);
    const a = GPCS.filter((g) => g.grapheme === "a").map((g) => g.id);
    assert.ok(a.length >= 3, "premise: <a> has several sounds");
    await h.api.playGraphemeReading("a", a, { mp4Stem: "A", gapMs: 1 });
    const phon = h.played.filter((p) => p.indexOf("phonemes/") !== -1);
    // ...minus any whose clip was cut off in export — <a>'s schwa is on the
    // re-record list, and skipping it is the point of that list.
    const want = a.map((id) => GPCS.find((g) => g.id === id))
      .flatMap((g) => (Array.isArray(g.phonemes) ? g.phonemes : [g.phonemes]))
      .map((ph) => "recordings/au/phonemes/" + ph + ".mp3")
      .filter((f) => CLIPS.tooShort.indexOf(f) === -1);
    assert.deepEqual(phon, want, "got " + JSON.stringify(phon));
    assert.ok(want.length < a.length, "premise: one of <a>'s sounds is flagged");
  },

  async "a missing letter name drops the names, not the sounds"() {
    // <ti> loses its letter names because letters/t.mp3 was cut in export.
    // It used to hand the whole reading to Ti.mp4 — someone else's voice —
    // even though /sh/ was recorded in the teacher's.
    const h = harness();
    await settle(h);
    await h.api.playGraphemeReading("ti", ["ti.sh"], { mp4Stem: "Ti", gapMs: 1 });
    assert.ok(h.played.every((p) => p.indexOf(".mp4") === -1),
      "no narrated video should be reached: " + JSON.stringify(h.played));
    assert.ok(h.played.indexOf("recordings/au/phonemes/sh.mp3") !== -1,
      "the teacher's /sh/ should still play: " + JSON.stringify(h.played));
    assert.ok(h.played.every((p) => p.indexOf("letters/") === -1),
      "a half-spelled name is worse than none: " + JSON.stringify(h.played));
  },

  async "with every letter recorded, the names come back"() {
    const h = harness();
    await settle(h);
    await h.api.playGraphemeReading("ow", ["ow.ow", "ow.oa"], { mp4Stem: "Ow", gapMs: 1 });
    assert.deepEqual(h.played, [
      "recordings/au/letters/o.mp3",
      "recordings/au/letters/w.mp3",
      "recordings/au/phonemes/ow.mp3",
      "recordings/au/phonemes/oa.mp3",
    ], "O, W, then both sounds — got " + JSON.stringify(h.played));
  },

  async "the narrated video is only reached when nothing of ours exists"() {
    const h = harness({ exists: [] });          // no recordings at all
    await settle(h);
    await h.api.playGraphemeReading("zz", [], { mp4Stem: "Zz", gapMs: 1 });
    assert.deepEqual(h.played, ["Zz.mp4"], "got " + JSON.stringify(h.played));
  },

  async "a clip flagged as cut off is skipped, not played"() {
    const h = harness();
    await settle(h);
    assert.ok(CLIPS.tooShort.indexOf("recordings/au/phonemes/ng.mp3") !== -1, "premise");
    await h.api.playPhoneme("ng");
    assert.ok(h.played.indexOf("recordings/au/phonemes/ng.mp3") === -1,
      "the clipped /ng/ must not play: " + JSON.stringify(h.played));
    assert.ok(h.spoke.length, "it should fall through to speaking the example word");
  },
};
