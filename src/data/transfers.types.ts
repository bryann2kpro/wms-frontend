/** Transfer / delivery order types (no mock data). */

export type TransferStatus =
	| "preparing"
	| "in-transit"
	| "to-ship"
	| "cancel"
	| "return"
	| "other";

export type NetSuiteStatus = "synced" | "pending" | "error" | undefined;

export interface TransferItem {
	id: string;
	sku: string;
	description: string;
	quantity: number;
	pickedQuantity: number;
	packedQuantity: number;
}

export interface TransferDetail {
	id: string;
	transferOrderNumber: string;
	fromLocation: string;
	toLocation: string;
	status: TransferStatus;
	createdDate: Date;
	expectedDeliveryDate: Date;
	createdBy: string;
	notes?: string;
	items: TransferItem[];
	totalItems: number;
	netsuiteStatus?: NetSuiteStatus;
	regionName?: string | null;
	regionCode?: string | null;
}

export type TransferStatusFilter = TransferStatus | "ALL";

export interface TransferListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: TransferStatusFilter;
}

export interface TransferSummary {
	byStatus: Record<TransferStatus, number>;
	total: number;
}

export interface TransferListResult {
	items: TransferDetail[];
	summary: TransferSummary;
	page: number;
	pageSize: number;
	total: number;
}

export interface CreateTransferLineItemInput {
	skuId: string;
	skuCode?: string;
	description?: string;
	quantity: number;
}

export interface CreateTransferInput {
	transferOrderNumber: string;
	outletId: string;
	outletName: string;
	expectedDeliveryDate: Date;
	notes?: string;
	items: CreateTransferLineItemInput[];
}
