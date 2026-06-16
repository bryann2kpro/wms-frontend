import { type CSSProperties, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	useReactTable,
	getCoreRowModel,
	type ColumnDef,
	type Column,
	flexRender,
} from "@tanstack/react-table";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	ITEMS_QUERY,
	CREATE_SKUS_MUTATION,
	UPDATE_SKUS_MUTATION,
	DELETE_SKUS_MUTATION,
	type ItemsQueryData,
	type CreateSkusMutationData,
	type UpdateSkusMutationData,
	type DeleteSkusMutationData,
	type CreateSkusMutationVariables,
	type UpdateSkusMutationVariables,
	type DeleteSkusMutationVariables,
} from "@/lib/graphql/skus";
import type { Skus, StockUnit } from "@/lib/graphql/types";
import {
	STOCK_UNITS_QUERY,
	type StockUnitsQueryData,
	type StockUnitsQueryVariables,
} from "@/lib/graphql/stock-units";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ItemFormDialog } from "@/components/settings/master-data/item-form-dialog";
import { ItemViewDialog } from "@/components/settings/master-data/item-view-dialog";
import { ConfirmDeleteDialog } from "@/components/settings/master-data/shared";
import { ImportDialog } from "@/components/settings/master-data/import-dialog";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { statusColors } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	Plus,
	Edit,
	Trash2,
	Search,
	Eye,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	Box,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/items")({
	component: ItemsComponent,
});

type ItemSortField = "CODE" | "DESCRIPTION";

function getCommonPinningStyles(column: Column<Skus>): CSSProperties {
	const isPinned = column.getIsPinned();
	const isLastLeftPinnedColumn =
		isPinned === "left" && column.getIsLastColumn("left");
	const isFirstRightPinnedColumn =
		isPinned === "right" && column.getIsFirstColumn("right");

	return {
		boxShadow: isLastLeftPinnedColumn
			? "-4px 0 4px -4px var(--border) inset"
			: isFirstRightPinnedColumn
				? "4px 0 4px -4px var(--border) inset"
				: undefined,
		left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
		right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
		position: isPinned ? "sticky" : "relative",
		width: column.getSize(),
		zIndex: isPinned ? 1 : 0,
	};
}

function formatNum(
	val: number | null | undefined,
	decimals: number,
): string {
	if (val == null) return "—";
	return Number(val).toFixed(decimals);
}

function ItemsComponent() {
	const { user } = useCurrentUser();
	const queryClient = useQueryClient();
	const createdBy = user?.id ?? "";

	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
	const [sortField, setSortField] = useState<ItemSortField>("CODE");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
	const [page, setPage] = useState(1);
	const pageSize = 10;

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [editing, setEditing] = useState<Skus | null>(null);
	const [deleting, setDeleting] = useState<Skus | null>(null);
	const [viewingItem, setViewingItem] = useState<Skus | null>(null);

	const { data, isLoading, refetch } = useQuery({
		queryKey: qk.items.all,
		queryFn: () => gqlRequest<ItemsQueryData>(ITEMS_QUERY, {}),
		staleTime: 0,
		gcTime: 0,
	});
	const allItems: Skus[] = data?.skus?.query ?? [];

	const { data: stockUnitsData } = useQuery({
		queryKey: qk.stockUnits.all,
		queryFn: () =>
			gqlRequest<StockUnitsQueryData, StockUnitsQueryVariables>(
				STOCK_UNITS_QUERY,
				{},
			),
	});
	const stockUnits: StockUnit[] = stockUnitsData?.stockUnits.query ?? [];
	const defaultStockUnitId =
		stockUnits.find(
			(u) =>
				u.isActive &&
				(u.unitCode?.trim().toLowerCase() === "ctn" ||
					u.unitName?.trim().toLowerCase() === "ctn"),
		)?.stockUnitId ??
		stockUnits.find((u) => u.isActive)?.stockUnitId ??
		stockUnits[0]?.stockUnitId;

	const filtered = useMemo(() => {
		const q = debouncedSearch.toLowerCase().trim();
		return allItems.filter((item) => {
			if (statusFilter === "ACTIVE" && !item.isActive) return false;
			if (statusFilter === "INACTIVE" && item.isActive) return false;
			if (!q) return true;
			return (
				item.skuCode.toLowerCase().includes(q) ||
				item.skuDescription.toLowerCase().includes(q) ||
				(item.barcode ?? "").toLowerCase().includes(q)
			);
		});
	}, [allItems, debouncedSearch, statusFilter]);

	const sorted = useMemo(() => {
		return [...filtered].sort((a, b) => {
			const dir = sortDirection === "ASC" ? 1 : -1;
			if (sortField === "DESCRIPTION") {
				return a.skuDescription.localeCompare(b.skuDescription) * dir;
			}
			return a.skuCode.localeCompare(b.skuCode) * dir;
		});
	}, [filtered, sortField, sortDirection]);

	const totalItems = sorted.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const currentPage = Math.min(page, totalPages);
	const startIndex = (currentPage - 1) * pageSize;
	const paginated = useMemo(
		() => sorted.slice(startIndex, startIndex + pageSize),
		[sorted, startIndex],
	);

	const createInFlightRef = useRef(false);
	const updateInFlightRef = useRef(false);
	const deleteInFlightRef = useRef(false);

	const { mutate: createItem, isPending: createLoading } = useMutation({
		mutationFn: (vars: CreateSkusMutationVariables) =>
			gqlRequest<CreateSkusMutationData, CreateSkusMutationVariables>(
				CREATE_SKUS_MUTATION,
				vars,
			),
		onSuccess: async () => {
			createInFlightRef.current = false;
			await refetch();
			queryClient.invalidateQueries({ queryKey: qk.skus.all });
			setIsCreateOpen(false);
			toast.success("Item created");
		},
		onError: (error: Error) => {
			createInFlightRef.current = false;
			toast.error("Failed to create item", { description: error.message });
		},
	});

	const { mutate: updateItem, isPending: updateLoading } = useMutation({
		mutationFn: (vars: UpdateSkusMutationVariables) =>
			gqlRequest<UpdateSkusMutationData, UpdateSkusMutationVariables>(
				UPDATE_SKUS_MUTATION,
				vars,
			),
		onSuccess: async () => {
			updateInFlightRef.current = false;
			await refetch();
			queryClient.invalidateQueries({ queryKey: qk.skus.all });
			setEditing(null);
			toast.success("Item updated");
		},
		onError: (error: Error) => {
			updateInFlightRef.current = false;
			toast.error("Failed to update item", { description: error.message });
		},
	});

	const { mutate: deleteItem, isPending: deleteLoading } = useMutation({
		mutationFn: (vars: DeleteSkusMutationVariables) =>
			gqlRequest<DeleteSkusMutationData, DeleteSkusMutationVariables>(
				DELETE_SKUS_MUTATION,
				vars,
			),
		onSuccess: async () => {
			deleteInFlightRef.current = false;
			await refetch();
			queryClient.invalidateQueries({ queryKey: qk.skus.all });
			setDeleting(null);
			toast.success("Item deleted");
		},
		onError: (error: Error) => {
			deleteInFlightRef.current = false;
			toast.error("Failed to delete item", { description: error.message });
		},
	});

	const columns = useMemo<ColumnDef<Skus>[]>(
		() => [
			{
				id: "skuCode",
				accessorKey: "skuCode",
				header: "SKU Code",
				size: 140,
				cell: (info) => info.getValue<string>(),
			},
			{
				id: "skuDescription",
				accessorKey: "skuDescription",
				header: "Description",
				size: 240,
				cell: (info) => (
					<span
						className="block max-w-[240px] truncate"
						title={info.getValue<string>()}
					>
						{info.getValue<string>()}
					</span>
				),
			},
			{
				id: "barcode",
				accessorKey: "barcode",
				header: "Barcode",
				size: 150,
				cell: (info) => info.getValue<string | null>() ?? "—",
			},
			{
				id: "brand",
				accessorKey: "brand",
				header: "Brand",
				size: 120,
				cell: (info) => info.getValue<string | null>() ?? "—",
			},
			{
				id: "category",
				accessorKey: "category",
				header: "Category",
				size: 120,
				cell: (info) => info.getValue<string | null>() ?? "—",
			},
			{
				id: "manufacturer",
				accessorKey: "manufacturer",
				header: "Manufacturer",
				size: 140,
				cell: (info) => info.getValue<string | null>() ?? "—",
			},
			{
				id: "isActive",
				accessorKey: "isActive",
				header: "Status",
				size: 100,
				cell: (info) => {
					const isActive = info.getValue<boolean>();
					const status = isActive ? "active" : "inactive";
					return (
						<Badge variant="outline" className={statusColors[status]}>
							{isActive ? "Active" : "Inactive"}
						</Badge>
					);
				},
			},
			{
				id: "caseRate",
				accessorKey: "caseRate",
				header: "Case Rate",
				size: 110,
				cell: (info) => formatNum(info.getValue<number | null>(), 2),
			},
			{
				id: "caseExtLengthMm",
				accessorKey: "caseExtLengthMm",
				header: "Case Ext Length (mm)",
				size: 170,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "caseExtWidthMm",
				accessorKey: "caseExtWidthMm",
				header: "Case Ext Width (mm)",
				size: 165,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "caseExtHeightMm",
				accessorKey: "caseExtHeightMm",
				header: "Case Ext Height (mm)",
				size: 170,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "caseGrossWeightKg",
				accessorKey: "caseGrossWeightKg",
				header: "Case Gross Weight (kg)",
				size: 175,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "casesPerLayer",
				accessorKey: "casesPerLayer",
				header: "Cases Per Layer",
				size: 140,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "noOfLayers",
				accessorKey: "noOfLayers",
				header: "No Of Layers",
				size: 120,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "actions",
				header: "Actions",
				size: 120,
				cell: (info) => {
					const row = info.row.original;
					return (
						<div className="flex justify-end gap-1">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setViewingItem(row)}
								title="View Item"
								className="rounded-lg"
							>
								<Eye className="h-4 w-4" />
							</Button>
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
								className="text-destructive rounded-lg"
								onClick={() => setDeleting(row)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					);
				},
			},
		],
		[],
	);

	const table = useReactTable({
		data: paginated,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.skuId,
		initialState: {
			columnPinning: {
				left: ["skuCode", "skuDescription"],
				right: ["actions"],
			},
		},
	});

	return (
		<main
			aria-labelledby="items-title"
			aria-describedby="items-desc"
			className="flex flex-col gap-6 p-6"
		>
			<AdminPageHeader
				icon={Box}
				title="Items"
				description="Manage item master data including logistics and packaging dimensions."
				titleId="items-title"
				descriptionId="items-desc"
			/>

			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle
								className="text-xl"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Items
							</CardTitle>
							<CardDescription
								className="text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Stock Keeping Units — logistics &amp; dimensions view
							</CardDescription>
						</div>
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
								<Input
									placeholder="Search code, description, barcode..."
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setPage(1);
									}}
									className="w-60 pl-9 rounded-lg border-muted-foreground/20"
									aria-label="Search items"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(v) => {
									setStatusFilter(v as typeof statusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="w-32 rounded-lg border-muted-foreground/20" aria-label="Filter by status">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All</SelectItem>
									<SelectItem value="ACTIVE">Active</SelectItem>
									<SelectItem value="INACTIVE">Inactive</SelectItem>
								</SelectContent>
							</Select>
							<div className="flex items-center gap-1.5">
								<ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden />
								<Select
									value={sortField}
									onValueChange={(v: ItemSortField) => {
										setSortField(v);
										setPage(1);
									}}
								>
									<SelectTrigger className="w-36 rounded-lg border-muted-foreground/20" aria-label="Sort by field">
										<SelectValue placeholder="Sort by" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="CODE">Code</SelectItem>
										<SelectItem value="DESCRIPTION">Description</SelectItem>
									</SelectContent>
								</Select>
								<Select
									value={sortDirection}
									onValueChange={(v: "ASC" | "DESC") => {
										setSortDirection(v);
										setPage(1);
									}}
								>
									<SelectTrigger className="w-32 rounded-lg border-muted-foreground/20" aria-label="Sort direction">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ASC">Ascending</SelectItem>
										<SelectItem value="DESC">Descending</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<Button
								variant="outline"
								onClick={() => setIsImportOpen(true)}
								disabled={!createdBy}
								className="rounded-lg"
							>
								Import Excel
							</Button>
							<Button
								onClick={() => setIsCreateOpen(true)}
								disabled={!createdBy}
								className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Item
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-0 pb-6">
					<div className="mx-6 overflow-x-auto rounded-xl border">
						<Table style={{ width: table.getTotalSize(), tableLayout: "fixed" }}>
							<TableHeader>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id} className="hover:bg-transparent">
										{headerGroup.headers.map((header) => (
											<TableHead
												key={header.id}
												style={{
													...getCommonPinningStyles(header.column),
													backgroundColor: header.column.getIsPinned()
														? "var(--background)"
														: undefined,
												}}
												className="px-4"
											>
												{header.isPlaceholder
													? null
													: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 px-6 text-center text-muted-foreground"
											aria-live="polite"
										>
											Loading items...
										</TableCell>
									</TableRow>
								) : table.getRowModel().rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 px-6 text-center text-muted-foreground"
										>
											No items found.
										</TableCell>
									</TableRow>
								) : (
									table.getRowModel().rows.map((row) => (
										<TableRow
											key={row.id}
											className="transition-colors hover:bg-muted/50"
										>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													style={{
														...getCommonPinningStyles(cell.column),
														backgroundColor: cell.column.getIsPinned()
															? "var(--background)"
															: undefined,
													}}
													className="px-4"
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
					{!isLoading && totalItems > 0 && (
						<div
							className="mx-6 mt-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							<div>
								Showing{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{startIndex + 1}
								</span>{" "}
								–{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{Math.min(startIndex + pageSize, totalItems)}
								</span>{" "}
								of{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{totalItems}
								</span>{" "}
								items
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={currentPage === 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									aria-label="Previous page"
									className="rounded-lg h-8 w-8"
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span>
									Page {currentPage} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={currentPage === totalPages}
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									aria-label="Next page"
									className="rounded-lg h-8 w-8"
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<ItemViewDialog
				open={viewingItem !== null}
				onOpenChange={(open) => {
					if (!open) setViewingItem(null);
				}}
				item={viewingItem}
				stockUnits={stockUnits}
			/>

			<ItemFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				stockUnits={stockUnits}
				onSubmit={(values) => {
					if (createInFlightRef.current || createLoading) return;
					if (!defaultStockUnitId) {
						toast.error("No stock unit found. Please create CTN stock unit first.");
						return;
					}
					createInFlightRef.current = true;
					createItem({
						input: {
							skuCode: values.skuCode,
							skuDescription: values.skuDescription,
							skuUom: values.skuUom,
							skuExpiryDate: "",
							skuSuppliers: [],
							isActive: true,
							barcode: values.barcode ?? null,
							brand: values.brand ?? null,
							category: values.category ?? null,
							manufacturer: values.manufacturer ?? null,
							caseRate: values.caseRate ?? null,
							caseExtLengthMm: values.caseExtLengthMm ?? null,
							caseExtWidthMm: values.caseExtWidthMm ?? null,
							caseExtHeightMm: values.caseExtHeightMm ?? null,
							caseGrossWeightKg: values.caseGrossWeightKg ?? null,
							casesPerLayer: values.casesPerLayer ?? null,
							noOfLayers: values.noOfLayers ?? null,
						},
					});
				}}
				loading={createLoading}
				title="Add Item"
				description="Create item using import format columns"
			/>

			<ImportDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				mode="skus"
				skuFormat="items"
				createdBy={createdBy}
				onImported={() => {
					void refetch();
				}}
			/>

			{editing && (
				<ItemFormDialog
					key={editing.skuId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					stockUnits={stockUnits}
					initial={{
						skuCode: editing.skuCode,
						skuDescription: editing.skuDescription,
						skuUom: editing.skuUom,
						isActive: editing.isActive,
						barcode: editing.barcode,
						brand: editing.brand,
						category: editing.category,
						manufacturer: editing.manufacturer,
						caseRate: editing.caseRate,
						caseExtLengthMm: editing.caseExtLengthMm,
						caseExtWidthMm: editing.caseExtWidthMm,
						caseExtHeightMm: editing.caseExtHeightMm,
						caseGrossWeightKg: editing.caseGrossWeightKg,
						casesPerLayer: editing.casesPerLayer,
						noOfLayers: editing.noOfLayers,
					}}
					onSubmit={(values) => {
						if (updateInFlightRef.current || updateLoading) return;
						updateInFlightRef.current = true;
						updateItem({
							id: editing.skuId,
							input: {
								skuCode: values.skuCode,
								skuDescription: values.skuDescription,
								skuUom: values.skuUom,
								isActive: values.isActive,
								barcode: values.barcode ?? null,
								brand: values.brand ?? null,
								category: values.category ?? null,
								manufacturer: values.manufacturer ?? null,
								caseRate: values.caseRate ?? null,
								caseExtLengthMm: values.caseExtLengthMm ?? null,
								caseExtWidthMm: values.caseExtWidthMm ?? null,
								caseExtHeightMm: values.caseExtHeightMm ?? null,
								caseGrossWeightKg: values.caseGrossWeightKg ?? null,
								casesPerLayer: values.casesPerLayer ?? null,
								noOfLayers: values.noOfLayers ?? null,
							},
						});
					}}
					loading={updateLoading}
					title="Edit Item"
					description="Update item using import format columns"
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.skuCode}
					onConfirm={() => {
						if (deleteInFlightRef.current || deleteLoading) return;
						deleteInFlightRef.current = true;
						deleteItem({ id: deleting.skuId });
					}}
					loading={deleteLoading}
				/>
			)}
		</main>
	);
}
