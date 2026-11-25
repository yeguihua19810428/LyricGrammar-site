// @ts-nocheck
// Pure quest-map rules for the student page. Plain JS so the player can inline it.
// Soft lock: later lectures stay visible and can be opened to listen or watch.
// Lighting a lecture (通关) still requires main-line mastery.
// Provisional, and a short main line on large lectures, can unlock the next pass path.

export const LECTURE_COUNT = 40;
export const CLOSED_LECTURES = [38, 39, 40];
// Lectures with more than MAIN_LINE_THRESHOLD points get a short main line.
// Rule (stable, data-driven, documented in LYRICGRAMMAR-PHILOSOPHY-IMPLEMENTATION.md):
// take up to MAIN_LINE_SIZE points, in existing catalog order, preferring:
// 1) this lecture's official 本家主打歌 points (title match, not reused),
// 2) other points whose songHomeLecture is this lecture and are not reused,
// 3) the remaining points (cameos or no-song). If the lecture has MAIN_LINE_THRESHOLD
// or fewer points, every point is main-line. Lectures with MAIN_LINE_THRESHOLD or fewer points
// treat every point as main-line.
export const MAIN_LINE_THRESHOLD = 10;
export const MAIN_LINE_SIZE = 5;

export function isLectureOpen(no) {
  var n = Number(no);
  return n >= 1 && n <= LECTURE_COUNT && CLOSED_LECTURES.indexOf(n) < 0;
}

export function officialSong(lectureNo, songs) {
  var n = Number(lectureNo);
  if (!isLectureOpen(n) || !songs || !songs.length) return null;
  for (var i = 0; i < songs.length; i++) {
    if (Number(songs[i].lecture) === n) {
      return { title: String(songs[i].title || ""), artist: String(songs[i].artist || "") };
    }
  }
  return null;
}

export function isHomeSongPoint(point, lectureNo) {
  if (!point || !point.song) return false;
  if (point.reusedFrom) return false;
  var n = Number(lectureNo);
  if (point.songHomeLecture != null && Number(point.songHomeLecture) !== n) return false;
  return true;
}

export function assignMainline(points, lectureNo, officialTitle) {
  var list = points || [];
  if (!list.length) return [];
  if (list.length <= MAIN_LINE_THRESHOLD) {
    return list.map(function (point) {
      return Object.assign({}, point, { mainline: true, track: "main" });
    });
  }
  var official = [];
  var home = [];
  var rest = [];
  var title = officialTitle ? String(officialTitle) : "";
  list.forEach(function (point, i) {
    if (title && point.song && point.song === title && !point.reusedFrom) official.push(i);
    else if (isHomeSongPoint(point, lectureNo)) home.push(i);
    else rest.push(i);
  });
  var picked = {};
  var order = official.concat(home).concat(rest);
  for (var k = 0; k < order.length && Object.keys(picked).length < MAIN_LINE_SIZE; k++) {
    picked[order[k]] = true;
  }
  return list.map(function (point, i) {
    var main = Boolean(picked[i]);
    return Object.assign({}, point, { mainline: main, track: main ? "main" : "side" });
  });
}

export function pointsInLecture(lectureNo, points) {
  var n = Number(lectureNo);
  var out = [];
  (points || []).forEach(function (point) {
    if (Number(point.lecture) === n) out.push(point);
  });
  return out;
}

export function buildLectures(book, songs, points) {
  var titles = {};
  (book || []).forEach(function (group) {
    (group.items || []).forEach(function (lec) {
      titles[Number(lec.no)] = { title: String(lec.title || ""), group: String(group.group || "") };
    });
  });
  var out = [];
  for (var no = 1; no <= LECTURE_COUNT; no++) {
    var meta = titles[no] || {};
    var song = officialSong(no, songs);
    var pts = isLectureOpen(no) ? assignMainline(pointsInLecture(no, points), no, song && song.title) : [];
    var fallback = pointsInLecture(no, points)[0];
    var open = isLectureOpen(no);
    out.push({
      no: no,
      title: meta.title || (fallback && fallback.lectureTitle) || "",
      group: meta.group || "",
      songTitle: song ? song.title : "",
      artist: song ? song.artist : "",
      open: open,
      closedLabel: open ? "" : "暂未开放",
      points: pts,
    });
  }
  return out;
}

export function lectureLight(statuses, open) {
  if (!open) return "closed";
  var list = statuses || [];
  if (!list.length) return "unseen";
  var i;
  var allMastered = true;
  var anyPracticed = false;
  var anyProvisional = false;
  var anyHeard = false;
  var anyMastered = false;
  for (i = 0; i < list.length; i++) {
    var status = list[i] || "unseen";
    if (status !== "mastered") allMastered = false;
    if (status === "mastered") anyMastered = true;
    if (status === "practiced") anyPracticed = true;
    if (status === "provisional") anyProvisional = true;
    if (status === "heard") anyHeard = true;
  }
  if (allMastered) return "mastered";
  if (anyPracticed) return "practiced";
  if (anyProvisional) return "provisional";
  if (anyHeard || anyMastered) return "heard";
  return "unseen";
}

export function lectureLightLabel(light) {
  if (light === "closed") return "暂未开放";
  if (light === "heard") return "已听";
  if (light === "practiced") return "已练未过 · 继续打";
  if (light === "provisional") return "暂过 · 半亮";
  if (light === "mastered") return "通关";
  return "未学";
}

export function allMastered(statuses) {
  var list = statuses || [];
  if (!list.length) return false;
  for (var i = 0; i < list.length; i++) {
    if (list[i] !== "mastered") return false;
  }
  return true;
}

export function withStatuses(lectures, progressOf) {
  return (lectures || []).map(function (lec) {
    var statuses = (lec.points || []).map(function (point) {
      var id = point && point.id;
      var status = progressOf ? progressOf(id) : "unseen";
      return status || "unseen";
    });
    var withStatus = Object.assign({}, lec, { statuses: statuses });
    return Object.assign({}, withStatus, {
      light: lectureLight(lectureMainlineStatuses(withStatus), lec.open),
    });
  });
}

export function lectureByNo(lectures, no) {
  var n = Number(no);
  var list = lectures || [];
  for (var i = 0; i < list.length; i++) {
    if (Number(list[i].no) === n) return list[i];
  }
  return null;
}

export function statusClearsPath(status) {
  return status === "mastered" || status === "provisional";
}

export function lectureMainlineStatuses(lec) {
  var points = (lec && lec.points) || [];
  var statuses = (lec && lec.statuses) || [];
  var out = [];
  var hasSide = false;
  for (var i = 0; i < points.length; i++) {
    if (points[i] && points[i].mainline === false) {
      hasSide = true;
      continue;
    }
    out.push(statuses[i] || "unseen");
  }
  if (!points.length || !hasSide && out.length === 0) return statuses;
  return out.length ? out : statuses;
}

export function lecturePathCleared(lec) {
  var list = lectureMainlineStatuses(lec);
  if (!list.length) return false;
  for (var i = 0; i < list.length; i++) {
    if (!statusClearsPath(list[i])) return false;
  }
  return true;
}

export function lectureMainlineMastered(lec) {
  return allMastered(lectureMainlineStatuses(lec));
}

export function lectureAllCollected(lec) {
  return allMastered((lec && lec.statuses) || []);
}

export function lecturePassUnlocked(lectureNo, lectures) {
  var n = Number(lectureNo);
  if (!isLectureOpen(n)) return false;
  if (n <= 1) return true;
  var prev = lectureByNo(lectures, n - 1);
  if (!prev || !prev.open) return false;
  return lecturePathCleared(prev);
}

export function pointPassUnlocked(pointIndex, statuses, lectureUnlocked, points) {
  if (!lectureUnlocked) return false;
  var i = Number(pointIndex);
  if (i <= 0) return true;
  var list = points || [];
  if (list[i] && list[i].mainline === false) return true;
  if (!list.length) return statusClearsPath((statuses || [])[i - 1]);
  for (var j = 0; j < i; j++) {
    if (list[j] && list[j].mainline === false) continue;
    if (!statusClearsPath((statuses || [])[j])) return false;
  }
  return true;
}

export function currentLectureNo(lectures) {
  var list = lectures || [];
  for (var i = 0; i < list.length; i++) {
    if (!list[i].open) continue;
    if (!lecturePathCleared(list[i])) return Number(list[i].no);
  }
  return 0;
}

export function pointIndexInLecture(lecture, pointId) {
  if (!lecture || !pointId) return -1;
  var points = lecture.points || [];
  for (var i = 0; i < points.length; i++) {
    if (points[i] && points[i].id === pointId) return i;
  }
  return -1;
}

export function nextPassTarget(lectures, fromLectureNo, fromPointId) {
  var list = lectures || [];
  var startLec = fromLectureNo ? Number(fromLectureNo) : 0;
  var passedCurrent = !fromPointId;
  for (var i = 0; i < list.length; i++) {
    var lec = list[i];
    if (!lec.open) continue;
    if (startLec && Number(lec.no) < startLec) continue;
    if (!lecturePassUnlocked(lec.no, list)) continue;
    var statuses = lec.statuses || [];
    var points = lec.points || [];
    var found = null;
    for (var j = 0; j < points.length; j++) {
      var id = points[j] && points[j].id;
      if (Number(lec.no) === startLec && !passedCurrent) {
        if (id === fromPointId) passedCurrent = true;
        continue;
      }
      if (statusClearsPath(statuses[j])) continue;
      if (!pointPassUnlocked(j, statuses, true, points)) continue;
      var cand = { lectureNo: lec.no, pointId: id, pointIndex: j };
      if (points[j] && points[j].mainline !== false) return cand;
      if (!found) found = cand;
    }
    if (found) return found;
  }
  return null;
}

export function lectureJustCleared(beforeStatuses, afterStatuses, open, beforeLecture, afterLecture) {
  if (afterLecture || beforeLecture) {
    return Boolean(open) && lectureMainlineMastered(afterLecture) && !lectureMainlineMastered(beforeLecture || { statuses: beforeStatuses, points: afterLecture && afterLecture.points });
  }
  return Boolean(open) && allMastered(afterStatuses) && !allMastered(beforeStatuses);
}

export function findJustClearedLecture(beforeLectures, afterLectures) {
  var list = afterLectures || [];
  for (var i = 0; i < list.length; i++) {
    var after = list[i];
    var before = lectureByNo(beforeLectures, after.no);
    if (lectureJustCleared(before && before.statuses, after.statuses, after.open, before, after)) return after;
  }
  return null;
}

export function lectureClearCopy(lecture, lectures) {
  var no = lecture && lecture.no ? Number(lecture.no) : 0;
  var title = "第" + no + "讲通关";
  var next = lectureByNo(lectures, no + 1);
  var body = "这一讲的主线细点都掌握了。";
  var nextLectureNo = 0;
  if (next && next.open && lecturePassUnlocked(next.no, lectures)) {
    body += "下一讲已经亮了：第" + next.no + "讲" + (next.title ? " " + next.title : "") + "。";
    nextLectureNo = Number(next.no);
  } else if (next && !next.open) {
    body += "后面的讲暂未开放，不编造歌曲。";
  } else if (!next) {
    body += "四十讲已经走到头了。";
  }
  return { title: title, body: body, nextLectureNo: nextLectureNo };
}

export var BADGE_MILESTONES = [5, 10, 20];

export function clearedOpenCount(lectures) {
  var n = 0;
  (lectures || []).forEach(function (lec) {
    if (lec.open && lectureMainlineMastered(lec)) n += 1;
  });
  return n;
}

export function badgeCatalog(lectures) {
  var out = [];
  var seenGroup = {};
  (lectures || []).forEach(function (lec) {
    if (!lec.open) return;
    out.push({
      id: "lecture-" + lec.no,
      title: "第" + lec.no + "讲通关",
      detail: (lec.title || "") + (lec.songTitle ? " · 《" + lec.songTitle + "》" : "") + " · 主线",
    });
    var hasSide = (lec.points || []).some(function (point) { return point && point.mainline === false; });
    if (hasSide) {
      out.push({
        id: "collect-" + lec.no,
        title: "第" + lec.no + "讲全收集",
        detail: "主线和支线细点都掌握了",
      });
    }
  });
  (lectures || []).forEach(function (lec) {
    if (!lec.group || seenGroup[lec.group]) return;
    seenGroup[lec.group] = true;
    var members = (lectures || []).filter(function (item) {
      return item.group === lec.group && item.open;
    });
    if (!members.length) return;
    out.push({
      id: "group-" + members[0].no,
      title: "过完「" + lec.group + "」",
      detail: "这一组已开放的讲，主线都掌握了",
      lectureNos: members.map(function (item) { return item.no; }),
    });
  });
  BADGE_MILESTONES.forEach(function (count) {
    out.push({
      id: "milestone-" + count,
      title: "过完 " + count + " 讲",
      detail: "已开放的讲里，有 " + count + " 讲的主线都掌握了",
      count: count,
    });
  });
  var openCount = (lectures || []).filter(function (lec) { return lec.open; }).length;
  if (openCount) {
    out.push({
      id: "path-open",
      title: "已开放关卡全部通关",
      detail: "已开放的 " + openCount + " 讲，主线都掌握了",
    });
  }
  return out;
}

export function earnedBadgeIds(lectures) {
  var catalog = badgeCatalog(lectures);
  var cleared = {};
  var count = clearedOpenCount(lectures);
  var collected = {};
  (lectures || []).forEach(function (lec) {
    if (lec.open && lectureMainlineMastered(lec)) cleared[lec.no] = true;
    if (lec.open && lectureAllCollected(lec)) collected[lec.no] = true;
  });
  var ids = [];
  catalog.forEach(function (badge) {
    if (badge.id.indexOf("lecture-") === 0) {
      if (cleared[Number(String(badge.id).slice(8))]) ids.push(badge.id);
      return;
    }
    if (badge.id.indexOf("collect-") === 0) {
      if (collected[Number(String(badge.id).slice(8))]) ids.push(badge.id);
      return;
    }
    if (badge.lectureNos && badge.lectureNos.length) {
      var ok = true;
      for (var i = 0; i < badge.lectureNos.length; i++) {
        if (!cleared[badge.lectureNos[i]]) ok = false;
      }
      if (ok) ids.push(badge.id);
      return;
    }
    if (badge.count) {
      if (count >= badge.count) ids.push(badge.id);
      return;
    }
    if (badge.id === "path-open") {
      var openCount = (lectures || []).filter(function (lec) { return lec.open; }).length;
      if (openCount && count === openCount) ids.push(badge.id);
    }
  });
  return ids;
}

export function newlyEarnedBadges(beforeLectures, afterLectures) {
  var before = {};
  earnedBadgeIds(beforeLectures).forEach(function (id) { before[id] = true; });
  var catalog = badgeCatalog(afterLectures);
  var byId = {};
  catalog.forEach(function (badge) { byId[badge.id] = badge; });
  var out = [];
  earnedBadgeIds(afterLectures).forEach(function (id) {
    if (!before[id] && byId[id]) out.push(byId[id]);
  });
  return out;
}

export function isKnownBadgeId(id) {
  return /^(lecture-\d+|collect-\d+|group-\d+|milestone-\d+|path-open)$/.test(String(id || ""));
}

export function normalizeBadge(row) {
  var id = String((row && (row.id || row.badgeId)) || "").slice(0, 80);
  if (!isKnownBadgeId(id)) return null;
  return {
    id: id,
    earnedAt: Number(row && row.earnedAt) || 0,
    dirty: Boolean(row && row.dirty),
  };
}

export function mergeBadgeMaps(localMap, remoteMap) {
  var out = {};
  var ids = {};
  var local = localMap || {};
  var remote = remoteMap || {};
  Object.keys(local).forEach(function (id) { ids[id] = true; });
  Object.keys(remote).forEach(function (id) { ids[id] = true; });
  Object.keys(ids).forEach(function (id) {
    var a = normalizeBadge(local[id] ? Object.assign({ id: id }, local[id]) : null);
    var b = normalizeBadge(remote[id] ? Object.assign({ id: id }, remote[id]) : null);
    if (!a && !b) return;
    if (!a) { out[id] = b; return; }
    if (!b) { out[id] = a; return; }
    var earnedAt = 0;
    if (a.earnedAt && b.earnedAt) earnedAt = Math.min(a.earnedAt, b.earnedAt);
    else earnedAt = a.earnedAt || b.earnedAt;
    out[id] = { id: id, earnedAt: earnedAt, dirty: Boolean(a.dirty) };
  });
  return out;
}
