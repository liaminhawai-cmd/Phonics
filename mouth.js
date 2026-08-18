// ============================================================
// mouth.js — articulation diagrams for the answer reveal.
//
// The side-profile face, its jaw/tongue/lip animation and the
// place-of-articulation dots are the same classroom model as the
// Pronunciation Hub (ELC-Pages/pronunciation-core.html); keep the
// two in sync if the face changes there.
//
// The trainer's sound labels are teacher notation (ă, ā, er, ch…),
// not IPA, and one label can stand for two phonemes ("oo" is /ʉː/
// in "do" but /ʊ/ in "put"; "th" is /θ/ in "thin" but /ð/ in
// "this") — so lookups key on label + example word. Vowel chart
// positions are the hub's Australian English values.
// ============================================================

window.Mouth = (() => {

  /* ---- face artwork (hub FACE_PATHS, verbatim) ---- */
  const FACE_PATHS = `
  <path class="skin" d="M45,1 C30,0 15,4 6,15 C3,20 0.5,25 4,28 L10,31.5
    C7,34.5 7,38 10,40.5 L14,42 C15,54 18,66 26,78 C34,90 44,98 54,102 L76,102
    C77,85 72,68 70,50 C72,32 76,15 68,6 C62,1 53,0.5 45,1 Z"/>
  <path class="mouthgap" d="M9,31.5 C14,32.2 18,33.8 22,36.5 C18,43.5 13,47 9,46.5 C6.3,42 6.3,36.5 9,31.5 Z"/>
  <g class="jawgrp">
    <path class="skin" d="M11,36 C6,39 5,43 8,46.5 C4,50 5,55 10,58.5 C6,64 11,68 17,70 C13,77 17,84 26,90
      C34,97 42,100 50,102 C40,96 32,88 28,78 C24,68 26,60 30,54 C26,48 24,42 26,36 Z"/>
    <path class="feature bold" d="M11,36 C6,39 5,43 8,46.5 C4,50 5,55 10,58.5 C6,64 11,68 17,70 C13,77 17,84 26,90 C34,97 42,100 50,102"/>
    <rect class="tooth" x="16.5" y="35" width="4" height="7" rx="1.4"/>
  </g>
  <path class="tongue tonguepath" d="M13,40 C20,34 30,30 39,31 C46,32 49,40 49,52
    C49,60 45,65 39,66 C30,67 20,60 15,52 C13,47 12,43 13,40 Z"/>
  <path class="feature bold" d="M32,0 C24,3 18,7 15,12 C12,16 9,18 5,20 C1.5,22 1,25.5 4,28 L10,31.5 C7,34.5 7,38 10,40.5"/>
  <path class="feature" d="M4.5,25 C6.3,26.3 8.3,26.3 10,24.9"/>
  <path class="feature" d="M16,8 C19.5,11 24,11 27.5,8"/>
  <rect class="tooth" x="14.5" y="28" width="4" height="7.5" rx="1.4"/>
  <path class="feature bold" d="M24,34.5 C26,31 28.5,30 31,31.5"/>
  <path class="feature bold" d="M24,34.5 C27,22 34,13 42,9.5 C48,7.6 52,7.4 56,8"/>
  <path class="feature bold" d="M56,8 C61,10.5 64,15 63,20 C62.4,23.7 60,26.1 57,26.1
    C55.8,28.3 56,31.1 57.5,33.5"/>
  <path class="feature" d="M8,22 C16,13 28,6.5 40,4 C48,2.4 55,2.2 60,3.6"/>
  <path class="feature bold" d="M57,26.1 C50,36 47,48 50,60 C52.5,68 52.5,77 48,85 C45,91 46,96 50,100"/>
  <path class="feature" d="M40,86 C44,82.5 49,82.7 52,86.3"/>`;

  /* where each consonant happens (hub values + Palatal for /j/) */
  const PLACE_SPOTS = {
    "Bilabial":[9,35], "Labio-dental":[15,39], "Dental":[18,28],
    "Alveolar":[27,26], "Post-alveolar":[35,16], "Palatal":[46,11],
    "Velar":[59,8], "Glottal":[62,86]
  };
  /* a tongue/jaw pose that suggests each place when the face animates:
     chart coordinates, x 0 front → 100 back, y 0 close → 100 open */
  const PLACE_POSE = {
    "Bilabial":[45,10], "Labio-dental":[35,18], "Dental":[6,12],
    "Alveolar":[12,8], "Post-alveolar":[26,10], "Palatal":[38,8],
    "Velar":[86,6], "Glottal":[55,70]
  };
  const PLACE_HOW = {
    "Bilabial":"both lips together",
    "Labio-dental":"top teeth on your bottom lip",
    "Dental":"tongue tip between your teeth",
    "Alveolar":"tongue tip on the ridge behind your top teeth",
    "Post-alveolar":"tongue curled just behind the ridge",
    "Palatal":"middle of the tongue near the roof",
    "Velar":"back of your tongue against the soft roof",
    "Glottal":"just your throat — mouth relaxed and open"
  };

  /* Aussie chart positions from the hub */
  const V = {
    "iː":[6,6], "ɪ":[20,18], "e":[16,42], "æ":[20,82], "ɜː":[50,44],
    "ə":[52,52], "ɐ":[54,72], "ʉː":[72,8], "ʊ":[78,22], "ɔ":[88,70],
    "ɔː":[92,48], "aː":[80,90]
  };
  const D = {
    "eɪ":[[16,42],[20,18]], "aɪ":[[60,90],[20,18]], "ɔɪ":[[90,58],[20,18]],
    "əʉ":[[52,52],[72,8]], "aʊ":[[45,88],[78,22]]
  };
  const C = {
    "p":["Bilabial",0], "b":["Bilabial",1], "t":["Alveolar",0], "d":["Alveolar",1],
    "k":["Velar",0], "g":["Velar",1], "f":["Labio-dental",0], "v":["Labio-dental",1],
    "θ":["Dental",0], "ð":["Dental",1], "s":["Alveolar",0], "z":["Alveolar",1],
    "ʃ":["Post-alveolar",0], "ʒ":["Post-alveolar",1], "h":["Glottal",0],
    "tʃ":["Post-alveolar",0], "dʒ":["Post-alveolar",1], "m":["Bilabial",1],
    "n":["Alveolar",1], "ŋ":["Velar",1], "w":["Bilabial",1], "l":["Alveolar",1],
    "r":["Post-alveolar",1], "j":["Palatal",1]
  };
  /* sounds the Pronunciation Hub has a page for (no /j/ there yet) */
  const HUB_HAS = new Set(Object.keys(V).concat(Object.keys(D),
    Object.keys(C).filter((k) => k !== "j")));
  const HUB_URL = "https://liaminhawai-cmd.github.io/ELC-Pages/pronunciation.html";

  const vDesc = (ipa) => ({ kind:"v", ipa, at:V[ipa] });
  const dDesc = (ipa) => ({ kind:"d", ipa, from:D[ipa][0], to:D[ipa][1] });
  const cDesc = (ipa) => ({ kind:"c", ipa, place:C[ipa][0], voiced:C[ipa][1] });
  const seq   = (...parts) => ({ kind:"seq", parts });

  /* trainer sound label → articulation descriptor.
     Ambiguous labels resolve on the example word below. */
  const LABEL_IPA = {
    "ă":vDesc("æ"), "ah":vDesc("aː"), "ĕ":vDesc("e"), "ē":vDesc("iː"),
    "ĭ":vDesc("ɪ"), "ŏ":vDesc("ɔ"), "ŭ":vDesc("ɐ"), "ōō":vDesc("ʉː"),
    "ŏŏ":vDesc("ʊ"), "er":vDesc("ɜː"), "ar":vDesc("aː"), "or":vDesc("ɔː"),
    "aw":vDesc("ɔː"), "au":vDesc("ɔː"),
    "ā":dDesc("eɪ"), "ī":dDesc("aɪ"), "ō":dDesc("əʉ"), "ow":dDesc("aʊ"),
    "oi":dDesc("ɔɪ"), "oy":dDesc("ɔɪ"),
    /* ū as in music: glide /j/ + /ʉː/, taught as a fast ee→oo */
    "ū":{ kind:"d", ipa:"jʉː", from:[8,10], to:[72,8] },
    "b":cDesc("b"), "d":cDesc("d"), "f":cDesc("f"), "g":cDesc("g"),
    "h":cDesc("h"), "j":cDesc("dʒ"), "k":cDesc("k"), "l":cDesc("l"),
    "m":cDesc("m"), "n":cDesc("n"), "ng":cDesc("ŋ"), "p":cDesc("p"),
    "r":cDesc("r"), "s":cDesc("s"), "t":cDesc("t"), "v":cDesc("v"),
    "w":cDesc("w"), "y":cDesc("j"), "z":cDesc("z"),
    "ch":cDesc("tʃ"), "sh":cDesc("ʃ"), "zh":cDesc("ʒ"),
    "kw":seq(cDesc("k"), cDesc("w")),
    "ks":seq(cDesc("k"), cDesc("s")),
    "hw":seq(cDesc("h"), cDesc("w")),
    "ĕd":seq(vDesc("e"), cDesc("d")),
    "ŭf":seq(vDesc("ɐ"), cDesc("f")),
    "ŏff":seq(vDesc("ɔ"), cDesc("f"))
  };

  function descFor(label, ex) {
    if (label === "oo") return vDesc(ex === "put" ? "ʊ" : "ʉː");
    if (label === "th") return cDesc(ex === "this" ? "ð" : "θ");
    return LABEL_IPA[label] || null;
  }

  /* ---- rendering ---- */
  let uid = 0;
  const store = {};   // id -> descriptor

  function faceSVG(desc, id) {
    const first = desc.kind === "seq" ? desc.parts[0] : desc;
    let dot = "";
    if (first.kind === "c") {
      const sp = PLACE_SPOTS[first.place];
      dot = '<circle class="place-dot" cx="' + sp[0] + '" cy="' + sp[1] + '" r="2.4"/>';
    }
    return '<svg class="mouthface mouth-mini" data-mouth-svg="' + id + '" viewBox="0 0 76 102" aria-hidden="true">' +
      FACE_PATHS + dot + '</svg>';
  }

  function captionFor(desc) {
    if (desc.kind === "c") {
      return PLACE_HOW[desc.place] + (desc.voiced ? ", throat buzzing" : ", no buzz — just air");
    }
    if (desc.kind === "d") return "two vowels in one — watch the mouth move";
    if (desc.kind === "seq") return "two sounds in a row — watch both";
    return "watch where the tongue sits";
  }

  // Markup for one sound of the current card. Tapping the face replays
  // the mouth movement; the hub link opens the full sound page.
  function html(label, ex) {
    const desc = descFor(label, ex);
    if (!desc) return "";
    const id = "m" + (uid++);
    store[id] = desc;
    const first = desc.kind === "seq" ? desc.parts[0] : desc;
    const hubIpa = first.ipa === "jʉː" ? "ʉː" : first.ipa;
    const link = HUB_HAS.has(hubIpa)
      ? '<a class="mouth-hub-link" href="' + HUB_URL + "?sound=" + encodeURIComponent(hubIpa) +
        '" target="_blank" rel="noopener">/' + hubIpa + '/ in the Pronunciation Hub ↗</a>'
      : "";
    return '<div class="mouth-wrap">' +
      '<button class="mouth-btn" type="button" data-mouth="' + id + '" title="Watch the mouth">' +
      faceSVG(desc, id) + '</button>' +
      '<div class="mouth-cap">' + captionFor(desc) + '<br>' + link + '</div></div>';
  }

  /* ---- animation (hub face controller, per mini svg) ---- */
  function roundAt(x, y) {
    const back = Math.min(1, Math.max(0, (x - 50) / 25));
    const open = Math.min(1, Math.max(0, (y - 45) / 50));
    return back * (1 - Math.pow(open, 1.5));
  }

  function makeFaceCtl(svg) {
    const jaw = svg.querySelector(".jawgrp"), tongue = svg.querySelector(".tonguepath");
    const lipgap = svg.querySelector(".mouthgap");
    if (!jaw || !tongue) return null;
    const IDLE = { x:52, y:38 };
    let cur = { ...IDLE }, tgt = { ...IDLE }, hold = false, raf = 0;
    function frame() {
      cur.x += (tgt.x - cur.x) * .28; cur.y += (tgt.y - cur.y) * .28;
      const ang = 1 + Math.pow(cur.y / 100, 1.15) * 9.5;
      jaw.setAttribute("transform", "rotate(" + ang.toFixed(2) + " 46 26)");
      const rad = ang * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
      const R = (px, py) => [46 + (px - 46) * cs - (py - 26) * sn, 26 + (px - 46) * sn + (py - 26) * cs];
      const [tx, ty] = R(12, 40);
      const [fx, fy] = R(24, 60);
      const ax = 26 + (cur.x / 100) * 26;
      const ay = 18 + (cur.y / 100) * 34;
      const w = 6 + (cur.y / 100) * 7;
      const rx = Math.min(57, 48 + (ax - 39) * .25);
      const ry = ay + 24;
      tongue.setAttribute("d",
        "M" + tx.toFixed(1) + "," + ty.toFixed(1) +
        " C" + (tx + 7).toFixed(1) + "," + (ay - 2).toFixed(1) + " " + (ax - w).toFixed(1) + "," + ay.toFixed(1) + " " + ax.toFixed(1) + "," + ay.toFixed(1) +
        " C" + (ax + w).toFixed(1) + "," + ay.toFixed(1) + " " + rx.toFixed(1) + "," + (ay + 8).toFixed(1) + " " + rx.toFixed(1) + "," + ry.toFixed(1) +
        " C" + rx.toFixed(1) + "," + (ry + 8).toFixed(1) + " " + (rx - 8).toFixed(1) + "," + (ry + 11).toFixed(1) + " " + (fx + 7).toFixed(1) + "," + (fy + 4).toFixed(1) +
        " C" + (fx + 1).toFixed(1) + "," + (fy + 2).toFixed(1) + " " + (tx + 2).toFixed(1) + "," + (ty + 8).toFixed(1) + " " + tx.toFixed(1) + "," + ty.toFixed(1) + " Z");
      if (lipgap) {
        const rnd = roundAt(cur.x, cur.y);
        const px = 2.2 * rnd;
        const ux = 9.5 - px, uy = 31.5 + 2.1 * rnd;
        const [lx, ly] = R(9.5 - px, 40.5 - 2.1 * rnd);
        lipgap.setAttribute("d",
          "M" + ux.toFixed(1) + "," + uy.toFixed(1) +
          " C" + (ux + 7).toFixed(1) + "," + (uy + 0.4).toFixed(1) + " 17,33.6 23,36" +
          " C17,38.4 " + (lx + 7).toFixed(1) + "," + (ly - 0.4).toFixed(1) + " " + lx.toFixed(1) + "," + ly.toFixed(1) + " Z");
      }
      if (hold || Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > .4) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    frame();
    return {
      set(x, y) { tgt = { x, y }; hold = true; kick(); },
      idle() { tgt = { ...IDLE }; hold = false; kick(); }
    };
  }

  const ctls = {};
  function ctlFor(id) {
    if (!ctls[id]) {
      const svg = document.querySelector('[data-mouth-svg="' + id + '"]');
      if (!svg) return null;
      ctls[id] = makeFaceCtl(svg);
    }
    return ctls[id];
  }

  const poseOf = (part) => part.kind === "c" ? PLACE_POSE[part.place] : (part.at || part.from);

  function playPart(ctl, part, done) {
    if (part.kind === "d") {
      const t0 = performance.now(), dur = 700;
      const ease = (k) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = ease(k);
        ctl.set(part.from[0] + (part.to[0] - part.from[0]) * e,
                part.from[1] + (part.to[1] - part.from[1]) * e);
        if (k < 1) requestAnimationFrame(step); else done();
      };
      ctl.set(part.from[0], part.from[1]);
      setTimeout(() => requestAnimationFrame(step), 250);
    } else {
      const p = poseOf(part);
      ctl.set(p[0], p[1]);
      setTimeout(done, part.kind === "c" ? 650 : 800);
    }
  }

  function play(id) {
    const desc = store[id], ctl = ctlFor(id);
    if (!desc || !ctl) return;
    const parts = desc.kind === "seq" ? desc.parts : [desc];
    let i = 0;
    const next = () => {
      if (i >= parts.length) { setTimeout(() => ctl.idle(), 250); return; }
      playPart(ctl, parts[i++], next);
    };
    next();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mouth]");
    if (btn) play(btn.dataset.mouth);
  });

  // Wipe per-card state when a new answer is revealed (ids are new each time).
  function reset() {
    Object.keys(store).forEach((k) => delete store[k]);
    Object.keys(ctls).forEach((k) => delete ctls[k]);
  }

  return { html, reset };
})();
