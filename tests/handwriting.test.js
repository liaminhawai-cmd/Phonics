const assert = require("assert");
const H = require("../js/core/handwriting/score.js");
const STYLE = require("../data/handwriting/letterforms-vic-modern-cursive.json");

const N = 48;
const LETTERS = STYLE.letters;

// Every fixture is built by SAMPLING THE REAL MODEL, so these tests fail if
// either the scoring maths or the letterform data drifts.
function modelStrokes(letter, n) {
  return LETTERS[letter].strokes.map(s => H.pathToPoints(s.path, n || N));
}
function score(letter, attemptStrokes, thirds) {
  return H.scoreAttempt({ attemptStrokes, letterModel: LETTERS[letter], thirds });
}
function self(letter) { return score(letter, modelStrokes(letter)); }
function move(strokes, dx, dy) {
  return strokes.map(s => s.map(p => ({ x: p.x + dx, y: p.y + dy })));
}
// Seeded LCG — no Math.random anywhere, so a failure is always reproducible.
function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function scribble(seed, nPts) {
  const rnd = lcg(seed);
  const pts = [];
  let x = 25, y = 50;
  for (let i = 0; i < nPts; i++) {
    pts.push({ x, y });
    x += (rnd() - 0.5) * 26;
    y += (rnd() - 0.5) * 26;
  }
  return pts;
}
function minFeature(res) { return Math.min.apply(null, Object.keys(res.features).map(k => res.features[k])); }

module.exports = {
  // ---- 1. the model against itself ----------------------------------
  "the model's own strokes score full marks against themselves"() {
    const keys = Object.keys(LETTERS);
    assert.ok(keys.length >= 10, "expected a real letterform set, got " + keys.length);
    for (const k of keys) {
      const r = self(k);
      assert.ok(r.total >= 90, `${k}: total ${r.total} < 90`);
      assert.ok(minFeature(r) >= 90, `${k}: features ${JSON.stringify(r.features)}`);
      assert.equal(r.band, "great", `${k}: band ${r.band}`);
      assert.deepEqual(r.advice, [], `${k}: unexpected advice ${r.advice}`);
    }
  },

  "each model stroke matches its own model stroke, in order"() {
    for (const k of Object.keys(LETTERS)) {
      const r = self(k);
      assert.equal(r.matches.length, LETTERS[k].strokes.length, k);
      r.matches.forEach((m, i) => {
        assert.equal(m.attempt, i, `${k} stroke ${i}`);
        assert.equal(m.model, i, `${k} stroke ${i} matched model stroke ${m.model}`);
      });
    }
  },

  // ---- 2. direction: the clockwise 'o' ------------------------------
  "'o' drawn clockwise fails the direction feature"() {
    const reversed = modelStrokes("o").map(s => s.slice().reverse());
    const r = score("o", reversed);
    const good = self("o");
    assert.ok(r.features.direction <= 40, "direction " + r.features.direction);
    assert.ok(r.total <= good.total - 15, `total ${r.total} vs clean ${good.total}`);
    // Shape and placement are untouched — a reversed 'o' still looks like an
    // 'o'. Direction is the ONLY thing that can catch it.
    assert.ok(r.features.shape >= 90, "shape " + r.features.shape);
    assert.ok(r.features.placement >= 90, "placement " + r.features.placement);
    assert.equal(r.band, "getting-there");
  },

  "a reversed anticlockwise letter gets the 'clockwise' advice line"() {
    const reversed = modelStrokes("o").map(s => s.slice().reverse());
    const r = score("o", reversed);
    assert.ok(r.advice.length >= 1, "no advice");
    assert.ok(/wrong way|2 o'clock/.test(r.advice[0]), r.advice[0]);
  },

  "every anticlockwise-loop letter fails direction when drawn backwards"() {
    for (const k of ["c", "o", "a", "d", "g", "q", "e"]) {
      const r = score(k, modelStrokes(k).map(s => s.slice().reverse()));
      assert.ok(r.features.direction <= 40, `${k}: direction ${r.features.direction}`);
      assert.ok(r.total <= 70, `${k}: total ${r.total}`);
    }
  },

  // ---- 3. order: 'a' built stick-first --------------------------------
  "'a' drawn with its strokes in the wrong order is penalised for order"() {
    const swapped = modelStrokes("a").slice().reverse();   // stick, then circle
    const r = score("a", swapped);
    const good = self("a");
    assert.ok(r.features.order <= 40, "order " + r.features.order);
    assert.ok(r.total < good.total, `total ${r.total} vs clean ${good.total}`);
    // The strokes themselves are perfect — only the order is wrong.
    assert.ok(r.features.shape >= 90, "shape " + r.features.shape);
    assert.ok(r.features.direction >= 90, "direction " + r.features.direction);
    assert.ok(r.features.strokeCount >= 90, "strokeCount " + r.features.strokeCount);
    // ...and the matcher still knows which stroke was which.
    assert.deepEqual(r.matches.map(m => m.model), [1, 0]);
    assert.ok(r.advice.some(a => /Round part first/.test(a)), r.advice.join(" | "));
  },

  "'i' dotted before the body is an order error, not a shape one"() {
    const [body, dot] = modelStrokes("i");
    const r = score("i", [dot, body]);
    assert.ok(r.features.order <= 40, "order " + r.features.order);
    assert.ok(r.features.shape >= 90, "shape " + r.features.shape);
    assert.ok(r.advice.some(a => /Body first/.test(a)), r.advice.join(" | "));
  },

  // ---- 4. placement: 'c' floating above the baseline -------------------
  "'c' floating above the baseline is penalised for placement"() {
    const floating = move(modelStrokes("c"), 0, -25);     // still inside the box
    const box = H.bboxOf([].concat.apply([], floating));
    assert.ok(box.minY > 0 && box.maxY < 100, "fixture left the letter box");
    const r = score("c", floating);
    assert.ok(r.features.placement <= 60, "placement " + r.features.placement);
    assert.ok(self("c").features.placement >= 90);
    // Everything about the letterform itself is still perfect.
    assert.ok(r.features.shape >= 90, "shape " + r.features.shape);
    assert.ok(r.features.direction >= 90, "direction " + r.features.direction);
    assert.ok(r.advice.some(a => /dotted line|baseline/.test(a)), r.advice.join(" | "));
  },

  "placement reads the thirds the attempt was drawn on"() {
    // Same letter, drawn 3x bigger on a canvas whose guidelines are 3x apart
    // and offset: identical score, because thirds map it back into the box.
    const big = modelStrokes("c").map(s => s.map(p => ({ x: p.x * 3 + 120, y: p.y * 3 + 40 })));
    const thirds = { top: 40, mid: 33.3 * 3 + 40, base: 66.6 * 3 + 40, floor: 340 };
    const r = H.scoreAttempt({ attemptStrokes: big, letterModel: LETTERS.c, thirds });
    assert.ok(r.features.placement >= 90, "placement " + r.features.placement);
    assert.ok(r.total >= 90, "total " + r.total);
    // ...and without telling it about the guidelines, placement collapses.
    const naive = H.scoreAttempt({ attemptStrokes: big, letterModel: LETTERS.c });
    assert.ok(naive.features.placement <= 40, "naive placement " + naive.features.placement);
  },

  "a good baseline can't hide a missing ascender"() {
    // 'l' squashed down to x-height: it sits perfectly on the baseline, so
    // placement has to be scored on its WORSE edge or the error vanishes.
    const base = 66.6, k = (base - 33.3) / (base - 8);
    const short = modelStrokes("l").map(s => s.map(p => ({ x: p.x, y: base - (base - p.y) * k })));
    const r = score("l", short);
    assert.ok(r.features.placement <= 60, "placement " + r.features.placement);
    assert.ok(r.total < 85, "a letter in the wrong zone is not 'great': " + r.total);
    assert.ok(r.features.shape >= 80, "the shape itself is fine: " + r.features.shape);
    assert.ok(r.advice.some(a => /tall|top line/.test(a)), r.advice.join(" | "));
  },

  "a descender that stops at the baseline loses placement marks"() {
    // 'g' with its tail cut off at the baseline.
    const strokes = modelStrokes("g").map(s => s.map(p => ({ x: p.x, y: Math.min(p.y, 66.6) })));
    const r = score("g", strokes);
    assert.ok(r.features.placement <= 70, "placement " + r.features.placement);
    assert.ok(self("g").features.placement >= 90);
  },

  // ---- 5. scribble -----------------------------------------------------
  "a random scribble scores near zero whatever letter it is aimed at"() {
    for (const seed of [1, 7, 99, 2026, 424242]) {
      for (const letter of ["a", "o", "c", "i", "t"]) {
        const r = score(letter, [scribble(seed, 20)]);
        assert.ok(r.total <= 40, `seed ${seed} vs '${letter}': total ${r.total} ${JSON.stringify(r.features)}`);
        assert.equal(r.band, "keep-practising", `seed ${seed} vs '${letter}'`);
        assert.ok(r.advice.length > 0, "a bad attempt should say something");
      }
    }
  },

  "a wobbly but correct letter still scores well"() {
    // The counterweight to the scribble test: jitter every point by up to
    // +/-4 units (a real 5-year-old's line) and the score must survive.
    const rnd = lcg(31337);
    for (const k of ["c", "a", "n", "g", "t"]) {
      const wobbly = modelStrokes(k).map(s => s.map(p => ({
        x: p.x + (rnd() - 0.5) * 8, y: p.y + (rnd() - 0.5) * 8
      })));
      const r = score(k, wobbly);
      assert.ok(r.total >= 85, `${k}: total ${r.total} ${JSON.stringify(r.features)}`);
    }
  },

  // ---- 6. resample -----------------------------------------------------
  "resample returns exactly n points with monotone arc positions"() {
    const L = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }];   // 3-point L, length 20
    for (const n of [2, 8, 48, 64]) {
      const out = H.resample(L, n);
      assert.equal(out.length, n, "n=" + n);
      assert.deepEqual(out[0], { x: 0, y: 0 }, "n=" + n);
      assert.ok(Math.abs(out[n - 1].x - 10) < 1e-9 && Math.abs(out[n - 1].y - 10) < 1e-9, "n=" + n);
      // Arc position along the original L: down the left side, then across.
      const arcOf = p => (p.y >= 10 - 1e-9 ? 10 + p.x : p.y);
      const step = 20 / (n - 1);
      let prev = -1;
      for (let i = 0; i < out.length; i++) {
        const a = arcOf(out[i]);
        assert.ok(a > prev, `n=${n} point ${i} arc ${a} not after ${prev}`);
        assert.ok(Math.abs(a - i * step) < 1e-6, `n=${n} point ${i} arc ${a} != ${i * step}`);
        prev = a;
      }
    }
  },

  "resample handles dots and one-point strokes"() {
    assert.deepEqual(H.resample([], 8), []);
    const one = H.resample([{ x: 3, y: 4 }], 8);
    assert.equal(one.length, 8);
    assert.deepEqual(one[7], { x: 3, y: 4 });
    const tap = H.resample([{ x: 3, y: 4 }, { x: 3, y: 4 }], 8);   // zero-length
    assert.equal(tap.length, 8);
    assert.deepEqual(tap[0], { x: 3, y: 4 });
    assert.equal(H.resample([[1, 2], [5, 2]], 5).length, 5);       // [x,y] pairs too
  },

  // ---- 7. pathToPoints (no DOM) ----------------------------------------
  "pathToPoints samples a cubic as a straight line when it is one"() {
    const pts = H.pathToPoints("M 0,0 C 0,0 100,0 100,0", 48);
    assert.equal(pts.length, 48);
    const maxY = Math.max.apply(null, pts.map(p => Math.abs(p.y)));
    assert.ok(maxY < 1, "max |y| = " + maxY);
    assert.ok(Math.abs(pts[0].x) < 1e-9, "starts at 0");
    assert.ok(Math.abs(pts[47].x - 100) < 1e-9, "ends at 100");
    // evenly spaced along x, because it is arc-length even along a line
    for (let i = 1; i < pts.length; i++) {
      assert.ok(Math.abs((pts[i].x - pts[i - 1].x) - 100 / 47) < 1e-6, "spacing at " + i);
    }
  },

  "pathToPoints follows L, C and repeated M segments"() {
    const line = H.pathToPoints("M 0,0 L 0,60", 12);
    assert.equal(line.length, 12);
    assert.ok(Math.abs(line[11].y - 60) < 1e-9);
    // A quadratic bulge leaves the chord.
    const q = H.pathToPoints("M 0,0 Q 50,50 100,0", 24);
    assert.ok(Math.max.apply(null, q.map(p => p.y)) > 20, "quadratic should bulge");
    // 'n' is one stroke with a retrace (a second M) — it must stay one polyline.
    const n = H.pathToPoints(LETTERS.n.strokes[0].path, 48);
    assert.equal(n.length, 48);
    const box = H.bboxOf(n);
    assert.ok(box.h > 25 && box.w > 20, JSON.stringify(box));
  },

  // ---- normalize / cloudDistance ---------------------------------------
  "normalize centres the centroid and scales the longest side to 1"() {
    const nz = H.normalize(modelStrokes("g"));
    const all = [].concat.apply([], nz.strokes);
    const box = H.bboxOf(all);
    assert.ok(Math.abs(Math.max(box.w, box.h) - 1) < 1e-9, JSON.stringify(box));
    assert.ok(box.w < box.h, "aspect ratio must be kept, not squashed");
    const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
    const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
    assert.ok(Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9, `centroid ${cx},${cy}`);
    assert.ok(nz.bbox.maxY > 90, "bbox stays in the original coords");
  },

  "cloudDistance weights the start of a stroke more than the end"() {
    // $P's index weighting, and the reason it is worth keeping: a wobble as
    // the pen lands matters more than one as it lifts off.
    const c = H.normalize([modelStrokes("c")[0]]).strokes[0];
    const bump = i => c.map((p, j) => (j === i ? { x: p.x + 0.3, y: p.y } : { x: p.x, y: p.y }));
    const early = H.cloudDistance(c, bump(0));
    const middle = H.cloudDistance(c, bump(24));
    const late = H.cloudDistance(c, bump(47));
    assert.ok(early > middle, `early ${early} should cost more than middle ${middle}`);
    assert.ok(middle > late, `middle ${middle} should cost more than late ${late}`);
  },

  "cloudDistance is zero for a cloud against itself and grows with difference"() {
    const c = modelStrokes("c")[0], o = modelStrokes("o")[0], l = modelStrokes("l")[0];
    const nc = H.normalize([c]).strokes[0];
    const no = H.normalize([o]).strokes[0];
    const nl = H.normalize([l]).strokes[0];
    assert.ok(H.cloudDistance(nc, nc) < 1e-9);
    assert.ok(H.cloudDistance(nc, no) < H.cloudDistance(nc, nl), "c is closer to o than to l");
    // symmetric, because we take the min of both directions
    assert.equal(H.cloudDistance(nc, nl), H.cloudDistance(nl, nc));
  },

  "scoring is scale and position invariant"() {
    for (const k of ["c", "a", "g", "i"]) {
      const clean = self(k);
      const big = modelStrokes(k).map(s => s.map(p => ({ x: p.x * 3 + 120, y: p.y * 3 + 40 })));
      const thirds = { top: 40, mid: 33.3 * 3 + 40, base: 66.6 * 3 + 40, floor: 340 };
      const r = H.scoreAttempt({ attemptStrokes: big, letterModel: LETTERS[k], thirds });
      assert.equal(r.total, clean.total, k);
      assert.deepEqual(r.features, clean.features, k);
    }
  },

  // ---- stroke count, dots ----------------------------------------------
  "stroke count is full marks only when the counts agree"() {
    assert.equal(self("t").features.strokeCount, 100);
    const noCross = score("t", [modelStrokes("t")[0]]);
    assert.ok(noCross.features.strokeCount <= 40, noCross.features.strokeCount);
    assert.ok(noCross.advice.some(a => /stroke/.test(a)), noCross.advice.join(" | "));
    const split = score("n", modelStrokes("n")[0].reduce((acc, p, i) => {
      acc[i < 24 ? 0 : 1].push(p); return acc;
    }, [[], []]));
    assert.ok(split.features.strokeCount <= 40, "a hump drawn separately: " + split.features.strokeCount);
  },

  "a half-drawn letter cannot claim full marks for stroke order"() {
    // Only the stem of 't': one stroke can't demonstrate an order, so the
    // order feature is scaled by how much of the letter was actually drawn.
    const r = score("t", [modelStrokes("t")[0]]);
    assert.equal(self("t").features.order, 100);
    assert.ok(r.features.order <= 60, "order " + r.features.order);
  },

  "a dot tapped as a single point still matches the model's dot stroke"() {
    const body = modelStrokes("i")[0];
    const r = score("i", [body, [{ x: 15, y: 25 }]]);
    assert.equal(r.features.strokeCount, 100);
    assert.deepEqual(r.matches.map(m => m.model), [0, 1], "the tap must claim the dot, not the stem");
    assert.ok(r.features.direction >= 90, "a tap has no direction to get wrong: " + r.features.direction);
    assert.ok(r.total >= 85, "total " + r.total);
  },

  // ---- start point -------------------------------------------------------
  "starting in the wrong place costs start marks with partial credit"() {
    const strokes = modelStrokes("l");
    const upsideDown = [strokes[0].slice().reverse()];      // starts at the bottom
    const r = score("l", upsideDown);
    assert.ok(r.features.start <= 40, "start " + r.features.start);
    assert.ok(r.advice.some(a => /Start at the top/.test(a)), r.advice.join(" | "));
    // Touching down outside the zone and running into the letter from there
    // is a near miss: partial credit, not a zero and not a free pass.
    const late = [H.resample([{ x: 6, y: 20 }].concat(strokes[0]), N)];
    const rn = score("l", late);
    assert.ok(rn.features.start > 30 && rn.features.start < 95,
      "near miss should get partial credit, got " + rn.features.start);
    // Sliding the whole letter sideways is NOT a start error — the start zone
    // travels with the letter, because scoring is translation invariant.
    const shifted = [strokes[0].map(p => ({ x: p.x + 10, y: p.y }))];
    assert.equal(score("l", shifted).features.start, 100);
  },

  // ---- bands / edges ------------------------------------------------------
  "gradeToBand cuts at 85 / 70 / 50"() {
    assert.equal(H.gradeToBand(100), "great");
    assert.equal(H.gradeToBand(85), "great");
    assert.equal(H.gradeToBand(84.9), "good");
    assert.equal(H.gradeToBand(70), "good");
    assert.equal(H.gradeToBand(69), "getting-there");
    assert.equal(H.gradeToBand(50), "getting-there");
    assert.equal(H.gradeToBand(49), "keep-practising");
    assert.equal(H.gradeToBand(0), "keep-practising");
  },

  "an empty attempt scores zero and asks for a go"() {
    const r = H.scoreAttempt({ attemptStrokes: [], letterModel: LETTERS.a });
    assert.equal(r.total, 0);
    assert.equal(r.band, "keep-practising");
    assert.equal(minFeature(r), 0);
    assert.equal(r.advice.length, 1);
    assert.deepEqual(H.scoreAttempt({}).features, r.features);
  },

  "the module is pure: scoring twice gives the same answer and mutates nothing"() {
    const strokes = modelStrokes("a");
    const before = JSON.stringify(strokes);
    const one = score("a", strokes);
    const two = score("a", strokes);
    assert.deepEqual(one.features, two.features);
    assert.equal(one.total, two.total);
    assert.equal(JSON.stringify(strokes), before, "input strokes were mutated");
    assert.equal(JSON.stringify(LETTERS.a.strokes.length), "2", "letter model was mutated");
  },
};
