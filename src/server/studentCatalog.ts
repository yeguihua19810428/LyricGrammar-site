import { readFile } from "node:fs/promises";
import path from "node:path";
import { readUserCourses } from "./courseLibrary";

const dataDir = path.join(process.cwd(), "src/lyric/data");
const audioDir = path.join(process.cwd(), "public/audio");

export type CatalogSong = {
  id?: string;
  title?: string;
  artist?: string;
  audioUrl?: string;
  lecture?: number;
  [key: string]: unknown;
};

export type CoursewarePoint = {
  id: string;
  lecture: number;
  lectureTitle: string;
  ref: string;
  oralName: string;
  bookName: string;
  say: string;
  status: string;
  song: string | null;
  artist: string | null;
  lyricLine: string | null;
  lyricTranslation: string | null;
  reason: string | null;
  songHomeLecture: number | null;
};

function isFlyingWithoutWings(title?: string): boolean {
  return /flying without wings/i.test(title || "");
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(dataDir, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function loadCoursewarePoints(): Promise<CoursewarePoint[]> {
  const raw = await readJson<{ points?: CoursewarePoint[] }>("courseware-points.json", { points: [] });
  return (raw.points || []).map((point) => ({
    id: String(point.id || ""),
    lecture: Number(point.lecture) || 0,
    lectureTitle: String(point.lectureTitle || ""),
    ref: String(point.ref || ""),
    oralName: String(point.oralName || ""),
    bookName: String(point.bookName || ""),
    say: String(point.say || ""),
    status: String(point.status || ""),
    song: point.song || null,
    artist: point.artist || null,
    lyricLine: point.lyricLine || null,
    lyricTranslation: point.lyricTranslation || null,
    reason: point.reason || null,
    songHomeLecture: point.songHomeLecture ?? null,
  }));
}

export async function loadStudentSongs(): Promise<CatalogSong[]> {
  const catalog = await readJson<CatalogSong[]>("courses-40.json", []);
  const extra = await readJson<CatalogSong[]>("extra-songs.json", []);
  const imported = await readUserCourses();
  const out: CatalogSong[] = [];
  const seen = new Set<string>();

  const push = (song: CatalogSong) => {
    const title = String(song.title || "").trim();
    if (!title || isFlyingWithoutWings(title)) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(song);
  };

  for (const song of catalog) push(song);
  for (const song of extra) push(song);
  for (const song of imported) push(song);
  return out;
}

export async function audioExists(audioUrl?: string): Promise<boolean> {
  const url = String(audioUrl || "");
  const filename = url.startsWith("/audio/") ? path.basename(url) : "";
  if (!filename) return false;
  try {
    await readFile(path.join(audioDir, filename));
    return true;
  } catch {
    return false;
  }
}
