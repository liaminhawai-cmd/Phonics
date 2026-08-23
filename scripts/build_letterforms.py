#!/usr/bin/env python3
"""Generate the UK and US handwriting letterform banks.

Usage: python3 scripts/build_letterforms.py

WHY GENERATED
-------------
72 stroke paths typed by hand drift: the o in "o" ends up a different
oval from the o inside "d", and nobody notices until a child is being
marked down for copying the model correctly. Every letter here is
assembled from the same handful of shapes — one bowl, one stem, one
hump, one tail — so a family really is a family and the scorer's
"these letters share a movement" claim is true by construction.

WHOSE LETTERS THESE ARE
-----------------------
Nobody's but ours. Named school fonts (Zaner-Bloser, D'Nealian,
Letter-join, Nelson) are commercial products; their outlines and their
names belong to their publishers. What is NOT ownable is the
convention — that US manuscript is upright with separate strokes, that
UK continuous cursive leads in from the baseline and exits ready to
join. These are drawn to those conventions from scratch. No outline is
traced and no product is named.

COORDINATES
-----------
Same box as the Victorian file: 0-100 wide, top line y=0, dotted mid
y=33.3, baseline y=66.6, descender floor y=100.
"""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOP, MID, BASE, FLOOR = 0.0, 33.3, 66.6, 100.0
XH = BASE - MID                      # x-height band, 33.3 tall


def f(v):
    return round(v, 1)


def pt(x, y):
    return "%s,%s" % (f(x), f(y))


# ---- the shapes every letter is made from ---------------------------

def bowl(cx, cy, rx, ry, start="right", direction="anti"):
    """A closed oval, drawn from the 2 o'clock position by default.

    Anticlockwise is the taught direction for c/o/a/d/g/q in every style
    here; getting it backwards is the single most common early error, so
    the direction is baked into the path rather than left to the scorer.
    """
    k = 0.5523                                   # circle-to-bezier constant
    ox, oy = rx * k, ry * k
    E, N, W, S = (cx + rx, cy), (cx, cy - ry), (cx - rx, cy), (cx, cy + ry)
    if direction == "anti":
        seq = [(E, (cx + rx, cy - oy), (cx + ox, cy - ry), N),
               (N, (cx - ox, cy - ry), (cx - rx, cy - oy), W),
               (W, (cx - rx, cy + oy), (cx - ox, cy + ry), S),
               (S, (cx + ox, cy + ry), (cx + rx, cy + oy), E)]
    else:
        seq = [(E, (cx + rx, cy + oy), (cx + ox, cy + ry), S),
               (S, (cx - ox, cy + ry), (cx - rx, cy + oy), W),
               (W, (cx - rx, cy - oy), (cx - ox, cy - ry), N),
               (N, (cx + ox, cy - ry), (cx + rx, cy - oy), E)]
    d = "M " + pt(*seq[0][0])
    for _s, c1, c2, e in seq:
        d += " C %s %s %s" % (pt(*c1), pt(*c2), pt(*e))
    return d


def arc_open(cx, cy, rx, ry, frm, to):
    """An open curve — c, e, the shoulder of r. Angles in degrees, 0 = east,
    measured anticlockwise on screen (y grows downward, so we negate)."""
    import math
    steps = 16
    a0, a1 = math.radians(frm), math.radians(to)
    pts = []
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        pts.append((cx + rx * math.cos(a), cy - ry * math.sin(a)))
    d = "M " + pt(*pts[0])
    for p in pts[1:]:
        d += " L " + pt(*p)
    return d


def stem(x, y0, y1):
    return "M %s L %s" % (pt(x, y0), pt(x, y1))


def first_point(path):
    """The coordinate an SVG path starts at — the pair right after its M."""
    import re
    m = re.match(r"\s*M\s*(-?[\d.]+),(-?[\d.]+)", path)
    return (float(m.group(1)), float(m.group(2))) if m else None


def last_point(path):
    """Where the pen finishes. Every command this file emits ends on its
    own final coordinate pair, so the last two numbers are the endpoint."""
    import re
    nums = re.findall(r"-?[\d.]+", path)
    return (float(nums[-2]), float(nums[-1])) if len(nums) >= 2 else None


def lead_in(x, y):
    """UK entry stroke: a short diagonal up from the baseline that finishes
    EXACTLY where the letter starts. Getting that endpoint wrong is not a
    cosmetic problem — the pen then travels from the end of the lead-in to
    wherever the body happens to begin, which for a bowl is the far side,
    and the letter comes out with a line slashed through it."""
    return "M %s C %s %s %s" % (pt(x - 9, BASE), pt(x - 6, BASE - 3),
                                pt(x - 3, y + 4), pt(x, y))


def exit_flick(x, y, to_x=None):
    """UK exit stroke: leaves at the baseline heading up-right, ready to
    join whatever comes next."""
    to_x = to_x if to_x is not None else x + 10
    return "C %s %s %s" % (pt(x + 2, BASE + 1), pt(to_x - 4, BASE - 2), pt(to_x, BASE - 6))


# ---- the two styles -------------------------------------------------
# Each entry: strokes as (path, direction-name), plus zone and family.
# W is the advance width; the pen starts near x=12 in an x-height letter.

L, R = 12.0, 46.0                    # left and right of a normal bowl
CX, RX, RY = 29.0, 17.0, 16.6        # bowl centre and radii (x-height)
ASC, DESC = 4.0, 93.0                # top of an ascender, foot of a tail


def us_letters():
    """Upright manuscript: circles and straight lines, no entry or exit
    strokes, and a pen lift between parts. This is the hand US infant
    classrooms teach before cursive, and the separate strokes are the
    point — a child builds b from a line and a circle."""
    g = {}

    def add(ch, width, zone, family, strokes, errors=None):
        g[ch] = {"width": width, "zone": zone, "family": family,
                 "strokes": [{"path": p, "dir": d, "start_zone": sz} for p, d, sz in strokes],
                 "common_errors": errors or []}

    circle = bowl(CX, MID + RY, RX, RY)
    add("o", 58, "x-height", ["circles"],
        [(circle, "anticlockwise", [CX + RX - 6, MID + RY - 6, 12, 12])],
        ["clockwise", "not-closed"])
    add("c", 55, "x-height", ["circles"],
        [(arc_open(CX, MID + RY, RX, RY, 55, 305), "anticlockwise-open",
          [CX + 6, MID + 2, 12, 12])], ["clockwise", "closed-up"])
    add("a", 56, "x-height", ["circles"],
        [(circle, "anticlockwise", [CX + RX - 6, MID + RY - 6, 12, 12]),
         (stem(CX + RX, MID, BASE), "down", [CX + RX - 6, MID - 6, 12, 12])],
        ["clockwise", "stem-first", "stem-detached"])
    add("d", 58, "ascender", ["circles", "tall-sticks"],
        [(circle, "anticlockwise", [CX + RX - 6, MID + RY - 6, 12, 12]),
         (stem(CX + RX, ASC, BASE), "down", [CX + RX - 6, ASC - 4, 12, 12])],
        ["b-reversal", "short-stem"])
    add("g", 58, "descender", ["circles", "tails"],
        [(circle, "anticlockwise", [CX + RX - 6, MID + RY - 6, 12, 12]),
         ("M %s L %s C %s %s %s" % (pt(CX + RX, MID), pt(CX + RX, DESC - 12),
                                    pt(CX + RX, DESC - 3), pt(CX + RX - 3, DESC + 1), pt(CX + RX - 12, DESC - 2)),
          "down-then-hook", [CX + RX - 6, MID - 6, 12, 12])],
        ["clockwise", "hook-wrong-way"])
    add("q", 58, "descender", ["circles", "tails"],
        [(circle, "anticlockwise", [CX + RX - 6, MID + RY - 6, 12, 12]),
         (stem(CX + RX, MID, DESC), "down", [CX + RX - 6, MID - 6, 12, 12])],
        ["p-reversal", "hook-added"])
    add("e", 54, "x-height", ["circles"],
        [("M %s L %s " % (pt(L + 3, MID + RY), pt(R - 1, MID + RY)) +
          arc_open(CX, MID + RY, RX, RY, 0, 300)[1:].replace("M", "L", 1),
          "across-then-round", [L + 2, MID + RY - 6, 12, 12])],
        ["backwards", "no-crossbar"])
    add("b", 57, "ascender", ["straight-then-circle", "tall-sticks"],
        [(stem(L + 2, ASC, BASE), "down", [L - 4, ASC - 4, 12, 12]),
         (bowl(L + 2 + RX, MID + RY, RX, RY, direction="clock"), "clockwise-bowl",
          [L - 4, MID + RY - 6, 12, 12])], ["d-reversal", "bowl-first"])
    add("p", 57, "descender", ["straight-then-circle", "tails"],
        [(stem(L + 2, MID, DESC), "down", [L - 4, MID - 6, 12, 12]),
         (bowl(L + 2 + RX, MID + RY, RX, RY, direction="clock"), "clockwise-bowl",
          [L - 4, MID + RY - 6, 12, 12])], ["q-reversal", "bowl-first"])
    add("l", 26, "ascender", ["tall-sticks"],
        [(stem(L + 4, ASC, BASE), "down", [L - 2, ASC - 4, 12, 12])], ["too-short"])
    add("i", 26, "x-height", ["tall-sticks", "dots"],
        [(stem(L + 4, MID, BASE), "down", [L - 2, MID - 6, 12, 12]),
         ("M %s L %s" % (pt(L + 4, MID - 12), pt(L + 4, MID - 11.5)), "dot",
          [L - 2, MID - 18, 12, 12])], ["no-dot", "dot-first"])
    add("j", 30, "descender", ["tails", "dots"],
        [("M %s L %s C %s %s %s" % (pt(L + 8, MID), pt(L + 8, DESC - 8),
                                    pt(L + 8, DESC), pt(L, DESC + 1), pt(L - 4, DESC - 7)),
          "down-then-hook", [L + 2, MID - 6, 12, 12]),
         ("M %s L %s" % (pt(L + 8, MID - 12), pt(L + 8, MID - 11.5)), "dot",
          [L + 2, MID - 18, 12, 12])], ["no-dot", "hook-wrong-way"])
    add("t", 36, "ascender", ["tall-sticks", "crossbars"],
        [(stem(L + 8, MID - 16, BASE), "down", [L + 2, MID - 22, 12, 12]),
         ("M %s L %s" % (pt(L, MID), pt(L + 16, MID)), "across", [L - 6, MID - 6, 12, 12])],
        ["no-crossbar", "crossbar-first"])
    add("f", 34, "ascender", ["tall-sticks", "crossbars"],
        [("M %s C %s %s %s L %s" % (pt(L + 16, ASC + 6), pt(L + 14, ASC),
                                    pt(L + 6, ASC), pt(L + 6, ASC + 8), pt(L + 6, BASE)),
          "hook-then-down", [L + 10, ASC, 12, 12]),
         ("M %s L %s" % (pt(L - 1, MID), pt(L + 14, MID)), "across", [L - 7, MID - 6, 12, 12])],
        ["no-crossbar", "descends"])
    add("n", 54, "x-height", ["humps"],
        [(stem(L + 2, MID, BASE), "down", [L - 4, MID - 6, 12, 12]),
         ("M %s C %s %s %s L %s" % (pt(L + 2, MID + 7), pt(L + 8, MID),
                                    pt(R - 2, MID + 1), pt(R, MID + 12), pt(R, BASE)),
          "retrace-hump", [L - 4, MID + 1, 12, 12])], ["no-retrace", "h-confusion"])
    add("m", 74, "x-height", ["humps"],
        [(stem(L + 2, MID, BASE), "down", [L - 4, MID - 6, 12, 12]),
         ("M %s C %s %s %s L %s" % (pt(L + 2, MID + 7), pt(L + 7, MID),
                                    pt(L + 25, MID + 1), pt(L + 26, MID + 12), pt(L + 26, BASE)),
          "retrace-hump", [L - 4, MID + 1, 12, 12]),
         ("M %s C %s %s %s L %s" % (pt(L + 26, MID + 7), pt(L + 31, MID),
                                    pt(L + 49, MID + 1), pt(L + 50, MID + 12), pt(L + 50, BASE)),
          "retrace-hump", [L + 20, MID + 1, 12, 12])], ["two-humps-only", "no-retrace"])
    add("h", 54, "ascender", ["humps", "tall-sticks"],
        [(stem(L + 2, ASC, BASE), "down", [L - 4, ASC - 4, 12, 12]),
         ("M %s C %s %s %s L %s" % (pt(L + 2, MID + 7), pt(L + 8, MID),
                                    pt(R - 2, MID + 1), pt(R, MID + 12), pt(R, BASE)),
          "retrace-hump", [L - 4, MID + 1, 12, 12])], ["n-confusion", "no-retrace"])
    add("r", 40, "x-height", ["humps"],
        [(stem(L + 2, MID, BASE), "down", [L - 4, MID - 6, 12, 12]),
         ("M %s C %s %s %s C %s %s %s" % (
             pt(L + 2, MID + 12), pt(L + 3, MID + 3), pt(L + 13, MID - 1), pt(L + 20, MID + 2),
             pt(L + 24, MID + 4), pt(L + 26, MID + 6), pt(L + 26, MID + 10)),
          "retrace-shoulder", [L - 4, MID + 6, 12, 12])], ["no-retrace", "full-hump"])
    add("u", 54, "x-height", ["u-turns"],
        [("M %s L %s C %s %s %s L %s" % (pt(L + 2, MID), pt(L + 2, BASE - 8),
                                         pt(L + 2, BASE), pt(R, BASE), pt(R, BASE - 8),
                                         pt(R, MID)), "down-round-up", [L - 4, MID - 6, 12, 12]),
         (stem(R, MID, BASE), "down", [R - 6, MID - 6, 12, 12])],
        ["n-reversal", "pointed-bottom"])
    add("y", 54, "descender", ["u-turns", "tails"],
        [("M %s L %s C %s %s %s L %s" % (pt(L + 2, MID), pt(L + 2, BASE - 8),
                                         pt(L + 2, BASE), pt(R, BASE), pt(R, BASE - 8),
                                         pt(R, MID)), "down-round-up", [L - 4, MID - 6, 12, 12]),
         ("M %s L %s C %s %s %s" % (pt(R, MID), pt(R, DESC - 6), pt(R, DESC),
                                    pt(L + 14, DESC + 2), pt(L + 4, DESC - 5)),
          "down-then-hook", [R - 6, MID - 6, 12, 12])], ["no-tail", "v-shape"])
    add("v", 50, "x-height", ["zigzags"],
        [("M %s L %s L %s" % (pt(L, MID), pt(L + 19, BASE), pt(L + 38, MID)),
          "down-up", [L - 6, MID - 6, 12, 12])], ["u-confusion", "rounded"])
    add("w", 72, "x-height", ["zigzags"],
        [("M %s L %s L %s L %s L %s" % (pt(L, MID), pt(L + 13, BASE), pt(L + 26, MID),
                                        pt(L + 39, BASE), pt(L + 52, MID)),
          "down-up-down-up", [L - 6, MID - 6, 12, 12])], ["three-points", "rounded"])
    add("x", 50, "x-height", ["zigzags"],
        [("M %s L %s" % (pt(L, MID), pt(L + 36, BASE)), "down-right",
          [L - 6, MID - 6, 12, 12]),
         ("M %s L %s" % (pt(L + 36, MID), pt(L, BASE)), "down-left",
          [L + 30, MID - 6, 12, 12])], ["one-stroke", "wrong-order"])
    add("z", 50, "x-height", ["zigzags"],
        [("M %s L %s L %s L %s" % (pt(L, MID), pt(L + 36, MID), pt(L, BASE), pt(L + 36, BASE)),
          "across-back-across", [L - 6, MID - 6, 12, 12])], ["s-confusion", "reversed"])
    add("k", 52, "ascender", ["zigzags", "tall-sticks"],
        [(stem(L + 2, ASC, BASE), "down", [L - 4, ASC - 4, 12, 12]),
         ("M %s L %s L %s" % (pt(L + 34, MID), pt(L + 2, MID + 18), pt(L + 34, BASE)),
          "in-then-out", [L + 28, MID - 6, 12, 12])], ["arms-detached", "one-arm"])
    add("s", 46, "x-height", ["snake-curves"],
        [("M %s C %s %s %s C %s %s %s" % (
            pt(L + 28, MID + 6), pt(L + 24, MID - 1), pt(L + 5, MID - 1), pt(L + 5, MID + 9),
            pt(L + 5, MID + 19), pt(L + 29, MID + 16), pt(L + 29, MID + 25),
            ) + " C %s %s %s" % (pt(L + 29, MID + 33), pt(L + 8, MID + 34), pt(L + 3, MID + 26)),
          "snake", [L + 22, MID, 12, 12])], ["reversed", "z-confusion"])
    return g


def uk_letters():
    """Continuous cursive: every letter starts with a lead-in from the
    baseline and finishes with an exit ready to join the next one. That
    is what the English National Curriculum's "joined handwriting" asks
    for, and it is why a UK <a> is one stroke where the US one is two."""
    g = {}
    us = us_letters()

    def add(ch, width, zone, family, strokes, errors=None, exit_at=None):
        e = {"width": width, "zone": zone, "family": family,
             "strokes": [{"path": p, "dir": d, "start_zone": sz} for p, d, sz in strokes],
             "common_errors": errors or []}
        if exit_at:
            e["exit"] = exit_at
        g[ch] = e

    def joined(ch, body, dirname, start, width, zone, family, errors=None, lift=None):
        """Lead-in, then the letter, then the exit — all one stroke unless a
        dot or a crossbar genuinely needs the pen up.

        `start` is ignored in favour of the body's own first point: the
        lead-in has to arrive exactly where the letter begins, or the pen
        draws a line across the letter to get there.
        """
        begin = first_point(body) or start
        # A continuous-cursive letter is ONE stroke, so any M inside the body
        # is a lie to the scorer, which counts strokes. Turn each into a line:
        # the pen retraces up the edge it just drew, which is what the hand
        # actually does and what "without lifting the pencil" means.
        body = body[:2] + body[2:].replace(" M ", " L ")
        end = last_point(body)
        # strip the body's own M — the lead-in has already put the pen there
        rest = body.split(" ", 2)[2] if body.startswith("M ") else body
        path = lead_in(*begin) + " " + rest
        # Leave ready to join, from wherever the letter actually finished.
        if end and abs(end[1] - BASE) < 14:
            path += " " + exit_flick(end[0], end[1])
            exit_at = [end[0] + 10, BASE - 6]
        else:
            exit_at = list(end) if end else [width - 12, BASE - 6]
        strokes = [(path, dirname, [begin[0] - 12, begin[1] - 6, 14, 14])]
        if lift:
            strokes.append(lift)
        add(ch, width, zone, family, strokes, errors, exit_at=exit_at)

    # Round family: the bowl is drawn anticlockwise then retraced down the
    # right-hand side, so the pen finishes at the baseline ready to leave.
    for ch, zone, top in (("a", "x-height", MID), ("d", "ascender", ASC),
                          ("g", "descender", MID), ("q", "descender", MID)):
        stem_bottom = DESC if zone == "descender" else BASE
        body = (bowl(CX, MID + RY, RX, RY) + " M %s L %s" % (pt(CX + RX, top), pt(CX + RX, stem_bottom)))
        joined(ch, body, "round-retrace-down", (L + 4, MID + 10), 62,
               zone, ["anticlockwise-loop"] + (["tails"] if zone == "descender" else []),
               ["clockwise", "pen-lift", "no-retrace"])
    joined("o", bowl(CX, MID + RY, RX, RY), "anticlockwise", (L + 4, MID + 10), 60,
           "x-height", ["anticlockwise-loop"], ["clockwise", "not-closed"])
    joined("c", arc_open(CX, MID + RY, RX, RY, 55, 300), "anticlockwise-open",
           (L + 4, MID + 10), 56, "x-height", ["anticlockwise-loop"], ["clockwise"])
    joined("e", "M %s L %s " % (pt(L + 5, MID + RY), pt(R - 2, MID + RY)) +
           arc_open(CX, MID + RY, RX, RY, 0, 300)[1:].replace("M", "L", 1),
           "across-then-round", (L + 4, MID + RY), 56, "x-height",
           ["anticlockwise-loop"], ["backwards"])
    # b and p cannot borrow the US skeleton: there the bowl is a separate
    # stroke, so merging them makes the pen leap from the foot of the stem
    # to the far side of the bowl. In cursive you retrace up the stem and
    # push the bowl out from it.
    for ch, top, foot, width, fam in (("b", ASC, BASE, 58, ["tall-sticks"]),
                                      ("p", MID, DESC, 58, ["tails"])):
        body = ("M %s L %s L %s C %s %s %s C %s %s %s" % (
            pt(L + 2, top), pt(L + 2, foot), pt(L + 2, MID + 6),
            pt(L + 10, MID), pt(L + 36, MID + 3), pt(L + 38, MID + 17),
            pt(L + 40, BASE - 2), pt(L + 22, BASE + 2), pt(L + 2, BASE)))
        joined(ch, body, "down-retrace-bowl", (L + 2, top), width,
               "ascender" if ch == "b" else "descender", fam,
               ["d-reversal" if ch == "b" else "q-reversal", "no-retrace"])

    # Sticks and humps keep their US skeletons but gain the lead-in and exit.
    for ch, width, zone, fam in (("l", 34, "ascender", ["tall-sticks"]),
                                 ("n", 56, "x-height", ["humps"]),
                                 ("m", 78, "x-height", ["humps"]),
                                 ("h", 56, "ascender", ["humps", "tall-sticks"]),
                                 ("r", 44, "x-height", ["humps"]),
                                 ("u", 56, "x-height", ["u-turns"]),
                                 ("y", 56, "descender", ["u-turns", "tails"]),
                                 ("k", 56, "ascender", ["zigzags", "tall-sticks"]),
                                 ("v", 54, "x-height", ["zigzags"]),
                                 ("w", 76, "x-height", ["zigzags"]),
                                 ("s", 50, "x-height", ["snake-curves"]),
                                 ("z", 54, "x-height", ["zigzags"])):
        body = " ".join(s["path"].replace("M ", "L ", 1) if i else s["path"]
                        for i, s in enumerate(us[ch]["strokes"]))
        top = ASC if zone == "ascender" else MID
        joined(ch, body, "joined", (L + 2, top + 8 if zone != "ascender" else ASC + 10),
               width, zone, fam, us[ch]["common_errors"])
    # Dotted and crossed letters need the one lift the style allows.
    for ch, width, zone, fam, extra in (
            ("i", 34, "x-height", ["tall-sticks", "dots"],
             ("M %s L %s" % (pt(L + 8, MID - 12), pt(L + 8, MID - 11.5)), "dot", [L + 2, MID - 18, 12, 12])),
            ("j", 36, "descender", ["tails", "dots"],
             ("M %s L %s" % (pt(L + 10, MID - 12), pt(L + 10, MID - 11.5)), "dot", [L + 4, MID - 18, 12, 12])),
            ("t", 42, "ascender", ["tall-sticks", "crossbars"],
             ("M %s L %s" % (pt(L, MID), pt(L + 18, MID)), "across", [L - 6, MID - 6, 12, 12])),
            ("f", 42, "ascender", ["tall-sticks", "crossbars"],
             ("M %s L %s" % (pt(L - 1, MID), pt(L + 16, MID)), "across", [L - 7, MID - 6, 12, 12])),
            ("x", 54, "x-height", ["zigzags"],
             ("M %s L %s" % (pt(L + 36, MID), pt(L, BASE)), "down-left", [L + 30, MID - 6, 12, 12]))):
        body = us[ch]["strokes"][0]["path"]
        top = ASC if zone == "ascender" else MID
        joined(ch, body, "joined", (L + 2, top + 8 if zone != "ascender" else ASC + 10),
               width, zone, fam, us[ch]["common_errors"], lift=extra)
    return g


def digits(style):
    """Digits are the same shapes in both styles — a 7 is a 7. They differ
    only in whether an exit stroke follows, and digits never join."""
    g = {}
    def add(ch, width, strokes, errors=None):
        g[ch] = {"width": width, "zone": "digit", "family": ["digits"],
                 "strokes": [{"path": p, "dir": d, "start_zone": sz} for p, d, sz in strokes],
                 "common_errors": errors or []}
    TOPD = MID - 20                          # digits are taller than x-height
    add("0", 50, [(bowl((L + 34) / 2 + 6, (TOPD + BASE) / 2, 15, (BASE - TOPD) / 2),
                   "anticlockwise", [L + 26, TOPD + 4, 12, 12])], ["o-confusion"])
    add("1", 28, [("M %s L %s L %s" % (pt(L, TOPD + 10), pt(L + 8, TOPD), pt(L + 8, BASE)),
                   "flag-then-down", [L - 6, TOPD + 4, 12, 12])], ["no-flag"])
    add("2", 48, [("M %s C %s %s %s C %s %s %s L %s" % (
        pt(L, TOPD + 8), pt(L + 4, TOPD - 3), pt(L + 30, TOPD - 1), pt(L + 28, TOPD + 16),
        pt(L + 26, TOPD + 28), pt(L + 6, BASE - 6), pt(L, BASE), pt(L + 32, BASE)),
        "curve-then-across", [L - 6, TOPD + 2, 12, 12])], ["reversed"])
    add("3", 48, [("M %s C %s %s %s C %s %s %s" % (
        pt(L, TOPD + 6), pt(L + 8, TOPD - 4), pt(L + 30, TOPD + 2), pt(L + 18, (TOPD + BASE) / 2),
        pt(L + 34, (TOPD + BASE) / 2 + 2), pt(L + 20, BASE + 6), pt(L, BASE - 6)),
        "two-bumps", [L - 6, TOPD, 12, 12])], ["e-confusion", "flat-middle"])
    add("4", 48, [("M %s L %s L %s" % (pt(L + 22, TOPD), pt(L, BASE - 14), pt(L + 34, BASE - 14)),
                   "down-across", [L + 16, TOPD - 6, 12, 12]),
                  (stem(L + 22, TOPD + 6, BASE), "down", [L + 16, TOPD, 12, 12])], ["one-stroke"])
    add("5", 48, [("M %s L %s L %s C %s %s %s" % (
        pt(L + 30, TOPD), pt(L + 4, TOPD), pt(L + 2, TOPD + 16),
        pt(L + 24, TOPD + 10), pt(L + 32, BASE), pt(L, BASE - 3)),
        "across-down-round", [L + 24, TOPD - 6, 12, 12])], ["s-confusion"])
    add("6", 48, [("M %s C %s %s %s C %s %s %s" % (
        pt(L + 28, TOPD), pt(L + 6, TOPD + 6), pt(L, BASE - 10), pt(L + 8, BASE),
        pt(L + 30, BASE + 2), pt(L + 30, BASE - 16), pt(L + 4, BASE - 14)),
        "curve-then-loop", [L + 22, TOPD - 6, 12, 12])], ["b-confusion"])
    add("7", 46, [("M %s L %s L %s" % (pt(L, TOPD), pt(L + 32, TOPD), pt(L + 12, BASE)),
                   "across-then-down", [L - 6, TOPD - 6, 12, 12])], ["no-slant"])
    WAIST = TOPD + (BASE - TOPD) * 0.44
    add("8", 48, [("M %s C %s %s %s C %s %s %s C %s %s %s C %s %s %s" % (
        pt(L + 17, TOPD),
        pt(L + 5, TOPD), pt(L + 4, WAIST - 6), pt(L + 17, WAIST),            # top left
        pt(L + 31, WAIST + 7), pt(L + 33, BASE), pt(L + 17, BASE),            # lower right
        pt(L + 1, BASE), pt(L + 3, WAIST + 7), pt(L + 17, WAIST),             # lower left
        pt(L + 30, WAIST - 6), pt(L + 29, TOPD), pt(L + 17, TOPD)),           # top right
        "figure-of-eight", [L + 11, TOPD - 6, 12, 12])], ["not-joined", "two-circles"])
    # The loop closes back at its own start on the right, so the stem
    # continues from there — no lift, which is how a 9 is actually written.
    add("9", 48, [(bowl(L + 18, TOPD + 12, 14, 12) + " L %s" % pt(L + 32, BASE),
                   "loop-then-down", [L + 26, TOPD + 6, 12, 12])],
        ["g-confusion", "no-stem"])
    return g


FAMILY_TEACH = {
    "circles": "Start at 2 o'clock and go round to the left. The circle in o, c, a, d, g and q is the same circle every time — draw it, then add the straight bit.",
    "straight-then-circle": "Straight line first, top to bottom, then the circle. b's circle sits on the right of the line; p's does too, but the line drops below the baseline.",
    "anticlockwise-loop": "Round to the left, back up the same line, then down. The pencil never leaves the paper — that retrace is what lets the letter join.",
    "tall-sticks": "All the way up to the top line, straight down to the baseline. Tall letters are tall on purpose: l, b, d, h, k, t and f all reach.",
    "tails": "Down past the baseline into the basement. g, j, p, q and y are the only letters that go down there.",
    "humps": "Down, back up the same line, then over. One hump for n, two for m, and r stops half way.",
    "u-turns": "Down, round the bottom like a cup, back up. u and y start the same way.",
    "zigzags": "Straight lines and corners, no curves. v, w, x, z and the arms of k.",
    "snake-curves": "One curve one way, one the other. Start at the top right for s.",
    "crossbars": "Draw the tall line first, then cross it. The bar sits on the dotted middle line.",
    "dots": "Letter first, dot after — always. The dot sits above the middle line.",
    "digits": "Numbers all start at the top and most of them are one stroke.",
}


def build(style, letters, comment, font_note):
    doc = {"style": style, "comment": comment,
           "display_font": {"name": None, "licence": font_note},
           "letters": {}, "families": {}}
    doc["letters"].update(letters)
    doc["letters"].update(digits(style))
    fams = {}
    for ch, spec in doc["letters"].items():
        for fam in spec["family"]:
            fams.setdefault(fam, []).append(ch)
    for fam, chars in sorted(fams.items()):
        doc["families"][fam] = {"letters": sorted(chars),
                                "teach": FAMILY_TEACH.get(fam, "")}
    return doc


NO_FONT = ("None. These stroke paths are drawn from scratch to the general "
           "conventions of the style, not traced from any published font. "
           "Named school fonts are commercial products whose outlines and "
           "names belong to their publishers; nothing here uses either, and "
           "rendering guides from these paths needs no font at all.")


def main():
    out = os.path.join(ROOT, "data", "handwriting")
    files = [
        ("us-manuscript", us_letters(),
         "Upright manuscript print: circles and straight lines, separate strokes, "
         "no entry or exit strokes. The hand US infant classrooms teach before "
         "cursive. Generic to the style, not a copy of any named font."),
        ("uk-continuous-cursive", uk_letters(),
         "Continuous cursive: every lowercase letter leads in from the baseline "
         "and exits ready to join the next, which is what the English National "
         "Curriculum's joined handwriting expects. Only dots and crossbars lift "
         "the pen. Generic to the style, not a copy of any named font."),
    ]
    for style, letters, comment in files:
        doc = build(style, letters, comment, NO_FONT)
        path = os.path.join(out, "letterforms-%s.json" % style)
        with io.open(path, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
        print("%-24s %d letters, %d families" % (style, len(doc["letters"]), len(doc["families"])))


if __name__ == "__main__":
    main()
