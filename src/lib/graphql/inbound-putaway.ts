import { gql } from "graphql-request";

export const SUGGEST_INBOUND_RACK_QUERY = gql`
	query SuggestInboundRack(
		$skuId: ID
		$skuCode: String
		$quantity: Float!
		$forRackId: ID
	) {
		suggestInboundRack(
			skuId: $skuId
			skuCode: $skuCode
			quantity: $quantity
			forRackId: $forRackId
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
			capacityForRack {
				rackId
				maxCapacity
				currentQuantity
				availableCapacity
			}
		}
	}
`;

export const SUGGEST_INBOUND_PUTAWAY_PLAN_QUERY = gql`
	query SuggestInboundPutawayPlan(
		$skuId: ID
		$skuCode: String
		$quantity: Float!
		$forRackId: ID
		$excludeRackIds: [ID!]
	) {
		suggestInboundPutawayPlan(
			skuId: $skuId
			skuCode: $skuCode
			quantity: $quantity
			forRackId: $forRackId
			excludeRackIds: $excludeRackIds
		) {
			totalAllocated
			remainingQty
			message
			defaultRackId
			capacityForRack {
				rackId
				maxCapacity
				currentQuantity
				availableCapacity
			}
			allocations {
				rackId
				rackLabel
				quantity
				maxCapacity
				availableCapacity
				source
			}
		}
	}
`;

export type RackSkuCapacityGql = {
	rackId: string;
	maxCapacity: number | null;
	currentQuantity: number;
	availableCapacity: number | null;
};

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
	capacityForRack: RackSkuCapacityGql | null;
};

export type InboundPutawayAllocationGql = {
	rackId: string;
	rackLabel: string;
	quantity: number;
	maxCapacity: number | null;
	availableCapacity: number | null;
	source: "DEFAULT" | "UNASSIGNED_EMPTY" | "FALLBACK";
};

export type InboundPutawayPlanGql = {
	allocations: InboundPutawayAllocationGql[];
	totalAllocated: number;
	remainingQty: number;
	message: string | null;
	defaultRackId: string | null;
	capacityForRack: RackSkuCapacityGql | null;
};

export type SuggestInboundRackQueryData = {
	suggestInboundRack: InboundRackSuggestionGql;
};

export type SuggestInboundPutawayPlanQueryData = {
	suggestInboundPutawayPlan: InboundPutawayPlanGql;
};

export type SuggestInboundRackQueryVariables = {
	skuId?: string | null;
	skuCode?: string | null;
	quantity: number;
	forRackId?: string | null;
};

export type SuggestInboundPutawayPlanQueryVariables = SuggestInboundRackQueryVariables & {
	excludeRackIds?: string[] | null;
};

export type GrnRackAllocationForm = {
	rackId: string;
	quantity: number;
	rackLabel?: string;
};

export const LIST_RACKS_WITH_CAPACITY_QUERY = gql`
	query ListRacksWithCapacity(
		$skuId: ID
		$skuCode: String
		$quantity: Float!
		$excludeRackIds: [ID!]
	) {
		listRacksWithCapacity(
			skuId: $skuId
			skuCode: $skuCode
			quantity: $quantity
			excludeRackIds: $excludeRackIds
		) {
			rackId
			rackRow
			rackLevel
			rackColumn
			availableCapacity
		}
	}
`;

export type RackCapacityOptionGql = {
	rackId: string;
	rackRow: string;
	rackLevel: string;
	rackColumn: string;
	availableCapacity: number | null;
};

export type ListRacksWithCapacityQueryData = {
	listRacksWithCapacity: RackCapacityOptionGql[];
};

export type ListRacksWithCapacityQueryVariables = {
	skuId?: string | null;
	skuCode?: string | null;
	quantity: number;
	excludeRackIds?: string[] | null;
};
