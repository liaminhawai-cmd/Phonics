// ============================================================
// js/core/errors.js — window.PhonicsErrors
//
// The error taxonomy from docs/ARCHITECTURE.md §7, as pure
// functions (unit-tested in tests/errors.test.js). Given what a
// child answered in one Elkonin box (or a whole word), classify
// the mistake and say where to route:
//
//   CORRECT           right grapheme
//   SUB-GRAPH-LEGAL   right phoneme heard, legal spelling of it,
//                     wrong choice for this word/position -> rule
//                     micro-lesson when a rule decides it
//   POS-ILLEGAL       a spelling of the right phoneme that is
//                     never legal in this position -> position rule
//   SUB-GRAPH-OTHER   the tried grapheme spells a DIFFERENT
//                     phoneme ("o" in the /oa/ box) -> contrast
//                     card; possibly a listening confusion
//   REV               reversal partner letter (b/d, p/q...)
//   HEART             the tricky part of a heart word
//   SEG-OMIT/SEG-ADD  word level: too few / too many boxes
//
// Needs maps from the bank, passed in so this file stays pure:
//   bank = { gpcsForGrapheme(g) -> [gpc], phonemeOf(gpc) -> key }
// ============================================================

(function () {
  // Classic visual reversals; both orders checked.
  const REVERSAL_PAIRS = [["b", "d"], ["p", "q"], ["b", "p"], ["m", "w"], ["n", "u"]];

  // Acoustically confusable phoneme pairs (voicing pairs, near vowels):
  // when a SUB-GRAPH-OTHER's phoneme is confusable with the target, the
  // mistake may be in the EAR, not the spelling -> minimal-pair drill.
  const CONFUSABLE = [
    ["p", "b"], ["t", "d"], ["k", "g"], ["f", "v"], ["s", "z"],
    ["ch", "j"], ["sh", "zh"], ["th", "dh"], ["th", "f"], ["dh", "v"],
    ["m", "n"], ["n", "ng"],
    ["a", "e"], ["e", "i"], ["i", "ee"], ["o", "u"], ["u", "oo_short"],
    ["oo_short", "oo_long"], ["o", "oa"], ["a", "ay"], ["e", "ee"],
    ["i", "igh"], ["u", "yoo"], ["or", "oa"], ["ow", "oa"], ["ar", "a"],
  ];

  const pairKey = (a, b) => (a < b ? a + "~" + b : b + "~" + a);
  const REV_SET = new Set(REVERSAL_PAIRS.map(([a, b]) => pairKey(a, b)));
  const CONF_SET = new Set(CONFUSABLE.map(([a, b]) => pairKey(a, b)));

  const phonemesEqual = (a, b) => {
    const norm = (p) => (Array.isArray(p) ? p.join("+") : String(p));
    return norm(a) === norm(b);
  };
  const firstPhoneme = (p) => (Array.isArray(p) ? p[0] : p);

  function positionOf(index, total) {
    if (index === 0) return "initial";
    return index === total - 1 ? "final" : "medial";
  }

  // Index rules.json for routing: which rule arbitrates a (target GPC,
  // tried GPC) pair, and which spellings a rule declares position-bound.
  function indexRules(rulesJson) {
    const byPair = {};       // "au.or~aw.or" -> ruleId
    const byGpc = {};        // "au.or" -> [ruleId,...]
    for (const r of rulesJson.rules) {
      const ids = r.gpcs || [];
      for (const g of ids) (byGpc[g] = byGpc[g] || []).push(r.id);
      const contest = r.choose_between ? Object.keys(r.choose_between) : ids;
      for (let i = 0; i < contest.length; i++)
        for (let j = i + 1; j < contest.length; j++)
          byPair[pairKey(contest[i], contest[j])] = byPair[pairKey(contest[i], contest[j])] || r.id;
    }
    return { byPair, byGpc };
  }

  // Classify ONE box. target: {g, p} segment; tried: grapheme string the
  // child chose/typed; index/total locate the box; heartParts from the word.
  function classifyBox({ target, tried, index, total, bank, rulesIdx, heartParts }) {
    tried = (tried || "").trim().toLowerCase();
    const pos = positionOf(index, total);
    const targetGpc = target.g + "." + (Array.isArray(target.p) ? target.p.join("").replace(/_/g, "") : target.p);

    if (!tried) return { code: "OMIT", position: pos };
    if (tried === target.g || tried === target.g.replace("_", "-"))
      return { code: "CORRECT", position: pos };

    if ((heartParts || []).includes(target.g))
      return { code: "HEART", position: pos, heartPart: target.g };

    // reversal partner of any letter of the target grapheme?
    if (tried.length === 1 && target.g.length === 1 && REV_SET.has(pairKey(tried, target.g)))
      return { code: "REV", position: pos, pair: [tried, target.g] };

    const triedGpcs = bank.gpcsForGrapheme(tried);
    if (!triedGpcs.length)
      return { code: "SUB-GRAPH-OTHER", position: pos, unknownGrapheme: true };

    // Does the tried grapheme legally spell the target phoneme?
    const legal = triedGpcs.find(g => phonemesEqual(g.phonemes, target.p));
    if (legal) {
      const positions = legal.positions || ["initial", "medial", "final"];
      if (!positions.includes(pos)) {
        const rule = rulesIdx && (rulesIdx.byPair[pairKey(legal.id, targetGpc)] ||
                                  (rulesIdx.byGpc[legal.id] || [])[0]);
        return { code: "POS-ILLEGAL", position: pos, triedGpc: legal.id, ruleId: rule || null };
      }
      const rule = rulesIdx && rulesIdx.byPair[pairKey(legal.id, targetGpc)];
      return { code: "SUB-GRAPH-LEGAL", position: pos, triedGpc: legal.id,
               ruleId: rule || null, phonemeCorrect: true };
    }

    // It spells something else. Is that something confusable with the target?
    const triedPhon = firstPhoneme(triedGpcs[0].phonemes);
    const targPhon = firstPhoneme(target.p);
    return { code: "SUB-GRAPH-OTHER", position: pos, triedGpc: triedGpcs[0].id,
             triedPhoneme: triedPhon,
             confusable: CONF_SET.has(pairKey(String(triedPhon), String(targPhon))) };
  }

  // Word-level classification for T4: segments = target segmentation,
  // answers = array of tried grapheme strings (one per box the child made).
  function classifyWord({ segments, answers, bank, rulesIdx, heartParts }) {
    const boxes = [];
    const n = segments.length;
    if (answers.length < n) boxes.push({ code: "SEG-OMIT", missing: n - answers.length });
    if (answers.length > n) boxes.push({ code: "SEG-ADD", extra: answers.length - n });
    const m = Math.min(n, answers.length);
    for (let i = 0; i < m; i++) {
      boxes.push(Object.assign(
        { boxIndex: i, target: segments[i].g },
        classifyBox({ target: segments[i], tried: answers[i], index: i, total: n,
                      bank, rulesIdx, heartParts })));
    }
    return boxes;
  }

  // Kid-facing feedback line per code (the UI may localise/soften further).
  function feedbackFor(result, ctx) {
    const say = ctx && ctx.phonemeLabel ? ctx.phonemeLabel : (p) => "/" + p + "/";
    switch (result.code) {
      case "CORRECT": return "Yes!";
      case "SUB-GRAPH-LEGAL":
        return "You heard the sound — yes! This word just spells it a different way.";
      case "POS-ILLEGAL":
        return "That spelling can't go there in a word.";
      case "SUB-GRAPH-OTHER":
        return result.confusable
          ? "Close — listen again, the sounds are easy to mix up."
          : "That letter makes a different sound — listen again.";
      case "REV": return "Watch out — that's the flip-around letter!";
      case "HEART": return "This is the tricky heart part of this word.";
      case "SEG-OMIT": return "There's a sound hiding — count again!";
      case "SEG-ADD": return "Too many sounds — count again!";
      case "OMIT": return "This box needs a sound.";
      default: return "Try again.";
    }
  }

  const api = { classifyBox, classifyWord, indexRules, feedbackFor,
                REVERSAL_PAIRS, CONFUSABLE };
  if (typeof window !== "undefined") window.PhonicsErrors = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
