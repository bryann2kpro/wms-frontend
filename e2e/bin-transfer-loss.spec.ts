/**
 * Bin-to-Bin LOSS (loose units) E2E — @smoke
 *
 * UI: /admin/stock-transfer → New transfer form
 *
 * Prerequisites
 * ─────────────
 * • TJ must run `pnpm run migrate` in smee-backend first (stock_quant.loss_qty,
 *   stock_transfer_items.loss_quantity columns).
 * • At least one stock_quant with carton quantity > 0 (seeded via beforeAll).
 * • Set E2E_LOSS_TRANSFER_ENABLED=1 (or true) in .env.e2e after migrate.
 * • Optional env:
 *     E2E_PUTAWAY_SOURCE_RACK_LABEL  (override auto-discovered source rack)
 *     E2E_PUTAWAY_DEST_RACK_LABEL    (override auto-discovered destination rack)
 */

import { test, expect, type Page } from "@playwright/test";
import { seedLooseStockForBinTransfer } from "./helpers/stock-quant";

const LOOSE_TEST_QTY = "1";

let sourceRackLabel =
	process.env.E2E_PUTAWAY_SOURCE_RACK_LABEL ?? "I1-L2-07";
let destRackLabel =
	process.env.E2E_PUTAWAY_DEST_RACK_LABEL ?? "G2-L1-07";
let seededSkuCode: string | undefined;
let seededLotNo: string | undefined;

async function gotoBinTransfer(page: Page) {
	await page.goto("/admin/stock-transfer");
	await expect(
		page.getByRole("heading", { name: /^Bin to Bin$/i }),
	).toBeVisible({ timeout: 15_000 });
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

function skuCodeFromOptionText(optionText: string): string {
	const trimmed = optionText.trim();
	const emParts = trimmed.split(/\s*\u2014\s*/);
	if (emParts.length > 1 && emParts[0]?.trim()) {
		return emParts[0].trim();
	}
	return trimmed.split(/\s*[–-]\s*/)[0]?.trim() ?? trimmed;
}

/**
 * When multiple quants share the SKU, pick the lot that matches seeded stock.
 */
async function ensureSeededLotSelected(
	page: Page,
	preferredLotNo?: string,
): Promise<void> {
	const lotTrigger = page.locator("#putaway-lot");
	if (!(await lotTrigger.isEnabled())) {
		return;
	}

	const current = (await lotTrigger.textContent())?.trim() ?? "";
	if (current && !/^Select lot/i.test(current)) {
		if (!preferredLotNo || current.includes(preferredLotNo)) {
			return;
		}
	}

	await lotTrigger.click();
	const listbox = page.getByRole("listbox");
	await expect(listbox).toBeVisible({ timeout: 10_000 });

	if (preferredLotNo) {
		const lotOption = listbox
			.getByRole("option")
			.filter({ hasText: new RegExp(preferredLotNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
		await expect(lotOption.first()).toBeVisible({ timeout: 5_000 });
		await lotOption.first().click();
		return;
	}

	if (!preferredLotNo) {
		const noLotOption = listbox.getByRole("option", { name: /No lot/i });
		if ((await noLotOption.count()) > 0) {
			await noLotOption.first().click();
			return;
		}
	}

	const options = listbox.getByRole("option");
	const count = await options.count();
	for (let i = 0; i < count; i++) {
		const option = options.nth(i);
		const text = (await option.textContent())?.trim() ?? "";
		if (!text || /^Select lot/i.test(text)) continue;
		await option.click();
		return;
	}

	throw new Error("Could not select a lot for the seeded SKU.");
}

test.describe("Bin-to-Bin loose (LOSS) transfer @smoke", () => {
	test.skip(
		!process.env.E2E_LOSS_TRANSFER_ENABLED,
		"Blocked until TJ migrates loss_qty / loss_quantity columns. Set E2E_LOSS_TRANSFER_ENABLED=1 after migrate.",
	);

	test.beforeAll(async () => {
		try {
			const seed = await seedLooseStockForBinTransfer({
				rackLabel: process.env.E2E_PUTAWAY_SOURCE_RACK_LABEL,
				destRackLabel: process.env.E2E_PUTAWAY_DEST_RACK_LABEL,
				lossQty: "5",
			});
			sourceRackLabel = seed.sourceRackLabel;
			destRackLabel = seed.destRackLabel;
			seededSkuCode = seed.skuCode;
			seededLotNo = seed.lotNo;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			test.skip(true, `Could not seed loose stock: ${message}`);
		}
	});

	test("loose-only draft appears in queue with loose qty", async ({ page }) => {
		await gotoBinTransfer(page);

		const sourceOk = await selectRackByLocationLabel(
			page,
			"putaway-source-rack",
			sourceRackLabel,
		);
		expect(sourceOk, `Source rack ${sourceRackLabel} not found`).toBe(true);

		await page.locator("#putaway-sku").click();
		const skuOptions = page.getByRole("option");
		await expect(skuOptions.first()).toBeVisible({ timeout: 8_000 });
		const skuOptionTexts = await skuOptions.allTextContents();
		const skuWithStock = seededSkuCode
			? skuOptionTexts.find((t) => t.includes(seededSkuCode!))
			: skuOptionTexts.find((t) => !/Select SKU/i.test(t));
		expect(skuWithStock, "No SKU with stock on source rack").toBeTruthy();
		const skuCode = skuCodeFromOptionText(skuWithStock!);
		await page.getByRole("option", { name: new RegExp(skuCode) }).first().click();

		await ensureSeededLotSelected(page, seededLotNo);

		const lossInput = page.locator("#putaway-loss-qty");
		await expect(lossInput).toBeEnabled({ timeout: 10_000 });
		const maxAttr = await lossInput.getAttribute("max");
		expect(
			maxAttr && Number(maxAttr) >= 1,
			`No loose stock on selected quant (max=${maxAttr ?? "none"})`,
		).toBe(true);

		await lossInput.fill(LOOSE_TEST_QTY);

		const destOk = await selectRackByLocationLabel(
			page,
			"putaway-dest-rack",
			destRackLabel,
		);
		expect(destOk, `Destination rack ${destRackLabel} not found`).toBe(true);

		await page.getByRole("button", { name: /^Add to list$/i }).click();
		await expect(
			page.locator("[data-sonner-toast]").getByText(/saved as draft/i).first(),
		).toBeVisible({ timeout: 10_000 });

		const draftRow = page
			.getByRole("table", { name: /Pending transfer drafts/i })
			.getByRole("row")
			.filter({ hasText: skuCode })
			.filter({ hasText: new RegExp(`${LOOSE_TEST_QTY} Loss`, "i") });
		await expect(draftRow.first()).toBeVisible({ timeout: 10_000 });
	});

	test("loose draft → approve → work queue confirm → completed", async ({
		page,
	}) => {
		await gotoBinTransfer(page);

		const sourceOk = await selectRackByLocationLabel(
			page,
			"putaway-source-rack",
			sourceRackLabel,
		);
		expect(sourceOk, `Source rack ${sourceRackLabel} not found`).toBe(true);

		await page.locator("#putaway-sku").click();
		const skuOptions = page.getByRole("option");
		await expect(skuOptions.first()).toBeVisible({ timeout: 8_000 });
		const skuOptionTexts = await skuOptions.allTextContents();
		const skuWithStock = seededSkuCode
			? skuOptionTexts.find((t) => t.includes(seededSkuCode!))
			: skuOptionTexts.find((t) => !/Select SKU/i.test(t));
		expect(skuWithStock, "No SKU with stock on source rack").toBeTruthy();
		const skuCode = skuCodeFromOptionText(skuWithStock!);
		await page.getByRole("option", { name: new RegExp(skuCode) }).first().click();

		await ensureSeededLotSelected(page, seededLotNo);

		const lossInput = page.locator("#putaway-loss-qty");
		await expect(lossInput).toBeEnabled({ timeout: 10_000 });
		await lossInput.fill(LOOSE_TEST_QTY);

		const destOk = await selectRackByLocationLabel(
			page,
			"putaway-dest-rack",
			destRackLabel,
		);
		expect(destOk, `Destination rack ${destRackLabel} not found`).toBe(true);

		await page.getByRole("button", { name: /^Add to list$/i }).click();
		await expect(
			page.locator("[data-sonner-toast]").getByText(/saved as draft/i).first(),
		).toBeVisible({ timeout: 10_000 });

		const draftRow = page
			.getByRole("table", { name: /Pending transfer drafts/i })
			.getByRole("row")
			.filter({ hasText: skuCode })
			.filter({ hasText: sourceRackLabel })
			.filter({ hasText: destRackLabel })
			.filter({ hasText: new RegExp(`${LOOSE_TEST_QTY} Loss`, "i") });
		await expect(draftRow.last()).toBeVisible({ timeout: 10_000 });
		await draftRow.last().getByRole("button", { name: /^Approve$/i }).click();
		await expect(
			page
				.locator("[data-sonner-toast]")
				.getByText(/confirm receipt|work queue|approved|received|success/i)
				.first(),
		).toBeVisible({ timeout: 15_000 });

		await page.goto("/admin/bin-transfer-work-queue");
		await expect(
			page.getByRole("heading", { name: /Internal Transfer Work Queue/i }),
		).toBeVisible({ timeout: 15_000 });

		const queueTable = page.getByRole("table", {
			name: /In-transit internal transfers awaiting confirmation/i,
		});
		const queueItemRow = queueTable
			.getByRole("row")
			.filter({ hasText: skuCode })
			.filter({ hasText: new RegExp(`${LOOSE_TEST_QTY} Loss`, "i") });
		await expect(queueItemRow.first()).toBeVisible({ timeout: 15_000 });
		const queueCountBefore = await queueItemRow.count();

		await queueItemRow
			.last()
			.locator("xpath=preceding-sibling::tr[1]")
			.getByRole("button", { name: /^Confirm$/i })
			.click();
		await expect(
			page
				.locator("[data-sonner-toast]")
				.getByText(/received|completed|success/i)
				.first(),
		).toBeVisible({ timeout: 10_000 });

		await expect(queueItemRow).toHaveCount(queueCountBefore - 1, {
			timeout: 15_000,
		});
	});
});
