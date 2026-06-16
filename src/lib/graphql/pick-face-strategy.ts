import { gql } from "graphql-request";

export type PickFaceStrategy = {
	id: string;
	skuId: string;
	storageBinId: string;
	binType: string;
	itemCode: string;
	storageBin: string | null;
	skuDescription: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
};

export type PickFaceStrategyPaginatedResponse = {
	query: PickFaceStrategy[];
	pagination: {
		count: number;
		totalCount: number;
		currentPage: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPrevPage: boolean;
	};
};

export const PICK_FACE_STRATEGY_FRAGMENT = gql`
	fragment PickFaceStrategyFields on PickFaceStrategy {
		id
		skuId
		storageBinId
		binType
		itemCode
		storageBin
		skuDescription
		isActive
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const PICK_FACE_STRATEGIES_QUERY = gql`
	query PickFaceStrategies(
		$filter: PickFaceStrategyFilterInput
		$sort: PickFaceStrategySortInput
		$pageSize: Int
		$pageNumber: Int
	) {
		pickFaceStrategies(
			filter: $filter
			sort: $sort
			pageSize: $pageSize
			pageNumber: $pageNumber
		) {
			query {
				...PickFaceStrategyFields
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
	${PICK_FACE_STRATEGY_FRAGMENT}
`;

export const CREATE_PICK_FACE_STRATEGY_MUTATION = gql`
	mutation CreatePickFaceStrategy($input: CreatePickFaceStrategyInput!) {
		createPickFaceStrategy(input: $input) {
			...PickFaceStrategyFields
		}
	}
	${PICK_FACE_STRATEGY_FRAGMENT}
`;

export const UPDATE_PICK_FACE_STRATEGY_MUTATION = gql`
	mutation UpdatePickFaceStrategy(
		$id: ID!
		$input: UpdatePickFaceStrategyInput!
	) {
		updatePickFaceStrategy(id: $id, input: $input) {
			...PickFaceStrategyFields
		}
	}
	${PICK_FACE_STRATEGY_FRAGMENT}
`;

export const DELETE_PICK_FACE_STRATEGY_MUTATION = gql`
	mutation DeletePickFaceStrategy($id: ID!) {
		deletePickFaceStrategy(id: $id)
	}
`;

export type PickFaceStrategiesQueryVariables = {
	filter?: {
		id?: string;
		skuId?: string;
		storageBinId?: string;
		binType?: string;
		search?: string;
	};
	sort?: {
		sortBy?: string;
		sortOrder?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type PickFaceStrategiesQueryData = {
	pickFaceStrategies: PickFaceStrategyPaginatedResponse;
};

export type CreatePickFaceStrategyInput = {
	skuId: string;
	storageBinId: string;
	itemCode: string;
	binType?: string;
	createdBy: string;
	updatedBy: string;
};

export type UpdatePickFaceStrategyInput = {
	skuId?: string;
	storageBinId?: string;
	binType?: string;
	isActive?: boolean;
	updatedBy: string;
};

export type CreatePickFaceStrategyMutationData = {
	createPickFaceStrategy: PickFaceStrategy;
};
export type UpdatePickFaceStrategyMutationData = {
	updatePickFaceStrategy: PickFaceStrategy | null;
};
export type DeletePickFaceStrategyMutationData = {
	deletePickFaceStrategy: boolean;
};
