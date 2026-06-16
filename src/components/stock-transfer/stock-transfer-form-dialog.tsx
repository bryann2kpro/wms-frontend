"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RackLocationCombobox } from "@/components/grn/rack-location-combobox";
import {
	WarehouseCombobox,
	type WarehouseOption,
} from "@/components/grn/warehouse-combobox";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import {
	CREATE_STOCK_TRANSFER_MUTATION,
	type CreateStockTransferLineInput,
} from "@/lib/graphql/stock-transfer";
import {
	STOCK_QUANTS_QUERY,
	type StockQuantsQueryData,
} from "@/lib/graphql/stock-quant";
import { WAREHOUSES_QUERY, type WarehousesQueryData } from "@/lib/graphql/warehouses";
import { ZONES_QUERY, type ZonesQueryData } from "@/lib/graphql/zones";
import type { Rack } from "@/lib/graphql/types";
import { toUserFriendlyMessage } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type TransferLineItem = {
	key: number;
	sourceRackId: string;
	sourceRackLabel: string;
	sourceStockQuantId: string;
	quantity: string;
	destWarehouseId: string;
	destRackId: string;
	destRackLabel: string;
};

type StockTransferFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "response" in err) {
		const first = (
			err as {
				response?: {
					errors?: Array<{
						message?: string;
						extensions?: { code?: string };
					}>;
				};
			}
		).response?.errors?.[0];
		if (first?.extensions?.code === "INTERNAL_SERVER_ERROR")
			return "Internal Server Error";
		const gql = first?.message;
		if (gql)
			return toUserFriendlyMessage(
				gql,
				"Something went wrong. Please try again.",
			);
	}
	if (err instanceof Error)
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	return "Something went wrong. Please try again.";
}

function available(quantity: string, reservedQty: string): number {
	const avail = Number(quantity) - Number(reservedQty);
	return Number.isFinite(avail) ? avail : 0;
}

// ============================================
// COMPONENT
// ============================================

let lineKeyCounter = 0;

function createEmptyLine(): TransferLineItem {
	return {
		key: ++lineKeyCounter,
		sourceRackId: "",
		sourceRackLabel: "",
		sourceStockQuantId: "",
		quantity: "",
		destWarehouseId: "",
		destRackId: "",
		destRackLabel: "",
	};
}

export function StockTransferFormDialog({
	open,
	onOpenChange,
	onSuccess,
}: StockTransferFormDialogProps) {
	const [remarks, setRemarks] = useState("");
	const [items, setItems] = useState<TransferLineItem[]>([createEmptyLine()]);

	// Warehouses for the destination selector.
	const whVars = { pageSize: 500, pageNumber: 1 };
	const { data: whData, refetch: refetchWarehouses } = useQuery({
		queryKey: [...qk.warehouses.all, whVars],
		queryFn: () => gqlRequest<WarehousesQueryData>(WAREHOUSES_QUERY, whVars),
		enabled: open,
	});
	const warehouses = whData?.warehouses?.query ?? [];

	// Zones map zoneId -> warehouseId so racks can be grouped by warehouse.
	const zonesVars = { pageSize: 1000, pageNumber: 1 };
	const { data: zonesData } = useQuery({
		queryKey: [...qk.zones.all, "warehouse-map", zonesVars],
		queryFn: () => gqlRequest<ZonesQueryData>(ZONES_QUERY, zonesVars),
		enabled: open,
	});
	const zoneToWarehouse = useMemo(() => {
		const map = new Map<string, string>();
		for (const z of zonesData?.zones?.query ?? []) {
			map.set(z.zoneId, z.warehouseId);
		}
		return map;
	}, [zonesData]);

	// All racks (with zoneId) so the destination rack list can be filtered by warehouse.
	const racksVars = { pageSize: 1000, pageNumber: 1 };
	const { data: racksData } = useQuery({
		queryKey: [...qk.racks.all, "transfer-all", racksVars],
		queryFn: () => gqlRequest<RacksQueryData>(RACKS_QUERY, racksVars),
		enabled: open,
	});
	const allRacks = racksData?.racks?.query ?? [];

	/** Resolve the warehouse a rack belongs to via its zone (null when unzoned). */
	const rackToWarehouse = useMemo(() => {
		const map = new Map<string, string | null>();
		for (const r of allRacks) {
			map.set(r.rackId, r.zoneId ? zoneToWarehouse.get(r.zoneId) ?? null : null);
		}
		return map;
	}, [allRacks, zoneToWarehouse]);

	const { mutateAsync: createMutation, isPending: loading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest(CREATE_STOCK_TRANSFER_MUTATION, { input }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Stock transfer created successfully");
			resetForm();
			onSuccess();
		},
	});

	function resetForm() {
		setRemarks("");
		setItems([createEmptyLine()]);
	}

	function handleOpenChange(val: boolean) {
		if (!val) resetForm();
		onOpenChange(val);
	}

	function updateItem(key: number, updates: Partial<TransferLineItem>) {
		setItems((prev) =>
			prev.map((item) => (item.key === key ? { ...item, ...updates } : item)),
		);
	}

	function removeItem(key: number) {
		setItems((prev) => prev.filter((item) => item.key !== key));
	}

	function addItem() {
		setItems((prev) => [...prev, createEmptyLine()]);
	}

	function validate(): string | null {
		if (items.length === 0) return "At least one line item is required.";
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (!item.sourceRackId.trim())
				return `Row ${i + 1}: Please select a source rack.`;
			if (!item.sourceStockQuantId.trim())
				return `Row ${i + 1}: Please select the stock to move.`;
			if (!item.destWarehouseId.trim())
				return `Row ${i + 1}: Please select a destination warehouse.`;
			if (!item.destRackId.trim())
				return `Row ${i + 1}: Please select a destination rack.`;
			if (item.destRackId === item.sourceRackId)
				return `Row ${i + 1}: Destination rack must differ from the source rack.`;
			const qty = Number(item.quantity);
			if (Number.isNaN(qty) || qty <= 0)
				return `Row ${i + 1}: Quantity must be greater than zero.`;
		}
		return null;
	}

	async function handleSubmit() {
		const error = validate();
		if (error) {
			toast.error(error);
			return;
		}

		const lines: CreateStockTransferLineInput[] = items.map((item) => ({
			sourceStockQuantId: item.sourceStockQuantId,
			destinationRackId: item.destRackId,
			quantity: item.quantity,
		}));

		await createMutation({
			remarks: remarks.trim() || null,
			lines,
		});
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-[min(96vw,1150px)] max-w-[1150px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border-2 border-border sm:max-w-[1150px] p-0"
				aria-busy={loading}
			>
				<DialogHeader className="border-b border-border/60 bg-muted/50 px-6 py-4 shrink-0">
					<DialogTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Create Bin to Bin Transfer
					</DialogTitle>
					<DialogDescription style={{ fontFamily: "var(--dashboard-body)" }}>
						Move stock between rack locations. A transfer within the same
						warehouse completes immediately; a transfer to a different warehouse
						stays in transit until received.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
					<div className="space-y-2">
						<Label htmlFor="transfer-remarks">Remarks</Label>
						<Textarea
							id="transfer-remarks"
							placeholder="Optional notes for this transfer"
							value={remarks}
							onChange={(e) => setRemarks(e.target.value)}
							rows={1}
						/>
					</div>

					<div className="space-y-3">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<h3
								className="text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Transfer lines
							</h3>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="gap-1 shrink-0 w-fit border-[color-mix(in_oklab,var(--dashboard-accent)_32%,transparent)] hover:bg-[var(--dashboard-accent-muted)]/35"
								onClick={addItem}
							>
								<Plus className="h-4 w-4" aria-hidden />
								Add line
							</Button>
						</div>

						<div className="space-y-4">
							{items.map((item, rowIndex) => (
								<TransferLineEditor
									key={item.key}
									item={item}
									rowIndex={rowIndex}
									canRemove={items.length > 1}
									warehouses={warehouses}
									allRacks={allRacks}
									rackToWarehouse={rackToWarehouse}
									onWarehouseCreated={async () => {
										await refetchWarehouses();
									}}
									onUpdate={(updates) => updateItem(item.key, updates)}
									onRemove={() => removeItem(item.key)}
								/>
							))}
						</div>

						{items.length === 0 && (
							<p className="text-sm text-muted-foreground text-center py-4">
								No transfer lines yet. Use the Add line button above.
							</p>
						)}
					</div>
				</div>

				<DialogFooter className="border-t border-border/60 px-6 pt-4 pb-4 gap-2 shrink-0">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={loading}
					>
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
						disabled={loading}
					>
						{loading ? "Creating…" : "Create transfer"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ============================================
// LINE EDITOR
// ============================================

type TransferLineEditorProps = {
	item: TransferLineItem;
	rowIndex: number;
	canRemove: boolean;
	warehouses: WarehouseOption[];
	allRacks: Rack[];
	rackToWarehouse: Map<string, string | null>;
	onWarehouseCreated: () => void | Promise<void>;
	onUpdate: (updates: Partial<TransferLineItem>) => void;
	onRemove: () => void;
};

function TransferLineEditor({
	item,
	rowIndex,
	canRemove,
	warehouses,
	allRacks,
	rackToWarehouse,
	onWarehouseCreated,
	onUpdate,
	onRemove,
}: TransferLineEditorProps) {
	// Stock quants available in the selected source rack.
	const quantsVars = useMemo(
		() => ({
			filter: { rackId: item.sourceRackId },
			pageSize: 200,
			pageNumber: 1,
		}),
		[item.sourceRackId],
	);
	const { data: quantsData, isFetching: quantsLoading } = useQuery({
		queryKey: qk.stockQuants.list(quantsVars),
		queryFn: () =>
			gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, quantsVars),
		enabled: !!item.sourceRackId,
	});
	const quants = quantsData?.stockQuants?.query ?? [];
	const selectedQuant = quants.find((q) => q.id === item.sourceStockQuantId);
	const availableQty = selectedQuant
		? available(selectedQuant.quantity, selectedQuant.reservedQty)
		: 0;

	// Destination racks filtered to the selected destination warehouse.
	const destRacks = useMemo(() => {
		if (!item.destWarehouseId) return [] as Rack[];
		return allRacks.filter(
			(r) => rackToWarehouse.get(r.rackId) === item.destWarehouseId,
		);
	}, [allRacks, rackToWarehouse, item.destWarehouseId]);

	// Banner: same warehouse vs different warehouse.
	const sourceWarehouseId = item.sourceRackId
		? rackToWarehouse.get(item.sourceRackId) ?? null
		: null;
	const showBanner =
		!!item.sourceRackId && !!item.destWarehouseId && sourceWarehouseId !== null;
	const isSameWarehouse =
		showBanner && sourceWarehouseId === item.destWarehouseId;

	function handleSourceRackChange(rackId: string, rackLabel?: string) {
		// Changing source rack resets the picked quant.
		onUpdate({
			sourceRackId: rackId,
			sourceRackLabel: rackLabel ?? "",
			sourceStockQuantId: "",
			quantity: "",
		});
	}

	function handleQuantChange(quantId: string) {
		onUpdate({ sourceStockQuantId: quantId, quantity: "" });
	}

	function handleQuantityChange(value: string) {
		if (value === "") {
			onUpdate({ quantity: "" });
			return;
		}
		const num = Number(value);
		if (Number.isNaN(num)) return;
		// Clamp to available.
		const clamped = num > availableQty ? String(availableQty) : value;
		onUpdate({ quantity: clamped });
	}

	function handleDestWarehouseChange(warehouseId: string) {
		// Changing warehouse resets the dest rack.
		onUpdate({
			destWarehouseId: warehouseId,
			destRackId: "",
			destRackLabel: "",
		});
	}

	return (
		<div className="rounded-lg border bg-card/40 p-3 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Line {rowIndex + 1}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onRemove}
					disabled={!canRemove}
					className="h-7 w-7 text-destructive hover:text-destructive"
					aria-label={`Remove line ${rowIndex + 1}`}
				>
					<Trash2 className="h-4 w-4" aria-hidden />
				</Button>
			</div>

			<div className="grid gap-3 lg:grid-cols-2">
				{/* SOURCE */}
				<div className="space-y-2 rounded-md border border-border/60 p-3">
					<p className="text-xs font-semibold text-foreground">From (source)</p>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Source rack</Label>
						<RackLocationCombobox
							value={item.sourceRackId}
							onChange={handleSourceRackChange}
							remoteSearch
							fallbackLabel={item.sourceRackLabel || null}
							placeholder="Select source rack…"
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Stock to move</Label>
						<Select
							value={item.sourceStockQuantId || "__none__"}
							onValueChange={(val) =>
								handleQuantChange(val === "__none__" ? "" : val)
							}
							disabled={!item.sourceRackId}
						>
							<SelectTrigger className="w-full">
								<SelectValue
									placeholder={
										!item.sourceRackId
											? "Select a source rack first"
											: quantsLoading
												? "Loading stock…"
												: quants.length === 0
													? "No stock in this rack"
													: "Select stock…"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none__">Select stock…</SelectItem>
								{quants.map((q) => {
									const avail = available(q.quantity, q.reservedQty);
									const lot = q.lotNo?.trim() ? ` · Lot ${q.lotNo}` : "";
									return (
										<SelectItem
											key={q.id}
											value={q.id}
											disabled={avail <= 0}
										>
											{q.skuCode ?? q.skuId}
											{lot} · avail {avail}
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">Available</Label>
							<Input
								readOnly
								value={selectedQuant ? String(availableQty) : "-"}
								className="font-mono text-sm bg-muted/40"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">Quantity</Label>
							<Input
								type="number"
								min={0}
								max={availableQty || undefined}
								step="0.01"
								placeholder="0"
								value={item.quantity}
								onChange={(e) => handleQuantityChange(e.target.value)}
								disabled={!item.sourceStockQuantId}
								aria-label={`Line ${rowIndex + 1} quantity`}
							/>
						</div>
					</div>
				</div>

				{/* DESTINATION */}
				<div className="space-y-2 rounded-md border border-border/60 p-3">
					<p className="text-xs font-semibold text-foreground">To (destination)</p>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">
							Destination warehouse
						</Label>
						<WarehouseCombobox
							value={item.destWarehouseId}
							onChange={handleDestWarehouseChange}
							warehouses={warehouses}
							onWarehouseCreated={onWarehouseCreated}
							placeholder="Select destination warehouse…"
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">
							Destination rack
						</Label>
						<RackLocationCombobox
							racks={destRacks}
							value={item.destRackId}
							onChange={(rackId, rackLabel) =>
								onUpdate({
									destRackId: rackId,
									destRackLabel: rackLabel ?? "",
								})
							}
							disabled={!item.destWarehouseId}
							fallbackLabel={item.destRackLabel || null}
							placeholder={
								!item.destWarehouseId
									? "Select a warehouse first"
									: "Select destination rack…"
							}
						/>
					</div>
				</div>
			</div>

			{showBanner && (
				<div
					className={
						"flex items-center gap-2 rounded-md border px-3 py-2 text-xs " +
						(isSameWarehouse
							? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
							: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400")
					}
				>
					<Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
					{isSameWarehouse ? (
						<span>Same warehouse — completes immediately.</span>
					) : (
						<span className="flex items-center gap-1">
							Different warehouse — In Transit until received
							<ArrowRight className="h-3 w-3" aria-hidden />
						</span>
					)}
				</div>
			)}
		</div>
	);
}
