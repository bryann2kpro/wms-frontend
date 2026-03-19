import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useQuery } from "@apollo/client/react";
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
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Search, ChevronLeft, ChevronRight, Loader2, Truck } from "lucide-react";
import { useStockUnitName } from "@/lib/hooks/use-stock-unit";
import { type DOItem, type DOStatusFilter, getDOs } from "@/data/do.mock-data";
import {
	DELIVERY_ORDER_ITEMS_QUERY,
	type DeliveryOrderItemsQueryData,
	type DeliveryOrderItemsQueryVariables,
} from "@/lib/graphql/delivery-orders";
import type { DeliveryOrderItemWithDetails } from "@/lib/graphql/types";
import { AdminPageHeader } from "@/components/admin-page-header";

const PAGE_TITLE = "Supplier DO Work Queue";
const PAGE_DESCRIPTION =
	"Stock movement and inventory management for supplier delivery orders.";

export const Route = createFileRoute("/admin/do-work-queue")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Supplier Delivery"]);
	},
	component: DOWorkQueueComponent,
});

function formatQty(qty: string | null): string {
	if (!qty) return "0";
	const num = parseFloat(qty);
	return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function getStatusBadgeVariant(
	status: string | null,
): "default" | "secondary" | "outline" | "destructive" {
	switch (status) {
		case "CREATED":
			return "secondary";
		case "PICKING":
			return "default";
		case "PACKED":
		case "READY_FOR_COLLECTION":
		case "COLLECTED":
			return "outline";
		case "DELIVERED_CONFIRMED":
			return "default";
		case "CANCELLED":
			return "destructive";
		default:
			return "secondary";
	}
}

function DOWorkQueueComponent() {
	const unitName = useStockUnitName();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchTerm);
			setPage(1);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	useEffect(() => {
		document.title = `${PAGE_TITLE} | SME Ederan`;
		return () => {
			document.title = "SME Ederan";
		};
	}, []);

	const { data, loading, refetch } = useQuery<
		DeliveryOrderItemsQueryData,
		DeliveryOrderItemsQueryVariables
	>(DELIVERY_ORDER_ITEMS_QUERY, {
		variables: {
			filter: debouncedSearch ? { search: debouncedSearch } : null,
			pageSize,
			pageNumber: page,
		},
		fetchPolicy: "cache-and-network",
	});

	const items: DeliveryOrderItemWithDetails[] =
		data?.deliveryOrderItems?.query ?? [];
	const pagination = data?.deliveryOrderItems?.pagination;
	const totalItems = pagination?.totalCount ?? 0;
	const totalPages = pagination?.totalPages ?? 1;

	const tableColSpan = 10;

	return (
		<div className="do-work-queue-page min-h-screen bg-[var(--dashboard-surface)]">
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				id="main-content"
				className="container relative mx-auto p-6 space-y-6"
				aria-labelledby="do-work-queue-page-title"
				aria-describedby="do-work-queue-page-description"
			>
			<div
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
				role="status"
			>
				{loading
					? "Loading items…"
					: items.length === 0
						? "No items found."
						: `Showing ${items.length} items.`}
			</div>

			<AdminPageHeader
				icon={Truck}
				title={PAGE_TITLE}
				description={PAGE_DESCRIPTION}
				titleId="do-work-queue-page-title"
				descriptionId="do-work-queue-page-description"
				rightSlot={
					<div className="relative">
						<Search
							className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
							aria-hidden
						/>
						<Input
							aria-label="Search items by SKU, description, or DO number"
							placeholder="Search items..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-9 sm:w-64 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						/>
					</div>
				}
			/>

			{loading && (
				<div
					className="flex items-center gap-2 text-muted-foreground text-sm"
					role="status"
					aria-live="polite"
				>
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
					<span>Loading items…</span>
				</div>
			)}

			<section
				className="relative"
				aria-label="Delivery order items table"
				aria-busy={loading}
			>
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table aria-label="Supplier DO work queue items with SKU, quantities and inventory">
						<TableHeader>
							<TableRow>
								<TableHead className="w-12">Item</TableHead>
								<TableHead>SKU</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>DO</TableHead>
								<TableHead>PO</TableHead>
								<TableHead className="text-center">Qty Required</TableHead>
								<TableHead className="text-center">Qty Picked</TableHead>
								<TableHead className="text-center">Qty Packed</TableHead>
								<TableHead className="text-center">
									On Hand
									<br />
									<span className="text-xs font-normal">({unitName}/Loss)</span>
								</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading && items.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={tableColSpan}
										className="h-24 text-center text-muted-foreground"
									>
										Loading items…
									</TableCell>
								</TableRow>
							) : items.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={tableColSpan}
										className="h-24 text-center text-muted-foreground"
									>
										No items found.
									</TableCell>
								</TableRow>
							) : (
								items.map((item, index) => {
									return (
										<TableRow
											key={item.id}
										>
											<TableCell className="font-medium">
												{(page - 1) * pageSize + index + 1}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{item.skuCode ?? "-"}
											</TableCell>
											<TableCell className="max-w-[200px] truncate">
												{item.skuDescription ?? "-"}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{item.doNo ?? "-"}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{item.purchaseOrderNo}
											</TableCell>
											<TableCell className="text-center">
												{formatQty(item.qtyRequired)}
											</TableCell>
											<TableCell className="text-center">
												{formatQty(item.qtyPicked)}
											</TableCell>
											<TableCell className="text-center">
												{formatQty(item.qtyPacked)}
											</TableCell>
											<TableCell className="text-center">
												{formatQty(item.onHandQty)} /{" "}
												{formatQty(item.lossQty)}
											</TableCell>
											<TableCell>
												<Badge
													variant={getStatusBadgeVariant(item.doStatus)}
												>
													{item.doStatus ?? "Unknown"}
												</Badge>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				{totalItems > 0 && (
					<nav
						className="mt-4 flex items-center justify-between text-xs text-muted-foreground"
						aria-label="Pagination"
					>
						<div>
							Showing{" "}
							<span className="font-medium">{(page - 1) * pageSize + 1}</span> -{" "}
							<span className="font-medium">
								{Math.min(page * pageSize, totalItems)}
							</span>{" "}
							of <span className="font-medium">{totalItems}</span> items
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								disabled={page === 1 || loading}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								aria-label="Previous page"
								className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<ChevronLeft className="h-4 w-4" aria-hidden />
							</Button>
							<span aria-live="polite">
								Page {page} of {totalPages}
							</span>
							<Button
								variant="outline"
								size="icon"
								disabled={page === totalPages || loading}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								aria-label="Next page"
								className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<ChevronRight className="h-4 w-4" aria-hidden />
							</Button>
						</div>
					</nav>
				)}
			</section>
			</main>
		</div>
	);
}
