import { gql } from "graphql-request";

// ============================================
// INBOUND — Advance Notice Logs
// ============================================

export const ES_ADVANCE_NOTICE_LOGS_QUERY = gql`
	query EsAdvanceNoticeLogs(
		$filter: EsAdvanceNoticeLogFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		esAdvanceNoticeLogs(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				id
				receivedAt
				apiKeyId
				rawPayload
				status
				errorMessage
				advanceNoticeId
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
`;

export interface EsAdvanceNoticeLog {
	id: string;
	receivedAt: string;
	apiKeyId: string | null;
	rawPayload: Record<string, unknown>;
	status: string;
	errorMessage: string | null;
	advanceNoticeId: string | null;
}

export interface EsAdvanceNoticeLogFilterInput {
	dateFrom?: string;
	dateTo?: string;
	status?: string;
}

export interface EsAdvanceNoticeLogsQueryVariables {
	filter?: EsAdvanceNoticeLogFilterInput;
	pageSize?: number;
	pageNumber?: number;
}

export type EsAdvanceNoticeLogsQueryData = {
	esAdvanceNoticeLogs: {
		query: EsAdvanceNoticeLog[];
		pagination: PaginationInfo;
	};
};

// ============================================
// OUTBOUND — Item Receipts
// ============================================

export const ES_ITEM_RECEIPTS_QUERY = gql`
	query EsItemReceipts(
		$filter: EsItemReceiptFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		esItemReceipts(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				id
				poNumber
				esAdvanceNoticeId
				payload
				sentAt
				nsResponse
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
`;

export interface EsItemReceipt {
	id: string;
	poNumber: string | null;
	esAdvanceNoticeId: string | null;
	payload: Record<string, unknown>;
	sentAt: string;
	nsResponse: Record<string, unknown> | null;
}

export interface EsItemReceiptFilterInput {
	dateFrom?: string;
	dateTo?: string;
	poNumber?: string;
	status?: string;
}

export interface EsItemReceiptsQueryVariables {
	filter?: EsItemReceiptFilterInput;
	pageSize?: number;
	pageNumber?: number;
}

export type EsItemReceiptsQueryData = {
	esItemReceipts: {
		query: EsItemReceipt[];
		pagination: PaginationInfo;
	};
};

// ============================================
// SHARED
// ============================================

export interface PaginationInfo {
	count: number;
	totalCount: number;
	currentPage: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}
