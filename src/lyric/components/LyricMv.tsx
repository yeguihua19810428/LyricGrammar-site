import React, { useEffect, useRef } from 'react';
import { Song } from '../types';

const CLIPS: Array<{ match: RegExp; src: string; wide?: boolean }> = [
  { match: /talking to the moon/i, src: '/mv/moon-fast.mp4' },
  { match: /count on me/i, src: '/mv/count-on-me-fast.mp4' },
  { match: /^someone like you$/i, src: '/mv/someone-like-you-fast.mp4', wide: true },
  { match: /^blank space$/i, src: '/mv/blank-space-fast.mp4', wide: true },
  { match: /^lovely$/i, src: '/mv/lovely-fast.mp4', wide: true },
];

function sungWords(text: string, start: number, end: number, now: number) {
  const parts = text.split(/(\s+)/);
  const words = parts.filter((part) => part.trim());
  const span = Math.max(0.3, end - start);
  const ratio = Math.max(0, Math.min(1, (now - start) / span));
  const cursor = ratio * words.length;
  let wordIndex = 0;
  return parts.map((part, index) => {
    if (!part.trim()) return <span key={index}>{part}</span>;
    const fill = wordIndex + 1 <= cursor ? 1 : wordIndex < cursor ? cursor - wordIndex : 0;
    wordIndex += 1;
    return (
      <span key={index} className="relative inline-block text-white/60">
        <span
          className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-300"
          style={{ width: `${Math.round(fill * 100)}%` }}
        >
          {part}
        </span>
        {part}
      </span>
    );
  });
}

interface LyricMvProps {
  song: Song;
  isPlaying: boolean;
  currentTime: number;
  activeLineIndex: number;
  onTogglePlay: () => void;
  onStartLesson: () => void;
}

export const LyricMv: React.FC<LyricMvProps> = ({
  song,
  isPlaying,
  currentTime,
  activeLineIndex,
  onTogglePlay,
  onStartLesson,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const line = song.lines[activeLineIndex];
  const next = song.lines[activeLineIndex + 1];
  const start = line?.startTime ?? 0;
  const end = line && line.endTime > start ? line.endTime : next?.startTime ?? start + 4;
  const showing = Boolean(line?.text) && currentTime + 0.05 >= start;
  const clip = CLIPS.find((item) => item.match.test(song.title));

  const playClip = () => {
    const media = videoRef.current;
    if (!media) return;
    media.muted = true;
    if (Math.abs(media.currentTime - currentTime) > 1.2 && media.readyState >= 1) {
      media.currentTime = currentTime;
    }
    media.play().catch(() => undefined);
  };

  useEffect(() => {
    const media = videoRef.current;
    if (!media || !clip) return;
    if (!isPlaying) {
      media.pause();
      return;
    }
    if (media.readyState >= 1 && Math.abs(media.currentTime - currentTime) > 1.2) {
      media.currentTime = currentTime;
    }
    if (media.paused) playClip();
  }, [isPlaying, currentTime, clip, song.id]);

  const toggle = () => {
    if (isPlaying) {
      videoRef.current?.pause();
    } else {
      playClip();
    }
    onTogglePlay();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-amber-700">第一步 · 先欣赏</p>
          <p className="text-sm text-slate-500">先把这首看完。语法等一下再讲。</p>
        </div>
        <button
          type="button"
          onClick={onStartLesson}
          className="shrink-0 min-h-11 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white cursor-pointer"
        >
          第二步 · 看这几句
        </button>
      </div>
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-3xl bg-slate-950 shadow-lg cursor-pointer ${clip?.wide ? 'aspect-video max-w-3xl' : 'aspect-[9/16] max-w-md'}`}
        onClick={toggle}
      >
        {clip ? (
          <video
            key={clip.src}
            ref={videoRef}
            src={clip.src}
            className={`absolute inset-0 h-full w-full ${clip.wide ? 'object-contain' : 'object-cover'}`}
            muted
            playsInline
            preload="auto"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
          className="absolute top-4 right-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-900 cursor-pointer"
        >
          {isPlaying ? '暂停' : '播放'}
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4 text-center text-white">
          <p className="text-[11px] tracking-wide text-amber-100/90">
            {song.artist} · {song.title}
          </p>
          {showing && line ? (
            <>
              <p className="mt-2 text-xl font-bold leading-snug [text-wrap:balance] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {sungWords(line.text, start, end, currentTime)}
              </p>
              {line.translation ? (
                <p className="mt-1 text-sm leading-snug text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {line.translation}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-white/70">按播放</p>
          )}
        </div>
      </div>
    </div>
  );
};
