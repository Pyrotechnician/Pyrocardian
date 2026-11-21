import { useEffect, useState } from "react";
import { api } from "../api";
import BattlePanel from "./Battle";
import Collection, { type CardInstanceRow } from "./Collection";
import Library from "./Library";
import type { T, UILang } from "../i18n";

interface MeResponse {
  user: { id: string; email: string; created_at: number };
  cards: CardInstanceRow[];
}

type Tab = "collection" | "library" | "arena" | "forge";

const TAB_KEYS: [Tab, string][] = [
  ["collection", "town.collection"],
  ["library", "town.library"],
  ["arena", "town.arena"],
  ["forge", "town.forge"],
];

export default function Town({
  token,
  lang,
  onLangChange,
  onLogout,
  t,
}: {
  token: string;
  lang: UILang;
  onLangChange: (lang: UILang) => void;
  onLogout: () => void;
  t: T;
}) {
  const [tab, setTab] = useState<Tab>("collection");
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    api<MeResponse>("/me", { token }).then(setMe).catch(() => onLogout());
  }, [token, onLogout]);

  return (
    <div className="town">
      <header className="town-header">
        <h1>{t("town.title")}</h1>
        <div className="town-user">
          <span>{me?.user.email ?? ""}</span>
          <button className="ghost" onClick={() => onLangChange(lang === "zh" ? "en" : "zh")}>
            {t("town.lang")}
          </button>
          <button onClick={onLogout}>{t("town.logout")}</button>
        </div>
      </header>
      <nav className="town-nav">
        {TAB_KEYS.map(([id, key]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {t(key)}
          </button>
        ))}
      </nav>
      <main>
        {tab === "collection" && me && <Collection token={token} cards={me.cards} lang={lang} t={t} />}
        {tab === "library" && <Library token={token} t={t} />}
        {tab === "arena" && <BattlePanel token={token} t={t} />}
        {tab === "forge" && <p className="placeholder">{t("town.forgePlaceholder")}</p>}
      </main>
    </div>
  );
}
