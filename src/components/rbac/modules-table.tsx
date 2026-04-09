import { Pagination } from "../pagination";
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
import { Plus } from "lucide-react";
import type { StatusFilter } from "@/constants/status-filter";
import type { RbacModule } from "@/lib/rbac";
import type { Pagination as PaginationType } from "@/lib/pagination/pagination";
import {
	formatDate,
	getErrorMessage,
	permissionTypeColors,
	statusColors,
} from "@/lib/utils";
import {
	CheckCircle2,
	XCircle,
	RefreshCw,
	Edit,
	Trash2,
	AlertCircle,
	Package,
} from "lucide-react";

// Modules Table Component
interface ModulesTableProps {
	modules: RbacModule[];
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
	const permissionOrder: Record<string, number> = {
		read: 0,
		create: 1,
		update: 2,
		delete: 3,
		approve: 4,
	};

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
						{/* Create Button */}
						<Button
							onClick={onCreateClick}
							className="text-white hover:opacity-90"
							style={{
								background: "var(--rbac-accent)",
								borderColor: "var(--rbac-accent)",
							}}
						>
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
											<Loader2
												className="h-6 w-6 animate-spin"
												aria-hidden="true"
											/>
											<span>Loading modules...</span>
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
													Failed to load modules
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
										<TableCell className="font-medium">
											{module.moduleName}
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1.5">
												{[...module.permission]
													.sort((a, b) => {
														const aOrder =
															permissionOrder[a.permissionType.toLowerCase()] ??
															99;
														const bOrder =
															permissionOrder[b.permissionType.toLowerCase()] ??
															99;
														return aOrder - bOrder;
													})
													.map((perm) => (
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
													<CheckCircle2
														className="h-3 w-3"
														aria-hidden="true"
													/>
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

export { ModulesTable, type ModulesTableProps };
