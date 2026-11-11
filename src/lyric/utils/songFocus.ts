// 一首歌只学一个点。学生看到的话不用术语。
// 现在先做一般现在时的两种特殊用法，各用一首 Bruno Mars。
import type { ClozeQuestion, LyricLine, Song } from "../types";

export const FUTURE_POINT = "以后的事，If 后面当现在说";
export const ALREADY_POINT = "已经说过的事，嘴里用现在说";
export const SIMPLE_IF_POINT = FUTURE_POINT;
export const SPOKEN_TIP =
  "两件事都是以后才发生的。If 后面那件，却当成现在来说，不加 will。will 只放在后面那句，说你到时会怎么做。";

const FUTURE_TIP = SPOKEN_TIP;
const ALREADY_TIP =
  "别人已经这么说了。嘴里却用 They say，不用 They said。听起来这消息现在还在起作用。";

function isIfLine(text: string): boolean {
  return /^\s*(and\s+)?if\b/i.test(text);
}

function isTheySayLine(text: string): boolean {
  return /\bthey say\b/i.test(text);
}

export function focusPoint(song: Pick<Song, "grammarTheme" | "title" | "lines">): string {
  const theme = (song.grammarTheme || "").trim();
  if (theme === "If 后面别加 will") return FUTURE_POINT;
  if (theme) return theme;
  if (/talking to the moon/i.test(song.title || "") || song.lines.some((line) => isTheySayLine(line.text))) {
    return ALREADY_POINT;
  }
  if (song.lines.some((line) => isIfLine(line.text))) return FUTURE_POINT;
  return FUTURE_POINT;
}

export function spokenTip(song: Pick<Song, "grammarTheme" | "title" | "lines" | "spokenTip">): string {
  if (song.spokenTip) return song.spokenTip;
  const point = focusPoint(song);
  if (point === ALREADY_POINT) return ALREADY_TIP;
  if (point === FUTURE_POINT) return FUTURE_TIP;
  return song.lines.find((line) => line.explanation)?.explanation || "";
}

export function focusLines(song: Pick<Song, "grammarTheme" | "title" | "lines">): LyricLine[] {
  const point = focusPoint(song);
  const tagged = song.lines.filter((line) => line.text.trim() && line.grammarPoint === point);
  if (tagged.length) return tagged;
  if (point === ALREADY_POINT) {
    return song.lines.filter((line) => line.text.trim() && isTheySayLine(line.text));
  }
  if (point === FUTURE_POINT) {
    return song.lines.filter((line) => line.text.trim() && isIfLine(line.text));
  }
  return [];
}

export function isStudyLine(song: Pick<Song, "grammarTheme" | "title" | "lines">, line: LyricLine): boolean {
  return focusLines(song).includes(line);
}

export function sungAfter(song: Pick<Song, "lines">, line: LyricLine): LyricLine | undefined {
  const index = song.lines.indexOf(line);
  const next = song.lines[index + 1];
  if (!next?.text.trim()) return undefined;
  return /\b(i'll|will|i've|i have)\b/i.test(next.text) ? next : undefined;
}

export function wholeBlank(song: Pick<Song, "lines">, line: LyricLine): {
  text: string;
  blank: string;
  translation: string;
} {
  if (line.fullSentence) {
    return {
      text: line.fullSentence,
      blank: line.cloze?.sentenceWithBlank || line.fullSentence,
      translation: line.translation,
    };
  }
  const blank = line.cloze?.sentenceWithBlank || line.text;
  const next = sungAfter(song, line);
  const ifOnly = /^\s*(and\s+)?if\b/i.test(line.text) && !/\b(i'll|will)\b/i.test(line.text);
  if (!ifOnly || !next) {
    return { text: line.text, blank, translation: line.translation };
  }
  return {
    text: `${line.text}, ${next.text}`,
    blank: `${blank}, ${next.text}`,
    translation: [line.translation, next.translation].filter(Boolean).join("，"),
  };
}

export function madeExample(song: Pick<Song, "grammarTheme" | "title" | "lines" | "practice">): {
  kind: "made";
  text: string;
  grammarPoint: string;
  patternTemplate: string;
  cloze: ClozeQuestion;
} {
  const point = focusPoint(song);
  if (song.practice?.cloze) {
    return {
      kind: "made",
      text: song.practice.text,
      grammarPoint: point,
      patternTemplate: song.practice.patternTemplate,
      cloze: song.practice.cloze,
    };
  }
  if (point === ALREADY_POINT) {
    return {
      kind: "made",
      text: "They say I stay up too late.",
      grammarPoint: point,
      patternTemplate: "They say",
      cloze: {
        blankWord: "say",
        sentenceWithBlank: "They _____ I stay up too late.",
        hint: "别人已经这么说了。嘴里用 say，不用 said。",
        options: ["say", "said", "will say", "says"],
      },
    };
  }
  return {
    kind: "made",
    text: "If it rains tomorrow, I will stay at home.",
    grammarPoint: point,
    patternTemplate: "If + 现在",
    cloze: {
      blankWord: "rains",
      sentenceWithBlank: "If it _____ tomorrow, I will stay at home.",
      hint: "两件都是以后的事。If 后面说 rains，不说 will rain。will 留在 I will stay。",
      options: ["rains", "will rain", "rained", "raining"],
    },
  };
}
