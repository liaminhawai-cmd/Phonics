// ============================================================
// tests/css-vars.test.js
//
// An undefined CSS custom property does not warn and does not
// fall back to a sensible default — it invalidates the entire
// declaration that references it. `background: var(--warn-bg)`
// with no --warn-bg defined leaves the element with no
// background at all, and nothing anywhere says so.
//
// This bit: index.html was missing five colour tokens the rest
// of the pages define, so a "Nearly" card rendered plain cream
// instead of amber and a confidence bar rendered invisible.
// Static check, no browser needed.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// Properties the page never defines because something else supplies them.
const EXTERNAL = new Set([
  // anatomy.js injects these with its diagram stylesheet
  "--an-tissue", "--an-tissue-edge", "--an-cavity", "--an-cavity-edge",
  "--an-tongue", "--an-tongue-edge", "--an-bone", "--an-air", "--an-contact",
  "--an-buzz-bg",
]);

function scan(src) {
  const defined = new Set();
  for (const m of src.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(m[1]);
  const used = new Map();                       // name -> has a fallback?
  for (const m of src.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,)?/g)) {
    if (!used.has(m[1]) || !m[2]) used.set(m[1], !!m[2]);
  }
  return { defined, used };
}

module.exports = {
  "every CSS variable a page uses is one it defines"() {
    const missing = [];
    for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
      const { defined, used } = scan(fs.readFileSync(path.join(ROOT, f), "utf8"));
      for (const [name, hasFallback] of used) {
        if (defined.has(name) || EXTERNAL.has(name) || hasFallback) continue;
        missing.push(`${f}: var(${name}) is used but never defined`);
      }
    }
    assert.equal(missing.length, 0, "\n  " + missing.join("\n  "));
  },

  "the shared colour tokens exist on every page that styles itself"() {
    // Pages copy this palette. A page that grew a --warn-bg rule without
    // the token is the exact failure above, caught before it ships.
    const CORE = ["--bg", "--paper", "--ink", "--muted", "--line", "--accent"];
    for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      if (src.indexOf(":root {") === -1) continue;       // page has no palette
      const { defined } = scan(src);
      for (const name of CORE) {
        assert.ok(defined.has(name), `${f} defines a palette but not ${name}`);
      }
    }
  },
};
