import { useState, useCallback, useMemo, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation as useApolloMutation, useQuery as useApolloQuery } from "@apollo/client/react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import {
	Search,
	ChevronLeft,
	ChevronRight,
	PackageSearch,
	Plus,
	Lock,
	CheckCircle2,
	Clock,
	Layers,
	TrendingDown,
	TrendingUp,
	Minus,
	ShieldCheck,
	ClipboardList,
	HelpCircle,
	ImageOff,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useStockUnitName } from "@/lib/hooks/use-stock-unit";
import {
	STOCK_COUNT_SESSIONS_QUERY,
	STOCK_COUNT_SESSION_ITEMS_QUERY,
	CREATE_STOCK_COUNT_SESSION_MUTATION,
	UPDATE_STOCK_COUNT_ITEM_MUTATION,
	CLOSE_STOCK_COUNT_SESSION_MUTATION,
	type StockCountSession,
	type StockCountItem,
	type StockCountSessionsQueryData,
	type StockCountSessionItemsQueryData,
	type CreateStockCountSessionData,
	type UpdateStockCountItemData,
	type CloseStockCountSessionData,
} from "@/lib/graphql/stock-count-session";

const ACTION_LABELS: Record<string, string> = {
	tally_to_opening: "Tally to Opening",
	tally_to_stock_count: "Tally to Stock Count",
	manual_key_in: "Manual Key-In",
};

const EXCEPTIONS_HELP_STEPS: Array<{
	title: string;
	description: ReactNode;
	image: string;
}> = [
	{
		title: "What this page does",
		image: "/help/exceptions/step-1.png",
		description: (
			<>
				This page manages <strong>Stock Count Sessions</strong> — periodic inventory
				audits that compare physical counts against system records. Discrepancies are
				surfaced here as exceptions to be reviewed and resolved before the session is
				closed.
			</>
		),
	},
	{
		title: "Create a stock count session",
		image: "/help/exceptions/step-2.png",
		description: (
			<>
				Click <strong>New Stock Count</strong> to start a session. A snapshot of all
				current inventory balances is captured automatically. Give the session a
				descriptive name (e.g. "March 2026 Stock Count") so it's easy to identify
				later.
			</>
		),
	},
	{
		title: "Review discrepancies in the Stock Count tab",
		image: "/help/exceptions/step-3.png",
		description: (
			<>
				The <strong>Stock Count</strong> tab lists every SKU with a discrepancy
				between the opening balance and the on-hand count. For each line, choose an
				action: <strong>Tally to Opening</strong>,{" "}
				<strong>Tally to Stock Count</strong>, or{" "}
				<strong>Manual Key-In</strong> to enter a custom quantity.
			</>
		),
	},
	{
		title: "Approve exceptions in the Approval tab",
		image: "/help/exceptions/step-4.png",
		description: (
			<>
				Switch to the <strong>Approval</strong> tab to sign off on each resolved
				line. Items must have an action selected before they can be approved. The
				amber badge on the tab shows how many items still need approval.
			</>
		),
	},
	{
		title: "Close the session",
		image: "/help/exceptions/step-5.png",
		description: (
			<>
				Once all items are approved, the <strong>Close Session</strong> button
				becomes available. Closing is irreversible — it finalises all approved lines
				and locks the session from further editing. Closed sessions remain visible in
				the dropdown for reference.
			</>
		),
	},
];

function HelpStepImage({
	src,
	stepNumber,
	alt,
}: {
	src: string;
	stepNumber: number;
	alt?: string;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
				<span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
					<ImageOff className="h-7 w-7" />
				</span>
				<span className="text-sm text-muted-foreground">
					Add screenshot:{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
						public/help/exceptions/step-{stepNumber}.png
					</code>
				</span>
			</div>
		);
	}
	return (
		<img
			src={src}
			alt={alt ?? ""}
			className="h-full w-full object-contain object-top"
			onError={() => setFailed(true)}
		/>
	);
}

export const Route = createFileRoute("/admin/exceptions")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Exception"]);
	},
	component: ExceptionsComponent,
});

function ExceptionsComponent() {
	const { user } = useCurrentUser();
	const unitName = useStockUnitName();

	// ─── Help dialog state ────────────────────────────────────────
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);

	// ─── Session state ───────────────────────────────────────────
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
	const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
	const [newSessionName, setNewSessionName] = useState("");
	const [isCloseSessionDialogOpen, setIsCloseSessionDialogOpen] = useState(false);

	// ─── Table state ──────────────────────────────────────────────
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");

	// ─── Local optimistic overrides (action + manual amounts) ────
	const [rowActions, setRowActions] = useState<Record<string, string>>({});
	const [rowManualAmounts, setRowManualAmounts] = useState<
		Record<string, { dozen: number; loss: number }>
	>({});

	// ─── Queries ──────────────────────────────────────────────────
	const {
		data: sessionsData,
		loading: sessionsLoading,
		refetch: refetchSessions,
	} = useApolloQuery<StockCountSessionsQueryData>(STOCK_COUNT_SESSIONS_QUERY, {
		variables: { pageSize: 100, pageNumber: 1 },
		onCompleted(data) {
			if (!selectedSessionId && data.stockCountSessions.query.length > 0) {
				setSelectedSessionId(data.stockCountSessions.query[0].id);
			}
		},
	});

	const sessions: StockCountSession[] = sessionsData?.stockCountSessions?.query ?? [];
	const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;

	const {
		data: itemsData,
		loading: itemsLoading,
		refetch: refetchItems,
	} = useApolloQuery<StockCountSessionItemsQueryData>(STOCK_COUNT_SESSION_ITEMS_QUERY, {
		variables: {
			sessionId: selectedSessionId ?? "",
			search: searchTerm || undefined,
			pageSize,
			pageNumber: page,
		},
		skip: !selectedSessionId,
	});

	const items: StockCountItem[] = itemsData?.stockCountSessionItems?.query ?? [];
	const totalItems = itemsData?.stockCountSessionItems?.pagination?.totalCount ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

	// ─── Mutations ────────────────────────────────────────────────
	const [createSession, { loading: creatingSession }] =
		useApolloMutation<CreateStockCountSessionData>(CREATE_STOCK_COUNT_SESSION_MUTATION, {
			onCompleted(data) {
				const newId = data.createStockCountSession.id;
				setSelectedSessionId(newId);
				setIsNewSessionDialogOpen(false);
				setNewSessionName("");
				refetchSessions();
				refetchItems();
			},
		});

	const [updateItem] = useApolloMutation<UpdateStockCountItemData>(
		UPDATE_STOCK_COUNT_ITEM_MUTATION,
		{ onCompleted: () => { refetchItems(); refetchSessions(); } }
	);

	const [closeSession, { loading: closingSession }] =
		useApolloMutation<CloseStockCountSessionData>(CLOSE_STOCK_COUNT_SESSION_MUTATION, {
			onCompleted() {
				setIsCloseSessionDialogOpen(false);
				refetchSessions();
				refetchItems();
			},
		});

	// ─── Handlers ─────────────────────────────────────────────────
	const handleCreateSession = () => {
		const name = newSessionName.trim();
		if (!name) return;
		createSession({ variables: { name } });
	};

	const handleActionChange = useCallback(
		(itemId: string, action: string) => {
			setRowActions((prev) => ({ ...prev, [itemId]: action }));
			updateItem({ variables: { id: itemId, input: { action } } });
		},
		[updateItem]
	);

	const handleManualAmountChange = useCallback(
		(itemId: string, update: { dozen: number; loss: number }) => {
			setRowManualAmounts((prev) => ({ ...prev, [itemId]: update }));
			updateItem({
				variables: {
					id: itemId,
					input: {
						countedQty: update.dozen,
						countedLossQty: update.loss,
					},
				},
			});
		},
		[updateItem]
	);

	const handleApprove = useCallback(
		(itemId: string) => {
			updateItem({ variables: { id: itemId, input: { isApproved: true } } });
		},
		[updateItem]
	);

	const handleCloseSession = () => {
		if (!selectedSessionId) return;
		closeSession({ variables: { id: selectedSessionId } });
	};

	// ─── Summary ──────────────────────────────────────────────────
	const summary = useMemo(() => {
		if (!selectedSession) return null;
		return {
			pending: selectedSession.pendingCount,
			approved: selectedSession.itemCount - selectedSession.pendingCount,
			total: selectedSession.itemCount,
		};
	}, [selectedSession]);

	const isSessionOpen = selectedSession?.status === "open";
	const completionPct =
		summary && summary.total > 0
			? Math.round((summary.approved / summary.total) * 100)
			: 0;

	return (
		<div className="exceptions-page container mx-auto p-6 space-y-5">

			{/* ── Page Header ─────────────────────────────────────────── */}
			<AdminPageHeader
				icon={PackageSearch}
				title="Stock Count Exceptions"
				description="Review and resolve discrepancies from stock count runs."
				titleId="exceptions-title"
				descriptionId="exceptions-description"
				rightSlot={
					<div className="flex items-center gap-2 flex-wrap">
						{sessions.length > 0 && (
							<Select
								value={selectedSessionId ?? ""}
								onValueChange={(v) => {
									setSelectedSessionId(v);
									setPage(1);
									setSearchTerm("");
									setRowActions({});
									setRowManualAmounts({});
								}}
							>
								<SelectTrigger className="h-9 w-64 text-sm border-border/60 bg-background/80">
									<SelectValue placeholder="Select a session…" />
								</SelectTrigger>
								<SelectContent>
									{sessions.map((s) => (
										<SelectItem key={s.id} value={s.id}>
											<span className="flex items-center gap-2">
												{s.status === "closed" ? (
													<Lock className="h-3 w-3 text-muted-foreground shrink-0" />
												) : (
													<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-px" />
												)}
												<span className="font-medium">{s.name}</span>
												<span className="text-muted-foreground text-xs">
													{new Date(s.countDate).toLocaleDateString("en-MY")}
												</span>
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						{selectedSession && isSessionOpen && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<Button
												variant="outline"
												size="sm"
												className="gap-1.5 text-xs h-9 border-border/60 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
												onClick={() => setIsCloseSessionDialogOpen(true)}
												disabled={!summary || summary.pending > 0}
											>
												<Lock className="h-3.5 w-3.5" />
												Close Session
											</Button>
										</span>
									</TooltipTrigger>
									{(!summary || summary.pending > 0) && (
										<TooltipContent side="bottom" className="text-xs max-w-[200px] text-center">
											{summary && summary.pending > 0
												? `${summary.pending} item${summary.pending > 1 ? "s" : ""} still pending approval`
												: "Loading approval status…"}
										</TooltipContent>
									)}
								</Tooltip>
							</TooltipProvider>
						)}

						<Button
							variant="outline"
							size="icon"
							aria-label="Open help"
							className="rounded-lg h-9 w-9"
							onClick={() => {
								setIsHelpOpen(true);
								setHelpStep(0);
							}}
						>
							<HelpCircle className="h-4 w-4" />
						</Button>

						<Button
							size="sm"
							className="gap-1.5 text-xs h-9 rounded-lg"
							style={{ background: "var(--dashboard-accent)", color: "white" }}
							onClick={() => setIsNewSessionDialogOpen(true)}
						>
							<Plus className="h-3.5 w-3.5" />
							New Stock Count
						</Button>
					</div>
				}
			/>

			{/* ── Empty State ──────────────────────────────────────────── */}
			{!sessionsLoading && sessions.length === 0 && (
				<Card className="dashboard-card border-dashed border-amber-200/70 bg-amber-50/30">
					<div className="flex flex-col items-center justify-center py-16 gap-4">
						<div className="relative">
							<div className="absolute -inset-3 rounded-full bg-amber-100/60 blur-md" />
							<div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200/60">
								<PackageSearch className="h-8 w-8 text-amber-500" />
							</div>
						</div>
						<div className="text-center space-y-1.5">
							<p
								className="font-semibold text-base"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								No stock count sessions yet
							</p>
							<p className="text-sm text-muted-foreground max-w-sm">
								Create your first session to capture a snapshot of current inventory.
							</p>
						</div>
						<Button
							onClick={() => setIsNewSessionDialogOpen(true)}
							className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/30 mt-1"
						>
							<Plus className="h-4 w-4" />
							Create First Stock Count
						</Button>
					</div>
				</Card>
			)}

			{/* ── Summary Cards ────────────────────────────────────────── */}
			{summary && (
				<div className="space-y-3">
					<div className="grid gap-3 grid-cols-2 md:grid-cols-4">
						{/* Pending */}
						<Card className="dashboard-card relative overflow-hidden border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-white">
							<div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />
							<CardHeader className="pb-1 pt-4 px-4">
								<div className="flex items-center justify-between">
									<CardTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-amber-700/70">
										Pending
									</CardTitle>
									<div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
										<Clock className="h-3.5 w-3.5 text-amber-600" />
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-4 pb-4">
								<div
									className="text-3xl font-bold tabular-nums tracking-tight text-amber-700"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									{summary.pending}
								</div>
								<p className="mt-1 text-[0.7rem] font-medium text-amber-600/80 uppercase tracking-wider">
									Need decision
								</p>
							</CardContent>
						</Card>

						{/* Approved */}
						<Card className="dashboard-card relative overflow-hidden border-emerald-200/50 bg-gradient-to-br from-emerald-50/60 to-white">
							<div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300" />
							<CardHeader className="pb-1 pt-4 px-4">
								<div className="flex items-center justify-between">
									<CardTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-emerald-700/70">
										Approved
									</CardTitle>
									<div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100">
										<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-4 pb-4">
								<div
									className="text-3xl font-bold tabular-nums tracking-tight text-emerald-700"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									{summary.approved}
								</div>
								<p className="mt-1 text-[0.7rem] font-medium text-emerald-600/80 uppercase tracking-wider">
									Resolved
								</p>
							</CardContent>
						</Card>

						{/* Total Items */}
						<Card
							className="dashboard-card relative overflow-hidden"
							style={{
								borderColor: "color-mix(in oklch, var(--dashboard-accent) 25%, transparent)",
								background: "color-mix(in oklch, var(--dashboard-accent) 4%, white)",
							}}
						>
							<div
								className="absolute top-0 inset-x-0 h-0.5"
								style={{
									background:
										"linear-gradient(to right, var(--dashboard-accent), color-mix(in oklch, var(--dashboard-accent) 50%, transparent))",
								}}
							/>
							<CardHeader className="pb-1 pt-4 px-4">
								<div className="flex items-center justify-between">
									<CardTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-muted-foreground">
										Total Items
									</CardTitle>
									<div
										className="flex h-6 w-6 items-center justify-center rounded-md"
										style={{
											background: "color-mix(in oklch, var(--dashboard-accent) 12%, transparent)",
										}}
									>
										<Layers
											className="h-3.5 w-3.5"
											style={{ color: "var(--dashboard-accent)" }}
										/>
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-4 pb-4">
								<div
									className="text-3xl font-bold tabular-nums tracking-tight"
									style={{
										fontFamily: "var(--dashboard-display)",
										color: "var(--dashboard-accent)",
									}}
								>
									{summary.total}
								</div>
								<p className="mt-1 text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
									In this session
								</p>
							</CardContent>
						</Card>

						{/* Session Status */}
						<Card
							className={`dashboard-card relative overflow-hidden ${
								isSessionOpen
									? "border-sky-200/50 bg-gradient-to-br from-sky-50/50 to-white"
									: "border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-white"
							}`}
						>
							<div
								className={`absolute top-0 inset-x-0 h-0.5 ${
									isSessionOpen
										? "bg-gradient-to-r from-sky-400 via-sky-500 to-sky-300"
										: "bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300"
								}`}
							/>
							<CardHeader className="pb-1 pt-4 px-4">
								<div className="flex items-center justify-between">
									<CardTitle
										className={`text-[0.6875rem] font-semibold uppercase tracking-widest ${
											isSessionOpen ? "text-sky-700/70" : "text-slate-500/70"
										}`}
									>
										Session
									</CardTitle>
									<div
										className={`flex h-6 w-6 items-center justify-center rounded-md ${
											isSessionOpen ? "bg-sky-100" : "bg-slate-100"
										}`}
									>
										{isSessionOpen ? (
											<span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
										) : (
											<Lock className="h-3 w-3 text-slate-400" />
										)}
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-4 pb-4">
								<div
									className={`text-3xl font-bold tracking-tight ${
										isSessionOpen ? "text-sky-700" : "text-slate-500"
									}`}
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									{isSessionOpen ? "Open" : "Closed"}
								</div>
								<p className="mt-1 text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
									{selectedSession?.countDate
										? new Date(selectedSession.countDate).toLocaleDateString("en-MY")
										: "—"}
								</p>
							</CardContent>
						</Card>
					</div>

					{/* Progress bar */}
					{summary.total > 0 && (
						<div className="flex items-center gap-3 px-1">
							<div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
								<div
									className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
									style={{ width: `${completionPct}%` }}
								/>
							</div>
							<span className="text-[0.7rem] font-mono text-muted-foreground shrink-0">
								{completionPct}% resolved
							</span>
						</div>
					)}
				</div>
			)}

			{/* ── Exception Queue Table ─────────────────────────────────── */}
			{selectedSession && (
				<Card className="dashboard-card overflow-hidden border-border/60">
					{/* Card header */}
					<CardHeader className="pb-0 pt-5 px-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<div className="flex items-center gap-2">
									<CardTitle
										className="text-[0.9375rem] font-semibold"
										style={{ fontFamily: "var(--dashboard-display)" }}
									>
										Exception Queue
									</CardTitle>
									<span className="text-muted-foreground font-normal text-sm">
										— {selectedSession.name}
									</span>
									{!isSessionOpen && (
										<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
											<Lock className="h-2.5 w-2.5" />
											Closed
										</span>
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-0.5">
									<span className="font-mono tabular-nums font-medium text-foreground">
										{totalItems}
									</span>{" "}
									line{totalItems !== 1 ? "s" : ""} with discrepancies
								</p>
							</div>

							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
								<Input
									placeholder="Search SKU or description…"
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-8.5 h-9 text-sm sm:w-64 border-border/50 bg-muted/30 focus-visible:bg-background transition-colors"
								/>
							</div>
						</div>
					</CardHeader>

					{/* Thin divider */}
					<div className="mx-5 mt-4 h-px bg-border/40" />

					{/* ── Tabs ─────────────────────────────────────────────── */}
					<Tabs defaultValue="count" className="w-full">
						{/* Tab triggers */}
						<div className="px-5 pt-4">
							<TabsList className="h-8 bg-muted/40 border border-border/30 p-0.5 rounded-lg gap-0.5">
								<TabsTrigger
									value="count"
									className="h-7 rounded-md text-xs px-3 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
								>
									<ClipboardList className="h-3.5 w-3.5" />
									Stock Count
									<span className="rounded-full bg-muted px-1.5 py-px text-[0.65rem] font-mono tabular-nums leading-none">
										{totalItems}
									</span>
								</TabsTrigger>
								<TabsTrigger
									value="approval"
									className="h-7 rounded-md text-xs px-3 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
								>
									<ShieldCheck className="h-3.5 w-3.5" />
									Approval
									{summary && summary.pending > 0 && (
										<span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-px text-[0.65rem] font-mono tabular-nums leading-none">
											{summary.pending}
										</span>
									)}
									{summary && summary.pending === 0 && summary.total > 0 && (
										<span className="rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-px text-[0.65rem] font-mono leading-none">
											✓
										</span>
									)}
								</TabsTrigger>
							</TabsList>
						</div>

						{/* ── Tab 1: Stock Count ─────────────────────────── */}
						<TabsContent value="count" className="mt-0">
							<CardContent className="relative pt-4 px-5 pb-5">
								<GlobalLoadingShadow />
								<div className="overflow-x-auto rounded-xl border border-border/40 bg-white shadow-xs">
									<Table>
										<TableHeader>
											<TableRow className="border-b border-border/50 bg-muted/20 hover:bg-muted/20">
												<TableHead className="w-12 pl-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">#</TableHead>
												<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">SKU</TableHead>
												<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Description</TableHead>
												<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
													Opening
													<span className="block font-normal normal-case tracking-normal text-muted-foreground/50">{unitName} / Loss</span>
												</TableHead>
												<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Count Date</TableHead>
												<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
													On-Hand
													<span className="block font-normal normal-case tracking-normal text-muted-foreground/50">{unitName} / Loss</span>
												</TableHead>
												<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Reserved</TableHead>
												<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
													Diff
													<span className="block font-normal normal-case tracking-normal text-muted-foreground/50">{unitName} / Loss</span>
												</TableHead>
												<TableHead className="pr-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Action</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{itemsLoading ? (
												<TableRow>
													<TableCell colSpan={9} className="h-28 text-center text-sm text-muted-foreground">
														<div className="flex flex-col items-center gap-2">
															<div className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
															<span>Loading inventory…</span>
														</div>
													</TableCell>
												</TableRow>
											) : items.length === 0 ? (
												<TableRow>
													<TableCell colSpan={9} className="h-28 text-center text-sm text-muted-foreground">
														No items found.
													</TableCell>
												</TableRow>
											) : (
												items.map((item, index) => {
													const selectedAction = rowActions[item.id] ?? item.action ?? "";
													const isManualKeyIn = selectedAction === "manual_key_in";
													const displayDozen = rowManualAmounts[item.id]?.dozen ?? item.countedQty ?? item.onHandQty;
													const displayLoss = rowManualAmounts[item.id]?.loss ?? item.countedLossQty ?? item.onHandLossQty;
													const diffDozen = item.qtyDifference;
													const diffLoss = item.lossQtyDifference;
													const hasDiff = diffDozen !== 0 || diffLoss !== 0;
													const isShortage = diffDozen > 0 || diffLoss > 0;
													return (
														<TableRow key={item.id} className="border-b border-border/30 transition-colors last:border-0 bg-white hover:bg-muted/20">
															<TableCell className="pl-4 pr-2 w-12 py-3">
																<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted/50 text-[0.6875rem] font-mono font-medium text-muted-foreground">
																	{(page - 1) * pageSize + index + 1}
																</span>
															</TableCell>
															<TableCell className="py-3">
																<span className="inline-block rounded bg-slate-100/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 tracking-wide">
																	{item.skuCode}
																</span>
															</TableCell>
															<TableCell className="max-w-[180px] py-3">
																<span className="block truncate text-sm text-foreground/80" title={item.skuDescription}>{item.skuDescription}</span>
															</TableCell>
															<TableCell className="text-center py-3">
																<span className="font-mono text-sm tabular-nums text-foreground/70">
																	{item.openingQty}<span className="mx-1 text-border">/</span>{item.openingLossQty}
																</span>
															</TableCell>
															<TableCell className="py-3">
																<span className="text-xs text-muted-foreground font-mono">
																	{new Date(selectedSession.countDate).toLocaleDateString("en-MY")}
																</span>
															</TableCell>
															<TableCell className="text-center py-3">
																{isManualKeyIn ? (
																	<div className="flex items-center justify-center gap-1">
																		<Input type="number" min={0} className="h-7 w-14 text-center text-xs font-mono px-1 border-amber-200 focus-visible:ring-amber-400/30" placeholder={String(item.onHandQty)} value={displayDozen} onChange={(e) => { const v = e.target.value; handleManualAmountChange(item.id, { dozen: v === "" ? 0 : Number(v), loss: displayLoss }); }} />
																		<span className="text-muted-foreground/50 text-xs">/</span>
																		<Input type="number" min={0} className="h-7 w-14 text-center text-xs font-mono px-1 border-amber-200 focus-visible:ring-amber-400/30" placeholder={String(item.onHandLossQty)} value={displayLoss} onChange={(e) => { const v = e.target.value; handleManualAmountChange(item.id, { dozen: displayDozen, loss: v === "" ? 0 : Number(v) }); }} />
																	</div>
																) : (
																	<span className="font-mono text-sm tabular-nums text-foreground/70">
																		{item.onHandQty}<span className="mx-1 text-border">/</span>{item.onHandLossQty}
																	</span>
																)}
															</TableCell>
															<TableCell className="text-center py-3">
																<span className="inline-flex min-w-[2rem] items-center justify-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-600">
																	{item.reservedQty}
																</span>
															</TableCell>
															<TableCell className="text-center py-3">
																<span className={["inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums", hasDiff ? isShortage ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-muted/40 text-muted-foreground ring-1 ring-border/40"].join(" ")}>
																	{hasDiff && (isShortage ? <TrendingDown className="h-3 w-3 shrink-0" /> : <TrendingUp className="h-3 w-3 shrink-0" />)}
																	{!hasDiff && <Minus className="h-3 w-3 shrink-0" />}
																	<span>{diffDozen > 0 ? `-${diffDozen}` : diffDozen}</span>
																	<span className="mx-0.5 opacity-40">/</span>
																	<span>{diffLoss > 0 ? `-${diffLoss}` : diffLoss}</span>
																</span>
															</TableCell>
															<TableCell className="pr-4 py-3">
																<Select value={selectedAction} onValueChange={(value) => handleActionChange(item.id, value)} disabled={!isSessionOpen}>
																	<SelectTrigger className={`h-7 w-[168px] rounded-lg text-xs border-border/50 bg-muted/20 transition-colors ${selectedAction ? "text-foreground" : "text-muted-foreground"}`}>
																		<SelectValue placeholder="Select action…" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="tally_to_opening" className="text-xs">Tally to Opening</SelectItem>
																		<SelectItem value="tally_to_stock_count" className="text-xs">Tally to Stock Count</SelectItem>
																		<SelectItem value="manual_key_in" className="text-xs">Manual Key-In</SelectItem>
																	</SelectContent>
																</Select>
															</TableCell>
														</TableRow>
													);
												})
											)}
										</TableBody>
									</Table>
								</div>
								{/* Pagination */}
								<div className="mt-4 flex items-center justify-between">
									<p className="text-[0.75rem] text-muted-foreground">
										Showing{" "}
										<span className="font-mono font-medium text-foreground">{(page - 1) * pageSize + 1}</span>
										{"–"}
										<span className="font-mono font-medium text-foreground">{Math.min(page * pageSize, totalItems)}</span>
										{" "}of{" "}
										<span className="font-mono font-medium text-foreground">{totalItems}</span>
									</p>
									<div className="flex items-center gap-1.5">
										<Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-border/50" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
											<ChevronLeft className="h-3.5 w-3.5" />
										</Button>
										<span className="min-w-[5rem] text-center text-[0.75rem] text-muted-foreground">
											<span className="font-mono font-medium text-foreground">{page}</span>{" / "}<span className="font-mono">{totalPages}</span>
										</span>
										<Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-border/50" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
											<ChevronRight className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							</CardContent>
						</TabsContent>

						{/* ── Tab 2: Approval ────────────────────────────── */}
						<TabsContent value="approval" className="mt-0">
							<CardContent className="relative pt-4 px-5 pb-5">
								<div className="overflow-x-auto rounded-xl border border-border/40 bg-white shadow-xs">
									<Table>
										<TableHeader>
											<TableRow className="border-b border-border/50 bg-muted/20 hover:bg-muted/20">
												<TableHead className="w-12 pl-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">#</TableHead>
												<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">SKU</TableHead>
												<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Description</TableHead>
												<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
													Diff
													<span className="block font-normal normal-case tracking-normal text-muted-foreground/50">{unitName} / Loss</span>
												</TableHead>
												<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Chosen Action</TableHead>
												<TableHead className="text-center pr-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Status</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{itemsLoading ? (
												<TableRow>
													<TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
														<div className="flex flex-col items-center gap-2">
															<div className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
															<span>Loading inventory…</span>
														</div>
													</TableCell>
												</TableRow>
											) : items.length === 0 ? (
												<TableRow>
													<TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
														No items found.
													</TableCell>
												</TableRow>
											) : (
												items.map((item, index) => {
													const selectedAction = rowActions[item.id] ?? item.action ?? "";
													const diffDozen = item.qtyDifference;
													const diffLoss = item.lossQtyDifference;
													const hasDiff = diffDozen !== 0 || diffLoss !== 0;
													const isShortage = diffDozen > 0 || diffLoss > 0;
													const actionLabel = selectedAction ? ACTION_LABELS[selectedAction] : null;
													return (
														<TableRow key={item.id} className={`border-b border-border/30 transition-colors last:border-0 ${item.isApproved ? "bg-emerald-50/40 hover:bg-emerald-50/60" : "bg-white hover:bg-amber-50/30"}`}>
															<TableCell className="pl-4 pr-2 w-12 py-3.5">
																<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted/50 text-[0.6875rem] font-mono font-medium text-muted-foreground">
																	{(page - 1) * pageSize + index + 1}
																</span>
															</TableCell>
															<TableCell className="py-3.5">
																<span className="inline-block rounded bg-slate-100/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 tracking-wide">
																	{item.skuCode}
																</span>
															</TableCell>
															<TableCell className="max-w-[200px] py-3.5">
																<span className="block truncate text-sm text-foreground/80" title={item.skuDescription}>{item.skuDescription}</span>
															</TableCell>
															<TableCell className="text-center py-3.5">
																<span className={["inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums", hasDiff ? isShortage ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-muted/40 text-muted-foreground ring-1 ring-border/40"].join(" ")}>
																	{hasDiff && (isShortage ? <TrendingDown className="h-3 w-3 shrink-0" /> : <TrendingUp className="h-3 w-3 shrink-0" />)}
																	{!hasDiff && <Minus className="h-3 w-3 shrink-0" />}
																	<span>{diffDozen > 0 ? `-${diffDozen}` : diffDozen}</span>
																	<span className="mx-0.5 opacity-40">/</span>
																	<span>{diffLoss > 0 ? `-${diffLoss}` : diffLoss}</span>
																</span>
															</TableCell>
															<TableCell className="py-3.5">
																{actionLabel ? (
																	<span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
																		{actionLabel}
																	</span>
																) : (
																	<span className="text-xs text-muted-foreground/50 italic">Not set</span>
																)}
															</TableCell>
															<TableCell className="text-center pr-4 py-3.5">
																{item.isApproved ? (
																	<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-300/50">
																		<CheckCircle2 className="h-3 w-3" />
																		Approved
																	</span>
																) : (
																	<Button variant="outline" size="sm" onClick={() => handleApprove(item.id)} disabled={!selectedAction || !isSessionOpen} className={`h-7 px-3 text-xs rounded-lg transition-all ${selectedAction && isSessionOpen ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400" : ""}`}>
																		<ShieldCheck className="h-3 w-3 mr-1" />
																		Approve
																	</Button>
																)}
															</TableCell>
														</TableRow>
													);
												})
											)}
										</TableBody>
									</Table>
								</div>
								{/* Pagination */}
								<div className="mt-4 flex items-center justify-between">
									<p className="text-[0.75rem] text-muted-foreground">
										Showing{" "}
										<span className="font-mono font-medium text-foreground">{(page - 1) * pageSize + 1}</span>
										{"–"}
										<span className="font-mono font-medium text-foreground">{Math.min(page * pageSize, totalItems)}</span>
										{" "}of{" "}
										<span className="font-mono font-medium text-foreground">{totalItems}</span>
									</p>
									<div className="flex items-center gap-1.5">
										<Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-border/50" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
											<ChevronLeft className="h-3.5 w-3.5" />
										</Button>
										<span className="min-w-[5rem] text-center text-[0.75rem] text-muted-foreground">
											<span className="font-mono font-medium text-foreground">{page}</span>{" / "}<span className="font-mono">{totalPages}</span>
										</span>
										<Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-border/50" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
											<ChevronRight className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							</CardContent>
						</TabsContent>
					</Tabs>
				</Card>
			)}

			{/* ── New Session Dialog ───────────────────────────────────── */}
			<Dialog open={isNewSessionDialogOpen} onOpenChange={setIsNewSessionDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-1">
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
								<Plus className="h-4 w-4 text-amber-600" />
							</div>
							<div>
								<DialogTitle className="text-base">New Stock Count Session</DialogTitle>
								<DialogDescription className="text-xs mt-0.5">
									Creating a session snapshots the current inventory state for all SKUs.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel>Session Name</FieldLabel>
							<Input
								placeholder="e.g. March 2026 Stock Count"
								value={newSessionName}
								onChange={(e) => setNewSessionName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
								className="mt-1.5"
							/>
						</Field>
					</FieldGroup>
					<DialogFooter className="mt-2">
						<Button
							variant="outline"
							onClick={() => setIsNewSessionDialogOpen(false)}
							className="text-sm"
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateSession}
							disabled={!newSessionName.trim() || creatingSession}
							className="text-sm bg-amber-500 hover:bg-amber-600 text-white"
						>
							{creatingSession ? (
								<>
									<div className="h-3.5 w-3.5 mr-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
									Creating…
								</>
							) : (
								"Create Session"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Close Session Dialog ─────────────────────────────────── */}
			<Dialog open={isCloseSessionDialogOpen} onOpenChange={setIsCloseSessionDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-1">
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
								<Lock className="h-4 w-4 text-slate-600" />
							</div>
							<div>
								<DialogTitle className="text-base">Close Session</DialogTitle>
								<DialogDescription className="text-xs mt-0.5">
									Once closed, this session cannot be edited. All approved lines will be
									finalised.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsCloseSessionDialogOpen(false)}
							className="text-sm"
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleCloseSession}
							disabled={closingSession}
							className="text-sm"
						>
							{closingSession ? (
								<>
									<div className="h-3.5 w-3.5 mr-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
									Closing…
								</>
							) : (
								"Close Session"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{/* ── Help Dialog ──────────────────────────────────────────── */}
			<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
				<DialogContent className="sm:max-w-lg rounded-2xl border-2 border-border bg-background p-0 overflow-hidden shadow-xl">
					<DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/50">
						<div className="flex items-center gap-3">
							<div
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-sm font-bold text-white tabular-nums"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{helpStep + 1}
							</div>
							<div>
								<DialogTitle
									className="text-lg"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Exceptions help
								</DialogTitle>
								<DialogDescription
									className="mt-0.5"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Step {helpStep + 1} of {EXCEPTIONS_HELP_STEPS.length}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>
					<div className="space-y-5 px-6 py-5">
						<div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/50 shadow-inner">
							<HelpStepImage
								src={EXCEPTIONS_HELP_STEPS[helpStep].image}
								stepNumber={helpStep + 1}
							/>
						</div>
						<div className="rounded-xl border bg-card p-4">
							<h3
								className="mb-2 text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{EXCEPTIONS_HELP_STEPS[helpStep].title}
							</h3>
							<p
								className="text-sm text-muted-foreground leading-relaxed"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{EXCEPTIONS_HELP_STEPS[helpStep].description}
							</p>
						</div>
						<div className="flex items-center justify-between gap-4 pt-1">
							<div className="flex gap-1.5" role="tablist" aria-label="Help steps">
								{EXCEPTIONS_HELP_STEPS.map((_, i) => (
									<button
										type="button"
										key={i}
										role="tab"
										aria-selected={i === helpStep}
										aria-label={`Step ${i + 1}: ${EXCEPTIONS_HELP_STEPS[i].title}`}
										onClick={() => setHelpStep(i)}
										className={`h-2 rounded-full transition-all duration-200 ${
											i === helpStep
												? "w-6 bg-amber-600"
												: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50 hover:w-3"
										}`}
									/>
								))}
							</div>
							<div className="flex gap-2">
								{helpStep > 0 && (
									<Button
										variant="outline"
										size="sm"
										className="rounded-lg"
										onClick={() => setHelpStep((s) => s - 1)}
									>
										<ChevronLeft className="mr-0.5 h-4 w-4" />
										Previous
									</Button>
								)}
								{helpStep < EXCEPTIONS_HELP_STEPS.length - 1 ? (
									<Button
										size="sm"
										className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
										onClick={() => setHelpStep((s) => s + 1)}
									>
										Next
										<ChevronRight className="ml-0.5 h-4 w-4" />
									</Button>
								) : (
									<Button
										size="sm"
										className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
										onClick={() => setIsHelpOpen(false)}
									>
										Got it
									</Button>
								)}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
