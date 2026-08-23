// ============================================================
// js/core/listen.js — window.PhonicsListen
//
// "Can the app hear a child's sound well enough to grade it?"
// This module answers that HONESTLY, per sound, and says
// "can't tell" whenever the acoustics don't support a verdict.
//
// Design rule: every function here is a PURE analysis over raw
// samples (Float32Array + sampleRate), so it can be tested in
// Node against synthesised audio. The microphone is a thin
// wrapper at the bottom, not a dependency of the maths.
//
// ------------------------------------------------------------
// WHAT IS ACTUALLY GRADABLE FROM A CHILD'S VOICE
// ------------------------------------------------------------
// TIER A — machine gradable (measured, defensible):
//   * voiced vs voiceless        /s/ vs /z/, /f/ vs /v/, /p/ vs /b/
//   * sibilant place             /s/ vs /sh/ (spectral centroid)
//   * vowel quality              F1/F2 against the child's own space
//   * manner                     fricative / stop / nasal-ish / vowel
//   * did they say anything      energy + duration
//
// TIER B — NOT gradable by ear, ask the child instead:
//   * /f/ vs /th/  — both weak, diffuse, near-flat spectra. This is
//     the classic confusable pair BECAUSE the acoustic difference is
//     tiny; it is carried visually (lip-teeth vs tongue-teeth). The
//     app shows the picture and asks "was your tongue out?" rather
//     than inventing a verdict.
//   * place of articulation for stops (/p/ vs /t/ vs /k/) from a
//     lone burst without a following vowel — unreliable in a noisy
//     classroom; ask or use the following vowel transition.
//
// CHILDREN ARE NOT SMALL ADULTS. A five-year-old's vocal tract is
// ~2/3 the length of an adult male's, so every formant and every
// fricative centroid sits far higher — adult thresholds would fail
// most children. Nothing here uses absolute thresholds for vowels:
// grading is always relative to THAT CHILD's calibration (see
// calibrate()), and the fricative thresholds carry an explicit
// child/adult band with an overlap region reported as "can't tell".
// ============================================================

(function () {
  "use strict";

  // ---- small DSP helpers (pure) --------------------------------

  function rms(buf, from, to) {
    from = from || 0; to = to == null ? buf.length : to;
    let s = 0;
    for (let i = from; i < to; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / Math.max(1, to - from));
  }

  function zeroCrossRate(buf, sampleRate, from, to) {
    from = from || 0; to = to == null ? buf.length : to;
    let n = 0;
    for (let i = from + 1; i < to; i++) if ((buf[i - 1] < 0) !== (buf[i] < 0)) n++;
    const secs = (to - from) / sampleRate;
    return secs > 0 ? n / secs : 0;
  }

  function hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    return w;
  }

  // In-place iterative radix-2 FFT. Same answer as the textbook DFT below,
  // in O(N log N) instead of O(N²) — 2048 points goes from ~59 ms to under
  // a millisecond, which is the difference between analysing one frame per
  // attempt and tracking a tongue 30 times a second.
  // tests/listen.test.js checks it against the naive transform.
  const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;

  function fft(re, im) {
    const n = re.length;
    // bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k], ai = im[i + k];
          const br = re[i + k + len / 2], bi = im[i + k + len / 2];
          const tr = br * cr - bi * ci, ti = br * ci + bi * cr;
          re[i + k] = ar + tr; im[i + k] = ai + ti;
          re[i + k + len / 2] = ar - tr; im[i + k + len / 2] = ai - ti;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  // The textbook transform, kept as the oracle the FFT is tested against
  // and as the fallback for a frame that isn't a power of two (only ever
  // the ragged end of a buffer).
  function dftSpectrum(buf, from, N, w, sampleRate) {
    const bins = N >> 1;
    const mag = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      let re = 0, im = 0;
      const c = (2 * Math.PI * k) / N;
      for (let i = 0; i < N; i++) {
        const s = buf[from + i] * w[i];
        re += s * Math.cos(c * i);
        im -= s * Math.sin(c * i);
      }
      mag[k] = Math.sqrt(re * re + im * im) / N;
    }
    return { mag, binHz: sampleRate / N };
  }

  // Magnitude spectrum of one windowed frame.
  function spectrum(buf, from, n, sampleRate) {
    const N = Math.min(n, buf.length - from);
    if (N <= 8) return { mag: new Float32Array(0), binHz: 0 };
    const w = hann(N);
    if (!isPow2(N)) return dftSpectrum(buf, from, N, w, sampleRate);
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = buf[from + i] * w[i];
    fft(re, im);
    const bins = N >> 1;
    const mag = new Float32Array(bins);
    for (let k = 0; k < bins; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N;
    return { mag, binHz: sampleRate / N };
  }

  // Centre of mass of the spectrum above a floor — the single most
  // useful fricative cue (/s/ sits high, /sh/ lower).
  function spectralCentroid(mag, binHz, minHz) {
    minHz = minHz || 0;
    let num = 0, den = 0;
    for (let k = 0; k < mag.length; k++) {
      const hz = k * binHz;
      if (hz < minHz) continue;
      num += hz * mag[k];
      den += mag[k];
    }
    return den > 0 ? num / den : 0;
  }

  // Flat (noise-like) vs peaky (voiced) — geometric/arithmetic mean.
  function spectralFlatness(mag) {
    let logSum = 0, sum = 0, n = 0;
    for (let k = 1; k < mag.length; k++) {
      const v = mag[k] + 1e-12;
      logSum += Math.log(v); sum += v; n++;
    }
    if (!n) return 0;
    return Math.exp(logSum / n) / (sum / n);
  }

  // Fraction of energy above a cut — fricatives are top-heavy.
  function highFraction(mag, binHz, cutHz) {
    let hi = 0, all = 0;
    for (let k = 0; k < mag.length; k++) {
      const e = mag[k] * mag[k];
      all += e;
      if (k * binHz >= cutHz) hi += e;
    }
    return all > 0 ? hi / all : 0;
  }

  // f0 by autocorrelation. Range covers children (up to ~500 Hz) and
  // adults (down to 70 Hz). Returns 0 when there is no clear period —
  // which is exactly the voiceless case.
  function pitch(buf, sampleRate, from, n) {
    const N = Math.min(n || 2048, buf.length - (from || 0));
    from = from || 0;
    if (N < 256) return { f0: 0, clarity: 0 };
    const minLag = Math.floor(sampleRate / 500);
    const maxLag = Math.floor(sampleRate / 70);
    let best = -1, bestLag = 0;
    let energy = 0;
    for (let i = 0; i < N; i++) energy += buf[from + i] * buf[from + i];
    if (energy <= 1e-9) return { f0: 0, clarity: 0 };
    for (let lag = minLag; lag <= Math.min(maxLag, N - 1); lag++) {
      let s = 0;
      for (let i = 0; i + lag < N; i++) s += buf[from + i] * buf[from + i + lag];
      const norm = s / energy;
      if (norm > best) { best = norm; bestLag = lag; }
    }
    if (bestLag === 0 || best < 0.3) return { f0: 0, clarity: Math.max(0, best) };
    return { f0: sampleRate / bestLag, clarity: best };
  }

  // Formants by LPC (autocorrelation + Levinson-Durbin), roots found
  // by scanning the LPC spectral envelope for peaks. Order scales with
  // sample rate; children need the same order but their peaks land
  // higher, which is why callers compare to the child's own space.
  function formants(buf, sampleRate, from, n) {
    const N = Math.min(n || 1024, buf.length - (from || 0));
    from = from || 0;
    if (N < 256) return [];
    const w = hann(N);
    const x = new Float32Array(N);
    // pre-emphasis lifts the higher formants out of the spectral tilt
    for (let i = 0; i < N; i++) {
      const s = buf[from + i] - (i > 0 ? 0.97 * buf[from + i - 1] : 0);
      x[i] = s * w[i];
    }
    const order = Math.min(24, 2 + Math.round(sampleRate / 1000));
    const r = new Float64Array(order + 1);
    for (let k = 0; k <= order; k++) {
      let s = 0;
      for (let i = 0; i + k < N; i++) s += x[i] * x[i + k];
      r[k] = s;
    }
    if (r[0] <= 1e-12) return [];
    const a = new Float64Array(order + 1);
    let err = r[0];
    a[0] = 1;
    for (let i = 1; i <= order; i++) {
      let acc = r[i];
      for (let j = 1; j < i; j++) acc -= a[j] * r[i - j];
      const k = acc / err;
      const prev = a.slice();
      a[i] = k;
      for (let j = 1; j < i; j++) a[j] = prev[j] - k * prev[i - j];
      err *= 1 - k * k;
      if (err <= 0) break;
    }
    // envelope: 1/|A(e^jw)| sampled finely, then peak-pick
    const steps = 512;
    const env = new Float32Array(steps);
    for (let s = 0; s < steps; s++) {
      const wHz = (s / steps) * (sampleRate / 2);
      const om = (2 * Math.PI * wHz) / sampleRate;
      let re = 1, im = 0;
      for (let j = 1; j <= order; j++) {
        re -= a[j] * Math.cos(om * j);
        im += a[j] * Math.sin(om * j);
      }
      env[s] = 1 / Math.sqrt(re * re + im * im + 1e-12);
    }
    const out = [];
    for (let s = 1; s < steps - 1; s++) {
      if (env[s] > env[s - 1] && env[s] >= env[s + 1]) {
        const hz = (s / steps) * (sampleRate / 2);
        if (hz > 150 && hz < sampleRate / 2 - 200) out.push({ hz, amp: env[s] });
      }
    }
    out.sort((p, q) => p.hz - q.hz);
    return out.map((p) => Math.round(p.hz));
  }

  // ---- one frame of features -----------------------------------

  function analyse(buf, sampleRate, opts) {
    opts = opts || {};
    const n = Math.min(opts.frame || 2048, buf.length);
    const from = opts.from || 0;
    const sp = spectrum(buf, from, n, sampleRate);
    const p = pitch(buf, sampleRate, from, n);
    return {
      rms: rms(buf, from, from + n),
      zcr: zeroCrossRate(buf, sampleRate, from, from + n),
      centroid: spectralCentroid(sp.mag, sp.binHz, 300),
      // Above the voice bar. A voiced fricative's low-frequency buzz drags
      // the whole-spectrum centroid down by thousands of Hz (/z/ measures
      // lower than /s/ purely because it is voiced), which would make the
      // /s/-vs-/sh/ call depend on voicing. Ignoring everything under
      // 1500 Hz removes the buzz and leaves the place cue alone.
      centroidHi: spectralCentroid(sp.mag, sp.binHz, 1500),
      flatness: spectralFlatness(sp.mag),
      highFraction: highFraction(sp.mag, sp.binHz, 3000),
      f0: p.f0,
      clarity: p.clarity,
      formants: p.clarity > 0.35 ? formants(buf, sampleRate, from, Math.min(1024, n)) : [],
      sampleRate,
    };
  }

  // ---- what we will and won't judge ----------------------------
  // Each phoneme id maps to how it can be checked. "self" means the
  // app must not pretend — show the articulation picture and ask.
  const CHECKS = {
    // voicing pairs — the buzz is measurable
    s: { manner: "fricative", voiced: false, cues: ["sibilant-high", "voiceless"] },
    z: { manner: "fricative", voiced: true, cues: ["sibilant-high", "voiced"] },
    sh: { manner: "fricative", voiced: false, cues: ["sibilant-low", "voiceless"] },
    zh: { manner: "fricative", voiced: true, cues: ["sibilant-low", "voiced"] },
    // The honest pair. Both are weak and diffuse and their spectra sit
    // almost on top of each other, so the app shows the picture and asks.
    // "ask" is the child-facing question — it must be answerable by a
    // five-year-old about their own mouth, in the moment, with a yes or no.
    f: { manner: "fricative", voiced: false, cues: ["weak-fricative", "voiceless"], selfCheck: "lip",
         ask: "Were your top teeth touching your bottom lip?" },
    v: { manner: "fricative", voiced: true, cues: ["weak-fricative", "voiced"], selfCheck: "lip",
         ask: "Were your top teeth touching your bottom lip?" },
    th: { manner: "fricative", voiced: false, cues: ["weak-fricative", "voiceless"], selfCheck: "tongue",
          ask: "Was your tongue poking out between your teeth?" },
    dh: { manner: "fricative", voiced: true, cues: ["weak-fricative", "voiced"], selfCheck: "tongue",
          ask: "Was your tongue poking out between your teeth?" },
    h: { manner: "fricative", voiced: false, cues: ["weak-fricative", "voiceless"] },
    // Stops: we can hear THAT a stop happened and whether it buzzed;
    // where it was made needs the picture (or a following vowel).
    p: { manner: "stop", voiced: false, cues: ["voiceless"], selfCheck: "place",
         ask: "Did your two lips press together?" },
    b: { manner: "stop", voiced: true, cues: ["voiced"], selfCheck: "place",
         ask: "Did your two lips press together?" },
    t: { manner: "stop", voiced: false, cues: ["voiceless"], selfCheck: "place",
         ask: "Was your tongue tip up behind your top teeth?" },
    d: { manner: "stop", voiced: true, cues: ["voiced"], selfCheck: "place",
         ask: "Was your tongue tip up behind your top teeth?" },
    k: { manner: "stop", voiced: false, cues: ["voiceless"], selfCheck: "place",
         ask: "Was the back of your tongue up at the back?" },
    g: { manner: "stop", voiced: true, cues: ["voiced"], selfCheck: "place",
         ask: "Was the back of your tongue up at the back?" },
    ch: { manner: "affricate", voiced: false, cues: ["sibilant-low", "voiceless"] },
    j: { manner: "affricate", voiced: true, cues: ["sibilant-low", "voiced"] },
    m: { manner: "nasal", voiced: true, cues: ["voiced", "low-heavy"], selfCheck: "place",
         ask: "Did your two lips press together and the sound come out your nose?" },
    n: { manner: "nasal", voiced: true, cues: ["voiced", "low-heavy"], selfCheck: "place",
         ask: "Was your tongue tip up behind your top teeth?" },
    ng: { manner: "nasal", voiced: true, cues: ["voiced", "low-heavy"], selfCheck: "place",
          ask: "Was the back of your tongue up at the back?" },
    l: { manner: "approximant", voiced: true, cues: ["voiced"] },
    r: { manner: "approximant", voiced: true, cues: ["voiced"] },
    w: { manner: "approximant", voiced: true, cues: ["voiced"] },
    y: { manner: "approximant", voiced: true, cues: ["voiced"] },
  };

  // Sibilant bands for centroidHi (NOT the whole-spectrum centroid —
  // these numbers only mean anything above the 1500 Hz floor).
  // Children sit higher than adults because their vocal tracts are
  // shorter, and the gap between shMax and sMin is a deliberate
  // no-man's-land reported as "can't tell" rather than guessed.
  // A child's own calibration beats both (see sibilantVerdict).
  const SIB = {
    child: { shMax: 6200, sMin: 7600 },
    adult: { shMax: 5500, sMin: 7000 },
  };

  function voicedVerdict(feat) {
    // A clear period plus a low-frequency bias means the folds are on.
    if (feat.clarity >= 0.45 && feat.f0 > 60) return true;
    if (feat.clarity <= 0.25) return false;
    return null;                       // genuinely ambiguous
  }

  // Prefer THIS child's own /s/-/sh/ midpoint when we have one: a personal
  // split beats any table, because mic, room and mouth all move the numbers.
  // Falls back to the band table, and either way keeps a dead zone in the
  // middle where the only honest answer is "I can't tell".
  function sibilantVerdict(feat, band, calibration) {
    const c = feat.centroidHi != null ? feat.centroidHi : feat.centroid;
    if (!(c > 0)) return null;
    const split = calibration && calibration.split;
    if (split > 0) {
      const dead = split * 0.08;
      if (c >= split + dead) return "sibilant-high";
      if (c <= split - dead) return "sibilant-low";
      return null;
    }
    const b = SIB[band] || SIB.child;
    if (c >= b.sMin) return "sibilant-high";                  // /s/ /z/
    if (c <= b.shMax) return "sibilant-low";                  // /sh/ /zh/
    return null;                                              // overlap
  }

  // Is there turbulent air in there at all? Spectral flatness answers this
  // and the fraction-of-energy-up-high measure does not: a voiced fricative
  // puts most of its ENERGY in the voice bar (measured highFraction ~0.04,
  // lower than a vowel's), but its spectrum is still noise-flat. Measured
  // on synthesised sounds the two groups do not come close to touching —
  // vowels and nasals land at 0.000-0.002, every fricative at 0.20-0.66 —
  // so the gate sits at 0.08 with two orders of magnitude of daylight.
  //
  // Only these two are claimed. Nasal-vs-vowel and stop place are NOT
  // separable from a single frame here, so they are not in the table and
  // the sounds that need them route to a picture question instead.
  const MANNER_HINT = {
    frication: (f) => f.flatness > 0.08,
    vowelish: (f) => f.flatness <= 0.08 && f.clarity > 0.4,
  };
  const NEEDS_AIR = { fricative: 1, affricate: 1 };

  // The verdict a child sees. Never invents certainty:
  //   heard  — the measurable cues matched
  //   close  — said something, but a cue was off (says WHICH)
  //   quiet  — nothing loud enough to judge
  //   ask    — the app cannot hear this contrast; show the picture
  function grade(phonemeId, feat, opts) {
    opts = opts || {};
    const cal = opts.calibration || null;
    const band = opts.band || (cal && cal.band) || "child";
    const spec = CHECKS[phonemeId];
    const out = { id: phonemeId, verdict: "close", why: [], measured: {}, askAbout: null };

    if (!feat || feat.rms < 0.006) {
      out.verdict = "quiet";
      out.why.push("I couldn't hear anything — try again a bit louder.");
      return out;
    }
    if (!spec) {                       // vowels and anything unlisted
      out.verdict = "ask";
      out.ask = "Does your mouth look like the picture?";
      out.why.push("Compare your mouth with the picture.");
      return out;
    }

    let ok = true;

    // Did any air actually rush? Checked before voicing so a child who
    // answers /f/ with a hummed "vuh" is told what is missing rather than
    // being asked whether their tongue was out.
    if (NEEDS_AIR[spec.manner]) {
      out.measured.frication = MANNER_HINT.frication(feat);
      if (!out.measured.frication) {
        ok = false;
        out.why.push(MANNER_HINT.vowelish(feat)
          ? "That was a voice sound. This one needs air rushing out — keep it going like a hiss."
          : "I didn't hear the air. Push a longer stream of air out.");
      }
    }

    if (spec.cues.indexOf("voiced") !== -1 || spec.cues.indexOf("voiceless") !== -1) {
      const wantVoiced = spec.voiced;
      const gotVoiced = voicedVerdict(feat);
      out.measured.voiced = gotVoiced;
      if (gotVoiced === null) {
        out.why.push("I couldn't tell if your voice was switched on.");
        ok = false;
      } else if (gotVoiced !== wantVoiced) {
        ok = false;
        out.why.push(wantVoiced
          ? "Switch your voice ON — put your hand on your throat and feel the buzz."
          : "Turn your voice OFF — this one is just air, no buzz.");
      }
    }

    const wantsSib = spec.cues.indexOf("sibilant-high") !== -1 ||
                     spec.cues.indexOf("sibilant-low") !== -1;
    if (wantsSib) {
      const got = sibilantVerdict(feat, band, cal);
      out.measured.centroid = Math.round(feat.centroidHi != null ? feat.centroidHi : feat.centroid);
      const want = spec.cues.indexOf("sibilant-high") !== -1 ? "sibilant-high" : "sibilant-low";
      if (got === null) {
        out.why.push("That was between the two sounds — try making it sharper.");
        ok = false;
      } else if (got !== want) {
        ok = false;
        out.why.push(want === "sibilant-high"
          ? "Pull your tongue forward — a thinner, higher hiss."
          : "Pull your tongue back and round your lips — a fatter hiss.");
      }
    }

    // The contrast we refuse to fake.
    if (spec.selfCheck && ok) {
      out.verdict = "ask";
      out.askAbout = spec.selfCheck;
      out.ask = spec.ask || "Compare your mouth with the picture.";
      return out;
    }

    out.verdict = ok ? "heard" : "close";
    return out;
  }

  /* ============================================================
     VOWELS: turning formants into a tongue position
     ============================================================
     A vowel IS a tongue position, and the two things that give it
     away are measurable:

       F1  rises as the mouth opens and the tongue drops
       F2  rises as the tongue comes forward

     So (F1, F2) maps onto the vowel quadrilateral every phonetics
     textbook draws, and the anatomy diagram already speaks that
     coordinate system: pose(x, y) with x = back and y = open, both
     0-100. That is the whole trick — no model, no training data,
     just the two resonances of the tube the child is making.

     What stops this being magic: absolute formant values are
     meaningless across speakers. A five-year-old's /iː/ has a
     higher F2 than an adult's /æ/. So a position is only ever
     computed inside a REFERENCE SPACE — this child's own corners
     where we have them (see calibrateVowels), and a rough age-band
     box where we don't, which is flagged as approximate.

     Reliability is honestly lower than the consonant cues. A child
     at 260 Hz gives harmonics 260 Hz apart, so F1 near 500 Hz is
     described by two of them; LPC has little to work with. Hence
     vowelPose() returns a confidence, and the UI is expected to
     draw a region rather than a pinpoint.
     ============================================================ */

  // The three corner vowels, and where they sit on the diagram. These
  // numbers mirror the VOW table in mouth.js (which drives the drawing);
  // they are restated here so this module stays free of the UI, and
  // tests/listen.test.js fails if the two ever disagree.
  //
  //   /iː/ see   close and front
  //   /aː/ spa   open
  //   /ʉː/ food  close and back
  const ANCHOR = { closeY: 6, openY: 90, frontX: 6, backX: 72 };

  // Corner references in Hz for a speaker we have not calibrated.
  // Adults from standard Australian English measurements; children
  // scaled up, since a shorter tube resonates higher.
  //
  // close/open are F1. frontGap/backGap are F2 MINUS F1, not raw F2:
  // as the mouth opens, F1 rises towards F2 and the two converge, so
  // raw F2 badly under-reads backness on open vowels — a textbook /aː/
  // came out 24 units too far forward. The gap between the formants
  // stays honest across the whole space.
  const VOWEL_BOX = {
    adult: { close: 300, open: 850, frontGap: 1970, backGap: 600 },
    child: { close: 450, open: 1250, frontGap: 2780, backGap: 650 },
  };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clampPose(v) { return Math.max(0, Math.min(100, v)); }

  // Straight line through two known points: at f = a you are at chart
  // position A, at f = b you are at B. Anything between interpolates,
  // anything outside extrapolates and then gets clamped to the diagram.
  //
  // Fitting to the ANCHOR positions rather than to a 0-100 box matters:
  // normalise /ʉː/ to "100% back" and a child who says a textbook-perfect
  // /ʉː/ lands 28 units past its target, so the app tells them to move a
  // tongue that was already right.
  function axis(f, a, A, b, B) {
    if (Math.abs(b - a) < 1) return (A + B) / 2;
    return A + ((f - a) * (B - A)) / (b - a);
  }

  // Where the tongue was, in the anatomy's own pose coordinates.
  // Returns null when there is nothing worth placing — no formants, or
  // a sound that wasn't a steady voiced vowel in the first place.
  function vowelPose(feat, opts) {
    opts = opts || {};
    const cal = opts.calibration || null;
    const band = opts.band || (cal && cal.band) || "child";
    if (!feat || feat.rms < 0.006) return null;
    const f = feat.formants || [];
    if (f.length < 2) return null;
    // A vowel is voiced and open. Frication means they made a consonant,
    // and placing that on a vowel chart would be a fiction.
    if (voicedVerdict(feat) === false) return null;
    if (MANNER_HINT.frication(feat)) return null;

    const box = (cal && cal.vowelBox) || VOWEL_BOX[band] || VOWEL_BOX.child;
    const f1 = f[0], f2 = f[1];
    const y = clampPose(axis(f1, box.close, ANCHOR.closeY, box.open, ANCHOR.openY));
    const x = clampPose(axis(f2 - f1, box.frontGap, ANCHOR.frontX, box.backGap, ANCHOR.backX));

    // How much to trust it. Three things degrade the reading: a weak
    // periodic signal, formants crowded together (the LPC envelope has
    // merged two peaks), and a pitch so high the harmonics can't
    // resolve F1 at all.
    let conf = clamp01((feat.clarity - 0.4) / 0.4);
    if (f2 - f1 < 200) conf *= 0.3;
    if (feat.f0 > 0 && f1 / feat.f0 < 2.2) conf *= 0.5;
    // No personal reference is not a small penalty. Absolute formant values
    // vary enormously between children of the same age, so an age-band table
    // can place a textbook-perfect vowel 20+ units off. Cap it well below
    // "sure" so the tolerance below stays wide enough not to correct them.
    if (!cal || !cal.vowelBox) conf = Math.min(conf, 0.5);

    return {
      x: Math.round(x),
      y: Math.round(y),
      f1: Math.round(f1),
      f2: Math.round(f2),
      confidence: +conf.toFixed(2),
      personal: !!(cal && cal.vowelBox),
    };
  }

  // How far off the target they were, in the same 0-100 space, plus a
  // child-facing nudge naming the ONE axis that is furthest out. Telling
  // a five-year-old two things about their tongue at once is telling
  // them nothing.
  //
  // The tolerance widens as the reading gets less certain. Correcting a
  // child on a measurement you have already labelled "a rough guess" is
  // the worst thing this module could do: they moved a tongue that was
  // right, on the app's say-so. Uncertain means quieter, not louder.
  function toleranceFor(conf) {
    if (conf == null) return 18;
    if (conf >= 0.66) return 18;
    if (conf >= 0.33) return 30;
    return 45;
  }

  function vowelFeedback(pose, target) {
    if (!pose || !target) return null;
    const dx = pose.x - target[0];      // + = too far back
    const dy = pose.y - target[1];      // + = too open
    const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
    const tol = toleranceFor(pose.confidence);
    const out = { dx: Math.round(dx), dy: Math.round(dy), distance: dist,
                  tolerance: tol, close: dist <= tol };
    if (out.close) { out.tip = "That's the shape."; return out; }
    if (Math.abs(dx) >= Math.abs(dy)) {
      out.tip = dx > 0 ? "Bring your tongue forward a bit."
                       : "Pull your tongue back a bit.";
    } else {
      out.tip = dy > 0 ? "Close your mouth a little more."
                       : "Open your mouth a little wider.";
    }
    return out;
  }

  // Build this child's own vowel box from the three corners of the
  // space. /iː/ (see) is close and front, /aː/ (spa) is open, /ʉː/
  // (food) is close and back — say those three and everything else
  // falls inside. Returns null unless the corners actually came out
  // distinct, because a box built from three identical readings would
  // place every later vowel in the same wrong spot.
  function calibrateVowels(samples) {
    const at = {};
    for (const s of samples || []) {
      if (!s || !s.features) continue;
      const f = s.features.formants || [];
      if (f.length < 2) continue;
      if (voicedVerdict(s.features) === false) continue;
      at[s.id] = { f1: f[0], f2: f[1] };
    }
    const see = at.ee || at["iː"], spa = at.ah || at["aː"], food = at.oo || at["ʉː"];
    if (!see || !spa) return null;
    const close = Math.min(see.f1, food ? food.f1 : see.f1);
    const open = spa.f1;
    const frontGap = see.f2 - see.f1;
    const backGap = food ? food.f2 - food.f1 : Math.min(spa.f2 - spa.f1, frontGap * 0.3);
    // Corners that came out on top of each other describe no space at all,
    // and a box built from them would put every later vowel in the same
    // wrong place. Better to say we have no personal reference.
    if (open - close < 120 || frontGap - backGap < 400) return null;
    return { close, open, frontGap, backGap };
  }

  /* ============================================================
     WATCHING THE TONGUE MOVE
     ============================================================
     vowelPose() reads one moment. These read a whole utterance, so a
     child can watch their own tongue travel — live while they speak,
     or replayed with their own voice afterwards.

     Two things make a track different from a sequence of poses:

     SMOOTHING. LPC picks the wrong peak now and then, and a single bad
     frame makes the tongue jump across the mouth. A median of three
     kills the one-frame outliers without lagging, and an EMA after it
     turns the rest into movement rather than jitter.

     GAPS. Most of a real recording is not a placeable vowel — silence
     at the ends, a consonant in the middle. Those frames come back as
     null and the UI HOLDS the last position rather than snapping to
     neutral, because a tongue that flies home between every sound
     reads as a fault rather than as a gap in what we can see.
     ============================================================ */

  function median3(a, b, c) {
    return a > b ? (b > c ? b : (a > c ? c : a)) : (a > c ? a : (b > c ? c : b));
  }

  // Rolling tracker for live audio. Feed it chunks as they arrive; it
  // returns a smoothed pose whenever it has enough new samples, or null
  // when this moment isn't a vowel. Kept here rather than in the mic
  // layer so it can be driven from a file in a test.
  function makeTracker(sampleRate, opts) {
    opts = opts || {};
    const frame = opts.frame || 1024;
    const hop = opts.hop || Math.round(sampleRate / (opts.fps || 30));
    const alpha = opts.smoothing == null ? 0.35 : opts.smoothing;
    const win = new Float32Array(frame);
    const recent = [];                 // last raw poses, for the median
    let pending = 0;
    let sm = null;                     // the smoothed pose we hand out

    function analyseWindow() {
      const feat = analyse(win, sampleRate, { from: 0, frame });
      const raw = vowelPose(feat, opts);
      if (!raw) { recent.length = 0; return null; }
      recent.push(raw);
      if (recent.length > 3) recent.shift();
      let x = raw.x, y = raw.y;
      if (recent.length === 3) {
        x = median3(recent[0].x, recent[1].x, recent[2].x);
        y = median3(recent[0].y, recent[1].y, recent[2].y);
      }
      sm = sm ? { x: sm.x + (x - sm.x) * alpha, y: sm.y + (y - sm.y) * alpha }
              : { x, y };
      return {
        x: Math.round(sm.x), y: Math.round(sm.y),
        rawX: raw.x, rawY: raw.y,
        f1: raw.f1, f2: raw.f2,
        confidence: raw.confidence, personal: raw.personal,
        rms: feat.rms,
      };
    }

    return {
      // Returns a pose, or null if this chunk didn't complete a frame or
      // didn't contain a vowel.
      push(chunk) {
        const n = chunk.length;
        if (n >= frame) {
          win.set(chunk.subarray(n - frame));
        } else {
          win.copyWithin(0, n);
          win.set(chunk, frame - n);
        }
        pending += n;
        if (pending < hop) return null;
        pending = 0;
        return analyseWindow();
      },
      reset() { win.fill(0); recent.length = 0; sm = null; pending = 0; },
      frame, hop,
    };
  }

  // The whole utterance as a timeline, for replaying a recording in step
  // with the audio it came from.
  function trackVowel(buf, sampleRate, opts) {
    opts = opts || {};
    const fps = opts.fps || 30;
    const tr = makeTracker(sampleRate, Object.assign({}, opts, { fps }));
    const hop = tr.hop;
    const out = [];
    for (let at = 0; at + hop <= buf.length; at += hop) {
      const pose = tr.push(buf.subarray(at, at + hop));
      out.push(pose ? Object.assign({ t: at / sampleRate }, pose)
                    : { t: at / sampleRate, x: null, y: null });
    }
    return { fps, sampleRate, duration: buf.length / sampleRate, samples: out };
  }

  // The steadiest stretch of a track — where the tongue stopped moving,
  // which is the vowel the child meant. Better than the loudest instant
  // for grading: the loudest moment can be the attack, mid-glide.
  function steadiest(track, opts) {
    opts = opts || {};
    const span = Math.max(2, Math.round((opts.ms || 120) / 1000 * (track.fps || 30)));
    const s = track.samples || [];
    let best = null, bestSpread = Infinity;
    for (let i = 0; i + span <= s.length; i++) {
      const win = s.slice(i, i + span);
      if (win.some((p) => p.x == null)) continue;
      let minX = 100, maxX = 0, minY = 100, maxY = 0, sumX = 0, sumY = 0, conf = 0;
      for (const p of win) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        sumX += p.x; sumY += p.y; conf += p.confidence || 0;
      }
      const spread = (maxX - minX) + (maxY - minY);
      if (spread < bestSpread) {
        bestSpread = spread;
        best = {
          x: Math.round(sumX / win.length), y: Math.round(sumY / win.length),
          confidence: +(conf / win.length).toFixed(2),
          from: win[0].t, to: win[win.length - 1].t,
          steadiness: spread, personal: win[0].personal,
        };
      }
    }
    return best;
  }

  // What the machine heard, in words, for the grown-up watching. This is
  // the panel that answers "is it good enough?" — it shows the reading
  // BEHIND a verdict so a teacher can see when the app is guessing.
  function describe(feat, opts) {
    opts = opts || {};
    const cal = opts.calibration || null;
    const band = opts.band || (cal && cal.band) || "child";
    // Only report cues that bear on THIS sound. A "hiss pitch: can't tell"
    // row under /f/ reads as a failure, when in truth /f/ was never going
    // to be decided that way — showing it would manufacture doubt.
    const spec = opts.id ? CHECKS[opts.id] : null;
    const wantsSib = !opts.id || !spec ||
      spec.cues.indexOf("sibilant-high") !== -1 || spec.cues.indexOf("sibilant-low") !== -1;
    const out = [];
    if (!feat || feat.rms < 0.006) return [{ label: "Loudness", value: "too quiet to read", sure: false }];
    out.push({ label: "Loudness", value: feat.rms.toFixed(3) + " rms", sure: true });
    const v = voicedVerdict(feat);
    out.push({
      label: "Voice",
      value: v === null ? "can't tell" : v ? "on (buzzing)" : "off (just air)",
      detail: "clarity " + feat.clarity.toFixed(2) + (feat.f0 ? ", pitch " + Math.round(feat.f0) + " Hz" : ", no pitch found"),
      sure: v !== null,
    });
    const air = MANNER_HINT.frication(feat);
    out.push({
      label: "Air",
      value: air ? "rushing (hissy)" : MANNER_HINT.vowelish(feat) ? "smooth (a voice sound)" : "not much",
      detail: "flatness " + feat.flatness.toFixed(3),
      sure: true,
    });
    if (wantsSib) {
      const sib = sibilantVerdict(feat, band, cal);
      out.push({
        label: "Hiss pitch",
        value: sib === "sibilant-high" ? "high and thin, like /s/"
             : sib === "sibilant-low" ? "low and fat, like /sh/"
             : "in between — can't tell",
        detail: Math.round(feat.centroidHi) + " Hz" +
          (cal && cal.split ? " (their own split " + Math.round(cal.split) + " Hz)"
                            : " (" + band + " table: " + SIB[band].shMax + "–" + SIB[band].sMin + " Hz is no-man's-land)"),
        sure: sib !== null,
      });
    }
    // Formants only mean something on an open, unobstructed vowel. On a
    // fricative the LPC envelope happily reports peaks that are the noise
    // shape, not a mouth position, so they are left out rather than shown
    // as if they were a reading of the child's tongue.
    if (!air && feat.formants && feat.formants.length >= 2) {
      out.push({
        label: "Mouth shape",
        value: "F1 " + feat.formants[0] + " Hz, F2 " + feat.formants[1] + " Hz",
        detail: "only meaningful next to this child's other vowels",
        sure: true,
      });
    }
    return out;
  }

  // A child's own baseline, so nothing is judged against adult numbers.
  // Feed a few known sounds; we keep the median centroid of their /s/
  // and /sh/ and their vowel f0, and pick the band from that.
  function calibrate(samples) {
    const sCent = [], shCent = [], f0s = [];
    for (const s of samples || []) {
      if (!s || !s.features) continue;
      const c = s.features.centroidHi != null ? s.features.centroidHi : s.features.centroid;
      if (s.id === "s" || s.id === "z") sCent.push(c);
      if (s.id === "sh" || s.id === "zh") shCent.push(c);
      if (s.features.f0 > 0) f0s.push(s.features.f0);
    }
    const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);
    const f0 = med(f0s);
    // ~200 Hz splits kids from adults — but only when a pitch was actually
    // found. A whispered "ahh", a noisy room or a calibration made entirely
    // of voiceless sounds all yield f0 = 0, and calling that an adult would
    // then judge a child against adult bands: exactly the wrong direction,
    // and silently. No evidence means the default this app is built for.
    return {
      band: f0 > 0 ? (f0 >= 200 ? "child" : "adult") : "child",
      f0,
      sCentroid: med(sCent),
      shCentroid: med(shCent),
      // A personal midpoint beats any table when we have both — but only
      // if the child's own two sounds actually came out different. If their
      // /s/ and /sh/ land on top of each other there is nothing to split,
      // and pretending otherwise would grade noise.
      split: sCent.length && shCent.length && med(sCent) > med(shCent) * 1.25
        ? (med(sCent) + med(shCent)) / 2
        : null,
      // Their own vowel corners, if they said them. Null falls back to the
      // age-band table, at a lower confidence.
      vowelBox: calibrateVowels(samples),
    };
  }

  // ---- microphone wrapper (thin) --------------------------------

  async function record(ms, opts) {
    opts = opts || {};
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const chunks = [];
    const node = ctx.createScriptProcessor
      ? ctx.createScriptProcessor(2048, 1, 1)
      : null;
    if (!node) { stream.getTracks().forEach((t) => t.stop()); throw new Error("no audio worklet path"); }
    node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(node);
    node.connect(ctx.destination);
    await new Promise((r) => setTimeout(r, ms || 1200));
    node.disconnect(); src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const buf = new Float32Array(total);
    let o = 0;
    for (const c of chunks) { buf.set(c, o); o += c.length; }
    const sr = ctx.sampleRate;
    await ctx.close();
    return { buf, sampleRate: sr };
  }

  // Loudest stretch — the child's actual attempt inside the silence.
  function loudestFrame(buf, sampleRate, frame) {
    frame = frame || 2048;
    let best = 0, bestAt = 0;
    for (let i = 0; i + frame <= buf.length; i += frame >> 1) {
      const e = rms(buf, i, i + frame);
      if (e > best) { best = e; bestAt = i; }
    }
    return { from: bestAt, rms: best };
  }

  const api = { analyse, grade, describe, calibrate, record, loudestFrame,
                vowelPose, vowelFeedback, calibrateVowels, toleranceFor,
                makeTracker, trackVowel, steadiest,
                VOWEL_BOX, ANCHOR,
                rms, zeroCrossRate, spectrum, dftSpectrum, fft, spectralCentroid, spectralFlatness,
                highFraction, pitch, formants, CHECKS, SIB };

  if (typeof window !== "undefined") window.PhonicsListen = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
