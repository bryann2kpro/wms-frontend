/**
 * Semi-automated GRN creation script.
 *
 * Opens a real browser, selects the Advance Notice for each PO, then
 * auto-fills what it can (Supplier DO, Received Date). You fill in the
 * remaining fields (Carton qty, Lot No., Expiry Date, Racks) and click
 * "Submit for Approval". The script then moves on to the next PO.
 *
 * Usage:
 *   dotenv -e .env.e2e -- bun run ./scripts/create-grn.ts PO26040093 PO26040094
 *
 * Requirements:
 *   • Frontend running on http://localhost:3000  (or set E2E_BASE_URL)
 *   • E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD set in .env.e2e
 */

import { chromium, type Page } from "@playwright/test";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import * as readline from "node:readline";

// ---------------------------------------------------------------------------
// Load .env.e2e automatically if env vars aren't already set
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
  console.log("📄  Loaded env from .env.e2e");
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:7777";

const poNumbers = process.argv.slice(2);
if (!poNumbers.length) {
  console.error(
    "Usage: dotenv -e .env.e2e -- bun run ./scripts/create-grn.ts PO26040093 PO26040094",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveSupplierDO(po: string): string {
  return po.replace(/^PO/i, "DO");
}

function generateLotNo(index: number): string {
  const date = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const datePart = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LOT-${datePart}-${String(index + 1).padStart(3, "0")}-${rand}`;
}

function generateExpiryDate(): string {
  // Default: 1 year from today — modify in the browser if needed
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function fillDatetimeNow(page: Page, selector: string) {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const value = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
  await page.fill(selector, value);
}

async function fillItemsAndRacks(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]:has-text("Create New GRN")');
  const cards = dialog.locator(".relative.rounded-xl.border.bg-card");
  const itemCount = await dialog.locator('[aria-label="Remove item"]').count();

  const expiry = generateExpiryDate();
  console.log(`\n    Auto-filling ${itemCount} item(s):`);
  console.log(`    • Expiry Date → ${expiry} (edit in browser if needed)`);

  for (let i = 0; i < itemCount; i++) {
    const card = cards.nth(i);
    const lotNo = generateLotNo(i);

    // Expiry date
    const expiryInput = card.locator('input[placeholder="YYYY-MM-DD"]');
    if ((await expiryInput.count()) > 0) {
      await expiryInput.fill(expiry);
    }

    // Lot No.
    const lotInput = card.locator('input[placeholder*="LOT"]');
    if ((await lotInput.count()) > 0) {
      await lotInput.fill(lotNo);
      console.log(`    • Item ${i + 1} Lot No. → ${lotNo}`);
    }

    // Rack — pick first available
    const rackBtn = dialog.locator("button", { hasText: /^Rack$/ }).nth(i);
    await rackBtn.scrollIntoViewIfNeeded();
    await rackBtn.click();

    const popover = page.locator("[data-radix-popper-content-wrapper]").last();
    await popover.waitFor({ state: "visible", timeout: 5_000 });

    const firstRack = popover.locator("ul li button").first();
    if ((await firstRack.count()) > 0) {
      const rackName = await firstRack.textContent();
      await firstRack.click();
      console.log(`    • Item ${i + 1} Rack    → ${rackName?.trim()}`);
    } else {
      await page.keyboard.press("Escape");
      console.log(`    ⚠️  Item ${i + 1}: no racks found — assign manually`);
    }
  }
}

async function loginAndInjectTokens(page: Page): Promise<void> {
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
  if (!res.ok) throw new Error(`Login failed [${res.status}]: ${await res.text()}`);

  const json = (await res.json()) as {
    data?: { accessToken: string; refreshToken: string; expiredAt: number };
  };
  if (!json.data) throw new Error("Login response missing data");

  const { accessToken, refreshToken, expiredAt } = json.data;

  // Inject into every new page that opens
  await page.addInitScript(
    ({ at, rt, exp }) => {
      localStorage.setItem("access_token", at);
      localStorage.setItem("refresh_token", rt);
      localStorage.setItem("token_expiry", String(exp));
    },
    { at: accessToken, rt: refreshToken, exp: expiredAt },
  );
}

// ---------------------------------------------------------------------------
// Approve + Send to ES
// ---------------------------------------------------------------------------

async function approveAndSendToES(page: Page, po: string): Promise<void> {
  // Find the newly created row by PO number
  const row = page
    .getByRole("table")
    .locator("tbody tr")
    .filter({ hasText: po });
  await row.waitFor({ timeout: 20_000 });

  // Open the detail panel
  await row.locator("button:has(svg)").first().click();

  // Approve
  console.log("    Approving…");
  const approveBtn = page.getByRole("button", { name: /^Approve$/i });
  await approveBtn.waitFor({ timeout: 8_000 });
  await approveBtn.click();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /GRN approved/i })
    .waitFor({ timeout: 10_000 });
  console.log("    ✅  Approved.");

  // Send to ES
  console.log("    Sending to ES…");
  const sendBtn = page.getByRole("button", { name: /Send to ES/i });
  await sendBtn.waitFor({ timeout: 30_000 });
  await sendBtn.click();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /GRN sent to ES/i })
    .waitFor({ timeout: 20_000 });
  console.log("    ✅  Sent to ES.");
}

// ---------------------------------------------------------------------------
// Per-PO GRN creation flow
// ---------------------------------------------------------------------------

async function createGrnForPO(page: Page, po: string): Promise<void> {
  const supplierDO = deriveSupplierDO(po);

  console.log(`\n──────────────────────────────────────────`);
  console.log(`📦  Starting GRN for ${po}`);
  console.log(`    Supplier DO will be set to: ${supplierDO}`);
  console.log(`──────────────────────────────────────────`);

  await page.goto("/admin/grn");
  await page.waitForLoadState("domcontentloaded");

  // Guard: if redirected to login, tokens didn't take — surface a clear error
  if (page.url().includes("/login")) {
    throw new Error(
      "Redirected to login after navigation — check that E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are correct.",
    );
  }

  // Wait for the GRN page to actually render
  await page.waitForSelector('button:has-text("Create GRN")', { timeout: 20_000 });

  await page.click('button:has-text("Create GRN")');

  // ── Step 1: AN picker ────────────────────────────────────────────────────
  await page.waitForSelector(
    '[role="dialog"]:has-text("Select Advance Shipping Notice")',
    { timeout: 10_000 },
  );

  await page.click("#asn-select");

  const option = page.getByRole("option", {
    name: new RegExp(po.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  });
  await option.waitFor({ timeout: 8_000 });
  await option.click();

  await page.click('button:has-text("Continue")');

  // ── Step 2: GRN form — auto-fill what we can ─────────────────────────────
  await page.waitForSelector('[role="dialog"]:has-text("Create New GRN")', {
    timeout: 8_000,
  });

  await page.fill("#supplierDO", supplierDO);
  await fillDatetimeNow(page, "#receivedDate");
  await fillItemsAndRacks(page);

  console.log(`\n✅  Auto-filled:`);
  console.log(`    • Supplier DO   → ${supplierDO}`);
  console.log(`    • Received Date → now`);
  console.log(`    • Lot No., Expiry Date, Racks (see above)`);
  console.log(`\n👉  Your turn — fill in the remaining fields in the browser:`);
  console.log(`    • Carton qty (each item)`);
  console.log(`    • Adjust Expiry Date if needed`);
  console.log(`\n    When done, click "Submit for Approval" in the dialog.`);
  console.log(`    The script will automatically detect the success and move on.`);

  await waitForUserSubmit(page);
  console.log(`\n✅  GRN for ${po} submitted.`);

  await approveAndSendToES(page, po);
  console.log(`\n🎯  GRN for ${po} fully processed (Sent to ES)!\n`);
}

async function waitForUserSubmit(page: Page): Promise<void> {
  const toastPromise = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /created|saved|success/i })
    .waitFor({ timeout: 10 * 60 * 1000 })
    .then(() => "toast" as const);

  const enterPromise = new Promise<"enter">((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    rl.once("line", () => {
      rl.close();
      resolve("enter");
    });
  });

  const winner = await Promise.race([toastPromise, enterPromise]);
  if (winner === "enter") {
    console.log("(Continued by ENTER — make sure the form was submitted.)");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  console.log("🔑  Logging in…");
  await loginAndInjectTokens(page);

  // Navigate once to establish the session before the loop
  await page.goto("/admin/grn");
  await page.waitForLoadState("domcontentloaded");

  if (page.url().includes("/login")) {
    throw new Error(
      "Login failed — check E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.e2e",
    );
  }
  console.log("✅  Logged in successfully.");

  for (const po of poNumbers) {
    await createGrnForPO(page, po);
  }

  console.log("🎉  All done! You can close the browser.");
  await page.waitForTimeout(5_000);
  await browser.close();
})().catch((err) => {
  console.error("❌  Script failed:", err.message ?? err);
  process.exit(1);
});
