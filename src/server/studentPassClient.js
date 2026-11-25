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
function adoptAccount(userId) {
  if (!userId || userId === progressAccount) return;
  var previous = progressMap;
  var movingLocal = !progressAccount || progressAccount === "local";
  progressAccount = userId;
  loadProgressMap();
  if (movingLocal) progressMap = mergeMaps(previous, progressMap);
  persistProgress();
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
function badgeHtml(status, kind) {
  var label = kind === "list" ? listBadge(status) : statusLabel(status);
  var cls = status || "unseen";
  return '<span class="badge ' + cls + '">' + escapeHtml(label) + '</span>';
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
  if (point && point.song) {
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
    if (typeof render === "function") render();
  }
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
    body: JSON.stringify({ items: items })
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
      if (mode === "builder" || mode === "book" || mode === "grammar") render();
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
        progressMap[row.pointId] = applyProgressEvent(row, verdictEvent("fail", row.pointId, row.lastSentence), Date.now());
      }
      next(i + 1);
    }).catch(function () { next(i + 1); });
  };
  next(0);
}

function renderGrammar() {
  var title = (song() && song().title) || "";
  var attached = pointsForSong(title);
  var intro = '<div class="card"><b>这首歌里出现的语法</b><p>看完、听完都不记掌握。每次只过当前这一条。请写成一句你自己的事。</p></div>';
  if (attached.length) {
    var cards = attached.map(function (point) {
      var lineIndex = findLineIndexIn(lines(), point.lyricLine);
      var hear = lineIndex >= 0
        ? '<button class="chip" data-hear="' + lineIndex + '" data-heard-point="' + escapeHtml(point.id) + '" type="button">听这句</button>'
        : "";
      var line = point.lyricLine
        ? '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
          escapeHtml(point.lyricTranslation || "") + '</small></p>'
        : '<p class="miss">暂无对应歌词</p>';
      var why = point.reason ? '<p>' + escapeHtml(point.reason) + '</p>' : "";
      return '<div class="card"><div class="row-head"><b>' + escapeHtml(point.oralName) +
        '</b>' + badgeHtml(getProgress(point.id).status) + '</div><p class="small">' + escapeHtml(point.bookName || "") +
        (point.lecture ? ' · 第' + point.lecture + '讲' : '') +
        '</p><p>' + escapeHtml(point.say || "") + '</p>' + line + why +
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
        var pts = pointsForLecture(lec.no);
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
  var pts = pointsForLecture(bookLec);
  if (!pts.length && !lec.title) { bookLec = ""; renderBook(); return; }
  if (!bookOpen) {
    var list = '<button class="chip" id="book-up" type="button">全部讲</button>';
    list += '<div class="card"><b>第' + lec.no + '讲 ' + escapeHtml(lec.title || "") +
      '</b><p>这一讲共 ' + pts.length + ' 个细点。暂无对应歌词的条目也会列在这里。看完不算掌握。</p></div>';
    pts.forEach(function (point) {
      var rec = getProgress(point.id);
      var mark = point.song ? " · " + point.song : " · 暂无对应歌词";
      list += '<button class="line" data-point="' + escapeHtml(point.id) + '" type="button"><b>' +
        escapeHtml(point.oralName) + '</b><small>' + badgeHtml(rec.status, "list") + " " +
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
  var body = '<p>' + escapeHtml(point.say || "") + '</p>';
  if (point.song && point.lyricLine) {
    body += '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
      escapeHtml(point.lyricTranslation || "") + '</small></p>';
    if (point.reason) body += '<p>' + escapeHtml(point.reason) + '</p>';
    body += '<p class="small">《' + escapeHtml(point.song) + '》' +
      (point.artist ? " · " + escapeHtml(point.artist) : "") + '</p>';
    var go = listenButton(point.song, point.lyricLine, "去听");
    if (go) go = go.replace('type="button">', 'data-heard-point="' + escapeHtml(point.id) + '" type="button">');
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
    body + exam + lectureExam + '</div>';
}

function showVerdict(result, options) {
  var box = document.getElementById("sentence-result");
  if (!box) return;
  var verdict = result.verdict || "fail";
  var title = verdict === "pass" ? "过了，记下掌握" : verdict === "provisional" ? "暂过，还不算正式掌握" : "还没过";
  var extra = "";
  if (options && options.frameOnly && (verdict === "pass" || verdict === "provisional")) {
    title = "架子这句可以了";
    extra = "<p>还要再独立写一句，才能记掌握或暂过。</p>";
    verdict = "provisional";
  } else if (verdict === "provisional") {
    extra = "<p>没网或还没有核到 AI。离线暂过不算正式掌握，有网再核一次才算。</p>";
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
  var event = verdictEvent(verdict, pointId, sentence, isFrameOnly);
  setProgress(pointId, event);
  if (isFrameOnly && (verdict === "pass" || verdict === "provisional")) {
    waitingIndependent = true;
    frameDraft = "";
  }
  showVerdict(result, { frameOnly: isFrameOnly });
  if (!isFrameOnly) renderBuilder();
  else renderBuilder();
  var again = document.getElementById("sentence-result");
  if (again) showVerdict(result, { frameOnly: isFrameOnly });
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
if (typeof render === "function") render();
if (typeof window !== "undefined") {
  window.addEventListener("online", function () { pullProgress(); });
}
pullProgress();

function handlePassClick(event) {
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
}

function renderPracticeHub(point, attached) {
  var rec = getProgress(point.id);
  var lyric = point.lyricLine
    ? '<p class="lyric"><b>' + escapeHtml(point.lyricLine) + '</b><small>' +
      escapeHtml(point.lyricTranslation || "") + "</small></p>"
    : '<p class="miss">暂无对应歌词。请用自己的句子来练，不编造歌词。</p>';
  var lineIndex = pointLineIndex(point);
  var hear = lineIndex >= 0
    ? '<button class="chip" data-hear="' + lineIndex + '" data-heard-point="' + escapeHtml(point.id) + '" type="button">再听原句</button>'
    : "";
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
  stage.innerHTML = '<div class="card"><div class="row-head"><b>过关</b>' + badgeHtml(rec.status) +
    '</div><p class="small">' + escapeHtml(point.oralName) +
    (point.lecture ? " · 第" + point.lecture + "讲" : "") +
    "</p><p>" + escapeHtml(point.say || tipText()) + "</p>" + lyric +
    "<p class=\"hint\">每次只过当前这一条。看完、听完、填空做对都不记掌握。请选一件事来做。</p>" +
    hear + tasks + more + "</div>";
}

function hearAndFrame(point, rec, kind) {
  var lineIndex = pointLineIndex(point);
  var hear = lineIndex >= 0
    ? '<button class="chip" id="hear-again" data-hear="' + lineIndex + '" data-heard-point="' + escapeHtml(point.id) + '" type="button">再听原句</button>'
    : "";
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
    '<div class="card"><div class="row-head"><b>' + title + "</b>" + badgeHtml(rec.status) +
    '</div><p class="small">' + escapeHtml(point.oralName) +
    (point.lecture ? " · 第" + point.lecture + "讲" : "") +
    "</p><p>" + escapeHtml(speaking ? prompt : (point.say || tipText())) + "</p>" + lyric +
    (speaking ? "<p>" + escapeHtml(point.say || tipText()) + "</p>" : "") +
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
    '</div><p class="small">' + escapeHtml(point.oralName) + "</p><p>" +
    escapeHtml(point.say || tipText()) + "</p>" + independentNote + body + bits.hear +
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
    '</div><p class="small">' + escapeHtml(point.oralName) + "</p><p>" +
    escapeHtml(point.say || tipText()) + '</p><p>只改一两个词，必须保住这个语法现象，然后交上去。也可以先读出来再改字。</p>' +
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
    "</p><p>" + escapeHtml(point.say || tipText()) + "</p>" + body +
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

function handlePassClick(event) {
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
