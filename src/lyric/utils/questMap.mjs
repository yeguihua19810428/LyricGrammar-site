// @ts-nocheck
// Pure quest-map rules for the student page. Plain JS so the player can inline it.
// Soft lock: later lectures stay visible and can be opened to listen or watch.
// Lighting a stage, and unlocking the next pass path, requires mastery.

export const LECTURE_COUNT = 40;
export const CLOSED_LECTURES = [38, 39, 40];

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
    var pts = isLectureOpen(no) ? pointsInLecture(no, points) : [];
    var fallback = pointsInLecture(no, points)[0];
    var song = officialSong(no, songs);
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
    return Object.assign({}, lec, {
      statuses: statuses,
      light: lectureLight(statuses, lec.open),
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

export function lecturePassUnlocked(lectureNo, lectures) {
  var n = Number(lectureNo);
  if (!isLectureOpen(n)) return false;
  if (n <= 1) return true;
  var prev = lectureByNo(lectures, n - 1);
  if (!prev || !prev.open) return false;
  return allMastered(prev.statuses || []);
}

export function pointPassUnlocked(pointIndex, statuses, lectureUnlocked) {
  if (!lectureUnlocked) return false;
  var i = Number(pointIndex);
  if (i <= 0) return true;
  return (statuses || [])[i - 1] === "mastered";
}

export function currentLectureNo(lectures) {
  var list = lectures || [];
  for (var i = 0; i < list.length; i++) {
    if (!list[i].open) continue;
    if (!allMastered(list[i].statuses || [])) return Number(list[i].no);
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
    for (var j = 0; j < points.length; j++) {
      var id = points[j] && points[j].id;
      if (Number(lec.no) === startLec && !passedCurrent) {
        if (id === fromPointId) passedCurrent = true;
        continue;
      }
      if (statuses[j] === "mastered") continue;
      if (pointPassUnlocked(j, statuses, true)) {
        return { lectureNo: lec.no, pointId: id, pointIndex: j };
      }
    }
  }
  return null;
}

export function lectureJustCleared(beforeStatuses, afterStatuses, open) {
  return Boolean(open) && allMastered(afterStatuses) && !allMastered(beforeStatuses);
}

export function findJustClearedLecture(beforeLectures, afterLectures) {
  var list = afterLectures || [];
  for (var i = 0; i < list.length; i++) {
    var after = list[i];
    var before = lectureByNo(beforeLectures, after.no);
    if (lectureJustCleared(before && before.statuses, after.statuses, after.open)) return after;
  }
  return null;
}

export function lectureClearCopy(lecture, lectures) {
  var no = lecture && lecture.no ? Number(lecture.no) : 0;
  var title = "第" + no + "讲通关";
  var next = lectureByNo(lectures, no + 1);
  var body = "这一讲的可练细点都掌握了。";
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
    if (lec.open && allMastered(lec.statuses || [])) n += 1;
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
      detail: (lec.title || "") + (lec.songTitle ? " · 《" + lec.songTitle + "》" : ""),
    });
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
      detail: "这一组已开放的讲都掌握了",
      lectureNos: members.map(function (item) { return item.no; }),
    });
  });
  BADGE_MILESTONES.forEach(function (count) {
    out.push({
      id: "milestone-" + count,
      title: "过完 " + count + " 讲",
      detail: "已开放的讲里，有 " + count + " 讲都掌握了",
      count: count,
    });
  });
  var openCount = (lectures || []).filter(function (lec) { return lec.open; }).length;
  if (openCount) {
    out.push({
      id: "path-open",
      title: "已开放关卡全部通关",
      detail: "已开放的 " + openCount + " 讲都掌握了",
    });
  }
  return out;
}

export function earnedBadgeIds(lectures) {
  var catalog = badgeCatalog(lectures);
  var cleared = {};
  var count = clearedOpenCount(lectures);
  (lectures || []).forEach(function (lec) {
    if (lec.open && allMastered(lec.statuses || [])) cleared[lec.no] = true;
  });
  var ids = [];
  catalog.forEach(function (badge) {
    if (badge.id.indexOf("lecture-") === 0) {
      if (cleared[Number(String(badge.id).slice(8))]) ids.push(badge.id);
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
  return /^(lecture-\d+|group-\d+|milestone-\d+|path-open)$/.test(String(id || ""));
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
