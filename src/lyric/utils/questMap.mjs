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
  if (light === "mastered") return "掌握";
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
