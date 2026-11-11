import { readFile } from "node:fs/promises";
import path from "node:path";
import { readUserCourses } from "./courseLibrary";
import { readCoachPrompt, readDeepseekKey } from "@/server/deepseekKey";
import { focusPoint, madeExample, spokenTip, wholeBlank } from "@/lyric/utils/songFocus";
import type { Song } from "@/lyric/types";

type StoredSong = {
  title?: string;
  audioUrl?: string;
  [key: string]: unknown;
};

const audioDir = path.join(process.cwd(), "public/audio");

const README = `怎么在手机上打开
================

1. 先把整个压缩包解压，不要在压缩包里直接点。
2. 用 Chrome 打开「点这里打开.html」。歌和画面已经放在这个文件里面，手机不用再去读旁边的 mp3、mp4。
3. 不要用手机自带的「文件预览」打开。用 Chrome 菜单里的「打开」选这个 html。
4. 如果屏幕下方弹出「相关网页」，点右上角的叉关掉。那是浏览器自己的搜索，不是课件。

电脑也可以双击「点这里打开.html」。
如果没有声音，再双击「打开学生包.bat」（Windows）或「打开学生包.command」（Mac）。
《Talking to the Moon》可以点底部的「欣赏」看画面。声音仍是原来的 MP3。
`;

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storeZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    parts.push(local, file.data);
    centrals.push(central);
    offset += local.length + file.data.length;
  }

  const centralStart = offset;
  const centralBlob = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBlob.length, 12);
  end.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...parts, centralBlob, end]);
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;");
}

function renderPlayer(
  songs: StoredSong[],
  deepseekKey: string,
  coachPrompt: string,
  media: Record<string, string> = {},
  bank: unknown = {},
  book: unknown = [],
  readings: unknown = {},
  pointExam: unknown = {},
): string {
  const slim = songs.map((song) => ({
    title: song.title,
    artist: song.artist,
    duration: song.duration,
    audioUrl: song.audioUrl,
    videoUrl: song.videoUrl,
    videoPoster: song.videoPoster,
    focus: song.grammarTheme,
    tip: song.spokenTip || "",
    coach: song.coachPrompt || "",
    lecture: song.lecture || 13,
    example: song.practiceExample,
    lines: Array.isArray(song.lines)
      ? song.lines.map((line) => {
          const row = line as {
            text?: string;
            translation?: string;
            startTime?: number;
            endTime?: number;
            fullText?: string;
            cloze?: unknown;
          };
          return {
            text: row.text,
            translation: row.translation,
            startTime: row.startTime,
            endTime: row.endTime,
            fullText: row.fullText,
            cloze: row.cloze,
          };
        })
      : [],
  }));
  const payload = JSON.stringify(slim).replace(/</g, "\\u003c");
  const first = slim[0];
  const pageTitle = xml(String(first?.title || "歌曲"));
  const pagePoint = xml(String(first?.focus || ""));
  const firstLyrics = (first?.lines || [])
    .map((line) => {
      const text = xml(String(line.text || ""));
      const zh = xml(String(line.translation || ""));
      return text ? `<div class="line"><b>${text}</b><small>${zh}</small></div>` : "";
    })
    .join("");
  const deepseekUrl = "https://api.deepseek.com/chat/completions";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex,nofollow,noarchive" />
<title>${pageTitle}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
  header { position: sticky; top: 0; z-index: 5; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; }
  header strong { display: block; font-size: 17px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .point { margin: 2px 0 0; font-size: 14px; line-height: 1.35; color: #b45309; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card .small { margin: 0; color: #94a3b8; font-size: 12px; }
  .hit { background: #fde68a; border-radius: 4px; padding: 0 2px; }
  select { width: 100%; margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px; font: inherit; }
  main { padding: 12px 12px 88px; }
  body.mode-mv { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
  body.mode-mv header { flex: none; }
  body.mode-mv main { flex: 1; min-height: 0; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
  body.mode-mv .dock { position: static; flex: none; }
  .line { padding: 12px 4px; border-bottom: 1px solid #f1f5f9; }
  .line b { display: block; font-size: 18px; line-height: 1.45; }
  .line small { color: #64748b; }
  .line.on { background: #fffbeb; }
  .w { position: relative; display: inline-block; color: #94a3b8; }
  .mvline .w { color: rgba(255,255,255,.55); }
  .w i { position: absolute; left: 0; top: 0; height: 100%; width: 0; overflow: hidden; color: #f59e0b; font-style: normal; white-space: nowrap; pointer-events: none; }
  .row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
  button, textarea { font: inherit; }
  .chip { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 10px 14px; min-height: 40px; white-space: nowrap; }
  .play { width: 48px; height: 48px; border: 0; border-radius: 999px; background: #f59e0b; color: #fff; font-size: 18px; }
  .chip.on { background: #f59e0b; color: #fff; border-color: #f59e0b; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; margin-bottom: 10px; }
  .chunk { display: inline-block; margin: 4px 4px 0 0; padding: 8px 10px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; }
  .opt { display: block; width: 100%; text-align: left; margin-top: 8px; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; }
  .opt.good { border-color: #10b981; background: #ecfdf5; }
  .opt.bad { border-color: #f43f5e; background: #fff1f2; }
  textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
  .dock { position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; background: #fff; border-top: 1px solid #e2e8f0; padding-bottom: env(safe-area-inset-bottom); }
  .transport { display: flex; align-items: center; gap: 6px; padding: 8px 10px; }
  .transport .chip { padding: 8px 12px; min-height: 44px; font-size: 15px; }
  body.quiet .play, body.quiet #prev, body.quiet #next { display: none; }
  body.quiet #more { flex: 1; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 8; max-height: 78dvh; overflow: auto; background: #fff; border-radius: 16px 16px 0 0; box-shadow: 0 -8px 30px rgba(15,23,42,.16); padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); }
  .sheet[hidden] { display: none; }
  .sheet h2 { margin: 8px 0; font-size: 13px; font-weight: 600; color: #64748b; }
  .nav { display: block; }
  .nav button { display: block; width: 100%; text-align: left; border: 0; border-bottom: 1px solid #f1f5f9; background: #fff; min-height: 48px; padding: 12px 4px; font-size: 16px; color: #0f172a; }
  .nav button.on { color: #b45309; font-weight: 700; }
  .slider { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 14px; color: #64748b; }
  .slider input { flex: 1; width: 100%; accent-color: #f59e0b; height: 28px; }
  .mv { position: relative; flex: 1; min-height: 0; background: #000; display: flex; align-items: center; justify-content: center; }
  .mv video { max-width: 100%; max-height: 100%; object-fit: contain; }
  .mvline { position: absolute; left: 0; right: 0; bottom: 6%; text-align: center; padding: 0 16px; text-shadow: 0 1px 4px rgba(0,0,0,.9); pointer-events: none; }
  .mvline b { display: block; font-size: 18px; line-height: 1.35; }
  .mvline p { margin: 4px 0 0; font-size: 15px; line-height: 1.4; color: rgba(255,255,255,.9); }
</style>
</head>
<body class="${first?.videoUrl ? "mode-mv" : "mode-listen"}">
<header>
  <strong id="title">${pageTitle}</strong>
  <p id="point" class="point">${pagePoint}</p>
</header>
<main id="stage">${first?.videoUrl ? '<div class="mv"></div>' : firstLyrics}</main>
<div class="dock">
  <div class="transport">
    <button class="play" id="play" type="button">▶</button>
    <button class="chip" id="prev" type="button">上一句</button>
    <button class="chip" id="next" type="button">下一句</button>
    <button class="chip" id="more" type="button">更多</button>
  </div>
</div>
<div id="sheet" class="sheet" hidden>
  <button class="chip" id="sheet-close" type="button">收起</button>
  <h2>这一首</h2>
  <nav class="nav">
    <button type="button" data-mode="listen">歌词</button>
    <button type="button" data-mode="mv">欣赏</button>
    <button type="button" data-mode="grammar">这几句</button>
    <button type="button" data-mode="karaoke">填空</button>
    <button type="button" data-mode="builder">自己的</button>
  </nav>
  <h2>教材和题</h2>
  <nav class="nav">
    <button type="button" data-mode="book">教材</button>
    <button type="button" data-mode="exam">专四</button>
    <button type="button" data-mode="read">阅读</button>
  </nav>
  <h2>换一首</h2>
  <select id="songs"></select>
  <h2>听的时候</h2>
  <button class="chip" id="loop" type="button">循环这句</button>
  <div class="slider"><span>进度</span><input id="seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="进度" /></div>
  <div class="slider"><span>音量</span><input id="vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="音量" /></div>
  <div class="row" id="speeds"></div>
</div>
<audio id="audio" preload="none"></audio>
<script>
const SONGS = ${payload};
const LECTURES = ${JSON.stringify(bank).replace(/</g, "\\u003c")};
const BOOK = ${JSON.stringify(book).replace(/</g, "\\u003c")};
const READINGS = ${JSON.stringify(readings).replace(/</g, "\\u003c")};
const POINT_EXAM = ${JSON.stringify(pointExam).replace(/</g, "\\u003c")};
const MEDIA = ${JSON.stringify(media)};
const DEEPSEEK_KEY = ${deepseekKey ? `atob(${JSON.stringify(Buffer.from(deepseekKey).toString("base64"))})` : '""'};
const DEEPSEEK_URL = ${JSON.stringify(deepseekUrl)};
const COACH_PROMPT = ${JSON.stringify(coachPrompt)};
let coachDraft = "";
let coachSong = -1;
const coachEdits = {};
let sentenceDraft = "";
let savedKey = "";
try { savedKey = localStorage.getItem("deepseek-key") || ""; } catch (error) {}
const audio = document.getElementById("audio");
const stage = document.getElementById("stage");
const readyUrl = {};
function prepare(url) {
  const key = String(url || "").replace(/^\\//, "");
  if (!key || !MEDIA[key]) return Promise.resolve(url || "");
  if (readyUrl[key]) return Promise.resolve(readyUrl[key]);
  return new Promise(function (resolve) {
    setTimeout(function () {
      try {
        const bin = atob(MEDIA[key]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const type = key.slice(-3) === "mp4" ? "video/mp4" : "audio/mpeg";
        readyUrl[key] = URL.createObjectURL(new Blob([bytes], { type: type }));
        resolve(readyUrl[key]);
      } catch (error) {
        resolve(url || "");
      }
    }, 0);
  });
}
let index = 0;
let mode = ${first?.videoUrl ? '"mv"' : '"listen"'};
let rate = 1;
let shown = -1;
let grammarIndex = 0;
let subtitles = "both";
let loopLine = null;
let quizIndex = 0;
let quizAnswer = "";
let quizLocked = false;
let quizScore = 0;
let examIndex = 0;
let examPick = "";
let examCat = "";
let examPoint = "";
let examFrom = "";
let bookFolder = "";
let bookLec = "";
let bookOpen = "";
let readIndex = 0;
let readPick = "";
let readTrans = "";
let readZh = false;
let readMore = false;
let readFrom = "grammar";
let readOpen = false;
function song() { return SONGS[index]; }
function lines() { return (song() && song().lines) || []; }
function focusName() {
  return (song() && song().focus) || "";
}
function studyLines() {
  const tagged = lines().filter(function (line) { return line.cloze && line.cloze.blankWord; });
  if (tagged.length) return tagged;
  const point = focusName();
  if (point.indexOf("已经") === 0) {
    return lines().filter(function (line) { return /they say/i.test(line.text || ""); });
  }
  if (point.indexOf("以后") === 0 || point.indexOf("If 后面") === 0) {
    return lines().filter(function (line) { return /^\\s*(and\\s+)?if\\b/i.test(line.text || ""); });
  }
  return [];
}
function tipText() {
  if (song() && song().tip) return song().tip;
  if (focusName().indexOf("已经") === 0) {
    return "别人已经这么说了。嘴里却用 They say，不用 They said。听起来这消息现在还在起作用。";
  }
  return "两件事都是以后才发生的。If 后面那件，却当成现在来说，不加 will。will 只放在后面那句，说你到时会怎么做。";
}
function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, function (ch) {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}
function activeLine() {
  const t = audio.currentTime || 0;
  const list = lines();
  let hit = -1;
  for (let i = 0; i < list.length; i++) {
    const start = Number(list[i].startTime);
    if (!isFinite(start)) continue;
    if (t + 0.02 < start) break;
    hit = i;
  }
  return hit;
}
function studySentence(line) {
  const at = lines().indexOf(line);
  const next = lines()[at + 1];
  const ifOnly = /^\\s*(and\\s+)?if\\b/i.test(line.text || "") && !/\\b(i'll|will)\\b/i.test(line.text || "");
  const follow = next && /\\b(i'll|will)\\b/i.test(next.text || "");
  if (ifOnly && follow) {
    return {
      translation: [line.translation, next.translation].filter(Boolean).join("，"),
      parts: [
        { i: at, text: line.text },
        { i: at + 1, text: next.text }
      ]
    };
  }
  return {
    translation: line.translation || "",
    parts: [{ i: at, text: line.fullText || line.text }]
  };
}
function sentenceHtml(line) {
  const spoken = studySentence(line);
  const html = spoken.parts.map(function (part, index) {
    const comma = index ? '<span class="gap">, </span>' : "";
    return comma + '<span class="part" data-i="' + part.i + '">' + wordHtml(part.text) + "</span>";
  }).join("");
  return { html: html, translation: spoken.translation };
}
function wordHtml(text) {
  return String(text || "").split(/(\\s+)/).map(function (part) {
    if (!part || !part.trim()) return escapeHtml(part);
    const safe = escapeHtml(part);
    return '<span class="w"><i>' + safe + '</i>' + safe + '</span>';
  }).join("");
}
function closeSheet() {
  const sheet = document.getElementById("sheet");
  if (sheet) sheet.setAttribute("hidden", "");
  document.body.classList.remove("sheet-open");
}
function paintTabs() {
  document.querySelectorAll("[data-mode]").forEach(function (button) {
    button.classList.toggle("on", button.dataset.mode === mode);
  });
}
function renderListen() {
  const source = subtitles === "grammar" ? studyLines() : lines();
  const html = source.map(function (line) {
    if (subtitles === "grammar") {
      const spoken = sentenceHtml(line);
      return '<div class="line" data-hear="' + lines().indexOf(line) + '"><b>' + spoken.html +
        '</b><small>' + escapeHtml(spoken.translation) + '</small></div>';
    }
    const extra = subtitles === "en" ? "" : escapeHtml(line.translation || "");
    return '<div class="line" data-i="' + lines().indexOf(line) + '" data-t="' + line.startTime + '"><b>' + wordHtml(line.text) +
      '</b><small>' + extra + '</small></div>';
  }).join("");
  stage.innerHTML = '<div class="row">' +
    '<button class="chip" data-sub="both" type="button">中英</button>' +
    '<button class="chip" data-sub="en" type="button">只看英文</button>' +
    '<button class="chip" data-sub="grammar" type="button">只看要学的</button>' +
    '<button class="chip" id="open-grammar" type="button">听这句怎么唱</button></div>' + html;
  shown = -1;
  highlight();
}
function renderGrammar() {
  const pool = studyLines();
  const cards = pool.map(function (line) {
    const spoken = sentenceHtml(line);
    return '<div class="card"><b>' + spoken.html +
      '</b><p>' + escapeHtml(spoken.translation) + '</p><button class="chip" data-hear="' +
      lines().indexOf(line) + '" type="button">听这句</button></div>';
  }).join("");
  stage.innerHTML = '<div class="card"><b>' + escapeHtml(focusName()) + '</b><p>' + tipText() + '</p></div>' +
    (cards || '<div class="card">这首歌里还没有对上这个点的句子。</div>') +
    '<button class="chip" id="open-read" type="button">拿到阅读里看</button> ' +
    '<button class="chip" id="use-pattern" type="button">我也用这句说说自己的事</button>';
}
function quizItems() {
  const items = studyLines().filter(function (line) { return line.cloze && line.cloze.blankWord; });
  const extra = song() && song().example;
  if (extra && extra.cloze) items.push(extra);
  return items;
}
function renderQuiz() {
  const items = quizItems();
  if (!items.length) { stage.innerHTML = '<div class="card">这首歌还没有填空题。</div>'; return; }
  if (quizIndex >= items.length) {
    stage.innerHTML = '<div class="card"><b>做完了</b><p>对了 ' + quizScore + ' / ' + items.length +
      '</p><button class="chip" id="quiz-restart" type="button">再练一次</button></div>';
    return;
  }
  const line = items[quizIndex];
  const cloze = line.cloze;
  const options = (cloze.options || []).map(function (opt) {
    let cls = "opt";
    if (quizLocked && opt.toLowerCase() === String(cloze.blankWord).toLowerCase()) cls += " good";
    else if (quizLocked && opt === quizAnswer) cls += " bad";
    return '<button class="' + cls + '" data-opt="' + escapeHtml(opt) + '" type="button">' + escapeHtml(opt) + '</button>';
  }).join("");
  const spoken = line.kind === "made" ? null : sentenceHtml(line);
  const sentence = line.kind === "made"
    ? (cloze.sentenceWithBlank || line.text)
    : (cloze.sentenceWithBlank || line.fullText || line.text);
  const hear = line.startTime == null ? "" : '<button class="chip" data-hear="' + lines().indexOf(line) + '" type="button">听这句</button>';
  stage.innerHTML = '<div class="card"><p>第 ' + (quizIndex + 1) + ' / ' + items.length + ' 句</p><p>' +
    (line.kind === "made" ? "换一句你自己的" : "完整的一句") + '</p><b>' + escapeHtml(sentence) +
    '</b><p>' + escapeHtml(spoken ? spoken.translation : "") + '</p>' + hear +
    options +
    '<button class="chip" id="quiz-prev" type="button">上一题</button>' +
    '<button class="chip" id="quiz-next" type="button">下一题</button></div>';
}
function coachForSong() {
  if (song() && song().coach) return song().coach;
  if (focusName().indexOf("已经") === 0) {
    return "根据一般现在时特殊用法其中一种‘用一般现在时的语法形式，表达已经发生的事’，分析以上句子语法对不对。别人已经说过的话，用 They say 这种现在时来说，不要写成 They said。";
  }
  return "根据一般现在时特殊用法其中一种‘在从句中，用一般现在时的语法形式，表达将来发生的事’，分析以上句子语法对不对";
}
function renderBuilder() {
  const coachBox = document.getElementById("coach");
  const sentenceBox = document.getElementById("sentence");
  const keyBox = document.getElementById("key-box");
  if (coachBox && coachSong >= 0) coachEdits[coachSong] = coachBox.value;
  if (coachEdits[index] == null) coachEdits[index] = coachForSong();
  coachDraft = coachEdits[index];
  coachSong = index;
  if (sentenceBox) sentenceDraft = sentenceBox.value;
  if (keyBox && keyBox.value.trim()) savedKey = keyBox.value.trim();
  const all = studyLines();
  if (grammarIndex >= all.length) grammarIndex = 0;
  const line = all[grammarIndex] || {};
  const list = all.map(function (item, i) {
    return '<button class="line" data-pick="' + i + '" type="button"><b>' + escapeHtml(item.fullText || item.text) +
      '</b><small>' + escapeHtml(item.translation || "") + '</small></button>';
  }).join("");
  const keyField = DEEPSEEK_KEY ? "" :
    '<input id="key-box" type="password" autocomplete="off" placeholder="贴上 DeepSeek 的 sk- 钥匙，只存在这台手机" value="' + escapeHtml(savedKey) + '" />';
  stage.innerHTML = '<div class="card"><b>换成你自己的事</b><p>' + tipText() + '</p></div>' +
    list +
    '<div class="card"><b>就改这一句</b><p>' + escapeHtml(line.fullText || line.text || "") + '</p><textarea id="sentence" rows="3" placeholder="写成完整的一句。If 后面当现在说，后面接上你会怎么做。">' + escapeHtml(sentenceDraft) + '</textarea>' +
    '<p>看一看会把你写的句子，连同下面这段话，发给 DeepSeek。这段可以改成你自己的指令。</p>' +
    '<textarea id="coach" rows="4">' + escapeHtml(coachDraft) + '</textarea>' +
    keyField +
    '<button class="chip" id="check-sentence" type="button">看一看</button><div id="sentence-result"></div></div>';
}
function renderMv() {
  const current = song() || {};
  if (!current.videoUrl) {
    stage.innerHTML = '<div class="card">这首还没有画面。歌和歌词还能照常听。</div>';
    return;
  }
  const line = lines()[activeLine()] || {};
  const videoUrl = current.videoUrl;
  stage.innerHTML = '<div class="mv"><video id="mv" muted playsinline></video><div class="mvline" id="mvline" data-i="' + activeLine() + '"><b>' +
    wordHtml(line.text || "") + '</b><p>' + escapeHtml(line.translation || "") + '</p></div></div>';
  const clip = document.getElementById("mv");
  if (!clip) return;
  clip.onerror = function () {
    stage.innerHTML = '<div class="card">画面没加载出来。歌词还可以看。</div>';
  };
  prepare(videoUrl).then(function (src) {
    const node = document.getElementById("mv");
    if (!node || !src) return;
    node.src = src;
    try { node.currentTime = audio.currentTime || 0; } catch (error) {}
    if (!audio.paused) node.play();
  });
}
function lectureNo() {
  return examCat || "";
}
function lecturePack() {
  const no = lectureNo();
  return LECTURES[no] || { title: "这一讲还没有题", items: [] };
}
function examItems() {
  if (examPoint && POINT_EXAM[examPoint]) return POINT_EXAM[examPoint].items || [];
  return lecturePack().items || [];
}
function songsForLecture(no) {
  const want = String(no);
  const found = [];
  SONGS.forEach(function (item, i) {
    if (String(item.lecture || "") === want) found.push({ song: item, index: i });
  });
  return found;
}
function songLinks(no) {
  return songsForLecture(no).map(function (item) {
    return '<button class="chip" data-song="' + item.index + '" type="button">去听《' +
      escapeHtml(item.song.title) + '》</button>';
  }).join("");
}
function renderExam() {
  if (!examCat && !examPoint) {
    const keys = Object.keys(LECTURES).map(Number).filter(function (no) {
      const pack = LECTURES[String(no)];
      return pack && pack.items && pack.items.length;
    }).sort(function (a, b) { return a - b; });
    const cards = keys.map(function (no) {
      const pack = LECTURES[String(no)];
      const linked = songsForLecture(no);
      const extra = linked.length ? " · 有歌" : "";
      return '<button class="line" data-cat="' + no + '" type="button"><b>第' + no + '讲 ' +
        escapeHtml(pack.title || "") + '</b><small>' + pack.items.length + ' 题' + extra + '</small></button>';
    }).join("");
    stage.innerHTML = '<div class="card"><b>专四真题</b><p>按知识点分。这一讲有歌的话，题目里可以跳过去听。</p></div>' + cards;
    return;
  }
  const pack = lecturePack();
  const items = examItems();
  if (!items.length) {
    stage.innerHTML = '<div class="card">这一讲还没有整理好的题。</div><button class="chip" id="exam-back" type="button">全部知识点</button>';
    return;
  }
  if (examIndex >= items.length) examIndex = 0;
  const item = items[examIndex];
  const pointPack = examPoint ? POINT_EXAM[examPoint] : null;
  const options = (item.opts || []).map(function (opt) {
    let mark = "";
    if (examPick && item.answer) {
      if (opt.k === item.answer) mark = " good";
      else if (opt.k === examPick) mark = " bad";
    }
    return '<button class="opt' + mark + '" data-exam="' + opt.k + '" type="button"><b>' + opt.k + '</b> ' + escapeHtml(opt.t) + '</button>';
  }).join("");
  const revealed = examPick && item.answer
    ? '<p>答案 ' + item.answer + '。' + escapeHtml(item.note || "") + '</p>'
    : examPick
      ? '<p>这题的答案还没核对。</p>'
      : "";
  const links = pointPack ? songButtons(pointPack.songs || []) : songLinks(examCat);
  const badge = item.kind === "模拟题" ? "模拟题" : "专四真题";
  const head = pointPack
    ? badge + " · " + escapeHtml(pointPack.name || "")
    : "第" + examCat + "讲 " + escapeHtml(pack.title || "");
  const from = item.from ? '<p class="small">' + escapeHtml(item.from) + '</p>' : '';
  stage.innerHTML = '<div class="card"><b>' + head +
    '</b><p>第 ' + (examIndex + 1) + ' / ' + items.length + ' 题</p>' + from + '<p>' +
    escapeHtml(item.stem) + '</p>' + options + revealed +
    (links ? '<p>相关的歌</p>' + links : '') +
    '<button class="chip" id="exam-back" type="button">' + (examFrom === "book" ? "返回教材" : "全部知识点") + '</button> ' +
    '<button class="chip" id="exam-prev" type="button">上一题</button> ' +
    '<button class="chip" id="exam-next" type="button">下一题</button></div>';
}
function songButtons(titles) {
  return (titles || []).map(function (name) {
    let found = -1;
    SONGS.forEach(function (item, i) {
      if (item.title === name) found = i;
    });
    if (found < 0) return "";
    return '<button class="chip" data-song="' + found + '" type="button">去听《' + escapeHtml(name) + '》</button>';
  }).join("");
}
function renderBook() {
  if (!bookLec) {
    let html = '<div class="card"><b>教材</b><p>按四十讲排。点一讲，再点里面的一条。</p></div>';
    let lastGroup = "";
    (BOOK || []).forEach(function (group) {
      (group.items || []).forEach(function (lec) {
        if (group.group !== lastGroup) {
          lastGroup = group.group;
          html += '<p class="point">' + escapeHtml(group.group) + '</p>';
        }
        const pack = LECTURES[String(lec.no)] || { items: [] };
        const hasExam = (pack.items || []).length > 0;
        const hasSong = (lec.points || []).some(function (point) { return (point.songs || []).length; });
        html += '<button class="line" data-lec="' + lec.no + '" type="button"><b>第' + lec.no + '讲 ' +
          escapeHtml(lec.title || "") + '</b><small>' + (lec.points || []).length + ' 个点' +
          (hasExam ? " · 有题" : "") + (hasSong ? " · 有歌" : "") + '</small></button>';
      });
    });
    stage.innerHTML = html;
    return;
  }
  let lec = null;
  (BOOK || []).some(function (group) {
    lec = (group.items || []).find(function (item) { return String(item.no) === String(bookLec); }) || lec;
    return false;
  });
  if (!lec) { bookLec = ""; renderBook(); return; }
  if (!bookOpen) {
    let html = '<button class="chip" id="book-up" type="button">全部讲</button>';
    html += '<div class="card"><b>第' + lec.no + '讲 ' + escapeHtml(lec.title || "") + '</b><p>点一条再看。</p></div>';
    (lec.points || []).forEach(function (point) {
      const mark = (point.songs || []).length ? " · 有歌" : "";
      html += '<button class="line" data-point="' + escapeHtml(point.ref) + '" type="button"><b>' +
        escapeHtml(point.name) + '</b><small>' + escapeHtml(point.book || "") + mark + '</small></button>';
    });
    stage.innerHTML = html;
    return;
  }
  const point = (lec.points || []).find(function (item) { return item.ref === bookOpen; });
  if (!point) { bookOpen = ""; renderBook(); return; }
  const songs = songButtons(point.songs || []);
  const readings = readButtons(point.songs || []);
  const own = POINT_EXAM[point.ref];
  const ownItems = (own && own.items) || [];
  const realN = ownItems.filter(function (item) { return item.kind !== "模拟题"; }).length;
  const mockN = ownItems.length - realN;
  const examLabel = realN && mockN ? "做这一条的题" : mockN ? "做模拟题" : realN ? "做这一条的真题" : "";
  const exam = examLabel
    ? '<button class="chip" data-point-exam="' + escapeHtml(point.ref) + '" type="button">' + examLabel + '</button>'
    : "";
  stage.innerHTML = '<button class="chip" id="book-up" type="button">返回这一讲</button><div class="card"><b>' +
    escapeHtml(point.name) + '</b><p class="small">' + escapeHtml(point.book || "") + '</p><p>' +
    escapeHtml(point.say) + '</p>' + (songs ? '<div class="row">' + songs + '</div>' : '') +
    (readings ? '<div class="row">' + readings + '</div>' : '') + exam + '</div>';
}
function readButtons(titles) {
  return (titles || []).map(function (name) {
    if (!READINGS[name] || !READINGS[name].length) return "";
    let found = -1;
    SONGS.forEach(function (item, i) {
      if (item.title === name) found = i;
    });
    if (found < 0) return "";
    return '<button class="chip" data-read="' + found + '" type="button">阅读里看《' + escapeHtml(name) + '》</button>';
  }).join("");
}
function readList() {
  const title = (song() && song().title) || "";
  return READINGS[title] || [];
}
function markedHtml(text, mark) {
  const safe = escapeHtml(text);
  const bit = escapeHtml(mark || "");
  const at = bit ? safe.indexOf(bit) : -1;
  if (at < 0) return safe;
  return safe.slice(0, at) + '<span class="hit">' + bit + '</span>' + safe.slice(at + bit.length);
}
function openRead(songIndex, from) {
  index = songIndex;
  readIndex = 0;
  readPick = "";
  readTrans = "";
  readZh = false;
  readMore = false;
  readFrom = from || "grammar";
  readOpen = true;
  mode = "read";
  render();
}
function renderRead() {
  if (!readOpen) {
    let html = '<div class="card"><b>阅读</b><p>专四阅读里的长句。点一首，只看这首歌的那一点。</p></div>';
    SONGS.forEach(function (item, i) {
      const pack = READINGS[item.title];
      if (!pack || !pack.length) return;
      html += '<button class="line" data-read="' + i + '" type="button"><b>' + escapeHtml(item.title) +
        '</b><small>' + escapeHtml(item.focus || "") + ' · ' + pack.length + ' 句</small></button>';
    });
    stage.innerHTML = html;
    return;
  }
  const items = readList();
  if (!items.length) {
    stage.innerHTML = '<div class="card">这首歌还没有配上专四阅读。</div><button class="chip" id="read-back" type="button">返回</button>';
    return;
  }
  if (readIndex >= items.length) readIndex = 0;
  const item = items[readIndex];
  const options = (item.options || []).map(function (opt) {
    let cls = "opt";
    if (readPick) {
      if (opt === item.answer) cls += " good";
      else if (opt === readPick) cls += " bad";
    }
    return '<button class="' + cls + '" data-read-opt="' + escapeHtml(opt) + '" type="button">' + escapeHtml(opt) + '</button>';
  }).join("");
  const why = readPick ? '<p>' + escapeHtml(item.why || "") + '</p>' : '';
  const para = item.paragraph
    ? (readMore
      ? '<p class="small">这一句在文章里</p><p>' + markedHtml(item.paragraph, item.text) + '</p><p>' + escapeHtml(item.use || "") + '</p><button class="chip" id="read-more" type="button">收起</button>'
      : '<button class="chip" id="read-more" type="button">看它在文章里</button>')
    : '';
  const zh = readZh
    ? '<p class="small">整句中文</p><p>' + escapeHtml(item.translation || "") + '</p>'
    : '<button class="chip" id="read-zh" type="button">整句中文</button>';
  let extra = '';
  if (!readZh) {
    const choices = (item.choices || []).map(function (choice, i) {
      let cls = "opt";
      if (readTrans) {
        if (choice.ok) cls += " good";
        else if (String(i) === readTrans) cls += " bad";
      }
      return '<button class="' + cls + '" data-read-zh="' + i + '" type="button">' + escapeHtml(choice.text) + '</button>';
    }).join("");
    const miss = readTrans && item.choices && item.choices[Number(readTrans)] && !item.choices[Number(readTrans)].ok
      ? '<p>' + escapeHtml(item.choices[Number(readTrans)].miss || "") + '</p>'
      : '';
    extra = '<p>想再认一认。下面三句都是整句中文，哪句把亮出来的这一点读对了？</p>' + choices + miss;
  }
  stage.innerHTML = '<div class="card"><b>专四阅读 · ' + escapeHtml(item.year || "") + '</b><p>第 ' +
    (readIndex + 1) + ' / ' + items.length + ' 句</p><p>' + markedHtml(item.text, item.mark) + '</p>' + para + zh +
    '<p>只看这一点</p><p>' + escapeHtml(item.ask || "") + '</p>' + options + why + extra +
    '<button class="chip" id="read-back" type="button">返回</button> ' +
    '<button class="chip" id="read-prev" type="button">上一句</button> ' +
    '<button class="chip" id="read-next" type="button">下一句</button></div>';
}
function render() {
  paintTabs();
  const quiet = mode === "exam" || mode === "karaoke" || mode === "read" || mode === "book";
  document.body.className = "mode-" + mode + (quiet ? " quiet" : "");
  if (mode === "grammar") renderGrammar();
  else if (mode === "karaoke") renderQuiz();
  else if (mode === "builder") renderBuilder();
  else if (mode === "exam") renderExam();
  else if (mode === "book") renderBook();
  else if (mode === "read") renderRead();
  else if (mode === "mv") renderMv();
  else renderListen();
}
function highlight() {
  if (mode !== "listen" || subtitles === "grammar") return;
  const lineNo = activeLine();
  if (lineNo === shown) return;
  shown = lineNo;
  stage.querySelectorAll(".line").forEach(function (node, i) { node.classList.toggle("on", i === lineNo); });
  const active = stage.querySelector(".line.on");
  if (active) active.scrollIntoView({ block: "center" });
}
function loadSong(next, autoplay) {
  index = next;
  const current = song();
  if (!current) return;
  document.getElementById("title").textContent = current.title || "歌曲";
  document.getElementById("point").textContent = current.focus || "";
  document.getElementById("songs").value = String(index);
  const songIndex = next;
  prepare(current.audioUrl).then(function (src) {
    if (index !== songIndex) return;
    audio.src = src || "";
    audio.playbackRate = rate;
    if (autoplay && src) audio.play();
  });
  grammarIndex = 0;
  quizIndex = 0;
  quizAnswer = "";
  quizLocked = false;
  quizScore = 0;
  readIndex = 0;
  readPick = "";
  readTrans = "";
  readZh = false;
  readMore = false;
  loopLine = null;
  examIndex = 0;
  examPick = "";
  document.getElementById("loop").classList.remove("on");
  render();
}
function playAt(index) {
  const line = lines()[index];
  if (!line || line.startTime == null) return;
  if (loopLine !== null && loopLine !== index) {
    loopLine = null;
    const loop = document.getElementById("loop");
    if (loop) loop.classList.remove("on");
  }
  const seconds = Number(line.startTime) || 0;
  const start = function () {
    const begin = function () { audio.play(); };
    audio.addEventListener("seeked", begin, { once: true });
    try { audio.currentTime = seconds; } catch (error) { begin(); }
  };
  if (audio.readyState >= 1) start();
  else {
    audio.addEventListener("loadedmetadata", start, { once: true });
    audio.load();
  }
}
function jump(delta) {
  if (mode === "karaoke") {
    const items = quizItems();
    if (!items.length) return;
    if (quizIndex >= items.length) quizIndex = items.length - 1;
    quizIndex = Math.max(0, Math.min(items.length - 1, quizIndex + delta));
    quizAnswer = "";
    quizLocked = false;
    renderQuiz();
    const line = items[quizIndex];
    if (line && line.startTime != null) playAt(lines().indexOf(line));
    return;
  }
  if (mode === "read") {
    if (!readOpen) return;
    const items = readList();
    if (!items.length) return;
    readIndex = Math.max(0, Math.min(items.length - 1, readIndex + delta));
    readPick = "";
    readTrans = "";
    readZh = false;
    readMore = false;
    renderRead();
    return;
  }
  if (mode === "builder" || mode === "grammar") {
    const pool = studyLines();
    if (!pool.length) return;
    grammarIndex = Math.max(0, Math.min(pool.length - 1, grammarIndex + delta));
    render();
    const line = pool[grammarIndex];
    if (line && line.startTime != null) playAt(lines().indexOf(line));
    return;
  }
  const i = Math.max(0, Math.min(lines().length - 1, activeLine() + delta));
  playAt(i);
}
function paintSung() {
  document.querySelectorAll(".w i").forEach(function (node) { node.style.width = "0%"; });
  const at = activeLine();
  const line = at < 0 ? null : lines()[at];
  if (!line) return;
  const root = mode === "mv" ? document.getElementById("mvline") : stage.querySelector('[data-i="' + at + '"]');
  if (!root || (mode !== "mv" && mode !== "listen" && mode !== "grammar")) return;
  const words = root.querySelectorAll(".w");
  if (!words.length) return;
  const start = Number(line.startTime) || 0;
  let end = Number(line.endTime);
  if (!end || end <= start) {
    const next = lines()[at + 1];
    end = next && Number(next.startTime) > start ? Number(next.startTime) : start + 4;
  }
  const t = audio.currentTime || 0;
  const ratio = t >= end ? 1 : Math.max(0, (t - start) / (end - start));
  const pos = ratio * words.length;
  words.forEach(function (word, i) {
    const fill = word.querySelector("i");
    if (!fill) return;
    const part = i + 1 <= pos ? 1 : i < pos ? pos - i : 0;
    fill.style.width = Math.round(part * 100) + "%";
  });
}
function localNote(text) {
  const lower = text.toLowerCase();
  const ifSong = focusName().indexOf("以后") === 0 || focusName().indexOf("If") === 0;
  let note = "可以。这是本地判断。";
  if (text.split(/\\s+/).length < 3) note = "再写完整一点。";
  else if (ifSong) {
    const head = lower.split(/i'll|i will/)[0];
    if (lower.indexOf("if") < 0) note = "还是用 If 开头，后面接上你会怎么做。";
    else if (head.indexOf("will") >= 0) note = "If 后面别加 will。will 放在后面那句。";
    else if (lower.indexOf("will") < 0 && lower.indexOf("i'll") < 0) note = "后面那句也要写上，用 will 说你会怎么做。";
  } else if (focusName().indexOf("已经") === 0 && (lower.indexOf("they say") < 0 || lower.indexOf("they said") >= 0)) {
    note = "别人已经说过了。嘴里用 They say，别写成 They said。";
  }
  return note;
}
function currentKey() {
  const box = document.getElementById("key-box");
  const typed = box ? box.value.trim() : "";
  if (typed) {
    savedKey = typed;
    try { localStorage.setItem("deepseek-key", typed); } catch (error) {}
  }
  return DEEPSEEK_KEY || savedKey;
}
function askDeepSeek(text) {
  const coach = (document.getElementById("coach") && document.getElementById("coach").value.trim()) || coachForSong();
  const direct = function () {
    const key = currentKey();
    if (!key || !DEEPSEEK_URL) return Promise.reject(new Error("no key"));
    return fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({
        model: "deepseek-flash",
        thinking: { type: "disabled" },
        temperature: 0.2,
        messages: [{ role: "user", content: "要分析的英文句子：\\n" + text + "\\n\\n请分析上面这句英文，不要说没看到句子。要求：\\n" + coach }]
      })
    }).then(function (res) {
      if (res.status === 401) throw new Error("auth");
      if (!res.ok) throw new Error("bad");
      return res.json();
    }).then(function (data) {
      const message = data && data.choices && data.choices[0] && data.choices[0].message;
      const reply = message && message.content ? String(message.content).trim() : "";
      if (!reply) throw new Error("empty");
      return reply;
    });
  };
  if (location.protocol !== "http:" && location.protocol !== "https:") return direct();
  return fetch("/api/check-sentence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentSentence: text, instruction: coach, labeled: true })
  }).then(function (res) {
    if (!res.ok) throw new Error("bad");
    return res.json();
  }).then(function (data) {
    if (data && data.error === "auth") throw new Error("auth");
    if (data && data.reply) return String(data.reply).trim();
    throw new Error("empty");
  }).catch(function (error) {
    if (error && error.message === "auth") throw error;
    return direct();
  });
}
function checkSentence() {
  const input = document.getElementById("sentence");
  const result = document.getElementById("sentence-result");
  if (!input || !result) return;
  const text = input.value.trim();
  if (!text) {
    result.innerHTML = "<p>先把你写的英文句子打进上面那个框，再点看一看。</p>";
    return;
  }
  const local = localNote(text);
  if (!currentKey()) {
    result.innerHTML = "<p>还没有 DeepSeek 钥匙。贴上之后，看一看才会问它。</p><p>" + escapeHtml(local) + "</p>";
    return;
  }
  result.innerHTML = "<p>在问 DeepSeek…</p>";
  askDeepSeek(text).then(function (reply) {
    result.innerHTML = "<p>" + escapeHtml(reply) + "</p>";
  }).catch(function (error) {
    const why = error && error.message === "auth" ? "DeepSeek 不认现在这把钥匙。换一把再保存。" : "没连上 DeepSeek，这是本地判断。";
    result.innerHTML = "<p>" + escapeHtml(local) + "</p><p>" + why + "</p>";
  });
}
document.getElementById("songs").innerHTML = SONGS.map(function (item, i) {
  return '<option value="' + i + '">' + escapeHtml((item.title || "未命名") + (item.focus ? " · " + item.focus : "")) + '</option>';
}).join("");
document.getElementById("songs").onchange = function (event) {
  closeSheet();
  loadSong(Number(event.target.value), true);
};
document.getElementById("more").onclick = function () {
  document.getElementById("sheet").removeAttribute("hidden");
};
document.getElementById("sheet-close").onclick = function () { closeSheet(); };
document.getElementById("play").onclick = function () {
  if (!song()) return;
  if (audio.paused) audio.play(); else audio.pause();
};
document.getElementById("prev").onclick = function () { jump(-1); };
document.getElementById("next").onclick = function () { jump(1); };
document.getElementById("loop").onclick = function (event) {
  if (loopLine === null) {
    loopLine = activeLine();
    event.target.classList.add("on");
  } else {
    loopLine = null;
    event.target.classList.remove("on");
  }
};
document.getElementById("seek").oninput = function (event) { audio.currentTime = Number(event.target.value); };
document.getElementById("vol").oninput = function (event) { audio.volume = Number(event.target.value); };
document.getElementById("speeds").innerHTML = [0.75, 1, 1.25].map(function (value) {
  return '<button class="chip' + (value === 1 ? ' on' : '') + '" data-rate="' + value + '" type="button">' + value + 'x</button>';
}).join("");
document.getElementById("speeds").onclick = function (event) {
  const button = event.target.closest("[data-rate]");
  if (!button) return;
  rate = Number(button.dataset.rate);
  audio.playbackRate = rate;
  document.querySelectorAll("#speeds button").forEach(function (item) { item.classList.toggle("on", item === button); });
};
document.querySelectorAll(".nav").forEach(function (nav) {
  nav.onclick = function (event) {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    mode = button.dataset.mode;
    if (mode === "read") readOpen = false;
    if (mode === "exam") { examPoint = ""; examCat = ""; examIndex = 0; examPick = ""; examFrom = ""; }
    shown = -1;
    closeSheet();
    render();
  };
});
stage.onclick = function (event) {
  const sub = event.target.closest("[data-sub]");
  if (sub) { subtitles = sub.dataset.sub; renderListen(); return; }
  if (event.target.id === "open-grammar" || event.target.id === "use-pattern") {
    if (event.target.id === "open-grammar") {
      const found = studyLines().indexOf(lines()[activeLine()]);
      grammarIndex = found >= 0 ? found : 0;
      mode = "grammar";
    } else {
      mode = "builder";
    }
    render();
    return;
  }
  const picked = event.target.closest("[data-pick]");
  if (picked) { grammarIndex = Number(picked.dataset.pick); renderBuilder(); return; }
  const grammarButton = event.target.closest("[data-g]");
  if (grammarButton) { grammarIndex = Number(grammarButton.dataset.g); renderGrammar(); return; }
  const pattern = event.target.closest("[data-pattern]");
  if (pattern) {
    const item = ((song() && song().keyTakeawayPatterns) || [])[Number(pattern.dataset.pattern)];
    const box = document.getElementById("sentence");
    if (item && box && !box.value) box.value = item.dailyExample || "";
    return;
  }
  const hear = event.target.closest("[data-hear]");
  if (hear) { playAt(Number(hear.dataset.hear)); return; }
  const line = event.target.closest("[data-i]");
  if (line && line.classList.contains("line") && !event.target.closest("[data-opt]")) {
    playAt(Number(line.dataset.i));
    return;
  }
  const option = event.target.closest("[data-opt]");
  if (option && !quizLocked) {
    quizAnswer = option.dataset.opt;
    quizLocked = true;
    const item = quizItems()[quizIndex];
    if (item && String(item.cloze.blankWord).toLowerCase() === String(quizAnswer).toLowerCase()) quizScore += 1;
    renderQuiz();
    return;
  }
  if (event.target.id === "quiz-prev") {
    quizIndex = Math.max(0, quizIndex - 1);
    quizAnswer = "";
    quizLocked = false;
    renderQuiz();
    return;
  }
  if (event.target.id === "quiz-next") { quizIndex += 1; quizAnswer = ""; quizLocked = false; renderQuiz(); return; }
  if (event.target.id === "quiz-restart") { quizIndex = 0; quizAnswer = ""; quizLocked = false; quizScore = 0; renderQuiz(); return; }
  if (event.target.id === "check-sentence") checkSentence();
  if (event.target.id === "open-read") {
    openRead(index, "grammar");
    return;
  }
  if (event.target.id === "read-back") {
    readOpen = false;
    mode = "read";
    render();
    return;
  }
  if (event.target.id === "read-zh") {
    readZh = true;
    readTrans = "";
    renderRead();
    return;
  }
  if (event.target.id === "read-more") {
    readMore = !readMore;
    renderRead();
    return;
  }
  if (event.target.id === "read-prev") {
    readIndex = Math.max(0, readIndex - 1);
    readPick = "";
    readTrans = "";
    readZh = false;
    readMore = false;
    renderRead();
    return;
  }
  if (event.target.id === "read-next") {
    readIndex += 1;
    readPick = "";
    readTrans = "";
    readZh = false;
    readMore = false;
    renderRead();
    return;
  }
  const readOpt = event.target.closest("[data-read-opt]");
  if (readOpt && !readPick) {
    readPick = readOpt.dataset.readOpt;
    renderRead();
    return;
  }
  const readChoice = event.target.closest("[data-read-zh]");
  if (readChoice && !readTrans && !readZh) {
    readTrans = readChoice.dataset.readZh;
    renderRead();
    return;
  }
  const toRead = event.target.closest("[data-read]");
  if (toRead) {
    openRead(Number(toRead.dataset.read), "book");
    return;
  }
  const toSong = event.target.closest("[data-song]");
  if (toSong) {
    const next = Number(toSong.dataset.song);
    mode = SONGS[next] && SONGS[next].videoUrl ? "mv" : "listen";
    loadSong(next, false);
    return;
  }
  const examOption = event.target.closest("[data-exam]");
  if (examOption && !examPick) {
    examPick = examOption.dataset.exam;
    renderExam();
    return;
  }
  const folder = event.target.closest("[data-folder]");
  if (folder) {
    bookFolder = folder.dataset.folder;
    bookLec = "";
    bookOpen = "";
    renderBook();
    return;
  }
  const lecBtn = event.target.closest("[data-lec]");
  if (lecBtn) {
    bookLec = lecBtn.dataset.lec;
    bookOpen = "";
    renderBook();
    return;
  }
  const pointBtn = event.target.closest("[data-point]");
  if (pointBtn) {
    bookOpen = pointBtn.dataset.point;
    renderBook();
    return;
  }
  if (event.target.id === "book-home") {
    bookFolder = "";
    bookLec = "";
    bookOpen = "";
    renderBook();
    return;
  }
  if (event.target.id === "book-up") {
    if (bookOpen) bookOpen = "";
    else bookLec = "";
    renderBook();
    return;
  }
  const pointExam = event.target.closest("[data-point-exam]");
  if (pointExam) {
    examPoint = pointExam.getAttribute("data-point-exam") || "";
    examCat = "";
    examIndex = 0;
    examPick = "";
    examFrom = "book";
    mode = "exam";
    render();
    return;
  }
  const openedLecture = event.target.closest("[data-book]");
  if (openedLecture) {
    examCat = openedLecture.dataset.book;
    examPoint = "";
    examIndex = 0;
    examPick = "";
    examFrom = "book";
    mode = "exam";
    render();
    return;
  }
  const cat = event.target.closest("[data-cat]");
  if (cat) {
    examCat = cat.dataset.cat;
    examPoint = "";
    examFrom = "";
    examIndex = 0;
    examPick = "";
    renderExam();
    return;
  }
  if (event.target.id === "exam-back") {
    examCat = "";
    examPoint = "";
    examIndex = 0;
    examPick = "";
    if (examFrom === "book") {
      mode = "book";
      render();
    } else {
      renderExam();
    }
    return;
  }
  if (event.target.id === "exam-prev") {
    const total = examItems().length || 1;
    examIndex = (examIndex - 1 + total) % total;
    examPick = "";
    renderExam();
    return;
  }
  if (event.target.id === "exam-next") {
    const total = examItems().length || 1;
    examIndex = (examIndex + 1) % total;
    examPick = "";
    renderExam();
  }
};
audio.ontimeupdate = function () {
  const seek = document.getElementById("seek");
  seek.max = String(audio.duration || (song() && song().duration) || 0);
  seek.value = String(audio.currentTime || 0);
  document.getElementById("play").textContent = audio.paused ? "▶" : "❚❚";
  if (loopLine !== null) {
    const line = lines()[loopLine];
    if (line && audio.currentTime > line.endTime + 0.05) audio.currentTime = line.startTime;
  }
  highlight();
  if (mode === "mv") {
    const clip = document.getElementById("mv");
    const cap = document.getElementById("mvline");
    const line = lines()[activeLine()] || {};
    if (cap && cap.dataset.n !== String(activeLine())) {
      cap.dataset.n = String(activeLine());
      cap.dataset.i = String(activeLine());
      cap.innerHTML = "<b>" + wordHtml(line.text || "") + "</b><p>" + escapeHtml(line.translation || "") + "</p>";
    }
    if (clip) {
      try {
        if (Math.abs(clip.currentTime - audio.currentTime) > 0.45) clip.currentTime = audio.currentTime;
      } catch (error) {}
      if (audio.paused) clip.pause();
      else clip.play();
    }
  }
  paintSung();
};
audio.onplay = audio.onpause = audio.ontimeupdate;
if (song()) loadSong(0, false);
</script>
</body>
</html>
`;
}

const WINDOWS_OPENER = `@echo off
cd /d "%~dp0"
where python >nul 2>nul && start "" http://127.0.0.1:8848/ && python -m http.server 8848 && goto :eof
where py >nul 2>nul && start "" http://127.0.0.1:8848/ && py -m http.server 8848 && goto :eof
echo 没有找到 Python。请直接双击 index.html。
pause
`;

const MAC_OPENER = `#!/bin/bash
cd "$(dirname "$0")"
python3 -m http.server 8848 >/dev/null 2>&1 &
sleep 0.4
open "http://127.0.0.1:8848/"
wait
`;

export async function packSongs(preview: boolean): Promise<StoredSong[]> {
  const courses = await readUserCourses();
  const packed: StoredSong[] = [];
  const root = preview ? "/" : "";
  for (const course of courses) {
    const url = String(course.audioUrl || "");
    const filename = url.startsWith("/audio/") ? path.basename(url) : "";
    let audioPacked = false;
    if (filename) {
      try {
        await readFile(path.join(audioDir, filename));
        audioPacked = true;
      } catch {
        audioPacked = false;
      }
    }
    const lines = Array.isArray(course.lines) ? course.lines : [];
    const songLines = lines as Song["lines"];
    const withWhole = songLines.map((line) => {
      const whole = wholeBlank({ lines: songLines }, line);
      if (!line.cloze) return { ...line, fullText: whole.text };
      return {
        ...line,
        fullText: whole.text,
        cloze: { ...line.cloze, sentenceWithBlank: whole.blank },
      };
    });
    const title = String(course.title || "");
    const moon = /talking to the moon/i.test(title);
    const count = /count on me/i.test(title);
    const named = String(course.videoUrl || "");
    packed.push({
      ...course,
      lines: withWhole,
      audioUrl: audioPacked ? `${root}audio/${filename}` : "",
      videoUrl: named
        ? `${root}${named.replace(/^\//, "")}`
        : moon
          ? `${root}mv/moon-fast.mp4`
          : count
            ? `${root}mv/count-on-me-fast.mp4`
            : "",
      videoPoster: moon ? `${root}mv/poster.jpg` : count ? `${root}mv/count-on-me-poster.jpg` : "",
      grammarTheme: String(course.grammarTheme || focusPoint(course as unknown as Song)),
      spokenTip: spokenTip(course as unknown as Song),
      coachPrompt: String(course.coachPrompt || ""),
      lecture: Number(course.lecture) || 13,
      practiceExample: madeExample(course as unknown as Song),
    });
  }
  return packed;
}

export async function renderStudentHtml(preview: boolean): Promise<string> {
  const songs = await packSongs(preview);
  const media: Record<string, string> = {};
  if (!preview) {
    for (const song of songs) {
      for (const url of [song.audioUrl, song.videoUrl]) {
        const rel = String(url || "").replace(/^\//, "");
        if (!rel || media[rel]) continue;
        try {
          media[rel] = (await readFile(path.join(process.cwd(), "public", rel))).toString("base64");
        } catch {
          // Keep the relative path when the file is not on disk.
        }
      }
    }
  }
  return renderPlayer(songs, await readDeepseekKey(), await readCoachPrompt(), media, JSON.parse(await readFile(path.join(process.cwd(), "src/lyric/data/lectures-exam.json"), "utf8")), JSON.parse(await readFile(path.join(process.cwd(), "src/lyric/data/book-points.json"), "utf8")), JSON.parse(await readFile(path.join(process.cwd(), "src/lyric/data/reading-links.json"), "utf8")), JSON.parse(await readFile(path.join(process.cwd(), "src/lyric/data/point-exam.json"), "utf8")));
}

export async function buildOfflinePackage(): Promise<{ zip: Buffer; songCount: number }> {
  const courses = await readUserCourses();
  const packed = await packSongs(false);
  const files: Array<{ name: string; data: Buffer }> = [];

  for (const course of courses) {
    const url = String(course.audioUrl || "");
    const filename = url.startsWith("/audio/") ? path.basename(url) : "";
    if (!filename) continue;
    try {
      const data = await readFile(path.join(audioDir, filename));
      files.push({ name: `学生包/audio/${filename}`, data });
    } catch {
      // Skip a song file that is not on disk.
    }
  }

  const page = Buffer.from(await renderStudentHtml(false), "utf8");
  const root = "学生包";
  const mvFiles = [
    ["public/mv/moon-fast.mp4", `${root}/mv/moon-fast.mp4`],
    ["public/mv/poster.jpg", `${root}/mv/poster.jpg`],
    ["public/mv/count-on-me-fast.mp4", `${root}/mv/count-on-me-fast.mp4`],
    ["public/mv/count-on-me-poster.jpg", `${root}/mv/count-on-me-poster.jpg`],
  ] as const;
  for (const [from, to] of mvFiles) {
    try {
      files.push({ name: to, data: await readFile(path.join(process.cwd(), from)) });
    } catch {
      // Songs still export if a picture is missing.
    }
  }
  files.unshift(
    { name: `${root}/请先看我.txt`, data: Buffer.from(README, "utf8") },
    {
      name: `${root}/songs.json`,
      data: Buffer.from(JSON.stringify(packed, null, 2) + "\n", "utf8"),
    },
    { name: `${root}/点这里打开.html`, data: page },
    { name: `${root}/index.html`, data: page },
    { name: `${root}/打开学生包.bat`, data: Buffer.from(WINDOWS_OPENER, "utf8") },
    { name: `${root}/打开学生包.command`, data: Buffer.from(MAC_OPENER, "utf8") },
  );

  return { zip: storeZip(files), songCount: packed.length };
}
