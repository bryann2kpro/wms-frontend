import { gql } from "graphql-request";
import type { Pagination } from "./types";

export const STOCK_COUNTS_QUERY = gql`
    query StockCounts {
        stockCounts {
            pagination {
                count
                totalCount
                currentPage
                totalPages
                hasNextPage
                hasPrevPage
            }
            query {
                skuId
                skuCode
                skuDescription
                openingQty
                openingLossQty
                onHandQty
                reservedQty
                lossQty
                skuExpiryDate
                qtyDifference
                lossQtyDifference
            }
        }
    }
`;

export type StockCountsQueryVariables = {
	filter?: StockCountFilterInput;
	pageSize?: number;
	pageNumber?: number;
};

export type StockCountFilterInput = {
	skuId?: string;
	skuIds?: string[];
	skuCode?: string;
	skuCodes?: string[];
	skuDescription?: string;
	search?: string;
};

export interface StockCount {
	skuId: string;
	skuCode: string;
	skuDescription: string;
	openingQty: number;
	openingLossQty: number;
	onHandQty: number;
	reservedQty: number;
	lossQty: number;
	skuExpiryDate: string;
	qtyDifference: number;
	lossQtyDifference: number;
}

export interface StockCountsPaginatedResponse {
	query: StockCount[];
	pagination: Pagination;
}

export type StockCountsQueryData = {
	stockCounts: StockCountsPaginatedResponse;
};
