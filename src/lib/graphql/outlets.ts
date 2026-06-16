import { gql } from "graphql-request";
import type {
	Outlet,
	OutletPaginatedResponse,
	CreateOutletInput,
	UpdateOutletInput,
} from "./types";

export const OUTLET_FRAGMENT = gql`
	fragment OutletFields on Outlet {
		outletId
		outletName
		outletCode
		address
		regionId
		regionName
		regionCode
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const OUTLETS_QUERY = gql`
	query Outlets(
		$filter: OutletFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		outlets(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...OutletFields
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
	${OUTLET_FRAGMENT}
`;

export const CREATE_OUTLET_MUTATION = gql`
	mutation CreateOutlet($input: CreateOutletInput!) {
		createOutlet(input: $input) {
			...OutletFields
		}
	}
	${OUTLET_FRAGMENT}
`;

export const UPDATE_OUTLET_MUTATION = gql`
	mutation UpdateOutlet($id: ID!, $input: UpdateOutletInput!) {
		updateOutlet(id: $id, input: $input) {
			...OutletFields
		}
	}
	${OUTLET_FRAGMENT}
`;

export const DELETE_OUTLET_MUTATION = gql`
	mutation DeleteOutlet($id: ID!) {
		deleteOutlet(id: $id)
	}
`;

export type OutletsQueryVariables = {
	filter?: {
		outletId?: string;
		outletIds?: string[];
		outletCode?: string;
		outletCodes?: string[];
		outletName?: string;
		regionId?: string;
		regionIds?: string[];
		unassignedOnly?: boolean;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type OutletsQueryData = {
	outlets: OutletPaginatedResponse;
};

export type CreateOutletMutationVariables = { input: CreateOutletInput };
export type CreateOutletMutationData = { createOutlet: Outlet };

export type UpdateOutletMutationVariables = {
	id: string;
	input: UpdateOutletInput;
};
export type UpdateOutletMutationData = { updateOutlet: Outlet | null };

export type DeleteOutletMutationVariables = { id: string };
export type DeleteOutletMutationData = { deleteOutlet: boolean };
