import {
	type CSSProperties,
	useDeferredValue,
	useMemo,
	useRef,
	useState,
} from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	useReactTable,
	getCoreRowModel,
	type ColumnDef,
	type Column,
	flexRender,
} from "@tanstack/react-table";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	SUPPLIERS_QUERY,
	type SuppliersQueryData,
	type SuppliersQueryVariables,
} from "@/lib/graphql/suppliers";
import {
	STOCK_UNITS_QUERY,
	type StockUnitsQueryData,
	type StockUnitsQueryVariables,
} from "@/lib/graphql/stock-units";
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
	Skus,
	StockUnit,
	createSkusInput,
	UpdateSkusInput,
} from "@/lib/graphql/types";
import {
	Plus,
	Edit,
	Trash2,
	Search,
	Eye,
	HelpCircle,
	ChevronLeft,
	ChevronRight,
	ImageOff,
	ArrowUpDown,
} from "lucide-react";
import { formatDateOnly, statusColors } from "@/lib/utils";
import { ConfirmDeleteDialog } from "./shared";
import { SkusFormDialog } from "./skus-form-dialog";
import { SkusSuppliersViewDialog } from "./skus-suppliers-view-dialog";
import { ImportDialog } from "./import-dialog";
import { toast } from "sonner";

const SKUS_HELP_IMAGES_BASE = "/help/skus";

const SKUS_HELP_STEPS: Array<{
	title: string;
	description: string;
	image: string;
}> = [
	{
		title: "What this section does",
		image: `${SKUS_HELP_IMAGES_BASE}/step-1.png`,
		description:
			"View and manage all Stock Keeping Units (SKUs) used in your warehouse.",
	},
	{
		title: "Search and filter",
		image: `${SKUS_HELP_IMAGES_BASE}/step-2.png`,
		description:
			"Use the search box to quickly find SKUs by code or description.",
	},
	{
		title: "Create new SKU",
		image: `${SKUS_HELP_IMAGES_BASE}/step-3.png`,
		description:
			"Click Add SKU to create a new record with UOM, picking strategy, and suppliers.",
	},
	{
		title: "Edit and suppliers",
		image: `${SKUS_HELP_IMAGES_BASE}/step-4.png`,
		description:
			"Use the action buttons to edit SKU details, view suppliers, or remove inactive SKUs.",
	},
];

type SkuSortField = "CODE" | "DESCRIPTION" | "EXPIRY_DATE" | "STRATEGY";

const SKU_SORT_FIELDS: Array<{ value: SkuSortField; label: string }> = [
	{ value: "CODE", label: "Code" },
	{ value: "DESCRIPTION", label: "Description" },
	{ value: "STRATEGY", label: "Picking strategy" },
	{ value: "EXPIRY_DATE", label: "Expiry date" },
];

// From TanStack docs: https://tanstack.com/table/v8/docs/framework/react/examples/column-pinning-sticky
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

function HelpStepImage({
	src,
	stepNumber,
	alt,
}: {
	src: string;
	stepNumber: number;
	alt?: string;
}) {
	const [failed, setFailed] = useState(false);

	if (failed) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
					<ImageOff className="h-6 w-6" />
				</span>
				<span>Add screenshot: public/help/skus/step-{stepNumber}.png</span>
			</div>
		);
	}

	return (
		<img
			src={src}
			alt={alt ?? ""}
			className="h-full w-full object-contain object-top"
			onError={() => setFailed(true)}
		/>
	);
}

export function SkusSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [editing, setEditing] = useState<Skus | null>(null);
	const [deleting, setDeleting] = useState<Skus | null>(null);
	const [viewingSuppliers, setViewingSuppliers] = useState<Skus | null>(null);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);
	const [sortField, setSortField] = useState<SkuSortField>("CODE");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: qk.skus.all,
		queryFn: () => gqlRequest<SkusQueryData, SkusQueryVariables>(SKUS_QUERY, {}),
		staleTime: 0,
		gcTime: 0,
	});
	const allSkus: Skus[] = data?.skus?.query ?? [];
	const deferredSearch = useDeferredValue(search);

	const list = useMemo(() => {
		const query = deferredSearch.toLowerCase().trim();
		return allSkus.filter((sku) => {
			if (!query) return true;
			return (
				sku.skuCode.toLowerCase().includes(query) ||
				sku.skuDescription.toLowerCase().includes(query)
			);
		});
	}, [allSkus, deferredSearch]);

	const sortedList = useMemo(() => {
		return [...list].sort((a, b) => {
			const direction = sortDirection === "ASC" ? 1 : -1;
			switch (sortField) {
				case "DESCRIPTION":
					return (
						(a.skuDescription ?? "").localeCompare(b.skuDescription ?? "") *
						direction
					);
				case "STRATEGY":
					return (
						(a.pickingStrategy ?? "").localeCompare(b.pickingStrategy ?? "") *
						direction
					);
				case "EXPIRY_DATE": {
					const aVal = a.skuExpiryDate
						? new Date(a.skuExpiryDate).getTime()
						: 0;
					const bVal = b.skuExpiryDate
						? new Date(b.skuExpiryDate).getTime()
						: 0;
					return (aVal - bVal) * direction;
				}
				default:
					return (a.skuCode ?? "").localeCompare(b.skuCode ?? "") * direction;
			}
		});
	}, [list, sortDirection, sortField]);

	const totalItems = sortedList.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const currentPage = Math.min(page, totalPages);
	const startIndex = (currentPage - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	const paginatedList = useMemo(
		() => sortedList.slice(startIndex, endIndex),
		[sortedList, startIndex, endIndex],
	);

	const createdBy = user?.id ?? "";

	const { data: suppliersData } = useQuery({
		queryKey: qk.suppliers.all,
		queryFn: () =>
			gqlRequest<SuppliersQueryData, SuppliersQueryVariables>(
				SUPPLIERS_QUERY,
				{},
			),
	});
	const suppliers = suppliersData?.suppliers.query ?? [];

	const { data: stockUnitsData } = useQuery({
		queryKey: qk.stockUnits.all,
		queryFn: () =>
			gqlRequest<StockUnitsQueryData, StockUnitsQueryVariables>(
				STOCK_UNITS_QUERY,
				{},
			),
	});
	const stockUnits = stockUnitsData?.stockUnits.query ?? [];

	const createInFlightRef = useRef(false);
	const updateInFlightRef = useRef(false);
	const deleteInFlightRef = useRef(false);

	const { mutate: createSkus, isPending: createLoading } = useMutation({
		mutationFn: (vars: { input: createSkusInput }) =>
			gqlRequest<CreateSkusMutationData>(CREATE_SKUS_MUTATION, vars),
		onSuccess: async () => {
			createInFlightRef.current = false;
			await refetch();
			setIsCreateOpen(false);
		},
		onError: (error: Error) => {
			createInFlightRef.current = false;
			toast.error("Failed to create SKU", { description: error.message });
		},
	});

	const { mutate: updateSkus, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateSkusMutationData>(UPDATE_SKUS_MUTATION, variables),
		onSuccess: async (data) => {
			updateInFlightRef.current = false;
			if (!data?.updateSku) {
				toast.error("Failed to update SKU", {
					description: "No data returned from server. Check backend logs.",
				});
				return;
			}
			await refetch();
			setEditing(null);
			toast.success("SKU updated");
		},
		onError: (error: Error) => {
			updateInFlightRef.current = false;
			toast.error("Failed to update SKU", { description: error.message });
		},
	});

	const { mutate: deleteSkus, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteSkusMutationData>(DELETE_SKUS_MUTATION, variables),
		onSuccess: async () => {
			deleteInFlightRef.current = false;
			await refetch();
			setDeleting(null);
		},
		onError: (error: Error) => {
			deleteInFlightRef.current = false;
			toast.error("Failed to delete SKU", { description: error.message });
		},
	});

	const columns = useMemo<ColumnDef<Skus>[]>(
		() => [
			{
				id: "skuCode",
				accessorKey: "skuCode",
				header: "Code",
				size: 140,
				cell: (info) => info.getValue<string>(),
			},
			{
				id: "skuDescription",
				accessorKey: "skuDescription",
				header: "Description",
				size: 280,
				cell: (info) => (
					<span
						className="block max-w-[280px] truncate"
						title={info.getValue<string>()}
					>
						{info.getValue<string>()}
					</span>
				),
			},
			{
				id: "pickingStrategy",
				accessorKey: "pickingStrategy",
				header: "Picking",
				size: 90,
				cell: (info) => info.getValue<string>() ?? "FIFO",
			},
			{
				id: "skuExpiryDate",
				accessorKey: "skuExpiryDate",
				header: "Expiry Date",
				size: 120,
				cell: (info) => {
					const val = info.getValue<string | null>();
					return val ? formatDateOnly(val) : "N/A";
				},
			},
			{
				id: "skuUom",
				accessorKey: "skuUom",
				header: "UOM",
				size: 150,
				cell: (info) => {
					const uomId = info.getValue<string>();
					const uom = stockUnits.find(
						(u: StockUnit) => u.stockUnitId === uomId,
					);
					return uom ? `${uom.unitName} (${uom.unitCode})` : uomId;
				},
			},
			{
				id: "looseQuantity",
				accessorKey: "looseQuantity",
				header: "Loose Qty",
				size: 100,
				cell: (info) => {
					const val = info.getValue<number | null>();
					return val != null ? val : "—";
				},
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
								onClick={() => setViewingSuppliers(row)}
								title="View Suppliers"
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
		[stockUnits, setViewingSuppliers, setEditing, setDeleting],
	);

	const table = useReactTable({
		data: paginatedList,
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
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Skus
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Stock Keeping Units
						</CardDescription>
					</div>
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							aria-label="Open help for SKUs"
							onClick={() => {
								setIsHelpOpen(true);
								setHelpStep(0);
							}}
							className="rounded-lg"
						>
							<HelpCircle className="h-4 w-4" />
						</Button>
						<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
							<DialogContent className="sm:max-w-lg rounded-2xl border-2 border-border bg-background shadow-xl">
								<DialogHeader className="border-b bg-muted/50">
									<DialogTitle
										className="text-xl"
										style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
									>
										SKU Management help
									</DialogTitle>
									<DialogDescription
										style={{ fontFamily: '"Figtree", sans-serif' }}
									>
										Step {helpStep + 1} of {SKUS_HELP_STEPS.length}
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4">
									<div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
										<HelpStepImage
											src={SKUS_HELP_STEPS[helpStep].image}
											stepNumber={helpStep + 1}
											alt={SKUS_HELP_STEPS[helpStep].title}
										/>
									</div>
									<div>
										<h3
											className="mb-1 text-sm font-semibold text-foreground"
											style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
										>
											{SKUS_HELP_STEPS[helpStep].title}
										</h3>
										<p
											className="text-sm leading-relaxed text-muted-foreground"
											style={{ fontFamily: '"Figtree", sans-serif' }}
										>
											{SKUS_HELP_STEPS[helpStep].description}
										</p>
									</div>
									<div className="flex items-center justify-between gap-4 pt-2">
										<div className="flex gap-1">
											{SKUS_HELP_STEPS.map((step, i) => (
												<button
													type="button"
													key={step.title}
													onClick={() => setHelpStep(i)}
													aria-label={`Go to help step ${i + 1}`}
													className={`h-2 rounded-full transition-colors ${i === helpStep ? "w-6 bg-amber-600" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
												/>
											))}
										</div>
										<div className="flex gap-2">
											{helpStep > 0 && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => setHelpStep((s) => s - 1)}
													className="rounded-lg"
												>
													<ChevronLeft className="mr-0.5 h-4 w-4" />
													Previous
												</Button>
											)}
											{helpStep < SKUS_HELP_STEPS.length - 1 ? (
												<Button
													size="sm"
													onClick={() => setHelpStep((s) => s + 1)}
													className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
												>
													Next
													<ChevronRight className="ml-0.5 h-4 w-4" />
												</Button>
											) : (
												<Button
													size="sm"
													onClick={() => setIsHelpOpen(false)}
													className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
												>
													Got it
												</Button>
											)}
										</div>
									</div>
								</div>
							</DialogContent>
						</Dialog>
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden
							/>
							<Input
								placeholder="Search by code or description..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="w-52 pl-9 rounded-lg border-muted-foreground/20"
								aria-label="Search SKUs by code or description"
							/>
						</div>
						<div className="flex items-center gap-1.5">
							<ArrowUpDown
								className="h-4 w-4 text-muted-foreground"
								aria-hidden
							/>
							<Select
								value={sortField}
								onValueChange={(value: SkuSortField) => {
									setSortField(value);
									setPage(1);
								}}
							>
								<SelectTrigger
									className="w-36 rounded-lg border-muted-foreground/20"
									aria-label="Sort SKUs by field"
								>
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									{SKU_SORT_FIELDS.map((f) => (
										<SelectItem key={f.value} value={f.value}>
											{f.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={sortDirection}
								onValueChange={(value: "ASC" | "DESC") => {
									setSortDirection(value);
									setPage(1);
								}}
							>
								<SelectTrigger
									className="w-32 rounded-lg border-muted-foreground/20"
									aria-label="Sort SKUs direction"
								>
									<SelectValue placeholder="Order" />
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
							title={!createdBy ? "Sign in to import" : undefined}
							className="rounded-lg"
						>
							Import Excel
						</Button>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Skus
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
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 px-6 text-center text-muted-foreground"
										aria-live="polite"
									>
										Loading SKUs...
									</TableCell>
								</TableRow>
							) : table.getRowModel().rows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No data found.
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
				{!loading && totalItems > 0 && (
					<div
						className="mx-6 mt-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
						style={{ fontFamily: "var(--dashboard-body)" }}
					>
						<div>
							Showing{" "}
							<span className="font-semibold tabular-nums text-foreground">
								{startIndex + 1}
							</span>{" "}
							-{" "}
							<span className="font-semibold tabular-nums text-foreground">
								{Math.min(endIndex, totalItems)}
							</span>{" "}
							of{" "}
							<span className="font-semibold tabular-nums text-foreground">
								{totalItems}
							</span>{" "}
							SKUs
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
								onClick={() =>
									setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p))
								}
								aria-label="Next page"
								className="rounded-lg h-8 w-8"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</CardContent>

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
					if (createInFlightRef.current || createLoading) return;
					createInFlightRef.current = true;

					createSkus({
						variables: {
							input: {
								skuCode: values.skuCode,
								skuDescription: values.skuDescription,
								skuExpiryDate: "",
								skuUom: values.skuUom,
								pickingStrategy: values.pickingStrategy,
								isLotControlled: values.isLotControlled,
								isExpiryControlled: values.isExpiryControlled,
								looseQuantity: values.looseQuantity ?? null,
								skuSuppliers:
									values.skuSuppliers?.map((s) => ({
										supplierId: s.supplierId,
										originalSkuCode: s.originalSkuCode || null,
									})) || [],
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
						},
					});
				}}
				loading={createLoading}
				title="Add SKU"
				description="Create a new Stock Keeping Unit"
			/>

			<ImportDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				mode="skus"
				createdBy={createdBy}
				onImported={() => {
					void refetch();
				}}
			/>

			{editing && (
				<SkusFormDialog
					key={editing.skuId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					suppliers={suppliers}
					stockUnits={stockUnits}
					initial={{
						skuCode: editing.skuCode,
						skuDescription: editing.skuDescription,
						skuUom: editing.skuUom,
						pickingStrategy: editing.pickingStrategy ?? "FIFO",
						isLotControlled: editing.isLotControlled ?? false,
						isExpiryControlled: editing.isExpiryControlled ?? false,
						looseQuantity: editing.looseQuantity,
						skuSuppliers: editing.skuSuppliers,
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

						updateSkus({
							id: editing.skuId,
							input: {
								skuCode: values.skuCode,
								skuDescription: values.skuDescription,
								skuExpiryDate: "",
								skuUom: values.skuUom,
								pickingStrategy: values.pickingStrategy,
								isLotControlled: values.isLotControlled,
								isExpiryControlled: values.isExpiryControlled,
								looseQuantity: values.looseQuantity ?? null,
								skuSuppliers:
									values.skuSuppliers?.map((s) => ({
										supplierId: s.supplierId,
										originalSkuCode: s.originalSkuCode || null,
									})) || [],
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
					title="Edit SKU"
					description="Update Stock Keeping Unit details"
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
						deleteSkus({ id: deleting.skuId });
					}}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}
