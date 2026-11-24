import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectJudgeKind, judgePointSentence } from "./machineJudge.mjs";

const CASES = {
  moon: {
    id: "L13-13.2/5)-表过去时间",
    oralName: "用现在的样子说已经发生的事",
    say: "一般现在时也可以用来转述、引述刚刚或已经发生的事，比如 They say I've gone mad。",
    lyricLine: "They say I've gone mad",
  },
  someone: {
    id: "L20-20.1/2)-带-to-不定式与不带-to-不定式",
    oralName: "带 to 还是不带 to",
    say: "要说的是这件事本身。to 后面用最简单的那个词。Ain't like you to hold back or hide from the light",
    lyricLine: "Ain't like you to hold back or hide from the light",
  },
  lovely: {
    id: "L22-22.3/2)-ing分词分句的句法功能",
    oralName: "没有 I am，直接用 -ing",
    say: "Walking out of town 这样的 -ing 分句，可以自己当状语，不一定要再写 I am walking。",
    lyricLine: "Walking out of town",
  },
  blank: {
    id: "L23-23.4/2)-ed分词分句的句法功能",
    oralName: "已经是那个样子，用 -ed",
    say: "dressed like a daydream 里的 dressed 是 -ed 分词，用来修饰前面的 nightmare。已经是那个样子，用 dressed。",
    lyricLine: "Cause, darling, I'm a nightmare dressed like a daydream",
  },
  count: {
    id: "L33-33.2/1)-第二种类型条件句的基本形式",
    oralName: "以后的事，If 后面当现在说",
    say: "第二种类型条件句的基本形式：if 后面用现在时，主句用 will。If you ever find yourself stuck, I will...。",
    lyricLine: "If you ever find yourself stuck in the middle of the sea",
  },
};

function judge(song: keyof typeof CASES, sentence: string) {
  const point = CASES[song];
  return judgePointSentence(sentence, point.oralName, point.say, point.lyricLine);
}

describe("machine judge for five existing lessons", () => {
  it("detects the five home points", () => {
    assert.equal(detectJudgeKind(CASES.moon.oralName, CASES.moon.say, CASES.moon.lyricLine), "already");
    assert.equal(detectJudgeKind(CASES.someone.oralName, CASES.someone.say, CASES.someone.lyricLine), "to-verb");
    assert.equal(detectJudgeKind(CASES.lovely.oralName, CASES.lovely.say, CASES.lovely.lyricLine), "walking");
    assert.equal(detectJudgeKind(CASES.blank.oralName, CASES.blank.say, CASES.blank.lyricLine), "dressed");
    assert.equal(detectJudgeKind(CASES.count.oralName, CASES.count.say, CASES.count.lyricLine), "future-if");
  });

  it("Talking to the Moon: They say passes, They said fails", () => {
    assert.equal(judge("moon", "They say I stay up too late.").machinePassed, true);
    assert.equal(judge("moon", "They said I stay up too late.").machinePassed, false);
    assert.equal(judge("moon", "I stay up too late.").machinePassed, false);
  });

  it("Someone Like You: to + verb passes, to will fails", () => {
    assert.equal(judge("someone", "It is like me to hold back when I am shy.").machinePassed, true);
    assert.equal(judge("someone", "It is like me to will hold back.").machinePassed, false);
    assert.equal(judge("someone", "I always hold back when I am shy.").machinePassed, false);
  });

  it("lovely: Walking passes, I am walking fails", () => {
    assert.equal(judge("lovely", "Walking out of class, I felt free.").machinePassed, true);
    assert.equal(judge("lovely", "I am walking out of class.").machinePassed, false);
    assert.equal(judge("lovely", "I left the town yesterday.").machinePassed, false);
  });

  it("Blank Space: dressed passes, dressing fails", () => {
    assert.equal(judge("blank", "I felt like a student dressed like a teacher.").machinePassed, true);
    assert.equal(judge("blank", "I felt like a student dressing like a teacher.").machinePassed, false);
    assert.equal(judge("blank", "I felt like a student in a costume.").machinePassed, false);
  });

  it("Count On Me: If + present and will passes; If will fails", () => {
    assert.equal(judge("count", "If it rains tomorrow, I will stay at home.").machinePassed, true);
    assert.equal(judge("count", "If it will rain tomorrow, I will stay at home.").machinePassed, false);
    assert.equal(judge("count", "If it rains tomorrow.").machinePassed, false);
    assert.equal(judge("count", "I will stay at home tomorrow.").machinePassed, false);
  });

  it("short or Chinese-only sentences do not pass", () => {
    assert.equal(judge("count", "If rains").machinePassed, false);
    assert.equal(judge("count", "如果明天下雨我就在家。").machinePassed, false);
    assert.equal(judge("moon", "").machinePassed, false);
  });
});
