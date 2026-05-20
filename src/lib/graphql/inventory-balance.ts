import { gql } from "@apollo/client";
import type { Pagination } from "./types";

export const INVENTORY_BALANCES_QUERY = gql`
	query GetInventoryBalances(
		$filter: InventoryBalanceFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		inventoryBalances(
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
				id
				skuId
				skuCode
				skuDescription
				pickingStrategy
				isExpiryControlled
				skuExpiryDate
				onHandQty
				lossQty
				reservedQty
				updatedAt
				unitCode
				unitName
			}
		}
	}
`;

export type InventoryBalanceFilterInput = {
	skuId?: string;
	skuIds?: string[];
	skuCode?: string;
	skuCodes?: string[];
	search?: string;
};

export interface InventoryBalance {
	id: string;
	skuId: string;
	skuCode: string;
	skuDescription: string;
	pickingStrategy: string;
	isExpiryControlled: boolean;
	skuExpiryDate: string | null;
	onHandQty: string;
	lossQty: string;
	reservedQty: string;
	updatedAt: string;
	unitCode: string | null;
	unitName: string | null;
}

export interface InventoryBalancePaginatedResponse {
	query: InventoryBalance[];
	pagination: Pagination;
}

export type InventoryBalancesQueryData = {
	inventoryBalances: InventoryBalancePaginatedResponse;
};

export type InventoryBalancesQueryVariables = {
	filter?: InventoryBalanceFilterInput;
	pageSize?: number;
	pageNumber?: number;
};

/** Derived fields computed from raw balance strings */
export function getAvailableQty(balance: InventoryBalance): number {
	const onHand = Number(balance.onHandQty ?? "0");
	const reserved = Number(balance.reservedQty ?? "0");
	return Math.max(0, onHand - reserved);
}
