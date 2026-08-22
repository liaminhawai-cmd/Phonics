// ============================================================
// js/views/practice.js — the Student Practice page shell.
//
// The M2 heart of the app (docs/ARCHITECTURE.md §5-§7): picks a
// learner profile, shows the task menu built from whatever task
// modules registered themselves in window.PhonicsTasks, hosts a
// task, and provides the shared ctx every task mounts with —
// including the rule micro-lesson modal (§5 "mistake flow") and
// the friendly end-of-round summary card.
//
// Task modules are plain scripts loaded after this file; each one
// calls PhonicsTasks.register({id, title, subtitle, icon, order,
// unlockId, mount}). The page must boot even if some task files
// are missing, so every registry read is guarded.
// ============================================================

// Shared registry bootstrap — identical snippet lives at the top of
// every task file, so whichever loads first creates it.
window.PhonicsTasks = window.PhonicsTasks || {
  registry: {},
  register(def) { this.registry[def.id] = def; },
};

if (typeof document !== "undefined") {
  (function () {
    const els = {};
    let rules = null;          // parsed data/rules/rules.json
    let rulesIdx = null;       // PhonicsErrors.indexRules(rules)
    let activeTask = null;     // { def, handle } while a task is mounted
    let toastTimer = null;

    const q = (id) => document.getElementById(id);

    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[ch]));
    }

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // ---- screens --------------------------------------------------
    const SCREENS = ["screenProfiles", "screenMenu", "screenTask", "screenSummary"];
    function show(screenId) {
      for (const id of SCREENS) els[id].hidden = id !== screenId;
      els.prHeader.hidden = screenId === "screenProfiles";
    }

    function setStatus(kind, html) {
      els.statusBox.hidden = kind === "hidden";
      els.statusBox.className = "status-box" + (kind === "error" ? " status-error" : "");
      if (kind !== "hidden") els.statusBox.innerHTML = html;
    }

    // ---- toast ----------------------------------------------------
    function toast(msg) {
      els.toastRoot.textContent = String(msg == null ? "" : msg);
      els.toastRoot.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toastRoot.classList.remove("show"), 2400);
    }

    // ---- profiles (screen 1) --------------------------------------
    const ACCENT_NAMES = { au: "Aussie", uk: "British", us: "American" };
    const FACES = ["🦘", "🐨", "🦜", "🐧", "🦎", "🐠", "🐢", "🦋"];

    function renderProfiles() {
      let profiles = [];
      try { profiles = PhonicsTracker.profilesList() || []; } catch (e) { profiles = []; }
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
      try { PhonicsTracker.setActiveProfile(id); } catch (e) { toast("Couldn't open that profile."); return; }
      const p = (PhonicsTracker.activeProfile && PhonicsTracker.activeProfile()) || null;
      if (p && p.accent) PhonicsBank.setAccent(p.accent);
      updateHeader(p);
      await renderMenu();
      show("screenMenu");
    }

    function updateHeader(profile) {
      els.profileChip.textContent = "🙂 " + ((profile && profile.name) || "Learner");
      const seq = PhonicsBank.seq && PhonicsBank.seq();
      els.programName.textContent = seq ? (seq.name || seq.id || "") : "";
    }

    async function createLearner() {
      const name = els.nlName.value.trim();
      if (!name) { toast("Type a name first!"); els.nlName.focus(); return; }
      const accent = els.nlAccent.value || "au";
      let prof;
      try {
        prof = await PhonicsTracker.profileCreate({ name, accent });
      } catch (e) {
        toast("Couldn't save the new learner — try again.");
        return;
      }
      els.nlForm.hidden = true;
      els.nlName.value = "";
      renderProfiles();
      if (prof && prof.id != null) {
        await chooseProfile(prof.id);
      } else {
        // Contract says profileCreate returns the profile; be forgiving anyway.
        const match = (PhonicsTracker.profilesList() || []).find((p) => p.name === name);
        if (match) await chooseProfile(match.id);
      }
    }

    // ---- task menu (screen 2) --------------------------------------
    function taskDefs() {
      const reg = (window.PhonicsTasks && window.PhonicsTasks.registry) || {};
      return Object.values(reg)
        .filter((d) => d && d.id && typeof d.mount === "function")
        .sort((a, b) => (a.order || 99) - (b.order || 99) || String(a.id).localeCompare(String(b.id)));
    }

    async function renderMenu() {
      const defs = taskDefs();
      if (!defs.length) {
        els.taskGrid.innerHTML = `<p class="menu-empty">No activities are installed yet.<br>
          Check back soon — or head <a href="index.html">back to the trainer</a>.</p>`;
        return;
      }
      const cards = [];
      for (const def of defs) {
        let lockReason = null;
        if (def.unlockId) {
          try {
            const r = await PhonicsTracker.isUnlocked(def.unlockId);
            if (!r || !r.ok) lockReason = (r && r.reason) || "Locked for now — keep practising!";
          } catch (e) { lockReason = null; } // never brick the menu on a tracker hiccup
        }
        cards.push(`
          <button type="button" class="task-card" data-task="${escapeHtml(def.id)}" ${lockReason ? "disabled" : ""}>
            <span class="task-icon">${escapeHtml(def.icon || "⭐")}</span>
            <span class="task-meta">
              <span class="task-title">${escapeHtml(def.title || def.id)}</span>
              <span class="task-sub">${escapeHtml(def.subtitle || "")}</span>
              ${lockReason ? `<span class="task-lock">🔒 ${escapeHtml(lockReason)}</span>` : ""}
            </span>
          </button>`);
      }
      els.taskGrid.innerHTML = cards.join("");
    }

    // ---- task host (screen 3) ---------------------------------------
    async function openTask(id) {
      const def = taskDefs().find((d) => d.id === id);
      if (!def) { toast("That activity isn't available."); return; }
      els.taskTitleBar.textContent = (def.icon ? def.icon + " " : "") + (def.title || def.id);
      els.taskHost.innerHTML = "";
      show("screenTask");
      const ctx = buildCtx();
      try {
        const handle = await def.mount(els.taskHost, ctx);
        activeTask = { def, handle: handle || null };
      } catch (err) {
        activeTask = null;
        els.taskHost.innerHTML = `<div class="task-host-error">That activity had trouble starting.
          Try again in a moment.<br><small>${escapeHtml(err && err.message ? err.message : String(err))}</small></div>`;
      }
    }

    function teardownTask() {
      if (activeTask && activeTask.handle && typeof activeTask.handle.destroy === "function") {
        try { activeTask.handle.destroy(); } catch (e) { /* a dying task can't hurt us */ }
      }
      activeTask = null;
      try { PhonicsAudio.stop(); } catch (e) { /* ignore */ }
      els.taskHost.innerHTML = "";
    }

    async function backToMenu() {
      teardownTask();
      await renderMenu();
      show("screenMenu");
    }

    // ---- ctx for tasks (TASK MODULE CONTRACT) ------------------------
    function buildCtx() {
      return {
        bank: window.PhonicsBank,
        audio: window.PhonicsAudio,
        tracker: window.PhonicsTracker,
        errors: window.PhonicsErrors,
        mastery: window.PhonicsMastery,
        rules,
        rulesIdx,
        showRuleLesson,
        toast,
        exit(opts) {
          teardownTask();
          if (opts && opts.summary) {
            renderSummary(opts.summary);
            show("screenSummary");
          } else {
            renderMenu().then(() => show("screenMenu"));
          }
        },
      };
    }

    // ---- session summary ----------------------------------------------
    function renderSummary(summary) {
      const s = summary || {};
      const profile = (PhonicsTracker.activeProfile && PhonicsTracker.activeProfile()) || null;
      const name = profile && profile.name ? profile.name : "you";
      const correct = s.correct != null ? s.correct : 0;
      const total = s.total != null ? s.total : 0;
      const frac = total > 0 ? correct / total : 1;
      const emoji = frac >= 0.8 ? "🌟" : frac >= 0.5 ? "💪" : "🌱";
      const cheer = frac >= 0.8 ? "Superstar work" : frac >= 0.5 ? "Great practising" : "Good on you for having a go";
      const sounds = (s.sounds || []).slice(0, 14);
      els.summaryHolder.innerHTML = `
        <div class="summary-card">
          <div class="summary-emoji">${emoji}</div>
          <div class="summary-title">${cheer}, ${escapeHtml(name)}!</div>
          ${s.title ? `<div class="summary-note">${escapeHtml(s.title)}</div>` : ""}
          <div class="summary-score">${correct} out of ${total} right</div>
          ${s.note ? `<div class="summary-note">${escapeHtml(s.note)}</div>` : ""}
          ${sounds.length ? `
            <div class="sound-chips-label">Sounds practised</div>
            <div class="sound-chips">${sounds.map((x) => `<span class="sound-chip">${escapeHtml(x)}</span>`).join("")}</div>` : ""}
          <button type="button" class="pt-primary" data-role="summary-menu">Back to activities</button>
        </div>`;
    }

    // ---- rule micro-lesson modal (§5 mistake flow) ----------------------
    // showRuleLesson(ruleId) -> Promise that resolves when the overlay
    // closes, so tasks can `await` it between words.
    let modalState = null; // { rule, items, i, options, optIdx, checked, resolve }

    function showRuleLesson(ruleId) {
      return new Promise((resolve) => {
        const rule = rules && rules.rules ? rules.rules.find((r) => r.id === ruleId) : null;
        if (!rule) { resolve(); return; }
        if (modalState) { resolve(); return; } // one lesson at a time
        const items = (rule.toggle_sets || [])
          .filter((t) => t && t.word && PhonicsBank.gpc(t.target_gpc))
          .slice(0, 3);
        modalState = { rule, items, i: 0, options: [], optIdx: 0, checked: false, resolve };
        els.ruleModal.hidden = false;
        renderRuleItem();
      });
    }

    function closeRuleLesson() {
      if (!modalState) return;
      const resolve = modalState.resolve;
      modalState = null;
      els.ruleModal.hidden = true;
      els.ruleModal.innerHTML = "";
      try { PhonicsAudio.stop(); } catch (e) { /* ignore */ }
      resolve();
    }

    function renderRuleItem() {
      const st = modalState;
      if (!st) return;
      const rule = st.rule;
      const item = st.items[st.i] || null;

      let bodyHtml = "";
      if (item) {
        const targetGpc = PhonicsBank.gpc(item.target_gpc);
        const ids = [item.target_gpc].concat(item.distractors || []);
        st.options = shuffle(ids.map((id) => PhonicsBank.gpc(id)).filter(Boolean));
        st.optIdx = 0;
        st.checked = false;

        const word = item.word;
        const g = targetGpc.grapheme;
        let pre = word, post = "", inline = false;
        if (g.indexOf("_") === -1) {
          const at = word.indexOf(g);
          if (at >= 0) { pre = word.slice(0, at); post = word.slice(at + g.length); inline = true; }
        }
        const dots = st.items.map((_, k) => (k === st.i ? "●" : "○")).join(" ");
        bodyHtml = `
          <div class="rule-dots">${dots}</div>
          <button type="button" class="pt-bigplay" data-role="rule-play" aria-label="Play the word">🔊</button>
          <div class="rule-word">
            ${inline
              ? `<span>${escapeHtml(pre)}</span><button type="button" class="rule-slot" data-role="rule-slot"></button><span>${escapeHtml(post)}</span>`
              : `<span>${escapeHtml(word)}</span>&nbsp;<button type="button" class="rule-slot" data-role="rule-slot"></button>`}
          </div>
          <div class="rule-slot-hint">Tap the box to try each spelling</div>
          <div class="pt-feedback" data-role="rule-feedback"></div>
          <button type="button" class="pt-primary" data-role="rule-check">Check</button>`;
      } else {
        bodyHtml = `<button type="button" class="pt-primary" data-role="rule-continue">Got it!</button>`;
      }

      els.ruleModal.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-label="Spelling rule lesson">
          <button type="button" class="modal-close" data-role="rule-close" aria-label="Close">✕</button>
          <div class="rule-kicker">Spelling rule</div>
          <div class="rule-statement">${escapeHtml(rule.statement_kid || rule.name || rule.id)}</div>
          ${bodyHtml}
        </div>`;

      if (item) {
        updateRuleSlot();
        try { PhonicsAudio.playWord(item.word); } catch (e) { /* ignore */ }
      }
    }

    function updateRuleSlot() {
      const st = modalState;
      if (!st) return;
      const slot = els.ruleModal.querySelector('[data-role="rule-slot"]');
      if (!slot) return;
      const g = st.options[st.optIdx];
      slot.textContent = g ? (g.display || g.grapheme) : "?";
    }

    function onRuleCheck() {
      const st = modalState;
      if (!st || st.checked) return;
      const item = st.items[st.i];
      const chosen = st.options[st.optIdx];
      const slot = els.ruleModal.querySelector('[data-role="rule-slot"]');
      const fb = els.ruleModal.querySelector('[data-role="rule-feedback"]');
      const checkBtn = els.ruleModal.querySelector('[data-role="rule-check"]');
      if (!item || !chosen || !slot || !fb || !checkBtn) return;
      st.checked = true;
      const right = chosen.id === item.target_gpc;
      slot.classList.add(right ? "good" : "bad");
      if (right) {
        fb.className = "pt-feedback good";
        fb.textContent = "Yes! That's the one.";
      } else {
        const target = PhonicsBank.gpc(item.target_gpc);
        fb.className = "pt-feedback bad";
        fb.textContent = "Not this time — this word uses " + (target ? (target.display || target.grapheme) : "") + ".";
        slot.textContent = target ? (target.display || target.grapheme) : slot.textContent;
        slot.classList.remove("bad");
        slot.classList.add("good");
      }
      const last = st.i >= st.items.length - 1;
      checkBtn.dataset.role = "rule-continue";
      checkBtn.textContent = last ? "Done" : "Continue";
    }

    function onRuleContinue() {
      const st = modalState;
      if (!st) return;
      st.i += 1;
      if (st.i >= st.items.length) closeRuleLesson();
      else renderRuleItem();
    }

    // ---- events -----------------------------------------------------
    function wireEvents() {
      els.profileGrid.addEventListener("click", (e) => {
        const newBtn = e.target.closest('[data-role="new-learner"]');
        if (newBtn) { els.nlForm.hidden = false; els.nlName.focus(); return; }
        const card = e.target.closest("[data-profile]");
        if (card) chooseProfile(card.dataset.profile);
      });

      els.nlForm.addEventListener("submit", (e) => { e.preventDefault(); createLearner(); });
      els.nlForm.querySelector('[data-role="nl-cancel"]').addEventListener("click", () => {
        els.nlForm.hidden = true;
      });

      els.taskGrid.addEventListener("click", (e) => {
        const card = e.target.closest(".task-card[data-task]");
        if (card && !card.disabled) openTask(card.dataset.task);
      });

      els.taskBack.addEventListener("click", backToMenu);

      els.profileChip.addEventListener("click", () => {
        teardownTask();
        renderProfiles();
        show("screenProfiles");
      });

      els.summaryHolder.addEventListener("click", (e) => {
        if (e.target.closest('[data-role="summary-menu"]')) {
          renderMenu().then(() => show("screenMenu"));
        }
      });

      els.ruleModal.addEventListener("click", (e) => {
        if (e.target.closest('[data-role="rule-close"]')) { closeRuleLesson(); return; }
        if (e.target.closest('[data-role="rule-play"]')) {
          const st = modalState;
          const item = st && st.items[st.i];
          if (item) PhonicsAudio.playWord(item.word);
          return;
        }
        const slot = e.target.closest('[data-role="rule-slot"]');
        if (slot) {
          const st = modalState;
          if (st && !st.checked && st.options.length) {
            st.optIdx = (st.optIdx + 1) % st.options.length;
            updateRuleSlot();
          }
          return;
        }
        if (e.target.closest('[data-role="rule-check"]')) { onRuleCheck(); return; }
        if (e.target.closest('[data-role="rule-continue"]')) { onRuleContinue(); return; }
      });
    }

    // ---- boot -----------------------------------------------------
    async function boot() {
      for (const id of ["prHeader", "statusBox", "screenProfiles", "screenMenu", "screenTask",
        "screenSummary", "profileGrid", "nlForm", "nlName", "nlAccent", "taskGrid",
        "taskBack", "taskTitleBar", "taskHost", "summaryHolder", "profileChip",
        "programName", "ruleModal", "toastRoot"]) {
        els[id] = q(id);
      }

      setStatus("loading", "Getting everything ready&hellip;");
      try {
        if (!window.PhonicsBank) throw new Error("data module missing");
        await PhonicsBank.load();
        if (!window.PhonicsTracker) throw new Error("progress tracker module missing");
        await PhonicsTracker.init();
        const res = await fetch("data/rules/rules.json");
        if (!res.ok) throw new Error("rules.json failed to load (" + res.status + ")");
        rules = await res.json();
        rulesIdx = PhonicsErrors.indexRules(rules);
      } catch (err) {
        setStatus("error", "Hmm, something didn't load. Try refreshing the page.<br><small>"
          + escapeHtml(err && err.message ? err.message : String(err)) + "</small>");
        return;
      }

      wireEvents();
      setStatus("hidden");
      renderProfiles();
      show("screenProfiles");
    }

    document.addEventListener("DOMContentLoaded", boot);
  })();
}
