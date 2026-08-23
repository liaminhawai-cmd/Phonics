// ============================================================
// i18n.js — optional trilingual captions (English / Mandarin / Cantonese)
//
// Started life as a whole separate app (mika.js) forked from the main
// trainer for one trilingual student, then drifted for months while the
// main app kept moving — by the time anyone looked again it was 70-odd
// commits behind. This is the fix for that shape of problem: no fork,
// just a caption layer over the real app, on by URL flag.
//
//   index.html#seq=ufli-foundations&tri=1
//
// #seq= already picks the program (js/core/data.js); &tri=1 turns on
// these captions. Every English label keeps its size and position — a
// small Mandarin (with Hanyu Pinyin) and Cantonese (with Jyutping) line
// is appended beneath it, same trick mika.js used with its tl/tl-cn/tl-yue
// classes. Coverage matches what mika.js actually translated: screen
// titles, buttons and hints — the static chrome, not live drill content
// (mic verdicts, per-attempt feedback) generated after each attempt.
// ============================================================

window.I18n = (() => {

  const T = {
    subtitle:      { en:"Hear it or see it, say it or write it, then check.",
                     cn:"听或看，说或写，然后检查。", cnP:"tīng huò kàn, shuō huò xiě",
                     yue:"聽或者睇，講或者寫，然後檢查。", yueP:"teng1 waak6 tai2, gong2 waak6 se2" },
    modeSayTitle:  { en:"Look & Say", cn:"看一看，说一说", cnP:"kàn yi kàn, shuō yi shuō",
                     yue:"睇一睇，講一講", yueP:"tai2 jat1 tai2, gong2 jat1 gong2" },
    modeSayDesc:   { en:"See the code, say the sound, then listen to check.",
                     cn:"看字母，读出声音，再听录音检查。", cnP:"kàn zìmǔ, dú chū shēngyīn",
                     yue:"睇字母，讀個音出嚟，再聽錄音檢查。", yueP:"tai2 zi6 mou5, duk6 go3 jam1" },
    modeWriteTitle:{ en:"Listen & Write", cn:"听一听，写一写", cnP:"tīng yi tīng, xiě yi xiě",
                     yue:"聽一聽，寫一寫", yueP:"teng1 jat1 teng1, se2 jat1 se2" },
    modeWriteDesc: { en:"Hear the sound, then type or handwrite the code.",
                     cn:"听声音，然后打字或手写字母。", cnP:"tīng shēngyīn, dǎzì huò shǒuxiě",
                     yue:"聽個音，然後打字或者手寫字母。", yueP:"teng1 go3 jam1, daa2 zi6 waak6 sau2 se2" },
    modeWallTitle: { en:"Sound Wall", cn:"声音墙", cnP:"shēngyīn qiáng",
                     yue:"聲音牆", yueP:"sing1 jam1 coeng4" },

    back:          { en:"← Back", cn:"返回", cnP:"fǎnhuí", yue:"返回", yueP:"faan1 wui4" },
    selectAll:     { en:"Select all", cn:"全选", cnP:"quán xuǎn", yue:"全部揀", yueP:"cyun4 bou6 gaan2" },
    clear:         { en:"Clear", cn:"清除", cnP:"qīngchú", yue:"清除", yueP:"cing1 ceoi4" },
    start:         { en:"Start practising", cn:"开始练习", cnP:"kāishǐ liànxí",
                     yue:"開始練習", yueP:"hoi1 ci2 lin6 zaap6" },
    bookmarkTitle: { en:"Bookmark Levels", cn:"书签等级", cnP:"shūqiān děngjí",
                     yue:"書籤等級", yueP:"syu1 cim1 dang2 kap1" },
    yearTitle:     { en:"Year Levels", cn:"年级", cnP:"niánjí", yue:"年級", yueP:"nin4 kap1" },

    exit:          { en:"Exit", cn:"退出", cnP:"tuìchū", yue:"退出", yueP:"teoi3 ceot1" },
    sayHint:       { en:"Read this code and say its sound out loud.",
                     cn:"读出这个字母的声音。", cnP:"dú chū zhège zìmǔ de shēngyīn",
                     yue:"讀出呢個字母嘅聲。", yueP:"duk6 ceot1 ni1 go3 zi6 mou5 ge3 seng1" },
    listenCheck:   { en:"Listen to check", cn:"听录音检查", cnP:"tīng lùyīn jiǎnchá",
                     yue:"聽錄音檢查", yueP:"teng1 luk6 jam1 gim2 caa4" },
    missed:        { en:"Missed it", cn:"答错了", cnP:"dá cuò le", yue:"答錯咗", yueP:"daap3 co3 zo2" },
    gotIt:         { en:"Got it", cn:"答对了", cnP:"dá duì le", yue:"答啱咗", yueP:"daap3 ngaam1 zo2" },
    playSound:     { en:"Play sound", cn:"播放声音", cnP:"bòfàng shēngyīn",
                     yue:"播放聲音", yueP:"bo3 fong3 sing1 jam1" },
    type:          { en:"Type", cn:"打字", cnP:"dǎzì", yue:"打字", yueP:"daa2 zi6" },
    handwrite:     { en:"Handwrite", cn:"手写", cnP:"shǒuxiě", yue:"手寫", yueP:"sau2 se2" },
    check:         { en:"Check", cn:"检查", cnP:"jiǎnchá", yue:"檢查", yueP:"gim2 caa4" },
    showAnswer:    { en:"Show answer", cn:"显示答案", cnP:"xiǎnshì dá'àn",
                     yue:"顯示答案", yueP:"hin2 si6 daap3 on3" },
    again:         { en:"Again", cn:"再来一次", cnP:"zài lái yīcì", yue:"再嚟多次", yueP:"zoi3 lai4 do1 ci3" },
    clearPlain:    { en:"clear", cn:"清除", cnP:"qīngchú", yue:"清除", yueP:"cing1 ceoi4" },
    shelfEmpty:    { en:"Cards you get right appear here", cn:"答对的字母会出现在这里。", cnP:"dá duì de zìmǔ",
                     yue:"答啱嘅字母會喺度出現。", yueP:"daap3 ngaam1 ge3 zi6 mou5" },

    wellDone:      { en:"Well done!", cn:"做得好！", cnP:"zuò dé hǎo", yue:"做得好！", yueP:"zou6 dak1 hou2" },
    printReport:   { en:"Save / print report", cn:"保存／打印报告", cnP:"bǎocún / dǎyìn",
                     yue:"儲存／打印報告", yueP:"cou5 cyun4 / daa2 jan3" },
    reviewMissed:  { en:"Review missed", cn:"复习错误", cnP:"fùxí cuòwù",
                     yue:"溫習錯處", yueP:"wan1 zaap6 co3 cyu3" },
    newSession:    { en:"New session", cn:"新的练习", cnP:"xīn de liànxí",
                     yue:"新嘅練習", yueP:"san1 ge3 lin6 zaap6" },
  };

  // element id -> T key. Only static chrome — screens, buttons, hints —
  // never anything generated fresh per attempt (mic verdicts, compare
  // results): those stay English, same scope mika.js had.
  const TARGETS = {
    modeSayBtn: { title:"modeSayTitle", desc:"modeSayDesc" },
    modeWriteBtn: { title:"modeWriteTitle", desc:"modeWriteDesc" },
    modeWallBtn: { title:"modeWallTitle" },
    viewBackBtn: { self:"back" }, selectBackBtn: { self:"back" },
    selectAll: { self:"selectAll" }, selectNone: { self:"clear" },
    startBtn: { self:"start" },
    viewBookmarkBtn: { title:"bookmarkTitle" }, viewYearBtn: { title:"yearTitle" },
    quitBtn: { self:"exit" },
    sayCheckBtn: { self:"listenCheck" },
    sayMissedBtn: { self:"missed" }, sayGotBtn: { self:"gotIt" },
    listenBtn: { self:"playSound" },
    modeType: { self:"type" }, modeWrite: { self:"handwrite" },
    typeCheckBtn: { self:"check" }, writeRevealBtn: { self:"showAnswer" },
    clearCanvas: { self:"clearPlain" },
    againBtn: { self:"again" }, gotItBtn: { self:"gotIt" },
    shelfEmpty: { self:"shelfEmpty" },
    practiceSheetBtn: { self:"printReport" }, printBtn: { self:"printReport" },
    reportReviewBtn: { self:"reviewMissed" }, reportRestartBtn: { self:"newSession" },
  };

  function block(t) {
    if (!t) return "";
    const cn = t.cn ? t.cn + (t.cnP ? " · " + t.cnP : "") : "";
    const yue = t.yue ? t.yue + (t.yueP ? " · " + t.yueP : "") : "";
    return '<span class="tl-cn">' + cn + '</span><span class="tl-yue">' + yue + '</span>';
  }

  // Split "Look & Say" out of an emoji-prefixed .ttl/.desc pair, or just
  // append after plain text — either way this only ever ADDS the two
  // caption lines; it never removes or reorders the English.
  function caption(el, key) {
    if (!el || el.dataset.tlDone) return;
    const t = T[key];
    if (!t) return;
    el.insertAdjacentHTML("beforeend", block(t));
    el.dataset.tlDone = "1";
  }

  function apply() {
    if (!enabled()) return;
    Object.keys(TARGETS).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const spec = TARGETS[id];
      if (spec.self) { caption(el, spec.self); return; }
      if (spec.title) { const ttl = el.querySelector(".ttl"); if (ttl) caption(ttl, spec.title); }
      if (spec.desc) { const d = el.querySelector(".desc"); if (d) caption(d, spec.desc); }
    });
    const sub = document.querySelector(".subtitle"); if (sub) caption(sub, "subtitle");
    const rt = document.querySelector(".report-title"); if (rt) caption(rt, "wellDone");
  }

  function enabled() {
    return /(?:^|[#&])tri=1(?:&|$)/.test(location.hash);
  }

  return { apply, enabled, T };
})();
