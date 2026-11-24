// @ts-nocheck
// Progress records for one grammar point, keyed by login account.
// Plain JS so the student page can inline the same file.
// 
export const PROGRESS_STATUS = {
  unseen: "unseen",
  heard: "heard",
  practiced: "practiced",
  provisional: "provisional",
  mastered: "mastered",
};

export const STATUS_RANK = {
  unseen: 0,
  heard: 1,
  practiced: 2,
  provisional: 3,
  mastered: 4,
};

export function statusLabel(status) {
  if (status === PROGRESS_STATUS.heard) return "已听";
  if (status === PROGRESS_STATUS.practiced) return "已练未过";
  if (status === PROGRESS_STATUS.provisional) return "暂过";
  if (status === PROGRESS_STATUS.mastered) return "掌握";
  return "未学";
}

export function listBadge(status) {
  if (status === PROGRESS_STATUS.mastered) return "掌握";
  if (status === PROGRESS_STATUS.practiced || status === PROGRESS_STATUS.provisional) return "已练";
  if (status === PROGRESS_STATUS.heard) return "已听";
  return "未学";
}

export function emptyRecord(pointId) {
  return {
    pointId: String(pointId || ""),
    status: PROGRESS_STATUS.unseen,
    failCount: 0,
    lastSentence: "",
    framePassed: false,
    updatedAt: 0,
    dirty: false,
  };
}

export function normalizeRecord(row) {
  const base = emptyRecord(row && row.pointId);
  if (!row || typeof row !== "object") return base;
  const status = String(row.status || "");
  base.status = STATUS_RANK[status] != null ? status : PROGRESS_STATUS.unseen;
  base.failCount = Math.max(0, Number(row.failCount) || 0);
  base.lastSentence = String(row.lastSentence || "").slice(0, 500);
  base.framePassed = Boolean(row.framePassed);
  base.updatedAt = Number(row.updatedAt) || 0;
  base.dirty = Boolean(row.dirty);
  return base;
}

function bumpTime(record, at) {
  record.updatedAt = at || Date.now();
  record.dirty = true;
  return record;
}

export function applyProgressEvent(current, event, at) {
  const record = normalizeRecord(current || emptyRecord(event && event.pointId));
  const type = event && event.type;
  const sentence = event && event.sentence ? String(event.sentence).slice(0, 500) : "";
  // Watching explanations, listening, or a correct cloze must never mark mastery.
  if (type === "watched" || type === "cloze") {
    return record;
  }
  if (type === "heard") {
    if (STATUS_RANK[record.status] < STATUS_RANK.heard) {
      record.status = PROGRESS_STATUS.heard;
      bumpTime(record, at);
    }
    return record;
  }
  if (type === "fail") {
    if (record.status !== PROGRESS_STATUS.mastered) {
      record.status = PROGRESS_STATUS.practiced;
    }
    record.failCount += 1;
    if (sentence) record.lastSentence = sentence;
    bumpTime(record, at);
    return record;
  }
  if (type === "frame-pass") {
    record.framePassed = true;
    if (sentence) record.lastSentence = sentence;
    if (record.status !== PROGRESS_STATUS.mastered && record.status !== PROGRESS_STATUS.provisional) {
      record.status = PROGRESS_STATUS.practiced;
    }
    bumpTime(record, at);
    return record;
  }
  if (type === "provisional") {
    if (record.status !== PROGRESS_STATUS.mastered) {
      record.status = PROGRESS_STATUS.provisional;
    }
    if (sentence) record.lastSentence = sentence;
    bumpTime(record, at);
    return record;
  }
  if (type === "mastered") {
    record.status = PROGRESS_STATUS.mastered;
    if (sentence) record.lastSentence = sentence;
    bumpTime(record, at);
    return record;
  }
  return record;
}

export function mergeRecords(local, remote) {
  const a = normalizeRecord(local);
  const b = normalizeRecord(remote);
  if (!a.pointId) a.pointId = b.pointId;
  if (!b.pointId) b.pointId = a.pointId;
  const rankA = STATUS_RANK[a.status] || 0;
  const rankB = STATUS_RANK[b.status] || 0;
  var chosen;
  if (rankA > rankB) chosen = a;
  else if (rankB > rankA) chosen = b;
  else chosen = (a.updatedAt >= b.updatedAt) ? a : b;
  const other = chosen === a ? b : a;
  chosen.failCount = Math.max(a.failCount, b.failCount);
  chosen.framePassed = Boolean(a.framePassed || b.framePassed);
  if (!chosen.lastSentence) chosen.lastSentence = other.lastSentence;
  chosen.dirty = Boolean(a.dirty || (rankA > rankB));
  return chosen;
}

export function mergeMaps(localMap, remoteMap) {
  const out = {};
  const ids = {};
  const local = localMap || {};
  const remote = remoteMap || {};
  Object.keys(local).forEach(function (id) { ids[id] = true; });
  Object.keys(remote).forEach(function (id) { ids[id] = true; });
  Object.keys(ids).forEach(function (id) {
    out[id] = mergeRecords(local[id], remote[id]);
    out[id].pointId = id;
  });
  return out;
}

export function verdictEvent(verdict, pointId, sentence, isFrameOnly) {
  if (isFrameOnly && (verdict === "pass" || verdict === "provisional")) {
    return { type: "frame-pass", pointId: pointId, sentence: sentence };
  }
  if (verdict === "pass") return { type: "mastered", pointId: pointId, sentence: sentence };
  if (verdict === "provisional") return { type: "provisional", pointId: pointId, sentence: sentence };
  return { type: "fail", pointId: pointId, sentence: sentence };
}

export function combineVerdict(machinePassed, aiPassed, aiAvailable) {
  if (!machinePassed) return "fail";
  if (aiAvailable && aiPassed === true) return "pass";
  if (aiAvailable && aiPassed === false) return "fail";
  return "provisional";
}
