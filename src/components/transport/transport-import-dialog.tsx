import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { gqlRequest } from "@/lib/api/gql";
import {
	CREATE_TRANSPORT_MUTATION,
	TRANSPORTS_QUERY,
	type CreateTransportMutationData,
	type CreateTransportMutationVariables,
	type TransportsQueryData,
	type TransportsQueryVariables,
} from "@/lib/graphql/transports";
import {
	applyCapacityTemplate,
	parseCapacityTemplateCode,
	vehicleRegistryRowToCreateInput,
} from "@/lib/transport/transport-capacity";

const FT_TO_MM = 304.8;

interface TransportImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	createdBy: string;
	onImported?: () => void;
}

type PreviewRow = {
	rowNumber: number;
	code: string;
	capacityClass: string;
	btm: string;
	bdm: string;
	payload: string;
	lengthFt: string;
	widthFt: string;
	heightFt: string;
	pallets: string;
	errors: string[];
	warnings: string[];
	payloadInput?: CreateTransportMutationVariables["input"];
};

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

/** Parse a number out of values like "17ft", "5181.6 mm", "8". */
function parseNum(value: string): number | null {
	if (!value.trim()) return null;
	const cleaned = value.replace(/[^0-9.-]/g, "");
	if (!cleaned) return null;
	const n = Number(cleaned);
	return Number.isNaN(n) ? null : n;
}

function toMm(value: number, headerKey: string | undefined): number {
	if (headerKey?.includes("mm")) return value;
	return value * FT_TO_MM;
}

function downloadTemplate() {
	const headers = [
		[
			"Code",
			"BTM (kg)",
			"BDM (kg)",
			"Payload (kg)",
			"Length (ft)",
			"Width (ft)",
			"Height (ft)",
			"Pallet 4x3",
		],
		["5T", "3450", "5000", "1317.5", "17", "7", "7", "8"],
	];
	const worksheet = utils.aoa_to_sheet(headers);
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, worksheet, "Template");
	writeFile(workbook, "transport-import-template.xlsx");
}

function downloadErrorReport(rows: PreviewRow[]) {
	const failed = rows.filter((row) => row.errors.length > 0);
	if (failed.length === 0) return;
	const sheetData = [
		[
			"Row",
			"Code",
			"BTM",
			"BDM",
			"Payload",
			"Length (ft)",
			"Width (ft)",
			"Height (ft)",
			"Pallets",
			"Errors",
		],
		...failed.map((row) => [
			row.rowNumber,
			row.code,
			row.btm,
			row.bdm,
			row.payload,
			row.lengthFt,
			row.widthFt,
			row.heightFt,
			row.pallets,
			row.errors.join("; "),
		]),
	];
	const worksheet = utils.aoa_to_sheet(sheetData);
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, worksheet, "Import Errors");
	writeFile(workbook, "transport-import-errors.xlsx");
}

export function TransportImportDialog({
	open,
	onOpenChange,
	createdBy,
	onImported,
}: TransportImportDialogProps) {
	const [fileName, setFileName] = useState("");
	const [rows, setRows] = useState<PreviewRow[]>([]);
	const [isParsing, setIsParsing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [processedCount, setProcessedCount] = useState(0);

	const { data: transportsData } = useQuery({
		queryKey: ["transports", "import-existing-codes"],
		queryFn: () =>
			gqlRequest<TransportsQueryData, TransportsQueryVariables>(
				TRANSPORTS_QUERY,
				{ pageSize: 1000, pageNumber: 1 },
			),
		enabled: open,
	});

	const { mutateAsync: createTransport } = useMutation({
		mutationFn: (variables: CreateTransportMutationVariables) =>
			gqlRequest<CreateTransportMutationData, CreateTransportMutationVariables>(
				CREATE_TRANSPORT_MUTATION,
				variables,
			),
	});

	const validRows = useMemo(
		() => rows.filter((row) => Boolean(row.payloadInput)),
		[rows],
	);

	const progress = validRows.length
		? Math.round((processedCount / validRows.length) * 100)
		: 0;

	function isVehicleRegistryFormat(rawRows: Record<string, unknown>[]): boolean {
		if (rawRows.length === 0) return false;
		const headers = rowToHeaders(rawRows[0]);
		return Boolean(headers.code) && !headers.btm && !headers.bdm;
	}

	function parseVehicleRegistryRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		const existingCodes = new Set(
			(transportsData?.transports.query ?? []).map((t) =>
				t.code.trim().toLowerCase(),
			),
		);
		const counts = new Map<string, number>();
		for (const row of rawRows) {
			const headers = rowToHeaders(row);
			const code = headers.code ?? "";
			if (!code) continue;
			counts.set(code.toLowerCase(), (counts.get(code.toLowerCase()) ?? 0) + 1);
		}

		return rawRows.map((row, index) => {
			const headers = rowToHeaders(row);
			const code = headers.code ?? "";
			const barcode = headers.barcode ?? "";
			const description = headers.desc_01 ?? headers.desc01 ?? headers.description ?? code;
			const location = headers.aisle ?? headers.status ?? "";
			const capacityClass = parseCapacityTemplateCode(code) ?? "";
			const errors: string[] = [];

			if (!code) errors.push("Code is required");
			if (code && (counts.get(code.toLowerCase()) ?? 0) > 1) {
				errors.push("Duplicate code in file");
			}
			if (code && existingCodes.has(code.toLowerCase())) {
				errors.push("Code already exists");
			}

			const tonnageWarning =
				code && !capacityClass
					? "No tonnage class in code — will import without auto-filled specs"
					: "";
			const warnings = tonnageWarning ? [tonnageWarning] : [];

			const merged = code && capacityClass
				? applyCapacityTemplate({
						code,
						description,
						minWeightKg: null,
						maxWeightKg: null,
						maxLengthMm: null,
						maxWidthMm: null,
						maxHeightMm: null,
						numberOfPallets: null,
					})
				: null;

			const payload =
				errors.length === 0 && code
					? vehicleRegistryRowToCreateInput(
							{ code, barcode, description, location },
							createdBy,
						)
					: undefined;

			return {
				rowNumber: index + 2,
				code,
				capacityClass: merged?.capacityClass ?? capacityClass,
				btm: merged?.minWeightKg ?? "",
				bdm: merged?.maxWeightKg ?? "",
				payload: merged?.description ?? description,
				lengthFt: merged?.maxLengthMm ? String(Number(merged.maxLengthMm) / FT_TO_MM) : "",
				widthFt: merged?.maxWidthMm ? String(Number(merged.maxWidthMm) / FT_TO_MM) : "",
				heightFt: merged?.maxHeightMm ? String(Number(merged.maxHeightMm) / FT_TO_MM) : "",
				pallets: merged?.numberOfPallets != null ? String(merged.numberOfPallets) : "",
				errors,
				warnings,
				payloadInput: payload,
			};
		});
	}

	function parseSpecSheetRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		const existingCodes = new Set(
			(transportsData?.transports.query ?? []).map((t) =>
				t.code.trim().toLowerCase(),
			),
		);
		const counts = new Map<string, number>();
		for (const row of rawRows) {
			const code = rowToHeaders(row).code ?? "";
			if (!code) continue;
			counts.set(
				code.toLowerCase(),
				(counts.get(code.toLowerCase()) ?? 0) + 1,
			);
		}

		return rawRows.map((row, index) => {
			const headers = rowToHeaders(row);
			const code = headers.code ?? "";
			const btm = headers.btm ?? "";
			const bdm = headers.bdm ?? "";
			const payloadRaw = headers.payload ?? "";
			const lengthFt = headers["length ft"] ?? headers.length ?? "";
			const widthFt = headers["width ft"] ?? headers.width ?? "";
			const heightFt = headers["height ft"] ?? headers.height ?? "";
			const pallets =
				headers["pallet 4x3"] ??
				headers.pallet ??
				headers["number of pallets"] ??
				headers["no of pallets"] ??
				"";

			const errors: string[] = [];
			if (!code) errors.push("Code is required");
			if (code && (counts.get(code.toLowerCase()) ?? 0) > 1) {
				errors.push("Duplicate code in file");
			}
			if (code && existingCodes.has(code.toLowerCase())) {
				errors.push("Code already exists");
			}

			const btmNum = parseNum(btm);
			if (btm && btmNum === null) errors.push("BTM must be a number");
			const bdmNum = parseNum(bdm);
			if (bdm && bdmNum === null) errors.push("BDM must be a number");

			let payloadNum: number | null = parseNum(payloadRaw);
			if (payloadRaw && payloadNum === null) {
				errors.push("Payload must be a number");
			}
			if (payloadNum === null && btmNum !== null && bdmNum !== null) {
				payloadNum = bdmNum - btmNum;
			}

			const lengthKey = Object.keys(headers).find((k) => k.includes("length"));
			const widthKey = Object.keys(headers).find((k) => k.includes("width"));
			const heightKey = Object.keys(headers).find((k) => k.includes("height"));

			const lengthNum = parseNum(lengthFt);
			if (lengthFt && lengthNum === null) errors.push("Length must be a number");
			const widthNum = parseNum(widthFt);
			if (widthFt && widthNum === null) errors.push("Width must be a number");
			const heightNum = parseNum(heightFt);
			if (heightFt && heightNum === null) errors.push("Height must be a number");

			const palletsNum = parseNum(pallets);
			if (pallets && palletsNum === null) errors.push("Pallets must be a number");

			const payload =
				errors.length === 0
					? {
							code,
							description:
								payloadNum !== null
									? `Payload (BG): ${Number(payloadNum.toFixed(2))} kg`
									: undefined,
							minWeightKg: btmNum !== null ? btmNum.toFixed(3) : undefined,
							maxWeightKg: bdmNum !== null ? bdmNum.toFixed(3) : undefined,
							maxLengthMm:
								lengthNum !== null
									? toMm(lengthNum, lengthKey).toFixed(2)
									: undefined,
							maxWidthMm:
								widthNum !== null
									? toMm(widthNum, widthKey).toFixed(2)
									: undefined,
							maxHeightMm:
								heightNum !== null
									? toMm(heightNum, heightKey).toFixed(2)
									: undefined,
							numberOfPallets: palletsNum !== null ? Math.trunc(palletsNum) : undefined,
							createdBy,
							updatedBy: createdBy,
						}
					: undefined;

			return {
				rowNumber: index + 2,
				code,
				capacityClass: parseCapacityTemplateCode(code) ?? "",
				btm,
				bdm,
				payload: payloadRaw,
				lengthFt,
				widthFt,
				heightFt,
				pallets,
				errors,
				warnings: [],
				payloadInput: payload,
			};
		});
	}

	function parseRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		return isVehicleRegistryFormat(rawRows)
			? parseVehicleRegistryRows(rawRows)
			: parseSpecSheetRows(rawRows);
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
				raw: false,
			});
			if (rawRows.length === 0) {
				toast.error("The uploaded file is empty.");
				return;
			}
			setRows(parseRows(rawRows));
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
		const batchSize = 20;
		const mutableRows = [...rows];

		try {
			for (let i = 0; i < validRows.length; i += batchSize) {
				const batch = validRows.slice(i, i + batchSize);
				const settled = await Promise.allSettled(
					batch.map(async (row) => {
						if (!row.payloadInput) {
							return { rowNumber: row.rowNumber, ok: false as const, error: "Missing payload" };
						}
						await createTransport({ input: row.payloadInput });
						return { rowNumber: row.rowNumber, ok: true as const };
					}),
				);

				for (const result of settled) {
					setProcessedCount((c) => c + 1);
					if (result.status === "fulfilled" && result.value.ok) continue;
					const rowNumber = result.status === "fulfilled" ? result.value.rowNumber : -1;
					const errorText =
						result.status === "fulfilled"
							? result.value.error
							: (result.reason?.message ?? "Import failed");
					const idx = mutableRows.findIndex((row) => row.rowNumber === rowNumber);
					if (idx >= 0) {
						mutableRows[idx] = { ...mutableRows[idx], errors: [errorText] };
					}
				}
				setRows([...mutableRows]);
			}

			const failedCount = mutableRows.filter((row) => row.errors.length > 0).length;
			const successCount = validRows.length - failedCount;
			if (successCount > 0) {
				toast.success(`Transport import complete: ${successCount} succeeded, ${failedCount} failed.`);
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
				style={{ maxWidth: "min(95vw, 1200px)" }}
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
							<DialogTitle className="text-xl" style={{ fontFamily: "var(--dashboard-display)" }}>
								Import Transports from Excel
							</DialogTitle>
							<DialogDescription className="mt-1" style={{ fontFamily: "var(--dashboard-body)" }}>
								Upload vehicle registry (CODE, BARCODE) or spec sheet (BTM, BDM, dimensions).
								Tonnage in code like WTH4155 (3 TON) maps to 3T specs automatically.
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
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 py-2 overflow-y-auto">
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" className="rounded-lg" onClick={downloadTemplate}>
							<Download className="mr-2 h-4 w-4" />
							Download Template
						</Button>
						{hasErrors && (
							<Button
								type="button"
								variant="outline"
								className="rounded-lg"
								onClick={() => downloadErrorReport(rows)}
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
							<p className="mt-2 text-xs text-muted-foreground">Selected file: {fileName}</p>
						)}
						<p className="mt-2 text-xs text-muted-foreground">
							BTM = unladen weight, BDM = gross weight. Length/Width/Height in feet (use a "(mm)"
							header to provide millimeters directly).
						</p>
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
									<TableHead>Code</TableHead>
									<TableHead>Class</TableHead>
									<TableHead>BTM</TableHead>
									<TableHead>BDM</TableHead>
									<TableHead>Payload</TableHead>
									<TableHead>Length (ft)</TableHead>
									<TableHead>Width (ft)</TableHead>
									<TableHead>Height (ft)</TableHead>
									<TableHead>Pallets</TableHead>
									<TableHead className="min-w-[200px]">Validation</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell colSpan={11} className="h-20 text-center text-muted-foreground">
											Upload a file to preview rows.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<TableRow
											key={row.rowNumber}
											className={
												row.errors.length > 0
													? "bg-destructive/10"
													: row.warnings.length > 0
														? "bg-amber-500/10"
														: ""
											}
										>
											<TableCell>{row.rowNumber}</TableCell>
											<TableCell className="font-mono text-xs">{row.code}</TableCell>
											<TableCell className="font-mono text-xs">{row.capacityClass || "-"}</TableCell>
											<TableCell>{row.btm}</TableCell>
											<TableCell>{row.bdm}</TableCell>
											<TableCell>{row.payload}</TableCell>
											<TableCell>{row.lengthFt}</TableCell>
											<TableCell>{row.widthFt}</TableCell>
											<TableCell>{row.heightFt}</TableCell>
											<TableCell>{row.pallets}</TableCell>
											<TableCell className="text-xs">
												{row.errors.length > 0
													? row.errors.join(" | ")
													: row.warnings.length > 0
														? row.warnings.join(" | ")
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
