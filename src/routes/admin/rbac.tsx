import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchModules,
  fetchRoles,
  fetchUserRoles,
  type RbacModule,
  type RbacRole,
  type RbacUserRole,
  type ModulesQueryParams,
  type RolesQueryParams,
  type UserRolesQueryParams,
  type RbacPagination,
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
    return "You don't have permission to view this data.";
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
              View all system modules and their permissions
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                      <span>Loading modules...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32">
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
                  <TableCell colSpan={4} className="h-32">
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
                <TableHead className="w-[300px]">User Name</TableHead>
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
                    <TableCell className="font-mono text-sm">
                      {userRole.userName}
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
    return new Intl.DateTimeFormat("en-MY", {
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
