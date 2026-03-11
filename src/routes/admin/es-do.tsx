import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useStockUnitName } from "@/lib/hooks/use-stock-unit";
import { type DOItem, type DOStatusFilter, getDOs } from "@/data/do.mock-data";

const PAGE_TITLE = "Empire Sushi DO Work Queue";
const PAGE_DESCRIPTION =
	"Delivery order work queue for Empire Sushi — stock movement based on DO.";

export const Route = createFileRoute("/admin/es-do")({
	component: EmpireSushiDOComponent,
});

function formatQty(qty: string | null): string {
	if (!qty) return "0";
	const num = parseFloat(qty);
	return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function getStatusBadgeVariant(status: string | null): "default" | "secondary" | "outline" | "destructive" {
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

interface FlattenedItem {
	id: string;
	skuCode: string | null;
	skuDescription: string | null;
	doNo: string | null;
	purchaseOrderNo: string;
	qtyRequired: string | number;
	qtyPicked: string | number;
	qtyPacked: string | number;
	onHandQty: string | number | null;
	lossQty: string | number | null;
	doStatus: string | null;
}

function EmpireSushiDOComponent() {
	const unitName = useStockUnitName();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<DOStatusFilter>("ALL");
	const [assignedTo, setAssignedTo] = useState<string>("");
	const [markingPicked, setMarkingPicked] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["dos-empire-sushi", { searchTerm, statusFilter, assignedTo }],
		queryFn: () =>
			getDOs({
				page: 1,
				pageSize: 100, // Get more to flatten
				search: searchTerm,
				status: statusFilter,
				assignedTo: assignedTo || undefined,
			}),
		staleTime: 30_000,
	});

	useEffect(() => {
		document.title = `${PAGE_TITLE} | SME Ederan`;
		return () => {
			document.title = "SME Ederan";
		};
	}, []);

	// Flatten all items from all DOs and map to table shape
	const allItems: FlattenedItem[] = useMemo(() => {
		if (!data?.items) return [];
		return data.items.flatMap((do_) =>
			do_.items.map((item) => ({
				id: item.id,
				skuCode: item.sku ?? null,
				skuDescription: item.description ?? null,
				doNo: do_.doNumber ?? null,
				purchaseOrderNo: do_.toNumber,
				qtyRequired: item.requiredQuantity,
				qtyPicked: item.pickedQuantity,
				qtyPacked: item.packedQuantity,
				onHandQty: item.openingQtyDozen,
				lossQty: item.openingQtyLoss,
				doStatus: do_.status ?? null,
			})),
		);
	}, [data?.items]);

	// Paginate the flattened items
	const totalItems = allItems.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const paginatedItems = allItems.slice((page - 1) * pageSize, page * pageSize);

	function handleMarkAsPicked(_item: FlattenedItem) {
		// TODO: wire to mutation when backend supports it
		setMarkingPicked(true);
		setTimeout(() => setMarkingPicked(false), 500);
	}

	const tableColSpan = 11;

	return (
		<main
			id="main-content"
			className="container mx-auto p-6 space-y-6"
			aria-label={PAGE_TITLE}
		>
			<div
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
				role="status"
			>
				{isLoading
					? "Loading items…"
					: paginatedItems.length === 0
						? "No items found."
						: `Showing ${paginatedItems.length} items.`}
			</div>

			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1
						id="page-title"
						className="text-3xl font-bold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
						tabIndex={-1}
					>
						{PAGE_TITLE}
					</h1>
					<p id="page-description" className="text-muted-foreground mt-1">
						{PAGE_DESCRIPTION}
					</p>
				</div>
				<div className="relative">
					<Search
						className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
						aria-hidden
					/>
					<Input
						aria-label="Search items by SKU, description, or DO number"
						placeholder="Search items..."
						value={searchTerm}
						onChange={(e) => {
							setSearchTerm(e.target.value);
							setPage(1);
						}}
						className="pl-9 sm:w-64 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
				</div>
			</header>

			{isLoading && (
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
				aria-busy={isLoading}
			>
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table aria-label="Empire Sushi DO work queue items with SKU, quantities and inventory">
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
								<TableHead className="text-center">Picked</TableHead>
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
									const isPicked = parseFloat(item.qtyPicked ?? "0") > 0;
									return (
										<TableRow key={item.id} className={isPicked ? "bg-muted/50" : ""}>
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
												{formatQty(item.onHandQty)} / {formatQty(item.lossQty)}
											</TableCell>
											<TableCell>
												<Badge variant={getStatusBadgeVariant(item.doStatus)}>
													{item.doStatus ?? "Unknown"}
												</Badge>
											</TableCell>
											<TableCell className="text-center">
												<Checkbox
													checked={isPicked}
													disabled={markingPicked}
													onCheckedChange={() => handleMarkAsPicked(item)}
													aria-label={`Mark ${item.skuCode} as ${isPicked ? "not picked" : "picked"}`}
												/>
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
	);
}
