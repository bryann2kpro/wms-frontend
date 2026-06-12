/** ASN / PO line shape used when computing remaining receive qty. */
export type PoFulfillmentAsnLine = {
	skuCode: string;
	expected: number;
};

export type PoFulfillmentGrnItem = {
	skuCode?: string | null;
	qty?: string | number | null;
};

export type PoFulfillmentGrn = {
	items?: PoFulfillmentGrnItem[] | null;
};

/**
 * Sum qty received on prior GRNs for a PO, keyed by SKU code.
 */
export function sumHistoricalReceivedBySku(
	grns: PoFulfillmentGrn[],
): Map<string, number> {
	const receivedBySku = new Map<string, number>();
	for (const grn of grns) {
		for (const item of grn.items ?? []) {
			const skuCode = item.skuCode?.trim();
			if (!skuCode) continue;
			const qty = Number(item.qty ?? 0);
			if (!Number.isFinite(qty) || qty <= 0) continue;
			receivedBySku.set(skuCode, (receivedBySku.get(skuCode) ?? 0) + qty);
		}
	}
	return receivedBySku;
}

/** Remaining qty to receive for one SKU on a PO (never negative). */
export function computePoRemainingQty(
	expected: number,
	alreadyReceived: number,
): number {
	const expectedNum = Number(expected);
	const receivedNum = Number(alreadyReceived);
	if (!Number.isFinite(expectedNum) || expectedNum <= 0) return 0;
	if (!Number.isFinite(receivedNum) || receivedNum <= 0) return expectedNum;
	return Math.max(0, expectedNum - receivedNum);
}

/**
 * Map ASN lines to skuCode + expected for fulfillment helpers.
 */
export function asnLinesToFulfillmentLines(
	lines: Array<{
		itemid: string;
		quantity: number;
	}>,
): PoFulfillmentAsnLine[] {
	return lines.map((line) => ({
		skuCode: line.itemid,
		expected: line.quantity,
	}));
}

/**
 * Set each line's `carton` to PO remaining (expected − prior GRN receipts).
 * Lines with no matching ASN entry or zero remaining are left unchanged / filtered by caller.
 */
export function applyRemainingQtyToLineItems<
	T extends { skuCode: string; carton: number },
>(items: T[], asnLines: PoFulfillmentAsnLine[], receivedBySku: Map<string, number>): T[] {
	return items.map((item) => {
		const skuCode = item.skuCode?.trim();
		if (!skuCode) return item;
		const asnLine = asnLines.find((l) => l.skuCode === skuCode);
		if (!asnLine) return item;
		const remaining = computePoRemainingQty(
			asnLine.expected,
			receivedBySku.get(skuCode) ?? 0,
		);
		return { ...item, carton: remaining };
	});
}
