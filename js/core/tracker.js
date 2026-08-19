// ============================================================
// js/core/tracker.js — window.PhonicsTracker
//
// Per-learner persistence around the pure mastery maths in
// js/core/mastery.js (ARCHITECTURE.md §8): profiles, attempt
// history, mastery records, task flags, unlock checks and
// JSON export/import so a teacher can move a kid between
// devices or email a snapshot home.
//
// Storage lives in IndexedDB (db "phonics-tracker" v1) when the
// browser has it, else in a JSON blob under localStorage — both
// behind the same adapter interface, chosen once at init().
// The core never uses async/await directly: it composes over
// "maybe-promises" (chain/steps below), so with the IndexedDB
// adapter every call returns a real Promise, and with the
// localStorage adapter results also come back synchronously.
// `await` works the same on both, and Node tests can drive the
// localStorage path under a synchronous test runner.
//
//   await PhonicsTracker.init();
//   const p = PhonicsTracker.profileCreate({ name: "Asha", accent: "au" });
//   PhonicsTracker.setActiveProfile(p.id);      // first profile auto-activates
//   await PhonicsTracker.record({ key: "s.s|decode", correct: true,
//                                 latencyMs: 1400, taskType: "t1" });
//   await PhonicsTracker.knownGpcSet("decode"); // Set of mastered gpc ids
//   await PhonicsTracker.isUnlocked("t6");      // { ok, reason }
// ============================================================

(function () {
  const DB_NAME = "phonics-tracker";
  const DB_VERSION = 1;
  const LS_DATA = "phonics-tracker";          // localStorage fallback blob
  const LS_ACTIVE = "phonics-active-profile"; // active profile id (both adapters)
  const flagsKey = (pid) => "flags:" + pid;

  // Task unlock predicates, evaluated by PhonicsMastery.evalUnlock.
  // An empty def means the task is always available.
  const UNLOCKS = {
    t3: {},                                            // sound & syllable counting
    t4: {},                                            // listen & write
    t5: {},                                            // grapheme toggle
    t6: { decode: { count: 8 } },                      // drag-and-drop build
    t8cvc: { decode: { count: 10 }, encode: { count: 5 } }, // CVC writing
  };

  // ---- maybe-promise plumbing -----------------------------------
  const isThenable = (v) => !!v && typeof v.then === "function";
  function chain(v, fn) { return isThenable(v) ? v.then(fn) : fn(v); }
  // Run fn over items in order; stays synchronous while results are.
  function each(items, fn) {
    let i = 0;
    function run() {
      while (i < items.length) {
        const r = fn(items[i++]);
        if (isThenable(r)) return r.then(run);
      }
    }
    return run();
  }
  const steps = (thunks) => each(thunks, (t) => t());
  function swallow(v) { // fire-and-forget write: log, never reject unhandled
    if (isThenable(v)) v.then(null, (e) => console.warn("PhonicsTracker:", e));
    return v;
  }

  // ---- small environment helpers --------------------------------
  function ls() {
    try { return typeof localStorage !== "undefined" ? localStorage : null; }
    catch (e) { return null; }
  }
  function lsGet(k) { const s = ls(); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { const s = ls(); try { if (s) s.setItem(k, v); } catch (e) {} }
  function lsRemove(k) { const s = ls(); try { if (s) s.removeItem(k); } catch (e) {} }

  let Mst = null; // lazy handle on the pure mastery maths
  function M() {
    if (Mst) return Mst;
    if (typeof window !== "undefined" && window.PhonicsMastery) return (Mst = window.PhonicsMastery);
    if (typeof module !== "undefined" && typeof require === "function") return (Mst = require("./mastery.js"));
    throw new Error("PhonicsTracker: js/core/mastery.js must load before tracker.js");
  }

  function activeSeq() { // active sequence file, when PhonicsBank is around
    try {
      const bank = (typeof window !== "undefined" && window.PhonicsBank) ||
                   (typeof PhonicsBank !== "undefined" ? PhonicsBank : null);
      return bank && typeof bank.seq === "function" ? (bank.seq() || null) : null;
    } catch (e) { return null; }
  }

  // ---- IndexedDB adapter -----------------------------------------
  // Stores: profiles(id) / mastery([profileId,key]) /
  //         attempts(autoIncrement, index profileTs [profileId,ts]) / meta(k)
  function makeIdbAdapter() {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { return reject(e); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("profiles"))
          db.createObjectStore("profiles", { keyPath: "id" });
        if (!db.objectStoreNames.contains("mastery"))
          db.createObjectStore("mastery", { keyPath: ["profileId", "key"] });
        if (!db.objectStoreNames.contains("attempts"))
          db.createObjectStore("attempts", { autoIncrement: true })
            .createIndex("profileTs", ["profileId", "ts"]);
        if (!db.objectStoreNames.contains("meta"))
          db.createObjectStore("meta", { keyPath: "k" });
      };
      req.onerror = () => reject(req.error || new Error("indexedDB open failed"));
      req.onsuccess = () => resolve(idbAdapter(req.result));
    });
  }

  function idbAdapter(db) {
    const rq = (r) => new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const os = (name, mode) => db.transaction(name, mode || "readonly").objectStore(name);
    // every [pid, x] key sorts between [pid] and [pid, []] in IDB key order
    const range = (pid) => IDBKeyRange.bound([pid], [pid, []]);
    return {
      kind: "indexeddb",
      profilesAll: () => rq(os("profiles").getAll()),
      profilePut: (p) => rq(os("profiles", "readwrite").put(p)),
      profileDelete: (id) => rq(os("profiles", "readwrite").delete(id)),
      masteryAll: (pid) => rq(os("mastery").getAll(range(pid))).then((rows) => {
        const out = {};
        for (const row of rows) {
          const rec = Object.assign({}, row);
          delete rec.profileId;
          out[rec.key] = rec;
        }
        return out;
      }),
      masteryPut: (pid, key, rec) =>
        rq(os("mastery", "readwrite").put(Object.assign({ profileId: pid }, rec))),
      masteryDeleteAll: (pid) => rq(os("mastery", "readwrite").delete(range(pid))),
      attemptAdd: (a) => rq(os("attempts", "readwrite").add(a)),
      attemptsFor: (pid, limit) => new Promise((res, rej) => {
        const out = [];
        const cur = os("attempts").index("profileTs").openCursor(range(pid), "prev");
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c || out.length >= limit) return res(out);
          out.push(c.value);
          c.continue();
        };
        cur.onerror = () => rej(cur.error);
      }),
      attemptsDeleteAll: (pid) => new Promise((res, rej) => {
        const cur = os("attempts", "readwrite").index("profileTs").openCursor(range(pid));
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return res();
          c.delete();
          c.continue();
        };
        cur.onerror = () => rej(cur.error);
      }),
      metaGet: (k) => rq(os("meta").get(k)).then((row) => (row ? row.v : undefined)),
      metaPut: (k, v) => rq(os("meta", "readwrite").put({ k: k, v: v })),
      metaDelete: (k) => rq(os("meta", "readwrite").delete(k)),
    };
  }

  // ---- localStorage fallback adapter ------------------------------
  // Same interface, one JSON blob; methods return plain values so the
  // whole tracker stays synchronous on this path.
  function makeLocalAdapter() {
    let data = null;
    const copy = (o) => Object.assign({}, o);
    function loadit() {
      if (data) return data;
      let parsed = null;
      const s = ls();
      if (s) { try { parsed = JSON.parse(s.getItem(LS_DATA) || "null"); } catch (e) { parsed = null; } }
      data = parsed && typeof parsed === "object" ? parsed : {};
      data.profiles = data.profiles || {};
      data.mastery = data.mastery || {};
      data.attempts = data.attempts || [];
      data.meta = data.meta || {};
      data.nextAttemptId = data.nextAttemptId || 1;
      return data;
    }
    function save() {
      const s = ls();
      if (!s) return;
      try { s.setItem(LS_DATA, JSON.stringify(data)); }
      catch (e) { console.warn("PhonicsTracker: could not save to localStorage", e); }
    }
    return {
      kind: "localStorage",
      profilesAll: () => Object.values(loadit().profiles).map(copy),
      profilePut: (p) => { loadit().profiles[p.id] = copy(p); save(); },
      profileDelete: (id) => { delete loadit().profiles[id]; save(); },
      masteryAll: (pid) => {
        const out = {};
        for (const [k, rec] of Object.entries(loadit().mastery[pid] || {})) out[k] = copy(rec);
        return out;
      },
      masteryPut: (pid, key, rec) => {
        const d = loadit();
        (d.mastery[pid] = d.mastery[pid] || {})[key] = copy(rec);
        save();
      },
      masteryDeleteAll: (pid) => { delete loadit().mastery[pid]; save(); },
      attemptAdd: (a) => {
        const d = loadit();
        d.attempts.push(Object.assign({ id: d.nextAttemptId++ }, a));
        save();
      },
      attemptsFor: (pid, limit) => {
        const rows = loadit().attempts.filter((a) => a.profileId === pid);
        rows.sort((x, y) => (y.ts - x.ts) || (y.id - x.id)); // newest first
        return rows.slice(0, limit).map(copy);
      },
      attemptsDeleteAll: (pid) => {
        const d = loadit();
        d.attempts = d.attempts.filter((a) => a.profileId !== pid);
        save();
      },
      metaGet: (k) => loadit().meta[k],
      metaPut: (k, v) => { loadit().meta[k] = v; save(); },
      metaDelete: (k) => { delete loadit().meta[k]; save(); },
    };
  }

  // ---- tracker state ----------------------------------------------
  let adapter = null;
  let profiles = {};      // id -> profile (in-memory mirror of the store)
  let activeId = null;
  let masteryCache = {};  // profileId -> { key: rec }
  let flagsCache = {};    // profileId -> Set of flag names

  function requireInit() {
    if (!adapter) throw new Error("PhonicsTracker: call init() first");
  }
  function requireActive() {
    requireInit();
    if (!activeId || !profiles[activeId]) {
      throw new Error("PhonicsTracker: no active profile — profileCreate() then setActiveProfile() first");
    }
    return activeId;
  }
  function genId() {
    let id;
    do { id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    while (profiles[id]);
    return id;
  }

  // init({adapter:"local"}) forces the localStorage adapter (tests, debugging).
  function init(opts) {
    opts = opts || {};
    adapter = null;
    profiles = {}; activeId = null; masteryCache = {}; flagsCache = {};
    const wantLocal = opts.adapter === "local" || opts.forceLocal === true;
    const hasIdb = typeof indexedDB !== "undefined" && indexedDB != null;
    if (wantLocal || !hasIdb) return finishInit(makeLocalAdapter());
    return makeIdbAdapter()
      .catch((e) => {
        console.warn("PhonicsTracker: indexedDB unavailable, falling back to localStorage", e);
        return makeLocalAdapter();
      })
      .then(finishInit);
  }
  function finishInit(a) {
    adapter = a;
    return chain(adapter.profilesAll(), (list) => {
      profiles = {};
      for (const p of list) profiles[p.id] = p;
      const saved = lsGet(LS_ACTIVE);
      activeId = saved && profiles[saved] ? saved : null;
      return api;
    });
  }

  // ---- profiles -----------------------------------------------------
  function profilesList() {
    requireInit();
    return Object.values(profiles)
      .sort((a, b) => (a.createdTs || 0) - (b.createdTs || 0))
      .map((p) => Object.assign({}, p));
  }
  function profileCreate(opts) {
    requireInit();
    opts = opts || {};
    const p = Object.assign({}, opts, {
      id: genId(),
      name: (opts.name == null ? "" : String(opts.name)).trim() || "Learner",
      accent: opts.accent || "au",
      createdTs: Date.now(),
    });
    profiles[p.id] = p;
    swallow(adapter.profilePut(Object.assign({}, p)));
    // A fresh install lands straight in a usable state: the first
    // profile becomes active; later ones need setActiveProfile().
    if (!activeId) setActiveProfile(p.id);
    return Object.assign({}, p);
  }
  function profileUpdate(id, patch) {
    requireInit();
    const p = profiles[id];
    if (!p) throw new Error("PhonicsTracker: no profile " + id);
    Object.assign(p, patch || {}, { id: id });
    swallow(adapter.profilePut(Object.assign({}, p)));
    return Object.assign({}, p);
  }
  function profileRemove(id) {
    requireInit();
    if (!profiles[id]) return false;
    delete profiles[id];
    delete masteryCache[id];
    delete flagsCache[id];
    if (activeId === id) { activeId = null; lsRemove(LS_ACTIVE); }
    swallow(steps([
      () => adapter.profileDelete(id),
      () => adapter.masteryDeleteAll(id),
      () => adapter.attemptsDeleteAll(id),
      () => adapter.metaDelete(flagsKey(id)),
    ]));
    return true;
  }
  function setActiveProfile(id) {
    requireInit();
    if (id == null) { activeId = null; lsRemove(LS_ACTIVE); return null; }
    if (!profiles[id]) throw new Error("PhonicsTracker: no profile " + id);
    activeId = id;
    lsSet(LS_ACTIVE, id);
    return Object.assign({}, profiles[id]);
  }
  function activeProfile() {
    requireInit();
    return activeId && profiles[activeId] ? Object.assign({}, profiles[activeId]) : null;
  }

  // ---- attempts & mastery -------------------------------------------
  function ensureMastery(pid) {
    if (masteryCache[pid]) return masteryCache[pid];
    return chain(adapter.masteryAll(pid), (m) => (masteryCache[pid] = m));
  }
  function ensureFlags(pid) {
    if (flagsCache[pid]) return flagsCache[pid];
    return chain(adapter.metaGet(flagsKey(pid)), (arr) =>
      (flagsCache[pid] = new Set(Array.isArray(arr) ? arr : [])));
  }

  // record({key, correct, latencyMs, taskType, detail}) -> updated rec.
  // Applies the pure mastery maths and appends one attempt row.
  function record(opts) {
    const pid = requireActive();
    if (!opts || !opts.key) throw new Error("PhonicsTracker: record() needs a mastery key");
    const now = Date.now();
    return chain(ensureMastery(pid), (m) => {
      const prev = m[opts.key] || M().newRecord(opts.key);
      const rec = M().applyAttempt(prev, {
        correct: !!opts.correct,
        latencyMs: opts.latencyMs == null ? null : opts.latencyMs,
        now: now,
      });
      m[opts.key] = rec;
      const attempt = {
        profileId: pid,
        ts: now,
        key: opts.key,
        correct: !!opts.correct,
        latencyMs: opts.latencyMs == null ? null : opts.latencyMs,
        taskType: opts.taskType || null,
        detail: opts.detail == null ? null : opts.detail, // keep JSON-safe
      };
      return chain(adapter.masteryPut(pid, opts.key, rec), () =>
        chain(adapter.attemptAdd(attempt), () => rec));
    });
  }

  function mastery() {
    requireInit();
    if (!activeId) return {};
    return chain(ensureMastery(activeId), (m) => Object.assign({}, m));
  }

  // Set of gpc ids the active profile has mastered in one direction
  // ("decode"/"encode") — overdue-for-review still counts as known.
  function knownGpcSet(direction) {
    const suffix = "|" + (direction || "decode");
    return chain(mastery(), (records) => {
      const out = new Set();
      for (const key of M().knownKeys(records, Date.now())) {
        if (key.endsWith(suffix)) out.add(key.slice(0, -suffix.length));
      }
      return out;
    });
  }

  function attempts(opts) {
    requireInit();
    if (!activeId) return [];
    const limit = (opts && opts.limit) || 100;
    return adapter.attemptsFor(activeId, limit); // newest first
  }

  // ---- flags (one-off milestones like "t8.cvc" finished) -------------
  function setFlag(name) {
    const pid = requireActive();
    if (!name) throw new Error("PhonicsTracker: setFlag() needs a name");
    return chain(ensureFlags(pid), (s) => {
      if (s.has(name)) return new Set(s);
      s.add(name);
      return chain(adapter.metaPut(flagsKey(pid), Array.from(s)), () => new Set(s));
    });
  }
  function getFlags() {
    requireInit();
    if (!activeId) return new Set();
    return chain(ensureFlags(activeId), (s) => new Set(s));
  }

  // ---- unlocks --------------------------------------------------------
  const plural = (n, noun) => n + " " + noun + (n === 1 ? "" : "s");
  function unlockReason(def) {
    const parts = [];
    if (def.decode) {
      let s = "master " + plural(def.decode.count, "letter-sound");
      if (def.decode.units) s += " from units " + def.decode.units.join("-");
      parts.push(s);
    }
    if (def.encode) parts.push("spell " + plural(def.encode.count, "letter-sound") + " correctly");
    if (def.rules) parts.push("learn " + plural(def.rules.count, "spelling rule"));
    if (def.tasksDone && def.tasksDone.length) parts.push("finish " + def.tasksDone.join(" and "));
    if (!parts.length) return null;
    const line = parts.join(" and ") + " to unlock";
    return line.charAt(0).toUpperCase() + line.slice(1);
  }
  function isUnlocked(taskId) {
    requireInit();
    const def = UNLOCKS[taskId] || {};
    return chain(mastery(), (records) =>
      chain(getFlags(), (flags) => {
        const ok = M().evalUnlock(def, {
          records: records, now: Date.now(), seq: activeSeq(), flags: flags,
        });
        return { ok: !!ok, reason: ok ? null : unlockReason(def) };
      }));
  }

  // ---- export / import -------------------------------------------------
  function exportJson() {
    const pid = requireActive();
    return chain(ensureMastery(pid), (m) =>
      chain(adapter.attemptsFor(pid, Infinity), (rows) =>
        chain(ensureFlags(pid), (flags) => ({
          version: 1,
          exportedTs: Date.now(),
          profile: Object.assign({}, profiles[pid]),
          mastery: Object.assign({}, m),
          attempts: rows.slice().reverse(), // oldest -> newest
          flags: Array.from(flags),
        }))));
  }

  // Accepts an exportJson() payload; creates the profile (fresh id if the
  // imported one clashes with an existing profile) and replaces its
  // mastery, attempts and flags. Returns the stored profile.
  function importJson(obj) {
    requireInit();
    if (!obj || obj.version !== 1 || !obj.profile || typeof obj.profile !== "object") {
      throw new Error("PhonicsTracker: not a phonics tracker export (expected version 1)");
    }
    const src = obj.profile;
    const id = src.id && !profiles[src.id] ? String(src.id) : genId();
    const p = Object.assign({}, src, { id: id });
    const entries = Object.entries(obj.mastery || {});
    const rows = Array.isArray(obj.attempts) ? obj.attempts : [];
    const flags = Array.isArray(obj.flags) ? obj.flags.slice() : [];
    profiles[id] = p;
    return chain(steps([
      () => adapter.profilePut(Object.assign({}, p)),
      () => adapter.masteryDeleteAll(id),
      () => each(entries, (e) => adapter.masteryPut(id, e[0], Object.assign({}, e[1]))),
      () => adapter.attemptsDeleteAll(id),
      () => each(rows, (a) => adapter.attemptAdd(Object.assign({}, a, { profileId: id }))),
      () => adapter.metaPut(flagsKey(id), flags),
    ]), () => {
      const m = {};
      for (const e of entries) m[e[0]] = Object.assign({}, e[1]);
      masteryCache[id] = m;
      flagsCache[id] = new Set(flags);
      return Object.assign({}, p);
    });
  }

  // ---- public api --------------------------------------------------------
  const api = {
    init: init,
    adapterKind: () => (adapter ? adapter.kind : null),
    profilesList: profilesList,
    profileCreate: profileCreate,
    profileUpdate: profileUpdate,
    profileRemove: profileRemove,
    setActiveProfile: setActiveProfile,
    activeProfile: activeProfile,
    record: record,
    mastery: mastery,
    knownGpcSet: knownGpcSet,
    attempts: attempts,
    setFlag: setFlag,
    getFlags: getFlags,
    isUnlocked: isUnlocked,
    exportJson: exportJson,
    importJson: importJson,
    UNLOCKS: UNLOCKS,
  };

  if (typeof window !== "undefined") window.PhonicsTracker = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
