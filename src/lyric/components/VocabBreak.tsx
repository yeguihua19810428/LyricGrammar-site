import React from "react";
import { Volume2 } from "lucide-react";
import type { CetHit } from "../utils/cet6";

function speak(word: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

interface VocabBreakProps {
  words: CetHit[];
  onContinue: () => void;
}

export const VocabBreak: React.FC<VocabBreakProps> = ({ words, onContinue }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold tracking-wide text-amber-700">副歌听过一遍了</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">这几个六级词先看一眼</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            剩下的歌里副歌还会再来。看完再接着听。
          </p>
        </div>
        <ul className="space-y-4 overflow-y-auto px-5 py-4">
          {words.map((item) => (
            <li key={item.word} className="border-b border-slate-100 pb-4 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{item.word}</p>
                  {item.sung.toLowerCase() !== item.word && (
                    <p className="text-sm text-slate-500">歌里唱的是 {item.sung}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => speak(item.word)}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                >
                  <Volume2 className="h-4 w-4 text-amber-600" />
                  发音
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {item.senses.map((sense) => (
                  <li key={sense.pos + sense.zh} className="text-sm leading-relaxed text-slate-700">
                    {sense.pos && <span className="mr-2 font-semibold text-amber-700">{sense.pos}</span>}
                    {sense.zh}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onContinue}
            className="h-12 w-full rounded-xl bg-amber-500 text-base font-semibold text-white"
          >
            接着听剩下的
          </button>
        </div>
      </div>
    </div>
  );
};
