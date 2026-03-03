import { gql } from "@apollo/client";
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

/** GRN list query - backend does search/filter; pass filter only */
export const GRNS_QUERY = gql`
	query GRNs($filter: GrnFilterInput) {
		grns(filter: $filter) {
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

// ---------------------------------------------------------------------------
// Query / mutation types (from types.ts)
// ---------------------------------------------------------------------------

export type GrnsQueryVariables = {
	filter?: GrnFilterInput | null;
};

export type GrnsQueryData = {
	grns: GrnPaginatedResponse;
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

/** Map backend GrnPaginatedResponse to UI GrnListResult. Derives summary from query when backend does not return it. */
export function mapGrnsQueryToResult(raw: GrnPaginatedResponse): GrnListResult {
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
		const status: GrnStatusUI = (GQL_STATUS_TO_UI[g.status] ?? "Draft") as GrnStatusUI;
		byStatus[status] = (byStatus[status] ?? 0) + 1;

		const warehouse = g.warehouse ?? null;
		const lineItems = (g.items ?? []).map((i: GrnItem) => {
			const cartonNum = Number(i.qty) || 0;
			const lossNum = Number(i.lossQty) || 0;
			const rack = i.rack ?? null;
			const location =
				rack
					? `${rack.rackRow}-${rack.rackColumn}-${rack.rackLevel}`
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
				rack: rack ?? null,
			};
		});
		const totalItems = lineItems.reduce(
			(s, it) => s + it.expectedQuantity + it.lossQuantity,
			0,
		);
		const receivedItems = lineItems.reduce((s, it) => s + it.receivedQuantity, 0);

		return {
			id: g.id,
			grnNo: g.grnNo,
			supplierId: g.supplierId,
			supplierDeliveryId: g.supplierDeliveryId,
			supplierDeliveryNo: g.supplierDeliveryNo ?? null,
			poNo: g.poNo,
			warehouseId: warehouse?.warehouseId ?? (g.items ?? [])[0]?.warehouseId ?? null,
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

	return {
		items,
		summary: {
			byStatus,
			total: query.length,
		},
		page: pagination?.currentPage ?? 1,
		pageSize: pagination?.count ?? query.length,
		total: pagination?.totalCount ?? query.length,
	};
}
