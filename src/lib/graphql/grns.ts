import { gql } from "@apollo/client";

export const GRNS_QUERY = gql`
	query GRNs($filters: GRNListFiltersInput) {
		grns(filters: $filters) {
			items {
				id
				grnNumber
				supplier
				status
				poReference
				supplierDO
				receivedDate
				createdAt
				createdBy
				notes
				totalItems
				receivedItems
				totalAmount
				items {
					id
					sku
					description
					expectedQuantity
					receivedQuantity
					location
				}
			}
			summary {
				byStatus {
					Draft
					Submitted
					Approved
					SentToES
					Failed
				}
				total
			}
			page
			pageSize
			total
		}
	}
`;

export const CREATE_GRN_MUTATION = gql`
	mutation CreateGRN($input: CreateGRNInput!) {
		createGRN(input: $input) {
			id
			grnNumber
			supplier
			status
			poReference
			supplierDO
			receivedDate
			createdAt
			createdBy
			notes
			totalItems
			receivedItems
			totalAmount
			items {
				id
				sku
				description
				expectedQuantity
				receivedQuantity
				location
			}
		}
	}
`;

export const UPDATE_GRN_STATUS_MUTATION = gql`
	mutation UpdateGRNStatus($id: ID!, $status: GRNStatus!) {
		updateGRNStatus(id: $id, status: $status) {
			id
			status
		}
	}
`;

/** Map GraphQL enum to UI GRNStatus */
export const GQL_STATUS_TO_UI: Record<string, import("@/data/grn.mock-data").GRNStatus> = {
	Draft: "Draft",
	Submitted: "Submitted",
	Approved: "Approved",
	SentToES: "Sent-to-ES",
	Failed: "Failed",
};

export type GrnsQueryData = {
	grns: {
		items: Array<{
			id: string;
			grnNumber: string;
			supplier: string;
			status: string;
			poReference: string | null;
			supplierDO: string | null;
			receivedDate: string;
			createdAt: string;
			createdBy: string;
			notes: string | null;
			totalItems: number;
			receivedItems: number;
			totalAmount: number;
			items: Array<{
				id: string;
				sku: string;
				description: string;
				expectedQuantity: number;
				receivedQuantity: number;
				location: string | null;
			}>;
		}>;
		summary: {
			byStatus: { Draft: number; Submitted: number; Approved: number; SentToES: number; Failed: number };
			total: number;
		};
		page: number;
		pageSize: number;
		total: number;
	};
};

export function mapGrnsQueryToResult(
	raw: GrnsQueryData["grns"]
): import("@/data/grn.mock-data").GRNListResult {
	return {
		items: raw.items.map((g) => ({
			id: g.id,
			grnNumber: g.grnNumber,
			supplier: g.supplier,
			status: GQL_STATUS_TO_UI[g.status] ?? "Draft",
			poReference: g.poReference ?? undefined,
			supplierDO: g.supplierDO ?? undefined,
			receivedDate: new Date(g.receivedDate),
			createdAt: new Date(g.createdAt),
			createdBy: g.createdBy,
			notes: g.notes ?? undefined,
			totalItems: g.totalItems,
			receivedItems: g.receivedItems,
			totalAmount: g.totalAmount,
			items: g.items.map((i) => ({
				id: i.id,
				sku: i.sku,
				description: i.description,
				expectedQuantity: i.expectedQuantity,
				receivedQuantity: i.receivedQuantity,
				location: i.location ?? undefined,
			})),
		})),
		summary: {
			byStatus: {
				Draft: raw.summary.byStatus.Draft,
				Submitted: raw.summary.byStatus.Submitted,
				Approved: raw.summary.byStatus.Approved,
				"Sent-to-ES": raw.summary.byStatus.SentToES,
				Failed: raw.summary.byStatus.Failed,
			},
			total: raw.summary.total,
		},
		page: raw.page,
		pageSize: raw.pageSize,
		total: raw.total,
	};
}

export const UI_STATUS_TO_GQL: Record<import("@/data/grn.mock-data").GRNStatus, string> = {
	Draft: "Draft",
	Submitted: "Submitted",
	Approved: "Approved",
	"Sent-to-ES": "SentToES",
	Failed: "Failed",
};
