import { useEffect, useState } from "react";
import type { ClassDef, SkillCardDef, WordCardDef } from "@pyrocardian/shared";
import { api } from "../api";
import { SkillCardView, WordCardView } from "../components/CardView";
import { localizeClassName, type T, type UILang } from "../i18n";

export interface CardInstanceRow {
  instance_id: string;
  kind: "character" | "skill" | "word";
  def_id: string;
  rarity: string;
  class_id: string | null;
  name: string | null;
  created_at: number;
}

export default function Collection({
  token,
  cards,
  lang,
  t,
}: {
  token: string;
  cards: CardInstanceRow[];
  lang: UILang;
  t: T;
}) {
  const [classes, setClasses] = useState<ClassDef[]>([]);
  const [skills, setSkills] = useState<SkillCardDef[]>([]);
  const [words, setWords] = useState<WordCardDef[]>([]);

  useEffect(() => {
    api<ClassDef[]>("/content/classes").then(setClasses);
    api<SkillCardDef[]>("/content/skills").then(setSkills);
    api<WordCardDef[]>("/content/words").then(setWords);
  }, []);

  const skillById = new Map(skills.map((s) => [s.id, s]));
  const wordById = new Map(words.map((w) => [w.id, w]));
  const classById = new Map(classes.map((c) => [c.id, c]));

  const characters = cards.filter((c) => c.kind === "character");
  const skillCards = cards.filter((c) => c.kind === "skill");
  const wordCards = cards.filter((c) => c.kind === "word");

  return (
    <div>
      <h2>{t("collection.characters")}</h2>
      <div className="card-row">
        {characters.map((c) => {
          const cls = c.class_id ? classById.get(c.class_id as ClassDef["id"]) : undefined;
          return (
            <div key={c.instance_id} className={`card rarity-${c.rarity}`}>
              <div className="card-name">{c.name ?? c.def_id}</div>
              <div className="card-text">
                {cls ? localizeClassName(cls, lang) : c.class_id} ·{" "}
                {cls?.combat ? t("collection.combat") : t("collection.functional")}
              </div>
            </div>
          );
        })}
      </div>
      <h2>{t("collection.skills")}</h2>
      <div className="card-row">
        {skillCards.map((c) => {
          const def = skillById.get(c.def_id);
          return def ? <SkillCardView key={c.instance_id} def={def} lang={lang} t={t} /> : null;
        })}
      </div>
      <h2>{t("collection.words")}</h2>
      <div className="card-row">
        {wordCards.map((c) => {
          const def = wordById.get(c.def_id);
          return def ? <WordCardView key={c.instance_id} def={def} t={t} /> : null;
        })}
      </div>
    </div>
  );
}
