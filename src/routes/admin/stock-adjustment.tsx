import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	ClipboardList,
	Eye,
	Plus,
	Search,
} from "lucide-react";
import { useState } from "react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StockAdjustmentFormDialog } from "@/components/stock-adjustment/stock-adjustment-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	STOCK_ADJUSTMENTS_QUERY,
	type StockAdjustment,
	type StockAdjustmentsQueryData,
} from "@/lib/graphql/stock-adjustment";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { requirePermission } from "@/lib/rbac";
import { formatDate, formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/admin/stock-adjustment")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: StockAdjustmentComponent,
	head: () => ({
		meta: [
			{
				title: "Stock Adjustment - SME Edaran WMS",
				description:
					"Review, create, and track inventory stock adjustment requests with approval visibility.",
			},
		],
	}),
});

const SEARCH_DEBOUNCE_MS = 350;

function StockAdjustmentComponent() {
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [viewAdj, setViewAdj] = useState<StockAdjustment | null>(null);

	const queryVars = {
		filter: {
			search: debouncedSearch.trim() || undefined,
			sortBy: "CREATED_AT",
			sortOrder: "DESC",
		},
		pageSize,
		pageNumber: page,
	};
	const {
		data: queryData,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: qk.stockAdjustments.list(queryVars),
		queryFn: () =>
			gqlRequest<StockAdjustmentsQueryData>(STOCK_ADJUSTMENTS_QUERY, queryVars),
	});

	const adjustments = queryData?.stockAdjustments?.query ?? [];
	const pagination = queryData?.stockAdjustments?.pagination;
	const totalPages = pagination?.totalPages ?? 1;

	return (
		<main
			className="stock-adjustment-page container mx-auto p-6 space-y-6"
			aria-labelledby="stock-adjustment-page-title"
			aria-describedby="stock-adjustment-page-description"
			aria-busy={loading}
		>
			<AdminPageHeader
				icon={ClipboardList}
				title="Stock Adjustments"
				description="Adjust inventory quantities for count corrections and damaged items."
				titleId="stock-adjustment-page-title"
				descriptionId="stock-adjustment-page-description"
			/>

			<Card className="dashboard-card" style={{ animationDelay: "0ms" }}>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Adjustment records
							</CardTitle>
							<CardDescription>
								Search by adjustment number and open an adjustment to review
								line items
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
							<div className="relative flex-1 sm:flex-initial sm:w-64 max-w-md">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search by adjustment number..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 w-full"
								/>
							</div>
							<Button
								type="button"
								className="gap-2 text-white shrink-0 disabled:opacity-50"
								style={{
									background: "var(--dashboard-accent)",
									borderColor: "var(--dashboard-accent)",
								}}
								onClick={() => setIsCreateOpen(true)}
							>
								<Plus className="h-4 w-4" aria-hidden />
								Create Adjustment
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Adjustment No.</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead className="text-center">Items</TableHead>
									<TableHead>Created By</TableHead>
									<TableHead>Created At</TableHead>
									<TableHead className="w-[60px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{adjustments.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center py-8 text-muted-foreground"
										>
											{loading ? "Loading..." : "No stock adjustments found."}
										</TableCell>
									</TableRow>
								) : (
									adjustments.map((adj) => (
										<TableRow key={adj.id}>
											<TableCell className="font-mono text-sm">
												{adj.adjustmentNo}
											</TableCell>
											<TableCell className="max-w-[200px] truncate">
												{adj.reason || "-"}
											</TableCell>
											<TableCell className="text-center">
												<Badge variant="outline">{adj.items.length}</Badge>
											</TableCell>
											<TableCell>
												{adj.createdByUser?.displayName ?? "-"}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDate(adj.createdAt)}
											</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => setViewAdj(adj)}
													title="View details"
												>
													<Eye className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between pt-4">
							<p className="text-sm text-muted-foreground">
								Page {page} of {totalPages}
								{pagination?.totalCount
									? ` (${pagination.totalCount} total)`
									: ""}
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page <= 1}
									onClick={() => setPage((p) => p - 1)}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => p + 1)}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create Dialog */}
			<StockAdjustmentFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSuccess={() => {
					setIsCreateOpen(false);
					refetch();
				}}
			/>

			{/* View Detail Dialog */}
			<Dialog
				open={!!viewAdj}
				onOpenChange={(open) => !open && setViewAdj(null)}
			>
				<DialogContent className="w-[min(96vw,700px)] max-w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl">
					<DialogHeader>
						<DialogTitle
							className="font-semibold"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{viewAdj?.adjustmentNo}
						</DialogTitle>
						<DialogDescription>
							Created by {viewAdj?.createdByUser?.displayName ?? "Unknown"} on{" "}
							{viewAdj ? formatDate(viewAdj.createdAt) : ""}
						</DialogDescription>
					</DialogHeader>

					{viewAdj && (
						<div className="space-y-4 pt-2">
							{(viewAdj.reason || viewAdj.notes) && (
								<div className="grid gap-3 sm:grid-cols-2">
									{viewAdj.reason && (
										<div>
											<p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
												Reason
											</p>
											<p className="text-sm">{viewAdj.reason}</p>
										</div>
									)}
									{viewAdj.notes && (
										<div>
											<p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
												Notes
											</p>
											<p className="text-sm">{viewAdj.notes}</p>
										</div>
									)}
								</div>
							)}

							<div className="rounded-lg border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>SKU</TableHead>
											<TableHead>Rack</TableHead>
											<TableHead>Lot</TableHead>
											<TableHead>Expiry</TableHead>
											<TableHead>Type</TableHead>
											<TableHead className="text-right">Qty</TableHead>
											<TableHead>Remarks</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{viewAdj.items.map((item) => (
											<TableRow key={item.id}>
												<TableCell>
													<div>
														<p className="font-mono text-sm">
															{item.skuCode ?? "-"}
														</p>
														{item.skuDescription && (
															<p className="text-xs text-muted-foreground truncate max-w-[200px]">
																{item.skuDescription}
															</p>
														)}
													</div>
												</TableCell>
												<TableCell className="font-mono text-sm whitespace-nowrap">
													{item.rack
														? `${item.rack.rackRow}-${item.rack.rackLevel}-${item.rack.rackColumn}`
														: "-"}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{item.lotNo?.trim() ? item.lotNo : "-"}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground whitespace-nowrap">
													{item.expiryDate
														? formatDateOnly(item.expiryDate)
														: "-"}
												</TableCell>
												<TableCell>
													<Badge
														variant={
															item.movementType === "DAMAGED"
																? "destructive"
																: "outline"
														}
													>
														{item.movementType}
													</Badge>
												</TableCell>
												<TableCell className="text-right font-mono">
													{Number(item.quantity) > 0
														? `+${item.quantity}`
														: item.quantity}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground">
													{item.remarks || "-"}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</main>
	);
}
