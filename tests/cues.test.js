// ============================================================
// tests/cues.test.js
//
// The cue folder holds video of a person performing a system of
// hand signs. Some of those systems belong to someone else.
// Using them in your own classroom is what the training is for;
// publishing a complete free reference of one, in a public repo,
// alongside the products its publisher sells, is a different act.
//
// data/cues/index.json is where that line is drawn, and these
// tests make sure the line is actually enforced rather than just
// written down.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const index = () => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cues", "index.json"), "utf8"));

module.exports = {
  "every cue system declares whether it may be published"() {
    for (const s of index().systems) {
      assert.ok(s.id, "a system has no id");
      assert.equal(typeof s.publish, "boolean",
        `${s.id} must say publish: true or false — an absent flag reads as "maybe"`);
    }
  },

  "a system that may not be published says who owns it and how to ask"() {
    for (const s of index().systems) {
      if (s.publish || s.builtin) continue;
      assert.ok(s.rights, `${s.id} is restricted but records no rights`);
      assert.ok(s.rights.holder, `${s.id} does not say who holds the rights`);
      assert.ok(s.rights.ask, `${s.id} does not say who to ask for permission`);
      assert.ok(s.rights.why, `${s.id} does not say why it is restricted — ` +
        "a future reader with a deadline will flip the flag unless the reason is here");
    }
  },

  "gitignore excludes the cue folder by default, not per system"() {
    // Allow-list, not deny-list: a system added later is out until someone
    // opts it in. A deny-list would publish it the moment it appeared.
    const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    assert.ok(/^cues\/\*$/m.test(gi), ".gitignore should exclude all of cues/ first");
    for (const s of index().systems) {
      if (!s.publish || s.builtin) continue;
      assert.ok(gi.indexOf("!cues/" + s.id + "/") !== -1,
        `${s.id} is publishable but not re-admitted in .gitignore`);
    }
  },

  "no restricted cue content is tracked by git"() {
    // The real guard. .gitignore is advice; `git add -f` ignores it, and so
    // does a file that was already tracked before the rule existed.
    let out = "", code = 0;
    try {
      out = execFileSync("python3", ["scripts/check_cues.py"], { cwd: ROOT, encoding: "utf8" });
    } catch (e) {
      code = e.status; out = String(e.stdout || "") + String(e.stderr || "");
    }
    assert.equal(code, 0, "scripts/check_cues.py found publishable-flag violations:\n" + out);
  },

  "cue clips are keyed by the same phoneme ids as the recordings"() {
    // A cue and its sound have to line up. Different id schemes would mean
    // silently pairing the wrong hand sign with the wrong sound.
    const readme = fs.readFileSync(path.join(ROOT, "cues", "README.md"), "utf8");
    assert.ok(readme.indexOf("data/phonemes.json") !== -1,
      "cues/README.md should state that clip names are phoneme ids");
    const ids = new Set(JSON.parse(
      fs.readFileSync(path.join(ROOT, "data", "phonemes.json"), "utf8")).phonemes.map((p) => p.id));
    const cues = path.join(ROOT, "cues");
    for (const sys of fs.readdirSync(cues)) {
      const sysDir = path.join(cues, sys);
      if (!fs.statSync(sysDir).isDirectory()) continue;
      for (const accent of fs.readdirSync(sysDir)) {
        const aDir = path.join(sysDir, accent);
        if (!fs.statSync(aDir).isDirectory()) continue;
        for (const f of fs.readdirSync(aDir)) {
          if (!/\.(mp4|webm|mov)$/i.test(f)) continue;
          const id = f.replace(/\.[^.]+$/, "");
          assert.ok(ids.has(id), `cues/${sys}/${accent}/${f} is not a phoneme id`);
        }
      }
    }
  },
};
