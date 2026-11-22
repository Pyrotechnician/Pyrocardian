import { useCallback, useEffect, useState } from "react";
import type { AncientCardDef, SkillCardDef, WordCardDef } from "@pyrocardian/shared";
import { api } from "../api";
import { WordCardView } from "../components/CardView";
import type { T } from "../i18n";
import type { CardInstanceRow } from "./Collection";

interface DueRow {
  word_id: string;
  reps: number;
  due_at: number;
}

interface MeResponse {
  cards: CardInstanceRow[];
}

interface IdentifyResult {
  instanceId: string;
  card: SkillCardDef;
}

export default function Library({ token, t }: { token: string; t: T }) {
  const [words, setWords] = useState<WordCardDef[]>([]);
  const [ancientDefs, setAncientDefs] = useState<AncientCardDef[]>([]);
  const [due, setDue] = useState<DueRow[]>([]);
  const [cards, setCards] = useState<CardInstanceRow[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [identifyResult, setIdentifyResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    api<WordCardDef[]>("/content/words").then(setWords);
    api<AncientCardDef[]>("/content/ancient").then(setAncientDefs);
    api<{ due: DueRow[] }>("/words/due", { token }).then((r) => setDue(r.due));
    api<MeResponse>("/me", { token }).then((r) => setCards(r.cards));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dueWords = due
    .map((d) => words.find((w) => w.id === d.word_id))
    .filter((w): w is WordCardDef => Boolean(w));

  const ancientCards = cards.filter((c) => c.kind === "ancient");
  const ancientById = new Map(ancientDefs.map((a) => [a.id, a]));

  const review = async (wordId: string, correct: boolean) => {
    await api("/words/review", { method: "POST", token, body: { wordId, correct } });
    setRevealed(false);
    refresh();
  };

  const identify = async (instanceId: string) => {
    setError("");
    try {
      const r = await api<IdentifyResult>("/library/identify", {
        method: "POST",
        token,
        body: { instanceId },
      });
      setIdentifyResult(r);
      refresh();
    } catch (e) {
      setError(t(`error.${e instanceof Error ? e.message : "unknown"}`));
    }
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

      <h2>{t("library.ancient")}</h2>
      <div className="card-row">
        {ancientCards.map((c) => {
          const def = ancientById.get(c.def_id);
          return (
            <div key={c.instance_id}>
              <div className={`card rarity-${c.rarity}`}>
                <img
                  src={`/assets/cards/${c.def_id}.jpg`}
                  alt={def?.name ?? "ancient"}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="card-name">{def?.name ?? c.def_id}</div>
                <div className="card-text">{def?.text}</div>
              </div>
              <div className="review-buttons">
                <button onClick={() => void identify(c.instance_id)}>{t("library.identify")}</button>
              </div>
            </div>
          );
        })}
      </div>
      {ancientCards.length === 0 && <p>{t("library.noAncient")}</p>}
      {identifyResult && (
        <p className="identify-result">
          {t("library.identified", { name: identifyResult.card.name })}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
