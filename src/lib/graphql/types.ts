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
	skuExpiryDate?: string;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	skuUom?: string;
	isActive?: boolean;
}

export interface SkusPaginatedResponse {
	query: Skus[];
	pagination: Pagination;
}

export interface Grn {
	id: string;
	grnNo: string;
	supplierId: string;
	supplierDeliveryId: string | null;
	poNo: string | null;
	status: string;
	receivedAt: string | null;
	approvedBy: string | null;
	approvedAt: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
	items: GrnItem[];
}
export interface GrnItem {
	id: string;
	grnId: string;
	skuId: string;
	skuCode: string;
	skuDescription: string;
	qty: string;
	remarks: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
}
export interface CreateGrnItemInput {
	skuId?: string | null;
	qty: string;
	remarks?: string | null;
	skuCode?: string | null;
	skuDescription?: string | null;
	skuUom?: string | null;
}

export interface CreateGrnInput {
	grnNo: string;
	supplierId: string;
	supplierDeliveryId?: string | null;
	poNo?: string | null;
	receivedAt?: string | null;
	/** Initial status: Draft or Submitted (if omitted backend may default) */
	status?: string | null;
	createdBy?: string | null;
	updatedBy?: string | null;
	items?: CreateGrnItemInput[] | null;
}

export interface GrnFilterInput {
	id?: string | null;
	grnNo?: string | null;
	status?: string | null;
}

export interface GrnPaginatedResponse {
	query: Grn[];
	pagination: Pagination;
}

export interface UpdateGrnInput {
	grnNo?: string | null;
	supplierId?: string | null;
	supplierDeliveryId?: string | null;
	poNo?: string | null;
	status?: string | null;
	receivedAt?: string | null;
	approvedBy?: string | null;
	approvedAt?: string | null;
	updatedBy?: string | null;
	notes?: string | null;
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
	expectedQuantity: number;
	receivedQuantity: number;
	location?: string;
}

/** GRN list row – uses same field names as API (grnNo, poNo, receivedAt, etc.) to avoid confusion. */
export interface GrnDetailForList {
	id: string;
	grnNo: string;
	supplierId: string;
	supplierDeliveryId: string | null;
	poNo: string | null;
	status: GrnStatusUI;
	receivedAt: string | null;
	createdAt: string;
	createdBy: string;
	updatedBy: string | null;
	notes?: string;
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