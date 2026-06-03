/**
 * Migrates area master data from the legacy SCM REST API into the WMS
 * via GraphQL mutations.
 *
 * Usage:
 *   bun run ./scripts/migrate-areas.ts
 *
 * Requirements:
 *   • Backend running on http://localhost:7777
 *   • E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD set (or in .env.e2e)
 *   • SCM_BEARER_TOKEN set (or passed via --token flag)
 */

import path from "node:path";
import { readFileSync, existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Load .env.e2e automatically
// ---------------------------------------------------------------------------

const envFile = path.join(import.meta.dirname, "../.env.e2e");
if (existsSync(envFile) && !process.env.E2E_ADMIN_EMAIL) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("Loaded env from .env.e2e");
}

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:7777";
const GQL_URL = `${BACKEND_URL}/graphql`;

const SCM_BASE =
  "https://luuwu.com/sme/scm-backend/public/api/v1/area/indexProcess/AREA_LIST_01";

// SCM bearer token — pass via --token <value> or SCM_BEARER_TOKEN env var
const tokenArgIdx = process.argv.indexOf("--token");
const SCM_TOKEN =
  tokenArgIdx !== -1
    ? process.argv[tokenArgIdx + 1]
    : (process.env.SCM_BEARER_TOKEN ?? "");

if (!SCM_TOKEN) {
  console.error(
    "SCM bearer token required. Pass --token <value> or set SCM_BEARER_TOKEN env var.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// WMS auth
// ---------------------------------------------------------------------------

async function getWmsToken(): Promise<{ token: string; userId: string }> {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in .env.e2e",
    );
  }

  const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });
  if (!res.ok)
    throw new Error(`WMS login failed [${res.status}]: ${await res.text()}`);

  const json = (await res.json()) as {
    data?: { accessToken: string; user?: { id: string } };
  };
  if (!json.data?.accessToken) throw new Error("Login response missing token");

  const token = json.data.accessToken;

  // Fetch current user id via REST profile endpoint
  const profileRes = await fetch(`${BACKEND_URL}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const profileJson = (await profileRes.json()) as {
    data?: { id: string };
    success?: boolean;
  };
  const userId = profileJson.data?.id ?? "";
  if (!userId) throw new Error("Could not resolve current user id from WMS");

  return { token, userId };
}

// ---------------------------------------------------------------------------
// SCM fetch
// ---------------------------------------------------------------------------

interface ScmArea {
  id: number;
  code: string;
  desc_01: string;
  desc_02: string;
}

interface ScmPage {
  data: ScmArea[];
  last_page: number;
  total: number;
}

async function fetchScmPage(page: number): Promise<ScmPage> {
  const url = `${SCM_BASE}?page=${page}&sorts[]=code:ASC&pageSize=20`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${SCM_TOKEN}`,
    },
  });
  if (!res.ok)
    throw new Error(`SCM fetch page ${page} failed [${res.status}]`);
  const json = (await res.json()) as { data: ScmPage };
  return json.data;
}

async function fetchAllScmAreas(): Promise<ScmArea[]> {
  const first = await fetchScmPage(1);
  const allAreas: ScmArea[] = [...first.data];
  console.log(`SCM total: ${first.total} areas across ${first.last_page} pages`);

  for (let page = 2; page <= first.last_page; page++) {
    const { data } = await fetchScmPage(page);
    allAreas.push(...data);
    process.stdout.write(`\rFetched page ${page}/${first.last_page} (${allAreas.length} areas)`);
  }
  console.log();
  return allAreas;
}

// ---------------------------------------------------------------------------
// WMS GraphQL mutation
// ---------------------------------------------------------------------------

const CREATE_AREA_MUTATION = `
  mutation CreateSetupArea($input: CreateSetupAreaInput!) {
    createSetupArea(input: $input) {
      id
      code
      description
    }
  }
`;

async function createArea(
  token: string,
  userId: string,
  area: ScmArea,
): Promise<{ id: string; code: string } | null> {
  const input = {
    code: area.code,
    description: area.desc_01 || area.code,
    createdBy: userId,
    updatedBy: userId,
  };

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: CREATE_AREA_MUTATION, variables: { input } }),
  });

  const json = (await res.json()) as {
    data?: { createSetupArea?: { id: string; code: string } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  return json.data?.createSetupArea ?? null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Area Migration ===\n");

  const [areas, { token, userId }] = await Promise.all([
    fetchAllScmAreas(),
    getWmsToken(),
  ]);

  console.log(`\nLogged in. User ID: ${userId}`);
  console.log(`Migrating ${areas.length} areas...\n`);

  let success = 0;
  let skipped = 0;
  const errors: Array<{ code: string; message: string }> = [];

  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    process.stdout.write(
      `\r[${i + 1}/${areas.length}] ${area.code.padEnd(10)} `,
    );

    try {
      await createArea(token, userId, area);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Duplicate codes are expected — skip silently
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("already exists")) {
        skipped++;
      } else {
        errors.push({ code: area.code, message: msg });
      }
    }
  }

  console.log("\n\n=== Results ===");
  console.log(`  Created : ${success}`);
  console.log(`  Skipped : ${skipped} (already exist)`);
  console.log(`  Errors  : ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nFailed areas:");
    for (const e of errors) {
      console.log(`  [${e.code}] ${e.message}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
