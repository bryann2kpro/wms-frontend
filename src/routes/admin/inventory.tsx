import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@apollo/client/react";
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
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Search, ChevronLeft, ChevronRight, Boxes, AlertTriangle, Eye, Activity } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	INVENTORY_BALANCES_QUERY,
	getAvailableQty,
	type InventoryBalance,
	type InventoryBalancesQueryData,
} from "@/lib/graphql/inventory-balance";
import {
	UPDATE_SKUS_MUTATION,
	type UpdateSkusMutationData,
	type UpdateSkusMutationVariables,
} from "@/lib/graphql/skus";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/inventory")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: InventoryComponent,
	head: () => ({
		meta: [
			{
				title: "Inventory - SME Edaran WMS",
				description:
					"Monitor real-time stock levels, on-hand quantities, and reserved stock for all SKUs.",
			},
		],
	}),
});

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 20;
// Fetch all records in one shot when low-stock filter is active so client-side
// pagination covers the full dataset, not just one server page.
const ALL_ITEMS_PAGE_SIZE = 9999;
const DEFAULT_LOW_STOCK_THRESHOLD = 20;

function InventoryComponent() {
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const [lowStockOnly, setLowStockOnly] = useState(false);
	const [lowStockPage, setLowStockPage] = useState(1);
	const [lowStockThreshold, setLowStockThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);

	// Normal paginated query — used when low-stock filter is off.
	const { data: pagedData, loading: pagedLoading } =
		useQuery<InventoryBalancesQueryData>(INVENTORY_BALANCES_QUERY, {
			variables: {
				filter: { search: debouncedSearch.trim() || undefined },
				pageSize: PAGE_SIZE,
				pageNumber: page,
			},
			skip: lowStockOnly,
			fetchPolicy: "cache-and-network",
		});

	// Full-fetch query — used when low-stock filter is on, fetches everything so
	// client-side filtering + pagination covers the entire dataset.
	const { data: fullData, loading: fullLoading } =
		useQuery<InventoryBalancesQueryData>(INVENTORY_BALANCES_QUERY, {
			variables: {
				filter: { search: debouncedSearch.trim() || undefined },
				pageSize: ALL_ITEMS_PAGE_SIZE,
				pageNumber: 1,
			},
			skip: !lowStockOnly,
			fetchPolicy: "cache-and-network",
		});

	const loading = lowStockOnly ? fullLoading : pagedLoading;

	const isOutOfStock = (item: InventoryBalance) => getAvailableQty(item) <= 0;
	const hasReserved = (item: InventoryBalance) =>
		Number(item.reservedQty ?? "0") > 0;
	const isLowStock = (item: InventoryBalance) =>
		getAvailableQty(item) <= lowStockThreshold;

	// Derive display items + pagination info depending on active mode.
	const serverItems = pagedData?.inventoryBalances?.query ?? [];
	const serverPagination = pagedData?.inventoryBalances?.pagination;

	const allFetchedItems = fullData?.inventoryBalances?.query ?? [];
	const lowStockItems = allFetchedItems.filter(isLowStock);
	const lowStockTotalPages = Math.max(1, Math.ceil(lowStockItems.length / PAGE_SIZE));
	const lowStockPageItems = lowStockItems.slice(
		(lowStockPage - 1) * PAGE_SIZE,
		lowStockPage * PAGE_SIZE,
	);

	// The count badge always reflects the full dataset when available.
	const lowStockCount = lowStockOnly
		? lowStockItems.length
		: (allFetchedItems.length > 0
				? allFetchedItems.filter(isLowStock).length
				: serverItems.filter(isLowStock).length);

	const items = lowStockOnly ? lowStockPageItems : serverItems;
	const totalPages = lowStockOnly ? lowStockTotalPages : (serverPagination?.totalPages ?? 1);
	const currentPage = lowStockOnly ? lowStockPage : page;
	const totalCount = lowStockOnly ? lowStockItems.length : (serverPagination?.totalCount ?? 0);

	const handlePageChange = (next: number) => {
		if (lowStockOnly) {
			setLowStockPage(next);
		} else {
			setPage(next);
		}
	};

	const [updateSku, { loading: updatingStrategy }] = useMutation<
		UpdateSkusMutationData,
		UpdateSkusMutationVariables
	>(UPDATE_SKUS_MUTATION, {
		refetchQueries: [INVENTORY_BALANCES_QUERY],
	});

	const [updatingSkuId, setUpdatingSkuId] = useState<string | null>(null);

	const handleStrategyChange = async (skuId: string, strategy: string) => {
		setUpdatingSkuId(skuId);
		try {
			await updateSku({
				variables: { id: skuId, input: { pickingStrategy: strategy } },
			});
			toast.success("Picking strategy updated");
		} catch {
			toast.error("Failed to update picking strategy");
		} finally {
			setUpdatingSkuId(null);
		}
	};

	const STRATEGY_STYLES: Record<string, string> = {
		FIFO: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
		LIFO: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
		FEFO: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
	};

	return (
		<main
			className="inventory-page container mx-auto p-6 space-y-6"
			aria-labelledby="inventory-page-title"
			aria-describedby="inventory-page-description"
			aria-busy={loading}
		>
			<AdminPageHeader
				icon={Boxes}
				title="Inventory"
				description="Real-time on-hand stock levels and reserved quantities for all SKUs."
				titleId="inventory-page-title"
				descriptionId="inventory-page-description"
			/>

			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Stock Balances
							</CardTitle>
							<CardDescription>
								Search by SKU code or description. Available = On Hand − Reserved.
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							{lowStockOnly && (
								<div className="flex items-center gap-1.5">
									<label
										htmlFor="low-stock-threshold"
										className="text-xs text-muted-foreground whitespace-nowrap"
									>
										Threshold ≤
									</label>
									<Input
										id="low-stock-threshold"
										type="number"
										min={0}
										value={lowStockThreshold}
										onChange={(e) => {
										setLowStockThreshold(Number(e.target.value));
										setLowStockPage(1);
									}}
										className="w-20 h-9"
									/>
								</div>
							)}
							<Button
								variant={lowStockOnly ? "default" : "outline"}
								size="sm"
								onClick={() => {
									setLowStockOnly((v) => !v);
									setPage(1);
									setLowStockPage(1);
								}}
								className={
									lowStockOnly
										? "gap-2 text-white"
										: "gap-2"
								}
								style={
									lowStockOnly
										? { background: "var(--dashboard-accent)", borderColor: "var(--dashboard-accent)" }
										: undefined
								}
								aria-pressed={lowStockOnly}
							>
								<AlertTriangle className="h-4 w-4" aria-hidden />
								Low Stock
								{lowStockCount > 0 && (
									<span
										className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
											lowStockOnly
												? "bg-white/20 text-white"
												: "bg-red-500/15 text-red-600"
										}`}
									>
										{lowStockCount}
									</span>
								)}
							</Button>
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search SKU code or description..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
										setLowStockPage(1);
									}}
									className="pl-9 sm:w-64"
									aria-label="Search SKUs"
								/>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>SKU Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Strategy</TableHead>
									<TableHead>Expiry Date</TableHead>
									<TableHead className="text-right">On Hand</TableHead>
									<TableHead className="text-right">Reserved</TableHead>
									<TableHead className="text-right">Available</TableHead>
									<TableHead>Unit</TableHead>
									<TableHead>Last Updated</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-center">View</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && items.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={11}
											className="h-24 text-center text-muted-foreground"
										>
											Loading inventory...
										</TableCell>
									</TableRow>
								) : items.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={11}
											className="h-24 text-center text-muted-foreground"
										>
											{lowStockOnly
												? `No SKUs with available quantity ≤ ${lowStockThreshold}.`
												: "No inventory records found."}
										</TableCell>
									</TableRow>
								) : (
									items.map((item) => {
										const available = getAvailableQty(item);
										const outOfStock = isOutOfStock(item);
										const reserved = hasReserved(item);
										return (
											<TableRow
												key={item.id}
												className={`${
													outOfStock
														? "bg-red-50/60 dark:bg-red-950/20"
														: reserved
															? "bg-amber-50/40 dark:bg-amber-950/10"
															: ""
												}`}
											>
												<TableCell className="font-mono text-xs font-semibold">
													{item.skuCode}
												</TableCell>
												<TableCell className="max-w-[220px] truncate">
													{item.skuDescription}
												</TableCell>
												<TableCell>
													<Select
														value={item.pickingStrategy}
														onValueChange={(val) =>
															handleStrategyChange(item.skuId, val)
														}
														disabled={updatingSkuId === item.skuId || updatingStrategy}
													>
														<SelectTrigger
															className="h-7 w-[82px] border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0"
															aria-label={`Picking strategy for ${item.skuCode}`}
														>
															<SelectValue>
																<Badge
																	variant="outline"
																	className={
																		STRATEGY_STYLES[item.pickingStrategy] ??
																		"bg-muted text-muted-foreground"
																	}
																>
																	{updatingSkuId === item.skuId ? "…" : item.pickingStrategy}
																</Badge>
															</SelectValue>
														</SelectTrigger>
														<SelectContent>
															{["FIFO", "LIFO", "FEFO"].map((s) => (
																<SelectItem key={s} value={s}>
																	<Badge
																		variant="outline"
																		className={STRATEGY_STYLES[s]}
																	>
																		{s}
																	</Badge>
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</TableCell>
												<TableCell className="text-xs text-muted-foreground">
													{item.skuExpiryDate
														? formatDate(item.skuExpiryDate)
														: <span className="italic">—</span>}
												</TableCell>
												<TableCell className="text-right font-medium">
													{Number(item.onHandQty).toLocaleString()}
												</TableCell>
												<TableCell className="text-right">
													{reserved ? (
														<span className="font-medium text-amber-600 dark:text-amber-400">
															{Number(item.reservedQty).toLocaleString()}
														</span>
													) : (
														<span className="text-muted-foreground">0</span>
													)}
												</TableCell>
												<TableCell className="text-right font-semibold">
													{outOfStock ? (
														<span className="text-red-600 dark:text-red-400">
															0
														</span>
													) : (
														available.toLocaleString()
													)}
												</TableCell>
												<TableCell className="text-xs text-muted-foreground">
													{item.unitCode ?? "—"}
												</TableCell>
												<TableCell className="text-xs text-muted-foreground whitespace-nowrap">
													{formatDate(item.updatedAt)}
												</TableCell>
												<TableCell>
													{outOfStock ? (
														<Badge
															variant="outline"
															className="bg-red-500/10 text-red-600 border-red-500/20"
														>
															Out of Stock
														</Badge>
													) : reserved ? (
														<Badge
															variant="outline"
															className="bg-amber-500/10 text-amber-600 border-amber-500/20"
														>
															Partially Reserved
														</Badge>
													) : (
														<Badge
															variant="outline"
															className="bg-green-500/10 text-green-600 border-green-500/20"
														>
															Available
														</Badge>
													)}
												</TableCell>
												<TableCell
													className="text-right"
													onClick={(e) => e.stopPropagation()}
												>
													<div className="flex items-center justify-end gap-1">
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-7 w-7 opacity-60 hover:opacity-100"
															aria-label={`View movements for ${item.skuCode}`}
															onClick={() =>
																navigate({
																	to: "/admin/sku-movement",
																	search: { skuId: item.skuId },
																})
															}
														>
															<Activity className="h-3.5 w-3.5" />
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-7 w-7 opacity-60 hover:opacity-100"
															aria-label={`View details for ${item.skuCode}`}
															onClick={() =>
																navigate({
																	to: "/admin/inventory-detail",
																	search: { skuId: item.skuId },
																})
															}
														>
															<Eye className="h-3.5 w-3.5" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>

					{totalCount > 0 && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								Showing{" "}
								<span className="font-medium">
									{(currentPage - 1) * PAGE_SIZE + 1}
								</span>{" "}
								–{" "}
								<span className="font-medium">
									{Math.min(currentPage * PAGE_SIZE, totalCount)}
								</span>{" "}
								of <span className="font-medium">{totalCount}</span>{" "}
								{lowStockOnly ? "low stock" : ""} SKUs
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={currentPage === 1}
									onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
									aria-label="Previous page"
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span>
									Page {currentPage} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={currentPage >= totalPages}
									onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
									aria-label="Next page"
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
