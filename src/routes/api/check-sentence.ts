import { createFileRoute } from "@tanstack/react-router";
import { combineVerdict } from "@/lyric/utils/pointProgress.mjs";
import {
  defaultFollowUp,
  judgeExplanationText,
  judgePointSelection,
  judgePointSentence,
  judgeReadingSelection,
  judgeRewrite,
} from "@/lyric/utils/machineJudge.mjs";
import { judgeOwnSentence, localSentenceFeedback, type SentenceFeedback } from "@/lyric/utils/sentenceCheck";
import { readDeepseekKey } from "@/server/deepseekKey";

type GateResult = {
  machinePassed: boolean;
  aiPassed: boolean | null;
  aiAvailable: boolean;
  verdict: "pass" | "fail" | "provisional";
  note: string;
  followUp: string;
  frame: string;
  kind: string;
  source: "configured-ai" | "local";
  feedback: SentenceFeedback;
};

function clip(value: unknown, max = 400): string {
  return String(value || "").trim().slice(0, max);
}

function parseAiJson(text: string): { passed: boolean; note: string; followUp: string; frame: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed.passed !== "boolean") return null;
    return {
      passed: parsed.passed,
      note: String(parsed.note || ""),
      followUp: String(parsed.followUp || ""),
      frame: String(parsed.frame || ""),
    };
  } catch {
    return null;
  }
}

async function askPassFail(input: {
  base: string;
  key: string;
  model: string;
  task: string;
  studentSentence: string;
  say: string;
  lyricLine: string;
  selectedText?: string;
  explanation?: string;
  readingSentence?: string;
}): Promise<{ passed: boolean; note: string; followUp: string; frame: string } | null> {
  const endpoint = input.base.replace(/\/$/, "") + "/chat/completions";
  const task = input.task || "own";
  const lines: string[] = ["口语提示：" + input.say];
  if (task === "read-mark") {
    if (input.readingSentence) lines.push("这一句长句：" + input.readingSentence);
    if (input.selectedText) lines.push("学生点出的部分：" + input.selectedText);
    if (input.explanation) lines.push("学生的说明：" + input.explanation);
  } else if (task === "explain") {
    if (input.lyricLine) lines.push("教学歌词：" + input.lyricLine);
    if (input.selectedText) lines.push("学生点出的部分：" + input.selectedText);
    if (input.studentSentence) lines.push("学生写的句子：" + input.studentSentence);
    if (input.explanation) lines.push("学生的说明：" + input.explanation);
  } else if (task === "rewrite") {
    if (input.lyricLine) lines.push("原来的教学歌词：" + input.lyricLine);
    lines.push("学生改过的那一句：" + input.studentSentence);
  } else {
    if (input.lyricLine) lines.push("教学歌词：" + input.lyricLine);
    lines.push("学生写的：" + input.studentSentence);
  }
  const system =
    task === "explain"
      ? [
          "你在看学生有没有讲到点子上。只用口语，不要用语法术语。",
          "只根据口语提示、一句教学歌词（如有）、学生点出的部分、学生的说明来判断。",
          "不要要求学生复述歌词。",
          "只返回 JSON，不要 markdown：",
          '{"passed":true,"note":"","followUp":"","frame":""}',
          "没过时：note 说明哪里不对；followUp 只追问一句，例如「写成 will find 会怎样」；frame 给一个说明架子，让学生填自己的话。",
          "过了时：followUp 和 frame 留空，note 用一句话肯定。",
        ]
      : task === "rewrite"
        ? [
            "你只评学生改过的这一句得不得体，并看这个语法现象还在不在。只用口语，不要用语法术语。",
            "只根据口语提示、原来那一句教学歌词、学生改过的那一句来判断。不要展开整首歌。",
            "丢了语法就没过。",
            "只返回 JSON，不要 markdown：",
            '{"passed":true,"note":"","followUp":"","frame":""}',
            "没过时：note 说明哪里不对；followUp 只追问一句；frame 可留空。",
            "过了时：followUp 和 frame 留空，note 用一句话肯定。",
          ]
        : task === "read-mark"
          ? [
              "你在看学生有没有在这一句长句里标出同一个语法现象，并说明它在这句话里起什么作用。只用口语，不要用语法术语。",
              "只根据口语提示、这一句长句、学生点出的部分、学生的说明来判断。不要使用整段课文。",
              "只返回 JSON，不要 markdown：",
              '{"passed":true,"note":"","followUp":"","frame":""}',
              "没过时：note 说明哪里不对；followUp 只追问一句。",
              "过了时：followUp 和 frame 留空，note 用一句话肯定。",
            ]
          : [
              "你在判断学生有没有用对当前这一条语法现象。只用口语，不要用语法术语。",
              "只根据口语提示、一句教学歌词（如有）、学生写的那一句来判断。",
              "不要要求学生复述歌词，要看他是不是用这个办法说自己的事。",
              "只返回 JSON，不要 markdown：",
              '{"passed":true,"note":"","followUp":"","frame":""}',
              "没过时：note 说明哪里不对；followUp 只追问一句；frame 给一个句子架子，让学生填自己的内容，不是选择题。",
              "过了时：followUp 和 frame 留空，note 用一句话肯定。",
            ];
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.key}`,
    },
    body: JSON.stringify({
      model: input.model,
      thinking: { type: "disabled" },
      temperature: 0.2,
      messages: [
        { role: "system", content: system.join("\n") },
        { role: "user", content: lines.join("\n") },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") return null;
  return parseAiJson(text);
}

function toFeedback(gate: Omit<GateResult, "feedback">, sentence: string): SentenceFeedback {
  const local = localSentenceFeedback(sentence, gate.note);
  return {
    ...local,
    isCorrect: gate.verdict === "pass" || gate.verdict === "provisional",
    score: gate.verdict === "pass" ? 95 : gate.verdict === "provisional" ? 80 : 60,
    praise: gate.verdict === "fail" ? "还差一点。" : gate.verdict === "provisional" ? "先记成暂过，有网再核一次。" : "可以，这一条算过了。",
    grammarAnalysis: gate.note,
    tips: local.tips,
  };
}

export const Route = createFileRoute("/api/check-sentence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const studentSentence = clip(body.studentSentence, 500);
        const oralName = clip(body.oralName, 200);
        const say = clip(body.say, 400);
        const lyricLine = clip(body.lyricLine, 240);
        const formula = clip(body.formula, 200);
        const promptContext = clip(body.promptContext, 400);
        const task = clip(body.task, 40) || "own";
        const selectedText = clip(body.selectedText, 240);
        const explanation = clip(body.explanation, 500);
        const readingSentence = clip(body.readingSentence, 400);
        const readingMark = clip(body.readingMark, 80);
        const passGate = Boolean(body.passGate) || Boolean(oralName || say || lyricLine || selectedText || explanation);
        let judged = judgeOwnSentence({
          studentSentence,
          oralName: oralName || formula,
          say: say || promptContext,
          lyricLine,
        });
        if (task === "explain") {
          if (lyricLine) {
            const picked = judgePointSelection(selectedText, oralName || formula, say || promptContext, lyricLine);
            const explained = judgeExplanationText(explanation, picked.kind);
            judged = {
              kind: picked.kind,
              machinePassed: picked.machinePassed && explained.passed,
              note: !picked.machinePassed ? picked.note : explained.note,
              tip: picked.tip,
              frame: picked.frame,
            };
          } else {
            const own = studentSentence
              ? judgePointSentence(studentSentence, oralName || formula, say || promptContext, "")
              : { kind: judged.kind, machinePassed: true, note: "", tip: judged.tip, frame: judged.frame };
            const explained = judgeExplanationText(explanation, own.kind);
            judged = {
              kind: own.kind,
              machinePassed: own.machinePassed && explained.passed,
              note: !own.machinePassed ? own.note : explained.note,
              tip: own.tip || judged.tip,
              frame: own.frame || judged.frame,
            };
          }
        } else if (task === "rewrite") {
          judged = judgeRewrite(lyricLine, studentSentence, oralName || formula, say || promptContext);
        } else if (task === "read-mark") {
          const picked = judgeReadingSelection(selectedText, readingMark, readingSentence);
          const explained = judgeExplanationText(explanation, judged.kind);
          judged = {
            kind: judged.kind,
            machinePassed: picked.machinePassed && explained.passed,
            note: !picked.machinePassed ? picked.note : explained.note,
            tip: judged.tip,
            frame: judged.frame,
          };
        }
        const savedKey = await readDeepseekKey();
        const base = process.env.CHECK_AI_BASE_URL || (savedKey ? "https://api.deepseek.com/v1" : "");
        const key = process.env.CHECK_AI_API_KEY || savedKey;
        const model = process.env.CHECK_AI_MODEL || "deepseek-flash";

        if (passGate) {
          let aiPassed: boolean | null = null;
          let aiAvailable = false;
          let note = judged.note;
          let followUp = judged.machinePassed ? "" : judged.note || defaultFollowUp(judged.kind);
          let frame = judged.frame;
          let source: "configured-ai" | "local" = "local";
          const hasOutput = Boolean(studentSentence || explanation || selectedText);
          if (base && key && hasOutput) {
            try {
              const ai = await askPassFail({
                base,
                key,
                model,
                task,
                studentSentence,
                say: judged.tip || say || promptContext,
                lyricLine,
                selectedText,
                explanation,
                readingSentence,
              });
              if (ai) {
                aiAvailable = true;
                aiPassed = ai.passed;
                source = "configured-ai";
                if (ai.note) note = ai.note;
                if (ai.followUp) followUp = ai.followUp;
                if (ai.frame) frame = ai.frame;
              }
            } catch {
              // Keep the machine result and mark AI unavailable.
            }
          }
          const verdict = combineVerdict(judged.machinePassed, aiPassed, aiAvailable);
          const gate: Omit<GateResult, "feedback"> = {
            machinePassed: judged.machinePassed,
            aiPassed,
            aiAvailable,
            verdict,
            note,
            followUp,
            frame,
            kind: judged.kind,
            source,
          };
          return Response.json({ ...gate, feedback: toFeedback(gate, studentSentence || explanation) });
        }

        // Older callers still send a free-form instruction. Do not use this
        // path for mastery: the student page now uses passGate above.
        const instruction = clip(body.instruction, 400);
        if (instruction && base && key && studentSentence) {
          try {
            const endpoint = base.replace(/\/$/, "") + "/chat/completions";
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
              body: JSON.stringify({
                model,
                thinking: { type: "disabled" },
                temperature: 0.2,
                messages: [{
                  role: "user",
                  content: `要分析的英文句子：\n${studentSentence}\n\n请分析上面这句英文，不要说没看到句子。要求：\n${instruction}`,
                }],
              }),
              signal: AbortSignal.timeout(20000),
            });
            if (response.status === 401) {
              return Response.json({ error: "auth" });
            }
            if (response.ok) {
              const data = await response.json();
              const reply = String(data?.choices?.[0]?.message?.content || "").trim();
              if (reply) return Response.json({ reply, source: "configured-ai" });
            }
          } catch {
            // Fall through to the local note.
          }
        }
        return Response.json({
          feedback: localSentenceFeedback(studentSentence, `${formula}\n${promptContext}`),
          source: "local",
        });
      },
    },
  },
});
