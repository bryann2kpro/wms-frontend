import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Search,
	ChevronLeft,
	ChevronRight,
	Undo2,
	Clock,
	CheckCircle2,
	PackageX,
	CalendarClock,
	MapPin,
	ImageOff,
	Eye,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	RackLocationCombobox,
	sortRacksByLocation,
} from "@/components/grn/rack-location-combobox";
import {
	RETURNS_QUERY,
	RETURNS_STATS_QUERY,
	ASSIGN_RETURN_ITEM_TO_RACK_MUTATION,
	type ReturnDoc,
	type ReturnItem,
	type ReturnsQueryData,
	type ReturnsQueryVariables,
	type ReturnsStatsQueryData,
	type AssignReturnItemToRackMutationData,
	type AssignReturnItemToRackMutationVariables,
} from "@/lib/graphql/returns";
import {
	RACKS_QUERY,
	type RacksQueryData,
	type RacksQueryVariables,
} from "@/lib/graphql/racks";
import {
	ZONES_QUERY,
	type ZonesQueryData,
	type ZonesQueryVariables,
} from "@/lib/graphql/zones";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/returns")({
	beforeLoad: async ({ context }) => {
		// "Return" module, with "Inventory" as fallback in case the module seed
		// has not been run yet (requirePermission passes when ANY module matches).
		await requirePermission(context.queryClient, ["Return", "Inventory"]);
	},
	component: ReturnsComponent,
	head: () => ({
		meta: [
			{
				title: "Returns - SME Edaran WMS",
				description:
					"Manage goods returned by outlets: review return documents and put away returned stock.",
			},
		],
	}),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "\u2014";
	return new Date(iso).toLocaleDateString("en-MY", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return "\u2014";
	return new Date(iso).toLocaleString("en-MY", {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function ReasonBadge({ reason }: { reason: string }) {
	if (reason === "DAMAGED") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[0.7rem] font-semibold text-red-700 ring-1 ring-red-200">
				<PackageX className="h-3 w-3" />
				Damaged
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-700 ring-1 ring-amber-200">
			<CalendarClock className="h-3 w-3" />
			About to Expire
		</span>
	);
}

function ReturnStatusBadge({ status }: { status: string }) {
	if (status === "COMPLETED") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-300/50">
				<CheckCircle2 className="h-3 w-3" />
				Completed
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold text-sky-700 ring-1 ring-sky-200">
			<Clock className="h-3 w-3" />
			Received
		</span>
	);
}

function ItemStatusBadge({ item }: { item: ReturnItem }) {
	if (item.status === "ASSIGNED") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-300/50">
				<CheckCircle2 className="h-3 w-3" />
				Assigned
			</span>
		);
	}
	const partial = Number(item.qtyPutaway) > 0;
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground ring-1 ring-border/40">
			<Clock className="h-3 w-3" />
			{partial ? "Partially assigned" : "Pending"}
		</span>
	);
}

// ─── Photo thumbnails with preview ──────────────────────────────────────────

function PhotoThumbnails({ item }: { item: ReturnItem }) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	if (item.photos.length === 0) {
		return (
			<span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground/60">
				<ImageOff className="h-3 w-3" />
				No photos
			</span>
		);
	}

	return (
		<>
			<div className="flex items-center gap-1.5">
				{item.photos.map((photo) =>
					photo.url ? (
						<button
							key={photo.id}
							type="button"
							className="h-10 w-10 overflow-hidden rounded-md border border-border/50 transition-all hover:ring-2 hover:ring-amber-400/40"
							onClick={() => setPreviewUrl(photo.url)}
							title={photo.fileName}
						>
							<img
								src={photo.url}
								alt={photo.fileName}
								className="h-full w-full object-cover"
							/>
						</button>
					) : null,
				)}
			</div>

			<Dialog
				open={!!previewUrl}
				onOpenChange={(open) => !open && setPreviewUrl(null)}
			>
				<DialogContent className="overflow-hidden p-0 sm:max-w-lg">
					<DialogHeader className="px-4 pb-2 pt-4">
						<DialogTitle className="text-sm">Return Photo</DialogTitle>
					</DialogHeader>
					{previewUrl && (
						<div className="px-4 pb-4">
							<img
								src={previewUrl}
								alt="Return evidence"
								className="h-auto w-full rounded-lg"
							/>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

// ─── Putaway controls for a pending item ─────────────────────────────────────

function AssignItemControls({
	item,
	damagedRacks,
	normalRacks,
	onAssigned,
}: {
	item: ReturnItem;
	damagedRacks: ReturnType<typeof sortRacksByLocation>;
	normalRacks: ReturnType<typeof sortRacksByLocation>;
	onAssigned: () => void;
}) {
	const remaining = Math.max(
		0,
		(Number(item.qtyReturned) || 0) - (Number(item.qtyPutaway) || 0),
	);
	const [rackId, setRackId] = useState("");
	const [qty, setQty] = useState(String(remaining));

	const isDamaged = item.reason === "DAMAGED";
	const racks = isDamaged ? damagedRacks : normalRacks;

	const { mutate: assign, isPending } = useMutation({
		mutationFn: (vars: AssignReturnItemToRackMutationVariables) =>
			gqlRequest<
				AssignReturnItemToRackMutationData,
				AssignReturnItemToRackMutationVariables
			>(ASSIGN_RETURN_ITEM_TO_RACK_MUTATION, vars),
		onSuccess: () => {
			toast.success("Return item put away");
			setRackId("");
			onAssigned();
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Assignment failed");
		},
	});

	const qtyNum = Number(qty);
	const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= remaining;

	return (
		<div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
			<p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
				<MapPin className="h-3.5 w-3.5 text-amber-600" />
				Put away to {isDamaged ? "a DAMAGED-zone rack" : "a storage rack"}
			</p>
			{isDamaged && damagedRacks.length === 0 && (
				<p className="text-[0.7rem] text-red-600">
					No racks found in a DAMAGED zone. Create one under Warehouse Setup
					first.
				</p>
			)}
			<div className="flex flex-wrap items-center gap-2">
				<div className="min-w-[220px] flex-1">
					<RackLocationCombobox
						racks={racks}
						value={rackId}
						onChange={(id) => setRackId(id)}
						placeholder={
							isDamaged ? "Select DAMAGED-zone rack…" : "Select rack…"
						}
						disabled={isPending}
					/>
				</div>
				<Input
					type="number"
					min={0}
					step="any"
					inputMode="decimal"
					value={qty}
					onChange={(e) => setQty(e.target.value)}
					disabled={isPending}
					className={`h-9 w-24 text-center text-sm ${
						!qtyValid && qty !== ""
							? "border-red-300 focus-visible:ring-red-400"
							: ""
					}`}
				/>
				<Button
					size="sm"
					className="h-9 gap-1.5 bg-amber-500 text-white hover:bg-amber-600"
					disabled={isPending || !rackId || !qtyValid}
					onClick={() =>
						assign({ returnItemId: item.id, rackId, qty: String(qtyNum) })
					}
				>
					{isPending ? (
						<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
					) : (
						<CheckCircle2 className="h-3.5 w-3.5" />
					)}
					Assign
				</Button>
			</div>
			<p className="text-[0.7rem] text-muted-foreground">
				Remaining to put away:{" "}
				<span className="font-mono font-medium text-foreground">
					{remaining}
				</span>
				{isDamaged
					? " — recorded as loss, stock is not re-entered."
					: " — stock re-enters at the chosen rack (original lot/expiry kept)."}
			</p>
		</div>
	);
}

// ─── Return detail dialog ────────────────────────────────────────────────────

function ReturnDetailDialog({
	returnDoc,
	open,
	onOpenChange,
	damagedRacks,
	normalRacks,
	onAssigned,
}: {
	returnDoc: ReturnDoc | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	damagedRacks: ReturnType<typeof sortRacksByLocation>;
	normalRacks: ReturnType<typeof sortRacksByLocation>;
	onAssigned: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
				{returnDoc && (
					<>
						<DialogHeader className="border-b bg-muted/40 px-6 pb-4 pt-5">
							<div className="flex items-start justify-between gap-3 pr-8">
								<div>
									<DialogTitle
										className="text-base"
										style={{ fontFamily: "var(--dashboard-display)" }}
									>
										{returnDoc.returnNo}
									</DialogTitle>
									<p className="mt-1 text-xs text-muted-foreground">
										DO{" "}
										<span className="font-medium text-foreground">
											{returnDoc.doNo}
										</span>{" "}
										· PO{" "}
										<span className="font-medium text-foreground">
											{returnDoc.poNo}
										</span>
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Received {formatDateTime(returnDoc.receivedAt)}
										{returnDoc.receivedByUser
											? ` by ${returnDoc.receivedByUser.displayName}`
											: ""}
									</p>
									{returnDoc.notes && (
										<p className="mt-1 text-xs italic text-muted-foreground">
											"{returnDoc.notes}"
										</p>
									)}
								</div>
								<ReturnStatusBadge status={returnDoc.status} />
							</div>
						</DialogHeader>

						<div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
							{returnDoc.items.map((item) => {
								const qtyReturned = Number(item.qtyReturned) || 0;
								const qtyPutaway = Number(item.qtyPutaway) || 0;
								const pct =
									qtyReturned > 0
										? Math.min(100, Math.round((qtyPutaway / qtyReturned) * 100))
										: 0;
								const isPending =
									item.status === "PENDING" && returnDoc.status === "RECEIVED";

								return (
									<div
										key={item.id}
										className="space-y-3 rounded-xl border border-border/60 bg-white p-4"
									>
										{/* Header row */}
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<span className="inline-block rounded bg-slate-100/80 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-slate-700">
														{item.skuCode ?? item.skuId}
													</span>
													<ReasonBadge reason={item.reason} />
													<ItemStatusBadge item={item} />
												</div>
												{item.skuDescription && (
													<p className="mt-1 truncate text-xs text-muted-foreground">
														{item.skuDescription}
													</p>
												)}
												<p className="mt-0.5 text-[0.7rem] text-muted-foreground/80">
													{item.lotNo ? `Lot ${item.lotNo}` : "No lot"}
													{" · "}
													{item.expiryDate
														? `Exp ${formatDate(item.expiryDate)}`
														: "No expiry"}
												</p>
											</div>
											<div className="text-right">
												<p className="font-mono text-sm font-semibold tabular-nums">
													{qtyPutaway}
													<span className="text-muted-foreground/60">
														{" "}
														/ {qtyReturned}
													</span>
												</p>
												<p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
													Put away
												</p>
											</div>
										</div>

										{/* Putaway progress */}
										<div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
											<div
												className={`h-full rounded-full transition-all duration-500 ${
													pct >= 100
														? "bg-gradient-to-r from-emerald-400 to-emerald-500"
														: "bg-gradient-to-r from-amber-400 to-amber-500"
												}`}
												style={{ width: `${pct}%` }}
											/>
										</div>

										{/* Condition notes */}
										{item.conditionNotes && (
											<p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-foreground/70">
												{item.conditionNotes}
											</p>
										)}

										{/* Photos + assigned rack */}
										<div className="flex flex-wrap items-center justify-between gap-2">
											<PhotoThumbnails item={item} />
											{item.assignedRackLabel && (
												<span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
													<MapPin className="h-3 w-3" />
													Rack{" "}
													<span className="font-mono font-medium text-foreground">
														{item.assignedRackLabel}
													</span>
												</span>
											)}
										</div>

										{/* Putaway controls */}
										{isPending && (
											<AssignItemControls
												item={item}
												damagedRacks={damagedRacks}
												normalRacks={normalRacks}
												onAssigned={onAssigned}
											/>
										)}
									</div>
								);
							})}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

// ─── Main component ──────────────────────────────────────────────────────────

function ReturnsComponent() {
	const queryClient = useQueryClient();

	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("ALL");
	const [reasonFilter, setReasonFilter] = useState<string>("ALL");
	const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);

	// ─── Queries ──────────────────────────────────────────────────
	const queryVars: ReturnsQueryVariables = {
		filter: {
			...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
			...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
			...(reasonFilter !== "ALL" ? { reason: reasonFilter } : {}),
		},
		pageSize,
		pageNumber: page,
	};

	const {
		data,
		isLoading,
		refetch: refetchReturns,
	} = useQuery({
		queryKey: qk.returns.list(queryVars),
		queryFn: () =>
			gqlRequest<ReturnsQueryData, ReturnsQueryVariables>(
				RETURNS_QUERY,
				queryVars,
			),
	});

	const { data: statsData, refetch: refetchStats } = useQuery({
		queryKey: qk.returns.stats,
		queryFn: () => gqlRequest<ReturnsStatsQueryData>(RETURNS_STATS_QUERY),
	});

	// Racks + zones (loaded once) — used to split racks by zone purpose so the
	// keeper only sees valid racks per item reason. The backend enforces this
	// regardless.
	const racksVars: RacksQueryVariables = { pageSize: 500, pageNumber: 1 };
	const { data: racksData } = useQuery({
		queryKey: [...qk.racks.all, "returns-putaway", racksVars] as const,
		queryFn: () =>
			gqlRequest<RacksQueryData, RacksQueryVariables>(RACKS_QUERY, racksVars),
	});

	const zonesVars: ZonesQueryVariables = { pageSize: 200, pageNumber: 1 };
	const { data: zonesData } = useQuery({
		queryKey: [...qk.zones.all, "returns-putaway", zonesVars] as const,
		queryFn: () =>
			gqlRequest<ZonesQueryData, ZonesQueryVariables>(ZONES_QUERY, zonesVars),
	});

	const { damagedRacks, normalRacks } = useMemo(() => {
		const racks = racksData?.racks?.query ?? [];
		const zones = zonesData?.zones?.query ?? [];
		const damagedZoneIds = new Set(
			zones.filter((z) => z.purpose === "DAMAGED").map((z) => z.zoneId),
		);
		return {
			damagedRacks: sortRacksByLocation(
				racks.filter((r) => r.zoneId && damagedZoneIds.has(r.zoneId)),
			),
			normalRacks: sortRacksByLocation(
				racks.filter((r) => !r.zoneId || !damagedZoneIds.has(r.zoneId)),
			),
		};
	}, [racksData, zonesData]);

	const returns = data?.returns?.query ?? [];
	const pagination = data?.returns?.pagination;
	const totalCount = pagination?.totalCount ?? 0;
	const totalPages = Math.max(1, pagination?.totalPages ?? 1);
	const stats = statsData?.returnsStats;

	const selectedReturn =
		returns.find((r) => r.id === selectedReturnId) ?? null;

	const handleAssigned = () => {
		refetchReturns();
		refetchStats();
		// Stock has changed — invalidate stock-related caches
		queryClient.invalidateQueries({ queryKey: qk.returns.all });
		queryClient.invalidateQueries({ queryKey: qk.stockQuants.all });
		queryClient.invalidateQueries({ queryKey: qk.inventory.all });
		queryClient.invalidateQueries({ queryKey: qk.inventoryMovements.all });
	};

	return (
		<div className="container mx-auto space-y-5 p-6">
			{/* ── Page Header ─────────────────────────────────────────── */}
			<AdminPageHeader
				icon={Undo2}
				title="Return Management"
				description="Goods returned by outlets at delivery — review return documents and put away returned stock."
				titleId="returns-title"
				descriptionId="returns-description"
			/>

			{/* ── Summary Cards ────────────────────────────────────────── */}
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{/* Pending putaway */}
				<Card className="dashboard-card relative overflow-hidden border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-white">
					<div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />
					<CardHeader className="px-4 pb-1 pt-4">
						<div className="flex items-center justify-between">
							<CardTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-amber-700/70">
								Pending Putaway
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
							{stats?.pendingItemCount ?? "\u2014"}
						</div>
						<p className="mt-1 text-[0.7rem] font-medium uppercase tracking-wider text-amber-600/80">
							Items awaiting rack
						</p>
					</CardContent>
				</Card>

				{/* Completed */}
				<Card className="dashboard-card relative overflow-hidden border-emerald-200/50 bg-gradient-to-br from-emerald-50/60 to-white">
					<div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300" />
					<CardHeader className="px-4 pb-1 pt-4">
						<div className="flex items-center justify-between">
							<CardTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-emerald-700/70">
								Completed
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
							{stats?.completedCount ?? "\u2014"}
						</div>
						<p className="mt-1 text-[0.7rem] font-medium uppercase tracking-wider text-emerald-600/80">
							Returns fully put away
						</p>
					</CardContent>
				</Card>

				{/* Damaged */}
				<Card className="dashboard-card relative overflow-hidden border-red-200/50 bg-gradient-to-br from-red-50/60 to-white">
					<div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-400 via-red-500 to-red-300" />
					<CardHeader className="px-4 pb-1 pt-4">
						<div className="flex items-center justify-between">
							<CardTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-red-700/70">
								Damaged
							</CardTitle>
							<div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100">
								<PackageX className="h-3.5 w-3.5 text-red-600" />
							</div>
						</div>
					</CardHeader>
					<CardContent className="px-4 pb-4">
						<div
							className="text-3xl font-bold tabular-nums tracking-tight text-red-700"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{stats?.damagedItemCount ?? "\u2014"}
						</div>
						<p className="mt-1 text-[0.7rem] font-medium uppercase tracking-wider text-red-600/80">
							Items written to loss
						</p>
					</CardContent>
				</Card>

				{/* About to expire */}
				<Card className="dashboard-card relative overflow-hidden border-orange-200/50 bg-gradient-to-br from-orange-50/60 to-white">
					<div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-300" />
					<CardHeader className="px-4 pb-1 pt-4">
						<div className="flex items-center justify-between">
							<CardTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-orange-700/70">
								About to Expire
							</CardTitle>
							<div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100">
								<CalendarClock className="h-3.5 w-3.5 text-orange-600" />
							</div>
						</div>
					</CardHeader>
					<CardContent className="px-4 pb-4">
						<div
							className="text-3xl font-bold tabular-nums tracking-tight text-orange-700"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{stats?.aboutToExpireItemCount ?? "\u2014"}
						</div>
						<p className="mt-1 text-[0.7rem] font-medium uppercase tracking-wider text-orange-600/80">
							Items re-entered for FEFO
						</p>
					</CardContent>
				</Card>
			</div>

			{/* ── Returns table ─────────────────────────────────────────── */}
			<Card className="dashboard-card overflow-hidden border-border/60">
				<CardHeader className="px-5 pb-0 pt-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle
								className="text-[0.9375rem] font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Return Documents
							</CardTitle>
							<p className="mt-0.5 text-xs text-muted-foreground">
								<span className="font-mono font-medium tabular-nums text-foreground">
									{totalCount}
								</span>{" "}
								return{totalCount !== 1 ? "s" : ""} captured by drivers
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<Select
								value={statusFilter}
								onValueChange={(v) => {
									setStatusFilter(v);
									setPage(1);
								}}
							>
								<SelectTrigger className="h-9 w-36 border-border/50 bg-muted/30 text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All statuses</SelectItem>
									<SelectItem value="RECEIVED">Received</SelectItem>
									<SelectItem value="COMPLETED">Completed</SelectItem>
								</SelectContent>
							</Select>

							<Select
								value={reasonFilter}
								onValueChange={(v) => {
									setReasonFilter(v);
									setPage(1);
								}}
							>
								<SelectTrigger className="h-9 w-40 border-border/50 bg-muted/30 text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All reasons</SelectItem>
									<SelectItem value="DAMAGED">Damaged</SelectItem>
									<SelectItem value="ABOUT_TO_EXPIRE">
										About to Expire
									</SelectItem>
								</SelectContent>
							</Select>

							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
								<Input
									placeholder="Search return / DO / PO no…"
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="h-9 border-border/50 bg-muted/30 pl-8.5 text-sm transition-colors focus-visible:bg-background sm:w-60"
								/>
							</div>
						</div>
					</div>
				</CardHeader>

				<div className="mx-5 mt-4 h-px bg-border/40" />

				<CardContent className="relative px-5 pb-5 pt-4">
					<GlobalLoadingShadow />
					<div className="shadow-xs overflow-x-auto rounded-xl border border-border/40 bg-white">
						<Table>
							<TableHeader>
								<TableRow className="border-b border-border/50 bg-muted/20 hover:bg-muted/20">
									<TableHead className="pl-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
										Return No
									</TableHead>
									<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
										DO / PO
									</TableHead>
									<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
										Items
									</TableHead>
									<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
										Reasons
									</TableHead>
									<TableHead className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
										Received
									</TableHead>
									<TableHead className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
										Status
									</TableHead>
									<TableHead className="pr-4 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
										Action
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-28 text-center text-sm text-muted-foreground"
										>
											<div className="flex flex-col items-center gap-2">
												<div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
												<span>Loading returns…</span>
											</div>
										</TableCell>
									</TableRow>
								) : returns.length === 0 ? (
									<TableRow>
										<TableCell colSpan={7} className="h-32">
											<div className="flex flex-col items-center justify-center gap-3 text-center">
												<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground/50">
													<Undo2 className="h-6 w-6" />
												</div>
												<div>
													<p className="text-sm font-medium text-foreground/70">
														No returns found
													</p>
													<p className="mt-0.5 text-xs text-muted-foreground">
														Returns captured by drivers at proof-of-delivery
														will appear here.
													</p>
												</div>
											</div>
										</TableCell>
									</TableRow>
								) : (
									returns.map((ret) => {
										const pendingItems = ret.items.filter(
											(i) => i.status === "PENDING",
										).length;
										const hasDamaged = ret.items.some(
											(i) => i.reason === "DAMAGED",
										);
										const hasAte = ret.items.some(
											(i) => i.reason === "ABOUT_TO_EXPIRE",
										);
										return (
											<TableRow
												key={ret.id}
												className="cursor-pointer border-b border-border/30 bg-white transition-colors last:border-0 hover:bg-muted/20"
												onClick={() => setSelectedReturnId(ret.id)}
											>
												<TableCell className="py-3 pl-4">
													<span className="font-mono text-xs font-semibold tracking-wide text-foreground">
														{ret.returnNo}
													</span>
												</TableCell>
												<TableCell className="py-3">
													<p className="text-sm font-medium text-foreground/90">
														{ret.doNo}
													</p>
													<p className="text-xs text-muted-foreground">
														{ret.poNo}
													</p>
												</TableCell>
												<TableCell className="py-3 text-center">
													<span className="font-mono text-sm tabular-nums">
														{ret.items.length}
													</span>
													{pendingItems > 0 && (
														<span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-700 ring-1 ring-amber-200">
															{pendingItems} pending
														</span>
													)}
												</TableCell>
												<TableCell className="py-3">
													<div className="flex flex-wrap gap-1">
														{hasDamaged && <ReasonBadge reason="DAMAGED" />}
														{hasAte && (
															<ReasonBadge reason="ABOUT_TO_EXPIRE" />
														)}
													</div>
												</TableCell>
												<TableCell className="py-3">
													<p className="text-sm text-foreground/80">
														{formatDate(ret.receivedAt)}
													</p>
													{ret.receivedByUser && (
														<p className="text-xs text-muted-foreground">
															{ret.receivedByUser.displayName}
														</p>
													)}
												</TableCell>
												<TableCell className="py-3 text-center">
													<ReturnStatusBadge status={ret.status} />
												</TableCell>
												<TableCell className="py-3 pr-4 text-center">
													<Button
														variant="ghost"
														size="sm"
														className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation();
															setSelectedReturnId(ret.id);
														}}
													>
														<Eye className="h-3.5 w-3.5" />
														{pendingItems > 0 ? "Put away" : "View"}
													</Button>
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
								{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
							</span>
							{"\u2013"}
							<span className="font-mono font-medium text-foreground">
								{Math.min(page * pageSize, totalCount)}
							</span>{" "}
							of{" "}
							<span className="font-mono font-medium text-foreground">
								{totalCount}
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

			{/* ── Detail dialog ─────────────────────────────────────────── */}
			<ReturnDetailDialog
				returnDoc={selectedReturn}
				open={!!selectedReturnId}
				onOpenChange={(open) => {
					if (!open) setSelectedReturnId(null);
				}}
				damagedRacks={damagedRacks}
				normalRacks={normalRacks}
				onAssigned={handleAssigned}
			/>
		</div>
	);
}
