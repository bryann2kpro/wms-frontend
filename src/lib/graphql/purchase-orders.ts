import { gql } from "graphql-request";
import type {
	PurchaseOrder,
	PurchaseOrderPaginatedResponse,
	PurchaseOrderFilterInput,
	Pagination,
} from "./types";
import type {
	PurchaseOrderDetail,
	PurchaseOrderListResult,
	PurchaseOrderStatus,
} from "@/data/purchase-orders.types";

// ---------------------------------------------------------------------------
// Fragment (basic fields without nested outlet)
// ---------------------------------------------------------------------------

export const PURCHASE_ORDER_FRAGMENT = gql`
	fragment PurchaseOrderFields on PurchaseOrder {
		id
		purchaseOrderNo
		status
		scheduledDeliveryDate
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

// ---------------------------------------------------------------------------
// Fragment with nested outlet and region (for list views)
// ---------------------------------------------------------------------------

export const PURCHASE_ORDER_WITH_OUTLET_FRAGMENT = gql`
	fragment PurchaseOrderWithOutletFields on PurchaseOrder {
		id
		purchaseOrderNo
		outlet {
			outletId
			outletName
			outletCode
			region {
				regionId
				regionName
				regionCode
			}
		}
		status
		scheduledDeliveryDate
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

// ---------------------------------------------------------------------------
// Query (basic - without nested outlet)
// ---------------------------------------------------------------------------

export const PURCHASE_ORDERS_QUERY = gql`
	query PurchaseOrders(
		$filter: PurchaseOrderFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		purchaseOrders(
			filter: $filter
			pageSize: $pageSize
			pageNumber: $pageNumber
		) {
			query {
				...PurchaseOrderFields
			}
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
		}
	}
	${PURCHASE_ORDER_FRAGMENT}
`;

// ---------------------------------------------------------------------------
// Query with nested outlet and region (for list views - avoids N+1 via DataLoader)
// ---------------------------------------------------------------------------

export const PURCHASE_ORDERS_WITH_OUTLET_QUERY = gql`
	query PurchaseOrdersWithOutlet(
		$filter: PurchaseOrderFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		purchaseOrders(
			filter: $filter
			pageSize: $pageSize
			pageNumber: $pageNumber
		) {
			query {
				...PurchaseOrderWithOutletFields
			}
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
		}
	}
	${PURCHASE_ORDER_WITH_OUTLET_FRAGMENT}
`;

export type PurchaseOrdersQueryVariables = {
	filter?: PurchaseOrderFilterInput | null;
	pageSize?: number | null;
	pageNumber?: number | null;
};

export type PurchaseOrdersQueryData = {
	purchaseOrders: PurchaseOrderPaginatedResponse;
};

// ---------------------------------------------------------------------------
// Purchase orders by week (grouped by scheduled delivery date, UTC)
// ---------------------------------------------------------------------------

export type PurchaseOrderWeekFilterInput = {
	scheduledDeliveryDateFrom?: string | null;
	scheduledDeliveryDateTo?: string | null;
	outletId?: string | null;
	status?: string | null;
};

export interface PurchaseOrdersByDateEntry {
	date: string;
	orders: PurchaseOrder[];
}

export const PURCHASE_ORDERS_BY_WEEK_QUERY = gql`
	query PurchaseOrdersByWeek($filter: PurchaseOrderWeekFilterInput) {
		purchaseOrdersByWeek(filter: $filter) {
			date
			orders {
				...PurchaseOrderWithOutletFields
			}
		}
	}
	${PURCHASE_ORDER_WITH_OUTLET_FRAGMENT}
`;

export type PurchaseOrdersByWeekQueryVariables = {
	filter?: PurchaseOrderWeekFilterInput | null;
};

export type PurchaseOrdersByWeekQueryData = {
	purchaseOrdersByWeek: PurchaseOrdersByDateEntry[];
};

// ---------------------------------------------------------------------------
// Create Purchase Order mutation
// ---------------------------------------------------------------------------

export const CREATE_PURCHASE_ORDER_MUTATION = gql`
	mutation CreatePurchaseOrder($input: CreatePurchaseOrderInput!) {
		createPurchaseOrder(input: $input) {
			id
			purchaseOrderNo
			status
			scheduledDeliveryDate
			createdAt
			updatedAt
			createdBy
			updatedBy
		}
	}
`;

export type CreatePurchaseOrderMutationVariables = {
	input: {
		purchaseOrderNo: string;
		outletId: string;
		items: Array<{ skuCode: string; skuId?: string; qtyRequired: number }>;
	};
};

export type CreatePurchaseOrderMutationData = {
	createPurchaseOrder: PurchaseOrder;
};

// ---------------------------------------------------------------------------
// Mapping helper – GraphQL PurchaseOrder -> PurchaseOrderDetail (for UI)
// ---------------------------------------------------------------------------

const GQL_STATUS_TO_PO_STATUS: Record<string, PurchaseOrderStatus> = {
	NEW: "preparing",
	ACCEPTED: "preparing",
	REJECTED: "cancel",
	DO_CREATED: "to-ship",
	CANCELLED: "cancel",
};

export function mapGqlToPurchaseOrderDetail(po: PurchaseOrder): PurchaseOrderDetail {
	const status: PurchaseOrderStatus =
		GQL_STATUS_TO_PO_STATUS[po.status] ?? "other";

	const createdDate = new Date(po.createdAt);
	const expectedDeliveryDate = po.scheduledDeliveryDate
		? new Date(po.scheduledDeliveryDate)
		: createdDate;

	const outlet = po.outlet;
	const region = outlet?.region;

	return {
		id: po.id,
		purchaseOrderNumber: po.purchaseOrderNo,
		fromLocation: "NetSuite",
		toLocation: outlet?.outletName ?? "Unknown outlet",
		status,
		createdDate,
		expectedDeliveryDate,
		createdBy: po.createdBy ?? "System",
		notes: undefined,
		items: [],
		totalItems: 0,
		netsuiteStatus: undefined,
		regionName: region?.regionName ?? outlet?.regionName ?? null,
		regionCode: region?.regionCode ?? outlet?.regionCode ?? null,
	};
}

export function mapGqlToPurchaseOrderList(
	raw: PurchaseOrderPaginatedResponse,
): PurchaseOrderListResult {
	const pagination = raw.pagination as Pagination;

	const items: PurchaseOrderDetail[] = (raw.query ?? []).map(mapGqlToPurchaseOrderDetail);

	const byStatus: Record<PurchaseOrderStatus, number> = {
		preparing: 0,
		"in-transit": 0,
		"to-ship": 0,
		cancel: 0,
		return: 0,
		other: 0,
	};

	for (const po of items) {
		byStatus[po.status] = (byStatus[po.status] ?? 0) + 1;
	}

	return {
		items,
		summary: {
			byStatus,
			total: items.length,
		},
		page: pagination?.currentPage ?? 1,
		pageSize: pagination?.count ?? items.length,
		total: pagination?.totalCount ?? items.length,
	};
}
