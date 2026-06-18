import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, Search, Building2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { RackFormDialog } from "@/components/racks/rack-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { AREAS_QUERY, type AreasQueryData } from "@/lib/graphql/areas";
import {
	RACKS_QUERY,
	RACK_UTILIZATION_QUERY,
	CREATE_RACK_MUTATION,
	type RacksQueryData,
	type RackUtilizationQueryData,
	type CreateRackMutationData,
} from "@/lib/graphql/racks";
import {
	WAREHOUSES_QUERY,
	type WarehousesQueryData,
} from "@/lib/graphql/warehouses";
import { ZONES_QUERY, type ZonesQueryData } from "@/lib/graphql/zones";
import { requirePermission } from "@/lib/rbac";
import type { ZonePurpose } from "@/lib/graphql/types";

const PURPOSE_COLOR: Record<ZonePurpose, { bg: string; border: string; text: string }> = {
	GENERAL: { bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-700" },
	WET: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-700" },
	DRY: { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700" },
	AMBIENT: { bg: "bg-green-100", border: "border-green-300", text: "text-green-700" },
	DAMAGED: { bg: "bg-red-100", border: "border-red-300", text: "text-red-700" },
};

type RackCell = {
	code: string; // {row}-{level}-{column}
	row: string;
	level: string;
	column: string;
	rackId: string;
	// rowLevelKey = `${row}-${level}` — identifies grid Y-axis row
	rowLevelKey: string;
};

type RackCapacity = {
	volCapacity: number;
	volCurrent: number;
	weightCapacity: number;
	weightCurrent: number;
	cartonCount: number;
};

function rackHasOccupancy(cap: RackCapacity | undefined): boolean {
	if (!cap) return false;
	return cap.cartonCount > 0 || cap.volCurrent > 0 || cap.weightCurrent > 0;
}

function pct(current: number, capacity: number): number {
	if (!capacity || capacity <= 0) return 0;
	return Math.round((current / capacity) * 100);
}

function utilBarColor(pct: number): string {
	if (pct >= 85) return "bg-red-500";
	if (pct >= 60) return "bg-amber-500";
	return "bg-emerald-500";
}

function fmtNum(n: number): string {
	if (!Number.isFinite(n)) return "0";
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const Route = createFileRoute("/admin/warehouse-map")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Warehouse Map"]);
	},
	component: WarehouseMapComponent,
	head: () => ({
		meta: [
			{
				title: "2D Warehouse Map - SME Edaran WMS",
				description:
					"Visualize rack rows and columns using the configured warehouse rack layout.",
			},
		],
	}),
});

function WarehouseMapComponent() {
	const queryClient = useQueryClient();
	const { user } = useCurrentUser();
	const createdBy = user?.id ?? "";
	const [search, setSearch] = useState("");
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
	const [isCreateRackOpen, setIsCreateRackOpen] = useState(false);

	const { data: warehousesData } = useQuery({
		queryKey: [...qk.warehouses.all, "warehouse-map"] as const,
		queryFn: () =>
			gqlRequest<WarehousesQueryData>(WAREHOUSES_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
	});

	const { data: racksData, isLoading } = useQuery({
		queryKey: [...qk.racks.all, "warehouse-map"] as const,
		queryFn: () =>
			gqlRequest<RacksQueryData>(RACKS_QUERY, {
				pageSize: 5000,
				pageNumber: 1,
			}),
	});

	const { data: zonesData } = useQuery({
		queryKey: [...qk.zones.all, "warehouse-map"] as const,
		queryFn: () =>
			gqlRequest<ZonesQueryData>(ZONES_QUERY, {
				pageSize: 2000,
				pageNumber: 1,
			}),
	});

	const allRacks = racksData?.racks?.query ?? [];
	const warehouses = warehousesData?.warehouses?.query ?? [];
	const allZones = zonesData?.zones?.query ?? [];

	// auto-select first warehouse once loaded
	const effectiveWarehouseId =
		selectedWarehouseId || warehouses[0]?.warehouseId || "";
	const selectedWarehouse =
		warehouses.find((w) => w.warehouseId === effectiveWarehouseId) ?? null;

	const { data: areasData } = useQuery({
		queryKey: [
			...qk.areas.all,
			"warehouse-map-racks",
			selectedWarehouse?.warehouseName,
		] as const,
		queryFn: () =>
			gqlRequest<AreasQueryData>(AREAS_QUERY, {
				filter: { warehouseName: selectedWarehouse?.warehouseName },
				pageSize: 500,
				pageNumber: 1,
			}),
		enabled: isCreateRackOpen && !!selectedWarehouse,
	});
	const rackAreas = areasData?.areas?.query ?? [];

	const { mutate: createRack, isPending: createRackLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateRackMutationData>(CREATE_RACK_MUTATION, { input }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: qk.racks.all });
			setIsCreateRackOpen(false);
		},
	});

	const zones = useMemo(
		() =>
			effectiveWarehouseId
				? allZones.filter((z) => z.warehouseId === effectiveWarehouseId)
				: allZones,
		[allZones, effectiveWarehouseId],
	);

	// rackIds that belong to zones in the selected warehouse
	const warehouseZoneIds = useMemo(
		() => new Set(zones.map((z) => z.zoneId)),
		[zones],
	);

	// racks: zone-assigned in this warehouse, or directly linked via warehouseId
	const racks = useMemo(() => {
		if (!effectiveWarehouseId) return allRacks;
		return allRacks.filter(
			(r) =>
				r.warehouseId === effectiveWarehouseId ||
				(r.zoneId != null && warehouseZoneIds.has(r.zoneId)),
		);
	}, [allRacks, effectiveWarehouseId, warehouseZoneIds]);

	const { data: utilizationData } = useQuery({
		queryKey: [...qk.racks.all, "warehouse-map-utilization"] as const,
		queryFn: () => gqlRequest<RackUtilizationQueryData>(RACK_UTILIZATION_QUERY),
	});

	const capacityByRackId = useMemo(() => {
		const map = new Map<string, RackCapacity>();
		const rows = utilizationData?.rackUtilization ?? [];
		for (const row of rows) {
			map.set(row.rackId, {
				volCapacity: row.volCapacity ?? 0,
				volCurrent: row.volCurrent ?? 0,
				weightCapacity: row.weightCapacity ?? 0,
				weightCurrent: row.weightCurrent ?? 0,
				cartonCount: row.cartonCount ?? 0,
			});
		}
		return map;
	}, [utilizationData]);

	const zonePurposeByZoneId = useMemo(() => {
		const map = new Map<string, ZonePurpose>();
		for (const z of zones) map.set(z.zoneId, z.purpose);
		return map;
	}, [zones]);

	const purposeByRackId = useMemo(() => {
		const map = new Map<string, ZonePurpose>();
		for (const rack of racks) {
			if (rack.zoneId) {
				const purpose = zonePurposeByZoneId.get(rack.zoneId);
				if (purpose) map.set(rack.rackId, purpose);
			}
		}
		return map;
	}, [racks, zonePurposeByZoneId]);

	const { cells, rowLevelKeys, columns, distinctRows, distinctLevels } = useMemo(() => {
		const cellList: RackCell[] = [];
		for (const rack of racks) {
			const row = String(rack.rackRow ?? "").trim();
			const column = String(rack.rackColumn ?? "").trim();
			const level = String(rack.rackLevel ?? "").trim();
			if (!row || !column || !level) continue;
			cellList.push({
				code: `${row}-${level}-${column}`,
				row,
				level,
				column,
				rackId: rack.rackId,
				rowLevelKey: `${row}-${level}`,
			});
		}

		const cells = cellList.sort((a, b) =>
			a.code.localeCompare(b.code, undefined, { numeric: true }),
		);
		const distinctRows = Array.from(new Set(cells.map((c) => c.row))).sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		);
		const distinctLevels = Array.from(new Set(cells.map((c) => c.level))).sort(
			(a, b) => a.localeCompare(b, undefined, { numeric: true }),
		);
		const columns = Array.from(new Set(cells.map((c) => c.column))).sort(
			(a, b) => a.localeCompare(b, undefined, { numeric: true }),
		);

		// Y-axis: row groups, with highest level on top within each row group
		const rowLevelKeys = Array.from(new Set(cells.map((c) => c.rowLevelKey))).sort(
			(a, b) => {
				const [aRow, aLevel] = a.split("-");
				const [bRow, bLevel] = b.split("-");
				const rowCmp = aRow.localeCompare(bRow, undefined, { numeric: true });
				if (rowCmp !== 0) return rowCmp;
				// higher level first (descending) within same row
				return bLevel.localeCompare(aLevel, undefined, { numeric: true });
			},
		);

		return { cells, rowLevelKeys, columns, distinctRows, distinctLevels };
	}, [racks]);

	const filtered = useMemo(() => {
		const q = search.trim().toUpperCase();
		if (!q) return cells;
		return cells.filter((cell) => cell.code.toUpperCase().includes(q));
	}, [cells, search]);

	const visibleCodes = useMemo(
		() => new Set(filtered.map((c) => c.code)),
		[filtered],
	);
	const selectedCell = cells.find((cell) => cell.code === selectedCode) ?? null;

	const totalLevels = distinctLevels.length;

	// Lookup: code → cell (fast cell access during grid render)
	const cellByCode = useMemo(() => {
		const map = new Map<string, RackCell>();
		for (const cell of cells) map.set(cell.code, cell);
		return map;
	}, [cells]);

	return (
		<main
			className="warehouse-map-page container mx-auto p-6 space-y-6"
			aria-labelledby="warehouse-map-page-title"
			aria-describedby="warehouse-map-page-description"
			aria-busy={isLoading}
		>
			<AdminPageHeader
				icon={LayoutGrid}
				title="2D Warehouse Map"
				description="Live rack layout by row and column, based on configured rack master data."
				titleId="warehouse-map-page-title"
				descriptionId="warehouse-map-page-description"
			/>

			<Card className="dashboard-card" style={{ animationDelay: "0ms" }}>
				<CardHeader>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Rack Layout
							</CardTitle>
							<CardDescription>
								Zone-coloured rack grid. Select a warehouse to view its layout.
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<Select
								value={effectiveWarehouseId}
								onValueChange={(v) => {
									setSelectedWarehouseId(v);
									setSelectedCode(null);
									setSearch("");
								}}
							>
								<SelectTrigger className="w-full sm:w-52">
									<Building2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
									<SelectValue placeholder="Select warehouse" />
								</SelectTrigger>
								<SelectContent>
									{warehouses.map((w) => (
										<SelectItem key={w.warehouseId} value={w.warehouseId}>
											{w.warehouseName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div className="relative w-full sm:w-56">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search position (A-01)"
									className="pl-9"
								/>
							</div>
							{selectedWarehouse && (
								<Button
									onClick={() => setIsCreateRackOpen(true)}
									disabled={!createdBy}
									className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Rack
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						<MetricCard label="Positions" value={filtered.length} />
						<MetricCard label="Rows" value={distinctRows.length} />
						<MetricCard label="Columns" value={columns.length} />
						<MetricCard label="Total Levels" value={totalLevels} />
					</div>

					<div className="overflow-x-auto rounded-xl border bg-muted/15 p-4">
						{rowLevelKeys.length === 0 || columns.length === 0 ? (
							<div className="py-10 text-center text-sm text-muted-foreground">
								{isLoading
									? "Loading rack layout..."
									: effectiveWarehouseId
										? "No rack positions for this warehouse yet. Use Add Rack to create one."
										: "No rack positions found."}
							</div>
						) : (
							<TooltipProvider delayDuration={150}>
							<div className="min-w-[740px]">
								<div
									className="grid gap-2 pb-2"
									style={{
										gridTemplateColumns: `90px repeat(${columns.length}, minmax(180px, 1fr))`,
									}}
								>
									<div />
									{columns.map((column) => (
										<div
											key={column}
											className="text-center text-xs font-semibold text-muted-foreground"
										>
											Col {column}
										</div>
									))}
								</div>

								{rowLevelKeys.map((rowLevelKey) => {
									const [rowLabel, levelLabel] = rowLevelKey.split("-");
									return (
										<div
											key={rowLevelKey}
											className="grid gap-2 pb-2"
											style={{
												gridTemplateColumns: `90px repeat(${columns.length}, minmax(180px, 1fr))`,
											}}
										>
											<div className="flex items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
												{rowLabel}·{levelLabel}
											</div>
											{columns.map((column) => {
												const code = `${rowLabel}-${levelLabel}-${column}`;
												const cell = cellByCode.get(code);
												if (!cell) {
													return (
														<div
															key={code}
															className="rounded-md border border-dashed border-border/60 bg-background/60"
														/>
													);
												}
												const hiddenByFilter =
													search.trim() && !visibleCodes.has(code);
												const selected = selectedCode === code;
												const cellPurpose = purposeByRackId.get(cell.rackId);
												const colorStyle = cellPurpose
													? PURPOSE_COLOR[cellPurpose]
													: null;
												const cap = capacityByRackId.get(cell.rackId);
												const occupied = rackHasOccupancy(cap);
												const volPct = cap ? pct(cap.volCurrent, cap.volCapacity) : 0;
												const wtPct = cap ? pct(cap.weightCurrent, cap.weightCapacity) : 0;
												const hasVol = !!(cap && cap.volCapacity > 0);
												const hasWt = !!(cap && cap.weightCapacity > 0);

												return (
													<Tooltip key={code}>
														<TooltipTrigger asChild>
															<button
																type="button"
																onClick={() => setSelectedCode(code)}
																className={`warehouse-map-slot rounded-md border px-2 py-2 text-xs transition text-left ${colorStyle ? `${colorStyle.bg} ${colorStyle.border}` : "border bg-card"} ${selected ? "ring-2 ring-[var(--dashboard-accent)] ring-offset-2" : ""} ${hiddenByFilter ? "opacity-25" : "opacity-100"}`}
																aria-label={`Position ${code}`}
															>
																<p className={`font-semibold ${colorStyle ? colorStyle.text : "text-foreground"}`}>
																	{code}
																</p>
																{occupied && cap!.cartonCount > 0 && (
																	<p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
																		{fmtNum(cap!.cartonCount)} ctns
																	</p>
																)}
																<div className="mt-1 space-y-1">
																	<div className="flex items-center gap-1">
																		<span className="text-[9px] font-semibold text-muted-foreground w-3">V</span>
																		<div className="flex-1 h-1.5 rounded-sm bg-muted-foreground/15 overflow-hidden">
																			{hasVol ? (
																				<div
																					className={`h-full rounded-sm transition-[width] ${utilBarColor(volPct)}`}
																					style={{ width: `${volPct}%` }}
																				/>
																			) : occupied && cap!.volCurrent > 0 ? (
																				<div className="h-full w-full rounded-sm bg-emerald-500/70" />
																			) : null}
																		</div>
																		<span className="text-[9px] text-muted-foreground tabular-nums w-9 text-right">
																			{hasVol ? `${volPct}%` : occupied && cap!.volCurrent > 0 ? fmtNum(cap!.volCurrent) : "—"}
																		</span>
																	</div>
																	<div className="flex items-center gap-1">
																		<span className="text-[9px] font-semibold text-muted-foreground w-3">W</span>
																		<div className="flex-1 h-1.5 rounded-sm bg-muted-foreground/15 overflow-hidden">
																			{hasWt ? (
																				<div
																					className={`h-full rounded-sm transition-[width] ${utilBarColor(wtPct)}`}
																					style={{ width: `${wtPct}%` }}
																				/>
																			) : occupied && cap!.weightCurrent > 0 ? (
																				<div className="h-full w-full rounded-sm bg-emerald-500/70" />
																			) : null}
																		</div>
																		<span className="text-[9px] text-muted-foreground tabular-nums w-9 text-right">
																			{hasWt ? `${wtPct}%` : occupied && cap!.weightCurrent > 0 ? fmtNum(cap!.weightCurrent) : "—"}
																		</span>
																	</div>
																</div>
															</button>
														</TooltipTrigger>
														<TooltipContent side="top" className="max-w-none">
															<div className="space-y-1">
																<p className="font-semibold">Position {code}</p>
																{cap ? (
																	<>
																		<p className="text-[11px] tabular-nums">
																			Cartons {fmtNum(cap.cartonCount)}
																		</p>
																		<p className="text-[11px] tabular-nums">
																			Vol {fmtNum(cap.volCurrent)}
																			{hasVol
																				? `/${fmtNum(cap.volCapacity)} m³ (${volPct}%)`
																				: cap.volCurrent > 0
																					? " m³ (rack capacity not set)"
																					: ""}
																		</p>
																		<p className="text-[11px] tabular-nums">
																			Wt {fmtNum(cap.weightCurrent)}
																			{hasWt
																				? `/${fmtNum(cap.weightCapacity)} kg (${wtPct}%)`
																				: cap.weightCurrent > 0
																					? " kg (rack capacity not set)"
																					: ""}
																		</p>
																	</>
																) : (
																	<p className="text-[11px] opacity-80">No utilization data</p>
																)}
															</div>
														</TooltipContent>
													</Tooltip>
												);
											})}
										</div>
									);
								})}
							</div>
							</TooltipProvider>
						)}
					</div>

					{zones.length > 0 && (
						<div className="mt-4 flex flex-wrap items-center gap-3">
							<span className="text-xs font-medium text-muted-foreground">Zone legend:</span>
							{(Object.entries(PURPOSE_COLOR) as [ZonePurpose, typeof PURPOSE_COLOR[ZonePurpose]][]).map(
								([purpose, style]) => (
									<span
										key={purpose}
										className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.border} ${style.text}`}
									>
										{purpose}
									</span>
								),
							)}
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="dashboard-card" style={{ animationDelay: "80ms" }}>
				<CardHeader>
					<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Position Details
					</CardTitle>
					<CardDescription>
						Inspect configured levels and underlying rack IDs.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{selectedCell ? (() => {
						const cap = capacityByRackId.get(selectedCell.rackId);
						const occupied = rackHasOccupancy(cap);
						const volPct = cap ? pct(cap.volCurrent, cap.volCapacity) : 0;
						const wtPct = cap ? pct(cap.weightCurrent, cap.weightCapacity) : 0;
						const hasVol = !!(cap && cap.volCapacity > 0);
						const hasWt = !!(cap && cap.weightCapacity > 0);
						return (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<DetailCell label="Position" value={selectedCell.code} />
							<DetailCell label="Row" value={selectedCell.row} />
							<DetailCell label="Level" value={selectedCell.level} />
							<DetailCell label="Column" value={selectedCell.column} />
							<DetailCell
								label="Cartons On Hand"
								value={occupied ? fmtNum(cap!.cartonCount) : "—"}
							/>
							<DetailCell
								label="Volume Used"
								value={
									occupied && cap!.volCurrent > 0
										? hasVol
											? `${fmtNum(cap!.volCurrent)} / ${fmtNum(cap!.volCapacity)} m³`
											: `${fmtNum(cap!.volCurrent)} m³ (rack capacity not set)`
										: "—"
								}
							/>
							<DetailCell
								label="Weight Used"
								value={
									occupied && cap!.weightCurrent > 0
										? hasWt
											? `${fmtNum(cap!.weightCurrent)} / ${fmtNum(cap!.weightCapacity)} kg`
											: `${fmtNum(cap!.weightCurrent)} kg (rack capacity not set)`
										: "—"
								}
							/>
							<DetailCell
								label="Utilization"
								value={hasVol || hasWt ? `V ${volPct}% · W ${wtPct}%` : occupied ? "Occupied (no rack capacity)" : "—"}
							/>
							<div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-4">
								<p className="text-xs text-muted-foreground mb-2">Capacity bars</p>
								<div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 text-xs items-center">
									<div className="font-semibold text-muted-foreground">Volume</div>
									<div className="h-2 rounded-sm bg-muted-foreground/15 overflow-hidden">
										{hasVol && (
											<div
												className={`h-full rounded-sm ${utilBarColor(volPct)}`}
												style={{ width: `${volPct}%` }}
											/>
										)}
									</div>
									<div className="text-right tabular-nums w-12">{hasVol ? `${volPct}%` : "—"}</div>
									<div className="font-semibold text-muted-foreground">Weight</div>
									<div className="h-2 rounded-sm bg-muted-foreground/15 overflow-hidden">
										{hasWt && (
											<div
												className={`h-full rounded-sm ${utilBarColor(wtPct)}`}
												style={{ width: `${wtPct}%` }}
											/>
										)}
									</div>
									<div className="text-right tabular-nums w-12">{hasWt ? `${wtPct}%` : "—"}</div>
								</div>
							</div>
							<div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-4">
								<p className="text-xs text-muted-foreground">Rack ID</p>
								<div className="mt-2">
									<Badge variant="outline" className="font-mono text-[11px]">
										{selectedCell.rackId}
									</Badge>
								</div>
							</div>
						</div>
						);
					})() : (
						<p className="text-sm text-muted-foreground">
							Select any rack position from the map to see details.
						</p>
					)}
				</CardContent>
			</Card>

			{selectedWarehouse && (
				<RackFormDialog
					key={selectedWarehouse.warehouseId}
					open={isCreateRackOpen}
					onOpenChange={setIsCreateRackOpen}
					areas={rackAreas}
					warehouses={[selectedWarehouse]}
					defaultWarehouseId={selectedWarehouse.warehouseId}
					onSubmit={(values) =>
						createRack({
							...values,
							createdBy,
							updatedBy: createdBy,
						})
					}
					loading={createRackLoading}
					title={`Add Rack — ${selectedWarehouse.warehouseName}`}
					description="Create a storage bin location for this warehouse. Optionally link it to an area."
				/>
			)}
		</main>
	);
}

function MetricCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border bg-card px-3 py-2.5">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p
				className="mt-1 text-lg font-bold"
				style={{ fontFamily: "var(--dashboard-display)" }}
			>
				{value}
			</p>
		</div>
	);
}

function DetailCell({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="pt-1 text-sm font-semibold text-foreground">{value}</p>
		</div>
	);
}
