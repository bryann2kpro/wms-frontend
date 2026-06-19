/**
 * Bin to Bin E2E — internal bin transfers (draft → Approve / Reject)
 *
 * UI: /admin/stock-transfer (legacy /admin/putaway redirects here)
 *
 * UI flow:
 *   1. Source rack
 *   2. SKU (aggregated on-hand on that rack)
 *   3. Lot No (when multiple stock quants share the SKU — required or optional)
 *   4. Quantity (≤ on-hand for chosen lot)
 *   5. Destination rack (must differ from source)
 *   6. Add to list → draft row in table
 *   7. Approve (dispatches from source → work queue) or Reject (no stock move)
 *   8. Confirm receipt on Internal Transfer Work Queue → COMPLETED
 *
 * Prerequisites
 * ─────────────
 * • Backend  : E2E_BACKEND_URL  (default http://localhost:7777)
 * • Frontend : E2E_BASE_URL     (default http://localhost:3000)
 * • Admin user with Inventory permission
 * • Source rack must have at least one stock quant with quantity > 0
 * • The draft queue may already contain other lines; tests target rows
 *   by SKU + source + destination + quantity (+ lot when needed).
 * • Optional env:
 *     E2E_PUTAWAY_SOURCE_RACK_LABEL  (default I1-L2-02)
 *     E2E_PUTAWAY_DEST_RACK_LABEL    (default G2-L1-07)
 *     E2E_PUTAWAY_ALT_DEST_RACK_LABEL (default A1-L1-01; queue isolation test)
 */

import { test, expect, type Page } from "@playwright/test";
import { seedLooseStockForBinTransfer } from "./helpers/stock-quant";

let SOURCE_RACK_LABEL =
  process.env.E2E_PUTAWAY_SOURCE_RACK_LABEL ?? "I1-L2-07";
let DEST_RACK_LABEL =
  process.env.E2E_PUTAWAY_DEST_RACK_LABEL ?? "G2-L1-07";
const ALT_DEST_RACK_LABEL =
  process.env.E2E_PUTAWAY_ALT_DEST_RACK_LABEL ?? "A1-L1-01";

/** Quantity used for single-line happy-path / reject tests. */
const PUTAWAY_TEST_QTY = "1";

/** Second quantity for queue-isolation test (must differ from PUTAWAY_TEST_QTY). */
const PUTAWAY_ALT_QTY = "2";

async function gotoPutaway(page: Page) {
  await page.goto("/admin/stock-transfer");
  await expect(
    page.getByRole("heading", { name: /^Bin to Bin$/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("region", { name: /Notifications/i }),
  ).toBeAttached({ timeout: 15_000 });
}

function toastWithText(page: Page, text: RegExp) {
  return page.locator("[data-sonner-toast]").getByText(text);
}

async function expectToast(page: Page, text: RegExp) {
  await expect(toastWithText(page, text).first()).toBeVisible({
    timeout: 10_000,
  });
}

async function expectNoToast(page: Page, text: RegExp) {
  await expect(toastWithText(page, text)).toHaveCount(0, { timeout: 3_000 });
}

async function clickAddToList(page: Page) {
  await page.getByRole("button", { name: /^Add to list$/i }).click();
}

async function selectRackByLocationLabel(
  page: Page,
  comboboxId: string,
  locationLabel: string,
): Promise<boolean> {
  await page.locator(`#${comboboxId}`).click();
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await popover.waitFor({ state: "visible", timeout: 8_000 });
  const filter = popover.getByPlaceholder(/Type to filter racks/i);
  await filter.fill(locationLabel);
  const escaped = locationLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rackBtn = popover
    .locator("ul li button")
    .filter({ hasText: new RegExp(escaped) });
  if ((await rackBtn.count()) === 0) {
    await page.keyboard.press("Escape");
    return false;
  }
  await rackBtn.first().click();
  return true;
}

/** SKU code from option text (`CODE` + em dash + `N on hand`). */
function skuCodeFromOptionText(optionText: string): string {
  const trimmed = optionText.trim();
  const emParts = trimmed.split(/\s*\u2014\s*/);
  if (emParts.length > 1 && emParts[0]?.trim()) {
    return emParts[0].trim();
  }
  return trimmed.split(/\s*[–-]\s*/)[0]?.trim() ?? trimmed;
}

/** Lot label from option text (`LOT` or `No lot` + em dash + on hand). */
function lotLabelFromOptionText(optionText: string): string {
  const trimmed = optionText.trim();
  const emParts = trimmed.split(/\s*\u2014\s*/);
  if (emParts.length > 1 && emParts[0]?.trim()) {
    return emParts[0].trim();
  }
  return trimmed.split(/\s*[–-]\s*/)[0]?.trim() ?? trimmed;
}

/** How the putaway table renders lot (empty/null → em dash). */
function lotNoTableCellText(lotLabel: string): string {
  if (!lotLabel || /^No lot$/i.test(lotLabel)) return "—";
  return lotLabel;
}

async function openSkuDropdown(page: Page) {
  const trigger = page.locator("#putaway-sku");
  await expect(trigger).toBeEnabled({ timeout: 15_000 });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  return listbox;
}

async function selectSkuAtOptionIndex(
  page: Page,
  optionIndex: number,
): Promise<string | null> {
  const listbox = await openSkuDropdown(page);
  const options = listbox.getByRole("option");
  if ((await options.count()) <= optionIndex) {
    await page.keyboard.press("Escape");
    return null;
  }
  const option = options.nth(optionIndex);
  const text = await option.textContent();
  await option.click();
  await expect(page.locator("#putaway-sku")).toHaveAttribute(
    "aria-expanded",
    "false",
    { timeout: 5_000 },
  );
  return text?.trim() ?? null;
}

async function selectFirstAvailableSku(page: Page): Promise<string | null> {
  const text = await selectSkuAtOptionIndex(page, 1);
  if (!text || /^Select SKU/i.test(text)) {
    return null;
  }
  return text;
}

/** True when SKU has multiple quants and every row is lot-tracked (lot pick required). */
async function skuRequiresLotSelection(page: Page): Promise<boolean> {
  const lotTrigger = page.locator("#putaway-lot");
  if (!(await lotTrigger.isEnabled())) return false;
  const lotText = (await lotTrigger.textContent()) ?? "";
  if (!/^Select lot/i.test(lotText)) return false;
  return (
    (await page
      .getByText(/All stock for this SKU on the rack is lot-tracked/i)
      .count()) > 0
  );
}

/**
 * When multiple stock quants share the SKU, pick a lot (or keep auto-selected value).
 * Returns the chosen lot label for table matching, or null if lot select is stuck on placeholder.
 */
async function ensureLotSelected(page: Page): Promise<string | null> {
  const lotTrigger = page.locator("#putaway-lot");
  if (!(await lotTrigger.isEnabled())) {
    const auto = (await lotTrigger.textContent())?.trim() ?? "";
    if (/No lot/i.test(auto)) return "No lot";
    if (auto && auto !== "—" && !/Select SKU/i.test(auto)) {
      return lotLabelFromOptionText(auto);
    }
    return "No lot";
  }

  const current = (await lotTrigger.textContent())?.trim() ?? "";
  if (current && !/^Select lot/i.test(current)) {
    return lotLabelFromOptionText(current);
  }

  await lotTrigger.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  const options = listbox.getByRole("option");
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    const option = options.nth(i);
    const text = (await option.textContent())?.trim() ?? "";
    if (!text || /^Select lot/i.test(text)) continue;
    await option.click();
    return lotLabelFromOptionText(text);
  }
  await page.keyboard.press("Escape");
  return null;
}

async function readMaximumQtyHint(page: Page): Promise<number | null> {
  const hint = page
    .locator("#putaway-qty")
    .locator("xpath=..")
    .locator("p.text-xs.text-muted-foreground")
    .filter({ hasText: /^Maximum [\d,]+/ });
  if ((await hint.count()) === 0) return null;
  const text = await hint.first().textContent();
  const m = text?.match(/Maximum\s+([\d,]+)/);
  if (!m) return null;
  return Number.parseInt(m[1].replace(/,/g, ""), 10);
}

type AddResult =
  | { ok: true; skuOptionText: string; skuCode: string; lotLabel: string }
  | {
      ok: false;
      reason: "source_rack" | "no_sku" | "lot_required" | "dest_rack";
    };

async function addPutawayDraftLine(
  page: Page,
  opts: { sourceLabel: string; destLabel: string; qty: string },
): Promise<AddResult> {
  const srcOk = await selectRackByLocationLabel(
    page,
    "putaway-source-rack",
    opts.sourceLabel,
  );
  if (!srcOk) return { ok: false, reason: "source_rack" };

  const skuOptionText = await selectFirstAvailableSku(page);
  if (!skuOptionText) return { ok: false, reason: "no_sku" };

  const lotLabel = await ensureLotSelected(page);
  if (lotLabel == null) return { ok: false, reason: "lot_required" };

  await expect(page.locator("#putaway-qty")).toBeEnabled({ timeout: 10_000 });
  await page.locator("#putaway-qty").fill(opts.qty);

  const destOk = await selectRackByLocationLabel(
    page,
    "putaway-dest-rack",
    opts.destLabel,
  );
  if (!destOk) return { ok: false, reason: "dest_rack" };

  await clickAddToList(page);
  return {
    ok: true,
    skuOptionText,
    skuCode: skuCodeFromOptionText(skuOptionText),
    lotLabel,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Target one draft row in the queue (SKU, racks, qty; lot column when provided).
 * Table columns: SKU | Description | Source | Lot No | Dest | Qty | Action
 */
function putawayDraftRowLocator(
  page: Page,
  p: {
    skuCode: string;
    sourceLabel: string;
    destLabel: string;
    qty: string;
    lotLabel?: string;
  },
) {
  const qtyDisplay = Number(p.qty).toLocaleString();
  const table = page.getByRole("table", { name: /Pending transfer drafts/i });
  let row = table
    .locator("tbody tr")
    .filter({ hasText: new RegExp(escapeRegExp(p.skuCode)) })
    .filter({ hasText: new RegExp(escapeRegExp(p.sourceLabel)) })
    .filter({ hasText: new RegExp(escapeRegExp(p.destLabel)) })
    .filter({
      has: page
        .locator("td")
        .nth(5)
        .getByText(new RegExp(`${escapeRegExp(qtyDisplay)} CTN`, "i")),
    });

  if (p.lotLabel != null) {
    const lotCell = lotNoTableCellText(p.lotLabel);
    row = row.filter({
      has: page.locator("td").nth(3).getByText(lotCell, { exact: true }),
    });
  }

  return row;
}

function skipIfPrereqsMissing(
  add: AddResult,
  sourceLabel: string,
  destLabel?: string,
): add is { ok: true; skuOptionText: string; skuCode: string; lotLabel: string } {
  if (add.ok) return true;
  const msg =
    add.reason === "source_rack"
      ? `No source rack matching "${sourceLabel}".`
      : add.reason === "dest_rack"
        ? `No destination rack matching "${destLabel ?? "unknown"}".`
        : add.reason === "lot_required"
          ? `Could not select a lot for SKU on rack "${sourceLabel}".`
          : `No SKU with stock on rack "${sourceLabel}".`;
  test.skip(true, msg);
  return false;
}

// ============================================================================
// Validation
// ============================================================================

test.describe("Putaway validation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPutaway(page);
  });

  test("shows error when Add to list is clicked with missing fields", async ({
    page,
  }) => {
    await clickAddToList(page);
    await expectToast(page, /Missing fields/i);
    await expectNoToast(page, /draft in putaway|saved as draft/i);
  });

  test("shows error when source and destination rack are the same", async ({
    page,
  }) => {
    const srcOk = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      SOURCE_RACK_LABEL,
    );
    if (!srcOk) {
      test.skip(true, `No source rack matching "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const sku = await selectFirstAvailableSku(page);
    if (!sku) {
      test.skip(true, `No SKU with stock on rack "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const lot = await ensureLotSelected(page);
    if (lot == null) {
      test.skip(true, "Could not resolve lot for selected SKU.");
      return;
    }

    await page.locator("#putaway-qty").fill(PUTAWAY_TEST_QTY);

    const sameDest = await selectRackByLocationLabel(
      page,
      "putaway-dest-rack",
      SOURCE_RACK_LABEL,
    );
    if (!sameDest) {
      test.skip(true, `Could not select rack "${SOURCE_RACK_LABEL}" as destination.`);
      return;
    }

    await clickAddToList(page);
    await expectToast(page, /Invalid racks/i);
    await expectToast(page, /Source and destination rack must be different/i);
    await expectNoToast(page, /draft in putaway|saved as draft/i);
  });

  test("shows error when quantity exceeds on-hand for selected lot", async ({
    page,
  }) => {
    const srcOk = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      SOURCE_RACK_LABEL,
    );
    if (!srcOk) {
      test.skip(true, `No source rack matching "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const sku = await selectFirstAvailableSku(page);
    if (!sku) {
      test.skip(true, `No SKU with stock on rack "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const lot = await ensureLotSelected(page);
    if (lot == null) {
      test.skip(true, "Could not resolve lot for selected SKU.");
      return;
    }

    const maxQty = await readMaximumQtyHint(page);
    if (maxQty == null || maxQty < 1) {
      test.skip(true, "Could not read maximum quantity hint for selected lot.");
      return;
    }

    const destOk = await selectRackByLocationLabel(
      page,
      "putaway-dest-rack",
      DEST_RACK_LABEL,
    );
    if (!destOk) {
      test.skip(true, `No destination rack matching "${DEST_RACK_LABEL}".`);
      return;
    }

    await page.locator("#putaway-qty").fill(String(maxQty + 1));
    await clickAddToList(page);

    await expectToast(page, /Quantity too high/i);
    await expectNoToast(page, /draft in putaway|saved as draft/i);
  });

  test("shows error when lot is required but not selected", async ({
    page,
  }) => {
    const srcOk = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      SOURCE_RACK_LABEL,
    );
    if (!srcOk) {
      test.skip(true, `No source rack matching "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const listbox = await openSkuDropdown(page);
    const skuOptionCount = await listbox.getByRole("option").count();
    await page.keyboard.press("Escape");
    await expect(listbox).toBeHidden({ timeout: 5_000 });

    if (skuOptionCount < 2) {
      test.skip(true, `No SKU with stock on rack "${SOURCE_RACK_LABEL}".`);
      return;
    }

    for (let i = 1; i < skuOptionCount; i++) {
      const skuText = await selectSkuAtOptionIndex(page, i);
      if (!skuText) continue;

      if (!(await skuRequiresLotSelection(page))) {
        await selectRackByLocationLabel(
          page,
          "putaway-source-rack",
          SOURCE_RACK_LABEL,
        );
        continue;
      }

      await expect(page.locator("#putaway-lot")).toContainText(/Select lot/i);
      await expect(page.locator("#putaway-qty")).toBeDisabled();

      await clickAddToList(page);
      await expectToast(page, /Select lot/i);
      await expectNoToast(page, /draft in putaway|saved as draft/i);
      return;
    }

    test.skip(
      true,
      `No lot-tracked SKU with multiple quants on rack "${SOURCE_RACK_LABEL}".`,
    );
  });
});

// ============================================================================
// Form behaviour
// ============================================================================

test.describe("Putaway form behaviour", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPutaway(page);
  });

  test("disables SKU until source rack; quantity until SKU and lot are resolved", async ({
    page,
  }) => {
    await expect(page.locator("#putaway-sku")).toBeDisabled();
    await expect(page.locator("#putaway-lot")).toBeDisabled();
    await expect(page.locator("#putaway-qty")).toBeDisabled();

    const srcOk = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      SOURCE_RACK_LABEL,
    );
    if (!srcOk) {
      test.skip(true, `No source rack matching "${SOURCE_RACK_LABEL}".`);
      return;
    }

    await expect(page.locator("#putaway-sku")).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator("#putaway-qty")).toBeDisabled();

    const sku = await selectFirstAvailableSku(page);
    if (!sku) {
      test.skip(true, `No SKU with stock on rack "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const lot = await ensureLotSelected(page);
    if (lot == null) {
      test.skip(true, "Could not resolve lot for selected SKU.");
      return;
    }

    await expect(page.locator("#putaway-qty")).toBeEnabled();
  });

  test("clears SKU, lot, and quantity when source rack is changed", async ({
    page,
  }) => {
    test.skip(
      SOURCE_RACK_LABEL === DEST_RACK_LABEL,
      "Need a destination rack different from source to re-select source.",
    );

    const srcOk = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      SOURCE_RACK_LABEL,
    );
    if (!srcOk) {
      test.skip(true, `No source rack matching "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const sku = await selectFirstAvailableSku(page);
    if (!sku) {
      test.skip(true, `No SKU with stock on rack "${SOURCE_RACK_LABEL}".`);
      return;
    }

    await ensureLotSelected(page);
    await page.locator("#putaway-qty").fill("5");
    await expect(page.locator("#putaway-qty")).toHaveValue("5");

    const srcOkAgain = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      DEST_RACK_LABEL,
    );
    if (!srcOkAgain) {
      test.skip(true, `No rack matching "${DEST_RACK_LABEL}" for source re-select.`);
      return;
    }

    await expect(page.locator("#putaway-qty")).toHaveValue("");
    await expect(page.locator("#putaway-sku")).toContainText(/Select SKU/i);
    await expect(page.locator("#putaway-lot")).toBeDisabled();
  });
});

// ============================================================================
// Queue
// ============================================================================

test.describe("Putaway queue", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPutaway(page);
  });

  test("approving one draft line leaves other draft lines in the queue", async ({
    page,
  }) => {
    test.skip(
      SOURCE_RACK_LABEL === DEST_RACK_LABEL ||
        SOURCE_RACK_LABEL === ALT_DEST_RACK_LABEL ||
        DEST_RACK_LABEL === ALT_DEST_RACK_LABEL,
      "Source and two distinct destination rack labels are required.",
    );

    const addAlt = await addPutawayDraftLine(page, {
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: ALT_DEST_RACK_LABEL,
      qty: PUTAWAY_ALT_QTY,
    });
    if (!skipIfPrereqsMissing(addAlt, SOURCE_RACK_LABEL, ALT_DEST_RACK_LABEL)) {
      return;
    }
    await expectToast(page, /draft in putaway|saved as draft/i);

    const addPrimary = await addPutawayDraftLine(page, {
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
    });
    if (!skipIfPrereqsMissing(addPrimary, SOURCE_RACK_LABEL, DEST_RACK_LABEL)) {
      return;
    }
    await expectToast(page, /draft in putaway|saved as draft/i);

    const rowToApprove = putawayDraftRowLocator(page, {
      skuCode: addPrimary.skuCode,
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
      lotLabel: addPrimary.lotLabel,
    });
    const rowToKeep = putawayDraftRowLocator(page, {
      skuCode: addAlt.skuCode,
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: ALT_DEST_RACK_LABEL,
      qty: PUTAWAY_ALT_QTY,
      lotLabel: addAlt.lotLabel,
    });

    await expect(rowToApprove).toBeVisible({ timeout: 10_000 });
    await expect(rowToKeep).toBeVisible();

    await rowToApprove.getByRole("button", { name: /^Approve$/i }).click();
    await expectToast(
      page,
      /confirm receipt|work queue|Transferred|success|approved|completed/i,
    );

    await expect(rowToApprove).not.toBeVisible({ timeout: 15_000 });
    await expect(rowToKeep).toBeVisible({ timeout: 10_000 });
  });
});

// ============================================================================
// Happy path
// ============================================================================

test.describe("Putaway happy path @smoke", () => {
  test.beforeAll(async () => {
    if (
      process.env.E2E_PUTAWAY_SOURCE_RACK_LABEL &&
      process.env.E2E_PUTAWAY_DEST_RACK_LABEL
    ) {
      return;
    }
    try {
      const seed = await seedLooseStockForBinTransfer({
        rackLabel: process.env.E2E_PUTAWAY_SOURCE_RACK_LABEL,
        destRackLabel: process.env.E2E_PUTAWAY_DEST_RACK_LABEL,
      });
      SOURCE_RACK_LABEL = seed.sourceRackLabel;
      DEST_RACK_LABEL = seed.destRackLabel;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      test.skip(true, `Could not seed stock for putaway E2E: ${message}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    await gotoPutaway(page);
  });

  test("adds a draft line to the putaway list then rejects it (no stock move)", async ({
    page,
  }) => {
    test.skip(
      SOURCE_RACK_LABEL === DEST_RACK_LABEL,
      "Set different E2E_PUTAWAY_SOURCE_RACK_LABEL and E2E_PUTAWAY_DEST_RACK_LABEL.",
    );

    const add = await addPutawayDraftLine(page, {
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
    });
    if (!skipIfPrereqsMissing(add, SOURCE_RACK_LABEL, DEST_RACK_LABEL)) {
      return;
    }

    await expectToast(page, /draft in putaway|saved as draft/i);

    const row = putawayDraftRowLocator(page, {
      skuCode: add.skuCode,
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
      lotLabel: add.lotLabel,
    });

    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByRole("cell").nth(5)).toHaveText(
      `${Number(PUTAWAY_TEST_QTY).toLocaleString()} CTN`,
    );
    await expect(row.getByRole("cell").nth(3)).toHaveText(
      lotNoTableCellText(add.lotLabel),
    );

    await row.getByRole("button", { name: /^Reject$/i }).click();
    await expectToast(page, /rejected|no stock was moved/i);
    await expect(row).not.toBeVisible({ timeout: 10_000 });
  });

  test("adds a draft line to the putaway list then approves (transfer)", async ({
    page,
  }) => {
    test.skip(
      SOURCE_RACK_LABEL === DEST_RACK_LABEL,
      "Set different E2E_PUTAWAY_SOURCE_RACK_LABEL and E2E_PUTAWAY_DEST_RACK_LABEL.",
    );

    const add = await addPutawayDraftLine(page, {
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
    });
    if (!skipIfPrereqsMissing(add, SOURCE_RACK_LABEL, DEST_RACK_LABEL)) {
      return;
    }

    await expectToast(page, /draft in putaway|saved as draft/i);

    const row = putawayDraftRowLocator(page, {
      skuCode: add.skuCode,
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
      lotLabel: add.lotLabel,
    });

    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: /^Approve$/i }).click();
    await expectToast(
      page,
      /confirm receipt|work queue|Transferred|success|approved|completed/i,
    );
    await expect(row).not.toBeVisible({ timeout: 15_000 });
  });

  test("approve reduces on-hand quantity for the selected lot", async ({
    page,
  }) => {
    test.skip(
      SOURCE_RACK_LABEL === DEST_RACK_LABEL,
      "Set different E2E_PUTAWAY_SOURCE_RACK_LABEL and E2E_PUTAWAY_DEST_RACK_LABEL.",
    );

    const srcOk = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      SOURCE_RACK_LABEL,
    );
    if (!srcOk) {
      test.skip(true, `No source rack matching "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const skuOptionText = await selectFirstAvailableSku(page);
    if (!skuOptionText) {
      test.skip(true, `No SKU with stock on rack "${SOURCE_RACK_LABEL}".`);
      return;
    }

    const lotLabel = await ensureLotSelected(page);
    if (lotLabel == null) {
      test.skip(true, "Could not resolve lot for selected SKU.");
      return;
    }

    const onHandBefore = await readMaximumQtyHint(page);
    if (onHandBefore == null || onHandBefore < 2) {
      test.skip(
        true,
        `Need at least 2 on-hand for selected lot to verify −${PUTAWAY_TEST_QTY} after approve (got ${onHandBefore ?? "unknown"}).`,
      );
      return;
    }

    const skuCode = skuCodeFromOptionText(skuOptionText);
    await page.locator("#putaway-qty").fill(PUTAWAY_TEST_QTY);

    const destOk = await selectRackByLocationLabel(
      page,
      "putaway-dest-rack",
      DEST_RACK_LABEL,
    );
    if (!destOk) {
      test.skip(true, `No destination rack matching "${DEST_RACK_LABEL}".`);
      return;
    }

    await clickAddToList(page);
    await expectToast(page, /draft in putaway|saved as draft/i);

    const row = putawayDraftRowLocator(page, {
      skuCode,
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
      lotLabel,
    });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: /^Approve$/i }).click();
    await expectToast(
      page,
      /confirm receipt|work queue|Transferred|success|approved|completed/i,
    );
    await expect(row).not.toBeVisible({ timeout: 15_000 });

    const srcAgain = await selectRackByLocationLabel(
      page,
      "putaway-source-rack",
      SOURCE_RACK_LABEL,
    );
    if (!srcAgain) {
      test.skip(true, `Could not re-select source rack "${SOURCE_RACK_LABEL}".`);
      return;
    }

    await page.locator("#putaway-sku").click();
    let listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 10_000 });
    await listbox
      .getByRole("option")
      .filter({ hasText: new RegExp(escapeRegExp(skuCode)) })
      .first()
      .click();

    const lotTrigger = page.locator("#putaway-lot");
    if (await lotTrigger.isEnabled()) {
      await lotTrigger.click();
      listbox = page.getByRole("listbox");
      await expect(listbox).toBeVisible({ timeout: 10_000 });
      const lotOption = listbox
        .getByRole("option")
        .filter({ hasText: new RegExp(escapeRegExp(lotLabel)) });
      if ((await lotOption.count()) === 0) {
        test.skip(true, `Lot "${lotLabel}" no longer listed after transfer.`);
        return;
      }
      await lotOption.first().click();
    }

    const onHandAfter = await readMaximumQtyHint(page);
    expect(onHandAfter).not.toBeNull();
    expect(onHandAfter).toBe(onHandBefore - Number(PUTAWAY_TEST_QTY));
  });

  test("approve dispatches to work queue; confirm completes transfer", async ({
    page,
  }) => {
    try {
      const seed = await seedLooseStockForBinTransfer();
      SOURCE_RACK_LABEL = seed.sourceRackLabel;
      DEST_RACK_LABEL = seed.destRackLabel;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      test.skip(true, `Could not seed stock for work-queue E2E: ${message}`);
    }

    test.skip(
      SOURCE_RACK_LABEL === DEST_RACK_LABEL,
      "Set different E2E_PUTAWAY_SOURCE_RACK_LABEL and E2E_PUTAWAY_DEST_RACK_LABEL.",
    );

    await gotoPutaway(page);

    const add = await addPutawayDraftLine(page, {
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
    });
    if (!skipIfPrereqsMissing(add, SOURCE_RACK_LABEL, DEST_RACK_LABEL)) {
      return;
    }

    await expectToast(page, /draft in putaway|saved as draft/i);

    const row = putawayDraftRowLocator(page, {
      skuCode: add.skuCode,
      sourceLabel: SOURCE_RACK_LABEL,
      destLabel: DEST_RACK_LABEL,
      qty: PUTAWAY_TEST_QTY,
      lotLabel: add.lotLabel,
    });

    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: /^Approve$/i }).click();
    await expectToast(
      page,
      /confirm receipt|approved|work queue|success/i,
    );
    await expect(row).not.toBeVisible({ timeout: 15_000 });

    await page.goto("/admin/bin-transfer-work-queue");
    await expect(
      page.getByRole("heading", { name: /Internal Transfer Work Queue/i }),
    ).toBeVisible({ timeout: 15_000 });

    const queueTable = page.getByRole("table", {
      name: /In-transit internal transfers awaiting confirmation/i,
    });
    const queueItemRow = queueTable
      .getByRole("row")
      .filter({ hasText: add.skuCode })
      .filter({ hasText: new RegExp(DEST_RACK_LABEL.replace(/-/g, "[^0-9]*")) });
    await expect(queueItemRow.first()).toBeVisible({ timeout: 15_000 });
    const queueCountBefore = await queueItemRow.count();

    await queueItemRow
      .last()
      .locator("xpath=preceding-sibling::tr[1]")
      .getByRole("button", { name: /^Confirm$/i })
      .click();
    await expectToast(page, /received|completed|success/i);

    await expect(queueItemRow).toHaveCount(queueCountBefore - 1, {
      timeout: 15_000,
    });
  });
});
