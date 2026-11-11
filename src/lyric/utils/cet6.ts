import type { Song } from "../types";
import cet6 from "../data/cet6.json";

type Sense = { pos: string; zh: string };
const book = cet6 as Record<string, Sense[]>;

export interface CetHit {
  word: string;
  sung: string;
  senses: Sense[];
  line: string;
}

const IRREGULAR: Record<string, string> = {
  found: "find",
  children: "child",
  men: "man",
  women: "woman",
};

function candidates(raw: string): string[] {
  const word = raw.toLowerCase();
  const list = [word];
  if (word.endsWith("ies") && word.length > 4) list.push(word.slice(0, -3) + "y");
  if (word.endsWith("es") && word.length > 4) list.push(word.slice(0, -2));
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) list.push(word.slice(0, -1));
  if (word.endsWith("ing") && word.length > 5) {
    list.push(word.slice(0, -3));
    list.push(word.slice(0, -3) + "e");
  }
  if (word.endsWith("ed") && word.length > 4) {
    list.push(word.slice(0, -2));
    list.push(word.slice(0, -1));
  }
  if (IRREGULAR[word]) list.push(IRREGULAR[word]);
  return list;
}

export function cet6InSong(song: Pick<Song, "lines">): CetHit[] {
  const hits: CetHit[] = [];
  const seen = new Set<string>();
  for (const line of song.lines) {
    const tokens = line.text.match(/[A-Za-z']+/g) || [];
    for (const token of tokens) {
      const head = candidates(token).find((item) => book[item]);
      if (!head || seen.has(head)) continue;
      seen.add(head);
      hits.push({
        word: head,
        sung: token,
        senses: book[head],
        line: line.text,
      });
    }
  }
  return hits;
}

export function firstChorusEnd(song: Pick<Song, "lines" | "duration">): number {
  const counts = new Map<string, number>();
  const norm = (text: string) => text.toLowerCase().replace(/[^a-z']+/g, " ").trim();
  for (const line of song.lines) {
    const key = norm(line.text);
    if (key.length < 8) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const line of song.lines) {
    const key = norm(line.text);
    if ((counts.get(key) || 0) > 1) return line.endTime;
  }
  const last = song.lines[song.lines.length - 1];
  const span = song.duration || last?.endTime || 0;
  return span > 0 ? span * 0.45 : 0;
}
