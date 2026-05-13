import { gql } from "graphql-request";
import type {
	Rack,
	RackPaginatedResponse,
	CreateRackInput,
	UpdateRackInput,
} from "./types";

export const RACK_FRAGMENT = gql`
	fragment RackFields on Rack {
		rackId
		rackRow
		rackColumn
		rackLevel
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const RACKS_QUERY = gql`
	query Racks(
		$filter: RackFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		racks(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...RackFields
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
	${RACK_FRAGMENT}
`;

export const CREATE_RACK_MUTATION = gql`
	mutation CreateRack($input: CreateRackInput!) {
		createRack(input: $input) {
			...RackFields
		}
	}
	${RACK_FRAGMENT}
`;

export const UPDATE_RACK_MUTATION = gql`
	mutation UpdateRack($id: ID!, $input: UpdateRackInput!) {
		updateRack(id: $id, input: $input) {
			...RackFields
		}
	}
	${RACK_FRAGMENT}
`;

export const DELETE_RACK_MUTATION = gql`
	mutation DeleteRack($id: ID!) {
		deleteRack(id: $id)
	}
`;

export type RacksQueryVariables = {
	filter?: {
		rackId?: string;
		rackIds?: string[];
		rackRow?: string;
		rackRows?: string[];
		rackColumn?: string;
		rackColumns?: string[];
		rackLevel?: string;
		rackLevels?: string[];
	};
	pageSize?: number;
	pageNumber?: number;
};

export type RacksQueryData = {
	racks: RackPaginatedResponse;
};

export type CreateRackMutationVariables = { input: CreateRackInput };
export type CreateRackMutationData = { createRack: Rack };

export type UpdateRackMutationVariables = {
	id: string;
	input: UpdateRackInput;
};
export type UpdateRackMutationData = { updateRack: Rack | null };

export type DeleteRackMutationVariables = { id: string };
export type DeleteRackMutationData = { deleteRack: boolean };
