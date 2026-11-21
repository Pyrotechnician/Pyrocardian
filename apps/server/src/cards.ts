import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAncientCard,
  validateClassDef,
  validateSkillCard,
  validateSummonDef,
  validateWordCard,
  type AncientCardDef,
  type ClassDef,
  type SkillCardDef,
  type SummonDef,
  type WordCardDef,
} from "@pyrocardian/shared";

const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../content/cards");

function readJsonFile(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function readJsonDir(dir: string): unknown[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJsonFile(path.join(dir, f)));
}

export function loadContent() {
  const classes = readJsonFile(path.join(contentDir, "classes.json")) as ClassDef[];
  const skills = readJsonDir(path.join(contentDir, "skills")) as SkillCardDef[];
  const summons = readJsonDir(path.join(contentDir, "summons")) as SummonDef[];
  const words = readJsonDir(path.join(contentDir, "words")) as WordCardDef[];
  const ancient = readJsonDir(path.join(contentDir, "ancient")) as AncientCardDef[];

  let errors = [
    ...classes.flatMap(validateClassDef),
    ...skills.flatMap(validateSkillCard),
    ...summons.flatMap(validateSummonDef),
    ...words.flatMap(validateWordCard),
    ...ancient.flatMap(validateAncientCard),
  ];

  const seen = new Set<string>();
  for (const def of [...classes, ...skills, ...summons, ...words, ...ancient] as { id: string }[]) {
    if (seen.has(def.id)) errors.push(`重复的卡牌 id: ${def.id}`);
    seen.add(def.id);
  }

  const summonIds = new Set(summons.map((s) => s.id));
  for (const skill of skills) {
    if (skill.summonId && !summonIds.has(skill.summonId)) {
      errors.push(`技能卡 ${skill.id} 引用了不存在的召唤物 ${skill.summonId}`);
    }
  }

  const classIds = new Set(classes.map((c) => c.id));
  for (const skill of skills) {
    if (skill.classId && !classIds.has(skill.classId)) {
      errors.push(`技能卡 ${skill.id} 引用了不存在的职业 ${skill.classId}`);
    }
  }
  for (const cl of classes) {
    for (const deckId of cl.deck ?? []) {
      if (!skills.some((s) => s.id === deckId)) {
        errors.push(`职业 ${cl.id} 的卡组引用了不存在的技能卡 ${deckId}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`卡牌内容校验失败:\n${errors.join("\n")}`);
  }

  return { classes, skills, summons, words, ancient };
}
