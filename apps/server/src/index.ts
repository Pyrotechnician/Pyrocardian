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
import {
  ELEMENTS,
  RARITY_RANK,
  RARITIES,
  type ClassId,
  type Element,
  type Rarity,
  type RecruitOffer,
} from "@pyrocardian/shared";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth";
import { loadContent } from "./cards";
import { initContext } from "./context";
import { BattleRoom } from "./rooms/BattleRoom";

const { Server } = Colyseus;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const DB_PATH = process.env.DB_PATH ?? path.join(repoRoot, "data", "pyrocardian.db");

const db = openDb(DB_PATH);
let jwtSecret = getMeta(db, "jwt_secret");
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString("hex");
  setMeta(db, "jwt_secret", jwtSecret);
}

const content = loadContent();
initContext({ db, content, jwtSecret });
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
    return c.json({ error: "auth.unauthorized" }, 401);
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
    return c.json({ error: "auth.invalid_input" }, 400);
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
    return c.json({ error: "auth.email_taken" }, 409);
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
    return c.json({ error: "auth.invalid_credentials" }, 401);
  }
  return c.json({ token: signToken({ sub: row.id }, jwtSecret, TOKEN_TTL_SECONDS), user: { id: row.id, email } });
});

function getVisitor(userId: string) {
  let row = db.prepare("SELECT xp, level, affinity_points, affinity FROM visitor WHERE user_id = ?").get(userId) as
    | { xp: number; level: number; affinity_points: number; affinity: string }
    | undefined;
  if (!row) {
    db.prepare("INSERT INTO visitor (user_id) VALUES (?)").run(userId);
    row = { xp: 0, level: 1, affinity_points: 0, affinity: "{}" };
  }
  return row;
}

function rollRarity(): Rarity {
  const r = Math.random();
  if (r < 0.6) return "common";
  if (r < 0.9) return "rare";
  if (r < 0.99) return "epic";
  return "legendary";
}

app.get("/api/me", authMw, (c) => {
  const userId = c.get("userId");
  const user = db
    .prepare("SELECT id, email, created_at, magic_stones FROM users WHERE id = ?")
    .get(userId);
  const cards = db
    .prepare(
      "SELECT instance_id, kind, def_id, rarity, class_id, name, created_at FROM player_cards WHERE user_id = ? ORDER BY created_at, instance_id"
    )
    .all(userId);
  const visitor = getVisitor(userId);
  return c.json({
    user,
    cards,
    visitor: {
      xp: visitor.xp,
      level: visitor.level,
      affinityPoints: visitor.affinity_points,
      affinity: JSON.parse(visitor.affinity) as Record<string, number>,
    },
  });
});

app.get("/api/portal/bosses", authMw, (c) => {
  const bosses = content.classes
    .filter((cl) => cl.boss)
    .map((cl) => ({
      ...cl,
      skills: (cl.deck ?? [])
        .map((id) => content.skills.find((s) => s.id === id))
        .filter((s) => Boolean(s)),
    }));
  return c.json({ bosses });
});

app.post("/api/portal/recruit", authMw, (c) => {
  const userId = c.get("userId");
  const visitor = getVisitor(userId);
  const affinity = JSON.parse(visitor.affinity) as Record<string, number>;
  const pool = content.classes.filter((cl) => cl.recruitable);
  const used = new Set<string>();
  const offers: RecruitOffer[] = [];
  for (let i = 0; i < 3 && used.size < pool.length; i++) {
    let total = 0;
    const weights = pool.map((cl) => {
      if (used.has(cl.id)) return 0;
      const el = cl.id.startsWith("mage_") ? cl.id.slice(5) : "";
      const w = 1 + (affinity[el] ?? 0) * 0.5;
      total += w;
      return w;
    });
    let r = Math.random() * total;
    let picked = pool[0];
    for (let j = 0; j < pool.length; j++) {
      r -= weights[j];
      if (r <= 0 && !used.has(pool[j].id)) {
        picked = pool[j];
        break;
      }
    }
    used.add(picked.id);
    offers.push({ classId: picked.id, name: randomName(), rarity: rollRarity() });
  }
  return c.json({ offers });
});

app.post("/api/library/identify", authMw, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const instanceId = String(body.instanceId ?? "");
  const userId = c.get("userId");
  const row = db
    .prepare("SELECT def_id, rarity FROM player_cards WHERE instance_id = ? AND user_id = ? AND kind = 'ancient'")
    .get(instanceId, userId) as { def_id: string; rarity: Rarity } | undefined;
  if (!row) return c.json({ error: "cards.not_ancient" }, 400);
  const ancientDef = content.ancient.find((a) => a.id === row.def_id);
  const minRank = RARITY_RANK[row.rarity] ?? 0;
  const candidates = content.skills.filter((s) => (RARITY_RANK[s.rarity] ?? 0) >= minRank);
  const pool = candidates.length > 0 ? candidates : content.skills;
  const replacement = pool[Math.floor(Math.random() * pool.length)];
  db.prepare(
    "UPDATE player_cards SET kind = 'skill', def_id = ?, class_id = null, name = null WHERE instance_id = ? AND user_id = ?"
  ).run(replacement.id, instanceId, userId);
  return c.json({ ok: true, instanceId, card: replacement, wasRarity: ancientDef?.rarity ?? row.rarity });
});

app.post("/api/visitor/affinity", authMw, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const element = String(body.element ?? "");
  if (!ELEMENTS.includes(element as Element)) return c.json({ error: "visitor.bad_element" }, 400);
  const userId = c.get("userId");
  const visitor = getVisitor(userId);
  if (visitor.affinity_points <= 0) return c.json({ error: "visitor.no_points" }, 400);
  const affinity = JSON.parse(visitor.affinity) as Record<string, number>;
  affinity[element] = (affinity[element] ?? 0) + 1;
  db.prepare("UPDATE visitor SET affinity = ?, affinity_points = affinity_points - 1 WHERE user_id = ?").run(
    JSON.stringify(affinity),
    userId
  );
  return c.json({ ok: true, affinity, affinityPoints: visitor.affinity_points - 1 });
});

app.get("/api/content/ancient", (c) => c.json(content.ancient));

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
    return c.json({ error: "words.unknown_card" }, 400);
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

httpServer.listen(PORT, HOST, () => {
  console.log(`[pyrocardian] listening on http://${HOST}:${PORT} (db: ${DB_PATH})`);
});
