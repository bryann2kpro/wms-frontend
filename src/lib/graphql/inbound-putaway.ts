import { gql } from "graphql-request";

export const SUGGEST_INBOUND_RACK_QUERY = gql`
	query SuggestInboundRack(
		$skuId: ID
		$skuCode: String
		$quantity: Float!
	) {
		suggestInboundRack(
			skuId: $skuId
			skuCode: $skuCode
			quantity: $quantity
		) {
			rackId
			rackLabel
			source
			defaultRackId
			isDefaultFull
			maxCapacity
			currentQuantity
			availableCapacity
			message
		}
	}
`;

export type InboundRackSuggestionGql = {
	rackId: string | null;
	rackLabel: string | null;
	source: "DEFAULT" | "FALLBACK_EMPTY" | "NONE";
	defaultRackId: string | null;
	isDefaultFull: boolean;
	maxCapacity: number | null;
	currentQuantity: number | null;
	availableCapacity: number | null;
	message: string | null;
};

export type SuggestInboundRackQueryData = {
	suggestInboundRack: InboundRackSuggestionGql;
};

export type SuggestInboundRackQueryVariables = {
	skuId?: string | null;
	skuCode?: string | null;
	quantity: number;
};
