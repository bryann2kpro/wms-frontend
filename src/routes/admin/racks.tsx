import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { requirePermission } from "@/lib/rbac";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useCurrentUser } from "@/lib/auth/use-current-user";
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
	AREAS_QUERY,
	type AreasQueryData,
} from "@/lib/graphql/areas";
import {
	WAREHOUSES_QUERY,
	type WarehousesQueryData,
} from "@/lib/graphql/warehouses";
import {
	ZONES_QUERY,
	type ZonesQueryData,
} from "@/lib/graphql/zones";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { Plus, Edit, Trash2, Search, LayoutGrid, ArrowUpDown, Upload } from "lucide-react";
import type { Rack } from "@/lib/graphql/types";
import { ImportDialog } from "@/components/settings/master-data/import-dialog";
import { RackFormDialog, formatLevel } from "@/components/racks/rack-form-dialog";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const formatNumericCell = (value: string | null | undefined) => {
	const trimmed = value?.trim();
	if (!trimmed) return <span className="opacity-30">—</span>;
	return <span className="tabular-nums">{trimmed}</span>;
};

const rackLocationDescription = (row: Pick<Rack, "rackRow" | "rackColumn" | "rackLevel">) =>
	`${row.rackRow}-${row.rackColumn}-${formatLevel(row.rackLevel)}`;

const emptyCell = <span className="opacity-30">—</span>;

export const Route = createFileRoute("/admin/racks")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: RacksPage,
	head: () => ({
		meta: [{ title: "Rack Locations - SME Edaran WMS" }],
	}),
});

function RacksPage() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
	const [sortField, setSortField] = useState<string>("UPDATED_AT");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [editing, setEditing] = useState<Rack | null>(null);
	const [deleting, setDeleting] = useState<Rack | null>(null);

	const racksVars: RacksQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		sort: { sortBy: sortField, sortOrder: sortDirection },
		...(debouncedSearch.trim() ? { filter: { binCode: debouncedSearch.trim() } } : {}),
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.racks.all, racksVars],
		queryFn: () => gqlRequest<RacksQueryData, RacksQueryVariables>(RACKS_QUERY, racksVars),
	});

	const { data: areasData } = useQuery({
		queryKey: [...qk.areas.all, "racks-page"],
		queryFn: () => gqlRequest<AreasQueryData>(AREAS_QUERY, { pageSize: 500, pageNumber: 1 }),
	});

	const { data: whData } = useQuery({
		queryKey: [...qk.warehouses.all, "racks-page"],
		queryFn: () =>
			gqlRequest<WarehousesQueryData>(WAREHOUSES_QUERY, { pageSize: 500, pageNumber: 1 }),
	});
	const warehouses = whData?.warehouses?.query ?? [];

	const { data: zonesData } = useQuery({
		queryKey: [...qk.zones.all, "racks-page"],
		queryFn: () => gqlRequest<ZonesQueryData>(ZONES_QUERY, { pageSize: 500, pageNumber: 1 }),
	});

	const { mutate: createRack, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateRackMutationData>(CREATE_RACK_MUTATION, { input }),
		onSuccess: () => {
			void refetch();
			setIsCreateOpen(false);
		},
	});

	const { mutate: updateRack, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateRackMutationData>(UPDATE_RACK_MUTATION, variables),
		onSuccess: () => {
			void refetch();
			setEditing(null);
		},
	});

	const { mutate: deleteRack, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteRackMutationData>(DELETE_RACK_MUTATION, variables),
		onSuccess: () => {
			void refetch();
			setDeleting(null);
		},
	});

	const list = data?.racks?.query ?? [];
	const pagination = data?.racks?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const areas = areasData?.areas?.query ?? [];
	const zones = zonesData?.zones?.query ?? [];
	const createdBy = user?.id ?? "";

	const locationLabel = (rack: { areaId?: string | null; zoneId?: string | null }) => {
		if (rack.areaId) {
			return areas.find((a) => a.areaId === rack.areaId)?.warehouseName ?? null;
		}
		if (rack.zoneId) {
			return zones.find((z) => z.zoneId === rack.zoneId)?.warehouseName ?? null;
		}
		return null;
	};

	return (
		<div className="space-y-6 p-6">
			<AdminPageHeader
				icon={LayoutGrid}
				title="Rack Locations"
				description="Storage bin locations across warehouse areas"
				titleId="racks-title"
				descriptionId="racks-description"
			/>
			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle
								className="text-xl"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Storage Bins
							</CardTitle>
							<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
								Manage warehouse rack locations
							</CardDescription>
						</div>
						<div className="flex flex-wrap items-center justify-end gap-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search by bin code..."
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setPage(1);
									}}
									className="w-full rounded-lg border-muted-foreground/20 pl-9 sm:w-56"
								/>
							</div>
							<div className="flex items-center gap-1">
								<ArrowUpDown className="h-4 w-4 text-muted-foreground" />
								<Select
									value={sortField}
									onValueChange={(v) => {
										setSortField(v);
										setPage(1);
									}}
								>
									<SelectTrigger className="h-9 w-36 rounded-lg text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="BIN_CODE">Bin Code</SelectItem>
										<SelectItem value="RACK_ROW">Storage Row</SelectItem>
										<SelectItem value="RACK_COLUMN">Storage Bay</SelectItem>
										<SelectItem value="RACK_LEVEL">Level</SelectItem>
										<SelectItem value="BIN_TYPE">Bin Type</SelectItem>
										<SelectItem value="UPDATED_AT">Last Updated</SelectItem>
										<SelectItem value="CREATED_AT">Created</SelectItem>
									</SelectContent>
								</Select>
								<Select
									value={sortDirection}
									onValueChange={(v) => {
										setSortDirection(v as "ASC" | "DESC");
										setPage(1);
									}}
								>
									<SelectTrigger className="h-9 w-20 rounded-lg text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ASC">ASC</SelectItem>
										<SelectItem value="DESC">DESC</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<Button
								variant="outline"
								onClick={() => setIsImportOpen(true)}
								disabled={!createdBy}
								className="rounded-lg"
							>
								<Upload className="mr-2 h-4 w-4" />
								Import Excel
							</Button>
							<Button
								onClick={() => setIsCreateOpen(true)}
								disabled={!createdBy}
								className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Rack
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative px-0 pb-6">
					<GlobalLoadingShadow />
					<div className="mx-6 overflow-x-auto rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="w-10 px-4">
										<Checkbox disabled />
									</TableHead>
									{[
										"Code",
										"Barcode",
										"Description",
										"Storage Row",
										"Storage Bay",
										"Level",
										"Storage Type",
										"Length (mm)",
										"Width (mm)",
										"Height (mm)",
										"Weight (kg)",
										"Max Pallets",
										"Location",
										"Status",
										"Last Count Date",
									].map((col) => (
										<TableHead
											key={col}
											className="px-4 text-xs font-medium"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											{col}
										</TableHead>
									))}
									<TableHead className="px-4 text-right text-xs font-medium">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell
											colSpan={17}
											className="h-24 text-center text-muted-foreground"
										>
											Loading...
										</TableCell>
									</TableRow>
								) : list.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={17}
											className="h-24 text-center text-muted-foreground"
										>
											No racks found.
										</TableCell>
									</TableRow>
								) : (
									list.map((row) => (
										<TableRow
											key={row.rackId}
											className="transition-colors hover:bg-muted/50"
										>
											<TableCell className="px-4">
												<Checkbox />
											</TableCell>
											<TableCell className="px-4 font-mono text-sm">
												{row.binCode ?? rackLocationDescription(row)}
											</TableCell>
											<TableCell className="px-4">
												{row.barCode ? (
													<Badge
														variant="outline"
														className="border-blue-400 font-mono text-blue-600"
													>
														{row.barCode}
													</Badge>
												) : (
													<span className="opacity-30">—</span>
												)}
											</TableCell>
											<TableCell className="px-4 text-sm text-muted-foreground">
												{rackLocationDescription(row)}
											</TableCell>
											<TableCell className="px-4 font-medium">
												{row.rackRow}
											</TableCell>
											<TableCell className="px-4">{`${row.rackRow}-${row.rackColumn}`}</TableCell>
											<TableCell className="px-4">{formatLevel(row.rackLevel)}</TableCell>
											<TableCell className="px-4">
												<Badge
													variant="secondary"
													className="text-xs font-medium"
												>
													{row.binType}
												</Badge>
											</TableCell>
											<TableCell className="px-4 text-sm">
												{formatNumericCell(row.length)}
											</TableCell>
											<TableCell className="px-4 text-sm">
												{formatNumericCell(row.width)}
											</TableCell>
											<TableCell className="px-4 text-sm">
												{formatNumericCell(row.height)}
											</TableCell>
											<TableCell className="px-4 text-sm">
												{formatNumericCell(row.weight)}
											</TableCell>
											<TableCell className="px-4 text-sm">
												{formatNumericCell(row.maxPallet)}
											</TableCell>
											<TableCell className="px-4 text-sm">
												{locationLabel(row) ?? (
													<span className="opacity-30">—</span>
												)}
											</TableCell>
											<TableCell className="px-4">
												<Badge
													variant={row.isActive ? "default" : "outline"}
													className={
														row.isActive
															? "bg-green-100 text-green-700 hover:bg-green-100"
															: "text-muted-foreground"
													}
												>
													{row.isActive ? "ACTIVE" : "INACTIVE"}
												</Badge>
											</TableCell>
											<TableCell className="px-4 text-sm text-muted-foreground">
												{emptyCell}
											</TableCell>
											<TableCell className="px-4 text-right">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => setEditing(row)}
													className="rounded-lg"
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="rounded-lg text-destructive"
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
						<div className="mx-6 mt-4 flex items-center justify-between">
							<p
								className="text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Page{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{currentPage}
								</span>{" "}
								of {totalPages} ({pagination.totalCount} total)
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!pagination.hasPrevPage}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									className="rounded-lg"
								>
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!pagination.hasNextPage}
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									className="rounded-lg"
								>
									Next
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<ImportDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				mode="racks"
				createdBy={createdBy}
				onImported={() => void refetch()}
			/>

			<RackFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				areas={areas}
				warehouses={warehouses}
				onSubmit={(values) =>
					createRack({
						...values,
						createdBy,
						updatedBy: createdBy,
					})
				}
				loading={createLoading}
				title="Add Rack Location"
				description="Create a new storage bin location."
			/>

			{editing && (
				<RackFormDialog
					key={editing.rackId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					areas={areas}
					warehouses={warehouses}
					initial={editing}
					onSubmit={(values) =>
						updateRack({
							id: editing.rackId,
							input: { ...values, updatedBy: createdBy },
						})
					}
					loading={updateLoading}
					title="Edit Rack Location"
					description="Update storage bin details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.binCode ?? `${deleting.rackRow}-${deleting.rackColumn}-${deleting.rackLevel}`}
					onConfirm={() => deleteRack({ id: deleting.rackId })}
					loading={deleteLoading}
				/>
			)}
		</div>
	);
}


// ─── Confirm Delete ───────────────────────────────────────────────────────────

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
			<DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader>
					<DialogTitle>Delete Rack</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete "{itemName}"? This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={loading}
						onClick={onConfirm}
					>
						{loading ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
