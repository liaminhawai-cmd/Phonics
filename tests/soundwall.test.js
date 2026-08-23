// ============================================================
// tests/soundwall.test.js
//
// The sound wall used to resolve its own audio URLs: the legacy
// sounds/ folders (long since emptied) and then <Grapheme>.mp4.
// So every tile played the narrator of the old mouth videos
// rather than the teacher whose voice is in recordings/. It had
// been that way for as long as the recordings existed, because a
// second audio path drifts silently — nothing errors, it just
// plays the wrong person.
//
// These tests keep every page on the one chain in
// js/core/audio.js, and keep mouth.js's IPA in step with the
// bank's phoneme ids so a tile can always find its recording.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// mouth.js is a browser IIFE, so its tables are read statically.
function keysOf(table) {
  const src = read("mouth.js");
  const i = src.indexOf("const " + table + " = {");
  assert.ok(i !== -1, "no " + table + " table in mouth.js");
  const body = src.slice(i, src.indexOf("\n  };", i) === -1 ? src.indexOf("};", i) : src.indexOf("};", i));
  return [...body.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]);
}

function bankByIpa() {
  const out = {};
  for (const p of JSON.parse(read("data/phonemes.json")).phonemes) {
    if (p.ipa && p.ipa.au) out[p.ipa.au] = p.id;
  }
  return out;
}

module.exports = {
  "every sound the wall can show maps to a bank phoneme"() {
    // mouth.js transcribes vowels the RP-ish way its diagrams were drawn
    // from; the bank uses the broad Australian set the recordings are filed
    // under. Six disagree, and each unmapped one is a tile that silently
    // falls back to somebody else's voice.
    const byIpa = bankByIpa();
    const alias = {};
    const src = read("mouth.js");
    const a = src.indexOf("const BANK_ALIAS = {");
    assert.ok(a !== -1, "mouth.js should carry the alias table");
    for (const m of src.slice(a, src.indexOf("};", a)).matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) {
      alias[m[1]] = m[2];
    }
    const ids = new Set(JSON.parse(read("data/phonemes.json")).phonemes.map((p) => p.id));
    const unmapped = [];
    for (const table of ["CONS", "VOW", "DIP"]) {
      for (const ipa of keysOf(table)) {
        const id = alias[ipa] || byIpa[ipa];
        if (!id) unmapped.push(table + " /" + ipa + "/");
        else assert.ok(ids.has(id), "/" + ipa + "/ maps to " + id + ", which is not a bank phoneme");
      }
    }
    assert.equal(unmapped.length, 0,
      "no recording can be reached for: " + unmapped.join(", "));
  },

  "the sound wall has no audio path of its own"() {
    const src = read("soundwall.js");
    assert.equal(src.indexOf("new Audio("), -1,
      "soundwall.js should play through PhonicsAudio, not its own element");
    assert.equal(src.indexOf('".mp4"'), -1,
      "soundwall.js should not build mp4 URLs — that is the old narration");
    assert.ok(src.indexOf("PhonicsAudio.playPhoneme") !== -1,
      "soundwall.js should call PhonicsAudio.playPhoneme");
  },

  "a grapheme that is several phonemes plays all of them"() {
    // <qu> is /k/+/w/, <x> is /k/+/s/, <ing> is /i/+/ng/. 33 GPCs in the
    // bank are more than one phoneme, and taking phonemes[0] made every one
    // of them play only its first sound: <qu> came out as /k/.
    const gpcs = JSON.parse(read("data/gpcs.json")).gpcs;
    const multi = gpcs.filter((g) => Array.isArray(g.phonemes) && g.phonemes.length > 1);
    assert.ok(multi.length > 20, "premise: the bank has plenty of these");
    const qu = gpcs.find((g) => g.grapheme === "qu");
    assert.deepEqual(qu.phonemes, ["k", "w"], "<qu> is /k/ then /w/");

    const src = read("js/core/audio.js");
    assert.ok(src.indexOf("const phonemesOf =") !== -1, "audio.js needs a phonemesOf helper");
    // the composed reading must walk every phoneme, not index 0
    const i = src.indexOf("async function playGraphemeReading");
    const body = src.slice(i, src.indexOf("\n  }", src.indexOf("return playGpc", i)));
    assert.ok(body.indexOf("phonemesOf(g)") !== -1,
      "playGraphemeReading should expand each GPC into all its phonemes");
    assert.equal(body.indexOf("g.phonemes[0]"), -1,
      "playGraphemeReading must not take only the first phoneme");
  },

  "the old narrated videos are the last resort, not the first"() {
    // One missing letter-name clip used to send the whole reading to the
    // mp4, so <ti> played someone else's voice even though /sh/ was
    // recorded in the teacher's.
    const src = read("js/core/audio.js");
    const i = src.indexOf("async function playGraphemeReading");
    const body = src.slice(i);
    const mp4At = body.indexOf("opts.mp4Stem");
    const soundsAt = body.indexOf("soundItems");
    assert.ok(soundsAt !== -1 && soundsAt < mp4At,
      "the teacher's own sounds must be tried before the narrated video");
  },

  "the reading leaves room between the letter names and the sounds"() {
    // <ow> should come out as "O · W —— /ow/ —— /oa/": the letters belong
    // together as the name of one code, then a clear break before what it
    // says, and between one sound and the next.
    const src = read("js/core/audio.js");
    const num = (name) => {
      const m = src.match(new RegExp("const " + name + " = (\\d+);"));
      assert.ok(m, "no " + name);
      return Number(m[1]);
    };
    const blend = num("BLEND_GAP"), letter = num("LETTER_GAP"), sound = num("SOUND_GAP");
    assert.ok(blend < letter, "two phonemes of one sound sit tighter than two letters");
    assert.ok(letter < sound, "letters of a code sit tighter than the sounds it makes");
    assert.ok(sound >= 400, "the break before the sounds should be audible");
  },
};
