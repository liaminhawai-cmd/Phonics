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


def lead_in(x, y):
    """UK entry stroke: a short diagonal up from the baseline into the
    letter. Every lowercase letter in a continuous-cursive hand starts
    with one, which is what makes the hand joinable."""
    return "M %s C %s %s %s" % (pt(x - 9, BASE), pt(x - 6, BASE - 3),
                                pt(x - 3, y + 4), pt(x, y))


def exit_flick(x, y, to_x=None):
    """UK exit stroke: leaves at the baseline heading up-right, ready to
    join whatever comes next."""
    to_x = to_x if to_x is not None else x + 10
    return "C %s %s %s" % (pt(x + 2, BASE + 1), pt(to_x - 4, BASE - 2), pt(to_x, BASE - 6))
