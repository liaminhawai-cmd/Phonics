# js/vendor/ — third-party code

Everything in this folder is **vendored**: copied in verbatim, licence header
intact, loaded as a plain `<script>` like the rest of the app. No build step,
no package manager at runtime, no CDN at page load (the site must keep working
offline and from `file://`). If you update a file here, update this table too.

| File | Library | Version | Licence | Source |
|---|---|---|---|---|
| `qrcode-generator.js` | qrcode-generator (Kazuhiko Arase) | 2.0.4 | MIT | `npm pack qrcode-generator` → `package/dist/qrcode.js` (also at <https://unpkg.com/qrcode-generator@2.0.4/qrcode.js>, repo <https://github.com/kazuhikoarase/qrcode-generator>) |

## qrcode-generator

Used by `js/views/sheets.js` (T11 sheet generator) to put a "scan to hear the
words" QR code in the footer of every printable sheet.

- Exposes a single global factory: `qrcode(typeNumber, errorCorrectionLevel)`.
  `typeNumber: 0` auto-sizes the symbol to the data.
- Usage: `const q = qrcode(0, "M"); q.addData(url); q.make();` then
  `q.createDataURL(cell, margin)` (GIF data URI — prints crisply, needs no
  canvas) or `q.createSvgTag()` / `q.createImgTag()` / `q.isDark(r, c)`.
- UTF-8: the distributed file registers `qrcode.stringToBytesFuncs["UTF-8"]`
  but defaults to the Latin-1 encoder. Callers that may pass non-ASCII text
  should opt in once at start-up:
  `qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];`
  (`sheets.js` does this — sheet titles contain en dashes.)
- The file ends with a UMD-ish wrapper, so `require()` works in Node too, which
  is how the vendored copy is smoke-tested (`qrcode(0,"L")` over
  `https://example.com/play?words=cat` → 29 modules).

The trademark note in the file's header is part of the upstream licence block:
"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
