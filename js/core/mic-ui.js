// ============================================================
// js/core/mic-ui.js — window.PhonicsMic
//
// The browser half of listening: getUserMedia, hold-to-talk, and
// remembering a child's calibration. js/core/listen.js is the maths
// and stays free of the DOM; this is the plumbing, and it stays free
// of any opinion about sounds.
//
// Split out because two places need it — the "can it hear them?"
// page and Look & Say — and a second copy of microphone plumbing is
// how permission handling, cleanup and mute-routing quietly diverge.
// ============================================================

window.PhonicsMic = (function () {
  "use strict";

  var CAL_KEY = "phonics.listen.cal";
  var L = window.PhonicsListen;

  // ---- the child's calibration, remembered between sessions ------
  function loadCal() {
    try { var raw = localStorage.getItem(CAL_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function saveCal(cal) {
    try { localStorage.setItem(CAL_KEY, JSON.stringify(cal)); } catch (e) {}
  }
  function clearCal() {
    try { localStorage.removeItem(CAL_KEY); } catch (e) {}
  }

  // ---- recording --------------------------------------------------
  // One recorder at a time. Every path through stop() releases the mic
  // track, because a page that leaves it open shows a recording dot in
  // the tab and, on a school laptop, looks exactly like spyware.
  function createRecorder() {
    var stream = null, ctx = null, src = null, node = null, mute = null;
    var chunks = [];
    var live = false;
    var peak = 0;

    async function start(onLevel) {
      if (live) return true;
      chunks = []; peak = 0;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      src = ctx.createMediaStreamSource(stream);
      node = ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = function (e) {
        var d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d));
        if (!onLevel) return;
        var m = 0;
        for (var i = 0; i < d.length; i++) { var v = Math.abs(d[i]); if (v > m) m = v; }
        peak = Math.max(m, peak * 0.86);
        onLevel(Math.min(1, peak * 2.4));
      };
      src.connect(node);
      // A ScriptProcessor only runs while connected to the destination,
      // so route it through a silent gain — the child is not echoed back
      // at themselves through the classroom speakers.
      mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute);
      mute.connect(ctx.destination);
      live = true;
      return true;
    }

    function stop() {
      if (!live) return null;
      live = false;
      try { node.disconnect(); src.disconnect(); mute.disconnect(); } catch (e) {}
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      var sr = ctx.sampleRate;
      try { ctx.close(); } catch (e) {}
      var total = chunks.reduce(function (n, c) { return n + c.length; }, 0);
      var buf = new Float32Array(total), at = 0;
      chunks.forEach(function (c) { buf.set(c, at); at += c.length; });
      chunks = [];
      return { buf: buf, sampleRate: sr };
    }

    return { start: start, stop: stop, isLive: function () { return live; } };
  }

  // Find the attempt inside the silence and measure it.
  function measure(clip) {
    if (!clip || !L || clip.buf.length < 2048) return null;
    var loud = L.loudestFrame(clip.buf, clip.sampleRate, 2048);
    return L.analyse(clip.buf, clip.sampleRate, { from: loud.from, frame: 2048 });
  }

  // ---- hold to talk -----------------------------------------------
  // Mouse, touch and keyboard, with a floor on how short a hold can be:
  // a child who taps rather than holds still gets a fair listen instead
  // of "too quiet", which would read as their fault rather than ours.
  var MIN_HOLD = 350;

  function holdToTalk(btn, opts) {
    opts = opts || {};
    var rec = createRecorder();
    var heldAt = 0, busy = false;

    function level(v) { if (opts.onLevel) opts.onLevel(v); }

    async function down(e) {
      if (busy || rec.isLive()) return;
      if (e && e.cancelable) e.preventDefault();
      busy = true;
      heldAt = Date.now();
      try {
        await rec.start(level);
        if (opts.onStart) opts.onStart();
      } catch (err) {
        busy = false;
        if (opts.onError) opts.onError(micError(err));
      }
    }

    function finish() {
      var clip = rec.stop();
      busy = false;
      level(0);
      if (opts.onStop) opts.onStop();
      var f = measure(clip);
      if (opts.onResult) opts.onResult(f, clip);
    }

    function up(e) {
      if (!rec.isLive()) { busy = false; return; }
      if (e && e.cancelable) e.preventDefault();
      var held = Date.now() - heldAt;
      if (held < MIN_HOLD) setTimeout(finish, MIN_HOLD - held);
      else finish();
    }

    function keyDown(e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) down(e); }
    function keyUp(e) { if (e.key === " " || e.key === "Enter") up(e); }

    btn.addEventListener("mousedown", down);
    btn.addEventListener("touchstart", down, { passive: false });
    btn.addEventListener("keydown", keyDown);
    btn.addEventListener("keyup", keyUp);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    // A finger dragged off the screen edge never fires touchend.
    window.addEventListener("touchcancel", up);
    window.addEventListener("blur", up);

    return {
      destroy: function () {
        btn.removeEventListener("mousedown", down);
        btn.removeEventListener("touchstart", down);
        btn.removeEventListener("keydown", keyDown);
        btn.removeEventListener("keyup", keyUp);
        window.removeEventListener("mouseup", up);
        window.removeEventListener("touchend", up);
        window.removeEventListener("touchcancel", up);
        window.removeEventListener("blur", up);
        if (rec.isLive()) rec.stop();
      }
    };
  }

  function micError(err) {
    var name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "The browser blocked the microphone. Allow it for this page and try again.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No microphone found. Plug one in, or use the headset mic.";
    }
    if (!window.isSecureContext) {
      return "Microphones only work on https:// (or localhost).";
    }
    return "Couldn't open the microphone." + (name ? " (" + name + ")" : "");
  }

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.PhonicsListen);
  }

  // ---- grading a card that may have several right answers ----------
  // A grapheme card can spell more than one sound: <s> says /s/ and /z/,
  // <a> says three. Look & Say asks for "its sound", so any of them is
  // right, and the child should get the verdict for the one they went
  // for — not a correction towards an arbitrary first entry.
  var RANK = { heard: 3, ask: 2, close: 1, quiet: 0 };

  function bestGrade(phonemeIds, features, opts) {
    if (!L || !features) return null;
    var best = null;
    (phonemeIds || []).forEach(function (id) {
      var r = L.grade(id, features, opts || {});
      if (!best) { best = r; return; }
      var a = RANK[r.verdict] == null ? -1 : RANK[r.verdict];
      var b = RANK[best.verdict] == null ? -1 : RANK[best.verdict];
      if (a > b) { best = r; return; }
      // Same verdict: the one with less to complain about is the closer miss.
      if (a === b && r.why.length < best.why.length) best = r;
    });
    return best;
  }

  // The phoneme ids a grapheme card stands for, via the bank.
  function phonemesForGpcs(gpcIds) {
    var out = [];
    (gpcIds || []).forEach(function (id) {
      var g = window.PhonicsBank && PhonicsBank.gpc(id);
      if (!g) return;
      var ph = Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes;
      if (ph && out.indexOf(ph) === -1) out.push(ph);
    });
    return out;
  }

  return {
    loadCal: loadCal, saveCal: saveCal, clearCal: clearCal,
    createRecorder: createRecorder, measure: measure, holdToTalk: holdToTalk,
    micError: micError, supported: supported,
    bestGrade: bestGrade, phonemesForGpcs: phonemesForGpcs,
    MIN_HOLD: MIN_HOLD, CAL_KEY: CAL_KEY,
  };
})();
