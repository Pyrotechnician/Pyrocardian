import { useEffect, useReducer, useRef, useState } from "react";
import { Client, type Room } from "colyseus.js";
import type { BattlePlayerState, BattleState } from "@pyrocardian/shared/battle";
import type { ClassDef, SkillCardDef } from "@pyrocardian/shared";
import { api } from "../api";
import { localizeSkillName, localizeSkillText, type T, type UILang } from "../i18n";
import type { CardInstanceRow } from "./Collection";

export function wsUrl(): string {
  if (import.meta.env.DEV) return "http://localhost:3000";
  return `${location.protocol}//${location.host}`;
}

interface MeResponse {
  user: { id: string; email: string; magic_stones: number };
  cards: CardInstanceRow[];
}

export function BattleView({
  room,
  token,
  lang,
  t,
  onLeave,
}: {
  room: Room<BattleState>;
  token: string;
  lang: UILang;
  t: T;
  onLeave: () => void;
}) {
  const [skills, setSkills] = useState<SkillCardDef[]>([]);
  const [instanceDef, setInstanceDef] = useState<Map<string, string>>(new Map());
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    api<SkillCardDef[]>("/content/skills").then(setSkills);
    api<MeResponse>("/me", { token }).then((me) =>
      setInstanceDef(new Map(me.cards.map((c) => [c.instance_id, c.def_id])))
    );
  }, [token]);

  useEffect(() => {
    const cb = () => force();
    room.onStateChange(cb);
    return () => {
      room.onStateChange.remove(cb);
    };
  }, [room]);

  useEffect(() => {
    return () => {
      room.leave();
    };
  }, [room]);

  const skillById = new Map(skills.map((s) => [s.id, s]));
  const state = room.state;
  const myId = room.sessionId;
  const mePlayer = state?.players.get(myId) ?? null;
  const opponent: BattlePlayerState | null = state
    ? ([...state.players.values()].find((p) => p.userId !== mePlayer?.userId) ?? null)
    : null;
  const myTurn = state?.phase === "playing" && state.turn === myId;
  const ended = state?.phase === "ended";
  const iWon = ended && state.winner === myId;

  const renderPlayer = (p: BattlePlayerState | null, label: string) => {
    if (!p) return null;
    return (
      <div className="battle-player">
        <div className="battle-player-name">
          {label}: {p.displayName} <span className="card-text">({p.classId}{p.ai ? " · AI" : ""})</span>
        </div>
        <div className="battle-stats">
          <span>
            {t("battle.hp")} {Math.max(0, p.hp)}/{p.maxHp}
          </span>
          <span>
            {t("battle.mana")} {p.mana}/{p.maxMana}
          </span>
          <span>
            {t("battle.shield")} {p.shield}
          </span>
          <span>
            {t("battle.deck")} {p.deck.length}
          </span>
        </div>
        {p.summons.size > 0 && (
          <div className="battle-summons">
            {t("battle.summons")}:{" "}
            {[...p.summons.values()].map((s) => (
              <span key={s.id} className="summon-chip">
                {s.name} {s.hp}HP/{s.attack}ATK
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="battle">
      <div className="battle-top">
        <h2>{t("battle.title")}</h2>
        <div>
          {state?.mode === "pve" && <span>{t("battle.pve")}</span>}
          {state?.phase === "waiting" && (
            <span>
              {t("battle.roomCode")}: <strong>{room.roomId}</strong> · {t("battle.roomHint")}
            </span>
          )}
          {state?.phase === "playing" && (
            <span>{myTurn ? t("battle.myTurn") : t("battle.opponentTurn")}</span>
          )}
          {ended && <span>{iWon ? t("battle.win") : t("battle.lose")}</span>}
          <button className="ghost" onClick={onLeave}>
            {t("battle.leave")}
          </button>
        </div>
      </div>
      <div className="battle-field">
        {renderPlayer(opponent, t("battle.opponent"))}
        {renderPlayer(mePlayer, t("battle.you"))}
      </div>
      {state?.phase === "playing" && mePlayer && (
        <div className="battle-controls">
          <button disabled={!myTurn || mePlayer.attacked} onClick={() => room.send("attack")}>
            {t("battle.attack")}
          </button>
          <button disabled={!myTurn} onClick={() => room.send("endTurn")}>
            {t("battle.endTurn")}
          </button>
        </div>
      )}
      <h3>{t("battle.hand")}</h3>
      <div className="card-row">
        {mePlayer && mePlayer.hand.length === 0 && <p className="card-text">{t("battle.empty")}</p>}
        {mePlayer &&
          ([...mePlayer.hand] as string[]).map((ref, index) => {
            const defId = instanceDef.get(ref) ?? ref;
            const def = skillById.get(defId);
            if (!def) return null;
            const playable = myTurn && def.cost <= mePlayer.mana;
            return (
              <div key={`${ref}-${index}`} className={`card rarity-${def.rarity}`}>
                <div className="card-cost">{def.cost}</div>
                <div className="card-name">{localizeSkillName(def, lang)}</div>
                <div className="card-text">{localizeSkillText(def, lang)}</div>
                <button disabled={!playable} onClick={() => room.send("playCard", { handIndex: index })}>
                  {t("battle.play")}
                </button>
              </div>
            );
          })}
      </div>
      <h3>{t("battle.log")}</h3>
      <ul className="battle-log">
        {state && [...state.log].map((line, i) => <li key={i}>{line}</li>)}
      </ul>
    </div>
  );
}

export default function BattlePanel({ token, lang, t }: { token: string; lang: UILang; t: T }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [classes, setClasses] = useState<ClassDef[]>([]);
  const [characterId, setCharacterId] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [room, setRoom] = useState<Room<BattleState> | null>(null);
  const [error, setError] = useState("");
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    api<MeResponse>("/me", { token }).then(setMe);
    api<ClassDef[]>("/content/classes").then(setClasses);
  }, [token]);

  const combatCharacters = (me?.cards ?? []).filter((c) => c.kind === "character");
  const classById = new Map(classes.map((c) => [c.id, c]));

  const getClient = () => {
    if (!clientRef.current) clientRef.current = new Client(wsUrl());
    return clientRef.current;
  };

  const join = async (action: "create" | "joinById" | "joinOrCreate") => {
    setError("");
    if (!characterId) {
      setError(t("battle.needCharacter"));
      return;
    }
    try {
      const client = getClient();
      const options = { token, characterInstanceId: characterId };
      let r: Room<BattleState>;
      if (action === "create") r = await client.create<BattleState>("battle", options);
      else if (action === "joinById") {
        if (!roomIdInput.trim()) {
          setError(t("battle.needRoom"));
          return;
        }
        r = await client.joinById<BattleState>(roomIdInput.trim(), options);
      } else r = await client.joinOrCreate<BattleState>("battle", options);
      setRoom(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.unknown"));
    }
  };

  if (room) {
    return (
      <BattleView
        room={room}
        token={token}
        lang={lang}
        t={t}
        onLeave={() => setRoom(null)}
      />
    );
  }

  return (
    <div className="battle-lobby">
      <h2>{t("battle.title")}</h2>
      <p>{t("battle.choose")}</p>
      <div className="card-row">
        {combatCharacters.map((c) => {
          const cls = c.class_id ? classById.get(c.class_id) : undefined;
          const active = characterId === c.instance_id;
          return (
            <button
              key={c.instance_id}
              className={`card selectable rarity-${c.rarity} ${active ? "active" : ""}`}
              onClick={() => setCharacterId(c.instance_id)}
            >
              <div className="card-name">{c.name ?? c.def_id}</div>
              <div className="card-text">{cls?.name ?? c.class_id}</div>
            </button>
          );
        })}
      </div>
      {combatCharacters.length === 0 && <p>{t("battle.noCharacter")}</p>}
      <div className="battle-actions">
        <button onClick={() => void join("create")}>{t("battle.create")}</button>
        <button onClick={() => void join("joinOrCreate")}>{t("battle.quick")}</button>
        <input
          placeholder={t("battle.roomCode")}
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
        />
        <button onClick={() => void join("joinById")}>{t("battle.join")}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
