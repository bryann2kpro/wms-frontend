/**
 * GraphQL types for master data (Supplier, Region).
 * Aligned with backend schema at /graphql.
 */

export interface Pagination {
	count: number;
	totalCount: number;
	currentPage: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface AuditUser {
	id: string;
	displayName: string;
}

export interface Supplier {
	supplierId: string;
	supplierName: string;
	supplierCode: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface SupplierPaginatedResponse {
	query: Supplier[];
	pagination: Pagination;
}

export interface CreateSupplierInput {
	supplierName: string;
	supplierCode: string;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateSupplierInput {
	supplierName?: string;
	supplierCode?: string;
	updatedBy: string;
}

export interface Region {
	regionId: string;
	regionName: string;
	regionCode: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface RegionPaginatedResponse {
	query: Region[];
	pagination: Pagination;
}

export interface CreateRegionInput {
	regionName: string;
	regionCode: string;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateRegionInput {
	regionName?: string;
	regionCode?: string;
	updatedBy: string;
}

export interface Warehouse {
	warehouseId: string;
	warehouseName: string;
	warehouseCode: string | null;
	warehouseAddress: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
	createdByUser: AuditUser | null;
	updatedByUser: AuditUser | null;
}

export interface WarehousePaginatedResponse {
	query: Warehouse[];
	pagination: Pagination;
}

export interface CreateWarehouseInput {
	warehouseName: string;
	warehouseCode?: string | null;
	warehouseAddress?: string | null;
}

export interface UpdateWarehouseInput {
	warehouseName?: string;
	warehouseCode?: string | null;
	warehouseAddress?: string | null;
}

export interface DeliverySchedule {
	scheduleId: string;
	regionId: string;
	regionName: string;
	regionCode: string;
	dayOfWeek: number;
	dayName: string;
	cutoffDaysBefore: number;
	cutoffTime: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface DeliverySchedulePaginatedResponse {
	query: DeliverySchedule[];
	pagination: Pagination;
}

export interface CreateDeliveryScheduleInput {
	regionId: string;
	dayOfWeek: number;
	cutoffDaysBefore: number;
	cutoffTime: string;
	isActive?: boolean;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateDeliveryScheduleInput {
	dayOfWeek?: number;
	cutoffDaysBefore?: number;
	cutoffTime?: string;
	isActive?: boolean;
	updatedBy: string;
}

export interface Outlet {
	outletId: string;
	outletName: string;
	outletCode: string;
	regionId: string | null;
	regionName: string | null;
	regionCode: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface OutletPaginatedResponse {
	query: Outlet[];
	pagination: Pagination;
}

export interface CreateOutletInput {
	outletName: string;
	outletCode: string;
	regionId?: string | null;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateOutletInput {
	outletName?: string;
	outletCode?: string;
	regionId?: string | null;
	updatedBy: string;
}

export interface StockUnit {
	stockUnitId: string;
	unitName: string;
	unitCode: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface StockUnitPaginatedResponse {
	query: StockUnit[];
	pagination: Pagination;
}

export interface CreateStockUnitInput {
	unitName: string;
	unitCode: string;
	isActive?: boolean;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateStockUnitInput {
	unitName?: string;
	unitCode?: string;
	isActive?: boolean;
	updatedBy: string;
}

export interface Rack {
	rackId: string;
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface RackPaginatedResponse {
	query: Rack[];
	pagination: Pagination;
}

export interface CreateRackInput {
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateRackInput {
	rackRow?: string;
	rackColumn?: string;
	rackLevel?: string;
	updatedBy: string;
}

export interface Warehouse {
	warehouseId: string;
	warehouseName: string;
	warehouseCode?: string | null;
	warehouseAddress?: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface WarehousePaginatedResponse {
	query: Warehouse[];
	pagination: Pagination;
}

export interface CreateWarehouseInput {
	warehouseName: string;
	warehouseCode?: string | null;
	warehouseAddress?: string | null;
}

export interface UpdateWarehouseInput {
	warehouseName?: string | null;
	warehouseCode?: string | null;
	warehouseAddress?: string | null;
}

export interface SkuSupplier {
	supplierId: string;
	originalSkuCode: string | null;
}

export interface Skus {
	skuId: string;
	skuCode: string;
	skuDescription: string;
	skuPrice: number;
	skuQuantity: number;
	lossQuantity: number;
	skuExpiryDate: string;
	skuSuppliers: SkuSupplier[];
	skuUom: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface createSkusInput {
	skuCode: string;
	skuDescription: string;
	skuPrice: number;
	skuQuantity: number;
	skuExpiryDate: string;
	skuSuppliers: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	skuUom: string;
	isActive?: boolean;
}

export interface UpdateSkusInput {
	skuCode?: string;
	skuDescription?: string;
	skuPrice?: number;
	skuQuantity?: number;
	lossQuantity?: number;
	skuExpiryDate?: string;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	skuUom?: string;
	isActive?: boolean;
}

export interface SkusPaginatedResponse {
	query: Skus[];
	pagination: Pagination;
}

/** User info for GRN audit fields (createdByUser / updatedByUser). */
export interface GrnAuditUser {
	id: string;
	displayName: string;
}

/** Warehouse at GRN root level */
export interface GrnWarehouse {
	warehouseId: string;
	warehouseName: string;
	warehouseCode: string | null;
	warehouseAddress: string | null;
	updatedBy: string | null;
}

/** Rack on a GRN line item */
export interface GrnRack {
	rackId: string;
	rackLevel: number | string;
	rackRow: string;
	rackColumn: string;
}

export interface Grn {
	id: string;
	grnNo: string;
	supplierId: string;
	supplierDeliveryId: string | null;
	supplierDeliveryNo: string | null;
	poNo: string | null;
	status: string;
	receivedAt: string | null;
	approvedBy: string | null;
	approvedAt: string | null;
	notes: string | null;
	proofUrl: string | null;
	createdAt: string;
	updatedAt: string;
	createdByUser: GrnAuditUser | null;
	updatedByUser: GrnAuditUser | null;
	items: GrnItem[];
	warehouse: GrnWarehouse | null;
}

export interface GrnItem {
	id: string;
	grnId: string;
	skuId: string;
	skuCode: string | null;
	skuDescription: string | null;
	/** Quantity in cartons */
	qty: string;
	/** Quantity lost */
	lossQty?: string | null;
	remarks: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
	/** Rack location for this line (replaces warehouse on item when backend uses rack) */
	rack: GrnRack | null;
	/** Legacy: some backends still return warehouse on item */
	warehouseId?: string | null;
	warehouseName?: string | null;
	warehouseAddress?: string | null;
}
export interface CreateGrnItemInput {
	skuId?: string | null;
	qty: string;
	lossQty?: string | null;
	remarks?: string | null;
	/** @deprecated Prefer rackIds. Single rack for legacy backends. */
	rackId?: string | null;
	/** Rack IDs for this line item (backend accepts string[]). */
	rackIds?: string[] | null;
	/** Expiry date (ISO date string YYYY-MM-DD). */
	expiryDate?: string | null;
	skuCode?: string | null;
	skuDescription?: string | null;
	skuUom?: string | null;
}

export interface CreateGrnInput {
	grnNo: string;
	supplierId?: string | null;
	supplierDeliveryId?: string | null;
	supplierDeliveryNo?: string | null;
	poNo?: string | null;
	receivedAt?: string | null;
	notes?: string | null;
	proofUrl?: string | null;
	warehouseId?: string | null;
	status?: string | null;
	createdBy?: string | null;
	updatedBy?: string | null;
	items?: CreateGrnItemInput[] | null;
}

export interface GrnFilterInput {
	id?: string | null;
	grnNo?: string | null;
	/** Search across GRN number, PO reference, and Supplier DO. */
	search?: string | null;
	status?: string | null;
	page?: number | null;
	pageSize?: number | null;
	pageNumber?: number | null;
	/** Sort field: GRN_NO, UPDATED_AT, CREATED_AT, STATUS, RECEIVED_AT */
	sortBy?: string | null;
	/** Sort direction: ASC or DESC */
	sortOrder?: string | null;
}

export interface GrnPaginatedResponse {
	query: Grn[];
	pagination: Pagination;
}

export interface UpdateGrnInput {
	grnNo?: string | null;
	supplierId?: string | null;
	supplierDeliveryId?: string | null;
	supplierDeliveryNo?: string | null;
	poNo?: string | null;
	receivedAt?: string | null;
	notes?: string | null;
	proofUrl?: string | null;
	warehouseId?: string | null;
	status?: string | null;
	approvedBy?: string | null;
	approvedAt?: string | null;
	updatedBy?: string | null;
	items?: CreateGrnItemInput[] | null;
}

// ---------------------------------------------------------------------------
// GRN list UI types (used by mapGrnsQueryToResult; no dependency on mock data)
// ---------------------------------------------------------------------------

export type GrnStatusUI =
	| "Draft"
	| "Submitted"
	| "Approved"
	| "Sent-to-ES"
	| "Failed";

export interface GrnItemForList {
	id: string;
	sku: string;
	skuCode: string;
	skuDescription: string;
	/** Quantity in cartons */
	expectedQuantity: number;
	/** Quantity lost */
	lossQuantity: number;
	receivedQuantity: number;
	/** Display: warehouse name or rack (e.g. "A-01-2") */
	location?: string;
	rack?: {
		rackId: string;
		rackLevel: number | string;
		rackRow: string;
		rackColumn: string;
	} | null;
}

/** GRN list row – uses same field names as API (grnNo, poNo, receivedAt, etc.) to avoid confusion. */
export interface GrnDetailForList {
	id: string;
	grnNo: string;
	supplierId: string;
	supplierDeliveryId: string | null;
	supplierDeliveryNo: string | null;
	poNo: string | null;
	warehouseId: string | null;
	warehouse?: GrnWarehouse | null;
	status: GrnStatusUI;
	receivedAt: string | null;
	createdAt: string;
	createdBy: string;
	updatedBy: string | null;
	notes?: string;
	proofUrl?: string | null;
	items: GrnItemForList[];
	totalItems: number;
	receivedItems: number;
	totalAmount: number;
}

export interface GrnListResult {
	items: GrnDetailForList[];
	summary: { byStatus: Record<GrnStatusUI, number>; total: number };
	page: number;
	pageSize: number;
	total: number;
}

// ---------------------------------------------------------------------------
// Delivery Orders (Outbound)
// ---------------------------------------------------------------------------

export interface DeliveryOrder {
	id: string;
	doNo: string;
	poNo: string;
	status: string;
	isEmergency: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
}

export interface DeliveryOrderPaginatedResponse {
	query: DeliveryOrder[];
	pagination: Pagination;
}

export interface DeliveryOrderFilterInput {
	id?: string | null;
	doNo?: string | null;
	toId?: string | null;
	status?: string | null;
	isEmergency?: boolean | null;
	createdBy?: string | null;
	createdAtFrom?: string | null;
	createdAtTo?: string | null;
	page?: number | null;
	pageSize?: number | null;
	pageNumber?: number | null;
}

export interface CreateDeliveryOrderItemInputGql {
	skuId?: string | null;
	skuCode?: string | null;
	qtyRequired: number | string;
}

export interface CreateDeliveryOrderInputGql {
	purchaseOrderNo: string;
	deliveryOrderNo: string;
	outletId: string;
	orderCreatedAt?: string | null;
	items: CreateDeliveryOrderItemInputGql[];
}

// ---------------------------------------------------------------------------
// Delivery Order Items (Work Queue)
// ---------------------------------------------------------------------------

export interface DeliveryOrderItemWithDetails {
	id: string;
	purchaseOrderId: string;
	purchaseOrderNo: string;
	skuId: string;
	qtyRequired: string;
	qtyPicked: string | null;
	qtyPacked: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
	skuCode: string | null;
	skuDescription: string | null;
	doNo: string | null;
	doStatus: string | null;
	onHandQty: string | null;
	lossQty: string | null;
	reservedQty: string | null;
}

export interface DeliveryOrderItemWithDetailsPaginatedResponse {
	query: DeliveryOrderItemWithDetails[];
	pagination: Pagination;
}

export interface DeliveryOrderItemFilterInput {
	id?: string | null;
	purchaseOrderNo?: string | null;
	doNo?: string | null;
	doStatus?: string | null;
	search?: string | null;
}

// ---------------------------------------------------------------------------
// Purchase Orders (Transfer Orders / TOs from NetSuite)
// ---------------------------------------------------------------------------

export interface PurchaseOrderOutlet {
	outletId: string;
	outletName: string;
	outletCode: string;
	regionId: string | null;
	regionName: string | null;
	regionCode: string | null;
	region?: PurchaseOrderRegion | null;
}

export interface PurchaseOrderRegion {
	regionId: string;
	regionName: string;
	regionCode: string;
}

export interface PurchaseOrder {
	id: string;
	purchaseOrderNo: string;
	outlet?: PurchaseOrderOutlet | null;
	deliveryOrder?: DeliveryOrder | null;
	status: string;
	scheduledDeliveryDate?: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy?: string | null;
	updatedBy?: string | null;
}

export interface PurchaseOrderPaginatedResponse {
	query: PurchaseOrder[];
	pagination: Pagination;
}

export interface PurchaseOrderFilterInput {
	id?: string | string[] | null;
	purchaseOrderNo?: string | null;
	outletId?: string | string[] | null;
	status?: string | string[] | null;
	requestedDeliveryDateFrom?: string | null;
	requestedDeliveryDateTo?: string | null;
	scheduledDeliveryDateFrom?: string | null;
	scheduledDeliveryDateTo?: string | null;
	createdAtFrom?: string | null;
	createdAtTo?: string | null;
	page?: number | null;
	pageSize?: number | null;
	pageNumber?: number | null;
}
