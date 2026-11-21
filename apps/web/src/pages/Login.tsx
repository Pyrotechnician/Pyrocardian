import { useState, type FormEvent } from "react";
import { api } from "../api";

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
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
      setError(err instanceof Error ? err.message : "出错了");
    }
  };

  return (
    <div className="login">
      <h1>卡迪安 Cardian</h1>
      <p>翻开你的第一张卡，进入卡牌世界。</p>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="密码（至少 6 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit">{mode === "login" ? "进入世界" : "注册并进入世界"}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "没有账号？注册新角色" : "已有账号？登录"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
