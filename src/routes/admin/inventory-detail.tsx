import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { ChevronLeft, Boxes, MapPin } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	INVENTORY_BALANCES_QUERY,
	getAvailableQty,
	type InventoryBalancesQueryData,
} from "@/lib/graphql/inventory-balance";
import {
	STOCK_QUANTS_QUERY,
	sortStockQuantsByPickingStrategy,
	type StockQuant,
	type StockQuantsQueryData,
} from "@/lib/graphql/stock-quant";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/admin/inventory-detail")({
	validateSearch: (search: Record<string, unknown>) => ({
		skuId: (search.skuId as string) ?? "",
	}),
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: InventoryDetailComponent,
	head: () => ({
		meta: [
			{
				title: "Stock Detail - SME Edaran WMS",
				description:
					"Per-batch, per-location stock breakdown for a SKU.",
			},
		],
	}),
});

const STOCK_QUANTS_PAGE_SIZE = 10;

/** Inventory/stock quant pages must always reflect current DB state. */
const LIVE_STOCK_QUERY_OPTIONS = {
	staleTime: 0,
	refetchOnMount: "always" as const,
};

const STRATEGY_STYLES: Record<string, string> = {
	FIFO: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
	LIFO: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
	FEFO: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
};

function formatRackLabel(row: StockQuant): string {
	if (row.rackLabel?.trim()) return row.rackLabel;
	return "Unassigned";
}

function InventoryDetailComponent() {
	const { skuId } = Route.useSearch();
	const navigate = useNavigate();

	const balanceVars = {
		filter: { skuId },
		pageSize: 1,
		pageNumber: 1,
	};

	const stockQuantVars = {
		filter: { skuId },
		pageSize: STOCK_QUANTS_PAGE_SIZE,
		pageNumber: 1,
	};

	const { data: stockQuantData, isLoading: stockQuantLoading } = useQuery({
		queryKey: qk.stockQuants.list(stockQuantVars),
		queryFn: () =>
			gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, stockQuantVars),
		enabled: !!skuId,
		...LIVE_STOCK_QUERY_OPTIONS,
	});

	const { data: balanceData, isLoading: balanceLoading } = useQuery({
		queryKey: qk.inventory.list(balanceVars),
		queryFn: () =>
			gqlRequest<InventoryBalancesQueryData>(
				INVENTORY_BALANCES_QUERY,
				balanceVars,
			),
		enabled: !!skuId,
		...LIVE_STOCK_QUERY_OPTIONS,
	});

	const loading = balanceLoading || stockQuantLoading;
	const balance = balanceData?.inventoryBalances?.query?.[0];
	const pickingStrategy = balance?.pickingStrategy ?? "FIFO";
	const stockQuants = sortStockQuantsByPickingStrategy(
		(stockQuantData?.stockQuants?.query ?? []).filter(
			(row) => Number(row.quantity ?? "0") > 0,
		),
		pickingStrategy,
	);

	const onHand = Number(balance?.onHandQty ?? 0);
	const reserved = Number(balance?.reservedQty ?? 0);
	const loss = Number(balance?.lossQty ?? 0);
	const available = balance ? getAvailableQty(balance) : 0;
	const totalStockQuantQty = stockQuants.reduce(
		(sum, row) => sum + Number(row.quantity ?? "0"),
		0,
	);

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="stock-detail-title"
			aria-busy={loading}
		>
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/admin/inventory", search: { tab: "inventory" } })}
					aria-label="Back to inventory"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<AdminPageHeader
					icon={Boxes}
					title={balance ? `${balance.skuCode}` : "Stock Detail"}
					description={balance?.skuDescription ?? "Loading..."}
					titleId="stock-detail-title"
					descriptionId="stock-detail-description"
				/>
			</div>

			{/* Summary card */}
			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
						<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
							Stock Summary
						</CardTitle>
						{balance && (
							<Badge
								variant="outline"
								className={
									STRATEGY_STYLES[balance.pickingStrategy] ??
									"bg-muted text-muted-foreground"
								}
							>
								{balance.pickingStrategy}
							</Badge>
						)}
					</div>
					<CardDescription>
						Aggregate quantities for this SKU. Available = On Hand − Reserved.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div className="rounded-lg border p-4">
							<p className="text-xs text-muted-foreground">On Hand</p>
							<p className="mt-1 text-2xl font-bold">{onHand.toLocaleString()}</p>
						</div>
						<div className="rounded-lg border p-4">
							<p className="text-xs text-muted-foreground">Reserved</p>
							<p className={`mt-1 text-2xl font-bold ${reserved > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
								{reserved.toLocaleString()}
							</p>
						</div>
						<div className="rounded-lg border p-4">
							<p className="text-xs text-muted-foreground">Available</p>
							<p className={`mt-1 text-2xl font-bold ${available <= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
								{available.toLocaleString()}
							</p>
						</div>
						<div className="rounded-lg border p-4">
							<p className="text-xs text-muted-foreground">Loss / Damaged</p>
							<p className="mt-1 text-2xl font-bold text-muted-foreground">
								{loss.toLocaleString()}
							</p>
						</div>
					</div>
					{balance?.unitCode && (
						<p className="mt-3 text-xs text-muted-foreground">
							Unit: <span className="font-medium">{balance.unitCode}{balance.unitName ? ` (${balance.unitName})` : ""}</span>
						</p>
					)}
					{balance?.skuExpiryDate && (
						<p className="mt-1 text-xs text-muted-foreground">
							Default Expiry: <span className="font-medium">{formatDate(balance.skuExpiryDate)}</span>
						</p>
					)}
					{balance?.updatedAt && (
						<p className="mt-1 text-xs text-muted-foreground">
							Last updated: <span className="font-medium">{formatDate(balance.updatedAt)}</span>
						</p>
					)}
				</CardContent>
			</Card>

			{/* Stock quant breakdown */}
			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex items-center gap-2">
						<MapPin className="h-4 w-4 text-muted-foreground" />
						<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
							Batches by Location
						</CardTitle>
					</div>
					<CardDescription>
						Physical stock from the stock quant ledger, ordered by {pickingStrategy}{" "}
						picking strategy. Available = On Hand − Reserved.
					</CardDescription>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Lot No</TableHead>
									<TableHead>Rack Location</TableHead>
									<TableHead className="text-right">On Hand</TableHead>
									<TableHead className="text-right">Reserved</TableHead>
									<TableHead className="text-right">Available</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && stockQuants.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="h-24 text-center text-muted-foreground"
										>
											Loading stock details...
										</TableCell>
									</TableRow>
								) : stockQuants.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="h-24 text-center text-muted-foreground"
										>
											No stock quant records found for this SKU.
										</TableCell>
									</TableRow>
								) : (
									stockQuants.map((row) => {
										const onHandQty = Number(row.quantity ?? "0");
										const reservedQty = Number(row.reservedQty ?? "0");
										const availableQty = onHandQty - reservedQty;
										return (
											<TableRow key={row.id}>
												<TableCell className="font-mono text-xs font-semibold">
													{row.lotNo?.trim() ? (
														row.lotNo
													) : (
														<span className="italic text-muted-foreground">N/A</span>
													)}
												</TableCell>
												<TableCell>
													<span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium">
														<MapPin className="h-3 w-3 text-muted-foreground" aria-hidden />
														{formatRackLabel(row)}
													</span>
												</TableCell>
												<TableCell className="text-right font-medium">
													{onHandQty.toLocaleString()}
												</TableCell>
												<TableCell className={`text-right ${reservedQty > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
													{reservedQty.toLocaleString()}
												</TableCell>
												<TableCell className="text-right font-semibold">
													{availableQty.toLocaleString()}
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
					{stockQuants.length > 0 && (
						<p className="mt-3 text-xs text-muted-foreground">
							{stockQuants.length} row{stockQuants.length !== 1 ? "s" : ""} across{" "}
							{new Set(stockQuants.map((row) => row.rackId)).size} rack location
							{new Set(stockQuants.map((row) => row.rackId)).size !== 1 ? "s" : ""}
							{" · "}
							Total on hand: {totalStockQuantQty.toLocaleString()}
						</p>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
