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
import type { Element, Rarity, SkillCardDef } from "@pyrocardian/shared";
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

interface JoinOptions {
  token?: string;
  userId?: string;
  characterInstanceId?: string;
}

export class BattleRoom extends Room<BattleState> {
  maxClients = 2;

  onAuth(_client: Client, options: JoinOptions) {
    const payload = options?.token ? verifyToken(String(options.token), ctx.jwtSecret) : null;
    if (!payload || typeof payload.sub !== "string") return false;
    options.userId = payload.sub;
    return true;
  }

  onCreate() {
    this.setState(new BattleState());
    this.onMessage("playCard", (client, message: { handIndex?: number }) =>
      this.playCard(client, message)
    );
    this.onMessage("attack", (client) => this.attack(client));
    this.onMessage("endTurn", (client) => this.endTurn(client));
  }

  onJoin(client: Client, options: JoinOptions) {
    if (this.state.phase !== "waiting") return;
    const player = this.buildPlayer(options);
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
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (this.state.phase === "playing" && this.state.players.size === 1) {
      const winner = [...this.state.players.keys()][0];
      this.state.winner = winner;
      this.state.phase = "ended";
      this.pushLog(`${player?.displayName ?? "玩家"} 离开了，${this.state.players.get(winner)?.displayName} 获胜`);
    } else if (this.state.phase === "waiting") {
      this.state.turn = "";
    }
  }

  private buildPlayer(options: JoinOptions): BattlePlayerState | null {
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

    const maxHp = BASE_HP + (RARITY_HP_BONUS[card.rarity] ?? 0);
    const player = new BattlePlayerState();
    player.userId = userId;
    player.displayName = card.name ?? classDef.name;
    player.classId = classDef.id;
    player.element = classDef.id.startsWith("mage_") ? classDef.id.slice(5) : "";
    player.maxHp = maxHp;
    player.hp = maxHp;

    const slotLimit = classDef.slotsByRarity[card.rarity] ?? 2;
    const owned = ctx.db
      .prepare("SELECT def_id FROM player_cards WHERE user_id = ? AND kind = 'skill'")
      .all(userId) as { def_id: string }[];
    const deck = owned
      .map((r) => ctx.content.skills.find((s) => s.id === r.def_id))
      .filter((s): s is SkillCardDef => Boolean(s && (!s.classId || s.classId === classDef.id)))
      .slice(0, slotLimit)
      .map((s) => s.id);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    for (const id of deck) player.deck.push(id);
    for (let i = 0; i < START_HAND; i++) this.drawCard(player);
    return player;
  }

  private playCard(client: Client, message: { handIndex?: number }) {
    if (this.state.phase !== "playing" || this.state.turn !== client.sessionId) return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const index = Number(message?.handIndex);
    if (!Number.isInteger(index) || index < 0 || index >= player.hand.length) return;
    const cardId = player.hand[index];
    const def = ctx.content.skills.find((s) => s.id === cardId);
    if (!def || def.cost > player.mana) return;
    player.mana -= def.cost;
    player.hand.splice(index, 1);
    const opponent = this.opponentOf(client.sessionId);
    this.pushLog(`${player.displayName} 打出了「${def.name}」`);
    switch (def.kind) {
      case "damage": {
        let damage = def.power;
        if (
          def.element &&
          opponent &&
          ELEMENT_BEATS[def.element as Element] === opponent.element
        ) {
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

  private attack(client: Client) {
    if (this.state.phase !== "playing" || this.state.turn !== client.sessionId) return;
    const player = this.state.players.get(client.sessionId);
    const opponent = this.opponentOf(client.sessionId);
    if (!player || !opponent || player.attacked) return;
    player.attacked = true;
    this.dealDamage(player, opponent, BASIC_ATTACK_DAMAGE);
    this.pushLog(`${player.displayName} 发起普攻，造成 ${BASIC_ATTACK_DAMAGE} 点伤害`);
    this.checkWin();
  }

  private endTurn(client: Client) {
    if (this.state.phase !== "playing" || this.state.turn !== client.sessionId) return;
    const nextId = this.opponentSessionOf(client.sessionId);
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

  private dealDamage(
    _source: BattlePlayerState | null,
    target: BattlePlayerState,
    damage: number
  ) {
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, damage);
      target.shield -= absorbed;
      damage -= absorbed;
    }
    target.hp -= damage;
  }

  private checkWin() {
    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.hp <= 0) {
        this.state.phase = "ended";
        this.state.winner = this.opponentSessionOf(sessionId);
        this.pushLog(`${player.displayName} 倒下了，${this.state.players.get(this.state.winner)?.displayName ?? "对手"} 获胜！`);
      }
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

  private pushLog(message: string) {
    this.state.log.push(message);
    if (this.state.log.length > LOG_LIMIT) this.state.log.splice(0, 1);
  }
}
