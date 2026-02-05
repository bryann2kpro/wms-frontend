import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import type {
	Supplier,
	Region,
	DeliverySchedule,
	Outlet,
	StockUnit,
	Rack,
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
} from "lucide-react";

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
		"supplier" | "region" | "delivery-schedule" | "outlet" | "stock-unit" | "rack"
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
			</div>
			{subTab === "supplier" && <SupplierSection />}
			{subTab === "region" && <RegionSection />}
			{subTab === "delivery-schedule" && <DeliveryScheduleSection />}
			{subTab === "outlet" && <OutletSection />}
			{subTab === "stock-unit" && <StockUnitSection />}
			{subTab === "rack" && <RackSection />}
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
