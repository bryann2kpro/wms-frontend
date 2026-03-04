import { gql } from "@apollo/client";
import type {
	DeliveryOrder,
	DeliveryOrderPaginatedResponse,
	DeliveryOrderFilterInput,
	CreateDeliveryOrderInputGql,
	Pagination,
} from "./types";
import type {
	TransferDetail,
	TransferListResult,
	TransferStatus,
} from "@/data/transfers.types";

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

export const DELIVERY_ORDER_FRAGMENT = gql`
	fragment DeliveryOrderFields on DeliveryOrder {
		id
		doNo
		poNo
		status
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const DELIVERY_ORDERS_QUERY = gql`
	query DeliveryOrders(
		$filter: DeliveryOrderFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		deliveryOrders(
			filter: $filter
			pageSize: $pageSize
			pageNumber: $pageNumber
		) {
			query {
				...DeliveryOrderFields
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
	${DELIVERY_ORDER_FRAGMENT}
`;

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const CREATE_DELIVERY_ORDER_MUTATION = gql`
	mutation CreateDeliveryOrder($input: CreateDeliveryOrderInput!) {
		createDeliveryOrder(input: $input) {
			...DeliveryOrderFields
		}
	}
	${DELIVERY_ORDER_FRAGMENT}
`;

export const COMPLETE_DELIVERY_ORDER_MUTATION = gql`
	mutation CompleteDeliveryOrder($id: ID!) {
		completeDeliveryOrder(id: $id) {
			...DeliveryOrderFields
		}
	}
	${DELIVERY_ORDER_FRAGMENT}
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryOrdersQueryVariables = {
	filter?: DeliveryOrderFilterInput | null;
	pageSize?: number | null;
	pageNumber?: number | null;
};

export type DeliveryOrdersQueryData = {
	deliveryOrders: DeliveryOrderPaginatedResponse;
};

export type CreateDeliveryOrderMutationVariables = {
	input: CreateDeliveryOrderInputGql;
};

export type CreateDeliveryOrderMutationData = {
	createDeliveryOrder: DeliveryOrder;
};

export type CompleteDeliveryOrderMutationVariables = {
	id: string;
};

export type CompleteDeliveryOrderMutationData = {
	completeDeliveryOrder: DeliveryOrder;
};

// ---------------------------------------------------------------------------
// Mapping helpers – GraphQL DeliveryOrder -> existing TransferDetail UI shape
// ---------------------------------------------------------------------------

const GQL_DO_STATUS_TO_TRANSFER: Record<string, TransferStatus> = {
	CREATED: "preparing",
	PICKING: "preparing",
	PACKED: "preparing",
	READY_FOR_COLLECTION: "to-ship",
	COLLECTED: "in-transit",
	DELIVERED_PENDING_PROOF: "in-transit",
	DELIVERED_CONFIRMED: "other",
	CANCELLED: "cancel",
};

/** Map backend DeliveryOrderPaginatedResponse to existing TransferListResult UI shape. */
export function mapDeliveryOrdersToTransfers(
	raw: DeliveryOrderPaginatedResponse,
): TransferListResult {
	const pagination = raw.pagination as Pagination;

	const items: TransferDetail[] = (raw.query ?? []).map((d: DeliveryOrder) => {
		const status: TransferStatus =
			GQL_DO_STATUS_TO_TRANSFER[d.status] ?? "other";

		const createdAt = new Date(d.createdAt);
		// Backend does not yet expose scheduled delivery date on DeliveryOrder,
		// so we approximate using createdAt for grouping.
		const expectedDeliveryDate = new Date(d.createdAt);

		return {
			id: d.id,
			transferOrderNumber: d.poNo ?? d.doNo,
			fromLocation: "Main Warehouse",
			toLocation: "Unknown outlet",
			status,
			createdDate: createdAt,
			expectedDeliveryDate,
			createdBy: d.createdBy,
			notes: undefined,
			items: [],
			totalItems: 0,
			netsuiteStatus: undefined,
			regionName: null,
			regionCode: null,
		};
	});

	const byStatus: Record<TransferStatus, number> = {
		preparing: 0,
		"in-transit": 0,
		"to-ship": 0,
		cancel: 0,
		return: 0,
		other: 0,
	};

	for (const t of items) {
		byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
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

