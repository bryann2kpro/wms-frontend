import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Shield,
  Package,
  Users,
  Key,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  fetchModules,
  fetchRoles,
  fetchUserRoles,
  createModule,
  updateModule,
  type RbacModule,
  type RbacRole,
  type RbacUserRole,
  type ModulesQueryParams,
  type RolesQueryParams,
  type UserRolesQueryParams,
  type RbacPagination,
  type CreateModuleInput,
  type UpdateModuleInput,
} from "@/lib/rbac";

export const Route = createFileRoute("/admin/rbac")({
  component: RbacComponent,
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

// Status filter type
type StatusFilter = "all" | "active" | "inactive";

// Status badge colors
const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  inactive: "bg-red-500/10 text-red-600 border-red-500/20",
};

// Permission type colors
const permissionTypeColors: Record<string, string> = {
  View: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Read: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  Create: "bg-green-500/10 text-green-600 border-green-500/20",
  Update: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  Delete: "bg-red-500/10 text-red-600 border-red-500/20",
};

// Role badge colors
const roleBadgeColors: Record<string, string> = {
  Admin: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Storekeeper: "bg-green-500/10 text-green-600 border-green-500/20",
  Logistic: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Management: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

function RbacComponent() {
  const { logout } = useAuth();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("modules");

  // Modules state
  const [modulesSearchTerm, setModulesSearchTerm] = useState("");
  const [modulesStatusFilter, setModulesStatusFilter] = useState<StatusFilter>("all");
  const [modulesPage, setModulesPage] = useState(1);

  // Roles state
  const [rolesSearchTerm, setRolesSearchTerm] = useState("");
  const [rolesStatusFilter, setRolesStatusFilter] = useState<StatusFilter>("all");
  const [rolesPage, setRolesPage] = useState(1);

  // User Roles state
  const [userRolesSearchTerm, setUserRolesSearchTerm] = useState("");
  const [userRolesStatusFilter, setUserRolesStatusFilter] = useState<StatusFilter>("all");
  const [userRolesPage, setUserRolesPage] = useState(1);

  // Module dialogs state
  const [isCreateModuleDialogOpen, setIsCreateModuleDialogOpen] = useState(false);
  const [isEditModuleDialogOpen, setIsEditModuleDialogOpen] = useState(false);
  const [isDeleteModuleDialogOpen, setIsDeleteModuleDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<RbacModule | null>(null);

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
    queryFn: () => fetchModules(modulesQueryParams, logout),
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
    queryFn: () => fetchRoles(rolesQueryParams, logout),
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
    queryFn: () => fetchUserRoles(userRolesQueryParams, logout),
    staleTime: 30_000,
    retry: 2,
  });

  // Create module mutation
  const createModuleMutation = useMutation({
    mutationFn: (input: CreateModuleInput) => createModule(input, logout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbac-modules"] });
      setIsCreateModuleDialogOpen(false);
    },
  });

  // Update module mutation
  const updateModuleMutation = useMutation({
    mutationFn: (input: UpdateModuleInput) => updateModule(input, logout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbac-modules"] });
      setIsEditModuleDialogOpen(false);
      setSelectedModule(null);
    },
  });

  // Deactivate module mutation (soft delete)
  const deactivateModuleMutation = useMutation({
    mutationFn: (input: UpdateModuleInput) => updateModule(input, logout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbac-modules"] });
      setIsDeleteModuleDialogOpen(false);
      setSelectedModule(null);
    },
  });

  const modules = modulesData?.data ?? [];
  const roles = rolesData?.data ?? [];
  const userRoles = userRolesData?.data ?? [];

  // Filter modules client-side for search (API might not support partial matching)
  const filteredModules = modules.filter((module) => {
    if (!modulesSearchTerm.trim()) return true;
    return module.moduleName.toLowerCase().includes(modulesSearchTerm.toLowerCase());
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
  const totalPermissions = modules.reduce((acc, m) => acc + m.permission.length, 0);

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Role-Based Access Control
        </h1>
        <p className="text-muted-foreground">
          Manage modules, roles, and user access across the system
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Modules"
          value={modulesData?.pagination?.totalCount ?? 0}
          icon={Package}
          isLoading={isLoadingModules}
          description="System features"
        />
        <SummaryCard
          title="Permissions"
          value={totalPermissions}
          icon={Key}
          isLoading={isLoadingModules}
          description="Access types"
        />
        <SummaryCard
          title="Roles"
          value={rolesData?.pagination?.totalCount ?? 0}
          icon={Shield}
          isLoading={isLoadingRoles}
          description="System roles"
        />
        <SummaryCard
          title="User Roles"
          value={userRolesData?.pagination?.totalCount ?? 0}
          icon={Users}
          isLoading={isLoadingUserRoles}
          description="Role assignments"
        />
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b" role="tablist" aria-label="RBAC sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              className="rounded-b-none"
              disabled={tab.disabled}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
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
        onSubmit={(input) => createModuleMutation.mutate(input)}
        isSubmitting={createModuleMutation.isPending}
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
        onSubmit={(input) => updateModuleMutation.mutate(input)}
        isSubmitting={updateModuleMutation.isPending}
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
    </div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  description: string;
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  isLoading,
  description,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// Extract error message from various error types
function getErrorMessage(err: Error | null): string {
  if (!err) return "An unexpected error occurred";

  // Check for Axios error response
  const axiosError = err as { response?: { data?: { message?: string }; status?: number } };
  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message;
  }
  if (axiosError.response?.status === 401) {
    return "Session expired. Please log in again.";
  }
  if (axiosError.response?.status === 403) {
    return "You don't have permission to perform this action.";
  }
  if (axiosError.response?.status === 500) {
    return "Server error. Please try again later.";
  }

  // Network error
  if (err.message === "Network Error") {
    return "Unable to connect to server. Please check your connection.";
  }

  return err.message || "An unexpected error occurred";
}

// Pagination Component
interface PaginationProps {
  pagination: RbacPagination | undefined;
  page: number;
  onPageChange: (page: number) => void;
  itemName: string;
}

function Pagination({ pagination, page, onPageChange, itemName }: PaginationProps) {
  if (!pagination || pagination.totalCount === 0) return null;

  const { totalCount, totalPages, hasNextPage, hasPrevPage } = pagination;

  return (
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <div>
        Showing page <span className="font-medium">{page}</span> of{" "}
        <span className="font-medium">{totalPages}</span> ({totalCount} {itemName}
        {totalCount !== 1 ? "s" : ""})
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={!hasPrevPage}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Modules Table Component
interface ModulesTableProps {
  modules: RbacModule[];
  pagination: RbacPagination | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onCreateClick: () => void;
  onEditClick: (module: RbacModule) => void;
  onDeleteClick: (module: RbacModule) => void;
}

function ModulesTable({
  modules,
  pagination,
  isLoading,
  isFetching,
  isError,
  error,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  onPageChange,
  onRetry,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: ModulesTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Module List
              {isFetching && !isLoading && (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-label="Refreshing data"
                />
              )}
            </CardTitle>
            <CardDescription>
              View and manage system modules and their permissions
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 sm:w-64"
                aria-label="Search modules by name"
              />
            </div>
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
            >
              <SelectTrigger className="sm:w-40" aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {/* Create Button */}
            <Button onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Create Module
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Module Name</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[180px]">Last Updated</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                      <span>Loading modules...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                      <div className="text-center">
                        <p className="font-medium text-destructive">Failed to load modules</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getErrorMessage(error)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : modules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Package className="h-6 w-6" aria-hidden="true" />
                      <span>No modules found</span>
                      {searchTerm && (
                        <span className="text-sm">
                          Try adjusting your search or filter criteria
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                modules.map((module) => (
                  <TableRow key={module.moduleName}>
                    <TableCell className="font-medium">{module.moduleName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {module.permission.map((perm) => (
                          <Badge
                            key={perm.permissionId}
                            variant="outline"
                            className={`text-xs ${permissionTypeColors[perm.permissionType] || ""}`}
                            title={perm.description}
                          >
                            {perm.permissionType}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusColors[module.status]} flex w-fit items-center gap-1`}
                      >
                        {module.status === "active" ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span className="capitalize">{module.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(module.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditClick(module)}
                          aria-label={`Edit ${module.moduleName}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteClick(module)}
                          aria-label={`Deactivate ${module.moduleName}`}
                          disabled={module.status === "inactive"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination
          pagination={pagination}
          page={page}
          onPageChange={onPageChange}
          itemName="module"
        />
      </CardContent>
    </Card>
  );
}

// Create Module Dialog Component
interface CreateModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateModuleInput) => void;
  isSubmitting: boolean;
  error: Error | null;
  currentUserIdentifier: string;
}

function CreateModuleDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
  currentUserIdentifier,
}: CreateModuleDialogProps) {
  const [moduleName, setModuleName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!moduleName.trim()) {
      errors.moduleName = "Module name is required";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    onSubmit({
      moduleName: moduleName.trim(),
      status,
      createdBy: currentUserIdentifier,
      updatedBy: currentUserIdentifier,
    });
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setModuleName("");
      setStatus("active");
      setValidationErrors({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Module</DialogTitle>
          <DialogDescription>
            Add a new module to the system. Permissions can be configured after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="moduleName">Module Name *</Label>
              <Input
                id="moduleName"
                placeholder="Enter module name"
                value={moduleName}
                onChange={(e) => {
                  setModuleName(e.target.value);
                  if (validationErrors.moduleName) {
                    setValidationErrors({ ...validationErrors, moduleName: "" });
                  }
                }}
                disabled={isSubmitting}
                aria-invalid={!!validationErrors.moduleName}
              />
              {validationErrors.moduleName && (
                <p className="text-sm text-destructive">{validationErrors.moduleName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as "active" | "inactive")}
                disabled={isSubmitting}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {getErrorMessage(error)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                "Create Module"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Module Dialog Component
interface EditModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: RbacModule | null;
  onSubmit: (input: UpdateModuleInput) => void;
  isSubmitting: boolean;
  error: Error | null;
  currentUserIdentifier: string;
}

function EditModuleDialog({
  open,
  onOpenChange,
  module,
  onSubmit,
  isSubmitting,
  error,
  currentUserIdentifier,
}: EditModuleDialogProps) {
  const [moduleName, setModuleName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Update form when module changes
  useState(() => {
    if (module) {
      setModuleName(module.moduleName);
      setStatus(module.status);
    }
  });

  // Reset form when dialog opens with a module
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && module) {
      setModuleName(module.moduleName);
      setStatus(module.status);
      setValidationErrors({});
    }
    onOpenChange(newOpen);
  };

  // Also reset when module changes while dialog is open
  if (open && module && moduleName !== module.moduleName && !isSubmitting) {
    setModuleName(module.moduleName);
    setStatus(module.status);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!module) return;

    const errors: Record<string, string> = {};

    if (!moduleName.trim()) {
      errors.moduleName = "Module name is required";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Get moduleId from the first permission (since module doesn't have its own ID in the response)
    const moduleId = module.permission[0]?.moduleId;
    if (!moduleId) {
      setValidationErrors({ moduleName: "Unable to identify module for update" });
      return;
    }

    onSubmit({
      moduleId,
      moduleName: moduleName.trim(),
      status,
      updatedBy: currentUserIdentifier,
    });
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setValidationErrors({});
    }
  };

  if (!module) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Module</DialogTitle>
          <DialogDescription>
            Update the module details. Changes will be applied immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-moduleName">Module Name *</Label>
              <Input
                id="edit-moduleName"
                placeholder="Enter module name"
                value={moduleName}
                onChange={(e) => {
                  setModuleName(e.target.value);
                  if (validationErrors.moduleName) {
                    setValidationErrors({ ...validationErrors, moduleName: "" });
                  }
                }}
                disabled={isSubmitting}
                aria-invalid={!!validationErrors.moduleName}
              />
              {validationErrors.moduleName && (
                <p className="text-sm text-destructive">{validationErrors.moduleName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as "active" | "inactive")}
                disabled={isSubmitting}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {getErrorMessage(error)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Updating...
                </>
              ) : (
                "Update Module"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Delete (Deactivate) Module Dialog Component
interface DeleteModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: RbacModule | null;
  onConfirm: (input: UpdateModuleInput) => void;
  isSubmitting: boolean;
  error: Error | null;
  currentUserIdentifier: string;
}

function DeleteModuleDialog({
  open,
  onOpenChange,
  module,
  onConfirm,
  isSubmitting,
  error,
  currentUserIdentifier,
}: DeleteModuleDialogProps) {
  const handleConfirm = () => {
    if (!module) return;

    // Get moduleId from the first permission
    const moduleId = module.permission[0]?.moduleId;
    if (!moduleId) return;

    onConfirm({
      moduleId,
      status: "inactive",
      updatedBy: currentUserIdentifier,
    });
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  if (!module) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deactivate Module</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate this module? This will set the module status to inactive.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Module: {module.moduleName}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This module has {module.permission.length} permission{module.permission.length !== 1 ? "s" : ""} associated with it.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {getErrorMessage(error)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Deactivating...
              </>
            ) : (
              "Deactivate Module"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Roles Table Component
interface RolesTableProps {
  roles: RbacRole[];
  pagination: RbacPagination | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

function RolesTable({
  roles,
  pagination,
  isLoading,
  isFetching,
  isError,
  error,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  onPageChange,
  onRetry,
}: RolesTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Role List
              {isFetching && !isLoading && (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-label="Refreshing data"
                />
              )}
            </CardTitle>
            <CardDescription>
              View all system roles and their configurations
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 sm:w-64"
                aria-label="Search roles by name"
              />
            </div>
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
            >
              <SelectTrigger className="sm:w-40" aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Role Name</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="w-[180px]">Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                      <span>Loading roles...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                      <div className="text-center">
                        <p className="font-medium text-destructive">Failed to load roles</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getErrorMessage(error)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Shield className="h-6 w-6" aria-hidden="true" />
                      <span>No roles found</span>
                      {searchTerm && (
                        <span className="text-sm">
                          Try adjusting your search or filter criteria
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.roleId}>
                    <TableCell className="font-medium">{role.roleName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusColors[role.status]} flex w-fit items-center gap-1`}
                      >
                        {role.status === "active" ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span className="capitalize">{role.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.createdBy}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(role.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination
          pagination={pagination}
          page={page}
          onPageChange={onPageChange}
          itemName="role"
        />
      </CardContent>
    </Card>
  );
}

// User Roles Table Component
interface UserRolesTableProps {
  userRoles: RbacUserRole[];
  pagination: RbacPagination | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

function UserRolesTable({
  userRoles,
  pagination,
  isLoading,
  isFetching,
  isError,
  error,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  onPageChange,
  onRetry,
}: UserRolesTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              User Role Assignments
              {isFetching && !isLoading && (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-label="Refreshing data"
                />
              )}
            </CardTitle>
            <CardDescription>
              View all user role assignments in the system
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Search by role or user ID..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 sm:w-64"
                aria-label="Search user roles by role name or user ID"
              />
            </div>
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
            >
              <SelectTrigger className="sm:w-40" aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">User ID</TableHead>
                <TableHead className="w-[150px]">Role</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="w-[180px]">Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                      <span>Loading user roles...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                      <div className="text-center">
                        <p className="font-medium text-destructive">Failed to load user roles</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getErrorMessage(error)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : userRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Users className="h-6 w-6" aria-hidden="true" />
                      <span>No user role assignments found</span>
                      {searchTerm && (
                        <span className="text-sm">
                          Try adjusting your search or filter criteria
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                userRoles.map((userRole) => (
                  <TableRow key={userRole.id}>
                    <TableCell className="font-mono text-sm">
                      {userRole.userId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={roleBadgeColors[userRole.roleName] || ""}
                      >
                        {userRole.roleName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusColors[userRole.status]} flex w-fit items-center gap-1`}
                      >
                        {userRole.status === "active" ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span className="capitalize">{userRole.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {userRole.createdBy}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(userRole.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination
          pagination={pagination}
          page={page}
          onPageChange={onPageChange}
          itemName="assignment"
        />
      </CardContent>
    </Card>
  );
}

// Utility function to format dates
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}
