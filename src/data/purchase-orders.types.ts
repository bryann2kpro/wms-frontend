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

/** Delivery order step status (NEW -> PACKING -> SHIPPED = out from warehouse -> DELIVERED). */
export interface DeliveryOrderStep {
	id: string;
	doNo: string;
	status: "CREATED" | "NEW" | "PICKING" | "PACKING" | "SHIPPED" | "DELIVERED";
}

export interface PurchaseOrderDetail {
	id: string;
	purchaseOrderNumber: string;
	fromLocation: string;
	toLocation: string;
	/** Raw outlet UUID, used by the edit form to pre-select the current outlet. */
	outletId?: string;
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
	/** When present, the purchase order has an associated delivery order; use for step button. */
	deliveryOrder?: DeliveryOrderStep | null;
}

export interface UpdatePurchaseOrderInput {
	scheduledDeliveryDate?: string;
	outletId?: string;
	items?: Array<{ id: string; qtyRequired: number }>;
	newItems?: Array<{ skuId: string; skuCode: string; qtyRequired: number }>;
	removedItemIds?: string[];
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
	/** From API pagination when available; minimum 1 for empty UI. */
	totalPages: number;
}

export interface CreatePurchaseOrderLineItemInput {
	skuId: string;
	skuCode?: string;
	description?: string;
	quantity: number;
	stockQuantId: string;
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
