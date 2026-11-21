import { useEffect, useState } from "react";
import type { ClassDef, SkillCardDef, WordCardDef } from "@pyrocardian/shared";
import { api } from "../api";
import { SkillCardView, WordCardView } from "../components/CardView";

export interface CardInstanceRow {
  instance_id: string;
  kind: "character" | "skill" | "word";
  def_id: string;
  rarity: string;
  class_id: string | null;
  name: string | null;
  created_at: number;
}

export default function Collection({ token, cards }: { token: string; cards: CardInstanceRow[] }) {
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
      <h2>角色卡</h2>
      <div className="card-row">
        {characters.map((c) => {
          const cls = c.class_id ? classById.get(c.class_id as ClassDef["id"]) : undefined;
          return (
            <div key={c.instance_id} className={`card rarity-${c.rarity}`}>
              <div className="card-name">{c.name ?? c.def_id}</div>
              <div className="card-text">
                {cls?.name ?? c.class_id} · {cls?.combat ? "可参战" : "功能职业"}
              </div>
            </div>
          );
        })}
      </div>
      <h2>技能卡</h2>
      <div className="card-row">
        {skillCards.map((c) => {
          const def = skillById.get(c.def_id);
          return def ? <SkillCardView key={c.instance_id} def={def} /> : null;
        })}
      </div>
      <h2>单词卡</h2>
      <div className="card-row">
        {wordCards.map((c) => {
          const def = wordById.get(c.def_id);
          return def ? <WordCardView key={c.instance_id} def={def} /> : null;
        })}
      </div>
    </div>
  );
}
