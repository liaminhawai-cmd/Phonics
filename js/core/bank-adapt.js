// ============================================================
// js/core/bank-adapt.js — window.PhonicsBankAdapt
//
// Pure functions that turn a PhonicsBank.graphemeView()/
// phonemeView() into the runtime shapes app.js has always used
// (GRAPHEMES / BOOKMARK_LEVELS / PHON_GROUPS). No DOM, no
// PhonicsBank mutation — safe to call from the page or from a
// plain Node harness (see /scripts or the refactor's test
// harness), as long as `PhonicsBank` is reachable as a global.
//
//   PhonicsBankAdapt.mp4StemFor("ai")                 -> "Ai" | null
//   PhonicsBankAdapt.buildGraphemes(view)              -> GRAPHEMES
//   PhonicsBankAdapt.buildBookmarkLevels(view)          -> BOOKMARK_LEVELS
//   PhonicsBankAdapt.buildPhonGroups(PhonicsBank.phonemeView())
// ============================================================

(function (root) {
  // Only graphemes with a video at the repo root get one — the 70 stems
  // app.js has always shipped (A.mp4 … Wr.mp4). Copied from the pre-refactor
  // GRAPHEMES table so mp4StemFor() reproduces today's `audio` values exactly.
  var MP4_STEMS = new Set([
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
    "P", "Qu", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "Ai", "Ar", "Au", "Aw", "Ay", "Ch", "Ci", "Ck", "Dge", "Ea", "Ear", "Ed",
    "Ee", "Ei", "Eigh", "Er", "Ew", "Ey", "Gn", "Gu", "Ie", "Igh", "Ir", "Kn",
    "Ng", "Oa", "Oe", "Oi", "Oo", "Or", "Ou", "Ough", "Ow", "Oy", "Ph", "Sh",
    "Si", "Th", "Ti", "Ui", "Ur", "Wh", "Wor", "Wr",
  ]);

  function mp4StemFor(grapheme) {
    if (!grapheme) return null;
    var stem = grapheme.charAt(0).toUpperCase() + grapheme.slice(1).toLowerCase();
    return MP4_STEMS.has(stem) ? stem : null;
  }

  // Short sound label for one taught GPC. Single-phoneme GPCs get the bank's
  // own "/…/" phoneme label; a multi-phoneme GPC (x -> ks, qu -> kw, the
  // ed.ed / ough.uf style composites) has no single phoneme id to label, so
  // we fall back to the id's own tail (the part after the grapheme).
  function shortSoundFor(gpc, bank) {
    if (Array.isArray(gpc.phonemes)) {
      var tail = gpc.id.indexOf(".") === -1 ? gpc.id : gpc.id.slice(gpc.id.indexOf(".") + 1);
      return tail;
    }
    return bank.phonemeLabel(gpc.phonemes);
  }

  // Flatten a graphemeView() (units -> graphemes -> gpcs) into one entry per
  // unique grapheme across every unit, preserving first-taught order for
  // both the graphemes and each grapheme's sounds.
  function buildGraphemes(view, bank) {
    bank = bank || root.PhonicsBank;
    var byGrapheme = new Map();
    view.forEach(function (unit) {
      unit.graphemes.forEach(function (g) {
        var entry = byGrapheme.get(g.grapheme);
        if (!entry) {
          entry = {
            grapheme: g.grapheme,
            display: g.display || g.grapheme,
            audio: mp4StemFor(g.grapheme),
            gpcIds: [],
            sounds: [],
          };
          byGrapheme.set(g.grapheme, entry);
        }
        g.gpcs.forEach(function (gpc) {
          if (entry.gpcIds.indexOf(gpc.id) !== -1) return; // same GPC re-taught in a later unit
          entry.gpcIds.push(gpc.id);
          entry.sounds.push({
            s: shortSoundFor(gpc, bank),
            ex: (gpc.examples && gpc.examples[0]) || "",
          });
        });
      });
    });
    return Array.from(byGrapheme.values());
  }

  // A small pastel palette for sequences that don't carry their own printed
  // colours (elc-bookmarks always does, so this never runs for the default
  // program).
  var FALLBACK_PALETTE = [
    "#cfe0f5", "#d4e6c5", "#f3cbc4", "#d6e5ec", "#ededed", "#fbecc2",
    "#dcd6ec", "#f5c33c", "#97b5d7", "#cacaca",
  ];

  function buildBookmarkLevels(view) {
    return view.map(function (unit, i) {
      var seen = new Set();
      var graphemes = [];
      unit.graphemes.forEach(function (g) {
        if (seen.has(g.grapheme)) return;
        seen.add(g.grapheme);
        graphemes.push(g.grapheme);
      });
      return {
        name: unit.label,
        graphemes: graphemes,
        colour: unit.colour || (typeof window !== "undefined" && window.PhonicsBank && window.PhonicsBank.beltColour
          ? window.PhonicsBank.beltColour(i).bg
          : FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]),
      };
    });
  }

  // Sound-group names follow the Victorian "44 Sounds" scope & sequence:
  // vowels split into Short / Long / R-Controlled / Other, consonants
  // grouped by manner of articulation; any bundled/composite GPC (x=ks,
  // qu=kw, long-u=yoo, ed.ed, ough.uf/off…) has no single phoneme identity
  // to sort by, so it goes in "Other Codes".
  var GROUP_ORDER = [
    "Short Vowels", "Long Vowels", "R-Controlled Vowels", "Other Vowels",
    "Stops", "Nasals", "Fricatives", "Affricates", "Approximants", "Lateral",
    "Other Codes",
  ];
  var VOWEL_SUBTYPE_GROUP = {
    short: "Short Vowels", long: "Long Vowels", r_controlled: "R-Controlled Vowels",
    diphthong: "Other Vowels", schwa: "Other Vowels",
  };
  var MANNER_GROUP = {
    stop: "Stops", nasal: "Nasals", fricative: "Fricatives",
    affricate: "Affricates", approximant: "Approximants", lateral: "Lateral",
  };

  function groupNameFor(row, bank) {
    if (row.type === "composite" || row.type === "unit") return "Other Codes";
    var p = bank.phoneme(row.phoneme);
    if (!p) return "Other Codes";
    if (p.type === "vowel") return VOWEL_SUBTYPE_GROUP[p.subtype] || "Other Vowels";
    if (p.type === "consonant") {
      var manner = p.articulation && p.articulation.manner;
      return MANNER_GROUP[manner] || "Other Codes";
    }
    return "Other Codes";
  }

  function buildPhonGroups(view, bank) {
    bank = bank || root.PhonicsBank;
    var byName = new Map(GROUP_ORDER.map(function (n) { return [n, new Set()]; }));
    view.forEach(function (row) {
      var name = groupNameFor(row, bank);
      var set = byName.get(name);
      if (!set) { set = new Set(); byName.set(name, set); }
      row.spellings.forEach(function (sp) { set.add(sp.gpc.grapheme); });
    });
    return GROUP_ORDER
      .map(function (name) { return { name: name, graphemes: Array.from(byName.get(name) || []) }; })
      .filter(function (g) { return g.graphemes.length > 0; });
  }

  var api = {
    mp4StemFor: mp4StemFor,
    buildGraphemes: buildGraphemes,
    buildBookmarkLevels: buildBookmarkLevels,
    buildPhonGroups: buildPhonGroups,
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PhonicsBankAdapt = api;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
