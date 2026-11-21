import { useState } from "react";
import type { SkillCardDef, WordCardDef } from "@pyrocardian/shared";

export function SkillCardView({ def }: { def: SkillCardDef }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className={`card rarity-${def.rarity}`}>
      {imgOk && (
        <img src={`/assets/cards/${def.id}.jpg`} alt={def.name} onError={() => setImgOk(false)} />
      )}
      <div className="card-cost">{def.cost}</div>
      <div className="card-name">{def.name}</div>
      <div className="card-text">{def.text}</div>
    </div>
  );
}

export function WordCardView({
  def,
  showTranslation = true,
}: {
  def: WordCardDef;
  showTranslation?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="card rarity-common word-card">
      {imgOk && <img src={`/assets/cards/${def.id}.jpg`} alt={def.word} onError={() => setImgOk(false)} />}
      <div className="card-lang">{def.lang === "de" ? "德语" : "英语"}</div>
      <div className="card-name">{def.word}</div>
      {showTranslation && <div className="card-text">{def.translation}</div>}
    </div>
  );
}
