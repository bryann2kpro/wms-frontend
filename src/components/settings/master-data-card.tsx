import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	SUPPLIERS_QUERY,
	CREATE_SUPPLIER_MUTATION,
	UPDATE_SUPPLIER_MUTATION,
	DELETE_SUPPLIER_MUTATION,
	type SuppliersQueryData,
	type SuppliersQueryVariables,
	type CreateSupplierMutationData,
	type UpdateSupplierMutationData,
	type DeleteSupplierMutationData,
} from "@/lib/graphql/suppliers";
import {
	REGIONS_QUERY,
	CREATE_REGION_MUTATION,
	UPDATE_REGION_MUTATION,
	DELETE_REGION_MUTATION,
	type RegionsQueryData,
	type RegionsQueryVariables,
	type CreateRegionMutationData,
	type UpdateRegionMutationData,
	type DeleteRegionMutationData,
} from "@/lib/graphql/regions";
import {
	DELIVERY_SCHEDULES_QUERY,
	CREATE_DELIVERY_SCHEDULE_MUTATION,
	UPDATE_DELIVERY_SCHEDULE_MUTATION,
	TOGGLE_DELIVERY_SCHEDULE_ACTIVE_MUTATION,
	DELETE_DELIVERY_SCHEDULE_MUTATION,
	type DeliverySchedulesQueryData,
	type DeliverySchedulesQueryVariables,
	type CreateDeliveryScheduleMutationData,
	type UpdateDeliveryScheduleMutationData,
	type ToggleDeliveryScheduleActiveMutationData,
	type DeleteDeliveryScheduleMutationData,
} from "@/lib/graphql/delivery-schedules";
import {
	OUTLETS_QUERY,
	CREATE_OUTLET_MUTATION,
	UPDATE_OUTLET_MUTATION,
	DELETE_OUTLET_MUTATION,
	type OutletsQueryData,
	type OutletsQueryVariables,
	type CreateOutletMutationData,
	type UpdateOutletMutationData,
	type DeleteOutletMutationData,
} from "@/lib/graphql/outlets";
import {
	STOCK_UNITS_QUERY,
	CREATE_STOCK_UNIT_MUTATION,
	UPDATE_STOCK_UNIT_MUTATION,
	TOGGLE_STOCK_UNIT_ACTIVE_MUTATION,
	DELETE_STOCK_UNIT_MUTATION,
	type StockUnitsQueryData,
	type StockUnitsQueryVariables,
	type CreateStockUnitMutationData,
	type UpdateStockUnitMutationData,
	type ToggleStockUnitActiveMutationData,
	type DeleteStockUnitMutationData,
} from "@/lib/graphql/stock-units";
import {
	RACKS_QUERY,
	CREATE_RACK_MUTATION,
	UPDATE_RACK_MUTATION,
	DELETE_RACK_MUTATION,
	type RacksQueryData,
	type RacksQueryVariables,
	type CreateRackMutationData,
	type UpdateRackMutationData,
	type DeleteRackMutationData,
} from "@/lib/graphql/racks";
import {
	SKUS_QUERY,
	CREATE_SKUS_MUTATION,
	UPDATE_SKUS_MUTATION,
	DELETE_SKUS_MUTATION,
	type SkusQueryData,
	type SkusQueryVariables,
	type CreateSkusMutationData,
	type UpdateSkusMutationData,
	type DeleteSkusMutationData,
} from "@/lib/graphql/skus";
import type {
	Supplier,
	Region,
	DeliverySchedule,
	Outlet,
	StockUnit,
	Rack,
	Skus,
} from "@/lib/graphql/types";
import {
	Plus,
	Edit,
	Trash2,
	Search,
	MapPin,
	Truck,
	CalendarClock,
	Store,
	Package,
	LayoutGrid,
	X,
	Eye,
	Calendar as CalendarIcon,
} from "lucide-react";
import { formatDateOnly, statusColors } from "@/lib/utils";
import { format } from "date-fns";

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday" },
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
] as const;

const PAGE_SIZE = 10;

export function MasterDataCard() {
	const [subTab, setSubTab] = useState<
		"supplier" | "region" | "delivery-schedule" | "outlet" | "stock-unit" | "rack" | "skus"
	>("supplier");

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2 border-b pb-2">
				<Button
					variant={subTab === "supplier" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("supplier")}
					className="rounded-b-none"
				>
					<Truck className="mr-2 h-4 w-4" />
					Suppliers
				</Button>
				<Button
					variant={subTab === "region" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("region")}
					className="rounded-b-none"
				>
					<MapPin className="mr-2 h-4 w-4" />
					Regions
				</Button>
				<Button
					variant={subTab === "delivery-schedule" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("delivery-schedule")}
					className="rounded-b-none"
				>
					<CalendarClock className="mr-2 h-4 w-4" />
					Delivery Schedules
				</Button>
				<Button
					variant={subTab === "outlet" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("outlet")}
					className="rounded-b-none"
				>
					<Store className="mr-2 h-4 w-4" />
					Outlets
				</Button>
				<Button
					variant={subTab === "stock-unit" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("stock-unit")}
					className="rounded-b-none"
				>
					<Package className="mr-2 h-4 w-4" />
					Stock Units
				</Button>
				<Button
					variant={subTab === "rack" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("rack")}
					className="rounded-b-none"
				>
					<LayoutGrid className="mr-2 h-4 w-4" />
					Racks
				</Button>
				<Button
					variant={subTab === "skus" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("skus")}
					className="rounded-b-none"
				>
					<Package className="mr-2 h-4 w-4" />
					SKUS
				</Button>
			</div>
			{subTab === "supplier" && <SupplierSection />}
			{subTab === "region" && <RegionSection />}
			{subTab === "delivery-schedule" && <DeliveryScheduleSection />}
			{subTab === "outlet" && <OutletSection />}
			{subTab === "stock-unit" && <StockUnitSection />}
			{subTab === "rack" && <RackSection />}
			{subTab === "skus" && <SkusSection />}
		</div>
	);
}

function SupplierSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Supplier | null>(null);
	const [deleting, setDeleting] = useState<Supplier | null>(null);

	const { data, loading, refetch } = useQuery<
		SuppliersQueryData,
		SuppliersQueryVariables
	>(SUPPLIERS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim()
				? { filter: { supplierName: search.trim() } }
				: {}),
		},
	});

	const [createSupplier, { loading: createLoading }] =
		useMutation<CreateSupplierMutationData>(CREATE_SUPPLIER_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateSupplier, { loading: updateLoading }] =
		useMutation<UpdateSupplierMutationData>(UPDATE_SUPPLIER_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [deleteSupplier, { loading: deleteLoading }] =
		useMutation<DeleteSupplierMutationData>(DELETE_SUPPLIER_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.suppliers?.query ?? [];
	const pagination = data?.suppliers?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Suppliers</CardTitle>
						<CardDescription>Manage supplier master data</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Supplier
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										No suppliers found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.supplierId}>
										<TableCell className="font-mono text-sm">
											{row.supplierCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.supplierName}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{pagination && totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {currentPage} of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<SupplierFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createSupplier({
						variables: {
							input: {
								supplierName: values.supplierName,
								supplierCode: values.supplierCode,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Supplier"
				description="Create a new supplier."
			/>

			{editing && (
				<SupplierFormDialog
					key={editing.supplierId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						supplierName: editing.supplierName,
						supplierCode: editing.supplierCode,
					}}
					onSubmit={(values) =>
						updateSupplier({
							variables: {
								id: editing.supplierId,
								input: {
									supplierName: values.supplierName,
									supplierCode: values.supplierCode,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Supplier"
					description="Update supplier details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.supplierName}
					onConfirm={() =>
						deleteSupplier({ variables: { id: deleting.supplierId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function RegionSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Region | null>(null);
	const [deleting, setDeleting] = useState<Region | null>(null);

	const { data, loading, refetch } = useQuery<
		RegionsQueryData,
		RegionsQueryVariables
	>(REGIONS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim() ? { filter: { regionName: search.trim() } } : {}),
		},
	});

	const [createRegion, { loading: createLoading }] =
		useMutation<CreateRegionMutationData>(CREATE_REGION_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateRegion, { loading: updateLoading }] =
		useMutation<UpdateRegionMutationData>(UPDATE_REGION_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [deleteRegion, { loading: deleteLoading }] =
		useMutation<DeleteRegionMutationData>(DELETE_REGION_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.regions?.query ?? [];
	const pagination = data?.regions?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Regions</CardTitle>
						<CardDescription>Manage delivery region master data</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Region
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										No regions found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.regionId}>
										<TableCell className="font-mono text-sm">
											{row.regionCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.regionName}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{pagination && totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {currentPage} of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<RegionFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createRegion({
						variables: {
							input: {
								regionName: values.regionName,
								regionCode: values.regionCode,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Region"
				description="Create a new region."
			/>

			{editing && (
				<RegionFormDialog
					key={editing.regionId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						regionName: editing.regionName,
						regionCode: editing.regionCode,
					}}
					onSubmit={(values) =>
						updateRegion({
							variables: {
								id: editing.regionId,
								input: {
									regionName: values.regionName,
									regionCode: values.regionCode,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Region"
					description="Update region details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.regionName}
					onConfirm={() =>
						deleteRegion({ variables: { id: deleting.regionId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function DeliveryScheduleSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [regionIdFilter, setRegionIdFilter] = useState<string>("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<DeliverySchedule | null>(null);
	const [deleting, setDeleting] = useState<DeliverySchedule | null>(null);

	const { data: regionsData } = useQuery<RegionsQueryData, RegionsQueryVariables>(
		REGIONS_QUERY,
		{ variables: { pageSize: 200, pageNumber: 1 } }
	);
	const regions = regionsData?.regions?.query ?? [];

	const { data, loading, refetch } = useQuery<
		DeliverySchedulesQueryData,
		DeliverySchedulesQueryVariables
	>(DELIVERY_SCHEDULES_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(regionIdFilter
				? { filter: { regionId: regionIdFilter } }
				: {}),
		},
	});

	const [createSchedule, { loading: createLoading }] = useMutation<
		CreateDeliveryScheduleMutationData
	>(CREATE_DELIVERY_SCHEDULE_MUTATION, {
		onCompleted: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const [updateSchedule, { loading: updateLoading }] = useMutation<
		UpdateDeliveryScheduleMutationData
	>(UPDATE_DELIVERY_SCHEDULE_MUTATION, {
		onCompleted: () => {
			refetch();
			setEditing(null);
		},
	});
	const [toggleActive] = useMutation<ToggleDeliveryScheduleActiveMutationData>(
		TOGGLE_DELIVERY_SCHEDULE_ACTIVE_MUTATION,
		{ onCompleted: () => refetch() }
	);
	const [deleteSchedule, { loading: deleteLoading }] = useMutation<
		DeleteDeliveryScheduleMutationData
	>(DELETE_DELIVERY_SCHEDULE_MUTATION, {
		onCompleted: () => {
			refetch();
			setDeleting(null);
		},
	});

	const list = data?.deliverySchedules?.query ?? [];
	const pagination = data?.deliverySchedules?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Delivery Schedules</CardTitle>
						<CardDescription>
							Recurring delivery days and cutoffs by region
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Select
							value={regionIdFilter || "all"}
							onValueChange={(v) => {
								setRegionIdFilter(v === "all" ? "" : v);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="All regions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All regions</SelectItem>
								{regions.map((r) => (
									<SelectItem key={r.regionId} value={r.regionId}>
										{r.regionName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Schedule
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Region</TableHead>
								<TableHead>Day</TableHead>
								<TableHead>Cutoff (days before)</TableHead>
								<TableHead>Cutoff time</TableHead>
								<TableHead>Active</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="h-24 text-center text-muted-foreground"
									>
										No delivery schedules found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.scheduleId}>
										<TableCell className="font-medium">
											{row.regionName}
											<span className="ml-1 text-muted-foreground font-normal">
												({row.regionCode})
											</span>
										</TableCell>
										<TableCell>{row.dayName}</TableCell>
										<TableCell>{row.cutoffDaysBefore}</TableCell>
										<TableCell className="font-mono text-sm">
											{row.cutoffTime}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={
													row.isActive
														? "bg-green-500/10 text-green-600 border-green-500/20"
														: "bg-muted text-muted-foreground"
												}
											>
												{row.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													toggleActive({
														variables: {
															id: row.scheduleId,
															isActive: !row.isActive,
															updatedBy: createdBy,
														},
													})
												}
												title={row.isActive ? "Deactivate" : "Activate"}
											>
												{row.isActive ? "Deactivate" : "Activate"}
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{pagination && totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {currentPage} of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<DeliveryScheduleFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				regions={regions}
				onSubmit={(values) =>
					createSchedule({
						variables: {
							input: {
								regionId: values.regionId,
								dayOfWeek: values.dayOfWeek,
								cutoffDaysBefore: values.cutoffDaysBefore,
								cutoffTime: values.cutoffTime,
								isActive: values.isActive ?? true,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Delivery Schedule"
				description="Add a recurring delivery day for a region."
			/>

			{editing && (
				<DeliveryScheduleFormDialog
					key={editing.scheduleId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					regions={regions}
					initial={{
						dayOfWeek: editing.dayOfWeek,
						cutoffDaysBefore: editing.cutoffDaysBefore,
						cutoffTime: editing.cutoffTime,
						isActive: editing.isActive,
					}}
					onSubmit={(values) =>
						updateSchedule({
							variables: {
								id: editing.scheduleId,
								input: {
									dayOfWeek: values.dayOfWeek,
									cutoffDaysBefore: values.cutoffDaysBefore,
									cutoffTime: values.cutoffTime,
									isActive: values.isActive,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Delivery Schedule"
					description="Update schedule details."
					hideRegion
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={`${deleting.regionName} - ${deleting.dayName}`}
					onConfirm={() =>
						deleteSchedule({ variables: { id: deleting.scheduleId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function OutletSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [regionIdFilter, setRegionIdFilter] = useState<string>("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Outlet | null>(null);
	const [deleting, setDeleting] = useState<Outlet | null>(null);

	const { data: regionsData } = useQuery<RegionsQueryData, RegionsQueryVariables>(
		REGIONS_QUERY,
		{ variables: { pageSize: 200, pageNumber: 1 } }
	);
	const regions = regionsData?.regions?.query ?? [];

	const filter: OutletsQueryVariables["filter"] = {
		...(search.trim() ? { outletName: search.trim() } : {}),
		...(regionIdFilter ? { regionId: regionIdFilter } : {}),
	};

	const { data, loading, refetch } = useQuery<
		OutletsQueryData,
		OutletsQueryVariables
	>(OUTLETS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			filter: Object.keys(filter).length > 0 ? filter : undefined,
		},
	});

	const [createOutlet, { loading: createLoading }] =
		useMutation<CreateOutletMutationData>(CREATE_OUTLET_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateOutlet, { loading: updateLoading }] =
		useMutation<UpdateOutletMutationData>(UPDATE_OUTLET_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [deleteOutlet, { loading: deleteLoading }] =
		useMutation<DeleteOutletMutationData>(DELETE_OUTLET_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const outletsList = data?.outlets?.query ?? [];
	const outletsPagination = data?.outlets?.pagination;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Outlets</CardTitle>
						<CardDescription>
							Store/outlet locations; each outlet can be assigned to a region
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Select
							value={regionIdFilter || "all"}
							onValueChange={(v) => {
								setRegionIdFilter(v === "all" ? "" : v);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="All regions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All regions</SelectItem>
								{regions.map((r) => (
									<SelectItem key={r.regionId} value={r.regionId}>
										{r.regionName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Outlet
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Region</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : outletsList.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 text-center text-muted-foreground"
									>
										No outlets found.
									</TableCell>
								</TableRow>
							) : (
								outletsList.map((row) => (
									<TableRow key={row.outletId}>
										<TableCell className="font-mono text-sm">
											{row.outletCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.outletName}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{row.regionName
												? `${row.regionName} (${row.regionCode ?? ""})`
												: "Unassigned"}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{outletsPagination && outletsPagination.totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {outletsPagination.currentPage} of {outletsPagination.totalPages}{" "}
							({outletsPagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!outletsPagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!outletsPagination.hasNextPage}
								onClick={() =>
									setPage((p) =>
										Math.min(outletsPagination.totalPages, p + 1)
									)
								}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<OutletFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				regions={regions}
				onSubmit={(values) =>
					createOutlet({
						variables: {
							input: {
								outletName: values.outletName,
								outletCode: values.outletCode,
								regionId: values.regionId || null,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Outlet"
				description="Create a new outlet. Region is optional."
			/>

			{editing && (
				<OutletFormDialog
					key={editing.outletId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					regions={regions}
					initial={{
						outletName: editing.outletName,
						outletCode: editing.outletCode,
						regionId: editing.regionId ?? undefined,
					}}
					onSubmit={(values) =>
						updateOutlet({
							variables: {
								id: editing.outletId,
								input: {
									outletName: values.outletName,
									outletCode: values.outletCode,
									regionId: values.regionId || null,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Outlet"
					description="Update outlet and assign to a region."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.outletName}
					onConfirm={() =>
						deleteOutlet({ variables: { id: deleting.outletId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function RackSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Rack | null>(null);
	const [deleting, setDeleting] = useState<Rack | null>(null);

	const { data, loading, refetch } = useQuery<
		RacksQueryData,
		RacksQueryVariables
	>(RACKS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim()
				? { filter: { rackRow: search.trim() } }
				: {}),
		},
	});

	const [createRack, { loading: createLoading }] =
		useMutation<CreateRackMutationData>(CREATE_RACK_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateRack, { loading: updateLoading }] =
		useMutation<UpdateRackMutationData>(UPDATE_RACK_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [deleteRack, { loading: deleteLoading }] =
		useMutation<DeleteRackMutationData>(DELETE_RACK_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.racks?.query ?? [];
	const pagination = data?.racks?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	const rackDisplayName = (rack: Rack) =>
		`${rack.rackRow}-${rack.rackColumn}-${rack.rackLevel}`;

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Racks</CardTitle>
						<CardDescription>
							Warehouse rack locations (row, column, level)
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by row..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Rack
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Row</TableHead>
								<TableHead>Column</TableHead>
								<TableHead>Level</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="h-24 text-center text-muted-foreground"
									>
										No racks found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.rackId}>
										<TableCell>{row.rackRow}</TableCell>
										<TableCell>{row.rackColumn}</TableCell>
										<TableCell>{row.rackLevel}</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{pagination && totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {currentPage} of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<RackFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createRack({
						variables: {
							input: {
								rackRow: values.rackRow,
								rackColumn: values.rackColumn,
								rackLevel: values.rackLevel,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Rack"
				description="Create a new rack location (row, column, level)."
			/>

			{editing && (
				<RackFormDialog
					key={editing.rackId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						rackRow: editing.rackRow,
						rackColumn: editing.rackColumn,
						rackLevel: editing.rackLevel,
					}}
					onSubmit={(values) =>
						updateRack({
							variables: {
								id: editing.rackId,
								input: {
									rackRow: values.rackRow,
									rackColumn: values.rackColumn,
									rackLevel: values.rackLevel,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Rack"
					description="Update rack location."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={rackDisplayName(deleting)}
					onConfirm={() =>
						deleteRack({ variables: { id: deleting.rackId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function SkusSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Skus | null>(null);
	const [deleting, setDeleting] = useState<Skus | null>(null);
	const [viewingSuppliers, setViewingSuppliers] = useState<Skus | null>(null);


	const { data, loading, refetch } = useQuery<
		SkusQueryData,
		SkusQueryVariables
	>(SKUS_QUERY, {
		variables: {},
	});
	const allSkus: Skus[] = data?.skus?.query ?? [];
	
	// Client-side filtering
	const list = search.trim()
		? allSkus.filter((sku: Skus) =>
				sku.skuCode.toLowerCase().includes(search.toLowerCase().trim()) ||
				sku.skuDescription.toLowerCase().includes(search.toLowerCase().trim())
			)
		: allSkus;
	
	const createdBy = user?.id ?? "";

	const { data: suppliersData } = useQuery<SuppliersQueryData, SuppliersQueryVariables>(
		SUPPLIERS_QUERY,
		{ variables: {} }
	);
	const suppliers = suppliersData?.suppliers.query ?? [];

	const { data: stockUnitsData } = useQuery<StockUnitsQueryData, StockUnitsQueryVariables>(
		STOCK_UNITS_QUERY,
		{ variables: {} }
	);
	const stockUnits = stockUnitsData?.stockUnits.query ?? [];

	const [createSkus, { loading: createLoading }] =
		useMutation<CreateSkusMutationData>(CREATE_SKUS_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});

	const [updateSkus, { loading: updateLoading }] =
		useMutation<UpdateSkusMutationData>(UPDATE_SKUS_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});

	const [deleteSkus, { loading: deleteLoading }] =
		useMutation<DeleteSkusMutationData>(DELETE_SKUS_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});


	return (
		<Card>
			<CardHeader>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Skus</CardTitle>
						<CardDescription>
							Stock Keeping Units
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Skus
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Code</TableHead>
							<TableHead>Description</TableHead>
							<TableHead>Price (RM)</TableHead>
							<TableHead>Quantity</TableHead>
							<TableHead>Expiry Date</TableHead>
							<TableHead>UOM</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{(() => {
							if (loading) {
								return (
									<TableRow>
										<TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
											Loading...
										</TableCell>
									</TableRow>
								);
							}
							if (list.length === 0) {
								return (
									<TableRow>
										<TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
											No data found.
										</TableCell>
									</TableRow>
								);
							}
							return list.map((row: Skus) => {
								let status: string;
								if (row.isActive) {
									status = "active";
								} else {
									status = "inactive";
								}
								const badgeStyle = statusColors[status];
								const uom = stockUnits.find((unit) => unit.stockUnitId === row.skuUom);
								let uomName: string;
								if (uom) {
									uomName = `${uom.unitName} (${uom.unitCode})`;
								} else {
									uomName = row.skuUom;
								}
								let price: string | null = row.skuPrice?.toString() ?? null;
								if(price === null) {
									price = 'N/A';
								} else {
									price = Number(price).toFixed(2);
								}
								return (
									<TableRow key={row.skuId}>
										<TableCell>{row.skuCode}</TableCell>
										<TableCell>{row.skuDescription}</TableCell>
										<TableCell>{price}</TableCell>
										<TableCell>{Number(row.skuQuantity).toFixed(2)}</TableCell>
										<TableCell>{formatDateOnly(row.skuExpiryDate)}</TableCell>
										<TableCell>{uomName}</TableCell>
										<TableCell>
											<Badge variant="outline" className={badgeStyle}>
												{row.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setViewingSuppliers(row)}
												title="View Suppliers"
											>
												<Eye className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								);
							});
						})()}
					</TableBody>
				</Table>
			</CardContent>
			<SkusSuppliersViewDialog
				open={viewingSuppliers !== null}
				onOpenChange={(open) => {
					if (!open) setViewingSuppliers(null);
				}}
				sku={viewingSuppliers}
				suppliers={suppliers}
			/>
			<SkusSuppliersViewDialog
				open={viewingSuppliers !== null}
				onOpenChange={(open) => {
					if (!open) setViewingSuppliers(null);
				}}
				sku={viewingSuppliers}
				suppliers={suppliers}
			/>
			<SkusFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				suppliers={suppliers}
				stockUnits={stockUnits}
				onSubmit={(values) => {
					// Convert date from YYYY-MM-DD to format: YYYY-MM-DD HH:mm:ss.SSSSSS
					// expiryDate is required, so values.skuExpiryDate should always be present
					// Use the date string directly and append time with microseconds
					const expiryDate = values.skuExpiryDate
						? `${values.skuExpiryDate} 00:00:00.000000`
						: "";
					createSkus({
						variables: {
							input: {
								skuCode: values.skuCode,
								skuDescription: values.skuDescription,
								skuPrice: values.skuPrice === 0 || values.skuPrice === null ? null : Number(values.skuPrice),
								skuQuantity: Number(values.skuQuantity),
								skuExpiryDate: expiryDate,
								skuUom: values.skuUom,
								skuSuppliers: values.skuSuppliers?.map((s) => ({
									supplierId: s.supplierId,
									originalSkuCode: s.originalSkuCode || null,
								})) || [],
								isActive: true,
								createdBy,
								updatedBy: createdBy,
							},
						},
					});
				}}
				loading={createLoading}
				title="Add SKU"
				description="Create a new Stock Keeping Unit"
			/>
			{editing && (
				<SkusFormDialog
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					suppliers={suppliers}
					stockUnits={stockUnits}
					initial={{
						skuCode: editing.skuCode,
						skuDescription: editing.skuDescription,
						skuPrice: editing.skuPrice,
						skuQuantity: editing.skuQuantity,
						skuExpiryDate: editing.skuExpiryDate, // Pass full date string
						skuUom: editing.skuUom,
						skuSuppliers: editing.skuSuppliers,
						isActive: editing.isActive,
					}}
					onSubmit={(values) => {
						// Convert date from YYYY-MM-DD to format: YYYY-MM-DD HH:mm:ss.SSSSSS
						const expiryDate = values.skuExpiryDate
							? `${values.skuExpiryDate} 00:00:00.000000`
							: "";
						updateSkus({
							variables: {
								id: editing.skuId,
								input: {
									skuCode: values.skuCode,
									skuDescription: values.skuDescription,
									skuPrice: values.skuPrice === 0 || values.skuPrice === null ? null : Number(values.skuPrice),
									skuQuantity: Number(values.skuQuantity),
									skuExpiryDate: expiryDate,
									skuUom: values.skuUom,
									skuSuppliers: values.skuSuppliers?.map((s) => ({
										supplierId: s.supplierId,
										originalSkuCode: s.originalSkuCode || null,
									})) || [],
									isActive: values.isActive,
									updatedBy: createdBy,
								},
							},
						});
					}}
					loading={updateLoading}
					title="Edit SKU"
					description="Update Stock Keeping Unit details"
				/>
			)}
			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.skuCode}
					onConfirm={() => deleteSkus({ variables: { id: deleting.skuId } })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function SkusSuppliersViewDialog({
	open,
	onOpenChange,
	sku,
	suppliers,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sku: Skus | null;
	suppliers: Supplier[];
}) {
	if (!sku) return null;

	const supplierDetails = sku.skuSuppliers.map((skuSupplier) => {
		const supplier = suppliers.find((s) => s.supplierId === skuSupplier.supplierId);
		return {
			...skuSupplier,
			supplierName: supplier?.supplierName || "Unknown",
			supplierCode: supplier?.supplierCode || "Unknown",
		};
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Suppliers for {sku.skuCode}</DialogTitle>
					<DialogDescription>
						View all suppliers associated with this SKU
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					{supplierDetails.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-8">
							No suppliers associated with this SKU.
						</p>
					) : (
						<div className="space-y-4">
							{supplierDetails.map((item) => (
								<div key={item.supplierId} className="border rounded-md p-4 space-y-2">
									<div className="flex items-center justify-between">
										<div>
											<div className="font-medium text-sm">
												{item.supplierName}
											</div>
											<div className="text-xs text-muted-foreground">
												Code: {item.supplierCode}
											</div>
										</div>
									</div>
									{item.originalSkuCode && (
										<div className="pt-2 border-t">
											<Label className="text-xs text-muted-foreground">
												Original SKU Code
											</Label>
											<div className="text-sm mt-1">
												{item.originalSkuCode}
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SkusFormDialog({
	open,
	onOpenChange,
	suppliers,
	stockUnits,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	suppliers: Supplier[];
	stockUnits: StockUnit[];
	initial?: {
		skuCode: string;
		skuDescription: string;
		skuPrice: number | null;
		skuQuantity: number;
		skuExpiryDate: string;
		skuUom: string;
		skuSuppliers?: Array<{ supplierId: string; originalSkuCode: string | null }>;
		isActive?: boolean;
	};
	onSubmit: (v: {
		skuCode: string;
		skuDescription: string;
		skuPrice: number | null;
		skuQuantity: number;
		skuExpiryDate: string;
		skuUom: string;
		skuSuppliers?: Array<{ supplierId: string; originalSkuCode?: string | null }>;
		isActive?: boolean;
	}) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [skuCode, setSkuCode] = useState(initial?.skuCode ?? "");
	const [skuDescription, setSkuDescription] = useState(initial?.skuDescription ?? "");
	const [skuPrice, setSkuPrice] = useState(initial?.skuPrice?.toString() ?? "");
	const [skuQuantity, setSkuQuantity] = useState(initial?.skuQuantity?.toString() ?? "");
	const parseDate = (dateValue: string | number | undefined): Date | undefined => {
		if (!dateValue) return undefined;
		
		try {
			// Handle numeric timestamp (milliseconds)
			if (typeof dateValue === "number") {
				const date = new Date(dateValue);
				if (isNaN(date.getTime())) {
					console.warn("Invalid date timestamp:", dateValue);
					return undefined;
				}
				return date;
			}
			
			// Handle string that is a numeric timestamp
			if (typeof dateValue === "string" && /^\d+$/.test(dateValue.trim())) {
				const date = new Date(Number(dateValue));
				if (isNaN(date.getTime())) {
					console.warn("Invalid date timestamp string:", dateValue);
					return undefined;
				}
				return date;
			}
			
			// Handle PostgreSQL timestamp with timezone format: "2027-02-09 16:00:00+00"
			// Extract YYYY-MM-DD from the string
			const dateMatch = dateValue.match(/(\d{4}-\d{2}-\d{2})/);
			if (dateMatch) {
				const datePart = dateMatch[1];
				// Create date at midnight in local timezone for date picker
				// This ensures the date picker shows the correct date regardless of timezone
				const [year, month, day] = datePart.split("-").map(Number);
				const date = new Date(year, month - 1, day);
				
				// Verify the date is valid
				if (isNaN(date.getTime())) {
					console.warn("Invalid date parsed:", dateValue);
					return undefined;
				}
				return date;
			}
			
			// Fallback: try parsing the string directly
			const date = new Date(dateValue);
			if (isNaN(date.getTime())) {
				console.warn("Invalid date string:", dateValue);
				return undefined;
			}
			return date;
		} catch (error) {
			console.error("Error parsing date:", dateValue, error);
			return undefined;
		}
	};

	const [skuExpiryDate, setSkuExpiryDate] = useState<Date | undefined>(
		parseDate(initial?.skuExpiryDate)
	);
	const [skuUom, setSkuUom] = useState(initial?.skuUom ?? "");
	const [skuSuppliers, setSkuSuppliers] = useState<Array<{ supplierId: string; originalSkuCode: string | null }>>(
		initial?.skuSuppliers ?? []
	);
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);
	const [step, setStep] = useState(1);
	const [supplierSearch, setSupplierSearch] = useState("");
	const [errors, setErrors] = useState<{
		skuCode?: string;
		skuDescription?: string;
		skuQuantity?: string;
		skuExpiryDate?: string;
		skuUom?: string;
	}>({});

	useEffect(() => {
		if (open) {
			setSkuCode(initial?.skuCode ?? "");
			setSkuDescription(initial?.skuDescription ?? "");
			setSkuPrice(initial?.skuPrice?.toString() ?? "");
			setSkuQuantity(initial?.skuQuantity?.toString() ?? "");
			const parsedDate = parseDate(initial?.skuExpiryDate);
			setSkuExpiryDate(parsedDate);
			setSkuUom(initial?.skuUom ?? "");
			setSkuSuppliers(initial?.skuSuppliers ?? []);
			setIsActive(initial?.isActive ?? true);
			setStep(1);
			setSupplierSearch("");
			setErrors({});
		}
	}, [open, initial]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setSkuCode(initial?.skuCode ?? "");
			setSkuDescription(initial?.skuDescription ?? "");
			setSkuPrice(initial?.skuPrice?.toString() ?? "");
			setSkuQuantity(initial?.skuQuantity?.toString() ?? "");
			setSkuExpiryDate(parseDate(initial?.skuExpiryDate));
			setSkuUom(initial?.skuUom ?? "");
			setSkuSuppliers(initial?.skuSuppliers ?? []);
			setIsActive(initial?.isActive ?? true);
			setStep(1);
			setSupplierSearch("");
			setErrors({});
		}
		onOpenChange(next);
	};

	const toggleSupplier = (supplierId: string) => {
		setSkuSuppliers((prev) => {
			const existing = prev.find((s) => s.supplierId === supplierId);
			if (existing) {
				return prev.filter((s) => s.supplierId !== supplierId);
			} else {
				return [...prev, { supplierId, originalSkuCode: null }];
			}
		});
	};

	const updateOriginalSkuCode = (supplierId: string, originalSkuCode: string) => {
		setSkuSuppliers((prev) =>
			prev.map((s) =>
				s.supplierId === supplierId
					? { ...s, originalSkuCode: originalSkuCode.trim() || null }
					: s
			)
		);
	};

	const getOriginalSkuCode = (supplierId: string): string => {
		const supplier = skuSuppliers.find((s) => s.supplierId === supplierId);
		return supplier?.originalSkuCode || "";
	};

	const filteredSuppliers = suppliers.filter((supplier) => {
		// Exclude already added suppliers
		if (skuSuppliers.some((s) => s.supplierId === supplier.supplierId)) {
			return false;
		}
		// If no search term, show all available suppliers
		if (!supplierSearch.trim()) return true;
		// Filter by search term
		const searchLower = supplierSearch.toLowerCase().trim();
		return (
			supplier.supplierName.toLowerCase().includes(searchLower) ||
			supplier.supplierCode.toLowerCase().includes(searchLower)
		);
	});

	const canProceedToStep2 = 
		skuCode.trim() &&
		skuDescription.trim() &&
		skuQuantity &&
		skuExpiryDate !== undefined &&
		skuUom;

	const validateStep1 = () => {
		const newErrors: {
			skuCode?: string;
			skuDescription?: string;
			skuQuantity?: string;
			skuExpiryDate?: string;
			skuUom?: string;
		} = {};

		if (!skuCode.trim()) {
			newErrors.skuCode = "Code is required";
		}
		if (!skuDescription.trim()) {
			newErrors.skuDescription = "Description is required";
		}
		if (!skuQuantity || skuQuantity.trim() === "") {
			newErrors.skuQuantity = "Quantity is required";
		}
		if (!skuExpiryDate || isNaN(skuExpiryDate.getTime())) {
			newErrors.skuExpiryDate = "Expiry date is required";
		}
		if (!skuUom) {
			newErrors.skuUom = "Unit of measure is required";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleNext = () => {
		const isValid = validateStep1();
		if (isValid) {
			setErrors({});
			setStep(2);
		}
	};

	const handleBack = () => {
		setStep(1);
	};

	const handleSubmit = () => {
		if (!skuExpiryDate || isNaN(skuExpiryDate.getTime())) return;
		const expiryDateString = skuExpiryDate.toISOString().split("T")[0];
		let priceValue: number | null = null;
		if (skuPrice.trim() !== "") {
			const parsed = parseFloat(skuPrice);
			if (!isNaN(parsed)) {
				priceValue = parsed;
			}
		}
		onSubmit({
			skuCode: skuCode.trim(),
			skuDescription: skuDescription.trim(),
			skuPrice: priceValue,
			skuQuantity: parseInt(skuQuantity, 10),
			skuExpiryDate: expiryDateString,
			skuUom,
			skuSuppliers,
			isActive,
		});
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{(() => {
					if (step === 1) {
						const hasErrors = Object.keys(errors).length > 0;
						return (
							<div className="grid gap-4 py-4">
								{hasErrors && (
									<div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
										<p className="text-sm text-destructive font-medium mb-1">
											Please fix the following errors to continue:
										</p>
										<ul className="text-sm text-destructive list-disc list-inside space-y-1">
											{errors.skuCode && <li>Code is required</li>}
											{errors.skuDescription && <li>Description is required</li>}
											{errors.skuQuantity && <li>Quantity is required</li>}
											{errors.skuExpiryDate && <li>Expiry date is required</li>}
											{errors.skuUom && <li>Unit of measure is required</li>}
										</ul>
									</div>
								)}
								<div className="grid gap-2">
									<Label htmlFor="sku-code">Code</Label>
									<Input
										id="sku-code"
										value={skuCode}
										onChange={(e) => {
											setSkuCode(e.target.value);
											if (errors.skuCode) {
												setErrors((prev) => ({ ...prev, skuCode: undefined }));
											}
										}}
										placeholder="SKU name"
										className={errors.skuCode ? "border-destructive" : ""}
									/>
									{errors.skuCode && (
										<p className="text-sm text-destructive">{errors.skuCode}</p>
									)}
								</div>
								<div className="grid gap-2">
									<Label htmlFor="sku-description">Description</Label>
									<Input
										id="sku-description"
										value={skuDescription}
										onChange={(e) => {
											setSkuDescription(e.target.value);
											if (errors.skuDescription) {
												setErrors((prev) => ({ ...prev, skuDescription: undefined }));
											}
										}}
										placeholder="SKU description"
										className={errors.skuDescription ? "border-destructive" : ""}
									/>
									{errors.skuDescription && (
										<p className="text-sm text-destructive">{errors.skuDescription}</p>
									)}
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="grid gap-2">
										<Label htmlFor="sku-price">Price per unit</Label>
										<Input
											id="sku-price"
											type="number"
											step="0.01"
											value={skuPrice}
											onChange={(e) => setSkuPrice(e.target.value)}
											placeholder="0.00"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="sku-quantity">Quantity</Label>
										<Input
											id="sku-quantity"
											type="number"
											min="0"
											value={skuQuantity}
											onChange={(e) => {
												const value = e.target.value;
												// Allow empty string or positive numbers only
												if (value === "" || (!isNaN(Number(value)) && Number(value) >= 0)) {
													setSkuQuantity(value);
													if (errors.skuQuantity) {
														setErrors((prev) => ({ ...prev, skuQuantity: undefined }));
													}
												}
											}}
											placeholder="0"
											className={errors.skuQuantity ? "border-destructive" : ""}
										/>
										{errors.skuQuantity && (
											<p className="text-sm text-destructive">{errors.skuQuantity}</p>
										)}
									</div>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="sku-expiry-date">Expiry Date</Label>
									<Popover>
										{(() => {
											let dateButtonClassName = "w-full justify-start text-left font-normal h-10 hover:bg-accent hover:text-accent-foreground transition-colors";
											if (!skuExpiryDate) {
												dateButtonClassName += " text-muted-foreground";
											} else {
												dateButtonClassName += " text-foreground";
											}
											if (errors.skuExpiryDate) {
												dateButtonClassName += " border-destructive";
											}
											return (
												<PopoverTrigger asChild>
													<Button
														id="sku-expiry-date"
														variant="outline"
														className={dateButtonClassName}
													>
														<CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
														<span className="truncate">
															{skuExpiryDate && !isNaN(skuExpiryDate.getTime()) ? (
																format(skuExpiryDate, "PPP")
															) : (
																"Select expiry date"
															)}
														</span>
													</Button>
												</PopoverTrigger>
											);
										})()}
										<PopoverContent 
											className="w-auto p-0 rounded-lg border shadow-lg bg-background" 
											align="start"
											sideOffset={4}
										>
											<Calendar
												mode="single"
												selected={skuExpiryDate}
												onSelect={(date) => {
													if (date) {
														setSkuExpiryDate(date);
														if (errors.skuExpiryDate) {
															setErrors((prev) => ({ ...prev, skuExpiryDate: undefined }));
														}
													}
												}}
												defaultMonth={skuExpiryDate || new Date()}
												captionLayout="dropdown"
												showOutsideDays={true}
												fromYear={new Date().getFullYear()}
												toYear={new Date().getFullYear() + 10}
											/>
										</PopoverContent>
									</Popover>
									{errors.skuExpiryDate && (
										<p className="text-sm text-destructive">{errors.skuExpiryDate}</p>
									)}
								</div>
								<div className="grid gap-2">
									<Label htmlFor="sku-uom">Unit of Measure</Label>
									<Select 
										value={skuUom} 
										onValueChange={(value) => {
											setSkuUom(value);
											if (errors.skuUom) {
												setErrors((prev) => ({ ...prev, skuUom: undefined }));
											}
										}}
									>
										<SelectTrigger className={errors.skuUom ? "border-destructive" : ""}>
											<SelectValue placeholder="Select UOM" />
										</SelectTrigger>
										<SelectContent>
											{stockUnits
												.filter((u) => u.isActive)
												.map((unit) => (
													<SelectItem key={unit.stockUnitId} value={unit.stockUnitId}>
														{unit.unitName} ({unit.unitCode})
													</SelectItem>
												))}
										</SelectContent>
									</Select>
									{errors.skuUom && (
										<p className="text-sm text-destructive">{errors.skuUom}</p>
									)}
								</div>
							</div>
						);
					} else {
						return (
							<div className="grid gap-4 py-4">
								<div className="grid gap-2">
									<Label htmlFor="supplier-search">Add Supplier</Label>
									<div className="relative">
										<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											id="supplier-search"
											placeholder="Search by supplier name or code..."
											value={supplierSearch}
											onChange={(e) => setSupplierSearch(e.target.value)}
											className="pl-9"
										/>
									</div>
									{(() => {
										if (filteredSuppliers.length > 0) {
											return (
												<div className="border rounded-md mt-2 h-40 overflow-y-auto">
													{filteredSuppliers.map((supplier) => (
														<button
															key={supplier.supplierId}
															type="button"
															onClick={() => {
																toggleSupplier(supplier.supplierId);
																setSupplierSearch("");
															}}
															className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
														>
															<div className="text-sm">
																{supplier.supplierName} ({supplier.supplierCode})
															</div>
														</button>
													))}
												</div>
											);
										} else if (supplierSearch.trim()) {
											return (
												<p className="text-sm text-muted-foreground mt-2">
													No suppliers found matching "{supplierSearch}"
												</p>
											);
										} else {
											return null;
										}
									})()}
								</div>
								<div className="grid gap-2">
									<Label>
										Added Suppliers
										{skuSuppliers.length > 0 && ` (${skuSuppliers.length})`}
									</Label>
									{(() => {
										if (skuSuppliers.length === 0) {
											return (
												<p className="text-sm text-muted-foreground border rounded-md p-3">
													No suppliers added yet. Search and select suppliers above.
												</p>
											);
										} else {
											return (
												<div className="border rounded-md p-3 space-y-3 max-h-60 overflow-y-auto">
													{skuSuppliers.map((selectedSupplier) => {
														const supplier = suppliers.find((s) => s.supplierId === selectedSupplier.supplierId);
														if (!supplier) return null;
														return (
															<div key={supplier.supplierId} className="space-y-2 py-2 border-b last:border-b-0">
																<div className="flex items-center justify-between">
																	<div className="text-sm font-medium">
																		{supplier.supplierName} ({supplier.supplierCode})
																	</div>
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		className="h-6 w-6"
																		onClick={() => toggleSupplier(supplier.supplierId)}
																	>
																		<X className="h-4 w-4" />
																	</Button>
																</div>
																<div>
																	<Label htmlFor={`original-sku-${supplier.supplierId}`} className="text-xs text-muted-foreground">
																		Original SKU Code (optional)
																	</Label>
																	<Input
																		id={`original-sku-${supplier.supplierId}`}
																		value={getOriginalSkuCode(supplier.supplierId)}
																		onChange={(e) => updateOriginalSkuCode(supplier.supplierId, e.target.value)}
																		placeholder="Supplier's original SKU code"
																		className="mt-1"
																	/>
																</div>
															</div>
														);
													})}
												</div>
											);
										}
									})()}
								</div>
							</div>
						);
					}
				})()}
				{initial && (
					<div className="flex items-center justify-between border-t pt-4">
						<Label htmlFor="sku-active">Active Status</Label>
						<Switch
							id="sku-active"
							checked={isActive}
							onCheckedChange={setIsActive}
						/>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					{(() => {
						if (step === 1) {
							return (
								<Button 
									onClick={handleNext}
									className={!canProceedToStep2 ? "opacity-75 cursor-not-allowed" : ""}
								>
									Next
								</Button>
							);
						} else {
							return (
								<>
									<Button variant="outline" onClick={handleBack}>
										Back
									</Button>
									<Button onClick={handleSubmit} disabled={loading}>
										{(() => {
											if (loading) {
												return "Saving...";
											} else {
												return "Save";
											}
										})()}
									</Button>
								</>
							);
						}
					})()}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function StockUnitSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<StockUnit | null>(null);
	const [deleting, setDeleting] = useState<StockUnit | null>(null);

	const { data, loading, refetch } = useQuery<
		StockUnitsQueryData,
		StockUnitsQueryVariables
	>(STOCK_UNITS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim()
				? { filter: { unitName: search.trim() } }
				: {}),
		},
	});

	const [createStockUnit, { loading: createLoading }] =
		useMutation<CreateStockUnitMutationData>(CREATE_STOCK_UNIT_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateStockUnit, { loading: updateLoading }] =
		useMutation<UpdateStockUnitMutationData>(UPDATE_STOCK_UNIT_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [toggleActive] = useMutation<ToggleStockUnitActiveMutationData>(
		TOGGLE_STOCK_UNIT_ACTIVE_MUTATION,
		{ onCompleted: () => refetch() }
	);
	const [deleteStockUnit, { loading: deleteLoading }] =
		useMutation<DeleteStockUnitMutationData>(DELETE_STOCK_UNIT_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.stockUnits?.query ?? [];
	const pagination = data?.stockUnits?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Stock Units (UOM)</CardTitle>
						<CardDescription>Units of measurement for inventory</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Stock Unit
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Active</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 text-center text-muted-foreground"
									>
										No stock units found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.stockUnitId}>
										<TableCell className="font-mono text-sm">
											{row.unitCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.unitName}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={
													row.isActive
														? "bg-green-500/10 text-green-600 border-green-500/20"
														: "bg-muted text-muted-foreground"
												}
											>
												{row.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													toggleActive({
														variables: {
															id: row.stockUnitId,
															isActive: !row.isActive,
															updatedBy: createdBy,
														},
													})
												}
												title={row.isActive ? "Deactivate" : "Activate"}
											>
												{row.isActive ? "Deactivate" : "Activate"}
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{pagination && totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {currentPage} of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<StockUnitFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createStockUnit({
						variables: {
							input: {
								unitName: values.unitName,
								unitCode: values.unitCode,
								isActive: values.isActive ?? true,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Stock Unit"
				description="Create a new unit of measurement."
			/>

			{editing && (
				<StockUnitFormDialog
					key={editing.stockUnitId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						unitName: editing.unitName,
						unitCode: editing.unitCode,
						isActive: editing.isActive,
					}}
					onSubmit={(values) =>
						updateStockUnit({
							variables: {
								id: editing.stockUnitId,
								input: {
									unitName: values.unitName,
									unitCode: values.unitCode,
									isActive: values.isActive,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Stock Unit"
					description="Update unit details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.unitName}
					onConfirm={() =>
						deleteStockUnit({ variables: { id: deleting.stockUnitId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function OutletFormDialog({
	open,
	onOpenChange,
	regions,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	regions: Region[];
	initial?: {
		outletName: string;
		outletCode: string;
		regionId?: string;
	};
	onSubmit: (v: {
		outletName: string;
		outletCode: string;
		regionId?: string;
	}) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [outletName, setOutletName] = useState(initial?.outletName ?? "");
	const [outletCode, setOutletCode] = useState(initial?.outletCode ?? "");
	const [regionId, setRegionId] = useState<string>(initial?.regionId ?? "");

	useEffect(() => {
		if (open) {
			setOutletName(initial?.outletName ?? "");
			setOutletCode(initial?.outletCode ?? "");
			setRegionId(initial?.regionId ?? "");
		}
	}, [open, initial?.outletName, initial?.outletCode, initial?.regionId]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setOutletName(initial?.outletName ?? "");
			setOutletCode(initial?.outletCode ?? "");
			setRegionId(initial?.regionId ?? "");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="outlet-code">Code</Label>
						<Input
							id="outlet-code"
							value={outletCode}
							onChange={(e) => setOutletCode(e.target.value)}
							placeholder="e.g. OUT001"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="outlet-name">Name</Label>
						<Input
							id="outlet-name"
							value={outletName}
							onChange={(e) => setOutletName(e.target.value)}
							placeholder="Outlet name"
						/>
					</div>
					<div className="grid gap-2">
						<Label>Region (optional)</Label>
						<Select
							value={regionId || "none"}
							onValueChange={(v) => setRegionId(v === "none" ? "" : v)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Unassigned" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Unassigned</SelectItem>
								{regions.map((r) => (
									<SelectItem key={r.regionId} value={r.regionId}>
										{r.regionName} ({r.regionCode})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!outletName.trim() || !outletCode.trim() || loading}
						onClick={() =>
							onSubmit({
								outletName: outletName.trim(),
								outletCode: outletCode.trim(),
								regionId: regionId || undefined,
							})
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function StockUnitFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: { unitName: string; unitCode: string; isActive?: boolean };
	onSubmit: (v: {
		unitName: string;
		unitCode: string;
		isActive?: boolean;
	}) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [unitName, setUnitName] = useState(initial?.unitName ?? "");
	const [unitCode, setUnitCode] = useState(initial?.unitCode ?? "");
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);

	useEffect(() => {
		if (open) {
			setUnitName(initial?.unitName ?? "");
			setUnitCode(initial?.unitCode ?? "");
			setIsActive(initial?.isActive ?? true);
		}
	}, [open, initial?.unitName, initial?.unitCode, initial?.isActive]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setUnitName(initial?.unitName ?? "");
			setUnitCode(initial?.unitCode ?? "");
			setIsActive(initial?.isActive ?? true);
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="unit-code">Code</Label>
						<Input
							id="unit-code"
							value={unitCode}
							onChange={(e) => setUnitCode(e.target.value)}
							placeholder="e.g. EA, KG, CTN"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="unit-name">Name</Label>
						<Input
							id="unit-name"
							value={unitName}
							onChange={(e) => setUnitName(e.target.value)}
							placeholder="Unit name"
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label htmlFor="unit-active">Active</Label>
						<Switch
							id="unit-active"
							checked={isActive}
							onCheckedChange={setIsActive}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!unitName.trim() || !unitCode.trim() || loading}
						onClick={() =>
							onSubmit({
								unitName: unitName.trim(),
								unitCode: unitCode.trim(),
								isActive,
							})
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DeliveryScheduleFormDialog({
	open,
	onOpenChange,
	regions,
	initial,
	onSubmit,
	loading,
	title,
	description,
	hideRegion = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	regions: Region[];
	initial?: {
		regionId?: string;
		dayOfWeek: number;
		cutoffDaysBefore: number;
		cutoffTime: string;
		isActive?: boolean;
	};
	onSubmit: (v: {
		regionId?: string;
		dayOfWeek: number;
		cutoffDaysBefore: number;
		cutoffTime: string;
		isActive?: boolean;
	}) => void;
	loading: boolean;
	title: string;
	description: string;
	hideRegion?: boolean;
}) {
	const [regionId, setRegionId] = useState(initial?.regionId ?? "");
	const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? 1);
	const [cutoffDaysBefore, setCutoffDaysBefore] = useState(
		initial?.cutoffDaysBefore ?? 1
	);
	const [cutoffTime, setCutoffTime] = useState(initial?.cutoffTime ?? "17:00");
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);

	useEffect(() => {
		if (open) {
			setRegionId(initial?.regionId ?? "");
			setDayOfWeek(initial?.dayOfWeek ?? 1);
			setCutoffDaysBefore(initial?.cutoffDaysBefore ?? 1);
			setCutoffTime(initial?.cutoffTime ?? "17:00");
			setIsActive(initial?.isActive ?? true);
		}
	}, [
		open,
		initial?.regionId,
		initial?.dayOfWeek,
		initial?.cutoffDaysBefore,
		initial?.cutoffTime,
		initial?.isActive,
	]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setRegionId(initial?.regionId ?? "");
			setDayOfWeek(initial?.dayOfWeek ?? 1);
			setCutoffDaysBefore(initial?.cutoffDaysBefore ?? 1);
			setCutoffTime(initial?.cutoffTime ?? "17:00");
			setIsActive(initial?.isActive ?? true);
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					{!hideRegion && (
						<div className="grid gap-2">
							<Label>Region</Label>
							<Select
								value={regionId || undefined}
								onValueChange={setRegionId}
								required
							>
								<SelectTrigger>
									<SelectValue placeholder="Select region" />
								</SelectTrigger>
								<SelectContent>
									{regions.map((r) => (
										<SelectItem key={r.regionId} value={r.regionId}>
											{r.regionName} ({r.regionCode})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<div className="grid gap-2">
						<Label>Day of week</Label>
						<Select
							value={String(dayOfWeek)}
							onValueChange={(v) => setDayOfWeek(Number(v))}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DAYS_OF_WEEK.map((d) => (
									<SelectItem key={d.value} value={String(d.value)}>
										{d.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="cutoff-days">Cutoff (days before)</Label>
						<Input
							id="cutoff-days"
							type="number"
							min={0}
							value={cutoffDaysBefore}
							onChange={(e) =>
								setCutoffDaysBefore(Number(e.target.value) || 0)
							}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="cutoff-time">Cutoff time</Label>
						<Input
							id="cutoff-time"
							value={cutoffTime}
							onChange={(e) => setCutoffTime(e.target.value)}
							placeholder="e.g. 17:00"
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label htmlFor="schedule-active">Active</Label>
						<Switch
							id="schedule-active"
							checked={isActive}
							onCheckedChange={setIsActive}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={
							(!hideRegion && !regionId) ||
							cutoffTime.trim() === "" ||
							loading
						}
						onClick={() =>
							onSubmit({
								...(hideRegion ? {} : { regionId }),
								dayOfWeek,
								cutoffDaysBefore,
								cutoffTime: cutoffTime.trim(),
								isActive,
							})
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SupplierFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: { supplierName: string; supplierCode: string };
	onSubmit: (v: { supplierName: string; supplierCode: string }) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [name, setName] = useState(initial?.supplierName ?? "");
	const [code, setCode] = useState(initial?.supplierCode ?? "");

	useEffect(() => {
		if (open) {
			setName(initial?.supplierName ?? "");
			setCode(initial?.supplierCode ?? "");
		}
	}, [open, initial?.supplierName, initial?.supplierCode]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName(initial?.supplierName ?? "");
			setCode(initial?.supplierCode ?? "");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="supplier-code">Code</Label>
						<Input
							id="supplier-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. SUP001"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="supplier-name">Name</Label>
						<Input
							id="supplier-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Supplier name"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || !code.trim() || loading}
						onClick={() => onSubmit({ supplierName: name.trim(), supplierCode: code.trim() })}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RegionFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: { regionName: string; regionCode: string };
	onSubmit: (v: { regionName: string; regionCode: string }) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [name, setName] = useState(initial?.regionName ?? "");
	const [code, setCode] = useState(initial?.regionCode ?? "");

	useEffect(() => {
		if (open) {
			setName(initial?.regionName ?? "");
			setCode(initial?.regionCode ?? "");
		}
	}, [open, initial?.regionName, initial?.regionCode]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName(initial?.regionName ?? "");
			setCode(initial?.regionCode ?? "");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="region-code">Code</Label>
						<Input
							id="region-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. REG001"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="region-name">Name</Label>
						<Input
							id="region-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Region name"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || !code.trim() || loading}
						onClick={() =>
							onSubmit({ regionName: name.trim(), regionCode: code.trim() })
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RackFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: { rackRow: string; rackColumn: string; rackLevel: string };
	onSubmit: (v: {
		rackRow: string;
		rackColumn: string;
		rackLevel: string;
	}) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [rackRow, setRackRow] = useState(initial?.rackRow ?? "");
	const [rackColumn, setRackColumn] = useState(initial?.rackColumn ?? "");
	const [rackLevel, setRackLevel] = useState(initial?.rackLevel ?? "");

	useEffect(() => {
		if (open) {
			setRackRow(initial?.rackRow ?? "");
			setRackColumn(initial?.rackColumn ?? "");
			setRackLevel(initial?.rackLevel ?? "");
		}
	}, [open, initial?.rackRow, initial?.rackColumn, initial?.rackLevel]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setRackRow(initial?.rackRow ?? "");
			setRackColumn(initial?.rackColumn ?? "");
			setRackLevel(initial?.rackLevel ?? "");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="rack-row">Row</Label>
						<Input
							id="rack-row"
							value={rackRow}
							onChange={(e) => setRackRow(e.target.value)}
							placeholder="e.g. A, B, 1"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="rack-column">Column</Label>
						<Input
							id="rack-column"
							value={rackColumn}
							onChange={(e) => setRackColumn(e.target.value)}
							placeholder="e.g. 01, 02"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="rack-level">Level</Label>
						<Input
							id="rack-level"
							value={rackLevel}
							onChange={(e) => setRackLevel(e.target.value)}
							placeholder="e.g. 01, 02"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={
							!rackRow.trim() ||
							!rackColumn.trim() ||
							!rackLevel.trim() ||
							loading
						}
						onClick={() =>
							onSubmit({
								rackRow: rackRow.trim(),
								rackColumn: rackColumn.trim(),
								rackLevel: rackLevel.trim(),
							})
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ConfirmDeleteDialog({
	open,
	onOpenChange,
	itemName,
	onConfirm,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	itemName: string;
	onConfirm: () => void;
	loading: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete &quot;{itemName}&quot;? This action
						cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={loading}
						onClick={() => onConfirm()}
					>
						{loading ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
