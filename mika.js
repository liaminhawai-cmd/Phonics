// ============================================================
// Mika's Phonics Trainer — trilingual (English / Mandarin / Cantonese)
//
// A special build just for Mika:
//   • Bookmark levels only (no year-level view)
//   • Both practice modes: Look & Say + Listen & Write
//   • Every instruction and button shown in English, Mandarin
//     (with Hanyu Pinyin) and Cantonese (with Jyutping)
//
// The drill itself is identical to the main app: wrong answers go
// back in the deck, mastered cards drop out, and a report turns
// first-try misses into targeted homework.
// ============================================================

// ---- Trilingual strings: en = English, cn/cnP = Mandarin + pinyin,
//      yue/yueP = Cantonese + Jyutping ----
const T = {
  subtitle:      { en: "Hear it or see it, say it or write it, then check.",
                   cn: "听或看，说或写，然后检查。", cnP: "tīng huò kàn, shuō huò xiě",
                   yue: "聽或者睇，講或者寫，然後檢查。", yueP: "teng1 waak6 tai2, gong2 waak6 se2" },

  modeSayTitle:  { en: "Look & Say", cn: "看一看，说一说", cnP: "kàn yi kàn, shuō yi shuō",
                   yue: "睇一睇，講一講", yueP: "tai2 jat1 tai2, gong2 jat1 gong2" },
  modeSayDesc:   { en: "See the code, say the sound, then listen to check.",
                   cn: "看字母，读出声音，再听录音检查。", cnP: "kàn zìmǔ, dú chū shēngyīn",
                   yue: "睇字母，讀個音出嚟，再聽錄音檢查。", yueP: "tai2 zi6 mou5, duk6 go3 jam1" },
  modeWriteTitle:{ en: "Listen & Write", cn: "听一听，写一写", cnP: "tīng yi tīng, xiě yi xiě",
                   yue: "聽一聽，寫一寫", yueP: "teng1 jat1 teng1, se2 jat1 se2" },
  modeWriteDesc: { en: "Hear the sound, then type or handwrite the code.",
                   cn: "听声音，然后打字或手写字母。", cnP: "tīng shēngyīn, dǎzì huò shǒuxiě",
                   yue: "聽個音，然後打字或者手寫字母。", yueP: "teng1 go3 jam1, daa2 zi6 waak6 sau2 se2" },

  back:          { en: "← Back", cn: "返回", cnP: "fǎnhuí", yue: "返回", yueP: "faan1 wui4" },
  selected:      { en: "selected", cn: "已选", cnP: "yǐ xuǎn", yue: "已揀", yueP: "ji5 gaan2" },
  selectAll:     { en: "Select all", cn: "全选", cnP: "quán xuǎn", yue: "全部揀", yueP: "cyun4 bou6 gaan2" },
  clear:         { en: "Clear", cn: "清除", cnP: "qīngchú", yue: "清除", yueP: "cing1 ceoi4" },
  trackerHint:   { en: "Tap a code to pick it, or tap a number to pick the whole level.",
                   cn: "点字母选一个，点号码选整级。", cnP: "diǎn zìmǔ xuǎn yī gè",
                   yue: "撳字母揀一個，撳號碼揀成級。", yueP: "gam6 zi6 mou5, gam6 hou6 maa5" },
  start:         { en: "Start practising", cn: "开始练习", cnP: "kāishǐ liànxí",
                   yue: "開始練習", yueP: "hoi1 ci2 lin6 zaap6" },

  bookmarkLevels:{ en: "Bookmark Levels", cn: "书签等级", cnP: "shūqiān děngjí",
                   yue: "書籤等級", yueP: "syu1 cim1 dang2 kap1" },

  exit:          { en: "Exit", cn: "退出", cnP: "tuìchū", yue: "退出", yueP: "teoi3 ceot1" },
  sayHint:       { en: "Read this code and say its sound out loud.",
                   cn: "读出这个字母的声音。", cnP: "dú chū zhège zìmǔ de shēngyīn",
                   yue: "讀出呢個字母嘅聲。", yueP: "duk6 ceot1 ni1 go3 zi6 mou5 ge3 seng1" },
  listenCheck:   { en: "Listen to check", cn: "听录音检查", cnP: "tīng lùyīn jiǎnchá",
                   yue: "聽錄音檢查", yueP: "teng1 luk6 jam1 gim2 caa4" },
  missed:        { en: "Missed it", cn: "答错了", cnP: "dá cuò le", yue: "答錯咗", yueP: "daap3 co3 zo2" },
  gotIt:         { en: "Got it", cn: "答对了", cnP: "dá duì le", yue: "答啱咗", yueP: "daap3 ngaam1 zo2" },
  playSound:     { en: "Play sound", cn: "播放声音", cnP: "bòfàng shēngyīn",
                   yue: "播放聲音", yueP: "bo3 fong3 sing1 jam1" },
  writeHint:     { en: "Listen, then type or write the code.",
                   cn: "听完，打字或写出字母。", cnP: "tīng wán, dǎzì huò xiě",
                   yue: "聽完，打字或者寫出字母。", yueP: "teng1 jyun4, daa2 zi6 waak6 se2" },
  type:          { en: "Type", cn: "打字", cnP: "dǎzì", yue: "打字", yueP: "daa2 zi6" },
  handwrite:     { en: "Handwrite", cn: "手写", cnP: "shǒuxiě", yue: "手寫", yueP: "sau2 se2" },
  check:         { en: "Check", cn: "检查", cnP: "jiǎnchá", yue: "檢查", yueP: "gim2 caa4" },
  showAnswer:    { en: "Show answer", cn: "显示答案", cnP: "xiǎnshì dá'àn",
                   yue: "顯示答案", yueP: "hin2 si6 daap3 on3" },
  again:         { en: "Again", cn: "再来一次", cnP: "zài lái yīcì", yue: "再嚟多次", yueP: "zoi3 lai4 do1 ci3" },
  clearPlain:    { en: "clear", cn: "清除", cnP: "qīngchú", yue: "清除", yueP: "cing1 ceoi4" },
  mastered:      { en: "Mastered", cn: "已掌握", cnP: "yǐ zhǎngwò", yue: "已掌握", yueP: "ji5 zoeng2 aak1" },
  shelfEmpty:    { en: "Codes you get right appear here.",
                   cn: "答对的字母会出现在这里。", cnP: "dá duì de zìmǔ",
                   yue: "答啱嘅字母會喺度出現。", yueP: "daap3 ngaam1 ge3 zi6 mou5" },
  typePlaceholder:{ en: "type here", cn: "在这里打字", cnP: "", yue: "喺度打字", yueP: "" },

  wellDone:      { en: "Well done!", cn: "做得好！", cnP: "zuò dé hǎo", yue: "做得好！", yueP: "zou6 dak1 hou2" },
  perfect:       { en: "Perfect run — everything right first go! 🎉",
                   cn: "完美！全部第一次就答对！", cnP: "wánměi",
                   yue: "完美！全部第一次就答啱！", yueP: "jyun4 mei5" },
  reviseThese:   { en: "Revise these", cn: "需要复习", cnP: "xūyào fùxí",
                   yue: "需要溫習", yueP: "seoi1 jiu3 wan1 zaap6" },
  remedyReadSub: { en: "Codes to read again — tap to watch the reading demo or open the activity sheets.",
                   cn: "需要再读的字母 — 点击观看朗读示范或打开练习纸。", cnP: "",
                   yue: "需要再讀嘅字母 — 撳一下睇朗讀示範或者打開練習紙。", yueP: "" },
  remedyWriteSub:{ en: "Codes to write again — tap to watch the writing demo or open the activity sheets.",
                   cn: "需要再写的字母 — 点击观看书写示范或打开练习纸。", cnP: "",
                   yue: "需要再寫嘅字母 — 撳一下睇書寫示範或者打開練習紙。", yueP: "" },
  readingDemo:   { en: "▶ Reading demo", cn: "朗读示范", cnP: "lǎngdú shìfàn",
                   yue: "朗讀示範", yueP: "long5 duk6 si6 faan6" },
  writingDemo:   { en: "▶ Writing demo", cn: "书写示范", cnP: "shūxiě shìfàn",
                   yue: "書寫示範", yueP: "syu1 se2 si6 faan6" },
  demo:          { en: "▶ Demo", cn: "示范", cnP: "shìfàn", yue: "示範", yueP: "si6 faan6" },
  printReport:   { en: "Save / print report", cn: "保存／打印报告", cnP: "bǎocún / dǎyìn",
                   yue: "儲存／打印報告", yueP: "cou5 cyun4 / daa2 jan3" },
  reviewMissed:  { en: "Review missed", cn: "复习答错的", cnP: "fùxí dá cuò de",
                   yue: "溫習答錯嘅", yueP: "wan1 zaap6 daap3 co3" },
  newSession:    { en: "New session", cn: "重新开始", cnP: "chóngxīn kāishǐ",
                   yue: "重新開始", yueP: "cung4 san1 hoi1 ci2" },
};

// Sound-category names, trilingual (used on the filter pills).
const CAT_T = {
  "Short Vowels":        { en: "Short Vowels", cn: "短元音", cnP: "duǎn yuányīn", yue: "短元音", yueP: "dyun2 jyun4 jam1" },
  "Long Vowels":         { en: "Long Vowels", cn: "长元音", cnP: "cháng yuányīn", yue: "長元音", yueP: "coeng4 jyun4 jam1" },
  "R-Controlled Vowels": { en: "R-Controlled", cn: "R元音", cnP: "R yuányīn", yue: "R元音", yueP: "R jyun4 jam1" },
  "Other Vowels":        { en: "Other Vowels", cn: "其他元音", cnP: "qítā yuányīn", yue: "其他元音", yueP: "kei4 taa1 jyun4 jam1" },
  "Stops":               { en: "Stops", cn: "爆破音", cnP: "bàopò yīn", yue: "爆破音", yueP: "baau3 po3 jam1" },
  "Nasals":              { en: "Nasals", cn: "鼻音", cnP: "bíyīn", yue: "鼻音", yueP: "bei6 jam1" },
  "Fricatives":          { en: "Fricatives", cn: "摩擦音", cnP: "mócā yīn", yue: "摩擦音", yueP: "mo1 caat3 jam1" },
  "Affricates":          { en: "Affricates", cn: "塞擦音", cnP: "sècā yīn", yue: "塞擦音", yueP: "sak1 caat3 jam1" },
  "Approximants":        { en: "Approximants", cn: "近音", cnP: "jìn yīn", yue: "近音", yueP: "kan5 jam1" },
  "Lateral":             { en: "Lateral", cn: "边音", cnP: "biānyīn", yue: "边音", yueP: "bin1 jam1" },
  "Other Codes":         { en: "Other Codes", cn: "其他字母", cnP: "qítā zìmǔ", yue: "其他字母", yueP: "kei4 taa1 zi6 mou5" },
};

// Build a trilingual block from a {en,cn,cnP,yue,yueP} object.
function triBlock(t) {
  if (!t) return "";
  const cn = t.cn ? (t.cn + (t.cnP ? " · " + t.cnP : "")) : "";
  const yue = t.yue ? (t.yue + (t.yueP ? " · " + t.yueP : "")) : "";
  return '<span class="tl">' +
    '<span class="tl-en">' + t.en + '</span>' +
    (cn ? '<span class="tl-cn">' + cn + '</span>' : '') +
    (yue ? '<span class="tl-yue">' + yue + '</span>' : '') +
    '</span>';
}
function tri(key) { return triBlock(T[key]); }
// Inline trilingual from three raw strings (for dynamic text with numbers).
function triStr(en, cn, yue) {
  return '<span class="tl"><span class="tl-en">' + en + '</span>' +
    '<span class="tl-cn">' + cn + '</span>' +
    '<span class="tl-yue">' + yue + '</span></span>';
}

// ============================================================
// Phonics data (shared with the main app)
// ============================================================
const GRAPHEMES = [
  { grapheme: "a",  audio: "A",    sounds: [{s:"ă", ex:"at"}, {s:"ā", ex:"navy"}, {s:"ah", ex:"last"}] },
  { grapheme: "b",  audio: "B",    sounds: [{s:"b", ex:"rib"}] },
  { grapheme: "c",  audio: "C",    sounds: [{s:"k", ex:"can"}, {s:"s", ex:"cent"}] },
  { grapheme: "d",  audio: "D",    sounds: [{s:"d", ex:"lid"}] },
  { grapheme: "e",  audio: "E",    sounds: [{s:"ĕ", ex:"end"}, {s:"ē", ex:"me"}] },
  { grapheme: "f",  audio: "F",    sounds: [{s:"f", ex:"if"}] },
  { grapheme: "g",  audio: "G",    sounds: [{s:"g", ex:"bag"}, {s:"j", ex:"gem"}] },
  { grapheme: "h",  audio: "H",    sounds: [{s:"h", ex:"him"}] },
  { grapheme: "i",  audio: "I",    sounds: [{s:"ĭ", ex:"sit"}, {s:"ī", ex:"silent"}] },
  { grapheme: "j",  audio: "J",    sounds: [{s:"j", ex:"jam"}] },
  { grapheme: "k",  audio: "K",    sounds: [{s:"k", ex:"ink"}] },
  { grapheme: "l",  audio: "L",    sounds: [{s:"l", ex:"leg"}] },
  { grapheme: "m",  audio: "M",    sounds: [{s:"m", ex:"am"}] },
  { grapheme: "n",  audio: "N",    sounds: [{s:"n", ex:"in"}] },
  { grapheme: "o",  audio: "O",    sounds: [{s:"ŏ", ex:"odd"}, {s:"ō", ex:"open"}, {s:"oo", ex:"do"}] },
  { grapheme: "p",  audio: "P",    sounds: [{s:"p", ex:"map"}] },
  { grapheme: "qu", audio: "Qu",   sounds: [{s:"kw", ex:"quit"}] },
  { grapheme: "r",  audio: "R",    sounds: [{s:"r", ex:"rat"}] },
  { grapheme: "s",  audio: "S",    sounds: [{s:"s", ex:"us"}, {s:"z", ex:"as"}] },
  { grapheme: "t",  audio: "T",    sounds: [{s:"t", ex:"bat"}] },
  { grapheme: "u",  audio: "U",    sounds: [{s:"ŭ", ex:"up"}, {s:"ū", ex:"music"}, {s:"oo", ex:"put"}] },
  { grapheme: "v",  audio: "V",    sounds: [{s:"v", ex:"van"}] },
  { grapheme: "w",  audio: "W",    sounds: [{s:"w", ex:"win"}] },
  { grapheme: "x",  audio: "X",    sounds: [{s:"ks", ex:"box"}] },
  { grapheme: "y",  audio: "Y",    sounds: [{s:"y", ex:"yes"}, {s:"ī", ex:"by"}, {s:"ĭ", ex:"gym"}] },
  { grapheme: "z",  audio: "Z",    sounds: [{s:"z", ex:"zoo"}] },
  { grapheme: "ai",   audio: "Ai",   sounds: [{s:"ā", ex:"rain"}] },
  { grapheme: "ar",   audio: "Ar",   sounds: [{s:"ar", ex:"far"}] },
  { grapheme: "au",   audio: "Au",   sounds: [{s:"au", ex:"sauce"}] },
  { grapheme: "aw",   audio: "Aw",   sounds: [{s:"aw", ex:"jaw"}] },
  { grapheme: "ay",   audio: "Ay",   sounds: [{s:"ā", ex:"day"}] },
  { grapheme: "ch",   audio: "Ch",   sounds: [{s:"ch", ex:"chop"}, {s:"k", ex:"school"}, {s:"sh", ex:"chef"}] },
  { grapheme: "ci",   audio: "Ci",   sounds: [{s:"sh", ex:"social"}] },
  { grapheme: "ck",   audio: "Ck",   sounds: [{s:"k", ex:"neck"}] },
  { grapheme: "dge",  audio: "Dge",  sounds: [{s:"j", ex:"bridge"}] },
  { grapheme: "ea",   audio: "Ea",   sounds: [{s:"ē", ex:"eat"}, {s:"ĕ", ex:"head"}, {s:"ā", ex:"break"}] },
  { grapheme: "ear",  audio: "Ear",  sounds: [{s:"er", ex:"early"}] },
  { grapheme: "ed",   audio: "Ed",   sounds: [{s:"ĕd", ex:"landed"}, {s:"d", ex:"loved"}, {s:"t", ex:"picked"}] },
  { grapheme: "ee",   audio: "Ee",   sounds: [{s:"ē", ex:"see"}] },
  { grapheme: "ei",   audio: "Ei",   sounds: [{s:"ē", ex:"receive"}, {s:"ā", ex:"veil"}, {s:"ī", ex:"forfeit"}] },
  { grapheme: "eigh", audio: "Eigh", sounds: [{s:"ā", ex:"eight"}] },
  { grapheme: "er",   audio: "Er",   sounds: [{s:"er", ex:"her"}] },
  { grapheme: "ew",   audio: "Ew",   sounds: [{s:"ōō", ex:"grew"}, {s:"ū", ex:"new"}] },
  { grapheme: "ey",   audio: "Ey",   sounds: [{s:"ā", ex:"they"}, {s:"ē", ex:"key"}, {s:"ī", ex:"donkey"}] },
  { grapheme: "gn",   audio: "Gn",   sounds: [{s:"n", ex:"gnome"}] },
  { grapheme: "gu",   audio: "Gu",   sounds: [{s:"g", ex:"guess"}] },
  { grapheme: "ie",   audio: "Ie",   sounds: [{s:"ē", ex:"chief"}, {s:"ī", ex:"pie"}, {s:"ĭ", ex:"parties"}] },
  { grapheme: "igh",  audio: "Igh",  sounds: [{s:"ī", ex:"light"}] },
  { grapheme: "ir",   audio: "Ir",   sounds: [{s:"er", ex:"first"}] },
  { grapheme: "kn",   audio: "Kn",   sounds: [{s:"n", ex:"knot"}] },
  { grapheme: "ng",   audio: "Ng",   sounds: [{s:"ng", ex:"sang"}] },
  { grapheme: "oa",   audio: "Oa",   sounds: [{s:"ō", ex:"boat"}] },
  { grapheme: "oe",   audio: "Oe",   sounds: [{s:"ō", ex:"toe"}] },
  { grapheme: "oi",   audio: "Oi",   sounds: [{s:"oi", ex:"point"}] },
  { grapheme: "oo",   audio: "Oo",   sounds: [{s:"ōō", ex:"food"}, {s:"ŏŏ", ex:"cook"}] },
  { grapheme: "or",   audio: "Or",   sounds: [{s:"or", ex:"for"}] },
  { grapheme: "ou",   audio: "Ou",   sounds: [{s:"ow", ex:"round"}, {s:"ō", ex:"shoulder"}, {s:"oo", ex:"you"}, {s:"ŭ", ex:"famous"}] },
  { grapheme: "ough", audio: "Ough", sounds: [{s:"ō", ex:"though"}, {s:"ōō", ex:"through"}, {s:"ŭf", ex:"rough"}, {s:"ŏff", ex:"cough"}, {s:"aw", ex:"thought"}, {s:"ow", ex:"drought"}] },
  { grapheme: "ow",   audio: "Ow",   sounds: [{s:"ow", ex:"how"}, {s:"ō", ex:"low"}] },
  { grapheme: "oy",   audio: "Oy",   sounds: [{s:"oy", ex:"boy"}] },
  { grapheme: "ph",   audio: "Ph",   sounds: [{s:"f", ex:"phone"}] },
  { grapheme: "sh",   audio: "Sh",   sounds: [{s:"sh", ex:"dish"}] },
  { grapheme: "si",   audio: "Si",   sounds: [{s:"sh", ex:"session"}, {s:"zh", ex:"vision"}] },
  { grapheme: "th",   audio: "Th",   sounds: [{s:"th", ex:"thin"}, {s:"th", ex:"this"}] },
  { grapheme: "ti",   audio: "Ti",   sounds: [{s:"sh", ex:"nation"}] },
  { grapheme: "ui",   audio: "Ui",   sounds: [{s:"ōō", ex:"fruit"}, {s:"ū", ex:"nuisance"}] },
  { grapheme: "ur",   audio: "Ur",   sounds: [{s:"er", ex:"nurse"}] },
  { grapheme: "wh",   audio: "Wh",   sounds: [{s:"hw", ex:"when"}] },
  { grapheme: "wor",  audio: "Wor",  sounds: [{s:"er", ex:"works"}] },
  { grapheme: "wr",   audio: "Wr",   sounds: [{s:"r", ex:"wrap"}] },
];

// Colours match the printed physical bookmarks.
const BOOKMARK_LEVELS = [
  { name: "Level 1 – APTIN",  graphemes: ["a","p","t","i","n"],        colour: "#cfe0f5" },
  { name: "Level 2 – SMOBC",  graphemes: ["s","m","o","b","c"],        colour: "#5b9bd5" },
  { name: "Level 3 – GHKDE",  graphemes: ["g","h","k","d","e"],        colour: "#dcd6ec" },
  { name: "Level 4 – LRFVU",  graphemes: ["l","r","f","v","u"],        colour: "#7c64b0" },
  { name: "Level 5 – JWZXY",  graphemes: ["j","w","z","x","y"],        colour: "#d4e6c5" },
  { name: "Level 6",          graphemes: ["qu","sh","th","ch","ay"],   colour: "#84b063" },
  { name: "Level 7",          graphemes: ["wh","ck","ee","er","ar"],   colour: "#fbecc2" },
  { name: "Level 8",          graphemes: ["ed","oo","igh","ai","oy"],  colour: "#f5c33c" },
  { name: "Level 9",          graphemes: ["oi","oa","ea","ir","ow"],   colour: "#f3cbc4" },
  { name: "Level 10",         graphemes: ["oe","au","aw","or","wr"],   colour: "#d75f50" },
  { name: "Level 11",         graphemes: ["ph","kn","ie","ei","eigh"], colour: "#ededed" },
  { name: "Level 12",         graphemes: ["ou","ew","ur","ear","wor"], colour: "#d6e5ec" },
  { name: "Level 13",         graphemes: ["dge","ui","ng","ey","ough"],colour: "#97b5d7" },
  { name: "Level 14",         graphemes: ["gu","ti","si","ci","gn"],   colour: "#cacaca" },
];

const F = "https://drive.google.com/file/d/";
const A = "activities/level-";

const BOOKMARK_RESOURCES = [
  { reading: F+"1V8Ux6hEoJTtqXd0AWvERm_Equv45BOpl/view", writing: F+"1QXFrY3GRznRow7xdJbhaZKzR215DCkcv/view", activities: [
    { name: "Initial sounds – look & write",   url: A+"1/aptin initial sounds look and write.pdf?v=2", kind: "look"  },
    { name: "End sounds – look & write",        url: A+"1/aptin end sounds look and write.pdf?v=2", kind: "look"  },
    { name: "Initial sounds – listen & write",  url: A+"1/aptin initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"1/aptin end sounds listen and write.pdf", kind: "write" },
    { name: "Reading cards",                    url: A+"1/aptin reading cards.pdf", kind: "read"  },
  ]},
  { reading: F+"1TsMeIck3VgGbhrnGcF6OHkRwxKML3Y67/view", writing: F+"1QjAY9Y6X3PtZklMj8rixuikZ58LKCJ61/view", activities: [
    { name: "Initial sounds – look & write",   url: A+"2/SMOBC initial sounds look and write.pdf", kind: "look"  },
    { name: "End sounds – look & write",        url: A+"2/SMOBC end sounds look and write.pdf", kind: "look"  },
    { name: "Initial sounds – listen & write",  url: A+"2/SMOBC initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"2/SMOBC end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"2/SMOBC Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1VVQ4G9VYTjxzRALsmljpByX4SXiizeeX/view", writing: F+"1QoqthUwCkmBlzeysnMauFZa09x8UFDrC/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"3/GHKDE initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"3/GHKDE end sounds listen and write.pdf", kind: "write" },
    { name: "Reading cards",                    url: A+"3/GHKDE reading cards.pdf", kind: "read"  },
  ]},
  { reading: F+"1VWCLqajUMABx3rwYXqi3p4_PC-r4AD7j/view", writing: F+"1QutZua5oFC5cnW42k8Mh-BEjzuKUvX8f/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"4/LFRVU initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"4/LFRVU end sounds listen and write.pdf", kind: "write" },
    { name: "Reading cards",                    url: A+"4/LFRVU reading cards.pdf", kind: "read"  },
    { name: "Reading words",                    url: A+"4/LFRVU Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1VlO4zWHFD5MJZuDYEAembv4AvVPU8fts/view", writing: F+"1Qxy117ZfgqNM9517bixJEXUWRe8u-xYY/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"5/JWZXY initial sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"5/JWZXY end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"5/JWZXY Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UQWCRM8jELug9m8OOkbILteSi0pbDQGw/view", writing: F+"1R5k6DPw5Cc9AHCmboOkW4V6RqM32TKqI/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"6/QuShThChAy initial sounds listen and write.pdf", kind: "write" },
    { name: "Middle sounds – listen & write",   url: A+"6/QuShThChAy middle sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"6/QuShThChAy end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"6/QuShThChAy Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UNwGUC3eFqi4sPPI9lmLJEhn5KwvosZa/view", writing: F+"1RI6qnr4swOZfthMTOZKy_e34u6Yhig2b/view", activities: [
    { name: "Initial sounds – listen & write",  url: A+"7/WhCkEeErAr initial sounds listen and write.pdf", kind: "write" },
    { name: "Middle sounds – listen & write",   url: A+"7/WhCkEeErAr middle sounds listen and write.pdf", kind: "write" },
    { name: "End sounds – listen & write",      url: A+"7/WhCkEeErAr end sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"7/WhCkEeErAr Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UEn-tMQ4oXfrSAo9CyB8cVcvd9p30uB7/view", writing: F+"1RLRUuQgW-z5hhyd0jppVhMDIg6OoT6bb/view", activities: [
    { name: "Middle sounds – listen & write",   url: A+"8/EdOoIghAiOy middle sounds listen and write.pdf", kind: "write" },
    { name: "Reading words",                    url: A+"8/EdOoIghAiOy Reading words.pdf", kind: "read"  },
  ]},
  { reading: F+"1UElswdzVuMCZlFoewpjt05opVTscmtjJ/view", writing: null, activities: [] },
  { reading: F+"1UDhOLPyJZiptqvkCw9JYmsBPmurxWDsc/view", writing: null, activities: [] },
  { reading: F+"1UAiMkQEqVh1v7IkbsBkrMwxsiqtaqZPZ/view", writing: null, activities: [] },
  { reading: F+"1U7_IS7j8JJvvvC3iPAN9XDcffVnggmKt/view", writing: null, activities: [] },
  { reading: F+"1U-6Ij0S7B_ov5DgYyxxdDpqvQy2ZiPEI/view", writing: null, activities: [] },
  { reading: F+"1TzfD4KFQjUkxHzcQPFA9z5U1ayMD2MAN/view", writing: null, activities: [] },
];

const PHON_GROUPS = [
  { name: "Short Vowels",        graphemes: ["a","e","i","o","u"] },
  { name: "Long Vowels",         graphemes: ["ay","ai","ee","ea","ie","igh","oe","oa","ow","oo","ew","ui","ey","ei","eigh"] },
  { name: "R-Controlled Vowels", graphemes: ["ar","er","ir","ur","or","ear","wor"] },
  { name: "Other Vowels",        graphemes: ["ou","oy","oi","au","aw"] },
  { name: "Stops",               graphemes: ["p","b","t","d","k","c","g","ck","qu","x","gu"] },
  { name: "Nasals",              graphemes: ["m","n","ng","kn","gn"] },
  { name: "Fricatives",          graphemes: ["f","v","th","s","z","sh","h","ph","wh","ci","si","ti"] },
  { name: "Affricates",          graphemes: ["ch","j","dge"] },
  { name: "Approximants",        graphemes: ["w","r","y","wr"] },
  { name: "Lateral",             graphemes: ["l"] },
  { name: "Other Codes",         graphemes: ["ed","ough"] },
];

const graphemeIndex = {};
GRAPHEMES.forEach((g, i) => { graphemeIndex[g.grapheme] = i; });

const graphemeToBookmark = {};
BOOKMARK_LEVELS.forEach((lvl, i) => {
  lvl.graphemes.forEach((gr) => { graphemeToBookmark[gr] = i; });
});

// ============================================================
// State
// ============================================================
let practiceMode = "say";   // "say" | "write"
let inputMode = "type";     // "type" | "write"

const selected = new Set();
let activeCats = new Set();
let queue = [];
let current = null;
let sessionTotal = 0;
let attempts = {};
let masteredOnTry = {};
let missed = new Set();

const $ = (id) => document.getElementById(id);
const screens = {};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
}

function chooseMode(mode) { practiceMode = mode; buildSelectScreen(); showScreen("select"); }

function buildSelectScreen() {
  selected.clear(); activeCats.clear();
  const modeT = practiceMode === "say" ? T.modeSayTitle : T.modeWriteTitle;
  $("selectTitle").innerHTML = triStr(
    modeT.en + " · " + T.bookmarkLevels.en,
    modeT.cn + " · " + T.bookmarkLevels.cn,
    modeT.yue + " · " + T.bookmarkLevels.yue
  );
  buildCategoryBar();
  buildTrackerGrid($("groupContainer"));
  refreshCount();
}

// ---- Sound category filter pills ----
function buildCategoryBar() {
  const bar = $("catBar");
  bar.innerHTML = "";
  activeCats.clear();
  PHON_GROUPS.forEach((group) => {
    const btn = document.createElement("button");
    btn.className = "cat-btn";
    btn.innerHTML = triBlock(CAT_T[group.name]);
    btn.addEventListener("click", () => toggleCategory(group.name, btn, group.graphemes));
    bar.appendChild(btn);
  });
}

function toggleCategory(catName, btn, graphemes) {
  if (activeCats.has(catName)) {
    activeCats.delete(catName);
    btn.classList.remove("active");
    graphemes.forEach((gr) => {
      const stillInOtherCat = [...activeCats].some((c) => PHON_GROUPS.find((g) => g.name === c).graphemes.includes(gr));
      if (!stillInOtherCat) {
        const idx = graphemeIndex[gr];
        if (idx !== undefined) { selected.delete(idx); updateChipVisual(idx, false); }
      }
    });
  } else {
    activeCats.add(catName);
    btn.classList.add("active");
    graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx !== undefined) { selected.add(idx); updateChipVisual(idx, true); }
    });
  }
  refreshCount();
}

// ---- Selecting / deselecting ----
function updateChipVisual(idx, on) {
  document.querySelectorAll('.tracker-cell[data-idx="' + idx + '"]').forEach((el) => {
    el.classList.toggle("selected", on);
  });
}

// ---- Bookmark tracker grid ----
function isLightColour(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

function buildTrackerGrid(container) {
  container.innerHTML = "";
  const tracker = document.createElement("div");
  tracker.className = "tracker";

  BOOKMARK_LEVELS.forEach((lvl, lvlIdx) => {
    const light = isLightColour(lvl.colour);
    const textCol = light ? "#1f1f1f" : "#ffffff";

    const row = document.createElement("div");
    row.className = "tracker-row";

    const label = document.createElement("div");
    label.className = "tracker-label" + (light ? " on-light" : "");
    label.dataset.lvl = lvlIdx;
    label.style.background = lvl.colour;
    label.style.color = textCol;
    label.textContent = lvlIdx + 1;
    label.title = lvl.name;
    label.addEventListener("click", () => toggleTrackerRow(lvlIdx, label));
    row.appendChild(label);

    const codes = document.createElement("div");
    codes.className = "tracker-codes";
    lvl.graphemes.forEach((gr) => {
      const idx = graphemeIndex[gr];
      if (idx === undefined) return;
      const g = GRAPHEMES[idx];
      const cell = document.createElement("div");
      cell.className = "tracker-cell";
      cell.dataset.idx = idx;
      cell.dataset.lvl = lvlIdx;
      cell.style.setProperty("--chip", lvl.colour);
      cell.style.setProperty("--cell-text", textCol);
      const dots = "●".repeat(g.sounds.length);
      cell.innerHTML = gr + '<span class="tc-dots">' + dots + '</span>';
      cell.addEventListener("click", () => toggleTrackerCell(idx, cell));
      codes.appendChild(cell);
    });
    row.appendChild(codes);
    tracker.appendChild(row);
  });
  container.appendChild(tracker);
}

function toggleTrackerRow(lvlIdx, label) {
  const lvl = BOOKMARK_LEVELS[lvlIdx];
  const allSelected = lvl.graphemes.every((gr) => {
    const idx = graphemeIndex[gr];
    return idx !== undefined && selected.has(idx);
  });
  lvl.graphemes.forEach((gr) => {
    const idx = graphemeIndex[gr];
    if (idx === undefined) return;
    if (allSelected) { selected.delete(idx); updateChipVisual(idx, false); }
    else { selected.add(idx); updateChipVisual(idx, true); }
  });
  refreshCount();
}

function toggleTrackerCell(idx, cell) {
  if (selected.has(idx)) { selected.delete(idx); cell.classList.remove("selected"); }
  else { selected.add(idx); cell.classList.add("selected"); }
  refreshCount();
}

function setAllCells(on) {
  document.querySelectorAll(".tracker-cell").forEach((el) => {
    const idx = +el.dataset.idx;
    el.classList.toggle("selected", on);
    if (on) selected.add(idx); else selected.delete(idx);
  });
  refreshCount();
}

function refreshCount() {
  $("selCount").textContent = selected.size;
  $("startBtn").disabled = selected.size === 0;
  // Light a level's number when its whole row is selected.
  document.querySelectorAll(".tracker-label").forEach((label) => {
    const lvl = BOOKMARK_LEVELS[+label.dataset.lvl];
    const allSel = lvl.graphemes.every((gr) => {
      const i = graphemeIndex[gr];
      return i !== undefined && selected.has(i);
    });
    label.classList.toggle("active", allSel);
  });
}

// ============================================================
// Drill
// ============================================================
function startSession() {
  queue = [...selected].map((i) => GRAPHEMES[i]);
  shuffle(queue);
  sessionTotal = queue.length;
  attempts = {};
  masteredOnTry = {};
  missed = new Set();
  clearShelf();

  $("sayPanel").style.display   = practiceMode === "say"   ? "block" : "none";
  $("writePanel").style.display = practiceMode === "write" ? "block" : "none";
  const mt = practiceMode === "say" ? T.modeSayTitle : T.modeWriteTitle;
  $("drillModeLabel").textContent = mt.en;

  showScreen("card");
  nextCard();
}

function nextCard() {
  if (queue.length === 0) { finishSession(); return; }
  current = queue[0];
  resetCardUI();
  updateProgress();
  if (practiceMode === "write") setTimeout(playCurrent, 300);
}

function resetCardUI() {
  $("answerBox").classList.remove("show");
  if (practiceMode === "say") {
    $("sayGrapheme").textContent = current.grapheme;
    $("sayCheckRow").style.display = "flex";
    $("sayGradeRow").style.display = "none";
  } else {
    $("typeInput").value = "";
    $("typeInput").className = "";
    clearCanvas();
    if (inputMode === "type") {
      $("writeCheckRow").style.display = "none";
      $("writeGradeRow").style.display = "none";
    } else {
      $("writeCheckRow").style.display = "flex";
      $("writeGradeRow").style.display = "none";
    }
  }
}

function updateProgress() {
  const left = queue.length;
  $("remainingLabel").innerHTML = triStr(
    left + " left", "还剩 " + left, "仲剩 " + left
  );
  $("progressFill").style.width = ((sessionTotal - left) / sessionTotal) * 100 + "%";
}

function sayCheck() {
  playCurrent();
  revealAnswer();
  $("sayCheckRow").style.display = "none";
  $("sayGradeRow").style.display = "flex";
}

function checkTypedAnswer() {
  if (!current) return;
  const input = $("typeInput");
  const typed = input.value.trim().toLowerCase();
  const correct = current.grapheme.toLowerCase();
  if (!typed) return;
  if (typed === correct) {
    input.classList.add("flash-correct");
    revealAnswer();
    setTimeout(() => gradeCard(true), 1000);
  } else {
    input.classList.add("flash-wrong");
    revealAnswer();
    setTimeout(() => gradeCard(false), 1200);
  }
}

function showWriteGrade() {
  revealAnswer();
  $("writeCheckRow").style.display = "none";
  $("writeGradeRow").style.display = "flex";
}

function revealAnswer() {
  $("ansGrapheme").textContent = current.grapheme;
  $("ansSounds").innerHTML = current.sounds.map((s) =>
    '<div class="sound-item"><span class="sym">' + s.s + '</span> <span class="ex">e.g. / 例如 ' + s.ex + '</span></div>'
  ).join("");
  $("answerBox").classList.add("show");
}

function gradeCard(gotIt) {
  const card = queue.shift();
  const g = card.grapheme;
  attempts[g] = (attempts[g] || 0) + 1;
  if (gotIt) {
    masteredOnTry[g] = attempts[g];
    addToShelf(card);
  } else {
    missed.add(g);
    const insertAt = Math.max(1, Math.floor(queue.length / 2) + Math.floor(Math.random() * Math.ceil(queue.length / 2)));
    queue.splice(Math.min(insertAt, queue.length), 0, card);
  }
  nextCard();
}

function clearShelf() {
  $("masteredShelf").innerHTML = '<span class="shelf-empty" id="shelfEmpty"></span>';
  $("shelfEmpty").innerHTML = tri("shelfEmpty");
}

function addToShelf(card) {
  const empty = $("shelfEmpty");
  if (empty) empty.remove();
  const item = document.createElement("span");
  item.className = "shelf-item";
  item.textContent = card.grapheme;
  $("masteredShelf").appendChild(item);
}

function finishSession() {
  showScreen("report");
  renderSummary();
  renderRemediation();
  $("reportReviewBtn").style.display = missed.size ? "inline-flex" : "none";
}

function renderSummary() {
  const buckets = {};
  Object.keys(masteredOnTry).forEach((g) => {
    const t = masteredOnTry[g];
    (buckets[t] = buckets[t] || []).push(g);
  });
  const firstTry = (buckets[1] || []).length;

  let html = '<div class="report-headline">' + triStr(
    "You practised " + sessionTotal + " code" + (sessionTotal === 1 ? "" : "s") + " · " + firstTry + " right first try",
    "练习了 " + sessionTotal + " 个字母 · " + firstTry + " 个第一次答对",
    "練習咗 " + sessionTotal + " 個字母 · " + firstTry + " 個第一次答啱"
  ) + '</div>';

  const tries = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  html += '<div class="report-rows">';
  tries.forEach((t) => {
    const label = t === 1
      ? triStr("First try", "第一次", "第一次")
      : t === 2
      ? triStr("Second try", "第二次", "第二次")
      : triStr(t + "th try", "第 " + t + " 次", "第 " + t + " 次");
    html += '<div class="report-row"><span class="rtry">' + label + '</span>' +
      '<span class="rcodes">' + buckets[t].map((g) => '<span class="rcode">' + g + '</span>').join("") + '</span></div>';
  });
  html += '</div>';

  if (missed.size === 0) {
    html += '<div class="report-perfect">' + tri("perfect") + '</div>';
  }
  $("reportSummary").innerHTML = html;
}

function renderRemediation() {
  const box = $("reportRemediation");
  if (missed.size === 0) { box.innerHTML = ""; return; }

  const levelToCodes = {};
  missed.forEach((g) => {
    const lvl = graphemeToBookmark[g];
    if (lvl === undefined) return;
    (levelToCodes[lvl] = levelToCodes[lvl] || []).push(g);
  });

  let html = '<div class="remedy-title">' + tri("reviseThese") + '</div>' +
    '<p class="remedy-sub">' + (practiceMode === "say" ? tri("remedyReadSub") : tri("remedyWriteSub")) + '</p>';

  Object.keys(levelToCodes).map(Number).sort((a, b) => a - b).forEach((lvl) => {
    const meta = BOOKMARK_LEVELS[lvl];
    const res = BOOKMARK_RESOURCES[lvl];
    const codes = levelToCodes[lvl];

    html += '<div class="remedy-card" style="border-left-color:' + meta.colour + '">';
    html += '<div class="remedy-head"><span class="swatch" style="background:' + meta.colour + '"></span>' + meta.name + '</div>';
    html += '<div class="remedy-codes">' + codes.map((g) => '<span class="rcode">' + g + '</span>').join("") + '</div>';

    const links = [];
    if (practiceMode === "say") {
      if (res.reading) links.push(linkBtn(T.readingDemo.en, res.reading));
      res.activities.filter((a) => ["read", "look"].includes(a.kind)).forEach((a) => links.push(linkBtn("📄 " + a.name, a.url)));
    } else {
      if (res.writing) links.push(linkBtn(T.writingDemo.en, res.writing));
      res.activities.filter((a) => ["write", "look"].includes(a.kind)).forEach((a) => links.push(linkBtn("📄 " + a.name, a.url)));
    }
    if (links.length === 0 && res.reading) links.push(linkBtn(T.demo.en, res.reading));

    html += '<div class="remedy-links">' + links.join("") + '</div></div>';
  });

  box.innerHTML = html;
}

function linkBtn(label, url) {
  return '<a class="remedy-link" href="' + url + '" target="_blank" rel="noopener">' + label + '</a>';
}

function reviewMissed() {
  selected.clear();
  [...missed].forEach((g) => selected.add(graphemeIndex[g]));
  startSession();
}

// ---- Audio ----
let audioEl = null;
function playCurrent() {
  if (!current) return;
  const btn = $("listenBtn");
  if (audioEl) { audioEl.pause(); audioEl = null; }
  audioEl = new Audio(current.audio + ".mp4");
  if (btn) {
    audioEl.addEventListener("play",  () => btn.classList.add("playing"));
    audioEl.addEventListener("ended", () => btn.classList.remove("playing"));
    audioEl.addEventListener("error", () => btn.classList.remove("playing"));
  }
  audioEl.play().catch(() => {});
}

// ---- Handwriting canvas ----
let canvas, ctx, drawing = false;
function initCanvas() {
  canvas = $("writeCanvas");
  ctx = canvas.getContext("2d");
  styleCtx();
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (canvas.width / r.width), y: (p.clientY - r.top) * (canvas.height / r.height) };
  }
  function start(e) { e.preventDefault(); drawing = true; const pt = pos(e); ctx.beginPath(); ctx.moveTo(pt.x, pt.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); const pt = pos(e); ctx.lineTo(pt.x, pt.y); ctx.stroke(); }
  function end() { drawing = false; }
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
}
function styleCtx() { ctx.strokeStyle = "#1f1f1f"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
function clearCanvas() { if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); styleCtx(); }

function setInputMode(mode) {
  inputMode = mode;
  $("modeType").classList.toggle("active", mode === "type");
  $("modeWrite").classList.toggle("active", mode === "write");
  $("typeWrap").classList.toggle("active", mode === "type");
  $("writeWrap").classList.toggle("active", mode === "write");
  if (mode === "type") {
    $("writeCheckRow").style.display = "none";
    $("writeGradeRow").style.display = "none";
    $("typeInput").focus();
  } else {
    $("writeCheckRow").style.display = "flex";
    $("writeGradeRow").style.display = "none";
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---- Apply trilingual labels to every [data-t] element ----
function applyTranslations() {
  document.querySelectorAll("[data-t]").forEach((el) => {
    el.innerHTML = tri(el.dataset.t);
  });
  const ph = T.typePlaceholder;
  $("typeInput").placeholder = ph.en + " · " + ph.cn + " · " + ph.yue;
}

document.addEventListener("DOMContentLoaded", () => {
  screens.mode   = $("modeScreen");
  screens.select = $("selectScreen");
  screens.card   = $("cardScreen");
  screens.report = $("reportScreen");

  applyTranslations();
  initCanvas();

  $("modeSayBtn").addEventListener("click", () => chooseMode("say"));
  $("modeWriteBtn").addEventListener("click", () => chooseMode("write"));
  $("selectBackBtn").addEventListener("click", () => showScreen("mode"));

  $("selectAll").addEventListener("click", () => {
    setAllCells(true);
    activeCats = new Set(PHON_GROUPS.map((g) => g.name));
    $("catBar").querySelectorAll(".cat-btn").forEach((b) => b.classList.add("active"));
  });
  $("selectNone").addEventListener("click", () => {
    setAllCells(false);
    activeCats.clear();
    $("catBar").querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
  });
  $("startBtn").addEventListener("click", startSession);

  $("sayCheckBtn").addEventListener("click", sayCheck);
  $("sayGotBtn").addEventListener("click", () => gradeCard(true));
  $("sayMissedBtn").addEventListener("click", () => gradeCard(false));

  $("listenBtn").addEventListener("click", playCurrent);
  $("modeType").addEventListener("click", () => setInputMode("type"));
  $("modeWrite").addEventListener("click", () => setInputMode("write"));
  $("clearCanvas").addEventListener("click", clearCanvas);
  $("typeCheckBtn").addEventListener("click", checkTypedAnswer);
  $("typeInput").addEventListener("keypress", (e) => { if (e.key === "Enter") checkTypedAnswer(); });
  $("writeRevealBtn").addEventListener("click", showWriteGrade);
  $("gotItBtn").addEventListener("click", () => gradeCard(true));
  $("againBtn").addEventListener("click", () => gradeCard(false));

  $("quitBtn").addEventListener("click", () => { if (audioEl) audioEl.pause(); showScreen("select"); });

  $("printBtn").addEventListener("click", () => window.print());
  $("reportReviewBtn").addEventListener("click", reviewMissed);
  $("reportRestartBtn").addEventListener("click", () => showScreen("mode"));
});
