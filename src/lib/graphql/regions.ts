import { gql } from "graphql-request";
import type {
	CreateRegionInput,
	Region,
	RegionPaginatedResponse,
	RegionPricing,
	UpdateRegionInput,
	UpsertRegionPricingInput,
} from "./types";

export const REGION_FRAGMENT = gql`
	fragment RegionFields on Region {
		regionId
		regionName
		regionCode
		createdAt
		updatedAt
		createdBy
		updatedBy
		pricing {
			id
			regionId
			rate
			minQty
			sstRate
			isActive
			updatedAt
		}
	}
`;

export const REGIONS_QUERY = gql`
	query Regions(
		$filter: RegionFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		regions(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...RegionFields
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
	${REGION_FRAGMENT}
`;

export const REGION_QUERY = gql`
	query Region($id: ID!) {
		region(id: $id) {
			...RegionFields
		}
	}
	${REGION_FRAGMENT}
`;

export const CREATE_REGION_MUTATION = gql`
	mutation CreateRegion($input: CreateRegionInput!) {
		createRegion(input: $input) {
			...RegionFields
		}
	}
	${REGION_FRAGMENT}
`;

export const UPDATE_REGION_MUTATION = gql`
	mutation UpdateRegion($id: ID!, $input: UpdateRegionInput!) {
		updateRegion(id: $id, input: $input) {
			...RegionFields
		}
	}
	${REGION_FRAGMENT}
`;

export const DELETE_REGION_MUTATION = gql`
	mutation DeleteRegion($id: ID!) {
		deleteRegion(id: $id)
	}
`;

export const UPSERT_REGION_PRICING_MUTATION = gql`
	mutation UpsertRegionPricing($regionId: ID!, $input: UpsertRegionPricingInput!) {
		upsertRegionPricing(regionId: $regionId, input: $input) {
			id
			regionId
			rate
			minQty
			sstRate
			isActive
			updatedAt
		}
	}
`;

export type RegionsQueryVariables = {
	filter?: {
		regionId?: string;
		regionIds?: string[];
		regionCode?: string;
		regionCodes?: string[];
		regionName?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type RegionsQueryData = {
	regions: RegionPaginatedResponse;
};

export type RegionQueryVariables = { id: string };
export type RegionQueryData = { region: Region | null };

export type CreateRegionMutationVariables = { input: CreateRegionInput };
export type CreateRegionMutationData = { createRegion: Region };

export type UpdateRegionMutationVariables = {
	id: string;
	input: UpdateRegionInput;
};
export type UpdateRegionMutationData = { updateRegion: Region | null };

export type DeleteRegionMutationVariables = { id: string };
export type DeleteRegionMutationData = { deleteRegion: boolean };

export type UpsertRegionPricingMutationVariables = {
	regionId: string;
	input: UpsertRegionPricingInput;
};
export type UpsertRegionPricingMutationData = {
	upsertRegionPricing: RegionPricing;
};
