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
    var chunkHook = null;      // set by holdToTalk to analyse as we go

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
        var d = new Float32Array(e.inputBuffer.getChannelData(0));
        chunks.push(d);
        if (chunkHook) chunkHook(d);
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
      chunkHook = null;
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

    return {
      start: start, stop: stop,
      isLive: function () { return live; },
      sampleRate: function () { return ctx ? ctx.sampleRate : 0; },
      onChunk: function (fn) { chunkHook = fn; },
    };
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

    // Live tongue, if the caller wants one: the tracker rides the
    // recording that is already happening rather than opening a second
    // microphone. onPose fires per analysed frame; onGap fires when this
    // moment is not a placeable vowel, so the caller can hold the last
    // position instead of snapping the tongue home.
    function attachTracker() {
      if (!opts.onPose || !L) return;
      var tracker = L.makeTracker(rec.sampleRate(), {
        calibration: opts.calibration || loadCal(),
        fps: opts.fps || 30,
      });
      rec.onChunk(function (chunk) {
        var pose = tracker.push(chunk);
        if (pose) opts.onPose(pose);
        else if (opts.onGap) opts.onGap();
      });
    }

    async function down(e) {
      if (busy || rec.isLive()) return;
      if (e && e.cancelable) e.preventDefault();
      busy = true;
      heldAt = Date.now();
      try {
        await rec.start(level);
        attachTracker();
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

  // ---- the vowel mouth ------------------------------------------------
  // Show the child the correct tongue movement, then replay their own on
  // the same diagram so the two are directly comparable. Consonants get a
  // still close-up of the place of articulation; vowels get this, because
  // a vowel has no contact point to point at — it IS the shape.

  // The chart position the app is aiming for, via mouth.js's own table so
  // the target and the drawing can never disagree.
  function targetFor(shortSound, example) {
    var d = window.Mouth && Mouth.descFor(shortSound, example);
    if (!d) return null;
    if (d.kind === "v") return { at: d.at, ipa: d.ipa, eg: d.eg };
    // A diphthong is a journey, not a place. Grade it on where it lands:
    // that is the part a child gets wrong ("ow" stopping halfway).
    if (d.kind === "d") return { at: d.to, from: d.from, ipa: d.ipa, eg: d.eg, glide: true };
    return null;
  }

  function isVowelSound(shortSound, example) {
    return !!targetFor(shortSound, example);
  }

  // Draw the head (not a consonant close-up — a vowel needs the whole
  // tongue visible) and hand back the animation control.
  function mountVowelMouth(host) {
    if (!host || !window.Anatomy) return null;
    host.innerHTML = Anatomy.svg({ cls: "mouth-vowel", label: "vowel mouth shape" });
    var svg = host.querySelector("svg");
    return svg ? Anatomy.makeCtl(svg) : null;
  }

  // Play the model: glide into the shape and hold it, so the child sees
  // the movement rather than a static picture appearing.
  function showTarget(ctl, target, opts) {
    if (!ctl || !target) return function () {};
    opts = opts || {};
    var ms = opts.ms || 700;
    if (target.glide && target.from) {
      return Anatomy.glide(ctl, target.from, target.at, ms, opts.done);
    }
    var rest = opts.from || [50, 42];
    return Anatomy.glide(ctl, rest, target.at, ms, opts.done);
  }

  // Replay what the child actually did, starting from the model's shape so
  // the difference is the thing that moves. Returns a cancel fn.
  function showAttempt(ctl, target, pose, opts) {
    if (!ctl || !pose) return function () {};
    opts = opts || {};
    var from = (target && target.at) || [50, 42];
    return Anatomy.glide(ctl, from, [pose.x, pose.y], opts.ms || 650, opts.done);
  }

  // ---- watching your own tongue -----------------------------------
  // Two ways to see it: live while you speak, and replayed afterwards
  // with your own voice. The replay is the one that teaches — live, a
  // child is busy making the sound; on the replay they can watch.

  // Replay a recording: the child's own voice, with the tongue moving in
  // step with it. Returns a cancel fn.
  function replayTongue(clip, ctl, opts) {
    opts = opts || {};
    if (!clip || !ctl || !window.PhonicsListen) return function () {};
    var track = L.trackVowel(clip.buf, clip.sampleRate, {
      calibration: opts.calibration || loadCal(),
      fps: opts.fps || 30,
    });

    var ctx = null, srcNode = null, raf = 0, dead = false;
    var startedAt = 0;

    // Play their voice back through the same clock the animation reads,
    // so the tongue and the sound cannot drift apart.
    if (opts.sound !== false && window.AudioContext) {
      try {
        ctx = new AudioContext();
        var abuf = ctx.createBuffer(1, clip.buf.length, clip.sampleRate);
        abuf.getChannelData(0).set(clip.buf);
        srcNode = ctx.createBufferSource();
        srcNode.buffer = abuf;
        srcNode.connect(ctx.destination);
        srcNode.start();
      } catch (e) { ctx = null; }
    }

    var t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    var last = null;
    function step() {
      if (dead) return;
      var now = (typeof performance !== "undefined" ? performance.now() : Date.now());
      var t = (now - t0) / 1000;
      if (t > track.duration) {
        if (opts.done) opts.done(track);
        cleanup();
        return;
      }
      var i = Math.min(track.samples.length - 1, Math.floor(t * track.fps));
      var p = track.samples[i];
      if (p && p.x != null) { ctl.pose(p.x, p.y); last = p; }
      // a gap holds `last` — deliberately no else branch
      if (opts.onFrame) opts.onFrame(p, t);
      raf = requestAnimationFrame(step);
    }
    function cleanup() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      try { if (srcNode) srcNode.stop(); } catch (e) {}
      try { if (ctx) ctx.close(); } catch (e) {}
    }
    raf = requestAnimationFrame(step);
    return cleanup;
  }

  // ---- a card that asks for more than one sound ------------------------

  // Turn a grapheme card's sounds into match targets. Vowels and
  // diphthongs come from mouth.js's own position table so the target and
  // the drawing can never disagree; consonants fall through to the cue
  // table in listen.js.
  function targetsFor(sounds, gpcIds) {
    var out = [];
    (sounds || []).forEach(function (s, i) {
      var id = (gpcIds && gpcIds[i]) || ("sound" + i);
      var d = window.Mouth && Mouth.descFor(s.s, s.ex);
      if (d && d.kind === "v") out.push({ id: id, kind: "v", at: d.at, label: s.s, eg: s.ex, ipa: d.ipa });
      else if (d && d.kind === "d") out.push({ id: id, kind: "d", from: d.from, to: d.to, label: s.s, eg: s.ex, ipa: d.ipa });
      else {
        var g = window.PhonicsBank && PhonicsBank.gpc(id);
        var ph = g && (Array.isArray(g.phonemes) ? g.phonemes[0] : g.phonemes);
        if (ph) out.push({ id: id, kind: "c", phoneme: ph, label: s.s, eg: s.ex });
      }
    });
    return out;
  }

  // Everything matchSounds() needs, from one recording.
  function attemptFrom(clip, opts) {
    if (!clip || !L) return null;
    opts = opts || {};
    var cal = opts.calibration || loadCal();
    var features = measure(clip);
    if (!features) return null;
    var track = L.trackVowel(clip.buf, clip.sampleRate, { calibration: cal, fps: opts.fps || 30 });
    var steady = L.steadiest(track, { ms: 120 });
    var pose = L.vowelPose(features, { calibration: cal });
    // Use the steady position where there is one — it is where the tongue
    // stopped — but keep vowelPose's confidence, which knows about pitch
    // and formant crowding.
    if (steady && pose) steady = Object.assign({}, steady, { confidence: pose.confidence, personal: pose.personal });
    return { track: track, path: L.pathOf(track), pose: steady || pose, features: features, clip: clip };
  }

  return {
    loadCal: loadCal, saveCal: saveCal, clearCal: clearCal,
    targetsFor: targetsFor, attemptFrom: attemptFrom,
    replayTongue: replayTongue,
    targetFor: targetFor, isVowelSound: isVowelSound,
    mountVowelMouth: mountVowelMouth, showTarget: showTarget, showAttempt: showAttempt,
    createRecorder: createRecorder, measure: measure, holdToTalk: holdToTalk,
    micError: micError, supported: supported,
    bestGrade: bestGrade, phonemesForGpcs: phonemesForGpcs,
    MIN_HOLD: MIN_HOLD, CAL_KEY: CAL_KEY,
  };
})();
