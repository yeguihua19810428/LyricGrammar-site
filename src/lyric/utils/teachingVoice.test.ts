import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATYPICAL_LECTURE_NOTES,
  clipWindow,
  explanationParts,
  isCameoPoint,
  isHomeSongPoint,
  songRoleCopy,
  styleHint,
} from "./teachingVoice.mjs";

describe("cameo vs home song", () => {
  it("treats reusedFrom or a different songHomeLecture as a cameo", () => {
    const home = { song: "Unstoppable", songHomeLecture: 1, reusedFrom: null };
    const reused = { song: "Just the Way You Are", songHomeLecture: 3, reusedFrom: "第3讲《Just the Way You Are》" };
    const borrowed = { song: "Hello", songHomeLecture: 7, reusedFrom: null };
    assert.equal(isHomeSongPoint(home, 1), true);
    assert.equal(isCameoPoint(home, 1), false);
    assert.equal(isCameoPoint(reused, 1), true);
    assert.equal(isHomeSongPoint(borrowed, 1), false);
    assert.equal(songRoleCopy(home, 1).label, "本家主打歌");
    assert.equal(songRoleCopy(reused, 1).label, "客串例句");
    assert.match(songRoleCopy(reused, 1).detail, /不展开那首歌的完整世界/);
  });
});

describe("cameo clip window", () => {
  it("keeps a supporting clip between 5 and 10 seconds", () => {
    assert.deepEqual(clipWindow(10, 16, 20), { start: 10, end: 16 });
    assert.deepEqual(clipWindow(10, 40, 50), { start: 10, end: 20 });
    assert.deepEqual(clipWindow(10, 12, 13), { start: 10, end: 15 });
    assert.deepEqual(clipWindow(4, null, 9), { start: 4, end: 9 });
    assert.deepEqual(clipWindow(4, null, null), { start: 4, end: 12 });
    assert.equal(clipWindow(-1, 8, 9), null);
  });
});

describe("teaching voice hints", () => {
  it("adds an oral style hint for inversion, modality, aspect and fragments, without leading with a term", () => {
    assert.match(styleHint({ lyricLine: "Never have I ever felt so small" }), /语序一变/);
    assert.match(styleHint({ lyricLine: "I would rather stay" }), /情态词/);
    assert.match(styleHint({ lyricLine: "I have seen it all" }), /完成体|还在眼前/);
    assert.match(styleHint({ lyricLine: "Not enough." }), /拆短|口气收紧/);
    assert.equal(styleHint({ lyricLine: "I'm unstoppable today" }), "");
  });

  it("keeps textbook names out of the oral body and appends atypical-lecture notes", () => {
    const parts = explanationParts({
      say: "一个词还能切开。",
      bookName: "自由词素",
      lecture: 4,
      lyricLine: "Everybody wants to be my enemy",
    }, 4);
    assert.equal(parts.say, "一个词还能切开。");
    assert.equal(parts.bookName, "自由词素");
    assert.equal(parts.atypicalNote, ATYPICAL_LECTURE_NOTES[4]);
    assert.match(parts.atypicalNote, /physics/);
  });
});
