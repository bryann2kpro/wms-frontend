import { gql } from "graphql-request";
import type {
	Bin,
	BinPaginatedResponse,
	CreateBinInput,
	UpdateBinInput,
} from "./types";

export const BIN_FRAGMENT = gql`
	fragment BinFields on Bin {
		binId
		rackId
		binCode
		level
		column
		capacityVolume
		capacityWeight
		currentVolume
		currentWeight
		isPickFace
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const BINS_QUERY = gql`
	query Bins(
		$filter: BinFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		bins(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...BinFields
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
	${BIN_FRAGMENT}
`;

export const BIN_QUERY = gql`
	query Bin($id: ID!) {
		bin(id: $id) {
			...BinFields
		}
	}
	${BIN_FRAGMENT}
`;

export const CREATE_BIN_MUTATION = gql`
	mutation CreateBin($input: CreateBinInput!) {
		createBin(input: $input) {
			...BinFields
		}
	}
	${BIN_FRAGMENT}
`;

export const UPDATE_BIN_MUTATION = gql`
	mutation UpdateBin($id: ID!, $input: UpdateBinInput!) {
		updateBin(id: $id, input: $input) {
			...BinFields
		}
	}
	${BIN_FRAGMENT}
`;

export const DELETE_BIN_MUTATION = gql`
	mutation DeleteBin($id: ID!) {
		deleteBin(id: $id)
	}
`;

export type BinsQueryVariables = {
	filter?: {
		binId?: string;
		rackId?: string;
		rackIds?: string[];
		isPickFace?: boolean;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type BinsQueryData = {
	bins: BinPaginatedResponse;
};

export type BinQueryVariables = { id: string };
export type BinQueryData = { bin: Bin | null };

export type CreateBinMutationVariables = { input: CreateBinInput };
export type CreateBinMutationData = { createBin: Bin };

export type UpdateBinMutationVariables = { id: string; input: UpdateBinInput };
export type UpdateBinMutationData = { updateBin: Bin | null };

export type DeleteBinMutationVariables = { id: string };
export type DeleteBinMutationData = { deleteBin: boolean };
