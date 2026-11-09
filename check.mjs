#!/usr/bin/env node
// Fails (exit 1) when a Telegram bot token or a full Discord webhook URL is in the build output.
// Usage: npx github:formgong-hq/bot-token-check dist
// Prints only the first 14 characters of a match, so the secret does not end up in CI logs.
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const PATTERNS = {
  "Telegram bot token": /\b\d{8,10}:AA[A-Za-z0-9_-]{30,40}\b/,
  "Discord webhook URL": /discord(?:app)?\.com\/api\/webhooks\/\d{15,22}\/[A-Za-z0-9_-]{60,}/,
};
const TEXT = /\.(m?js|cjs|html?|css|json|map|txt|xml|svg)$/i;

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (TEXT.test(entry.name)) yield path;
  }
}

const dir = process.argv[2] || "dist";
const info = await stat(dir).catch(() => null);
if (!info?.isDirectory()) {
  console.error(`bot-token-check: "${dir}" is not a folder. Point it at your build output (dist, build, out, .next/static).`);
  process.exit(2);
}

let scanned = 0;
let found = 0;
for await (const file of files(dir)) {
  scanned++;
  const text = await readFile(file, "utf8");
  for (const [name, re] of Object.entries(PATTERNS)) {
    const m = text.match(re);
    if (m) {
      found++;
      console.error(`${name} in ${file}: ${m[0].slice(0, 14)}… (hidden)`);
    }
  }
}

// A check that read nothing would pass on anything, so treat it as a wrong path.
if (!scanned) {
  console.error(`bot-token-check: no .js/.html/.css/.json files in "${dir}". Did the build run, or is this the wrong folder?`);
  process.exit(2);
}
if (found) {
  console.error(`\n${found} secret(s) in ${dir} (${scanned} files checked). Revoke them, then move the call to a server.`);
  process.exit(1);
}
console.log(`No bot tokens or webhook URLs in ${dir} (${scanned} files checked).`);
