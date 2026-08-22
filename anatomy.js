// ============================================================
// anatomy.js — the animated vocal-tract cutaway.
//
// This is the SAME diagram the Pronunciation Hub shows live
// (ELC-Pages/pronunciation-enhancer.part*.txt — the "anatomy"
// enhancement). Ported here so the phonics trainer and the hub
// show students one consistent picture of the mouth. If the
// artwork changes in one place, change it in the other.
//
// >>> HUB PORT: copy this file VERBATIM. Everything the consonant
// >>> close-ups need — framing windows, gesture timelines, airflow
// >>> artwork and their CSS — lives in here and is injected at load,
// >>> so no host page or call site has to change. The public API is
// >>> a superset of the old one; old calls behave the same except
// >>> that poseConsonant() now animates (pass {animate:false} for
// >>> the old freeze-in-place behaviour).
//
// Coordinate system: viewBox 0 0 88 110, head facing LEFT.
// Tongue position uses the vowel-chart axes the hub uses:
//   x  0 = front (towards the teeth) -> 100 = back (pharynx)
//   y  0 = close (tongue near the palate) -> 100 = open (jaw down)
//
// Vowels keep the whole head in frame — the point of a vowel is the
// shape of the WHOLE tube. Consonants zoom into the one place the
// sound is made and play that articulation on a loop, because the
// point of a consonant is a gesture: lips closing, a tongue tip
// tapping the ridge, air hissing through a slot.
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
      <rect class="an-tooth an-tooth-lower" x="17.7" y="48" width="4.1" height="7" rx="1" transform="rotate(5 19.7 51.5)"/>
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
    return `<svg class="anatomy ${o.cls || ""}" viewBox="0 0 88 110" role="img"
      aria-label="${esc("Side view of the mouth: " + label)}"
      ${place ? `data-place="${esc(place)}"` : ""}
      ${o.manner ? `data-manner="${esc(o.manner)}"` : ""}
      data-voiced="${o.voiced ? 1 : 0}">${parts(place)}</svg>`;
  }

  /* ============================================================
     CONSONANT CLOSE-UPS
     ============================================================ */

  const FULL_VB = [0, 0, 88, 110];

  /* Per place: [centre x, centre y, window width]. Height is always
     width * 1.25 so the cutaway keeps its 88:110 aspect and the tile
     never changes shape. Each window is tuned so the anatomy that
     actually does the work fills the frame:
       Bilabial / Labio-dental -> lips + front teeth
       Dental / Alveolar / Post-alveolar -> tongue tip, ridge, teeth
       Palatal / Velar -> tongue body + hard palate / velum + uvula
       Glottal -> pharynx, epiglottis, larynx, vocal folds            */
  const WINDOWS = {
    "Bilabial":      [14.5, 42.0, 28],
    "Labio-dental":  [15.0, 41.5, 28],
    "Dental":        [18.0, 41.5, 29],
    "Alveolar":      [24.5, 39.5, 30],
    "Post-alveolar": [31.0, 38.5, 32],
    "Palatal":       [36.5, 38.5, 34],
    "Velar":         [50.0, 39.0, 34],
    "Glottal":       [64.0, 87.5, 30]
  };

  // [x, y, w, h] of the close-up for a place (the full head if unknown).
  function windowFor(place) {
    const wv = WINDOWS[place];
    if (!wv) return FULL_VB.slice();
    const w = wv[2], h = w * 1.25;
    return [wv[0] - w / 2, wv[1] - h / 2, w, h];
  }

  /* Where the air goes once it is past the constriction. Point lists,
     mouth-ward; smoothed into a curve and used for the flow line, the
     stop burst and (reduced motion) the static arrow. */
  const JETS = {
    "Bilabial":      [[12, 42.0], [8.5, 41.8], [5, 41.3], [1.4, 40.6]],
    "Labio-dental":  [[18.4, 41.4], [14, 40.1], [8.5, 39.5], [3.4, 39.2]],
    "Dental":        [[20.5, 42.4], [16, 42.3], [11, 42.0], [5.2, 41.4]],
    "Alveolar":      [[27, 36.4], [22, 38.8], [16, 40.7], [9.5, 41.6]],
    "Post-alveolar": [[35, 33.6], [28, 36.6], [21, 39.6], [13, 41.3]],
    "Palatal":       [[42, 31.6], [34, 34.6], [26, 37.8], [18, 40.4]],
    "Velar":         [[57, 37.6], [50, 38.8], [41, 40.1], [30, 41.0]],
    "Glottal":       [[65, 100], [64.4, 92], [63.4, 82], [61, 71]]
  };

  /* /l/: the tip seals the ridge, so the air slips down and around it. */
  const LATERAL_JET = [[28, 37], [25, 42.5], [19, 47], [12.5, 44.5], [8.5, 42.4]];

  /* nasals: the velum drops and the whole stream leaves through the nose */
  const NASAL_JET = [[60, 33], [55, 27], [45, 23.6], [33, 24.6], [20, 28], [10, 30.6], [3.6, 30.4]];

  /* the seal, drawn thick and red the moment the articulators meet */
  const CONTACTS = {
    "Bilabial":      [[6.0, 41.9], [11.0, 41.9]],
    "Labio-dental":  [[13.5, 41.0], [19.6, 41.9]],
    "Dental":        [[14.4, 43.6], [19.2, 42.4]],
    "Alveolar":      [[23.6, 34.6], [28.8, 34.6]],
    "Post-alveolar": [[32.2, 32.2], [38.2, 32.6]],
    "Palatal":       [[39.4, 29.6], [45.4, 30.4]],
    "Velar":         [[51.5, 34.4], [58.2, 35.8]]
  };

  const MANNERS = {
    stop: "stop", plosive: "stop",
    affricate: "affricate", nasal: "nasal",
    lateral: "lateral", "lateral approximant": "lateral",
    approximant: "approximant", glide: "approximant",
    fricative: "fricative", sibilant: "fricative"
  };
  // data.js says "stop", mouth.js says "plosive" — same gesture either way.
  const mannerOf = (m) => MANNERS[String(m || "").toLowerCase()] || "fricative";

  /* how close the articulators end up, in viewBox units of daylight */
  const TARGET_GAP = { stop: .15, affricate: .15, nasal: .15, lateral: .2, approximant: 2.9, fricative: 2.2 };
  const REST_GAP = { "Alveolar": 7.5, "Post-alveolar": 7.5, "Palatal": 7, "Velar": 6 };

  /* one loop, in ms, plus a beat of stillness before it repeats */
  const BEATS = { stop: 1900, affricate: 2200, nasal: 2100, fricative: 2000, lateral: 2000, approximant: 1900 };
  const PAUSE = 300;
  /* the frame a still picture should show: closed / narrowest */
  const HOLD = { stop: .40, affricate: .60, nasal: .50, fricative: .50, lateral: .50, approximant: .50 };

  const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
  const seg = (u, a, b) => clamp01((u - a) / (b - a));
  const easeInOut = (k) => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const mix = (a, b, k) => a + (b - a) * k;
  const f2 = (n) => String(Math.round(n * 100) / 100);

  /* The gesture, as a function of normalised time u (0..1).
       c     0 = articulators apart, 1 = at the target constriction
       gap   the target daylight at this instant (affricates change it
             mid-gesture: stop closure, then a fricative slot)
       flow  turbulent oral airflow
       nose  nasal airflow
       pop / popR  the release burst and how far it has travelled
       voice voicing envelope                                          */
  function gesture(manner, u) {
    const g = { c: 0, gap: TARGET_GAP[manner], flow: 0, nose: 0, pop: 0, popR: 0, voice: 0 };
    if (manner === "stop") {
      g.c = easeInOut(seg(u, .02, .24)) * (1 - easeOut(seg(u, .55, .70)));
      g.pop = Math.min(1, seg(u, .54, .58)) * (1 - easeOut(seg(u, .58, .86)));
      g.popR = seg(u, .55, .88);
      g.flow = Math.min(1, seg(u, .55, .60)) * (1 - seg(u, .62, .92));
      g.voice = Math.min(1, seg(u, .04, .12)) * (1 - seg(u, .80, .92));
    } else if (manner === "affricate") {
      g.c = easeInOut(seg(u, .02, .18)) * (1 - easeOut(seg(u, .86, .98)));
      g.gap = mix(.15, 2.3, easeInOut(seg(u, .36, .48)));
      g.pop = Math.min(1, seg(u, .36, .40)) * (1 - easeOut(seg(u, .40, .62)));
      g.popR = seg(u, .37, .64);
      g.flow = Math.min(1, seg(u, .42, .52)) * (1 - seg(u, .82, .94));
      g.voice = Math.min(1, seg(u, .04, .12)) * (1 - seg(u, .86, .96));
    } else if (manner === "nasal") {
      g.c = easeInOut(seg(u, .02, .20)) * (1 - easeOut(seg(u, .84, .97)));
      g.nose = Math.min(1, seg(u, .16, .30)) * (1 - seg(u, .82, .95));
      g.voice = Math.min(1, seg(u, .06, .16)) * (1 - seg(u, .84, .96));
    } else if (manner === "lateral") {
      g.c = easeInOut(seg(u, .02, .22)) * (1 - easeOut(seg(u, .82, .97)));
      g.flow = Math.min(1, seg(u, .18, .32)) * (1 - seg(u, .80, .94));
      g.voice = Math.min(1, seg(u, .06, .16)) * (1 - seg(u, .82, .95));
    } else if (manner === "approximant") {
      g.c = easeInOut(seg(u, .02, .28)) * (1 - easeOut(seg(u, .78, .96)));
      g.flow = Math.min(1, seg(u, .20, .36)) * (1 - seg(u, .76, .92));
      g.voice = Math.min(1, seg(u, .06, .18)) * (1 - seg(u, .80, .94));
    } else {                                   /* fricative */
      g.c = easeInOut(seg(u, .02, .20)) * (1 - easeOut(seg(u, .82, .97)));
      g.flow = Math.min(1, seg(u, .16, .28)) * (1 - seg(u, .80, .94));
      g.voice = Math.min(1, seg(u, .06, .16)) * (1 - seg(u, .82, .95));
    }
    return g;
  }

  /* ---- the articulators, as functions of one number each ---- */

  // tongue for a place, with `gap` units of daylight under the constriction
  // (the shape the pre-close-up poseConsonant froze into — kept as-is so
  //  consonantTongue() still returns exactly what it always did)
  function tonguePath(place, gap) {
    const g = gap;
    switch (place) {
      case "Alveolar":
        return `M20,49 C21,${(35 + g).toFixed(1)} 24,${(33.6 + g).toFixed(1)} 27,${(34 + g).toFixed(1)} C35,36 49,39 56,49 C61,58 61,69 54,74 C45,80 31,72 24,63 C20,58 19,53 20,49 Z`;
      case "Post-alveolar":
        return `M20,49 C23,41 28,${(33 + g).toFixed(1)} 35,${(31.7 + g).toFixed(1)} C43,31 54,39 58,50 C62,61 59,71 51,75 C40,79 27,69 22,60 C19,55 19,52 20,49 Z`;
      case "Palatal":
        return `M20,49 C24,44 31,37 40,${(32.5 + g).toFixed(1)} C47,31 55,38 58,49 C61,60 59,71 51,75 C40,79 27,69 22,60 C19,55 19,52 20,49 Z`;
      case "Velar":
        return `M20,49 C28,45 38,44 47,${(39 + g).toFixed(1)} C52,${(35 + g).toFixed(1)} 56,${(34 + g).toFixed(1)} 59,${(37 + g).toFixed(1)} C62,45 61,61 57,69 C53,77 41,78 31,70 C23,64 18,55 20,49 Z`;
      default:
        return `M20,49 C26,43 35,41 44,42 C53,43 58,49 59,59 C60,68 57,73 50,75 C39,78 26,69 21,59 C19,55 18,52 20,49 Z`;
    }
  }

  /* Close-up tongues. Same tongue, drawn with a blade you can actually
     see: the tip (or body) rises to the constriction and the part behind
     it dips away, so at this magnification you read "tip on the ridge"
     rather than "the whole tongue is pressed to the roof". */
  function gestureTongue(place, gap) {
    const g = gap;
    switch (place) {
      case "Alveolar":
        return `M19,50 C19,46 20,43 22.6,${f2(40.6 + g * .9)} C23.6,${f2(38.6 + g)} 24.6,${f2(35.6 + g)} 26.6,${f2(34.6 + g)}` +
          ` C28.8,${f2(33.9 + g)} 30.6,${f2(36.2 + g * .8)} 33,${f2(38.8 + g * .75)} C40,${f2(41.4 + g * .35)} 50,43.4 56,50` +
          ` C61,58 60,69 53,74 C44,80 30,72 23,63 C19,58 18,53 19,50 Z`;
      case "Post-alveolar":
        return `M19,50 C19,46 20,43.6 23,42 C25.8,40.4 29.6,${f2(33.4 + g)} 32,${f2(32.4 + g)}` +
          ` C34.6,${f2(31.4 + g)} 36.8,${f2(32.4 + g)} 38.8,${f2(34.6 + g)} C44,${f2(38.4 + g * .5)} 51,${f2(42.6 + g * .2)} 56,50` +
          ` C61,58 60,69 53,74 C44,80 30,72 23,63 C19,58 18,53 19,50 Z`;
      case "Palatal":
        return `M19,50 C19,46 20,43.6 23,42 C28.5,40.6 35.5,${f2(31.6 + g)} 38.5,${f2(30.4 + g)}` +
          ` C41.5,${f2(29.2 + g)} 44.5,${f2(30.4 + g)} 46.5,${f2(32.6 + g)} C50.5,${f2(36.4 + g * .5)} 54.5,${f2(42.6 + g * .2)} 57,50` +
          ` C61,58 60,69 53,74 C44,80 30,72 23,63 C19,58 18,53 19,50 Z`;
      case "Velar":
        return `M19,50 C20,46 23,44 28,43.6 C34,${f2(43.1 + g * .25)} 42,${f2(41.4 + g * .7)} 47,${f2(37.8 + g)}` +
          ` C50.5,${f2(35.2 + g)} 54.4,${f2(34.2 + g)} 57.6,${f2(36.6 + g)} C61,41 61.5,52 58,63` +
          ` C54,74 41,78 31,70 C23,64 18,55 19,50 Z`;
      default:
        return tonguePath(null, 0);
    }
  }

  // /θ/ /ð/: t = 0 tongue back inside, t = 1 tip out between the teeth
  // (the upper teeth bite at y 42, the lower at y 48 — the tip lands between)
  function dentalTongue(t) {
    const tx = 20 - 6 * t, ty = 46 - 1.2 * t;
    return `M${f2(tx)},${f2(ty)} C${f2(tx + 3)},${f2(ty - 4)} 25,40.5 33,43 C46,44 57,49 59,60 C60,69 56,74 49,75 C37,77 25,69 20,59 C18,54 16,48.5 ${f2(tx)},${f2(ty)} Z`;
  }

  /* ---- consonants: the fixed shape each place holds ----
     (unchanged output — poseConsonant's freeze mode and the hub's older
     call sites both rely on it) */
  const DENTAL_LEGACY = "M15.5,43 C20,39 25,40 33,43 C46,44 57,49 59,60 C60,69 56,74 49,75 C37,77 25,69 20,59 C18,54 16,48 15.5,43 Z";
  function consonantTongue(place, manner) {
    if (place === "Dental") return DENTAL_LEGACY;
    const near = manner === "fricative" || manner === "approximant";
    return tonguePath(place, near ? 2.1 : .2);
  }

  /* ---- lips ----
     At full-head size the lips are two little strokes. Zoomed in they
     have to read as lips, so the close-ups draw the same two lips as
     closed cross-sections: outer vermilion, free edge, inner surface.
     Twelve points in path order: P0 c1 c2 P1 c3 c4 P2 c5 c6 P3 c7 c8. */
  function lipPath(p) {
    const n = p.map((q) => f2(q[0]) + "," + f2(q[1]));
    return `M${n[0]} C${n[1]} ${n[2]} ${n[3]} C${n[4]} ${n[5]} ${n[6]} C${n[7]} ${n[8]} ${n[9]} C${n[10]} ${n[11]} ${n[0]} Z`;
  }

  const UPPER = [[9.0,37.6],[6.4,37.8],[4.5,39.0],[4.5,40.7],[4.6,41.8],[6.4,42.1],
                 [8.8,42.1],[10.8,42.1],[12.8,41.6],[13.8,40.5],[13.0,39.3],[11.2,38.0]];
  const UP_LIFT = [.12,.28,.6,.8,.95,1,1,.95,.7,.45,.34,.2];
  const UP_FWD  = [0,.4,1,1,1,.6,.3,.1,0,0,0,0];
  const LOWER = [[9.0,45.9],[6.4,45.6],[4.6,44.5],[4.6,43.2],[4.7,42.2],[6.4,41.9],
                 [8.8,41.9],[10.8,41.9],[12.8,42.5],[13.9,43.7],[13.0,44.8],[11.2,45.7]];
  const LO_DROP = [.5,.55,.7,.8,.95,1,1,.95,.7,.45,.42,.48];
  const LO_FWD  = [0,.4,1,1,1,.6,.35,.1,0,0,0,.35];
  /* /f/ /v/: the bottom lip rides up and back onto the top teeth */
  const LOWER_BITE = [[9.8,45.9],[7.6,45.5],[6.2,44.3],[6.4,42.9],[7.4,41.6],[11.2,40.9],
                      [14.8,40.8],[17.0,40.9],[18.6,41.5],[19.6,42.9],[15.2,44.6],[12.0,45.7]];

  // open 0 = sealed .. 1 = well apart; round 0 = spread .. 1 = pushed forward
  function upperLipPath(open, round) {
    return lipPath(UPPER.map((q, i) => [q[0] - 3.6 * round * UP_FWD[i], q[1] - 3.1 * open * UP_LIFT[i]]));
  }
  function lowerLipPath(open, round, bite) {
    const b = bite || 0;
    return lipPath(LOWER.map((q, i) => {
      const x = mix(q[0] - 3.6 * round * LO_FWD[i], LOWER_BITE[i][0], b);
      const y = mix(q[1] + 3.6 * open * LO_DROP[i], LOWER_BITE[i][1], b);
      return [x, y];
    }));
  }

  // where each place parks the lips at full constriction: [open, round]
  function lipTarget(place, manner) {
    if (place === "Bilabial") return manner === "approximant" ? [.22, 1] : [0, .12];
    if (place === "Labio-dental") return [1.45, 0];
    if (place === "Dental") return [.8, 0];
    if (place === "Glottal") return [.95, 0];
    return [.8, 0];
  }

  /* a point list, smoothed into one curve */
  function smooth(pts) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${f2(p1[0] + (p2[0] - p0[0]) / 6)},${f2(p1[1] + (p2[1] - p0[1]) / 6)}` +
           ` ${f2(p2[0] - (p3[0] - p1[0]) / 6)},${f2(p2[1] - (p3[1] - p1[1]) / 6)}` +
           ` ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function mk(tag, cls, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (cls) n.setAttribute("class", cls);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---- the contact / airflow / voicing overlay, built once per cutaway ---- */
  function ensureFx(el) {
    let fx = el.querySelector(".an-fx");
    if (fx && fx.__g) return fx;
    fx = mk("g", "an-fx", el);
    const g = {
      root: fx,
      seal: mk("path", "an-fx-seal", fx),
      stream: mk("g", "an-fx-stream", fx),
      buzz: mk("g", "an-fx-buzz", fx)
    };
    g.jet = mk("path", "an-fx-jet", g.stream);
    g.jet2 = mk("path", "an-fx-jet an-fx-jet2", g.stream);
    g.puff = mk("path", "an-fx-jet an-fx-puff", g.stream);
    g.arrow = mk("path", "an-fx-arrow", g.stream);
    const bg = mk("rect", "an-fx-buzz-bg", g.buzz);
    g.buzzDot = mk("circle", "an-fx-buzz-dot", g.buzz);
    g.buzzW1 = mk("path", "an-fx-buzz-wave", g.buzz);
    g.buzzW2 = mk("path", "an-fx-buzz-wave", g.buzz);
    bg.setAttribute("x", -9); bg.setAttribute("y", -6.5);
    bg.setAttribute("width", 18); bg.setAttribute("height", 13); bg.setAttribute("rx", 4);
    g.buzzDot.setAttribute("cx", -4.4); g.buzzDot.setAttribute("cy", 0); g.buzzDot.setAttribute("r", 2.2);
    g.buzzW1.setAttribute("d", "M-1,-3.4 A4,4 0 0 1 -1,3.4");
    g.buzzW2.setAttribute("d", "M2.4,-5.4 A6.4,6.4 0 0 1 2.4,5.4");
    fx.__g = g;
    return fx;
  }

  /* ---- one shared ticker drives every close-up on the page ---- */
  const live = new Set();
  let tick = 0, lastFrame = 0, stagger = 0;
  function frame(now) {
    tick = 0;
    let want = false;
    if (now - lastFrame >= 26) {
      lastFrame = now;
      live.forEach((a) => {
        if (a.el.isConnected === false) { a.stop(); return; }   // tile was rebuilt
        if (a.visible) a.render(now);
      });
    }
    live.forEach((a) => { if (a.visible) want = true; });
    if (want) tick = requestAnimationFrame(frame);
  }
  function kick() { if (!tick && live.size) tick = requestAnimationFrame(frame); }

  let seer = null;
  function watch(anim) {
    if (typeof IntersectionObserver !== "function") { anim.visible = true; return; }
    if (!seer) {
      seer = new IntersectionObserver((rows) => {
        rows.forEach((r) => { if (r.target.__anAnim) r.target.__anAnim.visible = r.isIntersecting; });
        kick();
      }, { rootMargin: "80px" });
    }
    seer.observe(anim.el);
  }

  const REDUCED = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Animate one cutaway through its consonant gesture, on a loop.
     opts: {place, manner, voiced, zoom, animate, at}
       zoom    false keeps the whole head in frame (default true)
       animate false renders one still frame (default true)
       at      0..1 — render the gesture frozen at that point
     Returns {stop(), seek(u)}.                                       */
  function animateConsonant(el, opts) {
    if (!el) return { stop() {}, seek() {} };
    stopConsonant(el);

    const o = opts || {};
    const place = o.place || el.getAttribute("data-place") || null;
    let manner = mannerOf(o.manner != null ? o.manner : el.getAttribute("data-manner"));
    // English's one alveolar approximant is /l/, and it is lateral — the tip
    // seals the ridge and the air goes round it. (data/phonemes.json says
    // "lateral" outright; mouth.js's older table just says "approximant".)
    if (manner === "approximant" && place === "Alveolar") manner = "lateral";
    const voiced = o.voiced != null ? !!o.voiced : el.getAttribute("data-voiced") === "1";
    const zoom = o.zoom !== false && !!WINDOWS[place];
    const still = o.animate === false || o.at != null || REDUCED();
    const frozen = o.at != null ? clamp01(o.at) : HOLD[manner];

    const q = (s) => el.querySelector(s);
    const tongue = q(".an-tongue"), upper = q(".an-upper-lip"), lower = q(".an-lower-lip");
    const velum = q(".an-velum"), uvula = q(".an-uvula"), jaw = q(".an-jaw");
    const folds = q(".an-vocal-folds"), foldA = folds && folds.children[0], foldB = folds && folds.children[1];
    const lowTooth = q(".an-tooth-lower");
    const ring = q(".an-place-ring"), dot = q(".an-place");
    const fx = ensureFx(el).__g;

    const win = zoom ? windowFor(place) : FULL_VB.slice();
    const W = win[2], H = win[3];
    const beat = BEATS[manner], period = beat + PAUSE;

    const jetPts = manner === "lateral" ? LATERAL_JET : (JETS[place] || JETS.Alveolar);
    const jetD = smooth(jetPts);
    const noseD = smooth(NASAL_JET);
    const tipP = jetPts[jetPts.length - 1], preP = jetPts[jetPts.length - 2];
    const noseTip = NASAL_JET[NASAL_JET.length - 1], nosePre = NASAL_JET[NASAL_JET.length - 2];
    const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;

    const gapRest = REST_GAP[place] || 7.5;
    const lipT = lipTarget(place, manner);
    const restLip = place === "Bilabial" ? 1 : Math.min(1.15, lipT[0] + .1);
    const spot = SPOTS[place] || [44, 44];
    const seal = CONTACTS[place];

    if (zoom) el.classList.add("an-zoom"); else el.classList.remove("an-zoom");

    /* everything below is sized off the window, so a burst reads the same
       size on screen whether the crop is 28 units wide or 36 */
    const jetW = W * .036, jet2W = W * .026;
    if (ring) ring.setAttribute("r", f2(zoom ? W * .085 : 4.8));
    if (dot) dot.setAttribute("r", f2(zoom ? W * .022 : 2.2));

    // the throat-buzz badge sits in the same corner of every close-up
    const bs = zoom ? W * .0155 : .55;
    fx.buzz.setAttribute("transform",
      `translate(${f2(win[0] + W - 9 * bs - W * .045)},${f2(win[1] + H - 6.5 * bs - W * .045)}) scale(${f2(bs)})`);
    fx.buzz.setAttribute("stroke-width", "1.1");
    fx.buzz.style.display = voiced ? "" : "none";

    fx.root.style.opacity = 1;
    fx.jet.setAttribute("stroke-width", f2(jetW));
    fx.jet2.setAttribute("stroke-width", f2(jet2W));
    fx.puff.setAttribute("stroke-width", f2(jetW));

    if (seal) {
      fx.seal.setAttribute("d", `M${seal[0][0]},${seal[0][1]} L${seal[1][0]},${seal[1][1]}`);
      fx.seal.setAttribute("stroke-width", f2(W * .042));
    }

    /* the burst: short marks flying out along the jet */
    const dir = [jetPts[2][0] - jetPts[0][0], jetPts[2][1] - jetPts[0][1]];
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    const ux = dir[0] / dl, uy = dir[1] / dl, nx = -uy, ny = ux;
    function puffPath(travel) {
      const base = W * .09 + travel * W * .24, len = W * .11, off = W * .055;
      let d = "";
      for (let i = -1; i <= 1; i++) {
        const ox = spot[0] + nx * off * i + ux * (base + Math.abs(i) * W * .03);
        const oy = spot[1] + ny * off * i + uy * (base + Math.abs(i) * W * .03);
        d += `M${f2(ox)},${f2(oy)} L${f2(ox + ux * len)},${f2(oy + uy * len)} `;
      }
      return d;
    }

    const anim = {
      el, visible: true, place, manner, voiced,
      render(now) { paint(now); },
      stop() {
        live.delete(anim);
        if (el.__anAnim === anim) delete el.__anAnim;
        if (seer) { try { seer.unobserve(el); } catch (e) {} }
      },
      // freeze on one frame of the gesture (print, tests, step-through)
      seek(u) { intro = 1; live.delete(anim); paint(1000, clamp01(u)); }
    };

    let t0 = null, intro = still ? 1 : 0, introT0 = null, framed = false;

    function paint(now, forced) {
      const u = forced != null ? forced : (still ? frozen : ((now - t0) % period) / beat);
      const uu = Math.min(1, u);
      const g = gesture(manner, uu);
      const t = now == null ? 0 : now / 1000;

      /* --- framing --- */
      if (zoom) {
        if (intro < 1 && now != null) {
          if (introT0 == null) introT0 = now;
          intro = clamp01((now - introT0) / 650);
        }
        if (intro < 1 || !framed) {              // stop rewriting once we have landed
          const k = easeOut(intro);
          el.setAttribute("viewBox", [0, 1, 2, 3].map((i) => f2(mix(FULL_VB[i], win[i], k))).join(" "));
          framed = intro >= 1;
        }
      } else if (!framed) {
        el.setAttribute("viewBox", FULL_VB.join(" "));
        framed = true;
      }

      /* --- tongue --- */
      if (tongue) {
        if (place === "Dental") tongue.setAttribute("d", dentalTongue(.95 * g.c));
        else if (place === "Bilabial" && manner === "approximant")
          tongue.setAttribute("d", gestureTongue("Velar", mix(6, 3.2, g.c)));   // /w/ is labial AND velar
        else if (place === "Bilabial" || place === "Labio-dental" || place === "Glottal")
          tongue.setAttribute("d", tonguePath(null, 0));
        else tongue.setAttribute("d", gestureTongue(place, mix(gapRest, g.gap, g.c)));
      }

      /* --- lips --- */
      if (upper && lower) {
        if (place === "Labio-dental") {
          upper.setAttribute("d", upperLipPath(mix(1, 1.45, g.c), 0));
          lower.setAttribute("d", lowerLipPath(.9, 0, .94 * g.c));
        } else {
          const open = mix(restLip, lipT[0], g.c), round = lipT[1] * g.c;
          upper.setAttribute("d", upperLipPath(open, round));
          lower.setAttribute("d", lowerLipPath(open, round, 0));
        }
      }
      if (lowTooth) {
        const rise = (place === "Bilabial" || place === "Labio-dental") ? 1.4 * g.c : 0;
        lowTooth.setAttribute("transform", `rotate(5 19.7 51.5) translate(0,${f2(-rise)})`);
      }
      if (jaw) {
        const close = (place === "Bilabial" || place === "Labio-dental" || place === "Dental") ? g.c : g.c * .35;
        jaw.setAttribute("transform", `rotate(${f2(mix(5.2, 1.3, close))} 66 54)`);
      }

      /* --- velum: down for nasals, up for everything else --- */
      if (velum) {
        const n = manner === "nasal" ? g.c : 0;
        velum.setAttribute("d", `M58,31 Q${f2(mix(65, 61, n))},${f2(mix(34, 38, n))} ${f2(mix(63, 59, n))},${f2(mix(42, 46, n))}`);
        if (uvula) {
          uvula.setAttribute("cx", f2(mix(62.3, 58.8, n)));
          uvula.setAttribute("cy", f2(mix(43.5, 47, n)));
        }
      }

      /* --- vocal folds: /h/ blows them apart; voice makes them buzz --- */
      if (foldA && foldB) {
        const ap = place === "Glottal" ? 1.9 * g.c : 0;
        foldA.setAttribute("d", `M61,90.5 L${f2(65 - ap)},92.3`);
        foldB.setAttribute("d", `M68,90.5 L${f2(65 + ap)},92.3`);
      }
      if (folds) {
        const buzz = voiced && !still ? 1 + .22 * Math.sin(t * 44) * g.voice : 1;
        folds.setAttribute("transform", `translate(65,91.4) scale(${f2(buzz)},1) translate(-65,-91.4)`);
      }

      /* --- the seal: red only while the two articulators really touch.
             `aperture` is the daylight left at the constriction, so an
             affricate loses its seal the instant the slot opens. --- */
      if (seal) {
        let aperture;
        if (place === "Bilabial") aperture = mix(restLip, lipT[0], g.c) * 3.2;
        else if (place === "Labio-dental") aperture = (1 - .94 * g.c) * 3;
        else if (place === "Dental") aperture = (1 - .95 * g.c) * 3;
        else aperture = mix(gapRest, g.gap, g.c);
        fx.seal.style.opacity = f2(.95 * clamp01((.7 - aperture) / .5));
      } else {
        fx.seal.style.opacity = 0;
      }

      /* --- the place marker tracks the gesture: the ring closes in and
             the dot lights up as the articulators arrive --- */
      if (zoom) {
        if (ring) {
          ring.setAttribute("r", f2(W * (.105 - .048 * g.c)));
          ring.style.opacity = f2(.28 + .45 * g.c);
        }
        if (dot) dot.style.opacity = f2(.45 + .55 * g.c);
      }

      /* --- airflow --- */
      const useNose = manner === "nasal";
      const flowD = useNose ? noseD : jetD;
      const shown = useNose ? g.nose : g.flow;

      if (still) {
        // one static arrow: this is where the air goes
        fx.jet.setAttribute("d", flowD);
        fx.jet.setAttribute("stroke-dasharray", "none");
        fx.jet.style.opacity = .85;
        fx.jet2.style.opacity = 0;
        fx.puff.style.opacity = 0;
        const a = useNose ? noseTip : tipP, b = useNose ? nosePre : preP;
        const ah = W * .055;
        fx.arrow.setAttribute("d", `M0,0 L${f2(-2.1 * ah)},${f2(-1.2 * ah)} L${f2(-2.1 * ah)},${f2(1.2 * ah)} Z`);
        fx.arrow.setAttribute("transform", `translate(${a[0]},${a[1]}) rotate(${f2(ang(b, a))})`);
        fx.arrow.style.opacity = .9;
        fx.stream.setAttribute("transform", "");
        fx.buzz.style.opacity = voiced ? 1 : 0;
        return;
      }

      fx.arrow.style.opacity = 0;
      fx.jet.setAttribute("d", flowD);
      fx.jet2.setAttribute("d", flowD);

      if (g.pop > .01) {
        // the release: short motion lines flying out of the constriction
        fx.puff.setAttribute("d", puffPath(g.popR));
        fx.puff.style.opacity = f2(.95 * g.pop);
        fx.jet.setAttribute("stroke-dasharray", `${f2(W * .05)} ${f2(W * .1)}`);
        fx.jet.setAttribute("stroke-dashoffset", f2(-g.popR * W * .9));
        fx.jet.style.opacity = f2(.85 * g.pop);
        fx.jet2.style.opacity = 0;
        fx.stream.setAttribute("transform", "");
      } else if (shown > .01) {
        // sustained flow — broken and jittery for fricatives, smooth for glides
        const rough = manner === "fricative" || manner === "affricate";
        const speed = rough ? W * .55 : W * .3;
        fx.puff.style.opacity = 0;
        fx.jet.setAttribute("stroke-dasharray", rough ? `${f2(W * .06)} ${f2(W * .075)}` : `${f2(W * .13)} ${f2(W * .1)}`);
        fx.jet.setAttribute("stroke-dashoffset", f2(-((t * speed) % (W * 4))));
        fx.jet.style.opacity = f2(.92 * shown);
        fx.jet2.setAttribute("stroke-dasharray", rough ? `${f2(W * .04)} ${f2(W * .095)}` : `${f2(W * .1)} ${f2(W * .13)}`);
        fx.jet2.setAttribute("stroke-dashoffset", f2(-((t * speed * 1.35) % (W * 4))));
        fx.jet2.style.opacity = f2(.65 * shown);
        const jitter = rough ? W * .012 * Math.sin(t * 26) : 0;
        fx.stream.setAttribute("transform", jitter ? `translate(0,${f2(jitter)})` : "");
      } else {
        fx.jet.style.opacity = 0;
        fx.jet2.style.opacity = 0;
        fx.puff.style.opacity = 0;
        fx.stream.setAttribute("transform", "");
      }

      /* --- the throat-buzz badge: on for the whole voiced stretch --- */
      if (voiced) {
        const pulse = .55 + .45 * Math.sin(t * 42);
        fx.buzz.style.opacity = f2(.2 + .8 * g.voice);
        fx.buzzW1.style.opacity = f2(.4 + .6 * pulse);
        fx.buzzW2.style.opacity = f2(.95 - .75 * pulse);
        fx.buzzDot.setAttribute("r", f2(1.9 + .8 * pulse));
      }
    }

    el.__anAnim = anim;
    if (still) {
      paint(null, frozen);
    } else {
      // offset each tile so a wall of forty cutaways breathes instead of
      // pulsing in lockstep (and a screenshot always catches some mid-gesture)
      stagger = (stagger + 0.37) % 1;
      t0 = (typeof performance !== "undefined" ? performance.now() : Date.now()) - stagger * period;
      live.add(anim);
      watch(anim);
      paint(t0);
      kick();
    }
    return anim;
  }

  // Stop a close-up and hand the cutaway back the whole head.
  function stopConsonant(el, restore) {
    if (!el || !el.__anAnim) return;
    el.__anAnim.stop();
    if (restore) {
      el.classList.remove("an-zoom");
      el.setAttribute("viewBox", FULL_VB.join(" "));
      const fx = el.querySelector(".an-fx");
      if (fx) fx.style.opacity = 0;
      const ring = el.querySelector(".an-place-ring"), dot = el.querySelector(".an-place");
      if (ring) { ring.setAttribute("r", "4.8"); ring.style.opacity = ""; }
      if (dot) { dot.setAttribute("r", "2.2"); dot.style.opacity = ""; }
    }
  }

  /* Put a cutaway into one consonant: zoom to the place, then loop the
     articulation. opts is optional and additive —
       {animate:false} freezes it (the pre-close-up behaviour),
       {zoom:false}    keeps the whole head in frame,
       {at:0..1}       renders one still frame of the gesture,
       {voiced:bool}   overrides the svg's data-voiced.                */
  function poseConsonant(el, place, manner, opts) {
    if (!el) return null;
    const o = opts || {};
    if (o.animate === false && o.at == null) {
      stopConsonant(el, o.zoom === false);
      const q = (s) => el.querySelector(s);
      const tongue = q(".an-tongue");
      if (tongue) tongue.setAttribute("d", consonantTongue(place, manner));
      const upper = q(".an-upper-lip"), lower = q(".an-lower-lip");
      if (place === "Bilabial") {
        if (upper) upper.setAttribute("d", "M8,38 Q4,40 7,42 Q11,42 15,41.5");
        if (lower) lower.setAttribute("d", "M8,45 Q4,43.5 7,42.2 Q11,42.1 15,42.5");
      } else if (place === "Labio-dental") {
        if (lower) lower.setAttribute("d", "M8,46 Q7,42 12.4,39.8 Q14,40.5 16,42.5");
      }
      if (mannerOf(manner) === "nasal") {
        const velum = q(".an-velum"), uvula = q(".an-uvula");
        if (velum) velum.setAttribute("d", "M58,31 Q61,38 59,46");
        if (uvula) { uvula.setAttribute("cx", "58.8"); uvula.setAttribute("cy", "47"); }
      }
      if (o.zoom !== false && WINDOWS[place]) {
        el.classList.add("an-zoom");
        el.setAttribute("viewBox", windowFor(place).map(f2).join(" "));
      }
      return null;
    }
    return animateConsonant(el, {
      place, manner, zoom: o.zoom, animate: o.animate, at: o.at, voiced: o.voiced
    });
  }

  /* ---- vowels and diphthongs: the tract moves ----
     Jaw hinges, the tongue hump travels to the chart position, and the
     lips round on their own axis (so /ʉː/ food is rounded but /iː/ see
     is spread at the same jaw height). Untouched by the close-up work —
     a vowel still shows the whole head. */

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
    const kickV = () => { if (!raf) raf = requestAnimationFrame(draw); };
    // a vowel wants the whole head back — drop any consonant close-up first
    const release = () => { if (el.__anAnim) stopConsonant(el, true); };
    draw();

    return {
      el,
      pose(x, y) { release(); target = { x, y }; kickV(); },
      set(x, y) { release(); target = { x, y }; speaking = true; kickV(); },
      idle() { release(); target = { ...IDLE }; speaking = false; kickV(); },
      quiet() { speaking = false; kickV(); },
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

  /* ---- the close-ups' own CSS, so the file drops into any host ----
     Line weights are bumped in an-zoom because the host's strokes are
     non-scaling: at 3x magnification the original hairlines vanish
     against the areas of colour. */
  const CSS = `
.anatomy .an-fx { pointer-events: none; }
.an-fx-jet { fill: none; stroke: var(--an-air, #2f6f9e); stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
.an-fx-arrow { fill: var(--an-air, #2f6f9e); stroke: none; opacity: 0; }
.an-fx-seal { fill: none; stroke: var(--an-contact, #a83232); stroke-linecap: round; opacity: 0; }
.an-fx-buzz-bg { fill: var(--an-buzz-bg, #fffdf8); stroke: var(--an-contact, #a83232); }
.an-fx-buzz-dot { fill: var(--an-contact, #a83232); stroke: none; }
.an-fx-buzz-wave { fill: none; stroke: var(--an-contact, #a83232); stroke-linecap: round; }
.anatomy.an-zoom .an-oral-air, .anatomy.an-zoom .an-nasal-air { opacity: 0 !important; animation: none !important; }
.anatomy.an-zoom .an-place-ring { animation: none !important; }
.anatomy.an-zoom .an-tissue, .anatomy.an-zoom .an-cavity, .anatomy.an-zoom .an-tongue,
.anatomy.an-zoom .an-lip, .anatomy.an-zoom .an-tooth, .anatomy.an-zoom .an-palate,
.anatomy.an-zoom .an-velum, .anatomy.an-zoom .an-uvula, .anatomy.an-zoom .an-outline,
.anatomy.an-zoom .an-larynx, .anatomy.an-zoom .an-epiglottis, .anatomy.an-zoom .an-pharynx,
.anatomy.an-zoom .an-vocal-folds { vector-effect: non-scaling-stroke; }
.anatomy.an-zoom .an-tissue, .anatomy.an-zoom .an-cavity { stroke-width: 1.4; }
.anatomy.an-zoom .an-outline, .anatomy.an-zoom .an-pharynx, .anatomy.an-zoom .an-larynx,
.anatomy.an-zoom .an-epiglottis { stroke-width: 1.7; }
.anatomy.an-zoom .an-palate { stroke-width: 2.4; }
.anatomy.an-zoom .an-tooth { stroke-width: 1.2; }
.anatomy.an-zoom .an-tongue { stroke-width: 1.9; }
.anatomy.an-zoom .an-lip { stroke-width: 1.7; fill: var(--an-lip, #f0aba5); }
.anatomy.an-zoom .an-velum { stroke-width: 2.6; }
.anatomy.an-zoom .an-vocal-folds { stroke-width: 2.2; }
@media (prefers-reduced-motion: reduce) {
  .an-fx-jet, .an-fx-arrow, .an-fx-buzz, .an-fx-seal { animation: none !important; }
}`;
  (function injectCss() {
    if (typeof document === "undefined") return;
    if (document.getElementById("anatomy-fx-css")) return;
    const s = document.createElement("style");
    s.id = "anatomy-fx-css";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  })();

  return { svg, parts, makeCtl, poseConsonant, consonantTongue, glide, loopGlide, SPOTS, reduced: REDUCED,
           animateConsonant, stopConsonant, windowFor, WINDOWS, mannerOf };
})();
