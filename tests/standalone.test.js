// ============================================================
// tests/standalone.test.js
//
// phonics-standalone.html is a single-file build with its own
// inlined copy of anatomy.js, for handing to someone on a laptop
// with no server. Two copies of the same diagram is a drift
// hazard: the vocal-tract colours were pasted into every page
// that drew one, and a page that forgot them rendered a black
// silhouette. They live in anatomy.js now — this makes sure the
// standalone's copy keeps up.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// The block between the CSS template literal's start and the fx layer,
// normalised: whitespace collapsed and comments dropped, so the two copies
// are compared on the rules that render rather than the prose around them.
function baseCss(src) {
  const i = src.indexOf(".anatomy { --an-tissue");
  if (i === -1) return null;
  const j = src.indexOf(".anatomy .an-fx { pointer-events: none; }", i);
  if (j === -1) return null;
  return src.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
}

module.exports = {
  "anatomy.js ships the diagram's own colours"() {
    const css = baseCss(read("anatomy.js"));
    assert.ok(css, "anatomy.js should carry the base .anatomy tokens");
    for (const token of ["--an-tissue", "--an-tongue", "--an-bone", "--an-air", "--an-contact"]) {
      assert.ok(css.indexOf(token) !== -1, "missing " + token);
    }
    assert.ok(css.indexOf(".an-tongue {") !== -1, "missing the tongue rule");
  },

  "the standalone build's inlined copy has not drifted"() {
    const mine = baseCss(read("anatomy.js"));
    const theirs = baseCss(read("phonics-standalone.html"));
    assert.ok(theirs, "phonics-standalone.html lost its inlined diagram colours");
    assert.equal(theirs, mine,
      "phonics-standalone.html's inlined anatomy CSS has drifted from anatomy.js — re-inline it");
  },

  "no page re-declares the colours anatomy.js now ships"() {
    // A page pasting its own copy back in is how this drifted the first time.
    for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
      if (f === "phonics-standalone.html") continue;      // self-contained by design
      const src = read(f);
      if (src.indexOf("window.Anatomy = ") !== -1) continue;
      assert.equal(src.indexOf(".anatomy { --an-tissue"), -1,
        f + " re-declares the .anatomy colour tokens; anatomy.js provides them");
    }
  },

  "the standalone build's close-up windows match anatomy.js"() {
    // The window table is the difference between a close-up a child can
    // read and a wall of pink. It is inlined into the standalone build, so
    // a tuning pass that only lands in anatomy.js leaves that build behind.
    const grab = (src) => {
      const i = src.indexOf('const WINDOWS = {');
      assert.ok(i !== -1, "no WINDOWS table");
      const j = src.indexOf("};", i);
      return src.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, " ")
                .replace(/\/\/[^\n]*/g, " ").replace(/\s+/g, " ").trim();
    };
    assert.equal(grab(read("phonics-standalone.html")), grab(read("anatomy.js")),
      "phonics-standalone.html's inlined WINDOWS table has drifted from anatomy.js");
  },

  "every page that draws a vocal tract loads something that styles it"() {
    for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
      const src = read(f);
      if (src.indexOf("Anatomy.svg(") === -1 && src.indexOf("class=\"an-tissue\"") === -1) continue;
      const ok = src.indexOf("anatomy.js") !== -1 || src.indexOf("window.Anatomy = ") !== -1;
      assert.ok(ok, f + " draws a vocal tract but never loads anatomy.js");
    }
  },
};
