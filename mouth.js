// ============================================================
// mouth.js — maps the trainer's sound labels onto real phonemes
// and draws each one as a vocal-tract cutaway (see anatomy.js).
//
// The trainer's labels are teacher notation (ă, ā, er, ch...),
// not IPA, and one label can stand for two different phonemes
// ("oo" is /ʉː/ in do but /ʊ/ in put; "th" is /θ/ in thin but
// /ð/ in this) — so lookups key on label + example word.
//
// Positions are the Pronunciation Hub's Australian English
// values, so a sound looks the same in both apps.
// ============================================================

window.Mouth = (() => {

  const HUB_URL = "https://liaminhawai-cmd.github.io/ELC-Pages/pronunciation.html";

  /* ---- the phoneme inventory ---- */
  // consonants: [example, place, manner, voiced]
  const CONS = {
    "p":["pen","Bilabial","plosive",0],      "b":["bed","Bilabial","plosive",1],
    "t":["two","Alveolar","plosive",0],      "d":["do","Alveolar","plosive",1],
    "k":["kite","Velar","plosive",0],        "g":["go","Velar","plosive",1],
    "f":["fish","Labio-dental","fricative",0], "v":["very","Labio-dental","fricative",1],
    "θ":["thin","Dental","fricative",0],     "ð":["this","Dental","fricative",1],
    "s":["see","Alveolar","fricative",0],    "z":["zoo","Alveolar","fricative",1],
    "ʃ":["she","Post-alveolar","fricative",0], "ʒ":["vision","Post-alveolar","fricative",1],
    "h":["hat","Glottal","fricative",0],
    "tʃ":["chair","Post-alveolar","affricate",0], "dʒ":["jam","Post-alveolar","affricate",1],
    "m":["me","Bilabial","nasal",1],         "n":["no","Alveolar","nasal",1],
    "ŋ":["sing","Velar","nasal",1],
    "w":["we","Bilabial","approximant",1],   "l":["look","Alveolar","approximant",1],
    "r":["red","Post-alveolar","approximant",1], "j":["yes","Palatal","approximant",1]
  };
  // vowels: [example, x, y]   x front->back, y close->open
  const VOW = {
    "iː":["see",6,6],   "ɪ":["sit",20,18],  "e":["bed",16,42],  "æ":["cat",20,82],
    "ɜː":["her",50,44], "ə":["about",52,52], "ɐ":["cut",54,72], "ʉː":["food",72,8],
    "ʊ":["put",78,22],  "ɔ":["hot",88,70],  "ɔː":["door",92,48], "aː":["spa",80,90]
  };
  // diphthongs: [example, from, to]
  const DIP = {
    "eɪ":["day",[16,42],[20,18]], "aɪ":["my",[60,90],[20,18]], "ɔɪ":["boy",[90,58],[20,18]],
    "əʉ":["go",[52,52],[72,8]],   "aʊ":["now",[45,88],[78,22]]
  };

  /* sounds the Pronunciation Hub has a page for (it has no /j/ yet) */
  const HUB_HAS = (ipa) => ipa !== "j" && (CONS[ipa] || VOW[ipa] || DIP[ipa]);

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
  const MANNER_HOW = {
    plosive:"block the air completely, then let it pop out",
    fricative:"leave a tiny gap and squeeze the air through so it hisses",
    affricate:"block the air, then release it into a hiss",
    nasal:"block the mouth and hum out through your nose",
    approximant:"glide — the parts come close but never quite touch"
  };

  /* ---- which recording is this sound? --------------------------------
     This file transcribes vowels the RP-ish way the diagrams were drawn
     from; data/phonemes.json uses the broad Australian set (Mitchell /
     Harrington) that the recordings are filed under. Same sounds, six
     different letters — so a tile keyed on the IPA here finds nothing in
     recordings/ and silently falls back to whoever narrated the old mp4s.
     Every descriptor now carries the bank's id for its sound, and
     tests/soundwall.test.js fails if any of them stops resolving. */
  const BANK_ALIAS = {
    "r": "r",     // bank writes the approximant ɹ
    "ɔː": "or",   // door
    "eɪ": "ay",   // day  — bank: æɪ
    "aɪ": "igh",  // my   — bank: ɑe
    "ɔɪ": "oy",   // boy  — bank: oɪ
    "aʊ": "ow"    // now  — bank: æɔ
  };
  let bankByIpa = null;
  function bankId(ipa) {
    if (BANK_ALIAS[ipa]) return BANK_ALIAS[ipa];
    if (!bankByIpa) {
      const all = window.PhonicsBank && PhonicsBank.allPhonemes && PhonicsBank.allPhonemes();
      if (!all || !all.length) return null;          // bank not loaded yet; try again next call
      bankByIpa = {};
      all.forEach((p) => { if (p.ipa && p.ipa.au) bankByIpa[p.ipa.au] = p.id; });
    }
    return bankByIpa[ipa] || null;
  }

  const cDesc = (ipa) => ({ kind:"c", ipa, phoneme:bankId(ipa), eg:CONS[ipa][0], place:CONS[ipa][1], manner:CONS[ipa][2], voiced:CONS[ipa][3] });
  const vDesc = (ipa) => ({ kind:"v", ipa, phoneme:bankId(ipa), eg:VOW[ipa][0], at:[VOW[ipa][1], VOW[ipa][2]] });
  const dDesc = (ipa) => ({ kind:"d", ipa, phoneme:bankId(ipa), eg:DIP[ipa][0], from:DIP[ipa][1], to:DIP[ipa][2] });
  const seq = (...parts) => ({ kind:"seq", ipa:parts.map((p) => p.ipa).join(""), parts });

  /* trainer sound label -> phoneme. Ambiguous labels resolve on the
     example word in descFor() below. */
  const LABEL = {
    "ă":() => vDesc("æ"),  "ah":() => vDesc("aː"), "ĕ":() => vDesc("e"),   "ē":() => vDesc("iː"),
    "ĭ":() => vDesc("ɪ"),  "ŏ":() => vDesc("ɔ"),   "ŭ":() => vDesc("ɐ"),   "ōō":() => vDesc("ʉː"),
    "ŏŏ":() => vDesc("ʊ"), "er":() => vDesc("ɜː"), "ar":() => vDesc("aː"), "or":() => vDesc("ɔː"),
    "aw":() => vDesc("ɔː"), "au":() => vDesc("ɔː"),
    "ā":() => dDesc("eɪ"), "ī":() => dDesc("aɪ"),  "ō":() => dDesc("əʉ"),  "ow":() => dDesc("aʊ"),
    "oi":() => dDesc("ɔɪ"), "oy":() => dDesc("ɔɪ"),
    /* ū as in music — a /j/ glide onto /ʉː/, taught as a fast "yoo" */
    "ū":() => seq(cDesc("j"), vDesc("ʉː")),
    "b":() => cDesc("b"), "d":() => cDesc("d"), "f":() => cDesc("f"), "g":() => cDesc("g"),
    "h":() => cDesc("h"), "j":() => cDesc("dʒ"), "k":() => cDesc("k"), "l":() => cDesc("l"),
    "m":() => cDesc("m"), "n":() => cDesc("n"), "ng":() => cDesc("ŋ"), "p":() => cDesc("p"),
    "r":() => cDesc("r"), "s":() => cDesc("s"), "t":() => cDesc("t"), "v":() => cDesc("v"),
    "w":() => cDesc("w"), "y":() => cDesc("j"), "z":() => cDesc("z"),
    "ch":() => cDesc("tʃ"), "sh":() => cDesc("ʃ"), "zh":() => cDesc("ʒ"),
    "kw":() => seq(cDesc("k"), cDesc("w")),
    "ks":() => seq(cDesc("k"), cDesc("s")),
    "hw":() => seq(cDesc("h"), cDesc("w")),
    "ĕd":() => seq(vDesc("e"), cDesc("d")),
    "ŭf":() => seq(vDesc("ɐ"), cDesc("f")),
    "ŏff":() => seq(vDesc("ɔ"), cDesc("f"))
  };

  function descFor(label, ex) {
    if (label === "oo") return vDesc(ex === "put" ? "ʊ" : "ʉː");
    if (label === "th") return cDesc(ex === "this" ? "ð" : "θ");
    const make = LABEL[label];
    return make ? make() : null;
  }
  // The phoneme a trainer label stands for — "th"+"this" -> "ð".
  function ipaFor(label, ex) {
    const d = descFor(label, ex);
    return d ? d.ipa : null;
  }

  // Everything, grouped the way the hub groups it.
  function inventory() {
    return {
      consonants: Object.keys(CONS).map(cDesc),
      vowels: Object.keys(VOW).map(vDesc),
      diphthongs: Object.keys(DIP).map(dDesc)
    };
  }

  function howTo(d) {
    if (d.kind === "c") {
      return PLACE_HOW[d.place] + " — " + MANNER_HOW[d.manner] +
        (d.voiced ? ", with your throat buzzing" : ", with no buzz — just air");
    }
    if (d.kind === "d") return "two vowels in one — your mouth moves as you say it";
    if (d.kind === "seq") return "two sounds in a row — watch both";
    return "hold your tongue here and let your voice out";
  }

  function hubLink(ipa, text) {
    if (!HUB_HAS(ipa)) return "";
    return `<a class="mouth-hub-link" href="${HUB_URL}?sound=${encodeURIComponent(ipa)}" target="_blank" rel="noopener">${text || ("/" + ipa + "/ in the Pronunciation Hub ↗")}</a>`;
  }

  /* ---- controllers ---- */
  let uid = 0;
  const store = {};   // id -> {desc, ctl, loop}

  // Draw one cutaway for a descriptor and register it for animation.
  function figure(desc, cls) {
    const id = "m" + (uid++);
    store[id] = { desc, ctl: null, loop: null };
    const first = desc.kind === "seq" ? desc.parts[0] : desc;
    return `<span class="mouth-fig ${cls || ""}" data-mouth="${id}">${Anatomy.svg({
      place: first.kind === "c" ? first.place : null,
      manner: first.kind === "c" ? first.manner : null,
      voiced: first.kind === "c" ? first.voiced : 1,
      label: desc.ipa
    })}</span>`;
  }

  // Pose/animate every cutaway inside `root` that hasn't been wired yet.
  function activate(root) {
    (root || document).querySelectorAll("[data-mouth]").forEach((wrap) => {
      const rec = store[wrap.dataset.mouth];
      if (!rec || rec.ctl) return;
      const svg = wrap.querySelector("svg");
      rec.ctl = Anatomy.makeCtl(svg);
      apply(rec);
    });
  }

  // Put a cutaway into its resting state for that sound: consonants freeze
  // in position, vowels hold their tongue height, diphthongs loop silently.
  function apply(rec) {
    const d = rec.desc, ctl = rec.ctl;
    if (!ctl) return;
    if (rec.loop) { rec.loop.stop(); rec.loop = null; }
    const first = d.kind === "seq" ? d.parts[0] : d;
    if (first.kind === "c") {
      Anatomy.poseConsonant(ctl.el, first.place, first.manner);
      ctl.stop();
    } else if (first.kind === "v") {
      ctl.pose(first.at[0], first.at[1]);
    }
    if (d.kind === "d") rec.loop = Anatomy.loopGlide(ctl, d.from, d.to, { ms: 900, hold: 650 });
  }

  // Tapping a cutaway replays it: a glide for diphthongs, a burst of
  // airflow/voicing for consonants, a held position for vowels.
  function play(id) {
    const rec = store[id];
    if (!rec || !rec.ctl) return;
    const d = rec.desc, ctl = rec.ctl;
    if (rec.loop) { rec.loop.stop(); rec.loop = null; }
    const parts = d.kind === "seq" ? d.parts : [d];
    let i = 0;
    const next = () => {
      if (i >= parts.length) { setTimeout(() => apply(rec), 300); return; }
      const p = parts[i++];
      if (p.kind === "d") { Anatomy.glide(ctl, p.from, p.to, 900, next); }
      else if (p.kind === "v") { ctl.set(p.at[0], p.at[1]); setTimeout(next, 800); }
      else {
        Anatomy.poseConsonant(ctl.el, p.place, p.manner);
        ctl.el.classList.add("speaking");
        setTimeout(() => { ctl.el.classList.remove("speaking"); next(); }, 750);
      }
    };
    next();
  }

  /* ---- the answer-reveal diagram (Look & Say / Listen & Write) ---- */
  function html(label, ex) {
    const desc = descFor(label, ex);
    if (!desc) return "";
    const first = desc.kind === "seq" ? desc.parts[0] : desc;
    return `<div class="mouth-wrap">${figure(desc, "mouth-mini")}
      <div class="mouth-cap">${howTo(first)}<br>${hubLink(first.ipa)}</div></div>`;
  }

  function reset() {
    Object.keys(store).forEach((k) => {
      if (store[k].loop) store[k].loop.stop();
      if (store[k].ctl) store[k].ctl.stop();
      delete store[k];
    });
  }
  // Stop/restart every loop at once — used when a screen goes out of view.
  function pauseAll() { Object.values(store).forEach((r) => { if (r.loop) { r.loop.stop(); r.loop = null; } }); }
  function resumeAll() { Object.values(store).forEach((r) => { if (r.ctl) apply(r); }); }

  document.addEventListener("click", (e) => {
    const fig = e.target.closest("[data-mouth]");
    if (fig) play(fig.dataset.mouth);
  });

  return { html, figure, activate, play, reset, pauseAll, resumeAll,
           inventory, ipaFor, descFor, bankId, howTo, hubLink, HUB_URL };
})();
