import crypto from "node:crypto";
import Colyseus from "colyseus";
import type { Client } from "colyseus";
import {
  BattlePlayerState,
  BattleState,
  ELEMENT_BEATS,
  ELEMENT_COUNTER_MULTIPLIER,
  SummonState,
} from "@pyrocardian/shared/battle";
import {
  type Element,
  type Rarity,
  type RecruitOffer,
  type SkillCardDef,
} from "@pyrocardian/shared";
import { verifyToken } from "../auth";
import { ctx } from "../context";

const { Room } = Colyseus;

const BASE_HP = 30;
const RARITY_HP_BONUS: Record<Rarity, number> = { common: 0, rare: 2, epic: 4, legendary: 6 };
const START_HAND = 3;
const HAND_LIMIT = 7;
const MAX_MANA = 10;
const BASIC_ATTACK_DAMAGE = 2;
const BURN_DAMAGE = 2;
const MAX_SUMMONS = 2;
const LOG_LIMIT = 60;
const AI_SESSION_ID = "ai";
const AI_THINK_MS = 600;

interface RoomOptions {
  mode?: "pvp" | "pve";
  token?: string;
  userId?: string;
  characterInstanceId?: string;
  bossClassId?: string;
  recruit?: RecruitOffer;
}

export class BattleRoom extends Room<BattleState> {
  private roomOptions: RoomOptions = {};

  onAuth(_client: Client, options: RoomOptions) {
    const payload = options?.token ? verifyToken(String(options.token), ctx.jwtSecret) : null;
    if (!payload || typeof payload.sub !== "string") return false;
    options.userId = payload.sub;
    return true;
  }

  onCreate(options: RoomOptions) {
    this.roomOptions = options ?? {};
    this.setState(new BattleState());
    this.state.mode = this.roomOptions.mode === "pve" ? "pve" : "pvp";
    if (this.state.mode === "pve") this.maxClients = 1;
    this.onMessage("playCard", (client, message: { handIndex?: number }) =>
      this.playCard(client.sessionId, message)
    );
    this.onMessage("attack", (client) => this.attack(client.sessionId));
    this.onMessage("endTurn", (client) => this.endTurn(client.sessionId));
    if (this.state.mode === "pve") {
      const boss = this.buildBossPlayer();
      if (boss) {
        this.state.players.set(AI_SESSION_ID, boss);
      }
    }
  }

  onJoin(client: Client, options: RoomOptions) {
    if (this.state.mode === "pvp") {
      if (this.state.phase !== "waiting") return;
      const player = this.buildPvPPlayer(options);
      if (!player) return;
      this.state.players.set(client.sessionId, player);
      this.pushLog(`${player.displayName} 加入了战斗`);
      if (this.state.players.size === 2) {
        this.state.phase = "playing";
        const ids = [...this.state.players.keys()];
        const first = ids[Math.floor(Math.random() * ids.length)];
        this.state.turn = first;
        this.pushLog("战斗开始！");
        this.beginTurn(first, 0);
      }
    } else {
      const player = this.buildPvEPlayer(options);
      if (!player) return;
      this.state.players.set(client.sessionId, player);
      this.pushLog(`${player.displayName} 应战 ${this.state.players.get(AI_SESSION_ID)?.displayName}`);
      this.state.phase = "playing";
      const ids = [...this.state.players.keys()];
      const first = ids[Math.floor(Math.random() * ids.length)];
      this.state.turn = first;
      this.pushLog("战斗开始！");
      this.beginTurn(first, 0);
    }
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (this.state.phase === "playing" && this.state.players.size < (this.state.mode === "pve" ? 2 : 2)) {
      this.state.phase = "ended";
      const winner = [...this.state.players.keys()][0] ?? "";
      this.state.winner = winner;
      this.pushLog(`${player?.displayName ?? "玩家"} 离开了，${this.state.players.get(winner)?.displayName ?? "对手"} 获胜`);
    } else if (this.state.phase === "waiting") {
      this.state.turn = "";
    }
  }

  private buildPvPPlayer(options: RoomOptions): BattlePlayerState | null {
    const userId = options.userId;
    const characterInstanceId = String(options.characterInstanceId ?? "");
    if (!userId || !characterInstanceId) return null;
    const card = ctx.db
      .prepare(
        "SELECT rarity, class_id, name FROM player_cards WHERE instance_id = ? AND user_id = ? AND kind = 'character'"
      )
      .get(characterInstanceId, userId) as
      | { rarity: Rarity; class_id: string; name: string }
      | undefined;
    if (!card?.class_id) return null;
    const classDef = ctx.content.classes.find((c) => c.id === card.class_id);
    if (!classDef || !classDef.combat) return null;

    const player = new BattlePlayerState();
    player.userId = userId;
    player.displayName = card.name ?? classDef.name;
    player.classId = classDef.id;
    player.element = classDef.element ?? "";
    player.maxHp = BASE_HP + (RARITY_HP_BONUS[card.rarity] ?? 0);
    player.hp = player.maxHp;

    const slotLimit = classDef.slotsByRarity[card.rarity] ?? 2;
    const owned = ctx.db
      .prepare("SELECT def_id FROM player_cards WHERE user_id = ? AND kind = 'skill'")
      .all(userId) as { def_id: string }[];
    const deck = owned
      .map((r) => ctx.content.skills.find((s) => s.id === r.def_id))
      .filter((s): s is SkillCardDef => Boolean(s && (!s.classId || s.classId === classDef.id)))
      .slice(0, slotLimit)
      .map((s) => s.id);
    this.shuffle(deck);
    for (const id of deck) player.deck.push(id);
    for (let i = 0; i < START_HAND; i++) this.drawCard(player);
    return player;
  }

  private buildPvEPlayer(options: RoomOptions): BattlePlayerState | null {
    const userId = options.userId;
    const recruit = options.recruit;
    if (!userId || !recruit) return null;
    const classDef = ctx.content.classes.find((c) => c.id === recruit.classId);
    if (!classDef || !classDef.recruitable) return null;

    const player = new BattlePlayerState();
    player.userId = userId;
    player.displayName = recruit.name;
    player.classId = classDef.id;
    player.element = classDef.element ?? "";
    player.maxHp = BASE_HP + (RARITY_HP_BONUS[recruit.rarity] ?? 0);
    player.hp = player.maxHp;

    const slotLimit = classDef.slotsByRarity[recruit.rarity] ?? 2;
    const owned = ctx.db
      .prepare("SELECT instance_id, def_id FROM player_cards WHERE user_id = ? AND kind = 'skill'")
      .all(userId) as { instance_id: string; def_id: string }[];
    const playable = owned
      .map((r) => ({ instanceId: r.instance_id, def: ctx.content.skills.find((s) => s.id === r.def_id) }))
      .filter((r) => r.def && (!r.def.classId || r.def.classId === classDef.id))
      .slice(0, slotLimit);
    const deck = playable.map((r) => r.instanceId);
    this.shuffle(deck);
    for (const id of deck) player.deck.push(id);
    for (let i = 0; i < START_HAND; i++) this.drawCard(player);
    return player;
  }

  private buildBossPlayer(): BattlePlayerState | null {
    const bossClassId = String(this.roomOptions.bossClassId ?? "");
    const classDef = ctx.content.classes.find((c) => c.id === bossClassId && c.boss);
    if (!classDef) return null;
    const boss = new BattlePlayerState();
    boss.userId = AI_SESSION_ID;
    boss.displayName = classDef.name;
    boss.classId = classDef.id;
    boss.element = classDef.element ?? "";
    boss.ai = true;
    boss.maxHp = classDef.hp ?? BASE_HP;
    boss.hp = boss.maxHp;
    const deckArr = [...(classDef.deck ?? [])];
    this.shuffle(deckArr);
    for (const id of deckArr) boss.deck.push(id);
    for (let i = 0; i < START_HAND; i++) this.drawCard(boss);
    return boss;
  }

  private resolveCard(player: BattlePlayerState, ref: string): SkillCardDef | undefined {
    if (player.ai || this.state.mode === "pvp") {
      return ctx.content.skills.find((s) => s.id === ref);
    }
    const row = ctx.db
      .prepare("SELECT def_id FROM player_cards WHERE instance_id = ? AND user_id = ? AND kind = 'skill'")
      .get(ref, player.userId) as { def_id: string } | undefined;
    if (!row) return ctx.content.skills.find((s) => s.id === ref);
    return ctx.content.skills.find((s) => s.id === row.def_id);
  }

  private playCard(sessionId: string, message: { handIndex?: number }) {
    if (this.state.phase !== "playing" || this.state.turn !== sessionId) return;
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const index = Number(message?.handIndex);
    if (!Number.isInteger(index) || index < 0 || index >= player.hand.length) return;
    const ref = player.hand[index];
    if (ref === undefined) return;
    const def = this.resolveCard(player, ref);
    if (!def || def.cost > player.mana) return;
    player.mana -= def.cost;
    player.hand.splice(index, 1);
    if (this.state.mode === "pve" && !player.ai) {
      ctx.db
        .prepare("DELETE FROM player_cards WHERE instance_id = ? AND user_id = ?")
        .run(ref, player.userId);
    }
    const opponent = this.opponentOf(sessionId);
    this.pushLog(`${player.displayName} 打出了「${def.name}」`);
    switch (def.kind) {
      case "damage": {
        let damage = def.power;
        if (def.element && opponent && ELEMENT_BEATS[def.element as Element] === opponent.element) {
          damage = Math.round(damage * ELEMENT_COUNTER_MULTIPLIER);
          this.pushLog(`属性克制！伤害提升至 ${damage}`);
        }
        if (opponent) this.dealDamage(player, opponent, damage);
        break;
      }
      case "heal":
        player.hp = Math.min(player.maxHp, player.hp + def.power);
        break;
      case "shield":
      case "buff":
        player.shield += def.power;
        break;
      case "debuff":
        if (opponent) opponent.shield = Math.max(0, opponent.shield - def.power);
        break;
      case "draw":
        this.drawCard(player);
        this.drawCard(player);
        break;
      case "summon": {
        if (player.summons.size < MAX_SUMMONS && def.summonId) {
          const summonDef = ctx.content.summons.find((s) => s.id === def.summonId);
          if (summonDef) {
            const summon = new SummonState();
            summon.id = crypto.randomUUID();
            summon.name = summonDef.name;
            summon.hp = summonDef.hp;
            summon.attack = summonDef.attack;
            player.summons.set(summon.id, summon);
            this.pushLog(`${player.displayName} 召唤了 ${summonDef.name}！`);
          }
        }
        break;
      }
    }
    for (const effect of def.effects) {
      if (effect === "freeze" && opponent) {
        opponent.frozen = 1;
        this.pushLog(`${opponent.displayName} 被冻结了！`);
      }
      if (effect === "burn" && opponent) {
        opponent.burn = 2;
        this.pushLog(`${opponent.displayName} 被灼烧了！`);
      }
    }
    this.checkWin();
  }

  private attack(sessionId: string) {
    if (this.state.phase !== "playing" || this.state.turn !== sessionId) return;
    const player = this.state.players.get(sessionId);
    const opponent = this.opponentOf(sessionId);
    if (!player || !opponent || player.attacked) return;
    player.attacked = true;
    this.dealDamage(player, opponent, BASIC_ATTACK_DAMAGE);
    this.pushLog(`${player.displayName} 发起普攻，造成 ${BASIC_ATTACK_DAMAGE} 点伤害`);
    this.checkWin();
  }

  private endTurn(sessionId: string) {
    if (this.state.phase !== "playing" || this.state.turn !== sessionId) return;
    const nextId = this.opponentSessionOf(sessionId);
    if (!nextId) return;
    this.state.turn = nextId;
    this.beginTurn(nextId, 0);
  }

  private beginTurn(sessionId: string, depth: number) {
    if (this.state.phase !== "playing") return;
    const player = this.state.players.get(sessionId);
    if (!player) return;
    player.maxMana = Math.min(MAX_MANA, player.maxMana + 1);
    player.mana = player.maxMana;
    player.attacked = false;
    if (player.burn > 0) {
      player.burn--;
      player.hp -= BURN_DAMAGE;
      this.pushLog(`${player.displayName} 受到灼烧 ${BURN_DAMAGE} 点伤害`);
    }
    if (player.frozen > 0 && depth < 4) {
      player.frozen--;
      this.pushLog(`${player.displayName} 被冻结，跳过回合`);
      this.checkWin();
      const otherId = this.opponentSessionOf(sessionId);
      if (otherId) {
        this.state.turn = otherId;
        this.beginTurn(otherId, depth + 1);
      }
      return;
    }
    this.drawCard(player);
    const opponent = this.opponentOf(sessionId);
    for (const summon of player.summons.values()) {
      if (opponent) {
        this.dealDamage(player, opponent, summon.attack);
        this.pushLog(`${summon.name} 攻击了 ${opponent.displayName}，造成 ${summon.attack} 点伤害`);
      }
    }
    this.checkWin();
    this.maybeRunAi();
  }

  private maybeRunAi() {
    if (this.state.mode !== "pve" || this.state.phase !== "playing") return;
    if (this.state.turn !== AI_SESSION_ID) return;
    this.clock.setTimeout(() => this.aiAct(AI_SESSION_ID), AI_THINK_MS);
  }

  private aiAct(sessionId: string) {
    if (this.state.mode !== "pve" || this.state.phase !== "playing" || this.state.turn !== sessionId) {
      return;
    }
    const ai = this.state.players.get(sessionId);
    if (!ai) return;
    const hand = [...ai.hand] as string[];
    let best = -1;
    let bestCost = -1;
    hand.forEach((ref, i) => {
      const def = this.resolveCard(ai, ref);
      if (def && def.cost <= ai.mana && def.cost > bestCost) {
        best = i;
        bestCost = def.cost;
      }
    });
    if (best >= 0) {
      this.playCard(sessionId, { handIndex: best });
      this.maybeRunAi();
      return;
    }
    if (!ai.attacked) {
      this.attack(sessionId);
      this.maybeRunAi();
      return;
    }
    this.endTurn(sessionId);
  }

  private drawCard(player: BattlePlayerState) {
    if (player.deck.length === 0) {
      player.fatigue++;
      player.hp -= player.fatigue;
      this.pushLog(`${player.displayName} 没有牌了，疲劳受到 ${player.fatigue} 点伤害`);
      return;
    }
    const cardId = player.deck.shift();
    if (cardId === undefined) return;
    if (player.hand.length >= HAND_LIMIT) {
      this.pushLog(`${player.displayName} 手牌已满，烧掉了抽到的牌`);
      return;
    }
    player.hand.push(cardId);
  }

  private dealDamage(_source: BattlePlayerState | null, target: BattlePlayerState, damage: number) {
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, damage);
      target.shield -= absorbed;
      damage -= absorbed;
    }
    target.hp -= damage;
  }

  private checkWin() {
    if (this.state.phase !== "playing") return;
    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.hp <= 0) {
        this.state.phase = "ended";
        const winnerId = this.opponentSessionOf(sessionId);
        this.state.winner = winnerId;
        this.pushLog(
          `${player.displayName} 倒下了，${this.state.players.get(winnerId)?.displayName ?? "对手"} 获胜！`
        );
        this.applyResult(winnerId);
      }
    }
  }

  private applyResult(winnerId: string) {
    if (this.state.mode !== "pve") return;
    const humanEntry = [...this.state.players.entries()].find(([, p]) => !p.ai);
    if (!humanEntry) return;
    const [humanSessionId, human] = humanEntry;
    const won = winnerId === humanSessionId;
    const stones = won ? 30 : 5;
    const xpGain = won ? 50 : 10;
    ctx.db
      .prepare("UPDATE users SET magic_stones = magic_stones + ? WHERE id = ?")
      .run(stones, human.userId);
    const v = ctx.db
      .prepare("SELECT xp, level, affinity_points FROM visitor WHERE user_id = ?")
      .get(human.userId) as { xp: number; level: number; affinity_points: number } | undefined;
    let xp = (v?.xp ?? 0) + xpGain;
    let level = v?.level ?? 1;
    let points = v?.affinity_points ?? 0;
    while (xp >= level * 100) {
      xp -= level * 100;
      level++;
      points += 2;
    }
    ctx.db
      .prepare(
        `INSERT INTO visitor (user_id, xp, level, affinity_points) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET xp = excluded.xp, level = excluded.level, affinity_points = excluded.affinity_points`
      )
      .run(human.userId, xp, level, points);
    if (won) {
      const ancientDefs = ctx.content.ancient;
      const count = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const def = ancientDefs[Math.floor(Math.random() * ancientDefs.length)];
        ctx.db
          .prepare(
            "INSERT INTO player_cards (instance_id, user_id, kind, def_id, rarity, class_id, name, created_at) VALUES (?, ?, 'ancient', ?, ?, null, null, ?)"
          )
          .run(crypto.randomUUID(), human.userId, def.id, def.rarity, Date.now());
      }
      this.pushLog(`奖励：魔晶石 +${stones}，访客经验 +${xpGain}，古老的卡牌 x${count}`);
    } else {
      this.pushLog(`战败回城：返还旅费 魔晶石 +${stones}，访客经验 +${xpGain}`);
    }
  }

  private opponentSessionOf(sessionId: string): string {
    for (const id of this.state.players.keys()) {
      if (id !== sessionId) return id;
    }
    return "";
  }

  private opponentOf(sessionId: string): BattlePlayerState | null {
    for (const [id, player] of this.state.players.entries()) {
      if (id !== sessionId) return player;
    }
    return null;
  }

  private shuffle(arr: string[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private pushLog(message: string) {
    this.state.log.push(message);
    if (this.state.log.length > LOG_LIMIT) this.state.log.splice(0, 1);
  }
}
