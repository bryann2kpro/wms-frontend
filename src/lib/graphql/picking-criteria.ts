import { gql } from "graphql-request";
import type {
	PickingCriteria,
	PickingCriteriaPaginatedResponse,
	CreatePickingCriteriaInput,
	UpdatePickingCriteriaInput,
} from "./types";

export const PICKING_CRITERIA_FRAGMENT = gql`
	fragment PickingCriteriaFields on PickingCriteria {
		id
		userId
		category
		chain
		channel
		debtor
		deliveryPoint
		storageClass
		brand
		itemCategory
		manufacturer
		item
		minExpiryMonth
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const PICKING_CRITERIAS_QUERY = gql`
	query PickingCriterias(
		$filter: PickingCriteriaFilterInput
		$sort: PickingCriteriaSortInput
		$pageSize: Int
		$pageNumber: Int
	) {
		pickingCriterias(filter: $filter, sort: $sort, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...PickingCriteriaFields
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
	${PICKING_CRITERIA_FRAGMENT}
`;

export const CREATE_PICKING_CRITERIA_MUTATION = gql`
	mutation CreatePickingCriteria($input: CreatePickingCriteriaInput!) {
		createPickingCriteria(input: $input) {
			...PickingCriteriaFields
		}
	}
	${PICKING_CRITERIA_FRAGMENT}
`;

export const UPDATE_PICKING_CRITERIA_MUTATION = gql`
	mutation UpdatePickingCriteria($id: ID!, $input: UpdatePickingCriteriaInput!) {
		updatePickingCriteria(id: $id, input: $input) {
			...PickingCriteriaFields
		}
	}
	${PICKING_CRITERIA_FRAGMENT}
`;

export const DELETE_PICKING_CRITERIA_MUTATION = gql`
	mutation DeletePickingCriteria($id: ID!) {
		deletePickingCriteria(id: $id)
	}
`;

export type PickingCriteriasQueryVariables = {
	filter?: {
		id?: string;
		userId?: string;
		category?: string;
		chain?: string;
		channel?: string;
		debtor?: string;
		deliveryPoint?: string;
		storageClass?: string;
		brand?: string;
		itemCategory?: string;
		manufacturer?: string;
		item?: string;
	};
	sort?: {
		sortBy?: string;
		sortOrder?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type PickingCriteriasQueryData = {
	pickingCriterias: PickingCriteriaPaginatedResponse;
};

export type CreatePickingCriteriaMutationVariables = { input: CreatePickingCriteriaInput };
export type CreatePickingCriteriaMutationData = { createPickingCriteria: PickingCriteria };

export type UpdatePickingCriteriaMutationVariables = { id: string; input: UpdatePickingCriteriaInput };
export type UpdatePickingCriteriaMutationData = { updatePickingCriteria: PickingCriteria | null };

export type DeletePickingCriteriaMutationVariables = { id: string };
export type DeletePickingCriteriaMutationData = { deletePickingCriteria: boolean };
