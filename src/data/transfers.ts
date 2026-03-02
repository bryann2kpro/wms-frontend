/**
 * Transfers (delivery orders) API. Replace with real GraphQL/REST when backend is ready.
 * No mock in-memory data; list is empty until backend is connected.
 */

import type {
	TransferDetail,
	TransferListFilters,
	TransferListResult,
	TransferStatus,
	TransferSummary,
	CreateTransferInput,
} from "./transfers.types";

const emptySummary: TransferSummary = {
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
	TransferDetail,
	TransferStatus,
	TransferStatusFilter,
	CreateTransferInput,
	CreateTransferLineItemInput,
} from "./transfers.types";

/** List transfers. Returns empty result until backend is connected. */
export async function getTransfers(
	filters: TransferListFilters,
): Promise<TransferListResult> {
	const { page, pageSize } = filters;
	return {
		items: [],
		summary: emptySummary,
		page,
		pageSize,
		total: 0,
	};
}

/** Create a delivery order. Succeeds and returns a minimal detail so UI can close; not persisted until backend is connected. */
export async function createTransfer(
	input: CreateTransferInput,
): Promise<TransferDetail> {
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
		transferOrderNumber: input.transferOrderNumber,
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

/** Update transfer status (e.g. accept / reject). No-op until backend is connected. */
export async function updateTransferStatus(
	_id: string,
	_status: TransferStatus,
): Promise<TransferDetail | undefined> {
	return undefined;
}
