import { gql } from "graphql-request";
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
			totalQuantity
			query {
				id
				skuId
				skuCode
				stockUnitCode
				description
				quantity
				lossQty
				reservedQty
				rackId
				rackLabel
				rackBinType
				lotNo
				expiryDate
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
	skuCode?: string;
	rackId?: string;
	rackIds?: string[];
	rackLabel?: string;
};

export interface StockQuant {
	id: string;
	skuId: string;
	skuCode: string | null;
	stockUnitCode: string | null;
	description: string | null;
	quantity: string;
	lossQty: string;
	reservedQty: string;
	rackId: string;
	rackLabel: string | null;
	/** Bin type of the rack this quant is on (e.g. LOOSE_STORAGE, FIXED, PALLET_STORAGE). */
	rackBinType: string | null;
	lotNo: string | null;
	expiryDate: string | null;
	organizationId: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string | null;
}

export interface StockQuantPaginatedResponse {
	query: StockQuant[];
	pagination: Pagination;
	totalQuantity: string;
}

export type StockQuantsQueryData = {
	stockQuants: StockQuantPaginatedResponse;
};

export type StockQuantsQueryVariables = {
	filter?: StockQuantFilterInput;
	pageSize?: number;
	pageNumber?: number;
};

/** Sort stock quants for display using the SKU picking strategy (m.skus.picking_strategy). */
export function sortStockQuantsByPickingStrategy(
	rows: StockQuant[],
	strategy: string,
): StockQuant[] {
	const sorted = [...rows];
	const byUpdatedAt = (a: StockQuant, b: StockQuant, ascending: boolean) => {
		const diff =
			new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
		return ascending ? diff : -diff;
	};

	switch (strategy) {
		case "LIFO":
			sorted.sort((a, b) => byUpdatedAt(a, b, false));
			break;
		case "FEFO":
			sorted.sort((a, b) => {
				const aExp = a.expiryDate
					? new Date(a.expiryDate).getTime()
					: Number.MAX_SAFE_INTEGER;
				const bExp = b.expiryDate
					? new Date(b.expiryDate).getTime()
					: Number.MAX_SAFE_INTEGER;
				return aExp - bExp;
			});
			break;
		default:
			sorted.sort((a, b) => byUpdatedAt(a, b, true));
			break;
	}
	return sorted;
}
