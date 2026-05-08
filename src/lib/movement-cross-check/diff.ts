/**
 * Movement cross-check diff engine.
 *
 * Compares a map of records parsed from an uploaded Excel against a map of
 * Purchase Orders fetched from the database. Both sides are keyed by the
 * normalised PO number returned by `normalizePurchaseOrderNo`.
 */

import type { ExcelPoRecord, ParsedItems } from "./parse-excel";

export interface DbPoRecord {
	poNumber: string; // normalized
	poNumberRaw: string;
	outlet: string;
	region: string;
	date: Date | null;
	ctn: number;
	items: ParsedItems; // normalized SKU code → qty
}

export interface SkuDiffEntry {
	skuCode: string;
	excel: number;
	db: number;
}

export interface DiffFlags {
	outletDiff: boolean;
	dateDiff: boolean;
	ctnDiff: boolean;
	skuDiffs: SkuDiffEntry[];
}

export type DiffStatus = "ok" | "mismatch" | "missingInDb" | "missingInExcel";

export interface DiffRow {
	key: string;
	excel?: ExcelPoRecord;
	db?: DbPoRecord;
	flags: DiffFlags;
	status: DiffStatus;
}

export interface DiffSummary {
	total: number;
	ok: number;
	mismatch: number;
	missingInDb: number;
	missingInExcel: number;
}

export interface DiffResult {
	rows: DiffRow[];
	summary: DiffSummary;
	skuCodes: string[];
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function dateKey(d: Date | null): string {
	if (!d) return "";
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function isCtnDifferent(a: number, b: number): boolean {
	return Math.abs(a - b) > 0.0001;
}

function sumItems(items: ParsedItems): number {
	return Object.values(items).reduce((sum, qty) => sum + qty, 0);
}

/* ─────────────────────────── Public API ─────────────────────────── */

export function diffMovement(
	excelMap: Map<string, ExcelPoRecord>,
	dbMap: Map<string, DbPoRecord>,
): DiffResult {
	const allKeys = new Set<string>();
	for (const k of excelMap.keys()) allKeys.add(k);
	for (const k of dbMap.keys()) allKeys.add(k);

	const allSkus = new Set<string>();
	for (const r of excelMap.values()) {
		for (const sku of Object.keys(r.items)) allSkus.add(sku);
	}
	for (const r of dbMap.values()) {
		for (const sku of Object.keys(r.items)) allSkus.add(sku);
	}
	const skuCodes = Array.from(allSkus).sort();

	const rows: DiffRow[] = [];
	let ok = 0;
	let mismatch = 0;
	let missingInDb = 0;
	let missingInExcel = 0;

	const sortedKeys = Array.from(allKeys).sort();
	for (const key of sortedKeys) {
		const excel = excelMap.get(key);
		const db = dbMap.get(key);

		if (excel && !db) {
			missingInDb += 1;
			rows.push({
				key,
				excel,
				flags: emptyFlags(),
				status: "missingInDb",
			});
			continue;
		}
		if (!excel && db) {
			missingInExcel += 1;
			rows.push({
				key,
				db,
				flags: emptyFlags(),
				status: "missingInExcel",
			});
			continue;
		}
		if (!excel || !db) continue;

		const excelSkuSum = sumItems(excel.items);
		const excelQtyMatchesItsSkuSum = !isCtnDifferent(excel.ctn, excelSkuSum);
		const ctnDiffAgainstDb = isCtnDifferent(excel.ctn, db.ctn);

		const flags: DiffFlags = {
			outletDiff: false,
			dateDiff: dateKey(excel.date) !== dateKey(db.date),
			// If Excel total qty/ctn already equals the sum of its SKU quantities,
			// do not fail on ctn mismatch; SKU-level diff remains the source of truth.
			ctnDiff: ctnDiffAgainstDb && !excelQtyMatchesItsSkuSum,
			skuDiffs: [],
		};

		const skuKeys = new Set<string>([
			...Object.keys(excel.items),
			...Object.keys(db.items),
		]);
		for (const sku of Array.from(skuKeys).sort()) {
			const e = excel.items[sku] ?? 0;
			const d = db.items[sku] ?? 0;
			if (Math.abs(e - d) > 0.0001) {
				flags.skuDiffs.push({ skuCode: sku, excel: e, db: d });
			}
		}

		const hasMismatch =
			flags.outletDiff ||
			flags.dateDiff ||
			flags.ctnDiff ||
			flags.skuDiffs.length > 0;

		rows.push({
			key,
			excel,
			db,
			flags,
			status: hasMismatch ? "mismatch" : "ok",
		});

		if (hasMismatch) mismatch += 1;
		else ok += 1;
	}

	return {
		rows,
		summary: {
			total: rows.length,
			ok,
			mismatch,
			missingInDb,
			missingInExcel,
		},
		skuCodes,
	};
}

function emptyFlags(): DiffFlags {
	return {
		outletDiff: false,
		dateDiff: false,
		ctnDiff: false,
		skuDiffs: [],
	};
}
