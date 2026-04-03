/**
 * Parse "delivery schedule" Excel files: one row per PO, SKU codes as column headers (wide format).
 */

import * as XLSX from "xlsx";

/** Short code from Excel header (e.g. P0017); `skuCode` is the value sent to the API (e.g. RAW-P0017). */
export interface ParsedPurchaseOrderLine {
	shortCode: string;
	skuCode: string;
	quantity: number;
}

export interface ParsedPurchaseOrderRow {
	purchaseOrderNumber: string;
	outletName: string;
	expectedDeliveryDate: Date | null;
	items: ParsedPurchaseOrderLine[];
}

export type ParseDeliveryExcelResult =
	| { ok: true; rows: ParsedPurchaseOrderRow[] }
	| { ok: false; error: string };

const RAW_PREFIX = "RAW-";

/** Normalize PO cell: strip # and trim. */
export function normalizePurchaseOrderNo(raw: unknown): string {
	if (raw === null || raw === undefined) return "";
	const s = String(raw).trim();
	if (!s) return "";
	return s.startsWith("#") ? s.slice(1).trim() : s;
}

function isSumOrFormulaCell(val: unknown): boolean {
	if (val === null || val === undefined) return false;
	if (typeof val === "string" && val.trim().startsWith("=")) return true;
	return false;
}

function looksLikeSkuHeader(val: unknown): val is string {
	if (val === null || val === undefined) return false;
	if (typeof val !== "string") return false;
	const t = val.trim();
	if (!t || isSumOrFormulaCell(t)) return false;
	// Skip obvious non-SKU headers
	const lower = t.toLowerCase();
	if (lower === "sum" || lower === "total") return false;
	// Typical codes: P0017, E0010, W0005
	return /^[A-Za-z][\w.-]*$/.test(t);
}

/** Convert Excel date serial, Date, or locale string (e.g. `4/7/26`) to JS Date. */
function cellToDate(val: unknown): Date | null {
	if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
	if (typeof val === "number" && Number.isFinite(val)) {
		// Excel serial (days since 1899-12-30 UTC)
		const ms = (val - 25569) * 86400 * 1000;
		const d = new Date(ms);
		if (!Number.isNaN(d.getTime())) return d;
	}
	if (typeof val === "string") {
		const t = val.trim();
		if (!t) return null;
		const d = new Date(t);
		if (!Number.isNaN(d.getTime())) return d;
	}
	return null;
}

function validateHeaderRow(row: unknown[]): boolean {
	if (row.length < 4) return false;
	const c = String(row[2] ?? "")
		.trim()
		.toLowerCase();
	const d = String(row[3] ?? "")
		.trim()
		.toLowerCase();
	const outletOk = c === "outlet";
	const dateOk =
		d.includes("expected") && (d.includes("arrival") || d.includes("date"));
	return outletOk && dateOk;
}

/**
 * Read SKU short codes from header row starting at column F (index 5).
 */
function parseSkuHeaders(row: unknown[]): string[] {
	const codes: string[] = [];
	for (let i = 5; i < row.length; i++) {
		const val = row[i];
		if (val === null || val === undefined || val === "") break;
		if (isSumOrFormulaCell(val)) break;
		if (typeof val === "number") break;
		if (!looksLikeSkuHeader(val)) break;
		codes.push(String(val).trim());
	}
	return codes;
}

function parseQuantity(val: unknown): number | null {
	if (val === null || val === undefined || val === "") return null;
	const n =
		typeof val === "number"
			? val
			: Number.parseFloat(String(val).replace(/,/g, ""));
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

/**
 * Parse the first worksheet of a delivery Excel file.
 * Expected layout: row 1 = headers (Outlet col C, Expected Arrival Date col D, SKU codes from col F),
 * data from row 2: PO number col B, outlet col C, date col D, quantities from col F aligned with headers.
 */
export async function parseDeliveryExcel(
	file: File,
): Promise<ParseDeliveryExcelResult> {
	const buf = await file.arrayBuffer();
	const workbook = XLSX.read(buf, { type: "array", cellDates: true });
	const firstName = workbook.SheetNames[0];
	if (!firstName) {
		return { ok: false, error: "The workbook has no sheets." };
	}
	const sheet = workbook.Sheets[firstName];
	if (!sheet) {
		return { ok: false, error: "Could not read the first worksheet." };
	}

	const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
		header: 1,
		defval: null,
		raw: false,
	}) as unknown[][];

	if (!rows.length) {
		return { ok: false, error: "The sheet is empty." };
	}

	const headerRow = rows[0] ?? [];
	if (!validateHeaderRow(headerRow)) {
		return {
			ok: false,
			error:
				"Unrecognized format. Expected row 1 to include Outlet (column C) and Expected Arrival Date (column D), with SKU codes from column F.",
		};
	}

	const skuShortCodes = parseSkuHeaders(headerRow);
	if (skuShortCodes.length === 0) {
		return {
			ok: false,
			error:
				"No SKU columns found. Add SKU codes in row 1 starting from column F.",
		};
	}

	const parsed: ParsedPurchaseOrderRow[] = [];

	for (let r = 1; r < rows.length; r++) {
		const row = rows[r] ?? [];
		const poRaw = row[1];
		const purchaseOrderNumber = normalizePurchaseOrderNo(poRaw);
		if (!purchaseOrderNumber) continue;

		const outletName =
			row[2] === null || row[2] === undefined ? "" : String(row[2]).trim();
		const expectedDeliveryDate = cellToDate(row[3]);

		const items: ParsedPurchaseOrderLine[] = [];
		for (let c = 0; c < skuShortCodes.length; c++) {
			const colIndex = 5 + c;
			const qty = parseQuantity(row[colIndex]);
			if (qty === null) continue;
			const shortCode = skuShortCodes[c];
			if (!shortCode) continue;
			items.push({
				shortCode,
				skuCode: `${RAW_PREFIX}${shortCode}`,
				quantity: qty,
			});
		}

		if (items.length === 0) {
			continue;
		}

		parsed.push({
			purchaseOrderNumber,
			outletName,
			expectedDeliveryDate,
			items,
		});
	}

	if (parsed.length === 0) {
		return {
			ok: false,
			error:
				"No purchase order rows found. Ensure each row has a PO number in column B and at least one quantity in columns F onward.",
		};
	}

	return { ok: true, rows: parsed };
}

/** Minimal outlet shape for matching. */
export type ImportOutletRef = {
	outletId: string;
	outletName: string;
	outletCode?: string;
};

/** Minimal SKU shape for resolving lines. */
export type ImportSkuRef = {
	skuId: string;
	skuCode: string;
};

export type ImportReviewRow = {
	rowIndex: number;
	parsed: ParsedPurchaseOrderRow;
	/** Exactly one case-insensitive name match. */
	autoOutletId: string | null;
	/** All outlets with the same name (usually 0 or 1). */
	outletCandidates: ImportOutletRef[];
	resolvedItems: Array<{
		skuId: string;
		skuCode: string;
		quantity: number;
	}>;
	/** Full SKU codes from the file with no catalog match (e.g. RAW-P0017). */
	unmatchedSkuCodes: string[];
};

function findSkuInCatalog(
	skuCode: string,
	skus: ImportSkuRef[],
): ImportSkuRef | undefined {
	const trimmed = skuCode.trim();
	const upper = trimmed.toUpperCase();
	const direct =
		skus.find((s) => s.skuCode === trimmed) ??
		skus.find((s) => s.skuCode.toUpperCase() === upper);
	if (direct) return direct;
	const short = trimmed.replace(/^RAW-/i, "");
	if (!short) return undefined;
	return (
		skus.find(
			(s) => s.skuCode.toUpperCase() === `RAW-${short}`.toUpperCase(),
		) ??
		skus.find(
			(s) =>
				s.skuCode.replace(/^RAW-/i, "").toUpperCase() === short.toUpperCase(),
		)
	);
}

/**
 * Match parsed rows to outlets (exact name, case-insensitive) and SKUs (RAW- prefix).
 */
export function buildImportReviewRows(
	rows: ParsedPurchaseOrderRow[],
	outlets: ImportOutletRef[],
	skus: ImportSkuRef[],
): ImportReviewRow[] {
	return rows.map((parsed, rowIndex) => {
		const name = parsed.outletName.trim().toLowerCase();
		const outletCandidates = outlets.filter(
			(o) => o.outletName.trim().toLowerCase() === name,
		);
		const autoOutletId =
			outletCandidates.length === 1 ? outletCandidates[0].outletId : null;

		const resolvedItems: ImportReviewRow["resolvedItems"] = [];
		const unmatchedSkuCodes: string[] = [];
		for (const line of parsed.items) {
			const rec = findSkuInCatalog(line.skuCode, skus);
			if (rec) {
				resolvedItems.push({
					skuId: rec.skuId,
					skuCode: rec.skuCode,
					quantity: line.quantity,
				});
			} else {
				unmatchedSkuCodes.push(line.skuCode);
			}
		}

		return {
			rowIndex,
			parsed,
			autoOutletId,
			outletCandidates,
			resolvedItems,
			unmatchedSkuCodes,
		};
	});
}
