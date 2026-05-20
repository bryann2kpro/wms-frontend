import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
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

function StockQuantComponent() {
	const [page, setPage] = useState(1);

	const { data, loading } = useQuery<StockQuantsQueryData>(STOCK_QUANTS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
		},
		fetchPolicy: "cache-and-network",
	});

	const items = data?.stockQuants?.query ?? [];
	const pagination = data?.stockQuants?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const totalCount = pagination?.totalCount ?? 0;

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
					<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Stock Quant List
					</CardTitle>
					<CardDescription>
						Track quantity, rack location, and latest update per stock quant row.
					</CardDescription>
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
											No stock quant records found.
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

					{totalCount > 0 && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
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
							<div className="flex items-center gap-2">
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
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
