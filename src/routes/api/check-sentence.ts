import { createFileRoute } from "@tanstack/react-router";
import { combineVerdict } from "@/lyric/utils/pointProgress.mjs";
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
  studentSentence: string;
  say: string;
  lyricLine: string;
}): Promise<{ passed: boolean; note: string; followUp: string; frame: string } | null> {
  const endpoint = input.base.replace(/\/$/, "") + "/chat/completions";
  const lines = ["口语提示：" + input.say, "学生写的：" + input.studentSentence];
  if (input.lyricLine) lines.splice(1, 0, "教学歌词：" + input.lyricLine);
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
        {
          role: "system",
          content: [
            "你在判断学生有没有用对当前这一条语法现象。只用口语，不要用语法术语。",
            "只根据口语提示、一句教学歌词（如有）、学生写的那一句来判断。",
            "不要要求学生复述歌词，要看他是不是用这个办法说自己的事。",
            "只返回 JSON，不要 markdown：",
            '{"passed":true,"note":"","followUp":"","frame":""}',
            "没过时：note 说明哪里不对；followUp 只追问一句；frame 给一个句子架子，让学生填自己的内容，不是选择题。",
            "过了时：followUp 和 frame 留空，note 用一句话肯定。",
          ].join("\n"),
        },
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
        const passGate = Boolean(body.passGate) || Boolean(oralName || say || lyricLine);
        const judged = judgeOwnSentence({
          studentSentence,
          oralName: oralName || formula,
          say: say || promptContext,
          lyricLine,
        });
        const savedKey = await readDeepseekKey();
        const base = process.env.CHECK_AI_BASE_URL || (savedKey ? "https://api.deepseek.com/v1" : "");
        const key = process.env.CHECK_AI_API_KEY || savedKey;
        const model = process.env.CHECK_AI_MODEL || "deepseek-flash";

        if (passGate) {
          let aiPassed: boolean | null = null;
          let aiAvailable = false;
          let note = judged.note;
          let followUp = judged.machinePassed ? "" : judged.note;
          let frame = judged.frame;
          let source: "configured-ai" | "local" = "local";
          if (base && key && studentSentence) {
            try {
              const ai = await askPassFail({
                base,
                key,
                model,
                studentSentence,
                say: judged.tip || say || promptContext,
                lyricLine,
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
          return Response.json({ ...gate, feedback: toFeedback(gate, studentSentence) });
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
