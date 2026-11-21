import crypto from "node:crypto";
import fs from "node:fs";
import type { Server as HttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Colyseus from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Hono, type Context, type Next } from "hono";
import { createAdaptorServer } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getMeta, openDb, setMeta } from "@pyrocardian/db";
import type { ClassId } from "@pyrocardian/shared";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth";
import { loadContent } from "./cards";
import { BattleRoom } from "./rooms/BattleRoom";

const { Server } = Colyseus;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? path.join(repoRoot, "data", "pyrocardian.db");

const db = openDb(DB_PATH);
let jwtSecret = getMeta(db, "jwt_secret");
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString("hex");
  setMeta(db, "jwt_secret", jwtSecret);
}

const content = loadContent();
const TOKEN_TTL_SECONDS = 30 * 24 * 3600;

const NAME_PREFIX = ["雾港的", "林间的", "灯塔下的", "磨坊旁的", "星野的", "港口的"];
const NAME_CORE = ["艾琳", "诺亚", "米娅", "尤卡", "莉莉丝", "卡尔", "芙蕾雅", "奥斯卡"];

function randomName(): string {
  const prefix = NAME_PREFIX[Math.floor(Math.random() * NAME_PREFIX.length)];
  const core = NAME_CORE[Math.floor(Math.random() * NAME_CORE.length)];
  return prefix + core;
}

function seedStarterCards(userId: string): void {
  const now = Date.now();
  const insertCard = db.prepare(
    "INSERT INTO player_cards (instance_id, user_id, kind, def_id, rarity, class_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertCard.run(crypto.randomUUID(), userId, "character", "character_visitor", "common", "visitor", randomName(), now);
  const mages: ClassId[] = ["mage_fire", "mage_water", "mage_thunder", "mage_ice", "mage_earth"];
  const mage = mages[Math.floor(Math.random() * mages.length)];
  insertCard.run(crypto.randomUUID(), userId, "character", `character_${mage}`, "common", mage, randomName(), now + 1);
  for (const defId of ["strike", "heavy_strike", "heal_potion", "ward"]) {
    insertCard.run(crypto.randomUUID(), userId, "skill", defId, "common", null, null, now + 2);
  }
  const insertProgress = db.prepare(
    "INSERT INTO word_progress (user_id, word_id, reps, interval_ms, due_at) VALUES (?, ?, 0, 0, ?)"
  );
  for (const word of content.words.slice(0, 5)) {
    insertCard.run(crypto.randomUUID(), userId, "word", word.id, "common", null, null, now + 3);
    insertProgress.run(userId, word.id, now);
  }
}

type AppContext = { Variables: { userId: string } };
const app = new Hono<AppContext>();

const authMw = async (c: Context<AppContext>, next: Next) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = token ? verifyToken(token, jwtSecret) : null;
  if (!payload || typeof payload.sub !== "string") {
    return c.json({ error: "未登录或登录已过期" }, 401);
  }
  c.set("userId", payload.sub);
  await next();
};

app.get("/api/health", (c) =>
  c.json({ ok: true, skills: content.skills.length, words: content.words.length, classes: content.classes.length })
);

app.get("/api/content/classes", (c) => c.json(content.classes));
app.get("/api/content/skills", (c) => c.json(content.skills));
app.get("/api/content/summons", (c) => c.json(content.summons));
app.get("/api/content/words", (c) => c.json(content.words));

app.post("/api/auth/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email.includes("@") || password.length < 6) {
    return c.json({ error: "邮箱无效，或密码少于 6 位" }, 400);
  }
  const id = crypto.randomUUID();
  try {
    db.prepare("INSERT INTO users (id, email, pass_hash, created_at) VALUES (?, ?, ?, ?)").run(
      id,
      email,
      hashPassword(password),
      Date.now()
    );
  } catch {
    return c.json({ error: "该邮箱已注册" }, 409);
  }
  seedStarterCards(id);
  return c.json({ token: signToken({ sub: id }, jwtSecret, TOKEN_TTL_SECONDS), user: { id, email } });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const row = db
    .prepare("SELECT id, pass_hash FROM users WHERE email = ?")
    .get(email) as { id: string; pass_hash: string } | undefined;
  if (!row || !verifyPassword(String(body.password ?? ""), row.pass_hash)) {
    return c.json({ error: "邮箱或密码错误" }, 401);
  }
  return c.json({ token: signToken({ sub: row.id }, jwtSecret, TOKEN_TTL_SECONDS), user: { id: row.id, email } });
});

app.get("/api/me", authMw, (c) => {
  const userId = c.get("userId");
  const user = db.prepare("SELECT id, email, created_at FROM users WHERE id = ?").get(userId);
  const cards = db
    .prepare(
      "SELECT instance_id, kind, def_id, rarity, class_id, name, created_at FROM player_cards WHERE user_id = ? ORDER BY created_at, instance_id"
    )
    .all(userId);
  return c.json({ user, cards });
});

app.get("/api/words/due", authMw, (c) => {
  const rows = db
    .prepare(
      `SELECT pc.def_id AS word_id, COALESCE(wp.reps, 0) AS reps, COALESCE(wp.due_at, 0) AS due_at
       FROM player_cards pc
       LEFT JOIN word_progress wp ON wp.user_id = pc.user_id AND wp.word_id = pc.def_id
       WHERE pc.user_id = ? AND pc.kind = 'word' AND COALESCE(wp.due_at, 0) <= ?
       ORDER BY due_at`
    )
    .all(c.get("userId"), Date.now());
  return c.json({ due: rows });
});

app.post("/api/words/review", authMw, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const wordId = String(body.wordId ?? "");
  if (!content.words.some((w) => w.id === wordId)) {
    return c.json({ error: "未知单词卡" }, 400);
  }
  const userId = c.get("userId");
  const correct = Boolean(body.correct);
  const row = db
    .prepare("SELECT reps, interval_ms FROM word_progress WHERE user_id = ? AND word_id = ?")
    .get(userId, wordId) as { reps: number; interval_ms: number } | undefined;
  const dayMs = 24 * 3600 * 1000;
  const reps = (row?.reps ?? 0) + (correct ? 1 : 0);
  const interval = correct
    ? Math.min(30 * dayMs, Math.max(dayMs, (row?.interval_ms ?? 0) * 2 || dayMs))
    : dayMs;
  db.prepare(
    `INSERT INTO word_progress (user_id, word_id, reps, interval_ms, due_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, word_id) DO UPDATE SET reps = excluded.reps, interval_ms = excluded.interval_ms, due_at = excluded.due_at`
  ).run(userId, wordId, reps, interval, Date.now() + interval);
  return c.json({ ok: true, reps, intervalMs: interval });
});

const assetsRoot = path.join(repoRoot, "content", "assets");
app.use("/assets/*", serveStatic({ root: assetsRoot }));

const webDist = path.join(repoRoot, "apps", "web", "dist");
if (fs.existsSync(webDist)) {
  app.use("/*", serveStatic({ root: webDist }));
}

const httpServer = createAdaptorServer({ fetch: app.fetch });
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer as HttpServer }),
});
gameServer.define("battle", BattleRoom);

httpServer.listen(PORT, () => {
  console.log(`[pyrocardian] listening on http://localhost:${PORT} (db: ${DB_PATH})`);
});
