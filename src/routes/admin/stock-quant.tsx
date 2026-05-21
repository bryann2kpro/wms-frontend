import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { formatRackLocationLabel } from "@/components/grn/rack-location-combobox";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
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
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import { SKUS_QUERY, type SkusQueryData } from "@/lib/graphql/skus";
import {
	STOCK_QUANTS_QUERY,
	type StockQuantsQueryData,
	type StockQuant,
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
const RACKS_PAGE_SIZE = 500;

function StockQuantComponent() {
	const [page, setPage] = useState(1);
	const [selectedSkuId, setSelectedSkuId] = useState(FILTER_ALL);
	const [selectedRackId, setSelectedRackId] = useState(FILTER_ALL);

	const racksVariables = { pageSize: RACKS_PAGE_SIZE, pageNumber: 1 };

	const { data: skusData, isLoading: skusLoading } = useQuery({
		queryKey: qk.skus.all,
		queryFn: () => gqlRequest<SkusQueryData>(SKUS_QUERY),
	});

	const { data: racksData, isLoading: racksLoading } = useQuery({
		queryKey: [...qk.racks.all, "list", racksVariables] as const,
		queryFn: () => gqlRequest<RacksQueryData>(RACKS_QUERY, racksVariables),
	});

	const skus = useMemo(
		() =>
			[...(skusData?.skus?.query ?? [])]
				.filter((sku) => sku.isActive)
				.sort((a, b) =>
					a.skuCode.localeCompare(b.skuCode, undefined, { numeric: true }),
				),
		[skusData],
	);

	const racks = useMemo(
		() =>
			[...(racksData?.racks?.query ?? [])].sort((a, b) =>
				formatRackLocationLabel(a).localeCompare(
					formatRackLocationLabel(b),
					undefined,
					{ numeric: true },
				),
			),
		[racksData],
	);

	const hasActiveFilters =
		selectedSkuId !== FILTER_ALL || selectedRackId !== FILTER_ALL;

	const queryVars = {
		filter: {
			...(selectedSkuId !== FILTER_ALL && { skuId: selectedSkuId }),
			...(selectedRackId !== FILTER_ALL && { rackId: selectedRackId }),
		},
		pageSize: PAGE_SIZE,
		pageNumber: page,
	};
	const { data, isLoading: loading } = useQuery({
		queryKey: qk.stockQuants.list(queryVars),
		queryFn: () =>
			gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, queryVars),
	});

	const items = data?.stockQuants?.query ?? [];
	const pagination = data?.stockQuants?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const totalCount = pagination?.totalCount ?? 0;
	const totalQuantity = Number(data?.stockQuants?.totalQuantity ?? "0");

	const selectedSku = skus.find((sku) => sku.skuId === selectedSkuId);
	const selectedRack = racks.find((rack) => rack.rackId === selectedRackId);

	return (
		<main className="container mx-auto space-y-6 p-6" aria-busy={loading}>
			<AdminPageHeader
				icon={Boxes}
				title="Stock Quant"
				description="Current stock quant records grouped by SKU and rack."
				titleId="stock-quant-page-title"
				descriptionId="stock-quant-page-description"
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
									disabled={skusLoading}
								>
									<SelectTrigger
										className="w-full min-w-0"
										aria-label="Filter by SKU"
									>
										<SelectValue
											placeholder={
												skusLoading ? "Loading SKUs..." : "All SKUs"
											}
										>
											{selectedSkuId === FILTER_ALL
												? undefined
												: (selectedSku?.skuCode ?? "All SKUs")}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={FILTER_ALL}>All SKUs</SelectItem>
										{skus.map((sku) => (
											<SelectItem key={sku.skuId} value={sku.skuId}>
												<span className="font-mono">{sku.skuCode}</span>
												{sku.skuDescription ? (
													<span className="text-muted-foreground">
														{" "}
														— {sku.skuDescription}
													</span>
												) : null}
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
									disabled={racksLoading}
								>
									<SelectTrigger
										className="w-full min-w-0"
										aria-label="Filter by rack"
									>
										<SelectValue
											placeholder={
												racksLoading ? "Loading racks..." : "All racks"
											}
										>
											{selectedRackId === FILTER_ALL
												? undefined
												: selectedRack
													? formatRackLocationLabel(selectedRack)
													: "All racks"}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={FILTER_ALL}>All racks</SelectItem>
										{racks.map((rack) => (
											<SelectItem key={rack.rackId} value={rack.rackId}>
												<span className="font-mono">
													{formatRackLocationLabel(rack)}
												</span>
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
									<TableHead>Lot No</TableHead>
									<TableHead className="text-right">Quantity</TableHead>
									<TableHead>Last Updated</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && items.length === 0 ? (
									<TableRow>
										<TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
											Loading stock quant data...
										</TableCell>
									</TableRow>
								) : items.length === 0 ? (
									<TableRow>
										<TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
											<TableCell className="font-mono text-xs">
												{item.lotNo?.trim() ? item.lotNo : "—"}
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
