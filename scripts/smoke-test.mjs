const base = process.env.BASE_URL ?? "http://127.0.0.1:3210";

const fail = (msg) => {
  console.error(`smoke failed: ${msg}`);
  process.exit(1);
};

const health = await (await fetch(`${base}/api/health`)).json();
if (!health.ok) fail(`health: ${JSON.stringify(health)}`);

const email = `ci-${Date.now()}@cardian.test`;
const regRes = await fetch(`${base}/api/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password: "secret123" }),
});
if (regRes.status !== 200) fail(`register status ${regRes.status}`);
const reg = await regRes.json();
if (!reg.token) fail(`register: ${JSON.stringify(reg)}`);

const meRes = await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${reg.token}` } });
if (meRes.status !== 200) fail(`me status ${meRes.status}`);
const me = await meRes.json();
const kinds = new Set(me.cards.map((c) => c.kind));
if (!kinds.has("character") || !kinds.has("skill") || !kinds.has("word")) {
  fail(`starter cards missing kinds: ${[...kinds].join(",")}`);
}
if (!me.cards.some((c) => c.kind === "character" && c.class_id === "visitor")) {
  fail("visitor character card missing");
}

const unauth = await fetch(`${base}/api/me`);
if (unauth.status !== 401) fail(`unauth expected 401, got ${unauth.status}`);

const due = await (
  await fetch(`${base}/api/words/due`, { headers: { authorization: `Bearer ${reg.token}` } })
).json();
if (!Array.isArray(due.due) || due.due.length === 0) fail("no due word cards");

const review = await (
  await fetch(`${base}/api/words/review`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${reg.token}` },
    body: JSON.stringify({ wordId: due.due[0].word_id, correct: true }),
  })
).json();
if (!review.ok) fail(`review: ${JSON.stringify(review)}`);

const skills = await (await fetch(`${base}/api/content/skills`)).json();
if (!Array.isArray(skills) || skills.length === 0) fail("no skill cards");

console.log(`smoke ok: health=${JSON.stringify(health)}, cards=${me.cards.length}, due=${due.due.length}`);
