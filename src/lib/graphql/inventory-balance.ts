import { gql } from "graphql-request";
import type { Pagination } from "./types";

/** Display label for lot_no on inventory lot balance rows. */
export function formatLotNoDisplay(lotNo: string | null | undefined): string {
	const trimmed = (lotNo ?? "").trim();
	return trimmed === "" ? "No lot" : trimmed;
}

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

export const INVENTORY_LOT_BALANCES_QUERY = gql`
	query GetInventoryLotBalances(
		$filter: InventoryBalanceFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		inventoryLotBalances(
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
				lotKey
				lotNo
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

export interface InventoryLotBalance extends InventoryBalance {
	lotKey: string;
	lotNo: string | null;
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

export interface InventoryLotBalancePaginatedResponse {
	query: InventoryLotBalance[];
	pagination: Pagination;
}

export type InventoryLotBalancesQueryData = {
	inventoryLotBalances: InventoryLotBalancePaginatedResponse;
};

export type InventoryLotBalancesQueryVariables = InventoryBalancesQueryVariables;

/** Derived fields computed from raw balance strings */
export function getAvailableQty(balance: InventoryBalance): number {
	const onHand = Number(balance.onHandQty ?? "0");
	const reserved = Number(balance.reservedQty ?? "0");
	return Math.max(0, onHand - reserved);
}
