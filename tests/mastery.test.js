const assert = require("assert");
const M = require("../js/core/mastery.js");

const DAY = 24 * 60 * 60 * 1000;

function drill(rec, results, { latency = 3000, startTs = 0 } = {}) {
  let r = rec, t = startTs;
  for (const ok of results) { t += 60000; r = M.applyAttempt(r, { correct: ok, latencyMs: latency, now: t }); }
  return { rec: r, now: t };
}

module.exports = {
  "fresh record starts fresh"() {
    const r = M.newRecord("ai.ay|decode");
    assert.equal(M.state(r, 0), "fresh");
    assert.equal(r.strength, 0);
  },

  "ten fast correct answers reach mastered"() {
    const { rec, now } = drill(M.newRecord("s.s|decode"), Array(10).fill(true));
    assert.equal(M.state(rec, now), "mastered");
    assert.ok(rec.strength >= 0.8, "strength " + rec.strength);
  },

  "six slow correct answers are not yet mastered (strength gate)"() {
    const { rec, now } = drill(M.newRecord("s.s|decode"), Array(6).fill(true), { latency: 9000 });
    assert.equal(M.state(rec, now), "learning");
  },

  "errors drop strength and demote"() {
    let { rec, now } = drill(M.newRecord("x|decode"), Array(10).fill(true));
    assert.equal(M.state(rec, now), "mastered");
    ({ rec, now } = drill(rec, [false, false, false, false], { startTs: now }));
    const s = M.state(rec, now);
    assert.ok(s === "learning" || s === "overdue", "got " + s);
    assert.ok(rec.strength < 0.8);
  },

  "mastered item becomes overdue after its interval"() {
    const { rec, now } = drill(M.newRecord("m.m|decode"), Array(10).fill(true));
    assert.equal(M.state(rec, now + 60 * DAY), "overdue");
  },

  "knownKeys includes mastered and overdue, excludes learning"() {
    const a = drill(M.newRecord("a|decode"), Array(10).fill(true)).rec;       // mastered
    const b = drill(M.newRecord("b|decode"), [true, false, true]).rec;        // learning
    const known = M.knownKeys({ a, b }, a.lastTs);
    assert.ok(known.has("a|decode"));
    assert.ok(!known.has("b|decode"));
  },

  "reviewQueue puts overdue before weak learning"() {
    const done = drill(M.newRecord("old|decode"), Array(10).fill(true));
    const weak = drill(M.newRecord("weak|decode"), [false, true, false]).rec;
    const q = M.reviewQueue({ old: done.rec, weak }, done.now + 90 * DAY);
    assert.deepEqual(q, ["old|decode", "weak|decode"]);
  },

  "unlock predicate counts direction-specific mastered GPCs within units"() {
    const seq = { units: [
      { n: 1, teaches: ["a.a", "p.p", "t.t"] },
      { n: 2, teaches: ["s.s", "m.m"] },
      { n: 3, teaches: ["ai.ay"] },
    ]};
    const recs = {};
    for (const g of ["a.a", "p.p", "t.t", "s.s"]) {
      recs[g + "|decode"] = drill(M.newRecord(g + "|decode"), Array(10).fill(true)).rec;
    }
    recs["ai.ay|decode"] = drill(M.newRecord("ai.ay|decode"), Array(10).fill(true)).rec;
    const ctx = { records: recs, now: Date.parse("2026-01-01"), seq };
    // needs 4 decode from units 1-2: a.a,p.p,t.t,s.s qualify (ai.ay excluded)
    assert.equal(M.evalUnlock({ decode: { count: 4, units: [1, 2] } }, ctx), true);
    assert.equal(M.evalUnlock({ decode: { count: 5, units: [1, 2] } }, ctx), false);
    // encode: none mastered
    assert.equal(M.evalUnlock({ encode: { count: 1 } }, ctx), false);
  },

  "unlock tasksDone flag gating"() {
    const ctx = { records: {}, now: 0, flags: new Set(["t8.cvc"]) };
    assert.equal(M.evalUnlock({ tasksDone: ["t8.cvc"] }, ctx), true);
    assert.equal(M.evalUnlock({ tasksDone: ["t8.ccvc"] }, ctx), false);
  },
};
