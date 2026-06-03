import { gql } from "graphql-request";
import type {
	StockUnit,
	StockUnitPaginatedResponse,
	CreateStockUnitInput,
	UpdateStockUnitInput,
} from "./types";

export const STOCK_UNIT_FRAGMENT = gql`
	fragment StockUnitFields on StockUnit {
		stockUnitId
		unitName
		unitCode
		isActive
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const STOCK_UNITS_QUERY = gql`
	query StockUnits(
		$filter: StockUnitFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		stockUnits(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...StockUnitFields
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
	${STOCK_UNIT_FRAGMENT}
`;

export const CREATE_STOCK_UNIT_MUTATION = gql`
	mutation CreateStockUnit($input: CreateStockUnitInput!) {
		createStockUnit(input: $input) {
			...StockUnitFields
		}
	}
	${STOCK_UNIT_FRAGMENT}
`;

export const UPDATE_STOCK_UNIT_MUTATION = gql`
	mutation UpdateStockUnit($id: ID!, $input: UpdateStockUnitInput!) {
		updateStockUnit(id: $id, input: $input) {
			...StockUnitFields
		}
	}
	${STOCK_UNIT_FRAGMENT}
`;

export const TOGGLE_STOCK_UNIT_ACTIVE_MUTATION = gql`
	mutation ToggleStockUnitActive(
		$id: ID!
		$isActive: Boolean!
		$updatedBy: String!
	) {
		toggleStockUnitActive(id: $id, isActive: $isActive, updatedBy: $updatedBy) {
			...StockUnitFields
		}
	}
	${STOCK_UNIT_FRAGMENT}
`;

export const DELETE_STOCK_UNIT_MUTATION = gql`
	mutation DeleteStockUnit($id: ID!) {
		deleteStockUnit(id: $id)
	}
`;

// Simple query without pagination (matches user's API format)
export const STOCK_UNITS_SIMPLE_QUERY = gql`
	query StockUnitsSimple {
		stockUnits {
			query {
				stockUnitId
				unitName
				unitCode
				isActive
				createdAt
				updatedAt
				createdBy
				updatedBy
			}
		}
	}
`;

export type StockUnitsSimpleQueryData = {
	stockUnits: {
		query: StockUnit[];
	};
};

export type StockUnitsQueryVariables = {
	filter?: {
		stockUnitId?: string;
		stockUnitIds?: string[];
		unitCode?: string;
		unitCodes?: string[];
		unitName?: string;
		isActive?: boolean;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type StockUnitsQueryData = {
	stockUnits: StockUnitPaginatedResponse;
};

export type CreateStockUnitMutationVariables = { input: CreateStockUnitInput };
export type CreateStockUnitMutationData = { createStockUnit: StockUnit };

export type UpdateStockUnitMutationVariables = {
	id: string;
	input: UpdateStockUnitInput;
};
export type UpdateStockUnitMutationData = { updateStockUnit: StockUnit | null };

export type ToggleStockUnitActiveMutationVariables = {
	id: string;
	isActive: boolean;
	updatedBy: string;
};
export type ToggleStockUnitActiveMutationData = {
	toggleStockUnitActive: StockUnit | null;
};

export type DeleteStockUnitMutationVariables = { id: string };
export type DeleteStockUnitMutationData = { deleteStockUnit: boolean };
