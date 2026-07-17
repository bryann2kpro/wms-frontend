/**
 * Global rack pre-allocation for Excel import.
 *
 * Instead of creating POs one by one (each independently grabbing racks, leaving gaps),
 * this pre-computes rack assignments across ALL POs before any PO is created.
 *
 * Algorithm:
 * 1. Collect all SKUs + qty needed across all POs
 * 2. For each SKU, load available stock_quant sorted by expiry date ascending (FEFO), then rack label
 * 3. Drain racks globally (rack 1 fully used before moving to rack 2)
 * 4. Map each portion back to its PO line item as stockQuantIds
 */

import { gqlRequest } from "@/lib/api/gql";
import { STOCK_QUANTS_QUERY, type StockQuant } from "@/lib/graphql/stock-quant";
import type { CreatePurchaseOrderInput } from "@/data/purchase-orders.types";

type StockQuantsQueryData = {
	stockQuants: { query: StockQuant[] };
};

/** Fetch all available stock_quant rows for a SKU, sorted by rack label ascending. */
async function fetchStockQuantsForSku(skuId: string): Promise<StockQuant[]> {
	const data = await gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, {
		filter: { skuId },
		pageSize: 1000,
		pageNumber: 1,
	});
	const rows = data.stockQuants?.query ?? [];
	// Filter to rows with available qty, sort by expiry ascending (FEFO), then rack label
	return rows
		.filter((r) => parseFloat(r.quantity) - parseFloat(r.reservedQty) > 0)
		.sort((a, b) => {
			const aExp = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
			const bExp = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
			if (aExp !== bExp) return aExp - bExp;
			return (a.rackLabel ?? "").localeCompare(b.rackLabel ?? "");
		});
}

/**
 * Pre-allocate stock_quant batches globally across all POs before creation.
 * Returns the same inputs with `stockQuantIds` filled in on each line item.
 */
export async function allocateStockQuantsForImport(
	inputs: CreatePurchaseOrderInput[],
): Promise<CreatePurchaseOrderInput[]> {
	// Step 1: collect all unique skuIds needed
	const skuIds = [
		...new Set(inputs.flatMap((po) => po.items.map((item) => item.skuId))),
	];

	// Step 2: fetch available stock_quant for each SKU
	const stockQuantsBySku = new Map<string, StockQuant[]>();
	await Promise.all(
		skuIds.map(async (skuId) => {
			const rows = await fetchStockQuantsForSku(skuId);
			stockQuantsBySku.set(skuId, rows);
		}),
	);

	// Step 3: track remaining available per stock_quant row (mutable copy)
	const availableByRow = new Map<string, number>();
	for (const rows of stockQuantsBySku.values()) {
		for (const row of rows) {
			const avail = parseFloat(row.quantity) - parseFloat(row.reservedQty);
			availableByRow.set(row.id, avail);
		}
	}

	// Step 4: for each PO line item, greedily assign stockQuantIds from sorted racks
	const enriched: CreatePurchaseOrderInput[] = inputs.map((po) => ({
		...po,
		items: po.items.map((item) => {
			const rows = stockQuantsBySku.get(item.skuId) ?? [];
			let remaining = item.quantity;
			const assignedIds: string[] = [];

			for (const row of rows) {
				if (remaining <= 0) break;
				const avail = availableByRow.get(row.id) ?? 0;
				if (avail <= 0) continue;
				const take = Math.min(remaining, avail);
				assignedIds.push(row.id);
				availableByRow.set(row.id, avail - take);
				remaining -= take;
			}

			// If we couldn't fully allocate (insufficient stock), pass no stockQuantIds
			// and let the backend handle the error with a proper message
			if (remaining > 0 || assignedIds.length === 0) {
				return item;
			}

			return { ...item, stockQuantIds: assignedIds };
		}),
	}));

	return enriched;
}
