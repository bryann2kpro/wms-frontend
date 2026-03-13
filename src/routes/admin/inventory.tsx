import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useQuery } from "@tanstack/react-query";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Search,
	ChevronLeft,
	ChevronRight,
	PackageSearch,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getInventory, type InventoryItem } from "@/data/inventory.mock-data";

export const Route = createFileRoute("/admin/inventory")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: InventoryComponent,
});

function InventoryComponent() {
	const [page, setPage] = useState(1);
	const pageSize = 20;
	const [searchTerm, setSearchTerm] = useState("");
	const [lowStockFilter, setLowStockFilter] = useState(false);
	const [lowStockThreshold, setLowStockThreshold] = useState<number>(20);

	const { data, isLoading } = useQuery({
		queryKey: [
			"inventory",
			{
				page,
				pageSize,
				searchTerm,
				lowStock: lowStockFilter,
				lowStockThreshold,
			},
		],
		queryFn: () =>
			getInventory({
				page,
				pageSize,
				search: searchTerm,
				lowStock: lowStockFilter,
				lowStockThreshold,
			}),
		staleTime: 30_000,
	});

	const items = data?.items ?? [];
	const syncStatus = data?.syncStatus;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const isLowStock = (item: InventoryItem) => {
		return item.availableQuantity <= lowStockThreshold;
	};

	return (
		<main
			className="inventory-page container mx-auto p-6 space-y-6"
			aria-labelledby="inventory-page-title"
			aria-describedby="inventory-page-description"
			aria-busy={isLoading}
		>
			<AdminPageHeader
				icon={PackageSearch}
				title="Inventory"
				description="View inventory levels and stock sync status."
				titleId="inventory-page-title"
				descriptionId="inventory-page-description"
			/>

			{/* Stock Sync Status */}
			{syncStatus && (
				<Card className="dashboard-card border-blue-200 bg-blue-50/50">
					<CardHeader>
						<CardTitle
							className="flex items-center gap-2 text-base"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{syncStatus.status === "OK" ? (
								<CheckCircle2 className="h-5 w-5 text-green-600" />
							) : (
								<AlertCircle className="h-5 w-5 text-red-600" />
							)}
							Daily Stock Sync Status
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-3">
							<div>
								<p className="text-xs text-muted-foreground">
									Last synced to NetSuite
								</p>
								<p className="text-sm font-medium">
									{syncStatus.lastSyncTime.toLocaleString()}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Sync Status</p>
								<Badge
									variant="outline"
									className={
										syncStatus.status === "OK"
											? "bg-green-500/10 text-green-600 border-green-500/20"
											: "bg-red-500/10 text-red-600 border-red-500/20"
									}
								>
									{syncStatus.status}
								</Badge>
							</div>
							{syncStatus.nextSyncTime && (
								<div>
									<p className="text-xs text-muted-foreground">
										Next Sync Time
									</p>
									<p className="text-sm font-medium">
										{syncStatus.nextSyncTime.toLocaleString()}
									</p>
								</div>
							)}
						</div>
						{syncStatus.errorMessage && (
							<div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
								<p className="text-sm text-red-600">
									{syncStatus.errorMessage}
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Inventory Items
							</CardTitle>
							<CardDescription>
								View stock levels by SKU and location
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="flex items-center gap-2 mr-2">
								<span className="text-sm text-muted-foreground whitespace-nowrap">
									Threshold:
								</span>
								<Input
									type="number"
									value={lowStockThreshold}
									onChange={(e) => {
										setLowStockThreshold(Number(e.target.value));
										setPage(1);
									}}
									className="w-20"
								/>
							</div>
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search SKU or description..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 sm:w-64"
								/>
							</div>
							<Button
								variant={lowStockFilter ? "default" : "outline"}
								onClick={() => {
									setLowStockFilter(!lowStockFilter);
									setPage(1);
								}}
							>
								<AlertCircle className="mr-2 h-4 w-4" />
								Low Stock Only
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
									<TableHead>SKU</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Location</TableHead>
									<TableHead>Quantity</TableHead>
									<TableHead>Reserved</TableHead>
									<TableHead>Available</TableHead>
									<TableHead>Min Level</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground"
										>
											Loading inventory...
										</TableCell>
									</TableRow>
								) : items.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground"
										>
											No inventory items found.
										</TableCell>
									</TableRow>
								) : (
									items.map((item) => {
										const lowStock = isLowStock(item);
										return (
											<TableRow key={item.id}>
												<TableCell className="font-medium">
													{item.sku}
												</TableCell>
												<TableCell>{item.description}</TableCell>
												<TableCell>{item.location}</TableCell>
												<TableCell>{item.quantity}</TableCell>
												<TableCell>{item.reservedQuantity}</TableCell>
												<TableCell>{item.availableQuantity}</TableCell>
												<TableCell>{item.minimumStockLevel}</TableCell>
												<TableCell>
													{lowStock ? (
														<Badge
															variant="outline"
															className="bg-red-500/10 text-red-600 border-red-500/20"
														>
															Low Stock
														</Badge>
													) : (
														<Badge
															variant="outline"
															className="bg-green-500/10 text-green-600 border-green-500/20"
														>
															OK
														</Badge>
													)}
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>

					{data && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								Showing{" "}
								<span className="font-medium">
									{(data.page - 1) * data.pageSize + 1}
								</span>{" "}
								-{" "}
								<span className="font-medium">
									{Math.min(data.page * data.pageSize, data.total)}
								</span>{" "}
								of <span className="font-medium">{data.total}</span> items
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
									onClick={() =>
										setPage((p) => (data ? Math.min(totalPages, p + 1) : p))
									}
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
