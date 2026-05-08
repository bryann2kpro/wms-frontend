import { createFileRoute } from "@tanstack/react-router";
import { request } from "graphql-request";
import {
	AlertTriangle,
	ArrowDownLeft,
	ArrowUpRight,
	BarChart3,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	FileText,
	GitCompareArrows,
	Upload,
	X,
} from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/env";
import {
	PURCHASE_ORDERS_WITH_OUTLET_QUERY,
	type PurchaseOrdersQueryData,
	type PurchaseOrdersQueryVariables,
} from "@/lib/graphql/purchase-orders";
import type { PurchaseOrder } from "@/lib/graphql/types";
import {
	type DbPoRecord,
	type DiffResult,
	type DiffRow,
	diffMovement,
} from "@/lib/movement-cross-check/diff";
import {
	type ExcelPoRecord,
	normalizePurchaseOrderNo,
	normalizeSkuCode,
	type ParseWarning,
	parseMovementExcel,
} from "@/lib/movement-cross-check/parse-excel";
import { requirePermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/movement-cross-check")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Report"]);
	},
	component: MovementCrossCheckComponent,
	head: () => ({
		meta: [
			{
				title: "Movement Cross Check - SME Edaran WMS",
				description:
					"Export Purchase Orders by region/date to Excel and reconcile against another system's movement file.",
			},
		],
	}),
});

/* ───────────────── Helpers ───────────────── */

const MAX_PAGE_SIZE = 200;

function authHeaders(): Headers {
	const h = new Headers();
	h.set(
		"Authorization",
		`Bearer ${typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : ""}`,
	);
	return h;
}

async function fetchAllPurchaseOrdersInRange(
	dateFrom: string,
	dateTo: string,
): Promise<PurchaseOrder[]> {
	const all: PurchaseOrder[] = [];
	let page = 1;
	while (true) {
		const data = await request<
			PurchaseOrdersQueryData,
			PurchaseOrdersQueryVariables
		>(
			env.VITE_GRAPHQL_ENDPOINT,
			PURCHASE_ORDERS_WITH_OUTLET_QUERY,
			{
				filter: {
					scheduledDeliveryDateFrom: dateFrom,
					scheduledDeliveryDateTo: dateTo,
				},
				pageSize: MAX_PAGE_SIZE,
				pageNumber: page,
			},
			authHeaders(),
		);
		const batch = data.purchaseOrders?.query ?? [];
		all.push(...batch);
		const pagination = data.purchaseOrders?.pagination;
		if (!pagination?.hasNextPage) break;
		page += 1;
		if (page > 200) break; // safety stop at 40,000 rows
	}
	return all;
}

function poToDate(po: PurchaseOrder): Date | null {
	if (!po.scheduledDeliveryDate) return null;
	const d = new Date(po.scheduledDeliveryDate);
	return Number.isNaN(d.getTime()) ? null : d;
}

function ddmm(d: Date): string {
	const dd = String(d.getUTCDate()).padStart(2, "0");
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	return `${dd}.${mm}`;
}

function formatDdMmYyyy(d: Date | null | undefined): string {
	if (!d) return "";
	const dd = String(d.getUTCDate()).padStart(2, "0");
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const yyyy = d.getUTCFullYear();
	return `${dd}/${mm}/${yyyy}`;
}

/** Build a sheet name allowed by Excel (max 31 chars, no `/ \ : ? * [ ]`). */
function safeSheetName(input: string, used: Set<string>): string {
	let base = input.replace(/[/\\:?*[\]]/g, "-").trim();
	if (base.length > 31) base = base.slice(0, 31);
	if (!base) base = "Sheet";
	let candidate = base;
	let i = 2;
	while (used.has(candidate)) {
		const suffix = ` (${i})`;
		candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
		i += 1;
	}
	used.add(candidate);
	return candidate;
}

function poTotalCtn(po: PurchaseOrder): number {
	return (po.items ?? []).reduce(
		(sum, it) => sum + Number(it.qtyRequired ?? 0),
		0,
	);
}

function poItemMap(po: PurchaseOrder): Record<string, number> {
	const out: Record<string, number> = {};
	for (const item of po.items ?? []) {
		const code = normalizeSkuCode(item.skuCode);
		if (!code) continue;
		out[code] = (out[code] ?? 0) + Number(item.qtyRequired ?? 0);
	}
	return out;
}

function purchaseOrderToDbRecord(po: PurchaseOrder): DbPoRecord {
	return {
		poNumber: normalizePurchaseOrderNo(po.purchaseOrderNo),
		poNumberRaw: po.purchaseOrderNo,
		outlet: po.outlet?.outletName ?? "",
		region: po.outlet?.region?.regionName ?? po.outlet?.regionName ?? "",
		date: poToDate(po),
		ctn: poTotalCtn(po),
		items: poItemMap(po),
	};
}

/* ───────────────── Excel generation: Export section ───────────────── */

interface BuildSheetOptions {
	pos: PurchaseOrder[];
	skuCodes: string[];
	includeRegionColumn: boolean;
	groupByRegion?: boolean;
}

function buildSheet({
	pos,
	skuCodes,
	includeRegionColumn,
	groupByRegion,
}: BuildSheetOptions): XLSX.WorkSheet {
	const headers: string[] = [
		"PO Number",
		"PO Number",
		"Outlet",
		...(includeRegionColumn ? ["Region"] : []),
		"Expected Arrival Date",
		"Ctn",
		"",
		...skuCodes,
		"Total",
	];

	const rows: unknown[][] = [headers];

	const totalCol = headers.length - 1;
	const skuEndCol = totalCol; // exclusive upper bound for SKU columns
	const skuStartCol = totalCol - skuCodes.length;
	const ctnCol = includeRegionColumn ? 5 : 4;

	const colLetter = (c: number) => XLSX.utils.encode_col(c);

	const sortedPos = [...pos].sort((a, b) => {
		if (groupByRegion) {
			const ra = a.outlet?.region?.regionName ?? a.outlet?.regionName ?? "";
			const rb = b.outlet?.region?.regionName ?? b.outlet?.regionName ?? "";
			if (ra !== rb) return ra.localeCompare(rb);
		}
		const da = a.scheduledDeliveryDate ?? "";
		const db = b.scheduledDeliveryDate ?? "";
		if (da !== db) return da.localeCompare(db);
		return (a.purchaseOrderNo ?? "").localeCompare(b.purchaseOrderNo ?? "");
	});

	let lastRegion = "";
	let blockStartExcelRow = 2; // Excel rows are 1-indexed and row 1 is header.
	const subtotalExcelRows: number[] = [];

	const emitSubtotalRow = (label: string, fromRow: number, toRow: number) => {
		const subtotal: unknown[] = new Array(headers.length).fill(null);
		subtotal[2] = label;
		// Sum Ctn
		subtotal[ctnCol] = {
			f: `SUM(${colLetter(ctnCol)}${fromRow}:${colLetter(ctnCol)}${toRow})`,
		};
		for (let c = skuStartCol; c < skuEndCol; c++) {
			subtotal[c] = {
				f: `SUM(${colLetter(c)}${fromRow}:${colLetter(c)}${toRow})`,
			};
		}
		subtotal[totalCol] = {
			f: `SUM(${colLetter(totalCol)}${fromRow}:${colLetter(totalCol)}${toRow})`,
		};
		rows.push(subtotal);
	};

	for (const po of sortedPos) {
		const region =
			po.outlet?.region?.regionName ?? po.outlet?.regionName ?? "Unassigned";

		if (groupByRegion && lastRegion !== "" && region !== lastRegion) {
			const fromRow = blockStartExcelRow;
			const toRow = rows.length; // current size = excel row of the last data row
			emitSubtotalRow(`${lastRegion} Subtotal`, fromRow, toRow);
			subtotalExcelRows.push(rows.length);
			blockStartExcelRow = rows.length + 1;
		}
		lastRegion = region;

		const date = poToDate(po);
		const itemMap = poItemMap(po);
		const totalCtn = poTotalCtn(po);

		const dataRow: unknown[] = new Array(headers.length).fill(null);
		dataRow[0] = "Purchase Order";
		dataRow[1] = po.purchaseOrderNo;
		dataRow[2] = po.outlet?.outletName ?? "";
		if (includeRegionColumn) dataRow[3] = region;
		dataRow[ctnCol - 1] = date ? { v: date, t: "d", z: "dd/mm/yyyy" } : ""; // expected arrival date column (one before ctnCol)
		dataRow[ctnCol] = totalCtn || null;

		for (let i = 0; i < skuCodes.length; i++) {
			const code = skuCodes[i];
			const qty = itemMap[code] ?? 0;
			dataRow[skuStartCol + i] = qty > 0 ? qty : null;
		}

		const excelRow = rows.length + 1; // row index after we push it
		dataRow[totalCol] = {
			f: `SUM(${colLetter(skuStartCol)}${excelRow}:${colLetter(skuEndCol - 1)}${excelRow})`,
		};

		rows.push(dataRow);
	}

	// Final region subtotal (when grouping)
	if (groupByRegion && sortedPos.length > 0) {
		const fromRow = blockStartExcelRow;
		const toRow = rows.length;
		emitSubtotalRow(`${lastRegion} Subtotal`, fromRow, toRow);
		subtotalExcelRows.push(rows.length);
	}

	// Footer totals row (excludes subtotal rows so we don't double-count).
	const dataFromRow = 2;
	const dataToRow = rows.length; // last row excel-index

	const footer: unknown[] = new Array(headers.length).fill(null);
	footer[ctnCol] = {
		f: groupByRegion
			? `SUM(${colLetter(ctnCol)}${dataFromRow}:${colLetter(ctnCol)}${dataToRow})/2`
			: `SUM(${colLetter(ctnCol)}${dataFromRow}:${colLetter(ctnCol)}${dataToRow})`,
	};
	for (let c = skuStartCol; c < skuEndCol; c++) {
		footer[c] = {
			f: groupByRegion
				? `SUM(${colLetter(c)}${dataFromRow}:${colLetter(c)}${dataToRow})/2`
				: `SUM(${colLetter(c)}${dataFromRow}:${colLetter(c)}${dataToRow})`,
		};
	}
	footer[totalCol] = {
		f: groupByRegion
			? `SUM(${colLetter(totalCol)}${dataFromRow}:${colLetter(totalCol)}${dataToRow})/2`
			: `SUM(${colLetter(totalCol)}${dataFromRow}:${colLetter(totalCol)}${dataToRow})`,
	};
	footer[2] = "Grand Total";
	rows.push(footer);

	const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });

	// Auto-size columns based on header / content lengths.
	const colWidths = headers.map((h, idx) => {
		let max = String(h ?? "").length;
		for (const r of rows) {
			const cell = r[idx];
			if (cell == null) continue;
			let str: string;
			if (
				typeof cell === "object" &&
				cell !== null &&
				"v" in (cell as object)
			) {
				str = String((cell as { v: unknown }).v ?? "");
			} else {
				str = String(cell);
			}
			if (str.length > max) max = str.length;
		}
		return { wch: Math.min(Math.max(max + 2, 8), 30) };
	});
	ws["!cols"] = colWidths;

	return ws;
}

function buildWorkbook(pos: PurchaseOrder[]): XLSX.WorkBook {
	const wb = XLSX.utils.book_new();

	// Union of SKU codes across all POs (sorted).
	const skuSet = new Set<string>();
	for (const po of pos) {
		for (const item of po.items ?? []) {
			const code = normalizeSkuCode(item.skuCode);
			if (code) skuSet.add(code);
		}
	}
	const skuCodes = Array.from(skuSet).sort();

	const usedNames = new Set<string>();

	// Sheet 1: All Regions (grouped by region with subtotals)
	const allSheetName = safeSheetName("All Regions", usedNames);
	const allSheet = buildSheet({
		pos,
		skuCodes,
		includeRegionColumn: true,
		groupByRegion: true,
	});
	XLSX.utils.book_append_sheet(wb, allSheet, allSheetName);

	// Group POs by (region, date) for subsequent sheets.
	type Group = { regionName: string; date: Date; pos: PurchaseOrder[] };
	const groupMap = new Map<string, Group>();
	for (const po of pos) {
		const region =
			po.outlet?.region?.regionName ?? po.outlet?.regionName ?? "Unassigned";
		const d = poToDate(po);
		if (!d) continue;
		const key = `${region}__${d.toISOString().slice(0, 10)}`;
		const existing = groupMap.get(key);
		if (existing) existing.pos.push(po);
		else groupMap.set(key, { regionName: region, date: d, pos: [po] });
	}

	const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
		if (a.regionName !== b.regionName)
			return a.regionName.localeCompare(b.regionName);
		return a.date.getTime() - b.date.getTime();
	});

	for (const group of sortedGroups) {
		const sheetName = safeSheetName(
			`${group.regionName} ${ddmm(group.date)}`,
			usedNames,
		);
		const sheet = buildSheet({
			pos: group.pos,
			skuCodes,
			includeRegionColumn: false,
			groupByRegion: false,
		});
		XLSX.utils.book_append_sheet(wb, sheet, sheetName);
	}

	return wb;
}

/* ───────────────── Discrepancy report ───────────────── */

function buildDiscrepancyWorkbook(diff: DiffResult): XLSX.WorkBook {
	const wb = XLSX.utils.book_new();

	const mismatchRows: unknown[][] = [["PO Number", "Field", "Excel", "DB"]];

	for (const row of diff.rows) {
		if (row.status !== "mismatch") continue;
		const poDisplay = row.excel?.poNumberRaw ?? row.db?.poNumberRaw ?? row.key;
		if (row.flags.dateDiff) {
			mismatchRows.push([
				poDisplay,
				"Expected Arrival Date",
				formatDdMmYyyy(row.excel?.date ?? null),
				formatDdMmYyyy(row.db?.date ?? null),
			]);
		}
		if (row.flags.ctnDiff) {
			mismatchRows.push([
				poDisplay,
				"Ctn",
				row.excel?.ctn ?? 0,
				row.db?.ctn ?? 0,
			]);
		}
		for (const sku of row.flags.skuDiffs) {
			mismatchRows.push([poDisplay, `SKU ${sku.skuCode}`, sku.excel, sku.db]);
		}
	}

	const missingRows: unknown[][] = [
		["Side", "PO Number", "Outlet", "Date", "Ctn"],
	];
	for (const row of diff.rows) {
		if (row.status === "missingInDb" && row.excel) {
			missingRows.push([
				"Missing in DB",
				row.excel.poNumberRaw,
				row.excel.outlet,
				formatDdMmYyyy(row.excel.date),
				row.excel.ctn,
			]);
		} else if (row.status === "missingInExcel" && row.db) {
			missingRows.push([
				"Missing in Excel",
				row.db.poNumberRaw,
				row.db.outlet,
				formatDdMmYyyy(row.db.date),
				row.db.ctn,
			]);
		}
	}

	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.aoa_to_sheet(mismatchRows),
		"Mismatches",
	);
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.aoa_to_sheet(missingRows),
		"Missing",
	);

	return wb;
}

/* ───────────────── Component ───────────────── */

function MovementCrossCheckComponent() {
	const exportFromId = useId();
	const exportToId = useId();
	const compareFromId = useId();
	const compareToId = useId();

	const [exportDateFrom, setExportDateFrom] = useState("");
	const [exportDateTo, setExportDateTo] = useState("");
	const [isExporting, setIsExporting] = useState(false);

	// Compare section state
	const [files, setFiles] = useState<File[]>([]);
	const [fileMaps, setFileMaps] = useState<Array<Map<string, ExcelPoRecord>>>(
		[],
	);
	const [fileSummaries, setFileSummaries] = useState<
		Array<{
			name: string;
			poCount: number;
			sheetCount: number;
			warnings: ParseWarning[];
		}>
	>([]);
	const [excelMap, setExcelMap] = useState<Map<string, ExcelPoRecord> | null>(
		null,
	);
	const [excelWarnings, setExcelWarnings] = useState<ParseWarning[]>([]);
	const [compareDateFrom, setCompareDateFrom] = useState("");
	const [compareDateTo, setCompareDateTo] = useState("");
	const [isParsing, setIsParsing] = useState(false);
	const [isComparing, setIsComparing] = useState(false);
	const [diff, setDiff] = useState<DiffResult | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const isLoading = isExporting || isParsing || isComparing;

	/* ───── Export handler ───── */

	const handleExport = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!exportDateFrom || !exportDateTo) {
			toast.error("Please select both From and To dates.");
			return;
		}
		if (exportDateFrom > exportDateTo) {
			toast.error("From date must be on or before To date.");
			return;
		}
		setIsExporting(true);
		try {
			const pos = await fetchAllPurchaseOrdersInRange(
				exportDateFrom,
				exportDateTo,
			);
			if (pos.length === 0) {
				toast.error("No POs found in this date range.");
				return;
			}
			const wb = buildWorkbook(pos);
			XLSX.writeFile(
				wb,
				`Movement_Cross_Check_${exportDateFrom}_to_${exportDateTo}.xlsx`,
			);
			toast.success(`Exported ${pos.length} POs to Excel.`);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to generate workbook.";
			toast.error(message);
		} finally {
			setIsExporting(false);
		}
	};

	/* ───── Compare: parse uploaded files ───── */

	const handleFiles = async (incoming: FileList | null) => {
		if (!incoming || incoming.length === 0) return;
		const excelFiles = Array.from(incoming).filter((f) =>
			/\.xlsx?$|\.xlsm$/i.test(f.name),
		);
		if (excelFiles.length === 0) {
			toast.error("Only .xlsx, .xls, or .xlsm files are supported.");
			return;
		}
		setIsParsing(true);
		setDiff(null);
		try {
			const allWarnings: ParseWarning[] = [...excelWarnings];
			const newFileSummaries: typeof fileSummaries = [];
			const newFileMaps: Array<Map<string, ExcelPoRecord>> = [];
			// Start from existing combined map to preserve previously loaded files.
			const combinedMap = new Map<string, ExcelPoRecord>(excelMap ?? []);

			for (const f of excelFiles) {
				const result = await parseMovementExcel(f);
				if (!result.ok) {
					toast.error(`${f.name}: ${result.error}`);
					allWarnings.push(...result.warnings);
					continue;
				}
				let addedCount = 0;
				for (const [key, record] of result.recordsByPo) {
					if (combinedMap.has(key)) {
						allWarnings.push({
							sheet: f.name,
							message: `Duplicate PO ${record.poNumberRaw} already exists from a previously loaded file. Keeping first.`,
						});
					} else {
						combinedMap.set(key, record);
						addedCount++;
					}
				}
				newFileSummaries.push({
					name: f.name,
					poCount: addedCount,
					sheetCount: result.sheetCount,
					warnings: result.warnings,
				});
				newFileMaps.push(result.recordsByPo);
				allWarnings.push(...result.warnings);
			}

			if (combinedMap.size === 0) {
				toast.error("No PO rows found across all uploaded files.");
				return;
			}

			const updatedFiles = [...files, ...excelFiles];
			const updatedFileMaps = [...fileMaps, ...newFileMaps];
			const updatedSummaries = [...fileSummaries, ...newFileSummaries];

			setFiles(updatedFiles);
			setFileMaps(updatedFileMaps);
			setFileSummaries(updatedSummaries);
			setExcelMap(combinedMap);
			setExcelWarnings(allWarnings);

			// Auto-fill compare date range from all parsed records when empty.
			if (!compareDateFrom || !compareDateTo) {
				const allRecords = Array.from(combinedMap.values());
				const dates = allRecords
					.map((r) => r.date)
					.filter((d): d is Date => d instanceof Date);
				if (dates.length > 0) {
					const min = new Date(Math.min(...dates.map((d) => d.getTime())));
					const max = new Date(Math.max(...dates.map((d) => d.getTime())));
					if (!compareDateFrom)
						setCompareDateFrom(min.toISOString().slice(0, 10));
					if (!compareDateTo) setCompareDateTo(max.toISOString().slice(0, 10));
				}
			}
			toast.success(
				`Loaded ${excelFiles.length} file${excelFiles.length === 1 ? "" : "s"}. ${combinedMap.size} POs total.`,
			);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to parse Excel files.",
			);
		} finally {
			setIsParsing(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const removeFile = (index: number) => {
		setDiff(null);
		setHighlightedKey(null);
		const remainingFiles = files.filter((_, i) => i !== index);
		if (remainingFiles.length === 0) {
			resetCompare();
			return;
		}
		const remainingMaps = fileMaps.filter((_, i) => i !== index);
		const remainingSummaries = fileSummaries.filter((_, i) => i !== index);
		// Rebuild combined map from remaining per-file maps.
		const newCombined = new Map<string, ExcelPoRecord>();
		for (const m of remainingMaps) {
			for (const [k, v] of m) {
				if (!newCombined.has(k)) newCombined.set(k, v);
			}
		}
		// Rebuild warnings from remaining summaries only.
		const newWarnings = remainingSummaries.flatMap((s) => s.warnings);
		setFiles(remainingFiles);
		setFileMaps(remainingMaps);
		setFileSummaries(remainingSummaries);
		setExcelMap(newCombined.size > 0 ? newCombined : null);
		setExcelWarnings(newWarnings);
	};

	const resetCompare = () => {
		setFiles([]);
		setFileMaps([]);
		setFileSummaries([]);
		setExcelMap(null);
		setExcelWarnings([]);
		setDiff(null);
		setHighlightedKey(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	/* ───── Compare: run diff ───── */

	const handleCompare = async () => {
		if (!excelMap) {
			toast.error("Upload an Excel file first.");
			return;
		}
		if (!compareDateFrom || !compareDateTo) {
			toast.error("Please select both From and To dates for the DB query.");
			return;
		}
		if (compareDateFrom > compareDateTo) {
			toast.error("From date must be on or before To date.");
			return;
		}
		setIsComparing(true);
		try {
			const pos = await fetchAllPurchaseOrdersInRange(
				compareDateFrom,
				compareDateTo,
			);
			const dbMap = new Map<string, DbPoRecord>();
			for (const po of pos) {
				const rec = purchaseOrderToDbRecord(po);
				if (!rec.poNumber) continue;
				dbMap.set(rec.poNumber, rec);
			}
			const result = diffMovement(excelMap, dbMap);
			setDiff(result);
			toast.success(
				`Compared ${result.summary.total} POs (${result.summary.mismatch} mismatches, ${result.summary.missingInDb} missing in DB, ${result.summary.missingInExcel} missing in Excel).`,
			);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to compare data.",
			);
		} finally {
			setIsComparing(false);
		}
	};

	const handleDownloadDiscrepancy = () => {
		if (!diff) return;
		const wb = buildDiscrepancyWorkbook(diff);
		XLSX.writeFile(
			wb,
			`Movement_Cross_Check_Discrepancy_${compareDateFrom}_to_${compareDateTo}.xlsx`,
		);
		toast.success("Discrepancy report downloaded.");
	};

	/* ───── Quick "use export dates" helper ───── */

	const useExportDates = () => {
		if (exportDateFrom) setCompareDateFrom(exportDateFrom);
		if (exportDateTo) setCompareDateTo(exportDateTo);
	};

	const allSkuCodes = useMemo(() => diff?.skuCodes ?? [], [diff]);

	return (
		<main
			className="movement-cross-check-page container mx-auto p-6 space-y-6"
			aria-labelledby="mcc-page-title"
			aria-describedby="mcc-page-description"
			aria-busy={isLoading}
		>
			{isLoading && (
				<div
					className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
					aria-hidden="true"
				>
					<div className="absolute inset-0 bg-background/50 backdrop-blur-[3px]" />
					<div className="relative rounded-2xl border bg-card shadow-xl px-8 py-7 flex flex-col items-center gap-5 min-w-[220px]">
						<div className="flex items-end gap-[5px] h-10" aria-hidden>
							{[0, 1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="movement-cross-check-bar-wave w-[6px] rounded-full"
									style={{
										background: "var(--dashboard-accent)",
										animationDelay: `${i * 0.12}s`,
									}}
								/>
							))}
						</div>
						<div className="text-center space-y-1">
							<p
								className="text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{isExporting
									? "Generating Excel…"
									: isParsing
										? "Parsing files…"
										: "Comparing with database…"}
							</p>
							<p className="text-xs text-muted-foreground">
								This may take a moment
							</p>
						</div>
					</div>
				</div>
			)}

			<AdminPageHeader
				icon={GitCompareArrows}
				title="Movement Cross Check"
				description="Export Purchase Orders by date range and reconcile against another system's movement file."
				titleId="mcc-page-title"
				descriptionId="mcc-page-description"
			/>

			{/* ───── Section 1: Export ───── */}
			<Card className="dashboard-card" style={{ animationDelay: "0ms" }}>
				<CardHeader className="pb-3">
					<div className="flex items-center gap-2.5">
						<span
							className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold shrink-0"
							style={{ background: "var(--dashboard-accent)" }}
							aria-hidden
						>
							<FileSpreadsheet className="h-3.5 w-3.5" />
						</span>
						<CardTitle
							className="text-base font-semibold"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Export from system
						</CardTitle>
					</div>
					<CardDescription className="text-xs mt-1.5 pl-9.5">
						Generate a multi-sheet Excel workbook of all Purchase Orders in the
						selected date range. Sheet 1 lists all regions (with subtotals);
						subsequent sheets are split by region and date.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={handleExport}
						className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end"
					>
						<div className="space-y-1.5">
							<Label htmlFor={exportFromId} className="text-xs font-medium">
								From
							</Label>
							<Input
								id={exportFromId}
								type="date"
								value={exportDateFrom}
								onChange={(e) => setExportDateFrom(e.target.value)}
								disabled={isLoading}
								required
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor={exportToId} className="text-xs font-medium">
								To
							</Label>
							<Input
								id={exportToId}
								type="date"
								value={exportDateTo}
								onChange={(e) => setExportDateTo(e.target.value)}
								disabled={isLoading}
								required
							/>
						</div>
						<Button
							type="submit"
							disabled={isLoading}
							className="gap-2 text-white disabled:opacity-50"
							style={{
								background: "var(--dashboard-accent)",
								borderColor: "var(--dashboard-accent)",
							}}
						>
							<Download className="h-4 w-4" aria-hidden />
							Generate &amp; Download
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* ───── Section 2: Compare ───── */}
			<Card className="dashboard-card" style={{ animationDelay: "80ms" }}>
				<CardHeader className="pb-3">
					<div className="flex items-center gap-2.5">
						<span
							className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold shrink-0"
							style={{ background: "var(--dashboard-accent)" }}
							aria-hidden
						>
							<GitCompareArrows className="h-3.5 w-3.5" />
						</span>
						<CardTitle
							className="text-base font-semibold"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Compare with Excel
						</CardTitle>
					</div>
					<CardDescription className="text-xs mt-1.5 pl-9.5">
						Upload another system's movement file and reconcile it against the
						database. Mismatches and missing rows are highlighted side-by-side.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					{/* Loaded files list */}
					{files.length > 0 && (
						<div className="rounded-xl border bg-muted/30 overflow-hidden">
							{fileSummaries.map((summary, i) => (
								<div
									key={summary.name}
									className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
								>
									<FileText
										className="h-5 w-5 shrink-0"
										style={{ color: "var(--dashboard-accent)" }}
										aria-hidden
									/>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">
											{summary.name}
										</p>
										<p className="text-xs text-muted-foreground">
											{summary.sheetCount} sheet
											{summary.sheetCount === 1 ? "" : "s"} · {summary.poCount}{" "}
											POs
											{summary.warnings.length > 0
												? ` · ${summary.warnings.length} warning${summary.warnings.length === 1 ? "" : "s"}`
												: ""}
										</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => removeFile(i)}
										disabled={isLoading}
										aria-label={`Remove ${summary.name}`}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
							{/* Footer summary */}
							<div className="flex items-center justify-between px-4 py-2 bg-muted/40 text-xs text-muted-foreground">
								<span>
									<strong>{excelMap?.size ?? 0}</strong> POs total from{" "}
									{files.length} file{files.length === 1 ? "" : "s"}
									{excelWarnings.length > 0
										? ` · ${excelWarnings.length} warning${excelWarnings.length === 1 ? "" : "s"}`
										: ""}
								</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={resetCompare}
									disabled={isLoading}
									className="h-6 text-xs gap-1"
								>
									<X className="h-3 w-3" /> Clear all
								</Button>
							</div>
						</div>
					)}

					{/* File dropzone — always visible so more files can be added */}
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						onDragOver={(e) => {
							e.preventDefault();
							setIsDragOver(true);
						}}
						onDragLeave={() => setIsDragOver(false)}
						onDrop={(e) => {
							e.preventDefault();
							setIsDragOver(false);
							handleFiles(e.dataTransfer.files);
						}}
						data-active={isDragOver}
						disabled={isLoading}
						className="mcc-dropzone w-full rounded-xl py-10 px-4 flex flex-col items-center gap-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
					>
						<span
							className="flex h-12 w-12 items-center justify-center rounded-full text-white"
							style={{ background: "var(--dashboard-accent)" }}
							aria-hidden
						>
							<Upload className="h-5 w-5" />
						</span>
						<div className="space-y-1">
							<p
								className="text-sm font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Drop Excel files here, or click to browse
							</p>
							<p className="text-xs text-muted-foreground">
								Accepts .xlsx, .xls, .xlsm — multiple files and multi-sheet
								files supported.
							</p>
						</div>
					</button>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						className="hidden"
						accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						onChange={(e) => handleFiles(e.target.files)}
					/>

					{excelWarnings.length > 0 && (
						<div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs space-y-1">
							<div className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
								<AlertTriangle className="h-3.5 w-3.5" aria-hidden />
								Parse warnings
							</div>
							<ul className="list-disc pl-5 text-amber-900/90 dark:text-amber-200/90">
								{excelWarnings.slice(0, 5).map((w) => (
									<li key={`${w.sheet}-${w.row ?? "?"}-${w.message}`}>
										[{w.sheet}
										{w.row ? ` row ${w.row}` : ""}] {w.message}
									</li>
								))}
								{excelWarnings.length > 5 && (
									<li key="more">… and {excelWarnings.length - 5} more</li>
								)}
							</ul>
						</div>
					)}

					{/* Compare controls */}
					<div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
						<div className="space-y-1.5">
							<Label htmlFor={compareFromId} className="text-xs font-medium">
								DB query — From
							</Label>
							<Input
								id={compareFromId}
								type="date"
								value={compareDateFrom}
								onChange={(e) => setCompareDateFrom(e.target.value)}
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor={compareToId} className="text-xs font-medium">
								DB query — To
							</Label>
							<Input
								id={compareToId}
								type="date"
								value={compareDateTo}
								onChange={(e) => setCompareDateTo(e.target.value)}
								disabled={isLoading}
							/>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={useExportDates}
							disabled={isLoading || (!exportDateFrom && !exportDateTo)}
						>
							Use export dates
						</Button>
						<Button
							type="button"
							onClick={handleCompare}
							disabled={isLoading || !excelMap}
							className="gap-2 text-white disabled:opacity-50"
							style={{
								background: "var(--dashboard-accent)",
								borderColor: "var(--dashboard-accent)",
							}}
						>
							<GitCompareArrows className="h-4 w-4" aria-hidden />
							Compare
						</Button>
					</div>

					{/* Summary tiles */}
					{diff && (
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
							<SummaryTile
								label="Total POs"
								value={diff.summary.total}
								icon={BarChart3}
							/>
							<SummaryTile
								label="OK"
								value={diff.summary.ok}
								icon={CheckCircle2}
								tone="ok"
							/>
							<SummaryTile
								label="Mismatches"
								value={diff.summary.mismatch}
								icon={AlertTriangle}
								tone="warn"
							/>
							<SummaryTile
								label="Missing"
								value={diff.summary.missingInDb + diff.summary.missingInExcel}
								icon={ArrowUpRight}
								tone="warn"
							/>
						</div>
					)}

					{diff && (
						<div className="flex justify-end pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleDownloadDiscrepancy}
								className="gap-1.5"
							>
								<Download className="h-3.5 w-3.5" aria-hidden />
								Export discrepancy report
							</Button>
						</div>
					)}

					{/* Split view */}
					{diff && (
						<DiffSplitView
							diff={diff}
							skuCodes={allSkuCodes}
							highlightedKey={highlightedKey}
							onHighlight={setHighlightedKey}
						/>
					)}
				</CardContent>
			</Card>
		</main>
	);
}

/* ───────────────── Subcomponents ───────────────── */

function SummaryTile({
	label,
	value,
	icon: Icon,
	tone = "default",
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
	tone?: "default" | "ok" | "warn";
}) {
	const ringColor =
		tone === "ok"
			? "ring-emerald-500/20"
			: tone === "warn"
				? "ring-amber-500/20"
				: "ring-border";
	const iconColor =
		tone === "ok"
			? "text-emerald-600 dark:text-emerald-400"
			: tone === "warn"
				? "text-amber-600 dark:text-amber-400"
				: "text-muted-foreground";

	return (
		<div
			className={cn(
				"rounded-lg border bg-card px-3 py-2.5 flex items-center gap-3 ring-1",
				ringColor,
			)}
		>
			<span
				className={cn(
					"flex h-9 w-9 items-center justify-center rounded-md bg-muted",
					iconColor,
				)}
				aria-hidden
			>
				<Icon className="h-4 w-4" />
			</span>
			<div className="min-w-0">
				<p className="text-xs text-muted-foreground leading-tight">{label}</p>
				<p
					className="text-lg font-bold leading-none"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					{value.toLocaleString()}
				</p>
			</div>
		</div>
	);
}

function DiffSplitView({
	diff,
	skuCodes,
	highlightedKey,
	onHighlight,
}: {
	diff: DiffResult;
	skuCodes: string[];
	highlightedKey: string | null;
	onHighlight: (key: string | null) => void;
}) {
	const matchedRows = diff.rows.filter(
		(r) => r.status === "ok" || r.status === "mismatch",
	);
	const missingInDb = diff.rows.filter((r) => r.status === "missingInDb");
	const missingInExcel = diff.rows.filter((r) => r.status === "missingInExcel");

	return (
		<div className="space-y-4">
			{matchedRows.length === 0 ? (
				<div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
					No POs matched between the file and the database for this date range.
				</div>
			) : (
				<div className="rounded-xl border bg-card overflow-hidden">
					<div className="grid grid-cols-2 divide-x">
						<DiffPanelHeader title="Excel (uploaded)" />
						<DiffPanelHeader title="Database" />
					</div>
					<div className="grid grid-cols-2 divide-x max-h-[60vh] overflow-y-auto">
						<div className="divide-y">
							{matchedRows.map((row) => (
								<DiffRowCard
									key={`excel-${row.key}`}
									row={row}
									side="excel"
									skuCodes={skuCodes}
									isHighlighted={highlightedKey === row.key}
									onClick={() => onHighlight(row.key)}
								/>
							))}
						</div>
						<div className="divide-y">
							{matchedRows.map((row) => (
								<DiffRowCard
									key={`db-${row.key}`}
									row={row}
									side="db"
									skuCodes={skuCodes}
									isHighlighted={highlightedKey === row.key}
									onClick={() => onHighlight(row.key)}
								/>
							))}
						</div>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<MissingPanel
					title="Missing in DB"
					subtitle="In Excel but not in the database"
					icon={ArrowUpRight}
					rows={missingInDb}
					side="excel"
				/>
				<MissingPanel
					title="Missing in Excel"
					subtitle="In the database but not in Excel"
					icon={ArrowDownLeft}
					rows={missingInExcel}
					side="db"
				/>
			</div>
		</div>
	);
}

function DiffPanelHeader({ title }: { title: string }) {
	return (
		<div
			className="px-4 py-2 text-xs font-semibold tracking-wide uppercase bg-muted/40"
			style={{ fontFamily: "var(--dashboard-display)" }}
		>
			{title}
		</div>
	);
}

function DiffRowCard({
	row,
	side,
	skuCodes,
	isHighlighted,
	onClick,
}: {
	row: DiffRow;
	side: "excel" | "db";
	skuCodes: string[];
	isHighlighted: boolean;
	onClick: () => void;
}) {
	const rec = side === "excel" ? row.excel : row.db;
	const flags = row.flags;

	if (!rec) {
		return (
			<button
				type="button"
				className={cn(
					"w-full text-left px-4 py-3 text-xs text-muted-foreground italic hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					isHighlighted && "bg-muted/40 mcc-row-flash",
				)}
				onClick={onClick}
			>
				— missing —
			</button>
		);
	}

	const skuMap = new Map(row.flags.skuDiffs.map((s) => [s.skuCode, s]));
	const otherRec = side === "excel" ? row.db : row.excel;

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"w-full text-left px-4 py-3 text-xs hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-none",
				isHighlighted && "bg-muted/40 mcc-row-flash",
			)}
		>
			<div className="flex items-center gap-2 flex-wrap mb-1.5">
				<span className="font-mono font-semibold">
					{rec.poNumberRaw || rec.poNumber}
				</span>
				{row.status === "mismatch" && (
					<Badge
						variant="outline"
						className="border-amber-500/40 text-amber-700 dark:text-amber-400 text-[10px] py-0 h-4"
					>
						Mismatch
					</Badge>
				)}
				{row.status === "ok" && (
					<Badge
						variant="outline"
						className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[10px] py-0 h-4"
					>
						OK
					</Badge>
				)}
			</div>
			<dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
				<dt className="text-muted-foreground">Outlet</dt>
				<dd>
					{rec.outlet || <span className="text-muted-foreground">—</span>}
				</dd>
				<dt className="text-muted-foreground">Expected Delivery</dt>
				<dd
					className={cn(
						flags.dateDiff &&
							"bg-destructive/15 text-destructive rounded px-1 -mx-1",
					)}
				>
					{formatDdMmYyyy(rec.date) || (
						<span className="text-muted-foreground">—</span>
					)}
					{rec.date && (
						<span className="block text-[10px] text-muted-foreground/60 font-mono mt-0.5">
							{rec.date.toISOString()} (ts:{rec.date.getTime()})
						</span>
					)}
				</dd>
				<dt className="text-muted-foreground">Ctn</dt>
				<dd
					className={cn(
						"font-mono",
						flags.ctnDiff &&
							"bg-destructive/15 text-destructive rounded px-1 -mx-1",
					)}
				>
					{rec.ctn}
				</dd>
			</dl>
			{skuCodes.length > 0 && (
				<div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1">
					{skuCodes.map((sku) => {
						const qty = rec.items[sku] ?? 0;
						const otherQty = otherRec?.items[sku] ?? 0;
						const isDiff = skuMap.has(sku);
						if (qty === 0 && otherQty === 0) return null;
						return (
							<div
								key={sku}
								className={cn(
									"flex items-center justify-between rounded px-1.5 py-0.5 border text-[10px] font-mono gap-1",
									isDiff
										? "bg-destructive/15 text-destructive border-destructive/30"
										: "bg-muted/60 border-transparent text-muted-foreground",
								)}
							>
								<span className="truncate">{sku}</span>
								<span className="font-semibold">{qty}</span>
							</div>
						);
					})}
				</div>
			)}
		</button>
	);
}

function MissingPanel({
	title,
	subtitle,
	icon: Icon,
	rows,
	side,
}: {
	title: string;
	subtitle: string;
	icon: React.ComponentType<{ className?: string }>;
	rows: DiffRow[];
	side: "excel" | "db";
}) {
	return (
		<div className="rounded-xl border bg-card overflow-hidden">
			<div className="px-4 py-2.5 bg-muted/40 flex items-center gap-2.5">
				<Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
				<div>
					<p
						className="text-sm font-semibold leading-none"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						{title}
					</p>
					<p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
				</div>
				<Badge variant="secondary" className="ml-auto">
					{rows.length}
				</Badge>
			</div>
			{rows.length === 0 ? (
				<p className="px-4 py-4 text-xs text-muted-foreground italic">
					Nothing missing on this side.
				</p>
			) : (
				<ul className="divide-y max-h-[40vh] overflow-y-auto">
					{rows.map((r) => {
						const rec = side === "excel" ? r.excel : r.db;
						if (!rec) return null;
						const skuEntries = Object.entries(rec.items).sort(([a], [b]) =>
							a.localeCompare(b),
						);
						return (
							<li key={r.key} className="px-4 py-2 text-xs">
								<div className="flex items-baseline gap-2 flex-wrap">
									<span className="font-mono font-semibold">
										{rec.poNumberRaw || rec.poNumber}
									</span>
									<span className="text-muted-foreground">{rec.outlet}</span>
									<span className="text-muted-foreground ml-auto">
										Expected Delivery: {formatDdMmYyyy(rec.date) || "—"}
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Ctn: <span className="font-mono">{rec.ctn}</span>
								</p>
								{skuEntries.length > 0 && (
									<div className="mt-1.5 flex flex-wrap gap-1">
										{skuEntries.map(([sku, qty]) => (
											<span
												key={sku}
												className="bg-muted/60 rounded px-1.5 py-0.5 text-[10px] font-mono"
											>
												{sku}: {qty}
											</span>
										))}
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
