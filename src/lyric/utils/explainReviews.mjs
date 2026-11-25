// @ts-nocheck
// Human revisions of oral explanations. Plain JS so the student page can inline it.
// The catalog file stays untouched; one-point edits go into the overlay only.

export const REVIEW_FILE_NAME = "courseware-says-reviewed.json";
export const SAY_MAX = 2000;
export const BOOK_NAME_MAX = 200;
export const REASON_MAX = 2000;

export function shanghaiStamp(now) {
  var date = now || new Date();
  var fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  var parts = {};
  fmt.formatToParts(date).forEach(function (part) {
    parts[part.type] = part.value;
  });
  return parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute + ":" + parts.second + "+08:00";
}

export function emptyReviewFile(total) {
  return {
    meta: { totalPoints: Number(total) || 0, updatedAt: "" },
    points: {},
  };
}

export function normalizeReview(row, pointId, at) {
  var id = String((pointId || (row && row.id) || "")).trim();
  var say = String((row && row.say) || "").trim();
  if (!id || !say) return null;
  var out = {
    id: id,
    say: say.slice(0, SAY_MAX),
    humanRevised: true,
    revisedAt: String((row && row.revisedAt) || at || ""),
  };
  if (row && row.bookName != null) out.bookName = String(row.bookName).trim().slice(0, BOOK_NAME_MAX);
  if (row && row.reason != null) out.reason = String(row.reason).trim().slice(0, REASON_MAX);
  return out;
}

export function applyReviewToPoint(point, review) {
  if (!point || !review || !review.humanRevised || !review.say) return point;
  var next = Object.assign({}, point);
  next.say = String(review.say);
  if (review.bookName != null) next.bookName = String(review.bookName);
  if (review.reason != null) next.reason = String(review.reason);
  next.humanRevised = true;
  next.revisedAt = review.revisedAt || "";
  return next;
}

export function mergeReviewsIntoPoints(points, reviewFile) {
  var map = (reviewFile && reviewFile.points) || {};
  return (points || []).map(function (point) {
    var review = point && point.id ? map[point.id] : null;
    return review ? applyReviewToPoint(point, review) : point;
  });
}

export function reviewStats(points, reviewFile) {
  var list = points || [];
  var map = (reviewFile && reviewFile.points) || {};
  var known = {};
  list.forEach(function (point) {
    if (point && point.id) known[point.id] = true;
  });
  var revised = 0;
  Object.keys(map).forEach(function (id) {
    if (known[id] && map[id] && map[id].humanRevised) revised += 1;
  });
  return { total: list.length, revised: revised };
}

export function upsertReview(reviewFile, review, total, at) {
  var points = Object.assign({}, (reviewFile && reviewFile.points) || {});
  points[review.id] = review;
  return {
    meta: {
      totalPoints: Number(total) || (reviewFile && reviewFile.meta && reviewFile.meta.totalPoints) || 0,
      updatedAt: at || (review && review.revisedAt) || "",
    },
    points: points,
  };
}

export function formatReviewFile(reviewFile) {
  return JSON.stringify(reviewFile, null, 2) + "\n";
}

export function nextUnrevisedPoint(points, fromId) {
  var list = points || [];
  if (!list.length) return null;
  var start = 0;
  if (fromId) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === fromId) {
        start = i + 1;
        break;
      }
    }
  }
  var n = list.length;
  for (var step = 0; step < n; step++) {
    var point = list[(start + step) % n];
    if (point && point.id && !point.humanRevised) return point;
  }
  return null;
}

export function isLocalHostName(host) {
  var name = String(host || "").split(":")[0].toLowerCase();
  if (name.charAt(0) === "[" && name.charAt(name.length - 1) === "]") name = name.slice(1, -1);
  return name === "localhost" || name === "127.0.0.1" || name === "::1" || name === "0.0.0.0" || name.endsWith(".local");
}

export function isPrivateOrLocalHost(host) {
  if (isLocalHostName(host)) return true;
  var name = String(host || "").split(":")[0].toLowerCase();
  if (name.charAt(0) === "[" && name.charAt(name.length - 1) === "]") name = name.slice(1, -1);
  if (/^10\.\d+\.\d+\.\d+$/.test(name)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(name)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(name)) return true;
  return false;
}

export function isExplainEditorEnabled(options) {
  var opts = options || {};
  var flag = String(opts.flag == null ? "" : opts.flag).trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  if (opts.nodeEnv === "production") return false;
  if (opts.host) return isPrivateOrLocalHost(opts.host);
  return opts.nodeEnv !== "production";
}
