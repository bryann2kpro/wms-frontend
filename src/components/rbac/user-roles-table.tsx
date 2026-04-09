import type { RbacUserRole } from "@/lib/rbac";
import {
	formatDate,
	getErrorMessage,
	roleBadgeColors,
	statusColors,
} from "@/lib/utils";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { CheckCircle2, RefreshCw, Search, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableCell,
	TableHead,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { Users } from "lucide-react";
import type { StatusFilter } from "@/constants/status-filter";
import { Button } from "../ui/button";
import type { Pagination as PaginationType } from "@/lib/pagination/pagination";
import { Pagination } from "../pagination";

interface UserRolesTableProps {
	userRoles: RbacUserRole[];
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
								placeholder="Search by role or username..."
								value={searchTerm}
								onChange={(e) => onSearchChange(e.target.value)}
								className="pl-9 sm:w-64"
								aria-label="Search user roles by role name or username"
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
								<TableHead className="w-[300px]">Username</TableHead>
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
											<Loader2
												className="h-6 w-6 animate-spin"
												aria-hidden="true"
											/>
											<span>Loading user roles...</span>
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
													Failed to load user roles
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
										<TableCell className="text-sm">
											{userRole.userName}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={
													roleBadgeColors[userRole.roleName] ||
													"bg-gray-500/10 text-gray-600 border-gray-500/20"
												}
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
													<CheckCircle2
														className="h-3 w-3"
														aria-hidden="true"
													/>
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

export { UserRolesTable, type UserRolesTableProps };
