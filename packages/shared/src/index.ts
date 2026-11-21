export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

export type Element = "fire" | "water" | "thunder" | "ice" | "earth";
export const ELEMENTS: Element[] = ["fire", "water", "thunder", "ice", "earth"];

export type Lang = "de" | "en";

export type ClassId =
  | "visitor"
  | "scholar"
  | "summoner"
  | "mage_fire"
  | "mage_water"
  | "mage_thunder"
  | "mage_ice"
  | "mage_earth";

export const CLASS_IDS: ClassId[] = [
  "visitor",
  "scholar",
  "summoner",
  "mage_fire",
  "mage_water",
  "mage_thunder",
  "mage_ice",
  "mage_earth",
];

export type CombatRole = "damage" | "summon" | "tank" | "support";

export interface ClassDef {
  id: ClassId;
  name: string;
  nameEn?: string;
  combat: boolean;
  role?: CombatRole;
  slotsByRarity: Record<Rarity, number>;
  description: string;
  descriptionEn?: string;
}

export type SkillKind = "damage" | "heal" | "shield" | "buff" | "debuff" | "summon" | "draw";
export type Target = "enemy" | "self" | "none";

export interface SkillCardDef {
  id: string;
  name: string;
  kind: SkillKind;
  rarity: Rarity;
  cost: number;
  target: Target;
  power: number;
  classId?: ClassId;
  element?: Element;
  summonId?: string;
  effects: string[];
  text: string;
  nameEn?: string;
  textEn?: string;
}

export interface SummonDef {
  id: string;
  name: string;
  hp: number;
  attack: number;
  text: string;
  textEn?: string;
}

export interface WordCardDef {
  id: string;
  lang: Lang;
  word: string;
  translation: string;
  example?: string;
}

export interface CardInstance {
  instanceId: string;
  userId: string;
  kind: "character" | "skill" | "word";
  defId: string;
  rarity: Rarity;
  classId?: ClassId;
  name?: string;
  createdAt: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateClassDef(def: unknown): string[] {
  if (!isObject(def)) return ["职业定义不是对象"];
  const errors: string[] = [];
  const id = String(def.id ?? "(无id)");
  if (typeof def.id !== "string" || !CLASS_IDS.includes(def.id as ClassId)) {
    errors.push(`未知职业 id: ${id}`);
  }
  if (typeof def.name !== "string" || !def.name) errors.push(`${id}: 缺少名称`);
  if (typeof def.combat !== "boolean") errors.push(`${id}: combat 必须是布尔值`);
  if (!isObject(def.slotsByRarity)) {
    errors.push(`${id}: 缺少 slotsByRarity`);
  } else {
    for (const rarity of RARITIES) {
      const slots = def.slotsByRarity[rarity];
      if (typeof slots !== "number" || slots < 1 || slots > 5) {
        errors.push(`${id}: slotsByRarity.${rarity} 应为 1-5 的整数`);
      }
    }
  }
  if (typeof def.description !== "string") errors.push(`${id}: 缺少描述`);
  if (def.nameEn !== undefined && typeof def.nameEn !== "string") errors.push(`${id}: nameEn 必须是字符串`);
  if (def.descriptionEn !== undefined && typeof def.descriptionEn !== "string") errors.push(`${id}: descriptionEn 必须是字符串`);
  return errors;
}

export function validateSkillCard(def: unknown): string[] {
  if (!isObject(def)) return ["技能卡不是对象"];
  const errors: string[] = [];
  const id = typeof def.id === "string" && def.id ? def.id : "(无id)";
  if (typeof def.id !== "string" || !def.id) errors.push("技能卡缺少 id");
  if (typeof def.name !== "string" || !def.name) errors.push(`${id}: 缺少名称`);
  if (!RARITIES.includes(def.rarity as Rarity)) errors.push(`${id}: 非法稀有度 ${String(def.rarity)}`);
  if (typeof def.cost !== "number" || def.cost < 0 || def.cost > 10) errors.push(`${id}: 费用应为 0-10`);
  if (typeof def.power !== "number" || def.power < 0) errors.push(`${id}: power 应为非负数`);
  if (def.classId !== undefined && !CLASS_IDS.includes(def.classId as ClassId)) {
    errors.push(`${id}: 未知职业 ${String(def.classId)}`);
  }
  if (def.element !== undefined && !ELEMENTS.includes(def.element as Element)) {
    errors.push(`${id}: 未知元素 ${String(def.element)}`);
  }
  if (def.kind === "summon" && typeof def.summonId !== "string") {
    errors.push(`${id}: 召唤卡必须填写 summonId`);
  }
  if (!Array.isArray(def.effects)) errors.push(`${id}: effects 必须是数组`);
  if (typeof def.text !== "string") errors.push(`${id}: 缺少描述文本`);
  if (def.nameEn !== undefined && typeof def.nameEn !== "string") errors.push(`${id}: nameEn 必须是字符串`);
  if (def.textEn !== undefined && typeof def.textEn !== "string") errors.push(`${id}: textEn 必须是字符串`);
  return errors;
}

export function validateSummonDef(def: unknown): string[] {
  if (!isObject(def)) return ["召唤物定义不是对象"];
  const errors: string[] = [];
  const id = typeof def.id === "string" && def.id ? def.id : "(无id)";
  if (typeof def.name !== "string" || !def.name) errors.push(`${id}: 缺少名称`);
  if (typeof def.hp !== "number" || def.hp <= 0) errors.push(`${id}: hp 应为正数`);
  if (typeof def.attack !== "number" || def.attack < 0) errors.push(`${id}: attack 应为非负数`);
  if (def.textEn !== undefined && typeof def.textEn !== "string") errors.push(`${id}: textEn 必须是字符串`);
  return errors;
}

export function validateWordCard(def: unknown): string[] {
  if (!isObject(def)) return ["单词卡不是对象"];
  const errors: string[] = [];
  const id = typeof def.id === "string" && def.id ? def.id : "(无id)";
  if (typeof def.id !== "string" || !def.id) errors.push("单词卡缺少 id");
  if (def.lang !== "de" && def.lang !== "en") errors.push(`${id}: lang 只能是 de 或 en`);
  if (typeof def.word !== "string" || !def.word) errors.push(`${id}: 缺少单词`);
  if (typeof def.translation !== "string" || !def.translation) errors.push(`${id}: 缺少释义`);
  return errors;
}
