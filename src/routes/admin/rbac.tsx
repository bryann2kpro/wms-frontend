import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/lib/rbac";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { Button } from "@/components/ui/button";
import { Shield, Package, Users, Key } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useAuth } from "@/lib/auth-context";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	fetchModules,
	fetchRoles,
	fetchUserRoles,
	createPermission,
	updateRole,
	updateRolePermissions,
	type RbacModule,
	type RbacRole,
	type ModulesQueryParams,
	type RolesQueryParams,
	type UserRolesQueryParams,
	type CreateModuleInput,
	type UpdateModuleInput,
	type UpdateRoleInput,
	type UpdateRolePermissionsInput,
	type CreatePermissionInput,
} from "@/lib/rbac";
import {
	CREATE_MODULE_MUTATION,
	UPDATE_MODULE_MUTATION,
	type CreateModuleVariables,
	type UpdateModuleVariables,
} from "@/lib/graphql/rbac";
import type { StatusFilter } from "@/constants/status-filter";
import { UserRolesTable } from "@/components/rbac/user-roles-table";
import { SummaryCard } from "@/components/rbac/summary-card";
import { ModulesTable } from "@/components/rbac/modules-table";
import { RolesTable } from "@/components/rbac/roles-table";
import { RolePermissionsDialog } from "@/components/rbac/role-permissions-dialog";
import { DeleteModuleDialog } from "@/components/rbac/delete-module-dialog";
import { EditModuleDialog } from "@/components/rbac/edit-module-dialog";
import { CreateModuleDialog } from "@/components/rbac/create-module-dialog";
import { EditRoleDialog } from "@/components/rbac/edit-role-dialog";

export const Route = createFileRoute("/admin/rbac")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Role"]);
	},
	component: RbacComponent,
	head: () => ({
		meta: [
			{
				title: "RBAC - SME Edaran WMS",
				description:
					"Manage role-based access, permission modules, and user role assignments.",
			},
		],
	}),
});

// Tab type
type TabId = "modules" | "roles" | "user-roles";

// Tab configuration
const tabs: Array<{
	id: TabId;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	disabled?: boolean;
}> = [
	{ id: "modules", label: "Modules", icon: Package },
	{ id: "roles", label: "Roles", icon: Shield },
	{ id: "user-roles", label: "User Roles", icon: Users },
];

function RbacComponent() {
	const { logout } = useAuth();
	const { user } = useCurrentUser();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<TabId>("modules");

	// Modules state
	const [modulesSearchTerm, setModulesSearchTerm] = useState("");
	const [modulesStatusFilter, setModulesStatusFilter] =
		useState<StatusFilter>("all");
	const [modulesPage, setModulesPage] = useState(1);

	// Roles state
	const [rolesSearchTerm, setRolesSearchTerm] = useState("");
	const [rolesStatusFilter, setRolesStatusFilter] =
		useState<StatusFilter>("all");
	const [rolesPage, setRolesPage] = useState(1);

	// User Roles state
	const [userRolesSearchTerm, setUserRolesSearchTerm] = useState("");
	const [userRolesStatusFilter, setUserRolesStatusFilter] =
		useState<StatusFilter>("all");
	const [userRolesPage, setUserRolesPage] = useState(1);

	// Module dialogs state
	const [isCreateModuleDialogOpen, setIsCreateModuleDialogOpen] =
		useState(false);
	const [isEditModuleDialogOpen, setIsEditModuleDialogOpen] = useState(false);
	const [isDeleteModuleDialogOpen, setIsDeleteModuleDialogOpen] =
		useState(false);
	const [selectedModule, setSelectedModule] = useState<RbacModule | null>(null);

	// Role dialogs state
	const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
	const [selectedRole, setSelectedRole] = useState<RbacRole | null>(null);

	// Role permissions dialog state
	const [isRolePermissionsDialogOpen, setIsRolePermissionsDialogOpen] =
		useState(false);
	const [selectedRoleForPermissions, setSelectedRoleForPermissions] =
		useState<RbacRole | null>(null);

	// Build modules query params
	const modulesQueryParams: ModulesQueryParams = { page: modulesPage };
	if (modulesSearchTerm.trim()) {
		modulesQueryParams.moduleName = modulesSearchTerm.trim();
	}
	if (modulesStatusFilter !== "all") {
		modulesQueryParams.status = modulesStatusFilter;
	}

	// Build roles query params
	const rolesQueryParams: RolesQueryParams = { page: rolesPage };
	if (rolesSearchTerm.trim()) {
		rolesQueryParams.roleName = rolesSearchTerm.trim();
	}
	if (rolesStatusFilter !== "all") {
		rolesQueryParams.status = rolesStatusFilter;
	}

	// Build user roles query params
	const userRolesQueryParams: UserRolesQueryParams = { page: userRolesPage };
	if (userRolesStatusFilter !== "all") {
		userRolesQueryParams.status = userRolesStatusFilter;
	}

	// Fetch modules
	const {
		data: modulesData,
		isLoading: isLoadingModules,
		isError: isErrorModules,
		error: modulesError,
		isFetching: isFetchingModules,
		refetch: refetchModules,
	} = useQuery({
		queryKey: ["rbac-modules", modulesQueryParams],
		queryFn: () => fetchModules(modulesQueryParams),
		staleTime: 30_000,
		retry: 2,
	});

	// Fetch roles
	const {
		data: rolesData,
		isLoading: isLoadingRoles,
		isError: isErrorRoles,
		error: rolesError,
		isFetching: isFetchingRoles,
		refetch: refetchRoles,
	} = useQuery({
		queryKey: ["rbac-roles", rolesQueryParams],
		queryFn: () => fetchRoles(rolesQueryParams),
		staleTime: 30_000,
		retry: 2,
	});

	// Fetch user roles
	const {
		data: userRolesData,
		isLoading: isLoadingUserRoles,
		isError: isErrorUserRoles,
		error: userRolesError,
		isFetching: isFetchingUserRoles,
		refetch: refetchUserRoles,
	} = useQuery({
		queryKey: ["rbac-user-roles", userRolesQueryParams],
		queryFn: () => fetchUserRoles(userRolesQueryParams),
		staleTime: 30_000,
		retry: 2,
	});

	type CreateModuleResult = {
		createModule: {
			moduleId: string;
			permissions?: Array<{ permissionType?: string | null }>;
		};
	};

	// Create module mutation (GraphQL)
	const {
		mutate: createModuleGql,
		mutateAsync: createModuleGqlAsync,
		isPending: isCreatingModule,
		error: createModuleError,
	} = useMutation({
		mutationFn: (vars: CreateModuleVariables) =>
			gqlRequest<CreateModuleResult, CreateModuleVariables>(
				CREATE_MODULE_MUTATION,
				vars,
			),
	});

	// Wrap to accept the dialog's CreateModuleInput format
	const createModuleMutation = {
		mutate: (input: CreateModuleInput) => createModuleGql({ input }),
		mutateAsync: (input: CreateModuleInput) =>
			createModuleGqlAsync({ input }),
		isPending: isCreatingModule,
		error: createModuleError ?? null,
		isError: !!createModuleError,
	};

	// Update module mutation (GraphQL)
	const {
		mutate: updateModuleGql,
		mutateAsync: updateModuleGqlAsync,
		isPending: isUpdatingModule,
		error: updateModuleError,
	} = useMutation({
		mutationFn: (vars: UpdateModuleVariables) =>
			gqlRequest<unknown, UpdateModuleVariables>(
				UPDATE_MODULE_MUTATION,
				vars,
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["rbac-modules"] });
			setIsEditModuleDialogOpen(false);
			setSelectedModule(null);
		},
	});

	// Wrap to accept the dialog's UpdateModuleInput format (moduleId → id)
	const updateModuleMutation = {
		mutate: (input: UpdateModuleInput) => {
			const { moduleId, ...rest } = input;
			return updateModuleGql({ id: moduleId, input: rest });
		},
		mutateAsync: async (input: UpdateModuleInput) => {
			const { moduleId, ...rest } = input;
			await updateModuleGqlAsync({ id: moduleId, input: rest });
		},
		isPending: isUpdatingModule,
		error: updateModuleError ?? null,
		isError: !!updateModuleError,
	};

	// Deactivate module mutation (GraphQL – reuses updateModule)
	const {
		mutate: deactivateModuleGql,
		isPending: isDeactivatingModule,
		error: deactivateModuleError,
	} = useMutation({
		mutationFn: (vars: UpdateModuleVariables) =>
			gqlRequest<unknown, UpdateModuleVariables>(
				UPDATE_MODULE_MUTATION,
				vars,
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["rbac-modules"] });
			setIsDeleteModuleDialogOpen(false);
			setSelectedModule(null);
		},
	});

	const deactivateModuleMutation = {
		mutate: (input: UpdateModuleInput) => {
			const { moduleId, ...rest } = input;
			return deactivateModuleGql({ id: moduleId, input: rest });
		},
		isPending: isDeactivatingModule,
		error: deactivateModuleError ?? null,
		isError: !!deactivateModuleError,
	};

	// Update role mutation
	const updateRoleMutation = useMutation({
		mutationFn: (input: UpdateRoleInput) => updateRole(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["rbac-roles"] });
			setIsEditRoleDialogOpen(false);
			setSelectedRole(null);
		},
	});

	// Update role permissions mutation
	const updateRolePermissionsMutation = useMutation({
		mutationFn: (input: UpdateRolePermissionsInput) =>
			updateRolePermissions(input),
		onSuccess: () => {
			// Invalidate role permissions query to refetch with updated data
			queryClient.invalidateQueries({
				queryKey: ["rbac-role-permissions", selectedRoleForPermissions?.roleId],
			});
			setIsRolePermissionsDialogOpen(false);
			setSelectedRoleForPermissions(null);
		},
	});

	const createPermissionMutation = useMutation({
		mutationFn: (input: CreatePermissionInput) => createPermission(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["rbac-modules"] });
			queryClient.invalidateQueries({
				queryKey: ["rbac-role-permissions", selectedRoleForPermissions?.roleId],
			});
		},
	});

	const modules = modulesData?.data ?? [];
	const roles = rolesData?.data ?? [];
	const userRoles = userRolesData?.data ?? [];

	// Filter modules client-side for search (API might not support partial matching)
	const filteredModules = modules.filter((module) => {
		if (!modulesSearchTerm.trim()) return true;
		return module.moduleName
			.toLowerCase()
			.includes(modulesSearchTerm.toLowerCase());
	});

	// Filter roles client-side for search
	const filteredRoles = roles.filter((role) => {
		if (!rolesSearchTerm.trim()) return true;
		return role.roleName.toLowerCase().includes(rolesSearchTerm.toLowerCase());
	});

	// Filter user roles client-side for search (by role name or user ID)
	const filteredUserRoles = userRoles.filter((userRole) => {
		if (!userRolesSearchTerm.trim()) return true;
		const searchLower = userRolesSearchTerm.toLowerCase();
		return (
			userRole.roleName.toLowerCase().includes(searchLower) ||
			userRole.userId.toLowerCase().includes(searchLower)
		);
	});

	// Calculate total permissions across all modules
	const totalPermissions = modules.reduce(
		(acc, m) => acc + m.permission.length,
		0,
	);

	// Get current user identifier for createdBy/updatedBy
	const currentUserIdentifier = user?.email || user?.id || "system";

	const handleEditModule = (module: RbacModule) => {
		setSelectedModule(module);
		setIsEditModuleDialogOpen(true);
	};

	const handleDeleteModule = (module: RbacModule) => {
		setSelectedModule(module);
		setIsDeleteModuleDialogOpen(true);
	};

	const handleEditRole = (role: RbacRole) => {
		setSelectedRole(role);
		setIsEditRoleDialogOpen(true);
	};

	const handleViewRolePermissions = (role: RbacRole) => {
		setSelectedRoleForPermissions(role);
		setIsRolePermissionsDialogOpen(true);
	};

	const summaryCardDelays = [0, 60, 120, 180];

	const isAnyLoading = isLoadingModules || isLoadingRoles || isLoadingUserRoles;

	return (
		<main
			className="rbac-page min-h-screen bg-[var(--rbac-surface)]"
			aria-labelledby="rbac-page-title"
			aria-describedby="rbac-page-description"
			aria-busy={isAnyLoading}
		>
			{/* Subtle gradient band behind header */}
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[380px] bg-gradient-to-b from-[var(--rbac-accent-muted)]/40 via-transparent to-transparent"
				aria-hidden
			/>
			<div className="container relative mx-auto px-6 py-8 space-y-8">
				{/* Page Header */}
				<AdminPageHeader
					icon={Shield}
					title="Role-Based Access Control"
					description="Manage modules, roles, and user access across the system."
					titleId="rbac-page-title"
					descriptionId="rbac-page-description"
					accentCssVar="--rbac-accent"
				/>

				{/* Summary Cards */}
				<div className="grid gap-4 md:grid-cols-4">
					{[
						{
							title: "Modules",
							value: modulesData?.pagination?.totalCount ?? 0,
							icon: Package,
							isLoading: isLoadingModules,
							description: "System features",
						},
						{
							title: "Permissions",
							value: totalPermissions,
							icon: Key,
							isLoading: isLoadingModules,
							description: "Access types",
						},
						{
							title: "Roles",
							value: rolesData?.pagination?.totalCount ?? 0,
							icon: Shield,
							isLoading: isLoadingRoles,
							description: "System roles",
						},
						{
							title: "User Roles",
							value: userRolesData?.pagination?.totalCount ?? 0,
							icon: Users,
							isLoading: isLoadingUserRoles,
							description: "Role assignments",
						},
					].map((card, i) => (
						<div
							key={card.title}
							className="rbac-summary-card"
							style={{ animationDelay: `${summaryCardDelays[i]}ms` }}
						>
							<SummaryCard
								title={card.title}
								value={card.value}
								icon={card.icon}
								isLoading={card.isLoading}
								description={card.description}
							/>
						</div>
					))}
				</div>

				{/* Tabs Navigation */}
				<div
					className="flex gap-1 border-b border-border"
					role="tablist"
					aria-label="RBAC sections"
				>
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;
						return (
							<Button
								key={tab.id}
								variant="ghost"
								onClick={() => !tab.disabled && setActiveTab(tab.id)}
								className={cn(
									"rbac-tab rounded-b-none border-b-2 border-transparent px-5 py-3 font-medium transition-colors hover:bg-muted/60",
									isActive && "rbac-tab-active bg-transparent",
								)}
								disabled={tab.disabled}
								role="tab"
								aria-selected={isActive}
								aria-controls={`tabpanel-${tab.id}`}
								id={`tab-${tab.id}`}
							>
								<Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
								{tab.label}
							</Button>
						);
					})}
				</div>

				{/* Tab Content */}
				<div
					role="tabpanel"
					id={`tabpanel-${activeTab}`}
					aria-labelledby={`tab-${activeTab}`}
				>
					{activeTab === "modules" && (
						<ModulesTable
							modules={filteredModules}
							pagination={modulesData?.pagination}
							isLoading={isLoadingModules}
							isFetching={isFetchingModules}
							isError={isErrorModules}
							error={modulesError}
							searchTerm={modulesSearchTerm}
							onSearchChange={(value) => {
								setModulesSearchTerm(value);
								setModulesPage(1);
							}}
							statusFilter={modulesStatusFilter}
							onStatusFilterChange={(value) => {
								setModulesStatusFilter(value);
								setModulesPage(1);
							}}
							page={modulesPage}
							onPageChange={setModulesPage}
							onRetry={() => refetchModules()}
							onCreateClick={() => setIsCreateModuleDialogOpen(true)}
							onEditClick={handleEditModule}
							onDeleteClick={handleDeleteModule}
						/>
					)}

					{activeTab === "roles" && (
						<RolesTable
							roles={filteredRoles}
							pagination={rolesData?.pagination}
							isLoading={isLoadingRoles}
							isFetching={isFetchingRoles}
							isError={isErrorRoles}
							error={rolesError}
							searchTerm={rolesSearchTerm}
							onSearchChange={(value) => {
								setRolesSearchTerm(value);
								setRolesPage(1);
							}}
							statusFilter={rolesStatusFilter}
							onStatusFilterChange={(value) => {
								setRolesStatusFilter(value);
								setRolesPage(1);
							}}
							page={rolesPage}
							onPageChange={setRolesPage}
							onRetry={() => refetchRoles()}
							onEditClick={handleEditRole}
							onViewPermissionsClick={handleViewRolePermissions}
						/>
					)}

					{activeTab === "user-roles" && (
						<UserRolesTable
							userRoles={filteredUserRoles}
							pagination={userRolesData?.pagination}
							isLoading={isLoadingUserRoles}
							isFetching={isFetchingUserRoles}
							isError={isErrorUserRoles}
							error={userRolesError}
							searchTerm={userRolesSearchTerm}
							onSearchChange={(value) => {
								setUserRolesSearchTerm(value);
								setUserRolesPage(1);
							}}
							statusFilter={userRolesStatusFilter}
							onStatusFilterChange={(value) => {
								setUserRolesStatusFilter(value);
								setUserRolesPage(1);
							}}
							page={userRolesPage}
							onPageChange={setUserRolesPage}
							onRetry={() => refetchUserRoles()}
						/>
					)}
				</div>

				{/* Create Module Dialog */}
				<CreateModuleDialog
					open={isCreateModuleDialogOpen}
					onOpenChange={setIsCreateModuleDialogOpen}
					onSubmit={async (input, addPermissionTypes) => {
						const result = await createModuleMutation.mutateAsync(input);
						const created = result?.createModule;
						const moduleId = created?.moduleId;
						if (!moduleId || !created) return;

						const existingTypes = new Set(
							(created.permissions ?? [])
								.map((p) => p.permissionType)
								.filter((v): v is string => Boolean(v)),
						);
						const missingTypes = addPermissionTypes.filter(
							(type) => !existingTypes.has(type),
						);

						if (missingTypes.length > 0) {
							await Promise.all(
								missingTypes.map((permissionType) =>
									createPermissionMutation.mutateAsync({
										moduleId,
										permissionType,
										status: "active",
										createdBy: currentUserIdentifier,
										updatedBy: currentUserIdentifier,
									}),
								),
							);
						}

						queryClient.invalidateQueries({ queryKey: ["rbac-modules"] });
						setModulesPage(1);
						setIsCreateModuleDialogOpen(false);
					}}
					isSubmitting={
						createModuleMutation.isPending || createPermissionMutation.isPending
					}
					error={createModuleMutation.error}
					currentUserIdentifier={currentUserIdentifier}
				/>

				{/* Edit Module Dialog */}
				<EditModuleDialog
					open={isEditModuleDialogOpen}
					onOpenChange={(open) => {
						setIsEditModuleDialogOpen(open);
						if (!open) setSelectedModule(null);
					}}
					module={selectedModule}
					onSubmit={async (input, addPermissionTypes) => {
						await updateModuleMutation.mutateAsync(input);
						if (addPermissionTypes.length === 0) return;
						await Promise.all(
							addPermissionTypes.map((permissionType) =>
								createPermissionMutation.mutateAsync({
									moduleId: input.moduleId,
									permissionType,
									status: "active",
									createdBy: currentUserIdentifier,
									updatedBy: currentUserIdentifier,
								}),
							),
						);
					}}
					isSubmitting={
						updateModuleMutation.isPending || createPermissionMutation.isPending
					}
					error={updateModuleMutation.error}
					currentUserIdentifier={currentUserIdentifier}
				/>

				{/* Delete (Deactivate) Module Dialog */}
				<DeleteModuleDialog
					open={isDeleteModuleDialogOpen}
					onOpenChange={(open) => {
						setIsDeleteModuleDialogOpen(open);
						if (!open) setSelectedModule(null);
					}}
					module={selectedModule}
					onConfirm={(input) => deactivateModuleMutation.mutate(input)}
					isSubmitting={deactivateModuleMutation.isPending}
					error={deactivateModuleMutation.error}
					currentUserIdentifier={currentUserIdentifier}
				/>

				{/* Edit Role Dialog */}
				<EditRoleDialog
					open={isEditRoleDialogOpen}
					onOpenChange={(open) => {
						if (!open && updateRoleMutation.isPending) return;
						setIsEditRoleDialogOpen(open);
						if (!open) {
							setSelectedRole(null);
							updateRoleMutation.reset();
						}
					}}
					role={selectedRole}
					onSubmit={(input) => updateRoleMutation.mutate(input)}
					isSubmitting={updateRoleMutation.isPending}
					error={updateRoleMutation.error}
					currentUserIdentifier={currentUserIdentifier}
				/>

				{/* Role Permissions Dialog */}
				<RolePermissionsDialog
					open={isRolePermissionsDialogOpen}
					onOpenChange={(open) => {
						// Don't close if currently saving
						if (!open && updateRolePermissionsMutation.isPending) return;
						setIsRolePermissionsDialogOpen(open);
						if (!open) {
							setSelectedRoleForPermissions(null);
							// Reset mutation state when dialog closes
							updateRolePermissionsMutation.reset();
						}
					}}
					role={selectedRoleForPermissions}
					logout={logout}
					onSave={(input) => updateRolePermissionsMutation.mutate(input)}
					onAddPermission={async (moduleId, permissionType) => {
						await createPermissionMutation.mutateAsync({
							moduleId,
							permissionType,
							createdBy: currentUserIdentifier,
							updatedBy: currentUserIdentifier,
							status: "active",
						});
					}}
					isSaving={updateRolePermissionsMutation.isPending}
					isAddingPermission={createPermissionMutation.isPending}
					saveError={updateRolePermissionsMutation.error}
					currentUserIdentifier={currentUserIdentifier}
				/>
			</div>
		</main>
	);
}
