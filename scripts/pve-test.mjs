import { Client } from "colyseus.js";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3210";
const fail = (m) => {
  console.error(`pve test failed: ${m}`);
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

async function waitFor(fn, label, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  fail(`timeout: ${label}`);
}

const token = await register(`pve-${Date.now()}@cardian.test`);
const auth = { authorization: `Bearer ${token}` };
const me0 = await (await fetch(`${base}/api/me`, { headers: auth })).json();
const stones0 = me0.user.magic_stones;

const bossesRes = await (await fetch(`${base}/api/portal/bosses`, { headers: auth })).json();
if (!bossesRes.bosses || bossesRes.bosses.length === 0) fail("no bosses");
const boss = bossesRes.bosses[0];

const recruitRes = await (
  await fetch(`${base}/api/portal/recruit`, { method: "POST", headers: { ...auth, "content-type": "application/json" } })
).json();
if (!recruitRes.offers || recruitRes.offers.length !== 3) fail(`offers=${recruitRes.offers?.length}`);

const skills = await (await fetch(`${base}/api/content/skills`)).json();
const skillById = new Map(skills.map((s) => [s.id, s]));

const client = new Client(base);
const room = await client.create("battle", {
  token,
  mode: "pve",
  bossClassId: boss.id,
  recruit: recruitRes.offers[0],
});

await waitFor(() => room.state?.phase === "playing", "pve phase playing");
const playerCount = [...room.state.players.keys()].length;
if (playerCount !== 2) fail(`players=${playerCount} (expect human + AI boss)`);
const hasAi = [...room.state.players.values()].some((p) => p.ai);
if (!hasAi) fail("no AI boss player");

const myId = room.sessionId;
let guard = 0;
while (room.state?.phase === "playing" && guard < 80) {
  guard++;
  if (room.state.turn === myId) {
    const me = room.state.players.get(myId);
    const hand = [...me.hand];
    const meCards = await (await fetch(`${base}/api/me`, { headers: auth })).json();
    const instDef = new Map(meCards.cards.map((c) => [c.instance_id, c.def_id]));
    const idx = hand.findIndex((ref) => {
      const def = skillById.get(instDef.get(ref) ?? ref);
      return def && def.cost <= me.mana;
    });
    if (idx >= 0) room.send("playCard", { handIndex: idx });
    else if (!me.attacked) room.send("attack");
    room.send("endTurn");
  }
  await new Promise((r) => setTimeout(r, 250));
}

if (room.state?.phase !== "ended") fail(`battle did not end (phase=${room.state?.phase})`);

const me1 = await (await fetch(`${base}/api/me`, { headers: auth })).json();
const gainedStones = me1.user.magic_stones - stones0;
const ancientCount = me1.cards.filter((c) => c.kind === "ancient").length;
if (gainedStones <= 0 && ancientCount === 0) fail("no pve rewards granted");
console.log(
  `pve test ok: boss=${boss.id}, recruit=${recruitRes.offers[0].classId}, winner=${room.state.winner === myId ? "player" : "boss"}, stones +${gainedStones}, ancient=${ancientCount}, log=${room.state.log.length}`
);
room.leave();
process.exit(0);
