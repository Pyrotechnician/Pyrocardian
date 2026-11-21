import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const genDir = process.env.GEN_DIR ?? "/tmp/gen";
const outDir = path.join(repoRoot, "content", "assets", process.env.OUT_SUBDIR ?? "cards");

fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(genDir).filter((f) => f.endsWith(".json"))) {
  const cardId = file.replace(/\.json$/, "");
  const target = path.join(outDir, `${cardId}.jpg`);
  if (fs.existsSync(target)) {
    console.log(`skip ${cardId}.jpg (already exists)`);
    continue;
  }
  let parsed = JSON.parse(fs.readFileSync(path.join(genDir, file), "utf8"));
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  const res = await fetch(parsed.url);
  if (!res.ok) {
    console.error(`skip ${cardId}: download failed (${res.status})`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, buf);
  console.log(`saved ${cardId}.jpg (${buf.length} bytes)`);
}
