import { useState, useMemo, useEffect } from "react";
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
	Download,
	Loader2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
	usePurchaseOrders,
	type PurchaseOrderStatusFilter,
} from "@/lib/hooks/use-purchase-orders";

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
	/** Download PDFs for all selected rows (sequential). */
	onBulkDownloadDoPdf?: (
		purchaseOrders: PurchaseOrderDetail[],
	) => void | Promise<void>;
	isBulkDoPdfPending?: boolean;
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
	isBulkDoPdfPending,
	initialStatusFilter,
}: OutboundListCardProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<PurchaseOrderStatusFilter>("ALL");
	const [regionFilter, setRegionFilter] = useState<string>("ALL");
	const [activeTab, setActiveTab] = useState<DeliveryTab>("current-week");
	const [selectedDoIds, setSelectedDoIds] = useState<Set<string>>(new Set());

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

	const { data, isLoading, isFetching, error, refetch } = usePurchaseOrders({
		searchTerm,
		statusFilter,
		regionFilter,
		activeTab,
		page: 1,
	});
	const { data: regionData } = usePurchaseOrders({
		activeTab,
		page: 1,
		regionFilter: "ALL",
	});

	const purchaseOrdersByDate = data?.purchaseOrdersByDate ?? {};
	const allDateKeys = data?.paginatedDateKeys ?? [];
	const dateKeys = data?.dateKeys ?? [];

	const paginatedDateKeys = allDateKeys;

	const visiblePurchaseOrders = useMemo(
		() => paginatedDateKeys.flatMap((dk) => purchaseOrdersByDate[dk] ?? []),
		[paginatedDateKeys, purchaseOrdersByDate],
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

	useEffect(() => {
		setSelectedDoIds(new Set());
	}, [activeTab, statusFilter, searchTerm, regionFilter]);

	useEffect(() => {
		setRegionFilter("ALL");
	}, [activeTab, statusFilter, searchTerm]);

	const loading = isLoading || isFetching;
	const weekRangeLabel =
		activeTab === "current-week" && dateKeys.length > 0
			? formatWeekRange(dateKeys[0], dateKeys[dateKeys.length - 1])
			: null;

	const showRowPdfDownload = Boolean(onDownloadDoPdf);
	const showBulkPdf = Boolean(onBulkDownloadDoPdf);
	const tableColCount = 7 + (showBulkPdf ? 1 : 0);

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

	return (
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
							{/* <div
								className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30 px-3 py-1.5"
								title="Testing mode: show all scheduled dates, not just today"
							>
								<FlaskConical className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
								<span className="text-xs font-medium text-amber-700 select-none">Testing</span>
								<Switch
									id="testing-mode-toggle"
									checked={isTesting}
									onCheckedChange={setIsTesting}
									aria-label="Toggle testing mode to show all scheduled dates"
									className="data-[state=checked]:bg-amber-500"
								/>
							</div> */}
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
					{showBulkPdf && selectedDoIds.size > 0 ? (
						<div
							className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/40 px-4 py-3"
							role="status"
							aria-live="polite"
						>
							<span
								className="text-sm text-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{selectedDoIds.size}{" "}
								{selectedDoIds.size === 1 ? "order" : "orders"} selected for
								bulk DO PDF
							</span>
							<Button
								type="button"
								size="sm"
								disabled={isBulkDoPdfPending}
								className="gap-2 rounded-lg text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
								style={{
									background: "var(--dashboard-accent)",
									borderColor: "var(--dashboard-accent)",
								}}
								onClick={() => {
									const selected = selectableWithDo.filter((p) =>
										selectedDoIds.has(p.deliveryOrder.id),
									);
									void onBulkDownloadDoPdf?.(selected);
								}}
							>
								{isBulkDoPdfPending ? (
									<>
										<Loader2
											className="h-4 w-4 animate-spin shrink-0"
											aria-hidden
										/>
										Downloading PDFs…
									</>
								) : (
									<>
										<Download className="h-4 w-4 shrink-0" aria-hidden />
										Download DO PDFs
									</>
								)}
							</Button>
						</div>
					) : null}
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
					<Table aria-label="Purchase orders list">
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								{showBulkPdf ? (
									<TableHead scope="col" className="w-12 px-3">
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
											disabled={
												selectableIds.length === 0 || isBulkDoPdfPending
											}
											aria-label="Select all delivery orders in this list for bulk PDF download"
										/>
									</TableHead>
								) : null}
								<TableHead scope="col" className="px-6">
									PO Number
								</TableHead>
								<TableHead scope="col" className="px-6">
									Outlet
								</TableHead>
								<TableHead scope="col" className="px-6">
									Region
								</TableHead>
								<TableHead scope="col" className="px-6">
									PO Status
								</TableHead>
								<TableHead scope="col" className="px-6">
									DO Status
								</TableHead>
								<TableHead scope="col" className="px-6">
									NetSuite (API)
								</TableHead>
								<TableHead scope="col" className="px-6 text-right">
									Actions
								</TableHead>
							</TableRow>
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
											{showBulkPdf ? (
												<TableCell className="px-3">
													<Skeleton className="h-4 w-4 rounded" />
												</TableCell>
											) : null}
											<TableCell className="px-6">
												<Skeleton className="h-5 w-24" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-32" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-20" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-16" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-20" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-12" />
											</TableCell>
											<TableCell className="px-6 text-right">
												<Skeleton className="h-8 w-20 ml-auto" />
											</TableCell>
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
										<div className="flex flex-col items-center gap-4">
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
							) : paginatedDateKeys.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={tableColCount}
										className="px-6 py-12 text-center"
										role="status"
									>
										<div className="flex flex-col items-center gap-3">
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
							) : (
								paginatedDateKeys.flatMap((dateKey) => {
									const datePurchaseOrders =
										purchaseOrdersByDate[dateKey] ?? [];
									const deliveryDate = new Date(dateKey + "T12:00:00");
									const headerLabel = formatDeliveryDateHeader(deliveryDate);
									return [
										<TableRow
											key={dateKey}
											className="hover:bg-transparent bg-muted/50 border-l-4 border-l-primary/30"
										>
											<TableCell
												colSpan={tableColCount}
												className="px-6 font-semibold text-foreground py-3"
											>
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
											</TableCell>
										</TableRow>,
										...(datePurchaseOrders.length === 0
											? [
													<TableRow key={`${dateKey}-empty`}>
														<TableCell
															colSpan={tableColCount}
															className="px-6 py-4 text-center text-sm text-muted-foreground italic"
														>
															No orders for this day
														</TableCell>
													</TableRow>,
												]
											: []),
										...datePurchaseOrders.map((purchaseOrder) => {
											const deliveryOrderStatus =
												purchaseOrder.deliveryOrder?.status ?? "";
											const isAwaitingPicking = [
												"NEW",
												"CREATED",
												"PICKING",
											].includes(deliveryOrderStatus);
											return (
												<TableRow
													key={purchaseOrder.id}
													className="transition-colors hover:bg-muted/50"
												>
													{showBulkPdf ? (
														<TableCell className="w-12 px-3 align-middle">
															{purchaseOrder.deliveryOrder?.id ? (
																<Checkbox
																	checked={selectedDoIds.has(
																		purchaseOrder.deliveryOrder.id,
																	)}
																	onCheckedChange={(c) => {
																		const id = purchaseOrder.deliveryOrder?.id;
																		if (!id) return;
																		setSelectedDoIds((prev) => {
																			const next = new Set(prev);
																			if (c === true) next.add(id);
																			else next.delete(id);
																			return next;
																		});
																	}}
																	disabled={isBulkDoPdfPending}
																	aria-label={`Select ${purchaseOrder.purchaseOrderNumber} for bulk DO PDF download`}
																/>
															) : (
																<span className="text-muted-foreground/50">
																	—
																</span>
															)}
														</TableCell>
													) : null}
													<TableCell className="px-6 font-medium">
														{purchaseOrder.purchaseOrderNumber}
													</TableCell>
													<TableCell className="px-6">
														{purchaseOrder.toLocation}
													</TableCell>
													<TableCell className="px-6">
														{purchaseOrder.regionName ? (
															<div className="flex flex-col">
																<span>
																	{purchaseOrder.regionName}
																	{purchaseOrder.regionCode
																		? ` (${purchaseOrder.regionCode})`
																		: ""}
																</span>
															</div>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="px-6">
														<Badge
															variant="outline"
															className={getStatusColor(purchaseOrder.status)}
														>
															{formatStatus(purchaseOrder.status)}
														</Badge>
													</TableCell>
													<TableCell className="px-6">
														{purchaseOrder.deliveryOrder ? (
															<div className="flex items-center gap-2">
																<Badge
																	variant="outline"
																	className={getDeliveryOrderStepStatusColor(
																		purchaseOrder.deliveryOrder.status,
																	)}
																>
																	{formatDeliveryOrderStepStatus(
																		purchaseOrder.deliveryOrder.status,
																	)}
																</Badge>
																{isAwaitingPicking ? (
																	<span className="text-xs text-muted-foreground italic">
																		Awaiting picking
																	</span>
																) : onAdvanceStep &&
																	deliveryOrderStatus === "PACKING" &&
																	dateKey === todayKey ? (
																	<Button
																		variant="outline"
																		size="sm"
																		className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
																		onClick={() => onAdvanceStep(purchaseOrder)}
																		disabled={
																			isAdvanceStepPending &&
																			advancingDeliveryOrderId ===
																				purchaseOrder.deliveryOrder?.id
																		}
																		aria-label={`Mark ${purchaseOrder.purchaseOrderNumber} to next step`}
																	>
																		{isAdvanceStepPending &&
																		advancingDeliveryOrderId ===
																			purchaseOrder.deliveryOrder?.id
																			? "Updating…"
																			: "Next step"}
																		<ChevronRight className="ml-1 h-4 w-4" />
																	</Button>
																) : null}
															</div>
														) : (
															<span className="text-muted-foreground text-sm">
																—
															</span>
														)}
													</TableCell>
													<TableCell className="px-6">
														<Badge
															variant="outline"
															className={getNetSuiteStatusColor(
																purchaseOrder.netsuiteStatus,
															)}
														>
															{purchaseOrder.netsuiteStatus || "N/A"}
														</Badge>
													</TableCell>
													<TableCell className="px-6 text-right">
														<div
															className="flex justify-end gap-1"
															role="group"
															aria-label={`Actions for ${purchaseOrder.purchaseOrderNumber}`}
														>
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	onViewPurchaseOrder(purchaseOrder)
																}
																className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
																aria-label={`View details for ${purchaseOrder.purchaseOrderNumber}`}
															>
																<Eye className="h-4 w-4" aria-hidden="true" />
															</Button>
															{showRowPdfDownload &&
															purchaseOrder.deliveryOrder?.id ? (
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
																		onClick={() =>
																			onAcceptClick?.(purchaseOrder)
																		}
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
													</TableCell>
												</TableRow>
											);
										}),
									];
								})
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

export function useOutboundSummary() {
	const { data, isLoading } = usePurchaseOrders({ page: 1 });
	return { summary: data?.summary, isLoading };
}
