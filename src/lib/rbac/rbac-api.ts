// RBAC API functions
import { getClient } from "@/lib/axios-v1";
import type {
	ModulesApiResponse,
	ModulesQueryParams,
	ModuleApiResponse,
	CreateModuleInput,
	UpdateModuleInput,
	RolesApiResponse,
	RolesQueryParams,
	UpdateRoleInput,
	RoleApiResponse,
	UserRolesApiResponse,
	UserRolesQueryParams,
	RolePermissionsApiResponse,
	RolePermissionsQueryParams,
	CreatePermissionInput,
	CreateRolePermissionInput,
	UpdateRolePermissionsInput,
	PermissionApiResponse,
	RolePermissionApiResponse,
	RolePermissionsUpdateApiResponse,
} from "./rbac-types";

/**
 * Build URLSearchParams from query object, filtering out undefined values
 */
function buildQueryParams(
	params: Record<string, string | number | undefined>,
): string {
	const queryParams = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== "") {
			queryParams.append(key, String(value));
		}
	});
	const queryString = queryParams.toString();
	return queryString ? `?${queryString}` : "";
}

/**
 * Fetch RBAC modules
 * GET /rbac/modules
 */
export async function fetchModules(
	params: ModulesQueryParams = {},
): Promise<ModulesApiResponse> {
	const client = getClient();

	const queryString = buildQueryParams({
		moduleId: params.moduleId,
		moduleName: params.moduleName,
		status: params.status,
		page: params.page,
		pageSize: params.pageSize,
	});

	const response = await client.get<ModulesApiResponse>(
		`/rbac/modules${queryString}`,
	);
	return response.data;
}

/**
 * Create a new RBAC module
 * POST /rbac/modules/create
 */
export async function createModule(
	input: CreateModuleInput,
): Promise<ModuleApiResponse> {
	const client = getClient();
	const response = await client.post<ModuleApiResponse>(
		"/rbac/modules/create",
		input,
	);
	if (!response.data.success) {
		throw new Error(response.data.message || "Failed to create module");
	}
	return response.data;
}

/**
 * Update an existing RBAC module
 * PUT /rbac/modules/update/:moduleId
 */
export async function updateModule(
	input: UpdateModuleInput,
): Promise<ModuleApiResponse> {
	const client = getClient();
	const { moduleId, ...body } = input;
	const response = await client.put<ModuleApiResponse>(
		`/rbac/modules/update/${moduleId}`,
		body,
	);
	return response.data;
}

/**
 * Fetch RBAC roles
 * GET /rbac/roles
 */
export async function fetchRoles(
	params: RolesQueryParams = {},
): Promise<RolesApiResponse> {
	const client = getClient();

	const queryString = buildQueryParams({
		roleId: params.roleId,
		roleName: params.roleName,
		status: params.status,
		page: params.page,
		pageSize: params.pageSize,
	});

	const response = await client.get<RolesApiResponse>(
		`/rbac/roles${queryString}`,
	);
	return response.data;
}

/**
 * Update an existing RBAC role
 * PUT /rbac/roles/update/:roleId
 *
 * @description Updates an existing role's details.
 */
export async function updateRole(
	input: UpdateRoleInput,
): Promise<RoleApiResponse> {
	const client = getClient();
	const { roleId, ...body } = input;
	const response = await client.put<RoleApiResponse>(
		`/rbac/roles/update/${roleId}`,
		body,
	);
	return response.data;
}

/**
 * Fetch RBAC user roles
 * GET /rbac/user-role
 */
export async function fetchUserRoles(
	params: UserRolesQueryParams = {},
): Promise<UserRolesApiResponse> {
	const client = getClient();

	const queryString = buildQueryParams({
		userId: params.userId,
		roleId: params.roleId,
		status: params.status,
		page: params.page,
		pageSize: params.pageSize,
	});

	const response = await client.get<UserRolesApiResponse>(
		`/rbac/user-role${queryString}`,
	);
	return response.data;
}

/**
 * Fetch RBAC role permissions
 * GET /rbac/role-permission
 */
export async function fetchRolePermissions(
	params: RolePermissionsQueryParams,
): Promise<RolePermissionsApiResponse> {
	const client = getClient();

	const queryString = buildQueryParams({
		roleId: params.roleId,
		permissionId: params.permissionId,
		pageSize: params.pageSize,
		pageNumber: params.pageNumber,
	});

	const response = await client.get<RolePermissionsApiResponse>(
		`/rbac/role-permission${queryString}`,
	);
	return response.data;
}

/**
 * Create a single role permission
 * POST /rbac/role-permission/create
 *
 * @description Creates a new role permission assignment.
 */
export async function createRolePermission(
	input: CreateRolePermissionInput,
): Promise<RolePermissionApiResponse> {
	const client = getClient();
	const response = await client.post<RolePermissionApiResponse>(
		"/rbac/role-permission/create",
		input,
	);
	return response.data;
}

/**
 * Create a permission for a module
 * POST /rbac/permissions/create
 */
export async function createPermission(
	input: CreatePermissionInput,
): Promise<PermissionApiResponse> {
	const client = getClient();
	const response = await client.post<PermissionApiResponse>(
		"/rbac/permissions/create",
		input,
	);
	return response.data;
}

/**
 * Update (sync) all permissions for a role
 * PUT /rbac/role-permission/update/:roleId
 *
 * @description Replaces all existing permissions with the provided list.
 * Permissions not in the list will be removed.
 */
export async function updateRolePermissions(
	input: UpdateRolePermissionsInput,
): Promise<RolePermissionsUpdateApiResponse> {
	const client = getClient();
	const { roleId, ...body } = input;
	const response = await client.put<RolePermissionsUpdateApiResponse>(
		`/rbac/role-permission/update/${roleId}`,
		body,
	);
	return response.data;
}
