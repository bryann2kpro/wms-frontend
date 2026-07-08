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
	{ id: "A1" as const, aisleNum: 1, rowCount: 38 },
	{ id: "A2" as const, aisleNum: 2, rowCount: 42 },
	{ id: "A3" as const, aisleNum: 3, rowCount: 8  },
] as const;

// A1: A and N run all 38 rows; B-M are blank (staging area) at rows 1-13,
// and B-M use their own row numbering offset by 13 (physical row 14 = B-M row 1).
const A1_STAGING_ROW_COUNT = 14;     // rows 1-14: staging area (B-M blank)
const A1_BM_MAX_ROW = 24;            // B-M go up to row 24 in their own numbering
const A1_BM_ROW_OFFSET = A1_STAGING_ROW_COUNT; // physical row - offset = B-M row
const A1_EXTENDED_COLS = new Set(["A", "N"]);

export type AisleId = "A1" | "A2" | "A3";
export type AisleFilter = "all" | AisleId;

const WALKWAY_ROW_COUNT = 3;
const NORMAL_LEVELS = 6;
const WALKWAY_LEVELS = 3; // represents L4, L5, L6

// SVG isometric geometry
const SW = 52;
const SH = 14;
const SD = 20;
const TOP_OFF = SD / 2;

// ─── Isometric bin SVG ────────────────────────────────────────────────────────

type LevelStatus = "normal" | "soon" | "expired";
const SIX_MONTHS_MS = 6 * 30.5 * 24 * 60 * 60 * 1000;
function getLevelStatus(expiryDate: string | null): LevelStatus {
	if (!expiryDate) return "normal";
	const diff = new Date(expiryDate).getTime() - Date.now();
	if (diff < 0) return "expired";
	if (diff <= SIX_MONTHS_MS) return "soon";
	return "normal";
}
const STATUS_PRIORITY: Record<LevelStatus, number> = { expired: 2, soon: 1, normal: 0 };

type ShelfProps = {
	levels: number;
	displayLevels?: number;
	selected: boolean;
	onClick: (rect: DOMRect) => void;
	label: string;
	occupiedLevels?: Map<number, LevelStatus>;
};

function ShelfUnit({ levels, displayLevels = levels, selected, onClick, label, occupiedLevels }: ShelfProps) {
	const totalH = displayLevels * SH;
	const filledOffset = (displayLevels - levels) * SH;
	const svgW = SW + SD;
	const svgH = totalH + TOP_OFF;

	const topPts = [`0,${TOP_OFF + filledOffset}`, `${SW},${TOP_OFF + filledOffset}`, `${SW + SD},${filledOffset}`, `${SD},${filledOffset}`].join(" ");

	return (
		<div className={`flex flex-col items-center gap-0 rounded transition-all ${selected ? "drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] scale-105" : ""}`}>
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
					const levelNum = displayLevels - i; // top band is always L6, bottom band is L(6-levels+1)
					const status = occupiedLevels?.get(levelNum);
					const dark = i % 2 === 0;
					const fill = status === "expired"
						? "rgba(20,20,20,0.75)"
						: status === "soon"
							? "rgba(239,68,68,0.6)"
							: status === "normal"
								? "rgba(249,115,22,0.55)"
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
					const levelNum = displayLevels - i;
					const status = occupiedLevels?.get(levelNum);
					const dark = i % 2 === 0;
					const y1f = TOP_OFF + filledOffset + i * SH;
					const y2f = TOP_OFF + filledOffset + (i + 1) * SH;
					const y1b = filledOffset + i * SH;
					const y2b = filledOffset + (i + 1) * SH;
					const pts = [`${SW},${y1f}`, `${SW + SD},${y1b}`, `${SW + SD},${y2b}`, `${SW},${y2f}`].join(" ");
					const fill = status === "expired"
						? "rgba(10,10,10,0.65)"
						: status === "soon"
							? "rgba(185,28,28,0.5)"
							: status === "normal"
								? "rgba(194,65,12,0.45)"
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
	activeColFilter,
	rowOffset = 0,
}: {
	aisleId: string;
	aisleNum: number;
	row: number;
	isWalkway?: boolean;
	selected: string | null;
	onSelect: (key: string | null, rect?: DOMRect) => void;
	occupiedLevelsByKey?: Map<string, Map<number, LevelStatus>>;
	activeColFilter?: (col: string) => boolean;
	rowOffset?: number;
}) {
	return (
		<div className="flex items-end gap-4">
			<div
				className={`w-8 shrink-0 text-right text-[10px] font-semibold leading-none pb-1 pr-1 ${
					isWalkway ? "text-amber-500" : "text-slate-400"
				}`}
			>
				{isWalkway ? "W" : ""}
			</div>
			{COLUMNS.map((col) => {
				const levels = isWalkway ? WALKWAY_LEVELS : NORMAL_LEVELS;
				const displayLevels = isWalkway ? NORMAL_LEVELS : levels;
				// A1 extended cols (A, N) keep physical row; B-M use offset row numbering
				const effectiveRow = (!isWalkway && rowOffset > 0 && !A1_EXTENDED_COLS.has(col))
					? row - rowOffset
					: row;
				const key = isWalkway
					? `AW${aisleNum}|${col}|${effectiveRow}`
					: `${aisleId}|${col}|${effectiveRow}`;
				const isSelected = selected === key;
				if (activeColFilter && !activeColFilter(col)) {
					return <div key={key} style={{ width: SW + SD, minWidth: SW + SD }} />;
				}
				return (
					<div key={key} data-shelf-key={key}>
					<ShelfUnit
						levels={levels}
						displayLevels={displayLevels}
						selected={isSelected}
						label={isWalkway ? `${col}W-${effectiveRow}` : `${col}${aisleNum}-${effectiveRow}`}
						occupiedLevels={occupiedLevelsByKey?.get(key)}
						onClick={(rect) => onSelect(isSelected ? null : key, isSelected ? undefined : rect)}
					/>
					</div>
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
							className={`rounded-lg border px-3 py-2 ${hasStock ? "border-orange-300 bg-orange-50" : ""}`}
						>
							{!hasStock ? (
								<>
									<p className={`text-[10px] font-bold font-mono tracking-wide ${hasStock ? "text-orange-600" : "text-slate-500"}`}>{binCode}</p>
									<p className="text-[10px] text-muted-foreground pl-1 mt-1">—</p>
								</>
							) : (
								<div className="space-y-1.5">
									{quants.map((q) => (
										<div key={q.id} className="text-[10px]">
											{/* Row 1: bin code left, expiry date right */}
											{(() => {
												const now = Date.now();
												const exp = q.expiryDate ? new Date(q.expiryDate).getTime() : null;
												const monthsAway = exp ? (exp - now) / (1000 * 60 * 60 * 24 * 30.5) : null;
												const expiryClass = exp === null
													? "text-muted-foreground"
													: exp < now
														? "text-slate-900 font-bold"            // already expired
														: monthsAway! <= 6
															? "text-red-600 font-semibold"          // expiring within 6 months
															: "text-muted-foreground";
												return (
													<div className="flex items-baseline justify-between gap-2">
														<span className={`font-bold font-mono tracking-wide ${hasStock ? "text-orange-600" : "text-slate-500"}`}>{binCode}</span>
														<span className={`shrink-0 ${expiryClass}`}>{q.expiryDate ? new Date(q.expiryDate).toLocaleDateString("en-GB") : "No Expiry"}</span>
													</div>
												);
											})()}
											{/* Row 2: SKU code + description + qty */}
											<div className="flex gap-2 mt-0.5 pl-0.5 items-baseline">
												<span className="font-mono text-slate-600 shrink-0">{q.skuCode}</span>
												<span className="text-muted-foreground truncate">{q.description}</span>
												<span className="font-semibold text-foreground tabular-nums shrink-0 ml-auto">{q.quantity} {q.stockUnitCode ?? "CTN"}</span>
											</div>
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
	highlightBin?: string;
	highlightKey?: number;
};

function parseBinToShelfKey(bin: string): string | null {
	const mw = bin.trim().match(/^([A-N])W-L\d+-(\d+)$/i);
	if (mw) {
		const col = mw[1].toUpperCase();
		const row = parseInt(mw[2]);
		const aisleNum = row <= WALKWAY_ROW_COUNT ? 1 : 2;
		return `AW${aisleNum}|${col}|${row}`;
	}
	const m = bin.trim().match(/^([A-N])(\d+)-L\d+-(\d+)$/i);
	if (m) {
		return `A${m[2]}|${m[1].toUpperCase()}|${parseInt(m[3])}`;
	}
	return null;
}

export function WarehouseMap3D({ sectionFilter, highlightBin, highlightKey }: WarehouseMap3DProps) {
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
		const map = new Map<string, Map<number, LevelStatus>>();
		for (const q of allStockData?.stockQuants?.query ?? []) {
			if (!q.rackLabel || !(parseFloat(q.quantity ?? "0") > 0)) continue;
			let key: string | null = null;
			let levelNum: number | null = null;
			const mw = q.rackLabel.match(/^([A-N])W-L(\d+)-(\d+)$/);
			if (mw) {
				const col = mw[1];
				levelNum = parseInt(mw[2]);
				const row = parseInt(mw[3]);
				const aisleNum = row <= WALKWAY_ROW_COUNT ? 1 : 2;
				key = `AW${aisleNum}|${col}|${row}`;
			} else {
				const m = q.rackLabel.match(/^([A-N])(\d+)-L(\d+)-(\d+)$/);
				if (m) {
					key = `A${m[2]}|${m[1]}|${parseInt(m[4])}`;
					levelNum = parseInt(m[3]);
				}
			}
			if (key && levelNum !== null) {
				if (!map.has(key)) map.set(key, new Map());
				const levels = map.get(key)!;
				const newStatus = getLevelStatus(q.expiryDate);
				const existing = levels.get(levelNum);
				if (!existing || STATUS_PRIORITY[newStatus] > STATUS_PRIORITY[existing]) {
					levels.set(levelNum, newStatus);
				}
			}
		}
		return map;
	}, [allStockData]);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [sectionFilter]);

	useEffect(() => {
		if (!highlightBin) return;
		const key = parseBinToShelfKey(highlightBin);
		if (!key) return;
		setSelected(key);
		setTimeout(() => {
			const el = scrollRef.current?.querySelector(`[data-shelf-key="${key}"]`);
			if (!el) return;
			el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
			const rect = el.getBoundingClientRect();
			const CARD_W = 320;
			const x = rect.right + 12 + CARD_W > window.innerWidth
				? rect.left - 12 - CARD_W
				: rect.right + 12;
			const anchorBottom = rect.top > window.innerHeight * 0.55;
			setCardPos({ x, anchorY: anchorBottom ? window.innerHeight - rect.top : rect.top, anchorBottom });
		}, 50);
	}, [highlightBin, highlightKey]);

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
		const minLevel = isWalkwayKey ? 4 : 1;

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
						if (aisle.id === "A1") {
							return (
								<div key={aisle.id}>
									{/* Rows 38→14: normal rows; B-M use offset row numbering; row 38 is A/N only */}
									{Array.from({ length: aisle.rowCount - A1_STAGING_ROW_COUNT }, (_, i) => {
										const row = aisle.rowCount - i;
										const bmRow = row - A1_BM_ROW_OFFSET;
										const hasBMShelf = bmRow >= 1 && bmRow <= A1_BM_MAX_ROW;
										const activeColFilter = !hasBMShelf
											? (col: string) => A1_EXTENDED_COLS.has(col)
											: undefined;
										const rowOffset = hasBMShelf ? A1_BM_ROW_OFFSET : 0;
										return (
											<div key={row} className="mb-3">
												<ShelfRow
													aisleId={aisle.id}
													aisleNum={aisle.aisleNum}
													row={row}
													selected={selected}
													onSelect={handleSelect}
													occupiedLevelsByKey={occupiedLevelsByKey}
													activeColFilter={activeColFilter}
													rowOffset={rowOffset}
												/>
											</div>
										);
									})}

									{/* Staging area: rows 13→1 — A and N shelves with a visible box in the middle */}
									<div className="relative">
										<div
											className="absolute border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/40 flex items-center justify-center pointer-events-none z-10"
											style={{
												left: 64 + SW + SD,
												width: 12 * (SW + SD) + 11 * 16,
												top: 0,
												bottom: 0,
											}}
										>
											<span className="text-slate-400 text-xs font-bold tracking-[0.25em] uppercase">Staging Area</span>
										</div>
										{Array.from({ length: A1_STAGING_ROW_COUNT }, (_, i) => {
											const row = A1_STAGING_ROW_COUNT - i;
											return (
												<div key={row} className="mb-3">
													<ShelfRow
														aisleId={aisle.id}
														aisleNum={aisle.aisleNum}
														row={row}
														selected={selected}
														onSelect={handleSelect}
														occupiedLevelsByKey={occupiedLevelsByKey}
														activeColFilter={(col) => A1_EXTENDED_COLS.has(col)}
													/>
												</div>
											);
										})}
									</div>
								</div>
							);
						}

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
