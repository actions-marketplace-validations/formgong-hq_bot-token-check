// node --test test/check.test.mjs
// Fixtures are written at run time: the fake secrets are assembled from pieces,
// so this repo never holds a string that secret scanners would flag.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CHECK = join(dirname(fileURLToPath(import.meta.url)), "..", "check.mjs");
const FAKE_TOKEN = "1234567890" + ":" + "AA" + "FAKE-not-a-real-token-for-this-test";
const FAKE_HOOK = "https://discord.com/api/web" + "hooks/123456789012345678/" + "x".repeat(68);

function site(files) {
  const root = mkdtempSync(join(tmpdir(), "btc-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}
const run = (dir) => spawnSync(process.execPath, [CHECK, dir], { encoding: "utf8" });

test("token in a const, away from the API URL line, fails", () => {
  const dir = site({
    "assets/index-abc.js": `const BOT_TOKEN = "${FAKE_TOKEN}";\nconst CHAT_ID = "1";\n\nfetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/sendMessage\`);`,
    "index.html": "<form></form>",
  });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Telegram bot token in .*index-abc\.js/);
  assert.ok(!r.stderr.includes(FAKE_TOKEN), "full token must not be printed");
});

test("Discord webhook URL fails", () => {
  const r = run(site({ "index.html": `<script>fetch("${FAKE_HOOK}", {method:"POST"})</script>` }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Discord webhook URL/);
  assert.ok(!r.stderr.includes(FAKE_HOOK));
});

test("form that posts to its own API route passes", () => {
  const r = run(site({ "assets/index.js": `fetch("/api/contact", {method:"POST", body:new FormData(form)})`, "index.html": "<form></form>" }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 files checked/);
});

test("bot URL with a placeholder, not a token, passes", () => {
  const r = run(site({ "a.js": `fetch("https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage")` }));
  assert.equal(r.status, 0, r.stderr);
});

test("missing folder exits 2, not 0", () => {
  assert.equal(run(join(tmpdir(), "btc-does-not-exist-" + Date.now())).status, 2);
});

test("folder with no text files exits 2, not 0", () => {
  assert.equal(run(site({ "logo.png": "binary" })).status, 2);
});
