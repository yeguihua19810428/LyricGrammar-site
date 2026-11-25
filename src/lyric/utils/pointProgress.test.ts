import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProgressEvent,
  combineVerdict,
  emptyRecord,
  listBadge,
  mergeRecords,
  statusLabel,
  verdictEvent,
} from "./pointProgress.mjs";

describe("point progress status", () => {
  it("labels the five statuses in Chinese", () => {
    assert.equal(statusLabel("unseen"), "未学");
    assert.equal(statusLabel("heard"), "已听");
    assert.equal(statusLabel("practiced"), "已练未过");
    assert.equal(statusLabel("provisional"), "暂过");
    assert.equal(statusLabel("mastered"), "掌握");
    assert.equal(listBadge("heard"), "已听");
    assert.equal(listBadge("provisional"), "已练");
    assert.equal(listBadge("mastered"), "掌握");
  });

  it("listening or a correct cloze never records mastery", () => {
    let rec = emptyRecord("p1");
    rec = applyProgressEvent(rec, { type: "heard", pointId: "p1" }, 1);
    assert.equal(rec.status, "heard");
    rec = applyProgressEvent(rec, { type: "watched", pointId: "p1" }, 2);
    assert.equal(rec.status, "heard");
    rec = applyProgressEvent(rec, { type: "cloze", pointId: "p1" }, 3);
    assert.equal(rec.status, "heard");
    rec = applyProgressEvent(rec, { type: "mastered", pointId: "p1", sentence: "They say I am fine." }, 4);
    assert.equal(rec.status, "mastered");
  });

  it("offline machine pass is provisional; AI confirm is mastered; fail is practiced", () => {
    assert.equal(combineVerdict(true, null, false), "provisional");
    assert.equal(combineVerdict(true, true, true), "pass");
    assert.equal(combineVerdict(true, false, true), "fail");
    assert.equal(combineVerdict(false, true, true), "fail");
    let rec = applyProgressEvent(emptyRecord("p2"), verdictEvent("provisional", "p2", "If it rains, I will go."), 5);
    assert.equal(rec.status, "provisional");
    rec = applyProgressEvent(rec, verdictEvent("pass", "p2", "If it rains, I will go."), 6);
    assert.equal(rec.status, "mastered");
    const failed = applyProgressEvent(emptyRecord("p3"), verdictEvent("fail", "p3", "If it will rain."), 7);
    assert.equal(failed.status, "practiced");
    assert.equal(failed.failCount, 1);
  });

  it("a later fail does not downgrade mastery", () => {
    let rec = applyProgressEvent(emptyRecord("p4"), { type: "mastered", pointId: "p4", sentence: "ok" }, 8);
    rec = applyProgressEvent(rec, { type: "fail", pointId: "p4", sentence: "bad" }, 9);
    assert.equal(rec.status, "mastered");
    assert.equal(rec.failCount, 1);
  });

  it("merge keeps the higher status and does not let heard overwrite mastered", () => {
    const local = applyProgressEvent(emptyRecord("p5"), { type: "mastered", pointId: "p5", sentence: "A" }, 20);
    const remote = applyProgressEvent(emptyRecord("p5"), { type: "heard", pointId: "p5" }, 99);
    const merged = mergeRecords(local, remote);
    assert.equal(merged.status, "mastered");
    assert.equal(merged.lastSentence, "A");
  });

  it("frame pass is not mastery; an independent pass is", () => {
    const frame = applyProgressEvent(
      emptyRecord("p6"),
      verdictEvent("pass", "p6", "If it rains, I will stay.", true),
      10,
    );
    assert.equal(frame.status, "practiced");
    assert.equal(frame.framePassed, true);
    const done = applyProgressEvent(frame, verdictEvent("pass", "p6", "If I am late, I will call you."), 11);
    assert.equal(done.status, "mastered");
  });

  it("a later review-fail marks makeup and does not keep provisional", () => {
    let rec = applyProgressEvent(emptyRecord("p7"), verdictEvent("provisional", "p7", "If it rains, I will go."), 12);
    rec = applyProgressEvent(rec, { type: "review-fail", pointId: "p7", sentence: "If it rains, I will go." }, 13);
    assert.equal(rec.status, "practiced");
    assert.equal(rec.needsMakeup, true);
    assert.equal(statusLabel(rec.status, rec), "请补练");
    rec = applyProgressEvent(rec, verdictEvent("pass", "p7", "If it rains, I will go."), 14);
    assert.equal(rec.status, "mastered");
    assert.equal(rec.needsMakeup, false);
  });

  it("review-fail does not downgrade mastery", () => {
    let rec = applyProgressEvent(emptyRecord("p8"), { type: "mastered", pointId: "p8", sentence: "ok" }, 15);
    rec = applyProgressEvent(rec, { type: "review-fail", pointId: "p8", sentence: "ok" }, 16);
    assert.equal(rec.status, "mastered");
    assert.equal(rec.needsMakeup, false);
  });
});
