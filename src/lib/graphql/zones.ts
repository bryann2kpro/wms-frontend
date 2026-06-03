import { gql } from "graphql-request";
import type {
	Zone,
	ZonePaginatedResponse,
	CreateZoneInput,
	UpdateZoneInput,
} from "./types";

export const ZONE_FRAGMENT = gql`
	fragment ZoneFields on Zone {
		zoneId
		warehouseId
		zoneCode
		zoneName
		purpose
		warehouseName
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const ZONES_QUERY = gql`
	query Zones(
		$filter: ZoneFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		zones(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...ZoneFields
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
	${ZONE_FRAGMENT}
`;

export const ZONE_QUERY = gql`
	query Zone($id: ID!) {
		zone(id: $id) {
			...ZoneFields
		}
	}
	${ZONE_FRAGMENT}
`;

export const CREATE_ZONE_MUTATION = gql`
	mutation CreateZone($input: CreateZoneInput!) {
		createZone(input: $input) {
			...ZoneFields
		}
	}
	${ZONE_FRAGMENT}
`;

export const UPDATE_ZONE_MUTATION = gql`
	mutation UpdateZone($id: ID!, $input: UpdateZoneInput!) {
		updateZone(id: $id, input: $input) {
			...ZoneFields
		}
	}
	${ZONE_FRAGMENT}
`;

export const DELETE_ZONE_MUTATION = gql`
	mutation DeleteZone($id: ID!) {
		deleteZone(id: $id)
	}
`;

export type ZonesQueryVariables = {
	filter?: {
		zoneId?: string;
		warehouseId?: string;
		purpose?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type ZonesQueryData = {
	zones: ZonePaginatedResponse;
};

export type ZoneQueryVariables = { id: string };
export type ZoneQueryData = { zone: Zone | null };

export type CreateZoneMutationVariables = { input: CreateZoneInput };
export type CreateZoneMutationData = { createZone: Zone };

export type UpdateZoneMutationVariables = { id: string; input: UpdateZoneInput };
export type UpdateZoneMutationData = { updateZone: Zone | null };

export type DeleteZoneMutationVariables = { id: string };
export type DeleteZoneMutationData = { deleteZone: boolean };
