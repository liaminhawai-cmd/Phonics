// ============================================================
// js/core/handwriting/score.js — window.PhonicsHandwriting
//
// The handwriting scoring engine from docs/ARCHITECTURE.md §9,
// as a PURE module: no DOM, no canvas, no storage, no deps. Points
// in, score out — so every rule here is unit-testable in Node
// (tests/handwriting.test.js) and the T9 task view is just capture
// + drawing around it.
//
// What it scores (0-100 with a per-feature breakdown):
//   strokeCount  did they use the right number of strokes?
//   order        did they draw them in the model's order?
//   direction    did each stroke run the right way (the classic
//                "drew o clockwise" catch)?
//   start        did the first touch land in the model's start zone?
//   shape        $P point-cloud distance to the model, scale-normalised
//   placement    bounding box against the dotted thirds for the
//                letter's zone (x-height / ascender / descender)
//
// Coordinate spaces (data/handwriting/README.md):
//   MODEL BOX   letter models live in a 0-100 box, y 0=top line,
//               33.3=dotted mid, 66.6=baseline, 100=descender floor.
//   ATTEMPT     whatever the canvas gave us. `thirds` says where the
//               guideline rows sit in THAT space, which is all we need
//               to map an attempt into the model box for placement.
//   NORMALISED  centroid at the origin, longest bbox side = 1. Shape,
//               order, direction and start all compare here, so a big
//               scrawl and a neat little letter score the same.
//
// Model strokes are SVG path strings; pathToPoints() samples them
// without a DOM (de Casteljau for C/Q, lerp for L), so the same code
// runs in Node tests and in the browser.
// ============================================================

(function () {
  "use strict";

  // ---- tuned constants -----------------------------------------
  // (tuned against the real letterform fixtures in tests/handwriting.test.js)
  const RESAMPLE_N = 48;      // points per stroke, model and attempt alike
  const CURVE_STEPS = 24;     // de Casteljau samples per bezier segment
  const EPS = 1e-9;

  // The model letter box. `thirds` maps an attempt into this space.
  const MODEL_LINES = { top: 0, mid: 33.3, base: 66.6, floor: 100 };
  const XHEIGHT_BAND = MODEL_LINES.base - MODEL_LINES.mid;   // 33.3

  // Feature weights (sum 100). Direction, shape and placement carry the most
  // because they are what handwriting instruction is actually about; stroke
  // count and order are cheap-but-important process checks.
  const WEIGHTS = { strokeCount: 12, order: 14, direction: 22, start: 10, shape: 22, placement: 20 };

  // Gates: feature -> [below this score, cap the total at this]. Some
  // failures are disqualifying however tidy everything else is, and a
  // weighted average alone can't say so — a scribble drawn in one confident
  // stroke still collects full marks for stroke count, order and start.
  // Each gate caps the total into the band the failure deserves.
  const GATES = {
    shape: [40, 40],        // doesn't look like the letter -> keep practising
    direction: [50, 60],    // drawn backwards
    order: [50, 79],        // built in the wrong order
    placement: [50, 79]     // sitting in the wrong zone of the thirds
  };

  // Direction: cosine between corresponding chords. >= COS_PASS is full
  // marks, <= COS_FAIL is zero (COS_FAIL ~ 72 degrees off).
  const COS_PASS = 0.85, COS_FAIL = 0.3;
  // Chords compared per stroke pair: the whole start->end chord plus two
  // "head" chords. The early head is the reversal detector — on a closed
  // loop the full chord is ~zero long and the first third is ambiguous (a
  // reversed circle's first-third chord is only 60 degrees off, cos +0.5),
  // while its first 15% points the opposite way (cos -0.42). That is what
  // makes a clockwise 'o' fail instead of scraping a pass.
  const HEAD_FRACS = [{ frac: 0.15, w: 1.0 }, { frac: 1 / 3, w: 0.6 }];

  // Shape: mean cloud distance in normalised units (longest side = 1).
  // Measured on the real letterforms: a wobbly-but-right letter lands under
  // 0.06, a different letter of the same family around 0.18, a scribble
  // 0.18-0.30. 0.24 is the "not this letter any more" line.
  const SHAPE_TOL = 0.24;

  // Start point: distance outside the start zone, normalised units.
  const START_TOL = 0.45;

  // Placement: how far the attempt's top/bottom edge may sit from the
  // model's, as a fraction of the x-height band, before it costs marks.
  const ZONE_TOL = { "x-height": 0.22, ascender: 0.30, descender: 0.30, mixed: 0.35 };
  const ZONE_FAIL_EXTRA = 0.80;   // ...and where it reaches zero.

  const BANDS = [[85, "great"], [70, "good"], [50, "getting-there"]];

  // ---- small geometry helpers ----------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function clamp01(v) { return clamp(v, 0, 1); }

  function pt(p) {
    if (!p) return null;
    const x = Array.isArray(p) ? p[0] : p.x;
    const y = Array.isArray(p) ? p[1] : p.y;
    if (typeof x !== "number" || typeof y !== "number" ||
        !isFinite(x) || !isFinite(y)) return null;
    return { x: x, y: y };
  }

  // Accepts [{x,y}] or [[x,y]] (canvas capture may carry t/pressure too —
  // extra keys are ignored). Drops junk but KEEPS duplicate points: they
  // carry weight in a centroid, and a tap is 48 copies of one point.
  function toPoints(points) {
    const out = [];
    if (!points || !points.length) return out;
    for (let i = 0; i < points.length; i++) {
      const p = pt(points[i]);
      if (p) out.push(p);
    }
    return out;
  }

  // Consecutive duplicates break arc-length maths; only resample drops them.
  function dedupe(points) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - points[i].x) < EPS &&
          Math.abs(last.y - points[i].y) < EPS) continue;
      out.push(points[i]);
    }
    return out;
  }

  function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  function pathLength(points) {
    let n = 0;
    for (let i = 1; i < points.length; i++) n += dist(points[i - 1], points[i]);
    return n;
  }

  function bboxOf(points) {
    if (!points || !points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  function flat(strokes) {
    const all = [];
    for (let i = 0; i < strokes.length; i++)
      for (let j = 0; j < strokes[i].length; j++) all.push(strokes[i][j]);
    return all;
  }

  // ---- resample -------------------------------------------------
  // n points spaced evenly BY ARC LENGTH along the polyline. Built from
  // a cumulative-length table rather than the classic $1 walk, so the
  // count is exactly n and the spacing never drifts.
  // Dots (1-2 points, or zero total length) return n copies of the point:
  // a tap is a legitimate stroke, it just has no direction.
  function resample(points, n) {
    n = n || RESAMPLE_N;
    const pts = dedupe(toPoints(points));
    if (!pts.length || n < 1) return [];
    const fill = function (p) {
      const out = [];
      for (let i = 0; i < n; i++) out.push({ x: p.x, y: p.y });
      return out;
    };
    if (pts.length === 1 || n === 1) return n === 1 ? [{ x: pts[0].x, y: pts[0].y }] : fill(pts[0]);

    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1];
    if (total <= EPS) return fill(pts[0]);

    const out = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const target = (k * total) / (n - 1);
      while (j < pts.length - 2 && cum[j + 1] < target) j++;
      const seg = cum[j + 1] - cum[j];
      const t = seg <= EPS ? 0 : (target - cum[j]) / seg;
      out.push({
        x: pts[j].x + t * (pts[j + 1].x - pts[j].x),
        y: pts[j].y + t * (pts[j + 1].y - pts[j].y)
      });
    }
    return out;
  }

  // ---- normalise ------------------------------------------------
  // Centroid to the origin, longest bbox side to 1, aspect kept.
  // `bbox` is the ORIGINAL bbox (placement still needs real coords);
  // `center`/`scale` let callers push extra points (a start zone, the
  // exit point) through the same transform.
  function normalize(strokes) {
    const ss = (strokes || []).map(toPoints).filter(function (s) { return s.length > 0; });
    const all = flat(ss);
    if (!all.length) {
      return { strokes: [], bbox: bboxOf([]), center: { x: 0, y: 0 }, scale: 1 };
    }
    const bbox = bboxOf(all);
    let cx = 0, cy = 0;
    for (let i = 0; i < all.length; i++) { cx += all[i].x; cy += all[i].y; }
    cx /= all.length; cy /= all.length;
    const longest = Math.max(bbox.w, bbox.h);
    const scale = longest > EPS ? 1 / longest : 1;
    const out = ss.map(function (s) {
      return s.map(function (p) { return { x: (p.x - cx) * scale, y: (p.y - cy) * scale }; });
    });
    return { strokes: out, bbox: bbox, center: { x: cx, y: cy }, scale: scale };
  }

  function applyNorm(norm, p) {
    const q = pt(p);
    if (!q) return { x: 0, y: 0 };
    return { x: (q.x - norm.center.x) * norm.scale, y: (q.y - norm.center.y) * norm.scale };
  }

  // ---- SVG path sampling (no DOM) -------------------------------
  function lerpPt(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  // de Casteljau for any degree: repeated lerp of the control polygon.
  // 2 points = a line, 3 = quadratic, 4 = cubic.
  function deCasteljau(ctrl, t) {
    let pts = ctrl;
    while (pts.length > 1) {
      const next = [];
      for (let i = 0; i + 1 < pts.length; i++) next.push(lerpPt(pts[i], pts[i + 1], t));
      pts = next;
    }
    return pts[0];
  }

  function parsePath(d) {
    const cmds = [];
    const re = /([MmLlHhVvCcQqZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
    let m, cur = null;
    while ((m = re.exec(String(d || ""))) !== null) {
      if (m[1]) { cur = { cmd: m[1], args: [] }; cmds.push(cur); }
      else if (cur) cur.args.push(parseFloat(m[2]));
    }
    return cmds;
  }

  // Flatten an SVG path to a polyline. Supports M/L/H/V/C/Q/Z, absolute and
  // relative, with implicit argument repeats. A second M inside one stroke
  // path is a pen-up jump; the letterform models only ever use zero-length
  // ones (a retrace, as in n/h/m), so it is treated as a connector.
  function flattenPath(d, steps) {
    steps = steps || CURVE_STEPS;
    const cmds = parsePath(d);
    const out = [];
    let cx = 0, cy = 0, sx = 0, sy = 0, started = false;
    function push(x, y) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - x) < EPS && Math.abs(last.y - y) < EPS) return;
      out.push({ x: x, y: y });
    }
    function curve(ctrl) {
      for (let k = 1; k <= steps; k++) {
        const p = deCasteljau(ctrl, k / steps);
        push(p.x, p.y);
      }
    }
    for (let c = 0; c < cmds.length; c++) {
      const cmd = cmds[c].cmd, a = cmds[c].args;
      const up = cmd.toUpperCase(), rel = cmd !== up;
      const ax = function (v) { return rel ? cx + v : v; };
      const ay = function (v) { return rel ? cy + v : v; };
      if (up === "M") {
        for (let i = 0; i + 1 < a.length; i += 2) {
          const x = ax(a[i]), y = ay(a[i + 1]);
          push(x, y);
          if (i === 0 || !started) { sx = x; sy = y; started = true; }
          cx = x; cy = y;
        }
      } else if (up === "L") {
        for (let i = 0; i + 1 < a.length; i += 2) {
          const x = ax(a[i]), y = ay(a[i + 1]);
          push(x, y); cx = x; cy = y;
        }
      } else if (up === "H") {
        for (let i = 0; i < a.length; i++) { const x = ax(a[i]); push(x, cy); cx = x; }
      } else if (up === "V") {
        for (let i = 0; i < a.length; i++) { const y = ay(a[i]); push(cx, y); cy = y; }
      } else if (up === "C") {
        for (let i = 0; i + 5 < a.length; i += 6) {
          curve([{ x: cx, y: cy }, { x: ax(a[i]), y: ay(a[i + 1]) },
                 { x: ax(a[i + 2]), y: ay(a[i + 3]) }, { x: ax(a[i + 4]), y: ay(a[i + 5]) }]);
          cx = ax(a[i + 4]); cy = ay(a[i + 5]);
        }
      } else if (up === "Q") {
        for (let i = 0; i + 3 < a.length; i += 4) {
          curve([{ x: cx, y: cy }, { x: ax(a[i]), y: ay(a[i + 1]) },
                 { x: ax(a[i + 2]), y: ay(a[i + 3]) }]);
          cx = ax(a[i + 2]); cy = ay(a[i + 3]);
        }
      } else if (up === "Z") {
        push(sx, sy); cx = sx; cy = sy;
      }
    }
    return out;
  }

  // An SVG path string -> n arc-length-even points. This is how the model
  // letterforms in data/handwriting/*.json become point clouds.
  function pathToPoints(svgPath, n) {
    return resample(flattenPath(svgPath, CURVE_STEPS), n || RESAMPLE_N);
  }

  // ---- $P cloud distance ---------------------------------------
  // Greedy point-cloud matching (Vatavu/Anthony/Wobbrock $P): walk cloud A
  // from `start`, greedily take the nearest unmatched point of B, weighting
  // early matches more. Run it both ways and keep the smaller — matching is
  // asymmetric, and we want a distance, not an argument about which cloud
  // went first. The result is a weighted MEAN point distance, so on clouds
  // normalised to a longest side of 1 it reads directly as "how far apart,
  // as a fraction of the letter".
  function cloudOneWay(A, B, start) {
    const n = A.length;
    const matched = new Array(n);
    let sum = 0, wsum = 0, i = start;
    do {
      let min = Infinity, index = -1;
      for (let j = 0; j < n; j++) {
        if (matched[j]) continue;
        const d = dist(A[i], B[j]);
        if (d < min) { min = d; index = j; }
      }
      if (index < 0) break;
      matched[index] = true;
      const w = 1 - ((i - start + n) % n) / n;
      sum += w * min; wsum += w;
      i = (i + 1) % n;
    } while (i !== start);
    return wsum > EPS ? sum / wsum : 0;
  }

  function cloudDistance(A, B) {
    let a = toPoints(A), b = toPoints(B);
    if (!a.length || !b.length) return Infinity;
    if (a.length !== b.length) {
      const n = Math.max(a.length, b.length);
      a = resample(a, n); b = resample(b, n);
    }
    const n = a.length;
    const starts = n >= 4 ? [0, Math.floor(n / 2)] : [0];
    let best = Infinity;
    for (let s = 0; s < starts.length; s++) {
      best = Math.min(best, cloudOneWay(a, b, starts[s]), cloudOneWay(b, a, starts[s]));
    }
    return best;
  }

  // ---- stroke matching ------------------------------------------
  // Greedy: each attempt stroke, in the order it was drawn, claims the
  // nearest unclaimed model stroke by cloud distance. A model "dot" stroke
  // pairs with a tap for free — a one-point cloud sits far from every point
  // of a long stroke, so the long strokes claim each other and the dot is
  // left for the short mark, whether the child tapped it or dashed it.
  function matchStrokes(attemptNorm, modelNorm) {
    const used = [];
    const pairs = [];
    for (let i = 0; i < attemptNorm.length; i++) {
      let best = -1, bestDist = Infinity;
      for (let j = 0; j < modelNorm.length; j++) {
        if (used[j]) continue;
        const d = cloudDistance(attemptNorm[i], modelNorm[j]);
        if (d < bestDist) { bestDist = d; best = j; }
      }
      if (best < 0) break;
      used[best] = true;
      pairs.push({ attempt: i, model: best, distance: bestDist });
    }
    return pairs;
  }

  // ---- direction -------------------------------------------------
  function chordAt(points, frac) {
    if (points.length < 2) return { x: 0, y: 0, len: 0 };
    const k = clamp(Math.round(frac * (points.length - 1)), 1, points.length - 1);
    const dx = points[k].x - points[0].x, dy = points[k].y - points[0].y;
    return { x: dx, y: dy, len: Math.sqrt(dx * dx + dy * dy) };
  }

  function cosOf(u, v) {
    if (u.len <= EPS || v.len <= EPS) return null;
    return clamp((u.x * v.x + u.y * v.y) / (u.len * v.len), -1, 1);
  }

  // One matched pair -> 0-100. Compares the full start->end chord and two
  // head chords. Each comparison is weighted by how much direction it can
  // actually carry: a closed loop's full chord is ~zero long, so it is
  // ignored, and a tap (no length at all) scores neutral rather than wrong.
  function directionScore(aPts, mPts) {
    const aLen = pathLength(aPts), mLen = pathLength(mPts);
    const ref = 0.25 * Math.min(aLen, mLen);
    const parts = [{ frac: 1, w: 1 }].concat(HEAD_FRACS);
    let sum = 0, wsum = 0;
    for (let i = 0; i < parts.length; i++) {
      const ca = chordAt(aPts, parts[i].frac), cm = chordAt(mPts, parts[i].frac);
      const cos = cosOf(ca, cm);
      if (cos === null) continue;
      const reliability = ref <= EPS ? 0 : clamp01(Math.min(ca.len, cm.len) / ref);
      const w = parts[i].w * reliability;
      if (w <= EPS) continue;
      sum += w * cos; wsum += w;
    }
    if (wsum <= EPS) return 100;    // nothing to tell direction from (a dot)
    const cos = sum / wsum;
    return 100 * clamp01((cos - COS_FAIL) / (COS_PASS - COS_FAIL));
  }

  // ---- advice ----------------------------------------------------
  // common_errors slugs from the letterform files, mapped to the feature
  // they show up in and a line a 5-year-old can act on. Unknown slugs
  // (new styles, new letters) still produce a readable line.
  const ERROR_LIBRARY = {
    "clockwise": { feature: "direction", text: "You went round the wrong way. Start at 2 o'clock and curve back over the top to the left." },
    "clockwise-loop": { feature: "direction", text: "The loop goes the other way round — over the top and back to the left." },
    "backwards-e": { feature: "direction", text: "Start with the little line across the middle, then curve up and around to the left." },
    "backwards-s": { feature: "direction", text: "Curve back to the left at the top first, then swing down and round." },
    "backwards-2": { feature: "direction", text: "Start at the top and curve over to the right, not the left." },
    "backwards-3": { feature: "direction", text: "Both bumps curve out to the right." },
    "backwards-4": { feature: "direction", text: "Start at the top and come down to the left." },
    "backwards-7": { feature: "direction", text: "Draw the top line left to right, then slide down to the left." },
    "backwards-bowl": { feature: "direction", text: "The bowl curves out to the right." },
    "z-reversal": { feature: "direction", text: "Across the top to the right, back down to the left, then across again." },
    "diagonal-the-wrong-way": { feature: "direction", text: "The middle line slides down to the left." },
    "drawn-upwards": { feature: "direction", text: "Both lines are drawn downwards — start each one at the top." },
    "cross-right-to-left": { feature: "direction", text: "Draw the cross from left to right." },
    "tail-hooks-right": { feature: "direction", text: "This tail hooks back to the left." },
    "tail-hooks-left": { feature: "direction", text: "This tail hooks to the right." },
    "tail-hooks-left-like-g": { feature: "direction", text: "q's tail hooks to the right — g's is the one that hooks left." },
    "tail-hooks": { feature: "direction", text: "p's tail goes straight down — no hook at the bottom." },
    "start-at-bottom": { feature: "start", text: "Start at the top, not the bottom." },
    "start-at-the-bottom": { feature: "start", text: "Start at the top, not the bottom." },
    "start-at-the-top": { feature: "start", text: "Start on the little line in the middle, not at the top." },
    "no-flat-start": { feature: "start", text: "Begin with the little flat line across the middle." },
    "dot-first": { feature: "order", text: "Body first, then pop the dot on top." },
    "stick-first": { feature: "order", text: "Round part first, then the stick." },
    "stem-first": { feature: "order", text: "Draw the long line first, then the stem." },
    "cross-first": { feature: "order", text: "Body first, then the cross." },
    "hat-first": { feature: "order", text: "Draw the body first, then the hat on top." },
    "leg-before-arm": { feature: "order", text: "Arm in first, then the leg out." },
    "second-stroke-first": { feature: "order", text: "Start with the line that goes down to the right." },
    "hump-drawn-separately": { feature: "strokeCount", text: "Keep the pencil down — retrace back up and over the hump in one go." },
    "shoulder-drawn-separately": { feature: "strokeCount", text: "Keep the pencil down — retrace up and push the shoulder out in one go." },
    "no-dot": { feature: "strokeCount", text: "Don't forget the dot." },
    "hat-missing": { feature: "strokeCount", text: "Don't forget the hat across the top." },
    "no-top-bar": { feature: "strokeCount", text: "Don't forget the line across the top." },
    "stem-missing-the-crossbar": { feature: "strokeCount", text: "The stem needs to cross the line." },
    "no-retrace": { feature: "shape", text: "Retrace back up the same line before you go over." },
    "closing-the-circle": { feature: "shape", text: "Leave c open like a mouth — don't join it up." },
    "not-closing": { feature: "shape", text: "Close o all the way back to where you started." },
    "loop-not-closed": { feature: "shape", text: "Close the loop right up." },
    "loop-filled-in": { feature: "shape", text: "Keep the little loop open so you can see through it." },
    "no-crossover": { feature: "shape", text: "The lines cross over in the middle." },
    "no-middle-crossover": { feature: "shape", text: "s changes direction in the middle — it's a snake, not a c." },
    "c-shape-only": { feature: "shape", text: "Keep going after the curve — s turns back the other way." },
    "gap-between-circle-and-stick": { feature: "shape", text: "Bring the stick right up against the round part — no gap." },
    "bowl-not-touching-stick": { feature: "shape", text: "The bowl has to touch the stick." },
    "bowl-not-touching-the-stem": { feature: "shape", text: "The bowl has to touch the stem." },
    "arm-and-leg-not-meeting": { feature: "shape", text: "The arm and the leg meet on the stick." },
    "strokes-not-crossing": { feature: "shape", text: "The two lines have to cross in the middle." },
    "b-d-reversal": { feature: "shape", text: "Check which side the round part is on: b's bump comes after the stick, d's comes before it." },
    "p-q-reversal": { feature: "shape", text: "Check which side the bowl is on." },
    "g-q-confusion": { feature: "shape", text: "g's tail hooks left, q's hooks right." },
    "n-h-confusion": { feature: "shape", text: "h starts up at the top line; n starts at the dotted line." },
    "n-m-confusion": { feature: "shape", text: "n has one hump, m has two." },
    "n-u-reversal": { feature: "shape", text: "u is the one that scoops at the bottom." },
    "u-shape-instead-of-hump": { feature: "shape", text: "The hump goes over the top, like a bridge." },
    "u-shape-instead-of-point": { feature: "shape", text: "v has a sharp point at the bottom." },
    "full-hump-like-n": { feature: "shape", text: "r's shoulder just pokes out — it doesn't come all the way down." },
    "square-bottom": { feature: "shape", text: "Curve round the bottom, don't turn a corner." },
    "curved-sides": { feature: "shape", text: "Keep the sides straight — sharp corners, not curves." },
    "curved-instead-of-straight": { feature: "shape", text: "Straight lines only." },
    "rounded-like-two-u": { feature: "shape", text: "w has sharp points at the bottom." },
    "three-humps": { feature: "shape", text: "m has two humps." },
    "three-points": { feature: "shape", text: "w has two points at the bottom." },
    "two-stacked-circles": { feature: "shape", text: "8 is one line that crosses over in the middle, not two circles." },
    "closed-top": { feature: "shape", text: "Leave the top of 4 open." },
    "no-flag": { feature: "shape", text: "1 starts with a little flag at the top." },
    "flag-on-the-right": { feature: "shape", text: "The little flag points to the left." },
    "no-flat-base": { feature: "shape", text: "2 finishes with a flat line along the bottom." },
    "loop-at-the-bottom": { feature: "shape", text: "No loop at the bottom — finish flat." },
    "no-curve-at-the-top": { feature: "shape", text: "f curves over at the top like a walking stick." },
    "hook-facing-right": { feature: "shape", text: "f's hook curves over to the left." },
    "base-serif-added": { feature: "shape", text: "No line across the bottom." },
    "uneven-arms": { feature: "shape", text: "Make both sides the same size." },
    "uneven-widths": { feature: "shape", text: "Make all the parts the same width." },
    "bumps-uneven": { feature: "shape", text: "Make both bumps the same size." },
    "humps-different-sizes": { feature: "shape", text: "Make both humps the same size." },
    "top-bigger-than-bottom": { feature: "shape", text: "8's bottom circle is the bigger one." },
    "flat-top-like-a-7": { feature: "shape", text: "3 starts with a curve, not a straight line." },
    "leaning": { feature: "shape", text: "Keep the line straight up and down." },
    "vertical-instead-of-diagonal": { feature: "shape", text: "7's line slides down to the left." },
    "bowl-on-the-left": { feature: "shape", text: "The bowl goes on the right of the stick." },
    "loop-at-the-top-like-a-9": { feature: "shape", text: "6's loop is at the bottom." },
    "loop-at-the-bottom-like-a-6": { feature: "shape", text: "9's loop is at the top." },
    "short-stick": { feature: "placement", text: "Take the stick all the way up to the top line." },
    "too-short": { feature: "placement", text: "This letter is tall — go right up to the top line." },
    "cross-too-high": { feature: "placement", text: "The cross sits on the dotted line." },
    "arm-too-high": { feature: "placement", text: "The arm starts below the dotted line." },
    "shoulder-too-long": { feature: "placement", text: "The shoulder stays up near the dotted line." },
    "tail-stops-at-baseline": { feature: "placement", text: "The tail keeps going, down below the line." },
    "tail-below-the-baseline": { feature: "placement", text: "f sits on the line — its tail doesn't go below." },
    "no-tail": { feature: "placement", text: "Don't forget the tail below the line." },
    "second-leg-too-short": { feature: "placement", text: "Bring the second leg all the way down to the line." },
    "dot-misplaced": { feature: "placement", text: "The dot sits just above the letter." },
    "dot-circled": { feature: "shape", text: "A little dot, not a circle." },
    "exit-at-the-bottom": { feature: "placement", text: "This one finishes up at the dotted line." },
    "v-shape-at-the-top": { feature: "shape", text: "y's top is round like u, not pointy like v." },
    "too-wide-like-o": { feature: "shape", text: "0 is a narrow oval — thinner than o." }
  };

  function humanise(slug) {
    return String(slug || "").replace(/-/g, " ");
  }

  function zoneAdvice(zone) {
    if (zone === "ascender") return "Take the tall part right up to the top line.";
    if (zone === "descender") return "Let the tail drop below the baseline.";
    return "Sit the letter between the dotted line and the baseline.";
  }

  function genericAdvice(feature, model, counts) {
    switch (feature) {
      case "strokeCount":
        return "This letter takes " + counts.model + " stroke" + (counts.model === 1 ? "" : "s") +
               " — you used " + counts.attempt + ".";
      case "order":
        return "Do the strokes in order: " +
               (model.strokes || []).map(function (s, i) { return (i + 1) + ") " + humanise(s.dir); }).join(", ") + ".";
      case "direction":
        return "Check which way your pencil travels — this letter goes " +
               humanise(((model.strokes || [])[0] || {}).dir || "the other way") + ".";
      case "start":
        return "Start where the dot is.";
      case "shape":
        return "Try to keep your line right on top of the model shape.";
      case "placement":
        return zoneAdvice(model.zone);
      default:
        return "";
    }
  }

  const ADVICE_AT = 70;     // a feature below this earns a line
  const MAX_ADVICE = 3;

  function buildAdvice(features, model, counts) {
    const failed = Object.keys(WEIGHTS)
      .filter(function (f) { return features[f] < ADVICE_AT; })
      .sort(function (a, b) { return features[a] - features[b]; });
    const out = [];
    const seen = {};
    function add(line) {
      if (!line || seen[line]) return;
      seen[line] = true;
      out.push(line);
    }
    for (let i = 0; i < failed.length && out.length < MAX_ADVICE; i++) {
      const feature = failed[i];
      let matchedOne = false;
      const errs = model.common_errors || [];
      for (let e = 0; e < errs.length && out.length < MAX_ADVICE; e++) {
        const entry = ERROR_LIBRARY[errs[e]];
        if (entry && entry.feature === feature) { add(entry.text); matchedOne = true; }
      }
      if (!matchedOne && out.length < MAX_ADVICE) add(genericAdvice(feature, model, counts));
    }
    return out;
  }

  // ---- placement --------------------------------------------------
  function normalizeThirds(thirds) {
    const t = {};
    for (const k in MODEL_LINES) t[k] = MODEL_LINES[k];
    if (thirds) for (const k in thirds) if (typeof thirds[k] === "number") t[k] = thirds[k];
    return t;
  }

  // How far off one edge is, 0-100. Full marks inside `tol`, zero by `fail`.
  function edgeScore(err, tol, fail) {
    if (err <= tol) return 100;
    if (err >= fail) return 0;
    return 100 * (1 - (err - tol) / (fail - tol));
  }

  // The attempt's bbox against the model's, both in model-box coords.
  // The model letter IS the ideal placement for its zone (an ascender in
  // this style starts at y=8, not glued to the top line), so it is the
  // reference; `zone` only decides how much slack the letter gets.
  // Scored as the WORSE of the two edges, not their average: an 'l' drawn
  // only as tall as an 'o' sits perfectly on the baseline, and averaging
  // would let that good edge hide the missing ascender.
  function placementScore(attemptBox, modelBox, zone, thirds) {
    const span = thirds.floor - thirds.top;
    if (Math.abs(span) <= EPS) return 0;
    const k = (MODEL_LINES.floor - MODEL_LINES.top) / span;
    const mapY = function (y) { return MODEL_LINES.top + (y - thirds.top) * k; };
    const top = mapY(attemptBox.minY), bottom = mapY(attemptBox.maxY);
    const tolFrac = ZONE_TOL[zone] || ZONE_TOL.mixed;
    const tol = tolFrac * XHEIGHT_BAND;
    const fail = (tolFrac + ZONE_FAIL_EXTRA) * XHEIGHT_BAND;
    const topScore = edgeScore(Math.abs(top - modelBox.minY), tol, fail);
    const botScore = edgeScore(Math.abs(bottom - modelBox.maxY), tol, fail);
    return Math.min(topScore, botScore);
  }

  // ---- start point -------------------------------------------------
  // The model's start_zone is [x, y, w, h] in model-box coords; push it
  // through the model's normalisation so it can be compared with the
  // attempt's own normalised first touch (scale-invariant either way).
  function startScore(firstPoint, zoneRect, mNorm) {
    if (!zoneRect || zoneRect.length < 4) return 100;
    const a = applyNorm(mNorm, { x: zoneRect[0], y: zoneRect[1] });
    const b = applyNorm(mNorm, { x: zoneRect[0] + zoneRect[2], y: zoneRect[1] + zoneRect[3] });
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const dx = Math.max(minX - firstPoint.x, 0, firstPoint.x - maxX);
    const dy = Math.max(minY - firstPoint.y, 0, firstPoint.y - maxY);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= EPS) return 100;                       // inside the zone
    return 100 * clamp01(1 - d / START_TOL);        // partial credit by distance
  }

  // ---- the score ----------------------------------------------------
  function emptyFeatures() {
    return { strokeCount: 0, order: 0, direction: 0, start: 0, shape: 0, placement: 0 };
  }

  function scoreAttempt(opts) {
    opts = opts || {};
    const n = opts.n || RESAMPLE_N;
    const model = opts.letterModel || opts.letter || {};
    const thirds = normalizeThirds(opts.thirds);
    // Keep the sampled points and the stroke definitions in step, so
    // start_zone/dir always belong to the stroke they were sampled from
    // even if a model stroke has an unusable path.
    const modelDefs = [], modelStrokes = [];
    (model.strokes || []).forEach(function (s) {
      const pts = pathToPoints(s && s.path, n);
      if (pts.length) { modelDefs.push(s); modelStrokes.push(pts); }
    });
    const attemptStrokes = (opts.attemptStrokes || [])
      .map(function (s) { return resample(s, n); })
      .filter(function (s) { return s.length > 0; });

    if (!attemptStrokes.length || !modelStrokes.length) {
      return {
        total: 0, band: gradeToBand(0), features: emptyFeatures(),
        advice: ["Have a go — draw the letter on the line."], matches: []
      };
    }

    const aNorm = normalize(attemptStrokes);
    const mNorm = normalize(modelStrokes);
    const A = aNorm.strokes, M = mNorm.strokes;
    const counts = { attempt: A.length, model: M.length };
    const features = emptyFeatures();

    // 1. stroke count — full marks only when the counts agree.
    const diff = Math.abs(A.length - M.length);
    features.strokeCount = 100 * Math.max(0, 1 - 0.6 * diff);

    const pairs = matchStrokes(A, M);

    // 2a. order — did the matched strokes come out in the model's order?
    // Coverage keeps a one-stroke scrawl from scoring "perfectly ordered".
    const coverage = pairs.length / Math.max(A.length, M.length);
    if (pairs.length <= 1) {
      features.order = 100 * coverage;
    } else {
      let ascents = 0;
      for (let i = 1; i < pairs.length; i++) if (pairs[i].model > pairs[i - 1].model) ascents++;
      features.order = 100 * (ascents / (pairs.length - 1)) * coverage;
    }

    // 2b. direction — per matched pair, then averaged.
    if (pairs.length) {
      let sum = 0;
      for (let i = 0; i < pairs.length; i++) {
        sum += directionScore(A[pairs[i].attempt], M[pairs[i].model]);
      }
      features.direction = sum / pairs.length;
    }

    // 3. start point — the first touch of the FIRST stroke drawn.
    features.start = startScore(A[0][0], (modelDefs[0] || {}).start_zone, mNorm);

    // 4. shape — mean cloud distance over the matched pairs; a stroke with
    // no partner counts as a whole threshold's worth of wrong.
    const terms = Math.max(A.length, M.length);
    let dsum = 0;
    for (let i = 0; i < pairs.length; i++) dsum += Math.min(pairs[i].distance, SHAPE_TOL);
    dsum += (terms - pairs.length) * SHAPE_TOL;
    const meanCloud = terms ? dsum / terms : SHAPE_TOL;
    features.shape = 100 * (1 - clamp01(meanCloud / SHAPE_TOL));

    // 5. placement & size.
    features.placement = placementScore(aNorm.bbox, mNorm.bbox, model.zone, thirds);

    for (const k in features) features[k] = Math.round(clamp(features[k], 0, 100));

    let total = 0, wsum = 0;
    for (const f in WEIGHTS) { total += WEIGHTS[f] * features[f]; wsum += WEIGHTS[f]; }
    total = total / wsum;
    for (const g in GATES) {
      if (features[g] < GATES[g][0]) total = Math.min(total, GATES[g][1]);
    }
    total = Math.round(clamp(total, 0, 100));

    return {
      total: total,
      band: gradeToBand(total),
      features: features,
      advice: buildAdvice(features, model, counts),
      matches: pairs,
      meanCloudDistance: meanCloud
    };
  }

  function gradeToBand(total) {
    for (let i = 0; i < BANDS.length; i++) if (total >= BANDS[i][0]) return BANDS[i][1];
    return "keep-practising";
  }

  const api = {
    resample: resample,
    normalize: normalize,
    pathToPoints: pathToPoints,
    flattenPath: flattenPath,
    parsePath: parsePath,
    deCasteljau: deCasteljau,
    cloudDistance: cloudDistance,
    scoreAttempt: scoreAttempt,
    gradeToBand: gradeToBand,
    // handy for the task view / tests
    bboxOf: bboxOf,
    pathLength: pathLength,
    ERROR_LIBRARY: ERROR_LIBRARY,
    MODEL_LINES: MODEL_LINES,
    constants: {
      RESAMPLE_N: RESAMPLE_N, WEIGHTS: WEIGHTS, SHAPE_TOL: SHAPE_TOL,
      START_TOL: START_TOL, ZONE_TOL: ZONE_TOL, COS_PASS: COS_PASS,
      COS_FAIL: COS_FAIL, GATES: GATES, BANDS: BANDS
    }
  };

  if (typeof window !== "undefined") window.PhonicsHandwriting = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
