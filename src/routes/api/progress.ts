import { createFileRoute } from "@tanstack/react-router";
import { mergeRecords, normalizeRecord } from "@/lyric/utils/pointProgress.mjs";
import { listProgress, upsertProgress } from "@/server/pointProgress";
import { userIdFromApiRequest } from "@/server/progressAuth";

export const Route = createFileRoute("/api/progress")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromApiRequest(request);
        if (!userId) {
          return Response.json(
            { userId: null, items: [] },
            { headers: { "cache-control": "no-store" } },
          );
        }
        const items = await listProgress(userId);
        return Response.json(
          { userId, items },
          { headers: { "cache-control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const userId = await userIdFromApiRequest(request);
        if (!userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json().catch(() => ({}));
        const incoming = Array.isArray(body.items) ? body.items : [];
        const existing = await listProgress(userId);
        const byId = new Map(existing.map((row) => [row.pointId, row]));
        const merged = incoming.map((row: { pointId?: string }) => {
          const next = normalizeRecord(row);
          const prev = byId.get(next.pointId);
          return prev ? mergeRecords(next, prev) : next;
        });
        await upsertProgress(userId, merged);
        return Response.json(
          { userId, items: await listProgress(userId) },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
