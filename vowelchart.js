// ============================================================
// vowelchart.js — the vowel/diphthong trapezoid from the ELC
// Pronunciation Hub, ported into the Sound Wall.
//
// The wall's vowel and diphthong tiles are fixed points — tap
// one, hear that exact sound. This chart is the same vowel space
// as a continuous surface: press and hold anywhere to synthesise
// whatever sound sits at that spot, drag to glide between sounds
// live, and the mouth (anatomy.js) tracks the same x/y position.
// Tapping an actual vowel/diphthong chip still plays its real
// recording when one exists (via Mouth/PhonicsAudio) — only the
// hold-and-drag exploration is synthesised, because a recording
// can't bend.
// ============================================================

window.VowelChart = (() => {

  /* ---- formant synthesis (ported from the Pronunciation Hub) ----
     Interpolated in the Bark auditory scale (Traunmüller 1990), not
     linear Hz, and bilinearly across the trapezium's four corners so
     F2 depends on y as well as x — the same reasoning as the hub's
     own comment, reproduced here because the numbers must match. */
  const hzToBark = (f) => 26.81 * f / (1960 + f) - 0.53;
  const barkToHz = (z) => 1960 * (z + 0.53) / (26.81 - (z + 0.53));
  const CORNER_HZ = {
    closeFront: [280, 2250, 2950],
    closeBack:  [310, 870, 2300],
    openFront:  [750, 1700, 2550],
    openBack:   [700, 1100, 2450]
  };
  const CORNER_BARK = {};
  for (const k in CORNER_HZ) CORNER_BARK[k] = CORNER_HZ[k].map(hzToBark);

  function formantsFor(x, y) {
    const u = Math.min(1, Math.max(0, x / 100)), v = Math.min(1, Math.max(0, y / 100));
    const { closeFront: Q11, closeBack: Q21, openFront: Q12, openBack: Q22 } = CORNER_BARK;
    return Q11.map((_, i) => {
      const bark = Q11[i] * (1 - u) * (1 - v) + Q21[i] * u * (1 - v) + Q12[i] * (1 - u) * v + Q22[i] * u * v;
      return barkToHz(bark);
    });
  }

  let AC = null;
  function audioCtx() {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended" && AC.resume) AC.resume().catch(() => {});
    return AC;
  }
  function makeVoice() {
    const c = audioCtx(), t = c.currentTime;
    const src = c.createOscillator(); src.type = "sawtooth";
    src.frequency.setValueAtTime(132, t);
    src.frequency.linearRampToValueAtTime(112, t + .9);
    const vib = c.createOscillator(); vib.frequency.value = 5.2;
    const vibG = c.createGain(); vibG.gain.value = 4;
    vib.connect(vibG); vibG.connect(src.frequency);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200;
    const master = c.createGain(); master.gain.value = 0;
    const bands = [[8, 1], [10, .5], [12, .22]].map(([q, g]) => {
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = q;
      const fg = c.createGain(); fg.gain.value = g;
      src.connect(f); f.connect(fg); fg.connect(lp);
      return f;
    });
    lp.connect(master); master.connect(c.destination);
    src.start(); vib.start();
    master.gain.linearRampToValueAtTime(.24, t + .05);
    return {
      set(x, y, tc = .045) {
        const F = formantsFor(x, y), tt = c.currentTime;
        bands.forEach((b, i) => b.frequency.setTargetAtTime(F[i], tt, tc));
      },
      stop() {
        const tt = c.currentTime;
        master.gain.cancelScheduledValues(tt);
        master.gain.setTargetAtTime(0, tt, .07);
        setTimeout(() => { try { src.stop(); vib.stop(); } catch (e) {} }, 500);
      }
    };
  }

  /* ---- layout: same trapezium mapping as the hub ---- */
  const CHART_OFF = 44, CHART_SCALE = .54;
  const cpx = (x) => CHART_OFF + x * CHART_SCALE;   // chart x (0-100) -> container %
  const CX = (v) => (v * 1.35).toFixed(1);          // container % -> viewBox units (135 wide)

  let inv = null;   // { vowels, diphthongs } from Mouth.inventory(), cached
  function data() { return inv || (inv = Mouth.inventory()); }

  function trapPoints() {
    return `${CX(cpx(4))},4 ${CX(cpx(96))},4 ${CX(cpx(88))},96 ${CX(cpx(30))},96`;
  }

  function chipHTML(sym, x, y, eg) {
    return `<button type="button" class="vc-chip" data-sym="${sym}"
        style="left:${cpx(x)}%;top:${y}%">
      <span class="vc-sym">/${sym}/</span><span class="vc-eg">${eg.split(",")[0]}</span>
    </button>`;
  }

  function render() {
    const v = data().vowels, d = data().diphthongs;
    const dipPaths = d.map((dp, i) =>
      `<path class="vc-dpath" id="vcdp${i}" d="M${CX(cpx(dp.from[0]))},${dp.from[1]} L${CX(cpx(dp.to[0]))},${dp.to[1]}"
        pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/>`).join("");
    return `
      <div class="sw-section">
        <h2 class="sw-title">Vowel chart</h2>
        <p class="sw-blurb">Every vowel lives somewhere in here — front/back is where your tongue humps up, close/open is your jaw.
          <b>Press and hold anywhere, then drag,</b> to glide the sound and watch the mouth follow. Tap a chip for its real sound.</p>
        <div class="vc-wrap">
          <div class="vc-inner" id="vcInner">
            <svg class="anatomy vc-bg" viewBox="0 0 135 100" preserveAspectRatio="none" aria-hidden="true">
              ${Anatomy.parts()}
              <polygon class="vc-cavity" points="${trapPoints()}"/>
              <polygon class="vc-trap" points="${trapPoints()}"/>
              ${dipPaths}
            </svg>
            ${v.map((o) => chipHTML(o.ipa, o.at[0], o.at[1], o.eg)).join("")}
            ${d.map((o) => chipHTML(o.ipa, o.from[0], o.from[1], o.eg)).join("")}
            <div class="vc-dot" id="vcDot"></div>
            <div class="vc-axis vc-axis-tl">close ↑ · front ←</div>
            <div class="vc-axis vc-axis-br">→ back · ↓ open</div>
          </div>
        </div>
      </div>`;
  }

  /* ---- mouth + drag wiring ---- */
  let faceCtl = null, dragVoice = null, downAt = null, t0 = 0, suppressClick = false;

  function chartXY(el, clientX, clientY) {
    const r = el.getBoundingClientRect();
    const pct = (clientX - r.left) / r.width * 100;
    return { x: Math.min(98, Math.max(2, (pct - CHART_OFF) / CHART_SCALE)),
             y: Math.min(97, Math.max(3, (clientY - r.top) / r.height * 100)) };
  }
  function moveDot(el, x, y, show) {
    const dot = document.getElementById("vcDot"); if (!dot) return;
    dot.style.display = show ? "block" : "none";
    if (show) { dot.style.left = cpx(x) + "%"; dot.style.top = y + "%"; }
  }

  function playChip(sym) {
    const all = [...data().vowels, ...data().diphthongs];
    const o = all.find((x) => x.ipa === sym);
    if (!o) return;
    if (o.phoneme && window.PhonicsAudio) { PhonicsAudio.playPhoneme(o.phoneme); }
    if (o.from) { glideDot(o); if (faceCtl) { Anatomy.glide(faceCtl, o.from, o.to, 700, () => faceCtl.idle()); } if (!o.phoneme) playGlideSound(o); }
    else { if (faceCtl) { faceCtl.set(o.at[0], o.at[1]); setTimeout(() => faceCtl.idle(), 650); } if (!o.phoneme) playHeldSound(o); }
  }
  function playHeldSound(o) {
    const v = makeVoice(); v.set(o.at[0], o.at[1], .001);
    setTimeout(() => v.stop(), 650);
  }
  function playGlideSound(o) {
    const v = makeVoice(); v.set(o.from[0], o.from[1], .001);
    const t0 = performance.now(), dur = 620;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      v.set(o.from[0] + (o.to[0] - o.from[0]) * k, o.from[1] + (o.to[1] - o.from[1]) * k, .05);
      if (k < 1) requestAnimationFrame(step); else setTimeout(() => v.stop(), 80);
    };
    requestAnimationFrame(step);
  }
  function glideDot(o) {
    const idx = data().diphthongs.findIndex((x) => x.ipa === o.ipa);
    const path = document.getElementById("vcdp" + idx);
    document.querySelectorAll(".vc-dpath").forEach((p) => { p.classList.remove("show"); p.style.strokeDashoffset = 1; });
    if (path) { path.classList.add("show"); }
    const t0 = performance.now(), dur = 620;
    const ease = (k) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = ease(k);
      const px = o.from[0] + (o.to[0] - o.from[0]) * e, py = o.from[1] + (o.to[1] - o.from[1]) * e;
      moveDot(null, px, py, true);
      if (path) path.style.strokeDashoffset = 1 - e;
      if (k < 1) requestAnimationFrame(step); else setTimeout(() => moveDot(null, 0, 0, false), 250);
    };
    requestAnimationFrame(step);
  }

  function wireDrag(root) {
    const inner = root.querySelector("#vcInner");
    const svg = inner.querySelector(".vc-bg");
    faceCtl = Anatomy.makeCtl(svg);
    inner.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button > 0) return;
      const chip = e.target.closest(".vc-chip");
      downAt = [e.clientX, e.clientY]; t0 = performance.now(); suppressClick = false;
      const p = chartXY(inner, e.clientX, e.clientY);
      dragVoice = { v: makeVoice(), id: e.pointerId };
      dragVoice.v.set(p.x, p.y, .001);
      moveDot(inner, p.x, p.y, true);
      if (faceCtl) faceCtl.set(p.x, p.y);
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragVoice || e.pointerId !== dragVoice.id) return;
      if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) suppressClick = true;
      const p = chartXY(inner, e.clientX, e.clientY);
      dragVoice.v.set(p.x, p.y); moveDot(inner, p.x, p.y, true);
      if (faceCtl) faceCtl.set(p.x, p.y);
    });
    const end = (e) => {
      if (!dragVoice || e.pointerId !== dragVoice.id) return;
      const v = dragVoice.v, held = performance.now() - t0;
      if (held < 300) setTimeout(() => v.stop(), 320 - held); else v.stop();
      dragVoice = null;
      moveDot(inner, 0, 0, false);
      if (faceCtl) faceCtl.idle();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    inner.addEventListener("click", (e) => {
      if (suppressClick) { suppressClick = false; return; }
      const chip = e.target.closest(".vc-chip");
      if (chip) playChip(chip.dataset.sym);
    });
  }

  let built = false;
  function build(root) {
    root.insertAdjacentHTML("beforeend", render());
    wireDrag(root);
    built = true;
  }
  function ensure(root) { if (!built) build(root); }
  function pause() { if (faceCtl) faceCtl.idle(); }

  return { ensure, pause };
})();
