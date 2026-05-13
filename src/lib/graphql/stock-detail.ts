import { gql } from "graphql-request";

export const SKU_STOCK_DETAILS_QUERY = gql`
	query SkuStockDetails($skuId: ID!) {
		skuStockDetails(skuId: $skuId) {
			skuId
			details {
				lotNo
				expiryDate
				rackId
				rackRow
				rackColumn
				rackLevel
				onHandQty
				lossQty
				reservedQty
				firstInboundAt
			}
		}
	}
`;

export interface SkuStockDetail {
	lotNo: string | null;
	expiryDate: string | null;
	rackId: string | null;
	rackRow: string | null;
	rackColumn: string | null;
	rackLevel: string | null;
	onHandQty: string;
	lossQty: string;
	reservedQty: string;
	firstInboundAt: string | null;
}

export interface SkuStockDetailResponse {
	skuId: string;
	details: SkuStockDetail[];
}

export type SkuStockDetailsQueryData = {
	skuStockDetails: SkuStockDetailResponse;
};

export type SkuStockDetailsQueryVariables = {
	skuId: string;
};
