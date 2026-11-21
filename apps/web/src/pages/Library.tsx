import { useCallback, useEffect, useState } from "react";
import type { WordCardDef } from "@pyrocardian/shared";
import { api } from "../api";
import { WordCardView } from "../components/CardView";

interface DueRow {
  word_id: string;
  reps: number;
  due_at: number;
}

export default function Library({ token }: { token: string }) {
  const [words, setWords] = useState<WordCardDef[]>([]);
  const [due, setDue] = useState<DueRow[]>([]);
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(() => {
    api<WordCardDef[]>("/content/words").then(setWords);
    api<{ due: DueRow[] }>("/words/due", { token }).then((r) => setDue(r.due));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dueWords = due
    .map((d) => words.find((w) => w.id === d.word_id))
    .filter((w): w is WordCardDef => Boolean(w));

  const review = async (wordId: string, correct: boolean) => {
    await api("/words/review", { method: "POST", token, body: { wordId, correct } });
    setRevealed(false);
    refresh();
  };

  return (
    <div>
      <h2>图书馆 · 今日待复习 {dueWords.length} 张</h2>
      <button onClick={() => setRevealed((r) => !r)}>{revealed ? "隐藏释义" : "显示释义"}</button>
      <div className="card-row">
        {dueWords.map((w) => (
          <div key={w.id}>
            <WordCardView def={w} showTranslation={revealed} />
            <div className="review-buttons">
              <button onClick={() => review(w.id, false)}>不认识</button>
              <button onClick={() => review(w.id, true)}>认识</button>
            </div>
          </div>
        ))}
      </div>
      {dueWords.length === 0 && <p>今天没有待复习的单词卡，去广场逛逛吧。</p>}
    </div>
  );
}
