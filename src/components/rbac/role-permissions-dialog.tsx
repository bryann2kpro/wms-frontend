import { useState, useEffect, useCallback } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../ui/dialog";
import {
	Shield,
	Loader2,
	AlertCircle,
	RefreshCw,
	Key,
	Package,
	Check,
	X,
	Pencil,
	Save,
	PlusCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { getErrorMessage } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	fetchRolePermissions,
	type RbacRole,
	type RolePermissionModule,
	type UpdateRolePermissionsInput,
} from "@/lib/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

// Type for tracking local permission changes
type PermissionState = Map<string, boolean>; // permissionId -> hasPermission

// Role Permissions Dialog Component
interface RolePermissionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	role: RbacRole | null;
	logout: () => void;
	onSave?: (input: UpdateRolePermissionsInput) => void;
	onAddPermission?: (
		moduleId: string,
		permissionType: string,
	) => Promise<unknown>;
	isSaving?: boolean;
	isAddingPermission?: boolean;
	saveError?: Error | null;
	currentUserIdentifier: string;
}

function RolePermissionsDialog({
	open,
	onOpenChange,
	role,
	logout: _logout,
	onSave,
	onAddPermission,
	isSaving = false,
	isAddingPermission = false,
	saveError,
	currentUserIdentifier,
}: RolePermissionsDialogProps) {
	const [isEditMode, setIsEditMode] = useState(false);
	const [localPermissions, setLocalPermissions] = useState<PermissionState>(
		new Map(),
	);
	const [pendingAddModuleKey, setPendingAddModuleKey] = useState<string | null>(
		null,
	);

	// Fetch role permissions when dialog opens
	const {
		data: permissionsData,
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery({
		queryKey: ["rbac-role-permissions", role?.roleId],
		queryFn: () =>
			fetchRolePermissions({ roleId: role!.roleId, pageSize: 100 }),
		enabled: open && !!role?.roleId,
		staleTime: 30_000,
	});

	const permissionModules = permissionsData?.data ?? [];

	// Initialize local permissions state from fetched data
	useEffect(() => {
		if (permissionModules.length > 0) {
			const initialState = new Map<string, boolean>();
			permissionModules.forEach((module) => {
				module.permissions.forEach((permission) => {
					initialState.set(permission.permissionId, permission.hasPermission);
				});
			});
			setLocalPermissions(initialState);
		}
	}, [permissionModules]);

	// Reset edit mode when dialog closes
	useEffect(() => {
		if (!open) {
			setIsEditMode(false);
		}
	}, [open]);

	// Handle permission toggle
	const handlePermissionToggle = useCallback((permissionId: string) => {
		setLocalPermissions((prev) => {
			const newState = new Map(prev);
			newState.set(permissionId, !prev.get(permissionId));
			return newState;
		});
	}, []);

	// Handle cancel edit - reset to original state
	const handleCancelEdit = useCallback(() => {
		const originalState = new Map<string, boolean>();
		permissionModules.forEach((module) => {
			module.permissions.forEach((permission) => {
				originalState.set(permission.permissionId, permission.hasPermission);
			});
		});
		setLocalPermissions(originalState);
		setIsEditMode(false);
	}, [permissionModules]);

	// Handle save
	const handleSave = useCallback(() => {
		if (!role || !onSave) return;

		// Collect all permissionIds that are enabled
		const enabledPermissionIds: string[] = [];
		localPermissions.forEach((hasPermission, permissionId) => {
			if (hasPermission) {
				enabledPermissionIds.push(permissionId);
			}
		});

		onSave({
			roleId: role.roleId,
			permissionIds: enabledPermissionIds,
			updatedBy: currentUserIdentifier,
		});
	}, [role, onSave, localPermissions, currentUserIdentifier]);

	const handleAddApprovePermission = useCallback(
		async (moduleId: string) => {
			if (!onAddPermission) return;
			setPendingAddModuleKey(moduleId);
			try {
				await onAddPermission(moduleId, "Approve");
				await refetch();
			} finally {
				setPendingAddModuleKey(null);
			}
		},
		[onAddPermission, refetch],
	);

	// Check if there are unsaved changes
	const hasChanges = useCallback(() => {
		for (const module of permissionModules) {
			for (const permission of module.permissions) {
				const currentValue = localPermissions.get(permission.permissionId);
				if (currentValue !== permission.hasPermission) {
					return true;
				}
			}
		}
		return false;
	}, [permissionModules, localPermissions]);

	if (!role) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col"
				aria-describedby="role-permissions-description"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" aria-hidden="true" />
						Permissions for {role.roleName}
					</DialogTitle>
					<DialogDescription id="role-permissions-description">
						{isEditMode
							? "Click on permissions to toggle them. Save when done."
							: "View all module permissions assigned to this role."}
					</DialogDescription>
				</DialogHeader>

				{/* Error banner for save errors */}
				{saveError && (
					<div
						className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm"
						role="alert"
						aria-live="polite"
					>
						<AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
						<span>Failed to save: {getErrorMessage(saveError)}</span>
					</div>
				)}

				<div className="flex-1 overflow-y-auto py-4">
					{isLoading ? (
						<div
							className="flex flex-col items-center justify-center py-12 text-muted-foreground"
							role="status"
							aria-live="polite"
						>
							<Loader2
								className="h-8 w-8 animate-spin mb-3"
								aria-hidden="true"
							/>
							<span>Loading permissions...</span>
						</div>
					) : isError ? (
						<div
							className="flex flex-col items-center justify-center py-12"
							role="alert"
						>
							<AlertCircle
								className="h-8 w-8 text-destructive mb-3"
								aria-hidden="true"
							/>
							<p className="font-medium text-destructive">
								Failed to load permissions
							</p>
							<p className="text-sm text-muted-foreground mt-1">
								{getErrorMessage(error)}
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetch()}
								className="mt-4"
							>
								<RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
								Try Again
							</Button>
						</div>
					) : permissionModules.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
							<Key className="h-8 w-8 mb-3" aria-hidden="true" />
							<span>No permissions assigned to this role</span>
						</div>
					) : (
						<div
							className="space-y-4"
							role="list"
							aria-label="Module permissions"
						>
							{permissionModules.map((moduleData) => (
								<PermissionModuleCard
									key={moduleData.module}
									moduleData={moduleData}
									isEditMode={isEditMode}
									localPermissions={localPermissions}
									onPermissionToggle={handlePermissionToggle}
									onAddApprovePermission={handleAddApprovePermission}
									isAddingPermission={isAddingPermission}
									pendingAddModuleKey={pendingAddModuleKey}
									isSaving={isSaving}
								/>
							))}
						</div>
					)}
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-row">
					{isEditMode ? (
						<>
							<Button
								variant="outline"
								onClick={handleCancelEdit}
								disabled={isSaving}
								aria-label="Cancel editing and discard changes"
							>
								Cancel
							</Button>
							<Button
								onClick={handleSave}
								disabled={isSaving || !hasChanges()}
								aria-label={
									isSaving ? "Saving permissions" : "Save permission changes"
								}
							>
								{isSaving ? (
									<>
										<Loader2
											className="mr-2 h-4 w-4 animate-spin"
											aria-hidden="true"
										/>
										Saving...
									</>
								) : (
									<>
										<Save className="mr-2 h-4 w-4" aria-hidden="true" />
										Save Changes
									</>
								)}
							</Button>
						</>
					) : (
						<>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Close
							</Button>
							{permissionModules.length > 0 && onSave && (
								<Button
									onClick={() => setIsEditMode(true)}
									aria-label="Edit permissions for this role"
								>
									<Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
									Edit Permissions
								</Button>
							)}
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Permission Module Card Component
interface PermissionModuleCardProps {
	moduleData: RolePermissionModule;
	isEditMode: boolean;
	localPermissions: PermissionState;
	onPermissionToggle: (permissionId: string) => void;
	onAddApprovePermission: (moduleId: string) => void;
	isAddingPermission: boolean;
	pendingAddModuleKey: string | null;
	isSaving: boolean;
}

function PermissionModuleCard({
	moduleData,
	isEditMode,
	localPermissions,
	onPermissionToggle,
	onAddApprovePermission,
	isAddingPermission,
	pendingAddModuleKey,
	isSaving,
}: PermissionModuleCardProps) {
	// Define permission types in order
	const permissionTypes = [
		"Read",
		"Create",
		"Update",
		"Delete",
		"Approve",
	] as const;

	// Create a map of permission type to permission detail
	const permissionMap = new Map(
		moduleData.permissions.map((p) => [p.permissionType, p]),
	);

	return (
		<Card role="listitem">
			<CardHeader className="pb-3">
				<CardTitle className="text-base flex items-center gap-2">
					<Package className="h-4 w-4" aria-hidden="true" />
					{moduleData.module}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div
					className="grid grid-cols-5 gap-2"
					role="group"
					aria-label={`Permissions for ${moduleData.module}`}
				>
					{permissionTypes.map((type) => {
						const permission = permissionMap.get(type);
						const moduleId = moduleData.permissions[0]?.moduleId ?? null;
						const isAddingThisModule =
							isAddingPermission &&
							pendingAddModuleKey != null &&
							pendingAddModuleKey === moduleId;

						// Permission type not configured in DB — non-interactive placeholder
						if (!permission) {
							if (type === "Approve" && isEditMode && moduleId) {
								return (
									<button
										key={type}
										type="button"
										onClick={() => onAddApprovePermission(moduleId)}
										disabled={isSaving || isAddingThisModule}
										className="flex flex-col items-center justify-center p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 transition-colors hover:bg-amber-100 dark:hover:bg-amber-950/30 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
										aria-label={`Add ${type} permission type for ${moduleData.module}`}
									>
										<div className="w-6 h-6 rounded-full flex items-center justify-center mb-1 bg-amber-500 text-white">
											{isAddingThisModule ? (
												<Loader2
													className="h-4 w-4 animate-spin"
													aria-hidden="true"
												/>
											) : (
												<PlusCircle className="h-4 w-4" aria-hidden="true" />
											)}
										</div>
										<span className="text-xs font-medium text-amber-700 dark:text-amber-300">
											{isAddingThisModule ? "Adding..." : "Add"}
										</span>
									</button>
								);
							}
							return (
								<div
									key={type}
									className="flex flex-col items-center justify-center p-3 rounded-lg border bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 cursor-default opacity-40"
									aria-label={`${type} permission for ${moduleData.module}: not configured`}
									title="This permission type is not configured for this module"
								>
									<div className="w-6 h-6 rounded-full flex items-center justify-center mb-1 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
										<X className="h-4 w-4" aria-hidden="true" />
									</div>
									<span className="text-xs font-medium text-gray-400 dark:text-gray-500">
										{type}
									</span>
								</div>
							);
						}

						// Use local state in edit mode, otherwise use original value
						const hasPermission = isEditMode
							? (localPermissions.get(permission.permissionId) ??
								permission.hasPermission)
							: permission.hasPermission;

						const isInteractive = isEditMode && !isSaving;

						return (
							<button
								key={type}
								type="button"
								onClick={() =>
									isInteractive && onPermissionToggle(permission.permissionId)
								}
								disabled={!isInteractive}
								className={`
                  flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                  ${
										hasPermission
											? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
											: "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
									}
                  ${
										isInteractive
											? "cursor-pointer hover:ring-2 hover:ring-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
											: "cursor-default"
									}
                  ${isSaving ? "opacity-50" : ""}
                `}
								aria-pressed={hasPermission}
								aria-label={`${type} permission for ${moduleData.module}: ${hasPermission ? "enabled" : "disabled"}${isInteractive ? ", click to toggle" : ""}`}
							>
								<div
									className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 transition-colors ${
										hasPermission
											? "bg-green-500 text-white"
											: "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
									}`}
								>
									{hasPermission ? (
										<Check className="h-4 w-4" aria-hidden="true" />
									) : (
										<X className="h-4 w-4" aria-hidden="true" />
									)}
								</div>
								<span
									className={`text-xs font-medium transition-colors ${
										hasPermission
											? "text-green-700 dark:text-green-300"
											: "text-gray-500 dark:text-gray-400"
									}`}
								>
									{type}
								</span>
							</button>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

export { RolePermissionsDialog, type RolePermissionsDialogProps };
