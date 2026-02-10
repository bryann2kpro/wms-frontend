import { gql } from "@apollo/client";

export const SKUS_QUERY = gql`
	query Skus {
		skus {
			skuId
			skuName
			skuDescription
			skuPrice
			skuQuantity
			skuUom
			isActive
		}
	}
`;

export const SKUS_AND_UOM_QUERY = gql`
	query SkusAndUom {
		skus {
			skuId
			skuCode
			skuDescription
		}
        stockUnits {
            query {
                stockUnitId
                unitCode
            }
        }
		
	}
`;

export const CREATE_SKU_MUTATION = gql`
	mutation CreateSku($input: CreateSkuInput!) {
		createSku(input: $input) {
			skuId
			skuName
			skuDescription
			skuPrice
			skuQuantity
			skuUom
			isActive
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

export type SkusQueryData = {
	skus: Sku[];
};

export type CreateSkuInput = {
	skuCode: string;
	skuDescription: string;
	skuQuantity: number;
	skuUom: string;
};
