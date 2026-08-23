// ============================================================
// anatomy.js — the animated vocal-tract cutaway.
//
// This is the SAME diagram the Pronunciation Hub shows live
// (ELC-Pages/pronunciation-enhancer.part*.txt — the "anatomy"
// enhancement). Ported here so the phonics trainer and the hub
// show students one consistent picture of the mouth. If the
// artwork changes in one place, change it in the other.
//
// Coordinate system: viewBox 0 0 88 110, head facing LEFT.
// Tongue position uses the vowel-chart axes the hub uses:
//   x  0 = front (towards the teeth) -> 100 = back (pharynx)
//   y  0 = close (tongue near the palate) -> 100 = open (jaw down)
// ============================================================

window.Anatomy = (() => {

  /* where each consonant is made, in viewBox coordinates */
  const SPOTS = {
    "Bilabial":[7.5,41.5], "Labio-dental":[12.5,42.2], "Dental":[18.2,40.2],
    "Alveolar":[25.6,34.3], "Post-alveolar":[34.5,31.5], "Palatal":[42,29],
    "Velar":[56.5,34.5], "Glottal":[64,91]
  };

  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  /* the cutaway itself — head, cavities, palate, teeth, lips, jaw,
     tongue, velum, pharynx, larynx, vocal folds and the airflow paths */
  function parts(place) {
    const spot = place && SPOTS[place];
    const marker = spot ? `
      <circle class="an-place-ring" cx="${spot[0]}" cy="${spot[1]}" r="4.8"/>
      <circle class="an-place" cx="${spot[0]}" cy="${spot[1]}" r="2.2"/>` : "";
    return `
      <path class="an-tissue" d="M38,2 C22,2 11,9 8,22 C7,26 8,29 3,32 C1,34 2,37 7,38
        C5,40 5,43 8,45 C6,49 7,54 11,57 C8,63 11,71 18,77 C24,83 29,90 30,108
        L79,108 C78,96 77,86 79,73 C82,57 87,42 85,26 C83,10 69,2 54,2 Z"/>
      <path class="an-cavity" d="M7,29 C16,19 29,14 44,15 C53,15 60,18 65,23 C59,24 55,27 52,31
        C42,29 31,30 23,33 C17,35 12,35 7,34 Z"/>
      <path class="an-cavity" d="M10,39 C18,35 26,34 36,34 C47,34 57,38 61,46 C64,52 65,61 64,68
        C60,66 56,63 51,60 C40,56 27,55 16,58 C12,54 10,48 10,39 Z"/>
      <path class="an-cavity" d="M61,43 C68,44 71,51 70,61 L69,78 C69,84 72,90 72,108 L58,108
        C58,96 60,88 59,80 C58,71 57,61 58,53 C58,49 59,46 61,43 Z"/>
      <path class="an-palate" d="M21,35 Q34,25 49,26 Q55,27 59,31"/>
      <path class="an-outline" d="M8,33 Q14,36 21,35"/>
      <rect class="an-tooth" x="17" y="34" width="4.2" height="8" rx="1"/>
      <rect class="an-tooth" x="17.7" y="48" width="4.1" height="7" rx="1" transform="rotate(5 19.7 51.5)"/>
      <path class="an-lip an-upper-lip" d="M8,38 Q4.8,39.6 7.8,42 Q12,42.4 16,41"/>
      <path class="an-lip an-lower-lip" d="M8,45 Q4.8,43.5 8,42.2 Q12,42 16,43.4"/>
      <g class="an-jaw">
        <path class="an-jawbone" d="M20,52 Q26,69 43,74 Q55,76 66,63"/>
      </g>
      <path class="an-tongue" d="M20,49 C25,43 34,41 43,42 C52,43 58,49 59,59
        C60,68 57,73 50,75 C39,78 26,69 21,59 C19,55 18,52 20,49 Z"/>
      <path class="an-velum" d="M58,31 Q65,34 63,42"/>
      <ellipse class="an-uvula" cx="62.3" cy="43.5" rx="1.5" ry="2.6"/>
      <path class="an-pharynx" d="M68,43 Q71,56 68,72 Q66,80 67,87"/>
      <path class="an-epiglottis" d="M58,78 Q63,73 66,79 Q62,82 60,87"/>
      <path class="an-larynx" d="M58,88 Q64,85 71,89 M58,94 L72,94 M58,100 L72,100"/>
      <g class="an-vocal-folds"><path d="M61,90.5 L65,92.3"/><path d="M68,90.5 L65,92.3"/></g>
      <path class="an-air an-oral-air" d="M65,101 C65,88 64,75 64,63 C61,54 52,47 43,44 C32,41 20,42 8,42"/>
      <path class="an-air an-nasal-air" d="M65,101 C65,84 68,69 67,52 C66,38 58,25 45,22 C31,19 17,24 7,32"/>
      ${marker}`;
  }

  // One cutaway. `place` draws the contact marker (consonants only).
  function svg(opts) {
    const o = opts || {};
    const place = o.place || null;
    const label = o.label || (place ? place + " place of articulation" : "vocal tract");
    /* margin on every side so the head doesn't run flush to the card edge —
       a tight crop against the artwork's own bounds read as "zoomed in" */
    return `<svg class="anatomy ${o.cls || ""}" viewBox="-7 -8 102 128" role="img"
      aria-label="${esc("Side view of the mouth: " + label)}"
      ${place ? `data-place="${esc(place)}"` : ""}
      ${o.manner ? `data-manner="${esc(o.manner)}"` : ""}
      data-voiced="${o.voiced ? 1 : 0}">${parts(place)}</svg>`;
  }

  /* ---- consonants: hold a fixed tongue shape rather than animate ---- */
  function consonantTongue(place, manner) {
    const near = manner === "fricative" || manner === "approximant";
    const gap = near ? 2.1 : .2;
    switch (place) {
      case "Dental":
        return `M15.5,43 C20,39 25,40 33,43 C46,44 57,49 59,60 C60,69 56,74 49,75 C37,77 25,69 20,59 C18,54 16,48 15.5,43 Z`;
      case "Alveolar":
        return `M20,49 C21,${(35 + gap).toFixed(1)} 24,${(33.6 + gap).toFixed(1)} 27,${(34 + gap).toFixed(1)} C35,36 49,39 56,49 C61,58 61,69 54,74 C45,80 31,72 24,63 C20,58 19,53 20,49 Z`;
      case "Post-alveolar":
        return `M20,49 C23,41 28,${(33 + gap).toFixed(1)} 35,${(31.7 + gap).toFixed(1)} C43,31 54,39 58,50 C62,61 59,71 51,75 C40,79 27,69 22,60 C19,55 19,52 20,49 Z`;
      case "Palatal":
        return `M20,49 C24,44 31,37 40,${(32.5 + gap).toFixed(1)} C47,31 55,38 58,49 C61,60 59,71 51,75 C40,79 27,69 22,60 C19,55 19,52 20,49 Z`;
      case "Velar":
        return `M20,49 C28,45 38,44 47,${(39 + gap).toFixed(1)} C52,${(35 + gap).toFixed(1)} 56,${(34 + gap).toFixed(1)} 59,${(37 + gap).toFixed(1)} C62,45 61,61 57,69 C53,77 41,78 31,70 C23,64 18,55 20,49 Z`;
      default:
        return `M20,49 C26,43 35,41 44,42 C53,43 58,49 59,59 C60,68 57,73 50,75 C39,78 26,69 21,59 C19,55 18,52 20,49 Z`;
    }
  }

  // Freeze a cutaway into one consonant's shape: tongue, lips and velum.
  function poseConsonant(el, place, manner) {
    if (!el) return;
    const q = (sel) => el.querySelector(sel);
    const tongue = q(".an-tongue");
    if (tongue) tongue.setAttribute("d", consonantTongue(place, manner));
    const upper = q(".an-upper-lip"), lower = q(".an-lower-lip");
    if (place === "Bilabial") {
      if (upper) upper.setAttribute("d", "M8,38 Q4,40 7,42 Q11,42 15,41.5");
      if (lower) lower.setAttribute("d", "M8,45 Q4,43.5 7,42.2 Q11,42.1 15,42.5");
    } else if (place === "Labio-dental") {
      if (lower) lower.setAttribute("d", "M8,46 Q7,42 12.4,39.8 Q14,40.5 16,42.5");
    }
    if (manner === "nasal") {
      const velum = q(".an-velum"), uvula = q(".an-uvula");
      if (velum) velum.setAttribute("d", "M58,31 Q61,38 59,46");
      if (uvula) { uvula.setAttribute("cx", "58.8"); uvula.setAttribute("cy", "47"); }
    }
  }

  /* ---- vowels and diphthongs: the tract moves ----
     Jaw hinges, the tongue hump travels to the chart position, and the
     lips round on their own axis (so /ʉː/ food is rounded but /iː/ see
     is spread at the same jaw height). */
  const REDUCED = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rounding(x, y) {
    const back = Math.max(0, Math.min(1, (x - 46) / 38));
    const openness = Math.max(0, Math.min(1, (y - 55) / 45));
    return back * (1 - Math.pow(openness, .85));
  }

  // Controller for one cutaway. `pose` eases to a position and stops;
  // `set` does the same but keeps the voicing/airflow animation running.
  function makeCtl(el) {
    if (!el) return null;
    const jaw = el.querySelector(".an-jaw");
    const tongue = el.querySelector(".an-tongue");
    const upperLip = el.querySelector(".an-upper-lip");
    const lowerLip = el.querySelector(".an-lower-lip");
    if (!jaw || !tongue || !upperLip || !lowerLip) return null;

    const IDLE = { x: 50, y: 42 };
    let cur = { ...IDLE }, target = { ...IDLE }, speaking = false, raf = 0;

    function draw() {
      const ease = REDUCED() ? 1 : .25;
      cur.x += (target.x - cur.x) * ease;
      cur.y += (target.y - cur.y) * ease;

      const open = Math.max(0, Math.min(1, cur.y / 100));
      const angle = .8 + Math.pow(open, 1.12) * 10.5;
      jaw.setAttribute("transform", `rotate(${angle.toFixed(2)} 66 54)`);

      const humpX = 32 + (cur.x / 100) * 26;
      const humpY = 34 + (cur.y / 100) * 27;
      const width = 6 + open * 8;
      const tipY = 48 + open * 2.2;
      const rootX = 59 + (cur.x - 50) * .035;
      const rootY = 61 + open * 6;
      tongue.setAttribute("d",
        `M20,${tipY.toFixed(1)} ` +
        `C${(24 + open * 2).toFixed(1)},${(44 + open * 4).toFixed(1)} ${(humpX - width).toFixed(1)},${(humpY + 1).toFixed(1)} ${humpX.toFixed(1)},${humpY.toFixed(1)} ` +
        `C${(humpX + width).toFixed(1)},${(humpY - 1).toFixed(1)} ${rootX.toFixed(1)},${(rootY - 8).toFixed(1)} ${rootX.toFixed(1)},${rootY.toFixed(1)} ` +
        `C${rootX.toFixed(1)},${(rootY + 10).toFixed(1)} 52,76 43,75 ` +
        `C32,74 23,65 20,56 C19,53 19,51 20,${tipY.toFixed(1)} Z`);

      const round = rounding(cur.x, cur.y);
      const protrude = 3.2 * round;
      const gap = 3.2 + open * 3.1 - round * 2.2;
      upperLip.setAttribute("d", `M8,38 Q${(4.8 - protrude).toFixed(1)},${(39.5 - round).toFixed(1)} ${(7.8 - protrude).toFixed(1)},${(40.5 - gap * .16).toFixed(1)} Q12,41.4 16,41`);
      lowerLip.setAttribute("d", `M8,${(42 + gap).toFixed(1)} Q${(4.8 - protrude).toFixed(1)},${(43.5 + gap * .25).toFixed(1)} ${(8 - protrude).toFixed(1)},${(42.3 + gap * .35).toFixed(1)} Q12,42.2 16,43.4`);

      el.classList.toggle("speaking", speaking);
      const moving = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > .25;
      if (speaking || moving) raf = requestAnimationFrame(draw); else raf = 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    draw();

    return {
      el,
      pose(x, y) { target = { x, y }; kick(); },
      set(x, y) { target = { x, y }; speaking = true; kick(); },
      idle() { target = { ...IDLE }; speaking = false; kick(); },
      quiet() { speaking = false; kick(); },
      stop() { if (raf) cancelAnimationFrame(raf); raf = 0; speaking = false; el.classList.remove("speaking"); }
    };
  }

  // Glide from one vowel position to another, once. Returns a cancel fn.
  function glide(ctl, from, to, ms, done) {
    if (!ctl) return () => {};
    if (REDUCED()) { ctl.pose(to[0], to[1]); if (done) done(); return () => {}; }
    const t0 = performance.now();
    const ease = (k) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    let raf = 0, cancelled = false;
    ctl.pose(from[0], from[1]);
    const step = (now) => {
      if (cancelled) return;
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      ctl.pose(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else if (done) done();
    };
    raf = requestAnimationFrame(step);
    return () => { cancelled = true; if (raf) cancelAnimationFrame(raf); };
  }

  // A diphthong tile that glides start -> end, pauses, and repeats.
  function loopGlide(ctl, from, to, opts) {
    const o = opts || {};
    const ms = o.ms || 900, hold = o.hold || 700;
    let stop = null, timer = 0, dead = false;
    if (REDUCED()) { ctl.pose(from[0], from[1]); return { stop() {} }; }
    const run = () => {
      if (dead) return;
      stop = glide(ctl, from, to, ms, () => {
        timer = setTimeout(() => { if (!dead) { ctl.pose(from[0], from[1]); timer = setTimeout(run, 420); } }, hold);
      });
    };
    run();
    return { stop() { dead = true; if (stop) stop(); clearTimeout(timer); } };
  }

  return { svg, parts, makeCtl, poseConsonant, consonantTongue, glide, loopGlide, SPOTS, reduced: REDUCED };
})();
