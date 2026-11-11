import { createFileRoute } from "@tanstack/react-router";
import { readCoachPrompt, readDeepseekKey, writeCoachSettings } from "@/server/deepseekKey";

function tailOf(key: string): string {
  return key.length >= 4 ? key.slice(-4) : "";
}

export const Route = createFileRoute("/api/deepseek-key")({
  server: {
    handlers: {
      GET: async () => {
        const key = await readDeepseekKey();
        return Response.json({ configured: Boolean(key), tail: tailOf(key), prompt: await readCoachPrompt() });
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const patch: { apiKey?: string; prompt?: string } = {};
        if ("apiKey" in body) {
          const apiKey = String(body.apiKey || "").trim();
          if (apiKey && !/^sk-[A-Za-z0-9_-]{10,}$/.test(apiKey)) {
            return Response.json({ error: "这不像 DeepSeek 的钥匙。一般是 sk- 开头。" }, { status: 400 });
          }
          patch.apiKey = apiKey;
        }
        if ("prompt" in body) patch.prompt = String(body.prompt || "");
        const saved = await writeCoachSettings(patch);
        return Response.json({ configured: Boolean(saved.apiKey), tail: tailOf(saved.apiKey), prompt: saved.prompt });
      },
    },
  },
});