/**
 * GraphQL types for master data (Supplier, Region).
 * Aligned with backend schema at /graphql.
 */

export interface EndUser {
	endUserId: string;
	userName: string;
}

export interface EndUserPaginatedResponse {
	query: EndUser[];
	pagination: Pagination;
}

export interface CreateEndUserInput {
	userName: string;
}

export interface UpdateEndUserInput {
	userName: string;
}

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

export interface RegionPricing {
	id: string;
	regionId: string;
	/** Delivery rate per CTN as a numeric string, e.g. "12.50" */
	rate: string;
	/** Minimum qty threshold as a numeric string, e.g. "5" */
	minQty: string;
	/** SST rate as a decimal string, e.g. "0.0600" */
	sstRate: string;
	isActive: boolean;
	updatedAt: string;
}

export interface Region {
	regionId: string;
	regionName: string;
	regionCode: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
	pricing?: RegionPricing | null;
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

export interface UpsertRegionPricingInput {
	rate: number;
	minQty?: number;
	sstRate?: number;
	isActive?: boolean;
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
	address: string | null;
	chain: string | null;
	channel: string | null;
	debtor: string | null;
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
	address?: string;
	regionId?: string | null;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateOutletInput {
	outletName?: string;
	outletCode?: string;
	address?: string;
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
	warehouseId?: string | null;
	zoneId?: string | null;
	areaId?: string | null;
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
	binCode?: string | null;
	barCode?: string | null;
	binType: string;
	length?: string | null;
	width?: string | null;
	height?: string | null;
	weight?: string | null;
	maxPallet?: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface RackPaginatedResponse {
	query: Rack[];
	pagination: Pagination;
}

export interface RackUtilization {
	rackId: string;
	volCapacity: number | null;
	volCurrent: number;
	weightCapacity: number | null;
	weightCurrent: number;
	cartonCount: number;
}

export interface CreateRackInput {
	warehouseId?: string | null;
	zoneId?: string | null;
	areaId?: string | null;
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
	binCode?: string | null;
	barCode?: string | null;
	binType?: string;
	length?: string | null;
	width?: string | null;
	height?: string | null;
	weight?: string | null;
	maxPallet?: string | null;
	isActive?: boolean;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateRackInput {
	warehouseId?: string | null;
	zoneId?: string | null;
	areaId?: string | null;
	rackRow?: string;
	rackColumn?: string;
	rackLevel?: string;
	binCode?: string | null;
	barCode?: string | null;
	binType?: string;
	length?: string | null;
	width?: string | null;
	height?: string | null;
	weight?: string | null;
	maxPallet?: string | null;
	isActive?: boolean;
	updatedBy: string;
}

export interface Area {
	areaId: string;
	areaCode: string;
	areaName: string;
	areaDescription?: string | null;
	warehouseName?: string | null;
}

export interface AreaPaginatedResponse {
	query: Area[];
	pagination: Pagination;
}

export interface Transport {
	id: string;
	code: string;
	description?: string | null;
	storageBinId?: string | null;
	location?: string | null;
	minLengthMm?: string | null;
	minWidthMm?: string | null;
	minHeightMm?: string | null;
	minWeightKg?: string | null;
	maxLengthMm?: string | null;
	maxWidthMm?: string | null;
	maxHeightMm?: string | null;
	maxWeightKg?: string | null;
	numberOfPallets?: number | null;
	/** Resolved from code tonnage label, e.g. 3T for "WTH4155 (3 TON)". */
	capacityClass?: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface TransportPaginatedResponse {
	query: Transport[];
	pagination: Pagination;
}

export interface CreateTransportInput {
	code: string;
	description?: string;
	storageBinId?: string;
	location?: string;
	minLengthMm?: string;
	minWidthMm?: string;
	minHeightMm?: string;
	minWeightKg?: string;
	maxLengthMm?: string;
	maxWidthMm?: string;
	maxHeightMm?: string;
	maxWeightKg?: string;
	numberOfPallets?: number;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateTransportInput {
	code?: string;
	description?: string;
	storageBinId?: string;
	location?: string;
	minLengthMm?: string;
	minWidthMm?: string;
	minHeightMm?: string;
	minWeightKg?: string;
	maxLengthMm?: string;
	maxWidthMm?: string;
	maxHeightMm?: string;
	maxWeightKg?: string;
	numberOfPallets?: number;
	updatedBy: string;
}

export interface SetupArea {
	id: string;
	code: string;
	description: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface SetupAreaPaginatedResponse {
	query: SetupArea[];
	pagination: Pagination;
}

export interface CreateSetupAreaInput {
	code: string;
	description: string;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateSetupAreaInput {
	code?: string;
	description?: string;
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
	skuExpiryDate: string;
	skuSuppliers: SkuSupplier[];
	skuUom: string;
	pickingStrategy: string;
	isLotControlled: boolean;
	isExpiryControlled: boolean;
	looseQuantity?: number | null;
	barcode?: string | null;
	brand?: string | null;
	category?: string | null;
	manufacturer?: string | null;
	caseRate?: number | null;
	caseExtLengthMm?: number | null;
	caseExtWidthMm?: number | null;
	caseExtHeightMm?: number | null;
	caseGrossWeightKg?: number | null;
	casesPerLayer?: number | null;
	noOfLayers?: number | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface createSkusInput {
	skuCode: string;
	skuDescription: string;
	skuExpiryDate: string;
	skuSuppliers: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	skuUom: string;
	pickingStrategy?: string;
	isLotControlled?: boolean;
	isExpiryControlled?: boolean;
	looseQuantity?: number | null;
	isActive?: boolean;
	barcode?: string | null;
	brand?: string | null;
	category?: string | null;
	manufacturer?: string | null;
	caseRate?: number | null;
	caseExtLengthMm?: number | null;
	caseExtWidthMm?: number | null;
	caseExtHeightMm?: number | null;
	caseGrossWeightKg?: number | null;
	casesPerLayer?: number | null;
	noOfLayers?: number | null;
	initialOnHandQty?: number;
}

export interface UpdateSkusInput {
	skuCode?: string;
	skuDescription?: string;
	skuExpiryDate?: string;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	skuUom?: string;
	pickingStrategy?: string;
	isLotControlled?: boolean;
	isExpiryControlled?: boolean;
	looseQuantity?: number | null;
	isActive?: boolean;
	barcode?: string | null;
	brand?: string | null;
	category?: string | null;
	manufacturer?: string | null;
	caseRate?: number | null;
	caseExtLengthMm?: number | null;
	caseExtWidthMm?: number | null;
	caseExtHeightMm?: number | null;
	caseGrossWeightKg?: number | null;
	casesPerLayer?: number | null;
	noOfLayers?: number | null;
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
	/** NetSuite error message when status is Failed (incl. our PO-not-fully-fulfilled block message). */
	nsError?: string | null;
	endUserId?: string | null;
	/** null = nothing to enforce (no linked ASN, or not Approved yet). Gates the "Send to ES" action. */
	poFulfilled?: boolean | null;
	/** True when Send to ES must be hidden — no real ES ASN for this End User PO. */
	manualInbound?: boolean;
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
	/** Loose/loss rack for this item (single rack — legacy/fallback for lossRackAllocations). */
	lossRackId?: string | null;
	/** Per-rack carton allocations for this GRN item. */
	rackAllocations?: Array<{
		rackId: string;
		quantity: number;
		rackLabel?: string | null;
	}> | null;
	/** Per-rack loose/loss allocations for this GRN item's lossQty. */
	lossRackAllocations?: Array<{
		rackId: string;
		quantity: number;
		rackLabel?: string | null;
	}> | null;
	/** Optional expiry date for this GRN item (ISO string from backend). */
	expiryDate?: string | null;
	/** Lot number assigned by supplier/manufacturer to identify this production batch. */
	lotNo?: string | null;
	/** Legacy: some backends still return warehouse on item */
	warehouseId?: string | null;
	warehouseName?: string | null;
	warehouseAddress?: string | null;
}
export interface CreateGrnItemInput {
	skuId?: string | null;
	qty: string;
	lossQty?: string | null;
	orderedQty?: string | null;
	remarks?: string | null;
	/** @deprecated Prefer rackIds. Single rack for legacy backends. */
	rackId?: string | null;
	/** Rack IDs for this line item (backend accepts string[]). */
	rackIds?: string[] | null;
	/** Per-rack carton allocations (preferred over rackIds when splitting putaway). */
	rackAllocations?: Array<{ rackId: string; quantity: number }> | null;
	/** Loose/loss rack for this item (single rack — legacy/fallback). */
	lossRackId?: string | null;
	/** Per-rack loose/loss allocations (preferred over lossRackId when splitting loose storage). */
	lossRackAllocations?: Array<{ rackId: string; quantity: number }> | null;
	/** Expiry date (ISO date string YYYY-MM-DD). */
	expiryDate?: string | null;
	/** Lot number assigned by supplier/manufacturer. */
	lotNo?: string | null;
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

export interface CreateInboundInput {
	userId: string;
	grnNo: string;
	supplierId?: string | null;
	supplierDeliveryId?: string | null;
	supplierDeliveryNo?: string | null;
	poNo?: string | null;
	receivedAt?: string | null;
	notes?: string | null;
	proofUrl?: string | null;
	warehouseId?: string | null;
	endUserId?: string | null;
	status?: string | null;
	items?: CreateGrnItemInput[] | null;
	inboundQty?: number | null;
	skuId?: string | null;
	poFulfilled?: boolean | null;
	advanceNoticeId?: string | null;
}

export interface GrnFilterInput {
	id?: string | null;
	grnNo?: string | null;
	/** Search across GRN number, PO reference, and Supplier DO. */
	search?: string | null;
	/** When true and status is not set, omit draft GRNs from results. */
	excludeDraft?: boolean | null;
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
	/** Optional expiry date (ISO string or YYYY-MM-DD). */
	expiryDate?: string | null;
	/** Lot number assigned by supplier/manufacturer. */
	lotNo?: string | null;
	rack?: {
		rackId: string;
		rackLevel: number | string;
		rackRow: string;
		rackColumn: string;
	} | null;
	/** Loose/loss rack for this item (single rack — legacy/fallback for lossRackAllocations). */
	lossRackId?: string | null;
	/** Per-rack carton allocations (populated when multiple racks are used). */
	rackAllocations?: Array<{
		rackId: string;
		quantity: number;
		rackLabel?: string | null;
	}> | null;
	/** Per-rack loose/loss allocations (populated when loss qty is split across racks). */
	lossRackAllocations?: Array<{
		rackId: string;
		quantity: number;
		rackLabel?: string | null;
	}> | null;
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
	/** NetSuite error message when status is Failed (incl. our PO-not-fully-fulfilled block message). */
	nsError?: string | null;
	/** null = nothing to enforce (no linked ASN, or not Approved yet). Gates the "Send to ES" action. */
	poFulfilled?: boolean | null;
	/** True when Send to ES must be hidden — no real ES ASN for this End User PO. */
	manualInbound?: boolean;
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
	/** Total pages from server pagination metadata (preferred over computing from total/pageSize). */
	totalPages: number;
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

export interface DoItemAllocation {
	id: string;
	doItemId: string;
	grnItemId: string;
	grnNo: string | null;
	rackId: string | null;
	/** Rack location display (e.g. row-column-level) */
	rackName: string | null;
	expiryDate: string | null;
	/** Lot number from the GRN item, null if not recorded. */
	lotNo: string | null;
	qtyAllocated: string;
	priorityFlag: boolean;
}

export interface DeliveryOrderItemWithDetails {
	id: string;
	purchaseOrderId: string;
	purchaseOrderNo: string;
	skuId: string;
	qtyRequired: string;
	qtyPicked: string | null;
	qtyPacked: string | null;
	/** Lot / batch number on the DO line (prefills return capture). */
	lotNo: string | null;
	/** Expiry date of the DO line lot (ISO 8601), prefills return capture. */
	expiryDate: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
	skuCode: string | null;
	skuDescription: string | null;
	doId: string | null;
	doNo: string | null;
	doStatus: string | null;
	onHandQty: string | null;
	lossQty: string | null;
	reservedQty: string | null;
	allocations: DoItemAllocation[];
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
	doStatuses?: string[] | null;
	search?: string | null;
	regionId?: string | null;
	regionIds?: string[] | null;
	scheduledDeliveryDateFrom?: string | null;
	scheduledDeliveryDateTo?: string | null;
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
	createdByUser?: { id: string; displayName: string; email: string } | null;
	updatedByUser?: { id: string; displayName: string; email: string } | null;
	items?: Array<{
		id: string;
		skuCode: string;
		skuDescription: string;
		qtyRequired: string;
	}> | null;
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

// ============================================
// ZONES
// ============================================

export type ZonePurpose = "GENERAL" | "WET" | "DRY" | "AMBIENT" | "DAMAGED";

export interface Zone {
	zoneId: string;
	warehouseId: string;
	zoneCode: string;
	zoneName: string;
	purpose: ZonePurpose;
	warehouseName?: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface ZonePaginatedResponse {
	query: Zone[];
	pagination: Pagination;
}

export interface CreateZoneInput {
	warehouseId: string;
	zoneCode: string;
	zoneName: string;
	purpose?: ZonePurpose;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateZoneInput {
	zoneCode?: string;
	zoneName?: string;
	purpose?: ZonePurpose;
	updatedBy: string;
}

// ============================================
// BINS
// ============================================

export interface Bin {
	binId: string;
	rackId: string;
	binCode: string;
	level: string;
	column: string;
	capacityVolume: number | null;
	capacityWeight: number | null;
	currentVolume: number;
	currentWeight: number;
	isPickFace: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface BinPaginatedResponse {
	query: Bin[];
	pagination: Pagination;
}

export interface CreateBinInput {
	rackId: string;
	binCode: string;
	level: string;
	column: string;
	capacityVolume?: number | null;
	capacityWeight?: number | null;
	isPickFace?: boolean;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateBinInput {
	binCode?: string;
	level?: string;
	column?: string;
	capacityVolume?: number | null;
	capacityWeight?: number | null;
	isPickFace?: boolean;
	updatedBy: string;
}

// ============================================
// PUTAWAY RULES
// ============================================

export interface PutawayRule {
	putawayRuleId: string;
	warehouseId: string;
	itemAttributeKey: string;
	itemAttributeValue: string;
	targetZonePurpose: string;
	priority: number;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface PutawayRulePaginatedResponse {
	query: PutawayRule[];
	pagination: Pagination;
}

export interface CreatePutawayRuleInput {
	warehouseId: string;
	itemAttributeKey: string;
	itemAttributeValue: string;
	targetZonePurpose: string;
	priority?: number;
	createdBy: string;
	updatedBy: string;
}

export interface UpdatePutawayRuleInput {
	itemAttributeKey?: string;
	itemAttributeValue?: string;
	targetZonePurpose?: string;
	priority?: number;
	updatedBy: string;
}

export interface PalletLabel {
	id: string;
	itemCode: string;
	barCode: string | null;
	referenceNo: string | null;
	storageBinId: string | null;
	storageBinCode: string | null;
	labelCode: string;
	description: string | null;
	itemDesc02: string | null;
	printedCount: number;
	firstPrintedAt: string | null;
	lastPrintedAt: string | null;
	isActive: boolean;
	isDeleted: boolean;
	deletedAt: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface PalletLabelPaginatedResponse {
	query: PalletLabel[];
	pagination: Pagination;
}

export interface CreatePalletLabelInput {
	itemCode: string;
	barCode?: string;
	referenceNo?: string;
	storageBinId?: string;
	labelCode: string;
	description?: string;
	itemDesc02?: string;
	createdBy: string;
	updatedBy: string;
}

export interface UpdatePalletLabelInput {
	itemCode?: string;
	barCode?: string;
	referenceNo?: string;
	storageBinId?: string;
	labelCode?: string;
	description?: string;
	itemDesc02?: string;
	isActive?: boolean;
	version: number;
	updatedBy: string;
}

export interface SkuAssignmentOutlet {
	outletId: string;
	outletName: string;
	outletCode: string;
	chain: string | null;
	channel: string | null;
	debtor: string | null;
}

export interface SkuAssignmentSku {
	skuId: string;
	skuCode: string;
	skuDescription: string;
	brand: string | null;
	category: string | null;
	manufacturer: string | null;
}

export interface SkuAssignment {
	id: string;
	outlet: SkuAssignmentOutlet;
	sku: SkuAssignmentSku;
	minExpiryMonth: number;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface SkuAssignmentPaginatedResponse {
	query: SkuAssignment[];
	pagination: Pagination;
}

export interface CreateSkuAssignmentInput {
	outletId: string;
	skuId: string;
	minExpiryMonth: number;
	createdBy: string;
	updatedBy: string;
}

export interface UpdateSkuAssignmentInput {
	outletId?: string;
	skuId?: string;
	minExpiryMonth?: number;
	updatedBy: string;
}

export interface PickingCriteria {
	id: string;
	userId: string;
	category: string;
	chain: string;
	channel: string;
	debtor: string;
	deliveryPoint: string;
	storageClass: string;
	brand: string;
	itemCategory: string;
	manufacturer: string;
	item: string;
	minExpiryMonth: number;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

export interface PickingCriteriaPaginatedResponse {
	query: PickingCriteria[];
	pagination: Pagination;
}

export interface CreatePickingCriteriaInput {
	userId: string;
	category: string;
	chain: string;
	channel: string;
	debtor: string;
	deliveryPoint: string;
	storageClass: string;
	brand: string;
	itemCategory: string;
	manufacturer: string;
	item: string;
	minExpiryMonth: number;
	createdBy: string;
	updatedBy: string;
}

export interface UpdatePickingCriteriaInput {
	userId?: string;
	category?: string;
	chain?: string;
	channel?: string;
	debtor?: string;
	deliveryPoint?: string;
	storageClass?: string;
	brand?: string;
	itemCategory?: string;
	manufacturer?: string;
	item?: string;
	minExpiryMonth?: number;
	updatedBy: string;
}

// ============================================
// STOCK TRANSFER (Bin to Bin / W2W)
// ============================================

export type StockTransferType = "BIN_TO_BIN" | "WAREHOUSE_TO_WAREHOUSE";

export type StockTransferStatus =
	| "DRAFT"
	| "AWAITING_DISPATCH"
	| "IN_TRANSIT"
	| "COMPLETED"
	| "CANCELLED";

export interface StockTransferItemRack {
	rackId: string;
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
}

export interface StockTransferItem {
	id: string;
	skuId: string;
	skuCode: string | null;
	skuDescription: string | null;
	lotNo: string | null;
	expiryDate: string | null;
	quantity: string;
	lossQuantity: string;
	sourceStockQuantId: string;
	sourceRackId: string;
	sourceRack: StockTransferItemRack | null;
	destinationRackId: string;
	destinationRack: StockTransferItemRack | null;
}

export interface StockTransfer {
	id: string;
	transferNo: string;
	type: StockTransferType;
	status: StockTransferStatus;
	sourceWarehouseId: string | null;
	destinationWarehouseId: string | null;
	remarks: string | null;
	dispatchedAt: string | null;
	receivedAt: string | null;
	receivedBy: string | null;
	cancelledAt: string | null;
	cancelledBy: string | null;
	cancelReason: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	createdByUser: AuditUser | null;
	items: StockTransferItem[];
}

export interface StockTransferPaginatedResponse {
	query: StockTransfer[];
	pagination: Pagination;
}
