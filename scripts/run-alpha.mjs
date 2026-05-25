#!/usr/bin/env node
/**
 * Admin script to trigger the Alpha Tracker pipeline.
 *
 * Usage:
 *   npm run alpha:run
 *
 * Or with a custom URL:
 *   SITE_URL=https://conviqt.com npm run alpha:run
 *
 * Requires ALPHA_RUN_SECRET to be set in .env.local or as an env var.
 * The secret authenticates the POST to /api/alpha/run.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local if present
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on actual env vars
  }
}

loadEnvLocal();

const SITE_URL = process.env.SITE_URL ?? "https://conviqt.com";
const SECRET = process.env.ALPHA_RUN_SECRET;

if (!SECRET) {
  console.error("❌  ALPHA_RUN_SECRET is not set. Add it to .env.local or export it before running.");
  process.exit(1);
}

const endpoint = `${SITE_URL}/api/alpha/run`;
console.log(`🚀  Triggering Alpha Tracker pipeline: ${endpoint}`);
console.log(`    (prices updated for all active positions + new pick generated)\n`);

try {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();

  if (!res.ok) {
    console.error(`❌  HTTP ${res.status}:`, body);
    process.exit(1);
  }

  console.log(`✅  Pipeline complete in ${(body.durationMs / 1000).toFixed(1)}s`);
  console.log(`    Cost: $${body.costUSD?.toFixed(4) ?? "?"}`);

  if (body.sells?.length) {
    console.log(`\n📤  Exited positions:`);
    for (const s of body.sells) console.log(`    • ${s.ticker}: ${s.reason}`);
  }

  if (body.new_picks?.length) {
    console.log(`\n📥  New picks:`);
    for (const p of body.new_picks) console.log(`    • ${p.ticker}`);
  } else {
    console.log(`\n    No new picks this run.`);
  }

  if (body.errors?.length) {
    console.warn(`\n⚠️  Errors (${body.errors.length}):`);
    for (const e of body.errors) console.warn(`    • ${e}`);
  }

  console.log(`\n🌐  View results: ${SITE_URL}/alpha`);
} catch (err) {
  console.error("❌  Fetch failed:", err.message);
  process.exit(1);
}
