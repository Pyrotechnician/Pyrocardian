import { useEffect, useState } from "react";
import { api } from "../api";
import Collection, { type CardInstanceRow } from "./Collection";
import Library from "./Library";

interface MeResponse {
  user: { id: string; email: string; created_at: number };
  cards: CardInstanceRow[];
}

type Tab = "collection" | "library" | "arena" | "forge";

const TABS: [Tab, string][] = [
  ["collection", "收藏馆"],
  ["library", "图书馆"],
  ["arena", "竞技场"],
  ["forge", "熔炉"],
];

export default function Town({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("collection");
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    api<MeResponse>("/me", { token }).then(setMe).catch(() => onLogout());
  }, [token, onLogout]);

  return (
    <div className="town">
      <header className="town-header">
        <h1>卡迪安小镇广场</h1>
        <div className="town-user">
          <span>{me?.user.email ?? ""}</span>
          <button onClick={onLogout}>离开世界</button>
        </div>
      </header>
      <nav className="town-nav">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === "collection" && me && <Collection token={token} cards={me.cards} />}
        {tab === "library" && <Library token={token} />}
        {tab === "arena" && <p className="placeholder">竞技场施工中：PvE 关卡与好友房即将到来。</p>}
        {tab === "forge" && (
          <p className="placeholder">熔炉施工中：分解/合成（学者专属）即将到来。</p>
        )}
      </main>
    </div>
  );
}
