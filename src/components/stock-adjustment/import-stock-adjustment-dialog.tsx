import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import { CREATE_STOCK_ADJUSTMENT_MUTATION } from "@/lib/graphql/stock-adjustment";
import { toUserFriendlyMessage } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type PreviewRow = {
	lineNo: string;
	rackLabel: string;
	skuCode: string;
	description: string;
	batchNo: string;
	expiryDate: string;
	sign: "+" | "-";
	qty: number;
	// resolved
	rackId: string | null;
	error: string | null;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

// ============================================
// HELPERS
// ============================================

/** Parse STORAGE_BIN_CODE like "I1-L3-02" → { row: "I1", level: "L3", col: "02" } */
function parseRackLabel(label: string): { row: string; level: string; col: string } | null {
	// Format: {ROW}-{LEVEL}-{COL} where LEVEL starts with L
	const match = label.trim().match(/^(.+?)-(L\d+)-(.+)$/i);
	if (!match) return null;
	return { row: match[1], level: match[2].toUpperCase(), col: match[3] };
}

/** Convert Excel serial date → YYYY-MM-DD, or return the string if it's already text */
function parseExcelDate(value: unknown): string {
	if (!value) return "";
	if (typeof value === "number") {
		const d = new Date(Math.round((value - 25569) * 86400 * 1000));
		if (isNaN(d.getTime())) return "";
		return d.toISOString().split("T")[0];
	}
	const s = String(value).trim();
	if (!s) return "";
	// Already a date string — normalise to YYYY-MM-DD if possible
	const d = new Date(s);
	if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
	return s;
}

function expiryDateToApi(value: string): string | null {
	const t = value.trim();
	if (!t) return null;
	if (t.includes("T")) return t;
	return `${t}T00:00:00.000Z`;
}

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object") {
		const gqlErr =
			"graphQLErrors" in err
				? (err as any).graphQLErrors?.[0]
				: "response" in err
					? (err as any).response?.errors?.[0]
					: null;
		if (gqlErr) {
			if (gqlErr.extensions?.code === "INTERNAL_SERVER_ERROR")
				return "Internal Server Error";
			if (gqlErr.message)
				return toUserFriendlyMessage(gqlErr.message, "Something went wrong. Please try again.");
		}
	}
	if (err instanceof Error)
		return toUserFriendlyMessage(err.message, "Something went wrong. Please try again.");
	return "Something went wrong. Please try again.";
}

// ============================================
// COMPONENT
// ============================================

export function ImportStockAdjustmentDialog({ open, onOpenChange, onSuccess }: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [reason, setReason] = useState("");
	const [preview, setPreview] = useState<PreviewRow[] | null>(null);
	const [fileName, setFileName] = useState("");

	const racksVars = { pageSize: 1000, pageNumber: 1 };
	const { data: racksData } = useQuery({
		queryKey: [...qk.racks.all, racksVars],
		queryFn: () => gqlRequest<RacksQueryData>(RACKS_QUERY, racksVars),
	});
	const racks = racksData?.racks?.query ?? [];

	const { mutateAsync: createMutation, isPending: submitting } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest(CREATE_STOCK_ADJUSTMENT_MUTATION, { input }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Stock adjustment created from Excel");
			handleClose();
			onSuccess();
		},
	});

	function handleClose() {
		setPreview(null);
		setFileName("");
		setReason("");
		if (fileInputRef.current) fileInputRef.current.value = "";
		onOpenChange(false);
	}

	function resolveRackId(label: string): string | null {
		const parsed = parseRackLabel(label);
		if (!parsed) return null;
		const match = racks.find(
			(r) =>
				r.rackRow?.toUpperCase() === parsed.row.toUpperCase() &&
				r.rackLevel?.toUpperCase() === parsed.level.toUpperCase() &&
				r.rackColumn?.toUpperCase() === parsed.col.toUpperCase(),
		);
		return match?.rackId ?? null;
	}

	function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setFileName(file.name);

		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				const data = ev.target?.result;
				const workbook = XLSX.read(data, { type: "array" });
				const sheet = workbook.Sheets[workbook.SheetNames[0]];
				const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
					defval: "",
					raw: true,
				});

				const parsed: PreviewRow[] = rows.map((row, i) => {
					// Normalise keys to uppercase
					const get = (key: string) => {
						const found = Object.entries(row).find(
							([k]) => k.trim().toUpperCase() === key,
						);
						return found ? String(found[1] ?? "").trim() : "";
					};

					const rackLabel = get("STORAGE_BIN_CODE");
					const skuCode = get("ITEM_CODE");
					const description = get("DESC_01");
					const batchNo = get("BATCH_NO");
					const expiryRaw = row[
						Object.keys(row).find((k) => k.trim().toUpperCase() === "EXPIRY_DATE") ?? ""
					];
					const expiryDate = parseExcelDate(expiryRaw);
					const signRaw = get("SIGN");
					const sign: "+" | "-" = signRaw === "-" ? "-" : "+";
					const qtyRaw = get("QTY");
					const qty = parseFloat(qtyRaw) || 0;

					const rackId = rackLabel ? resolveRackId(rackLabel) : null;

					let error: string | null = null;
					if (!rackLabel) error = "Missing STORAGE_BIN_CODE";
					else if (!rackId) error = `Rack "${rackLabel}" not found`;
					else if (!skuCode) error = "Missing ITEM_CODE";
					else if (qty <= 0) error = "QTY must be > 0";

					return {
						lineNo: get("LINE_NO") || String(i + 1),
						rackLabel,
						skuCode,
						description,
						batchNo,
						expiryDate,
						sign,
						qty,
						rackId,
						error,
					};
				});

				setPreview(parsed);
			} catch {
				toast.error("Failed to parse Excel file. Make sure it's a valid .xlsx file.");
			}
		};
		reader.readAsArrayBuffer(file);
	}

	const validRows = preview?.filter((r) => !r.error) ?? [];
	const errorRows = preview?.filter((r) => r.error) ?? [];
	const hasErrors = errorRows.length > 0;

	async function handleSubmit() {
		if (!validRows.length) {
			toast.error("No valid rows to import.");
			return;
		}

		// We need skuIds — look them up via the sku combobox query is expensive here.
		// Instead, pass skuCode to a backend that accepts it. But the mutation requires skuId.
		// We'll need to resolve skuIds. Let's check if we can pass skuCode — no, the mutation
		// takes skuId. We need to fetch SKUs for all codes.
		// Use the existing stockQuants or skus query to resolve codes → ids.
		const uniqueCodes = [...new Set(validRows.map((r) => r.skuCode))];
		let skuMap: Map<string, string>;
		try {
			const result = await gqlRequest<{
				skus: { query: Array<{ skuId: string; skuCode: string }> };
			}>(
				`query ResolveSkus($codes: [String!]!) {
					skus(filter: { skuCodes: $codes }, pageSize: 500, pageNumber: 1) {
						query { skuId skuCode }
					}
				}`,
				{ codes: uniqueCodes },
			);
			skuMap = new Map(
				(result?.skus?.query ?? []).map((s) => [s.skuCode.trim(), s.skuId]),
			);
		} catch {
			toast.error("Failed to resolve SKU codes. Please try again.");
			return;
		}

		const unresolvedSkus = uniqueCodes.filter((c) => !skuMap.has(c));
		if (unresolvedSkus.length > 0) {
			toast.error(`SKU codes not found: ${unresolvedSkus.join(", ")}`);
			return;
		}

		const items = validRows.map((row) => ({
			skuId: skuMap.get(row.skuCode)!,
			rackId: row.rackId!,
			lotNo: row.batchNo || null,
			expiryDate: expiryDateToApi(row.expiryDate),
			movementType: "ADJUSTMENT",
			quantity: String(row.sign === "-" ? -row.qty : row.qty),
			remarks: null,
		}));

		await createMutation({
			reason: reason.trim() || `Excel import: ${fileName}`,
			notes: null,
			items,
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
			<DialogContent className="w-[min(96vw,900px)] max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border-2 border-border sm:max-w-[900px] p-0">
				<DialogHeader className="border-b border-border/60 bg-muted/50 px-6 py-4 shrink-0">
					<DialogTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Import Stock Adjustment from Excel
					</DialogTitle>
					<DialogDescription style={{ fontFamily: "var(--dashboard-body)" }}>
						Upload a COUNT_ADJ Excel file. Columns used: STORAGE_BIN_CODE, ITEM_CODE,
						BATCH_NO, EXPIRY_DATE, SIGN (+/−), QTY. Each row becomes one ADJUSTMENT
						line item.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
					{/* File + Reason */}
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label>Excel File</Label>
							<div className="flex gap-2 items-center">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="gap-2 shrink-0"
									onClick={() => fileInputRef.current?.click()}
								>
									<Upload className="h-4 w-4" />
									Choose file
								</Button>
								<span className="text-sm text-muted-foreground truncate">
									{fileName || "No file chosen"}
								</span>
							</div>
							<input
								ref={fileInputRef}
								type="file"
								accept=".xlsx,.xls"
								className="hidden"
								onChange={handleFile}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="import-reason">Reason (optional)</Label>
							<Input
								id="import-reason"
								placeholder={`Excel import: ${fileName || "COUNT_ADJ_..."}`}
								value={reason}
								onChange={(e) => setReason(e.target.value)}
							/>
						</div>
					</div>

					{/* Preview */}
					{preview && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<p className="text-sm font-semibold">
									Preview —{" "}
									<span className="text-green-600">{validRows.length} valid</span>
									{hasErrors && (
										<span className="text-destructive ml-2">
											, {errorRows.length} error{errorRows.length > 1 ? "s" : ""}
										</span>
									)}
								</p>
								{hasErrors && (
									<div className="flex items-center gap-1 text-xs text-destructive">
										<AlertCircle className="h-3.5 w-3.5" />
										Rows with errors will be skipped
									</div>
								)}
							</div>

							<div className="overflow-x-auto rounded-lg border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10">#</TableHead>
											<TableHead>Rack</TableHead>
											<TableHead>SKU Code</TableHead>
											<TableHead>Description</TableHead>
											<TableHead>Batch</TableHead>
											<TableHead>Expiry</TableHead>
											<TableHead className="text-right">Qty</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{preview.map((row) => (
											<TableRow
												key={row.lineNo}
												className={row.error ? "bg-destructive/5" : undefined}
											>
												<TableCell className="text-muted-foreground text-xs">
													{row.lineNo}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{row.rackLabel || "-"}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{row.skuCode || "-"}
												</TableCell>
												<TableCell className="text-sm max-w-[200px] truncate">
													{row.description || "-"}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{row.batchNo || "-"}
												</TableCell>
												<TableCell className="text-sm">
													{row.expiryDate || "-"}
												</TableCell>
												<TableCell className="text-right font-mono font-semibold">
													<span
														className={
															row.sign === "-"
																? "text-destructive"
																: "text-green-600"
														}
													>
														{row.sign}
														{row.qty}
													</span>
												</TableCell>
												<TableCell>
													{row.error ? (
														<Badge variant="destructive" className="text-xs whitespace-nowrap">
															{row.error}
														</Badge>
													) : (
														<Badge variant="outline" className="text-xs text-green-600 border-green-300">
															OK
														</Badge>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}

					{!preview && (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3 border-2 border-dashed rounded-lg">
							<FileSpreadsheet className="h-10 w-10 opacity-40" />
							<p className="text-sm">Upload a COUNT_ADJ Excel file to preview rows</p>
						</div>
					)}
				</div>

				<DialogFooter className="border-t border-border/60 px-6 pt-4 pb-4 gap-2 shrink-0">
					<Button variant="outline" onClick={handleClose} disabled={submitting}>
						Cancel
					</Button>
					<Button
						type="button"
						className="gap-2 text-white disabled:opacity-50"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
						onClick={handleSubmit}
						disabled={submitting || !preview || validRows.length === 0}
					>
						{submitting
							? "Creating…"
							: `Create adjustment (${validRows.length} line${validRows.length !== 1 ? "s" : ""})`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
