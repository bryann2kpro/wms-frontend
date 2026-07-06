import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
	SYNC_STOCK_BALANCE_MUTATION,
	type StockBalanceSyncRowInput,
	type SyncStockBalanceMutationData,
	type SyncStockBalanceMutationVariables,
} from "@/lib/graphql/stock-quant";

/** Excel serial date -> ISO date string. Serial 25569 = 1970-01-01 (empty expiry in the source system). */
function excelSerialToIso(serial: unknown): string | null {
	const n = Number(serial);
	if (!Number.isFinite(n) || n <= 25569) return null;
	return new Date((Math.floor(n) - 25569) * 86400 * 1000).toISOString();
}

type ParsedFile = {
	fileName: string;
	rows: StockBalanceSyncRowInput[];
	skuSummary: { skuCode: string; rows: number; totalQty: number }[];
};

function parseStockBalanceWorkbook(
	fileName: string,
	data: ArrayBuffer,
): ParsedFile {
	const wb = XLSX.read(data, { type: "array" });
	const ws = wb.Sheets[wb.SheetNames[0]];
	if (!ws) throw new Error("The Excel file has no sheets.");
	const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
		defval: null,
	});

	const rows: StockBalanceSyncRowInput[] = [];
	for (const r of raw) {
		const binCode = String(r["Storage Bin Code"] ?? "").trim();
		const skuCode = String(r["Item Code"] ?? "").trim();
		const qty = Number(r["Unit Qty"] ?? 0);
		if (!binCode || !skuCode) continue;
		rows.push({
			binCode,
			skuCode,
			expiryDate: excelSerialToIso(r["Expiry Date"]),
			qty,
			description: r["Description"] ? String(r["Description"]) : null,
		});
	}
	if (rows.length === 0) {
		throw new Error(
			'No valid rows found. Expected columns: "Storage Bin Code", "Item Code", "Expiry Date", "Unit Qty".',
		);
	}

	const bySku = new Map<string, { rows: number; totalQty: number }>();
	for (const row of rows) {
		const entry = bySku.get(row.skuCode) ?? { rows: 0, totalQty: 0 };
		entry.rows++;
		entry.totalQty += row.qty;
		bySku.set(row.skuCode, entry);
	}
	const skuSummary = [...bySku.entries()]
		.map(([skuCode, v]) => ({ skuCode, ...v }))
		.sort((a, b) => a.skuCode.localeCompare(b.skuCode));

	return { fileName, rows, skuSummary };
}

export function ImportStockBalanceDialog() {
	const [open, setOpen] = useState(false);
	const [parsed, setParsed] = useState<ParsedFile | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	const { mutate: runSync, isPending: syncing } = useMutation({
		mutationFn: (vars: SyncStockBalanceMutationVariables) =>
			gqlRequest<SyncStockBalanceMutationData, SyncStockBalanceMutationVariables>(
				SYNC_STOCK_BALANCE_MUTATION,
				vars,
			),
		onSuccess(data) {
			const r = data.syncStockBalance;
			toast.success(
				`Stock balance synced: ${r.updated} updated, ${r.inserted} added, ${r.zeroed} zeroed, ${r.balancesUpdated} balances refreshed` +
					(r.reassignedDoItems > 0
						? `, ${r.reassignedDoItems} picklist item(s) reassigned`
						: ""),
			);
			if (r.skipped.length > 0) {
				toast.warning(
					`${r.skipped.length} row(s) skipped: ` +
						r.skipped
							.slice(0, 3)
							.map((s) => `${s.skuCode}@${s.binCode} (${s.reason})`)
							.join("; ") +
						(r.skipped.length > 3 ? " …" : ""),
				);
			}
			queryClient.invalidateQueries();
			setOpen(false);
			setParsed(null);
		},
		onError(error) {
			toast.error(`Sync failed: ${(error as Error).message}`);
		},
	});

	const handleFile = useCallback(async (file: File) => {
		setParseError(null);
		setParsed(null);
		try {
			const data = await file.arrayBuffer();
			setParsed(parseStockBalanceWorkbook(file.name, data));
		} catch (error) {
			setParseError((error as Error).message);
		}
	}, []);

	const totalQty = useMemo(
		() => parsed?.rows.reduce((sum, r) => sum + r.qty, 0) ?? 0,
		[parsed],
	);

	const handleOpenChange = (next: boolean) => {
		if (!next && syncing) return;
		setOpen(next);
		if (!next) {
			setParsed(null);
			setParseError(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-1.5">
					<FileSpreadsheet className="h-4 w-4" aria-hidden />
					Import Excel
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Import Stock Balance</DialogTitle>
					<DialogDescription>
						Upload the warehouse stock balance Excel (Storage Bin Code, Item
						Code, Expiry Date, Unit Qty). The file fully replaces portal stock:
						quantities and rack locations are synced to inventory and stock
						quant, and anything not in the file — including whole SKUs — is
						zeroed.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<input
						ref={fileInputRef}
						type="file"
						accept=".xlsx,.xls"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void handleFile(file);
							e.target.value = "";
						}}
					/>
					<Button
						type="button"
						variant="outline"
						className="w-full h-20 border-dashed"
						onClick={() => fileInputRef.current?.click()}
						disabled={syncing}
					>
						<div className="flex flex-col items-center gap-1">
							<Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
							<span className="text-sm">
								{parsed ? parsed.fileName : "Choose Excel file…"}
							</span>
						</div>
					</Button>

					{parseError && (
						<p className="text-sm text-destructive" role="alert">
							{parseError}
						</p>
					)}

					{parsed && (
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								{parsed.rows.length} rows · {parsed.skuSummary.length} SKUs ·
								total qty {totalQty.toLocaleString()}
							</p>
							<div className="rounded-lg border overflow-hidden">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="text-xs">SKU Code</TableHead>
											<TableHead className="text-xs text-right">Bins</TableHead>
											<TableHead className="text-xs text-right">
												Total Qty
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{parsed.skuSummary.map((s) => (
											<TableRow key={s.skuCode}>
												<TableCell className="font-mono text-xs">
													{s.skuCode}
												</TableCell>
												<TableCell className="text-right text-xs">
													{s.rows}
												</TableCell>
												<TableCell className="text-right text-xs font-semibold">
													{s.totalQty.toLocaleString()}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={syncing}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => parsed && runSync({ rows: parsed.rows })}
						disabled={!parsed || syncing}
					>
						{syncing ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
								Syncing…
							</>
						) : (
							"Sync Stock Balance"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
