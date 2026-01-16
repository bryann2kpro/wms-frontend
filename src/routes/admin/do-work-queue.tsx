import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
	Eye,
	Printer,
	Package,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import {
	type DeliveryOrder,
	type DOStatus,
	type DOStatusFilter,
	getDOs,
} from "@/data/do.mock-data";

export const Route = createFileRoute("/admin/do-work-queue")({
	component: DOWorkQueueComponent,
});

const doStatuses: DOStatus[] = [
	"CREATED",
	"PICKING",
	"PACKED",
	"READY_FOR_COLLECTION",
	"COLLECTED",
	"DELIVERED_PENDING_PROOF",
	"DELIVERED_CONFIRMED",
];

function DOWorkQueueComponent() {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { hasPermission } = usePermissions(user);
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<DOStatusFilter>("ALL");

	// Filter by assigned user for Store Keeper and Logistic roles
	const assignedTo =
		user?.role === "store_keeper" || user?.role === "logistic"
			? user.id
			: undefined;

	const { data, isLoading } = useQuery({
		queryKey: ["dos", { page, pageSize, searchTerm, statusFilter, assignedTo }],
		queryFn: () =>
			getDOs({
				page,
				pageSize,
				search: searchTerm,
				status: statusFilter,
				assignedTo,
			}),
		staleTime: 30_000,
	});

	const dos = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const getStatusColor = (status: DOStatus) => {
		const colors: Record<DOStatus, string> = {
			CREATED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			PICKING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			PACKED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
			READY_FOR_COLLECTION:
				"bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
			COLLECTED: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
			DELIVERED_PENDING_PROOF:
				"bg-orange-500/10 text-orange-600 border-orange-500/20",
			DELIVERED_CONFIRMED: "bg-green-500/10 text-green-600 border-green-500/20",
			CANCELLED: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const formatStatus = (status: string) => {
		return status
			.replace(/_/g, " ")
			.toLowerCase()
			.replace(/\b\w/g, (l) => l.toUpperCase());
	};

	const handleViewDO = (doId: string) => {
		navigate({ to: "/admin/do-detail/$id", params: { id: doId } });
	};

	const handlePrintDO = (doNumber: string) => {
		// Mock print functionality
		window.print();
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">DO Work Queue</h1>
					<p className="text-muted-foreground">
						Manage delivery orders and track execution status
					</p>
				</div>
			</div>

			{/* Status Tabs */}
			<div className="flex flex-wrap gap-2 border-b">
				<Button
					variant={statusFilter === "ALL" ? "default" : "ghost"}
					size="sm"
					onClick={() => setStatusFilter("ALL")}
				>
					All ({summary?.total || 0})
				</Button>
				{doStatuses.map((status) => (
					<Button
						key={status}
						variant={statusFilter === status ? "default" : "ghost"}
						size="sm"
						onClick={() => {
							setStatusFilter(status);
							setPage(1);
						}}
					>
						{formatStatus(status)} ({summary?.byStatus[status] || 0})
					</Button>
				))}
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
					{doStatuses.slice(0, 4).map((status) => (
						<Card key={status}>
							<CardHeader className="pb-2">
								<CardTitle className="text-xs font-medium">
									{formatStatus(status)}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{summary.byStatus[status] ?? 0}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Delivery Orders</CardTitle>
							<CardDescription>
								View and manage all delivery orders
							</CardDescription>
						</div>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search DOs..."
								value={searchTerm}
								onChange={(e) => {
									setSearchTerm(e.target.value);
									setPage(1);
								}}
								className="pl-9 sm:w-64"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>DO Number</TableHead>
									<TableHead>TO Number</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead>Scheduled Date</TableHead>
									<TableHead>Items</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											Loading delivery orders...
										</TableCell>
									</TableRow>
								) : dos.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No delivery orders found.
										</TableCell>
									</TableRow>
								) : (
									dos.map((do_) => (
										<TableRow key={do_.id}>
											<TableCell className="font-medium">
												{do_.doNumber}
											</TableCell>
											<TableCell>{do_.toNumber || "-"}</TableCell>
											<TableCell>{do_.outlet}</TableCell>
											<TableCell>
												{do_.scheduledDeliveryDate.toLocaleDateString()}
											</TableCell>
											<TableCell>{do_.items.length}</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getStatusColor(do_.status)}
												>
													{formatStatus(do_.status)}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleViewDO(do_.id)}
													>
														<Eye className="h-4 w-4" />
													</Button>
													{hasPermission("do:print") && (
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handlePrintDO(do_.doNumber)}
														>
															<Printer className="h-4 w-4" />
														</Button>
													)}
												</div>
											</TableCell>
										</TableRow>
									))
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
								of <span className="font-medium">{data.total}</span> DOs
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
		</div>
	);
}
