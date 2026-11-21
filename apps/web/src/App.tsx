import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Town from "./pages/Town";

const TOKEN_KEY = "pyrocardian_token";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  if (!token) return <Login onLogin={setToken} />;
  return <Town token={token} onLogout={() => setToken(null)} />;
}
