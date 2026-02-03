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