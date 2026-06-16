import { gql } from "graphql-request";

export const CUSTOMER_PRIORITY_FRAGMENT = gql`
	fragment CustomerPriorityFields on CustomerPriority {
		id
		organizationId
		customerCode
		customerName
		rank
		isActive
		notes
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const CUSTOMER_PRIORITIES_QUERY = gql`
	query CustomerPriorities {
		customerPriorities {
			...CustomerPriorityFields
		}
	}
	${CUSTOMER_PRIORITY_FRAGMENT}
`;

export const UPSERT_CUSTOMER_PRIORITY_MUTATION = gql`
	mutation UpsertCustomerPriority($input: UpsertCustomerPriorityInput!) {
		upsertCustomerPriority(input: $input) {
			...CustomerPriorityFields
		}
	}
	${CUSTOMER_PRIORITY_FRAGMENT}
`;

export const REORDER_CUSTOMER_PRIORITIES_MUTATION = gql`
	mutation ReorderCustomerPriorities($ranking: [CustomerPriorityRankInput!]!) {
		reorderCustomerPriorities(ranking: $ranking) {
			...CustomerPriorityFields
		}
	}
	${CUSTOMER_PRIORITY_FRAGMENT}
`;

export interface CustomerPriority {
	id: string;
	organizationId: string;
	customerCode: string;
	customerName?: string | null;
	rank: number;
	isActive: boolean;
	notes?: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy?: string | null;
}

export type CustomerPrioritiesQueryData = {
	customerPriorities: CustomerPriority[];
};

export type UpsertCustomerPriorityInput = {
	customerCode: string;
	customerName?: string | null;
	rank?: number;
	isActive?: boolean;
	notes?: string | null;
};

export type UpsertCustomerPriorityMutationVariables = {
	input: UpsertCustomerPriorityInput;
};
export type UpsertCustomerPriorityMutationData = {
	upsertCustomerPriority: CustomerPriority;
};

export type ReorderCustomerPrioritiesMutationVariables = {
	ranking: Array<{ customerCode: string }>;
};
export type ReorderCustomerPrioritiesMutationData = {
	reorderCustomerPriorities: CustomerPriority[];
};
