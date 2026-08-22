// ============================================================
// js/views/bookmark.js — the bookmark view.
//
// One level of the active program, drawn as the physical thing:
// a 200 x 794 CSS px bookmark (≈53 x 210 mm at 96dpi) with the
// level's colour band, its graphemes, and the QR code that plays
// the level's sounds. Reached from the trainer's tracker — every
// row carries a 🔖 that opens bookmark.html?seq=…&level=….
//
//   SOUNDS side       one row per grapheme: the grapheme in a
//                     serif face, then a line per sound carrying
//                     the printed bookmarks' own shorthand
//                     (gpc.short — ă, ā, ōō, never "/a/") and one
//                     example word. Tap a sound line to hear it,
//                     tap the word to hear the word.
//   HANDWRITING side  the same graphemes as dotted-thirds tracing
//                     lanes: one canvas per letter, the model
//                     letterform drawn underneath in light grey.
//                     Capture -> score -> band + one advice line,
//                     using the same pipeline as T9
//                     (js/tasks/t9_handwriting.js): canvas points
//                     mapped ALL THE WAY into the model's 0-100
//                     letter box, so `thirds` is the model's own
//                     line set.
//
// Print puts BOTH sides side by side at true size on one A4 page:
// cut the two out, glue them back to back, one double-sided
// bookmark.
//
// Plain-script global, no build step, no modules — same pattern
// as js/views/sheets.js.
// ============================================================

(function () {
  "use strict";

  // Where the printed QR codes point. Same one-line constant as
  // js/views/sheets.js — change both if the site ever moves.
  var BASE_URL = "https://liaminhawai-cmd.github.io/Phonics/";

  var STYLE_FILE = "data/handwriting/letterforms-vic-modern-cursive.json";

  // ---- handwriting geometry ------------------------------------
  var N = 48;                       // resample points, model and attempt alike
  var MODEL_THIRDS = { top: 0, mid: 33.3, base: 66.6, floor: 100 };
  var MAX_SCALE = 1.0;              // px per model unit
  var PAD_Y = 6;                    // px above the top line / below the floor
  var CELL_PAD_X = 3;               // px of slack each side of a letter
  var CELL_GAP = 2;                 // px between letters of one grapheme
  var RES_H = 24;                   // the little result strip under a lane
  var LANE_GAP = 6;

  var MODEL_GREY = "#ddd6c7";
  var INK = "#1f1f1f";
  var START_GREEN = "#2f6a3e";

  var BANDS = {
    "great": { emoji: "🌟", text: "Beautiful!" },
    "good": { emoji: "👍", text: "Nice writing!" },
    "getting-there": { emoji: "💪", text: "Getting there." },
    "keep-practising": { emoji: "🌱", text: "Keep practising." }
  };

  var TRACE_HINT = "Trace the grey letters with your finger.";

  // ---- tiny helpers ---------------------------------------------
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  // Some level colours are very pale, some very dark — pick readable ink.
  function inkOn(hex) {
    var c = String(hex || "").replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return "#1f1f1f";
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 145 ? "#1f1f1f" : "#fbf7ee";
  }

  // The root-level mouth videos are named after the grapheme (Ai.mp4,
  // Ough.mp4). Only worth reaching for when the grapheme has ONE sound
  // here — the video says the grapheme, not one particular sound of it —
  // and a stem with no file simply falls through PhonicsAudio's chain.
  function mp4StemFor(grapheme) {
    if (!grapheme || !/^[a-z]+$/.test(grapheme)) return null;
    return grapheme.charAt(0).toUpperCase() + grapheme.slice(1);
  }

  // The shorthand the printed bookmarks use (ă, ā, ah, ōō…). The bank
  // carries it as gpc.short; a GPC the bookmarks never named falls back to
  // the id's own tail rather than a "/slashes/" phoneme label.
  function shortFor(gpc) {
    if (gpc.short) return gpc.short;
    var dot = gpc.id.indexOf(".");
    return dot === -1 ? gpc.id : gpc.id.slice(dot + 1);
  }

  // The id PhonicsAudio can actually speak for a GPC's sound: a plain
  // phoneme id, or — for a bundled one (qu = k+w, x = k+s) — the teaching
  // unit id, which is exactly the GPC id's tail.
  function soundIdFor(gpc) {
    if (!Array.isArray(gpc.phonemes)) return gpc.phonemes;
    var dot = gpc.id.indexOf(".");
    return dot === -1 ? gpc.id : gpc.id.slice(dot + 1);
  }

  // ============================================================
  // state
  // ============================================================
  var state = {
    units: [],            // PhonicsBank.graphemeView()
    unit: null,           // the one on the bookmark
    index: 0,
    side: "sounds",
    letters: null,        // letterform models, or null if they failed
    lettersError: "",
    lanes: [],            // live handwriting lanes
    scale: 1
  };

  var stage, stageWrap, statusBox;
  var soundsCard = null, handCard = null;

  function status(msg, isError) {
    if (!statusBox) return;
    statusBox.textContent = msg || "";
    statusBox.className = "status-box" + (isError ? " status-error" : "");
    statusBox.hidden = !msg;
  }

  // ============================================================
  // the sounds side
  // ============================================================
  function buildSoundsCard(unit, colour) {
    var card = el("div", "bm bm-sounds");
    card.dataset.side = "sounds";
    card.style.setProperty("--bm-colour", colour);
    card.style.setProperty("--bm-band-ink", inkOn(colour));

    var band = el("div", "bm-band");
    var t = el("div", "bm-band-title");
    t.textContent = unit.label || ("Level " + unit.n);
    var sub = el("div", "bm-band-sub");
    var seq = PhonicsBank.seq();
    sub.textContent = (seq && seq.name) || "My sounds";
    band.appendChild(t);
    band.appendChild(sub);
    card.appendChild(band);

    var rows = el("div", "bm-rows");
    var totalLines = 0;
    unit.graphemes.forEach(function (g) { totalLines += g.gpcs.length; });

    unit.graphemes.forEach(function (g) {
      var row = el("div", "bm-row");
      var single = g.gpcs.length === 1;

      var gEl = el("div", "bm-g");
      gEl.textContent = g.display || g.grapheme;
      // long graphemes (ough, eigh) have to give width back to the sounds
      var len = (g.display || g.grapheme).length;
      if (len >= 4) gEl.style.fontSize = "calc(var(--bm-g-size, 30px) * 0.6)";
      else if (len === 3) gEl.style.fontSize = "calc(var(--bm-g-size, 30px) * 0.78)";
      row.appendChild(gEl);

      var snds = el("div", "bm-snds");
      g.gpcs.forEach(function (gpc) {
        var line = el("div", "bm-snd");
        line.setAttribute("role", "button");
        line.setAttribute("tabindex", "0");
        line.dataset.gpc = gpc.id;
        var stem = single ? mp4StemFor(g.grapheme) : null;
        if (stem) line.dataset.mp4 = stem;
        var word = (gpc.examples && gpc.examples[0]) || "";
        line.setAttribute("aria-label",
          "Hear " + (g.display || g.grapheme) + " as in " + (word || "this sound"));

        var sh = el("span", "bm-short");
        sh.textContent = shortFor(gpc);
        line.appendChild(sh);

        var ex = el("span", "bm-ex");
        ex.textContent = word;
        if (word) {
          ex.dataset.word = word;
          ex.title = "Hear the word " + word;
        }
        line.appendChild(ex);

        var spk = el("span", "bm-spk");
        spk.textContent = "🔊";
        spk.setAttribute("aria-hidden", "true");
        line.appendChild(spk);

        snds.appendChild(line);
      });
      row.appendChild(snds);
      rows.appendChild(row);
    });
    card.appendChild(rows);

    // ---- QR foot ----
    var foot = el("div", "bm-foot");
    var slot = el("div", "bm-qr");
    foot.appendChild(slot);
    var cap = el("div", "bm-qr-cap");
    cap.textContent = "Scan to hear my sounds";
    foot.appendChild(cap);
    var sub2 = el("div", "bm-qr-sub");
    sub2.textContent = unit.graphemes.map(function (g) { return g.display || g.grapheme; }).join(" · ");
    foot.appendChild(sub2);
    card.appendChild(foot);

    card._rows = rows;
    card._qrSlot = slot;
    card._counts = { rows: unit.graphemes.length, lines: totalLines };
    return card;
  }

  // Fit the sound lines to the card: shrink the row height (never below a
  // comfortable tap) and the grapheme size when a level teaches a lot.
  function layoutSounds() {
    if (!soundsCard) return;
    var rows = soundsCard._rows;
    var avail = rows.clientHeight;
    if (!avail) return;
    var c = soundsCard._counts;
    var overhead = c.rows * 7;
    var per = (avail - overhead) / Math.max(1, c.lines);
    soundsCard.style.setProperty("--bm-snd-h", Math.round(clamp(per, 26, 44)) + "px");
    var gSize = c.rows <= 6 ? 30 : (c.rows <= 8 ? 25 : (c.rows <= 11 ? 21 : 18));
    soundsCard.style.setProperty("--bm-g-size", gSize + "px");
  }

  // ---- QR --------------------------------------------------------
  // play.html?sounds=<phoneme ids>&accent=…&title=… — the card's link back
  // to the audio for exactly this level's sounds.
  function qrPayload(unit) {
    var ids = [], seen = {};
    unit.graphemes.forEach(function (g) {
      g.gpcs.forEach(function (gpc) {
        var id = soundIdFor(gpc);
        if (!id || seen[id]) return;
        seen[id] = true;
        ids.push(id);
      });
    });
    var accent = (window.PhonicsBank && PhonicsBank.accent) || "au";
    return BASE_URL + "play.html?sounds=" + encodeURIComponent(ids.join(",")) +
      "&accent=" + encodeURIComponent(accent) +
      "&title=" + encodeURIComponent(unit.label || ("Level " + unit.n));
  }

  function renderQr(target, url) {
    target.innerHTML = "";
    target.title = url;
    if (typeof window.qrcode !== "function") {
      var box = el("div", "bm-qr-missing");
      box.textContent = "QR unavailable";
      target.appendChild(box);
      return false;
    }
    try {
      if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs["UTF-8"]) {
        window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
      }
      var code = window.qrcode(0, "M");
      code.addData(url);
      code.make();
      var img = new Image();
      img.alt = "QR code — hear this level's sounds";
      img.src = code.createDataURL(4, 0);
      target.appendChild(img);
      return true;
    } catch (e) {
      var box2 = el("div", "bm-qr-missing");
      box2.textContent = "QR unavailable";
      target.appendChild(box2);
      return false;
    }
  }

  // ============================================================
  // the handwriting side
  // ============================================================
  function buildHandCard(unit, colour) {
    var card = el("div", "bm bm-hand");
    card.dataset.side = "handwriting";
    card.style.setProperty("--bm-colour", colour);
    card.style.setProperty("--bm-band-ink", inkOn(colour));

    var band = el("div", "bm-band");
    var t = el("div", "bm-band-title");
    t.textContent = "Write them";
    var sub = el("div", "bm-band-sub");
    sub.textContent = unit.label || ("Level " + unit.n);
    band.appendChild(t);
    band.appendChild(sub);
    card.appendChild(band);

    var lanes = el("div", "bm-lanes");
    card.appendChild(lanes);

    var foot = el("div", "bm-hand-foot");
    var advice = el("div", "bm-advice");
    advice.textContent = TRACE_HINT;
    foot.appendChild(advice);
    // A printed card shouldn't carry a live score message.
    var printed = el("div", "bm-print-hint");
    printed.textContent = "Trace the grey letters — start on the green dot.";
    foot.appendChild(printed);
    var note = el("div", "bm-hand-note");
    note.textContent = "Victorian Modern Cursive";
    foot.appendChild(note);
    card.appendChild(foot);

    card._lanes = lanes;
    card._advice = advice;
    return card;
  }

  function setAdvice(text, warn) {
    if (!handCard) return;
    handCard._advice.textContent = text || TRACE_HINT;
    handCard._advice.className = "bm-advice" + (warn ? " warn" : "");
  }

  // One tracing lane: the letters of one grapheme, side by side on a
  // shared set of dotted thirds.
  function buildLane(grapheme, letterKeys) {
    var lane = el("div", "bm-lane");

    var strip = el("div", "bm-strip");
    var lines = el("div", "bm-lines");
    ["top", "mid", "base", "floor"].forEach(function (k) {
      var i = document.createElement("i");
      i.dataset.line = k;
      lines.appendChild(i);
    });
    strip.appendChild(lines);
    lane.appendChild(strip);

    var res = el("div", "bm-lane-res");
    var gLabel = el("span", "bm-lane-g");
    gLabel.textContent = grapheme;
    var score = el("span", "bm-lane-score");
    score.textContent = "";
    var clear = el("button", "bm-lane-clear");
    clear.type = "button";
    clear.textContent = "clear";
    clear.setAttribute("aria-label", "Clear the tracing for " + grapheme);
    res.appendChild(gLabel);
    res.appendChild(score);
    res.appendChild(clear);
    lane.appendChild(res);

    var obj = {
      grapheme: grapheme,
      node: lane,
      strip: strip,
      lines: lines,
      scoreEl: score,
      cells: [],
      scale: 1
    };

    letterKeys.forEach(function (key) {
      var def = state.letters[key];
      var canvas = el("canvas", "bm-cell");
      canvas.dataset.letter = key;
      canvas.setAttribute("aria-label", "Trace the letter " + key);
      strip.appendChild(canvas);
      var cell = {
        key: key, def: def, canvas: canvas, ctx: null,
        strokes: [],                 // MODEL-space points, so a relayout is free
        drawing: false, pointer: null,
        modelFine: (def.strokes || []).map(function (s) {
          return PhonicsHandwriting.pathToPoints(s.path, 96);
        }),
        modelPts: (def.strokes || []).map(function (s) {
          return PhonicsHandwriting.pathToPoints(s.path, N);
        }),
        paths: null
      };
      try {
        var built = (def.strokes || []).map(function (s) { return new Path2D(s.path); });
        if (built.length === (def.strokes || []).length) cell.paths = built;
      } catch (e) { cell.paths = null; }
      wireCell(obj, cell);
      obj.cells.push(cell);
    });

    clear.addEventListener("click", function () { clearLane(obj); });
    return obj;
  }

  function clearLane(lane) {
    lane.cells.forEach(function (c) { c.strokes = []; drawCell(lane, c); });
    lane.scoreEl.textContent = "";
    lane.scoreEl.className = "bm-lane-score";
  }

  function clearAllLanes() {
    state.lanes.forEach(clearLane);
    setAdvice(TRACE_HINT, false);
  }

  // ---- geometry ---------------------------------------------------
  function layoutHand() {
    if (!handCard || !state.lanes.length) return;
    var lanesEl = handCard._lanes;
    var availH = lanesEl.clientHeight;
    var availW = lanesEl.clientWidth;
    if (!availH || !availW) return;          // still hidden — try again later

    var n = state.lanes.length;
    var perLane = availH / n;
    var stripH = perLane - RES_H - LANE_GAP;
    var scaleH = (stripH - PAD_Y * 2) / 100;

    state.lanes.forEach(function (lane) {
      var units = 0;
      lane.cells.forEach(function (c) {
        units += (typeof c.def.width === "number" ? c.def.width : 55);
      });
      var k = lane.cells.length;
      var chrome = k * CELL_PAD_X * 2 + (k - 1) * CELL_GAP;
      var scaleW = units > 0 ? (availW - 2 - chrome) / units : MAX_SCALE;
      var scale = Math.max(0.28, Math.min(MAX_SCALE, scaleH, scaleW));
      lane.scale = scale;

      var h = Math.round(100 * scale + PAD_Y * 2);
      lane.strip.style.height = h + "px";
      [["top", 0], ["mid", 33.3], ["base", 66.6], ["floor", 100]].forEach(function (pair) {
        var i = lane.lines.querySelector('[data-line="' + pair[0] + '"]');
        if (!i) return;
        i.style.top = Math.round(PAD_Y + pair[1] * scale) + "px";
        if (pair[0] === "mid") {
          i.style.borderTop = "1px dashed var(--guide)";
        } else if (pair[0] === "base") {
          i.style.borderTop = "1.5px solid var(--guide-base)";
        } else if (pair[0] === "floor") {
          i.style.borderTop = "1px solid var(--guide-faint)";
        } else {
          i.style.borderTop = "1px solid var(--guide)";
        }
      });

      lane.cells.forEach(function (c) {
        var w = Math.round((typeof c.def.width === "number" ? c.def.width : 55) * scale) + CELL_PAD_X * 2;
        var dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
        c.canvas.style.width = w + "px";
        c.canvas.style.height = h + "px";
        c.canvas.width = Math.round(w * dpr);
        c.canvas.height = Math.round(h * dpr);
        c.ctx = c.canvas.getContext("2d");
        c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.w = w; c.h = h;
        drawCell(lane, c);
      });
    });
  }

  function toCanvas(lane, p) {
    return { x: CELL_PAD_X + p.x * lane.scale, y: PAD_Y + p.y * lane.scale };
  }

  function toModel(lane, p) {
    return { x: (p.x - CELL_PAD_X) / lane.scale, y: (p.y - PAD_Y) / lane.scale };
  }

  function drawCell(lane, c) {
    var g = c.ctx;
    if (!g) return;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.canvas.width, c.canvas.height);
    g.restore();

    // the model, as a light grey road to drive along
    g.save();
    g.translate(CELL_PAD_X, PAD_Y);
    g.scale(lane.scale, lane.scale);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = MODEL_GREY;
    g.lineWidth = 8 / lane.scale;
    if (c.paths) {
      c.paths.forEach(function (p) { g.stroke(p); });
    } else {
      c.modelFine.forEach(function (pts) {
        if (!pts || pts.length < 2) return;
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.stroke();
      });
    }
    g.restore();

    drawStartCue(lane, c);

    // the child's ink
    g.save();
    g.strokeStyle = INK;
    g.fillStyle = INK;
    g.lineWidth = 3.2;
    g.lineCap = "round";
    g.lineJoin = "round";
    c.strokes.forEach(function (s) {
      if (!s.length) return;
      var p0 = toCanvas(lane, s[0]);
      if (s.length === 1) {
        g.beginPath();
        g.arc(p0.x, p0.y, 1.8, 0, Math.PI * 2);
        g.fill();
        return;
      }
      g.beginPath();
      g.moveTo(p0.x, p0.y);
      for (var i = 1; i < s.length; i++) {
        var p = toCanvas(lane, s[i]);
        g.lineTo(p.x, p.y);
      }
      g.stroke();
    });
    g.restore();
  }

  // A green pen-down dot (plus a stubby arrow) on the stroke the child is
  // expected to draw next — the same cue T9 uses at its "trace" rung.
  function drawStartCue(lane, c) {
    var g = c.ctx;
    var idx = Math.min(c.strokes.length, c.modelPts.length - 1);
    var pts = c.modelPts[idx];
    if (!pts || !pts.length) return;
    var p0 = toCanvas(lane, pts[0]);
    var r = Math.max(3, 4.5 * lane.scale);
    g.save();
    g.beginPath();
    g.fillStyle = START_GREEN;
    g.arc(p0.x, p0.y, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = "#fff";
    g.stroke();
    g.restore();

    var lenPx = PhonicsHandwriting.pathLength(pts) * lane.scale;
    if (lenPx < 22) return;
    var frac = Math.max(0.06, Math.min(0.3, 16 / lenPx));
    var k = Math.max(1, Math.round((pts.length - 1) * frac));
    var a = toCanvas(lane, pts[k]);
    var b = toCanvas(lane, pts[Math.min(pts.length - 1, k + 2)]);
    var ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.save();
    g.translate(a.x, a.y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(6.5, 0); g.lineTo(-4, -4.2); g.lineTo(-4, 4.2);
    g.closePath();
    g.fillStyle = START_GREEN;
    g.fill();
    g.restore();
  }

  // ---- capture -----------------------------------------------------
  function pointFrom(c, e) {
    var r = c.canvas.getBoundingClientRect();
    var kx = r.width ? c.w / r.width : 1;
    var ky = r.height ? c.h / r.height : 1;
    return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
  }

  function wireCell(lane, c) {
    c.canvas.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      try { c.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      c.pointer = e.pointerId;
      c.drawing = true;
      c.strokes.push([toModel(lane, pointFrom(c, e))]);
      drawCell(lane, c);
    });

    c.canvas.addEventListener("pointermove", function (e) {
      if (!c.drawing || e.pointerId !== c.pointer) return;
      e.preventDefault();
      var cur = c.strokes[c.strokes.length - 1];
      if (!cur) return;
      var p = toModel(lane, pointFrom(c, e));
      var last = cur[cur.length - 1];
      if (Math.abs(p.x - last.x) < 0.5 && Math.abs(p.y - last.y) < 0.5) return;
      cur.push(p);
      drawCell(lane, c);
    });

    var up = function (e) {
      if (!c.drawing || e.pointerId !== c.pointer) return;
      c.drawing = false;
      c.pointer = null;
      try { c.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      drawCell(lane, c);
      scoreCell(lane, c);
    };
    c.canvas.addEventListener("pointerup", up);
    c.canvas.addEventListener("pointercancel", up);
  }

  // Everything drawn in this cell so far, scored against its model. Points
  // are already in the model's 0-100 box, so `thirds` is the model's own
  // line set — the safest of the two paths score.js documents.
  function scoreCell(lane, c) {
    if (!c.strokes.length) return;
    var res;
    try {
      res = PhonicsHandwriting.scoreAttempt({
        attemptStrokes: c.strokes,
        letterModel: c.def,
        thirds: MODEL_THIRDS,
        n: N
      });
    } catch (e) {
      setAdvice("Couldn't score that one — have another go.", true);
      return;
    }
    var band = BANDS[res.band] || BANDS["keep-practising"];
    lane.scoreEl.className = "bm-lane-score band-" + res.band;
    lane.scoreEl.textContent = band.emoji + " " + res.total + " " + band.text;
    lane.scoreEl.dataset.total = String(res.total);
    lane.scoreEl.dataset.band = res.band;
    var advice = (res.advice || [])[0];
    setAdvice(advice || (res.total >= 70 ? band.text + " Try the next letter." : TRACE_HINT), !!advice);
  }

  // ============================================================
  // render
  // ============================================================
  function render() {
    var unit = state.unit;
    var colour = unit.colour ||
      (PhonicsBank.beltColour ? PhonicsBank.beltColour(state.index).bg : "#cfe0f5");

    stage.innerHTML = "";
    state.lanes = [];

    soundsCard = buildSoundsCard(unit, colour);
    stage.appendChild(soundsCard);

    handCard = buildHandCard(unit, colour);
    stage.appendChild(handCard);

    if (!state.letters) {
      var err = el("div", "bm-hand-error");
      err.textContent = state.lettersError ||
        "The letter models didn't load, so tracing is off for now.";
      handCard._lanes.appendChild(err);
    } else {
      unit.graphemes.forEach(function (g) {
        var text = String(g.grapheme || "");
        var keys = text.split("").filter(function (ch) { return state.letters[ch]; });
        if (!keys.length) return;
        var lane = buildLane(g.display || g.grapheme, keys);
        state.lanes.push(lane);
        handCard._lanes.appendChild(lane.node);
      });
      if (!state.lanes.length) {
        var none = el("div", "bm-hand-error");
        none.textContent = "No letter models for this level's spellings yet.";
        handCard._lanes.appendChild(none);
      }
    }

    // Lay both sides out while both are on screen, then show the chosen one:
    // a hidden card measures zero, and print needs both sides ready anyway.
    soundsCard.classList.add("is-on");
    handCard.classList.add("is-on");
    fitStage(true);
    layoutSounds();
    layoutHand();
    setSide(state.side, true);
    fitStage();

    renderQr(soundsCard._qrSlot, qrPayload(unit));
    status("");
  }

  function setSide(side, quiet) {
    state.side = side === "handwriting" ? "handwriting" : "sounds";
    if (soundsCard) soundsCard.classList.toggle("is-on", state.side === "sounds");
    if (handCard) handCard.classList.toggle("is-on", state.side === "handwriting");
    var s = $("sideSoundsBtn"), h = $("sideHandBtn");
    if (s) s.setAttribute("aria-pressed", String(state.side === "sounds"));
    if (h) h.setAttribute("aria-pressed", String(state.side === "handwriting"));
    var clear = $("clearBtn");
    if (clear) clear.hidden = state.side !== "handwriting";
    if (!quiet) {
      fitStage();
      if (state.side === "handwriting") layoutHand(); else layoutSounds();
    }
  }

  // The bookmark is a fixed 200px wide; only a very narrow phone (or the
  // both-sides print preview) needs it scaled, and pointer capture maps
  // through getBoundingClientRect so tracing still lands where it looks.
  function fitStage(both) {
    if (!stage || !stageWrap) return;
    var cards = both ? 2 : (stage.querySelectorAll(".bm.is-on").length || 1);
    var need = cards * 200 + (cards - 1) * 24;
    var avail = stageWrap.clientWidth || need;
    var k = Math.min(1, avail / need);
    state.scale = k;
    stage.style.transform = k < 1 ? "scale(" + k.toFixed(4) + ")" : "";
    stageWrap.style.height = Math.ceil(794 * k) + "px";
  }

  // ============================================================
  // boot
  // ============================================================
  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  function pickUnit(levelParam) {
    var units = state.units;
    if (!units.length) return -1;
    var n = parseInt(levelParam, 10);
    if (!isFinite(n)) return 0;
    if (n >= 1 && n <= units.length) return n - 1;           // 1-based position
    for (var i = 0; i < units.length; i++) if (units[i].n === n) return i;
    return 0;
  }

  function fillLevelSelect() {
    var sel = $("levelSelect");
    if (!sel) return;
    sel.innerHTML = "";
    state.units.forEach(function (u, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = u.label || ("Level " + u.n);
      sel.appendChild(o);
    });
    sel.value = String(state.index);
  }

  function writeUrl() {
    if (!window.history || !history.replaceState) return;
    var seq = PhonicsBank.seq();
    var q = "?seq=" + encodeURIComponent((seq && seq.id) || "") + "&level=" + (state.index + 1);
    try { history.replaceState(null, "", q); } catch (e) { /* file:// */ }
  }

  function loadLetterforms() {
    return fetch(STYLE_FILE).then(function (r) {
      if (!r.ok) throw new Error("letterforms failed to load (" + r.status + ")");
      return r.json();
    }).then(function (json) {
      state.letters = (json && json.letters) || null;
      if (!state.letters) state.lettersError = "That handwriting style has no letter models.";
    }).catch(function (e) {
      state.letters = null;
      state.lettersError = "The letter models didn't load — " + (e && e.message ? e.message : "try refreshing") + ".";
    });
  }

  function wireControls() {
    var sel = $("levelSelect");
    if (sel) sel.addEventListener("change", function () {
      var i = parseInt(sel.value, 10);
      if (!isFinite(i) || !state.units[i]) return;
      state.index = i;
      state.unit = state.units[i];
      writeUrl();
      render();
    });

    var s = $("sideSoundsBtn"), h = $("sideHandBtn");
    if (s) s.addEventListener("click", function () { setSide("sounds"); });
    if (h) h.addEventListener("click", function () { setSide("handwriting"); });

    var clear = $("clearBtn");
    if (clear) clear.addEventListener("click", clearAllLanes);

    var print = $("printBtn");
    if (print) print.addEventListener("click", function () { window.print(); });

    // Tapping a sound line plays that sound; tapping its example word plays
    // the word. One delegated listener for the whole stage.
    stage.addEventListener("click", function (e) {
      var word = e.target.closest && e.target.closest("[data-word]");
      if (word) {
        e.stopPropagation();
        try { PhonicsAudio.playWord(word.dataset.word); } catch (err) { /* ignore */ }
        highlight(word.closest(".bm-snd"));
        return;
      }
      var line = e.target.closest && e.target.closest("[data-gpc]");
      if (line) playLine(line);
    });

    stage.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var line = e.target.closest && e.target.closest("[data-gpc]");
      if (!line) return;
      e.preventDefault();
      playLine(line);
    });

    var t = 0;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        fitStage();
        layoutSounds();
        layoutHand();
      }, 140);
    });

    // Print shows BOTH sides — make sure the hidden one has been laid out.
    window.addEventListener("beforeprint", function () {
      if (soundsCard) soundsCard.classList.add("is-on");
      if (handCard) handCard.classList.add("is-on");
      layoutSounds();
      layoutHand();
    });
    window.addEventListener("afterprint", function () { setSide(state.side); });
  }

  function playLine(line) {
    highlight(line);
    var opts = line.dataset.mp4 ? { mp4Stem: line.dataset.mp4 } : {};
    try {
      Promise.resolve(PhonicsAudio.playGpc(line.dataset.gpc, opts)).catch(function () {});
    } catch (e) { /* audio never breaks the page */ }
  }

  function highlight(line) {
    if (!line) return;
    stage.querySelectorAll(".bm-snd.is-on").forEach(function (n) { n.classList.remove("is-on"); });
    line.classList.add("is-on");
  }

  function boot() {
    stage = $("stage");
    stageWrap = $("stageWrap");
    statusBox = $("statusBox");

    if (!window.PhonicsBank) {
      status("The data bank didn't load — check js/core/data.js is on the page.", true);
      return;
    }

    var wanted = param("seq");
    var level = param("level");

    status("Getting your bookmark ready…");

    var opts = { base: "" };
    if (wanted) opts.sequenceId = wanted;

    PhonicsBank.load(opts)
      .then(function () { return loadLetterforms(); })
      .then(function () {
        state.units = PhonicsBank.graphemeView() || [];
        if (!state.units.length) throw new Error("that program has no levels yet");
        state.index = Math.max(0, pickUnit(level));
        state.unit = state.units[state.index];
        fillLevelSelect();
        wireControls();
        writeUrl();
        render();
      })
      .catch(function (e) {
        status("Couldn't build the bookmark: " + (e && e.message ? e.message : e) +
          ". Try opening it from the trainer's tracker again.", true);
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
