// RBAC API Types

import type { Pagination } from "../pagination/pagination";

/**
 * Permission within a module
 */
export interface ModulePermission {
	moduleId: string;
	permissionId: string;
	permissionType: "View" | "Read" | "Create" | "Update" | "Delete" | "Approve";
	description: string;
}

/**
 * Module entity representing a feature/module in the system
 */
export interface RbacModule {
	moduleId: string;
	moduleName: string;
	permission: ModulePermission[];
	status: "active" | "inactive";
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

/**
 * API Response for modules endpoint
 */
export interface ModulesApiResponse {
	success: boolean;
	message: string;
	pagination: Pagination;
	data: RbacModule[];
}

/**
 * Query parameters for fetching modules
 */
export interface ModulesQueryParams {
	moduleId?: string;
	moduleName?: string;
	status?: "active" | "inactive";
	page?: number;
	pageSize?: number;
}

/**
 * Input for creating a new module
 */
export interface CreateModuleInput {
	moduleName: string;
	status?: "active" | "inactive";
	createdBy: string;
	updatedBy: string;
}

/**
 * Input for updating an existing module
 */
export interface UpdateModuleInput {
	moduleId: string;
	moduleName?: string;
	status?: "active" | "inactive";
	updatedBy: string;
}

/**
 * API Response for single module operations (create/update)
 */
export interface ModuleApiResponse {
	success: boolean;
	message: string;
	data: RbacModule;
}

/**
 * Role entity
 */
export interface RbacRole {
	roleId: string;
	roleName: string;
	status: "active" | "inactive";
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

/**
 * API Response for roles endpoint
 */
export interface RolesApiResponse {
	success: boolean;
	message: string;
	pagination: Pagination;
	data: RbacRole[];
}

/**
 * Query parameters for fetching roles
 */
export interface RolesQueryParams {
	roleId?: string;
	roleName?: string;
	status?: "active" | "inactive";
	page?: number;
	pageSize?: number;
}

/**
 * Input for updating an existing role
 * PUT /rbac/roles/update/:roleId
 */
export interface UpdateRoleInput {
	roleId: string;
	roleName?: string;
	status?: "active" | "inactive";
	updatedBy: string;
}

/**
 * API Response for single role operations (update)
 */
export interface RoleApiResponse {
	success: boolean;
	message: string;
	data: RbacRole;
}

/**
 * User Role assignment entity
 */
export interface RbacUserRole {
	id: string;
	userId: string;
	userName: string;
	roleId: string;
	roleName: string;
	status: "active" | "inactive";
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

/**
 * API Response for user roles endpoint
 */
export interface UserRolesApiResponse {
	success: boolean;
	message: string;
	pagination: Pagination;
	data: RbacUserRole[];
}

/**
 * Query parameters for fetching user roles
 */
export interface UserRolesQueryParams {
	userId?: string;
	roleId?: string;
	status?: "active" | "inactive";
	page?: number;
	pageSize?: number;
}

/**
 * Permission detail within a role permission module
 */
export interface RolePermissionDetail {
	id: string;
	roleId: string;
	permissionId: string;
	permissionType: "View" | "Read" | "Create" | "Update" | "Delete" | "Approve";
	moduleId: string;
	moduleName: string;
	hasPermission: boolean;
}

/**
 * Module with its permissions for a role
 */
export interface RolePermissionModule {
	module: string;
	permissions: RolePermissionDetail[];
}

/**
 * API Response for role permissions endpoint
 */
export interface RolePermissionsApiResponse {
	success: boolean;
	message: string;
	pagination: Pagination;
	data: RolePermissionModule[];
}

/**
 * Query parameters for fetching role permissions
 */
export interface RolePermissionsQueryParams {
	roleId: string;
	permissionId?: string;
	pageSize?: number;
	pageNumber?: number;
}

/**
 * Role Permission entity (returned from create/update)
 */
export interface RolePermission {
	id: string;
	roleId: string;
	permissionId: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
}

/**
 * Input for creating a single role permission
 * POST /rbac/role-permission/create
 */
export interface CreateRolePermissionInput {
	roleId: string;
	permissionId: string;
	createdBy: string;
	updatedBy: string;
}

/**
 * Input for creating a permission row under a module
 * POST /rbac/permissions/create
 */
export interface CreatePermissionInput {
	moduleId: string;
	permissionType: string;
	description?: string;
	status?: string;
	createdBy: string;
	updatedBy: string;
}

/**
 * Input for updating (syncing) all permissions for a role
 * PUT /rbac/role-permission/update/:roleId
 */
export interface UpdateRolePermissionsInput {
	roleId: string;
	permissionIds: string[];
	updatedBy: string;
}

/**
 * API Response for single role permission operations
 */
export interface RolePermissionApiResponse {
	success: boolean;
	message: string;
	data: RolePermission;
}

/**
 * API Response for single permission operations
 */
export interface PermissionApiResponse {
	success: boolean;
	message: string;
	data: {
		permissionId: string;
		moduleId: string;
		permissionType: string;
		status: string;
		description?: string | null;
	};
}

/**
 * API Response for bulk role permission update
 */
export interface RolePermissionsUpdateApiResponse {
	success: boolean;
	message: string;
	data: RolePermission[];
}
