import { Client } from "colyseus.js";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3210";
const fail = (m) => {
  console.error(`battle test failed: ${m}`);
  process.exit(1);
};

async function register(email) {
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "secret123" }),
  });
  const data = await res.json();
  if (!data.token) fail(`register ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

async function visitorInstance(token) {
  const me = await (
    await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  const card = me.cards.find((c) => c.kind === "character" && c.class_id === "visitor");
  if (!card) fail("visitor card missing");
  return card.instance_id;
}

async function waitFor(fn, label, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  fail(`timeout: ${label}`);
}

const suffix = Date.now();
const tokenA = await register(`battle-a-${suffix}@cardian.test`);
const tokenB = await register(`battle-b-${suffix}@cardian.test`);
const charA = await visitorInstance(tokenA);
const charB = await visitorInstance(tokenB);

const clientA = new Client(base);
const roomA = await clientA.create("battle", { token: tokenA, characterInstanceId: charA });
const clientB = new Client(base);
const roomB = await clientB.joinById(roomA.roomId, { token: tokenB, characterInstanceId: charB });

await waitFor(() => roomA.state?.phase === "playing", "phase playing");
const players = [...roomA.state.players.keys()];
if (players.length !== 2) fail(`players=${players.length}`);
const firstTurn = roomA.state.turn;
if (!firstTurn) fail("empty turn");

roomA.send("endTurn");
await waitFor(() => roomA.state.turn !== firstTurn && roomA.state.turn !== "", "turn switch");

const skills = await (await fetch(`${base}/api/content/skills`)).json();
const skillById = new Map(skills.map((s) => [s.id, s]));
const currentId = roomA.state.turn;
const current = roomA.state.players.get(currentId);
const handBefore = current.hand.length;
const idx = [...current.hand].findIndex((id) => {
  const def = skillById.get(id);
  return def && def.cost <= current.mana;
});
if (idx >= 0) {
  const sender = currentId === roomA.sessionId ? roomA : roomB;
  sender.send("playCard", { handIndex: idx });
  await waitFor(
    () => roomA.state.players.get(currentId).hand.length === handBefore - 1,
    "card played"
  );
}

console.log("battle test ok: room created, 2 players joined, turn switched, card played");
roomA.leave();
roomB.leave();
process.exit(0);
