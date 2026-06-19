import { gql } from "graphql-request";
import type {
	Rack,
	RackPaginatedResponse,
	RackUtilization,
	CreateRackInput,
	UpdateRackInput,
} from "./types";

export const RACK_FRAGMENT = gql`
	fragment RackFields on Rack {
		rackId
		warehouseId
		zoneId
		areaId
		rackRow
		rackColumn
		rackLevel
		binCode
		barCode
		binType
		length
		width
		height
		weight
		maxPallet
		isActive
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const RACKS_QUERY = gql`
	query Racks(
		$filter: RackFilterInput
		$sort: RackSortInput
		$pageSize: Int
		$pageNumber: Int
	) {
		racks(filter: $filter, sort: $sort, pageSize: $pageSize, pageNumber: $pageNumber) {
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

export const RACK_UTILIZATION_QUERY = gql`
	query RackUtilization {
		rackUtilization {
			rackId
			volCapacity
			volCurrent
			weightCapacity
			weightCurrent
			cartonCount
		}
	}
`;

export type RackUtilizationQueryData = { rackUtilization: RackUtilization[] };

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
		warehouseId?: string;
		rackRow?: string;
		rackRows?: string[];
		rackColumn?: string;
		rackColumns?: string[];
		rackLevel?: string;
		rackLevels?: string[];
		binCode?: string;
		binType?: string;
		isActive?: boolean;
		search?: string;
	};
	sort?: {
		sortBy?: string;
		sortOrder?: string;
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
