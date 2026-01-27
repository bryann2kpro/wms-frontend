import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Package,
	ArrowRightLeft,
	Truck,
	AlertCircle,
	TrendingUp,
	Clock,
	FileText,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { DashboardData } from "@/data/dashboard.mock-data";
import { getDashboardData } from "@/data/dashboard.mock-data";

export const Route = createFileRoute("/admin/dashboard")({
	component: DashboardComponent,
});

function DashboardComponent() {
	const { user } = useCurrentUser();

	const { data, isLoading, isFetching } = useQuery<DashboardData>({
		queryKey: ["dashboard"],
		queryFn: () => getDashboardData(),
		staleTime: 30_000,
	});

	if (isLoading || !data) {
		return <DashboardSkeleton />;
	}

	const {
		stats,
		integrationHealth,
		grns,
		transferOrders,
		deliveries,
		pendingProofCount,
	} = data;

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			completed: "bg-green-500/10 text-green-600 border-green-500/20",
			delivered: "bg-green-500/10 text-green-600 border-green-500/20",
			pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			in_transit: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
			CREATED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			PICKING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			PACKED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
			DISPATCHED: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
			DELIVERED_CONFIRMED: "bg-green-500/10 text-green-600 border-green-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const formatStatus = (status: string) => {
		return status
			.toLowerCase()
			.replace("_", " ")
			.replace(/\b\w/g, (l) => l.toUpperCase());
	};

	const scheduledDeliveries = deliveries.filter(
		(d) =>
			d.status === "CREATED" || d.status === "PICKING" || d.status === "PACKED",
	);

	return (
		<div className="container mx-auto p-6 space-y-6">
			{/* Header */}
			<div className="space-y-1">
				<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground">Welcome back, {user?.displayName}</p>
			</div>

			{/* KPI Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">GRNs Today</CardTitle>
						<Package className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{stats.grnsToday}</div>
						<p className="text-xs text-muted-foreground">
							<span className="font-medium text-yellow-600">
								{stats.grnsPendingApproval} pending approval
							</span>
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							POs from ES Pulled Today
						</CardTitle>
						<ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{stats.tosPulledToday}</div>
						<p className="text-xs text-muted-foreground">
							Last: {stats.tosLastPullTime ? new Date(stats.tosLastPullTime).toLocaleTimeString() : "N/A"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">DOs Status</CardTitle>
						<Truck className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="space-y-1">
							<div className="text-sm">
								<span className="font-medium">{stats.dosByStatus.picking}</span>{" "}
								Picking
							</div>
							<div className="text-sm">
								<span className="font-medium">{stats.dosByStatus.ready}</span>{" "}
								Ready
							</div>
							<div className="text-xs text-muted-foreground">
								<span className="font-medium text-orange-600">
									{stats.dosByStatus.deliveredPendingProof} pending proof
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* <Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Shortage/Damage
						</CardTitle>
						<AlertCircle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stats.shortageDamagePending}
						</div>
						<p className="text-xs text-muted-foreground">Pending approval</p>
					</CardContent>
				</Card> */}

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Invoices</CardTitle>
						<FileText className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stats.invoicesIssuedToday}
						</div>
						<p className="text-xs text-muted-foreground">
							{stats.invoicesIssuedThisWeek} this week
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Integration Health & Pending Proof */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Integration Health */}
				<Card>
					<CardHeader>
						<CardTitle>Integration Health</CardTitle>
						<CardDescription>NetSuite sync status</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Last PO Pull:</span>
								<span className="font-medium">
									{integrationHealth.lastTOPullTime.toLocaleString()}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Last Stock Sync:</span>
								<span className="font-medium">
									{integrationHealth.lastStockSyncTime.toLocaleString()}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Failed Syncs:</span>
								<span className="font-medium text-red-600">
									{integrationHealth.failedSyncCount}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">
									Stock Sync Status:
								</span>
								<Badge
									variant="outline"
									className={
										integrationHealth.stockSyncStatus === "OK"
											? "bg-green-500/10 text-green-600 border-green-500/20"
											: "bg-red-500/10 text-red-600 border-red-500/20"
									}
								>
									{integrationHealth.stockSyncStatus}
								</Badge>
							</div>
						</div>
						<Button variant="outline" size="sm" asChild>
							<Link to="/admin/settings">View Logs</Link>
						</Button>
					</CardContent>
				</Card>

				{/* Pending Proof */}
				<Card className="border-orange-200 bg-orange-50/50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-orange-600" />
							Pending Proof of Delivery
						</CardTitle>
						<CardDescription>DOs awaiting signed DO upload</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="text-3xl font-bold text-orange-600">
								{pendingProofCount}
							</div>
							<p className="text-sm text-muted-foreground">
								Delivery orders are waiting for signed proof of delivery upload.
							</p>
							<Button asChild>
								<Link to="/admin/delivery-proof">View Proof of Delivery</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Recent Activity Grid */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Recent GRNs */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Recent GRNs</CardTitle>
							<CardDescription>Latest goods receipt notes</CardDescription>
						</div>
						<Button variant="outline" size="sm" asChild>
							<Link to="/">View All</Link>
						</Button>
					</CardHeader>
					<CardContent className="relative">
						<TableLoadingShadow active={isFetching} />
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>GRN Number</TableHead>
									<TableHead>Supplier</TableHead>
									<TableHead className="text-right">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{grns.slice(0, 5).map((grn) => (
									<TableRow key={grn.id}>
										<TableCell className="font-medium">
											{grn.grnNumber}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{grn.supplier}
										</TableCell>
										<TableCell className="text-right">
											<Badge
												variant="outline"
												className={getStatusColor(grn.status)}
											>
												{formatStatus(grn.status)}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Branch GRN - ES Branch Received SMEE's Stock */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Branch GRN</CardTitle>
							<CardDescription>ES branch received SMEE's stock</CardDescription>
						</div>
						<Button variant="outline" size="sm" asChild>
							<Link to="/">View All</Link>
						</Button>
					</CardHeader>
					<CardContent className="relative">
						<TableLoadingShadow active={isFetching} />
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>GRN Number</TableHead>
									<TableHead>Branch</TableHead>
									<TableHead className="text-right">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<TableRow>
									<TableCell className="font-medium">BGRN-2024-001</TableCell>
									<TableCell className="text-muted-foreground">ES Kuala Lumpur</TableCell>
									<TableCell className="text-right">
										<Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
											Completed
										</Badge>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">BGRN-2024-002</TableCell>
									<TableCell className="text-muted-foreground">ES Penang</TableCell>
									<TableCell className="text-right">
										<Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
											Pending
										</Badge>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">BGRN-2024-003</TableCell>
									<TableCell className="text-muted-foreground">ES Johor Bahru</TableCell>
									<TableCell className="text-right">
										<Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
											Completed
										</Badge>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">BGRN-2024-004</TableCell>
									<TableCell className="text-muted-foreground">ES Kuching</TableCell>
									<TableCell className="text-right">
										<Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
											Pending
										</Badge>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell className="font-medium">BGRN-2024-005</TableCell>
									<TableCell className="text-muted-foreground">ES Kota Kinabalu</TableCell>
									<TableCell className="text-right">
										<Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
											Completed
										</Badge>
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Active Purchase Orders from ES */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Active Purchase Orders from ES</CardTitle>
							<CardDescription>In progress purchase orders from ES</CardDescription>
						</div>
						<Button variant="outline" size="sm" asChild>
							<Link to="/">View All</Link>
						</Button>
					</CardHeader>
					<CardContent className="relative">
						<TableLoadingShadow active={isFetching} />
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Purchase Order</TableHead>
									<TableHead>Route</TableHead>
									<TableHead className="text-right">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{transferOrders.slice(0, 5).map((transfer) => (
									<TableRow key={transfer.id}>
										<TableCell className="font-medium">
											{transfer.transferOrderNumber}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{transfer.fromLocation} → {transfer.toLocation}
										</TableCell>
										<TableCell className="text-right">
											<Badge
												variant="outline"
												className={getStatusColor(transfer.status)}
											>
												{formatStatus(transfer.status)}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Scheduled Deliveries */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>Scheduled Deliveries</CardTitle>
							<CardDescription>Upcoming deliveries</CardDescription>
						</div>
						<Button variant="outline" size="sm" asChild>
							<Link to="/">View All</Link>
						</Button>
					</CardHeader>
					<CardContent className="relative">
						<TableLoadingShadow active={isFetching} />
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Delivery Number</TableHead>
									<TableHead>Branch</TableHead>
									<TableHead className="text-right">Date</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{scheduledDeliveries.slice(0, 5).map((delivery) => (
									<TableRow key={delivery.id}>
										<TableCell className="font-medium">
											{delivery.deliveryNumber}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{delivery.customerName}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
												<Clock className="h-3 w-3" />
												{delivery.scheduledDate.toLocaleDateString()}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Alerts */}
				<Card>
					<CardHeader>
						<CardTitle>Alerts & Notifications</CardTitle>
						<CardDescription>Items requiring attention</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
								<AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600 shrink-0" />
								<div className="flex-1">
									<p className="text-sm font-medium">Pending GRN Approvals</p>
									<p className="text-xs text-muted-foreground">
										{stats.pendingGRNs} GRNs awaiting verification
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
								<AlertCircle className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
								<div className="flex-1">
									<p className="text-sm font-medium">Low Stock Alert</p>
									<p className="text-xs text-muted-foreground">
										{stats.lowStockItems} items below minimum threshold
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
								<AlertCircle className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" />
								<div className="flex-1">
									<p className="text-sm font-medium">NetSuite Sync Pending</p>
									<p className="text-xs text-muted-foreground">
										2 purchase orders from ES waiting to sync
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-4 w-64" />
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-4 w-4 rounded" />
						</CardHeader>
						<CardContent className="space-y-2">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				{Array.from({ length: 3 }).map((_, i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between">
							<div className="space-y-2">
								<Skeleton className="h-5 w-36" />
								<Skeleton className="h-4 w-56" />
							</div>
							<Skeleton className="h-8 w-20" />
						</CardHeader>
						<CardContent className="space-y-3">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</CardContent>
					</Card>
				))}

				<Card>
					<CardHeader className="space-y-2">
						<Skeleton className="h-5 w-44" />
						<Skeleton className="h-4 w-56" />
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function TableLoadingShadow({ active }: { active: boolean }) {
	if (!active) return null;
	return (
		<div
			className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-background/40 backdrop-blur-[1px]"
			aria-hidden="true"
		/>
	);
}
