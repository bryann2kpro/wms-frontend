/**
 * Movement cross-check Excel parser.
 *
 * Reads a multi-sheet "movement" workbook (e.g. one sheet per region/date in the
 * format used by the SME Edaran ops team), auto-detects the header row of each
 * sheet, and extracts one record per Purchase Order with per-SKU quantities.
 *
 * The parser is intentionally tolerant of small format quirks seen in real
 * files (e.g. the `Ctn` header label being blank, PO numbers with `#` prefix,
 * date cells stored as Excel serials).
 */

import * as XLSX from "xlsx";

export type ParsedItems = Record<string, number>;

export interface ExcelPoRecord {
	/** Normalized PO number used as the comparison key (uppercase, no `#`). */
	poNumber: string;
	/** Original PO number cell value as it appeared in the file. */
	poNumberRaw: string;
	outlet: string;
	date: Date | null;
	/** Total cartons for the PO, derived from the row's Ctn cell or summed SKUs. */
	ctn: number;
	/** Map of normalized SKU short code → quantity. */
	items: ParsedItems;
	sourceSheet: string;
	sourceRow: number;
}

export interface ParseWarning {
	sheet: string;
	row?: number;
	message: string;
}

export type ParseExcelResult =
	| {
			ok: true;
			records: ExcelPoRecord[];
			/** Map keyed by `poNumber`. Duplicates keep the first record only. */
			recordsByPo: Map<string, ExcelPoRecord>;
			skuCodes: string[];
			warnings: ParseWarning[];
			sheetCount: number;
	  }
	| { ok: false; error: string; warnings: ParseWarning[] };

/* ─────────────────────────── Helpers ─────────────────────────── */

/** Normalise PO number for matching: trim, uppercase, strip `#`, strip whitespace. */
export function normalizePurchaseOrderNo(raw: unknown): string {
	if (raw === null || raw === undefined) return "";
	const s = String(raw).trim();
	if (!s) return "";
	const stripped = s.startsWith("#") ? s.slice(1) : s;
	return stripped.replace(/\s+/g, "").toUpperCase();
}

/** Normalise SKU code for matching: trim, uppercase, drop optional `RAW-` prefix. */
export function normalizeSkuCode(raw: unknown): string {
	if (raw === null || raw === undefined) return "";
	const s = String(raw).trim().toUpperCase();
	return s.replace(/^RAW-/, "");
}

function isFormulaCell(val: unknown): boolean {
	return typeof val === "string" && val.trim().startsWith("=");
}

function looksLikeSkuHeader(val: unknown): val is string {
	if (typeof val !== "string") return false;
	const t = val.trim();
	if (!t || isFormulaCell(t)) return false;
	const lower = t.toLowerCase();
	if (
		lower === "sum" ||
		lower === "total" ||
		lower === "ctn" ||
		lower === "qty" ||
		lower === "quantity" ||
		lower === "q'ty"
	)
		return false;
	if (lower === "po number" || lower === "outlet") return false;
	if (lower.startsWith("expected")) return false;
	// Typical codes: P0017, E0010, W0005, RAW-P0017
	return /^(RAW-)?[A-Za-z]\w{2,}$/.test(t);
}

function utcMidnight(year: number, month: number, day: number): Date {
	return new Date(Date.UTC(year, month, day));
}

function cellToDate(val: unknown): Date | null {
	// xlsx with cellDates:true returns local-midnight Date objects.
	// Normalise to UTC midnight using the *local* calendar date so that
	// UTC-based display helpers (getUTCDate, etc.) show the right day.
	if (val instanceof Date && !Number.isNaN(val.getTime())) {
		return utcMidnight(val.getFullYear(), val.getMonth(), val.getDate());
	}
	if (typeof val === "number" && Number.isFinite(val)) {
		// Excel serial → UTC midnight (25569 = days between 1900-01-01 and 1970-01-01).
		const ms = (val - 25569) * 86400 * 1000;
		const d = new Date(ms);
		if (!Number.isNaN(d.getTime())) return d;
	}
	if (typeof val === "string") {
		const t = val.trim();
		if (!t) return null;

		// MM/DD/YY(YY) — Excel's default US locale string, e.g. "4/30/26"
		const mdy = t.match(/^(\d{1,2})[/](\d{1,2})[/](\d{2,4})$/);
		if (mdy) {
			const month = Number.parseInt(mdy[1], 10);
			const day = Number.parseInt(mdy[2], 10);
			let year = Number.parseInt(mdy[3], 10);
			if (year < 100) year += 2000;
			// Only valid as MM/DD if day ≤ 31 and month ≤ 12.
			if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
				const d = utcMidnight(year, month - 1, day);
				if (!Number.isNaN(d.getTime())) return d;
			}
		}

		// DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
		const dmy = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
		if (dmy) {
			const day = Number.parseInt(dmy[1], 10);
			const month = Number.parseInt(dmy[2], 10);
			let year = Number.parseInt(dmy[3], 10);
			if (year < 100) year += 2000;
			if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
				const d = utcMidnight(year, month - 1, day);
				if (!Number.isNaN(d.getTime())) return d;
			}
		}

		// ISO YYYY-MM-DD (already UTC-friendly via Date.parse)
		if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
			const d = new Date(t);
			if (!Number.isNaN(d.getTime())) return d;
		}
	}
	return null;
}

function parseQuantity(val: unknown): number | null {
	if (val === null || val === undefined || val === "") return null;
	if (isFormulaCell(val)) return null;
	const n =
		typeof val === "number"
			? val
			: Number.parseFloat(String(val).replace(/,/g, ""));
	if (!Number.isFinite(n)) return null;
	return n;
}

/** Locate a column whose header matches one of the case-insensitive labels. */
function findColumn(
	header: unknown[],
	predicate: (cell: string, idx: number) => boolean,
	startFrom = 0,
): number {
	for (let i = startFrom; i < header.length; i++) {
		const v = header[i];
		if (typeof v !== "string") continue;
		if (predicate(v.trim().toLowerCase(), i)) return i;
	}
	return -1;
}

interface SheetLayout {
	headerRowIdx: number;
	poCol: number;
	outletCol: number;
	dateCol: number;
	ctnCol: number;
	totalCol: number;
	skuCols: Array<{ index: number; code: string }>;
}

function parseDateFromCell(
	sheet: XLSX.WorkSheet,
	rowIndex: number,
	colIndex: number,
	fallbackRaw: unknown,
): Date | null {
	const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
	const cell = sheet[addr];
	// Prefer formatted cell text when present (e.g. "4/30/26"), because some
	// workbooks produce shifted Date objects in raw/cellDates mode.
	if (cell?.w && typeof cell.w === "string") {
		const parsedFromText = cellToDate(cell.w);
		if (parsedFromText) return parsedFromText;
	}
	return cellToDate(fallbackRaw);
}

/** Try to recognise the per-sheet header layout. Returns null if unrecognised. */
function detectLayout(rows: unknown[][]): SheetLayout | null {
	for (let r = 0; r < Math.min(rows.length, 10); r++) {
		const row = rows[r] ?? [];
		const lower = row.map((c) =>
			typeof c === "string" ? c.trim().toLowerCase() : "",
		);
		const hasPoLabel = lower.some((c) => c === "po number");
		const hasOutletLabel = lower.some((c) => c === "outlet");
		if (!hasPoLabel || !hasOutletLabel) continue;

		// "PO Number" appears twice in the sample (col A label, col B header). Prefer the second.
		const firstPo = lower.indexOf("po number");
		const secondPo = lower.indexOf("po number", firstPo + 1);
		const poCol = secondPo !== -1 ? secondPo : firstPo;

		const outletCol = findColumn(row, (c) => c === "outlet");
		const dateCol = findColumn(
			row,
			(c) =>
				c.startsWith("expected") &&
				(c.includes("arrival") || c.includes("date")),
		);
		const totalCol = findColumn(row, (c) => c === "total");

		// Ctn header may be blank in some sheets — fall back to the column right after the date column.
		let ctnCol = findColumn(row, (c) => c === "ctn" || c === "cartons");
		if (ctnCol === -1 && dateCol !== -1) ctnCol = dateCol + 1;

		const skuCols: Array<{ index: number; code: string }> = [];
		const skuStart = (ctnCol >= 0 ? ctnCol : dateCol) + 1;
		const skuEnd = totalCol >= 0 ? totalCol : row.length;
		for (let c = skuStart; c < skuEnd; c++) {
			const cell = row[c];
			if (looksLikeSkuHeader(cell)) {
				skuCols.push({ index: c, code: normalizeSkuCode(cell) });
			}
		}

		// Need at least PO column + outlet + date + at least one SKU.
		if (
			poCol === -1 ||
			outletCol === -1 ||
			dateCol === -1 ||
			skuCols.length === 0
		) {
			continue;
		}

		return {
			headerRowIdx: r,
			poCol,
			outletCol,
			dateCol,
			ctnCol,
			totalCol: totalCol === -1 ? row.length : totalCol,
			skuCols,
		};
	}
	return null;
}

function isRowEmpty(row: unknown[]): boolean {
	for (const c of row) {
		if (c !== null && c !== undefined && c !== "") return false;
	}
	return true;
}

/* ─────────────────────────── Public API ─────────────────────────── */

export async function parseMovementExcel(
	file: File,
): Promise<ParseExcelResult> {
	const warnings: ParseWarning[] = [];
	let buffer: ArrayBuffer;
	try {
		buffer = await file.arrayBuffer();
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Could not read file",
			warnings,
		};
	}

	let workbook: XLSX.WorkBook;
	try {
		workbook = XLSX.read(buffer, { type: "array", cellDates: true });
	} catch (err) {
		return {
			ok: false,
			error:
				err instanceof Error
					? `Could not parse Excel file: ${err.message}`
					: "Could not parse Excel file.",
			warnings,
		};
	}

	if (!workbook.SheetNames.length) {
		return { ok: false, error: "The workbook has no sheets.", warnings };
	}

	const records: ExcelPoRecord[] = [];
	const recordsByPo = new Map<string, ExcelPoRecord>();
	const skuCodeSet = new Set<string>();

	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		if (!sheet) continue;

		const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
			header: 1,
			defval: null,
			raw: true,
		}) as unknown[][];
		if (!rows.length) continue;

		const layout = detectLayout(rows);
		if (!layout) {
			warnings.push({
				sheet: sheetName,
				message: "Skipped: header row could not be detected.",
			});
			continue;
		}

		for (let r = layout.headerRowIdx + 1; r < rows.length; r++) {
			const row = rows[r] ?? [];
			if (isRowEmpty(row)) continue;

			const poRaw = row[layout.poCol];
			const poNorm = normalizePurchaseOrderNo(poRaw);
			if (!poNorm) continue;
			// Skip totals row (if it has a SUM formula or no real PO).
			if (isFormulaCell(poRaw)) continue;

			const outlet =
				row[layout.outletCol] === null || row[layout.outletCol] === undefined
					? ""
					: String(row[layout.outletCol]).trim();
			const date = parseDateFromCell(
				sheet,
				r,
				layout.dateCol,
				row[layout.dateCol],
			);

			const items: ParsedItems = {};
			let summedCtn = 0;
			for (const { index, code } of layout.skuCols) {
				const qty = parseQuantity(row[index]);
				if (qty === null || qty === 0) continue;
				items[code] = (items[code] ?? 0) + qty;
				summedCtn += qty;
				skuCodeSet.add(code);
			}

			let ctn = layout.ctnCol >= 0 ? parseQuantity(row[layout.ctnCol]) : null;
			if (ctn === null) ctn = summedCtn;

			const record: ExcelPoRecord = {
				poNumber: poNorm,
				poNumberRaw: String(poRaw ?? ""),
				outlet,
				date,
				ctn,
				items,
				sourceSheet: sheetName,
				sourceRow: r + 1,
			};

			if (recordsByPo.has(poNorm)) {
				warnings.push({
					sheet: sheetName,
					row: r + 1,
					message: `Duplicate PO ${record.poNumberRaw} (already seen on sheet "${
						recordsByPo.get(poNorm)?.sourceSheet
					}"). Keeping the first.`,
				});
				continue;
			}

			records.push(record);
			recordsByPo.set(poNorm, record);
		}
	}

	if (records.length === 0) {
		return {
			ok: false,
			error:
				"No purchase order rows were found. Make sure each sheet has a 'PO Number' / 'Outlet' header row with SKU columns underneath.",
			warnings,
		};
	}

	const skuCodes = Array.from(skuCodeSet).sort();

	return {
		ok: true,
		records,
		recordsByPo,
		skuCodes,
		warnings,
		sheetCount: workbook.SheetNames.length,
	};
}
