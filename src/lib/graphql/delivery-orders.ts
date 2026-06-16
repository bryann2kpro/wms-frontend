import { gql } from "graphql-request";
import type {
	DeliveryOrder,
	DeliveryOrderPaginatedResponse,
	DeliveryOrderFilterInput,
	CreateDeliveryOrderInputGql,
	Pagination,
	DeliveryOrderItemWithDetails,
	DeliveryOrderItemWithDetailsPaginatedResponse,
	DeliveryOrderItemFilterInput,
} from "./types";
import type {
	PurchaseOrderDetail,
	PurchaseOrderListResult,
	PurchaseOrderStatus,
} from "@/data/purchase-orders.types";
import type { ReturnLineInput } from "./returns";

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

export const DELIVERY_ORDER_FRAGMENT = gql`
	fragment DeliveryOrderFields on DeliveryOrder {
		id
		doNo
		poNo
		status
		isEmergency
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

export const ADVANCE_DELIVERY_ORDER_STATUS_MUTATION = gql`
	mutation AdvanceDeliveryOrderStatus($id: ID!) {
		advanceDeliveryOrderStatus(id: $id) {
			...DeliveryOrderFields
		}
	}
	${DELIVERY_ORDER_FRAGMENT}
`;

export const SUBMIT_DELIVERY_PROOF_MUTATION = gql`
	mutation SubmitDeliveryProof(
		$doId: ID!
		$fileUrl: String!
		$fileName: String!
		$fileSizeBytes: Int!
		$mimeType: String!
		$returns: [ReturnLineInput!]
		$returnNotes: String
	) {
		submitDeliveryProof(
			doId: $doId
			fileUrl: $fileUrl
			fileName: $fileName
			fileSizeBytes: $fileSizeBytes
			mimeType: $mimeType
			returns: $returns
			returnNotes: $returnNotes
		) {
			...DeliveryOrderFields
		}
	}
	${DELIVERY_ORDER_FRAGMENT}
`;

// ---------------------------------------------------------------------------
// Delivery Order Items (Work Queue)
// ---------------------------------------------------------------------------

export const DELIVERY_ORDER_ITEM_WITH_DETAILS_FRAGMENT = gql`
	fragment DeliveryOrderItemWithDetailsFields on DeliveryOrderItemWithDetails {
		id
		purchaseOrderId
		purchaseOrderNo
		skuId
		qtyRequired
		qtyPicked
		qtyPacked
		lotNo
		expiryDate
		createdAt
		updatedAt
		createdBy
		updatedBy
		skuCode
		skuDescription
		doId
		doNo
		doStatus
		onHandQty
		lossQty
		reservedQty
		allocations {
			id
			doItemId
			grnItemId
			grnNo
			rackId
			rackName
			expiryDate
			lotNo
			qtyAllocated
			priorityFlag
		}
	}
`;

export const DELIVERY_ORDER_ITEMS_QUERY = gql`
	query DeliveryOrderItems(
		$filter: DeliveryOrderItemFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		deliveryOrderItems(
			filter: $filter
			pageSize: $pageSize
			pageNumber: $pageNumber
		) {
			query {
				...DeliveryOrderItemWithDetailsFields
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
	${DELIVERY_ORDER_ITEM_WITH_DETAILS_FRAGMENT}
`;

export const MARK_DELIVERY_ORDER_ITEM_PICKED_MUTATION = gql`
	mutation MarkDeliveryOrderItemPicked($id: ID!, $qtyPicked: String!) {
		markDeliveryOrderItemPicked(id: $id, qtyPicked: $qtyPicked) {
			...DeliveryOrderItemWithDetailsFields
		}
	}
	${DELIVERY_ORDER_ITEM_WITH_DETAILS_FRAGMENT}
`;

export const ALLOCATE_PICK_LIST_MUTATION = gql`
	mutation AllocatePickList($deliveryOrderId: ID!) {
		allocatePickList(deliveryOrderId: $deliveryOrderId) {
			...DeliveryOrderItemWithDetailsFields
		}
	}
	${DELIVERY_ORDER_ITEM_WITH_DETAILS_FRAGMENT}
`;

export const GENERATE_DO_PICKING_LIST_MUTATION = gql`
	mutation GenerateDoPickingList($filter: DoPickingListFilterInput) {
		generateDoPickingList(filter: $filter) {
			pdfBase64
			filename
		}
	}
`;

export type DoPickingListFilterInput = {
	regionId?: string | null;
	regionIds?: string[] | null;
	search?: string | null;
	scheduledDeliveryDateFrom?: string | null;
	scheduledDeliveryDateTo?: string | null;
};

export type GenerateDoPickingListMutationData = {
	generateDoPickingList: {
		pdfBase64: string;
		filename: string;
	};
};

export type GenerateDoPickingListMutationVariables = {
	filter?: DoPickingListFilterInput | null;
};

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

export type AdvanceDeliveryOrderStatusMutationVariables = {
	id: string;
};

export type AdvanceDeliveryOrderStatusMutationData = {
	advanceDeliveryOrderStatus: DeliveryOrder;
};

// ---------------------------------------------------------------------------
// Delivery Order Items Types
// ---------------------------------------------------------------------------

export type DeliveryOrderItemsQueryVariables = {
	filter?: DeliveryOrderItemFilterInput | null;
	pageSize?: number | null;
	pageNumber?: number | null;
};

export type DeliveryOrderItemsQueryData = {
	deliveryOrderItems: DeliveryOrderItemWithDetailsPaginatedResponse;
};

export type MarkDeliveryOrderItemPickedMutationVariables = {
	id: string;
	qtyPicked: string;
};

export type MarkDeliveryOrderItemPickedMutationData = {
	markDeliveryOrderItemPicked: DeliveryOrderItemWithDetails;
};

export type AllocatePickListMutationVariables = {
	deliveryOrderId: string;
};

export type AllocatePickListMutationData = {
	allocatePickList: DeliveryOrderItemWithDetails[];
};

export type SubmitDeliveryProofMutationVariables = {
	doId: string;
	fileUrl: string;
	fileName: string;
	fileSizeBytes: number;
	mimeType: string;
	/** Optional returned goods captured at the outlet (created atomically with the DELIVERED flip). */
	returns?: ReturnLineInput[] | null;
	returnNotes?: string | null;
};

export type SubmitDeliveryProofMutationData = {
	submitDeliveryProof: DeliveryOrder;
};

// ---------------------------------------------------------------------------
// Mapping helpers – GraphQL DeliveryOrder -> PurchaseOrderDetail UI shape
// ---------------------------------------------------------------------------

const GQL_DO_STATUS_TO_PO_STATUS: Record<string, PurchaseOrderStatus> = {
	CREATED: "preparing",
	NEW: "preparing",
	PACKING: "preparing",
	PICKING: "preparing",
	PACKED: "preparing",
	READY_FOR_COLLECTION: "to-ship",
	COLLECTED: "in-transit",
	SHIPPED: "in-transit",
	DELIVERED_PENDING_PROOF: "in-transit",
	DELIVERED: "other",
	DELIVERED_CONFIRMED: "other",
	CANCELLED: "cancel",
};

/** Map backend DeliveryOrderPaginatedResponse to PurchaseOrderListResult UI shape. */
export function mapDeliveryOrdersToPurchaseOrderList(
	raw: DeliveryOrderPaginatedResponse,
	options?: { requestedPageSize?: number },
): PurchaseOrderListResult {
	const pagination = raw.pagination as Pagination;

	const items: PurchaseOrderDetail[] = (raw.query ?? []).map(
		(d: DeliveryOrder) => {
			const status: PurchaseOrderStatus =
				GQL_DO_STATUS_TO_PO_STATUS[d.status] ?? "other";

			const createdAt = new Date(d.createdAt);
			const expectedDeliveryDate = new Date(d.createdAt);

			return {
				id: d.id,
				purchaseOrderNumber: d.poNo ?? d.doNo,
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
		},
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
