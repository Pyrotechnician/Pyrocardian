import { useCallback, useEffect, useRef, useState } from "react";
import { Client, type Room } from "colyseus.js";
import type { BattleState } from "@pyrocardian/shared/battle";
import { ELEMENTS, type ClassDef, type RecruitOffer, type SkillCardDef } from "@pyrocardian/shared";
import { api } from "../api";
import { BattleView, wsUrl } from "./Battle";
import { ClassArt } from "../components/CardView";
import { localizeClassName, type T, type UILang } from "../i18n";
import type { CardInstanceRow } from "./Collection";

interface BossInfo extends ClassDef {
  skills: SkillCardDef[];
}

interface MeResponse {
  user: { id: string; email: string; magic_stones: number };
  cards: CardInstanceRow[];
  visitor: { xp: number; level: number; affinityPoints: number; affinity: Record<string, number> };
}

export default function Portal({ token, lang, t }: { token: string; lang: UILang; t: T }) {
  const [bosses, setBosses] = useState<BossInfo[]>([]);
  const [classes, setClasses] = useState<ClassDef[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [selectedBoss, setSelectedBoss] = useState("");
  const [offers, setOffers] = useState<RecruitOffer[] | null>(null);
  const [room, setRoom] = useState<Room<BattleState> | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const clientRef = useRef<Client | null>(null);

  const refresh = useCallback(() => {
    api<MeResponse>("/me", { token }).then(setMe);
  }, [token]);

  useEffect(() => {
    api<{ bosses: BossInfo[] }>("/portal/bosses", { token }).then((r) => setBosses(r.bosses));
    api<ClassDef[]>("/content/classes").then(setClasses);
    refresh();
  }, [token, refresh]);

  const classById = new Map(classes.map((c) => [c.id, c]));

  const doRecruit = async () => {
    setError("");
    if (!selectedBoss) {
      setError(t("portal.noBoss"));
      return;
    }
    try {
      const r = await api<{ offers: RecruitOffer[] }>("/portal/recruit", { method: "POST", token });
      setOffers(r.offers);
    } catch (e) {
      setError(e instanceof Error ? t(`error.${e instanceof Error ? e.message : "unknown"}`) : t("error.unknown"));
    }
  };

  const startBattle = async (offer: RecruitOffer) => {
    if (starting) return;
    setError("");
    setStarting(true);
    try {
      if (!clientRef.current) clientRef.current = new Client(wsUrl());
      const r = await clientRef.current.create<BattleState>("battle", {
        token,
        mode: "pve",
        bossClassId: selectedBoss,
        recruit: offer,
      });
      setRoom(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.unknown"));
    } finally {
      setStarting(false);
    }
  };

  const addAffinity = async (element: string) => {
    try {
      await api("/visitor/affinity", { method: "POST", token, body: { element } });
      refresh();
    } catch (e) {
      setError(t(`error.${e instanceof Error ? e.message : "unknown"}`));
    }
  };

  if (room) {
    return (
      <BattleView
        room={room}
        token={token}
        lang={lang}
        t={t}
        onLeave={() => {
          setRoom(null);
          setOffers(null);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="portal">
      <div className="portal-header">
        <h2>{t("portal.title")}</h2>
        {me && (
          <div className="portal-stats">
            <span>
              {t("portal.wallet")}: {me.user.magic_stones}
            </span>
            <span>
              {t("portal.level", { n: me.visitor.level })} · {t("portal.xp", { xp: me.visitor.xp })}/100
            </span>
            <span>
              {t("portal.affinityPoints", { n: me.visitor.affinityPoints })}
            </span>
          </div>
        )}
      </div>
      {me && me.visitor.affinityPoints > 0 && (
        <div className="affinity-row">
          <span>{t("portal.affinity")}:</span>
          {ELEMENTS.map((el) => (
            <button key={el} className="ghost" onClick={() => void addAffinity(el)}>
              {t(`elem.${el}`)} +1 ({me.visitor.affinity[el] ?? 0})
            </button>
          ))}
        </div>
      )}
      <h3>{t("portal.bosses")}</h3>
      <div className="card-row">
        {bosses.map((b) => (
          <button
            key={b.id}
            className={`card selectable rarity-rare ${selectedBoss === b.id ? "active" : ""}`}
            onClick={() => setSelectedBoss(b.id)}
          >
            <ClassArt classId={b.id} />
            <div className="card-name">{localizeClassName(b, lang)}</div>
            <div className="card-text">
              HP {b.hp} · {b.skills.map((s) => s.name).join("、")}
            </div>
          </button>
        ))}
      </div>
      <div className="battle-actions">
        <button onClick={() => void doRecruit()}>{t("portal.recruit")}</button>
      </div>
      {offers && (
        <>
          <h3>{t("portal.offers")}</h3>
          <div className="card-row">
            {offers.map((offer, i) => {
              const cls = classById.get(offer.classId);
              return (
                <button
                  key={i}
                  className={`card selectable rarity-${offer.rarity}`}
                  disabled={starting}
                  onClick={() => void startBattle(offer)}
                >
                  <ClassArt classId={offer.classId} />
                  <div className="card-name">{starting ? t("battle.connecting") : offer.name}</div>
                  <div className="card-text">
                    {cls ? localizeClassName(cls, lang) : offer.classId} · {offer.rarity}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
