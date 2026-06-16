import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
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
	CREATE_PICK_FACE_STRATEGY_MUTATION,
	type CreatePickFaceStrategyInput,
	type CreatePickFaceStrategyMutationData,
} from "@/lib/graphql/pick-face-strategy";
import {
	RACKS_QUERY,
	type RacksQueryData,
	type RacksQueryVariables,
} from "@/lib/graphql/racks";
import { SKUS_QUERY, type SkusQueryData } from "@/lib/graphql/skus";

interface PickFaceImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	createdBy: string;
	onImported?: () => void;
}

type PreviewRow = {
	rowNumber: number;
	data: {
		storageBinCode: string;
		itemCode: string;
		description: string;
		binType: string;
	};
	errors: string[];
	payload?: CreatePickFaceStrategyInput;
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

function downloadErrorReport(rows: PreviewRow[]) {
	const failed = rows.filter((row) => row.errors.length > 0);
	if (failed.length === 0) return;
	const sheetData = [
		["Row", "Storage Bin Code", "Item Code", "Description", "Bin Type", "Errors"],
		...failed.map((row) => [
			row.rowNumber,
			row.data.storageBinCode,
			row.data.itemCode,
			row.data.description,
			row.data.binType,
			row.errors.join("; "),
		]),
	];
	const worksheet = utils.aoa_to_sheet(sheetData);
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, worksheet, "Import Errors");
	writeFile(workbook, "pick-face-import-errors.xlsx");
}

export function PickFaceImportDialog({
	open,
	onOpenChange,
	createdBy,
	onImported,
}: PickFaceImportDialogProps) {
	const [fileName, setFileName] = useState("");
	const [rows, setRows] = useState<PreviewRow[]>([]);
	const [isParsing, setIsParsing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [processedCount, setProcessedCount] = useState(0);

	const { data: racksData } = useQuery({
		queryKey: [...qk.racks.all, { pageSize: 5000, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<RacksQueryData, RacksQueryVariables>(RACKS_QUERY, {
				pageSize: 5000,
				pageNumber: 1,
			}),
		enabled: open,
	});

	const { data: skusData } = useQuery({
		queryKey: qk.skus.all,
		queryFn: () => gqlRequest<SkusQueryData>(SKUS_QUERY),
		enabled: open,
	});

	const { mutateAsync: createStrategy } = useMutation({
		mutationFn: (input: CreatePickFaceStrategyInput) =>
			gqlRequest<CreatePickFaceStrategyMutationData>(
				CREATE_PICK_FACE_STRATEGY_MUTATION,
				{ input },
			),
	});

	const validRows = useMemo(() => rows.filter((r) => Boolean(r.payload)), [rows]);

	const progress = validRows.length
		? Math.round((processedCount / validRows.length) * 100)
		: 0;

	function downloadTemplate() {
		const worksheet = utils.aoa_to_sheet([
			["LINE_NO", "STORAGE_BIN_CODE", "ITEM_CODE", "DESC_01", "REPLN_TYPE"],
		]);
		const workbook = utils.book_new();
		utils.book_append_sheet(workbook, worksheet, "Template");
		writeFile(workbook, "pick-face-strategy-template.xlsx");
	}

	function parseRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		const racks = racksData?.racks.query ?? [];
		const skus = skusData?.skus?.query ?? [];

		// Build lookup maps — keyed by binCode when set, else auto-generated rackRow-rackColumn-rackLevel
		const fmtLevel = (lvl: string) => {
			const m = lvl.trim().match(/\d+/);
			return m ? m[0].padStart(2, "0") : lvl.trim();
		};
		const rackByBinCode = new Map(
			racks.map((r) => {
				const key = r.binCode
					? r.binCode.trim().toUpperCase()
					: `${r.rackRow}-${r.rackColumn}-${fmtLevel(r.rackLevel ?? "")}`.toUpperCase();
				return [key, r];
			}),
		);

		// console.log("Rack by bin code:", rackByBinCode);
		const skuByCode = new Map(
			skus.map((s) => [s.skuCode.trim().toUpperCase(), s]),
		);

		// console.log("SKU by code:", skuByCode);

		const inFileKeys = new Map<string, number>();

		return rawRows.map((row, index) => {
			const headers: Record<string, string> = Object.fromEntries(
				Object.entries(row).map(([k, v]) => [normalizeKey(k), normalize(v)]),
			);

			const storageBinCode =
				headers["storage bin code"] ??
				headers["storagebincode"] ??
				headers["storage bin"] ??
				"";
			const itemCode =
				headers["item code"] ??
				headers["itemcode"] ??
				headers["item"] ??
				"";
			const description =
				headers["desc 01"] ??
				headers["desc01"] ??
				headers["description"] ??
				headers["desc"] ??
				"";
			const replnType =
				headers["repln type"] ??
				headers["replntype"] ??
				headers["repln"] ??
				headers["bin type"] ??
				"FIXED_BIN";

			const binType = replnType.trim() || "FIXED_BIN";
			const key = normalizeKey(`${storageBinCode}|${itemCode}`);
			inFileKeys.set(key, (inFileKeys.get(key) ?? 0) + 1);

			const errors: string[] = [];
			if (!storageBinCode) errors.push("Storage Bin Code is required");
			if (!itemCode) errors.push("Item Code is required");

			const rack = storageBinCode
				? rackByBinCode.get(storageBinCode.trim().toUpperCase())
				: undefined;
			if (storageBinCode && !rack) {
				errors.push(`Bin "${storageBinCode}" not found in racks`);
			}

			const sku = itemCode
				? skuByCode.get(itemCode.trim().toUpperCase())
				: undefined;
			if (itemCode && !sku) {
				errors.push(`Item "${itemCode}" not found in SKUs`);
			}

			if (key && (inFileKeys.get(key) ?? 0) > 1) {
				errors.push("Duplicate bin+item combination in file");
			}

			return {
				rowNumber: index + 2,
				data: { storageBinCode, itemCode, description, binType },
				errors,
				payload:
					errors.length === 0 && rack && sku
						? {
								storageBinId: rack.rackId,
								skuId: sku.skuId,
								itemCode: sku.skuCode,
								binType,
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
		const batchSize = 100;
		const mutableRows = [...rows];

		try {
			for (let i = 0; i < validRows.length; i += batchSize) {
				const batch = validRows.slice(i, i + batchSize);
				const settled = await Promise.allSettled(
					batch.map(async (row) => {
						if (!row.payload) throw new Error("Missing payload");
						await createStrategy(row.payload);
						return { rowNumber: row.rowNumber, ok: true as const };
					}),
				);

				for (const result of settled) {
					setProcessedCount((c) => c + 1);
					if (result.status === "fulfilled" && result.value.ok) continue;
					const rowNumber =
						result.status === "fulfilled" ? result.value.rowNumber : -1;
					const errorText =
						result.status === "rejected"
							? (result.reason?.message ?? "Import failed")
							: "Import failed";
					const idx = mutableRows.findIndex((r) => r.rowNumber === rowNumber);
					if (idx >= 0)
						mutableRows[idx] = { ...mutableRows[idx], errors: [errorText] };
				}
				setRows([...mutableRows]);
			}

			const failedCount = mutableRows.filter((r) => r.errors.length > 0).length;
			const successCount = validRows.length - failedCount;
			if (successCount > 0) {
				toast.success(
					`Pick face import complete: ${successCount} succeeded, ${failedCount} failed.`,
				);
				onImported?.();
			} else {
				toast.error("Import finished with no successful rows.");
			}
		} finally {
			setIsImporting(false);
		}
	}

	const hasErrors = rows.some((r) => r.errors.length > 0);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-background shadow-2xl"
				style={{ maxWidth: "min(95vw, 1100px)" }}
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
								Import Pick Face Strategy from Excel
							</DialogTitle>
							<DialogDescription
								className="mt-1"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Upload an Excel file with STORAGE_BIN_CODE, ITEM_CODE, and REPLN_TYPE columns.
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
							<p className="mt-2 text-xs text-muted-foreground">
								Selected file: {fileName}
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

					<div className="max-h-[50vh] overflow-auto rounded-xl border bg-background">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="w-16">Row</TableHead>
									<TableHead>Storage Bin</TableHead>
									<TableHead>Item Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Bin Type</TableHead>
									<TableHead className="min-w-[260px]">Validation</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="h-20 text-center text-muted-foreground"
										>
											Upload a file to preview rows.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<TableRow
											key={row.rowNumber}
											className={row.errors.length > 0 ? "bg-destructive/10" : ""}
										>
											<TableCell>{row.rowNumber}</TableCell>
											<TableCell className="font-mono text-xs">
												{row.data.storageBinCode}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{row.data.itemCode}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{row.data.description}
											</TableCell>
											<TableCell className="text-xs">
												{row.data.binType}
											</TableCell>
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
