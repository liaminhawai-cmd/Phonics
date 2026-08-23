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

// One attempt at a sound: the track, the path it took, a steady pose and
// the frame features — everything matchSounds() needs.
let _cal = null;
function childCal() {
  if (!_cal) _cal = { band: "child", vowelBox: vowelCal("child") };
  return _cal;
}
function attemptOf(what, who) {
  const { buf, sampleRate } = S.say(who || "child", what, 42);
  const cal = childCal();
  const track = L.trackVowel(buf, sampleRate, { calibration: cal, fps: 30 });
  const loud = L.loudestFrame(buf, sampleRate, 2048);
  const features = L.analyse(buf, sampleRate, { from: loud.from, frame: 2048 });
  return { track, path: L.pathOf(track), pose: L.vowelPose(features, { calibration: cal }), features };
}

// Several vowels said one after another, as one recording.
function glide(names, who) {
  const parts = names.map((v) => S.say(who || "child", v, 42).buf);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Float32Array(total);
  let at = 0;
  for (const p of parts) { buf.set(p, at); at += p.length; }
  return buf;
}

// The child's own vowel space, from the three corner sounds.
function vowelCal(who) {
  return L.calibrateVowels(["ee", "ah", "oo"].map((v) => ({ id: v, features: feat(who, v) })));
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

  // ---- 9. vowels: formants as a tongue position -------------------

  "a vowel gets placed on the chart; a fricative does not"() {
    for (const v of ["ee", "ah", "oo"]) {
      const p = L.vowelPose(feat("child", v), { band: "child" });
      assert.ok(p, `/${v}/ should get a position`);
      assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, JSON.stringify(p));
    }
    // Placing a hiss on a vowel chart would be a fiction: there is no
    // tongue position that /s/ "is", and the LPC peaks are the noise shape.
    for (const c of ["s", "sh", "z"]) {
      assert.equal(L.vowelPose(feat("child", c), { band: "child" }), null,
        `/${c}/ must not be placed on the vowel chart`);
    }
    assert.equal(L.vowelPose(feat("child", "quiet"), { band: "child" }), null);
  },

  "an unvoiced sound is not placed, even when it isn't a hiss"() {
    // Breath, a chair scrape, a mic bump: not fricative-flat, so the
    // frication gate misses them, but LPC still returns peaks and those
    // peaks are not a tongue. Voicing is the gate that catches these.
    // (It also means a whispered vowel gets no placement — the safe
    // trade: nothing shown beats a confident reading of room noise.)
    const breathy = Object.assign({}, feat("child", "ah"), { clarity: 0.1, f0: 0 });
    assert.equal(L.vowelPose(breathy, { band: "child" }), null);
    assert.ok(L.CHECKS, "sanity");
    // and the same features WITH voicing do get placed, so the test is
    // pinning the voicing gate and not something incidental
    assert.ok(L.vowelPose(feat("child", "ah"), { band: "child" }));
  },

  "the three corner vowels land on their own corners"() {
    // /iː/ front and close, /aː/ open, /ʉː/ back and close. If these drift
    // the whole chart is rotated and every piece of advice is wrong.
    const p = (v) => L.vowelPose(feat("child", v), { band: "child" });
    const ee = p("ee"), ah = p("ah"), oo = p("oo");
    assert.ok(ee.x < 25, "/iː/ should be front, got x=" + ee.x);
    assert.ok(ee.y < 25, "/iː/ should be close, got y=" + ee.y);
    assert.ok(ah.y > 60, "/aː/ should be open, got y=" + ah.y);
    assert.ok(oo.x > 60, "/ʉː/ should be back, got x=" + oo.x);
    assert.ok(oo.y < 30, "/ʉː/ should be close, got y=" + oo.y);
  },

  "backness uses F2 minus F1, because raw F2 misreads open vowels"() {
    // F1 climbs towards F2 as the mouth opens, so raw F2 put a textbook
    // /aː/ 24 units too far forward and the app told a correct tongue to
    // move. This is that regression, pinned.
    const cal = { band: "child", vowelBox: vowelCal("child") };
    const ah = L.vowelPose(feat("child", "ah"), { calibration: cal });
    assert.ok(Math.abs(ah.x - 80) <= 15, "/aː/ backness x=" + ah.x + ", target 80");
    assert.equal(L.vowelFeedback(ah, [80, 90]).close, true,
      "a good /aː/ must not be corrected");
  },

  "a calibrated child's own corner vowels come back as correct"() {
    const cal = { band: "child", vowelBox: vowelCal("child") };
    const targets = { ee: [6, 6], ah: [80, 90], oo: [72, 8] };
    for (const [v, target] of Object.entries(targets)) {
      const pose = L.vowelPose(feat("child", v), { calibration: cal });
      const fb = L.vowelFeedback(pose, target);
      assert.equal(fb.close, true,
        `/${v}/ at (${pose.x},${pose.y}) vs target (${target}) — distance ${fb.distance}: ${fb.tip}`);
    }
  },

  "a child and an adult saying the same vowel land in the same place"() {
    // The entire point of a personal reference. Raw formants differ by
    // ~50%; the positions should not.
    for (const v of ["ee", "ah", "oo"]) {
      const kid = L.vowelPose(feat("child", v), { calibration: { vowelBox: vowelCal("child") } });
      const grown = L.vowelPose(feat("adult", v), { calibration: { vowelBox: vowelCal("adult") } });
      assert.ok(Math.abs(kid.x - grown.x) <= 15 && Math.abs(kid.y - grown.y) <= 15,
        `${v}: child (${kid.x},${kid.y}) vs adult (${grown.x},${grown.y}) — ` +
        `raw F1 ${kid.f1}/${grown.f1}, F2 ${kid.f2}/${grown.f2}`);
    }
  },

  "an uncalibrated reading is offered with lower confidence"() {
    const withBox = L.vowelPose(feat("child", "ah"), { calibration: { vowelBox: vowelCal("child") } });
    const without = L.vowelPose(feat("child", "ah"), { band: "child" });
    assert.equal(withBox.personal, true);
    assert.equal(without.personal, false);
    assert.ok(without.confidence < withBox.confidence,
      `${without.confidence} should be under ${withBox.confidence}`);
  },

  "calibrateVowels refuses a box built from corners that aren't corners"() {
    // Three readings of the same vowel describe no space. A box built from
    // them would put every later vowel in the same wrong spot, confidently.
    const same = feat("child", "ah");
    assert.equal(L.calibrateVowels(
      [{ id: "ee", features: same }, { id: "ah", features: same }, { id: "oo", features: same }]), null);
    assert.equal(L.calibrateVowels([{ id: "ee", features: feat("child", "ee") }]), null,
      "one corner is not a space");
    assert.ok(L.calibrateVowels([
      { id: "ee", features: feat("child", "ee") },
      { id: "ah", features: feat("child", "ah") },
      { id: "oo", features: feat("child", "oo") }]), "three real corners should work");
  },

  "calibrate() carries the vowel box alongside the sibilant split"() {
    const cal = L.calibrate([
      { id: "s", features: feat("child", "s") },
      { id: "sh", features: feat("child", "sh") },
      { id: "ee", features: feat("child", "ee") },
      { id: "ah", features: feat("child", "ah") },
      { id: "oo", features: feat("child", "oo") },
    ]);
    assert.ok(cal.split > 0, "sibilant split");
    assert.ok(cal.vowelBox && cal.vowelBox.open > cal.vowelBox.close, "vowel box");
    assert.equal(cal.band, "child");
  },

  "feedback names one axis, the one furthest out"() {
    // A five-year-old told two things about their tongue at once has been
    // told nothing.
    const tooOpen = L.vowelFeedback({ x: 6, y: 60 }, [6, 6]);
    assert.ok(/close your mouth/i.test(tooOpen.tip), tooOpen.tip);
    const tooClosed = L.vowelFeedback({ x: 80, y: 30 }, [80, 90]);
    assert.ok(/open your mouth/i.test(tooClosed.tip), tooClosed.tip);
    const tooBack = L.vowelFeedback({ x: 80, y: 6 }, [6, 6]);
    assert.ok(/tongue forward/i.test(tooBack.tip), tooBack.tip);
    const tooFront = L.vowelFeedback({ x: 6, y: 8 }, [72, 8]);
    assert.ok(/tongue back/i.test(tooFront.tip), tooFront.tip);
    assert.equal(L.vowelFeedback({ x: 40, y: 40 }, [40, 40]).tip, "That's the shape.");
  },

  "an uncertain reading does not correct a child who was right"() {
    // Without a personal reference an age-band table can place a perfect
    // vowel 20+ units off. Correcting on a measurement already labelled
    // "a rough guess" makes a child move a tongue that was right — so the
    // tolerance widens as confidence drops.
    const uncal = L.vowelPose(feat("child", "ah"), { band: "child" });
    assert.ok(uncal.confidence <= 0.5, "uncalibrated should not read as sure");
    const fb = L.vowelFeedback(uncal, [80, 90]);
    assert.ok(fb.distance > 18, "premise: the table misplaces it by " + fb.distance);
    assert.equal(fb.close, true, "a correct /aː/ must not be corrected at " +
      fb.distance + " with tolerance " + fb.tolerance);

    // ...but a genuinely wrong vowel is still called out, however unsure.
    const wrong = L.vowelPose(feat("child", "ee"), { band: "child" });
    assert.equal(L.vowelFeedback(wrong, [80, 90]).close, false,
      "/iː/ for /aː/ is wrong at any confidence");
  },

  "tolerance widens as confidence falls, and never the other way"() {
    const t = L.toleranceFor;
    assert.ok(t(1) <= t(0.5), "surer should not be more forgiving");
    assert.ok(t(0.5) <= t(0.1));
    assert.equal(t(null), t(1), "no confidence given behaves like a sure reading");
  },

  "a calibrated reading is held to the tighter tolerance"() {
    const cal = { band: "child", vowelBox: vowelCal("child") };
    const p = L.vowelPose(feat("child", "ah"), { calibration: cal });
    assert.ok(p.confidence >= 0.66, "own corners should read as sure, got " + p.confidence);
    assert.equal(L.vowelFeedback(p, [80, 90]).tolerance, 18);
  },

  // ---- 10. the FFT, and watching a tongue move --------------------

  "the FFT gives the same answer as the textbook transform"() {
    // The whole app's spectral analysis rides on this. A wrong FFT would
    // shift every centroid and quietly rewrite every /s/-vs-/sh/ call, so
    // it is checked against the slow transform it replaced rather than
    // against itself.
    const { buf, sampleRate } = S.say("child", "s", 42);
    const w = (n) => { const a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
      return a; };
    for (const n of [256, 512, 1024, 2048]) {
      const fast = L.spectrum(buf, 0, n, sampleRate);
      const slow = L.dftSpectrum(buf, 0, n, w(n), sampleRate);
      assert.equal(fast.mag.length, slow.mag.length, "bin count at N=" + n);
      assert.equal(fast.binHz, slow.binHz, "bin width at N=" + n);
      let peak = 0, worst = 0;
      for (let k = 0; k < slow.mag.length; k++) {
        peak = Math.max(peak, slow.mag[k]);
        worst = Math.max(worst, Math.abs(fast.mag[k] - slow.mag[k]));
      }
      assert.ok(worst / peak < 1e-9, `N=${n}: relative error ${worst / peak}`);
    }
  },

  "a frame that isn't a power of two still gets a spectrum"() {
    // The ragged end of a buffer. It falls back to the slow path rather
    // than silently returning nothing.
    const { buf, sampleRate } = S.say("child", "s", 42);
    const odd = L.spectrum(buf, 0, 1000, sampleRate);
    assert.equal(odd.mag.length, 500);
    assert.ok(odd.mag.some((v) => v > 0), "should not be empty");
  },

  "analysis is fast enough to run live"() {
    // A tongue that updates 30 times a second needs a frame in well under
    // 33 ms. With the naive transform one frame took ~60 ms, so this is
    // the test that stops that coming back.
    const { buf, sampleRate } = S.say("child", "ah", 42);
    const t0 = Date.now();
    for (let i = 0; i < 30; i++) L.analyse(buf, sampleRate, { from: 0, frame: 2048 });
    const per = (Date.now() - t0) / 30;
    assert.ok(per < 15, `analyse() takes ${per.toFixed(1)} ms/frame — too slow to track live`);
  },

  "a track follows the tongue from one vowel to the next"() {
    // "ee-ah-oo" end to end: front-close, then open, then back-close.
    // If the track were reading noise these would not come out in order.
    const track = L.trackVowel(glide(["ee", "ah", "oo"]), 44100,
      { calibration: { band: "child", vowelBox: vowelCal("child") }, fps: 30 });
    const at = (frac) => {
      const s = track.samples.filter((p) => p.x != null);
      return s[Math.floor(s.length * frac)];
    };
    const ee = at(0.1), ah = at(0.5), oo = at(0.9);
    assert.ok(ee.x < 25 && ee.y < 25, `start should be front-close, got (${ee.x},${ee.y})`);
    assert.ok(ah.y > 60, `middle should be open, got (${ah.x},${ah.y})`);
    assert.ok(oo.x > 55 && oo.y < 35, `end should be back-close, got (${oo.x},${oo.y})`);
    assert.ok(track.samples.length > 30, "expected a frame every ~33 ms");
  },

  "smoothing removes a one-frame jump without erasing a real move"() {
    // LPC picks a wrong peak now and then. Unsmoothed, one bad frame
    // throws the tongue across the mouth and back — which reads as the
    // app being broken, not as a measurement being hard.
    const track = L.trackVowel(glide(["ee", "ah", "oo"]), 44100,
      { calibration: { band: "child", vowelBox: vowelCal("child") }, fps: 30 });
    const placed = track.samples.filter((p) => p.x != null);
    let jumps = 0, rawJumps = 0;
    for (let i = 1; i < placed.length; i++) {
      const d = Math.abs(placed[i].x - placed[i - 1].x) + Math.abs(placed[i].y - placed[i - 1].y);
      const r = Math.abs(placed[i].rawX - placed[i - 1].rawX) +
                Math.abs(placed[i].rawY - placed[i - 1].rawY);
      if (d > 45) jumps++;
      if (r > 45) rawJumps++;
    }
    assert.ok(jumps <= rawJumps, "smoothing should not add jumps");
    // and the real journey still happens
    const xs = placed.map((p) => p.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 40,
      "the tongue should still visibly travel front to back");
  },

  "a gap in the track is a gap, not a snap to neutral"() {
    // Silence and consonants come back as null so the UI can hold the
    // last position. A tongue that flies home between every sound reads
    // as a fault rather than as a gap in what the mic can see.
    const sr = 44100;
    const v = S.say("child", "ah", 42).buf;
    const quiet = new Float32Array(Math.round(sr * 0.4));
    const buf = new Float32Array(v.length + quiet.length + v.length);
    buf.set(v, 0); buf.set(v, v.length + quiet.length);
    const track = L.trackVowel(buf, sr, { band: "child", fps: 30 });
    assert.ok(track.samples.some((p) => p.x == null), "the silence should read as a gap");
    assert.ok(track.samples.filter((p) => p.x != null).length > 10, "the vowels should not");
  },

  "steadiest() finds where the tongue stopped, not where it was loudest"() {
    const track = L.trackVowel(glide(["ee", "ah"]), 44100,
      { calibration: { band: "child", vowelBox: vowelCal("child") }, fps: 30 });
    const held = L.steadiest(track, { ms: 120 });
    assert.ok(held, "expected a steady stretch");
    assert.ok(held.steadiness <= 12, "steadiness " + held.steadiness + " is not steady");
    assert.ok(held.to > held.from, "should span time");
  },

  "the live tracker and the offline track agree"() {
    // Same maths either way — the live path just gets the audio in
    // pieces. If they drift, what a child watches live stops matching
    // what the replay shows them.
    const buf = glide(["ee", "ah"]);
    const opts = { calibration: { band: "child", vowelBox: vowelCal("child") }, fps: 30 };
    const offline = L.trackVowel(buf, 44100, opts);
    const live = L.makeTracker(44100, opts);
    const got = [];
    for (let at = 0; at + live.hop <= buf.length; at += live.hop) {
      got.push(live.push(buf.subarray(at, at + live.hop)));
    }
    assert.equal(got.length, offline.samples.length);
    for (let i = 0; i < got.length; i++) {
      const a = got[i], b = offline.samples[i];
      if (b.x == null) { assert.equal(a, null, "frame " + i + " should be a gap"); continue; }
      assert.ok(a, "frame " + i + " should be placed");
      assert.equal(a.x, b.x, "x at frame " + i);
      assert.equal(a.y, b.y, "y at frame " + i);
    }
  },

  // ---- 11. one grapheme, several sounds ---------------------------

  "the boxes fill in whatever order the child says them"() {
    // <a> says three sounds and there is no correct order for them.
    // Grading position by position would mark a child wrong for something
    // that is not an error, so this is a set match, not a sequence match.
    const T = [{ id: "a.ee", kind: "v", at: [6, 6] },
               { id: "a.ah", kind: "v", at: [80, 90] },
               { id: "a.oo", kind: "v", at: [72, 8] }];
    for (const order of [["ee", "ah", "oo"], ["oo", "ee", "ah"], ["ah", "oo", "ee"]]) {
      const claimed = [];
      for (const v of order) {
        const m = L.matchSounds(T, attemptOf(v), { calibration: childCal(), claimed });
        assert.equal(m.verdict, "claimed", `saying ${v} should fill a box, got ${m.verdict}`);
        assert.equal(m.claimed, "a." + v, `${v} filled ${m.claimed}`);
        claimed.push(m.claimed);
      }
      assert.equal(claimed.length, 3, "order " + order.join(",") + " left a box empty");
    }
  },

  "a box that is already full is not filled twice"() {
    const T = [{ id: "a.ee", kind: "v", at: [6, 6] }, { id: "a.ah", kind: "v", at: [80, 90] }];
    const first = L.matchSounds(T, attemptOf("ee"), { calibration: childCal() });
    assert.equal(first.claimed, "a.ee");
    // saying it again finds nothing among the boxes still open
    const again = L.matchSounds(T, attemptOf("ee"), { calibration: childCal(), claimed: ["a.ee"] });
    assert.notEqual(again.verdict, "claimed");
    // and the other sound still works afterwards
    const other = L.matchSounds(T, attemptOf("ah"), { calibration: childCal(), claimed: ["a.ee"] });
    assert.equal(other.claimed, "a.ah");
  },

  "two sounds too alike to separate are asked about, not guessed"() {
    // <oo> says /ʉː/ and /ʊ/, which sit 15 apart on a chart whose honest
    // tolerance is 18. Naming one would hand a child mastery of a sound
    // they may never have said.
    const OO = [{ id: "oo.long", kind: "v", at: [72, 8] },
                { id: "oo.short", kind: "v", at: [78, 22] }];
    const m = L.matchSounds(OO, attemptOf("oo"), { calibration: childCal() });
    assert.equal(m.verdict, "ambiguous", "expected a refusal, got " + m.verdict + " " + m.claimed);
    assert.equal(m.ambiguous.length, 2);
    assert.equal(m.claimed, null);
  },

  "a diphthong is matched on its path, not where it lands"() {
    // <ey> says /eɪ/ and /aɪ/. They finish in the same place and set off
    // 65 apart — endpoint matching calls them identical.
    const EY = [{ id: "ey.ay", kind: "d", from: [16, 42], to: [20, 18] },
                { id: "ey.igh", kind: "d", from: [60, 90], to: [20, 18] }];
    const ay = attemptOf("ay"), igh = attemptOf("igh");
    // premise: the endpoints really are the same
    assert.ok(Math.hypot(ay.path.to[0] - igh.path.to[0], ay.path.to[1] - igh.path.to[1]) < 12,
      "premise: both should finish in the same place");
    assert.ok(Math.hypot(ay.path.from[0] - igh.path.from[0], ay.path.from[1] - igh.path.from[1]) > 40,
      "premise: they should set off far apart");
    // and it is never confidently wrong about which is which
    for (const [said, a] of [["ay", ay], ["igh", igh]]) {
      const m = L.matchSounds(EY, a, { calibration: childCal() });
      if (m.claimed) assert.equal(m.claimed, "ey." + said,
        `saying ${said} claimed ${m.claimed}`);
      else assert.ok(m.ambiguous.indexOf("ey." + said) !== -1,
        `saying ${said} did not even list it as possible`);
    }
    assert.equal(L.matchSounds(EY, igh, { calibration: childCal() }).claimed, "ey.igh",
      "/aɪ/ starts far enough from /eɪ/ to be called outright");
  },

  "a flattened diphthong is not accepted as the diphthong"() {
    // Children flatten /aɪ/ into /ɑː/ — they set off from the right place
    // and never make the journey. The start is what separates one
    // diphthong from another, but the finish is what says they did it,
    // so both count.
    const T = [{ id: "x.igh", kind: "d", from: [60, 90], to: [20, 18] }];
    const flat = attemptOf("ah");            // starts where /aɪ/ starts, goes nowhere
    assert.ok(Math.hypot(flat.path.from[0] - 60, flat.path.from[1] - 90) < 20,
      "premise: /ɑː/ sits on /aɪ/'s starting point");
    assert.notEqual(L.matchSounds(T, flat, { calibration: childCal() }).verdict, "claimed",
      "a vowel that never travelled is not the diphthong");
    assert.equal(L.matchSounds(T, attemptOf("igh"), { calibration: childCal() }).claimed, "x.igh",
      "...but the real one still is");
  },

  "two diphthongs that set off together are told apart by where they end"() {
    // The mirror of the <ey> case. /aɪ/ (my) and /aʊ/ (now) both start at
    // the open back corner and finish at opposite ends of the mouth — so
    // the finish is what separates them, exactly where the start separated
    // /eɪ/ from /aɪ/. Matching on either alone gets one of the two pairs
    // wrong; <ow> and <ou> in the bank need both.
    const OW = [{ id: "x.igh", kind: "d", from: [60, 90], to: [20, 18] },
                { id: "x.ow", kind: "d", from: [45, 88], to: [78, 22] }];
    const igh = attemptOf("igh"), ow = attemptOf("ow");
    assert.ok(Math.hypot(igh.path.from[0] - ow.path.from[0], igh.path.from[1] - ow.path.from[1]) < 20,
      "premise: both should set off from the same corner");
    assert.ok(Math.hypot(igh.path.to[0] - ow.path.to[0], igh.path.to[1] - ow.path.to[1]) > 35,
      "premise: they should finish far apart");
    for (const [said, a] of [["igh", igh], ["ow", ow]]) {
      const m = L.matchSounds(OW, a, { calibration: childCal() });
      if (m.claimed) assert.equal(m.claimed, "x." + said, `saying ${said} claimed ${m.claimed}`);
      else assert.ok(m.ambiguous.indexOf("x." + said) !== -1, `${said} was not even listed`);
    }
  },

  "a best match that still needs the picture question does not fill a box"() {
    // <th> says /θ/ and /ð/. A voiceless attempt beats /ð/ on voicing, but
    // grade() still says "ask" because voiceless-weak-fricative is equally
    // /f/. Claiming here would hand a child mastery of /θ/ on evidence the
    // module has already called insufficient — the two refusals compose.
    const TH = [{ id: "th.th", kind: "c", phoneme: "th" },
                { id: "th.dh", kind: "c", phoneme: "dh" }];
    const m = L.matchSounds(TH, { features: feat("child", "th") }, { band: "child" });
    assert.equal(m.verdict, "confirm", "expected a picture question, got " + m.verdict);
    assert.equal(m.claimed, null, "nothing may be claimed until the child confirms");
    assert.equal(m.confirm.id, "th.th");
    assert.ok(/tongue/i.test(m.confirm.grade.ask), m.confirm.grade.ask);
    // a sound the cues DO settle still claims outright
    const SZ = [{ id: "s.s", kind: "c", phoneme: "s" }, { id: "s.z", kind: "c", phoneme: "z" }];
    assert.equal(L.matchSounds(SZ, { features: feat("child", "z") }, { band: "child" }).verdict, "claimed");
  },

  "a held vowel cannot fill a diphthong box"() {
    // The mirror of the gate below, and the one that actually bit: /iː/
    // sits near both ends of /eɪ/, so on distance alone a child holding
    // "ee" filled the "ā" box on <a> and was told they were right.
    const T = [{ id: "x.ay", kind: "d", from: [16, 42], to: [20, 18] }];
    const held = attemptOf("ee");
    assert.ok(held.path.moved < 12, "premise: a held vowel barely moves");
    assert.notEqual(L.matchSounds(T, held, { calibration: childCal() }).verdict, "claimed",
      "a tongue that stayed put did not make the journey");
    assert.equal(L.matchSounds(T, attemptOf("ay"), { calibration: childCal() }).claimed, "x.ay",
      "...but the real glide still fills it");
  },

  "a vowel that travelled cannot fill a held-vowel box"() {
    // /aɪ/ sets off from exactly where /ɑː/ lives. Without a movement gate
    // a child saying "igh" fills the "ah" box and is told they were right.
    const held = [{ id: "x.ah", kind: "v", at: [73, 90] }];
    const m = L.matchSounds(held, attemptOf("igh"), { calibration: childCal() });
    assert.notEqual(m.verdict, "claimed", "a diphthong must not fill a monophthong box");
    // ...and a real held vowel still fills it
    assert.equal(L.matchSounds(held, attemptOf("ah"), { calibration: childCal() }).claimed, "x.ah");
  },

  "pathOf tells a glide from a hold"() {
    assert.ok(attemptOf("ah").path.moved < 12, "a held vowel should barely move");
    assert.ok(attemptOf("ee").path.moved < 12);
    assert.ok(attemptOf("igh").path.moved > 40, "a diphthong should travel");
    assert.ok(attemptOf("ay").path.moved > 25);
  },

  "the margin widens when the reading is less certain"() {
    // Same two targets, same attempt: sure enough and it calls it, unsure
    // and it asks. The alternative is a coin flip presented as a fact.
    const T = [{ id: "a", kind: "v", at: [40, 40] }, { id: "b", kind: "v", at: [40, 62] }];
    const near = { pose: { x: 40, y: 42, confidence: 1 }, path: { moved: 0 }, features: { rms: 0.1 } };
    const unsure = { pose: { x: 40, y: 42, confidence: 0.2 }, path: { moved: 0 }, features: { rms: 0.1 } };
    assert.equal(L.matchSounds(T, near).verdict, "claimed");
    assert.equal(L.matchSounds(T, unsure).verdict, "ambiguous");
  },

  "a sound that belongs to none of the boxes is reported as such"() {
    const T = [{ id: "a.ee", kind: "v", at: [6, 6] }];
    const m = L.matchSounds(T, attemptOf("ah"), { calibration: childCal() });
    assert.equal(m.verdict, "off");
    assert.ok(m.nearest, "should still say what it was nearest to");
  },

  "consonant boxes are matched by their cues"() {
    // <c> says /k/ and /s/; <s> says /s/ and /z/. Same machinery, scored
    // through grade() rather than the vowel chart.
    const C = [{ id: "c.k", kind: "c", phoneme: "k" }, { id: "c.s", kind: "c", phoneme: "s" }];
    const m = L.matchSounds(C, attemptOf("s"), { band: "child" });
    assert.equal(m.claimed, "c.s", "a hiss should fill the /s/ box, got " + JSON.stringify(m.scores));
    const S2 = [{ id: "s.s", kind: "c", phoneme: "s" }, { id: "s.z", kind: "c", phoneme: "z" }];
    assert.equal(L.matchSounds(S2, attemptOf("z"), { band: "child" }).claimed, "s.z",
      "voicing should separate /s/ from /z/");
  },

  "the chart anchors agree with the diagram that draws them"() {
    // listen.js restates where /iː/, /aː/ and /ʉː/ sit so it stays free of
    // the UI. mouth.js's VOW table is what actually positions the tongue.
    // If they drift, the app animates to one place and grades against
    // another, and every correction is quietly wrong.
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "mouth.js"), "utf8");
    const row = (ipa) => {
      const m = src.match(new RegExp('"' + ipa + '":\\["[^"]*",(\\d+),(\\d+)\\]'));
      assert.ok(m, "no VOW entry for /" + ipa + "/ in mouth.js");
      return [Number(m[1]), Number(m[2])];
    };
    const see = row("iː"), spa = row("aː"), food = row("ʉː");
    assert.equal(L.ANCHOR.frontX, see[0], "frontX should be /iː/'s x");
    assert.equal(L.ANCHOR.closeY, see[1], "closeY should be /iː/'s y");
    assert.equal(L.ANCHOR.openY, spa[1], "openY should be /aː/'s y");
    assert.equal(L.ANCHOR.backX, food[0], "backX should be /ʉː/'s x");
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
