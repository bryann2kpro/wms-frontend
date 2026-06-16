import { gql } from "graphql-request";
import type {
	PurchaseOrderDetail,
	PurchaseOrderListResult,
	PurchaseOrderStatus,
} from "@/data/purchase-orders.types";
import type {
	Pagination,
	PurchaseOrder,
	PurchaseOrderFilterInput,
	PurchaseOrderPaginatedResponse,
} from "./types";

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
		deliveryOrder {
			id
			doNo
			status
		}
		status
		scheduledDeliveryDate
		createdAt
		updatedAt
		createdBy
		updatedBy
		createdByUser {
			id
			displayName
			email
		}
		updatedByUser {
			id
			displayName
			email
		}
		items {
			id
			skuCode
			skuDescription
			qtyRequired
		}
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
		items: Array<{
			skuCode: string;
			skuId?: string;
			qtyRequired: number;
			stockQuantId?: string;
		}>;
		isEmergency?: boolean;
	};
};

export type CreatePurchaseOrderMutationData = {
	createPurchaseOrder: PurchaseOrder;
};

// ---------------------------------------------------------------------------
// Apply Emergency Delivery mutation
// ---------------------------------------------------------------------------

export const APPLY_EMERGENCY_DELIVERY_MUTATION = gql`
	mutation ApplyEmergencyDelivery($id: ID!) {
		applyEmergencyDelivery(id: $id) {
			id
			scheduledDeliveryDate
			status
		}
	}
`;

export type ApplyEmergencyDeliveryMutationVariables = { id: string };
export type ApplyEmergencyDeliveryMutationData = {
	applyEmergencyDelivery: Pick<
		PurchaseOrder,
		"id" | "scheduledDeliveryDate" | "status"
	>;
};

// ---------------------------------------------------------------------------
// Update Purchase Order mutation
// ---------------------------------------------------------------------------

export const UPDATE_PURCHASE_ORDER_MUTATION = gql`
	mutation UpdatePurchaseOrder($id: ID!, $input: UpdatePurchaseOrderInput!) {
		updatePurchaseOrder(id: $id, input: $input) {
			...PurchaseOrderWithOutletFields
		}
	}
	${PURCHASE_ORDER_WITH_OUTLET_FRAGMENT}
`;

export type UpdatePurchaseOrderMutationVariables = {
	id: string;
	input: {
		scheduledDeliveryDate?: string;
		outletId?: string;
		items?: Array<{ id: string; qtyRequired: number }>;
		newItems?: Array<{ skuId: string; skuCode: string; qtyRequired: number }>;
		removedItemIds?: string[];
	};
};

export type UpdatePurchaseOrderMutationData = {
	updatePurchaseOrder: PurchaseOrder;
};

// ---------------------------------------------------------------------------
// Mapping helper – GraphQL PurchaseOrder -> PurchaseOrderDetail (for UI)
// ---------------------------------------------------------------------------

const GQL_STATUS_TO_PO_STATUS: Record<string, PurchaseOrderStatus> = {
	NEW: "preparing",
	ACCEPTED: "preparing",
	REJECTED: "cancel",
	DO_CREATED: "to-ship",
	SHIPPED: "in-transit",
	CANCELLED: "cancel",
};

const DO_STEP_STATUSES = ["NEW", "PACKING", "SHIPPED", "DELIVERED"] as const;

export function mapGqlToPurchaseOrderDetail(
	po: PurchaseOrder,
): PurchaseOrderDetail {
	const status: PurchaseOrderStatus =
		GQL_STATUS_TO_PO_STATUS[po.status] ?? "other";

	const createdDate = new Date(po.createdAt);
	const expectedDeliveryDate = po.scheduledDeliveryDate
		? new Date(po.scheduledDeliveryDate)
		: createdDate;

	const outlet = po.outlet;
	const region = outlet?.region;

	const rawDoStatus = po.deliveryOrder?.status;
	const doStepStatus =
		rawDoStatus === "CREATED"
			? "NEW"
			: DO_STEP_STATUSES.includes(
						rawDoStatus as (typeof DO_STEP_STATUSES)[number],
					)
				? (rawDoStatus as "NEW" | "PACKING" | "SHIPPED" | "DELIVERED")
				: "NEW";
	const deliveryOrderStep =
		po.deliveryOrder?.id && rawDoStatus != null
			? {
					id: po.deliveryOrder.id,
					doNo: po.deliveryOrder.doNo,
					status: doStepStatus,
				}
			: null;

	return {
		id: po.id,
		purchaseOrderNumber: po.purchaseOrderNo,
		fromLocation: "NetSuite",
		toLocation: outlet?.outletName ?? "Unknown outlet",
		outletId: outlet?.outletId ?? undefined,
		status,
		createdDate,
		expectedDeliveryDate,
		createdBy: po.createdByUser?.displayName ?? po.createdBy ?? "System",
		items: (po.items ?? []).map((item) => ({
			id: item.id,
			sku: item.skuCode,
			description: item.skuDescription,
			quantity: Number(item.qtyRequired),
			pickedQuantity: 0,
			packedQuantity: 0,
		})),
		totalItems: po.items?.length ?? 0,
		netsuiteStatus: undefined,
		regionName: region?.regionName ?? outlet?.regionName ?? null,
		regionCode: region?.regionCode ?? outlet?.regionCode ?? null,
		deliveryOrder: deliveryOrderStep ?? undefined,
	};
}

/**
 * `pagination.count` is rows on the current page, not page size — pass `requestedPageSize`
 * from the query variables (same pattern as `mapGrnsQueryToResult`).
 */
export function mapGqlToPurchaseOrderList(
	raw: PurchaseOrderPaginatedResponse,
	options?: { requestedPageSize?: number },
): PurchaseOrderListResult {
	const pagination = raw.pagination as Pagination;

	const items: PurchaseOrderDetail[] = (raw.query ?? []).map(
		mapGqlToPurchaseOrderDetail,
	);

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

	const requestedPageSize = options?.requestedPageSize ?? 10;
	const serverTotalPages = pagination?.totalPages ?? 1;
	const totalCount = pagination?.totalCount ?? items.length;

	return {
		items,
		summary: {
			byStatus,
			total: totalCount,
		},
		page: pagination?.currentPage ?? 1,
		pageSize: requestedPageSize,
		total: totalCount,
		totalPages: Math.max(1, serverTotalPages),
	};
}
