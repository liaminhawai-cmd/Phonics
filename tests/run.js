#!/usr/bin/env node
// Minimal test runner: node tests/run.js  — runs every tests/*.test.js.
// Each test file exports an object of { "test name": fn } (throw = fail).
const fs = require("fs"), path = require("path");
let pass = 0, fail = 0;
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort()) {
  const suite = require(path.join(__dirname, f));
  for (const [name, fn] of Object.entries(suite)) {
    try { fn(); pass++; }
    catch (e) { fail++; console.error(`FAIL ${f} :: ${name}\n  ${e.message}`); }
  }
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
