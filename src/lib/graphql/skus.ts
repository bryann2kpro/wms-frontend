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
			skuName
			skuDescription

		}
		uom {
			uomId
			uomCode
			uomName
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
	skuName: string;
	skuDescription: string;
	skuCode: string;
	skuQuantity: number;
	skuUom: string;
	skuExpiryDate?: string | null;
};
