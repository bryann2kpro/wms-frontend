import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
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
	CREATE_PICKING_CRITERIA_MUTATION,
	type CreatePickingCriteriaMutationData,
	type CreatePickingCriteriaMutationVariables,
} from "@/lib/graphql/picking-criteria";
import type { CreatePickingCriteriaInput } from "@/lib/graphql/types";

interface PickingCriteriaImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	createdBy: string;
	onImported?: () => void;
}

type PreviewRow = {
	rowNumber: number;
	data: {
		deliveryPoint: string;
		itemCode: string;
		description: string;
		storageClass: string;
		minExpiryMonth: string;
	};
	errors: string[];
	payload?: CreatePickingCriteriaInput;
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
		["Row", "Delivery Point", "Item Code", "Description", "Storage Class", "Min Expiry Month", "Errors"],
		...failed.map((row) => [
			row.rowNumber,
			row.data.deliveryPoint,
			row.data.itemCode,
			row.data.description,
			row.data.storageClass,
			row.data.minExpiryMonth,
			row.errors.join("; "),
		]),
	];
	const worksheet = utils.aoa_to_sheet(sheetData);
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, worksheet, "Import Errors");
	writeFile(workbook, "picking-criteria-import-errors.xlsx");
}

export function PickingCriteriaImportDialog({
	open,
	onOpenChange,
	createdBy,
	onImported,
}: PickingCriteriaImportDialogProps) {
	const [fileName, setFileName] = useState("");
	const [rows, setRows] = useState<PreviewRow[]>([]);
	const [isParsing, setIsParsing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [processedCount, setProcessedCount] = useState(0);

	const { mutateAsync: createCriteria } = useMutation({
		mutationFn: (variables: CreatePickingCriteriaMutationVariables) =>
			gqlRequest<CreatePickingCriteriaMutationData, CreatePickingCriteriaMutationVariables>(
				CREATE_PICKING_CRITERIA_MUTATION,
				variables,
			),
	});

	const validRows = useMemo(() => rows.filter((r) => Boolean(r.payload)), [rows]);

	const progress = validRows.length
		? Math.round((processedCount / validRows.length) * 100)
		: 0;

	function downloadTemplate() {
		const worksheet = utils.aoa_to_sheet([
			[
				"LINE_NO",
				"USERNAME",
				"DEBTOR_GROUP_01_CODE",
				"DEBTOR_GROUP_02_CODE",
				"DEBTOR_GROUP_03_CODE",
				"DEBTOR_CODE",
				"DELIVERY_POINT_CODE",
				"STORAGE_CLASS",
				"ITEM_GROUP_01_CODE",
				"ITEM_GROUP_02_CODE",
				"ITEM_GROUP_03_CODE",
				"ITEM_CODE",
				"DESC_01",
				"MIN_EXPIRY_MONTH",
			],
		]);
		const workbook = utils.book_new();
		utils.book_append_sheet(workbook, worksheet, "Template");
		writeFile(workbook, "picking-criteria-template.xlsx");
	}

	function parseRows(rawRows: Record<string, unknown>[]): PreviewRow[] {
		const inFileKeys = new Map<string, number>();

		return rawRows.map((row, index) => {
			const headers: Record<string, string> = Object.fromEntries(
				Object.entries(row).map(([k, v]) => [normalizeKey(k), normalize(v)]),
			);

			const deliveryPoint =
				headers["delivery point code"] ??
				headers["deliverypoint"] ??
				headers["delivery point"] ??
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
				"";
			const storageClassRaw =
				headers["storage class"] ??
				headers["storageclass"] ??
				"";
			// "*" = wildcard "match all" — backend requires min(1) on all these fields
			const orWild = (v: string) => v || "*";
			const storageClassRaw2 = storageClassRaw.toUpperCase() === "NULL" ? "" : storageClassRaw;
			const storageClass = orWild(storageClassRaw2);
			const minExpiryMonthRaw =
				headers["min expiry month"] ??
				headers["minexpirymonth"] ??
				"0";
			const minExpiryMonth = Math.max(0, Math.floor(Number(minExpiryMonthRaw) || 0));

			// Optional debtor hierarchy fields — default to "*" when empty
			const category = orWild(headers["debtor group 01 code"] ?? headers["debtorgroup01code"] ?? "");
			const chain = orWild(headers["debtor group 02 code"] ?? headers["debtorgroup02code"] ?? "");
			const channel = orWild(headers["debtor group 03 code"] ?? headers["debtorgroup03code"] ?? "");
			const debtor = orWild(headers["debtor code"] ?? headers["debtorcode"] ?? "");
			const brand = orWild(headers["item group 01 code"] ?? headers["itemgroup01code"] ?? "");
			const itemCategory = orWild(headers["item group 02 code"] ?? headers["itemgroup02code"] ?? "");
			const manufacturer = orWild(headers["item group 03 code"] ?? headers["itemgroup03code"] ?? "");
			const userId = orWild(headers["username"] ?? "");

			const key = normalizeKey(`${deliveryPoint}|${itemCode}`);
			inFileKeys.set(key, (inFileKeys.get(key) ?? 0) + 1);

			const errors: string[] = [];
			if (!deliveryPoint && !itemCode) {
				errors.push("At least Delivery Point or Item Code is required");
			}
			if (key && (inFileKeys.get(key) ?? 0) > 1) {
				errors.push("Duplicate delivery point + item combination in file");
			}

			return {
				rowNumber: index + 2,
				data: { deliveryPoint, itemCode, description, storageClass, minExpiryMonth: String(minExpiryMonth) },
				errors,
				payload:
					errors.length === 0
						? {
								userId,
								category,
								chain,
								channel,
								debtor,
								deliveryPoint,
								storageClass,
								brand,
								itemCategory,
								manufacturer,
								item: itemCode,
								minExpiryMonth,
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
						await createCriteria({ input: row.payload });
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
					`Picking criteria import complete: ${successCount} succeeded, ${failedCount} failed.`,
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
								Import Picking Criteria from Excel
							</DialogTitle>
							<DialogDescription
								className="mt-1"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Upload an Excel file with DELIVERY_POINT_CODE, ITEM_CODE, and MIN_EXPIRY_MONTH columns.
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
									<TableHead>Delivery Point</TableHead>
									<TableHead>Item Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Storage Class</TableHead>
									<TableHead>Min Expiry</TableHead>
									<TableHead className="min-w-[260px]">Validation</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
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
												{row.data.deliveryPoint}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{row.data.itemCode}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{row.data.description}
											</TableCell>
											<TableCell className="text-xs">
												{row.data.storageClass || "—"}
											</TableCell>
											<TableCell className="text-xs">
												{row.data.minExpiryMonth}
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
