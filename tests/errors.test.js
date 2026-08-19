const assert = require("assert");
const E = require("../js/core/errors.js");
const fs = require("fs"), path = require("path");

// A tiny bank stub with realistic GPC records (matching data/gpcs.json shapes)
const GPCS = {
  o:  [{ id: "o.o",  grapheme: "o",  phonemes: "o",  positions: ["initial", "medial"] },
       { id: "o.oa", grapheme: "o",  phonemes: "oa", positions: ["initial", "medial", "final"] }],
  oa: [{ id: "oa.oa", grapheme: "oa", phonemes: "oa", positions: ["initial", "medial"] }],
  oe: [{ id: "oe.oa", grapheme: "oe", phonemes: "oa", positions: ["final"] }],
  ow: [{ id: "ow.oa", grapheme: "ow", phonemes: "oa", positions: ["medial", "final"] },
       { id: "ow.ow", grapheme: "ow", phonemes: "ow", positions: ["medial", "final"] }],
  au: [{ id: "au.or", grapheme: "au", phonemes: "or", positions: ["initial", "medial"] }],
  aw: [{ id: "aw.or", grapheme: "aw", phonemes: "or", positions: ["medial", "final"] }],
  b:  [{ id: "b.b", grapheme: "b", phonemes: "b", positions: ["initial", "medial", "final"] }],
  d:  [{ id: "d.d", grapheme: "d", phonemes: "d", positions: ["initial", "medial", "final"] }],
  t:  [{ id: "t.t", grapheme: "t", phonemes: "t", positions: ["initial", "medial", "final"] }],
  x:  [{ id: "x.ks", grapheme: "x", phonemes: ["k", "s"], positions: ["medial", "final"] }],
};
const bank = { gpcsForGrapheme: g => GPCS[g] || [] };

const RULES = { rules: [
  { id: "au_aw", name: "au never ends a word", gpcs: ["au.or", "aw.or"],
    choose_between: { "au.or": "middle", "aw.or": "end" } },
]};
const rulesIdx = E.indexRules(RULES);

// boat: b-oa-t
const BOAT = [{ g: "b", p: "b" }, { g: "oa", p: "oa" }, { g: "t", p: "t" }];

module.exports = {
  "correct grapheme is CORRECT"() {
    const r = E.classifyBox({ target: BOAT[1], tried: "oa", index: 1, total: 3, bank, rulesIdx });
    assert.equal(r.code, "CORRECT");
  },

  "legal alternative spelling of the right phoneme -> SUB-GRAPH-LEGAL, phoneme credited"() {
    const r = E.classifyBox({ target: BOAT[1], tried: "ow", index: 1, total: 3, bank, rulesIdx });
    assert.equal(r.code, "SUB-GRAPH-LEGAL");
    assert.equal(r.phonemeCorrect, true);
    assert.equal(r.triedGpc, "ow.oa");
  },

  "right phoneme but position-illegal spelling -> POS-ILLEGAL"() {
    // oe spells /oa/ but only word-finally; middle box of 'boat' is medial
    const r = E.classifyBox({ target: BOAT[1], tried: "oe", index: 1, total: 3, bank, rulesIdx });
    assert.equal(r.code, "POS-ILLEGAL");
    assert.equal(r.triedGpc, "oe.oa");
  },

  "grapheme that spells a different phoneme -> SUB-GRAPH-OTHER, confusable flagged"() {
    // 'o' in the /oa/ box: o.o is the primary sound; o~oa are confusable
    const oOnly = { gpcsForGrapheme: g => (g === "o" ? [GPCS.o[0]] : GPCS[g] || []) };
    const r = E.classifyBox({ target: BOAT[1], tried: "o", index: 1, total: 3, bank: oOnly, rulesIdx });
    assert.equal(r.code, "SUB-GRAPH-OTHER");
    assert.equal(r.confusable, true);
  },

  "au at the end routes to the au/aw rule"() {
    // word 'jaw' -> j-aw; child writes 'au' in final box
    const seg = { g: "aw", p: "or" };
    const r = E.classifyBox({ target: seg, tried: "au", index: 1, total: 2, bank, rulesIdx });
    assert.equal(r.code, "POS-ILLEGAL");
    assert.equal(r.ruleId, "au_aw");
  },

  "b/d reversal -> REV"() {
    const r = E.classifyBox({ target: BOAT[0], tried: "d", index: 0, total: 3, bank, rulesIdx });
    assert.equal(r.code, "REV");
  },

  "heart part wrong -> HEART"() {
    const r = E.classifyBox({ target: { g: "a", p: "o" }, tried: "o", index: 1, total: 3,
                              bank, rulesIdx, heartParts: ["a"] });
    assert.equal(r.code, "HEART");
  },

  "word level: too few boxes -> SEG-OMIT"() {
    const boxes = E.classifyWord({ segments: BOAT, answers: ["b", "oa"], bank, rulesIdx });
    assert.equal(boxes[0].code, "SEG-OMIT");
  },

  "word level: full correct"() {
    const boxes = E.classifyWord({ segments: BOAT, answers: ["b", "oa", "t"], bank, rulesIdx });
    assert.ok(boxes.every(b => b.code === "CORRECT"));
  },

  "multi-phoneme grapheme (x) matches array phonemes"() {
    const seg = { g: "x", p: ["k", "s"] };
    const r = E.classifyBox({ target: seg, tried: "x", index: 1, total: 2, bank, rulesIdx });
    assert.equal(r.code, "CORRECT");
  },

  "empty answer -> OMIT"() {
    const r = E.classifyBox({ target: BOAT[0], tried: "", index: 0, total: 3, bank, rulesIdx });
    assert.equal(r.code, "OMIT");
  },

  "REAL DATA: rules index builds over data/rules/rules.json and classify runs against data/gpcs.json"() {
    const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/rules/rules.json"), "utf8"));
    const gpcs = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/gpcs.json"), "utf8"));
    const byG = {};
    for (const g of gpcs.gpcs) (byG[g.grapheme] = byG[g.grapheme] || []).push(g);
    const realBank = { gpcsForGrapheme: g => byG[g] || [] };
    const idx = E.indexRules(rules);
    assert.ok(Object.keys(idx.byPair).length > 10, "rule pairs indexed");
    // sauce: s-au-ce; child tries 'aw' in the au box (medial)
    const r = E.classifyBox({ target: { g: "au", p: "or" }, tried: "aw", index: 1, total: 3,
                              bank: realBank, rulesIdx: idx });
    assert.ok(["SUB-GRAPH-LEGAL", "POS-ILLEGAL"].includes(r.code), r.code);
    assert.ok(r.ruleId, "a rule should arbitrate au vs aw: " + JSON.stringify(r));
  },
};
