import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSql } from "@/lib/db";
import {
  buildLectures,
  earnedBadgeIds,
  mergeBadgeMaps,
  normalizeBadge,
  withStatuses,
} from "@/lyric/utils/questMap.mjs";
import { loadCoursewarePoints, loadStudentSongs } from "@/server/studentCatalog";
import type { StoredProgress } from "@/server/pointProgress";

export type StoredBadge = { id: string; earnedAt: number; dirty?: boolean };

type LectureTemplate = ReturnType<typeof buildLectures>;

let catalogCache: LectureTemplate | null = null;

async function lectureTemplate(): Promise<LectureTemplate> {
  if (catalogCache) return catalogCache;
  const dataDir = path.join(process.cwd(), "src/lyric/data");
  const [points, bookRaw, songs] = await Promise.all([
    loadCoursewarePoints(),
    readFile(path.join(dataDir, "book-points.json"), "utf8"),
    loadStudentSongs(),
  ]);
  catalogCache = buildLectures(JSON.parse(bookRaw) as unknown[], songs, points);
  return catalogCache;
}

export async function listBadges(userId: string): Promise<StoredBadge[]> {
  const sql = await getSql();
  const rows = await sql.query<{ badge_id: string; earned_at: string | Date }>(
    "select badge_id, earned_at from quest_badges where user_id = $1",
    [userId],
  );
  const out: StoredBadge[] = [];
  for (const row of rows) {
    const badge = normalizeBadge({
      id: row.badge_id,
      earnedAt: row.earned_at ? new Date(row.earned_at).getTime() : 0,
    });
    if (badge) out.push(badge);
  }
  return out;
}

export async function upsertBadges(userId: string, items: StoredBadge[]): Promise<void> {
  if (!items.length) return;
  const sql = await getSql();
  for (const raw of items) {
    const item = normalizeBadge(raw);
    if (!item) continue;
    const earned = item.earnedAt ? new Date(item.earnedAt).toISOString() : new Date().toISOString();
    await sql.query(
      `insert into quest_badges (user_id, badge_id, earned_at)
       values ($1, $2, $3::timestamptz)
       on conflict (user_id, badge_id) do update set
         earned_at = least(quest_badges.earned_at, excluded.earned_at)`,
      [userId, item.id, earned],
    );
  }
}

export async function badgesFromProgress(
  items: StoredProgress[],
  existing: StoredBadge[] = [],
): Promise<StoredBadge[]> {
  const template = await lectureTemplate();
  const byId: Record<string, string> = {};
  for (const row of items) {
    if (row.pointId) byId[row.pointId] = row.status;
  }
  const lectures = withStatuses(template, (id: string) => byId[id] || "unseen");
  const now = Date.now();
  const computed: Record<string, StoredBadge> = {};
  for (const id of earnedBadgeIds(lectures) as string[]) {
    computed[id] = { id, earnedAt: now };
  }
  const stored: Record<string, StoredBadge> = {};
  for (const badge of existing) {
    if (badge && badge.id) stored[badge.id] = badge;
  }
  const merged = mergeBadgeMaps(stored, computed) as Record<string, StoredBadge>;
  return Object.keys(merged).map((id) => merged[id]);
}
