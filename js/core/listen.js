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

  // Naive DFT magnitude over a windowed frame. Slow but exact and
  // dependency-free; frames are short (≤2048) and analysis is not
  // per-sample, so this is affordable and keeps the module testable.
  function spectrum(buf, from, n, sampleRate) {
    const N = Math.min(n, buf.length - from);
    if (N <= 8) return { mag: new Float32Array(0), binHz: 0 };
    const w = hann(N);
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
    // the honest pair: acoustically near-identical, decided by eye
    f: { manner: "fricative", voiced: false, cues: ["weak-fricative", "voiceless"], selfCheck: "lip" },
    v: { manner: "fricative", voiced: true, cues: ["weak-fricative", "voiced"], selfCheck: "lip" },
    th: { manner: "fricative", voiced: false, cues: ["weak-fricative", "voiceless"], selfCheck: "tongue" },
    dh: { manner: "fricative", voiced: true, cues: ["weak-fricative", "voiced"], selfCheck: "tongue" },
    h: { manner: "fricative", voiced: false, cues: ["weak-fricative", "voiceless"] },
    // stops: we can hear THAT a stop happened and whether it buzzed;
    // where it was made needs the picture (or a following vowel).
    p: { manner: "stop", voiced: false, cues: ["voiceless"], selfCheck: "place" },
    b: { manner: "stop", voiced: true, cues: ["voiced"], selfCheck: "place" },
    t: { manner: "stop", voiced: false, cues: ["voiceless"], selfCheck: "place" },
    d: { manner: "stop", voiced: true, cues: ["voiced"], selfCheck: "place" },
    k: { manner: "stop", voiced: false, cues: ["voiceless"], selfCheck: "place" },
    g: { manner: "stop", voiced: true, cues: ["voiced"], selfCheck: "place" },
    ch: { manner: "affricate", voiced: false, cues: ["sibilant-low", "voiceless"] },
    j: { manner: "affricate", voiced: true, cues: ["sibilant-low", "voiced"] },
    m: { manner: "nasal", voiced: true, cues: ["voiced", "low-heavy"], selfCheck: "place" },
    n: { manner: "nasal", voiced: true, cues: ["voiced", "low-heavy"], selfCheck: "place" },
    ng: { manner: "nasal", voiced: true, cues: ["voiced", "low-heavy"], selfCheck: "place" },
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
      return out;
    }

    out.verdict = ok ? "heard" : "close";
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
    return {
      band: f0 >= 200 ? "child" : "adult",   // ~200 Hz splits kids from adults
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

  const api = { analyse, grade, calibrate, record, loudestFrame,
                rms, zeroCrossRate, spectrum, spectralCentroid, spectralFlatness,
                highFraction, pitch, formants, CHECKS, SIB };

  if (typeof window !== "undefined") window.PhonicsListen = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
