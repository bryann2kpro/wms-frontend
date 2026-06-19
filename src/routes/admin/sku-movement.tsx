import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { requirePermission } from "@/lib/rbac";
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
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Activity,
	AlertTriangle,
	ArrowDownToLine,
	ArrowUpFromLine,
	ArrowDownUp,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	Settings2,
	ShieldCheck,
	Skull,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	INVENTORY_BALANCES_QUERY,
	getAvailableQty,
	type InventoryBalancesQueryData,
} from "@/lib/graphql/inventory-balance";
import {
	BACKFILL_SKU_MOVEMENTS_MUTATION,
	INVENTORY_MOVEMENTS_QUERY,
	RECONCILE_SKU_BALANCE_MUTATION,
	SKU_INTEGRITY_CHECK_QUERY,
	type BackfillSkuMovementsMutationData,
	type InventoryMovement,
	type InventoryMovementType,
	type InventoryMovementsQueryData,
	type InventoryMovementsQueryVariables,
	type ReconcileSkuBalanceMutationData,
	type SkuIntegrityCheckQueryData,
} from "@/lib/graphql/inventory-movement";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sku-movement")({
	validateSearch: (search: Record<string, unknown>) => ({
		skuId: (search.skuId as string) ?? "",
	}),
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: SkuMovementComponent,
	head: () => ({
		meta: [
			{
				title: "SKU Movement - SME Edaran WMS",
				description: "Inbound and outbound movement history for a SKU.",
			},
		],
	}),
});

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type MovementTypeFilter = InventoryMovementType | "ALL";

const PHYSICAL_TYPES: InventoryMovementType[] = [
	"INBOUND",
	"SHIPMENT",
	"ADJUSTMENT",
	"DAMAGED",
];

const TYPE_CONFIG: Record<
	InventoryMovementType,
	{ label: string; badgeClass: string; icon: React.ReactNode; sign: "+" | "−" }
> = {
	INBOUND: {
		label: "Inbound",
		badgeClass:
			"bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400",
		icon: <ArrowDownToLine className="h-3 w-3" />,
		sign: "+",
	},
	SHIPMENT: {
		label: "Shipment",
		badgeClass:
			"bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
		icon: <ArrowUpFromLine className="h-3 w-3" />,
		sign: "−",
	},
	ADJUSTMENT: {
		label: "Adjustment",
		badgeClass:
			"bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
		icon: <Settings2 className="h-3 w-3" />,
		sign: "+",
	},
	DAMAGED: {
		label: "Damaged",
		badgeClass:
			"bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
		icon: <Skull className="h-3 w-3" />,
		sign: "−",
	},
	RESERVED: {
		label: "Reserved",
		badgeClass:
			"bg-gray-500/10 text-gray-700 border-gray-500/20 dark:text-gray-400",
		icon: null,
		sign: "−",
	},
};

function qtyColor(type: InventoryMovementType): string {
	if (type === "INBOUND" || type === "ADJUSTMENT") return "text-green-600 dark:text-green-400";
	return "text-red-600 dark:text-red-400";
}

function MovementTypeBadge({ type }: { type: InventoryMovementType }) {
	const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.ADJUSTMENT;
	return (
		<Badge
			variant="outline"
			className={`flex items-center gap-1 text-xs ${cfg.badgeClass}`}
		>
			{cfg.icon}
			{cfg.label}
		</Badge>
	);
}

function SkuMovementComponent() {
	const { skuId } = Route.useSearch();
	const navigate = useNavigate();

	const [page, setPage] = useState(1);
	const [selectedType, setSelectedType] = useState<MovementTypeFilter>("ALL");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [refSearch, setRefSearch] = useState("");
	const [sortOrder, setSortOrder] = useState<"DESC" | "ASC">("DESC");
	const [reconcileOpen, setReconcileOpen] = useState(false);
	const [integrityChecked, setIntegrityChecked] = useState(false);
	const debouncedRef = useDebouncedValue(refSearch, SEARCH_DEBOUNCE_MS);

	const movementTypes: InventoryMovementType[] | undefined =
		selectedType === "ALL" ? PHYSICAL_TYPES : [selectedType];

	const balanceVars = { filter: { skuId }, pageSize: 1, pageNumber: 1 };
	const {
		data: balanceData,
		isLoading: balanceLoading,
		refetch: refetchBalance,
	} = useQuery({
		queryKey: qk.inventory.list(balanceVars),
		queryFn: () =>
			gqlRequest<InventoryBalancesQueryData>(
				INVENTORY_BALANCES_QUERY,
				balanceVars,
			),
		enabled: !!skuId,
	});

	const movementsVars: InventoryMovementsQueryVariables = {
		filter: {
			skuId,
			movementTypes,
			referenceNo: debouncedRef.trim() || undefined,
			dateFrom: dateFrom || undefined,
			dateTo: dateTo || undefined,
		},
		pageSize: PAGE_SIZE,
		pageNumber: page,
		sortBy: "created_at",
		sortOrder,
	};
	const {
		data: movementsData,
		isLoading: movementsLoading,
		refetch: refetchMovements,
	} = useQuery({
		queryKey: qk.inventoryMovements.list(movementsVars),
		queryFn: () =>
			gqlRequest<
				InventoryMovementsQueryData,
				InventoryMovementsQueryVariables
			>(INVENTORY_MOVEMENTS_QUERY, movementsVars),
		enabled: !!skuId,
	});

	const { mutate: reconcileSkuBalance, isPending: reconcileLoading } =
		useMutation({
			mutationFn: (vars: { skuId: string }) =>
				gqlRequest<ReconcileSkuBalanceMutationData>(
					RECONCILE_SKU_BALANCE_MUTATION,
					vars,
				),
			onSuccess: (data) => {
				const r = data.reconcileSkuBalance;
				toast.success(
					`Balance recalculated — ${r.movementsFixed} movements fixed. Final on-hand: ${Number(r.finalOnHandQty).toFixed(2)}`,
				);
				setReconcileOpen(false);
				refetchBalance();
				refetchMovements();
			},
			onError: (err: Error) => {
				toast.error(err.message ?? "Recalculation failed");
			},
		});

	const {
		data: integrityData,
		isLoading: integrityLoading,
		refetch: refetchIntegrity,
	} = useQuery({
		queryKey: ["sku-integrity-check", skuId] as const,
		queryFn: () =>
			gqlRequest<SkuIntegrityCheckQueryData>(SKU_INTEGRITY_CHECK_QUERY, {
				skuId,
			}),
		enabled: !!skuId && integrityChecked,
	});

	const { mutate: backfillSkuMovements, isPending: backfillLoading } =
		useMutation({
			mutationFn: (vars: { skuId: string }) =>
				gqlRequest<BackfillSkuMovementsMutationData>(
					BACKFILL_SKU_MOVEMENTS_MUTATION,
					vars,
				),
			onSuccess: (data) => {
				const r = data.backfillSkuMovements;
				toast.success(
					`${r.backfilledCount} movement${r.backfilledCount !== 1 ? "s" : ""} backfilled. Balance recalculated.`,
				);
				refetchIntegrity();
				refetchBalance();
				refetchMovements();
			},
			onError: (err: Error) => toast.error(err.message ?? "Backfill failed"),
		});

	const integrity = integrityData?.skuIntegrityCheck;

	const balance = balanceData?.inventoryBalances?.query?.[0];
	const movements = movementsData?.inventoryMovements?.query ?? [];
	const pagination = movementsData?.inventoryMovements?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const totalCount = pagination?.totalCount ?? 0;

	const onHand = Number(balance?.onHandQty ?? 0);
	const reserved = Number(balance?.reservedQty ?? 0);
	const available = balance ? getAvailableQty(balance) : 0;

	function handleFilterChange() {
		setPage(1);
	}

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="sku-movement-title"
			aria-busy={balanceLoading || movementsLoading}
		>
			{(balanceLoading || movementsLoading) && <GlobalLoadingShadow />}

			{/* Header */}
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/admin/inventory", search: { tab: "inventory" } })}
					aria-label="Back to inventory"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<AdminPageHeader
					icon={Activity}
					title={balance ? `${balance.skuCode}` : "SKU Movement"}
					description={balance?.skuDescription ?? "Movement history for this SKU"}
					titleId="sku-movement-title"
					descriptionId="sku-movement-description"
				/>
				<div className="ml-auto">
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5 text-xs"
						onClick={() => setReconcileOpen(true)}
						disabled={!skuId}
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Recalculate
					</Button>
				</div>
			</div>

			{/* Recalculate confirmation dialog */}
			<Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Recalculate balance history</DialogTitle>
						<DialogDescription>
							All movement records for this SKU will be replayed from zero to recompute
							the running balance. The current stock balance will also be updated to
							match. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setReconcileOpen(false)}
							disabled={reconcileLoading}
						>
							Cancel
						</Button>
						<Button
							onClick={() => reconcileSkuBalance({ skuId })}
							disabled={reconcileLoading}
						>
							{reconcileLoading ? "Recalculating…" : "Confirm"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Summary card */}
			<Card className="dashboard-card">
				<CardHeader>
					<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Current Stock
					</CardTitle>
					<CardDescription>
						Live inventory balance for this SKU. Available = On Hand − Reserved.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-3 gap-4">
						<div className="rounded-lg border p-4">
							<p className="text-xs text-muted-foreground">On Hand</p>
							<p className="text-2xl font-bold mt-1">{onHand.toFixed(2)}</p>
						</div>
						<div className="rounded-lg border p-4">
							<p className="text-xs text-muted-foreground">Reserved</p>
							<p className="text-2xl font-bold mt-1">{reserved.toFixed(2)}</p>
						</div>
						<div className="rounded-lg border p-4">
							<p className="text-xs text-muted-foreground">Available</p>
							<p
								className={`text-2xl font-bold mt-1 ${
									available <= 0 ? "text-red-600 dark:text-red-400" : ""
								}`}
							>
								{available.toFixed(2)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Integrity check card */}
			<Card className="dashboard-card">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Movement Integrity
							</CardTitle>
							<CardDescription className="mt-1">
								Check for approved GRNs, shipped POs, and adjustments that are missing movement records.
							</CardDescription>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5 text-xs shrink-0"
							onClick={() => {
								if (!integrityChecked) {
									setIntegrityChecked(true);
								} else {
									refetchIntegrity();
								}
							}}
							disabled={integrityLoading || !skuId}
						>
							<ShieldCheck className="h-3.5 w-3.5" />
							{integrityLoading ? "Checking…" : "Check"}
						</Button>
					</div>
				</CardHeader>

				{integrityChecked && (
					<CardContent className="space-y-4">
						{integrityLoading ? (
							<p className="text-sm text-muted-foreground">Checking integrity…</p>
						) : integrity ? (
							<>
								{integrity.totalMissing === 0 ? (
									<div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
										<CheckCircle2 className="h-4 w-4" />
										All transactions have corresponding movement records.
									</div>
								) : (
									<div className="space-y-4">
										<div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
											<AlertTriangle className="h-4 w-4" />
											{integrity.totalMissing} missing movement record{integrity.totalMissing !== 1 ? "s" : ""} found.
										</div>

										{integrity.missingGrnMovements.length > 0 && (
											<div className="rounded-md border">
												<div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40">
													Missing GRN Inbound ({integrity.missingGrnMovements.length})
												</div>
												<div className="divide-y">
													{integrity.missingGrnMovements.map((item) => (
														<div key={item.grnItemId} className="flex items-center justify-between px-3 py-2 text-xs">
															<span className="font-mono">{item.grnNo}</span>
															<span className="text-muted-foreground">+{Number(item.qty).toFixed(2)}</span>
														</div>
													))}
												</div>
											</div>
										)}

										{integrity.missingDoMovements.length > 0 && (
											<div className="rounded-md border">
												<div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40">
													Missing DO Shipment ({integrity.missingDoMovements.length})
												</div>
												<div className="divide-y">
													{integrity.missingDoMovements.map((item) => (
														<div key={item.doItemId} className="flex items-center justify-between px-3 py-2 text-xs">
															<span className="font-mono">{item.poNo}</span>
															<span className="text-muted-foreground">−{Number(item.qtyRequired).toFixed(2)}</span>
														</div>
													))}
												</div>
											</div>
										)}

										{integrity.missingAdjustmentMovements.length > 0 && (
											<div className="rounded-md border">
												<div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40">
													Missing Adjustments ({integrity.missingAdjustmentMovements.length})
												</div>
												<div className="divide-y">
													{integrity.missingAdjustmentMovements.map((item) => (
														<div key={item.adjustmentItemId} className="flex items-center justify-between px-3 py-2 text-xs">
															<span className="font-mono">{item.adjustmentNo}</span>
															<span className="text-muted-foreground">
																{item.movementType === "DAMAGED" ? "−" : "+"}{Number(item.quantity).toFixed(2)}
															</span>
														</div>
													))}
												</div>
											</div>
										)}

										<Button
											size="sm"
											className="gap-1.5 text-xs"
											onClick={() => backfillSkuMovements({ skuId })}
											disabled={backfillLoading}
										>
											<RefreshCw className="h-3.5 w-3.5" />
											{backfillLoading ? "Backfilling…" : "Backfill & Recalculate"}
										</Button>
									</div>
								)}
							</>
						) : null}
					</CardContent>
				)}
			</Card>

			{/* Movements table card */}
			<Card className="dashboard-card">
				<CardHeader>
					<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Movement History
					</CardTitle>
					<CardDescription>
						Physical stock changes — inbound receipts, shipments, and adjustments.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Filter bar */}
					<div className="flex flex-wrap items-end gap-3">
						{/* Type filter chips */}
						<div className="flex flex-wrap gap-1.5">
							{(["ALL", ...PHYSICAL_TYPES] as MovementTypeFilter[]).map((t) => {
								const isActive = selectedType === t;
								return (
									<button
										key={t}
										type="button"
										onClick={() => {
											setSelectedType(t);
											handleFilterChange();
										}}
										className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
											isActive
												? "bg-primary text-primary-foreground border-primary"
												: "bg-background text-muted-foreground hover:bg-muted border-input"
										}`}
									>
										{t === "ALL"
											? "All Types"
											: TYPE_CONFIG[t as InventoryMovementType].label}
									</button>
								);
							})}
						</div>

						<div className="flex flex-wrap items-end gap-2 ml-auto">
							{/* Date from */}
							<div className="flex flex-col gap-1">
								<label className="text-xs text-muted-foreground">From</label>
								<input
									type="date"
									value={dateFrom}
									onChange={(e) => {
										setDateFrom(e.target.value);
										handleFilterChange();
									}}
									className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							</div>

							{/* Date to */}
							<div className="flex flex-col gap-1">
								<label className="text-xs text-muted-foreground">To</label>
								<input
									type="date"
									value={dateTo}
									onChange={(e) => {
										setDateTo(e.target.value);
										handleFilterChange();
									}}
									className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							</div>

							{/* Reference # search */}
							<Input
								placeholder="Reference #"
								value={refSearch}
								onChange={(e) => {
									setRefSearch(e.target.value);
									handleFilterChange();
								}}
								className="h-8 w-36 text-xs"
							/>

							{/* Date sort order toggle */}
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 gap-1.5 text-xs"
								onClick={() => {
									setSortOrder((s) => (s === "DESC" ? "ASC" : "DESC"));
									setPage(1);
								}}
								aria-label={`Sort by date ${sortOrder === "DESC" ? "ascending" : "descending"}`}
							>
								<ArrowDownUp className="h-3 w-3" />
								{sortOrder === "DESC" ? "Newest first" : "Oldest first"}
							</Button>
						</div>
					</div>

					{/* Table */}
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-xs">Date</TableHead>
									<TableHead className="text-xs">Type</TableHead>
									<TableHead className="text-xs">Reference #</TableHead>
									<TableHead className="text-xs text-right">Qty</TableHead>
									<TableHead className="text-xs text-right">Balance After</TableHead>
									<TableHead className="text-xs">Lot #</TableHead>
									<TableHead className="text-xs">Reason</TableHead>
									<TableHead className="text-xs">By</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{movementsLoading ? (
									<TableRow>
										<TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
											Loading...
										</TableCell>
									</TableRow>
								) : movements.length === 0 ? (
									<TableRow>
										<TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
											No movements found.
										</TableCell>
									</TableRow>
								) : (
									movements.map((m: InventoryMovement) => {
										const cfg = TYPE_CONFIG[m.movementType];
										const qty = Number(m.quantity ?? 0);
										const balAfter = Number(m.balanceAfter ?? 0);
										return (
											<TableRow key={m.id}>
												<TableCell className="text-xs">
													{m.createdAt ? formatDate(m.createdAt) : "—"}
												</TableCell>
												<TableCell>
													<MovementTypeBadge type={m.movementType} />
												</TableCell>
												<TableCell className="text-xs font-mono">
													{m.referenceNo ?? "—"}
												</TableCell>
												<TableCell className={`text-xs font-medium text-right ${qtyColor(m.movementType)}`}>
													{cfg?.sign}{qty.toFixed(2)}
												</TableCell>
												<TableCell className="text-xs text-right">
													{balAfter.toFixed(2)}
												</TableCell>
												<TableCell className="text-xs font-mono">
													{m.lotNo ?? "—"}
												</TableCell>
												<TableCell className="text-xs max-w-[160px] truncate">
													{m.reason ?? "—"}
												</TableCell>
												<TableCell className="text-xs text-muted-foreground">
													{m.createdByUser?.displayName ?? "—"}
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>

					{/* Pagination */}
					{totalCount > 0 && (
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>
								{totalCount} movement{totalCount !== 1 ? "s" : ""}
							</span>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									className="h-7 w-7"
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page <= 1}
									aria-label="Previous page"
								>
									<ChevronLeft className="h-3.5 w-3.5" />
								</Button>
								<span>
									Page {page} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									className="h-7 w-7"
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									disabled={page >= totalPages}
									aria-label="Next page"
								>
									<ChevronRight className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
