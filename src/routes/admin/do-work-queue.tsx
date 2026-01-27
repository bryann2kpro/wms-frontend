import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getPrimaryRole } from "@/lib/auth";
import {
	type DOItem,
	type DOStatusFilter,
	getDOs,
} from "@/data/do.mock-data";

export const Route = createFileRoute("/admin/do-work-queue")({
	component: DOWorkQueueComponent,
});

// Extended item type for flattened view
interface FlattenedItem extends DOItem {
	doNumber: string;
	doId: string;
}

function DOWorkQueueComponent() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<DOStatusFilter>("ALL");

	// Filter by assigned user for Store Keeper and Logistic roles
	const userRole = user ? getPrimaryRole(user.roles) : null;
	const assignedTo =
		userRole === "store_keeper" || userRole === "logistic"
			? user?.id
			: undefined;

	const { data, isLoading } = useQuery({
		queryKey: ["dos", { searchTerm, statusFilter, assignedTo }],
		queryFn: () =>
			getDOs({
				page: 1,
				pageSize: 100, // Get more to flatten
				search: searchTerm,
				status: statusFilter,
				assignedTo,
			}),
		staleTime: 30_000,
	});

	// Flatten all items from all DOs
	const allItems: FlattenedItem[] = useMemo(() => {
		if (!data?.items) return [];
		return data.items.flatMap((do_) =>
			do_.items.map((item) => ({
				...item,
				doNumber: do_.doNumber,
				doId: do_.id,
			})),
		);
	}, [data?.items]);

	// Paginate the flattened items
	const totalItems = allItems.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const paginatedItems = allItems.slice(
		(page - 1) * pageSize,
		page * pageSize,
	);

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">DO Work Queue</h1>
					<p className="text-muted-foreground">
						Stock movement and inventory management
					</p>
				</div>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search items..."
						value={searchTerm}
						onChange={(e) => {
							setSearchTerm(e.target.value);
							setPage(1);
						}}
						className="pl-9 sm:w-64"
					/>
				</div>
			</div>

			<div className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">Item</TableHead>
								<TableHead>SKU</TableHead>
								<TableHead>Description</TableHead>
								<TableHead className="text-center">
									Opening Qty
									<br />
									<span className="text-xs font-normal">(Dozen/Loss)</span>
								</TableHead>
								<TableHead className="text-center">
									Stock In
									<br />
									<span className="text-xs font-normal">(Dozen/Loss)</span>
								</TableHead>
								<TableHead className="text-center">
									Stock Out
									<br />
									<span className="text-xs font-normal">(Dozen/Loss)</span>
								</TableHead>
								<TableHead className="text-center">
									Close Qty
									<br />
									<span className="text-xs font-normal">(Dozen/Loss)</span>
								</TableHead>
								<TableHead>Storage Rack</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="h-24 text-center text-muted-foreground"
									>
										Loading items...
									</TableCell>
								</TableRow>
							) : paginatedItems.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="h-24 text-center text-muted-foreground"
									>
										No items found.
									</TableCell>
								</TableRow>
							) : (
								paginatedItems.map((item, index) => (
									<TableRow key={item.id}>
										<TableCell className="font-medium">
											{(page - 1) * pageSize + index + 1}
										</TableCell>
										<TableCell>{item.sku}</TableCell>
										<TableCell className="max-w-[200px] truncate">
											{item.description}
										</TableCell>
										<TableCell className="text-center">
											{item.openingQtyDozen} / {item.openingQtyLoss}
										</TableCell>
										<TableCell className="text-center">
											{item.stockInDozen} / {item.stockInLoss}
										</TableCell>
										<TableCell className="text-center">
											{item.stockOutDozen} / {item.stockOutLoss}
										</TableCell>
										<TableCell className="text-center">
											{item.closeQtyDozen} / {item.closeQtyLoss}
										</TableCell>
										<TableCell>{item.storageRack}</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				{totalItems > 0 && (
					<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
						<div>
							Showing{" "}
							<span className="font-medium">
								{(page - 1) * pageSize + 1}
							</span>{" "}
							-{" "}
							<span className="font-medium">
								{Math.min(page * pageSize, totalItems)}
							</span>{" "}
							of <span className="font-medium">{totalItems}</span> items
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								disabled={page === 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span>
								Page {page} of {totalPages}
							</span>
							<Button
								variant="outline"
								size="icon"
								disabled={page === totalPages}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
