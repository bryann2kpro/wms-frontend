/**
 * GRN → ES Integration E2E Tests
 *
 * Covers the full inbound workflow driven by an Advance Notice (AN):
 *
 *   POST /api/v1/es/advance-notice  (backend seeding via API key)
 *   → Create GRN from AN picker     (Submit for Approval)
 *   → Approve GRN                   (Submitted → Approved)
 *   → Send to ES / Item Receipt     (Approved → Sent-to-ES)
 *
 * Test matrix:
 * ┌────┬─────────────────────────────────────────────────────────────────┐
 * │ ID │ Scenario                                                        │
 * ├────┼─────────────────────────────────────────────────────────────────┤
 * │ ES1│ 1-line AN, non-lot-tracked — happy path through full workflow   │
 * ├────┼─────────────────────────────────────────────────────────────────┤
 * │ ES2│ 2-line AN, lot-tracked items — expiry + lot required before ES  │
 * └────┴─────────────────────────────────────────────────────────────────┘
 *
 * Prerequisites
 * ─────────────
 * • Backend  : E2E_BACKEND_URL  (default http://localhost:7777)
 * • Frontend : E2E_BASE_URL     (default http://localhost:3000)
 * • Env file : .env.e2e  →  E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_API_KEY
 * • At least one Rack in the DB  (rack assignment is required by the form)
 * • Backend must be able to reach the ES endpoint (or use a test stub)
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import { postAdvanceNotice, uniqueTranid } from "./helpers/api";

// ============================================================================
// Types
// ============================================================================

type LineItem = {
  lineuniquekey: number;
  itemid: string;
  quantity: number;
  units: string;
  displayname: string;
  islotitem: "T" | "F";
  custrecord_r2o_order_code: string;
  /** Carton qty to enter (defaults to quantity if omitted) */
  carton?: number;
  loss?: number;
  expiryDate?: string;
  lotNo?: string;
};

// ============================================================================
// Page-object helpers
// ============================================================================

async function fillDatetimeLocal(input: Locator) {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  await input.fill(
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`,
  );
}

/** Open the ASN picker, select by tranid, then click Continue. Returns the GRN form dialog. */
async function selectAsnAndContinue(page: Page, tranid: string): Promise<Locator> {
  const asnDialog = page.getByRole("dialog", { name: /Select Advance Shipping Notice/i });
  await expect(asnDialog).toBeVisible({ timeout: 10_000 });

  const asnSelect = asnDialog.locator("#asn-select");
  await expect(asnSelect).toBeVisible({ timeout: 12_000 });
  await asnSelect.click();

  const asnOption = page.getByRole("option", {
    name: new RegExp(tranid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  });
  await expect(asnOption).toBeVisible({ timeout: 8_000 });
  await asnOption.click();

  await asnDialog.getByRole("button", { name: /Continue/i }).click();

  const grnDialog = page.getByRole("dialog", { name: /Create New GRN/i });
  await expect(grnDialog).toBeVisible({ timeout: 8_000 });
  return grnDialog;
}

/** Pick the first available rack from the RackCombobox for the item at itemIndex. */
async function assignFirstRack(page: Page, grnDialog: Locator, itemIndex: number): Promise<boolean> {
  const rackButton = grnDialog.locator("button", { hasText: /^Rack$/ }).nth(itemIndex);
  await rackButton.scrollIntoViewIfNeeded();
  await rackButton.click();

  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await popover.waitFor({ state: "visible", timeout: 4_000 });

  const firstRack = popover.locator("ul li button").first();
  if ((await firstRack.count()) === 0) {
    await page.keyboard.press("Escape");
    return false;
  }
  await firstRack.click();
  return true;
}

/** Fill carton, loss, expiry, and lot fields for the item card at itemIndex. */
async function fillItemFields(
  grnDialog: Locator,
  itemIndex: number,
  opts: { carton?: number; loss?: number; expiryDate?: string; lotNo?: string },
) {
  const card = grnDialog.locator(".relative.rounded-xl.border.bg-card").nth(itemIndex);

  if (opts.carton !== undefined) {
    await card
      .getByRole("spinbutton", { name: /Delivered carton quantity/i })
      .fill(String(opts.carton));
  }
  if (opts.loss !== undefined) {
    await card
      .getByRole("spinbutton", { name: /Delivered loss quantity/i })
      .fill(String(opts.loss));
  }
  if (opts.expiryDate !== undefined) {
    await card.locator('input[placeholder="YYYY-MM-DD"]').fill(opts.expiryDate);
  }
  if (opts.lotNo !== undefined) {
    await card.locator('input[placeholder*="LOT"]').fill(opts.lotNo);
  }
}

/**
 * Create and submit a GRN from an Advance Notice.
 * Navigates to /admin/grn, opens the ASN picker, fills all line items, and
 * clicks "Submit for Approval". Asserts the success toast before returning.
 */
async function createGrnFromAsn(page: Page, tranid: string, lines: LineItem[]): Promise<void> {
  await page.goto("/admin/grn");
  await expect(page.getByRole("heading", { name: /Goods Receipt/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /Create GRN/i }).click();
  const grnDialog = await selectAsnAndContinue(page, tranid);

  await grnDialog.locator("#supplierDO").fill(`DO-E2E-${Date.now()}`);

  const receivedDateInput = grnDialog.locator("#receivedDate");
  if (!(await receivedDateInput.inputValue()).trim()) {
    await fillDatetimeLocal(receivedDateInput);
  }

  const itemCount = await grnDialog.locator('[aria-label="Remove item"]').count();
  expect(itemCount).toBe(lines.length);

  for (let i = 0; i < itemCount; i++) {
    const line = lines[i];
    await fillItemFields(grnDialog, i, {
      carton: line.carton ?? line.quantity,
      loss: line.loss ?? 0,
      expiryDate: line.expiryDate,
      lotNo: line.lotNo,
    });
    const picked = await assignFirstRack(page, grnDialog, i);
    if (!picked) {
      test.skip(true, "No racks in DB — create at least one rack to run this test.");
    }
  }

  const submitBtn = grnDialog.getByRole("button", { name: /Submit for Approval/i });
  await submitBtn.scrollIntoViewIfNeeded();
  await submitBtn.click();

  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: /created|saved|success/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Find the GRN row by tranid, open the detail panel, and return a locator for the row.
 * The detail panel (and its footer action buttons) are rendered inside the same page.
 */
async function openGrnDetail(page: Page, tranid: string): Promise<Locator> {
  const row = page
    .getByRole("table")
    .locator("tbody tr")
    .filter({ hasText: tranid });
  await expect(row).toBeVisible({ timeout: 20_000 });
  // The first icon button on each row expands the detail panel.
  await row.locator("button:has(svg)").first().click();
  return row;
}

/**
 * Click "Approve" in the GRN detail footer and wait for the success toast.
 * The button is visible only when status === "Submitted" and the user has approve permissions.
 */
async function approveGrn(page: Page): Promise<void> {
  const approveBtn = page.getByRole("button", { name: /^Approve$/i });
  await expect(approveBtn).toBeVisible({ timeout: 8_000 });
  await approveBtn.click();
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: /GRN approved/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Click "Send to ES" in the GRN detail footer and wait for the success toast.
 * The button is visible only when status === "Approved" and the user has approve permissions.
 * This triggers the Item Receipt creation in the external system (ES / NetSuite).
 */
async function sendGrnToES(page: Page): Promise<void> {
  const sendBtn = page.getByRole("button", { name: /Send to ES/i });
  await expect(sendBtn).toBeVisible({ timeout: 8_000 });
  await sendBtn.click();
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: /GRN sent to ES/i }),
  ).toBeVisible({ timeout: 20_000 }); // Allow extra time for the external ES call
}

// ============================================================================
// ES1 — 1-line AN, non-lot-tracked, full workflow happy path
// ============================================================================

test.describe("ES1: 1-line Advance Notice → GRN → Approve → Send to ES", () => {
  let tranid: string;
  const LINES: LineItem[] = [
    {
      lineuniquekey: 200001,
      itemid: "RAW-ES-0011",
      quantity: 100,
      units: "CTN",
      displayname: "Raw Material ES0011",
      islotitem: "F",
      custrecord_r2o_order_code: "",
    },
  ];

  test.beforeAll(async () => {
    tranid = uniqueTranid("PO-ES1");
    await postAdvanceNotice({
      tranid,
      entity: "MBF PRINTING INDUSTRY SDN BHD",
      duedate: "",
      trandate: new Date().toISOString().split("T")[0],
      timeStamp: new Date().toISOString(),
      lines: LINES.map(({ lineuniquekey, itemid, quantity, units, displayname, islotitem, custrecord_r2o_order_code }) => ({
        lineuniquekey,
        itemid,
        quantity,
        units,
        displayname,
        islotitem,
        custrecord_r2o_order_code,
      })),
    });
  });

  test("GRN progresses from Submitted → Approved → Sent-to-ES", async ({ page }) => {
    // Step 1: Create and submit the GRN from the Advance Notice
    await createGrnFromAsn(page, tranid, LINES);

    // Step 2: Locate the new GRN row in the list
    const row = await openGrnDetail(page, tranid);

    // Step 3: Approve the GRN (Submitted → Approved)
    await approveGrn(page);

    // The "Send to ES" button should now be visible in the detail footer
    await expect(page.getByRole("button", { name: /Send to ES/i })).toBeVisible({
      timeout: 8_000,
    });

    // Step 4: Send to ES — triggers Item Receipt creation in NetSuite
    await sendGrnToES(page);

    // Step 5: Verify the row reflects the final status
    await expect(row).toContainText("Sent-to-ES", { timeout: 10_000 });
  });
});

// ============================================================================
// ES2 — 2-line AN, lot-tracked items, full workflow
// ============================================================================

test.describe("ES2: 2-line lot-tracked Advance Notice → GRN → Approve → Send to ES", () => {
  let tranid: string;
  const EXPIRY = "2027-12-31";
  const LINES: LineItem[] = [
    {
      lineuniquekey: 200011,
      itemid: "RAW-ES-0021",
      quantity: 200,
      units: "CTN",
      displayname: "Raw Material ES0021 (Lot)",
      islotitem: "T",
      custrecord_r2o_order_code: "",
      expiryDate: EXPIRY,
      lotNo: "LOT-ES2-001",
    },
    {
      lineuniquekey: 200012,
      itemid: "RAW-ES-0022",
      quantity: 150,
      units: "CTN",
      displayname: "Raw Material ES0022 (Lot)",
      islotitem: "T",
      custrecord_r2o_order_code: "",
      expiryDate: EXPIRY,
      lotNo: "LOT-ES2-002",
    },
  ];

  test.beforeAll(async () => {
    tranid = uniqueTranid("PO-ES2");
    await postAdvanceNotice({
      tranid,
      entity: "MBF PRINTING INDUSTRY SDN BHD",
      duedate: "",
      trandate: new Date().toISOString().split("T")[0],
      timeStamp: new Date().toISOString(),
      lines: LINES.map(({ lineuniquekey, itemid, quantity, units, displayname, islotitem, custrecord_r2o_order_code }) => ({
        lineuniquekey,
        itemid,
        quantity,
        units,
        displayname,
        islotitem,
        custrecord_r2o_order_code,
      })),
    });
  });

  test("lot-tracked GRN with expiry and lot no. reaches Sent-to-ES", async ({ page }) => {
    // Step 1: Create and submit the GRN — lot fields (expiry + lot no.) are filled per line
    await createGrnFromAsn(page, tranid, LINES);

    // Step 2: Open GRN detail
    const row = await openGrnDetail(page, tranid);

    // Step 3: Approve
    await approveGrn(page);

    // Step 4: Send to ES — Item Receipt with lot/expiry data sent to NetSuite
    await sendGrnToES(page);

    // Step 5: Confirm final status
    await expect(row).toContainText("Sent-to-ES", { timeout: 10_000 });
  });
});
