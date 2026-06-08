import { gql } from "graphql-request";
import type {
	Grn,
	GrnItem,
	GrnPaginatedResponse,
	GrnFilterInput,
	CreateGrnInput,
	UpdateGrnInput,
	Pagination,
	GrnStatusUI,
	GrnListResult,
} from "./types";

/** GRN list query — pagination via top-level `pageSize` / `pageNumber` (server applies LIMIT/OFFSET). */
export const GRNS_QUERY = gql`
	query GRNs($filter: GrnFilterInput, $pageSize: Int, $pageNumber: Int) {
		grns(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
			query {
				id
				grnNo
				supplierId
				supplierDeliveryId
				supplierDeliveryNo
				poNo
				status
				receivedAt
				approvedBy
				approvedAt
				notes
				proofUrl
				createdAt
				updatedAt
				createdByUser {
					id
					displayName
				}
				updatedByUser {
					id
					displayName
				}
				warehouse {
					warehouseId
					warehouseName
					warehouseCode
					warehouseAddress
					updatedBy
				}
				items {
					id
					grnId
					skuId
					skuCode
					skuDescription
					qty
					lossQty
					remarks
					expiryDate
					lotNo
					createdAt
					updatedAt
					createdBy
					updatedBy
					rack {
						rackId
						rackLevel
						rackRow
						rackColumn
					}
				}
			}
		}
	}
`;

/** GRN work queue query - non-draft GRNs for inbound stock movement queue */
export const GRNS_WORK_QUEUE_QUERY = gql`
	query GrnsWorkQueue($filter: GrnFilterInput, $pageSize: Int, $pageNumber: Int) {
		grns(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
			query {
				id
				grnNo
				status
				receivedAt
				items {
					id
					grnId
					skuId
					skuCode
					skuDescription
					qty
					lossQty
					expiryDate
					lotNo
					rack {
						rackId
						rackLevel
						rackRow
						rackColumn
					}
				}
			}
		}
	}
`;

/** Create GRN - matches typeDefs: createGrn(input: CreateGrnInput!): Grn! */
export const CREATE_GRN_MUTATION = gql`
	mutation CreateGrn($input: CreateGrnInput!) {
		createGrn(input: $input) {
			id
			grnNo
			supplierId
			supplierDeliveryId
			poNo
			status
			receivedAt
			approvedBy
			approvedAt
			notes
			proofUrl
			createdAt
			updatedAt
			createdByUser {
				id
				displayName
			}
			updatedByUser {
				id
				displayName
			}
			items {
				id
				grnId
				skuId
				qty
				lossQty
				remarks
				createdAt
				updatedAt
				createdBy
				updatedBy
			}
		}
	}
`;

/** Create inbound → InboundServices.createInbound; returns Boolean! (no subfields) */
export const CREATE_INBOUND_MUTATION = gql`
	mutation CreateInbound($input: CreateInboundInput!) {
		createInbound(input: $input)
	}
`;

/** Update GRN - matches typeDefs: updateGrn(id: ID!, input: UpdateGrnInput!): Grn */
export const UPDATE_GRN_MUTATION = gql`
	mutation UpdateGrn($id: ID!, $input: UpdateGrnInput!) {
		updateGrn(id: $id, input: $input) {
			id
			grnNo
			poNo
			supplierDeliveryId
			supplierDeliveryNo
			status
			receivedAt
			notes
			proofUrl
			updatedAt
			updatedByUser {
				id
				displayName
			}
		}
	}
`;

/** Delete GRN - matches typeDefs: deleteGrn(id: ID!): Boolean! */
export const DELETE_GRN_MUTATION = gql`
	mutation DeleteGrn($id: ID!) {
		deleteGrn(id: $id)
	}
`;

/** Get next GRN number for today (or an optional date) */
export const NEXT_GRN_NUMBER_QUERY = gql`
	query NextGrnNumber($date: String) {
		nextGrnNumber(date: $date)
	}
`;

/** List advance notices from NetSuite not yet linked to a GRN (for Create GRN dropdown) */
export const LIST_PENDING_ADVANCE_NOTICES_QUERY = gql`
	query ListPendingAdvanceNotices {
		listPendingAdvanceNotices {
			id
			tranid
			entity
			duedate
			receivedAt
			fulfillmentStatus
			lines {
				lineuniquekey
				itemid
				displayname
				quantity
				units
				custrecord_r2o_order_code
				islotitem
				lotNo
				expiryDate
			}
		}
	}
`;

/** Look up the advance notice (linked or not) for a PO — used to compute remaining-to-receive qty. */
export const ADVANCE_NOTICE_BY_PO_NO_QUERY = gql`
	query AdvanceNoticeByPoNo($poNo: String!) {
		advanceNoticeByPoNo(poNo: $poNo) {
			id
			tranid
			lines {
				itemid
				displayname
				quantity
				units
			}
		}
	}
`;

// ---------------------------------------------------------------------------
// Query / mutation types (from types.ts)
// ---------------------------------------------------------------------------

export type GrnsQueryVariables = {
	filter?: GrnFilterInput | null;
	pageSize?: number | null;
	pageNumber?: number | null;
};

export type GrnsQueryData = {
	grns: GrnPaginatedResponse;
};

export type GrnsWorkQueueQueryVariables = {
	filter?: GrnFilterInput | null;
	pageSize?: number;
	pageNumber?: number;
};

export type GrnsWorkQueueQueryData = {
	grns: Pick<GrnPaginatedResponse, "pagination"> & {
		query: Array<
			Pick<Grn, "id" | "grnNo" | "status" | "receivedAt"> & {
				items: Array<
					Pick<
						GrnItem,
						| "id"
						| "grnId"
						| "skuId"
						| "skuCode"
						| "skuDescription"
						| "qty"
						| "lossQty"
						| "expiryDate"
						| "lotNo"
						| "rack"
					>
				>;
			}
		>;
	};
};

export type CreateGrnMutationVariables = {
	input: CreateGrnInput;
};

export type CreateGrnMutationData = {
	createGrn: Grn;
};

export type UpdateGrnMutationVariables = {
	id: string;
	input: UpdateGrnInput;
};

export type UpdateGrnMutationData = {
	updateGrn: Grn | null;
};

export type DeleteGrnMutationVariables = {
	id: string;
};

export type DeleteGrnMutationData = {
	deleteGrn: boolean;
};

export type NextGrnNumberQueryVariables = {
	date?: string | null;
};

export type NextGrnNumberQueryData = {
	nextGrnNumber: string;
};

export type AdvanceNoticeLine = {
	lineuniquekey: number;
	itemid: string;
	displayname: string | null;
	quantity: number;
	units: string;
	custrecord_r2o_order_code: string | null;
	/** NetSuite lot-tracked flag (e.g. "T"). */
	islotitem: string | null;
	/** From ASN lots[0].serialNumbers when present. */
	lotNo: string | null;
	/** From ASN lots[0].expiryDate when present. */
	expiryDate: string | null;
};

export type AdvanceNotice = {
	id: string;
	tranid: string;
	entity: string;
	duedate: string;
	receivedAt: string;
	/** PENDING = no GRN yet; PARTIAL = a GRN exists but qty remains outstanding for this PO. */
	fulfillmentStatus: "PENDING" | "PARTIAL" | string;
	lines: AdvanceNoticeLine[];
};

export type ListPendingAdvanceNoticesQueryData = {
	listPendingAdvanceNotices: AdvanceNotice[];
};

export type AdvanceNoticeByPoNoQueryVariables = {
	poNo: string;
};

export type AdvanceNoticeByPoNoQueryData = {
	advanceNoticeByPoNo: Pick<AdvanceNotice, "id" | "tranid"> & {
		lines: Array<Pick<AdvanceNoticeLine, "itemid" | "displayname" | "quantity" | "units">>;
	} | null;
};

// ---------------------------------------------------------------------------
// UI status mapping (GraphQL enum <-> UI GRNStatus)
// ---------------------------------------------------------------------------

/** Map GraphQL enum to UI status */
export const GQL_STATUS_TO_UI: Record<string, GrnStatusUI> = {
	Draft: "Draft",
	Submitted: "Submitted",
	Approved: "Approved",
	SentToES: "Sent-to-ES",
	Failed: "Failed",
};

export const UI_STATUS_TO_GQL: Record<GrnStatusUI, string> = {
	Draft: "Draft",
	Submitted: "Submitted",
	Approved: "Approved",
	"Sent-to-ES": "SentToES",
	Failed: "Failed",
};

// ---------------------------------------------------------------------------
// Mapper: GrnPaginatedResponse -> GRNListResult (for existing UI)
// ---------------------------------------------------------------------------

/**
 * Map backend GrnPaginatedResponse to UI GrnListResult.
 * Pass `requestedPageSize` so list page size stays correct on the last page — GraphQL `pagination.count`
 * is rows on the current page, not the requested page size.
 */
export function mapGrnsQueryToResult(
	raw: GrnPaginatedResponse,
	options?: { requestedPageSize?: number },
): GrnListResult {
	const query = raw.query ?? [];
	const pagination = raw.pagination as Pagination;

	const byStatus = {
		Draft: 0,
		Submitted: 0,
		Approved: 0,
		"Sent-to-ES": 0,
		Failed: 0,
	} as Record<GrnStatusUI, number>;

	const items: GrnListResult["items"] = query.map((g: Grn) => {
		const status: GrnStatusUI = (GQL_STATUS_TO_UI[g.status] ??
			"Draft") as GrnStatusUI;
		byStatus[status] = (byStatus[status] ?? 0) + 1;

		const warehouse = g.warehouse ?? null;
		const lineItems = (g.items ?? []).map((i: GrnItem) => {
			const cartonNum = Number(i.qty) || 0;
			const lossNum = Number(i.lossQty) || 0;
			const rack = i.rack ?? null;
			const location = rack
				? `${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`
				: (i.warehouseName ?? warehouse?.warehouseName ?? undefined);
			return {
				id: i.id,
				sku: i.skuId,
				skuCode: i.skuCode ?? "",
				skuDescription: i.skuDescription ?? "",
				expectedQuantity: cartonNum,
				lossQuantity: lossNum,
				receivedQuantity: cartonNum + lossNum,
				location,
				expiryDate: i.expiryDate ?? null,
				lotNo: i.lotNo ?? null,
				rack: rack ?? null,
			};
		});
		const totalItems = lineItems.reduce(
			(s, it) => s + it.expectedQuantity + it.lossQuantity,
			0,
		);
		const receivedItems = lineItems.reduce(
			(s, it) => s + it.receivedQuantity,
			0,
		);

		return {
			id: g.id,
			grnNo: g.grnNo,
			supplierId: g.supplierId,
			supplierDeliveryId: g.supplierDeliveryId,
			supplierDeliveryNo: g.supplierDeliveryNo ?? null,
			poNo: g.poNo,
			warehouseId:
				warehouse?.warehouseId ?? (g.items ?? [])[0]?.warehouseId ?? null,
			warehouse: warehouse ?? null,
			status,
			receivedAt: g.receivedAt,
			createdAt: g.createdAt,
			createdBy: g.createdByUser?.displayName ?? "",
			updatedBy: g.updatedByUser?.displayName ?? null,
			notes: g.notes ?? undefined,
			proofUrl: g.proofUrl ?? null,
			totalItems,
			receivedItems,
			totalAmount: 0,
			items: lineItems,
		};
	});

	const requestedPageSize = options?.requestedPageSize ?? 10;
	const serverTotalPages = pagination?.totalPages ?? 1;
	const totalCount = pagination?.totalCount ?? query.length;

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
