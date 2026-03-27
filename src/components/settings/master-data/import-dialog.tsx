import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { read, utils, writeFile } from "xlsx";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
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
	type CreateSkusMutationData,
	type CreateSkusMutationVariables,
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
	STOCK_UNITS_QUERY,
	type StockUnitsQueryData,
	type StockUnitsQueryVariables,
} from "@/lib/graphql/stock-units";

export type ImportMode = "skus" | "racks";

interface ImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: ImportMode;
	createdBy: string;
	onImported?: () => void;
}

type PreviewRow =
	| {
			rowNumber: number;
			data: {
				skuCode: string;
				skuDescription: string;
				skuPrice: string;
				skuQuantity: string;
				skuUomLabel: string;
				pickingStrategy: string;
				skuExpiryDate: string;
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
			};
			errors: string[];
			rackPayload?: CreateRackMutationVariables["input"];
	  };

function isSkuRow(
	row: PreviewRow,
): row is Extract<PreviewRow, { skuPayload?: CreateSkusMutationVariables["input"] }> {
	return "skuPayload" in row;
}

function normalize(value: unknown): string {
	return String(value ?? "").trim();
}

function normalizeKey(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function downloadErrorReport(mode: ImportMode, rows: PreviewRow[]) {
	const failed = rows.filter((row) => row.errors.length > 0);
	if (failed.length === 0) return;
	const sheetData =
		mode === "skus"
			? [
					[
						"Row",
						"SKU Code",
						"Description",
						"Price",
						"Quantity",
						"Unit of Measure",
						"Picking Strategy",
						"Expiry Date",
						"Errors",
					],
					...failed.map((row) => {
						const data = row.data as Extract<PreviewRow, { skuPayload?: unknown }>["data"];
						return [
							row.rowNumber,
							data.skuCode,
							data.skuDescription,
							data.skuPrice,
							data.skuQuantity,
							data.skuUomLabel,
							data.pickingStrategy,
							data.skuExpiryDate,
							row.errors.join("; "),
						];
					}),
				]
			: [
					["Row", "Row", "Column", "Level", "Errors"],
					...failed.map((row) => {
						const data = row.data as Extract<PreviewRow, { rackPayload?: unknown }>["data"];
						return [
							row.rowNumber,
							data.rackRow,
							data.rackColumn,
							data.rackLevel,
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
	createdBy,
	onImported,
}: ImportDialogProps) {
	const [fileName, setFileName] = useState("");
	const [rows, setRows] = useState<PreviewRow[]>([]);
	const [isParsing, setIsParsing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [processedCount, setProcessedCount] = useState(0);

	const { data: stockUnitsData } = useQuery<
		StockUnitsQueryData,
		StockUnitsQueryVariables
	>(STOCK_UNITS_QUERY, {
		variables: {},
		skip: mode !== "skus" || !open,
	});

	const { data: racksData } = useQuery<RacksQueryData, RacksQueryVariables>(
		RACKS_QUERY,
		{
			variables: { pageSize: 5000, pageNumber: 1 },
			skip: mode !== "racks" || !open,
		},
	);

	const [createSku] = useMutation<
		CreateSkusMutationData,
		CreateSkusMutationVariables
	>(CREATE_SKUS_MUTATION);
	const [createRack] = useMutation<
		CreateRackMutationData,
		CreateRackMutationVariables
	>(CREATE_RACK_MUTATION);

	const validRows = useMemo(
		() =>
			rows.filter((row) =>
				mode === "skus"
					? Boolean((row as Extract<PreviewRow, { skuPayload?: unknown }>).skuPayload)
					: Boolean((row as Extract<PreviewRow, { rackPayload?: unknown }>).rackPayload),
			),
		[rows, mode],
	);

	const progress = validRows.length
		? Math.round((processedCount / validRows.length) * 100)
		: 0;

	function downloadTemplate() {
		const headers =
			mode === "skus"
				? [
						[
							"SKU Code",
							"Description",
							"Price",
							"Quantity",
							"Unit of Measure",
							"Picking Strategy",
							"Expiry Date",
						],
					]
				: [["Row", "Column", "Level"]];
		const worksheet = utils.aoa_to_sheet(headers);
		const workbook = utils.book_new();
		utils.book_append_sheet(workbook, worksheet, "Template");
		writeFile(workbook, `${mode}-import-template.xlsx`);
	}

	function parseSkuRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		const stockUnits = stockUnitsData?.stockUnits.query ?? [];
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

		const counts = new Map<string, number>();
		for (const row of rawRows) {
			const headers: Record<string, string> = Object.fromEntries(
				Object.entries(row).map(([k, v]) => [normalizeKey(k), normalize(v)]),
			);
			const skuCode = headers["sku code"] ?? headers.code ?? "";
			if (!skuCode) continue;
			counts.set(skuCode.toLowerCase(), (counts.get(skuCode.toLowerCase()) ?? 0) + 1);
		}

		return rawRows.map((row, index) => {
			const headers: Record<string, string> = Object.fromEntries(
				Object.entries(row).map(([k, v]) => [normalizeKey(k), normalize(v)]),
			);
			const skuCode = headers["sku code"] ?? headers.code ?? "";
			const skuDescription = headers.description ?? "";
			const skuPrice = headers.price ?? "";
			const skuQuantity = headers.quantity ?? "";
			const skuUomLabel =
				headers["unit of measure"] ?? headers.uom ?? headers.unit ?? "";
			const pickingStrategy =
				(headers["picking strategy"] ?? "FIFO").toUpperCase().trim() || "FIFO";
			const skuExpiryDate = headers["expiry date"] ?? "";

			const errors: string[] = [];
			if (!skuCode) errors.push("SKU Code is required");
			if (!skuDescription) errors.push("Description is required");
			if (!skuQuantity || Number.isNaN(Number(skuQuantity))) {
				errors.push("Quantity must be a number");
			} else if (Number(skuQuantity) < 0) {
				errors.push("Quantity must be >= 0");
			}
			if (skuPrice && (Number.isNaN(Number(skuPrice)) || Number(skuPrice) < 0)) {
				errors.push("Price must be a number >= 0");
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
			if (skuExpiryDate && !parseDate(skuExpiryDate)) {
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
							skuPrice: skuPrice ? Number(skuPrice) : null,
							skuQuantity: Number(skuQuantity),
							skuExpiryDate: parseDate(skuExpiryDate),
							skuSuppliers: [],
							skuUom: stockUnitId,
							pickingStrategy,
							isActive: true,
					  }
					: undefined;

			return {
				rowNumber: index + 2,
				data: {
					skuCode,
					skuDescription,
					skuPrice,
					skuQuantity,
					skuUomLabel,
					pickingStrategy,
					skuExpiryDate,
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

		return rawRows.map((row, index) => {
			const headers: Record<string, string> = Object.fromEntries(
				Object.entries(row).map(([k, v]) => [normalizeKey(k), normalize(v)]),
			);
			const rackRow = headers.row ?? "";
			const rackColumn = headers.column ?? "";
			const rackLevel = headers.level ?? "";
			const key = normalizeKey(`${rackRow}|${rackColumn}|${rackLevel}`);
			inFileKeys.set(key, (inFileKeys.get(key) ?? 0) + 1);

			const errors: string[] = [];
			if (!rackRow) errors.push("Row is required");
			if (!rackColumn) errors.push("Column is required");
			if (!rackLevel) errors.push("Level is required");
			if (key && (inFileKeys.get(key) ?? 0) > 1) {
				errors.push("Duplicate rack in file");
			}
			if (key && existingKeys.has(key)) {
				errors.push("Rack already exists");
			}

			return {
				rowNumber: index + 2,
				data: { rackRow, rackColumn, rackLevel },
				errors,
				rackPayload:
					errors.length === 0
						? {
								rackRow,
								rackColumn,
								rackLevel,
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

		setIsImporting(true);
		setProcessedCount(0);
		const batchSize = 5;
		const mutableRows = [...rows];

		try {
			for (let i = 0; i < validRows.length; i += batchSize) {
				const batch = validRows.slice(i, i + batchSize);
				const settled = await Promise.allSettled(
					batch.map(async (row) => {
						if (mode === "skus") {
							const payload = (
								row as Extract<PreviewRow, { skuPayload?: unknown }>
							).skuPayload;
							if (!payload) return { rowNumber: row.rowNumber, ok: false as const, error: "Missing payload" };
							await createSku({ variables: { input: payload } });
							return { rowNumber: row.rowNumber, ok: true as const };
						}
						const payload = (
							row as Extract<PreviewRow, { rackPayload?: unknown }>
						).rackPayload;
						if (!payload) return { rowNumber: row.rowNumber, ok: false as const, error: "Missing payload" };
						await createRack({ variables: { input: payload } });
						return { rowNumber: row.rowNumber, ok: true as const };
					}),
				);

				for (const result of settled) {
					setProcessedCount((c) => c + 1);
					if (result.status === "fulfilled" && result.value.ok) continue;
					const rowNumber =
						result.status === "fulfilled" ? result.value.rowNumber : -1;
					const errorText =
						result.status === "fulfilled"
							? result.value.error
							: result.reason?.message ?? "Import failed";
					const idx = mutableRows.findIndex((row) => row.rowNumber === rowNumber);
					if (idx >= 0) mutableRows[idx] = { ...mutableRows[idx], errors: [errorText] } as PreviewRow;
				}
				setRows([...mutableRows]);
			}

			const failedCount = mutableRows.filter((row) => row.errors.length > 0).length;
			const successCount = validRows.length - failedCount;
			if (successCount > 0) {
				toast.success(
					`${mode === "skus" ? "SKU" : "Rack"} import complete: ${successCount} created, ${failedCount} failed.`,
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
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						Import {mode === "skus" ? "SKUs" : "Racks"} from Excel
					</DialogTitle>
					<DialogDescription style={{ fontFamily: "var(--dashboard-body)" }}>
						Upload an Excel file, review validation, then import valid rows.
					</DialogDescription>
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
								onClick={() => downloadErrorReport(mode, rows)}
							>
								<FileSpreadsheet className="mr-2 h-4 w-4" />
								Download Error Report
							</Button>
						)}
					</div>

					<div className="rounded-xl border border-dashed p-4">
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
					</div>

					{isImporting && (
						<div className="space-y-2 rounded-lg border p-3">
							<div className="flex items-center justify-between text-sm">
								<span>Import progress</span>
								<span>{processedCount} / {validRows.length}</span>
							</div>
							<Progress value={progress} />
						</div>
					)}

					<div className="max-h-[58vh] overflow-auto rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-16">Row</TableHead>
									{mode === "skus" ? (
										<>
											<TableHead>SKU Code</TableHead>
											<TableHead>Description</TableHead>
											<TableHead>Price</TableHead>
											<TableHead>Quantity</TableHead>
											<TableHead>UOM</TableHead>
											<TableHead>Strategy</TableHead>
											<TableHead>Expiry</TableHead>
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
											colSpan={mode === "skus" ? 9 : 6}
											className="h-20 text-center text-muted-foreground"
										>
											Upload a file to preview rows.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<TableRow
											key={`${mode}-${row.rowNumber}`}
											className={row.errors.length > 0 ? "bg-destructive/10" : ""}
										>
											<TableCell>{row.rowNumber}</TableCell>
											{isSkuRow(row) ? (
												<>
													<TableCell>{row.data.skuCode}</TableCell>
													<TableCell>{row.data.skuDescription}</TableCell>
													<TableCell>{row.data.skuPrice}</TableCell>
													<TableCell>{row.data.skuQuantity}</TableCell>
													<TableCell>{row.data.skuUomLabel}</TableCell>
													<TableCell>{row.data.pickingStrategy}</TableCell>
													<TableCell>{row.data.skuExpiryDate}</TableCell>
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
