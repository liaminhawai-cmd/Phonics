#!/usr/bin/env python3
"""Compile a teacher-friendly shorthand file into a sequence JSON.

This is what makes adding the 51st scope & sequence trivial: nobody
hand-writes GPC ids. You write a plain-text shorthand, this script resolves
every grapheme to a GPC in data/gpcs.json (warning about ambiguity), emits
schema-correct JSON, and rebuilds the sequence index.

Usage:
    python3 scripts/new_sequence.py data/sequences/src/my-program.seq.txt
    (writes data/sequences/<id>.json, then run scripts/validate_data.py)

Shorthand format (see data/sequences/HOW_TO_ADD.md for the cookbook):

    id: my-program
    name: My Program
    region: AU
    view: grapheme_first          # or phoneme_first
    source: Where this order comes from
    licence: note about licensing
    accuracy: optional accuracy caveat
    note: optional file-level note

    unit Stage 1: m s f a t p
    heart: the, is, a
    note: unit-level note

    unit Stage 2: i c b g o d ea=e th=*
    review: m s

Tokens in a unit line:
    s        bare grapheme  -> its primary GPC (most frequent; warns if ambiguous)
    ea=e     grapheme=phoneme -> that exact GPC (ea.e)
    th=*     grapheme=*     -> every GPC for that grapheme
    ea.e     a literal GPC id is also accepted
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FREQ_RANK = {"common": 0, "less-common": 1, "rare": 2}


def load_gpcs():
    with open(os.path.join(ROOT, "data/gpcs.json"), encoding="utf-8") as f:
        gpcs = json.load(f)["gpcs"]
    by_grapheme, by_id = {}, {}
    for i, g in enumerate(gpcs):
        g["_order"] = i
        by_grapheme.setdefault(g["grapheme"], []).append(g)
        by_id[g["id"]] = g
    return by_grapheme, by_id


def resolve(token, by_grapheme, by_id, warnings):
    if token in by_id:                      # literal GPC id
        return [token]
    if "=" in token:
        grapheme, phon = token.split("=", 1)
        cands = by_grapheme.get(grapheme)
        if not cands:
            raise SystemExit(f"ERROR: unknown grapheme '{grapheme}' in token '{token}'")
        if phon == "*":
            return [g["id"] for g in cands]
        gid = f"{grapheme}.{phon}"
        if gid not in by_id:
            options = ", ".join(g["id"] for g in cands)
            raise SystemExit(f"ERROR: no GPC '{gid}' — options for '{grapheme}': {options}")
        return [gid]
    cands = by_grapheme.get(token)
    if not cands:
        close = [g for g in by_grapheme if g.startswith(token[:2])][:6]
        raise SystemExit(f"ERROR: unknown grapheme '{token}'"
                         + (f" — nearby graphemes: {', '.join(close)}" if close else ""))
    best = sorted(cands, key=lambda g: (FREQ_RANK.get(g.get("freq"), 9), g["_order"]))[0]
    if len(cands) > 1:
        others = ", ".join(g["id"] for g in cands if g["id"] != best["id"])
        warnings.append(f"'{token}' is ambiguous -> chose {best['id']} (others: {others}; "
                        f"use {token}=<phoneme> or {token}=* to override)")
    return [best["id"]]


def parse(path):
    meta, units = {}, []
    with open(path, encoding="utf-8") as f:
        for ln, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^unit\s+(.+?):\s*(.*)$", line, re.I)
            if m:
                units.append({"label": m.group(1).strip(), "tokens": m.group(2).split(),
                              "heart": [], "review_tokens": [], "note": ""})
                continue
            if ":" not in line:
                raise SystemExit(f"ERROR line {ln}: expected 'key: value', got: {line}")
            key, val = (s.strip() for s in line.split(":", 1))
            key = key.lower()
            if units and key in ("heart", "review", "note"):
                if key == "heart":
                    units[-1]["heart"] += [w.strip() for w in val.split(",") if w.strip()]
                elif key == "review":
                    units[-1]["review_tokens"] += val.split()
                else:
                    units[-1]["note"] = val
            else:
                meta[key] = val
    for req in ("id", "name", "region", "view"):
        if req not in meta:
            raise SystemExit(f"ERROR: missing '{req}:' line")
    if meta["view"] not in ("grapheme_first", "phoneme_first"):
        raise SystemExit("ERROR: view must be grapheme_first or phoneme_first")
    if not units:
        raise SystemExit("ERROR: no 'unit <label>: ...' lines found")
    return meta, units


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = sys.argv[1]
    by_grapheme, by_id = load_gpcs()
    meta, units = parse(src)
    warnings = []

    out_units = []
    for n, u in enumerate(units, 1):
        teaches, review = [], []
        for t in u["tokens"]:
            teaches += resolve(t, by_grapheme, by_id, warnings)
        for t in u["review_tokens"]:
            review += resolve(t, by_grapheme, by_id, warnings)
        out_units.append({"n": n, "label": u["label"], "teaches": teaches,
                          "review": review, "heart_words": u["heart"], "notes": u["note"]})

    seq = {
        "id": meta["id"], "name": meta["name"], "region": meta["region"],
        "native_view": meta["view"],
        "source": meta.get("source", ""),
        "licence_note": meta.get("licence", ""),
        "units": out_units,
    }
    if meta.get("accuracy"):
        seq["accuracy_note"] = meta["accuracy"]
    if meta.get("note"):
        seq["notes"] = meta["note"]

    out_path = os.path.join(ROOT, "data/sequences", meta["id"] + ".json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(seq, f, ensure_ascii=False, indent=2)
        f.write("\n")

    for w in warnings:
        print(f"WARN  {w}")
    n_gpcs = sum(len(u["teaches"]) for u in out_units)
    print(f"Wrote {os.path.relpath(out_path, ROOT)} — {len(out_units)} units, {n_gpcs} GPCs")

    # keep the index fresh so the app discovers the new sequence automatically
    import subprocess
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts/build_sequence_index.py")],
                   check=True)
    print("Now run: python3 scripts/validate_data.py")


if __name__ == "__main__":
    main()
