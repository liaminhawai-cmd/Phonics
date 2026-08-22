// ============================================================
// js/views/report.js — the Teacher Report page.
//
// The strengths/weaknesses view from docs/ARCHITECTURE.md §8:
// the two mastery heatmaps (grapheme-first and phoneme-first —
// the same dual view the sequences have), a rule-application
// chart, recent attempts, and an auto-written plain-prose
// summary a teacher can print or read with a parent.
//
// Split like js/views/explorer.js:
//   PhonicsReportModel — pure, DOM-free helpers (key parsing,
//     totals, the summary paragraph). Testable from Node.
//   the IIFE below     — DOM wiring over PhonicsBank /
//     PhonicsTracker / PhonicsMastery / PhonicsAudio.
// ============================================================

window.PhonicsReportModel = (() => {
  // Same pastel fallback as the explorer, for sequences without
  // printed unit colours.
  const FALLBACK_PALETTE = [
    "#cfe0f5", "#d4e6c5", "#f3cbc4", "#dcd6ec", "#fbecc2",
    "#d6e5ec", "#f5c9df", "#e3ddc9", "#c9e8df", "#ece0f7",
  ];

  // Chip half colours per mastery state (kept in sync with the
  // --st-* custom properties in report.html).
  const STATE_COLOURS = {
    fresh: "#e7e2d6",
    learning: "#f3d488",
    mastered: "#a9d8b0",
    overdue: "#aecbeb",
  };

  const STATE_WORDS = {
    fresh: "not started",
    learning: "developing",
    mastered: "secure",
    overdue: "due for review",
  };

  // Mastery keys: "<gpcId>|decode", "<gpcId>|encode", "rule:<id>",
  // "skill:<id>", "morph:<id>", "letter:<letter>|<style>".
  function classifyKey(key) {
    const k = String(key || "");
    if (k.startsWith("rule:")) return { kind: "rule", id: k.slice(5) };
    if (k.startsWith("skill:")) return { kind: "skill", id: k.slice(6) };
    if (k.startsWith("morph:")) return { kind: "morph", id: k.slice(6) };
    if (k.startsWith("letter:")) return { kind: "letter", id: k.slice(7).split("|")[0] };
    const i = k.lastIndexOf("|");
    if (i > 0) {
      const dir = k.slice(i + 1);
      if (dir === "decode" || dir === "encode") {
        return { kind: "gpc", gpcId: k.slice(0, i), direction: dir };
      }
    }
    return { kind: "other", id: k };
  }

  const dirWord = (d) => (d === "decode" ? "reading" : "spelling");

  // Both halves of one chip: decode (left) and encode (right).
  function chipStates(records, gpcId, now, M) {
    const out = {};
    for (const dir of ["decode", "encode"]) {
      const rec = records[gpcId + "|" + dir];
      out[dir] = rec
        ? { state: M.state(rec, now), acc: M.rollingAccuracy(rec),
            attempts: rec.attempts, lastTs: rec.lastTs }
        : { state: "fresh", acc: null, attempts: 0, lastTs: null };
    }
    return out;
  }

  // Overview totals. Attempt total is the sum over mastery records —
  // every tracker.record() adds one attempt row AND bumps one record,
  // so the numbers agree without loading the full attempt log.
  function overviewTotals(records, now, M) {
    let attempts = 0, masteredDecode = 0, masteredEncode = 0;
    const gpcs = new Set();
    for (const rec of Object.values(records || {})) {
      attempts += rec.attempts || 0;
      const k = classifyKey(rec.key);
      if (k.kind !== "gpc") continue;
      gpcs.add(k.gpcId);
      if (M.state(rec, now) === "mastered") {
        if (k.direction === "decode") masteredDecode += 1;
        else masteredEncode += 1;
      }
    }
    return { attempts, gpcTouched: gpcs.size, masteredDecode, masteredEncode };
  }

  // Mastered GPCs grouped by gpc id (decode+encode folded together),
  // strongest first: [{ gpcId, dirs: ["decode","encode"], strength }].
  function masteredGroups(records, now, M) {
    const byGpc = {};
    for (const rec of Object.values(records || {})) {
      const k = classifyKey(rec.key);
      if (k.kind !== "gpc") continue;
      if (M.state(rec, now) !== "mastered") continue;
      const g = byGpc[k.gpcId] || (byGpc[k.gpcId] = { gpcId: k.gpcId, dirs: [], strength: 0 });
      g.dirs.push(k.direction);
      g.strength = Math.max(g.strength, rec.strength || 0);
    }
    return Object.values(byGpc).sort((a, b) =>
      (b.dirs.length - a.dirs.length) || (b.strength - a.strength));
  }

  // Weakest still-learning GPC keys, weakest first:
  // [{ gpcId, direction, acc, strength, attempts }].
  function weakestLearning(records, now, M) {
    const out = [];
    for (const rec of Object.values(records || {})) {
      const k = classifyKey(rec.key);
      if (k.kind !== "gpc") continue;
      if (M.state(rec, now) !== "learning") continue;
      out.push({ gpcId: k.gpcId, direction: k.direction,
                 acc: M.rollingAccuracy(rec), strength: rec.strength || 0,
                 attempts: rec.attempts || 0 });
    }
    return out.sort((a, b) => (a.acc - b.acc) || (a.strength - b.strength));
  }

  // rule:<id> records whose rolling accuracy sits below `threshold`.
  function rulesBelow(records, threshold, M) {
    const out = [];
    for (const rec of Object.values(records || {})) {
      const k = classifyKey(rec.key);
      if (k.kind !== "rule" || !rec.attempts) continue;
      const acc = M.rollingAccuracy(rec);
      if (acc < threshold) out.push({ id: k.id, acc, attempts: rec.attempts });
    }
    return out.sort((a, b) => a.acc - b.acc);
  }

  // Counting-skill states; null where the skill has never been tried.
  function skillStates(records, now, M) {
    const rec = (id) => (records || {})["skill:" + id];
    const st = (id) => (rec(id) ? M.state(rec(id), now) : null);
    return { syllables: st("count-syllables"), phonemes: st("count-phonemes") };
  }

  function listJoin(items) {
    const a = (items || []).filter(Boolean);
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  // The auto-written strengths/weaknesses paragraph: a template over
  // the data, plain and honest. Labels arrive pre-resolved so this
  // stays free of any bank/rules lookups.
  function summaryText(c) {
    const t = c.totals;
    if (!t || !t.attempts) return "";
    const s = [];
    s.push(c.name + " has logged " + t.attempts + " attempt" + (t.attempts === 1 ? "" : "s") +
           " across " + t.gpcTouched + " letter-sound correspondence" + (t.gpcTouched === 1 ? "" : "s") +
           " in " + c.programName + ".");
    if (t.masteredDecode || t.masteredEncode) {
      s.push(t.masteredDecode + (t.masteredDecode === 1 ? " is" : " are") +
             " mastered for reading and " + t.masteredEncode + " for spelling.");
    } else {
      s.push("Nothing is fully mastered yet — that is normal early on.");
    }
    if (c.strongestLabels && c.strongestLabels.length) {
      s.push("Strongest: " + listJoin(c.strongestLabels) + ".");
    }
    if (c.weakestLabels && c.weakestLabels.length) {
      s.push("Needs the most practice: " + listJoin(c.weakestLabels) + ".");
    }
    if (c.weakRuleNames && c.weakRuleNames.length) {
      s.push("Spelling rules under 60% recent accuracy: " + listJoin(c.weakRuleNames) + ".");
    }
    if (c.skills && (c.skills.syllables || c.skills.phonemes)) {
      s.push("Syllable counting is " + (STATE_WORDS[c.skills.syllables] || "not started") +
             "; sound counting is " + (STATE_WORDS[c.skills.phonemes] || "not started") + ".");
    } else {
      s.push("Sound and syllable counting haven't been tried yet.");
    }
    return s.join(" ");
  }

  // Readable text colour (ink or white) on a hex background.
  function textColourFor(hex) {
    const c = (hex || "#cccccc").replace("#", "");
    const full = c.length === 3 ? c.split("").map((ch) => ch + ch).join("") : c;
    const r = parseInt(full.substring(0, 2), 16) || 0;
    const g = parseInt(full.substring(2, 4), 16) || 0;
    const b = parseInt(full.substring(4, 6), 16) || 0;
    return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#1f1f1f" : "#ffffff";
  }

  // Root-level mouth videos are <Capitalised grapheme>.mp4.
  function mp4StemFor(grapheme) {
    if (!grapheme) return null;
    return grapheme.charAt(0).toUpperCase() + grapheme.slice(1);
  }

  // "just now" / "20 min ago" / "3 h ago" / "yesterday" / "5 days ago" / date.
  function relTime(ts, now) {
    if (ts == null) return "never";
    const d = Math.max(0, (now || Date.now()) - ts);
    const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
    if (d < MIN) return "just now";
    if (d < HOUR) return Math.round(d / MIN) + " min ago";
    if (d < DAY) return Math.round(d / HOUR) + " h ago";
    if (d < 2 * DAY) return "yesterday";
    if (d < 30 * DAY) return Math.round(d / DAY) + " days ago";
    return new Date(ts).toLocaleDateString();
  }

  return {
    FALLBACK_PALETTE, STATE_COLOURS, STATE_WORDS,
    classifyKey, dirWord, chipStates, overviewTotals,
    masteredGroups, weakestLearning, rulesBelow, skillStates,
    listJoin, summaryText, textColourFor, mp4StemFor, relTime,
  };
})();

// ============================================================
// DOM wiring — browser only; harmless to load in headless Node.
// ============================================================
if (typeof document !== "undefined") {
  (function () {
    const M = window.PhonicsReportModel;

    const ACCENT_NAMES = { au: "Australian", uk: "British", us: "American" };
    const FACES = ["🦘", "🐨", "🦜", "🐧", "🦎", "🐠", "🐢", "🦋"];
    const TASK_NAMES = {
      t1: "Flash cards", t2: "Sound to spelling", t3: "Sound counting",
      t4: "Listen & write", t5: "Grapheme toggle", t6: "Word builder",
      t7: "Decoding", t8: "Word writing", t8cvc: "CVC writing", t9: "Handwriting",
      t10: "Morphemes", t11: "Sound to letters",
    };
    const SKILL_NAMES = {
      "count-syllables": "Counting syllables",
      "count-phonemes": "Counting sounds",
    };

    const els = {};
    let rulesById = {};       // ruleId -> rule record from data/rules/rules.json
    let masteryRecords = {};  // active profile's { key: rec }
    let recentAttempts = [];  // newest first, last 30
    let now = Date.now();
    let openChipId = null;    // gpc id whose popover is showing
    let toastTimer = null;

    const q = (id) => document.getElementById(id);
    const Mst = () => window.PhonicsMastery;

    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[ch]));
    }

    function toast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
    }

    function setStatus(kind, html) {
      els.status.hidden = kind === "hidden";
      els.status.className = "status-box" + (kind === "error" ? " status-error" : "");
      if (kind !== "hidden") els.status.innerHTML = html;
    }

    function gpcDisplay(gpcId) {
      const g = PhonicsBank.gpc(gpcId);
      return g ? (g.display || g.grapheme) : gpcId;
    }

    function ruleName(ruleId) {
      const r = rulesById[ruleId];
      return r ? r.name : ruleId.replace(/_/g, " ");
    }

    function keyLabel(key) {
      const k = M.classifyKey(key);
      if (k.kind === "gpc") return gpcDisplay(k.gpcId) + " · " + M.dirWord(k.direction);
      if (k.kind === "rule") return "Rule: " + ruleName(k.id);
      if (k.kind === "skill") return SKILL_NAMES[k.id] || ("Skill: " + k.id);
      if (k.kind === "morph") return "Morpheme: " + k.id;
      if (k.kind === "letter") return "Handwriting: " + k.id;
      return key;
    }

    const pct = (x) => Math.round((x || 0) * 100);

    // ---- profile picker (same big cards as the practice page) ------
    function showPicker() {
      closeChipPop();
      els.header.hidden = true;
      els.main.hidden = true;
      els.picker.hidden = false;
      els.nlForm.hidden = true;
      let profiles = [];
      try { profiles = PhonicsTracker.profilesList() || []; } catch (e) { profiles = []; }
      els.pickerNote.textContent = profiles.length
        ? "Whose report would you like to see?"
        : "No learners yet. Add one here, or head to the practice page — profiles made there show up here too.";
      const cards = profiles.map((p, i) => `
        <button type="button" class="profile-card" data-profile="${escapeHtml(p.id)}">
          <span class="p-emoji">${FACES[i % FACES.length]}</span>
          <span class="p-name">${escapeHtml(p.name || "Learner")}</span>
          <span class="p-accent">${escapeHtml(ACCENT_NAMES[p.accent] || p.accent || "")}</span>
        </button>`);
      cards.push(`
        <button type="button" class="profile-card new" data-role="new-learner">
          <span class="p-emoji">＋</span>
          <span class="p-name">New learner</span>
        </button>`);
      els.profileGrid.innerHTML = cards.join("");
    }

    async function chooseProfile(id) {
      try { PhonicsTracker.setActiveProfile(id); }
      catch (e) { toast("Couldn't open that profile."); return; }
      await openReport();
    }

    // ---- data refresh + full render --------------------------------
    async function openReport() {
      const p = PhonicsTracker.activeProfile();
      if (!p) { showPicker(); return; }
      if (p.accent) PhonicsBank.setAccent(p.accent);
      els.picker.hidden = true;
      setStatus("loading", "Reading " + escapeHtml(p.name || "this learner") + "'s records&hellip;");
      try {
        now = Date.now();
        masteryRecords = (await PhonicsTracker.mastery()) || {};
        recentAttempts = (await PhonicsTracker.attempts({ limit: 30 })) || [];
      } catch (e) {
        setStatus("error", "Couldn't read the mastery records.<br><small>" +
          escapeHtml(e.message || String(e)) + "</small>");
        return;
      }
      setStatus("hidden");
      els.header.hidden = false;
      els.main.hidden = false;
      renderAll(p);
    }

    function renderAll(p) {
      const profile = p || PhonicsTracker.activeProfile();
      if (!profile) return;
      closeChipPop();
      updateHeader(profile);
      renderOverview(profile);
      renderGraphemeGrid();
      renderSoundGrid();
      renderRules();
      renderRecent();
      syncDataControls(profile);
      els.printNote.textContent = "Printed " + new Date().toLocaleDateString("en-AU") +
        " — Aussie Phonics teacher report for " + (profile.name || "Learner") + ".";
    }

    function updateHeader(p) {
      els.learnerChip.textContent = "🙂 " + (p.name || "Learner");
      const seq = PhonicsBank.seq();
      els.headerProgram.textContent = seq ? seq.name : "";
    }

    // ---- 1. overview -----------------------------------------------
    function renderOverview(p) {
      const totals = M.overviewTotals(masteryRecords, now, Mst());
      const seq = PhonicsBank.seq();
      const programName = seq ? seq.name : "the program";

      const strongestLabels = M.masteredGroups(masteryRecords, now, Mst()).slice(0, 3).map((g) => {
        const both = g.dirs.includes("decode") && g.dirs.includes("encode");
        return gpcDisplay(g.gpcId) + " (" + (both ? "reading and spelling" : M.dirWord(g.dirs[0])) + ")";
      });
      const weakestLabels = M.weakestLearning(masteryRecords, now, Mst()).slice(0, 3).map((w) =>
        gpcDisplay(w.gpcId) + " for " + M.dirWord(w.direction) + " (" + pct(w.acc) + "% recently)");
      const weakRuleNames = M.rulesBelow(masteryRecords, 0.6, Mst()).map((r) => ruleName(r.id));
      const skills = M.skillStates(masteryRecords, now, Mst());

      const text = M.summaryText({
        name: p.name || "This learner", programName, totals,
        strongestLabels, weakestLabels, weakRuleNames, skills,
      });

      const totHtml = `
        <div class="totals">
          <div class="tot"><b>${totals.attempts}</b><span>attempts</span></div>
          <div class="tot"><b>${totals.gpcTouched}</b><span>GPCs touched</span></div>
          <div class="tot"><b>${totals.masteredDecode}</b><span>mastered reading</span></div>
          <div class="tot"><b>${totals.masteredEncode}</b><span>mastered spelling</span></div>
        </div>`;

      const body = totals.attempts
        ? `<p class="ov-summary">${escapeHtml(text)}</p>`
        : `<div class="empty-card">🌱 No data yet — do some practice!<br>
             Open the <a href="practice.html">practice page</a> and this report will fill itself in.</div>`;

      els.overviewCard.innerHTML = `
        <h2>Overview</h2>
        <div class="ov-meta">
          <span>Learner: <b>${escapeHtml(p.name || "Learner")}</b></span>
          <span>Accent: <b>${escapeHtml(ACCENT_NAMES[p.accent] || p.accent || "—")}</b></span>
          <span>Program: <b>${escapeHtml(programName)}</b></span>
        </div>
        ${totHtml}
        ${body}`;
    }

    // ---- split chips -----------------------------------------------
    function chipHtml(gpcId, opts) {
      const g = PhonicsBank.gpc(gpcId);
      if (!g) return "";
      const st = M.chipStates(masteryRecords, gpcId, now, Mst());
      const l = M.STATE_COLOURS[st.decode.state] || M.STATE_COLOURS.fresh;
      const r = M.STATE_COLOURS[st.encode.state] || M.STATE_COLOURS.fresh;
      const title = (g.display || g.grapheme) + " — reading: " + M.STATE_WORDS[st.decode.state] +
        ", spelling: " + M.STATE_WORDS[st.encode.state];
      const unitTag = opts && opts.unitN != null
        ? `<span class="gg-u">unit ${opts.unitN}</span>`
        : (opts && opts.dupHint
          ? `<span class="gg-u gg-u-dup">${escapeHtml(opts.dupHint)}</span>` : "");
      return `<button type="button" class="gg-chip" data-role="gg-chip"
        data-gpc="${escapeHtml(gpcId)}" data-grapheme="${escapeHtml(g.grapheme)}"
        style="--chip-l:${l};--chip-r:${r}" title="${escapeHtml(title)}">
        <span class="gg-g">${escapeHtml(g.display || g.grapheme)}</span>${unitTag}
      </button>`;
    }

    function legendHtml() {
      const item = (colour, label) =>
        `<span class="legend-item"><i style="background:${colour}"></i> ${label}</span>`;
      return `<div class="legend">
        <span class="legend-note">Each tile is split — <b>left half = reading</b>, <b>right half = spelling</b>.</span>
        ${item(M.STATE_COLOURS.fresh, "not practised")}
        ${item(M.STATE_COLOURS.learning, "learning")}
        ${item(M.STATE_COLOURS.mastered, "mastered")}
        ${item(M.STATE_COLOURS.overdue, "due for review")}
      </div>`;
    }

    // ---- 2. grapheme grid (one row per unit of the active sequence) --
    function renderGraphemeGrid() {
      const seq = PhonicsBank.seq();
      const units = (seq && seq.units) || [];
      const rows = units.map((u, i) => {
        const colour = u.colour || (PhonicsBank.beltColour
          ? PhonicsBank.beltColour(i).bg
          : M.FALLBACK_PALETTE[i % M.FALLBACK_PALETTE.length]);
        const ids = u.teaches || [];
        // Same grapheme can teach >1 phoneme in one unit (a.a/a.ay/a.ar all
        // look like bare "a") — on paper those tiles are indistinguishable,
        // so a repeated display text earns a tiny phoneme hint (print only).
        const dispCounts = {};
        ids.forEach((gid) => {
          const g = PhonicsBank.gpc(gid);
          if (!g) return;
          const disp = g.display || g.grapheme;
          dispCounts[disp] = (dispCounts[disp] || 0) + 1;
        });
        const chips = ids.map((gid) => {
          const g = PhonicsBank.gpc(gid);
          const disp = g && (g.display || g.grapheme);
          let dupHint = null;
          if (g && dispCounts[disp] > 1) {
            const firstP = Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes;
            try { dupHint = PhonicsBank.phonemeLabel(firstP); } catch (e) { dupHint = null; }
          }
          return chipHtml(gid, dupHint ? { dupHint } : null);
        }).join("");
        return `<article class="rg-unit">
          <div class="rg-unit-bar" style="background:${colour};color:${M.textColourFor(colour)}">
            ${escapeHtml(u.label || ("Unit " + u.n))}
          </div>
          <div class="rg-unit-body">
            <div class="chip-row">${chips || '<span class="empty-note">No new graphemes in this unit.</span>'}</div>
          </div>
        </article>`;
      }).join("");
      els.graphemeCard.innerHTML = `
        <h2>Letters &amp; spellings — ${escapeHtml(seq ? seq.name : "")}</h2>
        ${legendHtml()}
        ${rows || '<p class="empty-note">This program has no units.</p>'}`;
    }

    // ---- 3. sounds grid (phoneme-first, same split chips) -----------
    function renderSoundGrid() {
      const rows = PhonicsBank.phonemeView() || [];
      const html = rows.map((row) => {
        const ipaBadge = row.ipa ? `<span class="ipa-badge">/${escapeHtml(row.ipa)}/</span>` : "";
        const speaker = row.type === "composite" ? "" :
          `<button type="button" class="speaker-btn" data-role="play-phoneme"
             data-phoneme="${escapeHtml(row.phoneme)}" aria-label="Play sound">🔊</button>`;
        const chips = (row.spellings || [])
          .map((sp) => chipHtml(sp.gpc.id, { unitN: sp.unit_n })).join("");
        return `<div class="ph-row" data-type="${escapeHtml(row.type || "unit")}">
          <div class="ph-head">
            <span class="ph-label">${escapeHtml(row.label)}</span>
            ${ipaBadge}${speaker}
          </div>
          <div class="chip-row">${chips}</div>
        </div>`;
      }).join("");
      els.soundsCard.innerHTML = `
        <h2>Sounds &amp; their spellings</h2>
        ${legendHtml()}
        ${html || '<p class="empty-note">No sounds in this program yet.</p>'}`;
    }

    // ---- 4. rules ---------------------------------------------------
    function renderRules() {
      const rows = [];
      for (const rec of Object.values(masteryRecords)) {
        const k = M.classifyKey(rec.key);
        if (k.kind !== "rule") continue;
        rows.push({ id: k.id, acc: Mst().rollingAccuracy(rec), attempts: rec.attempts || 0 });
      }
      rows.sort((a, b) => a.acc - b.acc);
      const body = rows.length ? rows.map((r) => {
        const p = pct(r.acc);
        const colour = p >= 90 ? "var(--st-mastered)" : p >= 60 ? "var(--st-learning)" : "#e4a8a8";
        return `<div class="rule-row">
          <span class="rule-name">${escapeHtml(ruleName(r.id))}</span>
          <div class="bar-track" role="img" aria-label="${p}% recent accuracy">
            <div class="bar-fill" style="width:${p}%;background:${colour}"></div>
          </div>
          <span class="rule-stat">${p}% · ${r.attempts} attempt${r.attempts === 1 ? "" : "s"}</span>
        </div>`;
      }).join("")
        : '<p class="empty-note">No spelling-rule practice recorded yet.</p>';
      els.rulesCard.innerHTML = `<h2>Spelling rules</h2>${body}`;
    }

    // ---- 5. recent work ---------------------------------------------
    function renderRecent() {
      const body = recentAttempts.length ? `
        <div class="attempts-wrap"><table class="attempts-table">
          <thead><tr><th>When</th><th>Activity</th><th>Focus</th><th>Result</th></tr></thead>
          <tbody>${recentAttempts.map((a) => `
            <tr>
              <td>${escapeHtml(M.relTime(a.ts, now))}</td>
              <td>${escapeHtml(TASK_NAMES[a.taskType] || a.taskType || "—")}</td>
              <td class="att-key">${escapeHtml(keyLabel(a.key))}</td>
              <td>${a.correct ? '<span class="att-good">✓ right</span>' : '<span class="att-bad">✗ not yet</span>'}</td>
            </tr>`).join("")}
          </tbody>
        </table></div>`
        : '<p class="empty-note">No attempts recorded yet.</p>';
      els.recentCard.innerHTML = `<h2>Recent work — last ${recentAttempts.length || 30} attempts</h2>${body}`;
    }

    // ---- 6. data card controls --------------------------------------
    function syncDataControls(p) {
      const opts = (PhonicsBank.sequences() || []).filter((s) => s.units > 0);
      els.programSelect.innerHTML = opts.map((s) =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name + (s.region ? " (" + s.region + ")" : ""))}</option>`
      ).join("");
      const seq = PhonicsBank.seq();
      if (seq) els.programSelect.value = seq.id;
      els.accentSelect.value = p.accent || PhonicsBank.accent || "au";
    }

    async function onExport() {
      let payload;
      try { payload = await PhonicsTracker.exportJson(); }
      catch (e) { toast("Export failed: " + (e.message || e)); return; }
      const slug = String((payload.profile && payload.profile.name) || "learner")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "learner";
      const fname = "phonics-" + slug + "-" + new Date().toISOString().slice(0, 10) + ".json";
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      els.exportBtn.dataset.lastUrl = url; // handy for tests; blob revoked later
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast("Downloaded " + fname);
    }

    async function onImportFile(file) {
      if (!file) return;
      try {
        const text = await file.text();
        const obj = JSON.parse(text);
        const p = await PhonicsTracker.importJson(obj);
        PhonicsTracker.setActiveProfile(p.id);
        toast("Imported " + (p.name || "learner"));
        await openReport();
      } catch (e) {
        toast("Couldn't import that file — is it a phonics export? (" + (e.message || e) + ")");
      } finally {
        els.importFile.value = "";
      }
    }

    // ---- chip popover ------------------------------------------------
    function accLine(half) {
      if (!half.attempts) return "not practised";
      return pct(half.acc) + "% · " + half.attempts + " tr" + (half.attempts === 1 ? "y" : "ies");
    }

    function openChipPop(chip) {
      const gpcId = chip.dataset.gpc;
      if (openChipId === gpcId && !els.chipPop.hidden) { closeChipPop(); return; }
      const g = PhonicsBank.gpc(gpcId);
      if (!g) return;
      const st = M.chipStates(masteryRecords, gpcId, now, Mst());
      const last = Math.max(st.decode.lastTs || 0, st.encode.lastTs || 0) || null;
      const firstP = Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes;
      els.chipPop.innerHTML = `
        <div class="pop-head">
          <span class="pop-g">${escapeHtml(g.display || g.grapheme)}</span>
          <span class="pop-sound">${escapeHtml(PhonicsBank.phonemeLabel(firstP))}</span>
          <button type="button" class="speaker-btn" data-role="pop-play"
            data-gpc="${escapeHtml(gpcId)}" data-stem="${escapeHtml(M.mp4StemFor(g.grapheme) || "")}"
            aria-label="Play sound">🔊</button>
        </div>
        <div class="pop-row"><span>Reading (decode)</span><b>${escapeHtml(accLine(st.decode))}</b></div>
        <div class="pop-row"><span>Spelling (encode)</span><b>${escapeHtml(accLine(st.encode))}</b></div>
        <div class="pop-row"><span>Last seen</span><b>${escapeHtml(last ? M.relTime(last, now) : "never")}</b></div>`;
      els.chipPop.hidden = false;
      openChipId = gpcId;
      const rect = chip.getBoundingClientRect();
      const popW = els.chipPop.offsetWidth || 250;
      const maxLeft = document.documentElement.clientWidth - popW - 8;
      const left = Math.max(8, Math.min(rect.left + window.scrollX, maxLeft + window.scrollX));
      els.chipPop.style.left = left + "px";
      els.chipPop.style.top = (rect.bottom + window.scrollY + 8) + "px";
    }

    function closeChipPop() {
      els.chipPop.hidden = true;
      openChipId = null;
    }

    // ---- events -------------------------------------------------------
    function wireEvents() {
      els.profileGrid.addEventListener("click", (e) => {
        const newBtn = e.target.closest('[data-role="new-learner"]');
        if (newBtn) { els.nlForm.hidden = false; els.nlName.focus(); return; }
        const card = e.target.closest("[data-profile]");
        if (card) chooseProfile(card.dataset.profile);
      });

      els.nlForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = els.nlName.value.trim();
        if (!name) { els.nlName.focus(); return; }
        try {
          const p = await PhonicsTracker.profileCreate({ name, accent: els.nlAccent.value });
          PhonicsTracker.setActiveProfile(p.id);
          els.nlName.value = "";
          await openReport();
        } catch (err) { toast("Couldn't create that learner."); }
      });
      els.nlForm.querySelector('[data-role="nl-cancel"]').addEventListener("click", () => {
        els.nlForm.hidden = true;
      });

      els.learnerChip.addEventListener("click", () => showPicker());
      els.printBtn.addEventListener("click", () => window.print());

      els.main.addEventListener("click", (e) => {
        const chip = e.target.closest('[data-role="gg-chip"]');
        if (chip) { e.stopPropagation(); openChipPop(chip); return; }
        const speaker = e.target.closest('[data-role="play-phoneme"]');
        if (speaker) { PhonicsAudio.playPhoneme(speaker.dataset.phoneme); return; }
      });

      els.chipPop.addEventListener("click", (e) => {
        e.stopPropagation();
        const play = e.target.closest('[data-role="pop-play"]');
        if (play) PhonicsAudio.playGpc(play.dataset.gpc, { mp4Stem: play.dataset.stem || null });
      });
      document.addEventListener("click", (e) => {
        if (els.chipPop.hidden) return;
        if (!e.target.closest(".chip-pop") && !e.target.closest('[data-role="gg-chip"]')) closeChipPop();
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeChipPop(); });

      els.exportBtn.addEventListener("click", onExport);
      els.importFile.addEventListener("change", () => onImportFile(els.importFile.files[0]));

      els.accentSelect.addEventListener("change", () => {
        const p = PhonicsTracker.activeProfile();
        if (!p) return;
        const a = els.accentSelect.value;
        try { PhonicsTracker.profileUpdate(p.id, { accent: a }); } catch (e) {}
        PhonicsBank.setAccent(a);
        renderAll();
        toast("Accent set to " + (ACCENT_NAMES[a] || a));
      });

      els.programSelect.addEventListener("change", async () => {
        const id = els.programSelect.value;
        try {
          await PhonicsBank.setSequence(id);
          const p = PhonicsTracker.activeProfile();
          if (p) { try { PhonicsTracker.profileUpdate(p.id, { activeSequence: id }); } catch (e) {} }
          renderAll();
          toast("Showing " + (PhonicsBank.seq().name || id));
        } catch (e) {
          toast("Couldn't load that program.");
          const seq = PhonicsBank.seq();
          if (seq) els.programSelect.value = seq.id;
        }
      });
    }

    // ---- boot ---------------------------------------------------------
    async function init() {
      ["statusBox", "rpHeader", "reportMain", "screenPicker", "pickerNote", "profileGrid",
       "nlForm", "nlName", "nlAccent", "learnerChip", "headerProgram", "printBtn", "printNote",
       "overviewCard", "graphemeCard", "soundsCard", "rulesCard", "recentCard",
       "exportBtn", "importFile", "accentSelect", "programSelect", "chipPop", "toastRoot"]
        .forEach((id) => { els[id] = q(id); });
      // friendlier aliases
      els.status = els.statusBox; els.header = els.rpHeader; els.main = els.reportMain;
      els.picker = els.screenPicker; els.toast = els.toastRoot;

      setStatus("loading", "Loading the sound bank and learner records&hellip;");
      try {
        await PhonicsBank.load();
        await PhonicsTracker.init();
      } catch (err) {
        setStatus("error", "Couldn't load the phonics data. Try refreshing the page.<br><small>" +
          escapeHtml(err.message || String(err)) + "</small>");
        return;
      }
      // Rule names are decoration — a failed fetch falls back to raw ids.
      try {
        const res = await fetch("data/rules/rules.json");
        if (res.ok) {
          const data = await res.json();
          for (const r of data.rules || []) rulesById[r.id] = r;
        }
      } catch (e) { /* names fall back to ids */ }

      wireEvents();
      setStatus("hidden");
      if (PhonicsTracker.activeProfile()) await openReport();
      else showPicker();
    }

    document.addEventListener("DOMContentLoaded", init);
  })();
}
