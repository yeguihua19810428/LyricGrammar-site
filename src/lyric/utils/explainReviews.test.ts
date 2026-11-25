import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyReviewToPoint,
  emptyReviewFile,
  formatReviewFile,
  isExplainEditorEnabled,
  isLocalHostName,
  mergeReviewsIntoPoints,
  nextUnrevisedPoint,
  normalizeReview,
  reviewStats,
  shanghaiStamp,
  upsertReview,
} from "./explainReviews.mjs";
import { explanationParts, styleHint } from "./teachingVoice.mjs";

describe("review overlay", () => {
  it("normalizes one point and leaves the other points untouched", () => {
    const points = [
      { id: "a", say: "旧的说法 A", bookName: "术语A", reason: "原因A" },
      { id: "b", say: "旧的说法 B", bookName: "术语B", reason: "原因B" },
    ];
    const review = normalizeReview({ say: "这句这样写，是为了把口气拉近。", bookName: "术语A" }, "a", "2026-11-25T14:00:00+08:00");
    assert.equal(review && review.humanRevised, true);
    assert.equal(review && review.id, "a");
    const file = upsertReview(emptyReviewFile(2), review, 2, review.revisedAt);
    const merged = mergeReviewsIntoPoints(points, file);
    assert.equal(merged[0].say, "这句这样写，是为了把口气拉近。");
    assert.equal(merged[0].humanRevised, true);
    assert.equal(merged[1].say, "旧的说法 B");
    assert.equal(merged[1].humanRevised, undefined);
    const stats = reviewStats(points, file);
    assert.deepEqual(stats, { total: 2, revised: 1 });
    const pretty = formatReviewFile(file);
    assert.equal(pretty.startsWith("{\n  "), true);
    assert.equal(pretty.endsWith("\n"), true);
    assert.equal(pretty.includes("旧的说法 B"), false);
  });

  it("rejects an empty oral explanation and does not invent a lyric", () => {
    assert.equal(normalizeReview({ say: "   " }, "a", "2026-11-25T14:00:00+08:00"), null);
    const point = { id: "a", say: "旧", lyricLine: "I'm unstoppable" };
    const review = normalizeReview({ say: "新的讲解", lyricLine: "should be ignored" }, "a", "2026-11-25T14:00:00+08:00");
    const next = applyReviewToPoint(point, review);
    assert.equal(next.lyricLine, "I'm unstoppable");
    assert.equal(next.say, "新的讲解");
  });

  it("walks to the next point that has not been rewritten", () => {
    const points = [
      { id: "a", say: "A", humanRevised: true },
      { id: "b", say: "B" },
      { id: "c", say: "C" },
    ];
    assert.equal(nextUnrevisedPoint(points, "a").id, "b");
    assert.equal(nextUnrevisedPoint(points, "b").id, "c");
    const allDone = points.map((point) => ({ ...point, humanRevised: true }));
    assert.equal(nextUnrevisedPoint(allDone, "a"), null);
  });
});

describe("reviewed explanations skip auto hints", () => {
  it("stops appending style and atypical notes once a point is human-revised", () => {
    const raw = { say: "I would rather stay", bookName: "情态", lecture: 4, lyricLine: "I would rather stay" };
    assert.match(styleHint(raw), /情态词/);
    const reviewed = applyReviewToPoint(raw, {
      id: "x",
      say: "这里用 would rather，是把拒绝说得软一点。",
      humanRevised: true,
      revisedAt: "2026-11-25T14:00:00+08:00",
    });
    const parts = explanationParts(reviewed, 4);
    assert.equal(parts.say, "这里用 would rather，是把拒绝说得软一点。");
    assert.equal(parts.styleHint, "");
    assert.equal(parts.atypicalNote, "");
  });
});

describe("editor enablement", () => {
  it("stays off in production unless the explicit local flag is on", () => {
    assert.equal(isExplainEditorEnabled({ nodeEnv: "production" }), false);
    assert.equal(isExplainEditorEnabled({ nodeEnv: "production", host: "127.0.0.1" }), false);
    assert.equal(isExplainEditorEnabled({ nodeEnv: "production", flag: "1" }), true);
    assert.equal(isExplainEditorEnabled({ nodeEnv: "production", flag: "0" }), false);
    assert.equal(isExplainEditorEnabled({ nodeEnv: "development", host: "127.0.0.1" }), true);
    assert.equal(isExplainEditorEnabled({ nodeEnv: "development", host: "englishisfun.cn" }), false);
    assert.equal(isExplainEditorEnabled({ nodeEnv: "development", host: "192.168.1.5:8080" }), true);
    assert.equal(isLocalHostName("localhost:8080"), true);
    assert.equal(isLocalHostName("englishisfun.cn"), false);
  });

  it("formats a Shanghai timestamp with an explicit offset", () => {
    const stamp = shanghaiStamp(new Date("2026-11-25T06:00:00.000Z"));
    assert.equal(stamp, "2026-11-25T14:00:00+08:00");
  });
});
