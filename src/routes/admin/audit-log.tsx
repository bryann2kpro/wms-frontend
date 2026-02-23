import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
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
	component: RouteComponent,
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

	const { data, loading, error } = useQuery<AuditLogsQueryData, AuditLogsQueryVariables>(
		AUDIT_LOGS_QUERY,
		{
			variables: {
				filter,
				pageSize,
				pageNumber: currentPage,
			},
			fetchPolicy: "cache-and-network",
		}
	);

	const { data: filtersData } = useQuery<AuditLogFiltersQueryData>(
		AUDIT_LOG_FILTERS_QUERY,
		{
			fetchPolicy: "cache-first",
		}
	);

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
		return `${mm}/${dd}/${yyyy} ${hours}:${minutes}:${seconds}`;
	};

	const truncateId = (id: string) => {
		if (id.length <= 8) return id;
		return `${id.slice(0, 8)}...`;
	};

	if (error) {
		return (
			<div className="container mx-auto p-6">
				<div className="rounded-lg border bg-red-500/10 border-red-500/20 text-red-600 px-4 py-3">
					Error loading audit logs: {error.message}
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
					<p className="text-muted-foreground">
						Track all system changes and user activity
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Audit Logs</CardTitle>
							<CardDescription>
								View all system changes and user activity
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="flex gap-2">
								<div className="flex items-center gap-2">
									<Calendar className="h-4 w-4 text-muted-foreground" />
									<Label htmlFor="dateFrom" className="text-xs whitespace-nowrap">
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
										className="w-[140px]"
									/>
								</div>
								<div className="flex items-center gap-2">
									<Label htmlFor="dateTo" className="text-xs whitespace-nowrap">
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
										className="w-[140px]"
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
								<SelectTrigger className="w-[180px]">
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
								<SelectTrigger className="w-[180px]">
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
				<CardContent>
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Timestamp</TableHead>
									<TableHead>User</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Entity</TableHead>
									<TableHead>Entity ID</TableHead>
									<TableHead>IP Address</TableHead>
									<TableHead>Detail</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											Loading audit logs...
										</TableCell>
									</TableRow>
								) : auditLogs.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No audit logs found.
										</TableCell>
									</TableRow>
								) : (
									auditLogs.map((log) => (
										<TableRow
											key={log.auditLogId}
											className="cursor-pointer hover:bg-muted/50"
											onClick={() => handleViewDetail(log)}
										>
											<TableCell>{formatDate(log.createdAt)}</TableCell>
											<TableCell>
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
											<TableCell>
												<Badge
													variant="outline"
													className={getActionBadgeColor(log.action)}
												>
													{log.action}
												</Badge>
											</TableCell>
											<TableCell>{log.entity}</TableCell>
											<TableCell className="font-mono text-xs">
												{log.entityId}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{log.ipAddress}
											</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="icon"
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
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								Showing{" "}
								<span className="font-medium">
									{(pagination.currentPage - 1) * pageSize + 1}
								</span>{" "}
								-{" "}
								<span className="font-medium">
									{Math.min(
										pagination.currentPage * pageSize,
										pagination.totalCount
									)}
								</span>{" "}
								of <span className="font-medium">{pagination.totalCount}</span>{" "}
								entries
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={!pagination.hasPrevPage || loading}
									onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span>
									Page {pagination.currentPage} of {pagination.totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={!pagination.hasNextPage || loading}
									onClick={() =>
										setCurrentPage((p) =>
											pagination
												? Math.min(pagination.totalPages, p + 1)
												: p
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
					className="max-h-[90vh] overflow-y-auto"
					style={{ maxWidth: "min(95vw, 1400px)" }}
				>
					{selectedLog && (
						<>
							<DialogHeader>
								<div className="flex items-center justify-between">
									<div>
										<DialogTitle className="text-2xl">Audit Log Detail</DialogTitle>
										<p className="text-sm text-muted-foreground mt-1">
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
										<Card>
											<CardContent className="pt-6">
												<div className="flex items-center gap-2 mb-2">
													<Clock className="h-4 w-4 text-muted-foreground" />
													<span className="text-xs text-muted-foreground uppercase">
														Timestamp
													</span>
												</div>
												<p className="text-lg font-semibold">
													{formatDate(selectedLog.createdAt)}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="pt-6">
												<div className="flex items-center gap-2 mb-2">
													<UserIcon className="h-4 w-4 text-muted-foreground" />
													<span className="text-xs text-muted-foreground uppercase">
														User
													</span>
												</div>
												<p className="text-lg font-semibold">
													{selectedLog.userName || truncateId(selectedLog.userId)}
												</p>
												{selectedLog.role && (
													<p className="text-sm text-muted-foreground mt-1">
														{selectedLog.role}
													</p>
												)}
											</CardContent>
										</Card>
										<Card>
											<CardContent className="pt-6">
												<div className="flex items-center gap-2 mb-2">
													<Box className="h-4 w-4 text-muted-foreground" />
													<span className="text-xs text-muted-foreground uppercase">
														Entity
													</span>
												</div>
												<p className="text-lg font-semibold">
													{selectedLog.entity} ({selectedLog.entityId})
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="pt-6">
												<div className="flex items-center gap-2 mb-2">
													<Globe className="h-4 w-4 text-muted-foreground" />
													<span className="text-xs text-muted-foreground uppercase">
														IP Address
													</span>
												</div>
												<p className="text-lg font-semibold font-mono text-xs">
													{selectedLog.ipAddress}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="pt-6">
												<div className="flex items-center gap-2 mb-2">
													<Monitor className="h-4 w-4 text-muted-foreground" />
													<span className="text-xs text-muted-foreground uppercase">
														User Agent
													</span>
												</div>
												<p className="text-sm font-semibold truncate" title={selectedLog.userAgent}>
													{selectedLog.userAgent}
												</p>
											</CardContent>
										</Card>
									</div>

									{/* Changes Table */}
									<div>
										<h3 className="text-lg font-semibold mb-4">Changes</h3>
										<div className="rounded-lg border overflow-x-auto">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Field</TableHead>
														<TableHead>Old Value</TableHead>
														<TableHead>New Value</TableHead>
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
																JSON.stringify(oldValue) !== JSON.stringify(newValue);
															
															return (
																<TableRow key={key}>
																	<TableCell>
																		<div className="flex items-center gap-2">
																			{hasChanged && (
																				<span className="h-2 w-2 rounded-full bg-orange-500" />
																			)}
																			<span className="font-medium">{key}</span>
																		</div>
																	</TableCell>
																	<TableCell className="min-w-[200px] max-w-[300px]">
																		{oldValue !== null && oldValue !== undefined ? (
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
																	<TableCell className="min-w-[200px] max-w-[300px]">
																		{newValue !== null && newValue !== undefined ? (
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
															<TableCell colSpan={3} className="text-center text-muted-foreground">
																Deleted entity data
															</TableCell>
														</TableRow>
													) : selectedLog.newData ? (
														<TableRow>
															<TableCell colSpan={3} className="text-center text-muted-foreground">
																Created entity data
															</TableCell>
														</TableRow>
													) : (
														<TableRow>
															<TableCell colSpan={3} className="text-center text-muted-foreground">
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
	);
}
