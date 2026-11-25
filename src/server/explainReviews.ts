import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env.server";
import {
  REVIEW_FILE_NAME,
  emptyReviewFile,
  formatReviewFile,
  isExplainEditorEnabled as enabledByOptions,
  normalizeReview,
  reviewStats,
  shanghaiStamp,
  upsertReview,
} from "@/lyric/utils/explainReviews.mjs";

const dataDir = path.join(process.cwd(), "src/lyric/data");

export { REVIEW_FILE_NAME };

export function reviewFilePath(): string {
  return path.join(dataDir, REVIEW_FILE_NAME);
}

export function isExplainEditorEnabled(request?: Request): boolean {
  const host = request ? (request.headers.get("host") || "") : "";
  return enabledByOptions({
    flag: env("LYRICGRAMMAR_EXPLAIN_EDITOR"),
    nodeEnv: process.env.NODE_ENV,
    host,
  });
}

export async function readReviewFile(): Promise<{
  meta: { totalPoints: number; updatedAt: string };
  points: Record<string, { id: string; say: string; bookName?: string; reason?: string; humanRevised: boolean; revisedAt: string }>;
}> {
  try {
    const raw = JSON.parse(await readFile(reviewFilePath(), "utf8"));
    if (!raw || typeof raw !== "object") return emptyReviewFile(0);
    if (!raw.points || typeof raw.points !== "object") raw.points = {};
    if (!raw.meta || typeof raw.meta !== "object") raw.meta = { totalPoints: 0, updatedAt: "" };
    return raw;
  } catch {
    return emptyReviewFile(0);
  }
}

export async function listBasePointIds(): Promise<Set<string>> {
  const raw = JSON.parse(await readFile(path.join(dataDir, "courseware-points.json"), "utf8")) as {
    points?: Array<{ id?: string }>;
  };
  const ids = new Set<string>();
  for (const point of raw.points || []) {
    if (point && point.id) ids.add(String(point.id));
  }
  return ids;
}

export async function saveOneReview(
  body: { pointId?: string; say?: string; bookName?: string; reason?: string },
  request?: Request,
): Promise<{ ok: true; review: ReturnType<typeof normalizeReview>; stats: { total: number; revised: number } } | { ok: false; error: string; status: number }> {
  if (!isExplainEditorEnabled(request)) {
    return { ok: false, error: "讲解改写只在本地试用时开放。", status: 403 };
  }
  const ids = await listBasePointIds();
  const pointId = String(body.pointId || "").trim();
  if (!pointId || !ids.has(pointId)) {
    return { ok: false, error: "找不到这一条细点。", status: 400 };
  }
  const review = normalizeReview(body, pointId, shanghaiStamp());
  if (!review) {
    return { ok: false, error: "请写下这一条的口语讲解，再提交。", status: 400 };
  }
  const current = await readReviewFile();
  const next = upsertReview(current, review, ids.size, review.revisedAt);
  const target = reviewFilePath();
  const staged = path.join(dataDir, `.courseware-says-reviewed.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(staged, formatReviewFile(next), "utf8");
    await rename(staged, target);
  } catch (error) {
    try { await unlink(staged); } catch { /* ignore */ }
    const message = error instanceof Error ? error.message : "保存失败";
    return { ok: false, error: message, status: 500 };
  }
  return { ok: true, review, stats: reviewStats([...ids].map((id) => ({ id })), next) };
}

export async function reviewProgress(): Promise<{ total: number; revised: number }> {
  const ids = await listBasePointIds();
  const file = await readReviewFile();
  return reviewStats([...ids].map((id) => ({ id })), file);
}

