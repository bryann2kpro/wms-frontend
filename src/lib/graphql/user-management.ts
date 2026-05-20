/**
 * User Management – GraphQL operations and types
 *
 * Best-practice pattern for this codebase:
 * 1. Define a fragment for the entity fields so they can be reused (list + single-item queries).
 * 2. Compose the list query with filter/sort/pagination and spread the fragment.
 * 3. Export TypeScript types that match the fragment and query response for type-safe use in components.
 * 4. Keep variable types aligned with the backend schema (UserFilter, UserSort, PaginationInput).
 *
 * Usage: useQuery<UsersQueryData, UsersQueryVariables>(USERS_QUERY, { variables })
 */

import { gql } from "graphql-request";
import type { Pagination } from "@/lib/graphql/types";

// ---------------------------------------------------------------------------
// Fragment (reusable for users list and future user(id) / userByEmail queries)
// ---------------------------------------------------------------------------

/**
 * Fields for User in list views. Spread this in any query that returns User(s).
 * Add/remove fields here to keep all user queries in sync.
 */
export const USER_LIST_FRAGMENT = gql`
	fragment UserListFields on User {
		id
		displayName
		email
		isActive
		roles {
			roleId
			roleName
		}
	}
`;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Paginated list of users with optional filter, sort, and pagination.
 * Backend returns { data, pagination } (UsersResponse); pagination has no "count" (PaginationInfo).
 */
export const USERS_QUERY = gql`
	query Users(
		$filter: UserFilter
		$sort: UserSort
		$pagination: PaginationInput
	) {
		users(filter: $filter, sort: $sort, pagination: $pagination) {
			data {
				...UserListFields
			}
			pagination {
				currentPage
				pageSize
				totalCount
				totalPages
				hasNextPage
				hasPrevPage
			}
		}
	}
	${USER_LIST_FRAGMENT}
`;

/**
 * Fetch roles for create/edit user dropdowns (roleId required by backend createUser/updateUser).
 * Frontend hides "Super Admin" from the list so it cannot be assigned via UI.
 */
export const ROLES_QUERY = gql`
	query Roles {
		roles {
			roleId
			roleName
		}
	}
`;

/**
 * Create a new user. Backend requires password (hashed server-side) and roleId.
 */
export const CREATE_USER_MUTATION = gql`
	mutation CreateUser($input: CreateUserInput!) {
		createUser(input: $input) {
			...UserListFields
		}
	}
	${USER_LIST_FRAGMENT}
`;

/**
 * Update an existing user. Only provided fields are updated (displayName, contactNo, isActive, roleId, password).
 */
export const UPDATE_USER_MUTATION = gql`
	mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
		updateUser(id: $id, input: $input) {
			...UserListFields
		}
	}
	${USER_LIST_FRAGMENT}
`;

// ---------------------------------------------------------------------------
// Types (match backend schema and fragment fields)
// ---------------------------------------------------------------------------

/** Backend UserRoleInfo – role attached to a user. */
export interface UserRoleInfo {
	roleId: string;
	roleName: string;
}

/**
 * User as returned by USERS_QUERY (and any query using UserListFields).
 * Optional contactNo for when other operations return it; not requested in list fragment.
 */
export interface User {
	id: string;
	email: string;
	displayName: string;
	isActive: boolean;
	roles: UserRoleInfo[];
	contactNo?: string | null;
}

/** Variables for USERS_QUERY. Align with backend UserFilter, UserSort, PaginationInput. */
export type UsersQueryVariables = {
	filter?: {
		email?: string;
		displayName?: string;
		isActive?: boolean;
		roleId?: string;
	};
	sort?: { field?: string; direction?: string };
	pagination?: { page?: number; pageSize?: number };
};

/** Response shape of USERS_QUERY. Backend uses PaginationInfo (no count). */
export type UsersQueryData = {
	users: {
		data: User[];
		pagination: Omit<Pagination, "count">;
	};
};

/** Role from ROLES_QUERY (RBAC). Used for create/edit user dropdowns (roleId required by backend). */
export interface RoleOption {
	roleId: string;
	roleName: string;
}

export type RolesQueryData = { roles: RoleOption[] };

/** Backend CreateUserInput. Password is required (backend hashes it). */
export type CreateUserInputGql = {
	email: string;
	displayName: string;
	password: string;
	roleId: string;
	contactNo?: string | null;
};

export type CreateUserMutationVariables = { input: CreateUserInputGql };
export type CreateUserMutationData = { createUser: User };

/** Backend UpdateUserInput. Only provided fields are updated. */
export type UpdateUserInputGql = {
	displayName?: string | null;
	contactNo?: string | null;
	isActive?: boolean | null;
	roleId?: string | null;
	password?: string | null;
};

export type UpdateUserMutationVariables = {
	id: string;
	input: UpdateUserInputGql;
};
export type UpdateUserMutationData = { updateUser: User | null };
