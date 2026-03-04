import { gql } from "@apollo/client";
import type {
	PurchaseOrder,
	PurchaseOrderPaginatedResponse,
	PurchaseOrderFilterInput,
	Pagination,
} from "./types";
import type {
	TransferDetail,
	TransferListResult,
	TransferStatus,
} from "@/data/transfers.types";

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

export const PURCHASE_ORDER_FRAGMENT = gql`
	fragment PurchaseOrderFields on PurchaseOrder {
		id
		purchaseOrderNo
		outletId
		status
		scheduledDeliveryDate
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

// ---------------------------------------------------------------------------
// Query
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

export type PurchaseOrdersQueryVariables = {
	filter?: PurchaseOrderFilterInput | null;
	pageSize?: number | null;
	pageNumber?: number | null;
};

export type PurchaseOrdersQueryData = {
	purchaseOrders: PurchaseOrderPaginatedResponse;
};

// ---------------------------------------------------------------------------
// Mapping helper – PurchaseOrder -> TransferDetail (for shared UI components)
// ---------------------------------------------------------------------------

const GQL_PO_STATUS_TO_TRANSFER: Record<string, TransferStatus> = {
	NEW: "preparing",
	ACCEPTED: "preparing",
	REJECTED: "cancel",
	DO_CREATED: "to-ship",
	CANCELLED: "cancel",
};

export function mapPurchaseOrdersToTransfers(
	raw: PurchaseOrderPaginatedResponse,
): TransferListResult {
	const pagination = raw.pagination as Pagination;

	const items: TransferDetail[] = (raw.query ?? []).map(
		(po: PurchaseOrder): TransferDetail => {
			const status: TransferStatus =
				GQL_PO_STATUS_TO_TRANSFER[po.status] ?? "other";

			const createdDate = new Date(po.createdAt);
			const expectedDeliveryDate = po.scheduledDeliveryDate
				? new Date(po.scheduledDeliveryDate)
				: createdDate;

			return {
				id: po.id,
				transferOrderNumber: po.purchaseOrderNo,
				fromLocation: "NetSuite",
				toLocation: "Unknown outlet",
				status,
				createdDate,
				expectedDeliveryDate,
				createdBy: po.createdBy ?? "System",
				notes: undefined,
				items: [],
				totalItems: 0,
				netsuiteStatus: undefined,
				regionName: null,
				regionCode: null,
			};
		},
	);

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

