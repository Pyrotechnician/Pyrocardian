import Colyseus from "colyseus";
import type { Client } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";

const { Room } = Colyseus;

export class PlayerState extends Schema {
  @type("string") name = "";
  @type("number") hp = 30;
  @type("number") mana = 0;
}

export class BattleState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("string") turn = "";
  @type("string") phase: "waiting" | "playing" | "ended" = "waiting";
}

export class BattleRoom extends Room<BattleState> {
  maxClients = 2;

  onCreate() {
    this.setState(new BattleState());
    this.onMessage("playCard", (client, message: { cost?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.turn !== client.sessionId || this.state.phase !== "playing") return;
      const cost = typeof message?.cost === "number" ? message.cost : 0;
      player.mana = Math.max(0, player.mana - cost);
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const player = new PlayerState();
    player.name = options?.name ?? "旅行者";
    this.state.players.set(client.sessionId, player);
    if (this.state.players.size === 2) {
      this.state.phase = "playing";
      this.state.turn = [...this.state.players.keys()][0];
      for (const p of this.state.players.values()) {
        p.mana = 1;
      }
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    if (this.state.players.size < 2) {
      this.state.phase = "ended";
    }
  }
}
