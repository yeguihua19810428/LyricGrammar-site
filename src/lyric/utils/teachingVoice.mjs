// @ts-nocheck
// Student-facing teaching voice helpers. Plain JS so the player can inline it.
// Do not rewrite the authored `say` corpus here; only add wrapping copy and
// conservative style hints. Leftover human rewrites are listed in
// LYRICGRAMMAR-PHILOSOPHY-IMPLEMENTATION.md.

export const CAMEO_CLIP_MIN = 5;
export const CAMEO_CLIP_MAX = 10;
export const CAMEO_CLIP_DEFAULT = 8;

export const TEACH_AFTER_LISTEN =
  "先听这句，感到它的口气，再看它为什么这样写。不要把歌停在半路、只去划语法名称。看完、听完都不记掌握。";

// Product-owned reminders from the existing course report, not new textbook text.
export const ATYPICAL_LECTURE_NOTES = {
  4: "课本里更典型的是 physics、committee 这类词。这首歌能教主谓一致，但例子不是那一类。",
  7: "课本里所有格常常出现在完整的主句里。这首歌的 's 很清楚，但不在副歌主句。",
  9: "课本里「就一份的东西加 the」例子更宽。这里用 in the end，只覆盖比较窄的一点。",
};

export function isCameoPoint(point, lectureNo) {
  if (!point || !point.song) return false;
  if (point.reusedFrom) return true;
  var n = Number(lectureNo != null ? lectureNo : point.lecture);
  if (point.songHomeLecture != null && Number(point.songHomeLecture) !== n) return true;
  return false;
}

export function isHomeSongPoint(point, lectureNo) {
  if (!point || !point.song) return false;
  return !isCameoPoint(point, lectureNo);
}

export function songRoleCopy(point, lectureNo) {
  if (!point || !point.song) return { role: "none", label: "", detail: "" };
  if (isCameoPoint(point, lectureNo)) {
    var from = point.reusedFrom
      ? String(point.reusedFrom)
      : (point.songHomeLecture
        ? ("第" + point.songHomeLecture + "讲《" + point.song + "》")
        : ("《" + point.song + "》"));
    return {
      role: "cameo",
      label: "客串例句",
      detail: "这句借自" + from + "。只听这一小段作为佐证，不展开那首歌的完整世界。",
    };
  }
  return {
    role: "home",
    label: "本家主打歌",
    detail: "《" + point.song + "》是这一讲的主打歌。",
  };
}

export function clipWindow(startTime, endTime, nextStartTime) {
  var start = Number(startTime);
  if (!isFinite(start) || start < 0) return null;
  var end = Number(endTime);
  if (!isFinite(end) || end <= start) {
    var next = Number(nextStartTime);
    end = isFinite(next) && next > start ? next : start + CAMEO_CLIP_DEFAULT;
  }
  if (end > start + CAMEO_CLIP_MAX) end = start + CAMEO_CLIP_MAX;
  if (end < start + CAMEO_CLIP_MIN) end = start + CAMEO_CLIP_MIN;
  return { start: start, end: end };
}

export function atypicalNote(lectureNo) {
  var note = ATYPICAL_LECTURE_NOTES[Number(lectureNo)];
  return note ? String(note) : "";
}

export function styleHint(point) {
  var lyric = String((point && point.lyricLine) || "").trim();
  var say = String((point && point.say) || "");
  if (!lyric && !say) return "";
  if (
    /^(never|nor|seldom|rarely|hardly|little|not only|only then|only when|should\s+you|were\s+i|had\s+i)\b/i.test(lyric) ||
    /(倒装|把.{0,8}提前|语序一变)/.test(say)
  ) {
    return "语序一变，口气就变了。这样写，听起来更远，或者更郑重，不只是把词换个位置。";
  }
  if (
    /\b(would|might|shall|could|should|must|may|won'?t|cannot|can'?t)\b/i.test(lyric) ||
    /(情态动词|would|might|shall)/.test(say)
  ) {
    return "换一个情态词，拒绝、请求或威胁的口气会跟着变。这里这样写，是在演这句话背后的态度。";
  }
  if (
    /\b(have|has|had|'ve|'d)\s+(been|[a-z]+ed|gone|done|seen|known|found|come|left|made)\b/i.test(lyric) ||
    /(完成体|已经发生|嘴里用现在)/.test(say)
  ) {
    return "时态不只是记时间。用完成体还是用现在，会让这件事情听起来已经落下，或还在眼前。";
  }
  var words = lyric ? lyric.split(/\s+/) : [];
  var hasFinite = /\b(am|is|are|was|were|do|does|did|have|has|had|will|would|can|could|shall|should)\b/i.test(lyric) ||
    /\b(i'm|you're|he's|she's|it's|we're|they're|i've|you've|we've|they've|i'd|you'd|he'd|she'd|we'd|they'd|i'll|you'll|he'll|she'll|we'll|they'll|won't|can't)\b/i.test(lyric);
  if (lyric && !hasFinite && (words.length <= 3 || /^(and|but|cause|cos|'cause)\b/i.test(lyric))) {
    return "句子被拆短了，常常是因为急、或情绪上来了。这样写不是错，是把口气收紧。";
  }
  return "";
}

export function explanationParts(point, lectureNo) {
  var no = lectureNo != null ? lectureNo : (point && point.lecture);
  var revised = Boolean(point && point.humanRevised);
  return {
    say: String((point && point.say) || ""),
    bookName: String((point && point.bookName) || ""),
    styleHint: revised ? "" : styleHint(point),
    atypicalNote: revised ? "" : atypicalNote(no),
    reason: String((point && point.reason) || ""),
  };
}
