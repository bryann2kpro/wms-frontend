import { useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { format } from "date-fns";
import {
	AlertTriangle,
	CheckCircle2,
	Copy,
	Loader2,
	Upload,
	XCircle,
} from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	OutletCombobox,
	type OutletOption,
} from "@/components/outbound/outlet-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { CreatePurchaseOrderInput } from "@/data/purchase-orders.types";
import {
	OUTLETS_QUERY,
	type OutletsQueryData,
	type OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import {
	SKUS_QUERY,
	type SkusQueryData,
	type SkusQueryVariables,
} from "@/lib/graphql/skus";
import type { Skus } from "@/lib/graphql/types";
import {
	buildImportReviewRows,
	type ImportReviewRow,
	parseDeliveryExcel,
} from "@/lib/outbound-excel-import";
import { copyErrorReport } from "@/lib/error-report";
import { cn } from "@/lib/utils";

export type ImportRowResult = {
	purchaseOrderNumber: string;
	success: boolean;
	error?: string;
	/** Structured JSON error report for developer triage — copy to clipboard. */
	report?: string;
};

export interface ImportExcelDialogProps {
	/** Create purchase orders; called with one input per selected row. */
	onImport: (inputs: CreatePurchaseOrderInput[]) => Promise<ImportRowResult[]>;
	disabled?: boolean;
	triggerClassName?: string;
}

type Step = "pick" | "review" | "importing" | "done";

function formatMaybeDate(d: Date | null): string {
	if (!d || Number.isNaN(d.getTime())) return "—";
	return format(d, "dd/MM/yyyy");
}

function buildCreateInput(
	row: ImportReviewRow,
	outletId: string,
	outlets: OutletOption[],
): CreatePurchaseOrderInput | null {
	if (!outletId || row.resolvedItems.length === 0) return null;
	const outlet = outlets.find((o) => o.outletId === outletId);
	return {
		purchaseOrderNumber: row.parsed.purchaseOrderNumber,
		outletId,
		outletName: outlet?.outletName ?? row.parsed.outletName,
		expectedDeliveryDate: row.parsed.expectedDeliveryDate ?? new Date(),
		items: row.resolvedItems.map((i) => ({
			skuId: i.skuId,
			skuCode: i.skuCode,
			quantity: i.quantity,
		})),
		isEmergency: false,
	};
}

function rowCanImport(
	row: ImportReviewRow,
	effectiveOutletId: string | null | undefined,
): boolean {
	return Boolean(effectiveOutletId) && row.resolvedItems.length > 0;
}

export function ImportExcelDialog({
	onImport,
	disabled = false,
	triggerClassName,
}: ImportExcelDialogProps) {
	const dialogTitleId = useId();
	const dialogDescId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<Step>("pick");
	const [outletIdByRow, setOutletIdByRow] = useState<
		Record<number, string | null | undefined>
	>({});
	const [reviewRows, setReviewRows] = useState<ImportReviewRow[]>([]);
	const [importResults, setImportResults] = useState<ImportRowResult[] | null>(
		null,
	);

	const {
		data: outletsData,
		isLoading: outletsLoading,
		refetch: refetchOutlets,
	} = useQuery({
		queryKey: [...qk.outlets.all, { pageSize: 500, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<OutletsQueryData, OutletsQueryVariables>(OUTLETS_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
		enabled: open,
	});

	const { data: skusData, isLoading: skusLoading } = useQuery({
		queryKey: qk.skus.all,
		queryFn: () => gqlRequest<SkusQueryData, SkusQueryVariables>(SKUS_QUERY, {}),
		enabled: open,
	});

	const outletsRaw = outletsData?.outlets?.query ?? [];
	const skus: Skus[] = skusData?.skus?.query ?? [];

	const outletOptions: OutletOption[] = useMemo(
		() =>
			outletsRaw.map((o) => ({
				outletId: o.outletId,
				outletName: o.outletName,
				outletCode: o.outletCode,
			})),
		[outletsRaw],
	);

	const catalogLoading = outletsLoading || skusLoading;

	const resetDialog = useCallback(() => {
		setStep("pick");
		setReviewRows([]);
		setOutletIdByRow({});
		setImportResults(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}, []);

	const handleOpenChange = useCallback(
		(next: boolean) => {
			setOpen(next);
			if (!next) resetDialog();
		},
		[resetDialog],
	);

	function effectiveOutletId(
		rowIndex: number,
		row: ImportReviewRow,
	): string | null {
		const manual = outletIdByRow[rowIndex];
		if (manual !== undefined && manual !== null && manual !== "") return manual;
		return row.autoOutletId;
	}

	const handlePickFile = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			if (catalogLoading) {
				toast.message(
					"Still loading outlets and SKUs — try again in a moment.",
				);
				return;
			}

			const result = await parseDeliveryExcel(file);
			if (!result.ok) {
				toast.error(result.error);
				return;
			}

			const skuRefs = skus.map((s) => ({
				skuId: s.skuId,
				skuCode: s.skuCode,
			}));
			const outletRefs = outletOptions.map((o) => ({
				outletId: o.outletId,
				outletName: o.outletName,
				outletCode: o.outletCode,
			}));

			const built = buildImportReviewRows(result.rows, outletRefs, skuRefs);
			setReviewRows(built);

			const initial: Record<number, string | null> = {};
			for (const r of built) {
				initial[r.rowIndex] = r.autoOutletId;
			}
			setOutletIdByRow(initial);
			setStep("review");
			toast.success(
				`Parsed ${built.length} purchase order${built.length === 1 ? "" : "s"}. Review and confirm.`,
			);
		},
		[catalogLoading, outletOptions, skus],
	);

	const allRowsReady = useMemo(() => {
		if (reviewRows.length === 0) return false;
		return reviewRows.every((r) => {
			const manual = outletIdByRow[r.rowIndex];
			const oid =
				manual !== undefined && manual !== null && manual !== ""
					? manual
					: r.autoOutletId;
			return rowCanImport(r, oid);
		});
	}, [reviewRows, outletIdByRow]);

	const runImport = useCallback(async () => {
		if (!allRowsReady) return;

		const inputs: CreatePurchaseOrderInput[] = [];
		for (const r of reviewRows) {
			const manual = outletIdByRow[r.rowIndex];
			const oid =
				manual !== undefined && manual !== null && manual !== ""
					? manual
					: r.autoOutletId;
			if (!oid) continue;
			const input = buildCreateInput(r, oid, outletOptions);
			if (input) inputs.push(input);
		}

		if (inputs.length === 0) {
			toast.error("Nothing to import.");
			return;
		}

		setStep("importing");

		try {
			const results = await onImport(inputs);
			setImportResults(results);
			setStep("done");
			const ok = results.filter((x) => x.success).length;
			const fail = results.length - ok;
			if (fail === 0) {
				toast.success(
					ok === 1
						? "Imported 1 purchase order."
						: `Imported ${ok} purchase orders.`,
				);
			} else if (ok === 0) {
				toast.error("Import failed for all rows.");
			} else {
				toast.warning(`Imported ${ok}; ${fail} failed.`);
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Import failed unexpectedly.",
			);
			setStep("review");
		}
	}, [allRowsReady, reviewRows, outletIdByRow, outletOptions, onImport]);

	return (
		<>
			<input
				ref={fileInputRef}
				type="file"
				accept=".xlsx,.xls"
				className="sr-only"
				aria-hidden
				tabIndex={-1}
				onChange={handleFileChange}
			/>
			<Button
				type="button"
				variant="outline"
				className={cn("rounded-lg gap-2", triggerClassName)}
				disabled={disabled}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => {
					resetDialog();
					setOpen(true);
				}}
			>
				<Upload className="h-4 w-4" aria-hidden />
				Import Excel
			</Button>

			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent
					className="max-h-[90vh] overflow-y-auto sm:max-w-4xl rounded-2xl border-2 border-border"
					aria-labelledby={dialogTitleId}
					aria-describedby={dialogDescId}
					aria-busy={step === "importing"}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<DialogHeader className="border-b bg-muted/50 -mx-6 px-6 py-4">
						<DialogTitle
							id={dialogTitleId}
							className="text-lg"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Import purchase orders from Excel
						</DialogTitle>
						<DialogDescription id={dialogDescId} className="text-sm">
							{step === "pick" &&
								"Use the wide-format delivery file: one row per PO, SKU codes in columns from F onward."}
							{step === "review" &&
								"Resolve any unmatched outlets, review SKU warnings, then confirm."}
							{step === "importing" && "Creating purchase orders…"}
							{step === "done" && "Import finished. Review the results below."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						{step === "pick" && (
							<div className="space-y-4">
								{catalogLoading ? (
									<output
										className="flex items-center gap-2 text-sm text-muted-foreground"
										aria-live="polite"
									>
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Loading outlets and SKU catalog…
									</output>
								) : (
									<p className="text-sm text-muted-foreground">
										Select an .xlsx file. The first sheet should have headers:
										Outlet (column C), Expected Arrival Date (column D), and SKU
										codes from column F.
									</p>
								)}
								<Button
									type="button"
									className="gap-2 text-white"
									style={{
										background: "var(--dashboard-accent)",
										borderColor: "var(--dashboard-accent)",
									}}
									disabled={disabled || catalogLoading}
									onClick={handlePickFile}
								>
									<Upload className="h-4 w-4" aria-hidden />
									Choose Excel file
								</Button>
							</div>
						)}

						{step === "review" && reviewRows.length > 0 && (
							<div className="space-y-3">
								<div className="max-h-[min(420px,50vh)] overflow-auto rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="min-w-[120px]">
													PO number
												</TableHead>
												<TableHead className="min-w-[200px]">Outlet</TableHead>
												<TableHead className="min-w-[100px]">Arrival</TableHead>
												<TableHead className="min-w-[160px]">Lines</TableHead>
												<TableHead className="min-w-[120px]">Status</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{reviewRows.map((row) => {
												const oid = effectiveOutletId(row.rowIndex, row);
												const ready = rowCanImport(row, oid);
												const outletLabel = row.parsed.outletName || "—";
												return (
													<TableRow key={row.rowIndex}>
														<TableCell className="font-mono text-xs align-top">
															{row.parsed.purchaseOrderNumber}
														</TableCell>
														<TableCell className="align-top">
															<div className="space-y-2">
																<p className="text-xs text-muted-foreground">
																	File: {outletLabel}
																</p>
																<OutletCombobox
																	value={oid ?? ""}
																	onChange={(id) =>
																		setOutletIdByRow((prev) => ({
																			...prev,
																			[row.rowIndex]: id,
																		}))
																	}
																	outlets={outletOptions}
																	onOutletCreated={() => void refetchOutlets()}
																	placeholder="Select outlet…"
																	className="w-full max-w-[280px]"
																	aria-invalid={!oid}
																/>
															</div>
														</TableCell>
														<TableCell className="text-sm align-top whitespace-nowrap">
															{formatMaybeDate(row.parsed.expectedDeliveryDate)}
														</TableCell>
														<TableCell className="align-top text-xs">
															<div className="space-y-1">
																<span className="text-muted-foreground">
																	{row.resolvedItems.length} SKU
																	{row.resolvedItems.length === 1 ? "" : "s"}
																</span>
																{row.unmatchedSkuCodes.length > 0 ? (
																	<div className="flex flex-wrap gap-1 pt-1">
																		{row.unmatchedSkuCodes.map((code) => (
																			<Badge
																				key={code}
																				variant="outline"
																				className="border-amber-500/60 text-amber-800 dark:text-amber-200 text-[10px]"
																			>
																				<AlertTriangle
																					className="mr-0.5 h-3 w-3 shrink-0"
																					aria-hidden
																				/>
																				{code} missing
																			</Badge>
																		))}
																	</div>
																) : null}
															</div>
														</TableCell>
														<TableCell className="align-top">
															{ready ? (
																<Badge className="bg-emerald-600 hover:bg-emerald-600">
																	Ready
																</Badge>
															) : (
																<Badge variant="destructive">
																	{row.resolvedItems.length === 0
																		? "No SKUs"
																		: "Pick outlet"}
																</Badge>
															)}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							</div>
						)}

						{step === "importing" && (
							<output
								className="flex flex-col items-center gap-3 py-8"
								aria-live="polite"
							>
								<Loader2 className="h-10 w-10 animate-spin text-[var(--dashboard-accent)]" />
								<p className="text-sm font-medium">
									Importing purchase orders…
								</p>
							</output>
						)}

						{step === "done" && importResults && (
							<ul className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
								{importResults.map((r) => (
									<li
										key={r.purchaseOrderNumber}
										className="flex items-start gap-2"
									>
										{r.success ? (
											<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
										) : (
											<XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
										)}
										<span className="font-mono text-xs">
											{r.purchaseOrderNumber}
										</span>
										{r.success ? (
											<span className="text-muted-foreground">Imported</span>
										) : (
											<span className="text-destructive">
												{r.error ?? "Failed"}
											</span>
										)}
									</li>
								))}
							</ul>
						)}
					</div>

					<DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
						{step === "review" && (
							<>
								<Button
									type="button"
									variant="outline"
									onClick={() => setStep("pick")}
								>
									Back
								</Button>
								<Button
									type="button"
									className="text-white disabled:opacity-50"
									style={{
										background: "var(--dashboard-accent)",
										borderColor: "var(--dashboard-accent)",
									}}
									disabled={!allRowsReady}
									onClick={() => void runImport()}
								>
									Confirm import
								</Button>
							</>
						)}
						{(step === "pick" || step === "done") && (
							<>
								{step === "done" && importResults && (
									(() => {
										const failedReports = importResults
											.filter((r) => !r.success && r.report)
											.map((r) => JSON.parse(r.report!));
										if (failedReports.length === 0) return null;
										return (
											<Button
												type="button"
												variant="outline"
												className="gap-2"
												onClick={async () => {
													const combined = JSON.stringify(failedReports, null, 2);
													const ok = await copyErrorReport(combined);
													toast[ok ? "success" : "error"](
														ok
															? `${failedReports.length} error report${failedReports.length > 1 ? "s" : ""} copied`
															: "Could not access clipboard",
													);
												}}
											>
												<Copy className="h-4 w-4" aria-hidden />
												Copy error details
											</Button>
										);
									})()
								)}
								<Button
									type="button"
									variant="secondary"
									onClick={() => handleOpenChange(false)}
								>
									{step === "done" ? "Close" : "Cancel"}
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
