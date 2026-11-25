import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOSED_LECTURES,
  allMastered,
  buildLectures,
  currentLectureNo,
  isLectureOpen,
  lectureLight,
  lectureLightLabel,
  lecturePassUnlocked,
  nextPassTarget,
  officialSong,
  pointPassUnlocked,
  withStatuses,
} from "./questMap.mjs";

const book = [
  {
    group: "前段",
    items: [
      { no: 1, title: "语法层次" },
      { no: 2, title: "分句结构和基本句型" },
    ],
  },
  {
    group: "句和句怎么接",
    items: [
      { no: 37, title: "替代" },
      { no: 38, title: "省略" },
      { no: 39, title: "强调" },
      { no: 40, title: "从句到篇" },
    ],
  },
];

const songs = [
  { lecture: 1, title: "Unstoppable", artist: "Sia" },
  { lecture: 2, title: "You Are Not Alone", artist: "Michael Jackson" },
  { lecture: 37, title: "I'm Not The Only One", artist: "Sam Smith" },
  { lecture: 38, title: "Should Not Appear", artist: "Nobody" },
];

const points = [
  { id: "L1-a", lecture: 1, lectureTitle: "语法层次", song: "Unstoppable" },
  { id: "L1-b", lecture: 1, lectureTitle: "语法层次", song: null },
  { id: "L2-a", lecture: 2, lectureTitle: "分句结构和基本句型", song: "You Are Not Alone" },
  { id: "L37-a", lecture: 37, lectureTitle: "替代", song: "I'm Not The Only One" },
  { id: "L38-a", lecture: 38, lectureTitle: "省略", song: "With or Without You" },
  { id: "L39-a", lecture: 39, lectureTitle: "强调", song: "Stay" },
  { id: "L40-a", lecture: 40, lectureTitle: "从句到篇", song: "You Are Not Alone" },
];

function progressMap(entries: Record<string, string>) {
  return function (id: string) {
    return entries[id] || "unseen";
  };
}

function live(entries: Record<string, string> = {}) {
  return withStatuses(buildLectures(book, songs, points), progressMap(entries));
}

describe("quest map closed lectures", () => {
  it("marks lectures 38, 39 and 40 as 暂未开放 and does not invent a song", () => {
    assert.deepEqual(CLOSED_LECTURES, [38, 39, 40]);
    assert.equal(isLectureOpen(37), true);
    assert.equal(isLectureOpen(38), false);
    assert.equal(isLectureOpen(39), false);
    assert.equal(isLectureOpen(40), false);
    assert.equal(officialSong(38, songs), null);
    const lectures = live();
    assert.equal(lectures.length, 40);
    for (const no of [38, 39, 40]) {
      const lec = lectures[no - 1];
      assert.equal(lec.open, false);
      assert.equal(lec.closedLabel, "暂未开放");
      assert.equal(lec.songTitle, "");
      assert.equal(lec.light, "closed");
      assert.equal(lectureLightLabel(lec.light), "暂未开放");
      assert.equal(lec.points.length, 0);
      assert.equal(lecturePassUnlocked(no, lectures), false);
    }
    assert.equal(lectures[0].songTitle, "Unstoppable");
    assert.equal(lectures[36].songTitle, "I'm Not The Only One");
  });
});

describe("quest map soft lock between lectures", () => {
  it("keeps later lectures visible, but locks their pass path until the previous lecture is mastered", () => {
    const lectures = live({ "L1-a": "mastered" });
    assert.equal(lectures[1].open, true);
    assert.equal(lectures[1].songTitle, "You Are Not Alone");
    assert.equal(lecturePassUnlocked(1, lectures), true);
    assert.equal(lecturePassUnlocked(2, lectures), false);
    const ready = live({ "L1-a": "mastered", "L1-b": "mastered" });
    assert.equal(lecturePassUnlocked(2, ready), true);
  });

  it("does not treat provisional as enough to unlock the next lecture", () => {
    const lectures = live({ "L1-a": "mastered", "L1-b": "provisional" });
    assert.equal(lectures[0].light, "provisional");
    assert.equal(lectureLightLabel(lectures[0].light), "暂过 · 半亮");
    assert.equal(allMastered(lectures[0].statuses), false);
    assert.equal(lecturePassUnlocked(2, lectures), false);
  });
});

describe("quest map unlock inside a lecture", () => {
  it("unlocks the next point only after the current point is mastered", () => {
    const statuses = ["unseen", "unseen"];
    assert.equal(pointPassUnlocked(0, statuses, true), true);
    assert.equal(pointPassUnlocked(1, statuses, true), false);
    assert.equal(pointPassUnlocked(1, ["provisional", "unseen"], true), false);
    assert.equal(pointPassUnlocked(1, ["mastered", "unseen"], true), true);
    assert.equal(pointPassUnlocked(0, statuses, false), false);
  });

  it("still requires a no-lyric point to be mastered before the lecture is cleared", () => {
    const lectures = live({ "L1-a": "mastered", "L1-b": "unseen" });
    assert.equal(lectures[0].points[1].song, null);
    assert.equal(lecturePassUnlocked(2, lectures), false);
    const done = live({ "L1-a": "mastered", "L1-b": "mastered" });
    assert.equal(done[0].light, "mastered");
    assert.equal(lecturePassUnlocked(2, done), true);
  });
});

describe("quest map lights", () => {
  it("maps the five progress states onto lecture lamps, with provisional only half lit", () => {
    assert.equal(lectureLight(["unseen", "unseen"], true), "unseen");
    assert.equal(lectureLight(["heard", "unseen"], true), "heard");
    assert.equal(lectureLight(["mastered", "unseen"], true), "heard");
    assert.equal(lectureLight(["mastered", "practiced"], true), "practiced");
    assert.equal(lectureLight(["mastered", "provisional"], true), "provisional");
    assert.equal(lectureLight(["mastered", "mastered"], true), "mastered");
    assert.equal(lectureLight(["mastered"], false), "closed");
    assert.equal(lectureLightLabel("unseen"), "未学");
    assert.equal(lectureLightLabel("heard"), "已听");
    assert.equal(lectureLightLabel("practiced"), "已练未过 · 继续打");
    assert.equal(lectureLightLabel("mastered"), "掌握");
  });

  it("highlights the first open lecture that is not fully mastered", () => {
    assert.equal(currentLectureNo(live()), 1);
    assert.equal(currentLectureNo(live({ "L1-a": "mastered" })), 1);
    const mid = live({ "L1-a": "mastered", "L1-b": "mastered" });
    assert.equal(currentLectureNo(mid), 2);
    const afterTwo = live({
      "L1-a": "mastered",
      "L1-b": "mastered",
      "L2-a": "mastered",
    });
    assert.equal(currentLectureNo(afterTwo), 3);
  });

  it("points next-pass at the first unlocked unmastered stage, never a closed lecture", () => {
    const start = live();
    const first = nextPassTarget(start);
    assert.deepEqual(first, { lectureNo: 1, pointId: "L1-a", pointIndex: 0 });
    const afterFirst = live({ "L1-a": "mastered" });
    const second = nextPassTarget(afterFirst, 1, "L1-a");
    assert.deepEqual(second, { lectureNo: 1, pointId: "L1-b", pointIndex: 1 });
    const cleared = live({ "L1-a": "mastered", "L1-b": "mastered" });
    const nextLec = nextPassTarget(cleared, 1, "L1-b");
    assert.deepEqual(nextLec, { lectureNo: 2, pointId: "L2-a", pointIndex: 0 });
    const allOpenDone = live({
      "L1-a": "mastered",
      "L1-b": "mastered",
      "L2-a": "mastered",
      "L37-a": "mastered",
    });
    // Lectures 3-36 have no points in this fixture, so they do not count as mastered.
    assert.equal(nextPassTarget(allOpenDone, 37, "L37-a"), null);
    assert.equal(lecturePassUnlocked(38, allOpenDone), false);
  });
});

describe("real courseware catalog", () => {
  it("builds 40 lectures, official songs for 1–37, and keeps 38–40 closed", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../data");
    const book = JSON.parse(await readFile(join(dir, "book-points.json"), "utf8"));
    const songs = JSON.parse(await readFile(join(dir, "courses-40.json"), "utf8"));
    const raw = JSON.parse(await readFile(join(dir, "courseware-points.json"), "utf8"));
    const lectures = withStatuses(buildLectures(book, songs, raw.points || []), () => "unseen");
    assert.equal(lectures.length, 40);
    assert.equal(lectures[0].songTitle, "Unstoppable");
    assert.equal(lectures[32].songTitle, "Count On Me");
    assert.equal(lectures[36].songTitle, "I'm Not The Only One");
    assert.equal(lecturePassUnlocked(1, lectures), true);
    assert.equal(lecturePassUnlocked(2, lectures), false);
    for (const lec of lectures.slice(37)) {
      assert.equal(lec.open, false);
      assert.equal(lec.songTitle, "");
      assert.equal(lec.closedLabel, "暂未开放");
      assert.equal(lecturePassUnlocked(lec.no, lectures), false);
    }
    const noLyric = (raw.points || []).filter((point: { song?: string | null; lecture: number }) => !point.song);
    assert.equal(noLyric.length, 32);
    const openNoLyric = noLyric.filter((point: { lecture: number }) => point.lecture <= 37);
    const included = openNoLyric.filter((point: { id: string; lecture: number }) =>
      lectures[point.lecture - 1].points.some((item: { id: string }) => item.id === point.id),
    );
    assert.equal(included.length, openNoLyric.length);
  });
});
