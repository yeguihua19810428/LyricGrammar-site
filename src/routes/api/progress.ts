import { createFileRoute } from "@tanstack/react-router";
import { mergeRecords, normalizeRecord } from "@/lyric/utils/pointProgress.mjs";
import { listProgress, upsertProgress } from "@/server/pointProgress";
import { badgesFromProgress, listBadges, upsertBadges } from "@/server/questBadges";
import { userIdFromApiRequest } from "@/server/progressAuth";
import { mergeBadgeMaps, normalizeBadge } from "@/lyric/utils/questMap.mjs";

export const Route = createFileRoute("/api/progress")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromApiRequest(request);
        if (!userId) {
          return Response.json(
            { userId: null, items: [], badges: [] },
            { headers: { "cache-control": "no-store" } },
          );
        }
        const items = await listProgress(userId);
        const badges = await badgesFromProgress(items, await listBadges(userId));
        await upsertBadges(userId, badges);
        return Response.json(
          { userId, items, badges: await listBadges(userId) },
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
        const items = await listProgress(userId);
        const incomingBadges = Array.isArray((body as { badges?: unknown }).badges)
          ? (body as { badges: unknown[] }).badges
          : [];
        const local: Record<string, { id: string; earnedAt: number }> = {};
        for (const row of incomingBadges) {
          const badge = normalizeBadge(row);
          if (badge) local[badge.id] = badge;
        }
        const stored: Record<string, { id: string; earnedAt: number }> = {};
        for (const badge of await listBadges(userId)) stored[badge.id] = badge;
        const combined = Object.values(mergeBadgeMaps(local, stored) as Record<string, { id: string; earnedAt: number }>);
        const badges = await badgesFromProgress(items, combined);
        await upsertBadges(userId, badges);
        return Response.json(
          { userId, items, badges: await listBadges(userId) },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
