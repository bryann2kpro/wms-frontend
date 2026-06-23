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
export type PoFulfillmentGrnItemWithLoss = PoFulfillmentGrnItem & {
	lossQty?: string | number | null;
};

export type PoFulfillmentGrnWithLoss = {
	items?: PoFulfillmentGrnItemWithLoss[] | null;
};

function sumHistoricalQtyBySku(
	grns: PoFulfillmentGrnWithLoss[],
	field: "qty" | "lossQty",
): Map<string, number> {
	const totalsBySku = new Map<string, number>();
	for (const grn of grns) {
		for (const item of grn.items ?? []) {
			const skuCode = item.skuCode?.trim();
			if (!skuCode) continue;
			const qty = Number(item[field] ?? 0);
			if (!Number.isFinite(qty) || qty <= 0) continue;
			totalsBySku.set(skuCode, (totalsBySku.get(skuCode) ?? 0) + qty);
		}
	}
	return totalsBySku;
}

export function sumHistoricalReceivedBySku(
	grns: PoFulfillmentGrn[],
): Map<string, number> {
	return sumHistoricalQtyBySku(grns, "qty");
}

/** Sum loss qty on prior GRNs for a PO, keyed by SKU code. */
export function sumHistoricalLossBySku(
	grns: PoFulfillmentGrnWithLoss[],
): Map<string, number> {
	return sumHistoricalQtyBySku(grns, "lossQty");
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
 * Remaining qty to receive for a single SKU (expected − already received),
 * clamped to >= 0. Returns 0 when the SKU has no matching ASN line.
 */
export function remainingForSku(
	skuCode: string,
	poAsnLines: PoFulfillmentAsnLine[],
	receivedBySku: Map<string, number>,
): number {
	const code = skuCode?.trim();
	if (!code) return 0;
	const asnLine = poAsnLines.find((l) => l.skuCode === code);
	if (!asnLine) return 0;
	return computePoRemainingQty(asnLine.expected, receivedBySku.get(code) ?? 0);
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

/** Ordered carton qty for fulfillment display (PO/ASN line or manual entry). */
export function resolveOrderedCtnForDisplay(
	orderedFromPo: number | null,
	manualOrderedQty: number | undefined,
): number | null {
	if (orderedFromPo != null && Number.isFinite(orderedFromPo) && orderedFromPo >= 0) {
		return orderedFromPo;
	}
	if (
		manualOrderedQty != null &&
		Number.isFinite(manualOrderedQty) &&
		manualOrderedQty >= 0
	) {
		return manualOrderedQty;
	}
	return null;
}

/** Fulfilled cartons as cumulative progress vs ordered (e.g. 5/20). */
export function formatFulfilledCtnDisplay(
	fulfilled: number,
	ordered: number | null | undefined,
): string {
	const fulfilledNum = Number(fulfilled);
	const safeFulfilled =
		Number.isFinite(fulfilledNum) && fulfilledNum >= 0 ? fulfilledNum : 0;
	const orderedNum = ordered == null ? null : Number(ordered);
	if (orderedNum == null || !Number.isFinite(orderedNum) || orderedNum < 0) {
		return String(safeFulfilled);
	}
	return `${safeFulfilled}/${orderedNum}`;
}

/** Cumulative loss qty; no ordered baseline on GRN lines. */
export function formatFulfilledLossDisplay(fulfilledLoss: number): string {
	const lossNum = Number(fulfilledLoss);
	const safeLoss = Number.isFinite(lossNum) && lossNum >= 0 ? lossNum : 0;
	return String(safeLoss);
}
