import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { gqlRequest } from "@/lib/api/gql";
import {
	STOCK_QUANTS_QUERY,
	type StockQuant,
	type StockQuantsQueryData,
} from "@/lib/graphql/stock-quant";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// Layout: A1 (rows 1-24) → AW walkway (rows 1-3) → A2 (rows 1-42) → AW walkway (rows 1-3) → A3 (rows 1-8)
// DOM render order (top→bottom so scroll-to-bottom lands on A1):
//   A3 rows 8→1, AW rows 3→1, A2 rows 42→1, AW rows 3→1, A1 rows 24→1

const AISLES = [
	{ id: "A1" as const, aisleNum: 1, rowCount: 24 },
	{ id: "A2" as const, aisleNum: 2, rowCount: 42 },
	{ id: "A3" as const, aisleNum: 3, rowCount: 8  },
] as const;

export type AisleId = "A1" | "A2" | "A3";
export type AisleFilter = "all" | AisleId;

const WALKWAY_ROW_COUNT = 3;
const NORMAL_LEVELS = 6;
const WALKWAY_LEVELS = 3; // represents L4, L5, L6
const FK_COLUMNS = new Set(["F", "G", "H", "I", "J", "K"]);

// SVG isometric geometry
const SW = 52;
const SH = 14;
const SD = 20;
const TOP_OFF = SD / 2;

// ─── Isometric bin SVG ────────────────────────────────────────────────────────

type ShelfProps = {
	levels: number;
	displayLevels?: number;
	selected: boolean;
	onClick: (rect: DOMRect) => void;
	label: string;
	occupiedLevels?: Set<number>;
};

function ShelfUnit({ levels, displayLevels = levels, selected, onClick, label, occupiedLevels }: ShelfProps) {
	const totalH = displayLevels * SH;
	const filledOffset = (displayLevels - levels) * SH;
	const svgW = SW + SD;
	const svgH = totalH + TOP_OFF;

	const topPts = [`0,${TOP_OFF + filledOffset}`, `${SW},${TOP_OFF + filledOffset}`, `${SW + SD},${filledOffset}`, `${SD},${filledOffset}`].join(" ");

	return (
		<div className="flex flex-col items-center gap-0">
			<svg
				width={svgW}
				height={svgH}
				viewBox={`0 0 ${svgW} ${svgH}`}
				onClick={(e) => onClick((e.currentTarget as SVGSVGElement).getBoundingClientRect())}
				className="cursor-pointer hover:opacity-80 transition-opacity"
				role="button"
				aria-label={label}
			>
				<defs>
					<linearGradient id="glassTop" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="rgba(30,30,30,0.85)" />
						<stop offset="100%" stopColor="rgba(80,80,80,0.6)" />
					</linearGradient>
					<linearGradient id="glassFront" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={selected ? "rgba(245,245,245,0.7)" : "rgba(230,230,230,0.35)"} />
						<stop offset="100%" stopColor={selected ? "rgba(200,200,200,0.85)" : "rgba(180,180,180,0.55)"} />
					</linearGradient>
					<linearGradient id="glassSide" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor={selected ? "rgba(200,200,200,0.75)" : "rgba(170,170,170,0.4)"} />
						<stop offset="100%" stopColor={selected ? "rgba(160,160,160,0.9)" : "rgba(140,140,140,0.6)"} />
					</linearGradient>
				</defs>

				{/* Top face */}
				<polygon points={topPts} fill="url(#glassTop)" stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />

				{/* Front face — alternating level bands */}
				{Array.from({ length: levels }, (_, i) => {
					const levelNum = levels - i; // i=0 is top = highest level number
					const hasStock = occupiedLevels?.has(levelNum) ?? false;
					const dark = i % 2 === 0;
					const fill = hasStock
						? "rgba(239,68,68,0.55)"
						: dark ? "rgba(160,160,160,0.35)" : "rgba(230,230,230,0.18)";
					return (
						<rect
							key={i}
							x={0}
							y={TOP_OFF + filledOffset + i * SH}
							width={SW}
							height={SH}
							fill={fill}
							stroke="rgba(0,0,0,0.12)"
							strokeWidth="0.5"
						/>
					);
				})}
				<rect x={0} y={TOP_OFF + filledOffset} width={SW} height={levels * SH} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />

				{/* Right side face — alternating bands */}
				{Array.from({ length: levels }, (_, i) => {
					const levelNum = levels - i;
					const hasStock = occupiedLevels?.has(levelNum) ?? false;
					const dark = i % 2 === 0;
					const y1f = TOP_OFF + filledOffset + i * SH;
					const y2f = TOP_OFF + filledOffset + (i + 1) * SH;
					const y1b = filledOffset + i * SH;
					const y2b = filledOffset + (i + 1) * SH;
					const pts = [`${SW},${y1f}`, `${SW + SD},${y1b}`, `${SW + SD},${y2b}`, `${SW},${y2f}`].join(" ");
					const fill = hasStock
						? "rgba(185,28,28,0.45)"
						: dark ? "rgba(120,120,120,0.4)" : "rgba(180,180,180,0.22)";
					return (
						<polygon
							key={i}
							points={pts}
							fill={fill}
							stroke="rgba(0,0,0,0.1)"
							strokeWidth="0.5"
						/>
					);
				})}
				{/* Side outline — only over the filled portion */}
				{(() => {
					const y1f = TOP_OFF + filledOffset;
					const y2f = TOP_OFF + filledOffset + levels * SH;
					const y1b = filledOffset;
					const y2b = filledOffset + levels * SH;
					const pts = [`${SW},${y1f}`, `${SW + SD},${y1b}`, `${SW + SD},${y2b}`, `${SW},${y2f}`].join(" ");
					return <polygon points={pts} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />;
				})()}

				{/* Selected ring */}
				{selected && (() => {
					const y1f = TOP_OFF + filledOffset;
					const y2f = TOP_OFF + filledOffset + levels * SH;
					const y1b = filledOffset;
					const y2b = filledOffset + levels * SH;
					const selSidePts = [`${SW},${y1f}`, `${SW + SD},${y1b}`, `${SW + SD},${y2b}`, `${SW},${y2f}`].join(" ");
					return (
						<>
							<polygon points={topPts} fill="none" stroke="rgba(0,0,0,0.9)" strokeWidth="1.8" />
							<rect x={0} y={y1f} width={SW} height={levels * SH} fill="none" stroke="rgba(0,0,0,0.9)" strokeWidth="1.5" />
							<polygon points={selSidePts} fill="none" stroke="rgba(0,0,0,0.9)" strokeWidth="1.5" />
						</>
					);
				})()}
			</svg>
			<span className="text-[9px] font-mono text-slate-400 leading-none mt-0.5">{label}</span>
		</div>
	);
}

// ─── Bin row ──────────────────────────────────────────────────────────────────

function ShelfRow({
	aisleId,
	aisleNum,
	row,
	isWalkway = false,
	selected,
	onSelect,
	occupiedLevelsByKey,
}: {
	aisleId: string;
	aisleNum: number;
	row: number;
	isWalkway?: boolean;
	selected: string | null;
	onSelect: (key: string | null, rect?: DOMRect) => void;
	occupiedLevelsByKey?: Map<string, Set<number>>;
}) {
	return (
		<div className="flex items-end gap-4">
			<div
				className={`w-8 shrink-0 text-right text-[10px] font-semibold leading-none pb-1 pr-1 ${
					isWalkway ? "text-amber-500" : "text-slate-400"
				}`}
			>
				{isWalkway ? "W" : row}
			</div>
			{COLUMNS.map((col) => {
				const levels = isWalkway ? WALKWAY_LEVELS : FK_COLUMNS.has(col) ? 5 : NORMAL_LEVELS;
				const displayLevels = isWalkway ? NORMAL_LEVELS : levels;
				const key = isWalkway
					? `AW${aisleNum}|${col}|${row}`
					: `${aisleId}|${col}|${row}`;
				const isSelected = selected === key;
				return (
					<ShelfUnit
						key={key}
						levels={levels}
						displayLevels={displayLevels}
						selected={isSelected}
						label={isWalkway ? `${col}W-${row}` : `${col}${aisleNum}-${row}`}
						occupiedLevels={occupiedLevelsByKey?.get(key)}
						onClick={(rect) => onSelect(isSelected ? null : key, isSelected ? undefined : rect)}
					/>
				);
			})}
		</div>
	);
}

// ─── Column labels ────────────────────────────────────────────────────────────

function ColumnLabels() {
	return (
		<div className="flex items-center gap-4 pt-2">
			<div className="w-8 shrink-0" />
			{COLUMNS.map((col) => (
				<div
					key={col}
					className="text-center text-[11px] font-bold text-slate-500"
					style={{ width: SW + SD, minWidth: SW + SD }}
				>
					{col}
				</div>
			))}
		</div>
	);
}

// ─── Detail card ─────────────────────────────────────────────────────────────

type BinRack = {
	rackId: string;
	rackColumn: string;
	rackRow: string;
	rackLevel: string;
	binCode?: string | null;
};
type LevelEntry = {
	levelCode: string;
	binCode: string;
};

function ShelfDetailCard({
	shelfKey,
	levelEntries,
	stockByBinCode,
	onClose,
}: {
	shelfKey: string;
	levelEntries: LevelEntry[];
	stockByBinCode: Map<string, StockQuant[]>;
	onClose: () => void;
}) {
	const isWalkway = shelfKey.startsWith("AW");
	const [aisleStr, col] = shelfKey.split("|");
	const aisleNum = isWalkway ? parseInt(aisleStr.slice(2)) : parseInt(aisleStr.slice(1));
	const rowPadded = shelfKey.split("|")[2]?.padStart(2, "0") ?? "01";
	const title = isWalkway ? `Walkway ${col}${aisleNum}` : `Bin ${col}${aisleNum}-${rowPadded}`;

	return (
		<div
			className="border rounded-xl bg-white shadow-lg p-4 w-80 shrink-0 flex flex-col"
			style={{ maxHeight: "70vh" }}
		>
			<div className="flex items-center justify-between mb-3 shrink-0">
				<p className="font-semibold text-sm" style={{ fontFamily: "var(--dashboard-display)" }}>
					{title}
				</p>
				<button
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			<div className="overflow-auto flex-1 space-y-2">
				{levelEntries.map(({ binCode }) => {
					const quants = stockByBinCode.get(binCode) ?? [];
					const hasStock = quants.length > 0;
					return (
						<div
							key={binCode}
							className={`rounded-lg border px-3 py-2 ${hasStock ? "border-red-300 bg-red-50" : ""}`}
						>
							<p className={`text-[10px] font-bold font-mono mb-1.5 tracking-wide ${hasStock ? "text-red-600" : "text-slate-500"}`}>
								{binCode}
							</p>
							{!hasStock ? (
								<p className="text-[10px] text-muted-foreground pl-1">—</p>
							) : (
								<div className="space-y-1">
									{quants.map((q) => (
										<div
											key={q.id}
											className="grid grid-cols-[auto_1fr_auto] gap-x-2 text-[10px] items-baseline pl-1"
										>
											<span className="font-mono font-medium text-slate-700">{q.skuCode}</span>
											<span className="text-muted-foreground truncate">{q.description}</span>
											<span className="font-semibold text-foreground shrink-0 tabular-nums">
												{q.quantity} {q.stockUnitCode ?? "CTN"}
											</span>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ─── Main 3D map component ────────────────────────────────────────────────────

type WarehouseMap3DProps = {
	sectionFilter: AisleFilter;
	racks: BinRack[];
};

export function WarehouseMap3D({ sectionFilter }: WarehouseMap3DProps) {
	const [selected, setSelected] = useState<string | null>(null);
	const [cardPos, setCardPos] = useState<{ x: number; anchorY: number; anchorBottom: boolean } | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Fetch all stock quants (server scopes by org) to colour occupied levels on the map
	const { data: allStockData } = useQuery({
		queryKey: ["warehouse-map-stock-summary"],
		queryFn: () =>
			gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, {
				pageSize: 10000,
				pageNumber: 1,
			}),
	});

	const occupiedLevelsByKey = useMemo(() => {
		const map = new Map<string, Set<number>>();
		for (const q of allStockData?.stockQuants?.query ?? []) {
			if (!q.rackLabel || !(parseFloat(q.quantity ?? "0") > 0)) continue;
			let key: string | null = null;
			let levelNum: number | null = null;
			// Walkway format: XW-Ln-rr  (e.g. KW-L5-01)
			const mw = q.rackLabel.match(/^([A-N])W-L(\d+)-(\d+)$/);
			if (mw) {
				const col = mw[1];
				levelNum = parseInt(mw[2]);
				const row = parseInt(mw[3]);
				// Determine which walkway aisle (AW1 rows 1-3, AW2 rows 4-6)
				const aisleNum = row <= WALKWAY_ROW_COUNT ? 1 : 2;
				key = `AW${aisleNum}|${col}|${row}`;
			} else {
				// Normal format: XN-Ln-rr  (e.g. K1-L3-05)
				const m = q.rackLabel.match(/^([A-N])(\d+)-L(\d+)-(\d+)$/);
				if (m) {
					key = `A${m[2]}|${m[1]}|${parseInt(m[4])}`;
					levelNum = parseInt(m[3]);
				}
			}
			if (key && levelNum !== null) {
				if (!map.has(key)) map.set(key, new Set());
				map.get(key)!.add(levelNum);
			}
		}
		return map;
	}, [allStockData]);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [sectionFilter]);

	function handleSelect(key: string | null, rect?: DOMRect) {
		setSelected(key);
		if (rect) {
			const CARD_W = 320;
			const x = rect.right + 12 + CARD_W > window.innerWidth
				? rect.left - 12 - CARD_W
				: rect.right + 12;
			const anchorBottom = rect.top > window.innerHeight * 0.55;
			setCardPos({ x, anchorY: anchorBottom ? window.innerHeight - rect.top : rect.top, anchorBottom });
		} else {
			setCardPos(null);
		}
	}

	// Build binCode → StockQuant[] directly from rackLabel on each stock quant record
	const stockByBinCode = useMemo(() => {
		const map = new Map<string, StockQuant[]>();
		for (const q of allStockData?.stockQuants?.query ?? []) {
			if (!q.rackLabel) continue;
			if (!map.has(q.rackLabel)) map.set(q.rackLabel, []);
			map.get(q.rackLabel)!.push(q);
		}
		return map;
	}, [allStockData]);

	// Synthetic level entries — always generated, not dependent on master data
	const selectedLevelEntries = useMemo<LevelEntry[]>(() => {
		if (!selected) return [];
		const isWalkwayKey = selected.startsWith("AW");
		const [aisleStr, col, rowStr] = selected.split("|");
		const aisleNum = isWalkwayKey
			? parseInt(aisleStr.slice(2))
			: AISLES.find((a) => a.id === aisleStr)?.aisleNum ?? 1;
		const row = parseInt(rowStr);
		const rowPadded = String(row).padStart(2, "0");
		const prefix = isWalkwayKey ? `${col}W` : `${col}${aisleNum}`;
		const minLevel = isWalkwayKey ? 4 : FK_COLUMNS.has(col) ? 2 : 1;

		return Array.from({ length: NORMAL_LEVELS - minLevel + 1 }, (_, i) => {
			const level = NORMAL_LEVELS - i;
			const binCode = `${prefix}-L${level}-${rowPadded}`;
			return { levelCode: `L${level}`, binCode };
		});
	}, [selected]);

	// Explicit DOM segment order (top → bottom = physical top → bottom):
	//   A3 rows 8→1 | AW(aisleNum=2) | A2 rows 42→1 | AW(aisleNum=1) | A1 rows 24→1
	type Segment =
		| { kind: "aisle"; aisle: (typeof AISLES)[number] }
		| { kind: "walkway"; aisleNum: number };

	const ALL_SEGMENTS: Segment[] = [
		{ kind: "aisle",   aisle: AISLES[2] },   // A3
		{ kind: "walkway", aisleNum: 2 },          // between A2 and A3
		{ kind: "aisle",   aisle: AISLES[1] },   // A2
		{ kind: "walkway", aisleNum: 1 },          // between A1 and A2
		{ kind: "aisle",   aisle: AISLES[0] },   // A1
	];

	const segments: Segment[] =
		sectionFilter === "all"
			? ALL_SEGMENTS
			: ALL_SEGMENTS.filter(
					(s) => s.kind === "aisle" && s.aisle.id === sectionFilter,
			  );

	return (
		<div className="flex flex-col h-full min-h-0">
			<div
				ref={scrollRef}
				className="overflow-auto rounded-xl border bg-white flex-1 min-h-0"
				onScroll={() => { setSelected(null); setCardPos(null); }}
			>
				<div className="inline-block p-6">
					<div className="mb-5">
						<ColumnLabels />
					</div>

					{segments.map((seg) => {
						if (seg.kind === "walkway") {
							const rowOffset = (seg.aisleNum - 1) * WALKWAY_ROW_COUNT;
							return (
								<div key={`aw${seg.aisleNum}`}>
									{Array.from({ length: WALKWAY_ROW_COUNT }, (_, i) => {
										const wRow = WALKWAY_ROW_COUNT - i + rowOffset;
										return (
											<div key={wRow} className="mb-3">
												<ShelfRow
													aisleId={`AW${seg.aisleNum}`}
													aisleNum={seg.aisleNum}
													row={wRow}
													isWalkway
													selected={selected}
													onSelect={handleSelect}
													occupiedLevelsByKey={occupiedLevelsByKey}
												/>
											</div>
										);
									})}
								</div>
							);
						}

						const { aisle } = seg;
						return (
							<div key={aisle.id}>
								{Array.from({ length: aisle.rowCount }, (_, i) => {
									const row = aisle.rowCount - i;
									return (
										<div key={row} className="mb-3">
											<ShelfRow
												aisleId={aisle.id}
												aisleNum={aisle.aisleNum}
												row={row}
												selected={selected}
												onSelect={handleSelect}
												occupiedLevelsByKey={occupiedLevelsByKey}
											/>
										</div>
									);
								})}
							</div>
						);
					})}

					<ColumnLabels />
				</div>
			</div>

			{/* Floating detail card */}
			{selected && cardPos && (
				<div style={{ position: "fixed", left: cardPos.x, ...(cardPos.anchorBottom ? { bottom: cardPos.anchorY } : { top: cardPos.anchorY }), zIndex: 50 }}>
					<ShelfDetailCard
						shelfKey={selected}
						levelEntries={selectedLevelEntries}
						stockByBinCode={stockByBinCode}
						onClose={() => {
							setSelected(null);
							setCardPos(null);
						}}
					/>
				</div>
			)}
		</div>
	);
}
