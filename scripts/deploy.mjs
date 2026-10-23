#!/usr/bin/env node
/**
 * Deploy after local check. Reads NETLIFY_AUTH_TOKEN from .env.
 * Usage: npm run deploy
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

/**
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function loadEnv(filePath) {
  if (!existsSync(filePath)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envFile = loadEnv(join(root, ".env"));
const token = process.env.NETLIFY_AUTH_TOKEN || envFile.NETLIFY_AUTH_TOKEN;
const siteId = process.env.NETLIFY_SITE_ID || envFile.NETLIFY_SITE_ID;

if (!token) {
  console.error("Missing NETLIFY_AUTH_TOKEN in .env");
  process.exit(1);
}
if (!siteId) {
  console.error("Missing NETLIFY_SITE_ID in .env");
  process.exit(1);
}

const check = spawnSync(process.execPath, [join(root, "scripts/check-local.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (check.status !== 0) process.exit(check.status || 1);

const result = spawnSync(
  "npx",
  ["--yes", "netlify-cli", "deploy", "--prod", "--dir=.", `--auth=${token}`, `--site=${siteId}`],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NETLIFY_AUTH_TOKEN: token },
  }
);

process.exit(result.status || 0);
