import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { gqlRequest } from "@/lib/api/gql";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
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
import {
	CheckCircle2,
	XCircle,
	AlertCircle,
	FileSpreadsheet,
	Upload,
	CheckCheck,
	Ban,
} from "lucide-react";
import { CREATE_OUTLET_MUTATION, OUTLETS_QUERY } from "@/lib/graphql/outlets";
import type {
	OutletsQueryData,
	OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import type { Region } from "@/lib/graphql/types";

type ImportRow = {
	outletName: string;
	outletCode: string;
	address?: string;
	regionCode?: string;
	regionId?: string;
	errors: string[];
	duplicate?: boolean;
};

type ImportState = "idle" | "preview" | "importing" | "done";

export function OutletImportDialog({
	open,
	onOpenChange,
	regions,
	createdBy,
	onComplete,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	regions: Region[];
	createdBy: string;
	onComplete: () => void;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [rows, setRows] = useState<ImportRow[]>([]);
	const [fileName, setFileName] = useState<string>("");
	const [state, setState] = useState<ImportState>("idle");
	const [isDragging, setIsDragging] = useState(false);
	const [progress, setProgress] = useState({ done: 0, total: 0 });
	const [results, setResults] = useState<{ success: number; failed: number }>({
		success: 0,
		failed: 0,
	});

	const regionByCode = Object.fromEntries(
		regions.map((r) => [r.regionCode?.toUpperCase() ?? "", r.regionId]),
	);

	function parseFile(file: File) {
		setFileName(file.name);
		const reader = new FileReader();
		reader.onload = async (e) => {
			const data = new Uint8Array(e.target?.result as ArrayBuffer);
			const wb = XLSX.read(data, { type: "array" });
			const sheet = wb.Sheets[wb.SheetNames[0]];
			const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
				defval: "",
			});

			const parsed: ImportRow[] = raw.map((r) => {
				const outletName = String(r.outletName ?? "").trim();
				const outletCode = String(r.outletCode ?? "").trim();
				// Accept both column name variants from the spreadsheet
				const address = String(r.outletAddress ?? r.address ?? "").trim();
				const regionCode = String(r.regionCode ?? "")
					.trim()
					.toUpperCase();
				const errors: string[] = [];

				if (!outletName) errors.push("outletName is required");
				if (!outletCode) errors.push("outletCode is required");

				let regionId: string | undefined;
				if (regionCode) {
					regionId = regionByCode[regionCode];
					if (!regionId) errors.push(`Unknown regionCode "${regionCode}"`);
				}

				return {
					outletName,
					outletCode,
					address,
					regionCode,
					regionId,
					errors,
				};
			});

			// Check for duplicates against existing outlets
			const codesToCheck = parsed
				.filter((r) => r.outletCode)
				.map((r) => r.outletCode);

			let existingCodes = new Set<string>();
			if (codesToCheck.length > 0) {
				try {
					const existingData = await gqlRequest<
						OutletsQueryData,
						OutletsQueryVariables
					>(OUTLETS_QUERY, {
						filter: { outletCodes: codesToCheck },
						pageSize: codesToCheck.length,
						pageNumber: 1,
					});
					existingCodes = new Set(
						existingData.outlets.query.map(
							(o) => o.outletCode?.toUpperCase() ?? "",
						),
					);
				} catch {
					// If query fails, proceed without duplicate detection
				}
			}

			const withDuplicates = parsed.map((row) => ({
				...row,
				duplicate: row.outletCode
					? existingCodes.has(row.outletCode.toUpperCase())
					: false,
			}));

			setRows(withDuplicates);
			setState("preview");
			setProgress({ done: 0, total: withDuplicates.length });
			setResults({ success: 0, failed: 0 });
		};
		reader.readAsArrayBuffer(file);
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) parseFile(file);
		e.target.value = "";
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (file && file.name.endsWith(".xlsx")) parseFile(file);
	}

	const validRows = rows.filter((r) => r.errors.length === 0 && !r.duplicate);
	const invalidRows = rows.filter((r) => r.errors.length > 0);
	const duplicateRows = rows.filter(
		(r) => r.duplicate && r.errors.length === 0,
	);

	async function handleImport() {
		setState("importing");
		let success = 0;
		let failed = 0;

		for (let i = 0; i < validRows.length; i++) {
			const row = validRows[i];
			try {
				await gqlRequest(CREATE_OUTLET_MUTATION, {
					input: {
						outletName: row.outletName,
						outletCode: row.outletCode,
						address: row.address || undefined,
						regionId: row.regionId ?? null,
						createdBy,
						updatedBy: createdBy,
					},
				});
				success++;
			} catch {
				failed++;
			}
			setProgress({ done: i + 1, total: validRows.length });
		}

		setResults({ success, failed });
		setState("done");
		onComplete();
	}

	function handleClose() {
		setRows([]);
		setFileName("");
		setState("idle");
		setProgress({ done: 0, total: 0 });
		setResults({ success: 0, failed: 0 });
		onOpenChange(false);
	}

	const pct =
		progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
			<DialogContent className="max-w-4xl rounded-2xl border-2 border-border bg-background shadow-xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
				{/* Header */}
				<DialogHeader className="shrink-0 px-6 py-5 border-b bg-muted/40">
					<div className="flex items-center gap-3">
						<div
							className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
							style={{ backgroundColor: "var(--dashboard-accent)" }}
						>
							<FileSpreadsheet className="h-4 w-4 text-white" />
						</div>
						<div>
							<DialogTitle
								className="text-lg leading-tight"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Import Outlets
							</DialogTitle>
							<p
								className="text-xs text-muted-foreground mt-0.5"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Upload a{" "}
								<code className="rounded bg-muted px-1 font-mono">.xlsx</code>{" "}
								file with columns:{" "}
								<code className="rounded bg-muted px-1 font-mono text-[11px]">
									outletName
								</code>{" "}
								<code className="rounded bg-muted px-1 font-mono text-[11px]">
									outletCode
								</code>{" "}
								<code className="rounded bg-muted px-1 font-mono text-[11px]">
									address
								</code>{" "}
								<code className="rounded bg-muted px-1 font-mono text-[11px]">
									regionCode
								</code>
							</p>
						</div>
					</div>
				</DialogHeader>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
					{/* Drop zone — show when idle or can re-upload */}
					{state !== "importing" && state !== "done" && (
						<div
							role="button"
							tabIndex={0}
							onClick={() => fileInputRef.current?.click()}
							onKeyDown={(e) =>
								e.key === "Enter" && fileInputRef.current?.click()
							}
							onDragOver={(e) => {
								e.preventDefault();
								setIsDragging(true);
							}}
							onDragLeave={() => setIsDragging(false)}
							onDrop={handleDrop}
							className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-all duration-200 select-none"
							style={{
								borderColor: isDragging ? "var(--dashboard-accent)" : undefined,
								backgroundColor: isDragging
									? "oklch(from var(--dashboard-accent) l c h / 0.05)"
									: undefined,
							}}
						>
							<input
								ref={fileInputRef}
								type="file"
								accept=".xlsx"
								className="hidden"
								onChange={handleFileChange}
							/>
							<div
								className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
								style={{
									backgroundColor: isDragging
										? "oklch(from var(--dashboard-accent) l c h / 0.15)"
										: "var(--dashboard-accent-muted, oklch(0.92 0.04 70))",
								}}
							>
								<Upload
									className="h-5 w-5 transition-colors"
									style={{ color: "var(--dashboard-accent)" }}
								/>
							</div>
							{fileName ? (
								<div className="text-center">
									<p
										className="text-sm font-medium"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										{fileName}
									</p>
									<p
										className="text-xs text-muted-foreground mt-0.5"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										Click or drop to replace
									</p>
								</div>
							) : (
								<div className="text-center">
									<p
										className="text-sm font-medium"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										Drop your file here, or{" "}
										<span style={{ color: "var(--dashboard-accent)" }}>
											browse
										</span>
									</p>
									<p
										className="text-xs text-muted-foreground mt-0.5"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										Supports .xlsx files only
									</p>
								</div>
							)}
						</div>
					)}

					{/* Stats bar after parsing */}
					{rows.length > 0 && state !== "idle" && state !== "done" && (
						<div className="flex items-center gap-2 flex-wrap">
							<div
								className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								<span className="tabular-nums font-semibold text-foreground">
									{rows.length}
								</span>
								rows total
							</div>
							{validRows.length > 0 && (
								<div
									className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
									style={{
										fontFamily: "var(--dashboard-body)",
										backgroundColor:
											"oklch(from var(--dashboard-accent) l c h / 0.1)",
										color: "var(--dashboard-accent)",
									}}
								>
									<CheckCircle2 className="h-3 w-3" />
									<span className="tabular-nums font-semibold">
										{validRows.length}
									</span>
									ready to import
								</div>
							)}
							{invalidRows.length > 0 && (
								<div
									className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									<XCircle className="h-3 w-3" />
									<span className="tabular-nums font-semibold">
										{invalidRows.length}
									</span>
									with errors
								</div>
							)}
							{duplicateRows.length > 0 && (
								<div
									className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
									style={{
										fontFamily: "var(--dashboard-body)",
										backgroundColor: "oklch(0.75 0.15 60 / 0.15)",
										color: "oklch(0.55 0.15 60)",
									}}
								>
									<Ban className="h-3 w-3" />
									<span className="tabular-nums font-semibold">
										{duplicateRows.length}
									</span>
									already in system
								</div>
							)}
						</div>
					)}

					{/* Importing progress */}
					{state === "importing" && (
						<div className="space-y-3 rounded-xl border p-4 bg-muted/30">
							<div className="flex items-center justify-between">
								<p
									className="text-sm font-medium"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Importing outlets…
								</p>
								<span
									className="text-sm tabular-nums font-semibold"
									style={{
										color: "var(--dashboard-accent)",
										fontFamily: "var(--dashboard-display)",
									}}
								>
									{progress.done} / {progress.total}
								</span>
							</div>
							<div className="h-2 w-full rounded-full bg-muted overflow-hidden">
								<div
									className="h-full rounded-full transition-all duration-300"
									style={{
										width: `${pct}%`,
										backgroundColor: "var(--dashboard-accent)",
									}}
								/>
							</div>
							<p
								className="text-xs text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{pct}% complete
							</p>
						</div>
					)}

					{/* Done summary */}
					{state === "done" && (
						<div
							className="flex items-center gap-4 rounded-xl border-2 p-5"
							style={{
								borderColor: "var(--dashboard-accent)",
								backgroundColor:
									"oklch(from var(--dashboard-accent) l c h / 0.05)",
							}}
						>
							<div
								className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
								style={{ backgroundColor: "var(--dashboard-accent)" }}
							>
								<CheckCheck className="h-6 w-6 text-white" />
							</div>
							<div>
								<p
									className="font-semibold text-base"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Import complete
								</p>
								<p
									className="text-sm text-muted-foreground mt-0.5"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									<span
										className="font-semibold"
										style={{ color: "var(--dashboard-accent)" }}
									>
										{results.success}
									</span>{" "}
									outlet{results.success !== 1 ? "s" : ""} imported successfully
									{results.failed > 0 && (
										<>
											{" "}
											·{" "}
											<span className="font-semibold text-destructive">
												{results.failed}
											</span>{" "}
											failed
										</>
									)}
									{duplicateRows.length > 0 && (
										<>
											{" "}
											·{" "}
											<span
												className="font-semibold"
												style={{ color: "oklch(0.55 0.15 60)" }}
											>
												{duplicateRows.length}
											</span>{" "}
											skipped (already in system)
										</>
									)}
								</p>
							</div>
						</div>
					)}

					{/* Preview table */}
					{rows.length > 0 && state !== "done" && (
						<div className="rounded-xl border overflow-hidden">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent bg-muted/40">
										<TableHead className="w-10 px-4" />
										<TableHead
											className="px-4 text-xs font-semibold uppercase tracking-wide"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											Outlet Name
										</TableHead>
										<TableHead
											className="px-4 text-xs font-semibold uppercase tracking-wide"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											Code
										</TableHead>
										<TableHead
											className="px-4 text-xs font-semibold uppercase tracking-wide"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											Region
										</TableHead>
										<TableHead
											className="px-4 text-xs font-semibold uppercase tracking-wide"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											Status
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((row, i) => (
										<TableRow
											key={i}
											className="relative transition-colors"
											style={
												row.duplicate
													? { backgroundColor: "oklch(0.75 0.15 60 / 0.06)" }
													: row.errors.length > 0
														? {
																backgroundColor:
																	"oklch(0.628 0.2577 29.23 / 0.04)",
															}
														: {}
											}
										>
											{/* Accent left strip */}
											{row.errors.length === 0 && !row.duplicate && (
												<td
													aria-hidden
													className="absolute left-0 top-0 h-full w-0.5 rounded-l"
													style={{
														backgroundColor:
															"oklch(from var(--dashboard-accent) l c h / 0.5)",
													}}
												/>
											)}
											<TableCell className="px-4 w-10">
												{row.duplicate ? (
													<Ban
														className="h-4 w-4"
														style={{ color: "oklch(0.55 0.15 60)" }}
													/>
												) : row.errors.length === 0 ? (
													<CheckCircle2
														className="h-4 w-4"
														style={{ color: "var(--dashboard-accent)" }}
													/>
												) : (
													<XCircle className="h-4 w-4 text-destructive" />
												)}
											</TableCell>
											<TableCell
												className="px-4 font-medium text-sm"
												style={{ fontFamily: "var(--dashboard-body)" }}
											>
												{row.outletName || (
													<span className="text-muted-foreground italic">
														(empty)
													</span>
												)}
											</TableCell>
											<TableCell className="px-4 font-mono text-xs text-muted-foreground">
												{row.outletCode || (
													<span className="italic">(empty)</span>
												)}
											</TableCell>
											<TableCell
												className="px-4 text-sm"
												style={{ fontFamily: "var(--dashboard-body)" }}
											>
												{row.regionCode ? (
													<span
														className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
														style={{
															backgroundColor:
																"oklch(from var(--dashboard-accent) l c h / 0.1)",
															color: "var(--dashboard-accent)",
															fontFamily: "var(--dashboard-body)",
														}}
													>
														{row.regionCode}
													</span>
												) : (
													<span className="text-muted-foreground text-xs">
														—
													</span>
												)}
											</TableCell>
											<TableCell className="px-4">
												{row.duplicate ? (
													<span
														className="text-xs font-medium"
														style={{
															color: "oklch(0.55 0.15 60)",
															fontFamily: "var(--dashboard-body)",
														}}
													>
														Not imported — already in system
													</span>
												) : row.errors.length > 0 ? (
													<div className="flex flex-col gap-0.5">
														{row.errors.map((err, j) => (
															<span
																key={j}
																className="flex items-center gap-1 text-xs text-destructive"
																style={{ fontFamily: "var(--dashboard-body)" }}
															>
																<AlertCircle className="h-3 w-3 shrink-0" />
																{err}
															</span>
														))}
													</div>
												) : (
													<span
														className="text-xs font-medium"
														style={{
															color: "var(--dashboard-accent)",
															fontFamily: "var(--dashboard-body)",
														}}
													>
														Ready
													</span>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</div>

				{/* Footer */}
				<DialogFooter className="shrink-0 border-t bg-muted/20 px-6 py-4">
					{state === "done" ? (
						<Button
							onClick={handleClose}
							className="rounded-lg text-white"
							style={{ backgroundColor: "var(--dashboard-accent)" }}
						>
							Close
						</Button>
					) : (
						<>
							<Button
								variant="outline"
								onClick={handleClose}
								disabled={state === "importing"}
								className="rounded-lg"
							>
								Cancel
							</Button>
							<Button
								onClick={handleImport}
								disabled={validRows.length === 0 || state === "importing"}
								className="rounded-lg text-white hover:opacity-90 transition-opacity"
								style={{ backgroundColor: "var(--dashboard-accent)" }}
							>
								{state === "importing"
									? `Importing… ${progress.done}/${progress.total}`
									: `Import ${validRows.length > 0 ? validRows.length : ""} Outlet${validRows.length !== 1 ? "s" : ""}`}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
