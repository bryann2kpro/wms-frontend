import { gql } from "graphql-request";
import type {
	Supplier,
	SupplierPaginatedResponse,
	CreateSupplierInput,
	UpdateSupplierInput,
} from "./types";

export const SUPPLIER_FRAGMENT = gql`
	fragment SupplierFields on Supplier {
		supplierId
		supplierName
		supplierCode
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const SUPPLIERS_QUERY = gql`
	query Suppliers(
		$filter: SupplierFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		suppliers(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...SupplierFields
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
	${SUPPLIER_FRAGMENT}
`;

export const SUPPLIER_QUERY = gql`
	query Supplier($id: ID!) {
		supplier(id: $id) {
			...SupplierFields
		}
	}
	${SUPPLIER_FRAGMENT}
`;

export const CREATE_SUPPLIER_MUTATION = gql`
	mutation CreateSupplier($input: CreateSupplierInput!) {
		createSupplier(input: $input) {
			...SupplierFields
		}
	}
	${SUPPLIER_FRAGMENT}
`;

export const UPDATE_SUPPLIER_MUTATION = gql`
	mutation UpdateSupplier($id: ID!, $input: UpdateSupplierInput!) {
		updateSupplier(id: $id, input: $input) {
			...SupplierFields
		}
	}
	${SUPPLIER_FRAGMENT}
`;

export const DELETE_SUPPLIER_MUTATION = gql`
	mutation DeleteSupplier($id: ID!) {
		deleteSupplier(id: $id)
	}
`;

export type SuppliersQueryVariables = {
	filter?: {
		supplierId?: string;
		supplierIds?: string[];
		supplierCode?: string;
		supplierCodes?: string[];
		supplierName?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type SuppliersQueryData = {
	suppliers: SupplierPaginatedResponse;
};

export type SupplierQueryVariables = { id: string };
export type SupplierQueryData = { supplier: Supplier | null };

export type CreateSupplierMutationVariables = { input: CreateSupplierInput };
export type CreateSupplierMutationData = { createSupplier: Supplier };

export type UpdateSupplierMutationVariables = {
	id: string;
	input: UpdateSupplierInput;
};
export type UpdateSupplierMutationData = { updateSupplier: Supplier | null };

export type DeleteSupplierMutationVariables = { id: string };
export type DeleteSupplierMutationData = { deleteSupplier: boolean };
