import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Clock,
	User as UserIcon,
	Box,
	Globe,
	Monitor,
	ChevronLeft,
	ChevronRight,
	Eye,
	Calendar,
} from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	AUDIT_LOGS_QUERY,
	AUDIT_LOG_FILTERS_QUERY,
	type AuditLogsQueryData,
	type AuditLogsQueryVariables,
	type AuditLog,
	type AuditLogFiltersQueryData,
} from "@/lib/graphql/audit-logs";

export const Route = createFileRoute("/admin/audit-log")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Audit Log"]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Audit Log - SME Edaran WMS",
				description:
					"Review user activity history, system changes, and operational audit trail records.",
			},
		],
	}),
});

function RouteComponent() {
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [selectedAction, setSelectedAction] = useState<string>("all");
	const [selectedEntity, setSelectedEntity] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
	const [isDetailOpen, setIsDetailOpen] = useState(false);

	const pageSize = 10;

	const filter: AuditLogsQueryVariables["filter"] = useMemo(() => {
		const filterObj: AuditLogsQueryVariables["filter"] = {};

		if (dateFrom) {
			filterObj.dateFrom = dateFrom;
		}

		if (dateTo) {
			filterObj.dateTo = dateTo;
		}

		if (selectedAction !== "all") {
			filterObj.action = selectedAction;
		}

		if (selectedEntity !== "all") {
			filterObj.entity = selectedEntity;
		}

		return filterObj;
	}, [dateFrom, dateTo, selectedAction, selectedEntity]);

	const auditVars: AuditLogsQueryVariables = {
		filter,
		pageSize,
		pageNumber: currentPage,
	};
	const { data, isLoading: loading, error } = useQuery({
		queryKey: qk.auditLogs.list(auditVars),
		queryFn: () =>
			gqlRequest<AuditLogsQueryData, AuditLogsQueryVariables>(
				AUDIT_LOGS_QUERY,
				auditVars,
			),
	});

	const { data: filtersData } = useQuery({
		queryKey: [...qk.auditLogs.all, "filters"] as const,
		queryFn: () => gqlRequest<AuditLogFiltersQueryData>(AUDIT_LOG_FILTERS_QUERY),
		staleTime: Infinity,
	});

	const auditLogs = data?.auditLogs.query || [];
	const pagination = data?.auditLogs.pagination;
	const uniqueActions = filtersData?.auditLogActions || [];
	const uniqueEntities = filtersData?.auditLogEntities || [];

	const handleViewDetail = (log: AuditLog) => {
		setSelectedLog(log);
		setIsDetailOpen(true);
	};

	const getActionBadgeColor = (action: string) => {
		const colors: Record<string, string> = {
			CREATE: "bg-green-500/10 text-green-600 border-green-500/20",
			UPDATE: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
			LOGIN: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			LOGOUT: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
		};
		return colors[action] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const mm = String(date.getMonth() + 1).padStart(2, "0");
		const dd = String(date.getDate()).padStart(2, "0");
		const yyyy = date.getFullYear();
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");
		return `${dd}/${mm}/${yyyy} ${hours}:${minutes}:${seconds}`;
	};

	const truncateId = (id: string) => {
		if (id.length <= 8) return id;
		return `${id.slice(0, 8)}...`;
	};

	if (error) {
		return (
			<main
				className="audit-log-page min-h-screen bg-[var(--dashboard-surface)]"
				aria-busy={false}
				aria-labelledby="audit-log-page-title"
				aria-describedby="audit-log-page-description"
			>
				<div className="container mx-auto p-6">
					<div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:bg-red-950/30 dark:border-red-500/30 px-4 py-3">
						Error loading audit logs: {(error as Error).message}
					</div>
				</div>
			</main>
		);
	}

	return (
		<main
			className="audit-log-page min-h-screen bg-[var(--dashboard-surface)]"
			aria-labelledby="audit-log-page-title"
			aria-describedby="audit-log-page-description"
			aria-busy={loading}
		>
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<div className="container relative mx-auto space-y-6 p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2.5">
							<div
								className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
								style={{ background: "var(--dashboard-accent)" }}
							>
								<Clock className="h-4.5 w-4.5 text-white" />
							</div>
							<h1
								id="audit-log-page-title"
								className="text-2xl font-bold tracking-tight"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Audit Log
							</h1>
						</div>
						<div className="pl-11.5 space-y-1.5">
							<p
								id="audit-log-page-description"
								className="text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Track all system changes and user activity.
							</p>
							<div
								style={{
									height: "3px",
									width: "3rem",
									borderRadius: "9999px",
									background:
										"linear-gradient(to right, var(--dashboard-accent), transparent)",
								}}
							/>
						</div>
					</div>
				</div>

				<Card className="dashboard-card">
					<CardHeader>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<CardTitle
									className="text-xl"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Audit Logs
								</CardTitle>
								<CardDescription
									className="text-muted-foreground"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									View all system changes and user activity
								</CardDescription>
							</div>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
								<div className="flex gap-2">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-muted-foreground" />
										<Label
											htmlFor="dateFrom"
											className="text-xs whitespace-nowrap"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											From
										</Label>
										<Input
											id="dateFrom"
											type="date"
											value={dateFrom}
											onChange={(e) => {
												setDateFrom(e.target.value);
												setCurrentPage(1);
											}}
											className="w-[140px] rounded-lg border-muted-foreground/20"
										/>
									</div>
									<div className="flex items-center gap-2">
										<Label
											htmlFor="dateTo"
											className="text-xs whitespace-nowrap"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											To
										</Label>
										<Input
											id="dateTo"
											type="date"
											value={dateTo}
											onChange={(e) => {
												setDateTo(e.target.value);
												setCurrentPage(1);
											}}
											className="w-[140px] rounded-lg border-muted-foreground/20"
										/>
									</div>
								</div>
								<Select
									value={selectedAction}
									onValueChange={(value) => {
										setSelectedAction(value);
										setCurrentPage(1);
									}}
								>
									<SelectTrigger className="w-[180px] rounded-lg border-muted-foreground/20">
										<SelectValue placeholder="All Actions" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Actions</SelectItem>
										{uniqueActions.map((action) => (
											<SelectItem key={action} value={action}>
												{action}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={selectedEntity}
									onValueChange={(value) => {
										setSelectedEntity(value);
										setCurrentPage(1);
									}}
								>
									<SelectTrigger className="w-[180px] rounded-lg border-muted-foreground/20">
										<SelectValue placeholder="All Entities" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Entities</SelectItem>
										{uniqueEntities.map((entity) => (
											<SelectItem key={entity} value={entity}>
												{entity}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardHeader>
					<CardContent className="px-0 pb-6">
						<div className="overflow-x-auto rounded-lg border mx-6">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="px-6">Timestamp</TableHead>
										<TableHead className="px-6">User</TableHead>
										<TableHead className="px-6">Action</TableHead>
										<TableHead className="px-6">Entity</TableHead>
										<TableHead className="px-6">Entity ID</TableHead>
										<TableHead className="px-6">IP Address</TableHead>
										<TableHead className="px-6">Detail</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loading ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="h-24 px-6 text-center text-muted-foreground"
											>
												Loading audit logs...
											</TableCell>
										</TableRow>
									) : auditLogs.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="h-24 px-6 text-center text-muted-foreground"
											>
												No audit logs found.
											</TableCell>
										</TableRow>
									) : (
										auditLogs.map((log) => (
											<TableRow
												key={log.auditLogId}
												className="cursor-pointer transition-colors hover:bg-muted/50"
												onClick={() => handleViewDetail(log)}
											>
												<TableCell className="px-6">
													{formatDate(log.createdAt)}
												</TableCell>
												<TableCell className="px-6">
													<div className="flex flex-col">
														<span className="font-medium">
															{log.userName || truncateId(log.userId)}
														</span>
														{log.role && (
															<span className="text-xs text-muted-foreground">
																{log.role}
															</span>
														)}
													</div>
												</TableCell>
												<TableCell className="px-6">
													<Badge
														variant="outline"
														className={getActionBadgeColor(log.action)}
													>
														{log.action}
													</Badge>
												</TableCell>
												<TableCell className="px-6">{log.entity}</TableCell>
												<TableCell className="px-6 font-mono text-xs">
													{log.entityId}
												</TableCell>
												<TableCell className="px-6 font-mono text-xs">
													{log.ipAddress}
												</TableCell>
												<TableCell className="px-6">
													<Button
														variant="ghost"
														size="icon"
														className="rounded-lg"
														onClick={(e) => {
															e.stopPropagation();
															handleViewDetail(log);
														}}
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

						{pagination && (
							<div
								className="mt-4 flex items-center justify-between px-6 text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								<div>
									Showing{" "}
									<span className="font-semibold tabular-nums text-foreground">
										{(pagination.currentPage - 1) * pageSize + 1}
									</span>{" "}
									-{" "}
									<span className="font-semibold tabular-nums text-foreground">
										{Math.min(
											pagination.currentPage * pageSize,
											pagination.totalCount,
										)}
									</span>{" "}
									of{" "}
									<span className="font-semibold tabular-nums text-foreground">
										{pagination.totalCount}
									</span>{" "}
									entries
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon"
										className="rounded-lg h-8 w-8"
										disabled={!pagination.hasPrevPage || loading}
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<span>
										Page{" "}
										<span className="font-semibold tabular-nums text-foreground">
											{pagination.currentPage}
										</span>{" "}
										of {pagination.totalPages}
									</span>
									<Button
										variant="outline"
										size="icon"
										className="rounded-lg h-8 w-8"
										disabled={!pagination.hasNextPage || loading}
										onClick={() =>
											setCurrentPage((p) =>
												pagination ? Math.min(pagination.totalPages, p + 1) : p,
											)
										}
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Detail Modal */}
				<Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
					<DialogContent
						className="max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border bg-background shadow-xl"
						style={{ maxWidth: "min(95vw, 1400px)" }}
					>
						{selectedLog && (
							<>
								<DialogHeader className="border-b bg-muted/50 pb-4">
									<div className="flex items-center justify-between gap-4">
										<div>
											<DialogTitle
												className="text-2xl font-semibold"
												style={{ fontFamily: "var(--dashboard-display)" }}
											>
												Audit Log Detail
											</DialogTitle>
											<p
												className="mt-1 text-sm text-muted-foreground"
												style={{ fontFamily: "var(--dashboard-body)" }}
											>
												{selectedLog.entity} - {selectedLog.entityId}
											</p>
										</div>
										<Badge
											variant="outline"
											className={getActionBadgeColor(selectedLog.action)}
										>
											{selectedLog.action}
										</Badge>
									</div>
								</DialogHeader>
								<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
									<div className="space-y-6">
										{/* Summary Cards */}
										<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
											<Card className="rounded-xl">
												<CardContent className="pt-6">
													<div className="flex items-center gap-2 mb-2">
														<Clock className="h-4 w-4 text-muted-foreground" />
														<span
															className="text-xs text-muted-foreground uppercase"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Timestamp
														</span>
													</div>
													<p
														className="text-lg font-semibold"
														style={{ fontFamily: "var(--dashboard-display)" }}
													>
														{formatDate(selectedLog.createdAt)}
													</p>
												</CardContent>
											</Card>
											<Card className="rounded-xl">
												<CardContent className="pt-6">
													<div className="flex items-center gap-2 mb-2">
														<UserIcon className="h-4 w-4 text-muted-foreground" />
														<span
															className="text-xs text-muted-foreground uppercase"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															User
														</span>
													</div>
													<p
														className="text-lg font-semibold"
														style={{ fontFamily: "var(--dashboard-display)" }}
													>
														{selectedLog.userName ||
															truncateId(selectedLog.userId)}
													</p>
													{selectedLog.role && (
														<p
															className="text-sm text-muted-foreground mt-1"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															{selectedLog.role}
														</p>
													)}
												</CardContent>
											</Card>
											<Card className="rounded-xl">
												<CardContent className="pt-6">
													<div className="flex items-center gap-2 mb-2">
														<Box className="h-4 w-4 text-muted-foreground" />
														<span
															className="text-xs text-muted-foreground uppercase"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Entity
														</span>
													</div>
													<p
														className="text-lg font-semibold"
														style={{ fontFamily: "var(--dashboard-display)" }}
													>
														{selectedLog.entity} ({selectedLog.entityId})
													</p>
												</CardContent>
											</Card>
											<Card className="rounded-xl">
												<CardContent className="pt-6">
													<div className="flex items-center gap-2 mb-2">
														<Globe className="h-4 w-4 text-muted-foreground" />
														<span
															className="text-xs text-muted-foreground uppercase"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															IP Address
														</span>
													</div>
													<p
														className="text-lg font-semibold font-mono text-xs"
														style={{ fontFamily: "var(--dashboard-display)" }}
													>
														{selectedLog.ipAddress}
													</p>
												</CardContent>
											</Card>
											<Card className="rounded-xl">
												<CardContent className="pt-6">
													<div className="flex items-center gap-2 mb-2">
														<Monitor className="h-4 w-4 text-muted-foreground" />
														<span
															className="text-xs text-muted-foreground uppercase"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															User Agent
														</span>
													</div>
													<p
														className="text-sm font-semibold truncate"
														title={selectedLog.userAgent}
														style={{ fontFamily: "var(--dashboard-body)" }}
													>
														{selectedLog.userAgent}
													</p>
												</CardContent>
											</Card>
										</div>

										{/* Changes Table */}
										<div>
											<h3
												className="text-lg font-semibold mb-4"
												style={{ fontFamily: "var(--dashboard-display)" }}
											>
												Changes
											</h3>
											<div className="rounded-xl border overflow-x-auto">
												<Table>
													<TableHeader>
														<TableRow className="hover:bg-transparent">
															<TableHead className="px-6">Field</TableHead>
															<TableHead className="px-6">Old Value</TableHead>
															<TableHead className="px-6">New Value</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{selectedLog.oldData && selectedLog.newData ? (
															Object.keys({
																...selectedLog.oldData,
																...selectedLog.newData,
															}).map((key) => {
																const oldValue = selectedLog.oldData?.[key];
																const newValue = selectedLog.newData?.[key];
																const hasChanged =
																	JSON.stringify(oldValue) !==
																	JSON.stringify(newValue);

																return (
																	<TableRow
																		key={key}
																		className="transition-colors hover:bg-muted/50"
																	>
																		<TableCell className="px-6">
																			<div className="flex items-center gap-2">
																				{hasChanged && (
																					<span className="h-2 w-2 rounded-full bg-orange-500" />
																				)}
																				<span className="font-medium">
																					{key}
																				</span>
																			</div>
																		</TableCell>
																		<TableCell className="px-6 min-w-[200px] max-w-[300px]">
																			{oldValue !== null &&
																			oldValue !== undefined ? (
																				<span
																					className={
																						hasChanged
																							? "text-red-600 font-mono text-xs break-all"
																							: "font-mono text-xs break-all"
																					}
																				>
																					{typeof oldValue === "object"
																						? JSON.stringify(oldValue, null, 2)
																						: String(oldValue)}
																				</span>
																			) : (
																				<span className="text-muted-foreground italic">
																					null
																				</span>
																			)}
																		</TableCell>
																		<TableCell className="px-6 min-w-[200px] max-w-[300px]">
																			{newValue !== null &&
																			newValue !== undefined ? (
																				<span
																					className={
																						hasChanged
																							? "text-green-600 font-mono text-xs break-all"
																							: "font-mono text-xs break-all"
																					}
																				>
																					{typeof newValue === "object"
																						? JSON.stringify(newValue, null, 2)
																						: String(newValue)}
																				</span>
																			) : (
																				<span className="text-muted-foreground italic">
																					null
																				</span>
																			)}
																		</TableCell>
																	</TableRow>
																);
															})
														) : selectedLog.oldData ? (
															<TableRow>
																<TableCell
																	colSpan={3}
																	className="px-6 text-center text-muted-foreground"
																>
																	Deleted entity data
																</TableCell>
															</TableRow>
														) : selectedLog.newData ? (
															<TableRow>
																<TableCell
																	colSpan={3}
																	className="px-6 text-center text-muted-foreground"
																>
																	Created entity data
																</TableCell>
															</TableRow>
														) : (
															<TableRow>
																<TableCell
																	colSpan={3}
																	className="px-6 text-center text-muted-foreground"
																>
																	No changes data available
																</TableCell>
															</TableRow>
														)}
													</TableBody>
												</Table>
											</div>
										</div>
									</div>
								</ScrollArea>
							</>
						)}
					</DialogContent>
				</Dialog>
			</div>
		</main>
	);
}
