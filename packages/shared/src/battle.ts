import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import type { Element } from "./index";

export const ELEMENT_BEATS: Partial<Record<Element, Element>> = {
  fire: "ice",
  ice: "thunder",
  thunder: "water",
  water: "fire",
};

export const ELEMENT_COUNTER_MULTIPLIER = 1.2;

export class SummonState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") hp = 0;
  @type("number") attack = 0;
}

export class BattlePlayerState extends Schema {
  @type("string") userId = "";
  @type("string") displayName = "";
  @type("string") classId = "";
  @type("string") element = "";
  @type("number") hp = 30;
  @type("number") maxHp = 30;
  @type("number") mana = 0;
  @type("number") maxMana = 0;
  @type("number") shield = 0;
  @type(["string"]) hand = new ArraySchema<string>();
  @type(["string"]) deck = new ArraySchema<string>();
  @type("number") fatigue = 0;
  @type({ map: SummonState }) summons = new MapSchema<SummonState>();
  @type("number") frozen = 0;
  @type("number") burn = 0;
  @type("boolean") attacked = false;
  @type("boolean") ai = false;
}

export class BattleState extends Schema {
  @type({ map: BattlePlayerState }) players = new MapSchema<BattlePlayerState>();
  @type("string") mode: "pvp" | "pve" = "pvp";
  @type("string") turn = "";
  @type("string") phase: "waiting" | "playing" | "ended" = "waiting";
  @type("string") winner = "";
  @type(["string"]) log = new ArraySchema<string>();
}
