// ============================================================
// tests/recordings.test.js
//
// A truncated recording is the failure mode that doesn't look
// like one: the file is there, it decodes, it plays — and what
// comes out is a 50 ms click where a sound should be. A child
// hears the app say something that isn't the sound they were
// asked for, which is worse than the app saying nothing.
//
// These tests guard the duration parser (validated to within
// 0.1 ms of what Chromium actually plays, across all 93 clips)
// and the report it writes for js/core/audio.js to act on.
// ============================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REPORT = path.join(ROOT, "recordings", "clips.json");

function report() {
  return JSON.parse(fs.readFileSync(REPORT, "utf8"));
}

module.exports = {
  "the clip report exists and lists a duration for every recording"() {
    const j = report();
    const found = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (name.endsWith(".mp3")) found.push(path.relative(ROOT, p));
      }
    };
    walk(path.join(ROOT, "recordings"));
    assert.ok(found.length > 0, "no recordings to check");
    for (const rel of found) {
      assert.ok(j.durations[rel] != null,
        rel + " has no duration — re-run scripts/check_recordings.py --write");
    }
  },

  "the report is current: re-running the checker changes nothing"() {
    // Catches a recording added or replaced without regenerating the report,
    // which would leave audio.js skipping a clip that is now fine, or
    // playing one that is now clipped.
    const before = fs.readFileSync(REPORT, "utf8");
    try {
      execFileSync("python3", ["scripts/check_recordings.py", "--write"], { cwd: ROOT });
    } catch (e) {
      if (e.status !== 1) throw e;      // exit 1 just means "found short clips"
    }
    const after = fs.readFileSync(REPORT, "utf8");
    if (before !== after) fs.writeFileSync(REPORT, before);
    assert.equal(after, before,
      "recordings/clips.json is stale — run: python3 scripts/check_recordings.py --write");
  },

  "the known-truncated clips are flagged"() {
    // These are the ones measured as ending at full amplitude — cut off
    // mid-sound. letters/a is the one that made an `a` card open with a
    // click instead of the letter name.
    const j = report();
    const flagged = new Set(j.tooShort);
    for (const rel of ["recordings/au/letters/a.mp3", "recordings/au/phonemes/ng.mp3",
                       "recordings/au/phonemes/schwa.mp3", "recordings/au/letters/e.mp3"]) {
      assert.ok(flagged.has(rel), rel + " should be flagged as too short");
    }
  },

  "healthy clips are not flagged"() {
    // The floors have to leave the good recordings alone: a false positive
    // silently downgrades a real human voice to the synthesised one.
    const j = report();
    const flagged = new Set(j.tooShort);
    for (const rel of ["recordings/au/letters/b.mp3", "recordings/au/letters/w.mp3",
                       "recordings/au/phonemes/s.mp3", "recordings/au/phonemes/m.mp3",
                       "recordings/au/phonemes/a.mp3", "recordings/au/words/brown.mp3"]) {
      assert.ok(!flagged.has(rel), rel + " is a good recording and must not be skipped");
      assert.ok(j.durations[rel] > 0.2, rel + " duration looks wrong: " + j.durations[rel]);
    }
  },

  "every flagged clip really is shorter than its floor"() {
    const j = report();
    for (const rel of j.tooShort) {
      const kind = rel.split("/")[2];
      const floor = j.floors[kind];
      assert.ok(floor != null, "no floor for kind " + kind);
      assert.ok(j.durations[rel] < floor,
        rel + " flagged at " + j.durations[rel] + "s but the floor is " + floor + "s");
    }
  },

  "audio.js reads the report and treats a clipped clip as missing"() {
    const src = fs.readFileSync(path.join(ROOT, "js", "core", "audio.js"), "utf8");
    assert.ok(src.indexOf("recordings/clips.json") !== -1,
      "audio.js should load the clip report");
    assert.ok(/if \(truncated\(rel\)\) \{ tryNext\(\); return; \}/.test(src),
      "playChain should skip a truncated source and fall through to the next");
    assert.ok(/if \(truncated\(rel\)\) return false;/.test(src),
      "have() should report a clipped clip as unusable, so the composed " +
      "letter+sound reading falls back instead of playing a fragment");
  },
};
