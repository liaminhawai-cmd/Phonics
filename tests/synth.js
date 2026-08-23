// ============================================================
// tests/synth.js — deterministic speech-ish audio for tests
//
// Lets tests/listen.test.js prove the analyser separates the
// things it claims to separate, with no microphone and no
// recorded assets. Everything is seeded, so a failure is a real
// regression and not a different roll of the noise.
//
// It is a source-filter toy, not a vocoder: a buzz (impulse
// train) or a hiss (white noise) pushed through two-pole
// resonators. That is enough to put energy where a real /s/,
// /sh/, /f/ or vowel puts it, which is all the analyser looks at.
// ============================================================

// Seeded uniform noise so every run sees the same "child".
function noiseGen(seed) {
  let s = (seed || 1) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

// Two-pole resonator: peaks at hz with bandwidth bw.
function resonate(buf, sampleRate, hz, bw) {
  const r = Math.exp((-Math.PI * bw) / sampleRate);
  const theta = (2 * Math.PI * hz) / sampleRate;
  const b = 2 * r * Math.cos(theta);
  const c = -r * r;
  const a = 1 - b - c;
  const out = new Float32Array(buf.length);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const y = a * buf[i] + b * y1 + c * y2;
    out[i] = y; y2 = y1; y1 = y;
  }
  return out;
}

// One-pole highpass — shapes a hiss so its energy sits up high.
function highpass(buf, sampleRate, hz) {
  const rc = 1 / (2 * Math.PI * hz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  const out = new Float32Array(buf.length);
  let prevIn = 0, prevOut = 0;
  for (let i = 0; i < buf.length; i++) {
    prevOut = alpha * (prevOut + buf[i] - prevIn);
    prevIn = buf[i];
    out[i] = prevOut;
  }
  return out;
}

function normalise(buf, peak) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m <= 0) return buf;
  const k = (peak == null ? 0.3 : peak) / m;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}

// Fade the ends so a hard edge doesn't smear the spectrum.
function envelope(buf, sampleRate, ms) {
  const n = Math.floor((sampleRate * (ms || 20)) / 1000);
  for (let i = 0; i < n && i < buf.length; i++) {
    const k = i / n;
    buf[i] *= k;
    buf[buf.length - 1 - i] *= k;
  }
  return buf;
}

function silence(secs, sampleRate) {
  return new Float32Array(Math.floor(secs * sampleRate));
}

// Two real poles low down — the -12 dB/octave tilt of a real glottal
// pulse. Without it the source is spectrally flat, which is not what
// vocal folds do and which quietly changes how formant estimation
// behaves (see lipRadiation below).
function tilt(buf, sampleRate, fc) {
  const r = Math.exp((-2 * Math.PI * (fc || 100)) / sampleRate);
  const b = 2 * r, c = -r * r, a = 1 - b - c;
  const out = new Float32Array(buf.length);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const y = a * buf[i] + b * y1 + c * y2;
    out[i] = y; y2 = y1; y1 = y;
  }
  return out;
}

// Radiation from the lips differentiates the pressure wave: +6 dB/octave.
// Source tilt (-12) plus this (+6) is the -6 dB/octave slope real speech
// has, and the -6 that the analyser's pre-emphasis is there to cancel.
// Get this wrong and pre-emphasis looks like it hurts, because on a flat
// synthetic source it does.
function lipRadiation(buf) {
  const out = new Float32Array(buf.length);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) { out[i] = buf[i] - prev; prev = buf[i]; }
  return out;
}

// A buzz: impulse train at f0 with slight jitter, then the glottal tilt.
function glottis(secs, sampleRate, f0, seed) {
  const rnd = noiseGen(seed || 7);
  const n = Math.floor(secs * sampleRate);
  const buf = new Float32Array(n);
  let next = 0;
  while (next < n) {
    buf[Math.floor(next)] = 1;
    const jitter = 1 + rnd() * 0.02;
    next += (sampleRate / f0) * jitter;
  }
  return tilt(buf, sampleRate, 100);
}

function hiss(secs, sampleRate, seed) {
  const rnd = noiseGen(seed || 11);
  const n = Math.floor(secs * sampleRate);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = rnd();
  return buf;
}

// A vowel: buzz through F1/F2/F3. Child formants are ~1.5x adult,
// which is exactly the reason listen.js never uses fixed vowel bands.
function vowel(opts) {
  const o = opts || {};
  const sr = o.sampleRate || 44100;
  const secs = o.secs || 0.5;
  const f = o.formants || [800, 1400, 2800];
  let buf = glottis(secs, sr, o.f0 || 240, o.seed);
  for (let i = 0; i < f.length; i++) buf = resonate(buf, sr, f[i], o.bw || 90);
  buf = lipRadiation(buf);
  return { buf: envelope(normalise(buf, o.peak || 0.3), sr), sampleRate: sr };
}

// A diphthong: one vowel sliding into another. The formants move, which
// is the whole point — /eɪ/ and /aɪ/ finish in the same place and are
// told apart only by where they set off.
function diphthong(opts) {
  const o = opts || {};
  const sr = o.sampleRate || 44100;
  const secs = o.secs || 0.6;
  const a = o.from || [700, 1600, 2900];
  const b = o.to || [400, 2200, 2900];
  const hold = o.hold == null ? 0.25 : o.hold;      // fraction spent at each end
  const src = glottis(secs, sr, o.f0 || 240, o.seed);
  const n = src.length;
  const out = new Float32Array(n);
  // Resonators have state, so a moving filter has to be run sample by
  // sample rather than as three passes over the buffer.
  const nf = Math.min(a.length, b.length);
  const st = [];
  for (let k = 0; k < nf; k++) st.push({ y1: 0, y2: 0 });
  const bw = o.bw || 90;
  for (let i = 0; i < n; i++) {
    let t = i / (n - 1);
    // ease: sit at the start, glide, sit at the end
    t = t < hold ? 0 : t > 1 - hold ? 1 : (t - hold) / (1 - 2 * hold);
    t = t * t * (3 - 2 * t);
    let x = src[i];
    for (let k = 0; k < nf; k++) {
      const hz = a[k] + (b[k] - a[k]) * t;
      const r = Math.exp((-Math.PI * bw) / sr);
      const theta = (2 * Math.PI * hz) / sr;
      const bb = 2 * r * Math.cos(theta), cc = -r * r, aa = 1 - bb - cc;
      const y = aa * x + bb * st[k].y1 + cc * st[k].y2;
      st[k].y2 = st[k].y1; st[k].y1 = y;
      x = y;
    }
    out[i] = x;
  }
  return { buf: envelope(normalise(lipRadiation(out), o.peak || 0.3), sr), sampleRate: sr };
}

// A fricative: hiss shaped to sit where that fricative's energy sits.
//   /s/  narrow, very high     /sh/ lower, broad
//   /f/ /th/  weak and diffuse — deliberately near-identical here,
//   because in life they are, which is the whole point.
function fricative(opts) {
  const o = opts || {};
  const sr = o.sampleRate || 44100;
  let buf = hiss(o.secs || 0.4, sr, o.seed);
  if (o.highpassHz) buf = highpass(buf, sr, o.highpassHz);
  for (const peak of o.peaks || []) buf = resonate(buf, sr, peak.hz, peak.bw || 1500);
  if (o.voiceF0) {                       // add the buzz for /z/ /v/ /zh/
    let v = glottis(o.secs || 0.4, sr, o.voiceF0, o.seed);
    v = lipRadiation(resonate(v, sr, 350, 120));
    normalise(v, 1);
    normalise(buf, 1);
    const mix = new Float32Array(buf.length);
    const w = o.voiceMix == null ? 0.75 : o.voiceMix;
    for (let i = 0; i < buf.length; i++) mix[i] = w * v[i] + (1 - w) * buf[i];
    buf = mix;
  }
  return { buf: envelope(normalise(buf, o.peak || 0.2), sr), sampleRate: sr };
}

// A stop: silence, a burst, then (optionally) the vowel that follows.
function stop(opts) {
  const o = opts || {};
  const sr = o.sampleRate || 44100;
  const hold = silence(o.holdSecs || 0.08, sr);
  let burst = hiss(o.burstSecs || 0.02, sr, o.seed);
  for (const peak of o.peaks || [{ hz: 2000, bw: 3000 }]) burst = resonate(burst, sr, peak.hz, peak.bw);
  normalise(burst, o.peak || 0.25);
  const parts = [hold, burst];
  if (o.thenVowel) parts.push(vowel({ sampleRate: sr, secs: 0.3, formants: o.thenVowel, f0: o.f0 || 240, seed: o.seed }).buf);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Float32Array(total);
  let at = 0;
  for (const p of parts) { buf.set(p, at); at += p.length; }
  return { buf, sampleRate: sr };
}

// Room tone — what the mic hears when nobody says anything.
function roomTone(opts) {
  const o = opts || {};
  const sr = o.sampleRate || 44100;
  const buf = hiss(o.secs || 0.5, sr, o.seed || 3);
  return { buf: normalise(buf, o.peak == null ? 0.002 : o.peak), sampleRate: sr };
}

// ---- the cast: a child and an adult saying the same things ----
// Child formants/centroids run ~1.5x the adult's. Both sets exist so
// tests can show that fixed adult thresholds would misjudge a child.
const CHILD = {
  f0: 260,
  vowelEE: [420, 3200, 3900],
  vowelAH: [1000, 1500, 3000],
  vowelOO: [430, 1050, 2900],
  sPeaks: [{ hz: 8200, bw: 2600 }],
  shPeaks: [{ hz: 3600, bw: 1600 }],
  vowelE: [780, 2500, 3300],
  vowelI: [520, 3000, 3700],
  vowelAE: [1150, 2350, 3200],
};
const ADULT = {
  f0: 120,
  vowelEE: [280, 2250, 2900],
  vowelAH: [730, 1090, 2440],
  vowelOO: [300, 870, 2240],
  sPeaks: [{ hz: 6500, bw: 2400 }],
  shPeaks: [{ hz: 2600, bw: 1400 }],
  vowelE: [530, 1840, 2480],
  vowelI: [390, 2100, 2700],
  vowelAE: [770, 1600, 2450],
};

function say(who, what, seed) {
  const v = who === "adult" ? ADULT : CHILD;
  const sr = 44100;
  switch (what) {
    case "s":   return fricative({ sampleRate: sr, peaks: v.sPeaks, highpassHz: 3500, seed });
    case "z":   return fricative({ sampleRate: sr, peaks: v.sPeaks, highpassHz: 3500, voiceF0: v.f0, seed });
    case "sh":  return fricative({ sampleRate: sr, peaks: v.shPeaks, highpassHz: 1200, seed });
    case "zh":  return fricative({ sampleRate: sr, peaks: v.shPeaks, highpassHz: 1200, voiceF0: v.f0, seed });
    // /f/ and /th/ get the SAME recipe on purpose.
    case "f":
    case "th":  return fricative({ sampleRate: sr, peaks: [{ hz: 5000, bw: 6000 }], highpassHz: 1500, peak: 0.08, seed });
    case "v":
    case "dh":  return fricative({ sampleRate: sr, peaks: [{ hz: 5000, bw: 6000 }], highpassHz: 1500, peak: 0.08, voiceF0: v.f0, seed });
    case "ee":  return vowel({ sampleRate: sr, formants: v.vowelEE, f0: v.f0, seed });
    case "ah":  return vowel({ sampleRate: sr, formants: v.vowelAH, f0: v.f0, seed });
    case "oo":  return vowel({ sampleRate: sr, formants: v.vowelOO, f0: v.f0, seed });
    case "ae":  return vowel({ sampleRate: sr, formants: v.vowelAE, f0: v.f0, seed });
    case "m":   return vowel({ sampleRate: sr, formants: [280, 1100, 2100], bw: 250, f0: v.f0, peak: 0.2, seed });
    // /eɪ/ (day) and /aɪ/ (my): both finish on /ɪ/, set off from opposite
    // ends of the mouth. The pair that endpoint matching cannot tell apart.
    case "ay":  return diphthong({ sampleRate: sr, f0: v.f0, seed,
                  from: v.vowelE || [560, 2100, 2900], to: v.vowelI || [430, 2600, 3100] });
    case "igh": return diphthong({ sampleRate: sr, f0: v.f0, seed,
                  from: v.vowelAH, to: v.vowelI || [430, 2600, 3100] });
    // /aʊ/ (now) sets off from the same place as /aɪ/ and finishes at the
    // opposite end. The pair that start matching cannot tell apart.
    case "ow":  return diphthong({ sampleRate: sr, f0: v.f0, seed,
                  from: v.vowelAH, to: v.vowelOO });
    case "p":   return stop({ sampleRate: sr, peaks: [{ hz: 900, bw: 4000 }], seed });
    case "t":   return stop({ sampleRate: sr, peaks: [{ hz: 4000, bw: 3000 }], seed });
    case "quiet": return roomTone({ sampleRate: sr, seed });
    default: throw new Error("no synth recipe for " + what);
  }
}

module.exports = { noiseGen, resonate, highpass, tilt, lipRadiation,
                   normalise, envelope, silence,
                   glottis, hiss, vowel, diphthong, fricative, stop, roomTone,
                   say, CHILD, ADULT };
