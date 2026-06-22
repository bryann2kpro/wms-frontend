import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeftRight,
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	CheckCircle2,
	Eye,
	Plus,
	Search,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { BinTransferQuickForm } from "@/components/stock-transfer/bin-transfer-quick-form";
import { StockTransferFormDialog } from "@/components/stock-transfer/stock-transfer-form-dialog";
import {
	TransferDraftActions,
	dashboardAccentButtonProps,
	formatTransferQtyDisplay,
	transferTableEmptyCellClassName,
	transferTableMonoCellClassName,
	transferTableWrapperClassName,
} from "@/components/stock-transfer/stock-transfer-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	APPROVE_STOCK_TRANSFER_MUTATION,
	CANCEL_STOCK_TRANSFER_MUTATION,
	RECEIVE_STOCK_TRANSFER_MUTATION,
	REJECT_STOCK_TRANSFER_MUTATION,
	STOCK_TRANSFERS_QUERY,
	type ApproveStockTransferMutationData,
	type StockTransfersQueryData,
} from "@/lib/graphql/stock-transfer";
import type {
	StockTransfer,
	StockTransferItem,
	StockTransferStatus,
	StockTransferType,
} from "@/lib/graphql/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { requirePermission } from "@/lib/rbac";
import { formatDate, formatDateOnly, toUserFriendlyMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/stock-transfer")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: StockTransferComponent,
	head: () => ({
		meta: [
			{
				title: "Bin to Bin - SME Edaran WMS",
				description:
					"Internal bin transfers and warehouse moves with draft approval.",
			},
		],
	}),
});

const SEARCH_DEBOUNCE_MS = 350;

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "response" in err) {
		const first = (
			err as { response?: { errors?: Array<{ message?: string }> } }
		).response?.errors?.[0];
		if (first?.message)
			return toUserFriendlyMessage(
				first.message,
				"Something went wrong. Please try again.",
			);
	}
	if (err instanceof Error)
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	return "Something went wrong. Please try again.";
}

function rackLabel(
	rack: { rackRow: string; rackLevel: string; rackColumn: string } | null,
): string {
	if (!rack) return "-";
	return `${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`;
}

function StatusBadge({ status }: { status: StockTransferStatus }) {
	if (status === "DRAFT") {
		return (
			<Badge className="border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-400">
				Draft
			</Badge>
		);
	}
	if (status === "AWAITING_DISPATCH") {
		return (
			<Badge className="border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-400">
				Awaiting Dispatch
			</Badge>
		);
	}
	if (status === "IN_TRANSIT") {
		return (
			<Badge className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400">
				In Transit
			</Badge>
		);
	}
	if (status === "COMPLETED") {
		return (
			<Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
				Completed
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="text-muted-foreground">
			Cancelled
		</Badge>
	);
}

function TypeBadge({ type }: { type: StockTransferType }) {
	return (
		<Badge variant="outline">
			{type === "BIN_TO_BIN" ? "Bin → Bin" : "Warehouse → Warehouse"}
		</Badge>
	);
}

function StockTransferComponent() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const [typeFilter, setTypeFilter] = useState<string>("ALL");
	const [statusFilter, setStatusFilter] = useState<string>("ALL");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [viewTransfer, setViewTransfer] = useState<StockTransfer | null>(null);
	const [receiveTarget, setReceiveTarget] = useState<StockTransfer | null>(null);
	const [cancelTarget, setCancelTarget] = useState<StockTransfer | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const queryVars = {
		filter: {
			search: debouncedSearch.trim() || undefined,
			type: typeFilter === "ALL" ? undefined : typeFilter,
			status: statusFilter === "ALL" ? undefined : statusFilter,
			sortBy: "CREATED_AT",
			sortOrder: "DESC",
		},
		pageSize,
		pageNumber: page,
	};
	const draftsVars = {
		filter: { status: "DRAFT" as const, sortBy: "CREATED_AT", sortOrder: "DESC" },
		pageSize: 100,
		pageNumber: 1,
	};
	const {
		data: queryData,
		isLoading: loading,
	} = useQuery({
		queryKey: qk.stockTransfers.list(queryVars),
		queryFn: () =>
			gqlRequest<StockTransfersQueryData>(STOCK_TRANSFERS_QUERY, queryVars),
	});
	const {
		data: draftsData,
		isLoading: draftsLoading,
		refetch: refetchDrafts,
	} = useQuery({
		queryKey: qk.stockTransfers.list(draftsVars),
		queryFn: () =>
			gqlRequest<StockTransfersQueryData>(STOCK_TRANSFERS_QUERY, draftsVars),
	});

	const transfers = queryData?.stockTransfers?.query ?? [];
	const draftTransfers = draftsData?.stockTransfers?.query ?? [];
	const pagination = queryData?.stockTransfers?.pagination;
	const totalPages = pagination?.totalPages ?? 1;

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: qk.stockTransfers.all });
		queryClient.invalidateQueries({ queryKey: qk.stockQuants.all });
		queryClient.invalidateQueries({ queryKey: qk.racks.all });
	}

	const { mutateAsync: approveMutation, isPending: approving } = useMutation({
		mutationFn: (id: string) =>
			gqlRequest<ApproveStockTransferMutationData>(
				APPROVE_STOCK_TRANSFER_MUTATION,
				{ id },
			),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: (data) => {
			const approved = data.approveStockTransfer;
			if (
				approved.type === "WAREHOUSE_TO_WAREHOUSE" &&
				approved.status === "AWAITING_DISPATCH"
			) {
				toast.success(
					"Transfer approved — dispatch from Internal Transfer Work Queue",
				);
			} else if (approved.status === "IN_TRANSIT") {
				toast.success(
					"Transfer approved — confirm receipt in Internal Transfer Work Queue",
				);
			} else {
				toast.success("Transfer approved and stock moved");
			}
			invalidate();
		},
	});

	const { mutateAsync: rejectMutation, isPending: rejecting } = useMutation({
		mutationFn: (id: string) =>
			gqlRequest(REJECT_STOCK_TRANSFER_MUTATION, { id }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Draft transfer rejected");
			invalidate();
		},
	});

	const { mutateAsync: receiveMutation, isPending: receiving } = useMutation({
		mutationFn: (id: string) =>
			gqlRequest(RECEIVE_STOCK_TRANSFER_MUTATION, { id }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Transfer received and completed");
			setReceiveTarget(null);
			invalidate();
		},
	});

	const { mutateAsync: cancelMutation, isPending: cancelling } = useMutation({
		mutationFn: (vars: { id: string; reason: string }) =>
			gqlRequest(CANCEL_STOCK_TRANSFER_MUTATION, vars),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Transfer cancelled");
			setCancelTarget(null);
			setCancelReason("");
			invalidate();
		},
	});

	function invalidateDrafts() {
		invalidate();
		void refetchDrafts();
	}

	async function handleConfirmCancel() {
		if (!cancelTarget) return;
		const reason = cancelReason.trim();
		if (!reason) {
			toast.error("A cancellation reason is required.");
			return;
		}
		await cancelMutation({ id: cancelTarget.id, reason });
	}

	return (
		<main
			className="stock-transfer-page container mx-auto p-6 space-y-6"
			aria-labelledby="stock-transfer-page-title"
			aria-describedby="stock-transfer-page-description"
			aria-busy={loading || draftsLoading || approving || rejecting}
		>
			<AdminPageHeader
				icon={ArrowLeftRight}
				title="Bin to Bin"
				description="Move stock between racks. Add a single-line transfer above, or create a multi-line / cross-warehouse transfer below. Approve dispatches stock from source; confirm receipt in the Internal Transfer Work Queue."
				titleId="stock-transfer-page-title"
				descriptionId="stock-transfer-page-description"
			/>

			<BinTransferQuickForm
				onDraftCreated={invalidateDrafts}
				animationDelay="0ms"
			/>

			<Card className="dashboard-card" style={{ animationDelay: "50ms" }}>
				<CardHeader>
					<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Bin to Bin list
					</CardTitle>
					<CardDescription>
						Draft transfers awaiting approval. Approve moves stock; reject cancels
						the draft without moving stock.
					</CardDescription>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className={transferTableWrapperClassName}>
						<Table aria-label="Pending transfer drafts">
							<TableHeader>
								<TableRow>
									<TableHead>SKU Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Source Rack</TableHead>
									<TableHead>Lot No</TableHead>
									<TableHead>Destination Rack</TableHead>
									<TableHead className="text-right">Qty (ctn | loss)</TableHead>
									<TableHead className="w-[200px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{draftTransfers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className={transferTableEmptyCellClassName}
										>
											{draftsLoading
												? "Loading..."
												: "No draft transfers yet. Add a transfer using the form above."}
										</TableCell>
									</TableRow>
								) : (
									draftTransfers.map((t) => {
										if (t.items.length === 1) {
											const item = t.items[0];
											return (
												<TableRow
													key={t.id}
													className="transition-colors hover:bg-muted/50"
												>
													<TableCell className={transferTableMonoCellClassName}>
														{item.skuCode ?? item.skuId}
													</TableCell>
													<TableCell className="max-w-[280px] truncate text-sm">
														{item.skuDescription?.trim() || "—"}
													</TableCell>
													<TableCell className={transferTableMonoCellClassName}>
														{rackLabel(item.sourceRack)}
													</TableCell>
													<TableCell className={transferTableMonoCellClassName}>
														{item.lotNo?.trim() ? item.lotNo : "—"}
													</TableCell>
													<TableCell className={transferTableMonoCellClassName}>
														{rackLabel(item.destinationRack)}
													</TableCell>
													<TableCell className="text-right text-sm font-medium">
														{formatTransferQtyDisplay(item)}
													</TableCell>
													<TableCell className="text-right">
														<TransferDraftActions
															disabled={approving || rejecting}
															onApprove={() => approveMutation(t.id)}
															onReject={() => rejectMutation(t.id)}
															onView={() => setViewTransfer(t)}
														/>
													</TableCell>
												</TableRow>
											);
										}

										return (
											<TableRow
												key={t.id}
												className="transition-colors hover:bg-muted/50"
											>
												<TableCell className={transferTableMonoCellClassName}>
													{t.transferNo}
												</TableCell>
												<TableCell
													colSpan={3}
													className="text-sm text-muted-foreground"
												>
													Multi-line draft ({t.items.length} lines)
													{t.type === "WAREHOUSE_TO_WAREHOUSE"
														? " · cross-warehouse"
														: ""}
												</TableCell>
												<TableCell />
												<TableCell className="text-right text-sm font-medium">
													<Badge variant="outline">{t.items.length} lines</Badge>
												</TableCell>
												<TableCell className="text-right">
													<TransferDraftActions
														disabled={approving || rejecting}
														onApprove={() => approveMutation(t.id)}
														onReject={() => rejectMutation(t.id)}
														onView={() => setViewTransfer(t)}
													/>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<Card className="dashboard-card" style={{ animationDelay: "100ms" }}>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Transfer records
							</CardTitle>
							<CardDescription>
								Search by transfer number, filter by type and status. Use
								Multi-line transfer for several lines or cross-warehouse moves.
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
							<div className="relative flex-1 sm:flex-initial sm:w-56 max-w-md">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search by transfer no..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 w-full"
								/>
							</div>
							<Button
								type="button"
								{...dashboardAccentButtonProps}
								onClick={() => setIsCreateOpen(true)}
							>
								<Plus className="h-4 w-4" aria-hidden />
								Multi-line transfer
							</Button>
						</div>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-2">
						<Select
							value={typeFilter}
							onValueChange={(val) => {
								setTypeFilter(val);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-full sm:w-56">
								<SelectValue placeholder="All types" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All types</SelectItem>
								<SelectItem value="BIN_TO_BIN">Bin to Bin</SelectItem>
								<SelectItem value="WAREHOUSE_TO_WAREHOUSE">
									Warehouse to Warehouse
								</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={statusFilter}
							onValueChange={(val) => {
								setStatusFilter(val);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-full sm:w-48">
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All statuses</SelectItem>
								<SelectItem value="DRAFT">Draft</SelectItem>
								<SelectItem value="AWAITING_DISPATCH">
									Awaiting Dispatch
								</SelectItem>
								<SelectItem value="IN_TRANSIT">In Transit</SelectItem>
								<SelectItem value="COMPLETED">Completed</SelectItem>
								<SelectItem value="CANCELLED">Cancelled</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className={transferTableWrapperClassName}>
						<Table aria-label="Transfer records">
							<TableHeader>
								<TableRow>
									<TableHead>Transfer No.</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-center">Lines</TableHead>
									<TableHead>Created By</TableHead>
									<TableHead>Created At</TableHead>
									<TableHead className="w-[200px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{transfers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className={transferTableEmptyCellClassName}
										>
											{loading ? "Loading..." : "No stock transfers found."}
										</TableCell>
									</TableRow>
								) : (
									transfers.map((t) => (
										<TableRow
											key={t.id}
											className="transition-colors hover:bg-muted/50"
										>
											<TableCell className={transferTableMonoCellClassName}>
												{t.transferNo}
											</TableCell>
											<TableCell>
												<TypeBadge type={t.type} />
											</TableCell>
											<TableCell>
												<StatusBadge status={t.status} />
											</TableCell>
											<TableCell className="text-center">
												<Badge variant="outline">{t.items.length}</Badge>
											</TableCell>
											<TableCell>
												{t.createdByUser?.displayName ?? "-"}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDate(t.createdAt)}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													{t.status === "DRAFT" && (
														<TransferDraftActions
															disabled={approving || rejecting}
															onApprove={() => approveMutation(t.id)}
															onReject={() => rejectMutation(t.id)}
															onView={() => setViewTransfer(t)}
														/>
													)}
													{t.status === "IN_TRANSIT" && (
														<>
															<Button
																variant="ghost"
																size="icon"
																className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
																onClick={() => setReceiveTarget(t)}
																title="Receive transfer"
															>
																<CheckCircle2 className="h-4 w-4" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																className="h-8 w-8 text-destructive hover:text-destructive"
																onClick={() => {
																	setCancelReason("");
																	setCancelTarget(t);
																}}
																title="Cancel transfer"
															>
																<XCircle className="h-4 w-4" />
															</Button>
														</>
													)}
													{t.status !== "DRAFT" && (
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
															onClick={() => setViewTransfer(t)}
															title="View details"
														>
															<Eye className="h-4 w-4" />
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

					{totalPages > 1 && (
						<div className="flex items-center justify-between pt-4">
							<p className="text-sm text-muted-foreground">
								Page {page} of {totalPages}
								{pagination?.totalCount
									? ` (${pagination.totalCount} total)`
									: ""}
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page <= 1}
									onClick={() => setPage((p) => p - 1)}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => p + 1)}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create Dialog */}
			<StockTransferFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSuccess={() => {
					setIsCreateOpen(false);
					invalidateDrafts();
				}}
			/>

			{/* Detail Dialog */}
			<Dialog
				open={!!viewTransfer}
				onOpenChange={(open) => !open && setViewTransfer(null)}
			>
				<DialogContent className="w-[min(96vw,820px)] max-w-[820px] max-h-[85vh] overflow-y-auto rounded-2xl">
					<DialogHeader>
						<DialogTitle
							className="font-semibold flex items-center gap-2"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{viewTransfer?.transferNo}
							{viewTransfer && <StatusBadge status={viewTransfer.status} />}
						</DialogTitle>
						<DialogDescription>
							{viewTransfer && (
								<>
									Created by{" "}
									{viewTransfer.createdByUser?.displayName ?? "Unknown"} on{" "}
									{formatDate(viewTransfer.createdAt)}
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					{viewTransfer && (
						<div className="space-y-4 pt-2">
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
										Type
									</p>
									<TypeBadge type={viewTransfer.type} />
								</div>
								{viewTransfer.remarks && (
									<div>
										<p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
											Remarks
										</p>
										<p className="text-sm">{viewTransfer.remarks}</p>
									</div>
								)}
								{viewTransfer.status === "CANCELLED" &&
									viewTransfer.cancelReason && (
										<div className="sm:col-span-2">
											<p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
												Cancellation reason
											</p>
											<p className="text-sm">{viewTransfer.cancelReason}</p>
										</div>
									)}
							</div>

							<div className={transferTableWrapperClassName}>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>SKU</TableHead>
											<TableHead>Lot</TableHead>
											<TableHead>Expiry</TableHead>
											<TableHead>Movement</TableHead>
											<TableHead className="text-right">Qty (ctn | loss)</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{viewTransfer.items.map((item: StockTransferItem) => (
											<TableRow
												key={item.id}
												className="transition-colors hover:bg-muted/50"
											>
												<TableCell>
													<div>
														<p className={transferTableMonoCellClassName}>
															{item.skuCode ?? "-"}
														</p>
														{item.skuDescription && (
															<p className="text-xs text-muted-foreground truncate max-w-[180px]">
																{item.skuDescription}
															</p>
														)}
													</div>
												</TableCell>
												<TableCell className={transferTableMonoCellClassName}>
													{item.lotNo?.trim() ? item.lotNo : "-"}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground whitespace-nowrap">
													{item.expiryDate
														? formatDateOnly(item.expiryDate)
														: "-"}
												</TableCell>
												<TableCell>
													<span className={`flex items-center gap-1.5 ${transferTableMonoCellClassName} whitespace-nowrap`}>
														{rackLabel(item.sourceRack)}
														<ArrowRight
															className="h-3.5 w-3.5 text-muted-foreground"
															aria-hidden
														/>
														{rackLabel(item.destinationRack)}
													</span>
												</TableCell>
												<TableCell className={`text-right ${transferTableMonoCellClassName}`}>
													{formatTransferQtyDisplay(item)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Receive Confirm Dialog */}
			<Dialog
				open={!!receiveTarget}
				onOpenChange={(open) => !open && setReceiveTarget(null)}
			>
				<DialogContent className="w-[min(94vw,460px)] max-w-[460px] rounded-2xl">
					<DialogHeader>
						<DialogTitle style={{ fontFamily: "var(--dashboard-display)" }}>
							Receive transfer
						</DialogTitle>
						<DialogDescription>
							Confirm receipt of transfer{" "}
							<span className="font-mono">{receiveTarget?.transferNo}</span>. This
							credits the destination racks and completes the document.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2">
						<Button
							variant="outline"
							onClick={() => setReceiveTarget(null)}
							disabled={receiving}
						>
							Cancel
						</Button>
						<Button
							{...dashboardAccentButtonProps}
							onClick={() => receiveTarget && receiveMutation(receiveTarget.id)}
							disabled={receiving}
						>
							{receiving ? "Receiving…" : "Confirm receive"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Cancel Dialog (required reason) */}
			<Dialog
				open={!!cancelTarget}
				onOpenChange={(open) => {
					if (!open) {
						setCancelTarget(null);
						setCancelReason("");
					}
				}}
			>
				<DialogContent className="w-[min(94vw,480px)] max-w-[480px] rounded-2xl">
					<DialogHeader>
						<DialogTitle style={{ fontFamily: "var(--dashboard-display)" }}>
							Cancel transfer
						</DialogTitle>
						<DialogDescription>
							Cancelling transfer{" "}
							<span className="font-mono">{cancelTarget?.transferNo}</span>{" "}
							re-credits the source racks. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 py-2">
						<Label htmlFor="cancel-reason">Reason *</Label>
						<Textarea
							id="cancel-reason"
							placeholder="Why is this transfer being cancelled?"
							value={cancelReason}
							onChange={(e) => setCancelReason(e.target.value)}
							rows={3}
						/>
					</div>
					<DialogFooter className="gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setCancelTarget(null);
								setCancelReason("");
							}}
							disabled={cancelling}
						>
							Back
						</Button>
						<Button
							variant="destructive"
							onClick={handleConfirmCancel}
							disabled={cancelling || !cancelReason.trim()}
						>
							{cancelling ? "Cancelling…" : "Cancel transfer"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
