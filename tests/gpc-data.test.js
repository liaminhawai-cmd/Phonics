// ============================================================
// tests/gpc-data.test.js
//
// A GPC is a claim: "this spelling, in these words, says this
// sound." Nothing in the app can tell when that claim is simply
// false — the card renders, the box fills, the mouth diagram
// draws, and a child is taught a sound the word does not have.
//
// <ey> shipped with three sounds. The third was /igh/, and its
// only example was "donkey" — which ends in /ee/, like monkey.
// The word bank knew: it had always segmented donkey as ey->ee.
// The two halves of the bank disagreed and nothing checked.
//
// So: the word a card shows must be a word that really is read
// that way, and the handful of graphemes with a genuine second
// analysis have to say so out loud.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const GPCS = JSON.parse(read("data/gpcs.json")).gpcs;
const UNITS = JSON.parse(read("data/phonemes.json")).teaching_units;
const WORDS = (() => {
  const d = JSON.parse(read("data/words/words.json"));
  return Array.isArray(d) ? d : (d.words || d);
})();

const key = (g, p) => g + "->" + (Array.isArray(p) ? p.join("+") : p);

const byWord = new Map();
for (const w of WORDS) {
  if (!w || !w.word) continue;
  if (!byWord.has(w.word)) byWord.set(w.word, []);
  byWord.get(w.word).push(w);
}

// Graphemes the word bank deliberately reads a second way. Each one is a
// real disagreement between two defensible analyses, not a mistake — and
// writing the reason down is the price of the exemption.
const SECOND_READING = {
  "wh.hw": "the word bank reads which as plain /w/ (Australian); wh.hw is the /hw/ accents' reading",
  "u_e.oo_long": "tune is /tyoo/ in AU/UK and /too/ in the US; the bank segments the AU reading",
  "all.or": "the bank splits ball into a->or + ll->l rather than treating all as one unit",
  "oll.oa": "same split for roll: o->oa + ll->l",
  "ull.oo_short": "same split for full: u->oo_short + ll->l",
};

module.exports = {
  "the word on a card really is read the way the card says"() {
    // Only the FIRST example matters here: that is the one bank-adapt.js
    // puts on the Look & Say card under the sound.
    const wrong = [];
    for (const g of GPCS) {
      const ex = (g.examples || [])[0];
      if (!ex) continue;
      const entries = byWord.get(ex);
      if (!entries) continue;                 // not in the word bank; nothing to check against
      let usesGrapheme = false, agrees = false;
      for (const e of entries) {
        for (const s of e.segments || []) {
          if (s.g !== g.grapheme) continue;
          usesGrapheme = true;
          if (key(s.g, s.p) === key(g.grapheme, g.phonemes)) agrees = true;
        }
      }
      if (!usesGrapheme || agrees) continue;
      if (SECOND_READING[g.id]) continue;
      wrong.push(g.id + ' says "' + ex + '" is ' + key(g.grapheme, g.phonemes) +
                 ", but the word bank reads it another way");
    }
    assert.deepEqual(wrong, [], wrong.join("\n"));
  },

  "every documented second reading is still a real one"() {
    // An exemption that stops applying is an exemption that has gone stale
    // and is now hiding the next mistake.
    const stale = [];
    for (const id of Object.keys(SECOND_READING)) {
      const g = GPCS.find((x) => x.id === id);
      if (!g) { stale.push(id + " no longer exists"); continue; }
      const ex = (g.examples || [])[0];
      const entries = byWord.get(ex) || [];
      const agrees = entries.some((e) => (e.segments || []).some(
        (s) => s.g === g.grapheme && key(s.g, s.p) === key(g.grapheme, g.phonemes)));
      if (agrees) stale.push(id + " now agrees with the word bank — drop the exemption");
    }
    assert.deepEqual(stale, [], stale.join("\n"));
  },

  "a recording asked for on the checklist is one the app will look for"() {
    // The checklist told the teacher to record kw.mp3. audio.js only ever
    // asks for k_w.mp3 — a blend is looked up by its phonemes joined with
    // an underscore, which is the rule that works for every multi-phoneme
    // GPC and not just the handful with a teaching-unit id. So kw.mp3 was
    // a job on the list that, once done, nothing would have played.
    // Everything audio.js can build a phonemes/ URL for: a phoneme id, a
    // teaching-unit id a GPC names on its own (er -> schwa_r), and a blend
    // written as its phonemes joined with an underscore.
    const wanted = new Set(JSON.parse(read("data/phonemes.json")).phonemes.map((p) => p.id));
    for (const g of GPCS) {
      if (Array.isArray(g.phonemes)) {
        if (g.phonemes.length > 1) wanted.add(g.phonemes.join("_"));
        g.phonemes.forEach((ph) => wanted.add(ph));
      } else wanted.add(g.phonemes);
    }
    const unplayable = [];
    for (const accent of ["au", "uk", "us"]) {
      const csv = read("recordings/" + accent + "/manifest.csv").split(/\r?\n/).slice(1);
      for (const line of csv) {
        const [kind, id, filename] = line.split(",");
        if (kind !== "phoneme" && kind !== "teaching-unit") continue;
        const stem = String(filename).replace(/\.mp3$/, "");
        if (!wanted.has(stem)) unplayable.push(accent + " " + kind + " " + id + " -> " + filename);
      }
    }
    assert.deepEqual(unplayable, [],
      "nothing in the app ever asks for these files:\n" + unplayable.join("\n") +
      "\n(re-run scripts/build_recording_manifest.py)");
  },

  "<ey> says /ay/ and /ee/, and donkey is not /igh/"() {
    const ey = GPCS.filter((g) => g.grapheme === "ey");
    assert.deepEqual(ey.map((g) => g.id).sort(), ["ey.ay", "ey.ee"],
      "<ey> should be they and key — nothing else");
    const igh = GPCS.find((g) => (g.examples || []).includes("donkey") && g.phonemes === "igh");
    assert.ok(!igh, "no GPC should claim donkey ends in /igh/");
    for (const f of ["data/sequences/elc-bookmarks.json", "mika.js", "mika-standalone.html",
                     "phonics-standalone.html"]) {
      assert.equal(read(f).indexOf("ey.igh"), -1, f + " still teaches ey.igh");
    }
    assert.equal(read("mika.js").indexOf('{s:"ī", ex:"donkey"}'), -1,
      "mika.js still lists donkey as the /igh/ example for <ey>");
  },

  "<wh> is /w/ by default, with /hw/ there for the programs that teach it"() {
    const wh = GPCS.filter((g) => g.grapheme === "wh");
    const w = wh.find((g) => g.id === "wh.w");
    const hw = wh.find((g) => g.id === "wh.hw");
    const h = wh.find((g) => g.id === "wh.h");

    assert.ok(w && hw && h, "<wh> should carry all three readings: /w/, /hw/, /h/");
    assert.equal(w.short, "w",
      'wh.w plays the plain /w/ recording, so its box must say "w" — labelling it "hw" ' +
      "drew the two-part h+w mouth diagram over a one-sound clip");
    assert.equal(hw.short, "hw");
    assert.deepEqual(hw.phonemes, ["h", "w"],
      "/hw/ has no recording of its own; it is the h clip run into the w clip");
    assert.deepEqual(UNITS.hw && UNITS.hw.phonemes, ["h", "w"],
      "data/phonemes.json should carry hw as a teaching unit, the way it carries kw");
    assert.equal(h.phonemes, "h", "wh in who is just /h/ — the word bank already segments it so");

    // /ʍ/ is not a sound of Australian English, and the sound wall says on
    // the tin that it shows the sounds of Australian English.
    assert.equal(read("mouth.js").indexOf("ʍ"), -1,
      "mouth.js CONS drives the sound wall — adding /ʍ/ would put it on every child's wall");

    // ...so it reaches a child only through a sequence that asks for it.
    const teaching = [];
    for (const f of fs.readdirSync(path.join(ROOT, "data/sequences"))) {
      if (!f.endsWith(".json")) continue;
      const seq = JSON.parse(read("data/sequences/" + f));
      for (const u of seq.units || []) {
        if ((u.teaches || []).includes("wh.hw")) teaching.push(f);
      }
    }
    assert.deepEqual(teaching, [],
      "no sequence should teach /hw/ unless its program really does: " + teaching.join(", "));
  },
};
