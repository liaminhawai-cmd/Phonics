// tests/tracker.test.js — window.PhonicsTracker (js/core/tracker.js)
//
// Runs under the synchronous runner (node tests/run.js): with the
// localStorage adapter forced, every tracker call returns its value
// synchronously (the maybe-promise core), so plain asserts work.
const assert = require("assert");

// -- browser shims so the tracker's localStorage path runs in Node ----
function makeLocalStorage() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}
global.localStorage = makeLocalStorage();
global.window = global.window || {};

const T = require("../js/core/tracker.js");

// Wipe storage and re-init on the forced localStorage adapter.
function freshInit() {
  global.localStorage.clear();
  return T.init({ adapter: "local" });
}
function drill(key, results, { latency = 1500, taskType = "t1" } = {}) {
  let rec = null;
  for (const ok of results) rec = T.record({ key, correct: ok, latencyMs: latency, taskType });
  return rec;
}

module.exports = {
  "init picks the localStorage adapter and returns the api synchronously"() {
    const ret = freshInit();
    assert.equal(ret, T, "init should hand back the api itself, not a promise");
    assert.equal(T.adapterKind(), "localStorage");
    // no indexedDB in Node, so an unforced init falls back too
    assert.equal(T.init(), T);
    assert.equal(T.adapterKind(), "localStorage");
  },

  "profile create / list / update / setActive / remove"() {
    freshInit();
    const a = T.profileCreate({ name: "Asha", accent: "au" });
    assert.equal(T.activeProfile().id, a.id, "first profile auto-activates");
    const b = T.profileCreate({ name: "Ben", accent: "us" });
    assert.equal(T.activeProfile().id, a.id, "second profile does not steal focus");
    const list = T.profilesList();
    assert.equal(list.length, 2);
    assert.ok(list.some((p) => p.id === a.id && p.name === "Asha"));
    T.setActiveProfile(b.id);
    assert.equal(T.activeProfile().id, b.id);
    assert.equal(global.localStorage.getItem("phonics-active-profile"), b.id);
    assert.throws(() => T.setActiveProfile("nope"), /no profile/);
    T.profileUpdate(b.id, { name: "Benny" });
    assert.equal(T.activeProfile().name, "Benny");
    assert.equal(T.profileRemove(b.id), true);
    assert.equal(T.activeProfile(), null, "removing the active profile clears it");
    assert.equal(T.profilesList().length, 1);
  },

  "record() and setFlag() require an active profile"() {
    freshInit();
    assert.throws(() => T.record({ key: "s.s|decode", correct: true }), /active profile/);
    assert.throws(() => T.setFlag("t8.cvc"), /active profile/);
  },

  "record() applies mastery maths and appends attempts (newest first)"() {
    freshInit();
    const p = T.profileCreate({ name: "Kid" });
    const r1 = T.record({ key: "s.s|decode", correct: true, latencyMs: 1200, taskType: "t1" });
    assert.equal(r1.attempts, 1);
    assert.equal(r1.correct, 1);
    assert.ok(r1.strength > 0);
    const r2 = T.record({ key: "s.s|decode", correct: false, latencyMs: 2000, taskType: "t4",
                          detail: { tried: "c" } });
    assert.equal(r2.attempts, 2);
    assert.ok(r2.strength < r1.strength, "an error drops strength");
    const m = T.mastery();
    assert.deepEqual(m["s.s|decode"], r2);
    delete m["s.s|decode"];
    assert.ok(T.mastery()["s.s|decode"], "mastery() hands out a copy");
    const rows = T.attempts({ limit: 10 });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].correct, false, "newest attempt first");
    assert.equal(rows[0].taskType, "t4");
    assert.deepEqual(rows[0].detail, { tried: "c" });
    assert.equal(rows[0].profileId, p.id);
    assert.equal(rows[1].correct, true);
  },

  "everything survives a re-init from localStorage"() {
    freshInit();
    const p = T.profileCreate({ name: "Kid" });
    drill("s.s|decode", [true, true, false]);
    T.setFlag("t8.cvc");
    T.init({ adapter: "local" }); // reload from storage, no wipe
    assert.equal(T.profilesList().length, 1);
    assert.equal(T.activeProfile().id, p.id, "active profile id restored");
    assert.equal(T.mastery()["s.s|decode"].attempts, 3);
    assert.equal(T.attempts({}).length, 3);
    assert.ok(T.getFlags().has("t8.cvc"));
  },

  "knownGpcSet strips the direction suffix and respects direction"() {
    freshInit();
    T.profileCreate({ name: "Kid" });
    drill("m.m|decode", Array(10).fill(true));
    drill("t.t|decode", Array(3).fill(true));   // still learning
    drill("s.s|encode", Array(10).fill(true));
    const dec = T.knownGpcSet("decode");
    assert.ok(dec instanceof Set);
    assert.ok(dec.has("m.m"));
    assert.ok(!dec.has("t.t"), "3 attempts is not mastered");
    assert.ok(!dec.has("s.s"), "encode mastery must not leak into decode");
    assert.ok(T.knownGpcSet("encode").has("s.s"));
  },

  "flags are idempotent and handed out as copies"() {
    freshInit();
    T.profileCreate({ name: "Kid" });
    assert.equal(T.getFlags().size, 0);
    T.setFlag("t8.cvc");
    T.setFlag("t8.cvc");
    assert.deepEqual(Array.from(T.getFlags()), ["t8.cvc"]);
    T.getFlags().add("hax");
    assert.ok(!T.getFlags().has("hax"), "mutating the returned Set changes nothing");
  },

  "isUnlocked: empty defs open, t6 needs 8 decode masteries"() {
    freshInit();
    T.profileCreate({ name: "Kid" });
    assert.deepEqual(T.isUnlocked("t3"), { ok: true, reason: null });
    assert.equal(T.isUnlocked("not-a-task").ok, true, "unknown ids default open");
    let r = T.isUnlocked("t6");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "Master 8 letter-sounds to unlock");
    const gpcs = ["s.s", "a.a", "t.t", "p.p", "i.i", "n.n", "m.m", "d.d"];
    for (const g of gpcs) drill(g + "|decode", Array(10).fill(true));
    r = T.isUnlocked("t6"); // PhonicsBank absent in Node -> seq null path
    assert.deepEqual(r, { ok: true, reason: null });
    r = T.isUnlocked("t8cvc"); // 8 decode < 10, and no encode yet
    assert.equal(r.ok, false);
    assert.ok(/10 letter-sounds/.test(r.reason), r.reason);
    assert.ok(/spell 5 letter-sounds/i.test(r.reason), r.reason);
  },

  "isUnlocked: t8cvc opens with 10 decode + 5 encode masteries"() {
    freshInit();
    T.profileCreate({ name: "Kid" });
    const gpcs = ["s.s", "a.a", "t.t", "p.p", "i.i", "n.n", "m.m", "d.d", "g.g", "o.o"];
    for (const g of gpcs) drill(g + "|decode", Array(10).fill(true));
    for (const g of gpcs.slice(0, 5)) drill(g + "|encode", Array(10).fill(true));
    assert.deepEqual(T.isUnlocked("t8cvc"), { ok: true, reason: null });
  },

  "export/import round-trip (clashing id gets a fresh one)"() {
    freshInit();
    const p = T.profileCreate({ name: "Asha", accent: "au" });
    drill("s.s|decode", Array(10).fill(true));
    T.setFlag("t8.cvc");
    const dump = T.exportJson();
    assert.equal(dump.version, 1);
    assert.ok(dump.exportedTs > 0);
    assert.equal(dump.profile.name, "Asha");
    assert.equal(dump.attempts.length, 10);
    for (let i = 1; i < dump.attempts.length; i++) {
      assert.ok(dump.attempts[i - 1].ts <= dump.attempts[i].ts, "export is chronological");
    }
    assert.ok(dump.mastery["s.s|decode"]);
    assert.deepEqual(dump.flags, ["t8.cvc"]);
    const imported = T.importJson(JSON.parse(JSON.stringify(dump)));
    assert.notEqual(imported.id, p.id, "id clash resolved with a fresh id");
    assert.equal(imported.name, "Asha");
    assert.equal(T.profilesList().length, 2);
    T.setActiveProfile(imported.id);
    assert.equal(T.mastery()["s.s|decode"].attempts, 10);
    assert.equal(T.attempts({ limit: 99 }).length, 10);
    assert.ok(T.getFlags().has("t8.cvc"));
    assert.ok(T.knownGpcSet("decode").has("s.s"));
  },

  "import into an empty store keeps the original profile id"() {
    freshInit();
    const p = T.profileCreate({ name: "Asha" });
    drill("s.s|decode", [true, true]);
    const dump = T.exportJson();
    freshInit(); // wiped: no clash now
    const again = T.importJson(dump);
    assert.equal(again.id, p.id);
    T.setActiveProfile(again.id);
    assert.equal(T.mastery()["s.s|decode"].attempts, 2);
    assert.throws(() => T.importJson({ version: 2, profile: {} }), /version 1/);
  },
};
