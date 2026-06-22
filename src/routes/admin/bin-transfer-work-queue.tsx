import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeftRight,
	Loader2,
	PackageOpen,
	Printer,
	Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { formatTransferQtyDisplay } from "@/components/stock-transfer/stock-transfer-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	CANCEL_STOCK_TRANSFER_MUTATION,
	DISPATCH_STOCK_TRANSFER_MUTATION,
	GENERATE_STOCK_TRANSFER_WORK_QUEUE_LIST_MUTATION,
	RECEIVE_STOCK_TRANSFER_MUTATION,
	STOCK_TRANSFERS_QUERY,
	type GenerateStockTransferWorkQueueListMutationData,
	type GenerateStockTransferWorkQueueListMutationVariables,
	type StockTransfersQueryData,
} from "@/lib/graphql/stock-transfer";
import type {
	StockTransfer,
	StockTransferItem,
	StockTransferStatus,
	StockTransferType,
} from "@/lib/graphql/types";
import { requirePermission } from "@/lib/rbac";
import { downloadPdfFromBase64 } from "@/lib/reports/report-pdf";
import { formatDate, toUserFriendlyMessage } from "@/lib/utils";

const PAGE_TITLE = "Internal Transfer Work Queue";
const PAGE_DESCRIPTION =
	"Storekeeper queue for approved internal transfers awaiting dispatch or destination receipt.";

export const Route = createFileRoute("/admin/bin-transfer-work-queue")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: BinTransferWorkQueueComponent,
	head: () => ({
		meta: [
			{
				title: "Internal Transfer Work Queue - SME Edaran WMS",
				description:
					"Dispatch warehouse transfers or confirm receipt at destination racks.",
			},
		],
	}),
});

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "response" in err) {
		const first = (
			err as { response?: { errors?: Array<{ message?: string }> } }
		).response?.errors?.[0];
		if (first?.message) {
			return toUserFriendlyMessage(
				first.message,
				"Something went wrong. Please try again.",
			);
		}
	}
	if (err instanceof Error) {
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	}
	return "Something went wrong. Please try again.";
}

function formatRackLocation(
	rack: {
		rackRow: string;
		rackColumn: string;
		rackLevel: string | number;
	} | null,
): string {
	if (!rack) return "-";
	return `${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`;
}

function formatSkuLot(item: StockTransferItem): string {
	const sku = item.skuCode ?? "—";
	const lot = item.lotNo?.trim() || "No lot";
	return `${sku} / ${lot}`;
}

function formatRoute(item: StockTransferItem): string {
	return `${formatRackLocation(item.sourceRack)} → ${formatRackLocation(item.destinationRack)}`;
}

function TypeBadge({ type }: { type: StockTransferType }) {
	return (
		<Badge variant="outline">
			{type === "BIN_TO_BIN" ? "Bin → Bin" : "Warehouse → Warehouse"}
		</Badge>
	);
}

function QueueStatusBadge({ status }: { status: StockTransferStatus }) {
	if (status === "AWAITING_DISPATCH") {
		return (
			<Badge className="border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-400">
				Awaiting Dispatch
			</Badge>
		);
	}
	return (
		<Badge className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400">
			In Transit
		</Badge>
	);
}

type QueueAction = "Dispatch" | "Confirm" | "Receive";

function getQueueAction(
	type: StockTransferType,
	status: StockTransferStatus,
): QueueAction | null {
	if (type === "WAREHOUSE_TO_WAREHOUSE" && status === "AWAITING_DISPATCH") {
		return "Dispatch";
	}
	if (type === "BIN_TO_BIN" && status === "IN_TRANSIT") {
		return "Confirm";
	}
	if (type === "WAREHOUSE_TO_WAREHOUSE" && status === "IN_TRANSIT") {
		return "Receive";
	}
	return null;
}

const TABLE_COLS = 6;

function BinTransferWorkQueueComponent() {
	const [searchTerm, setSearchTerm] = useState("");
	const trimmedSearchTerm = searchTerm.trim();
	const [actionTransferId, setActionTransferId] = useState<string | null>(null);
	const [cancelTarget, setCancelTarget] = useState<StockTransfer | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const queryClient = useQueryClient();
	const baseFilter = {
		search: trimmedSearchTerm || undefined,
		sortBy: "CREATED_AT",
		sortOrder: "ASC",
	} as const;

	const queueQueries = useQueries({
		queries: (["IN_TRANSIT", "AWAITING_DISPATCH"] as StockTransferStatus[]).map(
			(status) => {
				const queryVars = {
					filter: { ...baseFilter, status },
					pageSize: 200,
					pageNumber: 1,
				};
				return {
					queryKey: qk.stockTransfers.list(queryVars),
					queryFn: () =>
						gqlRequest<StockTransfersQueryData>(
							STOCK_TRANSFERS_QUERY,
							queryVars,
						),
				};
			},
		),
	});

	const queryLoading = queueQueries.some((q) => q.isLoading);
	const queryError = queueQueries.find((q) => q.error)?.error ?? null;

	const transfers = useMemo(() => {
		const merged = queueQueries.flatMap(
			(q) => q.data?.stockTransfers?.query ?? [],
		);
		const seen = new Set<string>();
		return merged
			.filter((t) => {
				if (seen.has(t.id)) return false;
				seen.add(t.id);
				return true;
			})
			.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			);
	}, [queueQueries]);

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: qk.stockTransfers.all });
		queryClient.invalidateQueries({ queryKey: qk.stockQuants.all });
	}

	const refetch = useCallback(() => {
		for (const q of queueQueries) {
			void q.refetch();
		}
	}, [queueQueries]);

	const { mutateAsync: receiveMutation, isPending: receiving } = useMutation({
		mutationFn: (id: string) =>
			gqlRequest(RECEIVE_STOCK_TRANSFER_MUTATION, { id }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Transfer received and completed");
			setActionTransferId(null);
			invalidate();
		},
	});

	const { mutateAsync: dispatchMutation, isPending: dispatching } = useMutation(
		{
			mutationFn: (id: string) =>
				gqlRequest(DISPATCH_STOCK_TRANSFER_MUTATION, { id }),
			onError: (err) => toast.error(getErrorMessage(err)),
			onSuccess: () => {
				toast.success("Transfer dispatched — stock debited from source");
				setActionTransferId(null);
				invalidate();
			},
		},
	);

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

	const workQueueListFilter = useMemo(
		() => ({
			...(trimmedSearchTerm ? { search: trimmedSearchTerm } : {}),
		}),
		[trimmedSearchTerm],
	);

	const { mutate: generateWorkQueueList, isPending: generatingWorkQueueList } =
		useMutation({
			mutationFn: (vars: GenerateStockTransferWorkQueueListMutationVariables) =>
				gqlRequest<
					GenerateStockTransferWorkQueueListMutationData,
					GenerateStockTransferWorkQueueListMutationVariables
				>(GENERATE_STOCK_TRANSFER_WORK_QUEUE_LIST_MUTATION, vars),
			onSuccess(data) {
				const { pdfBase64, filename } =
					data.generateStockTransferWorkQueueList;
				downloadPdfFromBase64(pdfBase64, filename);
			},
			onError: (err) => toast.error(getErrorMessage(err)),
		});

	const handlePrimaryAction = useCallback(
		async (transfer: StockTransfer) => {
			if (actionTransferId || receiving || dispatching) return;
			const action = getQueueAction(transfer.type, transfer.status);
			if (!action) return;

			setActionTransferId(transfer.id);
			try {
				if (action === "Dispatch") {
					await dispatchMutation(transfer.id);
				} else {
					await receiveMutation(transfer.id);
				}
			} finally {
				setActionTransferId(null);
			}
		},
		[
			actionTransferId,
			dispatchMutation,
			dispatching,
			receiveMutation,
			receiving,
		],
	);

	async function handleConfirmCancel() {
		if (!cancelTarget) return;
		const reason = cancelReason.trim();
		if (!reason) {
			toast.error("A cancellation reason is required.");
			return;
		}
		await cancelMutation({ id: cancelTarget.id, reason });
	}

	const busy = queryLoading || receiving || dispatching || cancelling;

	return (
		<div className="bin-transfer-work-queue-page min-h-screen bg-[var(--dashboard-surface)]">
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				id="main-content"
				className="container relative mx-auto p-6 space-y-6"
				aria-labelledby="bin-transfer-work-queue-page-title"
				aria-describedby="bin-transfer-work-queue-page-description"
			>
				<div
					aria-live="polite"
					aria-atomic="true"
					className="sr-only"
					role="status"
				>
					{queryLoading
						? "Loading items…"
						: transfers.length === 0
							? "No internal transfers awaiting action found."
							: `Showing ${transfers.length} transfer${transfers.length === 1 ? "" : "s"}.`}
				</div>

				<AdminPageHeader
					icon={ArrowLeftRight}
					title={PAGE_TITLE}
					description={PAGE_DESCRIPTION}
					titleId="bin-transfer-work-queue-page-title"
					descriptionId="bin-transfer-work-queue-page-description"
					rightSlot={
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
								aria-hidden
							/>
							<Input
								aria-label="Search internal transfers by transfer number or SKU"
								placeholder="Search transfers..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9 sm:w-64 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							/>
						</div>
					}
				/>

				<div className="flex items-center justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={() => generateWorkQueueList({ filter: workQueueListFilter })}
						disabled={generatingWorkQueueList || queryLoading}
						className="h-7 text-xs gap-1.5"
					>
						{generatingWorkQueueList ? (
							<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
						) : (
							<Printer className="h-3 w-3" aria-hidden />
						)}
						{generatingWorkQueueList ? "Generating…" : "Print Work Queue"}
					</Button>
				</div>

				{queryLoading && (
					<div
						className="flex items-center gap-2 text-muted-foreground text-sm"
						role="status"
						aria-live="polite"
					>
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						<span>Loading items…</span>
					</div>
				)}

				{queryError && (
					<div
						className="flex items-center gap-2 text-destructive text-sm rounded-lg border border-destructive/20 bg-destructive/5 p-4"
						role="alert"
					>
						<AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
						<span>Failed to load items: {(queryError as Error).message}</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
							className="ml-auto"
						>
							Retry
						</Button>
					</div>
				)}

				<section
					className="relative"
					aria-label="Internal transfer work queue table"
					aria-busy={busy}
				>
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table
							aria-label="Internal transfers awaiting dispatch or receipt"
						>
							<TableHeader>
								<TableRow>
									<TableHead>Transfer No.</TableHead>
									<TableHead>Source → Dest</TableHead>
									<TableHead>SKU / Lot</TableHead>
									<TableHead className="text-center">Qty</TableHead>
									<TableHead>Created By</TableHead>
									<TableHead>Created At</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{!queryLoading && transfers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={TABLE_COLS}
											className="py-16 text-center"
										>
											<div className="flex flex-col items-center gap-3">
												<div className="rounded-full bg-muted p-3">
													<PackageOpen
														className="h-8 w-8 text-muted-foreground"
														aria-hidden
													/>
												</div>
												<p className="font-medium text-foreground">
													No internal transfers awaiting action
												</p>
												<p className="text-sm text-muted-foreground">
													Approved bin-to-bin and warehouse transfers appear
													here until dispatched or received at destination.
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									transfers.flatMap((transfer) => {
										const primaryAction = getQueueAction(
											transfer.type,
											transfer.status,
										);
										return [
											<TableRow
												key={`group-${transfer.id}`}
												className="bg-muted/50 hover:bg-muted/60 border-l-4 border-l-primary/40"
											>
												<TableCell colSpan={TABLE_COLS} className="px-4 py-2.5">
													<div className="flex flex-wrap items-center gap-3">
														<span className="font-semibold text-sm">
															{transfer.transferNo}
														</span>
														<TypeBadge type={transfer.type} />
														<QueueStatusBadge status={transfer.status} />
														<span className="text-xs text-muted-foreground">
															{transfer.items.length} line
															{transfer.items.length === 1 ? "" : "s"}
														</span>
														<span className="text-xs text-muted-foreground">
															· {transfer.createdByUser?.displayName ?? "—"} ·{" "}
															{formatDate(transfer.createdAt)}
														</span>
														<div className="ml-auto flex items-center gap-2">
															{primaryAction ? (
																<Button
																	size="sm"
																	variant="default"
																	onClick={() => handlePrimaryAction(transfer)}
																	disabled={
																		receiving ||
																		dispatching ||
																		cancelling ||
																		actionTransferId === transfer.id
																	}
																	className="text-xs h-7"
																>
																	{actionTransferId === transfer.id ? (
																		<Loader2
																			className="h-3 w-3 animate-spin mr-1"
																			aria-hidden
																		/>
																	) : null}
																	{primaryAction}
																</Button>
															) : null}
															<Button
																size="sm"
																variant="outline"
																onClick={() => {
																	setCancelReason("");
																	setCancelTarget(transfer);
																}}
																disabled={
																	receiving ||
																	dispatching ||
																	cancelling ||
																	actionTransferId === transfer.id
																}
																className="text-xs h-7 text-destructive hover:text-destructive"
															>
																Cancel
															</Button>
														</div>
													</div>
												</TableCell>
											</TableRow>,
											...transfer.items.map((item) => (
												<TableRow key={item.id}>
													<TableCell className="font-mono text-sm text-muted-foreground">
														{transfer.transferNo}
													</TableCell>
													<TableCell className="text-sm">
														{formatRoute(item)}
													</TableCell>
													<TableCell className="font-mono text-sm">
														{formatSkuLot(item)}
													</TableCell>
													<TableCell className="text-center text-sm">
														{formatTransferQtyDisplay(item)}
													</TableCell>
													<TableCell className="text-sm">
														{transfer.createdByUser?.displayName ?? "—"}
													</TableCell>
													<TableCell className="text-sm text-muted-foreground">
														{formatDate(transfer.createdAt)}
													</TableCell>
												</TableRow>
											)),
										];
									})
								)}
							</TableBody>
						</Table>
					</div>
				</section>
			</main>

			<Dialog
					open={!!cancelTarget}
					onOpenChange={(open) => {
						if (!open) {
							setCancelTarget(null);
							setCancelReason("");
						}
					}}
				>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Cancel transfer</DialogTitle>
						<DialogDescription>
							{cancelTarget?.status === "AWAITING_DISPATCH"
								? "No stock has been moved yet. This action cannot be undone."
								: "Stock will return to the source rack. This action cannot be undone."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="cancel-reason">Reason</Label>
						<Textarea
							id="cancel-reason"
							value={cancelReason}
							onChange={(e) => setCancelReason(e.target.value)}
							placeholder="Why is this transfer being cancelled?"
							rows={3}
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setCancelTarget(null);
								setCancelReason("");
							}}
						>
							Keep transfer
						</Button>
						<Button
							variant="destructive"
							onClick={handleConfirmCancel}
							disabled={cancelling || !cancelReason.trim()}
						>
							{cancelling ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
							) : null}
							Cancel transfer
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
