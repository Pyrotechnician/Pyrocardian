import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { T } from "../i18n";

export default function Login({ onLogin, t }: { onLogin: (token: string) => void; t: T }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("register");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ token: string }>(`/auth/${mode}`, {
        method: "POST",
        body: { email, password },
      });
      onLogin(res.token);
    } catch (err) {
      const code = err instanceof Error ? err.message : "unknown";
      setError(t(`error.${code}`));
    }
  };

  return (
    <div className="login">
      <h1>卡迪安 Cardian</h1>
      <p>{t("app.tagline")}</p>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder={t("login.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t("login.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit">{mode === "login" ? t("login.submitLogin") : t("login.submitRegister")}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? t("login.switchToRegister") : t("login.switchToLogin")}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
