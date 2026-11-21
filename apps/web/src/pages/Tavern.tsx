import Collection from "./Collection";
import type { MeResponse } from "./Town";
import type { T, UILang } from "../i18n";

export default function Tavern({
  token,
  me,
  lang,
  t,
}: {
  token: string;
  me: MeResponse;
  lang: UILang;
  t: T;
}) {
  return (
    <div>
      <div className="portal-stats tavern-stats">
        <span>
          {t("portal.wallet")}: {me.user.magic_stones}
        </span>
        <span>
          {t("portal.level", { n: me.visitor.level })} · {t("portal.xp", { xp: me.visitor.xp })}/100
        </span>
        <span>{t("portal.affinityPoints", { n: me.visitor.affinityPoints })}</span>
      </div>
      <Collection token={token} cards={me.cards} lang={lang} t={t} />
    </div>
  );
}
