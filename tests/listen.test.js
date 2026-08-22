// ============================================================
// tests/listen.test.js
//
// "Can the app hear a child's sound well enough to grade it?"
// These tests answer that with synthesised audio (tests/synth.js),
// so the claims in js/core/listen.js are checked, not asserted.
//
// Two kinds of test here, and the second kind matters most:
//   1. it hears what it says it hears  (voicing, /s/ vs /sh/, air)
//   2. it ADMITS what it cannot hear   (/f/ vs /th/, stop place)
// A regression that made the module confidently wrong about /th/
// would be worse than one that made it silent, so the honesty
// tests are as load-bearing as the detection ones.
// ============================================================

const assert = require("assert");
const L = require("../js/core/listen.js");
const S = require("./synth.js");

// The one call site the app uses: find the attempt inside the silence,
// measure it, grade it.
function hear(who, what, phonemeId, opts) {
  const { buf, sampleRate } = S.say(who, what, 42);
  const loud = L.loudestFrame(buf, sampleRate, 2048);
  const features = L.analyse(buf, sampleRate, { from: loud.from, frame: 2048 });
  return { features, result: L.grade(phonemeId, features, opts || {}) };
}

function feat(who, what) {
  const { buf, sampleRate } = S.say(who, what, 42);
  const loud = L.loudestFrame(buf, sampleRate, 2048);
  return L.analyse(buf, sampleRate, { from: loud.from, frame: 2048 });
}

module.exports = {

  // ---- 1. voicing: the buzz is real and measurable ----------------

  "voiceless fricatives read as voiceless, voiced as voiced"() {
    for (const who of ["child", "adult"]) {
      for (const id of ["s", "sh", "f", "th"]) {
        const f = feat(who, id);
        assert.ok(f.clarity <= 0.25, `${who} /${id}/ should read voiceless, clarity ${f.clarity.toFixed(2)}`);
      }
      for (const id of ["z", "zh", "v", "dh", "ee", "ah", "m"]) {
        const f = feat(who, id);
        assert.ok(f.clarity >= 0.45 && f.f0 > 60,
          `${who} /${id}/ should read voiced, clarity ${f.clarity.toFixed(2)} f0 ${Math.round(f.f0)}`);
      }
    }
  },

  "a child saying /s/ with the voice on is told to switch it off"() {
    const { result } = hear("child", "z", "s");
    assert.equal(result.verdict, "close");
    assert.equal(result.measured.voiced, true);
    assert.ok(result.why.join(" ").match(/voice OFF/i), result.why.join(" "));
  },

  "a child saying /s/ for /z/ is told to switch the voice on"() {
    const { result } = hear("child", "s", "z");
    assert.equal(result.verdict, "close");
    assert.equal(result.measured.voiced, false);
    assert.ok(result.why.join(" ").match(/voice ON/i), result.why.join(" "));
  },

  "f0 lands near the synthesised pitch for both a child and an adult"() {
    assert.ok(Math.abs(feat("child", "ah").f0 - S.CHILD.f0) < 25);
    assert.ok(Math.abs(feat("adult", "ah").f0 - S.ADULT.f0) < 25);
  },

  // ---- 2. sibilant place: /s/ vs /sh/ -----------------------------

  "the sibilant centroid ignores voicing"() {
    // /z/ is /s/ with the folds on. If the place cue moved when the voice
    // came on, every voiced sibilant would be misgraded — this is the bug
    // the 1500 Hz floor exists to prevent.
    for (const who of ["child", "adult"]) {
      const s = feat(who, "s").centroidHi, z = feat(who, "z").centroidHi;
      const sh = feat(who, "sh").centroidHi, zh = feat(who, "zh").centroidHi;
      assert.ok(Math.abs(s - z) / s < 0.15, `${who} /s/ ${Math.round(s)} vs /z/ ${Math.round(z)}`);
      assert.ok(Math.abs(sh - zh) / sh < 0.15, `${who} /sh/ ${Math.round(sh)} vs /zh/ ${Math.round(zh)}`);
      assert.ok(s > sh * 1.4, `${who} /s/ should sit well above /sh/: ${Math.round(s)} vs ${Math.round(sh)}`);
    }
  },

  "/s/ and /sh/ are each graded right, for a child and an adult"() {
    for (const who of ["child", "adult"]) {
      const band = who === "child" ? "child" : "adult";
      for (const id of ["s", "sh", "z", "zh"]) {
        const { result } = hear(who, id, id, { band });
        assert.equal(result.verdict, "heard", `${who} /${id}/ -> ${result.verdict}: ${result.why.join(" ")}`);
      }
    }
  },

  "saying /sh/ when /s/ was asked for gets the tongue-forward cue"() {
    const { result } = hear("child", "sh", "s", { band: "child" });
    assert.equal(result.verdict, "close");
    assert.ok(result.why.join(" ").match(/tongue forward/i), result.why.join(" "));
  },

  "saying /s/ when /sh/ was asked for gets the tongue-back cue"() {
    const { result } = hear("child", "s", "sh", { band: "child" });
    assert.equal(result.verdict, "close");
    assert.ok(result.why.join(" ").match(/tongue back/i), result.why.join(" "));
  },

  "a centroid inside the overlap is reported as can't-tell, not guessed"() {
    const b = L.SIB.child;
    const middle = { centroidHi: (b.shMax + b.sMin) / 2, centroid: 0 };
    assert.equal(L.CHECKS.s.cues.indexOf("sibilant-high") !== -1, true);
    const { result } = (() => {
      const f = Object.assign(feat("child", "s"), middle);
      return { result: L.grade("s", f, { band: "child" }) };
    })();
    assert.equal(result.verdict, "close");
    assert.ok(result.why.join(" ").match(/between the two sounds/i), result.why.join(" "));
  },

  // ---- 3. the honest pair: /f/ vs /th/ ----------------------------

  "/f/ and /th/ are acoustically indistinguishable here — by design"() {
    // The synth gives them the SAME recipe because in life the acoustic
    // difference is tiny. If a future change made these measure apart,
    // that would be an artefact of the synth, not a real capability.
    const f = feat("child", "f"), th = feat("child", "th");
    assert.ok(Math.abs(f.centroidHi - th.centroidHi) < 1, "synth must not cheat");
  },

  "a good /th/ asks about the tongue instead of inventing a verdict"() {
    const { result } = hear("child", "th", "th");
    assert.equal(result.verdict, "ask");
    assert.equal(result.askAbout, "tongue");
  },

  "a good /f/ asks about the lip"() {
    const { result } = hear("child", "f", "f");
    assert.equal(result.verdict, "ask");
    assert.equal(result.askAbout, "lip");
  },

  "the voiced pair /v/ and /dh/ also route to a picture question"() {
    assert.equal(hear("child", "v", "v").result.askAbout, "lip");
    assert.equal(hear("child", "dh", "dh").result.askAbout, "tongue");
  },

  "/th/ said with the voice on is corrected before any picture question"() {
    // Voicing IS measurable, so a voiced attempt at voiceless /th/ gets a
    // real correction — the app only falls back to asking once the cues it
    // can actually check have passed.
    const { result } = hear("child", "dh", "th");
    assert.equal(result.verdict, "close");
    assert.equal(result.askAbout, null);
    assert.ok(result.why.join(" ").match(/voice OFF/i), result.why.join(" "));
  },

  "stops route to a picture question for place, not a guess"() {
    for (const id of ["p", "t", "k", "b", "d", "g"]) {
      assert.equal(L.CHECKS[id].selfCheck, "place", `/${id}/ must not claim place`);
    }
    const { result } = hear("child", "p", "p");
    assert.equal(result.verdict, "ask");
    assert.equal(result.askAbout, "place");
  },

  // ---- 4. is there air at all -------------------------------------

  "frication separates from voicing by two orders of magnitude"() {
    for (const who of ["child", "adult"]) {
      for (const id of ["s", "sh", "z", "zh", "f", "v"]) {
        assert.ok(feat(who, id).flatness > 0.08,
          `${who} /${id}/ flatness ${feat(who, id).flatness.toFixed(3)} should read as air`);
      }
      for (const id of ["ee", "ah", "oo", "m"]) {
        assert.ok(feat(who, id).flatness < 0.01,
          `${who} ${id} flatness ${feat(who, id).flatness.toFixed(3)} should not read as air`);
      }
    }
  },

  "a hummed answer to /v/ is told the air is missing, not asked about lips"() {
    const { result } = hear("child", "m", "v");
    assert.equal(result.verdict, "close");
    assert.equal(result.askAbout, null);
    assert.equal(result.measured.frication, false);
    assert.ok(result.why.join(" ").match(/voice sound/i), result.why.join(" "));
  },

  "an energy-above-3kHz rule would have failed every voiced fricative"() {
    // Documents WHY the manner gate uses flatness. The obvious rule —
    // "fricatives are top-heavy, so highFraction > 0.35" — rejects /z/,
    // /zh/ and /v/ outright, because a voiced fricative puts most of its
    // ENERGY in the voice bar down low while still being noise-flat up
    // top. An adult /sh/ fails it too. If someone "simplifies" the gate
    // back to an energy rule, this test says what breaks.
    for (const who of ["child", "adult"]) {
      for (const id of ["z", "zh", "v"]) {
        const f = feat(who, id);
        assert.ok(f.highFraction < 0.35, `${who} /${id}/ hiFr ${f.highFraction.toFixed(3)}`);
        assert.ok(f.flatness > 0.08, `${who} /${id}/ flatness ${f.flatness.toFixed(3)}`);
      }
    }
    assert.ok(feat("adult", "sh").highFraction < 0.35, "even a voiceless /sh/ fails the energy rule");
  },

  // ---- 5. silence and the loudest-frame finder --------------------

  "room tone is called quiet, not graded"() {
    const { result } = hear("child", "quiet", "s");
    assert.equal(result.verdict, "quiet");
    assert.ok(result.why.join(" ").match(/couldn't hear/i));
  },

  "the loudest frame finds the sound inside the silence"() {
    const sr = 44100;
    const { buf } = S.say("child", "ah", 42);
    const pad = new Float32Array(sr);            // 1s of silence up front
    const joined = new Float32Array(pad.length + buf.length + pad.length);
    joined.set(buf, pad.length);
    const loud = L.loudestFrame(joined, sr, 2048);
    assert.ok(loud.from >= pad.length - 2048 && loud.from < pad.length + buf.length,
      "found the attempt at " + loud.from + ", expected near " + pad.length);
    assert.ok(loud.rms > 0.05);
  },

  // ---- 6. children are not small adults ---------------------------

  "calibrate tells a child from an adult by pitch"() {
    const kid = L.calibrate([{ id: "ah", features: feat("child", "ah") }]);
    const grown = L.calibrate([{ id: "ah", features: feat("adult", "ah") }]);
    assert.equal(kid.band, "child");
    assert.equal(grown.band, "adult");
  },

  "calibrate with no pitch found defaults to child, not adult"() {
    // A whisper, a noisy room, or a calibration made only of voiceless
    // sounds gives f0 = 0. Reading that as "adult" would judge a child
    // against adult bands — wrong direction, and invisible.
    const cal = L.calibrate([{ id: "s", features: feat("child", "s") }]);
    assert.equal(cal.f0, 0, "premise: no pitch in a voiceless sound");
    assert.equal(cal.band, "child");
  },

  "calibrate builds a personal /s/-/sh/ split and grading uses it"() {
    const cal = L.calibrate([
      { id: "s", features: feat("child", "s") },
      { id: "sh", features: feat("child", "sh") },
      { id: "ah", features: feat("child", "ah") },
    ]);
    assert.ok(cal.split > 0, "expected a personal split");
    assert.ok(cal.split > feat("child", "sh").centroidHi);
    assert.ok(cal.split < feat("child", "s").centroidHi);
    assert.equal(L.grade("s", feat("child", "s"), { calibration: cal }).verdict, "heard");
    assert.equal(L.grade("sh", feat("child", "sh"), { calibration: cal }).verdict, "heard");
  },

  "calibrate refuses a split when the child's own two sounds are the same"() {
    // A child who has not yet split /s/ from /sh/ must not have their
    // muddle enshrined as their personal boundary.
    const same = feat("child", "s");
    const cal = L.calibrate([{ id: "s", features: same }, { id: "sh", features: same }]);
    assert.equal(cal.split, null);
  },

  "a calibrated child is graded against themselves, not an adult table"() {
    const cal = L.calibrate([
      { id: "s", features: feat("child", "s") },
      { id: "sh", features: feat("child", "sh") },
    ]);
    // Their /sh/ sits above the ADULT shMax — judged by the adult table it
    // would land in no-man's-land; judged against themselves it is right.
    const sh = feat("child", "sh");
    assert.ok(sh.centroidHi > L.SIB.adult.shMax, "premise: " + Math.round(sh.centroidHi));
    assert.equal(L.grade("sh", sh, { band: "adult" }).verdict, "close");
    assert.equal(L.grade("sh", sh, { calibration: cal }).verdict, "heard");
  },

  "a child's vowel formants land far above the same adult vowel's"() {
    // The reason no vowel is ever graded against a fixed table.
    const kid = feat("child", "ee").formants;
    const grown = feat("adult", "ee").formants;
    assert.ok(kid.length >= 2 && grown.length >= 2, "need F1/F2 for both");
    assert.ok(kid[1] > grown[1] * 1.25,
      `child F2 ${kid[1]} should tower over adult F2 ${grown[1]}`);
  },

  "formants track the synthesised vowel targets for every voice and vowel"() {
    // Tight enough to be worth something: the analyser's pre-emphasis is
    // what keeps F1 inside this window. Take it out and the child's /ee/
    // drops ~75 Hz below target. (The synth gives its source the real
    // -12 dB/oct glottal tilt and +6 dB/oct lip radiation, so this is
    // measuring what pre-emphasis is actually for.)
    for (const who of ["child", "adult"]) {
      for (const v of ["ee", "ah", "oo"]) {
        const target = (who === "child" ? S.CHILD : S.ADULT)["vowel" + v.toUpperCase()];
        const f = feat(who, v);
        assert.ok(f.formants.length >= 2, `${who} ${v}: no formants`);
        assert.ok(Math.abs(f.formants[0] - target[0]) <= 60,
          `${who} ${v} F1 ${f.formants[0]} vs target ${target[0]}`);
        assert.ok(Math.abs(f.formants[1] - target[1]) <= 60,
          `${who} ${v} F2 ${f.formants[1]} vs target ${target[1]}`);
      }
    }
  },

  // ---- 8. the ambiguity band: half-sure is not sure ---------------

  "a half-clear buzz is reported as can't-tell, not rounded to a verdict"() {
    // Between the two gates there is no honest answer. Both gates are
    // load-bearing: widen either one and a maybe becomes a claim.
    const base = feat("child", "z");
    for (const clarity of [0.26, 0.35, 0.44]) {
      const f = Object.assign({}, base, { clarity, f0: 200 });
      const r = L.grade("z", f, { band: "child" });
      assert.strictEqual(r.measured.voiced, null, "clarity " + clarity + " should be null");
      assert.equal(r.verdict, "close");
      assert.ok(r.why.join(" ").match(/couldn't tell if your voice/i), r.why.join(" "));
    }
  },

  "a clear period with no pitch found is also can't-tell"() {
    const f = Object.assign({}, feat("child", "z"), { clarity: 0.8, f0: 0 });
    assert.strictEqual(L.grade("z", f, { band: "child" }).measured.voiced, null);
  },

  "a quiet-but-audible sound grades the same as a loud one"() {
    // Classrooms are not recording booths; children do not lean in. Every
    // cue except rms is amplitude-invariant and this proves it stays so.
    const sr = 44100;
    const loudSay = S.say("child", "s", 42);
    const soft = { buf: Float32Array.from(loudSay.buf, (v) => v * 0.12), sampleRate: sr };
    const at = (o) => {
      const l = L.loudestFrame(o.buf, o.sampleRate, 2048);
      return L.analyse(o.buf, o.sampleRate, { from: l.from, frame: 2048 });
    };
    const a = at(loudSay), b = at(soft);
    assert.ok(b.rms > 0.006, "premise: still above the quiet floor, rms " + b.rms.toFixed(4));
    assert.ok(Math.abs(a.centroidHi - b.centroidHi) < 50, `${a.centroidHi} vs ${b.centroidHi}`);
    assert.equal(L.grade("s", b, { band: "child" }).verdict, "heard");
  },

  // ---- 7. the module never claims more than it can do -------------

  "every sound with a selfCheck has a picture question the UI can ask"() {
    const known = { lip: 1, tongue: 1, place: 1 };
    for (const [id, spec] of Object.entries(L.CHECKS)) {
      if (spec.selfCheck) assert.ok(known[spec.selfCheck], `/${id}/ asks for unknown check "${spec.selfCheck}"`);
    }
  },

  "an unknown phoneme is never graded, only asked about"() {
    const { result } = hear("child", "ah", "oo_as_in_book");
    assert.equal(result.verdict, "ask");
  },

  "every refusal comes with a question a five-year-old can answer"() {
    for (const [id, spec] of Object.entries(L.CHECKS)) {
      if (!spec.selfCheck) continue;
      assert.ok(spec.ask, `/${id}/ refuses to grade but asks nothing`);
      assert.ok(/\?$/.test(spec.ask), `/${id}/ ask should be a question: "${spec.ask}"`);
      assert.ok(spec.ask.split(/\s+/).length <= 14, `/${id}/ ask is too long: "${spec.ask}"`);
    }
    assert.equal(hear("child", "th", "th").result.ask, L.CHECKS.th.ask);
    assert.equal(hear("child", "p", "p").result.ask, L.CHECKS.p.ask);
  },

  "describe() marks the readings it is not sure about"() {
    const sure = L.describe(feat("child", "s"), { band: "child" });
    const byLabel = (rows, l) => rows.find((r) => r.label === l);
    assert.equal(byLabel(sure, "Voice").sure, true);
    assert.equal(byLabel(sure, "Hiss pitch").sure, true);
    // A reading inside the overlap must be flagged, not quietly rendered.
    const murky = Object.assign({}, feat("child", "s"),
      { centroidHi: (L.SIB.child.shMax + L.SIB.child.sMin) / 2, clarity: 0.35, f0: 200 });
    assert.equal(byLabel(L.describe(murky, { band: "child" }), "Hiss pitch").sure, false);
    assert.equal(byLabel(L.describe(murky, { band: "child" }), "Voice").sure, false);
    assert.ok(byLabel(L.describe(murky, { band: "child" }), "Voice").value.match(/can't tell/i));
  },

  "describe() leaves out cues that don't bear on the sound asked for"() {
    const labels = (id) => L.describe(feat("child", id === "s" ? "s" : "f"),
      { band: "child", id }).map((r) => r.label);
    // /s/ lives or dies on the hiss pitch, so it is reported.
    assert.ok(labels("s").indexOf("Hiss pitch") !== -1);
    // /f/ never was going to be decided that way. Reporting "can't tell"
    // there invents a doubt about a measurement nobody was relying on.
    assert.equal(labels("f").indexOf("Hiss pitch"), -1);
    // With no target named, show everything — that is the diagnostic view.
    assert.ok(L.describe(feat("child", "f"), { band: "child" })
      .map((r) => r.label).indexOf("Hiss pitch") !== -1);
  },

  "describe() does not report formants for a fricative"() {
    // LPC will happily return peaks for a hiss; they are the noise shape,
    // not a reading of where the child's tongue is.
    const labels = (id) => L.describe(feat("child", id), { band: "child" }).map((r) => r.label);
    assert.equal(labels("z").indexOf("Mouth shape"), -1, "/z/ should not report a mouth shape");
    assert.equal(labels("s").indexOf("Mouth shape"), -1);
    assert.ok(labels("ah").indexOf("Mouth shape") !== -1, "a vowel should");
  },

  "describe() on silence says so instead of reading noise"() {
    const rows = L.describe(feat("child", "quiet"));
    assert.equal(rows.length, 1);
    assert.ok(rows[0].value.match(/too quiet/i));
  },

  "CHECKS agrees with data/phonemes.json and cannot drift from it"() {
    // listen.js stays free of the bank so it can be tested without one,
    // which means it restates manner and voicing. This is the seam where
    // that copy would silently go stale — e.g. a phoneme's voicing fixed
    // in the data but not here would make the app correct a child who was
    // right. The articulation picture the UI shows comes from the bank,
    // so the two must describe the same mouth.
    const bank = require("../data/phonemes.json").phonemes;
    const byId = {};
    for (const p of bank) byId[p.id] = p;
    for (const [id, spec] of Object.entries(L.CHECKS)) {
      const p = byId[id];
      assert.ok(p, `CHECKS has /${id}/ but the bank does not`);
      const a = p.articulation || {};
      assert.equal(spec.voiced, a.voiced, `/${id}/ voicing disagrees with the bank`);
      const bankManner = a.manner === "lateral" ? "approximant" : a.manner;
      assert.equal(spec.manner, bankManner, `/${id}/ manner disagrees with the bank`);
    }
    // Every consonant in the bank should have a plan, even if the plan is
    // "ask" — an unlisted one silently falls through to a bare picture.
    for (const p of bank) {
      if (p.type === "consonant") assert.ok(L.CHECKS[p.id], `no listening plan for /${p.id}/`);
    }
  },
};
