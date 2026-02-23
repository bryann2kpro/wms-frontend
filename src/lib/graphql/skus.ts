import { gql } from "@apollo/client";
import type {
	Skus,
	SkusPaginatedResponse,
	createSkusInput,
	UpdateSkusInput,
} from "./types";

export const SKUS_FRAGMENT = gql`
	fragment SkuFields on Sku {
		skuId
		skuCode
		skuDescription
		skuPrice
		skuQuantity
		skuExpiryDate
		skuSuppliers {
			supplierId
			originalSkuCode
		}
		skuUom
		isActive
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const SKUS_QUERY = gql`
	query Skus {
		skus {
			query {
				...SkuFields
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
	${SKUS_FRAGMENT}
`;

export const SKU_QUERY = gql`
	query Sku($id: ID!) {
		sku(id: $id) {
			...SkuFields
		}
	}
	${SKUS_FRAGMENT}
`;

export const CREATE_SKUS_MUTATION = gql`
	mutation CreateSku($input: CreateSkuInput!) {
		createSku(input: $input) {
			...SkuFields
		}
	}
	${SKUS_FRAGMENT}
`;

export const UPDATE_SKUS_MUTATION = gql`
	mutation UpdateSku($id: ID!, $input: UpdateSkuInput!) {
		updateSku(id: $id, input: $input) {
			...SkuFields
		}
	}
	${SKUS_FRAGMENT}
`;

export const DELETE_SKUS_MUTATION = gql`
	mutation DeleteSku($id: ID!) {
		deleteSku(id: $id)
	}
`;

export type SkusQueryVariables = {};

export type SkusQueryData = {
	skus: SkusPaginatedResponse;
};

export type SkuQueryVariables = { id: string };
export type SkuQueryData = { sku: Skus | null };

export type CreateSkusMutationVariables = { input: createSkusInput };
export type CreateSkusMutationData = { createSku: Skus };

export type UpdateSkusMutationVariables = {
	id: string;
	input: UpdateSkusInput;
};
export type UpdateSkusMutationData = { updateSku: Skus | null };

export type DeleteSkusMutationVariables = { id: string };
export type DeleteSkusMutationData = { deleteSku: boolean };

