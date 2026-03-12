import { useState, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@apollo/client/react";
import {
	STOCK_COUNTS_QUERY,
	type StockCount,
	type StockCountsQueryData,
	type StockCountsQueryVariables,
} from "@/lib/graphql/stock-count";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useStockUnitName } from "@/lib/hooks/use-stock-unit";
import {
	type Exception,
	type ExceptionStatusFilter,
	type ExceptionType,
	type StockCountAction,
	approveException,
	rejectException,
} from "@/data/exceptions.mock-data";

export const Route = createFileRoute("/admin/exceptions")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Exception"]);
	},
	component: ExceptionsComponent,
});

const exceptionStatuses: Array<ExceptionStatusFilter> = [
	"ALL",
	"pending",
	"approved",
	"rejected",
];

const exceptionTypes: Array<ExceptionType | "ALL"> = [
	"ALL",
	"SHORTAGE",
	"DAMAGE",
];

/** Exception row with server-provided diff for display */
type ExceptionRow = Exception & {
	qtyDifference: number;
	lossQtyDifference: number;
	reservedQty: number;
};

function stockCountToException(sc: StockCount): ExceptionRow {
	const date = sc.skuExpiryDate
		? (() => {
				const raw = sc.skuExpiryDate;
				const ms =
					typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : raw;
				const d = new Date(ms);
				return Number.isNaN(d.getTime()) ? new Date() : d;
			})()
		: new Date();
	return {
		id: sc.skuId,
		doNumber: "-",
		doId: "-",
		itemId: sc.skuId,
		sku: sc.skuCode,
		description: sc.skuDescription ?? "-",
		type: "SHORTAGE",
		quantity: sc.onHandQty + sc.lossQty,
		reason: "-",
		openingQtyDozen: sc.openingQty,
		openingQtyLoss: sc.openingLossQty,
		stockCountDate: date,
		closedQtyDozen: sc.onHandQty,
		closedQtyLoss: sc.lossQty,
		action: undefined,
		isApproved: false,
		reportedBy: "-",
		reportedByName: "-",
		reportedAt: date,
		status: "pending",
		qtyDifference: sc.qtyDifference,
		lossQtyDifference: sc.lossQtyDifference,
		reservedQty: sc.reservedQty,
	};
}

function ExceptionsComponent() {
	const { user } = useCurrentUser();
	const queryClient = useQueryClient();
	const unitName = useStockUnitName();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<ExceptionStatusFilter>("ALL");
	const [typeFilter, setTypeFilter] = useState<ExceptionType | "ALL">("ALL");
	const [selectedException, setSelectedException] = useState<Exception | null>(
		null,
	);
	const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

	// Track actions selected per row (Stock Count)
	const [rowActions, setRowActions] = useState<
		Record<string, StockCountAction | undefined>
	>({});
	// Manual key-in amounts per row (when action is "manual_key_in")
	const [rowManualAmounts, setRowManualAmounts] = useState<
		Record<string, { dozen: number; loss: number }>
	>({});
	// Track approval status per row (for demo)
	const [rowApprovals, setRowApprovals] = useState<Record<string, boolean>>({});
	// Track closed quantities (for close action demo)
	const [closedQuantities, setClosedQuantities] = useState<
		Record<string, { dozen: number; loss: number }>
	>({});

	const handleActionChange = useCallback(
		(id: string, action: StockCountAction) => {
			setRowActions((prev) => ({ ...prev, [id]: action }));
		},
		[],
	);

	const handleManualAmountChange = useCallback(
		(id: string, update: { dozen: number; loss: number }) => {
			setRowManualAmounts((prev) => ({ ...prev, [id]: update }));
		},
		[],
	);

	const handleApprovalClick = useCallback((id: string) => {
		setRowApprovals((prev) => ({ ...prev, [id]: true }));
	}, []);

	const handleCloseAction = useCallback((exc: Exception) => {
		// Demo: Replace closed qty with opening qty
		setClosedQuantities((prev) => ({
			...prev,
			[exc.id]: {
				dozen: exc.openingQtyDozen,
				loss: exc.openingQtyLoss,
			},
		}));
	}, []);

	const { data: stockCountsData, loading: isLoading } = useQuery<
		StockCountsQueryData,
		StockCountsQueryVariables
	>(STOCK_COUNTS_QUERY, { variables: {} });

	const allStockCounts: StockCount[] =
		stockCountsData?.stockCounts?.query ?? [];

	const { data, exceptions, totalPages } = useMemo(() => {
		const filtered = searchTerm.trim()
			? allStockCounts.filter(
					(s) =>
						s.skuCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
						(s.skuDescription ?? "")
							.toLowerCase()
							.includes(searchTerm.toLowerCase()),
				)
			: allStockCounts;
		const total = filtered.length;
		const start = (page - 1) * pageSize;
		const items = filtered
			.slice(start, start + pageSize)
			.map(stockCountToException);
		const summary = {
			byStatus: { pending: total, approved: 0, rejected: 0 },
			byType: { SHORTAGE: total, DAMAGE: 0 },
			total,
		};
		return {
			data: {
				items,
				summary,
				page,
				pageSize,
				total,
			},
			exceptions: items,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		};
	}, [allStockCounts, page, pageSize, searchTerm]);

	const approveMutation = useMutation({
		mutationFn: (id: string) =>
			approveException(id, user?.id || "", user?.displayName || ""),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["exceptions"] });
			setIsApproveDialogOpen(false);
			setSelectedException(null);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			rejectException(id, reason, user?.id || "", user?.displayName || ""),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["exceptions"] });
			setIsRejectDialogOpen(false);
			setSelectedException(null);
		},
	});

	const summary = data?.summary;

	const formatStatus = (status: string) => {
		return status.charAt(0).toUpperCase() + status.slice(1);
	};

	const handleApprove = () => {
		if (selectedException) {
			approveMutation.mutate(selectedException.id);
		}
	};

	const handleReject = (reason: string) => {
		if (selectedException) {
			rejectMutation.mutate({ id: selectedException.id, reason });
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
					<p className="text-muted-foreground">
						Manage shortage and damage reports
					</p>
				</div>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Pending</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.pending ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Approved</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.approved ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Rejected</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.rejected ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Total</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{summary.total}</div>
						</CardContent>
					</Card>
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Inventory List</CardTitle>
							<CardDescription>
								View and manage all inventory reports
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search inventory..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 sm:w-64"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(value) => {
									setStatusFilter(value as ExceptionStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									{exceptionStatuses.map((status) => (
										<SelectItem key={status} value={status}>
											{formatStatus(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={typeFilter}
								onValueChange={(value) => {
									setTypeFilter(value as ExceptionType | "ALL");
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by type" />
								</SelectTrigger>
								<SelectContent>
									{exceptionTypes.map((type) => (
										<SelectItem key={type} value={type}>
											{type === "ALL" ? "All Types" : type}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-16">Item</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="text-center">
										Opening Qty
										<br />
										<span className="text-xs font-normal">
											({unitName}/Loss)
										</span>
									</TableHead>
									<TableHead>Stock Count Date</TableHead>
									<TableHead className="text-center">
										Qty
										<br />
										<span className="text-xs font-normal">
											({unitName}/Loss)
										</span>
									</TableHead>
									<TableHead className="text-center">Reserved Qty</TableHead>
									<TableHead className="text-center">
										Diff
										<br />
										<span className="text-xs font-normal">
											({unitName}/Loss)
										</span>
									</TableHead>
									<TableHead>Stock Count</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead className="text-center">Approval</TableHead>
									<TableHead className="text-center">Close Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={11}
											className="h-24 text-center text-muted-foreground"
										>
											Loading inventory...
										</TableCell>
									</TableRow>
								) : exceptions.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={11}
											className="h-24 text-center text-muted-foreground"
										>
											No inventory found.
										</TableCell>
									</TableRow>
								) : (
									exceptions.map((exc, index) => {
										const row = exc as ExceptionRow;
										const selectedAction = rowActions[row.id] ?? row.action;
										const isManualKeyIn = selectedAction === "manual_key_in";
										const baseClosed = closedQuantities[row.id] ?? {
											dozen: row.closedQtyDozen,
											loss: row.closedQtyLoss,
										};
										const closedDozen =
											isManualKeyIn && rowManualAmounts[row.id] != null
												? rowManualAmounts[row.id].dozen
												: baseClosed.dozen;
										const closedLoss =
											isManualKeyIn && rowManualAmounts[row.id] != null
												? rowManualAmounts[row.id].loss
												: baseClosed.loss;
										const diffDozen = row.qtyDifference;
										const diffLoss = row.lossQtyDifference;
										const isApproved = rowApprovals[row.id] ?? row.isApproved;
										const displayDozen =
											rowManualAmounts[row.id]?.dozen ?? baseClosed.dozen;
										const displayLoss =
											rowManualAmounts[row.id]?.loss ?? baseClosed.loss;

										return (
											<TableRow key={row.id}>
												<TableCell className="font-medium">
													{(page - 1) * pageSize + index + 1}
												</TableCell>
												<TableCell>{row.sku}</TableCell>
												<TableCell className="max-w-[200px] truncate">
													{row.description}
												</TableCell>
												<TableCell className="text-center">
													{row.openingQtyDozen} / {row.openingQtyLoss}
												</TableCell>
												<TableCell>
													{row.stockCountDate.toLocaleDateString("en-MY")}
												</TableCell>
												<TableCell className="text-center">
													{isManualKeyIn ? (
														<div className="flex items-center justify-center gap-1">
															<Input
																type="number"
																min={0}
																className="h-8 w-16 text-center"
																placeholder={String(row.closedQtyDozen)}
																value={displayDozen}
																onChange={(e) => {
																	const v = e.target.value;
																	handleManualAmountChange(row.id, {
																		dozen: v === "" ? 0 : Number(v),
																		loss: displayLoss,
																	});
																}}
															/>
															<span className="text-muted-foreground">/</span>
															<Input
																type="number"
																min={0}
																className="h-8 w-16 text-center"
																placeholder={String(row.closedQtyLoss)}
																value={displayLoss}
																onChange={(e) => {
																	const v = e.target.value;
																	handleManualAmountChange(row.id, {
																		dozen: displayDozen,
																		loss: v === "" ? 0 : Number(v),
																	});
																}}
															/>
														</div>
													) : (
														`${closedDozen} / ${closedLoss}`
													)}
												</TableCell>
												<TableCell className="text-center">
													{row.reservedQty}
												</TableCell>
												<TableCell className="text-center">
													<span
														className={
															diffDozen !== 0 || diffLoss !== 0
																? diffDozen > 0 || diffLoss > 0
																	? "text-red-600 font-medium"
																	: "text-green-600 font-medium"
																: ""
														}
													>
														{diffDozen > 0 ? `-${diffDozen}` : diffDozen} /{" "}
														{diffLoss > 0 ? `-${diffLoss}` : diffLoss}
													</span>
												</TableCell>
												<TableCell>
													<div className="flex flex-col gap-2">
														<Select
															value={selectedAction || ""}
															onValueChange={(value) =>
																handleActionChange(
																	row.id,
																	value as StockCountAction,
																)
															}
														>
															<SelectTrigger className="w-[160px]">
																<SelectValue placeholder="Select..." />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="tally_to_opening">
																	Tally to opening
																</SelectItem>
																<SelectItem value="tally_to_stock_count">
																	Tally to Stock Count
																</SelectItem>
																<SelectItem value="manual_key_in">
																	Manual Key in amount
																</SelectItem>
															</SelectContent>
														</Select>
													</div>
												</TableCell>
												<TableCell>{row.reason}</TableCell>
												<TableCell className="text-center">
													{isApproved ? (
														<Badge
															variant="outline"
															className="bg-green-500/10 text-green-600 border-green-500/20"
														>
															Approved
														</Badge>
													) : (
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleApprovalClick(row.id)}
															disabled={!selectedAction}
														>
															Approve
														</Button>
													)}
												</TableCell>
												<TableCell className="text-center">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleCloseAction(row)}
														disabled={!isApproved}
													>
														Close
													</Button>
												</TableCell>
											</TableRow>
										);
									})
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
								of <span className="font-medium">{data.total}</span> inventory
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

			{/* Approve Dialog */}
			<Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Approve Inventory</DialogTitle>
						<DialogDescription>
							Are you sure you want to approve this inventory? This will trigger
							an inventory adjustment.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsApproveDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleApprove}
							disabled={approveMutation.isPending}
						>
							{approveMutation.isPending ? "Approving..." : "Approve"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reject Dialog */}
			<Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject Inventory</DialogTitle>
						<DialogDescription>
							Please provide a reason for rejecting this inventory.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const reason = formData.get("reason") as string;
							if (reason) {
								handleReject(reason);
							}
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel>Rejection Reason</FieldLabel>
								<Textarea
									name="reason"
									placeholder="Enter rejection reason..."
									required
									rows={3}
								/>
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsRejectDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="destructive"
								disabled={rejectMutation.isPending}
							>
								{rejectMutation.isPending ? "Rejecting..." : "Reject"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
