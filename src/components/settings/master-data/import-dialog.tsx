import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { read, utils, writeFile } from "xlsx";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CalendarDays } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	CREATE_SKUS_MUTATION,
	SKUS_QUERY,
	type CreateSkusMutationData,
	type CreateSkusMutationVariables,
	type SkusQueryData,
	type SkusQueryVariables,
} from "@/lib/graphql/skus";
import {
	CREATE_RACK_MUTATION,
	RACKS_QUERY,
	type CreateRackMutationData,
	type CreateRackMutationVariables,
	type RacksQueryData,
	type RacksQueryVariables,
} from "@/lib/graphql/racks";
import {
	AREAS_QUERY,
	type AreasQueryData,
} from "@/lib/graphql/areas";
import {
	WAREHOUSES_QUERY,
	type WarehousesQueryData,
} from "@/lib/graphql/warehouses";
import { formatLevel } from "@/components/racks/rack-form-dialog";
import {
	STOCK_UNITS_QUERY,
	CREATE_STOCK_UNIT_MUTATION,
	type CreateStockUnitMutationData,
	type CreateStockUnitMutationVariables,
	type StockUnitsQueryData,
	type StockUnitsQueryVariables,
} from "@/lib/graphql/stock-units";
import { excelSerialToDateString } from "@/lib/utils";

export type ImportMode = "skus" | "racks";

/** Matches /admin/items table column order (importable fields only). */
export const ITEMS_IMPORT_HEADERS = [
	"SKU Code",
	"Description",
	"Barcode",
	"Brand",
	"Category",
	"Manufacturer",
	"Status",
	"Case Rate",
	"Case Ext Length (mm)",
	"Case Ext Width (mm)",
	"Case Ext Height (mm)",
	"Case Gross Weight (kg)",
	"Cases Per Layer",
	"No Of Layers",
] as const;

/** Parsed Items-import row fields shown in preview / validation / error report. */
export interface ItemsImportPreviewFields {
	barcode: string;
	brand: string;
	category: string;
	manufacturer: string;
	isActive: boolean;
	caseRate: number | null;
	caseExtLengthMm: number | null;
	caseExtWidthMm: number | null;
	caseExtHeightMm: number | null;
	caseGrossWeightKg: number | null;
	casesPerLayer: number | null;
	noOfLayers: number | null;
}

/** Matches /admin/racks table column order. Description & Last Count Date are display-only. */
export const RACKS_IMPORT_HEADERS = [
	"Code",
	"Barcode",
	"Description",
	"Storage Row",
	"Storage Bay",
	"Level",
	"Storage Type",
	"Length (mm)",
	"Width (mm)",
	"Height (mm)",
	"Weight (kg)",
	"Max Pallets",
	"Location",
	"Status",
	"Last Count Date",
] as const;

/** Rack page columns with no CreateRackInput field — present in template for table alignment. */
export const RACKS_NON_IMPORTABLE_HEADERS = [
	"Description",
	"Last Count Date",
] as const;

const STORAGE_TYPE_TO_BIN_TYPE: Record<string, string> = {
	PICK_FACE: "PICK_FACE",
	RESERVE_STORAGE: "RESERVE",
	BULK_STORAGE: "BULK",
};

function mapStorageToBinType(storageType: string): string {
	const upper = storageType.trim().toUpperCase();
	if (["FIXED", "PICK_FACE", "RESERVE", "BULK"].includes(upper)) return upper;
	return (
		STORAGE_TYPE_TO_BIN_TYPE[upper] ??
		(upper.includes("RESERVE") ? "RESERVE" : upper.includes("BULK") ? "BULK" : "FIXED")
	);
}

function parseStorageBay(value: string, rackRow: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (trimmed.includes("-") && rackRow) {
		const prefix = `${rackRow}-`;
		if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
			return trimmed.slice(prefix.length);
		}
		const parts = trimmed.split("-");
		return parts[parts.length - 1]?.trim() ?? trimmed;
	}
	return trimmed;
}

function parseOptionalNumericString(value: string): string | null {
	const trimmed = value.trim();
	return trimmed || null;
}

function rackLocationDescription(parts: {
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
}): string {
	return `${parts.rackRow}-${parts.rackColumn}-${formatLevel(parts.rackLevel)}`;
}

interface ImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: ImportMode;
	skuFormat?: "default" | "items";
	createdBy: string;
	onImported?: () => void;
}

type PreviewRow =
	| {
			rowNumber: number;
			data: {
				skuCode: string;
				skuDescription: string;
				skuQuantity: string;
				skuUomLabel: string;
				pickingStrategy: string;
				skuExpiryDate: string;
				itemsImport?: ItemsImportPreviewFields;
			};
			errors: string[];
			skuPayload?: CreateSkusMutationVariables["input"];
	  }
	| {
			rowNumber: number;
			data: {
				rackRow: string;
				rackColumn: string;
				rackLevel: string;
				binCode?: string;
				barCode?: string;
				binType?: string;
				length?: string;
				width?: string;
				height?: string;
				weight?: string;
				maxPallet?: string;
				location?: string;
				isActive?: boolean;
			};
			errors: string[];
			rackPayload?: CreateRackMutationVariables["input"];
	  };

function isSkuRow(
	row: PreviewRow,
): row is Extract<
	PreviewRow,
	{ skuPayload?: CreateSkusMutationVariables["input"] }
> {
	return "skuPayload" in row;
}

function formatItemsImportCell(value: string | number | null | undefined): string {
	if (value == null || value === "") return "";
	return String(value);
}

function formatItemsImportStatus(isActive: boolean): string {
	return isActive ? "Active" : "Inactive";
}

function itemsImportPreviewValues(
	row: Extract<PreviewRow, { skuPayload?: CreateSkusMutationVariables["input"] }>,
): string[] {
	const fields = row.data.itemsImport;
	const payload = row.skuPayload;
	return [
		row.data.skuCode,
		row.data.skuDescription,
		formatItemsImportCell(fields?.barcode ?? payload?.barcode),
		formatItemsImportCell(fields?.brand ?? payload?.brand),
		formatItemsImportCell(fields?.category ?? payload?.category),
		formatItemsImportCell(fields?.manufacturer ?? payload?.manufacturer),
		formatItemsImportStatus(
			fields?.isActive ?? (payload?.isActive !== false),
		),
		formatItemsImportCell(fields?.caseRate ?? payload?.caseRate),
		formatItemsImportCell(fields?.caseExtLengthMm ?? payload?.caseExtLengthMm),
		formatItemsImportCell(fields?.caseExtWidthMm ?? payload?.caseExtWidthMm),
		formatItemsImportCell(fields?.caseExtHeightMm ?? payload?.caseExtHeightMm),
		formatItemsImportCell(fields?.caseGrossWeightKg ?? payload?.caseGrossWeightKg),
		formatItemsImportCell(fields?.casesPerLayer ?? payload?.casesPerLayer),
		formatItemsImportCell(fields?.noOfLayers ?? payload?.noOfLayers),
	];
}

function normalize(value: unknown): string {
	return String(value ?? "").trim();
}

function normalizeKey(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function rowToHeaders(row: Record<string, unknown>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(row).map(([k, v]) => [normalizeKey(k), normalize(v)]),
	);
}

function parseDate(value: string): string {
	if (!value.trim()) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} 00:00:00.000000`;
}

function parseExcelDateInput(value: string): { display: string; db: string } {
	const trimmed = value.trim();
	if (!trimmed) return { display: "", db: "" };

	const asNumber = Number(trimmed);
	const normalizedDate = Number.isNaN(asNumber)
		? trimmed
		: excelSerialToDateString(asNumber);
	const db = parseDate(normalizedDate);
	if (!db) return { display: trimmed, db: "" };
	return { display: db.slice(0, 10), db };
}

function parseBinCode(binCode: string): {
	rackRow: string;
	rackLevel: string;
	rackColumn: string;
} | null {
	const parts = binCode.trim().split("-");
	if (parts.length !== 3) return null;
	const [rackRow, rackLevel, rackColumn] = parts.map((part) => part.trim());
	if (!rackRow || !rackLevel || !rackColumn) return null;
	return { rackRow, rackLevel, rackColumn };
}

function downloadErrorReport(
	mode: ImportMode,
	rows: PreviewRow[],
	skuFormat: "default" | "items" = "default",
) {
	const failed = rows.filter((row) => row.errors.length > 0);
	if (failed.length === 0) return;
	const sheetData =
		mode === "skus"
			? skuFormat === "items"
				? [
						["Row", ...ITEMS_IMPORT_HEADERS, "Errors"],
						...failed.map((row) => [
							row.rowNumber,
							...itemsImportPreviewValues(
								row as Extract<
									PreviewRow,
									{ skuPayload?: CreateSkusMutationVariables["input"] }
								>,
							),
							row.errors.join("; "),
						]),
					]
				: [
						[
							"Row",
							"SKU Code",
							"Description",
							"Quantity",
							"Unit of Measure",
							"Picking Strategy",
							"Expiry Date",
							"Errors",
						],
						...failed.map((row) => {
							const data = row.data as Extract<
								PreviewRow,
								{ skuPayload?: unknown }
							>["data"];
							return [
								row.rowNumber,
								data.skuCode,
								data.skuDescription,
								data.skuQuantity,
								data.skuUomLabel,
								data.pickingStrategy,
								data.skuExpiryDate,
								row.errors.join("; "),
							];
						}),
					]
			: [
					["Row", ...RACKS_IMPORT_HEADERS, "Errors"],
					...failed.map((row) => {
						const data = row.data as Extract<
							PreviewRow,
							{ rackPayload?: unknown }
						>["data"];
						return [
							row.rowNumber,
							data.binCode ?? "",
							data.barCode ?? "",
							"",
							data.rackRow,
							data.rackColumn,
							data.rackLevel,
							data.binType ?? "",
							data.length ?? "",
							data.width ?? "",
							data.height ?? "",
							data.weight ?? "",
							data.maxPallet ?? "",
							data.location ?? "",
							data.isActive === undefined
								? ""
								: data.isActive
									? "ACTIVE"
									: "INACTIVE",
							"",
							row.errors.join("; "),
						];
					}),
				];

	const worksheet = utils.aoa_to_sheet(sheetData);
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, worksheet, "Import Errors");
	writeFile(workbook, `${mode}-import-errors.xlsx`);
}

export function ImportDialog({
	open,
	onOpenChange,
	mode,
	skuFormat = "default",
	createdBy,
	onImported,
}: ImportDialogProps) {
	const [fileName, setFileName] = useState("");
	const [rows, setRows] = useState<PreviewRow[]>([]);
	const [isParsing, setIsParsing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [processedCount, setProcessedCount] = useState(0);
	const [isStockTakeFormat, setIsStockTakeFormat] = useState(false);
	const [isStorageBinFormat, setIsStorageBinFormat] = useState(false);
	const [newRacksToCreate, setNewRacksToCreate] = useState<
		CreateRackMutationVariables["input"][]
	>([]);
	const [newUomsToCreate, setNewUomsToCreate] = useState<string[]>([]);

	const { data: stockUnitsData } = useQuery({
		queryKey: qk.stockUnits.all,
		queryFn: () =>
			gqlRequest<StockUnitsQueryData, StockUnitsQueryVariables>(
				STOCK_UNITS_QUERY,
				{},
			),
		enabled: mode === "skus" && open,
	});

	const { data: racksData } = useQuery({
		queryKey: [...qk.racks.all, { pageSize: 5000, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<RacksQueryData, RacksQueryVariables>(RACKS_QUERY, {
				pageSize: 5000,
				pageNumber: 1,
			}),
		enabled: open,
	});

	const { data: areasData } = useQuery({
		queryKey: [...qk.areas.all, "import-dialog"],
		queryFn: () =>
			gqlRequest<AreasQueryData>(AREAS_QUERY, { pageSize: 500, pageNumber: 1 }),
		enabled: mode === "racks" && open,
	});

	const { data: warehousesData } = useQuery({
		queryKey: [...qk.warehouses.all, "import-dialog"],
		queryFn: () =>
			gqlRequest<WarehousesQueryData>(WAREHOUSES_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
		enabled: mode === "racks" && open,
	});

	const { data: skusData, isLoading: skusLoading } = useQuery({
		queryKey: qk.skus.all,
		queryFn: () => gqlRequest<SkusQueryData, SkusQueryVariables>(SKUS_QUERY, {}),
		enabled: mode === "skus" && open,
		staleTime: 0,
		gcTime: 0,
	});

	const { mutateAsync: createSku } = useMutation({
		mutationFn: (variables: CreateSkusMutationVariables) =>
			gqlRequest<CreateSkusMutationData, CreateSkusMutationVariables>(
				CREATE_SKUS_MUTATION,
				variables,
			),
	});

	const { mutateAsync: createRack } = useMutation({
		mutationFn: (variables: CreateRackMutationVariables) =>
			gqlRequest<CreateRackMutationData, CreateRackMutationVariables>(
				CREATE_RACK_MUTATION,
				variables,
			),
	});
	const { mutateAsync: createStockUnit } = useMutation({
		mutationFn: (variables: CreateStockUnitMutationVariables) =>
			gqlRequest<CreateStockUnitMutationData, CreateStockUnitMutationVariables>(
				CREATE_STOCK_UNIT_MUTATION,
				variables,
			),
	});

	const validRows = useMemo(
		() =>
			rows.filter((row) => {
				if (mode === "skus" && isStockTakeFormat) {
					return row.errors.length === 0;
				}
				return mode === "skus"
					? Boolean(
							(row as Extract<PreviewRow, { skuPayload?: unknown }>).skuPayload,
						)
					: Boolean(
							(row as Extract<PreviewRow, { rackPayload?: unknown }>)
								.rackPayload,
						);
			}),
		[rows, mode, isStockTakeFormat],
	);

	const progress = validRows.length
		? Math.round((processedCount / validRows.length) * 100)
		: 0;

	function downloadTemplate() {
		const headers =
			mode === "skus"
				? skuFormat === "items"
					? [Array.from(ITEMS_IMPORT_HEADERS)]
					: [
							[
								"SKU Code",
								"Description",
								"Quantity",
								"Unit of Measure",
								"Picking Strategy",
								"Expiry Date",
							],
						]
				: [Array.from(RACKS_IMPORT_HEADERS)];
		const worksheet = utils.aoa_to_sheet(headers);
		const workbook = utils.book_new();
		utils.book_append_sheet(workbook, worksheet, "Template");
		writeFile(workbook, `${mode}-import-template.xlsx`);
	}

	function parseSkuRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		const stockUnits = stockUnitsData?.stockUnits.query ?? [];
		const defaultStockUnitId =
			stockUnits.find(
				(u) =>
					u.isActive &&
					(u.unitCode?.trim().toLowerCase() === "ctn" ||
						u.unitName?.trim().toLowerCase() === "ctn"),
			)?.stockUnitId ??
			stockUnits.find((u) => u.isActive)?.stockUnitId ??
			stockUnits[0]?.stockUnitId;
		const uomLookup = new Map(
			stockUnits.map((unit) => [
				normalizeKey(`${unit.unitName} ${unit.unitCode}`),
				unit.stockUnitId,
			]),
		);
		for (const unit of stockUnits) {
			uomLookup.set(normalizeKey(unit.unitName), unit.stockUnitId);
			uomLookup.set(normalizeKey(unit.unitCode), unit.stockUnitId);
		}

		const firstHeaders = rowToHeaders(rawRows[0] ?? {});
		const stockTakeFormat =
			Boolean(firstHeaders["item code"]) ||
			Boolean(firstHeaders["storage bin code"]) ||
			Boolean(firstHeaders["loose uom"]);
		setIsStockTakeFormat(stockTakeFormat);

		if (stockTakeFormat) {
			const existingRackKeys = new Set(
				(racksData?.racks.query ?? []).map((rack) =>
					normalizeKey(`${rack.rackRow}|${rack.rackColumn}|${rack.rackLevel}`),
				),
			);
			const newRackMap = new Map<
				string,
				CreateRackMutationVariables["input"]
			>();
			const newUomSet = new Set<string>();
			const aggregate = new Map<
				string,
				{
					skuCode: string;
					skuDescription: string;
					skuQuantity: number;
					skuUomLabel: string;
				}
			>();

			for (const rawRow of rawRows) {
				const headers = rowToHeaders(rawRow);
				const binCode = headers["storage bin code"] ?? "";
				const skuCodeRaw =
					headers["item code"] ?? headers["sku code"] ?? headers.code ?? "";
				const skuCode = skuCodeRaw.replace(/\s*\(f\)\s*$/i, "").trim();
				const skuDescription = headers.description ?? "";
				const quantityRaw = headers["unit qty"] ?? headers.quantity ?? "";
				const skuUomLabel =
					headers["loose uom"] ??
					headers["unit of measure"] ??
					headers.uom ??
					headers.unit ??
					"";

				const isSubtotalRow =
					!skuCode &&
					(!quantityRaw || String(quantityRaw).trim().startsWith("="));
				if (isSubtotalRow) continue;
				if (!skuCode) continue;

				const qty = Number(quantityRaw);
				if (!Number.isNaN(qty)) {
					const key = skuCode.toLowerCase();
					const current = aggregate.get(key);
					if (current) {
						current.skuQuantity += qty;
						if (!current.skuDescription && skuDescription) {
							current.skuDescription = skuDescription;
						}
						if (!current.skuUomLabel && skuUomLabel) {
							current.skuUomLabel = skuUomLabel;
						}
					} else {
						aggregate.set(key, {
							skuCode,
							skuDescription,
							skuQuantity: qty,
							skuUomLabel,
						});
					}
				}

				if (binCode) {
					const parsedBin = parseBinCode(binCode);
					if (parsedBin) {
						const rackKey = normalizeKey(
							`${parsedBin.rackRow}|${parsedBin.rackColumn}|${parsedBin.rackLevel}`,
						);
						if (!existingRackKeys.has(rackKey) && !newRackMap.has(rackKey)) {
							newRackMap.set(rackKey, {
								rackRow: parsedBin.rackRow,
								rackColumn: parsedBin.rackColumn,
								rackLevel: parsedBin.rackLevel,
								createdBy,
								updatedBy: createdBy,
							});
						}
					}
				}

				if (skuUomLabel && !uomLookup.has(normalizeKey(skuUomLabel))) {
					newUomSet.add(skuUomLabel);
				}
			}

			setNewRacksToCreate(Array.from(newRackMap.values()));
			setNewUomsToCreate(Array.from(newUomSet.values()));

			return Array.from(aggregate.values()).map((item, index) => {
				const errors: string[] = [];
				if (!item.skuCode) errors.push("SKU Code is required");
				if (!item.skuDescription) errors.push("Description is required");
				if (Number.isNaN(item.skuQuantity)) {
					errors.push("Quantity must be a number");
				} else if (item.skuQuantity < 0) {
					errors.push("Quantity must be >= 0");
				}
				if (!item.skuUomLabel) errors.push("Unit of Measure is required");
				const stockUnitId = uomLookup.get(normalizeKey(item.skuUomLabel));

				return {
					rowNumber: index + 2,
					data: {
						skuCode: item.skuCode,
						skuDescription: item.skuDescription,
						skuQuantity: String(item.skuQuantity),
						skuUomLabel: item.skuUomLabel,
						pickingStrategy: "FIFO",
						skuExpiryDate: "",
					},
					errors,
					skuPayload:
						errors.length === 0 && stockUnitId
							? {
									skuCode: item.skuCode,
									skuDescription: item.skuDescription,
									skuExpiryDate: "",
									skuSuppliers: [],
									skuUom: stockUnitId,
									pickingStrategy: "FIFO",
									isActive: true,
									initialOnHandQty: item.skuQuantity,
								}
							: undefined,
				};
			});
		}

		if (skuFormat === "items") {
			// Detect item_excel format: has DESC_01 / RETRIEVAL / BATCH_SERIAL_CONTROL headers
			const firstHeaders = rowToHeaders(rawRows[0] ?? {});
			const isItemExcelFormat =
				Boolean(firstHeaders["desc 01"]) ||
				Boolean(firstHeaders["retrieval"]) ||
				Boolean(firstHeaders["batch serial control"]);

			const mapRetrieval = (v: string): string => {
				const u = v.trim().toUpperCase();
				if (u.includes("EXPIRED") || u === "FEFO") return "FEFO";
				if (u.includes("LAST") || u === "LIFO") return "LIFO";
				return "FIFO";
			};

			const mapBatchControl = (v: string): { isExpiryControlled: boolean; isLotControlled: boolean } => {
				const u = v.trim().toUpperCase();
				if (u === "BOTH") return { isExpiryControlled: true, isLotControlled: true };
				if (u === "LOT_CONTROL_ONLY") return { isExpiryControlled: false, isLotControlled: true };
				if (u === "EXPIRY_CONTROL_ONLY") return { isExpiryControlled: true, isLotControlled: false };
				return { isExpiryControlled: false, isLotControlled: false };
			};

			return rawRows.map((row, index) => {
				const headers = rowToHeaders(row);
				const skuCode =
					headers["sku code"] ?? headers.code ?? headers["item code"] ?? "";
				const skuDescription = isItemExcelFormat
					? (headers["desc 01"] ?? headers.description ?? "")
					: (headers.description ?? "");
				const barcode = isItemExcelFormat
					? (headers["unit barcode"] ?? headers.barcode ?? "")
					: (headers.barcode ?? "");
				const brand = headers.brand ?? "";
				const category = headers.category ?? "";
				const manufacturer = headers.manufacturer ?? "";
				const statusRaw = (headers.status ?? "active").toLowerCase();
				const isActive = !["inactive", "0", "false", "no"].includes(statusRaw);
				const parseNum = (v: string) => {
					const t = v.trim();
					if (!t || t === "0" || t === "0.0") return null;
					const n = Number(t);
					return Number.isNaN(n) ? null : n;
				};
				const caseRate = parseNum(headers["case rate"] ?? "");
				const caseExtLengthMm = parseNum(headers["case ext length mm"] ?? "");
				const caseExtWidthMm =
					parseNum(headers["case ext width mm"] ?? "") ??
					parseNum(headers["case ext width ((mm"] ?? "");
				const caseExtHeightMm = parseNum(headers["case ext height mm"] ?? "");
				const caseGrossWeightKg = parseNum(headers["case gross weight kg"] ?? "");
				const casesPerLayer = parseNum(headers["cases per layer"] ?? "");
				const noOfLayers = parseNum(headers["no of layers"] ?? "");

				// item_excel-specific fields
				const pickingStrategy = isItemExcelFormat
					? mapRetrieval(headers["retrieval"] ?? "")
					: "FIFO";
				const { isExpiryControlled, isLotControlled } = isItemExcelFormat
					? mapBatchControl(headers["batch serial control"] ?? "")
					: { isExpiryControlled: false, isLotControlled: false };

				// UOM: item_excel uses CASE_UOM column; fall back to default CTN
				const caseUomLabel = isItemExcelFormat
					? (headers["case uom"] ?? headers["unit uom"] ?? "")
					: "";
				const resolvedUomId = caseUomLabel
					? (uomLookup.get(normalizeKey(caseUomLabel)) ?? defaultStockUnitId)
					: defaultStockUnitId;

				const errors: string[] = [];
				if (!skuCode) errors.push("SKU Code is required");
				if (!skuDescription) errors.push("Description is required");
				if (!resolvedUomId) errors.push("No stock unit available (expected CTN)");

				const payload =
					errors.length === 0 && resolvedUomId
						? {
								skuCode,
								skuDescription,
								skuExpiryDate: "",
								skuSuppliers: [],
								skuUom: resolvedUomId,
								pickingStrategy,
								isActive,
								barcode: barcode || null,
								brand: brand || null,
								category: category || null,
								manufacturer: manufacturer || null,
								caseRate,
								caseExtLengthMm,
								caseExtWidthMm,
								caseExtHeightMm,
								caseGrossWeightKg,
								casesPerLayer,
								noOfLayers,
							}
						: undefined;

				return {
					rowNumber: index + 2,
					data: {
						skuCode,
						skuDescription,
						skuQuantity: "",
						skuUomLabel: caseUomLabel || "CTN",
						pickingStrategy,
						skuExpiryDate: "",
						itemsImport: {
							barcode,
							brand,
							category,
							manufacturer,
							isActive,
							caseRate,
							caseExtLengthMm,
							caseExtWidthMm,
							caseExtHeightMm,
							caseGrossWeightKg,
							casesPerLayer,
							noOfLayers,
						},
					},
					errors,
					skuPayload: payload,
				};
			});
		}

		setNewRacksToCreate([]);
		setNewUomsToCreate([]);

		const counts = new Map<string, number>();
		for (const row of rawRows) {
			const headers = rowToHeaders(row);
			const skuCode = headers["sku code"] ?? headers.code ?? "";
			if (!skuCode) continue;
			counts.set(
				skuCode.toLowerCase(),
				(counts.get(skuCode.toLowerCase()) ?? 0) + 1,
			);
		}

		return rawRows.map((row, index) => {
			const headers = rowToHeaders(row);
			const skuCode =
				headers["sku code"] ?? headers["item code"] ?? headers.code ?? "";
			const skuDescription = headers.description ?? "";
			const skuQuantity = headers.quantity ?? headers["unit qty"] ?? "";
			const skuUomLabel =
				headers["unit of measure"] ??
				headers["loose uom"] ??
				headers.uom ??
				headers.unit ??
				"";
			const pickingStrategy =
				(headers["picking strategy"] ?? "FIFO").toUpperCase().trim() || "FIFO";
			const expiryInput = headers["expiry date"] ?? "";
			const expiry = parseExcelDateInput(expiryInput);

			const errors: string[] = [];
			if (!skuCode) errors.push("SKU Code is required");
			if (!skuDescription) errors.push("Description is required");
			if (!skuQuantity || Number.isNaN(Number(skuQuantity))) {
				errors.push("Quantity must be a number");
			} else if (Number(skuQuantity) < 0) {
				errors.push("Quantity must be >= 0");
			}
			if (!skuUomLabel) {
				errors.push("Unit of Measure is required");
			}
			if (
				pickingStrategy &&
				!["FIFO", "LIFO", "FEFO"].includes(pickingStrategy)
			) {
				errors.push("Picking Strategy must be FIFO, LIFO, or FEFO");
			}
			if (expiryInput && !expiry.db) {
				errors.push("Expiry Date is invalid");
			}
			if ((counts.get(skuCode.toLowerCase()) ?? 0) > 1) {
				errors.push("Duplicate SKU Code in file");
			}
			const stockUnitId = uomLookup.get(normalizeKey(skuUomLabel));
			if (skuUomLabel && !stockUnitId) {
				errors.push("Unit of Measure not found");
			}

			const payload =
				errors.length === 0 && stockUnitId
					? {
							skuCode,
							skuDescription,
							skuExpiryDate: expiry.db,
							skuSuppliers: [],
							skuUom: stockUnitId,
							pickingStrategy,
							isActive: true,
							initialOnHandQty: Number(skuQuantity),
						}
					: undefined;

			return {
				rowNumber: index + 2,
				data: {
					skuCode,
					skuDescription,
					skuQuantity,
					skuUomLabel,
					pickingStrategy,
					skuExpiryDate: expiry.display,
				},
				errors,
				skuPayload: payload,
			};
		});
	}

	function parseRackRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		const existingKeys = new Set(
			(racksData?.racks.query ?? []).map((rack) =>
				normalizeKey(`${rack.rackRow}|${rack.rackColumn}|${rack.rackLevel}`),
			),
		);
		const inFileKeys = new Map<string, number>();
		const areas = areasData?.areas?.query ?? [];
		const warehouses = warehousesData?.warehouses?.query ?? [];

		const firstHeaders = Object.fromEntries(
			Object.entries(rawRows[0] ?? {}).map(([k]) => [normalizeKey(k), true]),
		);
		const isPageFormat = Boolean(
			firstHeaders["storage row"] || firstHeaders["storage bay"],
		);
		const isBinFormat = Boolean(
			firstHeaders["code"] || firstHeaders["bay"] || isPageFormat,
		);
		setIsStorageBinFormat(isBinFormat);

		return rawRows.map((row, index) => {
			const headers: Record<string, string> = Object.fromEntries(
				Object.entries(row).map(([k, v]) => [normalizeKey(k), normalize(v)]),
			);

			let rackRow: string;
			let rackColumn: string;
			let rackLevel: string;
			let binCode: string | undefined;
			let barCode: string | undefined;
			let binType: string | undefined;
			let length: string | undefined;
			let width: string | undefined;
			let height: string | undefined;
			let weight: string | undefined;
			let maxPallet: string | undefined;
			let location: string | undefined;
			let isActive: boolean | undefined;
			let areaId: string | null | undefined;
			let warehouseId: string | null | undefined;

			if (isPageFormat) {
				rackRow = headers["storage row"] ?? headers["row"] ?? "";
				const bayRaw =
					headers["storage bay"] ?? headers["bay"] ?? headers["column"] ?? "";
				rackLevel = headers["level"] ?? "";
				rackColumn = parseStorageBay(bayRaw, rackRow);
				binCode = headers["code"] || undefined;
				barCode = headers["barcode"] || undefined;
				const storageType =
					headers["storage type"] ??
					headers["storage_type"] ??
					headers["storagetype"] ??
					"";
				binType = storageType ? mapStorageToBinType(storageType) : "FIXED";
				length = parseOptionalNumericString(headers["length mm"] ?? "") ?? undefined;
				width = parseOptionalNumericString(headers["width mm"] ?? "") ?? undefined;
				height = parseOptionalNumericString(headers["height mm"] ?? "") ?? undefined;
				weight = parseOptionalNumericString(headers["weight kg"] ?? "") ?? undefined;
				maxPallet =
					parseOptionalNumericString(headers["max pallets"] ?? "") ?? undefined;
				location = headers["location"] || undefined;
				const statusRaw = (headers["status"] ?? "active").trim().toUpperCase();
				isActive = statusRaw !== "INACTIVE";
			} else if (isBinFormat) {
				rackRow = headers["row"] ?? headers["storage row"] ?? "";
				const bayRaw = headers["bay"] ?? headers["storage bay"] ?? "";
				rackColumn = parseStorageBay(bayRaw, rackRow);
				rackLevel = headers["level"] ?? "";
				binCode = headers["code"] || undefined;
				barCode = headers["barcode"] || undefined;
				const storageType =
					headers["storage type"] ??
					headers["storage_type"] ??
					headers["storagetype"] ??
					"";
				binType = storageType ? mapStorageToBinType(storageType) : "FIXED";
				length = parseOptionalNumericString(headers["length mm"] ?? "") ?? undefined;
				width = parseOptionalNumericString(headers["width mm"] ?? "") ?? undefined;
				height = parseOptionalNumericString(headers["height mm"] ?? "") ?? undefined;
				weight = parseOptionalNumericString(headers["weight kg"] ?? "") ?? undefined;
				maxPallet =
					parseOptionalNumericString(headers["max pallets"] ?? "") ?? undefined;
				location = headers["location"] || undefined;
				const statusRaw = (headers["status"] ?? "active").trim().toUpperCase();
				isActive = statusRaw !== "INACTIVE";
			} else {
				rackRow = headers["row"] ?? "";
				rackColumn = headers["column"] ?? "";
				rackLevel = headers["level"] ?? "";
			}

			if (location) {
				const locationKey = normalizeKey(location);
				const matchedArea = areas.find(
					(area) =>
						normalizeKey(area.warehouseName ?? "") === locationKey ||
						normalizeKey(area.areaName ?? "") === locationKey ||
						normalizeKey(area.areaCode ?? "") === locationKey,
				);
				if (matchedArea) {
					areaId = matchedArea.areaId;
				} else {
					const matchedWarehouse = warehouses.find(
						(wh) => normalizeKey(wh.warehouseName) === locationKey,
					);
					if (matchedWarehouse) {
						warehouseId = matchedWarehouse.warehouseId;
					}
				}
			}

			const key = normalizeKey(`${rackRow}|${rackColumn}|${rackLevel}`);
			inFileKeys.set(key, (inFileKeys.get(key) ?? 0) + 1);

			const errors: string[] = [];
			if (!rackRow) {
				errors.push(isPageFormat ? "Storage Row is required" : "Row is required");
			}
			if (!rackColumn) {
				errors.push(
					isBinFormat || isPageFormat
						? "Storage Bay is required"
						: "Column is required",
				);
			}
			if (!rackLevel) errors.push("Level is required");
			if (location && !areaId && !warehouseId) {
				errors.push("Location not found (match warehouse or area name)");
			}
			if (key && (inFileKeys.get(key) ?? 0) > 1) {
				errors.push("Duplicate rack in file");
			}
			if (key && existingKeys.has(key)) {
				errors.push("Rack already exists");
			}

			return {
				rowNumber: index + 2,
				data: {
					rackRow,
					rackColumn,
					rackLevel,
					binCode,
					barCode,
					binType,
					length,
					width,
					height,
					weight,
					maxPallet,
					location,
					isActive,
				},
				errors,
				rackPayload:
					errors.length === 0
						? {
								rackRow,
								rackColumn,
								rackLevel,
								binCode: binCode ?? null,
								barCode: barCode ?? null,
								binType: binType ?? "FIXED",
								length: length ?? null,
								width: width ?? null,
								height: height ?? null,
								weight: weight ?? null,
								maxPallet: maxPallet ?? null,
								areaId: areaId ?? null,
								warehouseId: warehouseId ?? null,
								isActive: isActive ?? true,
								createdBy,
								updatedBy: createdBy,
							}
						: undefined,
			};
		});
	}

	async function handleFile(file: File) {
		setFileName(file.name);
		setIsParsing(true);
		setRows([]);
		setIsStockTakeFormat(false);
		setIsStorageBinFormat(false);
		setNewRacksToCreate([]);
		setNewUomsToCreate([]);
		try {
			const arrayBuffer = await file.arrayBuffer();
			const workbook = read(arrayBuffer, { type: "array" });
			const firstSheet = workbook.SheetNames[0];
			if (!firstSheet) {
				toast.error("No sheet found in the uploaded file.");
				return;
			}
			const worksheet = workbook.Sheets[firstSheet];
			const rawRows = utils.sheet_to_json<Record<string, unknown>>(worksheet, {
				defval: "",
				raw: false,
			});
			if (rawRows.length === 0) {
				toast.error("The uploaded file is empty.");
				return;
			}
			setRows(mode === "skus" ? parseSkuRows(rawRows) : parseRackRows(rawRows));
		} catch {
			toast.error("Failed to parse file. Please upload a valid Excel file.");
		} finally {
			setIsParsing(false);
		}
	}

	async function runImport() {
		if (!createdBy) {
			toast.error("You must be signed in to import.");
			return;
		}
		if (validRows.length === 0) {
			toast.error("No valid rows to import.");
			return;
		}

		if (mode === "skus" && isStockTakeFormat && skusLoading) {
			toast.error("Loading SKUs, please try again in a moment.");
			return;
		}

		setIsImporting(true);
		setProcessedCount(0);
		const batchSize = 100;
		const mutableRows = [...rows];
		const uomLookup = new Map<string, string>();
		for (const unit of stockUnitsData?.stockUnits.query ?? []) {
			uomLookup.set(
				normalizeKey(`${unit.unitName} ${unit.unitCode}`),
				unit.stockUnitId,
			);
			uomLookup.set(normalizeKey(unit.unitName), unit.stockUnitId);
			uomLookup.set(normalizeKey(unit.unitCode), unit.stockUnitId);
		}

		try {
			let createdCount = 0;

			if (mode === "skus" && isStockTakeFormat) {
				for (const uomLabel of newUomsToCreate) {
					if (uomLookup.has(normalizeKey(uomLabel))) continue;
					const data = await createStockUnit({
						input: {
							unitName: uomLabel,
							unitCode: uomLabel,
							isActive: true,
							createdBy,
							updatedBy: createdBy,
						},
					});
					const created = data?.createStockUnit;
					if (created) {
						uomLookup.set(normalizeKey(created.unitName), created.stockUnitId);
						uomLookup.set(normalizeKey(created.unitCode), created.stockUnitId);
						uomLookup.set(
							normalizeKey(`${created.unitName} ${created.unitCode}`),
							created.stockUnitId,
						);
					}
				}

				for (const rackInput of newRacksToCreate) {
					await createRack({ input: rackInput });
				}
			}

			for (let i = 0; i < validRows.length; i += batchSize) {
				const batch = validRows.slice(i, i + batchSize);
				const settled = await Promise.allSettled(
					batch.map(async (row) => {
						if (mode === "skus") {
							let payload = (
								row as Extract<PreviewRow, { skuPayload?: unknown }>
							).skuPayload;
							if (isStockTakeFormat) {
								const skuRow = row as Extract<
									PreviewRow,
									{ skuPayload?: unknown }
								>;
								const stockUnitId = uomLookup.get(
									normalizeKey(skuRow.data.skuUomLabel),
								);
								if (!stockUnitId) {
									return {
										rowNumber: row.rowNumber,
										ok: false as const,
										error: "Unit of Measure not found",
									};
								}
								payload = {
									skuCode: skuRow.data.skuCode,
									skuDescription: skuRow.data.skuDescription,
									skuExpiryDate: "",
									skuSuppliers: [],
									skuUom: stockUnitId,
									pickingStrategy: skuRow.data.pickingStrategy || "FIFO",
									isActive: true,
									initialOnHandQty: Number(skuRow.data.skuQuantity),
								};
							}
							if (!payload)
								return {
									rowNumber: row.rowNumber,
									ok: false as const,
									error: "Missing payload",
								};

							if (isStockTakeFormat) {
								const existing = (skusData?.skus?.query ?? []).find(
									(s) =>
										s.skuCode.toLowerCase() === payload.skuCode.toLowerCase(),
								);

								if (existing) {
									return {
										rowNumber: row.rowNumber,
										ok: false as const,
										error:
											"SKU already exists; use Stock Adjustment to change on-hand quantity",
									};
								}

								await createSku({ input: payload });
								return {
									rowNumber: row.rowNumber,
									ok: true as const,
									action: "created" as const,
								};
							}

							await createSku({ input: payload });
							return {
								rowNumber: row.rowNumber,
								ok: true as const,
								action: "created" as const,
							};
						}
						const payload = (
							row as Extract<PreviewRow, { rackPayload?: unknown }>
						).rackPayload;
						if (!payload)
							return {
								rowNumber: row.rowNumber,
								ok: false as const,
								error: "Missing payload",
							};
						await createRack({ input: payload });
						return { rowNumber: row.rowNumber, ok: true as const };
					}),
				);

				for (const result of settled) {
					setProcessedCount((c) => c + 1);
					if (result.status === "fulfilled" && result.value.ok) {
						if (
							mode === "skus" &&
							isStockTakeFormat &&
							result.value.action === "created"
						) {
							createdCount += 1;
						}
						continue;
					}
					const rowNumber =
						result.status === "fulfilled" ? result.value.rowNumber : -1;
					const errorText =
						result.status === "fulfilled"
							? result.value.error
							: (result.reason?.message ?? "Import failed");
					const idx = mutableRows.findIndex(
						(row) => row.rowNumber === rowNumber,
					);
					if (idx >= 0)
						mutableRows[idx] = {
							...mutableRows[idx],
							errors: [errorText],
						} as PreviewRow;
				}
				setRows([...mutableRows]);
			}

			const failedCount = mutableRows.filter(
				(row) => row.errors.length > 0,
			).length;
			const successCount = validRows.length - failedCount;
			if (successCount > 0) {
				toast.success(
					mode === "skus" && isStockTakeFormat
						? `SKU import complete: ${createdCount} created, ${failedCount} failed.`
						: `${mode === "skus" ? "SKU" : "Rack"} import complete: ${successCount} succeeded, ${failedCount} failed.`,
				);
				onImported?.();
			} else {
				toast.error("Import finished with no successful rows.");
			}
		} finally {
			setIsImporting(false);
		}
	}

	const hasErrors = rows.some((row) => row.errors.length > 0);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-background shadow-2xl"
				style={{ maxWidth: "min(95vw, 1400px)" }}
			>
				<DialogHeader className="border-b bg-muted/50 pb-4">
					<div className="flex items-start gap-3">
						<div
							className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
							style={{ background: "var(--dashboard-accent)" }}
						>
							<FileSpreadsheet className="h-4 w-4 text-white" />
						</div>
						<div className="min-w-0 flex-1">
							<DialogTitle
								className="text-xl"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Import {mode === "skus" ? "SKUs" : "Racks"} from Excel
							</DialogTitle>
							<DialogDescription
								className="mt-1"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Upload an Excel file, review validation, then import valid rows.
							</DialogDescription>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<span className="rounded-md border border-border bg-[var(--dashboard-accent-muted)]/45 px-2 py-1 text-foreground">
								Total: {rows.length}
							</span>
							<span
								className="rounded-md border px-2 py-1 font-medium text-foreground"
								style={{
									background: "var(--dashboard-accent-muted)",
									borderColor: "var(--dashboard-accent)",
								}}
							>
								Ready: {validRows.length}
							</span>
							{mode === "skus" &&
								isStockTakeFormat &&
								newRacksToCreate.length > 0 && (
									<span className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
										+{newRacksToCreate.length} new racks
									</span>
								)}
							{mode === "skus" &&
								isStockTakeFormat &&
								newUomsToCreate.length > 0 && (
									<span className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
										+{newUomsToCreate.length} new UOMs
									</span>
								)}
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 py-2 overflow-y-auto">
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							className="rounded-lg"
							onClick={downloadTemplate}
						>
							<Download className="mr-2 h-4 w-4" />
							Download Template
						</Button>
						{hasErrors && (
							<Button
								type="button"
								variant="outline"
								className="rounded-lg"
								onClick={() => downloadErrorReport(mode, rows, skuFormat)}
							>
								<FileSpreadsheet className="mr-2 h-4 w-4" />
								Download Error Report
							</Button>
						)}
					</div>

					<div className="rounded-xl border border-dashed bg-muted/20 p-4">
						<div className="flex items-center gap-2">
							<Upload className="h-4 w-4 text-muted-foreground" />
							<Input
								type="file"
								accept=".xlsx,.xls,.csv"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) void handleFile(file);
								}}
								disabled={isParsing || isImporting}
							/>
						</div>
						{fileName && (
							<p className="mt-2 text-xs text-muted-foreground">
								Selected file: {fileName}
							</p>
						)}
						{mode === "skus" && (
							<p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
								<CalendarDays className="h-3.5 w-3.5" />
								Expiry supports `YYYY-MM-DD`, `MM/DD/YYYY`, and Excel serial
								dates (e.g. 46387).
							</p>
						)}
					</div>

					{isImporting && (
						<div className="space-y-2 rounded-lg border bg-[var(--dashboard-accent-muted)]/25 p-3">
							<div className="flex items-center justify-between text-sm">
								<span>Import progress</span>
								<span>
									{processedCount} / {validRows.length}
								</span>
							</div>
							<Progress
								value={progress}
								className="bg-[var(--dashboard-accent-muted)] [&_[data-slot=progress-indicator]]:bg-[var(--dashboard-accent)]"
							/>
						</div>
					)}

					<div className="max-h-[58vh] overflow-auto rounded-xl border bg-background">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="w-16">Row</TableHead>
									{mode === "skus" ? (
									skuFormat === "items" ? (
										<>
											{ITEMS_IMPORT_HEADERS.map((header) => (
												<TableHead key={header}>{header}</TableHead>
											))}
										</>
									) : (
										<>
											<TableHead>SKU Code</TableHead>
											<TableHead>Description</TableHead>
											<TableHead>Quantity</TableHead>
											<TableHead>UOM</TableHead>
											<TableHead>Strategy</TableHead>
											<TableHead>Expiry</TableHead>
										</>
									)
									) : isStorageBinFormat ? (
										<>
											{RACKS_IMPORT_HEADERS.map((header) => (
												<TableHead key={header}>{header}</TableHead>
											))}
										</>
									) : (
										<>
											<TableHead>Row</TableHead>
											<TableHead>Column</TableHead>
											<TableHead>Level</TableHead>
										</>
									)}
									<TableHead className="min-w-[260px]">Validation</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={
												mode === "skus"
													? skuFormat === "items"
														? ITEMS_IMPORT_HEADERS.length + 2
														: 8
													: isStorageBinFormat
														? RACKS_IMPORT_HEADERS.length + 2
														: 5
											}
											className="h-20 text-center text-muted-foreground"
										>
											Upload a file to preview rows.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<TableRow
											key={`${mode}-${row.rowNumber}`}
											className={
												row.errors.length > 0 ? "bg-destructive/10" : ""
											}
										>
											<TableCell>{row.rowNumber}</TableCell>
											{isSkuRow(row) ? (
												skuFormat === "items" ? (
													itemsImportPreviewValues(row).map(
														(value, cellIndex) => (
															<TableCell key={ITEMS_IMPORT_HEADERS[cellIndex]}>
																{value}
															</TableCell>
														),
													)
												) : (
													<>
														<TableCell>{row.data.skuCode}</TableCell>
														<TableCell>{row.data.skuDescription}</TableCell>
														<TableCell>{row.data.skuQuantity}</TableCell>
														<TableCell>{row.data.skuUomLabel}</TableCell>
														<TableCell>{row.data.pickingStrategy}</TableCell>
														<TableCell>{row.data.skuExpiryDate}</TableCell>
													</>
												)
											) : isStorageBinFormat ? (
												<>
													<TableCell className="font-mono text-xs">{row.data.binCode ?? ""}</TableCell>
													<TableCell className="font-mono text-xs">{row.data.barCode ?? ""}</TableCell>
													<TableCell className="text-muted-foreground text-xs">
														{row.data.rackRow && row.data.rackColumn && row.data.rackLevel
															? rackLocationDescription(row.data)
															: "—"}
													</TableCell>
													<TableCell>{row.data.rackRow}</TableCell>
													<TableCell>{row.data.rackColumn}</TableCell>
													<TableCell>{row.data.rackLevel}</TableCell>
													<TableCell>{row.data.binType ?? ""}</TableCell>
													<TableCell>{row.data.length ?? ""}</TableCell>
													<TableCell>{row.data.width ?? ""}</TableCell>
													<TableCell>{row.data.height ?? ""}</TableCell>
													<TableCell>{row.data.weight ?? ""}</TableCell>
													<TableCell>{row.data.maxPallet ?? ""}</TableCell>
													<TableCell>{row.data.location ?? ""}</TableCell>
													<TableCell>{row.data.isActive === undefined ? "" : row.data.isActive ? "ACTIVE" : "INACTIVE"}</TableCell>
													<TableCell className="text-muted-foreground text-xs">—</TableCell>
												</>
											) : (
												<>
													<TableCell>{row.data.rackRow}</TableCell>
													<TableCell>{row.data.rackColumn}</TableCell>
													<TableCell>{row.data.rackLevel}</TableCell>
												</>
											)}
											<TableCell className="text-xs">
												{row.errors.length > 0
													? row.errors.join(" | ")
													: "Ready"}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</div>

				<DialogFooter className="border-t bg-muted/20 pt-4">
					<Button
						variant="outline"
						className="rounded-lg"
						onClick={() => onOpenChange(false)}
						disabled={isImporting}
					>
						Cancel
					</Button>
					<Button
						className="rounded-lg text-white"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
						onClick={() => void runImport()}
						disabled={isParsing || isImporting || validRows.length === 0}
					>
						Import {validRows.length > 0 ? `(${validRows.length})` : ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
