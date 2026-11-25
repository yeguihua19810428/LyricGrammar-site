// @ts-nocheck
// Student-page overrides for Phase 0 pass-the-point. Inlined into the player.
// 
var progressAccount = "";
var progressMap = {};
var practicePointId = "";
var waitingIndependent = false;
var syncTimer = 0;
var recheckBusy = false;
var recheckTried = {};
var keepPractice = false;
var passDraft = "";
var frameDraft = "";
var practiceTask = "";
var pickFrom = -1;
var pickTo = -1;
var pickReady = false;
var explainDraft = "";
var rewriteDraft = "";
var followDraft = "";
var speechNote = "";
var listeningMic = false;
var badgeMap = {};
var explainEditorOpen = false;
var explainSayDraft = "";
var explainBookDraft = "";
var explainReasonDraft = "";
var explainBusy = false;
var explainNote = "";
var explainForId = "";

function storageKey() {
  return "lyricgrammar-progress-v1:" + (progressAccount || "local");
}
function loadProgressMap() {
  try {
    var raw = localStorage.getItem(storageKey());
    progressMap = raw ? JSON.parse(raw) : {};
  } catch (error) {
    progressMap = {};
  }
}
function persistProgress() {
  try { localStorage.setItem(storageKey(), JSON.stringify(progressMap)); } catch (error) {}
}
function badgeStorageKey() {
  return "lyricgrammar-badges-v1:" + (progressAccount || "local");
}
function loadBadgeMap() {
  try {
    var raw = localStorage.getItem(badgeStorageKey());
    badgeMap = raw ? JSON.parse(raw) : {};
  } catch (error) {
    badgeMap = {};
  }
}
function persistBadges() {
  try { localStorage.setItem(badgeStorageKey(), JSON.stringify(badgeMap)); } catch (error) {}
}
function adoptAccount(userId) {
  if (!userId || userId === progressAccount) return;
  var previous = progressMap;
  var previousBadges = badgeMap;
  var movingLocal = !progressAccount || progressAccount === "local";
  progressAccount = userId;
  loadProgressMap();
  loadBadgeMap();
  if (movingLocal) {
    progressMap = mergeMaps(previous, progressMap);
    badgeMap = mergeBadgeMaps(previousBadges, badgeMap);
  }
  persistProgress();
  persistBadges();
}
function getProgress(pointId) {
  if (!pointId) return emptyRecord("");
  if (!progressMap[pointId]) return emptyRecord(pointId);
  return normalizeRecord(progressMap[pointId]);
}
function setProgress(pointId, event) {
  if (!pointId) return emptyRecord("");
  var next = applyProgressEvent(progressMap[pointId] || emptyRecord(pointId), event, Date.now());
  next.pointId = pointId;
  progressMap[pointId] = next;
  persistProgress();
  scheduleSync();
  return next;
}
function markHeard(pointId) {
  if (!pointId) return;
  setProgress(pointId, { type: "heard", pointId: pointId });
}
function badgeHtml(status, kind, record) {
  var rec = record || null;
  var label = kind === "list" ? listBadge(status, rec) : statusLabel(status, rec);
  var cls = status || "unseen";
  if (rec && rec.needsMakeup && status !== "mastered" && status !== "provisional") cls += " makeup";
  return '<span class="badge ' + cls + '">' + escapeHtml(label) + '</span>';
}
function pointExplainHtml(point, lectureNo) {
  var parts = typeof explanationParts === "function"
    ? explanationParts(point, lectureNo != null ? lectureNo : (point && point.lecture))
    : { say: (point && point.say) || "", styleHint: "", atypicalNote: "" };
  var html = "";
  if (point && point.humanRevised) html += '<p class="review-flag">已人工改写</p>';
  if (parts.say) html += "<p>" + escapeHtml(parts.say) + "</p>";
  if (parts.styleHint) html += '<p class="voice-hint">' + escapeHtml(parts.styleHint) + "</p>";
  if (parts.atypicalNote) html += '<p class="voice-hint">' + escapeHtml(parts.atypicalNote) + "</p>";
  return html;
}
function explainEditorOn() {
  return typeof EXPLAIN_EDITOR !== "undefined" && EXPLAIN_EDITOR;
}
function parentSearch() {
  try {
    if (parent && parent !== window && parent.location) return String(parent.location.search || "");
  } catch (error) {}
  try { return String(location.search || ""); } catch (error) {}
  return "";
}
function bootExplainEditor() {
  if (!explainEditorOn()) return;
  if (/(?:\?|&)editExplain=1(?:&|$)/.test(parentSearch())) explainEditorOpen = true;
}
function reviewCountText() {
  var stats = typeof REVIEW_STATS === "object" && REVIEW_STATS ? REVIEW_STATS : { total: 0, revised: 0 };
  return (Number(stats.revised) || 0) + "/" + (Number(stats.total) || 0);
}
function paintExplainChrome() {
  var btn = document.getElementById("toggle-explain-editor");
  var bar = document.getElementById("explain-progress");
  if (!btn) return;
  if (!explainEditorOn()) {
    btn.hidden = true;
    if (bar) bar.hidden = true;
    return;
  }
  btn.hidden = false;
  btn.textContent = (explainEditorOpen ? "收起改讲解 " : "改讲解 ") + reviewCountText();
  if (explainEditorOpen) btn.classList.add("on");
  else btn.classList.remove("on");
  if (bar) {
    bar.hidden = false;
    bar.textContent = "人工改写进度 " + reviewCountText() + "。一边试用一边提交，一次只改当前这条。";
  }
}
function currentReviewPoint() {
  if (practicePointId) return pointById(practicePointId);
  if (typeof questPoint !== "undefined" && questPoint) return pointById(questPoint);
  if (typeof bookOpen !== "undefined" && bookOpen) return pointById(bookOpen);
  return typeof currentPoint === "function" ? currentPoint() : null;
}
function captureExplainDrafts() {
  var sayBox = document.getElementById("review-say");
  var bookBox = document.getElementById("review-book");
  var reasonBox = document.getElementById("review-reason");
  if (sayBox) {
    explainSayDraft = sayBox.value;
    explainForId = (currentReviewPoint() && currentReviewPoint().id) || explainForId;
  }
  if (bookBox) explainBookDraft = bookBox.value;
  if (reasonBox) explainReasonDraft = reasonBox.value;
}
function resetExplainDrafts() {
  explainSayDraft = "";
  explainBookDraft = "";
  explainReasonDraft = "";
  explainForId = "";
}
function applyReviewLocally(review, stats) {
  if (!review || !review.id || typeof applyReviewToPoint !== "function") return;
  for (var i = 0; i < POINTS.length; i++) {
    if (POINTS[i].id === review.id) {
      POINTS[i] = applyReviewToPoint(POINTS[i], review);
      break;
    }
  }
  if (stats && typeof REVIEW_STATS === "object" && REVIEW_STATS) {
    REVIEW_STATS.revised = stats.revised;
    REVIEW_STATS.total = stats.total;
  }
}
function goToUnrevised(fromId, note) {
  var next = typeof nextUnrevisedPoint === "function" ? nextUnrevisedPoint(POINTS, fromId) : null;
  explainEditorOpen = true;
  practicePointId = "";
  practiceTask = "";
  if (typeof bookOpen !== "undefined") bookOpen = "";
  if (!next) {
    explainNote = "499 条都改完了。可以继续试用学生页。";
    render();
    return;
  }
  resetExplainDrafts();
  explainNote = note || "已保存。现在是下一条还未改的细点。";
  questView = "";
  questLec = String(next.lecture || "");
  questPoint = next.id;
  questHint = "";
  mode = "map";
  render();
}
function toggleExplainEditor() {
  if (!explainEditorOn()) return;
  explainEditorOpen = !explainEditorOpen;
  if (explainEditorOpen && !currentReviewPoint()) {
    goToUnrevised("", "从第一条还未改的细点开始。一边试用一边提交。");
    return;
  }
  render();
}
function explainEditorHtml(point, lectureNo) {
  if (!explainEditorOn() || !explainEditorOpen || !point) return "";
  var parts = typeof explanationParts === "function"
    ? explanationParts(point, lectureNo != null ? lectureNo : point.lecture)
    : { say: point.say || "", bookName: point.bookName || "", styleHint: "", atypicalNote: "", reason: point.reason || "" };
  var same = explainForId === point.id;
  var sayVal = same && explainSayDraft !== "" ? explainSayDraft : String(point.say || "");
  var bookVal = same ? explainBookDraft : String(point.bookName || "");
  var reasonVal = same ? explainReasonDraft : String(point.reason || "");
  if (!same) {
    bookVal = String(point.bookName || "");
    reasonVal = String(point.reason || "");
  }
  var html = '<section class="explain-editor" id="explain-editor"><div class="row-head"><b>改这一条讲解</b><span class="small">已改 ' +
    reviewCountText() + "</span></div>";
  if (point.lyricLine) {
    html += '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + "</b><small>" +
      escapeHtml(point.lyricTranslation || "") + "</small></p>";
  } else {
    html += '<p class="miss">这条暂无对应歌词。只改讲解，不要编造歌词。</p>';
  }
  html += '<p class="now"><b>当前讲解</b>' + escapeHtml(parts.say || "（还没有口语讲解）") + "</p>";
  if (parts.styleHint) html += '<p class="voice-hint">程序自动提示（提交后会改用人写的，不再叠这段）：' + escapeHtml(parts.styleHint) + "</p>";
  if (parts.atypicalNote) html += '<p class="voice-hint">课表提示：' + escapeHtml(parts.atypicalNote) + "</p>";
  if (parts.reason) html += '<p class="now"><b>当前原因</b>' + escapeHtml(parts.reason) + "</p>";
  if (parts.bookName) html += '<p class="now"><b>当前小字术语</b>' + escapeHtml(parts.bookName) + "</p>";
  if (point.humanRevised) html += '<p class="review-flag">这条已经改过，还可以再改。</p>';
  html += '<label>为什么这样写（学生听到的口语）<textarea id="review-say" maxlength="2000">' + escapeHtml(sayVal) + "</textarea></label>";
  html += '<label>小字术语（可选）<input id="review-book" type="text" maxlength="200" value="' + escapeHtml(bookVal) + '" /></label>';
  html += '<label>补充原因（可选，小字）<textarea id="review-reason" maxlength="2000">' + escapeHtml(reasonVal) + "</textarea></label>";
  html += '<p class="hint" id="review-note">' + escapeHtml(explainNote || "只改这一条。提交后立刻写入本机课件，再去下一条未改的。跳过则保留原来的讲解。") + "</p>";
  html += '<div class="review-actions">';
  html += '<button class="chip on wide" id="save-explain-review" type="button"' + (explainBusy ? " disabled" : "") + ">保存这一条</button>";
  html += '<button class="chip wide" id="skip-explain-review" type="button">先跳过，下一条未改的</button>';
  html += "</div></section>";
  return html;
}
function paintReviewNote() {
  var note = document.getElementById("review-note");
  if (note) note.textContent = explainNote || "";
}
function saveExplainReview() {
  if (explainBusy) return;
  captureExplainDrafts();
  var sayBox = document.getElementById("review-say");
  var bookBox = document.getElementById("review-book");
  var reasonBox = document.getElementById("review-reason");
  var say = sayBox ? String(sayBox.value || "").trim() : "";
  var point = currentReviewPoint();
  if (!point) {
    explainNote = "请先打开一条细点。";
    paintReviewNote();
    return;
  }
  if (!say) {
    explainNote = "请写下这一条的口语讲解，再提交。";
    paintReviewNote();
    return;
  }
  explainBusy = true;
  explainNote = "正在保存这一条…";
  paintReviewNote();
  fetch("/api/explain-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pointId: point.id,
      say: say,
      bookName: bookBox ? bookBox.value : "",
      reason: reasonBox ? reasonBox.value : "",
    }),
  }).then(function (res) {
    return res.json().then(function (data) { return { ok: res.ok, data: data }; }, function () {
      return { ok: false, data: { error: "保存失败。" } };
    });
  }).then(function (out) {
    explainBusy = false;
    if (!out.ok || !out.data || !out.data.success) {
      explainNote = (out.data && out.data.error) || "保存失败。";
      render();
      return;
    }
    applyReviewLocally(out.data.review, { total: out.data.total, revised: out.data.revised });
    goToUnrevised(point.id);
  }).catch(function () {
    explainBusy = false;
    explainNote = "保存失败，请确认本机开发服务器还在跑。";
    render();
  });
}

function songRoleHtml(point, lectureNo) {
  if (typeof songRoleCopy !== "function") return "";
  var role = songRoleCopy(point, lectureNo != null ? lectureNo : (point && point.lecture));
  if (!role.role || role.role === "none") return "";
  return '<p class="song-role ' + role.role + '"><span class="role-tag">' + escapeHtml(role.label) + "</span> " +
    escapeHtml(role.detail) + "</p>";
}
function pointSongLine(point) {
  if (!point || !point.song || !point.lyricLine) return null;
  var sidx = findSongIndex(point.song);
  if (sidx < 0) return null;
  var list = (SONGS[sidx] && SONGS[sidx].lines) || [];
  var li = findLineIndexIn(list, point.lyricLine);
  if (li < 0) return { songIndex: sidx, lineIndex: -1, line: null, next: null };
  return { songIndex: sidx, lineIndex: li, line: list[li], next: list[li + 1] || null };
}
function pointHearButton(point, label) {
  var info = pointSongLine(point);
  if (!info || info.lineIndex < 0) return "";
  if (typeof isCameoPoint === "function" && isCameoPoint(point, point.lecture)) {
    return '<button class="chip" data-cameo-clip="' + escapeHtml(point.id) + '" data-heard-point="' +
      escapeHtml(point.id) + '" type="button">' + escapeHtml(label || "听这一小段") + "</button>";
  }
  var currentTitle = (typeof song === "function" && song() && song().title) || "";
  if (findSongIndex(currentTitle) === info.songIndex) {
    return '<button class="chip" data-hear="' + info.lineIndex + '" data-heard-point="' +
      escapeHtml(point.id) + '" type="button">' + escapeHtml(label || "听这句") + "</button>";
  }
  return '<button class="chip" data-quest-listen-song="' + info.songIndex + '" data-line="' + info.lineIndex +
    '" data-heard-point="' + escapeHtml(point.id) + '" type="button">' + escapeHtml(label || "听这句") + "</button>";
}
var clipAudio = null;
var clipTimer = 0;
function stopCameoClip() {
  if (clipTimer) { clearTimeout(clipTimer); clipTimer = 0; }
  if (clipAudio) {
    try { clipAudio.pause(); } catch (error) {}
  }
}
function playCameoClip(point) {
  var info = pointSongLine(point);
  if (!info || !info.line) return false;
  var win = typeof clipWindow === "function"
    ? clipWindow(info.line.startTime, info.line.endTime, info.next && info.next.startTime)
    : null;
  if (!win) return false;
  stopCameoClip();
  if (typeof audio !== "undefined" && audio && !audio.paused) {
    try { audio.pause(); } catch (error) {}
  }
  var url = (SONGS[info.songIndex] && SONGS[info.songIndex].audioUrl) || "";
  if (!url) return false;
  var startPlay = function (src) {
    if (!clipAudio) clipAudio = new Audio();
    clipAudio.src = src;
    var begin = function () {
      try { clipAudio.currentTime = win.start; } catch (error) {}
      var play = clipAudio.play();
      if (play && play.catch) play.catch(function () {});
      clipTimer = setTimeout(function () { stopCameoClip(); }, Math.max(300, (win.end - win.start) * 1000));
    };
    if (clipAudio.readyState >= 1) begin();
    else clipAudio.addEventListener("loadedmetadata", begin, { once: true });
  };
  if (typeof prepare === "function") prepare(url).then(startPlay);
  else startPlay(url);
  return true;
}
function lecturePoints(no) {
  var list = pointsForLecture(no);
  if (typeof assignMainline !== "function") return list;
  var song = typeof officialSong === "function" ? officialSong(no, typeof SONGS !== "undefined" ? SONGS : []) : null;
  return assignMainline(list, no, song && song.title);
}
function grammarPointList() {
  if (questLec) return lecturePoints(questLec);
  var current = typeof song === "function" ? song() : null;
  if (current && current.lecture) return lecturePoints(current.lecture);
  return pointsForSong((current && current.title) || "");
}
function pointById(id) {
  if (!id || !POINTS || !POINTS.length) return null;
  for (var i = 0; i < POINTS.length; i++) {
    if (POINTS[i].id === id) return POINTS[i];
  }
  return null;
}
function songKind() {
  return detectJudgeKind(focusName(), tipText(), "");
}
function defaultPracticePoint() {
  var title = (song() && song().title) || "";
  var attached = pointsForSong(title);
  if (!attached.length) return null;
  var kind = songKind();
  var i;
  if (kind !== "generic") {
    for (i = 0; i < attached.length; i++) {
      if (detectJudgeKind(attached[i].oralName, attached[i].say, attached[i].lyricLine) === kind) return attached[i];
    }
  }
  var focus = focusName();
  if (focus) {
    for (i = 0; i < attached.length; i++) {
      if (attached[i].oralName === focus || (attached[i].oralName && attached[i].oralName.indexOf(focus) >= 0)) return attached[i];
    }
  }
  for (i = 0; i < attached.length; i++) {
    if (getProgress(attached[i].id).status !== "mastered") return attached[i];
  }
  return attached[0];
}
function currentPoint() {
  if (practicePointId) return pointById(practicePointId);
  return defaultPracticePoint();
}
function startPractice(pointId) {
  var point = pointById(pointId);
  if (point && point.lecture && typeof isLectureOpen === "function") {
    if (!isLectureOpen(point.lecture)) {
      questHint = "这一讲暂未开放。还没有合适的歌，不编造歌曲。";
      questLec = String(point.lecture);
      questPoint = "";
      mode = "map";
      render();
      return;
    }
    var lectures = liveQuestLectures();
    var lec = lectureByNo(lectures, point.lecture);
    var idx = pointIndexInLecture(lec, point.id);
    var unlocked = lecturePassUnlocked(point.lecture, lectures);
    if (idx >= 0 && !pointPassUnlocked(idx, lec && lec.statuses, unlocked, lec && lec.points)) {
      questHint = "先过当前关，才能亮这一关的过关路径。仍可以先听、先看，但不记掌握。";
      questLec = String(point.lecture);
      questPoint = point.id;
      mode = "map";
      render();
      return;
    }
    if (point.lecture) questLec = String(point.lecture);
  }
  practicePointId = pointId || "";
  waitingIndependent = Boolean(pointId && getProgress(pointId).framePassed);
  passDraft = "";
  frameDraft = "";
  practiceTask = "";
  pickFrom = -1;
  pickTo = -1;
  pickReady = false;
  explainDraft = "";
  rewriteDraft = "";
  followDraft = "";
  speechNote = "";
  listeningMic = false;
  if (point && point.song && !(typeof isCameoPoint === "function" && isCameoPoint(point, point.lecture))) {
    var next = findSongIndex(point.song);
    if (next >= 0 && next !== index) {
      mode = "builder";
      keepPractice = true;
      loadSong(next, false);
      return;
    }
  }
  mode = "builder";
  render();
}
function pointLineIndex(point) {
  if (!point || !point.lyricLine) return -1;
  return findLineIndexIn(lines(), point.lyricLine);
}
function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(flushProgress, 500);
}
function applyRemotePayload(data) {
  if (!data) return;
  if (data.userId) adoptAccount(data.userId);
  if (data.items && data.items.length) {
    var remote = {};
    for (var i = 0; i < data.items.length; i++) {
      var row = normalizeRecord(data.items[i]);
      if (row.pointId) remote[row.pointId] = row;
    }
    progressMap = mergeMaps(progressMap, remote);
    persistProgress();
  }
  if (data.badges && data.badges.length) {
    var remoteBadges = {};
    for (var b = 0; b < data.badges.length; b++) {
      var badge = normalizeBadge(data.badges[b]);
      if (badge) remoteBadges[badge.id] = badge;
    }
    badgeMap = mergeBadgeMaps(badgeMap, remoteBadges);
    persistBadges();
  }
  if (typeof catchUpBadges === "function") catchUpBadges();
  if (typeof render === "function") render();
}
function flushProgress() {
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  var items = [];
  Object.keys(progressMap).forEach(function (id) {
    var row = normalizeRecord(progressMap[id]);
    if (row.pointId && row.status !== "unseen") items.push(row);
  });
  fetch("/api/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ items: items, badges: badgesForSync() })
  }).then(function (res) {
    if (res.status === 401) return null;
    if (!res.ok) throw new Error("bad");
    return res.json();
  }).then(function (data) {
    applyRemotePayload(data);
    recheckProvisional();
  }).catch(function () {});
}
function pullProgress() {
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  fetch("/api/progress", { credentials: "same-origin" }).then(function (res) {
    if (!res.ok) throw new Error("bad");
    return res.json();
  }).then(function (data) {
    applyRemotePayload(data);
    recheckProvisional();
  }).catch(function () {});
}
function recheckProvisional() {
  if (recheckBusy) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  var beforeLectures = typeof liveQuestLectures === "function" ? liveQuestLectures() : [];
  var pending = [];
  Object.keys(progressMap).forEach(function (id) {
    var row = normalizeRecord(progressMap[id]);
    if (row.status === "provisional" && row.lastSentence && !recheckTried[id]) pending.push(row);
  });
  if (!pending.length) return;
  recheckBusy = true;
  var next = function (i) {
    if (i >= pending.length) {
      recheckBusy = false;
      persistProgress();
      var sync = typeof syncBadgesFromLectures === "function" ? syncBadgesFromLectures(beforeLectures) : null;
      if (mode === "builder" || mode === "book" || mode === "grammar" || mode === "map") render();
      if (sync && sync.cleared && mode === "builder") {
        var box = document.getElementById("sentence-result");
        if (box) showVerdict({ verdict: "pass", note: "" }, { lectureClear: sync.cleared, newBadges: sync.added });
      }
      return;
    }
    var row = pending[i];
    var point = pointById(row.pointId);
    if (!point) { next(i + 1); return; }
    fetch("/api/check-sentence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        passGate: true,
        studentSentence: row.lastSentence,
        oralName: point.oralName || "",
        say: point.say || "",
        lyricLine: point.lyricLine || ""
      })
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (data && data.aiAvailable && data.verdict === "pass") {
        recheckTried[row.pointId] = true;
        progressMap[row.pointId] = applyProgressEvent(row, verdictEvent("pass", row.pointId, row.lastSentence), Date.now());
      } else if (data && data.aiAvailable && data.verdict === "fail") {
        recheckTried[row.pointId] = true;
        progressMap[row.pointId] = applyProgressEvent(row, { type: "review-fail", pointId: row.pointId, sentence: row.lastSentence }, Date.now());
      }
      next(i + 1);
    }).catch(function () { next(i + 1); });
  };
  next(0);
}

function renderGrammar() {
  var attached = grammarPointList();
  var introCopy = typeof TEACH_AFTER_LISTEN === "string" ? TEACH_AFTER_LISTEN : "先听这句，再看它为什么这样写。看完、听完都不记掌握。";
  var intro = '<div class="card"><b>这一讲里出现的语法</b><p>' + escapeHtml(introCopy) + "每次只过当前这一条。请写成一句你自己的事。</p></div>";
  if (attached.length) {
    var cards = attached.map(function (point) {
      var rec = getProgress(point.id);
      var hear = pointHearButton(point);
      var line = point.lyricLine
        ? '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
          escapeHtml(point.lyricTranslation || "") + '</small></p>'
        : '<p class="miss">暂无对应歌词</p>';
      var why = point.reason ? '<p class="voice-hint">' + escapeHtml(point.reason) + '</p>' : "";
      return '<div class="card"><div class="row-head"><b>' + escapeHtml(point.oralName) +
        '</b>' + badgeHtml(rec.status, "", rec) + '</div><p class="small">' + escapeHtml(point.bookName || "") +
        (point.lecture ? ' · 第' + point.lecture + '讲' : '') +
        (point.mainline === false ? ' · 支线' : '') +
        '</p>' + pointExplainHtml(point) + songRoleHtml(point) + line + why +
        '<div class="row">' + hear +
        '<button class="chip on" data-practice="' + escapeHtml(point.id) + '" type="button">过关：写成自己的</button></div></div>';
    }).join("");
    stage.innerHTML = intro + cards +
      '<button class="chip" id="open-read" type="button">拿到阅读里看</button>';
    return;
  }
  var pool = studyLines();
  var fallback = pool.map(function (line) {
    var spoken = sentenceHtml(line);
    return '<div class="card"><b>' + spoken.html +
      '</b><p>' + escapeHtml(spoken.translation) + '</p><button class="chip" data-hear="' +
      lines().indexOf(line) + '" type="button">听这句</button></div>';
  }).join("");
  stage.innerHTML = '<div class="card"><b>' + escapeHtml(focusName()) + '</b><p>' + tipText() +
    '</p><p>看完还不算掌握。请用这个办法写一句自己的事。</p></div>' +
    (fallback || '<div class="card">这首歌里还没有对上这个点的句子。</div>') +
    '<button class="chip on" id="use-pattern" type="button">过关：写成自己的</button> ' +
    '<button class="chip" id="open-read" type="button">拿到阅读里看</button>';
}

function renderBuilder() {
  var box = document.getElementById("sentence");
  var frameBox = document.getElementById("frame-sentence");
  if (box) passDraft = box.value;
  if (frameBox) frameDraft = frameBox.value;
  var attached = pointsForSong((song() && song().title) || "");
  var point = currentPoint();
  if (attached.length && !practicePointId && attached.length > 1 && !point) {
    var picker = attached.map(function (item) {
      return '<button class="line" data-practice="' + escapeHtml(item.id) + '" type="button"><b>' +
        escapeHtml(item.oralName) + '</b><small>' + escapeHtml(item.bookName || "") + " · " +
        statusLabel(getProgress(item.id).status) + '</small></button>';
    }).join("");
    stage.innerHTML = '<div class="card"><b>换成你自己的事</b><p>每次只过当前这一条。请先选一条细点。</p></div>' + picker;
    return;
  }
  if (!practicePointId && point) practicePointId = point.id;
  if (!point) {
    stage.innerHTML = '<div class="card"><b>换成你自己的事</b><p>' + tipText() +
      '</p><p>用这个办法写一句你自己的完整话。看完、听完、填空做对都不记掌握。</p>' +
      '<textarea id="sentence" rows="3" placeholder="写成完整的一句。">' + escapeHtml(passDraft) +
      '</textarea><button class="chip on wide" id="check-sentence" type="button">交一版，看过没过</button>' +
      '<div id="sentence-result"></div></div>';
    return;
  }
  var rec = getProgress(point.id);
  var lyric = point.lyricLine
    ? '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
      escapeHtml(point.lyricTranslation || "") + '</small></p>'
    : '<p class="miss">暂无对应歌词。请用自己的句子来练，不编造歌词。</p>';
  var lineIndex = pointLineIndex(point);
  var hear = lineIndex >= 0
    ? '<button class="chip" id="hear-again" data-hear="' + lineIndex + '" data-heard-point="' + escapeHtml(point.id) + '" type="button">再听原句</button>'
    : "";
  var more = attached.length > 1
    ? '<button class="chip" id="pick-point" type="button">换一条细点</button>'
    : "";
  var frameBlock = "";
  if (rec.failCount >= 2 && !waitingIndependent && rec.status !== "mastered") {
    frameBlock = '<div class="card"><b>先用这个架子写一句</b><p>填进你自己的事，不是选择题。架子过了以后，还要再独立写一句，才能算过。</p><p>' +
      escapeHtml(sentenceFrame(detectJudgeKind(point.oralName, point.say, point.lyricLine))) +
      '</p><textarea id="frame-sentence" rows="2" placeholder="用架子写成一句">' + escapeHtml(frameDraft) +
      '</textarea><button class="chip wide" id="check-frame" type="button">先交架子这句</button></div>';
  }
  var independentNote = waitingIndependent || rec.framePassed
    ? '<p>架子已经过了。现在请再独立写一句，才能记掌握或暂过。</p>'
    : "";
  stage.innerHTML = '<div class="card"><div class="row-head"><b>过关：换成你自己的事</b>' +
    badgeHtml(rec.status) + '</div><p class="small">' + escapeHtml(point.oralName) +
    (point.lecture ? ' · 第' + point.lecture + '讲' : '') +
    '</p><p>' + escapeHtml(point.say || tipText()) + '</p>' + lyric + independentNote +
    '<textarea id="sentence" rows="3" placeholder="用这个办法写一句你自己的完整话。">' + escapeHtml(passDraft) +
    '</textarea>' + hear +
    '<button class="chip on wide" id="check-sentence" type="button">交一版，看过没过</button>' +
    '<div id="sentence-result"></div>' + more + '</div>' + frameBlock;
}

function renderQuiz() {
  var items = quizItems();
  if (!items.length) { stage.innerHTML = '<div class="card">这首歌还没有填空题。</div>'; return; }
  if (quizIndex >= items.length) {
    stage.innerHTML = '<div class="card"><b>做完了</b><p>对了 ' + quizScore + ' / ' + items.length +
      '</p><p class="small">填空只是热身，做对了也不记掌握。</p>' +
      '<button class="chip" id="quiz-restart" type="button">再练一次</button> ' +
      '<button class="chip on" id="use-pattern" type="button">去过关：写成自己的</button></div>';
    return;
  }
  var line = items[quizIndex];
  var cloze = line.cloze;
  var options = (cloze.options || []).map(function (opt) {
    var cls = "opt";
    if (quizLocked && opt.toLowerCase() === String(cloze.blankWord).toLowerCase()) cls += " good";
    else if (quizLocked && opt === quizAnswer) cls += " bad";
    return '<button class="' + cls + '" data-opt="' + escapeHtml(opt) + '" type="button">' + escapeHtml(opt) + '</button>';
  }).join("");
  var spoken = line.kind === "made" ? null : sentenceHtml(line);
  var sentence = line.kind === "made"
    ? (cloze.sentenceWithBlank || line.text)
    : (cloze.sentenceWithBlank || line.fullText || line.text);
  var hear = line.startTime == null ? "" : '<button class="chip" data-hear="' + lines().indexOf(line) + '" type="button">听这句</button>';
  stage.innerHTML = '<div class="card"><p>第 ' + (quizIndex + 1) + ' / ' + items.length +
    ' 句</p><p class="small">填空只是热身，做对了也不记掌握。</p><p>' +
    (line.kind === "made" ? "换一句你自己的" : "完整的一句") + '</p><b>' + escapeHtml(sentence) +
    '</b><p>' + escapeHtml(spoken ? spoken.translation : "") + '</p>' + hear +
    options +
    '<button class="chip" id="quiz-prev" type="button">上一题</button>' +
    '<button class="chip" id="quiz-next" type="button">下一题</button></div>';
}

function renderBook() {
  if (!bookLec) {
    var html = '<div class="card"><b>教材</b><p>按四十讲打开。每一讲列出课件上的全部细点。点一条看讲解；有对应歌词的可以去听。列表上的掌握，只看你有没有用自己的句子过关。</p></div>';
    var lastGroup = "";
    (BOOK || []).forEach(function (group) {
      (group.items || []).forEach(function (lec) {
        if (group.group !== lastGroup) {
          lastGroup = group.group;
          html += '<p class="point">' + escapeHtml(group.group) + '</p>';
        }
        var pack = LECTURES[String(lec.no)] || { items: [] };
        var pts = lecturePoints(lec.no);
        var matched = pts.filter(function (point) { return point.song; }).length;
        var missing = pts.length - matched;
        var mastered = pts.filter(function (point) { return getProgress(point.id).status === "mastered"; }).length;
        var hasExam = (pack.items || []).length > 0;
        var mark = pts.length + " 个点";
        if (matched) mark += " · " + matched + " 有歌";
        if (missing) mark += " · " + missing + " 暂无歌词";
        if (mastered) mark += " · " + mastered + " 已掌握";
        if (hasExam) mark += " · 有题";
        html += '<button class="line" data-lec="' + lec.no + '" type="button"><b>第' + lec.no + '讲 ' +
          escapeHtml(lec.title || "") + '</b><small>' + mark + '</small></button>';
      });
    });
    stage.innerHTML = html;
    return;
  }
  var lec = lectureInfo(bookLec);
  var pts = lecturePoints(bookLec);
  if (!pts.length && !lec.title) { bookLec = ""; renderBook(); return; }
  if (!bookOpen) {
    var list = '<button class="chip" id="book-up" type="button">全部讲</button>';
    list += '<div class="card"><b>第' + lec.no + '讲 ' + escapeHtml(lec.title || "") +
      '</b><p>这一讲共 ' + pts.length + ' 个细点。暂无对应歌词的条目也会列在这里。看完不算掌握。细点多的讲次，过完主线即可点亮本讲。</p></div>';
    pts.forEach(function (point) {
      var rec = getProgress(point.id);
      var mark = point.song ? " · " + point.song : " · 暂无对应歌词";
      if (point.mainline === false) mark += " · 支线";
      else if (pts.length > 10) mark += " · 主线";
      if (typeof isCameoPoint === "function" && isCameoPoint(point, bookLec)) mark += " · 客串例句";
      else if (point.song) mark += " · 本家主打歌";
      list += '<button class="line" data-point="' + escapeHtml(point.id) + '" type="button"><b>' +
        escapeHtml(point.oralName) + '</b><small>' + badgeHtml(rec.status, "list", rec) + " " +
        escapeHtml(point.bookName || "") + mark + '</small></button>';
    });
    stage.innerHTML = list;
    return;
  }
  var point = pts.find(function (item) { return item.id === bookOpen; });
  if (!point) { bookOpen = ""; renderBook(); return; }
  var own = POINT_EXAM[point.ref];
  var ownItems = (own && own.items) || [];
  var realN = ownItems.filter(function (item) { return item.kind !== "模拟题"; }).length;
  var mockN = ownItems.length - realN;
  var examLabel = realN && mockN ? "做这一条的题" : mockN ? "做模拟题" : realN ? "做这一条的真题" : "";
  var exam = examLabel
    ? '<button class="chip" data-point-exam="' + escapeHtml(point.ref) + '" type="button">' + examLabel + '</button>'
    : "";
  var packItems = (LECTURES[String(point.lecture)] || {}).items || [];
  var lectureExam = !exam && packItems.length
    ? '<button class="chip" data-book="' + point.lecture + '" type="button">做第' + point.lecture + '讲的题</button>'
    : "";
  var body = pointExplainHtml(point) + songRoleHtml(point, bookLec);
  if (point.song && point.lyricLine) {
    body += '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
      escapeHtml(point.lyricTranslation || "") + '</small></p>';
    if (point.reason) body += '<p class="voice-hint">' + escapeHtml(point.reason) + '</p>';
    body += '<p class="small">《' + escapeHtml(point.song) + '》' +
      (point.artist ? " · " + escapeHtml(point.artist) : "") + '</p>';
    var go = pointHearButton(point, typeof isCameoPoint === "function" && isCameoPoint(point, bookLec) ? "听这一小段" : "去听");
    var readings = readButtons([point.song]);
    body += go || '<p class="miss">歌名已记下，课表里还没有这首歌。</p>';
    if (readings) body += '<div class="row">' + readings + '</div>';
  } else {
    body += '<p class="miss">暂无对应歌词。请用自己的句子来练，不编造歌词。</p>';
  }
  body += '<button class="chip on wide" data-practice="' + escapeHtml(point.id) + '" type="button">过关：写成自己的</button>';
  stage.innerHTML = '<button class="chip" id="book-up" type="button">返回这一讲</button><div class="card"><div class="row-head"><b>' +
    escapeHtml(point.oralName) + '</b>' + badgeHtml(getProgress(point.id).status) +
    '</div><p class="small">' + escapeHtml(point.bookName || "") + '</p>' +
    body + exam + lectureExam + '</div>' + explainEditorHtml(point, bookLec);
}

function showVerdict(result, options) {
  var box = document.getElementById("sentence-result");
  if (!box) return;
  var verdict = result.verdict || "fail";
  var title = verdict === "pass" ? "过了，记下掌握" : verdict === "provisional" ? "暂过，灯先半亮" : "还没过";
  var extra = "";
  if (options && options.frameOnly && (verdict === "pass" || verdict === "provisional")) {
    title = "架子这句可以了";
    extra = "<p>还要再独立写一句，才能记掌握或暂过。</p>";
    verdict = "provisional";
  } else if (verdict === "pass") {
    var clear = options && options.lectureClear;
    if (clear) {
      var copy = lectureClearCopy(clear, liveQuestLectures());
      title = copy.title;
      extra = lectureClearExtraHtml(copy, (options && options.newBadges) || []);
      verdict = "pass lecture-clear";
    } else {
      extra = "<p>这一关亮了。</p>";
      var current = currentPoint();
      var lectures = typeof liveQuestLectures === "function" ? liveQuestLectures() : [];
      var target = typeof nextPassTarget === "function"
        ? nextPassTarget(lectures, current && current.lecture, current && current.id)
        : null;
      if (target && target.pointId) {
        extra += '<div class="quest-actions"><button class="chip on wide" data-quest-next="' +
          escapeHtml(target.pointId) + '" data-quest-lec="' + target.lectureNo +
          '" type="button">去下一关</button></div>';
      }
      extra += '<div class="quest-actions"><button class="chip wide" id="back-quest-lec" type="button">返回这一讲</button>' +
        '<button class="chip wide" id="to-map-main" type="button">返回地图</button></div>';
    }
  } else if (verdict === "provisional") {
    extra = "<p>没网或还没有核到 AI。灯先半亮。暂过还不是正式掌握，有网后会再核一次。现在可以先去下一关；若复核未过，会把这一关标成请补练。</p>";
    var currentProv = currentPoint();
    var lecturesProv = typeof liveQuestLectures === "function" ? liveQuestLectures() : [];
    var targetProv = typeof nextPassTarget === "function"
      ? nextPassTarget(lecturesProv, currentProv && currentProv.lecture, currentProv && currentProv.id)
      : null;
    if (targetProv && targetProv.pointId) {
      extra += '<div class="quest-actions"><button class="chip on wide" data-quest-next="' +
        escapeHtml(targetProv.pointId) + '" data-quest-lec="' + targetProv.lectureNo +
        '" type="button">去下一关</button></div>';
    }
    extra += '<div class="quest-actions"><button class="chip wide" id="back-quest-lec" type="button">返回这一讲</button>' +
      '<button class="chip wide" id="to-map-main" type="button">返回地图</button></div>';
  } else if (verdict === "fail") {
    if (result.followUp) extra += "<p>想一想：" + escapeHtml(result.followUp) + "</p>";
    extra += "<p>请再听原句，改一版再交。</p>";
  }
  box.innerHTML = '<div class="verdict ' + verdict + '"><b>' + title + '</b><p>' +
    escapeHtml(result.note || "") + '</p>' + extra + "</div>";
}

function applyVerdict(pointId, sentence, result, isFrameOnly) {
  var verdict = result.verdict || "fail";
  if (!pointId) {
    showVerdict(result, { frameOnly: isFrameOnly });
    return;
  }
  var beforeLectures = typeof liveQuestLectures === "function" ? liveQuestLectures() : [];
  var event = verdictEvent(verdict, pointId, sentence, isFrameOnly);
  setProgress(pointId, event);
  if (isFrameOnly && (verdict === "pass" || verdict === "provisional")) {
    waitingIndependent = true;
    frameDraft = "";
  }
  var sync = typeof syncBadgesFromLectures === "function" ? syncBadgesFromLectures(beforeLectures) : {};
  var verdictOpts = { frameOnly: isFrameOnly, lectureClear: sync && sync.cleared, newBadges: (sync && sync.added) || [] };
  showVerdict(result, verdictOpts);
  if (!isFrameOnly) renderBuilder();
  else renderBuilder();
  var again = document.getElementById("sentence-result");
  if (again) showVerdict(result, verdictOpts);
}

function localGate(sentence, point) {
  var judged = judgePointSentence(
    sentence,
    point && point.oralName || focusName(),
    point && point.say || tipText(),
    point && point.lyricLine || ""
  );
  return {
    machinePassed: judged.machinePassed,
    aiPassed: null,
    aiAvailable: false,
    verdict: combineVerdict(judged.machinePassed, null, false),
    note: judged.note,
    followUp: judged.machinePassed ? "" : judged.note,
    frame: judged.frame,
    kind: judged.kind
  };
}

function requestGate(sentence, point) {
  var local = localGate(sentence, point);
  var canFetch = location.protocol === "http:" || location.protocol === "https:";
  if (!canFetch) return Promise.resolve(local);
  return fetch("/api/check-sentence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      passGate: true,
      studentSentence: sentence,
      oralName: (point && point.oralName) || focusName() || "",
      say: (point && point.say) || tipText() || "",
      lyricLine: (point && point.lyricLine) || ""
    })
  }).then(function (res) {
    if (!res.ok) throw new Error("bad");
    return res.json();
  }).then(function (data) {
    if (!data || !data.verdict) throw new Error("empty");
    return data;
  }).catch(function () {
    return local;
  });
}

function checkSentence() {
  checkPass(false);
}
function checkFrame() {
  checkPass(true);
}
function checkPass(isFrameOnly) {
  var input = document.getElementById(isFrameOnly ? "frame-sentence" : "sentence");
  var result = document.getElementById("sentence-result");
  if (!input || !result) return;
  var text = input.value.trim();
  if (!text) {
    result.innerHTML = "<p>先把你写的英文句子打进上面那个框，再交一版。</p>";
    return;
  }
  if (isFrameOnly) frameDraft = text;
  else passDraft = text;
  result.innerHTML = "<p>在看有没有用对…</p>";
  var point = currentPoint();
  requestGate(text, point).then(function (data) {
    applyVerdict(point && point.id, text, data, isFrameOnly);
  });
}

loadProgressMap();
loadBadgeMap();
if (typeof catchUpBadges === "function") catchUpBadges();
if (typeof render === "function") render();
if (typeof window !== "undefined") {
  window.addEventListener("online", function () { pullProgress(); });
}
pullProgress();

function handlePassClick(event) {
  if (handleQuestClick(event)) return true;
  if (event.target.id === "save-explain-review") {
    saveExplainReview();
    return true;
  }
  if (event.target.id === "skip-explain-review") {
    captureExplainDrafts();
    var cur = currentReviewPoint();
    explainNote = "已跳过，保留原来的讲解。";
    goToUnrevised(cur && cur.id, "已跳过，保留原来的讲解。现在是下一条还未改的细点。");
    return true;
  }
  var practice = event.target.closest("[data-practice]");
  if (practice) {
    startPractice(practice.getAttribute("data-practice") || "");
    return true;
  }
  if (event.target.id === "pick-point") {
    practicePointId = "";
    renderBuilder();
    return true;
  }
  if (event.target.id === "check-frame") {
    checkFrame();
    return true;
  }
  if (event.target.id === "use-pattern") {
    var point = defaultPracticePoint();
    if (point) startPractice(point.id);
    else {
      mode = "builder";
      render();
    }
    return true;
  }
  var heard = event.target.closest("[data-heard-point]");
  if (heard) markHeard(heard.getAttribute("data-heard-point") || "");
  return false;
}
if (stage && !stage.getAttribute("data-pass-bound")) {
  stage.setAttribute("data-pass-bound", "1");
  var previousClick = stage.onclick;
  stage.onclick = function (event) {
    if (handlePassClick(event)) return;
    if (previousClick) previousClick.call(stage, event);
  };
}
var mapHome = document.getElementById("to-map");
if (mapHome && !mapHome.getAttribute("data-quest-bound")) {
  mapHome.setAttribute("data-quest-bound", "1");
  mapHome.onclick = function () {
    mode = "map";
    questLec = "";
    questPoint = "";
    questHint = "";
    questView = "";
    if (typeof closeSheet === "function") closeSheet();
    render();
  };
}

var previousLoadSong = loadSong;
loadSong = function (next, autoplay) {
  if (!keepPractice) { practicePointId = ""; practiceTask = ""; }
  keepPractice = false;
  previousLoadSong(next, autoplay);
};

function pointKind(point) {
  if (!point) return detectJudgeKind(focusName(), tipText(), "");
  return detectJudgeKind(point.oralName, point.say, point.lyricLine);
}

function matchingReadings(point) {
  var title = (point && point.song) || (song() && song().title) || "";
  var pack = (typeof READINGS !== "undefined" && READINGS[title]) || [];
  if (!pack.length) return [];
  var kind = pointKind(point);
  // 已按同一现象配上的长句，通用细点也进入第 3 期阅读迁移；五种专用机判仍按 kind 筛选。
  if (kind === "generic") return pack;
  var hits = [];
  for (var i = 0; i < pack.length; i++) {
    var mark = String((pack[i] && pack[i].mark) || "");
    var ask = String((pack[i] && pack[i].ask) || "");
    var probe = detectJudgeKind("", ask, mark);
    var ok = probe === kind;
    if (!ok && kind === "already" && /say/i.test(mark)) ok = true;
    if (!ok && kind === "future-if" && /^if\b/i.test(mark)) ok = true;
    if (!ok && kind === "to-verb" && /^to\s+/i.test(mark)) ok = true;
    if (!ok && kind === "walking" && /ing$/i.test(mark)) ok = true;
    if (!ok && kind === "dressed" && /(ed|tired)$/i.test(mark)) ok = true;
    if (ok) hits.push(pack[i]);
  }
  return hits;
}

function splitTokens(text) {
  var parts = String(text || "").split(/(\s+)/);
  var words = [];
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i] || /^\s+$/.test(parts[i])) continue;
    words.push(parts[i]);
  }
  return words;
}

function tokenButtons(text, from, to) {
  var parts = String(text || "").split(/(\s+)/);
  var wordIndex = -1;
  var html = "";
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    if (/^\s+$/.test(parts[i])) {
      html += parts[i];
      continue;
    }
    wordIndex += 1;
    var lo = Math.min(from, to);
    var hi = Math.max(from, to);
    var on = from >= 0 && to >= 0 && wordIndex >= lo && wordIndex <= hi;
    html += '<button class="pick' + (on ? " on" : "") + '" data-tok="' + wordIndex + '" type="button">' +
      escapeHtml(parts[i]) + "</button>";
  }
  return html;
}

function selectedTokens(text, from, to) {
  if (from < 0 || to < 0) return "";
  var words = splitTokens(text);
  var lo = Math.min(from, to);
  var hi = Math.max(from, to);
  return words.slice(lo, hi + 1).join(" ");
}

function backToHub() {
  practiceTask = "";
  pickFrom = -1;
  pickTo = -1;
  pickReady = false;
  speechNote = "";
  renderBuilder();
}

function saveOpenDrafts() {
  var box = document.getElementById("sentence");
  var frameBox = document.getElementById("frame-sentence");
  var explainBox = document.getElementById("explain-text");
  var rewriteBox = document.getElementById("rewrite-text");
  var followBox = document.getElementById("follow-text");
  if (box) passDraft = box.value;
  if (frameBox) frameDraft = frameBox.value;
  if (explainBox) explainDraft = explainBox.value;
  if (rewriteBox) rewriteDraft = rewriteBox.value;
  if (followBox) followDraft = followBox.value;
  captureExplainDrafts();
}

function renderPracticeHub(point, attached) {
  var rec = getProgress(point.id);
  var lyric = point.lyricLine
    ? '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
      escapeHtml(point.lyricTranslation || "") + "</small></p>"
    : '<p class="miss">暂无对应歌词。请用自己的句子来练，不编造歌词。</p>';
  var hear = pointHearButton(point, typeof isCameoPoint === "function" && isCameoPoint(point, point.lecture) ? "再听这一小段" : "再听原句");
  var more = attached.length > 1
    ? '<button class="chip" id="pick-point" type="button">换一条细点</button>'
    : "";
  var tasks = '<button class="chip on wide" data-task="own" type="button">写成自己的</button>' +
    '<button class="chip wide" data-task="explain" type="button">指出并说明</button>' +
    '<button class="chip wide" data-task="speak" type="button">开口用上</button>';
  if (point.lyricLine) tasks += '<button class="chip wide" data-task="rewrite" type="button">改一句歌词</button>';
  if (rec.status === "mastered" && matchingReadings(point).length) {
    tasks += '<button class="chip wide" data-task="read" type="button">到阅读里标出同一现象</button>';
  }
  stage.innerHTML = '<div class="card"><div class="row-head"><b>过关</b>' + badgeHtml(rec.status, "", rec) +
    '</div><p class="small">' + escapeHtml(point.oralName) +
    (point.lecture ? " · 第" + point.lecture + "讲" : "") +
    (point.mainline === false ? " · 支线" : "") +
    "</p>" + (pointExplainHtml(point) || ("<p>" + escapeHtml(tipText()) + "</p>")) + songRoleHtml(point) + lyric +
    "<p class=\"hint\">" + escapeHtml(typeof TEACH_AFTER_LISTEN === "string" ? TEACH_AFTER_LISTEN : "先听这句，再看它为什么这样写。") +
    "每次只过当前这一条。请选一件事来做。写成自己的是主过关。</p>" +
    hear + tasks + more +
    '<div class="quest-actions"><button class="chip wide" id="back-quest-lec" type="button">返回这一讲</button>' +
    '<button class="chip wide" id="to-map-main" type="button">返回地图</button></div></div>' +
    explainEditorHtml(point);
}

function hearAndFrame(point, rec, kind) {
  var hear = pointHearButton(point, typeof isCameoPoint === "function" && isCameoPoint(point, point.lecture) ? "再听这一小段" : "再听原句");
  var frameBlock = "";
  if (rec.failCount >= 2 && !waitingIndependent && rec.status !== "mastered") {
    var frameText = practiceTask === "explain" ? explainFrame(kind) : sentenceFrame(kind);
    var frameTitle = practiceTask === "explain" ? "先用这个架子说明" : "先用这个架子写一句";
    frameBlock = '<div class="card"><b>' + frameTitle +
      "</b><p>填进你自己的话，不是选择题。架子过了以后，还要再独立做一次，才能算过。</p><p>" +
      escapeHtml(frameText) +
      '</p><textarea id="frame-sentence" rows="2" placeholder="用架子写成一句">' + escapeHtml(frameDraft) +
      '</textarea><button class="chip wide" id="check-frame" type="button">先交架子这句</button></div>';
  }
  return { hear: hear, frameBlock: frameBlock };
}

function renderOwnTask(point, attached) {
  var rec = getProgress(point.id);
  var kind = pointKind(point);
  var bits = hearAndFrame(point, rec, kind);
  var lyric = point.lyricLine
    ? '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
      escapeHtml(point.lyricTranslation || "") + "</small></p>"
    : '<p class="miss">暂无对应歌词。请用自己的句子来练，不编造歌词。</p>';
  var speaking = practiceTask === "speak";
  var title = speaking ? "开口用上" : "过关：换成你自己的事";
  var prompt = speaking ? speakPrompt(kind) : "用这个办法写一句你自己的完整话。";
  var mic = "";
  if (speaking) {
    mic = '<p class="hint">先把你说的话转成文字，再按和「写成自己的」相同的标准判断。先不打发音分。没有麦克、没网或开口不好用时，请改打字，也可记暂过。</p>' +
      '<button class="chip on wide mic" id="start-mic" type="button">' +
      (listeningMic ? "停下来" : "对着手机说") + "</button>" +
      '<p id="speech-note">' + escapeHtml(speechNote || "也可以直接打字。") + "</p>";
  }
  var independentNote = waitingIndependent || rec.framePassed
    ? "<p>架子已经过了。现在请再独立做一次，才能记掌握或暂过。</p>"
    : "";
  var more = attached.length > 1
    ? '<button class="chip" id="pick-point" type="button">换一条细点</button>'
    : "";
  stage.innerHTML = '<button class="chip" id="back-hub" type="button">返回过关</button>' +
    '<div class="card"><div class="row-head"><b>' + title + "</b>" + badgeHtml(rec.status, "", rec) +
    '</div><p class="small">' + escapeHtml(point.oralName) +
    (point.lecture ? " · 第" + point.lecture + "讲" : "") +
    "</p>" + (speaking ? "<p>" + escapeHtml(prompt) + "</p>" : "") +
    (pointExplainHtml(point) || ("<p>" + escapeHtml(tipText()) + "</p>")) + songRoleHtml(point) + lyric +
    independentNote + mic +
    '<textarea id="sentence" rows="3" placeholder="' + (speaking ? "开口转写会出现在这里，也可以改打字。" : "用这个办法写一句你自己的完整话。") + '">' +
    escapeHtml(passDraft) + "</textarea>" + bits.hear +
    '<button class="chip on wide" id="check-sentence" type="button">交一版，看过没过</button>' +
    '<div id="sentence-result"></div>' + more + "</div>" + bits.frameBlock;
}

function renderExplainTask(point) {
  var rec = getProgress(point.id);
  var kind = pointKind(point);
  var bits = hearAndFrame(point, rec, kind);
  var independentNote = waitingIndependent || rec.framePassed
    ? "<p>架子已经过了。现在请再独立说明一次，才能记掌握或暂过。</p>"
    : "";
  var body;
  if (!point.lyricLine) {
    body = '<p class="miss">暂无对应歌词，不能点歌词。请用自己的句子，再加上一句说明来练。</p>' +
      '<textarea id="sentence" rows="3" placeholder="先写一句你自己的完整话。">' + escapeHtml(passDraft) + "</textarea>" +
      '<textarea id="explain-text" rows="3" placeholder="再用自己的话说明为什么。">' + escapeHtml(explainDraft) + "</textarea>";
  } else {
    body = '<p>请点出承载这个现象的那几个词。点错了会先挡住，对了再说明为什么。</p>' +
      '<p class="pick-line lyric">' + tokenButtons(point.lyricLine, pickFrom, pickTo) + "</p>" +
      (point.lyricTranslation ? "<small>" + escapeHtml(point.lyricTranslation) + "</small>" : "") +
      '<button class="chip wide" id="clear-pick" type="button">重选</button>' +
      '<button class="chip on wide" id="confirm-pick" type="button">就点这几个词</button>';
    if (pickReady) {
      body += '<p>点对了。请再用自己的话说明为什么。</p>' +
        '<textarea id="explain-text" rows="3" placeholder="用自己的话说明为什么。">' + escapeHtml(explainDraft) + "</textarea>" +
        '<button class="chip on wide" id="check-explain" type="button">交说明，看过没过</button>';
    }
  }
  if (!point.lyricLine) {
    body += '<button class="chip on wide" id="check-explain" type="button">交说明，看过没过</button>';
  }
  stage.innerHTML = '<button class="chip" id="back-hub" type="button">返回过关</button>' +
    '<div class="card"><div class="row-head"><b>指出并说明</b>' + badgeHtml(rec.status) +
    '</div><p class="small">' + escapeHtml(point.oralName) + "</p>" +
    (pointExplainHtml(point) || ("<p>" + escapeHtml(tipText()) + "</p>")) + songRoleHtml(point) +
    independentNote + body + bits.hear +
    '<div id="sentence-result"></div></div>' + bits.frameBlock;
}

function renderRewriteTask(point) {
  var rec = getProgress(point.id);
  var kind = pointKind(point);
  var bits = hearAndFrame(point, rec, kind);
  if (!point.lyricLine) {
    stage.innerHTML = '<button class="chip" id="back-hub" type="button">返回过关</button>' +
      '<div class="card"><b>改一句歌词</b><p class="miss">暂无对应歌词，不能改歌词。请用自己的句子来练，不编造歌词。</p></div>';
    return;
  }
  var independentNote = waitingIndependent || rec.framePassed
    ? "<p>架子已经过了。现在请再独立改一句，才能记掌握或暂过。</p>"
    : "";
  stage.innerHTML = '<button class="chip" id="back-hub" type="button">返回过关</button>' +
    '<div class="card"><div class="row-head"><b>改一句歌词</b>' + badgeHtml(rec.status) +
    '</div><p class="small">' + escapeHtml(point.oralName) + "</p>" +
    (pointExplainHtml(point) || ("<p>" + escapeHtml(tipText()) + "</p>")) + songRoleHtml(point) +
    '<p>只改一两个词，必须保住这个语法现象，然后交上去。也可以先读出来再改字。</p>' +
    '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + "</b><small>" +
    escapeHtml(point.lyricTranslation || "") + "</small></p>" + independentNote +
    '<textarea id="rewrite-text" rows="3" placeholder="只改一两个词，把这个语法留下来。">' +
    escapeHtml(rewriteDraft || point.lyricLine) + "</textarea>" + bits.hear +
    '<button class="chip wide" id="start-mic" type="button">' + (listeningMic ? "停下来" : "读出来（转成文字）") + "</button>" +
    '<p id="speech-note">' + escapeHtml(speechNote || "先不打发音分。没有开口时，直接改字交上去即可。") + "</p>" +
    '<button class="chip on wide" id="check-rewrite" type="button">交这一句，看过没过</button>' +
    '<div id="sentence-result"></div></div>' + bits.frameBlock;
}

function renderReadMarkTask(point) {
  var rec = getProgress(point.id);
  var items = matchingReadings(point);
  if (!items.length) {
    stage.innerHTML = '<button class="chip" id="back-hub" type="button">返回过关</button>' +
      '<div class="card"><b>阅读里标出同一现象</b><p>这首歌还没有配上同一现象的专四长句，不编造课文。</p></div>';
    return;
  }
  var item = items[0];
  var sentence = item.text || "";
  var body = '<p>掌握之后，请在这一句长句里点出同一个现象，并说明它在这句话里起什么作用。没有配套长句的点不会编课文。</p>' +
    '<p class="pick-line lyric">' + tokenButtons(sentence, pickFrom, pickTo) + "</p>" +
    '<button class="chip wide" id="clear-pick" type="button">重选</button>' +
    '<button class="chip on wide" id="confirm-read-pick" type="button">就点这几个词</button>';
  if (pickReady) {
    body += '<p>请说明它在这句话里起什么作用。</p>' +
      '<textarea id="explain-text" rows="3" placeholder="用自己的话说明它在这句话里起什么作用。">' +
      escapeHtml(explainDraft) + "</textarea>" +
      '<button class="chip on wide" id="check-read" type="button">交说明，看过没过</button>';
  }
  stage.innerHTML = '<button class="chip" id="back-hub" type="button">返回过关</button>' +
    '<div class="card"><div class="row-head"><b>阅读里标出同一现象</b>' + badgeHtml(rec.status) +
    '</div><p class="small">' + escapeHtml(point.oralName) + " · " + escapeHtml(item.year || "") +
    "</p>" + (pointExplainHtml(point) || ("<p>" + escapeHtml(tipText()) + "</p>")) + body +
    '<div id="sentence-result"></div></div>';
}

function renderBuilder() {
  saveOpenDrafts();
  var attached = pointsForSong((song() && song().title) || "");
  var point = currentPoint();
  if (attached.length && !practicePointId && attached.length > 1 && !point) {
    var picker = attached.map(function (item) {
      return '<button class="line" data-practice="' + escapeHtml(item.id) + '" type="button"><b>' +
        escapeHtml(item.oralName) + "</b><small>" + escapeHtml(item.bookName || "") + " · " +
        statusLabel(getProgress(item.id).status) + "</small></button>";
    }).join("");
    stage.innerHTML = '<div class="card"><b>换成你自己的事</b><p>每次只过当前这一条。请先选一条细点。</p></div>' + picker;
    return;
  }
  if (!practicePointId && point) practicePointId = point.id;
  if (!point) {
    stage.innerHTML = '<div class="card"><b>换成你自己的事</b><p>' + tipText() +
      "</p><p>用这个办法写一句你自己的完整话。看完、听完、填空做对都不记掌握。</p>" +
      '<textarea id="sentence" rows="3" placeholder="写成完整的一句。">' + escapeHtml(passDraft) +
      '</textarea><button class="chip on wide" id="check-sentence" type="button">交一版，看过没过</button>' +
      '<div id="sentence-result"></div></div>';
    return;
  }
  if (!practiceTask) {
    renderPracticeHub(point, attached);
    return;
  }
  if (practiceTask === "explain") {
    renderExplainTask(point);
    return;
  }
  if (practiceTask === "rewrite") {
    renderRewriteTask(point);
    return;
  }
  if (practiceTask === "read") {
    renderReadMarkTask(point);
    return;
  }
  renderOwnTask(point, attached);
}

function currentPickLine() {
  var point = currentPoint();
  if (practiceTask === "read") {
    var items = matchingReadings(point);
    return (items[0] && items[0].text) || "";
  }
  return (point && point.lyricLine) || "";
}

function onTokenClick(index) {
  var n = Number(index);
  if (pickFrom < 0) {
    pickFrom = n;
    pickTo = n;
  } else if (pickFrom === pickTo && n !== pickFrom) {
    pickTo = n;
  } else {
    pickFrom = n;
    pickTo = n;
  }
  pickReady = false;
  renderBuilder();
}

function confirmSelection(forRead) {
  var point = currentPoint();
  var line = currentPickLine();
  var selected = selectedTokens(line, pickFrom, pickTo);
  var resultBox = document.getElementById("sentence-result") || { innerHTML: "" };
  var judged;
  if (forRead) {
    var item = matchingReadings(point)[0] || {};
    judged = judgeReadingSelection(selected, item.mark || "", item.text || "");
  } else {
    judged = judgePointSelection(selected, point && point.oralName, point && point.say, point && point.lyricLine);
  }
  if (!judged.machinePassed) {
    pickReady = false;
    var box = document.getElementById("sentence-result");
    if (box) box.innerHTML = '<div class="verdict fail"><b>这一点还没点到</b><p>' + escapeHtml(judged.note) + "</p></div>";
    else renderBuilder();
    var after = document.getElementById("sentence-result");
    if (!after) {
      renderBuilder();
      after = document.getElementById("sentence-result");
    }
    if (after) after.innerHTML = '<div class="verdict fail"><b>这一点还没点到</b><p>' + escapeHtml(judged.note) + "</p></div>";
    return;
  }
  pickReady = true;
  renderBuilder();
}

function localTaskGate(task, point, payload) {
  var oral = (point && point.oralName) || focusName();
  var say = (point && point.say) || tipText();
  var lyric = (point && point.lyricLine) || "";
  if (task === "rewrite") {
    var rewritten = judgeRewrite(lyric, payload.studentSentence, oral, say);
    return {
      machinePassed: rewritten.machinePassed,
      aiPassed: null,
      aiAvailable: false,
      verdict: combineVerdict(rewritten.machinePassed, null, false),
      note: rewritten.note,
      followUp: rewritten.machinePassed ? "" : rewritten.note,
      frame: rewritten.frame,
      kind: rewritten.kind
    };
  }
  if (task === "explain") {
    var selected = payload.selectedText || "";
    var explanation = payload.explanation || "";
    var kind = pointKind(point);
    var pick = lyric
      ? judgePointSelection(selected, oral, say, lyric)
      : { machinePassed: true, note: "", kind: kind, tip: say, frame: explainFrame(kind) };
    var own = !lyric && payload.studentSentence
      ? judgePointSentence(payload.studentSentence, oral, say, "")
      : { machinePassed: true, note: "", kind: kind, tip: say, frame: explainFrame(kind) };
    var explained = judgeExplanationText(explanation, pick.kind || own.kind || kind);
    var passed = pick.machinePassed && own.machinePassed && explained.passed;
    var note = !pick.machinePassed ? pick.note : (!own.machinePassed ? own.note : explained.note);
    return {
      machinePassed: passed,
      aiPassed: null,
      aiAvailable: false,
      verdict: combineVerdict(passed, null, false),
      note: note,
      followUp: passed ? "" : defaultFollowUp(kind),
      frame: explainFrame(kind),
      kind: kind
    };
  }
  if (task === "read-mark") {
    var item = matchingReadings(point)[0] || {};
    var readPick = judgeReadingSelection(payload.selectedText || "", item.mark || "", item.text || "");
    var readExp = judgeExplanationText(payload.explanation || "", pointKind(point));
    var readPass = readPick.machinePassed && readExp.passed;
    return {
      machinePassed: readPass,
      aiPassed: null,
      aiAvailable: false,
      verdict: combineVerdict(readPass, null, false),
      note: !readPick.machinePassed ? readPick.note : readExp.note,
      followUp: readPass ? "" : defaultFollowUp(pointKind(point)),
      frame: explainFrame(pointKind(point)),
      kind: pointKind(point)
    };
  }
  return localGate(payload.studentSentence || "", point);
}

function requestGate(sentence, point, extras) {
  extras = extras || {};
  var task = extras.task || "own";
  var payload = {
    studentSentence: sentence || extras.studentSentence || "",
    explanation: extras.explanation || "",
    selectedText: extras.selectedText || "",
    readingSentence: extras.readingSentence || "",
    readingMark: extras.readingMark || ""
  };
  var local = localTaskGate(task, point, payload);
  var canFetch = location.protocol === "http:" || location.protocol === "https:";
  if (!canFetch) return Promise.resolve(local);
  return fetch("/api/check-sentence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      passGate: true,
      task: task,
      studentSentence: payload.studentSentence,
      explanation: payload.explanation,
      selectedText: payload.selectedText,
      readingSentence: payload.readingSentence,
      readingMark: payload.readingMark,
      oralName: (point && point.oralName) || focusName() || "",
      say: (point && point.say) || tipText() || "",
      lyricLine: (point && point.lyricLine) || ""
    })
  }).then(function (res) {
    if (!res.ok) throw new Error("bad");
    return res.json();
  }).then(function (data) {
    if (!data || !data.verdict) throw new Error("empty");
    return data;
  }).catch(function () {
    return local;
  });
}

function checkPass(isFrameOnly) {
  var input = document.getElementById(isFrameOnly ? "frame-sentence" : "sentence");
  var result = document.getElementById("sentence-result");
  if (!input || !result) return;
  var text = input.value.trim();
  if (!text) {
    result.innerHTML = "<p>先把你写的英文句子打进上面那个框，再交一版。</p>";
    return;
  }
  if (isFrameOnly) frameDraft = text;
  else passDraft = text;
  result.innerHTML = "<p>在看有没有用对…</p>";
  var point = currentPoint();
  requestGate(text, point, { task: "own" }).then(function (data) {
    applyVerdict(point && point.id, text, data, isFrameOnly);
  });
}

function checkExplain(isFrameOnly) {
  var point = currentPoint();
  var result = document.getElementById("sentence-result");
  var explainBox = document.getElementById(isFrameOnly ? "frame-sentence" : "explain-text");
  var sentenceBox = document.getElementById("sentence");
  if (!result) return;
  var explanation = explainBox ? explainBox.value.trim() : "";
  var own = sentenceBox ? sentenceBox.value.trim() : passDraft;
  var selected = selectedTokens((point && point.lyricLine) || "", pickFrom, pickTo);
  if (point && point.lyricLine && !pickReady && !isFrameOnly) {
    result.innerHTML = "<p>请先点对承载这个现象的那几个词，再交说明。</p>";
    return;
  }
  if (!explanation) {
    result.innerHTML = "<p>请再用自己的话说明为什么。</p>";
    return;
  }
  if (isFrameOnly) frameDraft = explanation;
  else explainDraft = explanation;
  result.innerHTML = "<p>在看有没有讲到点子上…</p>";
  requestGate(own, point, { task: "explain", explanation: explanation, selectedText: selected, studentSentence: own }).then(function (data) {
    applyVerdict(point && point.id, explanation, data, isFrameOnly);
  });
}

function checkRewrite(isFrameOnly) {
  var point = currentPoint();
  var result = document.getElementById("sentence-result");
  var box = document.getElementById(isFrameOnly ? "frame-sentence" : "rewrite-text");
  if (!result || !box) return;
  var text = box.value.trim();
  if (!text) {
    result.innerHTML = "<p>请只改一两个词，再交上来。</p>";
    return;
  }
  if (isFrameOnly) frameDraft = text;
  else rewriteDraft = text;
  result.innerHTML = "<p>在看这个语法还在不在…</p>";
  requestGate(text, point, { task: "rewrite", studentSentence: text }).then(function (data) {
    applyVerdict(point && point.id, text, data, isFrameOnly);
  });
}

function checkReadMark() {
  var point = currentPoint();
  var result = document.getElementById("sentence-result");
  var explainBox = document.getElementById("explain-text");
  if (!result) return;
  if (!pickReady) {
    result.innerHTML = "<p>请先点出同一个现象的那几个词。</p>";
    return;
  }
  var explanation = explainBox ? explainBox.value.trim() : "";
  if (!explanation) {
    result.innerHTML = "<p>请说明它在这句话里起什么作用。</p>";
    return;
  }
  explainDraft = explanation;
  var item = matchingReadings(point)[0] || {};
  var selected = selectedTokens(item.text || "", pickFrom, pickTo);
  result.innerHTML = "<p>在看是不是同一个现象…</p>";
  requestGate("", point, {
    task: "read-mark",
    explanation: explanation,
    selectedText: selected,
    readingSentence: item.text || "",
    readingMark: item.mark || ""
  }).then(function (data) {
    applyVerdict(point && point.id, explanation, data, false);
  });
}

function toggleMic() {
  if (listeningMic && window._lgRec) {
    try { window._lgRec.stop(); } catch (error) {}
    listeningMic = false;
    speechNote = "已停。可以改打字，或再开口一次。";
    var note = document.getElementById("speech-note");
    var btn = document.getElementById("start-mic");
    if (note) note.textContent = speechNote;
    if (btn) btn.textContent = practiceTask === "rewrite" ? "读出来（转成文字）" : "对着手机说";
    return;
  }
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    speechNote = "这台手机不能开口，请改打字。没网时也可以先记暂过。";
    var missing = document.getElementById("speech-note");
    if (missing) missing.textContent = speechNote;
    else {
      renderBuilder();
    }
    return;
  }
  var rec = new Rec();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = function (event) {
    var text = "";
    for (var i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
    if (practiceTask === "rewrite") {
      rewriteDraft = text;
      var rewriteBox = document.getElementById("rewrite-text");
      if (rewriteBox) rewriteBox.value = text;
    } else {
      passDraft = text;
      var box = document.getElementById("sentence");
      if (box) box.value = text;
    }
  };
  rec.onerror = function (event) {
    listeningMic = false;
    speechNote = event.error === "not-allowed"
      ? "没有麦克风权限，请改打字。"
      : "没听清或开口不可用，请改打字，或再试一次。";
    var errNote = document.getElementById("speech-note");
    var errBtn = document.getElementById("start-mic");
    if (errNote) errNote.textContent = speechNote;
    if (errBtn) errBtn.textContent = practiceTask === "rewrite" ? "读出来（转成文字）" : "对着手机说";
  };
  rec.onend = function () {
    listeningMic = false;
    var hasText = practiceTask === "rewrite" ? rewriteDraft : passDraft;
    speechNote = hasText
      ? "已转成文字。先不打发音分，只看语法用对没有。可以改字再交。"
      : "没听到句子。请再开口一次，或改打字。";
    var endNote = document.getElementById("speech-note");
    var endBtn = document.getElementById("start-mic");
    if (endNote) endNote.textContent = speechNote;
    if (endBtn) endBtn.textContent = practiceTask === "rewrite" ? "读出来（转成文字）" : "对着手机说";
  };
  try {
    listeningMic = true;
    speechNote = "请对着手机说话…";
    window._lgRec = rec;
    var startNote = document.getElementById("speech-note");
    var startBtn = document.getElementById("start-mic");
    if (startNote) startNote.textContent = speechNote;
    if (startBtn) startBtn.textContent = "停下来";
    rec.start();
  } catch (error) {
    listeningMic = false;
    speechNote = "开口没打开，请改打字。";
    var failNote = document.getElementById("speech-note");
    if (failNote) failNote.textContent = speechNote;
  }
}



function badgesForSync() {
  var items = [];
  Object.keys(badgeMap || {}).forEach(function (id) {
    var badge = normalizeBadge(Object.assign({ id: id }, badgeMap[id]));
    if (badge) items.push(badge);
  });
  return items;
}

function catchUpBadges() {
  if (typeof liveQuestLectures !== "function" || typeof earnedBadgeIds !== "function") return;
  var earned = earnedBadgeIds(liveQuestLectures());
  var now = Date.now();
  var changed = false;
  earned.forEach(function (id) {
    if (!badgeMap[id]) {
      badgeMap[id] = { id: id, earnedAt: now, dirty: true };
      changed = true;
    }
  });
  if (changed) {
    persistBadges();
    scheduleSync();
  }
}

function syncBadgesFromLectures(beforeLectures) {
  var after = liveQuestLectures();
  var added = newlyEarnedBadges(beforeLectures, after);
  var now = Date.now();
  added.forEach(function (badge) {
    if (!badgeMap[badge.id]) badgeMap[badge.id] = { id: badge.id, earnedAt: now, dirty: true };
  });
  catchUpBadges();
  var cleared = findJustClearedLecture(beforeLectures, after);
  if (cleared) {
    var copy = lectureClearCopy(cleared, after);
    questClear = { lectureNo: cleared.no, copy: copy, badges: added, nextLectureNo: copy.nextLectureNo };
    questJustUnlocked = copy.nextLectureNo || 0;
  }
  if (added.length) persistBadges();
  return { added: added, cleared: cleared };
}

function lectureClearExtraHtml(copy, badges) {
  var html = "<p>" + escapeHtml(copy.body) + "</p>";
  if (badges && badges.length) {
    html += "<p>获得勋章：" + escapeHtml(badges.map(function (item) { return item.title; }).join("、")) + "</p>";
  }
  html += '<div class="quest-actions">';
  if (copy.nextLectureNo) {
    html += '<button class="chip on wide" data-quest-next-lec="' + copy.nextLectureNo + '" type="button">去下一讲</button>';
  }
  html += '<button class="chip wide" data-quest-badges="1" type="button">看勋章</button>';
  html += '<button class="chip wide" id="to-map-main" type="button">返回地图</button>';
  html += "</div>";
  return html;
}

function lectureClearCardHtml() {
  if (!questClear || !questClear.copy) return "";
  return '<div class="verdict pass lecture-clear"><b>' + escapeHtml(questClear.copy.title) + "</b>" +
    lectureClearExtraHtml(questClear.copy, questClear.badges || []) + "</div>";
}

function renderQuestBadges() {
  var lectures = liveQuestLectures();
  var catalog = badgeCatalog(lectures);
  var earned = earnedBadgeIds(lectures);
  var have = {};
  earned.forEach(function (id) { have[id] = true; });
  Object.keys(badgeMap || {}).forEach(function (id) { have[id] = true; });
  var html = '<div class="quest-actions"><button class="chip" id="back-quest-map" type="button">返回地图</button></div>';
  html += '<p class="map-intro">过完一讲，或过完一组已开放的讲，会记下轻量勋章。挂在登录账号上，没网先记在手机里。没有连续打卡。</p>';
  var count = 0;
  catalog.forEach(function (badge) { if (have[badge.id]) count += 1; });
  html += "<p class=\"map-intro\">已获得 " + count + " 枚勋章。</p>";
  catalog.forEach(function (badge) {
    if (!have[badge.id]) return;
    html += '<div class="medal"><b>' + escapeHtml(badge.title) + "</b><small>" + escapeHtml(badge.detail || "") + "</small></div>";
  });
  if (!count) html += '<div class="card"><p>还没有勋章。过完一讲就会得到第一枚。</p></div>';
  stage.innerHTML = html;
}

function liveQuestLectures() {
  return withStatuses(buildLectures(BOOK, SONGS, POINTS), function (id) {
    return getProgress(id).status;
  });
}

function paintQuestHeader() {
  var title = document.getElementById("title");
  var pointEl = document.getElementById("point");
  if (!title || !pointEl) return;
  if (questView === "badges") {
    title.textContent = "勋章";
    pointEl.textContent = "过完一讲或一组讲就会记下";
    paintExplainChrome();
    return;
  }
  if (!questLec) {
    title.textContent = "四十讲关卡";
    pointEl.textContent = "过了才亮下一关。先听、先看不记掌握。";
    paintExplainChrome();
    return;
  }
  var lec = lectureByNo(liveQuestLectures(), questLec);
  if (!lec) {
    title.textContent = "四十讲关卡";
    pointEl.textContent = "";
    paintExplainChrome();
    return;
  }
  title.textContent = "第" + lec.no + "讲 " + (lec.title || "");
  if (!lec.open) pointEl.textContent = "暂未开放";
  else pointEl.textContent = lec.songTitle ? ("《" + lec.songTitle + "》") : "先听、先看不记掌握";
  paintExplainChrome();
}

function questNavHtml() {
  var html = '<div class="quest-actions">';
  html += '<button class="chip" id="back-quest-map" type="button">返回地图</button>';
  if (questPoint) html += '<button class="chip" id="back-quest-lec" type="button">返回这一讲</button>';
  html += "</div>";
  return html;
}

function openQuestLecture(no) {
  questLec = String(no || "");
  questPoint = "";
  questHint = "";
  mode = "map";
  var lec = lectureByNo(liveQuestLectures(), questLec);
  if (lec && lec.songTitle) {
    var next = findSongIndex(lec.songTitle);
    if (next >= 0 && next !== index) {
      keepPractice = true;
      loadSong(next, false);
      return;
    }
  }
  render();
}

function renderQuest() {
  paintQuestHeader();
  var lectures = liveQuestLectures();
  var hint = questHint ? ('<p class="lock-note">' + escapeHtml(questHint) + "</p>") : "";
  if (questView === "badges") {
    renderQuestBadges();
    return;
  }
  if (questPoint) {
    renderQuestStage(lectureByNo(lectures, questLec), questPoint, hint);
    return;
  }
  if (questLec) {
    renderQuestLecture(lectureByNo(lectures, questLec), lectures, hint);
    return;
  }
  renderQuestMap(lectures, hint);
}

function renderQuestMap(lectures, hint) {
  var current = currentLectureNo(lectures);
  var earnedCount = earnedBadgeIds(lectures).length;
  var html = lectureClearCardHtml();
  html += '<p class="map-intro">一讲一大关。点进去可以先听、先看。要亮灯，必须过关。细点多的讲次，过完主线即可点亮本讲、解锁下一讲；其余是支线。暂过可以先往下走。后面的讲看得见，也可以先进去听，但不记掌握。</p>' + hint;
  html += '<div class="quest-actions"><button class="chip" data-quest-badges="1" type="button">勋章' +
    (earnedCount ? " · " + earnedCount : "") + "</button></div>";
  html += '<div class="map-path">';
  lectures.forEach(function (lec) {
    var light = lec.light || "unseen";
    var cls = "map-node " + light;
    if (current && Number(lec.no) === current) cls += " current";
    if (questClear && Number(lec.no) === Number(questClear.lectureNo)) cls += " just-cleared";
    if (questJustUnlocked && Number(lec.no) === Number(questJustUnlocked)) cls += " just-lit";
    var songLine = lec.open ? (lec.songTitle ? ("《" + lec.songTitle + "》") : "") : "暂未开放";
    var mark = lectureLightLabel(light);
    var mainTotal = 0, mainMastered = 0, sideTotal = 0, sideMastered = 0;
    (lec.points || []).forEach(function (point, i) {
      var status = (lec.statuses || [])[i] || "unseen";
      if (point && point.mainline === false) {
        sideTotal += 1;
        if (status === "mastered") sideMastered += 1;
      } else {
        mainTotal += 1;
        if (status === "mastered") mainMastered += 1;
      }
    });
    var count = "";
    if (lec.open && lec.points.length) {
      count = "主线 " + mainMastered + " / " + mainTotal + " 掌握";
      if (sideTotal) count += " · 支线 " + sideMastered + " / " + sideTotal;
    }
    html += '<button class="' + cls + '" data-quest-lec="' + lec.no + '" type="button">';
    html += '<span class="lamp" aria-hidden="true"></span>';
    html += "<b>第" + lec.no + "讲 " + escapeHtml(lec.title || "") + "</b>";
    html += "<small>" + escapeHtml(songLine) + "</small>";
    html += '<span class="mark">' + escapeHtml(mark + (count ? " · " + count : "")) + "</span>";
    html += "</button>";
  });
  html += "</div>";
  stage.innerHTML = html;
  var currentNode = stage.querySelector(".map-node.just-lit") || stage.querySelector(".map-node.just-cleared") || stage.querySelector(".map-node.current");
  if (currentNode && currentNode.scrollIntoView) currentNode.scrollIntoView({ block: "center" });
}

function renderQuestLecture(lec, lectures, hint) {
  if (!lec) {
    questLec = "";
    renderQuestMap(lectures, hint);
    return;
  }
  var html = questNavHtml() + hint;
  if (questClear && Number(questClear.lectureNo) === Number(lec.no)) html += lectureClearCardHtml();
  if (!lec.open) {
    html += '<div class="card"><b>第' + lec.no + "讲 " + escapeHtml(lec.title || "") +
      "</b><p>这一讲暂未开放。还没有合适的歌，不编造歌曲。</p></div>";
    stage.innerHTML = html;
    return;
  }
  var unlocked = lecturePassUnlocked(lec.no, lectures);
  html += '<div class="card"><b>' + (lec.songTitle ? ("《" + escapeHtml(lec.songTitle) + "》") : escapeHtml(lec.title || "")) +
    '</b><p class="small"><span class="role-tag">本家主打歌</span></p>' +
    '<p class="map-intro">可以先听这首本家主打歌，感到口气，再看讲解。客串例句只听一小段，不展开别的歌的世界。要亮这一关，必须用现有的过关练习。细点多的讲次，过完主线即可点亮本讲。</p>';
  var songIndex = lec.songTitle ? findSongIndex(lec.songTitle) : -1;
  if (songIndex >= 0) {
    html += '<div class="quest-actions">';
    html += '<button class="chip on" data-quest-listen-song="' + songIndex + '" type="button">去听这首歌</button>';
    html += '<button class="chip" data-quest-grammar="' + songIndex + '" type="button">看讲解</button>';
    html += "</div>";
  }
  html += "</div>";
  (lec.points || []).forEach(function (item, i) {
    var status = (lec.statuses || [])[i] || "unseen";
    var passOn = pointPassUnlocked(i, lec.statuses, unlocked, lec.points);
    var rec = getProgress(item.id);
    var cls = "stage-item " + status;
    if (item.mainline === false) cls += " side";
    if (rec.needsMakeup) cls += " makeup";
    if (passOn && status !== "mastered") cls += " current";
    if (!passOn && status !== "mastered") cls += " locked";
    var missing = item.song ? "" : "暂无对应歌词 · ";
    var track = item.mainline === false ? "支线 · " : ((lec.points || []).length > 10 ? "主线 · " : "");
    var role = "";
    if (typeof isCameoPoint === "function" && isCameoPoint(item, lec.no)) role = "客串例句 · ";
    else if (item.song) role = "本家主打歌 · ";
    var lockText = rec.needsMakeup ? "复核未过 · 请补练" : (passOn ? lectureLightLabel(status === "provisional" ? "provisional" : status) : "先过当前关");
    html += '<button class="' + cls + '" data-quest-point="' + escapeHtml(item.id) + '" type="button">';
    html += '<span class="lamp" aria-hidden="true"></span>';
    html += "<b>" + escapeHtml(item.oralName || item.bookName || "细点") + "</b>";
    html += "<small>" + escapeHtml(item.lyricLine || "暂无对应歌词。请用自己的句子来练，不编造歌词。") + "</small>";
    html += '<span class="mark">' + escapeHtml(track + role + missing + lockText) + "</span>";
    html += "</button>";
  });
  stage.innerHTML = html;
}

function renderQuestStage(lec, pointId, hint) {
  var lectures = liveQuestLectures();
  lec = lectureByNo(lectures, lec && lec.no) || lec;
  if (!lec) {
    questPoint = "";
    renderQuestMap(lectures, hint);
    return;
  }
  var point = null;
  var idx = -1;
  (lec.points || []).forEach(function (item, i) {
    if (item.id === pointId) { point = item; idx = i; }
  });
  if (!point) {
    questPoint = "";
    renderQuestLecture(lec, lectures, hint);
    return;
  }
  var unlocked = lecturePassUnlocked(lec.no, lectures);
  var passOn = pointPassUnlocked(idx, lec.statuses, unlocked, lec.points);
  var rec = getProgress(point.id);
  var status = (lec.statuses || [])[idx] || rec.status;
  var html = questNavHtml() + hint;
  html += '<div class="card"><div class="row-head"><b>' + escapeHtml(point.oralName || "") + "</b>" +
    badgeHtml(status, "", rec) + "</div>";
  html += '<p class="small">' + escapeHtml(point.bookName || "") +
    (point.mainline === false ? " · 支线" : "") + "</p>";
  html += pointExplainHtml(point) + songRoleHtml(point, lec.no);
  if (rec.needsMakeup) html += '<p class="lock-note">复核未过，请补练这一关。先不一定挡住后面的关。</p>';
  if (point.lyricLine) {
    html += '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + "</b><small>" +
      escapeHtml(point.lyricTranslation || "") + "</small></p>";
  } else {
    html += '<p class="miss">暂无对应歌词。请用自己的句子来练，不编造歌词。</p>';
  }
  html += '<div class="quest-actions">';
  html += pointHearButton(point, typeof isCameoPoint === "function" && isCameoPoint(point, lec.no) ? "听这一小段" : "去听这句");
  if (passOn) {
    html += '<button class="chip on wide" data-practice="' + escapeHtml(point.id) + '" type="button">过关</button>';
  } else {
    html += '<button class="chip wide" data-quest-locked="' + escapeHtml(point.id) + '" type="button">过关（先过当前关）</button>';
    html += '<p class="lock-note">后面的关看得见，也可以先听、先看，但不记掌握。要亮灯，必须先过当前这一关。</p>';
  }
  html += "</div></div>";
  html += explainEditorHtml(point, lec.no);
  stage.innerHTML = html;
}

function handleQuestClick(event) {
  var cameo = event.target.closest("[data-cameo-clip]");
  if (cameo) {
    var clipPoint = pointById(cameo.getAttribute("data-cameo-clip") || "");
    if (clipPoint) playCameoClip(clipPoint);
    markHeard(cameo.getAttribute("data-heard-point") || (clipPoint && clipPoint.id) || "");
    return true;
  }
  var qnextLec = event.target.closest("[data-quest-next-lec]");
  if (qnextLec) {
    questView = "";
    questClear = null;
    openQuestLecture(qnextLec.getAttribute("data-quest-next-lec"));
    return true;
  }
  if (event.target.closest("[data-quest-badges]")) {
    mode = "map";
    questView = "badges";
    questLec = "";
    questPoint = "";
    questHint = "";
    render();
    return true;
  }
  var qnext = event.target.closest("[data-quest-next]");
  if (qnext) {
    questLec = qnext.getAttribute("data-quest-lec") || questLec;
    questPoint = qnext.getAttribute("data-quest-next") || "";
    questHint = "";
    startPractice(questPoint);
    return true;
  }
  var qlec = event.target.closest("[data-quest-lec]");
  if (qlec) {
    openQuestLecture(qlec.getAttribute("data-quest-lec"));
    return true;
  }
  var qpoint = event.target.closest("[data-quest-point]");
  if (qpoint) {
    questPoint = qpoint.getAttribute("data-quest-point") || "";
    questHint = "";
    mode = "map";
    render();
    return true;
  }
  var qlisten = event.target.closest("[data-quest-listen-song]");
  if (qlisten) {
    var sidx = Number(qlisten.getAttribute("data-quest-listen-song"));
    var line = qlisten.getAttribute("data-line");
    var lineIndex = (line === null || line === undefined || line === "") ? -1 : Number(line);
    goListen(sidx, lineIndex);
    return true;
  }
  var qgrammar = event.target.closest("[data-quest-grammar]");
  if (qgrammar) {
    var gidx = Number(qgrammar.getAttribute("data-quest-grammar"));
    if (gidx >= 0 && gidx !== index) {
      keepPractice = true;
      mode = "grammar";
      loadSong(gidx, false);
    } else {
      mode = "grammar";
      render();
    }
    return true;
  }
  var qlocked = event.target.closest("[data-quest-locked]");
  if (qlocked) {
    questHint = "先过当前关，才能亮这一关的过关路径。仍可以先听、先看，但不记掌握。";
    render();
    return true;
  }
  if (event.target.id === "back-quest-map" || event.target.id === "to-map-main") {
    mode = "map";
    questLec = "";
    questPoint = "";
    questHint = "";
    questView = "";
    render();
    return true;
  }
  if (event.target.id === "back-quest-lec") {
    mode = "map";
    questPoint = "";
    questHint = "";
    if (!questLec) {
      var cur = currentPoint();
      if (cur && cur.lecture) questLec = String(cur.lecture);
    }
    render();
    return true;
  }
  return false;
}

function handlePassClick(event) {
  if (handleQuestClick(event)) return true;
  var practice = event.target.closest("[data-practice]");
  if (practice) {
    startPractice(practice.getAttribute("data-practice") || "");
    return true;
  }
  var taskBtn = event.target.closest("[data-task]");
  if (taskBtn) {
    practiceTask = taskBtn.getAttribute("data-task") || "";
    pickFrom = -1;
    pickTo = -1;
    pickReady = false;
    speechNote = "";
    waitingIndependent = Boolean(practicePointId && getProgress(practicePointId).framePassed);
    renderBuilder();
    return true;
  }
  if (event.target.id === "back-hub") {
    backToHub();
    return true;
  }
  if (event.target.id === "pick-point") {
    practicePointId = "";
    practiceTask = "";
    renderBuilder();
    return true;
  }
  if (event.target.id === "check-frame") {
    if (practiceTask === "explain") checkExplain(true);
    else if (practiceTask === "rewrite") checkRewrite(true);
    else checkFrame();
    return true;
  }
  if (event.target.id === "check-explain") {
    checkExplain(false);
    return true;
  }
  if (event.target.id === "check-rewrite") {
    checkRewrite(false);
    return true;
  }
  if (event.target.id === "check-read") {
    checkReadMark();
    return true;
  }
  if (event.target.id === "confirm-pick") {
    confirmSelection(false);
    return true;
  }
  if (event.target.id === "confirm-read-pick") {
    confirmSelection(true);
    return true;
  }
  if (event.target.id === "clear-pick") {
    pickFrom = -1;
    pickTo = -1;
    pickReady = false;
    renderBuilder();
    return true;
  }
  var tok = event.target.closest("[data-tok]");
  if (tok) {
    onTokenClick(tok.getAttribute("data-tok"));
    return true;
  }
  if (event.target.id === "start-mic") {
    toggleMic();
    return true;
  }
  if (event.target.id === "use-pattern") {
    var point = defaultPracticePoint();
    if (point) startPractice(point.id);
    else {
      mode = "builder";
      render();
    }
    return true;
  }
  var heard = event.target.closest("[data-heard-point]");
  if (heard) markHeard(heard.getAttribute("data-heard-point") || "");
  return false;
}

bootExplainEditor();
var explainToggle = document.getElementById("toggle-explain-editor");
if (explainToggle && !explainToggle.getAttribute("data-explain-bound")) {
  explainToggle.setAttribute("data-explain-bound", "1");
  explainToggle.onclick = function () { toggleExplainEditor(); };
}
