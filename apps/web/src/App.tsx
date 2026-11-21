import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Town from "./pages/Town";
import { detectLang, makeT, type UILang } from "./i18n";

const TOKEN_KEY = "pyrocardian_token";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [lang, setLang] = useState<UILang>(() => detectLang());

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    localStorage.setItem("pyrocardian_lang", lang);
  }, [lang]);

  const t = makeT(lang);
  if (!token) return <Login onLogin={setToken} lang={lang} onLangChange={setLang} t={t} />;
  return <Town token={token} lang={lang} onLogout={() => setToken(null)} t={t} />;
}
