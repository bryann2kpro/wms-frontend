import { gql } from "graphql-request";
import type { StockTransfer, StockTransferPaginatedResponse } from "./types";

// ============================================
// FRAGMENTS
// ============================================

export const STOCK_TRANSFER_FRAGMENT = gql`
	fragment StockTransferFields on StockTransfer {
		id
		transferNo
		type
		status
		sourceWarehouseId
		destinationWarehouseId
		remarks
		dispatchedAt
		receivedAt
		receivedBy
		cancelledAt
		cancelledBy
		cancelReason
		createdAt
		updatedAt
		createdBy
		createdByUser {
			id
			displayName
		}
		items {
			id
			skuId
			skuCode
			skuDescription
			lotNo
			expiryDate
			quantity
			lossQuantity
			sourceStockQuantId
			sourceRackId
			sourceRack {
				rackId
				rackRow
				rackColumn
				rackLevel
			}
			destinationRackId
			destinationRack {
				rackId
				rackRow
				rackColumn
				rackLevel
			}
		}
	}
`;

// ============================================
// QUERIES
// ============================================

export const STOCK_TRANSFERS_QUERY = gql`
	query StockTransfers(
		$filter: StockTransferFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		stockTransfers(
			filter: $filter
			pageSize: $pageSize
			pageNumber: $pageNumber
		) {
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
			query {
				...StockTransferFields
			}
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

export const STOCK_TRANSFER_QUERY = gql`
	query StockTransfer($id: ID!) {
		stockTransfer(id: $id) {
			...StockTransferFields
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

// ============================================
// MUTATIONS
// ============================================

export const CREATE_STOCK_TRANSFER_MUTATION = gql`
	mutation CreateStockTransfer($input: CreateStockTransferInput!) {
		createStockTransfer(input: $input) {
			...StockTransferFields
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

export const RECEIVE_STOCK_TRANSFER_MUTATION = gql`
	mutation ReceiveStockTransfer($id: ID!) {
		receiveStockTransfer(id: $id) {
			...StockTransferFields
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

export const CANCEL_STOCK_TRANSFER_MUTATION = gql`
	mutation CancelStockTransfer($id: ID!, $reason: String!) {
		cancelStockTransfer(id: $id, reason: $reason) {
			...StockTransferFields
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

export const DISPATCH_STOCK_TRANSFER_MUTATION = gql`
	mutation DispatchStockTransfer($id: ID!) {
		dispatchStockTransfer(id: $id) {
			...StockTransferFields
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

export const APPROVE_STOCK_TRANSFER_MUTATION = gql`
	mutation ApproveStockTransfer($id: ID!) {
		approveStockTransfer(id: $id) {
			...StockTransferFields
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

export const REJECT_STOCK_TRANSFER_MUTATION = gql`
	mutation RejectStockTransfer($id: ID!) {
		rejectStockTransfer(id: $id) {
			...StockTransferFields
		}
	}
	${STOCK_TRANSFER_FRAGMENT}
`;

export const GENERATE_STOCK_TRANSFER_WORK_QUEUE_LIST_MUTATION = gql`
	mutation GenerateStockTransferWorkQueueList(
		$filter: StockTransferWorkQueueFilterInput
	) {
		generateStockTransferWorkQueueList(filter: $filter) {
			pdfBase64
			filename
		}
	}
`;

// ============================================
// VARIABLE / DATA TYPES
// ============================================

export type StockTransferFilterInput = {
	id?: string;
	transferNo?: string;
	type?: string;
	status?: string;
	search?: string;
	sortBy?: string;
	sortOrder?: string;
};

export type StockTransfersQueryVariables = {
	filter?: StockTransferFilterInput;
	pageSize?: number;
	pageNumber?: number;
};

export type StockTransfersQueryData = {
	stockTransfers: StockTransferPaginatedResponse | null;
};

export type StockTransferQueryVariables = { id: string };
export type StockTransferQueryData = { stockTransfer: StockTransfer | null };

export type CreateStockTransferLineInput = {
	sourceStockQuantId: string;
	destinationRackId: string;
	quantity: string;
	lossQuantity?: string;
};

export type CreateStockTransferInput = {
	remarks?: string | null;
	lines: CreateStockTransferLineInput[];
};

export type CreateStockTransferMutationVariables = {
	input: CreateStockTransferInput;
};
export type CreateStockTransferMutationData = {
	createStockTransfer: StockTransfer;
};

export type ReceiveStockTransferMutationVariables = { id: string };
export type ReceiveStockTransferMutationData = {
	receiveStockTransfer: StockTransfer;
};

export type CancelStockTransferMutationVariables = {
	id: string;
	reason: string;
};
export type CancelStockTransferMutationData = {
	cancelStockTransfer: StockTransfer;
};

export type DispatchStockTransferMutationVariables = { id: string };
export type DispatchStockTransferMutationData = {
	dispatchStockTransfer: StockTransfer;
};

export type ApproveStockTransferMutationVariables = { id: string };
export type ApproveStockTransferMutationData = {
	approveStockTransfer: StockTransfer;
};

export type RejectStockTransferMutationVariables = { id: string };
export type RejectStockTransferMutationData = {
	rejectStockTransfer: StockTransfer;
};

export type StockTransferWorkQueueFilterInput = {
	search?: string | null;
};

export type GenerateStockTransferWorkQueueListMutationVariables = {
	filter?: StockTransferWorkQueueFilterInput | null;
};

export type GenerateStockTransferWorkQueueListMutationData = {
	generateStockTransferWorkQueueList: {
		pdfBase64: string;
		filename: string;
	};
};
