import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { requirePermission } from "@/lib/rbac";
import { formatDate, formatDateOnly } from "@/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
	STOCK_QUANTS_QUERY,
	type StockQuantsQueryData,
	type StockQuant,
	type StockQuantFilterInput,
} from "@/lib/graphql/stock-quant";

export const Route = createFileRoute("/admin/stock-quant")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: StockQuantComponent,
	head: () => ({
		meta: [
			{
				title: "Stock Quant - SME Edaran WMS",
				description: "View stock quant records by SKU and rack location.",
			},
		],
	}),
});

const PAGE_SIZE = 20;
const FILTER_ALL = "__all__";

/** Badge distinguishing loose-storage stock (loose units) from carton/pallet stock, by rack bin type. */
function StockTypeBadge({ rackBinType }: { rackBinType: string | null }) {
	if (rackBinType === "LOOSE_STORAGE") {
		return (
			<Badge
				variant="outline"
				className="border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
			>
				Loose
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="text-muted-foreground">
			CTN
		</Badge>
	);
}
/** Load enough rows to build SKU/rack filter options from actual stock quant data. */
const FILTER_OPTIONS_PAGE_SIZE = 5000;

function buildStockQuantFilter(
	selectedSkuId: string,
	selectedRackId: string,
): StockQuantFilterInput | undefined {
	const filter: StockQuantFilterInput = {};
	if (selectedSkuId !== FILTER_ALL) filter.skuId = selectedSkuId;
	if (selectedRackId !== FILTER_ALL) filter.rackId = selectedRackId;
	return Object.keys(filter).length > 0 ? filter : undefined;
}

function StockQuantComponent() {
	const [page, setPage] = useState(1);
	const [selectedSkuId, setSelectedSkuId] = useState(FILTER_ALL);
	const [selectedRackId, setSelectedRackId] = useState(FILTER_ALL);

	const filterOptionsVars = useMemo(
		() => ({
			pageSize: FILTER_OPTIONS_PAGE_SIZE,
			pageNumber: 1,
		}),
		[],
	);

	const { data: filterOptionsData, isLoading: filterOptionsLoading } = useQuery(
		{
			queryKey: [...qk.stockQuants.all, "filter-options"] as const,
			queryFn: () =>
				gqlRequest<StockQuantsQueryData>(
					STOCK_QUANTS_QUERY,
					filterOptionsVars,
				),
			staleTime: 0,
		},
	);

	const skuFilterOptions = useMemo(() => {
		const byId = new Map<string, { skuId: string; label: string }>();
		for (const row of filterOptionsData?.stockQuants?.query ?? []) {
			if (byId.has(row.skuId)) continue;
			const code = row.skuCode ?? row.skuId;
			const desc = row.description?.trim();
			byId.set(row.skuId, {
				skuId: row.skuId,
				label: desc ? `${code} — ${desc}` : code,
			});
		}
		return [...byId.values()].sort((a, b) =>
			a.label.localeCompare(b.label, undefined, { numeric: true }),
		);
	}, [filterOptionsData]);

	const rackFilterOptions = useMemo(() => {
		const byId = new Map<string, { rackId: string; label: string }>();
		for (const row of filterOptionsData?.stockQuants?.query ?? []) {
			if (byId.has(row.rackId)) continue;
			byId.set(row.rackId, {
				rackId: row.rackId,
				label: row.rackLabel ?? row.rackId,
			});
		}
		return [...byId.values()].sort((a, b) =>
			a.label.localeCompare(b.label, undefined, { numeric: true }),
		);
	}, [filterOptionsData]);

	const hasActiveFilters =
		selectedSkuId !== FILTER_ALL || selectedRackId !== FILTER_ALL;

	const queryVars = useMemo(() => {
		const filter = buildStockQuantFilter(selectedSkuId, selectedRackId);
		return {
			...(filter ? { filter } : {}),
			pageSize: PAGE_SIZE,
			pageNumber: page,
		};
	}, [selectedSkuId, selectedRackId, page]);

	const { data, isLoading: loading, isFetching } = useQuery({
		queryKey: qk.stockQuants.list(queryVars),
		queryFn: () =>
			gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, queryVars),
		staleTime: 0,
	});

	const items = data?.stockQuants?.query ?? [];
	const pagination = data?.stockQuants?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const totalCount = pagination?.totalCount ?? 0;
	const totalQuantity = Number(data?.stockQuants?.totalQuantity ?? "0");

	const [dateNow, setDateNow] = useState(new Date());

	useEffect(() => {
		const interval = setInterval(() => {
			setDateNow(new Date());
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	return (
		<main className="container mx-auto space-y-6 p-6" aria-busy={loading || isFetching}>
			<AdminPageHeader
				icon={Boxes}
				title="Stock Quant"
				description="Current stock quant records grouped by SKU and rack."
				titleId="stock-quant-page-title"
				descriptionId="stock-quant-page-description"
				rightSlot={
					<p className="text-sm text-muted-foreground tabular-nums">
						{formatDate(dateNow)}
					</p>
				}
			/>

			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-4">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Stock Quant List
							</CardTitle>
							<CardDescription>
								Track quantity, rack location, and latest update per stock quant row.
							</CardDescription>
						</div>
						<div className="grid w-full gap-2 sm:grid-cols-2">
							<div className="min-w-0">
								<Select
									value={selectedSkuId}
									onValueChange={(value) => {
										setSelectedSkuId(value);
										setPage(1);
									}}
								>
									<SelectTrigger
										className="w-full min-w-0"
										aria-label="Filter by SKU"
									>
										<SelectValue
											placeholder={
												filterOptionsLoading
													? "Loading SKUs..."
													: "All SKUs"
											}
										/>
									</SelectTrigger>
									<SelectContent position="popper" className="max-h-72">
										<SelectItem value={FILTER_ALL}>All SKUs</SelectItem>
										{skuFilterOptions.map((sku) => (
											<SelectItem
												key={sku.skuId}
												value={sku.skuId}
												textValue={sku.label}
											>
												{sku.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="min-w-0">
								<Select
									value={selectedRackId}
									onValueChange={(value) => {
										setSelectedRackId(value);
										setPage(1);
									}}
								>
									<SelectTrigger
										className="w-full min-w-0"
										aria-label="Filter by rack"
									>
										<SelectValue
											placeholder={
												filterOptionsLoading
													? "Loading racks..."
													: "All racks"
											}
										/>
									</SelectTrigger>
									<SelectContent position="popper" className="max-h-72">
										<SelectItem value={FILTER_ALL}>All racks</SelectItem>
										{rackFilterOptions.map((rack) => (
											<SelectItem
												key={rack.rackId}
												value={rack.rackId}
												textValue={rack.label}
											>
												<span className="font-mono">{rack.label}</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
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
									<TableHead>Rack</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Lot No</TableHead>
									<TableHead>Expiry</TableHead>
									<TableHead className="text-right">Quantity</TableHead>
									<TableHead>Last Updated</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && items.length === 0 ? (
									<TableRow>
										<TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
											Loading stock quant data...
										</TableCell>
									</TableRow>
								) : items.length === 0 ? (
									<TableRow>
										<TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
											{hasActiveFilters
												? "No stock quant records match the current filters."
												: "No stock quant records found."}
										</TableCell>
									</TableRow>
								) : (
									items.map((item: StockQuant) => (
										<TableRow key={item.id}>
											<TableCell className="font-mono text-xs">
												{item.skuCode ?? item.skuId}
											</TableCell>
											<TableCell className="max-w-[280px] truncate">
												{item.description || "—"}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{item.rackLabel ?? item.rackId}
											</TableCell>
											<TableCell>
												<StockTypeBadge rackBinType={item.rackBinType} />
											</TableCell>
											<TableCell className="font-mono text-xs">
												{item.lotNo?.trim() ? item.lotNo : "—"}
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{item.expiryDate
													? formatDateOnly(item.expiryDate)
													: "—"}
											</TableCell>
											<TableCell className="text-right font-medium">
												{Number(item.quantity ?? "0").toLocaleString()}
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{formatDate(item.updatedAt)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{(totalCount > 0 || hasActiveFilters) && (
						<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-1 text-xs text-muted-foreground">
								{totalCount > 0 && (
									<div>
										Showing{" "}
										<span className="font-medium">
											{(page - 1) * PAGE_SIZE + 1}
										</span>{" "}
										–{" "}
										<span className="font-medium">
											{Math.min(page * PAGE_SIZE, totalCount)}
										</span>{" "}
										of <span className="font-medium">{totalCount}</span> rows
									</div>
								)}
								<div>
									Total quantity
									{hasActiveFilters ? " (filtered)" : ""}:{" "}
									<span className="font-medium text-foreground">
										{totalQuantity.toLocaleString()}
									</span>
								</div>
							</div>
							{totalCount > 0 && (
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<Button
										variant="outline"
										size="icon"
										disabled={page <= 1}
										onClick={() => setPage((p) => Math.max(1, p - 1))}
										aria-label="Previous page"
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<span>
										Page {page} of {totalPages}
									</span>
									<Button
										variant="outline"
										size="icon"
										disabled={page >= totalPages}
										onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
										aria-label="Next page"
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
