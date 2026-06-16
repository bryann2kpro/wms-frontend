import { gql } from "graphql-request";
import type {
	SetupArea,
	SetupAreaPaginatedResponse,
	CreateSetupAreaInput,
	UpdateSetupAreaInput,
} from "./types";

export const SETUP_AREA_FRAGMENT = gql`
	fragment SetupAreaFields on SetupArea {
		id
		code
		description
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const SETUP_AREAS_QUERY = gql`
	query SetupAreas(
		$filter: SetupAreaFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		setupAreas(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...SetupAreaFields
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
	${SETUP_AREA_FRAGMENT}
`;

export const CREATE_SETUP_AREA_MUTATION = gql`
	mutation CreateSetupArea($input: CreateSetupAreaInput!) {
		createSetupArea(input: $input) {
			...SetupAreaFields
		}
	}
	${SETUP_AREA_FRAGMENT}
`;

export const UPDATE_SETUP_AREA_MUTATION = gql`
	mutation UpdateSetupArea($id: ID!, $input: UpdateSetupAreaInput!) {
		updateSetupArea(id: $id, input: $input) {
			...SetupAreaFields
		}
	}
	${SETUP_AREA_FRAGMENT}
`;

export const DELETE_SETUP_AREA_MUTATION = gql`
	mutation DeleteSetupArea($id: ID!) {
		deleteSetupArea(id: $id)
	}
`;

export type SetupAreasQueryVariables = {
	filter?: {
		id?: string;
		code?: string;
		description?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type SetupAreasQueryData = {
	setupAreas: SetupAreaPaginatedResponse;
};

export type CreateSetupAreaMutationVariables = { input: CreateSetupAreaInput };
export type CreateSetupAreaMutationData = { createSetupArea: SetupArea };

export type UpdateSetupAreaMutationVariables = {
	id: string;
	input: UpdateSetupAreaInput;
};
export type UpdateSetupAreaMutationData = { updateSetupArea: SetupArea | null };

export type DeleteSetupAreaMutationVariables = { id: string };
export type DeleteSetupAreaMutationData = { deleteSetupArea: boolean };

export type { SetupArea };
