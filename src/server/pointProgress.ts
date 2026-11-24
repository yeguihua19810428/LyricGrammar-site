import { getSql } from "@/lib/db";
import { normalizeRecord, PROGRESS_STATUS } from "@/lyric/utils/pointProgress.mjs";

export type StoredProgress = ReturnType<typeof normalizeRecord>;

const ALLOWED = new Set(Object.values(PROGRESS_STATUS));

export async function listProgress(userId: string): Promise<StoredProgress[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    point_id: string;
    status: string;
    fail_count: number;
    last_sentence: string | null;
    frame_passed: boolean;
    updated_at: string | Date;
  }>(
    "select point_id, status, fail_count, last_sentence, frame_passed, updated_at from point_progress where user_id = $1",
    [userId],
  );
  return rows.map((row) =>
    normalizeRecord({
      pointId: row.point_id,
      status: row.status,
      failCount: row.fail_count,
      lastSentence: row.last_sentence || "",
      framePassed: row.frame_passed,
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
    }),
  );
}

export async function upsertProgress(userId: string, items: StoredProgress[]): Promise<void> {
  if (!items.length) return;
  const sql = await getSql();
  for (const raw of items) {
    const item = normalizeRecord(raw);
    if (!item.pointId || item.pointId.length > 200) continue;
    if (!ALLOWED.has(item.status) || item.status === PROGRESS_STATUS.unseen) continue;
    const updated = item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString();
    await sql.query(
      `insert into point_progress (user_id, point_id, status, fail_count, last_sentence, frame_passed, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz)
       on conflict (user_id, point_id) do update set
         status = excluded.status,
         fail_count = excluded.fail_count,
         last_sentence = excluded.last_sentence,
         frame_passed = excluded.frame_passed,
         updated_at = excluded.updated_at`,
      [userId, item.pointId, item.status, item.failCount, item.lastSentence || null, item.framePassed, updated],
    );
  }
}
