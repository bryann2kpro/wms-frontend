import { gql } from "@apollo/client";
import type {
	Skus,
	SkusPaginatedResponse,
	createSkusInput,
	UpdateSkusInput,
} from "./types";

export const SKUS_QUERY = gql`
	query Skus {
		skus {
			query {
				skuId
				skuCode
				skuDescription
				skuPrice
				skuQuantity
				skuExpiryDate
				skuUom
				isActive
			}
		}
	}
`;

export const SKUS_AND_UOM_QUERY = gql`
	query SkusAndUom {
		skus {
			query {
				skuId
				skuCode
				skuDescription
				skuUom
				isActive
			}
		}
		stockUnits {
			query {
				stockUnitId
				unitCode
			}
		}
	}
`;

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

export const CREATE_SKU_MUTATION = gql`
	mutation CreateSku($input: CreateSkuInput!) {
		createSku(input: $input) {
			skuCode
			skuDescription
			skuQuantity
			skuUom
		}
	}
`;

export type Sku = {
	skuId: string;
	skuName: string;
	skuDescription: string;
	skuCode: string;
	skuQuantity: number;
	skuUom: string;
	skuExpiryDate: string;
};

// export type SkusQueryData = {
// 	skus: Sku[];
// };

export type CreateSkuInput = {
	skuCode: string;
	skuDescription: string;
	skuQuantity: number;
	skuUom: string;
};