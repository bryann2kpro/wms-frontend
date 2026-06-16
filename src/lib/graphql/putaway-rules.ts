import { gql } from "graphql-request";
import type {
	PutawayRule,
	PutawayRulePaginatedResponse,
	CreatePutawayRuleInput,
	UpdatePutawayRuleInput,
} from "./types";

export const PUTAWAY_RULE_FRAGMENT = gql`
	fragment PutawayRuleFields on PutawayRule {
		putawayRuleId
		warehouseId
		itemAttributeKey
		itemAttributeValue
		targetZonePurpose
		priority
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const PUTAWAY_RULES_QUERY = gql`
	query PutawayRules(
		$filter: PutawayRuleFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		putawayRules(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...PutawayRuleFields
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
	${PUTAWAY_RULE_FRAGMENT}
`;

export const CREATE_PUTAWAY_RULE_MUTATION = gql`
	mutation CreatePutawayRule($input: CreatePutawayRuleInput!) {
		createPutawayRule(input: $input) {
			...PutawayRuleFields
		}
	}
	${PUTAWAY_RULE_FRAGMENT}
`;

export const UPDATE_PUTAWAY_RULE_MUTATION = gql`
	mutation UpdatePutawayRule($id: ID!, $input: UpdatePutawayRuleInput!) {
		updatePutawayRule(id: $id, input: $input) {
			...PutawayRuleFields
		}
	}
	${PUTAWAY_RULE_FRAGMENT}
`;

export const DELETE_PUTAWAY_RULE_MUTATION = gql`
	mutation DeletePutawayRule($id: ID!) {
		deletePutawayRule(id: $id)
	}
`;

export type PutawayRulesQueryVariables = {
	filter?: {
		putawayRuleId?: string;
		warehouseId?: string;
		targetZonePurpose?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type PutawayRulesQueryData = {
	putawayRules: PutawayRulePaginatedResponse;
};

export type CreatePutawayRuleMutationVariables = { input: CreatePutawayRuleInput };
export type CreatePutawayRuleMutationData = { createPutawayRule: PutawayRule };

export type UpdatePutawayRuleMutationVariables = { id: string; input: UpdatePutawayRuleInput };
export type UpdatePutawayRuleMutationData = { updatePutawayRule: PutawayRule | null };

export type DeletePutawayRuleMutationVariables = { id: string };
export type DeletePutawayRuleMutationData = { deletePutawayRule: boolean };
