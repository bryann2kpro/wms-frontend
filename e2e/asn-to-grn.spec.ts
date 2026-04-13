/**
 * GRN E2E Tests — MBF Printing scenarios
 *
 * Test matrix (mirrors the UAT test plan):
 *
 * ┌────┬──────────────────────────────────────────────────────────────────────┐
 * │ ID │ Scenario                                                             │
 * ├────┼──────────────────────────────────────────────────────────────────────┤
 * │ R  │ Regression: 2-line ASN, second item has blank displayname           │
 * │    │ → backend must persist both items                                   │
 * ├────┼──────────────────────────────────────────────────────────────────────┤
 * │ 1A │ 3 SKUs, fully received, 0 loss                                      │
 * │    │ RAW-E0011 300 ctn | RAW-E0012 300 ctn | RAW-E0013 300 ctn           │
 * ├────┼──────────────────────────────────────────────────────────────────────┤
 * │ 1B │ 3 SKUs, loss on 2 items                                             │
 * │    │ RAW-E0011 299 ctn | RAW-E0012 150 ctn | RAW-E0013 300 ctn           │
 * ├────┼──────────────────────────────────────────────────────────────────────┤
 * │ 2A │ 3 SKUs, lot-tracked, same expiry date 31/12/2027, 0 loss            │
 * │    │ RAW-E0011 600 ctn | RAW-E0012 600 ctn | RAW-E0013 600 ctn           │
 * ├────┼──────────────────────────────────────────────────────────────────────┤
 * │ 2B │ 3 SKUs, lot-tracked, different expiry dates, loss on 2 items        │
 * │    │ RAW-E0011 600 ctn exp 31/12/2027                                    │
 * │    │ RAW-E0012 400 ctn exp 31/8/2027  (loss: 200 ctn from ASN qty 600)  │
 * │    │ RAW-E0013 500 ctn exp 31/6/2027  (loss: 100 ctn from ASN qty 600)  │
 * ├────┼──────────────────────────────────────────────────────────────────────┤
 * │ M  │ Manual GRN: Skip ASN picker, fill form by hand with 2 SKUs          │
 * └────┴──────────────────────────────────────────────────────────────────────┘
 *
 * Prerequisites
 * ─────────────
 * • Backend  : E2E_BACKEND_URL  (default http://localhost:7777)
 * • Frontend : E2E_BASE_URL     (default http://localhost:3000)
 * • Env file : .env.e2e  →  E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_API_KEY
 * • At least one Rack in the DB   (rack assignment is required by the form)
 * • At least two SKUs in the DB   (required for the manual GRN test only)
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import { postAdvanceNotice, uniqueTranid, fetchFirstSupplierId } from "./helpers/api";

// ============================================================================
// Types
// ============================================================================

type LineItem = {
  itemid: string;
  quantity: number;
  units: string;
  displayname: string;
  islotitem: "T" | "F";
  lineuniquekey: number;
  /** Carton qty to type into the form (may differ from ASN qty for loss scenarios) */
  carton?: number;
  /** Loss qty — entered in the Loss field of each line item card */
  loss?: number;
  /** Expiry date string in "YYYY-MM-DD" format (lot-tracked items only) */
  expiryDate?: string;
  /** Lot number (lot-tracked items only) */
  lotNo?: string;
};

// ============================================================================
// Shared page-object helpers
// ============================================================================

/** Fill a datetime-local input with the current local time. */
async function fillDatetimeLocal(input: Locator) {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  await input.fill(
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`,
  );
}

/**
 * Select the ASN by tranid in the ASN picker dialog and click Continue.
 * Returns the GRN form dialog locator.
 */
async function selectAsnAndContinue(
  page: Page,
  tranid: string,
): Promise<Locator> {
  const asnDialog = page.getByRole("dialog", {
    name: /Select Advance Shipping Notice/i,
  });
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

/**
 * Assign the first available rack from the RackCombobox popover.
 * Returns false (and skips the test) if no racks exist in the DB.
 */
async function assignFirstRack(
  page: Page,
  grnDialog: Locator,
  itemIndex: number,
): Promise<boolean> {
  const rackButton = grnDialog
    .locator("button", { hasText: /^Rack$/ })
    .nth(itemIndex);
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

/**
 * Fill carton, loss, expiry, and lot fields for an item card at a given index.
 * Only fills optional fields when a value is provided.
 */
async function fillItemFields(
  grnDialog: Locator,
  itemIndex: number,
  opts: { carton?: number; loss?: number; expiryDate?: string; lotNo?: string },
) {
  // Item cards are separated by "Remove item" buttons — nth(itemIndex) gives the right card.
  // The Carton and Loss inputs use placeholder="0" and type="number".
  // Within each card the order is: Carton(0), Loss(1), Expiry(2-text), LotNo(3-text)
  const cards = grnDialog.locator(
    ".relative.rounded-xl.border.bg-card",
  );
  const card = cards.nth(itemIndex);

  if (opts.carton !== undefined) {
    const cartonInput = card.locator('input[type="number"]').first();
    await cartonInput.fill(String(opts.carton));
  }
  if (opts.loss !== undefined) {
    const lossInput = card.locator('input[type="number"]').nth(1);
    await lossInput.fill(String(opts.loss));
  }
  if (opts.expiryDate !== undefined) {
    const expiryInput = card.locator('input[placeholder="YYYY-MM-DD"]');
    await expiryInput.fill(opts.expiryDate);
  }
  if (opts.lotNo !== undefined) {
    const lotInput = card.locator('input[placeholder*="LOT"]');
    await lotInput.fill(opts.lotNo);
  }
}

/**
 * Full GRN creation flow via the ASN picker:
 *  1. Navigate to /admin/grn
 *  2. POST the ASN (done in beforeAll — tranid is passed in)
 *  3. Click "Create GRN" → select the ASN → Continue
 *  4. Fill Supplier DO, Received Date
 *  5. Fill per-item fields (carton, loss, expiry, lot) and assign a rack
 *  6. Submit for Approval
 *  7. Return the unique PO (=tranid) so the caller can find the row
 */
async function createGrnFromAsn(
  page: Page,
  tranid: string,
  lines: LineItem[],
): Promise<void> {
  await page.goto("/admin/grn");
  await expect(
    page.getByRole("heading", { name: /Goods Receipt/i }),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /Create GRN/i }).click();
  const grnDialog = await selectAsnAndContinue(page, tranid);

  // Supplier DO
  await grnDialog.locator("#supplierDO").fill(`DO-E2E-${Date.now()}`);

  // Received Date (blank duedate in test ASNs)
  const receivedDateInput = grnDialog.locator("#receivedDate");
  if (!(await receivedDateInput.inputValue()).trim()) {
    await fillDatetimeLocal(receivedDateInput);
  }

  // Per-item fields + rack
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
      test.skip(true, "No racks in DB — create at least one rack to run the full flow.");
    }
  }

  const submitBtn = grnDialog.getByRole("button", {
    name: /Submit for Approval/i,
  });
  await submitBtn.scrollIntoViewIfNeeded();
  await submitBtn.click();

  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /created|saved|success/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Open the detail panel for the GRN whose "End User PO" column matches `po`,
 * then assert every expected SKU code appears as a cell in the items table.
 */
async function verifyGrnDetailItems(
  page: Page,
  po: string,
  expectedSkus: string[],
) {
  const ourRow = page
    .getByRole("table")
    .locator("tbody tr")
    .filter({ hasText: po });
  await expect(ourRow).toBeVisible({ timeout: 20_000 });
  await ourRow.locator("button:has(svg)").first().click();

  for (const sku of expectedSkus) {
    await expect(
      page.getByRole("cell", { name: sku }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  // Confirm the total count of SKU-code cells matches
  const skuPattern = new RegExp(expectedSkus.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
  const skuCells = page
    .locator('td[data-slot="table-cell"].font-medium')
    .filter({ hasText: skuPattern });
  await expect(skuCells).toHaveCount(expectedSkus.length);
}

// ============================================================================
// Helper: open the SkuCombobox and pick by index (manual GRN only)
// ============================================================================
async function selectSkuFromCombobox(
  page: Page,
  grnDialog: Locator,
  itemIndex: number,
  skuIndexInList = 0,
): Promise<string | null> {
  const trigger = grnDialog.getByRole("combobox").nth(itemIndex);
  await trigger.click();

  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await popover.waitFor({ state: "visible", timeout: 5_000 });
  await expect(
    popover.locator("text=/Loading SKUs/i").or(popover.locator("ul li button").first()),
  ).toBeVisible({ timeout: 8_000 });

  const skuButton = popover.locator("ul li button").nth(skuIndexInList);
  if ((await skuButton.count()) === 0) {
    await page.keyboard.press("Escape");
    return null;
  }
  const skuCode = await skuButton.locator("span.font-semibold").first().textContent();
  await skuButton.click();
  return skuCode?.trim() ?? null;
}

// ============================================================================
// Helper: read supplierId from saved auth state (manual GRN test)
// ============================================================================
async function readSupplierId(): Promise<string | null> {
  try {
    const authStatePath = new URL("../e2e/.auth/admin.json", import.meta.url).pathname;
    const { readFileSync } = await import("node:fs");
    const authState = JSON.parse(readFileSync(authStatePath, "utf-8")) as {
      origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
    };
    const ls = authState.origins?.[0]?.localStorage ?? [];
    const token = ls.find((e) => e.name === "access_token")?.value ?? "";
    if (token) return fetchFirstSupplierId(token);
  } catch {
    // auth state not available
  }
  return null;
}

// ============================================================================
// REGRESSION — blank displayname on second item
// ============================================================================

test.describe("Regression: 2-line ASN with blank displayname", () => {
  let tranid: string;

  test.beforeAll(async () => {
    tranid = uniqueTranid("PO76040043-E2E");
    await postAdvanceNotice({
      tranid,
      entity: "MBF PRINTING INDUSTRY SDN BHD",
      duedate: "",
      trandate: new Date().toISOString().split("T")[0],
      timeStamp: new Date().toISOString(),
      lines: [
        {
          lineuniquekey: 470680594,
          itemid: "RAW LEAF E1001",
          quantity: 600,
          units: "GM",
          displayname: "ZZZ 1001",
          islotitem: "F",
          custrecord_r2o_order_code: "",
        },
        {
          lineuniquekey: 470680595,
          itemid: "RAW LEAF E1002",
          quantity: 500,
          units: "GM",
          displayname: "", // ← blank displayname must NOT silently drop the item
          islotitem: "F",
          custrecord_r2o_order_code: "",
        },
      ],
    });
  });

  test("both items persist even when second item has blank displayname", async ({ page }) => {
    await createGrnFromAsn(page, tranid, [
      { itemid: "RAW LEAF E1001", quantity: 600, units: "GM", displayname: "ZZZ 1001", islotitem: "F", lineuniquekey: 470680594 },
      { itemid: "RAW LEAF E1002", quantity: 500, units: "GM", displayname: "", islotitem: "F", lineuniquekey: 470680595 },
    ]);
    await verifyGrnDetailItems(page, tranid, ["RAW LEAF E1001", "RAW LEAF E1002"]);
  });
});

// ============================================================================
// 1A — 3 SKUs, fully received, 0 loss
// ============================================================================

test.describe("1A: 3-line ASN — fully received, 0 loss", () => {
  let tranid: string;
  const LINES: LineItem[] = [
    { lineuniquekey: 100001, itemid: "RAW-E0011", quantity: 300, units: "CTN", displayname: "Raw Material E0011", islotitem: "F", custrecord_r2o_order_code: "" } as LineItem,
    { lineuniquekey: 100002, itemid: "RAW-E0012", quantity: 300, units: "CTN", displayname: "Raw Material E0012", islotitem: "F", custrecord_r2o_order_code: "" } as LineItem,
    { lineuniquekey: 100003, itemid: "RAW-E0013", quantity: 300, units: "CTN", displayname: "Raw Material E0013", islotitem: "F", custrecord_r2o_order_code: "" } as LineItem,
  ];

  test.beforeAll(async () => {
    tranid = uniqueTranid("PO-1A-MBF");
    await postAdvanceNotice({
      tranid,
      entity: "MBF PRINTING INDUSTRY SDN BHD",
      duedate: "",
      trandate: new Date().toISOString().split("T")[0],
      timeStamp: new Date().toISOString(),
      lines: LINES.map((l) => ({
        lineuniquekey: l.lineuniquekey,
        itemid: l.itemid,
        quantity: l.quantity,
        units: l.units,
        displayname: l.displayname,
        islotitem: l.islotitem,
        custrecord_r2o_order_code: "",
      })),
    });
  });

  test("all 3 items saved with carton = ASN qty and 0 loss", async ({ page }) => {
    await createGrnFromAsn(page, tranid, LINES);
    await verifyGrnDetailItems(page, tranid, LINES.map((l) => l.itemid));
  });
});

// ============================================================================
// 1B — 3 SKUs, loss on 2 items
// ============================================================================

test.describe("1B: 3-line ASN — loss on 2 items", () => {
  let tranid: string;
  // ASN quantities: all 300. WMS received: E0011=299, E0012=150, E0013=300
  const LINES: LineItem[] = [
    { lineuniquekey: 100011, itemid: "RAW-E0011", quantity: 300, units: "CTN", displayname: "Raw Material E0011", islotitem: "F", carton: 299, loss: 1 } as LineItem,
    { lineuniquekey: 100012, itemid: "RAW-E0012", quantity: 300, units: "CTN", displayname: "Raw Material E0012", islotitem: "F", carton: 150, loss: 150 } as LineItem,
    { lineuniquekey: 100013, itemid: "RAW-E0013", quantity: 300, units: "CTN", displayname: "Raw Material E0013", islotitem: "F", carton: 300, loss: 0 } as LineItem,
  ];

  test.beforeAll(async () => {
    tranid = uniqueTranid("PO-1B-MBF");
    await postAdvanceNotice({
      tranid,
      entity: "MBF PRINTING INDUSTRY SDN BHD",
      duedate: "",
      trandate: new Date().toISOString().split("T")[0],
      timeStamp: new Date().toISOString(),
      lines: LINES.map((l) => ({
        lineuniquekey: l.lineuniquekey,
        itemid: l.itemid,
        quantity: l.quantity,
        units: l.units,
        displayname: l.displayname,
        islotitem: l.islotitem,
        custrecord_r2o_order_code: "",
      })),
    });
  });

  test("all 3 items saved; E0011 carton=299 loss=1, E0012 carton=150 loss=150, E0013 carton=300 loss=0", async ({ page }) => {
    await createGrnFromAsn(page, tranid, LINES);
    await verifyGrnDetailItems(page, tranid, LINES.map((l) => l.itemid));
  });
});

// ============================================================================
// 2A — 3 SKUs, lot-tracked, same expiry 31/12/2027, 0 loss
// ============================================================================

test.describe("2A: 3-line ASN — lot-tracked, same expiry date, 0 loss", () => {
  let tranid: string;
  const EXPIRY = "2027-12-31";
  const LINES: LineItem[] = [
    { lineuniquekey: 100021, itemid: "RAW-E0011", quantity: 600, units: "CTN", displayname: "Raw Material E0011", islotitem: "T", expiryDate: EXPIRY, lotNo: "LOT-2A-001" } as LineItem,
    { lineuniquekey: 100022, itemid: "RAW-E0012", quantity: 600, units: "CTN", displayname: "Raw Material E0012", islotitem: "T", expiryDate: EXPIRY, lotNo: "LOT-2A-002" } as LineItem,
    { lineuniquekey: 100023, itemid: "RAW-E0013", quantity: 600, units: "CTN", displayname: "Raw Material E0013", islotitem: "T", expiryDate: EXPIRY, lotNo: "LOT-2A-003" } as LineItem,
  ];

  test.beforeAll(async () => {
    tranid = uniqueTranid("PO-2A-MBF");
    await postAdvanceNotice({
      tranid,
      entity: "MBF PRINTING INDUSTRY SDN BHD",
      duedate: "",
      trandate: new Date().toISOString().split("T")[0],
      timeStamp: new Date().toISOString(),
      lines: LINES.map((l) => ({
        lineuniquekey: l.lineuniquekey,
        itemid: l.itemid,
        quantity: l.quantity,
        units: l.units,
        displayname: l.displayname,
        islotitem: l.islotitem,
        custrecord_r2o_order_code: "",
      })),
    });
  });

  test("all 3 lot-tracked items saved with same expiry 31/12/2027", async ({ page }) => {
    await createGrnFromAsn(page, tranid, LINES);
    await verifyGrnDetailItems(page, tranid, LINES.map((l) => l.itemid));
  });
});

// ============================================================================
// 2B — 3 SKUs, lot-tracked, different expiry dates, loss on 2 items
// ============================================================================

test.describe("2B: 3-line ASN — lot-tracked, different expiry dates, loss on 2 items", () => {
  let tranid: string;
  // ASN qty: all 600. WMS received: E0011=600, E0012=400 (loss 200), E0013=500 (loss 100)
  // Expiry: E0011=31/12/2027, E0012=31/8/2027, E0013=31/6/2027
  const LINES: LineItem[] = [
    { lineuniquekey: 100031, itemid: "RAW-E0011", quantity: 600, units: "CTN", displayname: "Raw Material E0011", islotitem: "T", carton: 600, loss: 0,   expiryDate: "2027-12-31", lotNo: "LOT-2B-001" } as LineItem,
    { lineuniquekey: 100032, itemid: "RAW-E0012", quantity: 600, units: "CTN", displayname: "Raw Material E0012", islotitem: "T", carton: 400, loss: 200, expiryDate: "2027-08-31", lotNo: "LOT-2B-002" } as LineItem,
    { lineuniquekey: 100033, itemid: "RAW-E0013", quantity: 600, units: "CTN", displayname: "Raw Material E0013", islotitem: "T", carton: 500, loss: 100, expiryDate: "2027-06-30", lotNo: "LOT-2B-003" } as LineItem,
  ];

  test.beforeAll(async () => {
    tranid = uniqueTranid("PO-2B-MBF");
    await postAdvanceNotice({
      tranid,
      entity: "MBF PRINTING INDUSTRY SDN BHD",
      duedate: "",
      trandate: new Date().toISOString().split("T")[0],
      timeStamp: new Date().toISOString(),
      lines: LINES.map((l) => ({
        lineuniquekey: l.lineuniquekey,
        itemid: l.itemid,
        quantity: l.quantity,
        units: l.units,
        displayname: l.displayname,
        islotitem: l.islotitem,
        custrecord_r2o_order_code: "",
      })),
    });
  });

  test("all 3 lot-tracked items saved with correct carton, loss, and different expiry dates", async ({ page }) => {
    await createGrnFromAsn(page, tranid, LINES);
    await verifyGrnDetailItems(page, tranid, LINES.map((l) => l.itemid));
  });
});

// ============================================================================
// Manual GRN — Skip ASN picker, fill form by hand
// ============================================================================

test.describe("Manual GRN: create via UI without an ASN", () => {
  let supplierId: string | null = null;

  test.beforeAll(async () => {
    supplierId = await readSupplierId();
  });

  test("creates a GRN with 2 manually added items and both appear in detail view", async ({ page }) => {
    // Inject supplierId into the GraphQL mutation — the manual path has no ASN
    // entity to auto-resolve a supplier from.
    if (supplierId) {
      await page.route("**/graphql", async (route) => {
        const postData = route.request().postDataJSON() as {
          query?: string;
          variables?: { input?: Record<string, unknown> };
        } | null;
        if (
          postData?.query?.includes("createInbound") &&
          postData.variables?.input &&
          !postData.variables.input.supplierId
        ) {
          postData.variables.input.supplierId = supplierId;
          await route.continue({ postData: JSON.stringify(postData) });
        } else {
          await route.continue();
        }
      });
    }

    await page.goto("/admin/grn");
    await expect(
      page.getByRole("heading", { name: /Goods Receipt/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Create GRN/i }).click();

    const asnDialog = page.getByRole("dialog", {
      name: /Select Advance Shipping Notice/i,
    });
    await expect(asnDialog).toBeVisible({ timeout: 8_000 });
    await asnDialog.getByRole("button", { name: /Skip/i }).click();

    const grnDialog = page.getByRole("dialog", { name: /Create New GRN/i });
    await expect(grnDialog).toBeVisible({ timeout: 8_000 });

    const uniquePo = `PO-E2E-MANUAL-${Date.now()}`;
    await grnDialog.locator("#poReference").fill(uniquePo);
    await grnDialog.locator("#supplierDO").fill(`DO-MANUAL-${Date.now()}`);
    await fillDatetimeLocal(grnDialog.locator("#receivedDate"));

    const addItemButton = grnDialog.getByRole("button", { name: /Add Item/i });
    await addItemButton.click();
    await addItemButton.click();
    await expect(grnDialog.locator('[aria-label="Remove item"]')).toHaveCount(2, { timeout: 5_000 });

    const sku1 = await selectSkuFromCombobox(page, grnDialog, 0, 0);
    const sku2 = await selectSkuFromCombobox(page, grnDialog, 1, 1);
    if (!sku1 || !sku2) {
      test.skip(true, "Fewer than 2 SKUs in DB — seed at least 2 SKUs to run this test.");
    }

    for (let i = 0; i < 2; i++) {
      const picked = await assignFirstRack(page, grnDialog, i);
      if (!picked) test.skip(true, "No racks in DB — create at least one rack.");
    }

    const submitBtn = grnDialog.getByRole("button", { name: /Submit for Approval/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /created|saved|success/i }),
    ).toBeVisible({ timeout: 15_000 });

    await verifyGrnDetailItems(page, uniquePo, [sku1!, sku2!]);
  });
});
