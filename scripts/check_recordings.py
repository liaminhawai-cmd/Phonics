#!/usr/bin/env python3
"""Find recordings that were cut off in export, and write the duration manifest.

Usage: python3 scripts/check_recordings.py            (report only)
       python3 scripts/check_recordings.py --write    (also write clips.json)

WHY THIS EXISTS
---------------
A clip that got truncated mid-sound does not fail — it plays. A 50 ms
fragment of someone saying "ay" is a click, and a child hears the app
make a noise that is not the sound they were asked for. That is worse
than silence, because silence falls back to the synthesised voice and a
click does not.

Durations come from parsing MPEG frame headers directly: no ffmpeg, no
pip installs, so this runs anywhere and in CI.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "recordings")

# How long a real clip of each kind has to be. Set from where this repo's
# own recordings actually separate, not from a guess. Sorting every clip by
# length leaves an unmistakable gap in each folder:
#
#   letters   truncated 0.050-0.148 s | gap | 0.246, 0.250 | gap | 0.426+
#   phonemes  truncated 0.054-0.104 s | gap | healthy from 0.233 s
#   words     truncated 0.100-0.127 s | gap | healthy from 0.180 s
#
# and the clips below each gap are the same ones whose waveform is still at
# 40-230% of its average peak when the file ends — cut off mid-sound rather
# than allowed to decay. Two independent signals, same verdict.
#
# The letters floor sits at 0.30, above that middle pair: x (0.246) and h
# (0.250) are the only two-part letter names in the alphabet — "ex" and
# "aitch" — and listening to x confirmed it had lost its /ks/ and was just
# saying "eh". Every letter name that survived intact runs 0.426 s or more,
# so the middle cluster is clipped rather than merely brisk.
#
# The floors sit inside each gap, closer to the truncated side, because a
# false positive costs a re-record and a false negative costs a child
# hearing the wrong sound.
FLOORS = {"letters": 0.30, "phonemes": 0.15, "ui": 0.20, "words": 0.15,
          "words-segmented": 0.35}
DEFAULT_FLOOR = 0.15

BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
RATES = {0: [44100, 48000, 32000], 2: [22050, 24000, 16000], 3: [11025, 12000, 8000]}


def id3_size(b):
    """Bytes to skip for an ID3v2 tag (syncsafe length), 0 if none."""
    if len(b) < 10 or b[:3] != b"ID3":
        return 0
    n = (b[6] & 0x7F) << 21 | (b[7] & 0x7F) << 14 | (b[8] & 0x7F) << 7 | (b[9] & 0x7F)
    return 10 + n


def xing_duration(b, start, ver, rate, spf, chan_mode):
    """Exact playable length from the Xing/Info + LAME tag, or None.

    This is the number a browser reports, because it is the number a
    browser plays: the encoder's own frame count, minus the delay it
    padded onto the front and the padding it left on the end. Walking
    frames alone overstates a short clip by ~60 ms of that padding —
    enough to make a 50 ms fragment look like a real sound.
    """
    side = (32 if chan_mode != 3 else 17) if ver == 3 else (17 if chan_mode != 3 else 9)
    i = start + 4 + side
    if b[i:i + 4] not in (b"Xing", b"Info"):
        return None
    flags = int.from_bytes(b[i + 4:i + 8], "big")
    if not (flags & 1):                       # no frame count, nothing to use
        return None
    p = i + 8
    frames = int.from_bytes(b[p:p + 4], "big"); p += 4
    if flags & 2: p += 4                      # byte count
    if flags & 4: p += 100                    # TOC
    if flags & 8: p += 4                      # quality
    samples = frames * spf
    # LAME/Lavc extension: 9-byte encoder string, then fixed fields, then a
    # 12-bit delay and 12-bit padding packed into three bytes.
    tag = b[p:p + 4]
    if tag[:4] in (b"LAME", b"Lavc", b"Lavf"):
        d = p + 9 + 1 + 1 + 8 + 1 + 1
        trip = b[d:d + 3]
        if len(trip) == 3:
            delay = (trip[0] << 4) | (trip[1] >> 4)
            pad = ((trip[1] & 0xF) << 8) | trip[2]
            samples -= delay + pad
    return max(0.0, samples / rate)


def mp3_duration(path):
    """Playable seconds. None if the file isn't parseable as MP3."""
    with open(path, "rb") as f:
        b = f.read()
    i = id3_size(b)
    total_samples, rate, first = 0, None, None
    while i + 4 <= len(b):
        if b[i] != 0xFF or (b[i + 1] & 0xE0) != 0xE0:
            i += 1                                   # resync
            continue
        ver = (b[i + 1] >> 3) & 3                    # 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
        layer = (b[i + 1] >> 1) & 3                  # 1 = Layer III
        bri = (b[i + 2] >> 4) & 0xF
        sri = (b[i + 2] >> 2) & 3
        pad = (b[i + 2] >> 1) & 1
        chan = (b[i + 3] >> 6) & 3
        if layer != 1 or sri == 3 or bri in (0, 15) or ver == 1:
            i += 1
            continue
        rate = RATES[0 if ver == 3 else (2 if ver == 2 else 3)][sri]
        kbps = (BITRATES_V1_L3 if ver == 3 else BITRATES_V2_L3)[bri]
        spf = 1152 if ver == 3 else 576
        size = int((spf / 8 * kbps * 1000) / rate) + pad
        if size <= 0 or i + size + 4 > len(b):
            i += 1
            continue
        # A real frame is followed by another frame header (or the file end).
        nxt = b[i + size:i + size + 2]
        if len(nxt) == 2 and (nxt[0] != 0xFF or (nxt[1] & 0xE0) != 0xE0):
            i += 1
            continue
        if first is None:
            first = i
            exact = xing_duration(b, i, ver, rate, spf, chan)
            if exact is not None:
                return exact
        total_samples += spf
        i += size
    if not rate or not total_samples:
        return None
    return total_samples / rate
def walk():
    out = []
    for accent in sorted(os.listdir(REC)):
        adir = os.path.join(REC, accent)
        if not os.path.isdir(adir):
            continue
        for kind in sorted(os.listdir(adir)):
            kdir = os.path.join(adir, kind)
            if not os.path.isdir(kdir):
                continue
            for name in sorted(os.listdir(kdir)):
                if not name.endswith(".mp3"):
                    continue
                path = os.path.join(kdir, name)
                rel = "recordings/%s/%s/%s" % (accent, kind, name)
                out.append((rel, kind, mp3_duration(path)))
    return out


def main():
    clips = walk()
    if not clips:
        print("No .mp3 recordings found under recordings/.")
        return 0

    short, unreadable, manifest = [], [], {}
    for rel, kind, secs in clips:
        if secs is None:
            unreadable.append(rel)
            continue
        manifest[rel] = round(secs, 3)
        if secs < FLOORS.get(kind, DEFAULT_FLOOR):
            short.append((rel, kind, secs))

    print("%d clips scanned." % len(clips))
    if unreadable:
        print("\n%d could not be parsed as MP3:" % len(unreadable))
        for rel in unreadable:
            print("   %s" % rel)

    if short:
        print("\n%d look cut off — too short to be the whole sound:\n" % len(short))
        for rel, kind, secs in sorted(short, key=lambda r: r[2]):
            print("   %-44s %5d ms   (a real %s clip runs %d ms+)"
                  % (rel, secs * 1000, kind.rstrip("s"), FLOORS.get(kind, DEFAULT_FLOOR) * 1000))
        print("\nThese need re-recording. Until then the app skips them and uses"
              "\nthe next fallback, so a child never hears the clipped fragment.")
    else:
        print("\nNothing looks truncated.")

    if "--write" in sys.argv:
        path = os.path.join(REC, "clips.json")
        payload = {
            "comment": ("Generated by scripts/check_recordings.py — do not hand-edit. "
                        "js/core/audio.js reads tooShort and skips those clips, so a "
                        "truncated export falls back to the next source instead of "
                        "playing a click at a child."),
            "floors": FLOORS,
            "tooShort": sorted(rel for rel, _, _ in short),
            "durations": manifest,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=1, sort_keys=True)
            f.write("\n")
        print("\nWrote recordings/clips.json (%d durations)." % len(manifest))
    return 1 if short or unreadable else 0


if __name__ == "__main__":
    sys.exit(main())
