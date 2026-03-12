import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "../ui/card";
import { Loader2 } from "lucide-react";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "../ui/select";
import { Badge } from "../ui/badge";
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableCell,
	TableHead,
} from "../ui/table";
import { Button } from "../ui/button";
import type { StatusFilter } from "@/constants/status-filter";
import type { RbacRole } from "@/lib/rbac";
import type { Pagination as PaginationType } from "@/lib/pagination/pagination";
import { formatDate, getErrorMessage, statusColors } from "@/lib/utils";
import {
	CheckCircle2,
	XCircle,
	RefreshCw,
	AlertCircle,
	Shield,
	Eye,
	Pencil,
} from "lucide-react";
import { Pagination } from "../pagination";

// Roles Table Component
interface RolesTableProps {
	roles: RbacRole[];
	pagination: PaginationType | undefined;
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
	onEditClick: (role: RbacRole) => void;
	onViewPermissionsClick: (role: RbacRole) => void;
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
	onEditClick,
	onViewPermissionsClick,
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
							onValueChange={(value) =>
								onStatusFilterChange(value as StatusFilter)
							}
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
								<TableHead className="w-[120px] text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={5} className="h-32">
										<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
											<Loader2
												className="h-6 w-6 animate-spin"
												aria-hidden="true"
											/>
											<span>Loading roles...</span>
										</div>
									</TableCell>
								</TableRow>
							) : isError ? (
								<TableRow>
									<TableCell colSpan={5} className="h-32">
										<div className="flex flex-col items-center justify-center gap-3">
											<AlertCircle
												className="h-8 w-8 text-destructive"
												aria-hidden="true"
											/>
											<div className="text-center">
												<p className="font-medium text-destructive">
													Failed to load roles
												</p>
												<p className="text-sm text-muted-foreground mt-1">
													{getErrorMessage(error)}
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={onRetry}
												className="mt-2"
											>
												<RefreshCw
													className="mr-2 h-4 w-4"
													aria-hidden="true"
												/>
												Try Again
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : roles.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} className="h-32">
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
										<TableCell className="font-medium">
											{role.roleName}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={`${statusColors[role.status]} flex w-fit items-center gap-1`}
											>
												{role.status === "active" ? (
													<CheckCircle2
														className="h-3 w-3"
														aria-hidden="true"
													/>
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
										<TableCell className="text-right">
											<div className="flex justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => onEditClick(role)}
													aria-label={`Edit ${role.roleName} role`}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => onViewPermissionsClick(role)}
													aria-label={`View permissions for ${role.roleName}`}
													disabled={role.roleName === "Super Admin"} // Prevent Idiot Users from removing super_admin access
												>
													<Eye className="h-4 w-4" />
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
					itemName="role"
				/>
			</CardContent>
		</Card>
	);
}

export { RolesTable, type RolesTableProps };
