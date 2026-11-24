// @ts-nocheck
// Shared machine judge for Phase 0 "换成自己的事".
// Plain JS so the student page can inline the same file.
// 
export const JUDGE_KINDS = {
  already: "already",
  futureIf: "future-if",
  toVerb: "to-verb",
  dressed: "dressed",
  walking: "walking",
  generic: "generic",
};

export function detectJudgeKind(oralName, say, lyricLine) {
  const text = [oralName, say, lyricLine].join("\n");
  if (
    /\bthey say\b/i.test(text) ||
    /已经说过的事，嘴里用现在说/.test(text) ||
    /用现在的样子说已经发生的事/.test(text)
  ) {
    return JUDGE_KINDS.already;
  }
  if (
    /If 后面当现在说/.test(text) ||
    /If 后面别加 will/.test(text) ||
    /if 后面用现在时/.test(text)
  ) {
    return JUDGE_KINDS.futureIf;
  }
  if (
    /没有 I am/.test(text) ||
    /直接用 Walking/.test(text) ||
    /直接用 -ing/.test(text) ||
    /^\s*Walking\b/m.test(String(lyricLine || ""))
  ) {
    return JUDGE_KINDS.walking;
  }
  if (/已经是那个样子/.test(text) || (/\bdressed\b/i.test(text) && /用 -ed|用 dressed/.test(text))) {
    return JUDGE_KINDS.dressed;
  }
  if (
    /to 后面就说/.test(text) ||
    /to 后面用最简单/.test(text) ||
    /Ain't like you to hold/i.test(text) ||
    /\bto hold\b/i.test(text)
  ) {
    return JUDGE_KINDS.toVerb;
  }
  return JUDGE_KINDS.generic;
}

export function sentenceFrame(kind) {
  if (kind === JUDGE_KINDS.already) return "They say __________.";
  if (kind === JUDGE_KINDS.futureIf) return "If __________, I will __________.";
  if (kind === JUDGE_KINDS.toVerb) return "It is like me to __________.";
  if (kind === JUDGE_KINDS.dressed) return "I am a __________ dressed like __________.";
  if (kind === JUDGE_KINDS.walking) return "Walking __________, I __________.";
  return "__________.";
}

export function kindTip(kind) {
  if (kind === JUDGE_KINDS.already) {
    return "别人已经这么说了。嘴里却用 They say，不用 They said。听起来这消息现在还在起作用。";
  }
  if (kind === JUDGE_KINDS.futureIf) {
    return "两件事都是以后才发生的。If 后面那件，却当成现在来说，不加 will。will 只放在后面那句，说你到时会怎么做。";
  }
  if (kind === JUDGE_KINDS.toVerb) {
    return "要说的是这件事本身。to 后面用最简单的那个词，不用 will，也不加 s 或 ed。";
  }
  if (kind === JUDGE_KINDS.dressed) {
    return "已经是那个样子，用 dressed。不是 dressing，也不是 dress。";
  }
  if (kind === JUDGE_KINDS.walking) {
    return "没有 I am。直接用 Walking 把这件事说出来。";
  }
  return "用这一条的办法，写一句你自己的完整话。";
}

function isCompleteEnglish(sentence) {
  const trimmed = String(sentence || "").trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
  const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjk > letters) return false;
  return true;
}

function judgeAlready(trimmed) {
  if (!/\bthey say\b/i.test(trimmed) || /\bthey said\b/i.test(trimmed)) {
    return { passed: false, note: "别人已经说过了。嘴里用 They say，别写成 They said。" };
  }
  return { passed: true, note: "可以，嘴里用了 They say，像已经说过、现在还在起作用。" };
}

function judgeFutureIf(trimmed) {
  const beforeMain = trimmed.split(/\b(i'll|i will|we'll|we will|you'll|you will|he'll|she will|they'll|they will)\b/i)[0] || trimmed;
  if (!/\bif\b/i.test(trimmed) || /\bwill\b/i.test(beforeMain)) {
    return { passed: false, note: "两件都是以后的事。If 后面当成现在来说，别加 will。后面那句再用 will。" };
  }
  if (!/\b(i'll|we'll|you'll|he'll|they'll|will)\b/i.test(trimmed)) {
    return { passed: false, note: "把后面那句也写上。will 放在后面，说你到时会怎么做。" };
  }
  return { passed: true, note: "可以，If 后面当现在说，will 放在后面那句。" };
}

function judgeToVerb(trimmed) {
  if (/\bto\s+will\b/i.test(trimmed)) {
    return { passed: false, note: "把那件事用 to hold 这种说法写出来。to 后面别加 will。" };
  }
  if (!/\bto\s+[a-z]+\b/i.test(trimmed)) {
    return { passed: false, note: "把那件事用 to hold 这种说法写出来。to 后面别加 will。" };
  }
  return { passed: true, note: "可以，to 后面说的是那件事本身。" };
}

function judgeDressed(trimmed) {
  if (!/\bdressed\b/i.test(trimmed) || /\bdressing\b/i.test(trimmed)) {
    return { passed: false, note: "已经是那个样子，用 dressed，别写成 dressing。" };
  }
  return { passed: true, note: "可以，用 dressed 说已经是那个样子。" };
}

function judgeWalking(trimmed) {
  if (/\bam walking\b/i.test(trimmed)) {
    return { passed: false, note: "不要写 I am walking。直接用 Walking 开头。" };
  }
  if (!/\bwalking\b/i.test(trimmed)) {
    return { passed: false, note: "不要写 I am walking。直接用 Walking 开头。" };
  }
  return { passed: true, note: "可以，没有 I am，直接用 Walking 把这件事说出来。" };
}

function judgeGeneric(trimmed) {
  if (!isCompleteEnglish(trimmed)) {
    return { passed: false, note: "再写完整一点。请用英文写一句你自己的完整话。" };
  }
  return { passed: true, note: "句子是完整的。有网时再核一次，才算正式掌握。" };
}

export function judgePointSentence(studentSentence, oralName, say, lyricLine) {
  const trimmed = String(studentSentence || "").trim();
  const kind = detectJudgeKind(oralName, say, lyricLine);
  const tip = String(say || "").trim() || kindTip(kind);
  const frame = sentenceFrame(kind);
  if (!trimmed) {
    return {
      kind: kind,
      machinePassed: false,
      note: "先把你写的英文句子打进上面那个框，再交一版。",
      tip: tip,
      frame: frame,
    };
  }
  if (kind !== JUDGE_KINDS.generic && !isCompleteEnglish(trimmed)) {
    return {
      kind: kind,
      machinePassed: false,
      note: "再写完整一点。请用英文写一句你自己的完整话。",
      tip: tip,
      frame: frame,
    };
  }
  let result;
  if (kind === JUDGE_KINDS.already) result = judgeAlready(trimmed);
  else if (kind === JUDGE_KINDS.futureIf) result = judgeFutureIf(trimmed);
  else if (kind === JUDGE_KINDS.toVerb) result = judgeToVerb(trimmed);
  else if (kind === JUDGE_KINDS.dressed) result = judgeDressed(trimmed);
  else if (kind === JUDGE_KINDS.walking) result = judgeWalking(trimmed);
  else result = judgeGeneric(trimmed);
  return {
    kind: kind,
    machinePassed: result.passed,
    note: result.note,
    tip: tip,
    frame: frame,
  };
}
