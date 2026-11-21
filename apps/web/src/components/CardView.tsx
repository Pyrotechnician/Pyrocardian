import { useState } from "react";
import type { SkillCardDef, WordCardDef } from "@pyrocardian/shared";
import { localizeSkillName, localizeSkillText, type T, type UILang } from "../i18n";

export function SkillCardView({ def, lang, t }: { def: SkillCardDef; lang: UILang; t: T }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className={`card rarity-${def.rarity}`}>
      {imgOk && (
        <img src={`/assets/cards/${def.id}.jpg`} alt={def.name} onError={() => setImgOk(false)} />
      )}
      <div className="card-cost">{def.cost}</div>
      <div className="card-name">{localizeSkillName(def, lang)}</div>
      <div className="card-text">{localizeSkillText(def, lang)}</div>
    </div>
  );
}

export function WordCardView({
  def,
  showTranslation = true,
  t,
}: {
  def: WordCardDef;
  showTranslation?: boolean;
  t: T;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="card rarity-common word-card">
      {imgOk && <img src={`/assets/cards/${def.id}.jpg`} alt={def.word} onError={() => setImgOk(false)} />}
      <div className="card-lang">{t(def.lang === "de" ? "word.de" : "word.en")}</div>
      <div className="card-name">{def.word}</div>
      {showTranslation && <div className="card-text">{def.translation}</div>}
    </div>
  );
}
