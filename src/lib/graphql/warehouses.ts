import { gql } from "graphql-request";
import type {
	Warehouse,
	WarehousePaginatedResponse,
	CreateWarehouseInput,
	UpdateWarehouseInput,
} from "./types";

export const WAREHOUSE_FRAGMENT = gql`
	fragment WarehouseFields on Warehouse {
		warehouseId
		warehouseName
		warehouseCode
		warehouseAddress
		createdAt
		updatedAt
		createdBy
		updatedBy
		createdByUser {
			id
			displayName
		}
		updatedByUser {
			id
			displayName
		}
	}
`;

export const WAREHOUSES_QUERY = gql`
	query Warehouses(
		$filter: WarehouseFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		warehouses(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...WarehouseFields
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
	${WAREHOUSE_FRAGMENT}
`;

export const WAREHOUSE_QUERY = gql`
	query Warehouse($id: ID!) {
		warehouse(id: $id) {
			...WarehouseFields
		}
	}
	${WAREHOUSE_FRAGMENT}
`;

export const CREATE_WAREHOUSE_MUTATION = gql`
	mutation CreateWarehouse($input: CreateWarehouseInput!) {
		createWarehouse(input: $input) {
			...WarehouseFields
		}
	}
	${WAREHOUSE_FRAGMENT}
`;

export const UPDATE_WAREHOUSE_MUTATION = gql`
	mutation UpdateWarehouse($id: ID!, $input: UpdateWarehouseInput!) {
		updateWarehouse(id: $id, input: $input) {
			...WarehouseFields
		}
	}
	${WAREHOUSE_FRAGMENT}
`;

export const DELETE_WAREHOUSE_MUTATION = gql`
	mutation DeleteWarehouse($id: ID!) {
		deleteWarehouse(id: $id)
	}
`;

export type WarehousesQueryVariables = {
	filter?: {
		warehouseId?: string;
		warehouseIds?: string[];
		warehouseCode?: string;
		warehouseCodes?: string[];
		warehouseName?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type WarehousesQueryData = {
	warehouses: WarehousePaginatedResponse;
};

export type WarehouseQueryVariables = { id: string };
export type WarehouseQueryData = { warehouse: Warehouse | null };

export type CreateWarehouseMutationVariables = { input: CreateWarehouseInput };
export type CreateWarehouseMutationData = { createWarehouse: Warehouse };

export type UpdateWarehouseMutationVariables = {
	id: string;
	input: UpdateWarehouseInput;
};
export type UpdateWarehouseMutationData = { updateWarehouse: Warehouse | null };

export type DeleteWarehouseMutationVariables = { id: string };
export type DeleteWarehouseMutationData = { deleteWarehouse: boolean };
