import { useCallback, useEffect, useState } from "react";
import type { WordCardDef } from "@pyrocardian/shared";
import { api } from "../api";
import { WordCardView } from "../components/CardView";
import type { T } from "../i18n";

interface DueRow {
  word_id: string;
  reps: number;
  due_at: number;
}

export default function Library({ token, t }: { token: string; t: T }) {
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
      <h2>{t("library.title", { n: dueWords.length })}</h2>
      <button onClick={() => setRevealed((r) => !r)}>{revealed ? t("library.hide") : t("library.show")}</button>
      <div className="card-row">
        {dueWords.map((w) => (
          <div key={w.id}>
            <WordCardView def={w} showTranslation={revealed} t={t} />
            <div className="review-buttons">
              <button onClick={() => review(w.id, false)}>{t("library.forgot")}</button>
              <button onClick={() => review(w.id, true)}>{t("library.remember")}</button>
            </div>
          </div>
        ))}
      </div>
      {dueWords.length === 0 && <p>{t("library.empty")}</p>}
    </div>
  );
}
