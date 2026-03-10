/** Purchase Order / Delivery Order types. */

export type PurchaseOrderStatus =
	| "preparing"
	| "in-transit"
	| "to-ship"
	| "cancel"
	| "return"
	| "other";

export type NetSuiteStatus = "synced" | "pending" | "error" | undefined;

export interface PurchaseOrderItem {
	id: string;
	sku: string;
	description: string;
	quantity: number;
	pickedQuantity: number;
	packedQuantity: number;
}

export interface PurchaseOrderDetail {
	id: string;
	purchaseOrderNumber: string;
	fromLocation: string;
	toLocation: string;
	status: PurchaseOrderStatus;
	createdDate: Date;
	expectedDeliveryDate: Date;
	createdBy: string;
	notes?: string;
	items: PurchaseOrderItem[];
	totalItems: number;
	netsuiteStatus?: NetSuiteStatus;
	regionName?: string | null;
	regionCode?: string | null;
}

export type PurchaseOrderStatusFilter = PurchaseOrderStatus | "ALL";

export interface PurchaseOrderListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: PurchaseOrderStatusFilter;
}

export interface PurchaseOrderSummary {
	byStatus: Record<PurchaseOrderStatus, number>;
	total: number;
}

export interface PurchaseOrderListResult {
	items: PurchaseOrderDetail[];
	summary: PurchaseOrderSummary;
	page: number;
	pageSize: number;
	total: number;
}

export interface CreatePurchaseOrderLineItemInput {
	skuId: string;
	skuCode?: string;
	description?: string;
	quantity: number;
}

export interface CreatePurchaseOrderInput {
	purchaseOrderNumber: string;
	outletId: string;
	outletName: string;
	expectedDeliveryDate: Date;
	notes?: string;
	items: CreatePurchaseOrderLineItemInput[];
	/** When true, assigns to next delivery day regardless of cutoff (emergency delivery). */
	isEmergency?: boolean;
}
