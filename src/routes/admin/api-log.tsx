import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Activity,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Eye,
	ArrowDownToLine,
	ArrowUpFromLine,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ES_ADVANCE_NOTICE_LOGS_QUERY,
	ES_ITEM_RECEIPTS_QUERY,
	type EsAdvanceNoticeLog,
	type EsAdvanceNoticeLogsQueryData,
	type EsAdvanceNoticeLogsQueryVariables,
	type EsItemReceipt,
	type EsItemReceiptsQueryData,
	type EsItemReceiptsQueryVariables,
} from "@/lib/graphql/es-api-logs";

export const Route = createFileRoute("/admin/api-log")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Audit Log"]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "API Log - SME Edaran WMS",
				description:
					"View all inbound and outbound third-party API calls for the ES (Empire Sushi / NetSuite) integration.",
			},
		],
	}),
});

const PAGE_SIZE = 20;

function formatDate(dateString: string) {
	const date = new Date(dateString);
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const yyyy = date.getFullYear();
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	return `${dd}/${mm}/${yyyy} ${hours}:${minutes}:${seconds}`;
}

function truncateId(id: string) {
	if (!id || id.length <= 8) return id;
	return `${id.slice(0, 8)}…`;
}

const inboundStatusConfig: Record<
	string,
	{ label: string; className: string }
> = {
	success: {
		label: "Success",
		className: "bg-green-500/10 text-green-600 border-green-500/20",
	},
	validation_error: {
		label: "Validation Error",
		className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
	},
	duplicate: {
		label: "Duplicate",
		className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
	},
	error: {
		label: "Error",
		className: "bg-red-500/10 text-red-600 border-red-500/20",
	},
};

function getInboundStatusBadge(status: string) {
	const config = inboundStatusConfig[status] ?? {
		label: status,
		className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
	};
	return (
		<Badge variant="outline" className={config.className}>
			{config.label}
		</Badge>
	);
}

function getOutboundStatusBadge(nsResponse: Record<string, unknown> | null) {
	const isSuccess = nsResponse?.success === true;
	return isSuccess ? (
		<Badge
			variant="outline"
			className="bg-green-500/10 text-green-600 border-green-500/20"
		>
			Success
		</Badge>
	) : (
		<Badge
			variant="outline"
			className="bg-red-500/10 text-red-600 border-red-500/20"
		>
			Error
		</Badge>
	);
}

// ============================================
// INBOUND TAB
// ============================================

function InboundTab() {
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [selectedStatus, setSelectedStatus] = useState("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedLog, setSelectedLog] = useState<EsAdvanceNoticeLog | null>(
		null,
	);
	const [isDetailOpen, setIsDetailOpen] = useState(false);

	const filter = useMemo(() => {
		const f: EsAdvanceNoticeLogsQueryVariables["filter"] = {};
		if (dateFrom) f.dateFrom = dateFrom;
		if (dateTo) f.dateTo = dateTo;
		if (selectedStatus !== "all") f.status = selectedStatus;
		return f;
	}, [dateFrom, dateTo, selectedStatus]);

	const inboundVars: EsAdvanceNoticeLogsQueryVariables = {
		filter,
		pageSize: PAGE_SIZE,
		pageNumber: currentPage,
	};
	const { data, isLoading: loading, error } = useQuery({
		queryKey: [...qk.esApiLogs.all, "inbound", inboundVars] as const,
		queryFn: () =>
			gqlRequest<
				EsAdvanceNoticeLogsQueryData,
				EsAdvanceNoticeLogsQueryVariables
			>(ES_ADVANCE_NOTICE_LOGS_QUERY, inboundVars),
	});

	const logs = data?.esAdvanceNoticeLogs.query ?? [];
	const pagination = data?.esAdvanceNoticeLogs.pagination;

	return (
		<>
			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle
								className="text-xl"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Inbound Requests
							</CardTitle>
							<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
								All advance notice requests received from NetSuite
							</CardDescription>
						</div>
						<div className="flex flex-wrap gap-2 items-center">
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<Label htmlFor="in-dateFrom" className="text-xs whitespace-nowrap">
									From
								</Label>
								<Input
									id="in-dateFrom"
									type="date"
									value={dateFrom}
									onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
									className="w-[140px] rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Label htmlFor="in-dateTo" className="text-xs whitespace-nowrap">
									To
								</Label>
								<Input
									id="in-dateTo"
									type="date"
									value={dateTo}
									onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
									className="w-[140px] rounded-lg border-muted-foreground/20"
								/>
							</div>
							<Select
								value={selectedStatus}
								onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
							>
								<SelectTrigger className="w-[180px] rounded-lg border-muted-foreground/20">
									<SelectValue placeholder="All Statuses" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Statuses</SelectItem>
									<SelectItem value="success">Success</SelectItem>
									<SelectItem value="validation_error">Validation Error</SelectItem>
									<SelectItem value="duplicate">Duplicate</SelectItem>
									<SelectItem value="error">Error</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-0 pb-6">
					{error && (
						<div className="mx-6 mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
							Error loading logs: {(error as Error).message}
						</div>
					)}
					<div className="overflow-x-auto rounded-lg border mx-6">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="px-6">Received At</TableHead>
									<TableHead className="px-6">Tran ID</TableHead>
									<TableHead className="px-6">Status</TableHead>
									<TableHead className="px-6">Error</TableHead>
									<TableHead className="px-6">Detail</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell colSpan={5} className="h-24 px-6 text-center text-muted-foreground">
											Loading…
										</TableCell>
									</TableRow>
								) : logs.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="h-24 px-6 text-center text-muted-foreground">
											No records found.
										</TableCell>
									</TableRow>
								) : (
									logs.map((log) => (
										<TableRow
											key={log.id}
											className="cursor-pointer transition-colors hover:bg-muted/50"
											onClick={() => { setSelectedLog(log); setIsDetailOpen(true); }}
										>
											<TableCell className="px-6 tabular-nums">
												{formatDate(log.receivedAt)}
											</TableCell>
											<TableCell className="px-6 font-mono text-xs">
												{(log.rawPayload?.tranid as string) ?? "—"}
											</TableCell>
											<TableCell className="px-6">
												{getInboundStatusBadge(log.status)}
											</TableCell>
											<TableCell className="px-6 max-w-[260px] truncate text-xs text-muted-foreground" title={log.errorMessage ?? ""}>
												{log.errorMessage ?? "—"}
											</TableCell>
											<TableCell className="px-6">
												<Button
													variant="ghost"
													size="icon"
													className="rounded-lg"
													onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setIsDetailOpen(true); }}
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
						<div className="mt-4 flex items-center justify-between px-6 text-sm text-muted-foreground" style={{ fontFamily: "var(--dashboard-body)" }}>
							<div>
								Showing{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{(pagination.currentPage - 1) * PAGE_SIZE + 1}
								</span>{" "}
								–{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{Math.min(pagination.currentPage * PAGE_SIZE, pagination.totalCount)}
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
									onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Inbound Detail Dialog */}
			<Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
				<DialogContent
					className="max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border bg-background shadow-xl"
					style={{ maxWidth: "min(95vw, 900px)" }}
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
											Advance Notice Request
										</DialogTitle>
										<p className="mt-1 text-sm text-muted-foreground font-mono">
											{formatDate(selectedLog.receivedAt)}
										</p>
									</div>
									{getInboundStatusBadge(selectedLog.status)}
								</div>
							</DialogHeader>
							<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
								<div className="space-y-6 pt-2">
									<div className="grid grid-cols-2 gap-4">
										<Card className="rounded-xl">
											<CardContent className="pt-5">
												<p className="text-xs text-muted-foreground uppercase mb-1">Tran ID</p>
												<p className="font-mono font-semibold">
													{(selectedLog.rawPayload?.tranid as string) ?? "—"}
												</p>
											</CardContent>
										</Card>
										<Card className="rounded-xl">
											<CardContent className="pt-5">
												<p className="text-xs text-muted-foreground uppercase mb-1">API Key ID</p>
												<p className="font-mono text-sm">
													{selectedLog.apiKeyId ? truncateId(selectedLog.apiKeyId) : "—"}
												</p>
											</CardContent>
										</Card>
										{selectedLog.advanceNoticeId && (
											<Card className="rounded-xl col-span-2">
												<CardContent className="pt-5">
													<p className="text-xs text-muted-foreground uppercase mb-1">Advance Notice ID</p>
													<p className="font-mono text-sm">{selectedLog.advanceNoticeId}</p>
												</CardContent>
											</Card>
										)}
										{selectedLog.errorMessage && (
											<Card className="rounded-xl col-span-2 border-red-500/20">
												<CardContent className="pt-5">
													<p className="text-xs text-red-500 uppercase mb-1">Error</p>
													<p className="text-sm text-red-600">{selectedLog.errorMessage}</p>
												</CardContent>
											</Card>
										)}
									</div>
									<div>
										<h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
											Raw Payload
										</h3>
										<pre className="text-[11px] leading-relaxed font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
											{JSON.stringify(selectedLog.rawPayload, null, 2)}
										</pre>
									</div>
								</div>
							</ScrollArea>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

// ============================================
// OUTBOUND TAB
// ============================================

function OutboundTab() {
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [poNumber, setPoNumber] = useState("");
	const [selectedStatus, setSelectedStatus] = useState("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedReceipt, setSelectedReceipt] = useState<EsItemReceipt | null>(null);
	const [isDetailOpen, setIsDetailOpen] = useState(false);

	const filter = useMemo(() => {
		const f: EsItemReceiptsQueryVariables["filter"] = {};
		if (dateFrom) f.dateFrom = dateFrom;
		if (dateTo) f.dateTo = dateTo;
		if (poNumber.trim()) f.poNumber = poNumber.trim();
		if (selectedStatus !== "all") f.status = selectedStatus;
		return f;
	}, [dateFrom, dateTo, poNumber, selectedStatus]);

	const outboundVars: EsItemReceiptsQueryVariables = {
		filter,
		pageSize: PAGE_SIZE,
		pageNumber: currentPage,
	};
	const { data, isLoading: loading, error } = useQuery({
		queryKey: [...qk.esApiLogs.all, "outbound", outboundVars] as const,
		queryFn: () =>
			gqlRequest<EsItemReceiptsQueryData, EsItemReceiptsQueryVariables>(
				ES_ITEM_RECEIPTS_QUERY,
				outboundVars,
			),
	});

	const receipts = data?.esItemReceipts.query ?? [];
	const pagination = data?.esItemReceipts.pagination;

	return (
		<>
			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle
								className="text-xl"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Outbound Requests
							</CardTitle>
							<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
								All item receipts sent to NetSuite
							</CardDescription>
						</div>
						<div className="flex flex-wrap gap-2 items-center">
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<Label htmlFor="out-dateFrom" className="text-xs whitespace-nowrap">
									From
								</Label>
								<Input
									id="out-dateFrom"
									type="date"
									value={dateFrom}
									onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
									className="w-[140px] rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Label htmlFor="out-dateTo" className="text-xs whitespace-nowrap">
									To
								</Label>
								<Input
									id="out-dateTo"
									type="date"
									value={dateTo}
									onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
									className="w-[140px] rounded-lg border-muted-foreground/20"
								/>
							</div>
							<Input
								placeholder="Search PO number…"
								value={poNumber}
								onChange={(e) => { setPoNumber(e.target.value); setCurrentPage(1); }}
								className="w-[180px] rounded-lg border-muted-foreground/20"
							/>
							<Select
								value={selectedStatus}
								onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
							>
								<SelectTrigger className="w-[150px] rounded-lg border-muted-foreground/20">
									<SelectValue placeholder="All Statuses" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Statuses</SelectItem>
									<SelectItem value="success">Success</SelectItem>
									<SelectItem value="error">Error</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-0 pb-6">
					{error && (
						<div className="mx-6 mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
							Error loading records: {(error as Error).message}
						</div>
					)}
					<div className="overflow-x-auto rounded-lg border mx-6">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="px-6">Sent At</TableHead>
									<TableHead className="px-6">PO Number</TableHead>
									<TableHead className="px-6">Advance Notice ID</TableHead>
									<TableHead className="px-6">Status</TableHead>
									<TableHead className="px-6">Detail</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell colSpan={5} className="h-24 px-6 text-center text-muted-foreground">
											Loading…
										</TableCell>
									</TableRow>
								) : receipts.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="h-24 px-6 text-center text-muted-foreground">
											No records found.
										</TableCell>
									</TableRow>
								) : (
									receipts.map((receipt) => (
										<TableRow
											key={receipt.id}
											className="cursor-pointer transition-colors hover:bg-muted/50"
											onClick={() => { setSelectedReceipt(receipt); setIsDetailOpen(true); }}
										>
											<TableCell className="px-6 tabular-nums">
												{formatDate(receipt.sentAt)}
											</TableCell>
											<TableCell className="px-6 font-mono text-xs">
												{receipt.poNumber ?? "—"}
											</TableCell>
											<TableCell className="px-6 font-mono text-xs">
												{receipt.esAdvanceNoticeId ? truncateId(receipt.esAdvanceNoticeId) : "—"}
											</TableCell>
											<TableCell className="px-6">
												{getOutboundStatusBadge(receipt.nsResponse)}
											</TableCell>
											<TableCell className="px-6">
												<Button
													variant="ghost"
													size="icon"
													className="rounded-lg"
													onClick={(e) => { e.stopPropagation(); setSelectedReceipt(receipt); setIsDetailOpen(true); }}
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
						<div className="mt-4 flex items-center justify-between px-6 text-sm text-muted-foreground" style={{ fontFamily: "var(--dashboard-body)" }}>
							<div>
								Showing{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{(pagination.currentPage - 1) * PAGE_SIZE + 1}
								</span>{" "}
								–{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{Math.min(pagination.currentPage * PAGE_SIZE, pagination.totalCount)}
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
									onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Outbound Detail Dialog */}
			<Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
				<DialogContent
					className="max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border bg-background shadow-xl"
					style={{ maxWidth: "min(95vw, 900px)" }}
				>
					{selectedReceipt && (
						<>
							<DialogHeader className="border-b bg-muted/50 pb-4">
								<div className="flex items-center justify-between gap-4">
									<div>
										<DialogTitle
											className="text-2xl font-semibold"
											style={{ fontFamily: "var(--dashboard-display)" }}
										>
											Item Receipt
										</DialogTitle>
										<p className="mt-1 text-sm text-muted-foreground font-mono">
											{formatDate(selectedReceipt.sentAt)}
										</p>
									</div>
									{getOutboundStatusBadge(selectedReceipt.nsResponse)}
								</div>
							</DialogHeader>
							<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
								<div className="space-y-6 pt-2">
									<div className="grid grid-cols-2 gap-4">
										<Card className="rounded-xl">
											<CardContent className="pt-5">
												<p className="text-xs text-muted-foreground uppercase mb-1">PO Number</p>
												<p className="font-mono font-semibold">
													{selectedReceipt.poNumber ?? "—"}
												</p>
											</CardContent>
										</Card>
										<Card className="rounded-xl">
											<CardContent className="pt-5">
												<p className="text-xs text-muted-foreground uppercase mb-1">Advance Notice ID</p>
												<p className="font-mono text-sm">
													{selectedReceipt.esAdvanceNoticeId ?? "—"}
												</p>
											</CardContent>
										</Card>
									</div>
									<div>
										<h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
											Payload Sent to NetSuite
										</h3>
										<pre className="text-[11px] leading-relaxed font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
											{JSON.stringify(selectedReceipt.payload, null, 2)}
										</pre>
									</div>
									<div>
										<h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
											NetSuite Response
										</h3>
										<pre className="text-[11px] leading-relaxed font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
											{JSON.stringify(selectedReceipt.nsResponse, null, 2)}
										</pre>
									</div>
								</div>
							</ScrollArea>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

// ============================================
// PAGE
// ============================================

function RouteComponent() {
	return (
		<main
			className="api-log-page min-h-screen bg-[var(--dashboard-surface)]"
			aria-labelledby="api-log-page-title"
		>
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<div className="container relative mx-auto space-y-6 p-6">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2.5">
							<div
								className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
								style={{ background: "var(--dashboard-accent)" }}
							>
								<Activity className="h-4.5 w-4.5 text-white" />
							</div>
							<h1
								id="api-log-page-title"
								className="text-2xl font-bold tracking-tight"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								API Log
							</h1>
						</div>
						<div className="pl-11.5 space-y-1.5">
							<p
								className="text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Monitor all inbound and outbound ES / NetSuite integration traffic.
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

				{/* Tabs */}
				<Tabs defaultValue="inbound">
					<TabsList className="mb-4">
						<TabsTrigger value="inbound" className="flex items-center gap-2">
							<ArrowDownToLine className="h-4 w-4" />
							Inbound
						</TabsTrigger>
						<TabsTrigger value="outbound" className="flex items-center gap-2">
							<ArrowUpFromLine className="h-4 w-4" />
							Outbound
						</TabsTrigger>
					</TabsList>
					<TabsContent value="inbound">
						<InboundTab />
					</TabsContent>
					<TabsContent value="outbound">
						<OutboundTab />
					</TabsContent>
				</Tabs>
			</div>
		</main>
	);
}
