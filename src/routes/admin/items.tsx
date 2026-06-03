import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
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
import type { Skus, Supplier, StockUnit } from "@/lib/graphql/types";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SkusSuppliersViewDialog } from "@/components/settings/master-data/skus-suppliers-view-dialog";
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

type ItemFormValues = {
	skuCode: string;
	skuDescription: string;
	barcode: string | null;
	brand: string | null;
	category: string | null;
	manufacturer: string | null;
	isActive: boolean;
	caseRate: number | null;
	caseExtLengthMm: number | null;
	caseExtWidthMm: number | null;
	caseExtHeightMm: number | null;
	caseGrossWeightKg: number | null;
	casesPerLayer: number | null;
	noOfLayers: number | null;
};

function ItemFormDialog({
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
	initial?: Partial<ItemFormValues>;
	onSubmit: (values: ItemFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [skuCode, setSkuCode] = useState(initial?.skuCode ?? "");
	const [skuDescription, setSkuDescription] = useState(initial?.skuDescription ?? "");
	const [barcode, setBarcode] = useState(initial?.barcode ?? "");
	const [brand, setBrand] = useState(initial?.brand ?? "");
	const [category, setCategory] = useState(initial?.category ?? "");
	const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);
	const [caseRate, setCaseRate] = useState(initial?.caseRate?.toString() ?? "");
	const [caseExtLengthMm, setCaseExtLengthMm] = useState(initial?.caseExtLengthMm?.toString() ?? "");
	const [caseExtWidthMm, setCaseExtWidthMm] = useState(initial?.caseExtWidthMm?.toString() ?? "");
	const [caseExtHeightMm, setCaseExtHeightMm] = useState(initial?.caseExtHeightMm?.toString() ?? "");
	const [caseGrossWeightKg, setCaseGrossWeightKg] = useState(initial?.caseGrossWeightKg?.toString() ?? "");
	const [casesPerLayer, setCasesPerLayer] = useState(initial?.casesPerLayer?.toString() ?? "");
	const [noOfLayers, setNoOfLayers] = useState(initial?.noOfLayers?.toString() ?? "");

	useEffect(() => {
		if (!open) return;
		setSkuCode(initial?.skuCode ?? "");
		setSkuDescription(initial?.skuDescription ?? "");
		setBarcode(initial?.barcode ?? "");
		setBrand(initial?.brand ?? "");
		setCategory(initial?.category ?? "");
		setManufacturer(initial?.manufacturer ?? "");
		setIsActive(initial?.isActive ?? true);
		setCaseRate(initial?.caseRate?.toString() ?? "");
		setCaseExtLengthMm(initial?.caseExtLengthMm?.toString() ?? "");
		setCaseExtWidthMm(initial?.caseExtWidthMm?.toString() ?? "");
		setCaseExtHeightMm(initial?.caseExtHeightMm?.toString() ?? "");
		setCaseGrossWeightKg(initial?.caseGrossWeightKg?.toString() ?? "");
		setCasesPerLayer(initial?.casesPerLayer?.toString() ?? "");
		setNoOfLayers(initial?.noOfLayers?.toString() ?? "");
	}, [open, initial]);

	const parseOptionalFloat = (v: string) => {
		const t = v.trim();
		if (!t) return null;
		const n = Number.parseFloat(t);
		return Number.isNaN(n) ? null : n;
	};

	const submit = () => {
		onSubmit({
			skuCode: skuCode.trim(),
			skuDescription: skuDescription.trim(),
			barcode: barcode.trim() || null,
			brand: brand.trim() || null,
			category: category.trim() || null,
			manufacturer: manufacturer.trim() || null,
			isActive,
			caseRate: parseOptionalFloat(caseRate),
			caseExtLengthMm: parseOptionalFloat(caseExtLengthMm),
			caseExtWidthMm: parseOptionalFloat(caseExtWidthMm),
			caseExtHeightMm: parseOptionalFloat(caseExtHeightMm),
			caseGrossWeightKg: parseOptionalFloat(caseGrossWeightKg),
			casesPerLayer: parseOptionalFloat(casesPerLayer),
			noOfLayers: parseOptionalFloat(noOfLayers),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl rounded-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="grid gap-2"><Label>Code</Label><Input value={skuCode} onChange={(e) => setSkuCode(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Description</Label><Input value={skuDescription} onChange={(e) => setSkuDescription(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Barcode</Label><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Manufacturer</Label><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} /></div>
					<div className="flex items-center justify-between rounded-lg border px-3 py-2">
						<Label>Status</Label>
						<Switch checked={isActive} onCheckedChange={setIsActive} />
					</div>
					<div className="grid gap-2"><Label>Case Rate</Label><Input type="number" step="0.01" value={caseRate} onChange={(e) => setCaseRate(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Case Ext Length (mm)</Label><Input type="number" step="0.001" value={caseExtLengthMm} onChange={(e) => setCaseExtLengthMm(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Case Ext Width (mm)</Label><Input type="number" step="0.001" value={caseExtWidthMm} onChange={(e) => setCaseExtWidthMm(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Case Ext Height (mm)</Label><Input type="number" step="0.001" value={caseExtHeightMm} onChange={(e) => setCaseExtHeightMm(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Case Gross Weight (kg)</Label><Input type="number" step="0.001" value={caseGrossWeightKg} onChange={(e) => setCaseGrossWeightKg(e.target.value)} /></div>
					<div className="grid gap-2"><Label>Cases Per Layer</Label><Input type="number" step="0.001" value={casesPerLayer} onChange={(e) => setCasesPerLayer(e.target.value)} /></div>
					<div className="grid gap-2"><Label>No Of Layers</Label><Input type="number" step="0.001" value={noOfLayers} onChange={(e) => setNoOfLayers(e.target.value)} /></div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={submit} disabled={loading || !skuCode.trim() || !skuDescription.trim()}>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

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
	const [viewingSuppliers, setViewingSuppliers] = useState<Skus | null>(null);

	const sendDebugLog = (
		hypothesisId: string,
		message: string,
		data: Record<string, unknown>,
	) => {
		// #region agent log
		fetch("http://127.0.0.1:7725/ingest/20db73c8-0fb7-4781-a984-2cc888a5a871", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Debug-Session-Id": "8952bb",
			},
			body: JSON.stringify({
				sessionId: "8952bb",
				runId: "pre-fix",
				hypothesisId,
				location: "src/routes/admin/items.tsx:ItemsComponent",
				message,
				data,
				timestamp: Date.now(),
			}),
		}).catch(() => {});
		// #endregion
	};

	const { data, isLoading, refetch } = useQuery({
		queryKey: qk.items.all,
		queryFn: () => gqlRequest<ItemsQueryData>(ITEMS_QUERY, {}),
		staleTime: 0,
		gcTime: 0,
	});
	const allItems: Skus[] = data?.skus?.query ?? [];

	const { data: suppliersData } = useQuery({
		queryKey: qk.suppliers.all,
		queryFn: () =>
			gqlRequest<SuppliersQueryData, SuppliersQueryVariables>(
				SUPPLIERS_QUERY,
				{},
			),
	});
	const suppliers: Supplier[] = suppliersData?.suppliers.query ?? [];

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
				header: "Ctn Rate",
				size: 110,
				cell: (info) => formatNum(info.getValue<number | null>(), 2),
			},
			{
				id: "caseExtLengthMm",
				accessorKey: "caseExtLengthMm",
				header: "Ctn Ext Length (mm)",
				size: 170,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "caseExtWidthMm",
				accessorKey: "caseExtWidthMm",
				header: "Ctn Ext Width (mm)",
				size: 165,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "caseExtHeightMm",
				accessorKey: "caseExtHeightMm",
				header: "Ctn Ext Height (mm)",
				size: 170,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "caseGrossWeightKg",
				accessorKey: "caseGrossWeightKg",
				header: "Ctn Gross Weight (kg)",
				size: 175,
				cell: (info) => formatNum(info.getValue<number | null>(), 3),
			},
			{
				id: "casesPerLayer",
				accessorKey: "casesPerLayer",
				header: "Ctns Per Layer",
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

	useEffect(() => {
		const links = Array.from(document.head.querySelectorAll("link")).map((link) => ({
			rel: link.rel,
			href: link.getAttribute("href"),
		}));
		sendDebugLog("H1", "items route mounted", {
			isCreateOpen,
			isImportOpen,
			editingId: editing?.skuId ?? null,
			deletingId: deleting?.skuId ?? null,
			viewingSuppliersId: viewingSuppliers?.skuId ?? null,
			headLinkCount: links.length,
			headLinks: links.slice(0, 8),
		});

		return () => {
			const unmountLinks = Array.from(document.head.querySelectorAll("link")).map((link) => ({
				rel: link.rel,
				href: link.getAttribute("href"),
			}));
			sendDebugLog("H1", "items route unmount cleanup", {
				headLinkCount: unmountLinks.length,
				headLinks: unmountLinks.slice(0, 8),
			});
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const links = Array.from(document.head.querySelectorAll("link")).map((link) => ({
			rel: link.rel,
			href: link.getAttribute("href"),
		}));
		sendDebugLog("H2", "items ui state changed", {
			isCreateOpen,
			isImportOpen,
			editingId: editing?.skuId ?? null,
			deletingId: deleting?.skuId ?? null,
			viewingSuppliersId: viewingSuppliers?.skuId ?? null,
			page,
			totalItems,
			headLinkCount: links.length,
		});
	}, [
		isCreateOpen,
		isImportOpen,
		editing,
		deleting,
		viewingSuppliers,
		page,
		totalItems,
	]);

	useEffect(() => {
		sendDebugLog("H3", "items data/loading state changed", {
			isLoading,
			paginatedLength: paginated.length,
			allItemsLength: allItems.length,
		});
	}, [isLoading, paginated.length, allItems.length]);

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

			<SkusSuppliersViewDialog
				open={viewingSuppliers !== null}
				onOpenChange={(open) => {
					if (!open) setViewingSuppliers(null);
				}}
				sku={viewingSuppliers}
				suppliers={suppliers}
			/>

			<ItemFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) => {
					if (createInFlightRef.current || createLoading) return;
					if (!defaultStockUnitId) {
						toast.error("No stock unit found. Please create CTN stock unit first.");
						return;
					}
					createInFlightRef.current = true;
					void createItem({
						input: {
							skuCode: values.skuCode,
							skuDescription: values.skuDescription,
							skuExpiryDate: "",
							skuUom: defaultStockUnitId,
							pickingStrategy: "FIFO",
							isLotControlled: false,
							isExpiryControlled: false,
							skuSuppliers: [],
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
					initial={{
						skuCode: editing.skuCode,
						skuDescription: editing.skuDescription,
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
						void updateItem({
							id: editing.skuId,
							input: {
								skuCode: values.skuCode,
								skuDescription: values.skuDescription,
								skuExpiryDate: "",
								skuUom: editing.skuUom,
								pickingStrategy: editing.pickingStrategy ?? "FIFO",
								isLotControlled: editing.isLotControlled ?? false,
								isExpiryControlled: editing.isExpiryControlled ?? false,
								skuSuppliers: editing.skuSuppliers ?? [],
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
