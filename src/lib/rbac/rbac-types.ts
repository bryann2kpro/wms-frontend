// RBAC API Types

/**
 * Common pagination structure for RBAC APIs
 */
export interface RbacPagination {
  count: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Permission within a module
 */
export interface ModulePermission {
  moduleId: string;
  permissionId: string;
  permissionType: "View" | "Read" | "Create" | "Update" | "Delete";
  description: string;
}

/**
 * Module entity representing a feature/module in the system
 */
export interface RbacModule {
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
  pagination: RbacPagination;
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
  pagination: RbacPagination;
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
  pagination: RbacPagination;
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
