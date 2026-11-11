// 基建：歌词句子 → 教材句法细目。key 用教科书编号，不用应用里的按钮。
// 只标字面就能认定的那一层。认定不了的细目留空，不往上凑，也不硬填。
import fs from "fs";
import path from "path";

const root = "/workspace";
const lyricDir = path.join(root, "artifacts/lyrics");
const tree = JSON.parse(fs.readFileSync(path.join(root, "src/lyric/data/textbook.knowledge.json"), "utf8"));

const catalog = [];
function walk(node, trail) {
  const next = [...trail, node.title];
  if (node.ref) catalog.push({ ref: node.ref, title: node.title, path: next.join(" / ") });
  for (const c of node.children || []) walk(c, next);
}
walk(tree.children.find((c) => c.title === "句法"), []);

const byRef = new Map(catalog.map((item) => [item.ref, item]));

const GENERIC = new Set([
  "28.1/2)",
  "28.2/1)",
  "28.2/2)",
  "31.2/1)",
  "31.2/2)",
  "31.2/3)",
  "32.2/1)",
  "36.1/2)",
]);

function has(re, text) {
  re.lastIndex = 0;
  return re.test(text);
}

const NOT_SUPERLATIVE = new Set("rest forest nest test west chest interest honest harvest guest request protest suggest contest".split(" "));

function tagsFor(text) {
  const t = ` ${text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")} `;
  const trimmed = t.trim();
  const q = /[?？]["']?\s*$/.test(trimmed);
  const out = new Set();

  if (has(/\bthere(?:'s|'re| is| are| was| were| will be|'ll be)\b/i, t)) out.add("29.1/1)");
  if (has(/\bthere being\b|\bfor there to be\b/i, t)) out.add("29.2");

  if (has(/\bit(?:'s| is| was)\s+(?:clear|hard|easy|important|obvious|difficult|possible|impossible|true|likely|unlikely)\s+(?:that|to)\b/i, t)) out.add("30.1/2)");
  if (has(/\bit(?:'s| is| was)\s+(?:no use|a pity|time)\s+(?:that|to)\b/i, t)) out.add("30.1/2)");
  if (has(/\bit\s+(?:seems|appears|looks|happens)\s+that\b/i, t)) out.add("30.1/3)");
  if (has(/\bit(?:'s| is| was)\s+(?:the |a |my |your |his |her )?[a-z]+\s+(?:that|who)\b/i, t)
    && !has(/\bit(?:'s| is| was)\s+(?:clear|hard|easy|important|obvious|difficult|possible|impossible|true|likely|unlikely|no|a)\b/i, t)) {
    out.add("39.4/1)");
    out.add("30.1/5)");
  }

  if (!q && has(/\b(?:never|n't| not )\b/i, t)) out.add("28.1/2)");
  if (has(/\bi\s+don't\s+think\b|\bi\s+don't\s+believe\b|\bdoesn't\s+seem\b/i, t)) out.add("30.2/3)");

  if (q && has(/^(?:what|who|whom|whose|where|when|why|how)\b/i, trimmed) && !has(/^what a\b/i, trimmed)) out.add("28.2/2)");
  if (q && has(/^(?:am|is|are|was|were|do|does|did|can|could|will|would|have|has|shall|should)\b/i, trimmed)) out.add("28.2/1)");
  if (q && has(/\bor\b/i, t)) out.add("28.2/3)");
  if (has(/,\s*(?:do|don't|does|doesn't|is|isn't|are|aren't|will|won't|can|can't|would|have|has|did|didn't)\s+(?:i|you|we|they|he|she|it)\b/i, t)) out.add("28.2/4)");

  if (!q && has(/^(?:please |don't |do not |let's |let me |never )\b/i, trimmed)) out.add("28.3/1)");
  if (!q && (has(/\bwhat a\b/i, t) || has(/\bhow\s+(?:beautiful|sweet|deep|strange|wonderful|lovely)\b/i, t))) out.add("28.3/2)");

  if (has(/\b(?:because|although|though|unless|when|while|before|after|since|if)\b/i, t)) out.add("32.2/1)");
  if (has(/\b(?:as soon as|even if|even though|so that|as long as|as if)\b/i, t)) out.add("32.2/2)");
  if (has(/\b(?:because|although|though|unless|when|while|if)\b/i, t)) out.add("32.3/2)");

  const wouldHave = has(/\b(?:would|could|might|should)(?:\s+not|\s+n't)?\s+have\b|\bwould've\b|\bcould've\b/i, t);
  const would = has(/\b(?:would|might|'d)\b/i, t);
  const ifWere = has(/\bif\b[\s\S]{0,50}\b(?:were|was|weren't|wasn't|knew|did)\b/i, t);
  const ifHadParticiple = has(/\bif\b[\s\S]{0,40}\bhad\s+(?:been|had|\w+ed)\b/i, t);
  if (has(/\bif\b/i, t) && ifWere && would && !wouldHave) out.add("33.2/1)");
  if (ifHadParticiple && wouldHave) out.add("33.3/1)");
  if (ifHadParticiple && would && !wouldHave) out.add("33.4/1)");
  if (has(/^(?:should|were)\s+(?:i|you|he|she|we|they)\b/i, trimmed) && would) out.add("33.2/2)");
  if (has(/\bif\b[\s\S]{0,30}\bshould\b|\bwere to\b/i, t)) out.add("33.2/2)");

  if (!q && has(/,\s*(?:who|which|whose|whom)\b/i, t)) {
    out.add("34.2/2)");
    out.add("34.3/3)");
  } else if (!q && has(/\b(?:who|which|whom|whose)\b/i, t)) {
    out.add("34.2/1)");
    out.add("34.3/1)");
  }

  if (has(/\bas\s+(?:(?!soon|if|well|though|long)\w+\s+){1,4}as\b/i, t)) out.add("26.2/1)");
  if (has(/\b\w+er than\b|\bmore\s+\w+(?:\s+\w+){0,2}\s+than\b/i, t)) out.add("26.2/2)");
  if (has(/\bthe most\s+\w+/i, t)) out.add("26.2/3)");
  const est = trimmed.match(/\bthe\s+([a-z]{4,}est)\b/i);
  if (est && !NOT_SUPERLATIVE.has(est[1].toLowerCase())) out.add("26.2/3)");
  if (has(/\bnot so much\b[\s\S]{0,50}\bas\b/i, t)) out.add("26.3/2)");
  if (has(/\bthe more\b[\s\S]{0,50}\bthe more\b|\bmore and more\b/i, t)) out.add("26.3/4)");

  if (has(/^(?:never|seldom|rarely|hardly|little)\s+(?:have|has|had|do|does|did|am|is|are|was|were|can|could|will|would)\s+\w+/i, trimmed)) out.add("39.3/2)");
  if (has(/^(?:had|were|should)\s+(?:i|you|he|she|we|they|it)\b/i, trimmed)) out.add("39.3/2)");
  if (has(/\b(?:so|nor|neither)\s+(?:do|does|did|am|is|are|was|were|can|could|will|would|have|has)\s+(?:i|you|we|they|he|she|it)\b/i, t)) out.add("39.3/2)");

  if (has(/\bboth\b[\s\S]{0,40}\band\b/i, t)) out.add("5.1/1)");
  if (has(/\b(?:either|neither)\b[\s\S]{0,40}\b(?:or|nor)\b/i, t)) out.add("5.1/2)");
  if (has(/\b(?:when|while|if|although|though)\s+(?:young|old|necessary|possible|tired|ready|alone|true|needed)\b/i, t)) out.add("32.4/1)");
  if (has(/\bthere being\b|\ball\s+\w+\s+being\b/i, t)) out.add("32.5/1)");

  if (has(/\b(?:asked|ask|wondered)\b[\s\S]{0,24}\b(?:if|whether)\b/i, t)) out.add("35.2/1)");
  if (has(/\b(?:think|hope|guess|believe|suppose)\s+so\b|\bif so\b/i, t)) out.add("37.3/2)");
  if (has(/\bdo so\b|\bdid so\b/i, t)) out.add("37.2/2)");
  if (has(/\b(?:a|the|this|that|another)\s+(?:\w+\s+)?one\b|\bones\b/i, t)) out.add("37.1/2)");
  if (has(/\b(?:very|too|quite)\s+\w+/i, t)) out.add("36.1/2)");
  if (!q && has(/\b(?:what|whatever|whoever)\s+(?:i|you|we|they|he|she|it)\b/i, t)) out.add("32.3/1)");
  if (has(/\b(\w+)\b(?:\s+\1\b){2,}/i, t)) out.add("39.1/2)");
  if (has(/\b(?:however|therefore|meanwhile|instead)\b/i, t)) out.add("40.2/1)");

  if (has(/\band\b/i, t)) out.add("31.2/1)");
  if (has(/\bor\b/i, t)) out.add("31.2/2)");
  if (has(/\bbut\b/i, t)) out.add("31.2/3)");

  return [...out].filter((ref) => byRef.has(ref));
}

function cleanDisplay(s) {
  return s.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

function norm(s) {
  return s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9'\s]/g, " ").replace(/\s+/g, " ").trim();
}

const files = fs.readdirSync(lyricDir).filter((f) => f.endsWith(".lrc"));
const bucket = new Map();
let songs = 0;
let unreadable = 0;
let lines = 0;
const lineRe = /^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/;

for (const file of files) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(lyricDir, file), "utf8");
  } catch {
    unreadable++;
    continue;
  }
  songs++;
  const song = file.replace(/\.lrc$/i, "");
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (!m) continue;
    const text = cleanDisplay(m[3]);
    if (!text || text.length < 2) continue;
    if (/^(oh|yeah|na|la|ah|uh|hey|ooh)([\s-]+\1)*[.!]?$/i.test(text)) continue;
    rows.push(text);
    lines++;
  }
  for (let i = 0; i < rows.length; i++) {
    let text = rows[i];
    if (/^\s*(?:and\s+)?if\b/i.test(text) && !/\b(?:will|would|'ll|'d)\b/i.test(text) && rows[i + 1]) {
      text = `${text} ${rows[i + 1]}`;
    }
    const key = norm(text);
    if (key.length < 8) continue;
    const refs = tagsFor(text);
    if (!refs.length) continue;
    let row = bucket.get(key);
    if (!row) {
      row = { t: text, songs: new Set(), refs: new Set() };
      bucket.set(key, row);
    }
    row.songs.add(song);
    for (const ref of refs) row.refs.add(ref);
  }
}

const points = {};
for (const item of catalog) {
  points[item.ref] = { title: item.title, path: item.path, generic: GENERIC.has(item.ref), count: 0, sentences: [] };
}
for (const row of bucket.values()) {
  const songList = [...row.songs].sort();
  for (const ref of row.refs) {
    points[ref].count++;
    points[ref].sentences.push({ t: row.t, songs: songList });
  }
}
for (const ref of Object.keys(points)) {
  points[ref].sentences.sort((a, b) => b.songs.length - a.songs.length || a.t.localeCompare(b.t));
  if (!points[ref].count) delete points[ref].sentences;
}

const hit = Object.values(points).filter((p) => p.count).length;
const out = {
  note: "基建。key 是教材句法细目，不是应用按钮。同一句只留一次，歌名并列。空着的细目是字面认定不了，不是歌里没有。generic 太常见，不能当一首歌的唯一知识点。",
  songs,
  unreadable,
  lyricLines: lines,
  uniqueSentences: bucket.size,
  catalog: catalog.length,
  hit,
  points,
};
const dest = path.join(root, "src/lyric/data/syntax-by-point.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log(JSON.stringify({
  songs, unreadable, lines, unique: bucket.size, catalog: catalog.length, hit, mb: (fs.statSync(dest).size / 1048576).toFixed(1),
}, null, 2));
for (const [ref, p] of Object.entries(points).filter(([, p]) => p.count).sort((a, b) => b[1].count - a[1].count)) {
  console.log(`${p.generic ? "泛" : "专"}\t${p.count}\t${ref}\t${p.title}`);
}
