import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
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
	Clock,
	FileText,
	Gauge,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { DashboardData } from "@/data/dashboard.mock-data";
import {
	DASHBOARD_QUERY,
	mapDashboardQueryToData,
	type DashboardQueryData,
} from "@/lib/graphql/dashboard";
import { formatDate, formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/admin/dashboard")({
	component: DashboardComponent,
	head: () => ({
		meta: [
			{
				title: "Dashboard - SME Edaran WMS",
				description:
					"View warehouse operations highlights, recent activity, and key performance indicators.",
			},
		],
	}),
});

function DashboardComponent() {
	const { user } = useCurrentUser();

	const { data: queryData, isLoading: loading } = useQuery({
		queryKey: qk.dashboard.all,
		queryFn: () => gqlRequest<DashboardQueryData>(DASHBOARD_QUERY),
	});

	const data: DashboardData | undefined =
		queryData?.dashboard != null
			? mapDashboardQueryToData(queryData.dashboard)
			: undefined;

	if (loading && !data) {
		return <DashboardSkeleton />;
	}

	if (!data) {
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

	const displayName = user?.displayName ?? "there";

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			// GRN statuses
			DRAFT: "bg-gray-500/10 text-gray-600 border-gray-500/20",
			SUBMITTED: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			APPROVED: "bg-green-500/10 text-green-600 border-green-500/20",
			SENT: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			FAILED: "bg-red-500/10 text-red-600 border-red-500/20",
			// PO & DO statuses (SHIPPED shared)
			NEW: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			ACCEPTED: "bg-green-500/10 text-green-600 border-green-500/20",
			REJECTED: "bg-red-500/10 text-red-600 border-red-500/20",
			DO_CREATED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
			SHIPPED: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
			CANCELLED: "bg-red-500/10 text-red-600 border-red-500/20",
			CREATED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			PACKING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			DELIVERED: "bg-green-500/10 text-green-600 border-green-500/20",
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
		(d) => d.status === "CREATED" || d.status === "PACKING",
	);

	const kpiDelays = [0, 80, 160, 240];

	return (
		<div className="dashboard-page min-h-screen bg-[var(--dashboard-surface)]">
			{/* Subtle gradient band behind header */}
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				className="container relative mx-auto px-6 py-8 space-y-8"
				aria-labelledby="dashboard-page-title"
				aria-describedby="dashboard-page-description"
				aria-busy={loading}
			>
				<AdminPageHeader
					icon={Gauge}
					title="Dashboard"
					description={`Welcome back, ${displayName}. Overview of today's operations and sync health.`}
					titleId="dashboard-page-title"
					descriptionId="dashboard-page-description"
				/>

				{/* KPI Cards */}
				<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
					<Card
						className="dashboard-card border-l-4 border-l-[var(--dashboard-accent)] shadow-md hover:shadow-lg"
						style={{ animationDelay: `${kpiDelays[0]}ms` }}
					>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle
								className="text-sm font-semibold"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								GRNs Today
							</CardTitle>
							<div className="rounded-lg bg-[var(--dashboard-accent-muted)] p-2">
								<Package className="h-4 w-4 text-[var(--dashboard-accent)]" />
							</div>
						</CardHeader>
						<CardContent>
							<div
								className="text-3xl font-bold tabular-nums"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{stats.grnsToday}
							</div>
							<p className="mt-1.5 text-xs text-muted-foreground">
								<span className="font-semibold text-amber-600 dark:text-amber-400">
									{stats.grnsPendingApproval} pending approval
								</span>
							</p>
						</CardContent>
					</Card>

					<Card
						className="dashboard-card shadow-md hover:shadow-lg"
						style={{ animationDelay: `${kpiDelays[1]}ms` }}
					>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle
								className="text-sm font-semibold"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								POs from ES Pulled Today
							</CardTitle>
							<div className="rounded-lg bg-muted p-2">
								<ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
							</div>
						</CardHeader>
						<CardContent>
							<div
								className="text-3xl font-bold tabular-nums"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{stats.tosPulledToday}
							</div>
							<p className="mt-1.5 text-xs text-muted-foreground">
								Last:{" "}
								{stats.tosLastPullTime
									? formatDate(stats.tosLastPullTime.toString())
									: "N/A"}
							</p>
						</CardContent>
					</Card>

					<Card
						className="dashboard-card shadow-md hover:shadow-lg"
						style={{ animationDelay: `${kpiDelays[2]}ms` }}
					>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle
								className="text-sm font-semibold"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								DOs Status
							</CardTitle>
							<div className="rounded-lg bg-muted p-2">
								<Truck className="h-4 w-4 text-muted-foreground" />
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-1.5 text-sm">
								<div>
									<span
										className="font-semibold tabular-nums"
										style={{ fontFamily: "var(--dashboard-display)" }}
									>
										{stats.dosByStatus.picking}
									</span>{" "}
									Picking
								</div>
								<div>
									<span
										className="font-semibold tabular-nums"
										style={{ fontFamily: "var(--dashboard-display)" }}
									>
										{stats.dosByStatus.ready}
									</span>{" "}
									Ready
								</div>
								<div className="text-xs text-muted-foreground">
									<span className="font-semibold text-amber-600 dark:text-amber-400">
										{stats.dosByStatus.deliveredPendingProof} pending proof
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className="dashboard-card shadow-md hover:shadow-lg"
						style={{ animationDelay: `${kpiDelays[3]}ms` }}
					>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle
								className="text-sm font-semibold"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Invoices
							</CardTitle>
							<div className="rounded-lg bg-muted p-2">
								<FileText className="h-4 w-4 text-muted-foreground" />
							</div>
						</CardHeader>
						<CardContent>
							<div
								className="text-3xl font-bold tabular-nums"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{stats.invoicesIssuedToday}
							</div>
							<p className="mt-1.5 text-xs text-muted-foreground">
								{stats.invoicesIssuedThisWeek} this week
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Integration Health & Pending Proof */}
				<div className="grid gap-6 lg:grid-cols-2">
					<Card className="dashboard-card shadow-md hover:shadow-lg">
						<CardHeader>
							<CardTitle
								className="text-lg"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Integration Health
							</CardTitle>
							<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
								NetSuite sync status
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Last PO Pull</span>
									<span className="font-medium tabular-nums">
										{formatDate(integrationHealth.lastTOPullTime.toString())}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Last Stock Sync</span>
									<span className="font-medium tabular-nums">
										{formatDate(integrationHealth.lastStockSyncTime.toString())}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Failed Syncs</span>
									<span className="font-semibold text-red-600 dark:text-red-400">
										{integrationHealth.failedSyncCount}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">
										Stock Sync Status
									</span>
									<Badge
										variant="outline"
										className={
											integrationHealth.stockSyncStatus === "OK"
												? "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400"
												: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
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

					<Card className="dashboard-card overflow-hidden border-2 border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-muted)]/40 shadow-md hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<div className="rounded-lg bg-[var(--dashboard-accent)]/20 p-1.5">
									<AlertCircle className="h-5 w-5 text-[var(--dashboard-accent)]" />
								</div>
								<span style={{ fontFamily: "var(--dashboard-display)" }}>
									Pending Proof of Delivery
								</span>
							</CardTitle>
							<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
								DOs awaiting signed DO upload
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div
									className="text-4xl font-bold tabular-nums text-[var(--dashboard-accent)]"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									{pendingProofCount}
								</div>
								<p
									className="text-sm text-muted-foreground"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Delivery orders are waiting for signed proof of delivery
									upload.
								</p>
								<Button
									className="bg-[var(--dashboard-accent)] text-white hover:opacity-90"
									asChild
								>
									<Link to="/admin/delivery-proof">View Proof of Delivery</Link>
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Recent Activity Grid */}
				<div className="grid gap-6 lg:grid-cols-2">
					<Card className="dashboard-card shadow-md hover:shadow-lg">
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle
									className="text-lg"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Recent GRNs
								</CardTitle>
								<CardDescription
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Latest goods receipt notes
								</CardDescription>
							</div>
							<Button variant="outline" size="sm" asChild>
								<Link to="/">View All</Link>
							</Button>
						</CardHeader>
						<CardContent className="relative px-0 pb-6">
							<TableLoadingShadow active={loading} />
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="px-6">GRN Number</TableHead>
										<TableHead className="px-6">Supplier</TableHead>
										<TableHead className="text-right px-6">Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{grns.slice(0, 5).map((grn) => (
										<TableRow
											key={grn.id}
											className="transition-colors hover:bg-muted/50"
										>
											<TableCell className="px-6 font-medium">
												{grn.grnNumber}
											</TableCell>
											<TableCell className="px-6 text-muted-foreground">
												{grn.supplier}
											</TableCell>
											<TableCell className="text-right px-6">
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

					<Card className="dashboard-card shadow-md hover:shadow-lg">
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle
									className="text-lg"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Purchase Orders from ES
								</CardTitle>
								<CardDescription
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									In progress purchase orders from ES
								</CardDescription>
							</div>
							<Button variant="outline" size="sm" asChild>
								<Link to="/">View All</Link>
							</Button>
						</CardHeader>
						<CardContent className="relative px-0 pb-6">
							<TableLoadingShadow active={loading} />
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="px-6">Purchase Order</TableHead>
										<TableHead className="px-6">Route</TableHead>
										<TableHead className="text-right px-6">Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{transferOrders.slice(0, 5).map((transfer) => (
										<TableRow
											key={transfer.id}
											className="transition-colors hover:bg-muted/50"
										>
											<TableCell className="px-6 font-medium">
												{transfer.transferOrderNumber}
											</TableCell>
											<TableCell className="px-6 text-muted-foreground">
												{transfer.fromLocation} → {transfer.toLocation}
											</TableCell>
											<TableCell className="text-right px-6">
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

					<Card className="dashboard-card shadow-md hover:shadow-lg">
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle
									className="text-lg"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Scheduled Deliveries
								</CardTitle>
								<CardDescription
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Upcoming deliveries
								</CardDescription>
							</div>
							<Button variant="outline" size="sm" asChild>
								<Link to="/">View All</Link>
							</Button>
						</CardHeader>
						<CardContent className="relative px-0 pb-6">
							<TableLoadingShadow active={loading} />
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="px-6">Delivery Number</TableHead>
										<TableHead className="px-6">Branch</TableHead>
										<TableHead className="text-right px-6">Date</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{scheduledDeliveries.slice(0, 5).map((delivery) => (
										<TableRow
											key={delivery.id}
											className="transition-colors hover:bg-muted/50"
										>
											<TableCell className="px-6 font-medium">
												{delivery.deliveryNumber}
											</TableCell>
											<TableCell className="px-6 text-muted-foreground">
												{delivery.customerName}
											</TableCell>
											<TableCell className="text-right px-6">
												<div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
													<Clock className="h-3 w-3" />
													{formatDateOnly(delivery.scheduledDate)}
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card className="dashboard-card shadow-md hover:shadow-lg">
						<CardHeader>
							<CardTitle
								className="text-lg"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Alerts & Notifications
							</CardTitle>
							<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
								Items requiring attention
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 transition-colors hover:bg-amber-500/15">
									<div className="rounded-lg bg-amber-500/20 p-1.5">
										<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold">
											Pending GRN Approvals
										</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											{stats.pendingGRNs} GRNs awaiting verification
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 transition-colors hover:bg-red-500/15">
									<div className="rounded-lg bg-red-500/20 p-1.5">
										<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold">Low Stock Alert</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											{stats.lowStockItems} items below minimum threshold
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 transition-colors hover:bg-blue-500/15">
									<div className="rounded-lg bg-blue-500/20 p-1.5">
										<AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold">
											NetSuite Sync Pending
										</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											2 purchase orders from ES waiting to sync
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</main>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="dashboard-page min-h-screen bg-[var(--dashboard-surface)]">
			<div className="container relative mx-auto px-6 py-8 space-y-8">
				<header className="relative">
					<div
						className="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-muted"
						aria-hidden
					/>
					<div className="pl-5 space-y-2">
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-4 w-56" />
					</div>
				</header>

				<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Card key={i} className="shadow-md">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-9 w-9 rounded-lg" />
							</CardHeader>
							<CardContent className="space-y-2">
								<Skeleton className="h-9 w-20" />
								<Skeleton className="h-3 w-32" />
							</CardContent>
						</Card>
					))}
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					<Card className="shadow-md">
						<CardHeader className="space-y-2">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-32" />
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
								{Array.from({ length: 4 }).map((_, i) => (
									<div key={i} className="flex justify-between">
										<Skeleton className="h-4 w-28" />
										<Skeleton className="h-4 w-36" />
									</div>
								))}
							</div>
							<Skeleton className="h-9 w-24" />
						</CardContent>
					</Card>
					<Card className="shadow-md">
						<CardHeader className="space-y-2">
							<Skeleton className="h-5 w-44" />
							<Skeleton className="h-4 w-40" />
						</CardHeader>
						<CardContent className="space-y-4">
							<Skeleton className="h-12 w-16" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-10 w-40" />
						</CardContent>
					</Card>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					{Array.from({ length: 3 }).map((_, i) => (
						<Card key={i} className="shadow-md">
							<CardHeader className="flex flex-row items-center justify-between">
								<div className="space-y-2">
									<Skeleton className="h-5 w-36" />
									<Skeleton className="h-4 w-48" />
								</div>
								<Skeleton className="h-8 w-20" />
							</CardHeader>
							<CardContent className="px-0 pb-6 space-y-2">
								{Array.from({ length: 5 }).map((_, j) => (
									<div key={j} className="flex gap-4 px-6 py-2">
										<Skeleton className="h-4 flex-1" />
										<Skeleton className="h-4 flex-1" />
										<Skeleton className="h-5 w-20" />
									</div>
								))}
							</CardContent>
						</Card>
					))}
					<Card className="shadow-md">
						<CardHeader className="space-y-2">
							<Skeleton className="h-5 w-44" />
							<Skeleton className="h-4 w-52" />
						</CardHeader>
						<CardContent className="space-y-3">
							{Array.from({ length: 3 }).map((_, i) => (
								<Skeleton key={i} className="h-16 w-full rounded-xl" />
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

function TableLoadingShadow({ active }: { active: boolean }) {
	if (!active) return null;
	return (
		<div
			className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-background/60 backdrop-blur-[2px]"
			aria-hidden="true"
		/>
	);
}
