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

function hasWill(text) {
  return /\bwill\b/i.test(text) || /\b(i'll|you'll|we'll|he'll|she'll|they'll)\b/i.test(text);
}

function extractIfClause(trimmed) {
  const afterIf = ((String(trimmed || "").match(/\bif\b([\s\S]*)$/i) || [])[1]) || "";
  if (afterIf.indexOf(",") >= 0) return afterIf.split(",")[0];
  const main = afterIf.match(/^(.*?)\s+\b(i|we|you|he|she|they)\s+(will|'ll|’ll)\b/i);
  if (main && String(main[1] || "").trim().split(/\s+/).filter(Boolean).length >= 2) return main[1];
  return afterIf;
}

function judgeFutureIf(trimmed) {
  if (!/\bif\b/i.test(trimmed)) {
    return { passed: false, note: "两件都是以后的事。If 后面当成现在来说，别加 will。后面那句再用 will。" };
  }
  const clause = extractIfClause(trimmed);
  if (hasWill(clause)) {
    return { passed: false, note: "两件都是以后的事。If 后面当成现在来说，别加 will。后面那句再用 will。" };
  }
  if (!hasWill(trimmed)) {
    return { passed: false, note: "把后面那句也写上。will 放在后面，说你到时会怎么做。" };
  }
  return { passed: true, note: "可以，If 后面当现在说，will 放在后面那句。" };
}

function phenomenonKept(text, kind) {
  const trimmed = String(text || "").trim();
  if (kind === JUDGE_KINDS.already) return judgeAlready(trimmed);
  if (kind === JUDGE_KINDS.futureIf) {
    if (!/\bif\b/i.test(trimmed)) {
      return { passed: false, note: "这个语法现象丢了，请重改。" };
    }
    if (hasWill(extractIfClause(trimmed))) {
      return { passed: false, note: "这个语法现象丢了，请重改。" };
    }
    return { passed: true, note: "If 后面还是当现在说。" };
  }
  if (kind === JUDGE_KINDS.toVerb) return judgeToVerb(trimmed);
  if (kind === JUDGE_KINDS.dressed) return judgeDressed(trimmed);
  if (kind === JUDGE_KINDS.walking) return judgeWalking(trimmed);
  return { passed: Boolean(trimmed), note: trimmed ? "这句还在。" : "请改一版再交。" };
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

export function normalizeWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[“”"'’,.!?…:—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function defaultFollowUp(kind) {
  if (kind === JUDGE_KINDS.already) return "写成 They said 会怎样？";
  if (kind === JUDGE_KINDS.futureIf) return "写成 will find 会怎样？";
  if (kind === JUDGE_KINDS.toVerb) return "to 后面加上 will，听起来有什么不对？";
  if (kind === JUDGE_KINDS.dressed) return "写成 dressing 会怎样？";
  if (kind === JUDGE_KINDS.walking) return "写成 I am walking 会怎样？";
  return "如果不用这个办法，这句话会有什么不一样？";
}

export function speakPrompt(kind) {
  if (kind === JUDGE_KINDS.already) return "别人已经这么说过你什么？请用 They say 说一句。";
  if (kind === JUDGE_KINDS.futureIf) return "明天下雨你会怎么办？";
  if (kind === JUDGE_KINDS.toVerb) return "你自己有什么事要去做？用 to 后面那个最简单的词说出来。";
  if (kind === JUDGE_KINDS.dressed) return "你今天是什么样子？用 dressed 说已经是那个样子。";
  if (kind === JUDGE_KINDS.walking) return "你一边走一边做什么？不要说 I am，直接用 Walking 开头。";
  return "用这个办法，回答一句关于你自己的事。";
}

export function explainFrame(kind) {
  if (kind === JUDGE_KINDS.already) return "这里用 They say，因为 __________。";
  if (kind === JUDGE_KINDS.futureIf) return "If 后面用现在说，因为 __________。";
  if (kind === JUDGE_KINDS.toVerb) return "to 后面用最简单的那个词，因为 __________。";
  if (kind === JUDGE_KINDS.dressed) return "这里用 dressed，因为 __________。";
  if (kind === JUDGE_KINDS.walking) return "没有 I am，直接用 Walking，因为 __________。";
  return "这里用 __________，因为 __________。";
}

function uniquePush(list, value) {
  const text = String(value || "").trim();
  if (!text) return;
  for (var i = 0; i < list.length; i++) {
    if (list[i].toLowerCase() === text.toLowerCase()) return;
  }
  list.push(text);
}

export function targetSpans(oralName, say, lyricLine) {
  const kind = detectJudgeKind(oralName, say, lyricLine);
  const line = String(lyricLine || "");
  const found = [];
  if (!line.trim()) return found;
  if (kind === JUDGE_KINDS.already) {
    const hit = line.match(/\bthey say\b/i);
    if (hit) uniquePush(found, hit[0]);
    uniquePush(found, "They say");
    uniquePush(found, "say");
  } else if (kind === JUDGE_KINDS.futureIf) {
    uniquePush(found, "If");
    const clause = line.match(/\bif\s+(?:you\s+)?(?:ever\s+)?(?!will\b)[a-z]+\b/i);
    if (clause) uniquePush(found, clause[0]);
    const verb = line.match(/\bif\s+(?:you\s+)?(?:ever\s+)?(?!will\b)([a-z]+)\b/i);
    if (verb && verb[1]) uniquePush(found, verb[1]);
  } else if (kind === JUDGE_KINDS.toVerb) {
    const hit = line.match(/\bto\s+[a-z]+\b/i);
    if (hit) uniquePush(found, hit[0]);
  } else if (kind === JUDGE_KINDS.dressed) {
    const hit = line.match(/\bdressed\b/i);
    if (hit) uniquePush(found, hit[0]);
  } else if (kind === JUDGE_KINDS.walking) {
    const hit = line.match(/\bwalking\b/i);
    if (hit) uniquePush(found, hit[0]);
  } else {
    const words = normalizeWords(say + " " + oralName).split(" ");
    const lineNorm = normalizeWords(line);
    words.forEach(function (word) {
      if (word.length < 4) return;
      if (lineNorm.indexOf(word) >= 0) uniquePush(found, word);
    });
  }
  return found;
}

function isWeakPick(sel, kind) {
  if (!sel) return true;
  if (sel === "you" || sel === "the" || sel === "a" || sel === "an" || sel === "in" || sel === "of" || sel === "and") return true;
  if (kind === JUDGE_KINDS.toVerb && sel === "to") return true;
  return false;
}

export function judgePointSelection(selected, oralName, say, lyricLine) {
  const kind = detectJudgeKind(oralName, say, lyricLine);
  const tip = String(say || "").trim() || kindTip(kind);
  const sel = normalizeWords(selected);
  const line = normalizeWords(lyricLine);
  if (!line) {
    return { kind: kind, machinePassed: false, note: "暂无对应歌词，不能点歌词。请用自己的句子来练。", tip: tip, frame: explainFrame(kind) };
  }
  if (!sel) {
    return { kind: kind, machinePassed: false, note: "请先点出承载这个现象的那几个词。", tip: tip, frame: explainFrame(kind) };
  }
  if (sel === line && sel.split(" ").length > 4) {
    return { kind: kind, machinePassed: false, note: "请只点承载这个现象的那一部分，不要整句都点上。", tip: tip, frame: explainFrame(kind) };
  }
  const targets = targetSpans(oralName, say, lyricLine).map(normalizeWords);
  var hit = false;
  for (var i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (!target) continue;
    if (sel === target || sel.indexOf(target) >= 0) {
      hit = true;
      break;
    }
    if (target.indexOf(sel) >= 0 && sel.length >= 2 && !isWeakPick(sel, kind)) {
      hit = true;
      break;
    }
  }
  if (hit) {
    return { kind: kind, machinePassed: true, note: "点对了。请再用自己的话说明为什么。", tip: tip, frame: explainFrame(kind) };
  }
  return {
    kind: kind,
    machinePassed: false,
    note: "这一点还没点到。请再听原句，只点承载这个现象的那几个词。",
    tip: tip,
    frame: explainFrame(kind),
  };
}

export function judgeExplanationText(explanation, kind) {
  const text = String(explanation || "").trim();
  if (text.length < 6) {
    return { passed: false, note: "请再用自己的话说明为什么，写完整一点。" };
  }
  const lower = text.toLowerCase();
  var hint = false;
  if (kind === JUDGE_KINDS.already) hint = /they say|现在|不是 said|不用 said|已经/.test(lower + text);
  else if (kind === JUDGE_KINDS.futureIf) hint = /if|will|现在|不加|以后/.test(lower + text);
  else if (kind === JUDGE_KINDS.toVerb) hint = /\bto\b|这件事|不加 will/.test(lower + text);
  else if (kind === JUDGE_KINDS.dressed) hint = /dressed|已经|不是 dressing/.test(lower + text);
  else if (kind === JUDGE_KINDS.walking) hint = /walking|没有 i am|没有我是|不是 i am/.test(lower + text);
  else hint = true;
  if (!hint) {
    return { passed: false, note: "还没讲到点子上。请再说说为什么要用这个办法。" };
  }
  return { passed: true, note: "说明讲到点子上了。有网再核一次，才算正式掌握。" };
}

export function wordEditDistance(left, right) {
  const a = normalizeWords(left).split(" ").filter(Boolean);
  const b = normalizeWords(right).split(" ").filter(Boolean);
  const rows = [];
  for (var i = 0; i <= a.length; i++) {
    rows[i] = [i];
    for (var j = 1; j <= b.length; j++) {
      if (i === 0) rows[0][j] = j;
      else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      }
    }
  }
  return rows[a.length][b.length];
}

export function judgeRewrite(original, rewritten, oralName, say) {
  const kind = detectJudgeKind(oralName, say, original);
  const tip = String(say || "").trim() || kindTip(kind);
  const src = String(original || "").trim();
  const next = String(rewritten || "").trim();
  if (!src) {
    return { kind: kind, machinePassed: false, note: "暂无对应歌词，不能改歌词。请用自己的句子来练。", tip: tip, frame: sentenceFrame(kind) };
  }
  if (!next) {
    return { kind: kind, machinePassed: false, note: "请只改一两个词，再交上来。", tip: tip, frame: sentenceFrame(kind) };
  }
  if (normalizeWords(src) === normalizeWords(next)) {
    return { kind: kind, machinePassed: false, note: "请只改一两个词，别原样交回去。", tip: tip, frame: sentenceFrame(kind) };
  }
  const edits = wordEditDistance(src, next);
  if (edits > 2) {
    return { kind: kind, machinePassed: false, note: "只改一两个词，把这个语法现象留下来。", tip: tip, frame: sentenceFrame(kind) };
  }
  const kept = phenomenonKept(next, kind);
  if (!kept.passed) {
    return { kind: kind, machinePassed: false, note: "这个语法现象丢了，请重改。", tip: tip, frame: sentenceFrame(kind) };
  }
  return { kind: kind, machinePassed: true, note: "语法还在，也只改了少量词。有网再看这句是否得体。", tip: tip, frame: sentenceFrame(kind) };
}

export function judgeReadingSelection(selected, mark, sentence) {
  const sel = normalizeWords(selected);
  const target = normalizeWords(mark);
  const line = normalizeWords(sentence);
  if (!sel) return { machinePassed: false, note: "请在这一句长句里，点出和歌词里同一个现象的那部分。" };
  if (line && sel === line && sel.split(" ").length > 6) {
    return { machinePassed: false, note: "请只点同一个现象的那几个词，不要整句都点上。" };
  }
  if (!target) {
    return { machinePassed: sel.length > 0, note: sel ? "先记下你点的部分，再用自己的话说明它在这句话里起什么作用。" : "请先点出来。" };
  }
  const hit = sel === target || sel.indexOf(target) >= 0 || (target.indexOf(sel) >= 0 && sel.length >= 2 && sel !== "the" && sel !== "a" && sel !== "you");
  if (hit) return { machinePassed: true, note: "点到同一个现象了。请说明它在这句话里起什么作用。" };
  return { machinePassed: false, note: "这一点还不是同一个现象。请再看这一句，只点对得上的那部分。" };
}
