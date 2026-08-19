# Needed GPCs

**Status: as of the last `python3 scripts/validate_data.py` run, `data/gpcs.json`
already contains all 172 GPCs referenced below (0 errors) — the colleague's
bank converged with everything this file flags while these sequences were
being written.** Keeping the list as-is anyway: it documents *why* each id
looks the way it does, and is still useful if either side drifts later
(e.g. `le.el` here vs a possible future `le.schwa` rename, or if `ough.uf`/
`ough.off` ever get renamed to match the `phonemes:['u','f']`-keyed-by-first-
phoneme pattern used elsewhere in the bank).

GPC ids used across `data/sequences/*.json` that a *conservative* core bank
(built straight off app.js's `GRAPHEMES`) probably won't already have —
either because the grapheme itself isn't in app.js's table, or because the
id encodes something other than one grapheme mapped to one phoneme id. All
follow the `<grapheme>.<phoneme id>` convention as best they can; flagged
ones are the cases where that convention gets stretched.

Standard GPCs (e.g. `qu.kw`, `x.ks`, `u.yoo`, `er.schwa_r`) are **not**
listed here — they use phoneme ids/teaching units already defined in
`phonemes.json`, including `x.ks`, which is one of `data/README.md`'s own
worked examples.

## 1. Composite ids (phoneme part = a multi-phoneme mnemonic, not a real phoneme id)

These don't parse as `<grapheme>.<single phoneme id>` — the part after the
dot stands in for a short sequence of phonemes. Recommend either (a) adding
matching `teaching_units` entries to `phonemes.json` (the way `ks`/`kw`/`yoo`
already work), or (b) letting `gpcs.json` give these records a `"phonemes":
[...]` array instead of a single id, per `data/README.md`'s own pattern for
`{"g":"x","p":["k","s"]}`.

| id | represents | used in |
|---|---|---|
| `ed.ed` | /ĕd/ = [e, d] (landed) | elc-bookmarks, ufli-foundations |
| `ough.uf` | [u, f] (rough) | elc-bookmarks |
| `ough.off` | [o, f] (cough) | elc-bookmarks |
| `es.iz` | /ɪz/ ending = [i, z] (boxes) | ufli-foundations |
| `est.est` | /ɪst/ ending = [i, s, t] (fastest) | ufli-foundations |
| `le.el` | syllabic /əl/ ending = [schwa, l] (apple, table) | ufli-foundations |
| `am.am`, `an.an` | glued/welded sound = [vowel, nasal] | ufli-foundations |
| `ang.ang`, `ing.ing`, `ong.ong`, `ung.ung` | glued sound = [vowel, ng] | ufli-foundations |
| `ank.ank`, `ink.ink`, `onk.onk`, `unk.unk` | glued sound = [vowel, ng, k] | ufli-foundations |

## 2. Graphemes not in app.js's GRAPHEMES table

Real, ordinary spellings that several public programs need but app.js's
14-level bookmark table never introduces (it stops at the 69 graphemes on
the physical bookmarks). All need a `grapheme` row added to `gpcs.json`.

| grapheme | GPC id(s) | example | used in |
|---|---|---|---|
| `ff` | `ff.f` | cliff | letters-and-sounds, sound-waves |
| `ll` | `ll.l` | bell | letters-and-sounds, sound-waves |
| `ss` | `ss.s` | miss | letters-and-sounds, sound-waves |
| `zz` | `zz.z` | buzz | letters-and-sounds, sound-waves |
| `tch` | `tch.ch` | catch | ufli-foundations, sound-waves |
| `ue` | `ue.oo_long`, `ue.yoo` | blue, cue | letters-and-sounds, jolly-phonics, ufli, sound-waves |
| `augh` | `augh.or` | taught | ufli-foundations, sound-waves |
| `mb` | `mb.m` | comb, lamb | ufli-foundations, sound-waves |
| `ge` | `ge.j` | cage | ufli-foundations, sound-waves |
| `es` | `es.iz` | boxes (see §1) | ufli-foundations |
| `est` | `est.est` | fastest (see §1) | ufli-foundations |
| `le` | `le.el` | apple (see §1) | ufli-foundations |
| `are` | `are.air` | care | sound-waves |
| `ere` | `ere.air`, `ere.ear` | there / here (same spelling, two sounds) | sound-waves |
| `eer` | `eer.ear` | deer | sound-waves |
| `a_e`, `e_e`, `i_e`, `o_e`, `u_e` | `a_e.ay`, `e_e.ee`, `i_e.igh`, `o_e.oa`, `u_e.oo_long`/`u_e.yoo` | cake, these, time, bone, cute | ufli-foundations, letters-and-sounds, sound-waves — already anticipated by `data/README.md`'s own id-convention section, so lowest-risk of this whole list |

## 3. Less-common secondary pronunciations of graphemes app.js only lists once

All real per app.js's own `sounds[]` arrays, but not surfaced by
elc-bookmarks (which uses primary-sound-only outside ea/ow/oo/ough/ch).
Standard GPCs, just extra ones for the colleague's bank to include.

`i.igh` (find), `o.oa` (cold), `o.u` (mother), `u.oo_short` (put),
`a.o` (wasp/want), `y.igh` (fly), `y.ee` (happy), `y.i` (gym),
`c.s` (city), `g.j` (giant), `ch.k` (school), `ch.sh` (chef),
`th.dh` (this — voiced pair of `th.th`), `si.zh` (vision),
`ie.ee`/`ie.igh` (chief/pie — both used, in different files), `ow.oa` (blow).

## 4. Task's own worked examples (for cross-check)

The task brief named these directly as the kind of thing to log; confirming
they made it in: `a_e.ay` (§2), `ere.air` (§2), `tch.ch` (§2),
`ea.ay` — used in elc-bookmarks Level 9 (break) and letters-and-sounds
Phase 5 (great).

## 5. Not a gap, just a note

`x.ks`, `qu.kw`, `u.yoo`/`ew.yoo`/`ue.yoo`, `er.schwa_r` all use phoneme ids
or `teaching_units` already defined in `phonemes.json` — completely normal
GPCs, listed here only so it's clear they were considered and don't need
reconciliation.
