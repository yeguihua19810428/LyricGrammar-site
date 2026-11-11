import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const keyFile = path.join(process.cwd(), "data/deepseek.json");

export const DEFAULT_COACH_PROMPT =
  "根据一般现在时特殊用法其中一种‘在从句中，用一般现在时的语法形式，表达将来发生的事’，分析以上句子语法对不对";

type Settings = { apiKey: string; prompt: string };

async function readSettings(): Promise<Settings> {
  try {
    const parsed = JSON.parse(await readFile(keyFile, "utf8")) as { apiKey?: string; prompt?: string };
    return {
      apiKey: String(parsed.apiKey || "").trim(),
      prompt: String(parsed.prompt || "").trim() || DEFAULT_COACH_PROMPT,
    };
  } catch {
    return { apiKey: "", prompt: DEFAULT_COACH_PROMPT };
  }
}

export async function readDeepseekKey(): Promise<string> {
  const fromEnv = process.env.CHECK_AI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return (await readSettings()).apiKey;
}

export async function readCoachPrompt(): Promise<string> {
  return (await readSettings()).prompt;
}

export async function writeCoachSettings(patch: { apiKey?: string; prompt?: string }): Promise<Settings> {
  const current = await readSettings();
  const next: Settings = {
    apiKey: patch.apiKey !== undefined ? patch.apiKey.trim() : current.apiKey,
    prompt: patch.prompt !== undefined && patch.prompt.trim() ? patch.prompt.trim() : current.prompt,
  };
  await mkdir(path.dirname(keyFile), { recursive: true });
  await writeFile(keyFile, JSON.stringify(next), "utf8");
  return next;
}

export async function writeDeepseekKey(apiKey: string): Promise<void> {
  await writeCoachSettings({ apiKey });
}