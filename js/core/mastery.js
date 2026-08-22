// ============================================================
// js/core/mastery.js — window.PhonicsMastery
//
// The pure mastery mathematics from docs/ARCHITECTURE.md §8.
// No storage, no DOM: records in, records out, so every rule
// here is unit-testable in Node (tests/mastery.test.js) and the
// tracker (js/core/tracker.js) is just persistence around it.
//
// A mastery record tracks ONE key — a GPC in one direction
// ("ai.ay|decode"), a rule ("rule:ck_k_c_spelling_of_k"), a
// phoneme-awareness skill ("count:phonemes"), a letter form
// ("letter:a|vic-modern-cursive") or a morpheme ("morph:port").
// ============================================================

(function () {
  const WINDOW = 10;            // rolling attempts considered for accuracy
  const MASTER_ACC = 0.9;       // rolling accuracy needed for "mastered"
  const MASTER_STRENGTH = 0.8;
  const MIN_ATTEMPTS = 6;       // can't master something you've barely met
  const TARGET_LATENCY = 5000;  // ms — at/below this counts as "at speed"
  const GAIN = 0.12;            // strength climb per correct answer
  const FAST_BONUS = 0.5;       // extra climb multiplier when at speed
  const LOSS = 0.25;            // strength drop per error
  const DAY = 24 * 60 * 60 * 1000;

  function newRecord(key) {
    return { key, attempts: 0, correct: 0, window: [], strength: 0,
             lastTs: null, due: null, everMastered: false };
  }

  // Spaced-retrieval interval: weak items come back tomorrow, strong ones
  // stretch out to ~3 weeks. days = 1 + 21·strength²
  function intervalMs(strength) {
    return (1 + 21 * strength * strength) * DAY;
  }

  function applyAttempt(rec, { correct, latencyMs = null, now = 0 }) {
    const r = Object.assign({}, rec, { window: rec.window.slice(-(WINDOW - 1)) });
    r.attempts += 1;
    if (correct) r.correct += 1;
    r.window.push(correct ? 1 : 0);
    const fast = latencyMs != null && latencyMs <= TARGET_LATENCY;
    r.strength = correct
      ? Math.min(1, r.strength + GAIN * (fast ? 1 + FAST_BONUS : 1))
      : Math.max(0, r.strength - LOSS);
    r.lastTs = now;
    r.due = now + intervalMs(r.strength);
    if (state(r, now) === "mastered") r.everMastered = true;
    return r;
  }

  function rollingAccuracy(rec) {
    if (!rec.window.length) return 0;
    return rec.window.reduce((a, b) => a + b, 0) / rec.window.length;
  }

  function state(rec, now = 0) {
    if (rec.attempts === 0) return "fresh";
    const acc = rollingAccuracy(rec);
    const mastered = rec.attempts >= MIN_ATTEMPTS && acc >= MASTER_ACC &&
                     rec.strength >= MASTER_STRENGTH;
    if (mastered || rec.everMastered) {
      return rec.due != null && now > rec.due ? "overdue" : (mastered ? "mastered" : "overdue");
    }
    return "learning";
  }

  // Keys the learner "knows" — mastered now, or mastered before and merely
  // due for review. This is what fills drag-and-drop trays and default
  // palettes: an overdue skill is rusty, not absent.
  function knownKeys(records, now = 0) {
    const out = new Set();
    for (const rec of Object.values(records)) {
      const s = state(rec, now);
      if (s === "mastered" || s === "overdue") out.add(rec.key);
    }
    return out;
  }

  // Review queue: overdue first (most overdue first), then weakest learning.
  function reviewQueue(records, now = 0, limit = 20) {
    const overdue = [], learning = [];
    for (const rec of Object.values(records)) {
      const s = state(rec, now);
      if (s === "overdue") overdue.push(rec);
      else if (s === "learning") learning.push(rec);
    }
    overdue.sort((a, b) => (a.due || 0) - (b.due || 0));
    learning.sort((a, b) => a.strength - b.strength);
    return overdue.concat(learning).slice(0, limit).map(r => r.key);
  }

  // ---- unlock predicates (ARCHITECTURE.md §8) -------------------
  // def: { decode: {count: 8, units: [1,2]},   // ≥8 decode-mastered GPCs from units 1-2
  //        encode: {count: 5},                 // ≥5 encode-mastered GPCs anywhere
  //        tasksDone: ["t8.cvc"],              // prior unlock flags
  //        rules: {count: 1} }
  // ctx: { records, now, seq (active sequence file), flags: Set }
  function evalUnlock(def, ctx) {
    const now = ctx.now || 0;
    const known = knownKeys(ctx.records, now);
    const inUnits = (gpcId) => {
      if (!def._unitSet) return true;
      return def._unitSet.has(gpcId);
    };
    for (const dir of ["decode", "encode"]) {
      const want = def[dir];
      if (!want) continue;
      let allowed = null;
      if (want.units && ctx.seq) {
        allowed = new Set();
        for (const u of ctx.seq.units) {
          if (want.units.includes(u.n)) u.teaches.forEach(g => allowed.add(g));
        }
      }
      let n = 0;
      for (const key of known) {
        const [gpc, d] = key.split("|");
        if (d !== dir) continue;
        if (allowed && !allowed.has(gpc)) continue;
        n += 1;
      }
      if (n < want.count) return false;
    }
    if (def.rules) {
      let n = 0;
      for (const key of known) if (key.startsWith("rule:")) n += 1;
      if (n < def.rules.count) return false;
    }
    if (def.tasksDone) {
      for (const t of def.tasksDone) if (!ctx.flags || !ctx.flags.has(t)) return false;
    }
    return true;
  }

  const api = { newRecord, applyAttempt, state, rollingAccuracy, knownKeys,
                reviewQueue, evalUnlock, intervalMs,
                constants: { WINDOW, MASTER_ACC, MIN_ATTEMPTS, TARGET_LATENCY } };

  if (typeof window !== "undefined") window.PhonicsMastery = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
