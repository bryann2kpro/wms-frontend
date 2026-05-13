import { gql } from "graphql-request";
import type { Pagination } from "./types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StockCountSession {
	id: string;
	organizationId: string;
	name: string;
	status: "open" | "closed";
	countDate: string;
	createdBy: string;
	createdAt: string;
	closedBy: string | null;
	closedAt: string | null;
	itemCount: number;
	pendingCount: number;
}

export interface StockCountItem {
	id: string;
	sessionId: string;
	organizationId: string;
	skuId: string;
	skuCode: string;
	skuDescription: string;
	openingQty: number;
	openingLossQty: number;
	onHandQty: number;
	onHandLossQty: number;
	reservedQty: number;
	qtyDifference: number;
	lossQtyDifference: number;
	countedQty: number | null;
	countedLossQty: number | null;
	action: "tally_to_opening" | "tally_to_stock_count" | "manual_key_in" | null;
	notes: string | null;
	imageUrl: string | null;
	isApproved: boolean;
	approvedBy: string | null;
	approvedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface UpdateStockCountItemInput {
	action?: string;
	countedQty?: number;
	countedLossQty?: number;
	notes?: string;
	imageUrl?: string;
	isApproved?: boolean;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export const STOCK_COUNT_SESSIONS_QUERY = gql`
    query StockCountSessions($pageSize: Int, $pageNumber: Int) {
        stockCountSessions(pageSize: $pageSize, pageNumber: $pageNumber) {
            query {
                id
                organizationId
                name
                status
                countDate
                createdBy
                createdAt
                closedBy
                closedAt
                itemCount
                pendingCount
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

export type StockCountSessionsQueryData = {
	stockCountSessions: {
		query: StockCountSession[];
		pagination: Pagination;
	};
};

export const STOCK_COUNT_SESSION_QUERY = gql`
    query StockCountSession($id: ID!) {
        stockCountSession(id: $id) {
            id
            organizationId
            name
            status
            countDate
            createdBy
            createdAt
            closedBy
            closedAt
            itemCount
            pendingCount
        }
    }
`;

export type StockCountSessionQueryData = {
	stockCountSession: StockCountSession | null;
};

export const STOCK_COUNT_SESSION_ITEMS_QUERY = gql`
    query StockCountSessionItems(
        $sessionId: ID!
        $search: String
        $pageSize: Int
        $pageNumber: Int
    ) {
        stockCountSessionItems(
            sessionId: $sessionId
            search: $search
            pageSize: $pageSize
            pageNumber: $pageNumber
        ) {
            query {
                id
                sessionId
                skuId
                skuCode
                skuDescription
                openingQty
                openingLossQty
                onHandQty
                onHandLossQty
                reservedQty
                qtyDifference
                lossQtyDifference
                countedQty
                countedLossQty
                action
                notes
                imageUrl
                isApproved
                approvedBy
                approvedAt
                updatedAt
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

export type StockCountSessionItemsQueryData = {
	stockCountSessionItems: {
		query: StockCountItem[];
		pagination: Pagination;
	};
};

// ─── Mutations ───────────────────────────────────────────────────────────────

export const CREATE_STOCK_COUNT_SESSION_MUTATION = gql`
    mutation CreateStockCountSession($name: String!) {
        createStockCountSession(name: $name) {
            id
            name
            status
            countDate
            createdAt
            itemCount
            pendingCount
        }
    }
`;

export type CreateStockCountSessionData = {
	createStockCountSession: StockCountSession;
};

export const UPDATE_STOCK_COUNT_ITEM_MUTATION = gql`
    mutation UpdateStockCountItem($id: ID!, $input: UpdateStockCountItemInput!) {
        updateStockCountItem(id: $id, input: $input) {
            id
            sessionId
            skuCode
            skuDescription
            action
            countedQty
            countedLossQty
            notes
            imageUrl
            isApproved
            approvedBy
            approvedAt
            updatedAt
        }
    }
`;

export type UpdateStockCountItemData = {
	updateStockCountItem: StockCountItem;
};

export const CLOSE_STOCK_COUNT_SESSION_MUTATION = gql`
    mutation CloseStockCountSession($id: ID!) {
        closeStockCountSession(id: $id) {
            id
            name
            status
            closedAt
            closedBy
            itemCount
            pendingCount
        }
    }
`;

export type CloseStockCountSessionData = {
	closeStockCountSession: StockCountSession;
};

export const GENERATE_STOCK_COUNT_CHECKLIST_MUTATION = gql`
    mutation GenerateStockCountChecklist($sessionId: ID!) {
        generateStockCountChecklist(sessionId: $sessionId) {
            pdfBase64
            filename
        }
    }
`;

export type GenerateStockCountChecklistData = {
	generateStockCountChecklist: { pdfBase64: string; filename: string };
};

export const BULK_APPROVE_STOCK_COUNT_ITEMS_MUTATION = gql`
    mutation BulkApproveStockCountItems($sessionId: ID!) {
        bulkApproveStockCountItems(sessionId: $sessionId)
    }
`;

export type BulkApproveStockCountItemsData = {
	bulkApproveStockCountItems: number;
};
