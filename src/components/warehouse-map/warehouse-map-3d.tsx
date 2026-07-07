import { useState } from "react";
import { X } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// Columns F-K have 5 levels; all others have 6
const FK_COLS = new Set(["F", "G", "H", "I", "J", "K"]);
const DEFAULT_LEVELS = 6;
const FK_LEVELS = 5;

// Sections: array of [start, end] inclusive, displayed high-to-low
const SECTIONS: Array<{ start: number; end: number }> = [
	{ start: 43, end: 60 }, // Section 3 (shown at top)
	{ start: 25, end: 42 }, // Section 2
	{ start: 1,  end: 24 }, // Section 1 (shown at bottom)
];

// SVG shelf geometry
const SW = 44;   // front face width
const SH = 11;   // height per shelf level
const SD = 16;   // depth offset (isometric)
const TOP_OFF = SD / 2; // y-offset so top face fits above front

// ─── Isometric shelf SVG ─────────────────────────────────────────────────────

type ShelfProps = {
	levels: number;
	selected: boolean;
	onClick: () => void;
	label: string;
};

function ShelfUnit({ levels, selected, onClick, label }: ShelfProps) {
	const totalH = levels * SH;
	const svgW = SW + SD;
	const svgH = totalH + TOP_OFF;

	// Colours — selected = brighter blue; default = steel blue/slate
	const topFill    = selected ? "#60a5fa" : "#93c5fd";
	const frontFill  = selected ? "#374151" : "#4b5563";
	const sideFill   = selected ? "#111827" : "#1f2937";
	const dividerCol = "rgba(156,163,175,0.55)";
	const sideDiv    = "rgba(255,255,255,0.12)";
	const outline    = selected ? "#1d4ed8" : "rgba(255,255,255,0.6)";

	// Top face (parallelogram): front-left → front-right → back-right → back-left
	const topPts = [
		`0,${TOP_OFF}`,
		`${SW},${TOP_OFF}`,
		`${SW + SD},0`,
		`${SD},0`,
	].join(" ");

	// Right side face
	const sidePts = [
		`${SW},${TOP_OFF}`,
		`${SW + SD},0`,
		`${SW + SD},${totalH}`,
		`${SW},${totalH + TOP_OFF}`,
	].join(" ");

	return (
		<div className="flex flex-col items-start gap-0">
			<svg
				width={svgW}
				height={svgH}
				viewBox={`0 0 ${svgW} ${svgH}`}
				onClick={onClick}
				className="cursor-pointer hover:opacity-90 transition-opacity"
				role="button"
				aria-label={label}
			>
				{/* Top face */}
				<polygon points={topPts} fill={topFill} stroke={outline} strokeWidth="0.6" />

				{/* Front face */}
				<rect x={0} y={TOP_OFF} width={SW} height={totalH} fill={frontFill} stroke={outline} strokeWidth="0.6" />

				{/* Shelf dividers — front */}
				{Array.from({ length: levels - 1 }, (_, i) => (
					<line
						key={i}
						x1={0}
						y1={TOP_OFF + (i + 1) * SH}
						x2={SW}
						y2={TOP_OFF + (i + 1) * SH}
						stroke={dividerCol}
						strokeWidth="1"
					/>
				))}

				{/* Right side face */}
				<polygon points={sidePts} fill={sideFill} stroke={outline} strokeWidth="0.6" />

				{/* Shelf dividers — side */}
				{Array.from({ length: levels - 1 }, (_, i) => (
					<line
						key={i}
						x1={SW}
						y1={TOP_OFF + (i + 1) * SH}
						x2={SW + SD}
						y2={(i + 1) * SH}
						stroke={sideDiv}
						strokeWidth="0.8"
					/>
				))}
			</svg>
		</div>
	);
}

// ─── Row of shelves ───────────────────────────────────────────────────────────

type RowProps = {
	row: number;
	selected: string | null;
	onSelect: (key: string | null) => void;
};

function ShelfRow({ row, selected, onSelect }: RowProps) {
	const rowLabel = String(row).padStart(2, "0");
	return (
		<div className="flex items-end gap-1">
			{/* Row number */}
			<div className="w-8 shrink-0 text-right text-[10px] font-semibold text-muted-foreground leading-none pb-1 pr-1">
				{row}
			</div>

			{COLUMNS.map((col) => {
				const levels = FK_COLS.has(col) ? FK_LEVELS : DEFAULT_LEVELS;
				const key = `${col}${rowLabel}`;
				const isSelected = selected === key;

				return (
					<ShelfUnit
						key={key}
						levels={levels}
						selected={isSelected}
						label={`${col}${row}`}
						onClick={() => onSelect(isSelected ? null : key)}
					/>
				);
			})}
		</div>
	);
}

// ─── Walkway divider ─────────────────────────────────────────────────────────

function Walkway() {
	return (
		<div className="flex items-center gap-1 py-3">
			<div className="w-8 shrink-0" />
			{/* stripe line across all columns */}
			<div
				className="flex-1 h-6 rounded flex items-center justify-center text-[10px] font-semibold tracking-widest text-amber-700 bg-amber-50 border border-amber-200"
				style={{ minWidth: COLUMNS.length * (SW + SD + 4) }}
			>
				WALKWAY
			</div>
		</div>
	);
}

// ─── Column header row ────────────────────────────────────────────────────────

function ColumnLabels() {
	return (
		<div className="flex items-center gap-1 pt-1">
			<div className="w-8 shrink-0" />
			{COLUMNS.map((col) => (
				<div
					key={col}
					className="text-center text-[11px] font-bold text-slate-600"
					style={{ width: SW + SD, minWidth: SW + SD }}
				>
					{col}
				</div>
			))}
		</div>
	);
}

// ─── Detail card ─────────────────────────────────────────────────────────────

function ShelfDetailCard({
	shelfKey,
	onClose,
}: {
	shelfKey: string;
	onClose: () => void;
}) {
	// Parse col letter(s) and row number from key like "A01" or "AB03"
	const colMatch = shelfKey.match(/^([A-Z]+)(\d+)$/);
	const col = colMatch?.[1] ?? "";
	const row = colMatch ? parseInt(colMatch[2]) : 0;
	const levels = FK_COLS.has(col) ? FK_LEVELS : DEFAULT_LEVELS;

	return (
		<div className="border rounded-xl bg-white shadow-lg p-4 w-64 shrink-0">
			<div className="flex items-center justify-between mb-3">
				<p className="font-semibold text-sm" style={{ fontFamily: "var(--dashboard-display)" }}>
					Shelf {col}{row}
				</p>
				<button
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div className="space-y-1 text-xs text-muted-foreground">
				<div className="flex justify-between">
					<span>Column</span>
					<span className="font-mono font-medium text-foreground">{col}</span>
				</div>
				<div className="flex justify-between">
					<span>Row</span>
					<span className="font-mono font-medium text-foreground">{row}</span>
				</div>
				<div className="flex justify-between">
					<span>Levels</span>
					<span className="font-mono font-medium text-foreground">{levels}</span>
				</div>
				<div className="flex justify-between">
					<span>Section</span>
					<span className="font-mono font-medium text-foreground">
						{row <= 24 ? "1 (rows 1–24)" : row <= 42 ? "2 (rows 25–42)" : "3 (rows 43–60)"}
					</span>
				</div>
			</div>
			<p className="mt-3 text-[10px] text-muted-foreground italic">
				Stock detail coming soon.
			</p>
		</div>
	);
}

// ─── Main 3D Map component ───────────────────────────────────────────────────

export function WarehouseMap3D() {
	const [selected, setSelected] = useState<string | null>(null);

	return (
		<div className="space-y-4">
			<p className="text-xs text-muted-foreground">
				Fixed warehouse layout · Columns A–N · Rows 1–60 · F–K shelves are 5 levels, all others 6 levels · Click a shelf to inspect
			</p>

			<div className="flex gap-4 items-start">
				{/* Map */}
				<div className="overflow-x-auto rounded-xl border bg-slate-50 p-4 flex-1">
					<div className="inline-block">
						{SECTIONS.map((section, sIdx) => {
							// Render rows from end down to start (high row at top)
							const rows: number[] = [];
							for (let r = section.end; r >= section.start; r--) rows.push(r);

							return (
								<div key={sIdx}>
									{rows.map((row) => (
										<ShelfRow
											key={row}
											row={row}
											selected={selected}
											onSelect={setSelected}
										/>
									))}
									{/* Walkway after sections 1 and 2 */}
									{sIdx < SECTIONS.length - 1 && <Walkway />}
								</div>
							);
						})}

						{/* Column labels at the bottom */}
						<ColumnLabels />
					</div>
				</div>

				{/* Detail panel */}
				{selected && (
					<ShelfDetailCard
						shelfKey={selected}
						onClose={() => setSelected(null)}
					/>
				)}
			</div>

			{/* Legend */}
			<div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<div className="w-3 h-3 rounded-sm bg-[#93c5fd]" />
					<span>Shelf top face (5 or 6 levels)</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="w-3 h-3 rounded-sm bg-[#4b5563]" />
					<span>Front face</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />
					<span>Walkway</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="w-3 h-3 rounded-sm bg-[#60a5fa]" />
					<span>Selected shelf</span>
				</div>
			</div>
		</div>
	);
}
