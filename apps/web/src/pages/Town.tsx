import { useEffect, useState } from "react";
import { api } from "../api";
import BattlePanel from "./Battle";
import type { CardInstanceRow } from "./Collection";
import Library from "./Library";
import Portal from "./Portal";
import Tavern from "./Tavern";
import type { T, UILang } from "../i18n";

export interface MeResponse {
  user: { id: string; email: string; magic_stones: number };
  cards: CardInstanceRow[];
  visitor: { xp: number; level: number; affinityPoints: number; affinity: Record<string, number> };
}

const BUILDINGS = ["arena", "portal", "forge", "tavern", "shop", "library"] as const;
type BuildingId = (typeof BUILDINGS)[number];

const LEAF_EMOJIS = ["🍃", "🍂", "🍃", "🍂", "🍃", "🍂", "🍁"];

export default function Town({
  token,
  lang,
  onLogout,
  t,
}: {
  token: string;
  lang: UILang;
  onLogout: () => void;
  t: T;
}) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [active, setActive] = useState<BuildingId | null>(null);

  useEffect(() => {
    api<MeResponse>("/me", { token }).then(setMe).catch(() => onLogout());
  }, [token, onLogout]);

  if (active) {
    return (
      <div
        className="interior"
        style={{ backgroundImage: `url(/assets/town/interior_${active}.jpg)` }}
      >
        <div className="interior-panel">
          <div className="interior-top">
            <h2>{t(`b.${active}`)}</h2>
            <button className="ghost" onClick={() => setActive(null)}>
              {t("town.back")}
            </button>
          </div>
          {active === "arena" && <BattlePanel token={token} lang={lang} t={t} />}
          {active === "portal" && <Portal token={token} lang={lang} t={t} />}
          {active === "tavern" && me && <Tavern token={token} me={me} lang={lang} t={t} />}
          {active === "library" && <Library token={token} t={t} />}
          {(active === "forge" || active === "shop") && (
            <p className="placeholder">{t("town.underConstruction", { name: t(`b.${active}`) })}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="town-scene">
      <div className="leaves">
        {LEAF_EMOJIS.map((emoji, i) => (
          <span
            key={i}
            className="leaf"
            style={{
              left: `${(i * 17 + 5) % 100}%`,
              animationDelay: `${i * 1.4}s`,
              animationDuration: `${7 + (i % 3) * 2}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
      <div className="town-topbar">
        <h1>{t("town.title")}</h1>
        <div className="town-user">
          <span>{me?.user.email ?? ""}</span>
          <button className="ghost" onClick={onLogout}>
            {t("town.logout")}
          </button>
        </div>
      </div>
      <div className="buildings">
        {BUILDINGS.map((b) => (
          <button key={b} className="building" onClick={() => setActive(b)}>
            <img src={`/assets/town/building_${b}.jpg`} alt={t(`b.${b}`)} />
            <span className="building-label">{t(`b.${b}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
