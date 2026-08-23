// ============================================================
// tests/letterforms.test.js
//
// The handwriting scorer marks stroke count, stroke order and
// shape. That makes a malformed path worse than a missing one:
// a child copies the model correctly and is told they were
// wrong.
//
// Two real defects these were written after. A lead-in stroke
// that stopped short of where the letter began, so the pen drew
// a line straight through every bowl. And letters claiming "one
// stroke" whose path contained a jump, which is a lie to the
// thing that counts strokes.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STYLES = ["vic-modern-cursive", "us-manuscript", "uk-continuous-cursive"];
const load = (s) => JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "handwriting", "letterforms-" + s + ".json"), "utf8"));

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");

// y=0 top line, 33.3 dotted middle, 66.6 baseline, 100 descender floor
const TOP = 0, MID = 33.3, BASE = 66.6, FLOOR = 100;

function coords(d) {
  const n = d.match(/-?[\d.]+/g) || [];
  const out = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([+n[i], +n[i + 1]]);
  return out;
}

module.exports = {
  "every style has the whole alphabet and every digit"() {
    for (const s of STYLES) {
      const doc = load(s);
      for (const ch of ALPHABET.concat(DIGITS)) {
        assert.ok(doc.letters[ch], s + " is missing " + ch);
        assert.ok(doc.letters[ch].strokes.length, s + " " + ch + " has no strokes");
      }
    }
  },

  "no stroke lifts the pen and moves"() {
    // A path that lifts the pen halfway through while still counting as one
    // stroke makes the scorer mark a child down for a stroke count the model
    // itself misreports. An M that lands on the point the pen is already at
    // is only redundant notation, so it does not count.
    for (const s of STYLES) {
      const doc = load(s);
      for (const [ch, L] of Object.entries(doc.letters)) {
        L.strokes.forEach((st, i) => {
          const parts = st.path.split(/(?=[MLC])/);
          let at = null;
          parts.forEach((cmd) => {
            const nums = (cmd.match(/-?[\d.]+/g) || []).map(Number);
            if (!nums.length) return;
            const to = [nums[nums.length - 2], nums[nums.length - 1]];
            if (cmd.trim()[0] === "M" && at) {
              const moved = Math.hypot(to[0] - at[0], to[1] - at[1]);
              assert.ok(moved < 0.6,
                `${s} <${ch}> stroke ${i} lifts the pen and moves ${moved.toFixed(1)} units`);
            }
            at = to;
          });
        });
      }
    }
  },

  "a continuous-cursive letter really is continuous"() {
    // One stroke for everything except the dot on i/j and the bar on t/f/x,
    // which are the only lifts the style allows.
    const doc = load("uk-continuous-cursive");
    const mayLift = new Set(["i", "j", "t", "f", "x"]);
    for (const ch of ALPHABET) {
      const n = doc.letters[ch].strokes.length;
      assert.equal(n, mayLift.has(ch) ? 2 : 1,
        `<${ch}> has ${n} strokes; continuous cursive lifts only for a dot or a bar`);
    }
  },

  "every continuous-cursive letter begins with a lead-in from the baseline"() {
    // What makes the hand joinable: the pen starts ON the baseline, to the
    // left of the letter, and rises into it. The bug this guards is the
    // entry stroke ending somewhere the letter does not begin — the pen
    // then travels across the letter to reach the start and slashes a line
    // through it. Checking the entry is real and that no stroke lifts
    // (above) together rule that out.
    const doc = load("uk-continuous-cursive");
    for (const ch of ALPHABET) {
      const pts = coords(doc.letters[ch].strokes[0].path);
      const [x0, y0] = pts[0];
      assert.ok(Math.abs(y0 - BASE) < 3,
        `<${ch}> starts at y=${y0}; a lead-in starts on the baseline (${BASE})`);
      const rises = pts.slice(1, 4).some((p) => p[1] < y0 - 2);
      assert.ok(rises, `<${ch}> does not rise off the baseline into the letter`);
      assert.ok(pts.some((p) => p[0] > x0 + 6),
        `<${ch}> never moves right of where the lead-in began`);
    }
  },

  "a letter never wanders outside its own advance width"() {
    // A stroke that runs past the letter box collides with the next letter
    // on the dotted thirds, and the scorer's placement check reads it as
    // the child having written in the wrong place.
    for (const s of STYLES) {
      const doc = load(s);
      for (const [ch, L] of Object.entries(doc.letters)) {
        const xs = L.strokes.flatMap((st) => coords(st.path).map((p) => p[0]));
        assert.ok(Math.min(...xs) > -12, `${s} <${ch}> starts ${Math.min(...xs)} — off the left`);
        assert.ok(Math.max(...xs) < L.width + 26,
          `${s} <${ch}> reaches x=${Math.max(...xs)} but claims width ${L.width}`);
      }
    }
  },

  "letters sit in the zone they claim"() {
    for (const s of STYLES) {
      const doc = load(s);
      for (const [ch, L] of Object.entries(doc.letters)) {
        if (L.zone === "digit") continue;
        const ys = L.strokes.flatMap((st) => coords(st.path).map((p) => p[1]));
        const lowest = Math.max(...ys), highest = Math.min(...ys);
        if (L.zone === "descender") {
          assert.ok(lowest > BASE + 8, `${s} <${ch}> is a descender but stops at ${lowest}`);
        } else {
          assert.ok(lowest < BASE + 12, `${s} <${ch}> drops to ${lowest}, below the baseline`);
        }
        if (L.zone === "ascender") {
          assert.ok(highest < MID - 8, `${s} <${ch}> is an ascender but only reaches ${highest}`);
        }
        assert.ok(highest > TOP - 4 && lowest < FLOOR + 4,
          `${s} <${ch}> leaves the writing box (${highest}..${lowest})`);
      }
    }
  },

  "the new styles name no commercial font"() {
    // Named school hands are commercial products; their outlines and their
    // names belong to their publishers. The conventions are not ownable and
    // these are drawn to the conventions.
    const BANNED = /zaner|bloser|dnealian|d'nealian|letter-?join|nelson|twinkl/i;
    for (const s of ["us-manuscript", "uk-continuous-cursive"]) {
      const raw = fs.readFileSync(
        path.join(ROOT, "data", "handwriting", "letterforms-" + s + ".json"), "utf8");
      assert.ok(!BANNED.test(raw), s + " names a commercial font");
      assert.equal(load(s).display_font.name, null, s + " should not claim a display font");
    }
  },

  "each accent maps to a style whose file actually exists"() {
    // The handwriting task picks its hand from the learner's accent. A
    // mapping that points at a missing file fails silently at fetch time
    // and the child gets no model to trace at all.
    const src = fs.readFileSync(path.join(ROOT, "js", "tasks", "t9_handwriting.js"), "utf8");
    const m = src.match(/const STYLE_BY_ACCENT = \{([\s\S]*?)\};/);
    assert.ok(m, "t9 should map accents to handwriting styles");
    const map = {};
    for (const pair of m[1].matchAll(/(\w+):\s*"([^"]+)"/g)) map[pair[1]] = pair[2];
    assert.deepEqual(Object.keys(map).sort(), ["au", "uk", "us"]);
    for (const [accent, style] of Object.entries(map)) {
      const f = path.join(ROOT, "data", "handwriting", "letterforms-" + style + ".json");
      assert.ok(fs.existsSync(f), `accent ${accent} wants ${style}, which does not exist`);
      assert.equal(load(style).style, style, `${style}.json disagrees about its own name`);
    }
    assert.equal(map.au, "vic-modern-cursive");
    assert.notEqual(map.uk, map.au, "England does not teach the Victorian hand");
    assert.notEqual(map.us, map.uk, "US manuscript is not UK cursive");
  },

  "mastery is recorded per style, not shared across them"() {
    // Writing <a> in Victorian cursive does not show you can write it as US
    // print — they are different movements with different stroke counts.
    const src = fs.readFileSync(path.join(ROOT, "js", "tasks", "t9_handwriting.js"), "utf8");
    assert.ok(/key:\s*"letter:"\s*\+\s*key\s*\+\s*"\|"\s*\+\s*styleId\(\)/.test(src),
      "the mastery key should include the style");
  },

  "every family a letter claims exists, and lists that letter back"() {
    for (const s of STYLES) {
      const doc = load(s);
      for (const [ch, L] of Object.entries(doc.letters)) {
        for (const fam of L.family) {
          assert.ok(doc.families[fam], `${s} <${ch}> claims family ${fam}, which is not defined`);
          assert.ok(doc.families[fam].letters.indexOf(ch) !== -1,
            `${s} family ${fam} does not list <${ch}>`);
        }
      }
      for (const [fam, spec] of Object.entries(doc.families)) {
        assert.ok(spec.teach, `${s} family ${fam} has no teaching line`);
      }
    }
  },
};
