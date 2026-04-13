import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@apollo/client/react";
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
	SKU_STOCK_DETAILS_QUERY,
	type SkuStockDetail,
	type SkuStockDetailsQueryData,
	type SkuStockDetailsQueryVariables,
} from "@/lib/graphql/stock-detail";
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

const STRATEGY_STYLES: Record<string, string> = {
	FIFO: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
	LIFO: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
	FEFO: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
};

function sortDetailsByStrategy(
	details: SkuStockDetail[],
	strategy: string,
): SkuStockDetail[] {
	const sorted = [...details];
	if (strategy === "FIFO") {
		sorted.sort((a, b) => {
			if (!a.firstInboundAt) return 1;
			if (!b.firstInboundAt) return -1;
			return new Date(a.firstInboundAt).getTime() - new Date(b.firstInboundAt).getTime();
		})
	} else if (strategy === "LIFO") {
		sorted.sort((a, b) => {
			if (!a.firstInboundAt) return 1;
			if (!b.firstInboundAt) return -1;
			return new Date(b.firstInboundAt).getTime() - new Date(a.firstInboundAt).getTime();
		})
	} else if (strategy === "FEFO") {
		sorted.sort((a, b) => {
			if (!a.expiryDate) return 1;
			if (!b.expiryDate) return -1;
			return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
		})
	}
	return sorted;
}

function rackLabel(detail: SkuStockDetail): string {
	if (!detail.rackRow && !detail.rackColumn && !detail.rackLevel) return "Unassigned";
	return `${detail.rackRow ?? "?"}–${detail.rackColumn ?? "?"}–${detail.rackLevel ?? "?"}`;
}

function InventoryDetailComponent() {
	const { skuId } = Route.useSearch();
	const navigate = useNavigate();

	const { data: balanceData, loading: balanceLoading } =
		useQuery<InventoryBalancesQueryData>(INVENTORY_BALANCES_QUERY, {
			variables: {
				filter: { skuId },
				pageSize: 1,
				pageNumber: 1,
			},
			fetchPolicy: "cache-and-network",
		})

	const { data: stockData, loading: stockLoading } =
		useQuery<SkuStockDetailsQueryData, SkuStockDetailsQueryVariables>(
			SKU_STOCK_DETAILS_QUERY,
			{
				variables: { skuId },
				fetchPolicy: "cache-and-network",
			},
		)

	const loading = balanceLoading || stockLoading;
	const balance = balanceData?.inventoryBalances?.query?.[0];
	const rawDetails = stockData?.skuStockDetails?.details ?? [];
	const pickingStrategy = balance?.pickingStrategy ?? "FIFO";
	const details = sortDetailsByStrategy(rawDetails, pickingStrategy);

	const onHand = Number(balance?.onHandQty ?? 0);
	const reserved = Number(balance?.reservedQty ?? 0);
	const loss = Number(balance?.lossQty ?? 0);
	const available = balance ? getAvailableQty(balance) : 0;

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
					onClick={() => navigate({ to: "/admin/inventory" })}
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

			{/* Batch & location breakdown */}
			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex items-center gap-2">
						<MapPin className="h-4 w-4 text-muted-foreground" />
						<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
							Batches by Location
						</CardTitle>
					</div>
					<CardDescription>
						Stock breakdown per lot and rack location, sorted by{" "}
						<span className="font-medium">{pickingStrategy}</span> picking order.
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
									<TableHead className="text-right">Loss</TableHead>
									<TableHead className="text-right">Available</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && details.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="h-24 text-center text-muted-foreground"
										>
											Loading stock details...
										</TableCell>
									</TableRow>
								) : details.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="h-24 text-center text-muted-foreground"
										>
											No batch or location data recorded for this SKU.
										</TableCell>
									</TableRow>
								) : (
									details.map((detail) => {
										const onHandQty = Number(detail.onHandQty);
										const lossQty = Math.max(0, Number(detail.lossQty));
										const reservedQty = Math.max(0, Number(detail.reservedQty));
										const availableQty = Math.max(0, onHandQty - reservedQty);
										const isOut = availableQty <= 0;
										return (
											<TableRow
												key={`${detail.lotNo ?? "no-lot"}-${detail.rackId ?? "no-rack"}-${detail.expiryDate ?? "no-exp"}`}
												className={isOut ? "bg-red-50/60 dark:bg-red-950/20" : undefined}
											>
												<TableCell className="font-mono text-xs font-semibold">
													{detail.lotNo ?? <span className="italic text-muted-foreground">N/A</span>}
												</TableCell>
												<TableCell>
													<span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium">
														<MapPin className="h-3 w-3 text-muted-foreground" aria-hidden />
														{rackLabel(detail)}
													</span>
												</TableCell>
												<TableCell className="text-right font-medium">
													{onHandQty.toLocaleString()}
												</TableCell>
												<TableCell className="text-right">
													{lossQty > 0 ? (
														<span className="font-medium text-amber-600 dark:text-amber-400">
															{lossQty.toLocaleString()}
														</span>
													) : <span className="text-muted-foreground">0</span>}
												</TableCell>
												<TableCell className="text-right font-semibold">
													{isOut ? (
														<span className="text-red-600 dark:text-red-400">0</span>
													) : (
														availableQty.toLocaleString()
													)}
												</TableCell>
											</TableRow>
										)
									})
								)}
							</TableBody>
						</Table>
					</div>
					{details.length > 0 && (
						<p className="mt-3 text-xs text-muted-foreground">
							{details.length} batch{details.length !== 1 ? "es" : ""} across{" "}
							{new Set(details.map((d) => d.rackId).filter(Boolean)).size} rack location{new Set(details.map((d) => d.rackId).filter(Boolean)).size !== 1 ? "s" : ""}
						</p>
					)}
				</CardContent>
			</Card>
		</main>
	)
}
