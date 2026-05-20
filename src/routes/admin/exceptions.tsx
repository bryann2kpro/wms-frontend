import {
	useState,
	useCallback,
	useMemo,
	useEffect,
	useRef,
	type ReactNode,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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
	HelpCircle,
	ImageOff,
	FileText,
	Camera,
	X,
	MessageSquare,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useStockUnitName } from "@/lib/hooks/use-stock-unit";
import {
	STOCK_COUNT_SESSIONS_QUERY,
	STOCK_COUNT_SESSION_ITEMS_QUERY,
	CREATE_STOCK_COUNT_SESSION_MUTATION,
	UPDATE_STOCK_COUNT_ITEM_MUTATION,
	CLOSE_STOCK_COUNT_SESSION_MUTATION,
	GENERATE_STOCK_COUNT_CHECKLIST_MUTATION,
	BULK_APPROVE_STOCK_COUNT_ITEMS_MUTATION,
	type StockCountSession,
	type StockCountItem,
	type StockCountSessionsQueryData,
	type StockCountSessionItemsQueryData,
	type CreateStockCountSessionData,
	type UpdateStockCountItemData,
	type CloseStockCountSessionData,
	type GenerateStockCountChecklistData,
	type BulkApproveStockCountItemsData,
} from "@/lib/graphql/stock-count-session";
import { downloadPdfFromBase64 } from "@/lib/reports";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import { toast } from "sonner";

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
				This page manages <strong>Stock Count Sessions</strong> — periodic
				inventory audits that compare physical counts against system records.
				Enter your counted quantities, resolve discrepancies, and approve items
				before closing the session.
			</>
		),
	},
	{
		title: "Create a stock count session",
		image: "/help/exceptions/step-2.png",
		description: (
			<>
				Click <strong>New Stock Count</strong> to start a session. A snapshot of
				all current inventory balances is captured automatically. Give the
				session a descriptive name (e.g. "March 2026 Stock Count") so it's easy
				to identify later.
			</>
		),
	},
	{
		title: "Enter physical counts",
		image: "/help/exceptions/step-3.png",
		description: (
			<>
				For each SKU, enter the <strong>physical count</strong> in the Counted
				column. The system calculates the difference automatically. You can also
				add notes and upload damage photos for each line.
			</>
		),
	},
	{
		title: "Resolve discrepancies",
		image: "/help/exceptions/step-4.png",
		description: (
			<>
				Items with a difference need an <strong>action</strong>:{" "}
				<strong>Tally to Opening</strong>, <strong>Tally to Stock Count</strong>
				, or <strong>Manual Key-In</strong>. Items with no difference are
				auto-resolved.
			</>
		),
	},
	{
		title: "Approve and close",
		image: "/help/exceptions/step-5.png",
		description: (
			<>
				Use <strong>Approve All Ready</strong> to bulk-approve items that have
				an action set or zero difference. You can also approve individually.
				Once all items are approved, <strong>Close Session</strong> to finalise.
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

// ─── Inline image upload button ──────────────────────────────────────────────

function ImageUploadCell({
	imageUrl,
	disabled,
	onUploaded,
}: {
	imageUrl: string | null;
	disabled: boolean;
	onUploaded: (url: string) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);

	const handleUpload = async (file: File) => {
		setUploading(true);
		try {
			const formData = new FormData();
			formData.append("image", file);
			const token = getAccessToken();
			const res = await fetch(`${env.VITE_API_URL}/v1/upload`, {
				method: "POST",
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				body: formData,
			});
			if (!res.ok) throw new Error("Upload failed");
			const body = (await res.json()) as {
				success: boolean;
				data: { url: string } | null;
			};
			if (body.success && body.data?.url) {
				onUploaded(body.data.url);
			}
		} catch {
			// Silently fail — user can retry
		} finally {
			setUploading(false);
		}
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				disabled={disabled}
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) handleUpload(file);
					e.target.value = "";
				}}
			/>
			{imageUrl ? (
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="h-8 w-8 rounded-md overflow-hidden border border-border/50 hover:ring-2 hover:ring-amber-400/40 transition-all"
						onClick={() => setPreviewOpen(true)}
					>
						<img
							src={imageUrl}
							alt="Evidence"
							className="h-full w-full object-cover"
						/>
					</button>
					{!disabled && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={() => inputRef.current?.click()}
						>
							<Camera className="h-3 w-3" />
						</Button>
					)}
				</div>
			) : (
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground"
					disabled={disabled || uploading}
					onClick={() => inputRef.current?.click()}
				>
					{uploading ? (
						<div className="h-3.5 w-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
					) : (
						<Camera className="h-3.5 w-3.5" />
					)}
				</Button>
			)}

			{/* Full-size image preview dialog */}
			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
				<DialogContent className="sm:max-w-lg p-0 overflow-hidden">
					<DialogHeader className="px-4 pt-4 pb-2">
						<DialogTitle className="text-sm">Damage Evidence</DialogTitle>
					</DialogHeader>
					{imageUrl && (
						<div className="px-4 pb-4">
							<img
								src={imageUrl}
								alt="Damage evidence"
								className="w-full h-auto rounded-lg"
							/>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

// ─── Inline notes popover ────────────────────────────────────────────────────

function NotesCell({
	notes,
	disabled,
	onSave,
}: {
	notes: string | null;
	disabled: boolean;
	onSave: (notes: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState(notes ?? "");

	useEffect(() => {
		setValue(notes ?? "");
	}, [notes]);

	const handleSave = () => {
		onSave(value);
		setOpen(false);
	};

	return (
		<>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className={`h-7 w-7 ${notes ? "text-amber-600" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
							onClick={() => setOpen(true)}
							disabled={disabled && !notes}
						>
							<MessageSquare className="h-3.5 w-3.5" />
						</Button>
					</TooltipTrigger>
					{notes && (
						<TooltipContent side="top" className="max-w-[200px] text-xs">
							{notes}
						</TooltipContent>
					)}
				</Tooltip>
			</TooltipProvider>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle className="text-sm">Notes</DialogTitle>
						<DialogDescription className="text-xs">
							Add comments or observations for this item.
						</DialogDescription>
					</DialogHeader>
					<textarea
						className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 resize-none"
						rows={3}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						disabled={disabled}
						placeholder="Enter notes..."
					/>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						{!disabled && (
							<Button size="sm" onClick={handleSave}>
								Save
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

// ─── Route definition ────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/exceptions")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Exception"]);
	},
	component: ExceptionsComponent,
	head: () => ({
		meta: [
			{
				title: "Exceptions - SME Edaran WMS",
				description:
					"Investigate stock count exceptions, review discrepancies, and manage follow-up actions.",
			},
		],
	}),
});

function ExceptionsComponent() {
	const unitName = useStockUnitName();

	// ─── Help dialog state ────────────────────────────────────────
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);

	// ─── Session state ───────────────────────────────────────────
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
		null,
	);
	const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
	const [newSessionName, setNewSessionName] = useState("");
	const [isCloseSessionDialogOpen, setIsCloseSessionDialogOpen] =
		useState(false);

	// ─── Table state ──────────────────────────────────────────────
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");

	// ─── Local optimistic overrides ──────────────────────────────
	const [rowCountedAmounts, setRowCountedAmounts] = useState<
		Record<string, { dozen: number; loss: number }>
	>({});
	const [rowActions, setRowActions] = useState<Record<string, string>>({});

	// ─── Queries ──────────────────────────────────────────────────
	const sessionsQueryVariables = { pageSize: 100, pageNumber: 1 };
	const {
		data: sessionsData,
		isLoading: sessionsLoading,
		refetch: refetchSessions,
	} = useQuery({
		queryKey: [...qk.stockCount.all, "sessions", sessionsQueryVariables] as const,
		queryFn: () =>
			gqlRequest<StockCountSessionsQueryData>(
				STOCK_COUNT_SESSIONS_QUERY,
				sessionsQueryVariables,
			),
	});

	const sessions = (sessionsData?.stockCountSessions?.query ??
		[]) as StockCountSession[];
	const selectedSession =
		sessions.find((s) => s.id === selectedSessionId) ?? null;

	useEffect(() => {
		if (sessions.length === 0) {
			if (selectedSessionId !== null) setSelectedSessionId(null);
			return;
		}
		if (
			!selectedSessionId ||
			!sessions.some((session) => session.id === selectedSessionId)
		) {
			setSelectedSessionId(sessions[0].id);
		}
	}, [sessions, selectedSessionId]);

	const itemsQueryVariables = {
		sessionId: selectedSessionId ?? "",
		search: searchTerm || undefined,
		pageSize,
		pageNumber: page,
	};
	const {
		data: itemsData,
		isLoading: itemsLoading,
		refetch: refetchItems,
	} = useQuery({
		queryKey: [
			...qk.stockCount.all,
			"items",
			itemsQueryVariables,
		] as const,
		queryFn: () =>
			gqlRequest<StockCountSessionItemsQueryData>(
				STOCK_COUNT_SESSION_ITEMS_QUERY,
				itemsQueryVariables,
			),
		enabled: !!selectedSessionId,
	});

	const items: StockCountItem[] =
		itemsData?.stockCountSessionItems?.query ?? [];
	const totalItems =
		itemsData?.stockCountSessionItems?.pagination?.totalCount ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

	// ─── Mutations ────────────────────────────────────────────────
	const { mutate: createSession, isPending: creatingSession } = useMutation({
		mutationFn: (vars: { name: string }) =>
			gqlRequest<CreateStockCountSessionData>(
				CREATE_STOCK_COUNT_SESSION_MUTATION,
				vars,
			),
		onSuccess(data) {
			const newId = data.createStockCountSession.id;
			setSelectedSessionId(newId);
			setIsNewSessionDialogOpen(false);
			setNewSessionName("");
			refetchSessions();
			refetchItems();
		},
	});

	const { mutate: updateItem } = useMutation({
		mutationFn: (vars: { id: string; input: Record<string, unknown> }) =>
			gqlRequest<UpdateStockCountItemData>(
				UPDATE_STOCK_COUNT_ITEM_MUTATION,
				vars,
			),
		onSuccess: () => {
			refetchItems();
			refetchSessions();
		},
	});

	const { mutate: closeSession, isPending: closingSession } = useMutation({
		mutationFn: (vars: { id: string }) =>
			gqlRequest<CloseStockCountSessionData>(
				CLOSE_STOCK_COUNT_SESSION_MUTATION,
				vars,
			),
		onSuccess() {
			setIsCloseSessionDialogOpen(false);
			refetchSessions();
			refetchItems();
		},
	});

	const { mutate: generateChecklist, isPending: generatingChecklist } =
		useMutation({
			mutationFn: (vars: { sessionId: string }) =>
				gqlRequest<GenerateStockCountChecklistData>(
					GENERATE_STOCK_COUNT_CHECKLIST_MUTATION,
					vars,
				),
			onSuccess(data) {
				const { pdfBase64, filename } = data.generateStockCountChecklist;
				downloadPdfFromBase64(pdfBase64, filename);
			},
		});

	const { mutate: bulkApprove, isPending: bulkApproving } = useMutation({
		mutationFn: (vars: { sessionId: string }) =>
			gqlRequest<BulkApproveStockCountItemsData>(
				BULK_APPROVE_STOCK_COUNT_ITEMS_MUTATION,
				vars,
			),
		onSuccess(data) {
			toast.success(`${data.bulkApproveStockCountItems} item(s) approved`);
			refetchItems();
			refetchSessions();
		},
	});

	// ─── Handlers ─────────────────────────────────────────────────
	const handleCreateSession = () => {
		const name = newSessionName.trim();
		if (!name) return;
		createSession({ name });
	};

	const handleCountedChange = useCallback(
		(itemId: string, update: { dozen: number; loss: number }) => {
			setRowCountedAmounts((prev) => ({ ...prev, [itemId]: update }));
			updateItem({
				id: itemId,
				input: {
					countedQty: update.dozen,
					countedLossQty: update.loss,
				},
			});
		},
		[updateItem],
	);

	const handleActionChange = useCallback(
		(itemId: string, action: string) => {
			setRowActions((prev) => ({ ...prev, [itemId]: action }));
			updateItem({ id: itemId, input: { action } });
		},
		[updateItem],
	);

	const handleNotesChange = useCallback(
		(itemId: string, notes: string) => {
			updateItem({ id: itemId, input: { notes } });
		},
		[updateItem],
	);

	const handleImageUploaded = useCallback(
		(itemId: string, imageUrl: string) => {
			updateItem({ id: itemId, input: { imageUrl } });
		},
		[updateItem],
	);

	const handleApprove = useCallback(
		(itemId: string) => {
			updateItem({ id: itemId, input: { isApproved: true } });
		},
		[updateItem],
	);

	const handleBulkApprove = () => {
		if (!selectedSessionId) return;
		bulkApprove({ sessionId: selectedSessionId });
	};

	const handleCloseSession = () => {
		if (!selectedSessionId) return;
		closeSession({ id: selectedSessionId });
	};

	const handlePrintChecklist = () => {
		if (!selectedSessionId) return;
		generateChecklist({ sessionId: selectedSessionId });
	};

	// ─── Summary ──────────────────────────────────────────────────
	const summary = useMemo(() => {
		if (!selectedSession) return null;
		console.log("selectedSession", selectedSession);
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
				title="Stock Count"
				description="Count inventory, resolve discrepancies, and approve before closing."
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
									setRowCountedAmounts({});
								}}
							>
								<SelectTrigger className="h-9 w-64 text-sm border-border/60 bg-background/80">
									<SelectValue placeholder="Select a session..." />
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
										<TooltipContent
											side="bottom"
											className="text-xs max-w-[200px] text-center"
										>
											{summary && summary.pending > 0
												? `${summary.pending} item${summary.pending > 1 ? "s" : ""} still pending approval`
												: "Loading approval status..."}
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

						{selectedSession && isSessionOpen && (
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5 text-xs h-9 border-border/60"
								onClick={handlePrintChecklist}
								disabled={generatingChecklist}
							>
								<FileText className="h-3.5 w-3.5" />
								{generatingChecklist ? "Generating..." : "Print Checklist"}
							</Button>
						)}

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
								Create your first session to capture a snapshot of current
								inventory.
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
								borderColor:
									"color-mix(in oklch, var(--dashboard-accent) 25%, transparent)",
								background:
									"color-mix(in oklch, var(--dashboard-accent) 4%, white)",
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
											background:
												"color-mix(in oklch, var(--dashboard-accent) 12%, transparent)",
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
										? new Date(selectedSession.countDate).toLocaleDateString(
												"en-MY",
											)
										: "\u2014"}
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

			{/* ── Unified Stock Count Table ─────────────────────────────── */}
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
										Stock Count
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
									SKU{totalItems !== 1 ? "s" : ""} in this session
								</p>
							</div>

							<div className="flex items-center gap-2">
								{summary?.pending}
								{isSessionOpen && summary && summary.approved > 0 && (
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5 text-xs h-9 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400"
										onClick={handleBulkApprove}
										disabled={bulkApproving}
									>
										<ShieldCheck className="h-3.5 w-3.5" />
										{bulkApproving ? "Approving..." : "Approve All"}
									</Button>
								)}

								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
									<Input
										placeholder="Search SKU or description..."
										value={searchTerm}
										onChange={(e) => {
											setSearchTerm(e.target.value);
											setPage(1);
										}}
										className="pl-8.5 h-9 text-sm sm:w-64 border-border/50 bg-muted/30 focus-visible:bg-background transition-colors"
									/>
								</div>
							</div>
						</div>
					</CardHeader>

					{/* Thin divider */}
					<div className="mx-5 mt-4 h-px bg-border/40" />

					<CardContent className="relative pt-4 px-5 pb-5">
						<GlobalLoadingShadow />
						<div className="overflow-x-auto rounded-xl border border-border/40 bg-white shadow-xs">
							<Table>
								<TableHeader>
									<TableRow className="border-b border-border/50 bg-muted/20 hover:bg-muted/20">
										<TableHead className="w-12 pl-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											#
										</TableHead>
										<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											SKU
										</TableHead>
										<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											Description
										</TableHead>
										<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											Opening
											<span className="block font-normal normal-case tracking-normal text-muted-foreground/50">
												{unitName} / Loss
											</span>
										</TableHead>
										<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											Counted
											<span className="block font-normal normal-case tracking-normal text-muted-foreground/50">
												{unitName} / Loss
											</span>
										</TableHead>
										<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											Diff
											<span className="block font-normal normal-case tracking-normal text-muted-foreground/50">
												{unitName} / Loss
											</span>
										</TableHead>
										<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											Action
										</TableHead>
										<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70 w-20">
											Notes / Photo
										</TableHead>
										<TableHead className="text-center pr-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
											Status
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{itemsLoading ? (
										<TableRow>
											<TableCell
												colSpan={9}
												className="h-28 text-center text-sm text-muted-foreground"
											>
												<div className="flex flex-col items-center gap-2">
													<div className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
													<span>Loading inventory...</span>
												</div>
											</TableCell>
										</TableRow>
									) : items.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={9}
												className="h-28 text-center text-sm text-muted-foreground"
											>
												No items found.
											</TableCell>
										</TableRow>
									) : (
										items.map((item, index) => {
											const displayDozen =
												rowCountedAmounts[item.id]?.dozen ??
												item.countedQty ??
												item.onHandQty;
											const displayLoss =
												rowCountedAmounts[item.id]?.loss ??
												item.countedLossQty ??
												item.onHandLossQty;
											const diffDozen = item.qtyDifference;
											const diffLoss = item.lossQtyDifference;
											const hasDiff = diffDozen !== 0 || diffLoss !== 0;
											const isShortage = diffDozen > 0 || diffLoss > 0;
											const selectedAction =
												rowActions[item.id] ?? item.action ?? "";
											const needsAction = hasDiff;
											const canApprove =
												isSessionOpen &&
												!item.isApproved &&
												(!needsAction || !!selectedAction);

											return (
												<TableRow
													key={item.id}
													className={`border-b border-border/30 transition-colors last:border-0 ${item.isApproved ? "bg-emerald-50/40 hover:bg-emerald-50/60" : "bg-white hover:bg-muted/20"}`}
												>
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
													<TableCell className="max-w-[160px] py-3">
														<span
															className="block truncate text-sm text-foreground/80"
															title={item.skuDescription}
														>
															{item.skuDescription}
														</span>
													</TableCell>
													{/* Opening */}
													<TableCell className="text-center py-3">
														<span className="font-mono text-sm tabular-nums text-foreground/70">
															{item.openingQty}
															<span className="mx-1 text-border">/</span>
															{item.openingLossQty}
														</span>
													</TableCell>
													{/* Counted — always editable when session is open */}
													<TableCell className="text-center py-3">
														{isSessionOpen && !item.isApproved ? (
															<div className="flex items-center justify-center gap-1">
																<Input
																	type="number"
																	min={0}
																	className="h-7 w-14 text-center text-xs font-mono px-1 border-amber-200 focus-visible:ring-amber-400/30"
																	placeholder={String(item.onHandQty)}
																	value={displayDozen}
																	onChange={(e) => {
																		const v = e.target.value;
																		handleCountedChange(item.id, {
																			dozen: v === "" ? 0 : Number(v),
																			loss: displayLoss,
																		});
																	}}
																/>
																<span className="text-muted-foreground/50 text-xs">
																	/
																</span>
																<Input
																	type="number"
																	min={0}
																	className="h-7 w-14 text-center text-xs font-mono px-1 border-amber-200 focus-visible:ring-amber-400/30"
																	placeholder={String(item.onHandLossQty)}
																	value={displayLoss}
																	onChange={(e) => {
																		const v = e.target.value;
																		handleCountedChange(item.id, {
																			dozen: displayDozen,
																			loss: v === "" ? 0 : Number(v),
																		});
																	}}
																/>
															</div>
														) : (
															<span className="font-mono text-sm tabular-nums text-foreground/70">
																{item.countedQty ?? item.onHandQty}
																<span className="mx-1 text-border">/</span>
																{item.countedLossQty ?? item.onHandLossQty}
															</span>
														)}
													</TableCell>
													{/* Diff */}
													<TableCell className="text-center py-3">
														<span
															className={[
																"inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
																hasDiff
																	? isShortage
																		? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
																		: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
																	: "bg-muted/40 text-muted-foreground ring-1 ring-border/40",
															].join(" ")}
														>
															{hasDiff &&
																(isShortage ? (
																	<TrendingDown className="h-3 w-3 shrink-0" />
																) : (
																	<TrendingUp className="h-3 w-3 shrink-0" />
																))}
															{!hasDiff && (
																<Minus className="h-3 w-3 shrink-0" />
															)}
															<span>
																{diffDozen > 0 ? `-${diffDozen}` : diffDozen}
															</span>
															<span className="mx-0.5 opacity-40">/</span>
															<span>
																{diffLoss > 0 ? `-${diffLoss}` : diffLoss}
															</span>
														</span>
													</TableCell>
													{/* Action — only shown/required when diff != 0 */}
													<TableCell className="py-3">
														{needsAction ? (
															<Select
																value={selectedAction}
																onValueChange={(value) =>
																	handleActionChange(item.id, value)
																}
																disabled={!isSessionOpen || item.isApproved}
															>
																<SelectTrigger
																	className={`h-7 w-[154px] rounded-lg text-xs border-border/50 bg-muted/20 transition-colors ${selectedAction ? "text-foreground" : "text-muted-foreground"}`}
																>
																	<SelectValue placeholder="Select action..." />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem
																		value="tally_to_opening"
																		className="text-xs"
																	>
																		Tally to Opening
																	</SelectItem>
																	<SelectItem
																		value="tally_to_stock_count"
																		className="text-xs"
																	>
																		Tally to Stock Count
																	</SelectItem>
																	<SelectItem
																		value="manual_key_in"
																		className="text-xs"
																	>
																		Manual Key-In
																	</SelectItem>
																</SelectContent>
															</Select>
														) : (
															<span className="text-xs text-muted-foreground/50 italic">
																No diff
															</span>
														)}
													</TableCell>
													{/* Notes + Photo */}
													<TableCell className="text-center py-3">
														<div className="flex items-center justify-center gap-0.5">
															<NotesCell
																notes={item.notes}
																disabled={!isSessionOpen || item.isApproved}
																onSave={(notes) =>
																	handleNotesChange(item.id, notes)
																}
															/>
															<ImageUploadCell
																imageUrl={item.imageUrl}
																disabled={!isSessionOpen || item.isApproved}
																onUploaded={(url) =>
																	handleImageUploaded(item.id, url)
																}
															/>
														</div>
													</TableCell>
													{/* Status */}
													<TableCell className="text-center pr-4 py-3">
														{item.isApproved ? (
															<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-300/50">
																<CheckCircle2 className="h-3 w-3" />
																Approved
															</span>
														) : (
															<span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[0.7rem] font-semibold text-muted-foreground ring-1 ring-border/40">
																Pending
															</span>
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
								<span className="font-mono font-medium text-foreground">
									{(page - 1) * pageSize + 1}
								</span>
								{"\u2013"}
								<span className="font-mono font-medium text-foreground">
									{Math.min(page * pageSize, totalItems)}
								</span>{" "}
								of{" "}
								<span className="font-mono font-medium text-foreground">
									{totalItems}
								</span>
							</p>
							<div className="flex items-center gap-1.5">
								<Button
									variant="outline"
									size="icon"
									className="h-7 w-7 rounded-lg border-border/50"
									disabled={page === 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									<ChevronLeft className="h-3.5 w-3.5" />
								</Button>
								<span className="min-w-[5rem] text-center text-[0.75rem] text-muted-foreground">
									<span className="font-mono font-medium text-foreground">
										{page}
									</span>
									{" / "}
									<span className="font-mono">{totalPages}</span>
								</span>
								<Button
									variant="outline"
									size="icon"
									className="h-7 w-7 rounded-lg border-border/50"
									disabled={page === totalPages}
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								>
									<ChevronRight className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* ── New Session Dialog ───────────────────────────────────── */}
			<Dialog
				open={isNewSessionDialogOpen}
				onOpenChange={setIsNewSessionDialogOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-1">
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
								<Plus className="h-4 w-4 text-amber-600" />
							</div>
							<div>
								<DialogTitle className="text-base">
									New Stock Count Session
								</DialogTitle>
								<DialogDescription className="text-xs mt-0.5">
									Creating a session snapshots the current inventory state for
									all SKUs.
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
									Creating...
								</>
							) : (
								"Create Session"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Close Session Dialog ─────────────────────────────────── */}
			<Dialog
				open={isCloseSessionDialogOpen}
				onOpenChange={setIsCloseSessionDialogOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-1">
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
								<Lock className="h-4 w-4 text-slate-600" />
							</div>
							<div>
								<DialogTitle className="text-base">Close Session</DialogTitle>
								<DialogDescription className="text-xs mt-0.5">
									Once closed, this session cannot be edited. All approved lines
									will be finalised.
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
									Closing...
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
									Stock Count help
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
							<div
								className="flex gap-1.5"
								role="tablist"
								aria-label="Help steps"
							>
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
