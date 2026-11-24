import { judgePointSentence, kindTip } from "./machineJudge.mjs";

export interface SentenceFeedback {
  isCorrect: boolean;
  score: number;
  praise: string;
  grammarAnalysis: string;
  betterAlternative: string;
  tips: string;
}

export interface PointJudgeInput {
  studentSentence: string;
  oralName?: string;
  say?: string;
  lyricLine?: string;
}

export function judgeOwnSentence(input: PointJudgeInput) {
  return judgePointSentence(
    input.studentSentence,
    input.oralName || "",
    input.say || "",
    input.lyricLine || "",
  );
}

export function localSentenceFeedback(sentence: string, context = ""): SentenceFeedback {
  const judged = judgePointSentence(sentence, context, context, "");
  const trimmed = sentence.trim();
  const hasCapital = /^[A-Z]/.test(trimmed);
  const hasPunctuation = /[.!?]$/.test(trimmed);
  const polished = !trimmed
    ? ""
    : hasCapital && hasPunctuation
      ? trimmed
      : `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}${hasPunctuation ? "" : "."}`;
  return {
    isCorrect: judged.machinePassed,
    score: judged.machinePassed ? (hasCapital && hasPunctuation ? 95 : 90) : 60,
    praise: judged.machinePassed ? "可以，听着就像歌里那样。" : "还差一点。",
    grammarAnalysis: judged.note,
    betterAlternative: polished || trimmed,
    tips: judged.tip || kindTip(judged.kind),
  };
}
