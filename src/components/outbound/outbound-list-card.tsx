import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	type ColumnDef,
	type Column,
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
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Search,
	Eye,
	CheckCircle,
	Calendar,
	Clock,
	PackageOpen,
	AlertCircle,
	ChevronRight,
	ChevronDown,
	Download,
	Loader2,
	FileArchive,
	Files,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PurchaseOrderDetail } from "@/data/purchase-orders.types";
import {
	purchaseOrderStatuses,
	getStatusColor,
	getNetSuiteStatusColor,
	formatStatus,
	getPurchaseOrderStatusColor,
	formatDeliveryOrderStepStatus,
	getDeliveryOrderStepStatusColor,
} from "@/lib/outbound";
import type { DeliveryTab } from "@/lib/outbound";
import { formatDeliveryDateHeader, formatWeekRange } from "@/lib/utils";
import {
	useInfinitePurchaseOrders,
	usePurchaseOrders,
	type PurchaseOrderStatusFilter,
} from "@/lib/hooks/use-purchase-orders";

function getCommonPinningStyles(
	column: Column<PurchaseOrderDetail>,
): CSSProperties {
	const isPinned = column.getIsPinned();
	const isLastLeftPinned =
		isPinned === "left" && column.getIsLastColumn("left");
	return {
		boxShadow: isLastLeftPinned
			? "-4px 0 4px -4px var(--border) inset"
			: undefined,
		left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
		position: isPinned ? "sticky" : "relative",
		width: column.getSize(),
		zIndex: isPinned ? 1 : 0,
	};
}

interface OutboundListCardProps {
	onViewPurchaseOrder: (purchaseOrder: PurchaseOrderDetail) => void;
	onAcceptClick?: (purchaseOrder: PurchaseOrderDetail) => void;
	onAdvanceStep?: (purchaseOrder: PurchaseOrderDetail) => void;
	isAdvanceStepPending?: boolean;
	advancingDeliveryOrderId?: string | null;
	hasAcceptPermission?: boolean;
	cardClassName?: string;
	/** Generate and download DO PDF for one row. */
	onDownloadDoPdf?: (
		purchaseOrder: PurchaseOrderDetail,
	) => void | Promise<void>;
	pendingDoPdfDeliveryOrderId?: string | null;
	/** Download PDFs for all selected rows bundled as a ZIP. */
	onBulkDownloadDoPdf?: (
		purchaseOrders: PurchaseOrderDetail[],
	) => void | Promise<void>;
	/** Download PDFs for all selected rows as individual files. */
	onBulkDownloadDoPdfIndividual?: (
		purchaseOrders: PurchaseOrderDetail[],
	) => void | Promise<void>;
	isBulkDoPdfPending?: boolean;
	bulkDoPdfProgress?: number;
	bulkDoPdfTotal?: number;
	/** Mark selected delivery orders as picked (advance to PACKING). */
	onBulkMarkAllPicked?: (
		purchaseOrders: PurchaseOrderDetail[],
	) => void | Promise<void>;
	/** Mark selected PACKING delivery orders as shipped. */
	onBulkMarkAsShipped?: (
		purchaseOrders: PurchaseOrderDetail[],
	) => void | Promise<void>;
	/** Bulk process selected delivery orders to their next step. */
	onBulkProcessSelected?: (
		purchaseOrders: PurchaseOrderDetail[],
	) => void | Promise<void>;
	isBulkStatusActionPending?: boolean;
	/** When set, syncs the internal status filter from an external source (e.g. summary cards). */
	initialStatusFilter?: PurchaseOrderStatusFilter;
}

export function OutboundListCard({
	onViewPurchaseOrder,
	onAcceptClick,
	onAdvanceStep,
	isAdvanceStepPending,
	advancingDeliveryOrderId,
	hasAcceptPermission,
	cardClassName,
	onDownloadDoPdf,
	pendingDoPdfDeliveryOrderId,
	onBulkDownloadDoPdf,
	onBulkDownloadDoPdfIndividual,
	isBulkDoPdfPending,
	bulkDoPdfProgress,
	bulkDoPdfTotal,
	onBulkMarkAllPicked,
	onBulkMarkAsShipped,
	onBulkProcessSelected,
	isBulkStatusActionPending,
	initialStatusFilter,
}: OutboundListCardProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<PurchaseOrderStatusFilter>("ALL");
	const [regionFilter, setRegionFilter] = useState<string>("ALL");
	const [dateFilter, setDateFilter] = useState<string>("ALL");
	const [activeTab, setActiveTab] = useState<DeliveryTab>("current-week");
	const [selectedDoIds, setSelectedDoIds] = useState<Set<string>>(new Set());
	const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

	// Sentinel ref for IntersectionObserver
	const sentinelRef = useRef<HTMLTableRowElement>(null);

	useEffect(() => {
		if (initialStatusFilter !== undefined) {
			setStatusFilter(initialStatusFilter);
		}
	}, [initialStatusFilter]);

	/** Today's date key in YYYY-MM-DD format, using UTC+8 business timezone. */
	const todayKey = useMemo(() => {
		const now = new Date();
		const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
		return `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, "0")}-${String(utc8.getUTCDate()).padStart(2, "0")}`;
	}, []);

	// Separate query for region options (unfiltered, for the region dropdown)
	const { data: regionData } = usePurchaseOrders({
		activeTab,
		page: 1,
		regionFilter: "ALL",
	});

	// Infinite query for the main table
	const {
		data: infiniteData,
		isLoading,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
		error,
		refetch,
	} = useInfinitePurchaseOrders({
		searchTerm,
		statusFilter,
		regionFilter,
		activeTab,
	});

	// Merge all pages into a single model
	const { purchaseOrdersByDate, allDateKeys, weekRangeDateKeys } =
		useMemo(() => {
			if (!infiniteData) {
				return {
					purchaseOrdersByDate: {},
					allDateKeys: [],
					dateKeys: [],
					weekRangeDateKeys: [],
				};
			}
			const mergedByDate: Record<string, PurchaseOrderDetail[]> = {};
			const seenDateKeys = new Set<string>();

			for (const page of infiniteData.pages) {
				const pageByDate = page.result.purchaseOrdersByDate;
				for (const dk of page.result.paginatedDateKeys) {
					seenDateKeys.add(dk);
					// Merge orders, deduplicating by PO id
					const existing = mergedByDate[dk] ?? [];
					const incoming = pageByDate[dk] ?? [];
					const existingIds = new Set(existing.map((p) => p.id));
					mergedByDate[dk] = [
						...existing,
						...incoming.filter((p) => !existingIds.has(p.id)),
					];
				}
				// For current-week include all date slots (even empty ones) from first page
				if (activeTab === "current-week" && infiniteData.pages[0]?.result.dateKeys) {
					for (const dk of infiniteData.pages[0].result.dateKeys) {
						seenDateKeys.add(dk);
						if (!mergedByDate[dk]) mergedByDate[dk] = [];
					}
				}
			}

			// Globally sort all collected date keys so cross-page ordering is consistent.
			// current-week: ASC (nearest first), past-weeks: DESC (newest first)
			const allKeys = Array.from(seenDateKeys).sort((a, b) =>
				activeTab === "current-week" ? a.localeCompare(b) : b.localeCompare(a),
			);

			// Week range label uses the full set from the first page
			const weekKeys = infiniteData.pages[0]?.result.dateKeys ?? [];

			return {
				purchaseOrdersByDate: mergedByDate,
				allDateKeys: allKeys,
				dateKeys: weekKeys,
				weekRangeDateKeys: weekKeys,
			};
		}, [infiniteData, activeTab]);

	const paginatedDateKeys =
		dateFilter === "ALL"
			? allDateKeys
			: allDateKeys.filter((dk) => dk === dateFilter);

	const visiblePurchaseOrders = useMemo(
		() => paginatedDateKeys.flatMap((dk) => purchaseOrdersByDate[dk] ?? []),
		[paginatedDateKeys, purchaseOrdersByDate],
	);

	const dateOptions = useMemo(
		() =>
			allDateKeys.map((dk) => {
				const label = formatDeliveryDateHeader(new Date(dk + "T12:00:00"));
				return { value: dk, label };
			}),
		[allDateKeys],
	);

	const regionOptions = useMemo(() => {
		const allPurchaseOrders = regionData?.purchaseOrders ?? [];
		const seen = new Map<string, string>();
		for (const po of allPurchaseOrders) {
			if (!po.regionName) continue;
			const label = po.regionCode
				? `${po.regionName} (${po.regionCode})`
				: po.regionName;
			seen.set(po.regionName, label);
		}
		return Array.from(seen.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([value, label]) => ({ value, label }));
	}, [regionData?.purchaseOrders]);

	const selectableWithDo = useMemo(
		() =>
			visiblePurchaseOrders.filter(
				(p): p is PurchaseOrderDetail & { deliveryOrder: { id: string } } =>
					Boolean(p.deliveryOrder?.id),
			),
		[visiblePurchaseOrders],
	);

	// Reset selection and filters when tab/filter changes
	useEffect(() => {
		setSelectedDoIds(new Set());
	}, [activeTab, statusFilter, searchTerm, regionFilter, dateFilter]);

	useEffect(() => {
		setRegionFilter("ALL");
		setDateFilter("ALL");
	}, [activeTab, statusFilter, searchTerm]);

	// past-weeks: page 1 may be empty while older weeks have data — keep probing
	const isProbingPastWeeks =
		activeTab === "past-weeks" &&
		!isLoading &&
		paginatedDateKeys.length === 0 &&
		hasNextPage;

	// IntersectionObserver sentinel to auto-fetch next page
	const handleFetchNext = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	useEffect(() => {
		if (isProbingPastWeeks && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [isProbingPastWeeks, isFetchingNextPage, fetchNextPage]);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					handleFetchNext();
				}
			},
			{ threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [handleFetchNext]);

	const isFetching = isLoading || isFetchingNextPage;
	const loading = isLoading;
	const weekRangeLabel =
		activeTab === "current-week" && weekRangeDateKeys.length > 0
			? formatWeekRange(
					weekRangeDateKeys[0],
					weekRangeDateKeys[weekRangeDateKeys.length - 1],
				)
			: null;

	const showRowPdfDownload = Boolean(onDownloadDoPdf);
	const showBulkPdf = Boolean(onBulkDownloadDoPdf);

	// Derive which delivery-date groups the current selection spans (for sticky bar subtitle)
	const selectedGroupLabels = useMemo(() => {
		if (selectedDoIds.size === 0) return [];
		const labels: string[] = [];
		for (const dateKey of allDateKeys) {
			const groupIds = (purchaseOrdersByDate[dateKey] ?? [])
				.filter((p) => Boolean(p.deliveryOrder?.id))
				.map((p) => p.deliveryOrder!.id);
			const count = groupIds.filter((id) => selectedDoIds.has(id)).length;
			if (count > 0) {
				labels.push(`${formatDeliveryDateHeader(new Date(dateKey + "T12:00:00"))} (${count})`);
			}
		}
		return labels;
	}, [selectedDoIds, allDateKeys, purchaseOrdersByDate]);

	const poToDateKey = useMemo(() => {
		const m = new Map<string, string>();
		for (const dateKey of allDateKeys) {
			for (const po of purchaseOrdersByDate[dateKey] ?? []) {
				m.set(po.id, dateKey);
			}
		}
		return m;
	}, [allDateKeys, purchaseOrdersByDate]);

	const selectedPurchaseOrders = useMemo(
		() =>
			selectableWithDo.filter((p) => selectedDoIds.has(p.deliveryOrder.id)),
		[selectableWithDo, selectedDoIds],
	);

	const selectableIds = useMemo(
		() => selectableWithDo.map((p) => p.deliveryOrder.id),
		[selectableWithDo],
	);
	const allSelectableSelected =
		selectableIds.length > 0 &&
		selectableIds.every((id) => selectedDoIds.has(id));
	const someSelectableSelected = selectableIds.some((id) =>
		selectedDoIds.has(id),
	);

	const columns = useMemo<ColumnDef<PurchaseOrderDetail>[]>(() => {
		const cols: ColumnDef<PurchaseOrderDetail>[] = [];

		if (showBulkPdf) {
			cols.push({
				id: "select",
				size: 56,
				header: () => (
					<Checkbox
						checked={
							allSelectableSelected
								? true
								: someSelectableSelected
									? "indeterminate"
									: false
						}
						onCheckedChange={(checked) => {
							if (checked === true) {
								setSelectedDoIds(new Set(selectableIds));
							} else {
								setSelectedDoIds(new Set());
							}
						}}
						disabled={selectableIds.length === 0 || isBulkDoPdfPending}
						aria-label="Select all delivery orders in this list for bulk PDF download"
					/>
				),
				cell: ({ row }) => {
					const po = row.original;
					const doId = po.deliveryOrder?.id;
					if (!doId)
						return <span className="text-muted-foreground/50">—</span>;
					return (
						<Checkbox
							checked={selectedDoIds.has(doId)}
							onCheckedChange={(c) => {
								setSelectedDoIds((prev) => {
									const next = new Set(prev);
									if (c === true) next.add(doId);
									else next.delete(doId);
									return next;
								});
							}}
							disabled={isBulkDoPdfPending}
							aria-label={`Select ${po.purchaseOrderNumber} for bulk DO PDF download`}
						/>
					);
				},
			});
		}

		cols.push(
			{
				id: "purchaseOrderNumber",
				size: 160,
				header: () => "PO Number",
				cell: ({ row }) => (
					<span className="block truncate font-medium" title={row.original.purchaseOrderNumber}>
						{row.original.purchaseOrderNumber}
					</span>
				),
			},
			{
				id: "toLocation",
				size: 192,
				header: () => "Outlet",
				cell: ({ row }) => (
					<span className="block truncate" title={row.original.toLocation ?? undefined}>
						{row.original.toLocation}
					</span>
				),
			},
			{
				id: "regionName",
				size: 200,
				header: () => "Region",
				cell: ({ row }) => {
					const po = row.original;
					if (!po.regionName) return "—";
					const label = `${po.regionName}${po.regionCode ? ` (${po.regionCode})` : ""}`;
					return (
						<span className="block truncate" title={label}>
							{label}
						</span>
					);
				},
			},
			{
				id: "status",
				size: 150,
				header: () => "PO Status",
				cell: ({ row }) => (
					<Badge
						variant="outline"
						className={getStatusColor(row.original.status)}
					>
						{formatStatus(row.original.status)}
					</Badge>
				),
			},
			{
				id: "deliveryOrderStatus",
				size: 260,
				header: () => "DO Status",
				cell: ({ row }) => {
					const po = row.original;
					if (!po.deliveryOrder) {
						return (
							<span className="text-muted-foreground text-sm">—</span>
						);
					}
					const deliveryOrderStatus = po.deliveryOrder.status ?? "";
					const isAwaitingPicking = [
						"NEW",
						"CREATED",
						"PICKING",
					].includes(deliveryOrderStatus);
					const rowDateKey = poToDateKey.get(po.id);
					return (
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className={getDeliveryOrderStepStatusColor(
									po.deliveryOrder.status,
								)}
							>
								{formatDeliveryOrderStepStatus(po.deliveryOrder.status)}
							</Badge>
							{isAwaitingPicking ? (
								<span className="text-xs text-muted-foreground italic">
									Awaiting picking
								</span>
							) : onAdvanceStep &&
								deliveryOrderStatus === "PACKING" &&
								rowDateKey === todayKey ? (
								<Button
									variant="outline"
									size="sm"
									className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									onClick={() => onAdvanceStep(po)}
									disabled={
										isAdvanceStepPending &&
										advancingDeliveryOrderId === po.deliveryOrder?.id
									}
									aria-label={`Mark ${po.purchaseOrderNumber} to next step`}
								>
									{isAdvanceStepPending &&
									advancingDeliveryOrderId === po.deliveryOrder?.id
										? "Updating…"
										: "Next step"}
									<ChevronRight className="ml-1 h-4 w-4" />
								</Button>
							) : null}
						</div>
					);
				},
			},
			{
				id: "netsuiteStatus",
				size: 150,
				header: () => "NetSuite (API)",
				cell: ({ row }) => (
					<Badge
						variant="outline"
						className={getNetSuiteStatusColor(row.original.netsuiteStatus)}
					>
						{row.original.netsuiteStatus || "N/A"}
					</Badge>
				),
			},
			{
				id: "actions",
				size: 180,
				header: () => <span className="block text-right">Actions</span>,
				cell: ({ row }) => {
					const purchaseOrder = row.original;
					return (
						<div
							className="flex justify-end gap-1"
							role="group"
							aria-label={`Actions for ${purchaseOrder.purchaseOrderNumber}`}
						>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => onViewPurchaseOrder(purchaseOrder)}
								className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label={`View details for ${purchaseOrder.purchaseOrderNumber}`}
							>
								<Eye className="h-4 w-4" aria-hidden="true" />
							</Button>
							{showRowPdfDownload && purchaseOrder.deliveryOrder?.id ? (
								<Button
									variant="ghost"
									size="icon"
									onClick={() =>
										void onDownloadDoPdf?.(purchaseOrder)
									}
									disabled={
										pendingDoPdfDeliveryOrderId ===
											purchaseOrder.deliveryOrder.id ||
										isBulkDoPdfPending
									}
									className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									aria-label={`Download delivery order PDF for ${purchaseOrder.purchaseOrderNumber}`}
								>
									{pendingDoPdfDeliveryOrderId ===
									purchaseOrder.deliveryOrder.id ? (
										<Loader2
											className="h-4 w-4 animate-spin"
											aria-hidden
										/>
									) : (
										<Download className="h-4 w-4" aria-hidden />
									)}
								</Button>
							) : null}
							{hasAcceptPermission &&
								purchaseOrder.status === "preparing" && (
									<Button
										variant="ghost"
										size="icon"
										onClick={() => onAcceptClick?.(purchaseOrder)}
										className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										aria-label={`Accept ${purchaseOrder.purchaseOrderNumber}`}
									>
										<CheckCircle
											className="h-4 w-4 text-green-600"
											aria-hidden="true"
										/>
									</Button>
								)}
						</div>
					);
				},
			},
		);

		return cols;
	}, [
		showBulkPdf,
		allSelectableSelected,
		someSelectableSelected,
		selectableIds,
		isBulkDoPdfPending,
		selectedDoIds,
		onAdvanceStep,
		isAdvanceStepPending,
		advancingDeliveryOrderId,
		todayKey,
		onViewPurchaseOrder,
		showRowPdfDownload,
		onDownloadDoPdf,
		pendingDoPdfDeliveryOrderId,
		hasAcceptPermission,
		onAcceptClick,
		poToDateKey,
	]);

	const table = useReactTable({
		data: visiblePurchaseOrders,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (po) => po.id,
		state: {
			columnPinning: {
				left: showBulkPdf
					? ["select", "purchaseOrderNumber"]
					: ["purchaseOrderNumber", "toLocation"],
			},
		},
	});

	const tableColCount = columns.length;

	return (
		<>
		<Card
			role="region"
			aria-labelledby="purchase-order-title"
			className={cardClassName}
		>
			<CardHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle
								id="purchase-order-title"
								className="text-xl font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Delivery Order List
							</CardTitle>
							<CardDescription
								className="text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{weekRangeLabel
									? `This week: ${weekRangeLabel}`
									: "View and manage all purchase orders"}
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search
									className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									id="search-purchase-orders"
									placeholder="Search purchase orders..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-9 sm:w-64 rounded-lg border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									aria-label="Search purchase orders by PO number, outlet, or region"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(value) =>
									setStatusFilter(value as PurchaseOrderStatusFilter)
								}
							>
								<SelectTrigger
									className="sm:w-48 rounded-lg border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									aria-label="Filter by status"
								>
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Status</SelectItem>
									{purchaseOrderStatuses.map((status) => (
										<SelectItem
											key={status}
											value={status}
											className={getPurchaseOrderStatusColor(status)}
										>
											{formatStatus(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={regionFilter}
								onValueChange={(value) => setRegionFilter(value)}
							>
								<SelectTrigger
									className="sm:w-52 rounded-lg border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									aria-label="Filter by region"
								>
									<SelectValue placeholder="Filter by region" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Regions</SelectItem>
									{regionOptions.map((region) => (
										<SelectItem key={region.value} value={region.value}>
											{region.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={dateFilter}
								onValueChange={setDateFilter}
							>
								<SelectTrigger
									className="sm:w-60 rounded-lg border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									aria-label="Filter by date"
								>
									<SelectValue placeholder="Filter by date" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Dates</SelectItem>
									{dateOptions.map((dateOption) => (
										<SelectItem
											key={dateOption.value}
											value={dateOption.value}
										>
											{dateOption.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div
						className="flex gap-2 border-b"
						role="tablist"
						aria-label="Delivery period tabs"
					>
						<Button
							variant="ghost"
							onClick={() => setActiveTab("current-week")}
							className="rounded-lg rounded-b-none border border-transparent transition-colors hover:bg-[var(--dashboard-accent-muted)]/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							style={{
								...(activeTab === "current-week"
									? {
											background: "var(--dashboard-accent)",
											borderColor: "var(--dashboard-accent)",
											color: "white",
										}
									: {
											background: "transparent",
											color: "inherit",
										}),
							}}
							role="tab"
							aria-selected={activeTab === "current-week"}
							aria-controls="purchase-order-table"
						>
							<Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
							Next Delivery
						</Button>
						<Button
							variant="ghost"
							onClick={() => setActiveTab("past-weeks")}
							className="rounded-lg rounded-b-none border border-transparent transition-colors hover:bg-[var(--dashboard-accent-muted)]/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							style={{
								...(activeTab === "past-weeks"
									? {
											background: "var(--dashboard-accent)",
											borderColor: "var(--dashboard-accent)",
											color: "white",
										}
									: {
											background: "transparent",
											color: "inherit",
										}),
							}}
							role="tab"
							aria-selected={activeTab === "past-weeks"}
							aria-controls="purchase-order-table"
						>
							<Clock className="mr-2 h-4 w-4" aria-hidden="true" />
							Past Deliveries
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent
				className="relative px-0 pb-6"
				role="tabpanel"
				id="purchase-order-table"
				aria-labelledby="purchase-order-title"
			>
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border mx-6">
					<Table
						aria-label="Purchase orders list"
						aria-busy={isFetching}
						style={{ width: "100%", minWidth: table.getTotalSize(), tableLayout: "fixed" }}
					>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow
									key={headerGroup.id}
									className="hover:bg-transparent"
								>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											scope="col"
											className="px-6"
											style={{
												...getCommonPinningStyles(header.column),
												backgroundColor: header.column.getIsPinned()
													? "var(--background)"
													: undefined,
											}}
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
								<>
									<TableRow aria-hidden="true">
										<TableCell
											colSpan={tableColCount}
											className="sr-only px-6"
											role="status"
											aria-live="polite"
										>
											Loading purchase orders…
										</TableCell>
									</TableRow>
									{Array.from({ length: 8 }).map((_, i) => (
										<TableRow key={i}>
											{table.getAllLeafColumns().map((column) => (
												<TableCell
													key={column.id}
													className="px-6"
													style={{
														...getCommonPinningStyles(column),
														backgroundColor: column.getIsPinned()
															? "var(--background)"
															: undefined,
													}}
												>
													<Skeleton className="h-5 w-3/4" />
												</TableCell>
											))}
										</TableRow>
									))}
								</>
							) : error ? (
								<TableRow>
									<TableCell
										colSpan={tableColCount}
										className="px-6 py-12 text-center"
										role="alert"
										aria-live="assertive"
									>
										<div className="sticky left-0 flex flex-col items-center gap-4">
											<div className="rounded-full bg-destructive/10 p-3">
												<AlertCircle
													className="h-8 w-8 text-destructive"
													aria-hidden
												/>
											</div>
											<div>
												<p className="font-medium text-foreground">
													Failed to load purchase orders
												</p>
												<p className="mt-1 text-sm text-muted-foreground">
													{error instanceof Error
														? error.message
														: "Something went wrong."}
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
												onClick={() => refetch()}
											>
												Try again
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : paginatedDateKeys.length === 0 && !isProbingPastWeeks ? (
								<TableRow>
									<TableCell
										colSpan={tableColCount}
										className="px-6 py-12 text-center"
										role="status"
									>
										<div className="sticky left-0 flex flex-col items-center gap-3">
											<div className="rounded-full bg-muted p-3">
												<PackageOpen
													className="h-10 w-10 text-muted-foreground"
													aria-hidden
												/>
											</div>
											<div>
												<p className="font-medium text-foreground">
													{activeTab === "current-week"
														? "No orders scheduled for this week"
														: "No purchase orders found"}
												</p>
												<p className="mt-1 text-sm text-muted-foreground">
													{activeTab === "current-week"
														? "Orders will appear here when they are scheduled for delivery."
														: "Try adjusting your search or filters."}
												</p>
											</div>
										</div>
									</TableCell>
								</TableRow>
							) : paginatedDateKeys.length === 0 && isProbingPastWeeks ? (
								<>
									<TableRow aria-live="polite" role="status">
										<TableCell
											colSpan={tableColCount}
											className="px-6 py-12 text-center"
										>
											<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
												Searching older deliveries…
											</div>
										</TableCell>
									</TableRow>
									<TableRow
										ref={sentinelRef}
										aria-hidden="true"
										className="pointer-events-none"
									>
										<TableCell colSpan={tableColCount} className="py-0 h-1" />
									</TableRow>
								</>
							) : (
								<>
									{paginatedDateKeys.flatMap((dateKey) => {
										const datePurchaseOrders =
											purchaseOrdersByDate[dateKey] ?? [];
										const deliveryDate = new Date(dateKey + "T12:00:00");
										const headerLabel = formatDeliveryDateHeader(deliveryDate);

										const dateSelectableIds = datePurchaseOrders
											.filter((p) => Boolean(p.deliveryOrder?.id))
											.map((p) => p.deliveryOrder!.id);
										const allDateSelected =
											dateSelectableIds.length > 0 &&
											dateSelectableIds.every((id) => selectedDoIds.has(id));
										const someDateSelected = dateSelectableIds.some((id) =>
											selectedDoIds.has(id),
										);

										const isCollapsed = collapsedDates.has(dateKey);

										return [
											<TableRow
												key={dateKey}
												className="hover:bg-muted/70 bg-muted/50 border-l-4 border-l-primary/30 cursor-pointer select-none"
												onClick={() =>
													setCollapsedDates((prev) => {
														const next = new Set(prev);
														if (next.has(dateKey)) next.delete(dateKey);
														else next.add(dateKey);
														return next;
													})
												}
												aria-expanded={!isCollapsed}
											>
												<TableCell
													colSpan={tableColCount}
													className="px-6 font-semibold text-foreground py-3"
												>
													<div className="sticky left-0 inline-flex items-center gap-3">
														<ChevronDown
															className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
															aria-hidden
														/>
														{showBulkPdf && dateSelectableIds.length > 0 ? (
															<Checkbox
																checked={
																	allDateSelected
																		? true
																		: someDateSelected
																			? "indeterminate"
																			: false
																}
																onCheckedChange={(checked) => {
																	setSelectedDoIds((prev) => {
																		const next = new Set(prev);
																		if (checked === true) {
																			dateSelectableIds.forEach((id) =>
																				next.add(id),
																			);
																		} else {
																			dateSelectableIds.forEach((id) =>
																				next.delete(id),
																			);
																		}
																		return next;
																	});
																}}
																onClick={(e) => e.stopPropagation()}
																disabled={isBulkDoPdfPending}
																aria-label={`Select all orders for ${headerLabel}`}
															/>
														) : null}
														<span>
															{headerLabel}
															{datePurchaseOrders.length > 0 && (
																<span className="ml-2 text-muted-foreground font-normal">
																	({datePurchaseOrders.length}{" "}
																	{datePurchaseOrders.length === 1
																		? "order"
																		: "orders"}
																	)
																</span>
															)}
														</span>
													</div>
												</TableCell>
											</TableRow>,
											...(!isCollapsed && datePurchaseOrders.length === 0
												? [
														<TableRow key={`${dateKey}-empty`}>
															<TableCell
																colSpan={tableColCount}
																className="px-6 py-4 text-sm text-muted-foreground italic"
															>
																<span className="sticky left-0 inline-block">
																	No orders for this day
																</span>
															</TableCell>
														</TableRow>,
													]
												: []),
											...(!isCollapsed ? datePurchaseOrders : []).map(
												(purchaseOrder) => {
													const tableRow = table.getRow(purchaseOrder.id);
													return (
														<TableRow
															key={purchaseOrder.id}
															className="transition-colors hover:bg-muted/50 [&:hover>td]:bg-muted/50"
														>
															{tableRow.getVisibleCells().map((cell) => (
																<TableCell
																	key={cell.id}
																	className="px-6 align-middle"
																	style={{
																		...getCommonPinningStyles(cell.column),
																		backgroundColor: cell.column.getIsPinned()
																			? "var(--background)"
																			: undefined,
																	}}
																>
																	{flexRender(
																		cell.column.columnDef.cell,
																		cell.getContext(),
																	)}
																</TableCell>
															))}
														</TableRow>
													);
												},
											),
										];
									})}

									{/* Infinite scroll sentinel row */}
									<TableRow
										ref={sentinelRef}
										aria-hidden="true"
										className="pointer-events-none"
									>
										<TableCell colSpan={tableColCount} className="py-0 h-1" />
									</TableRow>

									{/* Loading more indicator */}
									{isFetchingNextPage && (
										<TableRow aria-live="polite" role="status">
											<TableCell
												colSpan={tableColCount}
												className="px-6 py-4 text-center"
											>
												<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
													<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
													Loading more orders…
												</div>
											</TableCell>
										</TableRow>
									)}

									{/* End of list indicator */}
									{!hasNextPage && paginatedDateKeys.length > 0 && !loading && (
										<TableRow aria-live="polite">
											<TableCell
												colSpan={tableColCount}
												className="px-6 py-3 text-center"
											>
												<span className="text-xs text-muted-foreground">
													All orders loaded
												</span>
											</TableCell>
										</TableRow>
									)}
								</>
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>

		{/* ── Sticky bulk-action bar ── */}
		{showBulkPdf && selectedDoIds.size > 0 && (
			<div
				className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
				role="status"
				aria-live="polite"
			>
				<div className="container mx-auto flex items-center justify-between gap-4 px-6 py-3">
					<div className="flex flex-col gap-0.5 min-w-0">
						<span className="text-sm">
							<span className="font-semibold text-foreground">
								{selectedDoIds.size}
							</span>{" "}
							<span className="text-muted-foreground">
								{selectedDoIds.size === 1 ? "order" : "orders"} selected
							</span>
						</span>
						{selectedGroupLabels.length > 0 && (
							<span className="text-xs text-muted-foreground truncate">
								{selectedGroupLabels.join(", ")}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs"
							onClick={() => setSelectedDoIds(new Set())}
						>
							Clear selection
						</Button>
						{(onBulkMarkAllPicked || onBulkMarkAsShipped || onBulkProcessSelected) ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										disabled={Boolean(isBulkStatusActionPending)}
									>
										{isBulkStatusActionPending ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
										) : null}
										Update DO status
										<ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{onBulkMarkAllPicked ? (
										<DropdownMenuItem
											disabled={Boolean(isBulkStatusActionPending)}
											onSelect={() => {
												void onBulkMarkAllPicked(selectedPurchaseOrders);
											}}
										>
											Mark all as Picked
										</DropdownMenuItem>
									) : null}
									{onBulkMarkAsShipped ? (
										<DropdownMenuItem
											disabled={Boolean(isBulkStatusActionPending)}
											onSelect={() => {
												void onBulkMarkAsShipped(selectedPurchaseOrders);
											}}
										>
											Mark as Shipped
										</DropdownMenuItem>
									) : null}
									{onBulkProcessSelected ? (
										<DropdownMenuItem
											disabled={Boolean(isBulkStatusActionPending)}
											onSelect={() => {
												void onBulkProcessSelected(selectedPurchaseOrders);
											}}
										>
											Bulk process
										</DropdownMenuItem>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
						{isBulkDoPdfPending ? (
							<Button
								type="button"
								size="sm"
								disabled
								className="h-8 text-xs gap-1.5 text-white disabled:opacity-50"
								style={{
									background: "var(--dashboard-accent)",
									borderColor: "var(--dashboard-accent)",
								}}
							>
								<Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
								{bulkDoPdfTotal && bulkDoPdfTotal > 0
									? `${bulkDoPdfProgress ?? 0} / ${bulkDoPdfTotal} PDFs…`
									: "Generating PDFs…"}
							</Button>
						) : (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										size="sm"
										className="h-8 text-xs gap-1.5 text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										style={{
											background: "var(--dashboard-accent)",
											borderColor: "var(--dashboard-accent)",
										}}
									>
										<Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
										Download {selectedDoIds.size} PDF{selectedDoIds.size !== 1 ? "s" : ""}
										<ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onSelect={() => {
											const selected = selectableWithDo.filter((p) =>
												selectedDoIds.has(p.deliveryOrder.id),
											);
											void onBulkDownloadDoPdf?.(selected);
										}}
									>
										<FileArchive className="mr-2 h-4 w-4" aria-hidden />
										Download as ZIP
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={() => {
											const selected = selectableWithDo.filter((p) =>
												selectedDoIds.has(p.deliveryOrder.id),
											);
											void onBulkDownloadDoPdfIndividual?.(selected);
										}}
									>
										<Files className="mr-2 h-4 w-4" aria-hidden />
										Download individually
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>
			</div>
		)}
		</>
	);
}

export function useOutboundSummary() {
	const { data, isLoading } = usePurchaseOrders({ page: 1 });
	return { summary: data?.summary, isLoading };
}
