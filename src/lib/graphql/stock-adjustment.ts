import { gql } from "graphql-request";
import type { Pagination } from "./types";

// ============================================
// QUERIES
// ============================================

export const STOCK_ADJUSTMENTS_QUERY = gql`
	query StockAdjustments(
		$filter: StockAdjustmentFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		stockAdjustments(
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
				adjustmentNo
				reason
				notes
				createdAt
				updatedAt
				createdByUser {
					id
					displayName
				}
				items {
					id
					skuId
					skuCode
					skuDescription
					rackId
					rack {
						rackId
						rackRow
						rackColumn
						rackLevel
					}
					lotNo
					expiryDate
					movementType
					quantity
					remarks
					createdAt
				}
			}
		}
	}
`;

// ============================================
// MUTATIONS
// ============================================

export const CREATE_STOCK_ADJUSTMENT_MUTATION = gql`
	mutation CreateStockAdjustment($input: CreateStockAdjustmentInput!) {
		createStockAdjustment(input: $input) {
			id
			adjustmentNo
			reason
			notes
			createdAt
			items {
				id
				skuId
				skuCode
				skuDescription
				rackId
				rack {
					rackId
					rackRow
					rackColumn
					rackLevel
				}
				lotNo
				expiryDate
				movementType
				quantity
				remarks
			}
		}
	}
`;

// ============================================
// TYPES
// ============================================

export interface StockAdjustmentItemRack {
	rackId: string;
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
}

export interface StockAdjustmentItem {
	id: string;
	skuId: string;
	skuCode: string | null;
	skuDescription: string | null;
	rackId: string | null;
	rack: StockAdjustmentItemRack | null;
	lotNo: string | null;
	expiryDate: string | null;
	movementType: string;
	quantity: string;
	remarks: string | null;
	createdAt: string;
}

export interface StockAdjustment {
	id: string;
	adjustmentNo: string;
	reason: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
	createdByUser: { id: string; displayName: string } | null;
	items: StockAdjustmentItem[];
}

export interface StockAdjustmentPaginatedResponse {
	query: StockAdjustment[];
	pagination: Pagination;
}

export type StockAdjustmentsQueryData = {
	stockAdjustments: StockAdjustmentPaginatedResponse;
};
