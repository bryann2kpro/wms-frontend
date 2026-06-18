import { gql } from "graphql-request";
import type { EndUser, EndUserPaginatedResponse } from "./types";

const END_USER_FRAGMENT = gql`
	fragment EndUserFields on EndUser {
		endUserId
		userName
	}
`;

export const END_USERS_QUERY = gql`
	query EndUsers($filter: EndUserFilterInput, $pageSize: Int, $pageNumber: Int) {
		endUsers(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...EndUserFields
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
	${END_USER_FRAGMENT}
`;

export const CREATE_END_USER_MUTATION = gql`
	mutation CreateEndUser($input: CreateEndUserInput!) {
		createEndUser(input: $input) {
			...EndUserFields
		}
	}
	${END_USER_FRAGMENT}
`;

export const UPDATE_END_USER_MUTATION = gql`
	mutation UpdateEndUser($id: ID!, $input: UpdateEndUserInput!) {
		updateEndUser(id: $id, input: $input) {
			...EndUserFields
		}
	}
	${END_USER_FRAGMENT}
`;

export const DELETE_END_USER_MUTATION = gql`
	mutation DeleteEndUser($id: ID!) {
		deleteEndUser(id: $id)
	}
`;

export type EndUsersQueryVariables = {
	filter?: { userName?: string };
	pageSize?: number;
	pageNumber?: number;
};

export type EndUsersQueryData = { endUsers: EndUserPaginatedResponse };
export type CreateEndUserMutationData = { createEndUser: EndUser };
export type UpdateEndUserMutationData = { updateEndUser: EndUser | null };
export type DeleteEndUserMutationData = { deleteEndUser: boolean };
