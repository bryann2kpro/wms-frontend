/**
 * Purchase Orders API. Replace with real GraphQL/REST when backend is ready.
 * No mock in-memory data; list is empty until backend is connected.
 */

import type {
	PurchaseOrderDetail,
	PurchaseOrderListFilters,
	PurchaseOrderListResult,
	PurchaseOrderStatus,
	PurchaseOrderSummary,
	CreatePurchaseOrderInput,
} from "./purchase-orders.types";

const emptySummary: PurchaseOrderSummary = {
	byStatus: {
		preparing: 0,
		"in-transit": 0,
		"to-ship": 0,
		cancel: 0,
		return: 0,
		other: 0,
	},
	total: 0,
};

export type {
	PurchaseOrderDetail,
	PurchaseOrderStatus,
	PurchaseOrderStatusFilter,
	CreatePurchaseOrderInput,
	CreatePurchaseOrderLineItemInput,
} from "./purchase-orders.types";

/** List purchase orders. Returns empty result until backend is connected. */
export async function getPurchaseOrders(
	filters: PurchaseOrderListFilters,
): Promise<PurchaseOrderListResult> {
	const { page, pageSize } = filters;
	return {
		items: [],
		summary: emptySummary,
		page,
		pageSize,
		total: 0,
	};
}

/** Create a purchase order. Succeeds and returns a minimal detail so UI can close; not persisted until backend is connected. */
export async function createPurchaseOrder(
	input: CreatePurchaseOrderInput,
): Promise<PurchaseOrderDetail> {
	const now = new Date();
	const items = (input.items ?? []).map((line, idx) => ({
		id: `temp-${idx + 1}`,
		sku: line.skuCode ?? line.skuId,
		description: line.description ?? "—",
		quantity: line.quantity,
		pickedQuantity: 0,
		packedQuantity: 0,
	}));

	return {
		id: "temp",
		purchaseOrderNumber: input.purchaseOrderNumber,
		fromLocation: "Main Warehouse",
		toLocation: input.outletName,
		status: "preparing",
		createdDate: now,
		expectedDeliveryDate: input.expectedDeliveryDate,
		createdBy: "Current User",
		notes: input.notes,
		items: items.length ? items : [{ id: "temp-1", sku: "—", description: "—", quantity: 0, pickedQuantity: 0, packedQuantity: 0 }],
		totalItems: items.length || 0,
		netsuiteStatus: undefined,
	};
}

/** Update purchase order status (e.g. accept / reject). No-op until backend is connected. */
export async function updatePurchaseOrderStatus(
	_id: string,
	_status: PurchaseOrderStatus,
): Promise<PurchaseOrderDetail | undefined> {
	return undefined;
}
