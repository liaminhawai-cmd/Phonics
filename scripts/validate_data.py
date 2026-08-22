#!/usr/bin/env python3
"""Validate the data bank: ids resolve, segmentations reconstruct spellings.

Usage: python3 scripts/validate_data.py          (from repo root)
Exit 0 = clean (warnings allowed), exit 1 = errors.
"""
import json, sys, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors, warnings = [], []


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        errors.append(f"{path}: invalid JSON — {e}")
        return None


def as_list(p):
    return p if isinstance(p, list) else [p]


def reconstruct(segments):
    """Join segment graphemes back into a spelling (split-digraph aware)."""
    out, pending_e = [], False
    for seg in segments:
        g = seg["g"]
        if seg.get("split"):
            if pending_e:
                return None  # two overlapping split digraphs — malformed
            out.append(g.split("_")[0])
            pending_e = True
        else:
            out.append(g)
            if pending_e:
                out.append("e")
                pending_e = False
    if pending_e:
        out.append("e")
    return "".join(out)


# ---- phonemes ----
phon = load(os.path.join(ROOT, "data/phonemes.json"))
if not phon:
    errors.append("data/phonemes.json missing or unreadable")
    print("\n".join(errors)); sys.exit(1)

PHONEMES = {p["id"] for p in phon["phonemes"]}
UNITS = set(phon.get("teaching_units", {})) - {"comment"}
VALID_P = PHONEMES | UNITS
for p in phon["phonemes"]:
    for acc in ("au", "uk", "us"):
        if acc not in p.get("ipa", {}):
            errors.append(f"phoneme {p['id']}: missing ipa.{acc}")

# ---- gpcs ----
gpcs = load(os.path.join(ROOT, "data/gpcs.json"))
GPC_IDS = set()
if gpcs:
    for g in gpcs["gpcs"]:
        gid = g["id"]
        if gid in GPC_IDS:
            errors.append(f"gpcs: duplicate id {gid}")
        GPC_IDS.add(gid)
        for pid in as_list(g["phonemes"]):
            if pid not in VALID_P:
                errors.append(f"gpc {gid}: unknown phoneme id '{pid}'")
        for w in g.get("examples", []):
            letters = g["grapheme"].replace("_", "")
            if not all(ch in w for ch in set(letters)):
                warnings.append(f"gpc {gid}: example '{w}' may not contain grapheme '{g['grapheme']}'")

# ---- words ----
words = load(os.path.join(ROOT, "data/words/words.json"))
WORD_IDS = set()
if words:
    for w in words["words"]:
        wid = w.get("id", w["word"])
        if wid in WORD_IDS:
            errors.append(f"words: duplicate id {wid}")
        WORD_IDS.add(wid)
        variants = [("(base)", w.get("segments"))]
        for acc, ov in w.get("accents", {}).items():
            if "segments" in ov:
                variants.append((acc, ov["segments"]))
        for label, segs in variants:
            if not segs:
                errors.append(f"word {wid} {label}: no segments")
                continue
            spelled = reconstruct(segs)
            if spelled != w["word"]:
                errors.append(f"word {wid} {label}: segments spell '{spelled}', not '{w['word']}'")
            for seg in segs:
                for pid in as_list(seg["p"]):
                    if pid not in VALID_P:
                        errors.append(f"word {wid} {label}: unknown phoneme id '{pid}' in segment '{seg['g']}'")
        # syllables ≈ number of vowel-nucleus segments (warning only — le endings etc.)
        vowel_ids = {p["id"] for p in phon["phonemes"] if p["type"] == "vowel"}
        n_vowels = sum(1 for seg in w.get("segments", [])
                       for pid in as_list(seg["p"]) if pid in vowel_ids or pid == "yoo")
        if "syllables" in w and n_vowels and w["syllables"] != n_vowels:
            warnings.append(f"word {wid}: syllables={w['syllables']} but {n_vowels} vowel sounds")

# ---- sequences ----
for path in sorted(glob.glob(os.path.join(ROOT, "data/sequences/*.json"))):
    seq = load(path)
    if not seq:
        continue
    name = os.path.basename(path)
    for unit in seq.get("units", []):
        for gid in unit.get("teaches", []):
            if GPC_IDS and gid not in GPC_IDS:
                errors.append(f"{name} unit {unit.get('n')}: unknown gpc id '{gid}'")
        for hw in unit.get("heart_words", []):
            if WORD_IDS and hw not in WORD_IDS:
                warnings.append(f"{name} unit {unit.get('n')}: heart word '{hw}' not in word bank")

# ---- rules ----
rules = load(os.path.join(ROOT, "data/rules/rules.json"))
if rules:
    seen = set()
    for r in rules["rules"]:
        if r["id"] in seen:
            errors.append(f"rules: duplicate id {r['id']}")
        seen.add(r["id"])
        for gid in r.get("gpcs", []):
            if GPC_IDS and gid not in GPC_IDS:
                errors.append(f"rule {r['id']}: unknown gpc id '{gid}'")
        for ts in r.get("toggle_sets", []):
            if GPC_IDS and ts.get("target_gpc") and ts["target_gpc"] not in GPC_IDS:
                errors.append(f"rule {r['id']}: toggle target '{ts['target_gpc']}' not a gpc id")

# ---- morphemes (JSON validity only) ----
for path in sorted(glob.glob(os.path.join(ROOT, "data/morphemes/*.json"))):
    load(path)

for w in warnings:
    print(f"WARN  {w}")
for e in errors:
    print(f"ERROR {e}")
print(f"\n{len(errors)} errors, {len(warnings)} warnings"
      f" — phonemes:{len(PHONEMES)} gpcs:{len(GPC_IDS)} words:{len(WORD_IDS)}")
sys.exit(1 if errors else 0)
