import { gql } from "graphql-request";
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
				skuUom
				pickingStrategy
				isLotControlled
				isExpiryControlled
				looseQuantity
				skuSuppliers {
					supplierId
					originalSkuCode
				}
				isActive
			}
		}
	}
`;

export const SKUS_AND_UOM_QUERY = gql`
	query SkusAndUom(
		$filter: SkuFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		skus(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				skuId
				skuCode
				skuDescription
				skuUom
				isActive
			}
			pagination {
				currentPage
				hasNextPage
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

export type SkuSearchFilter = {
	skuCode?: string;
	skuCodes?: string[];
	skuDescription?: string;
};

export type SkusAndUomQueryVariables = {
	filter?: SkuSearchFilter;
	pageSize?: number;
	pageNumber?: number;
};

/** Code-like terms (e.g. RAW-E0012) search skuCode; others search skuDescription. */
const SKU_CODE_SEARCH_PATTERN = /^[A-Z0-9_-]+$/i;

export function buildSkuSearchFilter(
	searchTerm: string,
): SkuSearchFilter | undefined {
	const term = searchTerm.trim();
	if (!term) return undefined;
	return SKU_CODE_SEARCH_PATTERN.test(term)
		? { skuCode: term }
		: { skuDescription: term };
}

export type SkusAndUomQueryData = {
	skus: {
		query: Skus[];
		pagination: { currentPage: number; hasNextPage: boolean };
	};
	stockUnits: { query: { stockUnitId: string; unitCode: string }[] };
};

export const SKUS_FRAGMENT = gql`
	fragment SkuFields on Sku {
		skuId
		skuCode
		skuDescription
		skuExpiryDate
		skuSuppliers {
			supplierId
			originalSkuCode
		}
		skuUom
		pickingStrategy
		isLotControlled
		isExpiryControlled
		looseQuantity
		isActive
		barcode
		brand
		category
		manufacturer
		caseRate
		caseExtLengthMm
		caseExtWidthMm
		caseExtHeightMm
		caseGrossWeightKg
		casesPerLayer
		noOfLayers
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

export const ITEMS_QUERY = gql`
	query Items {
		skus {
			query {
				skuId
				skuCode
				skuDescription
				barcode
				brand
				category
				manufacturer
				isActive
				caseRate
				caseExtLengthMm
				caseExtWidthMm
				caseExtHeightMm
				caseGrossWeightKg
				casesPerLayer
				noOfLayers
				skuSuppliers {
					supplierId
					originalSkuCode
				}
				skuUom
				pickingStrategy
				isLotControlled
				isExpiryControlled
				createdAt
				updatedAt
			}
		}
	}
`;

export type ItemsQueryData = {
	skus: SkusPaginatedResponse;
};

export type ItemsQueryVariables = Record<string, never>;
