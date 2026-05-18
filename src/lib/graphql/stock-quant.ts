import { gql } from "@apollo/client";
import type { Pagination } from "./types";

export const STOCK_QUANTS_QUERY = gql`
	query GetStockQuants(
		$filter: StockQuantFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		stockQuants(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
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
				skuId
				skuCode
				description
				quantity
				rackId
				rackLabel
				lotNo
				organizationId
				createdAt
				updatedAt
				createdBy
				updatedBy
			}
		}
	}
`;

export type StockQuantFilterInput = {
	id?: string;
	skuId?: string;
	skuIds?: string[];
	rackId?: string;
	rackIds?: string[];
};

export interface StockQuant {
	id: string;
	skuId: string;
	skuCode: string | null;
	description: string | null;
	quantity: string;
	rackId: string;
	rackLabel: string | null;
	lotNo: string | null;
	organizationId: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
}

export interface StockQuantPaginatedResponse {
	query: StockQuant[];
	pagination: Pagination;
}

export type StockQuantsQueryData = {
	stockQuants: StockQuantPaginatedResponse;
};

export type StockQuantsQueryVariables = {
	filter?: StockQuantFilterInput;
	pageSize?: number;
	pageNumber?: number;
};
