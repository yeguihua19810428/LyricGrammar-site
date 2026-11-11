export interface SentenceFeedback {
  isCorrect: boolean;
  score: number;
  praise: string;
  grammarAnalysis: string;
  betterAlternative: string;
  tips: string;
}

const FUTURE_TIP =
  "两件事都是以后才发生的。If 后面那件，却当成现在来说，不加 will。will 只放在后面那句，说你到时会怎么做。";
const ALREADY_TIP =
  "别人已经这么说了。嘴里却用 They say，不用 They said。听起来这消息现在还在起作用。";

export function localSentenceFeedback(sentence: string, context = ""): SentenceFeedback {
  const trimmed = sentence.trim();
  const already = /已经|they say/i.test(context) || /\bthey say\b/i.test(trimmed);
  const toVerb = /to 后面/.test(context);
  const dressed = /dressed|已经是那个样子/.test(context);
  const walking = /没有 I am|Walking/.test(context);
  const future = !already && !toVerb && !dressed && !walking;
  const tips = already
    ? ALREADY_TIP
    : toVerb
      ? "要说的是这件事本身。to 后面用最简单的那个词，不用 will，也不加 s 或 ed。"
      : dressed
        ? "已经是那个样子，用 dressed。不是 dressing，也不是 dress。"
        : walking
          ? "没有 I am。直接用 Walking 把这件事说出来。"
          : FUTURE_TIP;
  const hasCapital = /^[A-Z]/.test(trimmed);
  const hasPunctuation = /[.!?]$/.test(trimmed);

  let ok = true;
  let note = tips;
  if (already) {
    if (!/\bthey say\b/i.test(trimmed) || /\bthey said\b/i.test(trimmed)) {
      ok = false;
      note = "别人已经说过了。嘴里用 They say，别写成 They said。";
    }
  } else if (toVerb) {
    if (!/\bto\s+[a-z]+\b/i.test(trimmed)) {
      ok = false;
      note = "把那件事用 to hold 这种说法写出来。to 后面别加 will。";
    }
  } else if (dressed) {
    if (!/\bdressed\b/i.test(trimmed) || /\bdressing\b/i.test(trimmed)) {
      ok = false;
      note = "已经是那个样子，用 dressed，别写成 dressing。";
    }
  } else if (walking) {
    if (!/\bwalking\b/i.test(trimmed) || /\bam walking\b/i.test(trimmed)) {
      ok = false;
      note = "不要写 I am walking。直接用 Walking 开头。";
    }
  } else if (future) {
    const beforeMain = trimmed.split(/\b(i'll|i will)\b/i)[0] || trimmed;
    if (!/\bif\b/i.test(trimmed) || /\bwill\b/i.test(beforeMain)) {
      ok = false;
      note = "两件都是以后的事。If 后面当成现在来说，别加 will。后面那句再用 will。";
    } else if (!/\b(i'll|will)\b/i.test(trimmed)) {
      ok = false;
      note = "把后面那句也写上。will 放在后面，说你到时会怎么做。";
    }
  }

  const polished = hasCapital && hasPunctuation
    ? trimmed
    : `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}${hasPunctuation ? "" : "."}`;

  return {
    isCorrect: ok,
    score: ok ? (hasCapital && hasPunctuation ? 95 : 90) : 85,
    praise: ok ? "可以，听着就像歌里那样。" : "还差一点。",
    grammarAnalysis: note,
    betterAlternative: polished,
    tips,
  };
}
