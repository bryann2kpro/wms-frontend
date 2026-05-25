import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, Search, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin-page-header";
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
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { BINS_QUERY, type BinsQueryData } from "@/lib/graphql/bins";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
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
	code: string;
	row: string;
	column: string;
	levels: string[];
	rackIds: string[];
};

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
	const [search, setSearch] = useState("");
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

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

	// racks: if warehouse selected, only those assigned to a zone in that warehouse
	const racks = useMemo(() => {
		if (!effectiveWarehouseId) return allRacks;
		return allRacks.filter(
			(r) => r.zoneId && warehouseZoneIds.has(r.zoneId),
		);
	}, [allRacks, effectiveWarehouseId, warehouseZoneIds]);

	const allRackIds = useMemo(() => racks.map((r) => r.rackId), [racks]);

	const { data: binsData } = useQuery({
		queryKey: [...qk.bins.all, "warehouse-map", effectiveWarehouseId] as const,
		queryFn: () =>
			gqlRequest<BinsQueryData>(BINS_QUERY, {
				filter: { rackIds: allRackIds },
				pageSize: 50000,
				pageNumber: 1,
			}),
		enabled: allRackIds.length > 0,
	});

	const utilizationByCode = useMemo(() => {
		const map = new Map<string, { total: number; occupied: number }>();
		const allBins = binsData?.bins?.query ?? [];
		for (const bin of allBins) {
			const rack = allRacks.find((r) => r.rackId === bin.rackId);
			if (!rack) continue;
			const row = String(rack.rackRow ?? "").trim();
			const col = String(rack.rackColumn ?? "").trim();
			if (!row || !col) continue;
			const code = `${row}-${col}`;
			const entry = map.get(code) ?? { total: 0, occupied: 0 };
			entry.total += 1;
			if ((bin.currentVolume ?? 0) > 0 || (bin.currentWeight ?? 0) > 0) {
				entry.occupied += 1;
			}
			map.set(code, entry);
		}
		return map;
	}, [binsData, allRacks]);

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

	const { cells, rows, columns } = useMemo(() => {
		const map = new Map<string, RackCell>();
		for (const rack of racks) {
			const row = String(rack.rackRow ?? "").trim();
			const column = String(rack.rackColumn ?? "").trim();
			const level = String(rack.rackLevel ?? "").trim();
			if (!row || !column) continue;
			const code = `${row}-${column}`;
			const current = map.get(code);
			if (!current) {
				map.set(code, {
					code,
					row,
					column,
					levels: level ? [level] : [],
					rackIds: [rack.rackId],
				});
				continue;
			}
			if (level && !current.levels.includes(level)) current.levels.push(level);
			if (!current.rackIds.includes(rack.rackId))
				current.rackIds.push(rack.rackId);
		}

		const cells = Array.from(map.values()).sort((a, b) =>
			a.code.localeCompare(b.code, undefined, { numeric: true }),
		);
		const rows = Array.from(new Set(cells.map((c) => c.row))).sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		);
		const columns = Array.from(new Set(cells.map((c) => c.column))).sort(
			(a, b) => a.localeCompare(b, undefined, { numeric: true }),
		);

		for (const cell of cells) {
			cell.levels.sort((a, b) =>
				a.localeCompare(b, undefined, { numeric: true }),
			);
		}

		return { cells, rows, columns };
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

	const totalLevels = useMemo(
		() => filtered.reduce((sum, cell) => sum + cell.levels.length, 0),
		[filtered],
	);

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
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						<MetricCard label="Positions" value={filtered.length} />
						<MetricCard label="Rows" value={rows.length} />
						<MetricCard label="Columns" value={columns.length} />
						<MetricCard label="Total Levels" value={totalLevels} />
					</div>

					<div className="overflow-x-auto rounded-xl border bg-muted/15 p-4">
						{rows.length === 0 || columns.length === 0 ? (
							<div className="py-10 text-center text-sm text-muted-foreground">
								{isLoading
									? "Loading rack layout..."
									: effectiveWarehouseId
										? "No zone-assigned racks for this warehouse. Assign racks to zones in Settings → Racks."
										: "No rack positions found."}
							</div>
						) : (
							<div className="min-w-[740px]">
								<div
									className="grid gap-2 pb-2"
									style={{
										gridTemplateColumns: `90px repeat(${columns.length}, minmax(84px, 1fr))`,
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

								{rows.map((row) => (
									<div
										key={row}
										className="grid gap-2 pb-2"
										style={{
											gridTemplateColumns: `90px repeat(${columns.length}, minmax(84px, 1fr))`,
										}}
									>
										<div className="flex items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
											Row {row}
										</div>
										{columns.map((column) => {
											const code = `${row}-${column}`;
											const cell = cells.find((item) => item.code === code);
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
											const cellPurpose = cell.rackIds
												.map((id) => purposeByRackId.get(id))
												.find(Boolean) as ZonePurpose | undefined;
											const colorStyle = cellPurpose
												? PURPOSE_COLOR[cellPurpose]
												: null;

											return (
												<button
													type="button"
													key={code}
													onClick={() => setSelectedCode(code)}
													className={`warehouse-map-slot rounded-md border px-2 py-2 text-xs transition ${colorStyle ? `${colorStyle.bg} ${colorStyle.border}` : "border bg-card"} ${selected ? "ring-2 ring-[var(--dashboard-accent)] ring-offset-2" : ""} ${hiddenByFilter ? "opacity-25" : "opacity-100"}`}
													aria-label={`Position ${code} with ${cell.levels.length} level${cell.levels.length === 1 ? "" : "s"}`}
												>
													<p className={`font-semibold ${colorStyle ? colorStyle.text : "text-foreground"}`}>
														{code}
													</p>
													<p className="text-[10px] text-muted-foreground leading-tight">
														{cell.levels.length <= 4
															? cell.levels.join(" · ")
															: `${cell.levels.length} lvls`}
													</p>
													{(() => {
														const util = utilizationByCode.get(code);
														if (!util || util.total === 0) return null;
														const pct = Math.round((util.occupied / util.total) * 100);
														return (
															<div className="mt-1 w-full">
																<div className="h-1 w-full rounded-full bg-muted-foreground/20">
																	<div
																		className="h-1 rounded-full bg-[var(--dashboard-accent)]"
																		style={{ width: `${pct}%` }}
																	/>
																</div>
																<p className="text-[10px] text-muted-foreground">
																	{util.occupied}/{util.total}
																</p>
															</div>
														);
													})()}
												</button>
											);
										})}
									</div>
								))}
							</div>
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
					{selectedCell ? (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<DetailCell label="Position" value={selectedCell.code} />
							<DetailCell label="Row" value={selectedCell.row} />
							<DetailCell label="Column" value={selectedCell.column} />
							<DetailCell
								label="Levels"
								value={selectedCell.levels.join(", ") || "-"}
							/>
							{(() => {
								const util = utilizationByCode.get(selectedCell.code);
								if (!util) return null;
								return (
									<>
										<DetailCell
											label="Bins Occupied"
											value={`${util.occupied} / ${util.total}`}
										/>
										<DetailCell
											label="Utilization"
											value={util.total > 0 ? `${Math.round((util.occupied / util.total) * 100)}%` : "—"}
										/>
									</>
								);
							})()}
							<div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-4">
								<p className="text-xs text-muted-foreground">Rack IDs</p>
								<div className="mt-2 flex flex-wrap gap-2">
									{selectedCell.rackIds.map((rackId) => (
										<Badge
											key={rackId}
											variant="outline"
											className="font-mono text-[11px]"
										>
											{rackId}
										</Badge>
									))}
								</div>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							Select any rack position from the map to see details.
						</p>
					)}
				</CardContent>
			</Card>
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
