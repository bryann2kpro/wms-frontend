/**
 * Warehouse-to-Warehouse two-leg transfer E2E — @smoke
 *
 * Flow: seed source stock → create + approve W2W → AWAITING_DISPATCH (source unchanged)
 *       → Dispatch from work queue → IN_TRANSIT (source debited)
 *       → Receive → COMPLETED (destination credited)
 *
 * Prerequisites
 * ─────────────
 * • TJ must run `pnpm run migrate` in smee-backend first (AWAITING_DISPATCH enum).
 * • Backend + frontend running; E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in .env.e2e
 * • At least two warehouses with zoned racks and carton stock on a source rack
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
	createAndApproveW2WTransfer,
	getStockQuantQuantity,
	seedStockForW2WTransfer,
	type W2WStockSeedResult,
} from "./helpers/stock-quant";

const TRANSFER_QTY = "1";

async function gotoWorkQueue(page: Page) {
	await page.goto("/admin/bin-transfer-work-queue");
	await expect(
		page.getByRole("heading", { name: /Internal Transfer Work Queue/i }),
	).toBeVisible({ timeout: 15_000 });
}

function toastWithText(page: Page, text: RegExp) {
	return page.locator("[data-sonner-toast]").getByText(text);
}

async function expectToast(page: Page, text: RegExp) {
	await expect(toastWithText(page, text).first()).toBeVisible({
		timeout: 10_000,
	});
}

/** Line-item row for a transfer (buttons live on the preceding group row). */
function transferItemRow(
	queueTable: Locator,
	transferNo: string,
	skuCode: string,
) {
	return queueTable
		.getByRole("row")
		.filter({ hasText: transferNo })
		.filter({ hasText: skuCode });
}

/** Group header row immediately above a line-item row. */
function transferGroupRow(itemRow: Locator) {
	return itemRow.locator("xpath=preceding-sibling::tr[1]");
}

async function clickTransferQueueAction(
	queueTable: Locator,
	transferNo: string,
	skuCode: string,
	action: RegExp,
) {
	const itemRow = transferItemRow(queueTable, transferNo, skuCode);
	await expect(itemRow.first()).toBeVisible({ timeout: 15_000 });
	const groupRow = transferGroupRow(itemRow.first());
	const actionButton = groupRow.getByRole("button", { name: action });
	await expect(actionButton).toBeVisible({ timeout: 15_000 });
	await expect(actionButton).toBeEnabled();
	await actionButton.click();
}

async function expectTransferGroupStatus(
	queueTable: Locator,
	transferNo: string,
	skuCode: string,
	statusPattern: RegExp,
) {
	const itemRow = transferItemRow(queueTable, transferNo, skuCode);
	await expect(itemRow.first()).toBeVisible({ timeout: 15_000 });
	await expect(transferGroupRow(itemRow.first())).toContainText(statusPattern, {
		timeout: 15_000,
	});
}

test.describe("W2W two-leg transfer @smoke", () => {
	let seed: W2WStockSeedResult;

	test.beforeAll(async () => {
		try {
			seed = await seedStockForW2WTransfer({ transferQty: TRANSFER_QTY });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			test.skip(true, `Could not seed W2W stock: ${message}`);
		}
	});

	test("approve → awaiting dispatch (no stock move) → dispatch → receive", async ({
		page,
	}) => {
		const qtyBefore = Number(seed.sourceQtyBefore);
		expect(qtyBefore).toBeGreaterThanOrEqual(Number(TRANSFER_QTY));

		const approved = await createAndApproveW2WTransfer(seed);
		expect(approved.status).toBe("AWAITING_DISPATCH");

		const qtyAfterApprove = Number(await getStockQuantQuantity(seed.quantId));
		expect(qtyAfterApprove).toBe(qtyBefore);

		await gotoWorkQueue(page);

		const queueTable = page.getByRole("table", {
			name: /Internal transfers awaiting dispatch or receipt/i,
		});

		await expectTransferGroupStatus(
			queueTable,
			approved.transferNo,
			seed.skuCode,
			/Awaiting Dispatch/i,
		);

		await clickTransferQueueAction(
			queueTable,
			approved.transferNo,
			seed.skuCode,
			/^Dispatch$/i,
		);
		await expectToast(page, /dispatched|success/i);
		await expectTransferGroupStatus(
			queueTable,
			approved.transferNo,
			seed.skuCode,
			/In Transit/i,
		);

		const qtyAfterDispatch = Number(await getStockQuantQuantity(seed.quantId));
		expect(qtyAfterDispatch).toBe(qtyBefore - Number(TRANSFER_QTY));

		await clickTransferQueueAction(
			queueTable,
			approved.transferNo,
			seed.skuCode,
			/^Receive$/i,
		);
		await expectToast(page, /received|completed|success/i);

		await expect(
			transferItemRow(queueTable, approved.transferNo, seed.skuCode),
		).toHaveCount(0, { timeout: 15_000 });
	});
});
