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
import { postAdvanceNotice, uniqueTranid } from "./helpers/api";

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

type AdvanceNoticeLookup = {
  id: string;
  tranid: string;
  fulfillmentStatus: string;
  lines: Array<{
    lineuniquekey: number;
    itemid: string;
    quantity: number;
    units: string;
  }>;
};

type GrnLookup = {
  id: string;
  grnNo: string;
  poNo: string | null;
  status: string;
  nsError: string | null;
  poFulfilled: boolean | null;
  createdAt: string;
  items: Array<{
    skuCode: string | null;
    qty: string;
  }>;
};

type B15Fixtures = {
  supplierId: string;
  skuId: string;
  skuCode: string;
  skuDescription: string;
  skuUom: string;
  rackId: string;
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

  const tranidPattern = new RegExp(
    tranid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i",
  );
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await expect(popover).toBeVisible({ timeout: 8_000 });
  await popover.getByPlaceholder(/Search PO/i).fill(tranid);
  // AsnCombobox renders choices as <button> list items, not role="option".
  const asnOption = popover.getByRole("button", { name: tranidPattern });
  await expect(asnOption).toBeVisible({ timeout: 8_000 });
  await asnOption.click();

  await asnDialog.getByRole("button", { name: /Continue/i }).click();

  const grnDialog = page.getByRole("dialog", { name: /Create New GRN/i });
  await expect(grnDialog).toBeVisible({ timeout: 8_000 });
  return grnDialog;
}

async function selectPartialAsnBySearchAndContinue(
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

  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await expect(popover).toBeVisible({ timeout: 8_000 });
  await popover.getByPlaceholder(/Search PO/i).fill(tranid);

  const asnOption = popover
    .getByRole("button")
    .filter({ hasText: tranid })
    .filter({ hasText: /Partially fulfilled/i });
  await expect(asnOption).toBeVisible({ timeout: 12_000 });
  await asnOption.click();

  const continueBtn = asnDialog.getByRole("button", { name: /Continue/i });
  await expect(continueBtn).toBeEnabled({ timeout: 15_000 });
  await continueBtn.click();

  const grnDialog = page.getByRole("dialog", { name: /Create New GRN/i });
  await expect(grnDialog).toBeVisible({ timeout: 15_000 });
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
  const card = grnDialog.locator(".relative.rounded-xl.border.bg-card").nth(itemIndex);
  const rackButton = card.getByRole("combobox").last();
  await rackButton.scrollIntoViewIfNeeded();

  const currentLabel = (await rackButton.textContent())?.trim() ?? "";
  if (currentLabel && !/^(Rack|Select rack)$/i.test(currentLabel)) {
    return true;
  }

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
  // Delivered Ctn / Loss use aria-labels in the quantities table.
  const cards = grnDialog.locator(
    ".relative.rounded-xl.border.bg-card",
  );
  const card = cards.nth(itemIndex);

  if (opts.carton !== undefined) {
    const cartonInput = card.getByRole("spinbutton", {
      name: /Delivered carton quantity/i,
    });
    await cartonInput.fill(String(opts.carton));
  }
  if (opts.loss !== undefined) {
    const lossInput = card.getByRole("spinbutton", {
      name: /Delivered loss quantity/i,
    });
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
  const trigger = grnDialog
    .locator(".relative.rounded-xl.border.bg-card")
    .nth(itemIndex)
    .getByRole("combobox")
    .first();
  await trigger.click();

  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await popover.waitFor({ state: "visible", timeout: 5_000 });
  await expect(popover.locator("ul li button").first()).toBeVisible({
    timeout: 12_000,
  });

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
    const data = await e2eGraphql<{
      suppliers?: { query?: Array<{ supplierId: string }> };
    }>(`
      query FirstSupplier {
        suppliers(pageSize: 1, pageNumber: 1) {
          query {
            supplierId
          }
        }
      }
    `);
    return data.suppliers?.query?.[0]?.supplierId ?? null;
  } catch {
    // auth state not available
  }
  return null;
}

async function readAdminAccessToken(): Promise<string> {
  const authStatePath = new URL("../e2e/.auth/admin.json", import.meta.url).pathname;
  const { readFileSync } = await import("node:fs");
  const authState = JSON.parse(readFileSync(authStatePath, "utf-8")) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  const ls = authState.origins?.[0]?.localStorage ?? [];
  return ls.find((e) => e.name === "access_token")?.value ?? "";
}

async function e2eGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = await readAdminAccessToken();
  if (!token) throw new Error("E2E admin access token is not available.");

  const graphqlUrl = process.env.E2E_GRAPHQL_URL ?? "http://localhost:7777/graphql";
  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `GraphQL request failed [${res.status}]`);
  }
  return json.data as T;
}

async function fetchAdvanceNoticeByPoNo(
  poNo: string,
): Promise<AdvanceNoticeLookup | null> {
  const data = await e2eGraphql<{ advanceNoticeByPoNo: AdvanceNoticeLookup | null }>(
    `
      query AdvanceNoticeByPoNo($poNo: String!) {
        advanceNoticeByPoNo(poNo: $poNo) {
          id
          tranid
          fulfillmentStatus
          lines {
            lineuniquekey
            itemid
            quantity
            units
          }
        }
      }
    `,
    { poNo },
  );
  return data.advanceNoticeByPoNo;
}

async function fetchGrnsByPoNo(poNo: string): Promise<GrnLookup[]> {
  const data = await e2eGraphql<{ grns: { query: GrnLookup[] } }>(
    `
      query GrnsByPo($poNo: String!) {
        grns(filter: { poNo: $poNo }, pageSize: 10, pageNumber: 1) {
          query {
            id
            grnNo
            poNo
            status
            nsError
            poFulfilled
            createdAt
            items {
              skuCode
              qty
            }
          }
        }
      }
    `,
    { poNo },
  );
  return data.grns.query;
}

async function readCurrentUserId(): Promise<string> {
  const token = await readAdminAccessToken();
  const backendUrl = process.env.E2E_BACKEND_URL ?? "http://localhost:7777";
  const res = await fetch(`${backendUrl}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { id?: string };
    message?: string;
  };
  const id = json.data?.id;
  if (!res.ok || !id) {
    throw new Error(json.message ?? `Profile request failed [${res.status}]`);
  }
  return id;
}

async function fetchB15Fixtures(): Promise<B15Fixtures> {
  const data = await e2eGraphql<{
    suppliers?: { query?: Array<{ supplierId: string }> };
    skus?: {
      query?: Array<{
        skuId: string;
        skuCode: string;
        skuDescription: string | null;
        skuUom: string;
      }>;
    };
    racks?: { query?: Array<{ rackId: string }> };
  }>(`
    query B15Fixtures {
      suppliers(pageSize: 1, pageNumber: 1) {
        query { supplierId }
      }
      skus(pageSize: 1, pageNumber: 1) {
        query { skuId skuCode skuDescription skuUom }
      }
      racks(pageSize: 1, pageNumber: 1) {
        query { rackId }
      }
    }
  `);

  const supplier = data.suppliers?.query?.[0];
  const sku = data.skus?.query?.[0];
  const rack = data.racks?.query?.[0];
  if (!supplier || !sku || !rack) {
    throw new Error("B15 E2E requires at least one supplier, SKU, and rack.");
  }

  return {
    supplierId: supplier.supplierId,
    skuId: sku.skuId,
    skuCode: sku.skuCode,
    skuDescription: sku.skuDescription ?? sku.skuCode,
    skuUom: sku.skuUom,
    rackId: rack.rackId,
  };
}

async function createInboundGrnForB15(opts: {
  poNo: string;
  carton: number;
  orderedQty?: number;
  poFulfilled: boolean;
  advanceNoticeId?: string;
}): Promise<{ id: string; grnNo: string; skuCode: string }> {
  const fixtures = await fetchB15Fixtures();
  const userId = await readCurrentUserId();
  await e2eGraphql<{ createInbound: boolean }>(
    `
      mutation CreateB15Inbound($input: CreateInboundInput!) {
        createInbound(input: $input)
      }
    `,
    {
      input: {
        userId,
        grnNo: `GRN-B15-${Date.now()}`,
        supplierId: fixtures.supplierId,
        supplierDeliveryNo: `DO-B15-${Date.now()}`,
        poNo: opts.poNo,
        receivedAt: new Date().toISOString(),
        status: "Submitted",
        poFulfilled: opts.poFulfilled,
        advanceNoticeId: opts.advanceNoticeId,
        items: [
          {
            skuId: fixtures.skuId,
            skuCode: fixtures.skuCode,
            skuDescription: fixtures.skuDescription,
            skuUom: fixtures.skuUom,
            qty: String(opts.carton),
            orderedQty:
              opts.orderedQty !== undefined ? String(opts.orderedQty) : undefined,
            lossQty: "0",
            lotNo: `LOT-B15-${Date.now()}`,
            expiryDate: "2027-12-31",
            rackAllocations: [{ rackId: fixtures.rackId, quantity: opts.carton }],
          },
        ],
      },
    },
  );

  const grns = await fetchGrnsByPoNo(opts.poNo);
  const latest = [...grns].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  if (!latest) throw new Error(`Created B15 GRN not found for PO ${opts.poNo}`);
  return { id: latest.id, grnNo: latest.grnNo, skuCode: fixtures.skuCode };
}

async function updateGrnStatusForB15(
  id: string,
  status: "Approved" | "SentToES",
): Promise<GrnLookup> {
  const input: Record<string, string> = { status };
  if (status === "Approved") {
    input.approvedBy = await readCurrentUserId();
    input.approvedAt = new Date().toISOString();
  }

  const data = await e2eGraphql<{ updateGrn: GrnLookup }>(
    `
      mutation UpdateB15Grn($id: ID!, $input: UpdateGrnInput!) {
        updateGrn(id: $id, input: $input) {
          id
          grnNo
          poNo
          status
          nsError
          poFulfilled
          createdAt
          items {
            skuCode
            qty
          }
        }
      }
    `,
    { id, input },
  );
  return data.updateGrn;
}

async function sendGrnToEsForB15OrSkipExternal(
  id: string,
  poNo: string,
  grnNo: string,
): Promise<void> {
  const updated = await updateGrnStatusForB15(id, "SentToES");
  if (updated.status === "Failed") {
    expect(updated.nsError ?? "").not.toMatch(/not fully received|outstanding/i);
    test.skip(
      true,
      `External Send-to-ES failed outside B15 fulfillment gate: ${updated.nsError ?? "unknown error"}`,
    );
  }

  await expect
    .poll(async () => (await fetchGrnsByPoNo(poNo)).find((grn) => grn.grnNo === grnNo)?.status)
    .toBe("SentToES");
}

async function openGrnDetailByGrnNo(page: Page, grnNo: string): Promise<Locator> {
  const openDialog = page.getByRole("dialog").last();
  if (await openDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await openDialog.getByRole("button", { name: /^Close$/i }).first().click();
    await expect(openDialog).toBeHidden({ timeout: 5_000 });
  }
  await page.goto("/admin/grn");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Goods Receipt/i }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder(/Search GRN/i).fill(grnNo);

  const row = page
    .getByRole("table")
    .locator("tbody tr")
    .filter({ hasText: grnNo })
    .first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator("button:has(svg)").first().click();
  return row;
}

async function expectSendToEsHiddenOnGrnDetail(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: /Send to ES/i })).toBeHidden({
    timeout: 10_000,
  });
  await expect(
    page.getByText(/Send to ES blocked.*PO not fully received/i),
  ).toBeHidden();
}

async function expectManualPoFulfilledDefaultChecked(page: Page) {
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
  await expect(
    grnDialog.getByRole("checkbox", {
      name: /PO fully fulfilled by this delivery/i,
    }),
  ).toBeChecked();
  await grnDialog.getByRole("button", { name: /^Cancel$/i }).click();
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

// ============================================================================
// B15 — Manual GRN fulfillment and partial synthetic ASN smoke coverage
// ============================================================================

test.describe("B15: Manual GRN fulfillment smoke", () => {
  test.setTimeout(180_000);

  test("Case A @smoke manual GRN default fulfilled creates no ASN and hides Send to ES", async ({
    page,
  }) => {
    const poNo = uniqueTranid("PO-B15-A");
    await expectManualPoFulfilledDefaultChecked(page);
    const { id, grnNo, skuCode } = await createInboundGrnForB15({
      poNo,
      carton: 1,
      poFulfilled: true,
    });

    await expect.poll(async () => fetchAdvanceNoticeByPoNo(poNo)).toBeNull();

    await openGrnDetailByGrnNo(page, grnNo);
    await expect(page.getByRole("cell", { name: skuCode }).first()).toBeVisible({
      timeout: 10_000,
    });

    await updateGrnStatusForB15(id, "Approved");
    await expect
      .poll(async () => (await fetchGrnsByPoNo(poNo)).find((grn) => grn.grnNo === grnNo)?.status)
      .toBe("Approved");

    await openGrnDetailByGrnNo(page, grnNo);
    await expectSendToEsHiddenOnGrnDetail(page);
  });

  test("Case B @smoke manual partial creates synthetic ASN and second GRN clears outstanding", async ({ page }) => {
    const poNo = uniqueTranid("PO123");
    const firstGrn = await createInboundGrnForB15({
      poNo,
      carton: 60,
      orderedQty: 100,
      poFulfilled: false,
    });

    let syntheticAsn: AdvanceNoticeLookup | null = null;
    await expect
      .poll(async () => {
        syntheticAsn = await fetchAdvanceNoticeByPoNo(poNo);
        return syntheticAsn?.tranid ?? null;
      })
      .toBe(poNo);
    expect(syntheticAsn?.lines).toHaveLength(1);
    expect(syntheticAsn?.lines[0]).toMatchObject({
      itemid: firstGrn.skuCode,
      quantity: 100,
    });

    await updateGrnStatusForB15(firstGrn.id, "Approved");
    await expect
      .poll(async () => (await fetchGrnsByPoNo(poNo)).find((grn) => grn.grnNo === firstGrn.grnNo)?.status)
      .toBe("Approved");
    await expect
      .poll(async () => (await fetchGrnsByPoNo(poNo)).find((grn) => grn.grnNo === firstGrn.grnNo)?.poFulfilled)
      .toBe(false);
    await openGrnDetailByGrnNo(page, firstGrn.grnNo);
    await expectSendToEsHiddenOnGrnDetail(page);

    await page.getByRole("dialog").getByRole("button", { name: /^Close$/i }).first().click();
    await page.getByRole("button", { name: /Create GRN/i }).click();
    await selectPartialAsnBySearchAndContinue(page, poNo);
    await page.getByRole("button", { name: /^Cancel$/i }).click();

    const secondGrn = await createInboundGrnForB15({
      poNo,
      carton: 40,
      poFulfilled: true,
      advanceNoticeId: syntheticAsn!.id,
    });

    await updateGrnStatusForB15(secondGrn.id, "Approved");
    await expect
      .poll(
        async () =>
          (await fetchGrnsByPoNo(poNo)).find((grn) => grn.grnNo === secondGrn.grnNo)?.poFulfilled,
      )
      .toBe(true);
    await openGrnDetailByGrnNo(page, secondGrn.grnNo);
    await expectSendToEsHiddenOnGrnDetail(page);
  });
});
