import { gql } from "graphql-request";
import type { Pagination } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReturnReason = "DAMAGED" | "ABOUT_TO_EXPIRE";
export type ReturnStatus = "RECEIVED" | "COMPLETED";
export type ReturnItemStatus = "PENDING" | "ASSIGNED";

export interface ReturnPhoto {
	id: string;
	fileName: string;
	url: string | null;
	mimeType: string;
	uploadedAt: string;
}

export interface ReturnItem {
	id: string;
	returnId: string;
	doItemId: string | null;
	skuId: string;
	skuCode: string | null;
	skuDescription: string | null;
	lotNo: string | null;
	expiryDate: string | null;
	qtyReturned: string;
	reason: ReturnReason | string;
	conditionNotes: string | null;
	status: ReturnItemStatus | string;
	qtyPutaway: string;
	assignedRackId: string | null;
	assignedRackLabel: string | null;
	assignedBy: string | null;
	assignedAt: string | null;
	photos: ReturnPhoto[];
	createdAt: string;
}

export interface ReturnDoc {
	id: string;
	returnNo: string;
	doId: string;
	doNo: string;
	purchaseOrderId: string;
	poNo: string;
	status: ReturnStatus | string;
	receivedBy: string | null;
	receivedByUser: { id: string; displayName: string } | null;
	receivedAt: string;
	completedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
	items: ReturnItem[];
}

export interface ReturnPaginatedResponse {
	query: ReturnDoc[];
	pagination: Pagination;
}

export interface ReturnsStats {
	receivedCount: number;
	completedCount: number;
	pendingItemCount: number;
	damagedItemCount: number;
	aboutToExpireItemCount: number;
}

export interface ReturnPhotoInput {
	fileUrl: string;
	fileName: string;
	fileSizeBytes: number;
	mimeType: string;
}

export interface ReturnLineInput {
	doItemId?: string | null;
	skuId: string;
	lotNo?: string | null;
	expiryDate?: string | null;
	qtyReturned: string;
	reason: ReturnReason;
	conditionNotes?: string | null;
	photos?: ReturnPhotoInput[] | null;
}

export interface ReturnFilterInput {
	id?: string | null;
	doId?: string | null;
	status?: string | null;
	reason?: string | null;
	search?: string | null;
	receivedAtFrom?: string | null;
	receivedAtTo?: string | null;
}

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

export const RETURN_ITEM_FRAGMENT = gql`
	fragment ReturnItemFields on ReturnItem {
		id
		returnId
		doItemId
		skuId
		skuCode
		skuDescription
		lotNo
		expiryDate
		qtyReturned
		reason
		conditionNotes
		status
		qtyPutaway
		assignedRackId
		assignedRackLabel
		assignedBy
		assignedAt
		photos {
			id
			fileName
			url
			mimeType
			uploadedAt
		}
		createdAt
	}
`;

export const RETURN_FRAGMENT = gql`
	fragment ReturnFields on Return {
		id
		returnNo
		doId
		doNo
		purchaseOrderId
		poNo
		status
		receivedBy
		receivedByUser {
			id
			displayName
		}
		receivedAt
		completedAt
		notes
		createdAt
		updatedAt
		items {
			...ReturnItemFields
		}
	}
	${RETURN_ITEM_FRAGMENT}
`;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const RETURNS_QUERY = gql`
	query Returns($filter: ReturnFilter, $pageSize: Int, $pageNumber: Int) {
		returns(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...ReturnFields
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
	${RETURN_FRAGMENT}
`;

export const RETURN_QUERY = gql`
	query ReturnDoc($id: ID!) {
		returnDoc(id: $id) {
			...ReturnFields
		}
	}
	${RETURN_FRAGMENT}
`;

export const RETURNS_STATS_QUERY = gql`
	query ReturnsStats {
		returnsStats {
			receivedCount
			completedCount
			pendingItemCount
			damagedItemCount
			aboutToExpireItemCount
		}
	}
`;

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const CREATE_RETURN_MUTATION = gql`
	mutation CreateReturn($doId: ID!, $items: [ReturnLineInput!]!, $notes: String) {
		createReturn(doId: $doId, items: $items, notes: $notes) {
			...ReturnFields
		}
	}
	${RETURN_FRAGMENT}
`;

export const ASSIGN_RETURN_ITEM_TO_RACK_MUTATION = gql`
	mutation AssignReturnItemToRack($returnItemId: ID!, $rackId: ID!, $qty: String) {
		assignReturnItemToRack(returnItemId: $returnItemId, rackId: $rackId, qty: $qty) {
			...ReturnItemFields
		}
	}
	${RETURN_ITEM_FRAGMENT}
`;

// ---------------------------------------------------------------------------
// Query/Mutation variable + data types
// ---------------------------------------------------------------------------

export type ReturnsQueryVariables = {
	filter?: ReturnFilterInput | null;
	pageSize?: number | null;
	pageNumber?: number | null;
};

export type ReturnsQueryData = {
	returns: ReturnPaginatedResponse;
};

export type ReturnQueryVariables = {
	id: string;
};

export type ReturnQueryData = {
	returnDoc: ReturnDoc | null;
};

export type ReturnsStatsQueryData = {
	returnsStats: ReturnsStats;
};

export type CreateReturnMutationVariables = {
	doId: string;
	items: ReturnLineInput[];
	notes?: string | null;
};

export type CreateReturnMutationData = {
	createReturn: ReturnDoc;
};

export type AssignReturnItemToRackMutationVariables = {
	returnItemId: string;
	rackId: string;
	qty?: string | null;
};

export type AssignReturnItemToRackMutationData = {
	assignReturnItemToRack: ReturnItem;
};
