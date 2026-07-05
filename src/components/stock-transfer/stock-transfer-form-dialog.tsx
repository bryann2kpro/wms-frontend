"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronsUpDown, Info, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RackLocationCombobox } from "@/components/grn/rack-location-combobox";
import { WarehouseCombobox } from "@/components/grn/warehouse-combobox";
import { dashboardAccentButtonProps, formatCtnLossComma, formatCtnLossPipe } from "@/components/stock-transfer/stock-transfer-ui";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
	CREATE_STOCK_TRANSFER_MUTATION,
	type CreateStockTransferLineInput,
} from "@/lib/graphql/stock-transfer";
import {
	STOCK_QUANTS_QUERY,
	type StockQuant,
	type StockQuantsQueryData,
	type StockQuantsQueryVariables,
} from "@/lib/graphql/stock-quant";
import { cn, toUserFriendlyMessage } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

// ============================================
// TYPES
// ============================================

type TransferLineItem = {
	key: number;
	sourceWarehouseId: string;
	sourceRackId: string;
	sourceRackLabel: string;
	sourceStockQuantId: string;
	quantity: string;
	lossQuantity: string;
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
	return Number.isFinite(avail) ? Math.max(0, Math.floor(avail)) : 0;
}

function availableLoss(lossQty: string | null | undefined): number {
	const n = Number(lossQty ?? "0");
	return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function hasTransferableStock(quant: StockQuant): boolean {
	return (
		available(quant.quantity, quant.reservedQty) > 0 ||
		availableLoss(quant.lossQty) > 0
	);
}

function formatStockQuantLabel(quant: StockQuant): string {
	const availCtn = available(quant.quantity, quant.reservedQty);
	const availLoss = availableLoss(quant.lossQty);
	const lot = quant.lotNo?.trim() ? ` · Lot ${quant.lotNo}` : "";
	return `${quant.skuCode ?? quant.skuId}${lot} · ${formatCtnLossComma(availCtn, availLoss)}`;
}

// ============================================
// STOCK QUANT COMBOBOX
// ============================================

type StockQuantComboboxProps = {
	value: string;
	onChange: (quantId: string) => void;
	rackId: string;
	disabled?: boolean;
	placeholder?: string;
};

function StockQuantCombobox({
	value,
	onChange,
	rackId,
	disabled = false,
	placeholder = "Select stock…",
}: StockQuantComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
	const sentinelRef = useRef<HTMLDivElement | null>(null);

	const searchTerm = debouncedSearch.trim();

	const {
		data,
		isLoading,
		isFetching,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
	} = useInfiniteQuery({
		queryKey: [
			...qk.stockQuants.all,
			"transfer-combobox",
			rackId,
			searchTerm,
		] as const,
		queryFn: async ({ pageParam }) =>
			gqlRequest<StockQuantsQueryData, StockQuantsQueryVariables>(
				STOCK_QUANTS_QUERY,
				{
					filter: {
						rackId,
						...(searchTerm ? { skuCode: searchTerm } : {}),
					},
					pageSize: PAGE_SIZE,
					pageNumber: pageParam,
				},
			),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const p = lastPage.stockQuants.pagination;
			return p.hasNextPage ? p.currentPage + 1 : undefined;
		},
		enabled: Boolean(rackId) && open && !disabled,
	});

	const quants = useMemo(
		() => data?.pages.flatMap((page) => page.stockQuants.query) ?? [],
		[data],
	);

	const { data: selectedQuantData } = useQuery({
		queryKey: [...qk.stockQuants.all, "by-id", value] as const,
		queryFn: () =>
			gqlRequest<StockQuantsQueryData, StockQuantsQueryVariables>(
				STOCK_QUANTS_QUERY,
				{ filter: { id: value }, pageSize: 1, pageNumber: 1 },
			),
		enabled: Boolean(value) && !quants.some((q) => q.id === value),
	});

	const selectedFromList = quants.find((q) => q.id === value);
	const selectedQuant =
		selectedFromList ?? selectedQuantData?.stockQuants?.query?.[0] ?? null;

	const displayLabel = selectedQuant ? formatStockQuantLabel(selectedQuant) : null;
	const listLoading = isLoading || (isFetching && !isFetchingNextPage);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return quants;
		return quants.filter((quant) => {
			const label = formatStockQuantLabel(quant).toLowerCase();
			return (
				label.includes(q) ||
				(quant.skuCode?.toLowerCase().includes(q) ?? false) ||
				(quant.lotNo?.toLowerCase().includes(q) ?? false)
			);
		});
	}, [quants, search]);

	const handleSelect = (quant: StockQuant) => {
		if (!hasTransferableStock(quant)) return;
		onChange(quant.id);
		setOpen(false);
		setSearch("");
	};

	const handleFetchNext = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !open) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					handleFetchNext();
				}
			},
			{ threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [handleFetchNext, open, filtered.length]);

	const emptyMessage = !rackId
		? "Select a source rack first"
		: listLoading
			? "Loading stock…"
			: searchTerm
				? "No stock matches your search."
				: "No stock in this rack";

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setSearch("");
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled || !rackId}
					className="h-9 w-full justify-between gap-1 font-normal text-sm"
				>
					<span className="truncate text-left">
						{displayLabel ?? placeholder}
					</span>
					<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="z-[200] min-w-[280px] w-(--radix-popover-trigger-width) max-w-[min(92vw,560px)] p-0 shadow-md"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex flex-col rounded-md">
					<div className="border-b bg-muted/30 px-2 py-1.5">
						<Input
							placeholder="Search SKU or lot…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-8 border-0 bg-background text-sm focus-visible:ring-2"
							autoFocus
						/>
					</div>
					<div className="max-h-[280px] overflow-y-auto overscroll-contain">
						{listLoading && filtered.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading stock…
							</div>
						) : filtered.length === 0 ? (
							<div className="py-6 text-center text-xs text-muted-foreground">
								{emptyMessage}
							</div>
						) : (
							<ul className="px-1 py-1">
								{filtered.map((quant) => {
									const label = formatStockQuantLabel(quant);
									const isSelected = value === quant.id;
									const isDisabled = !hasTransferableStock(quant);
									return (
										<li key={quant.id}>
											<button
												type="button"
												title={label}
												disabled={isDisabled}
												className={cn(
													"flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
													isSelected && "bg-accent",
													isDisabled &&
														"cursor-not-allowed opacity-50 hover:bg-transparent",
												)}
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => handleSelect(quant)}
											>
												{isSelected ? (
													<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
												) : (
													<span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
												)}
												<span className="truncate">{label}</span>
											</button>
										</li>
									);
								})}
								<li aria-hidden className="h-px">
									<div ref={sentinelRef} className="h-px" />
								</li>
								{isFetchingNextPage ? (
									<li className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										Loading more…
									</li>
								) : null}
							</ul>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ============================================
// COMPONENT
// ============================================

let lineKeyCounter = 0;

function createEmptyLine(): TransferLineItem {
	return {
		key: ++lineKeyCounter,
		sourceWarehouseId: "",
		sourceRackId: "",
		sourceRackLabel: "",
		sourceStockQuantId: "",
		quantity: "",
		lossQuantity: "",
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

	const { mutateAsync: createMutation, isPending: loading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest(CREATE_STOCK_TRANSFER_MUTATION, { input }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Stock transfer saved as draft");
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
			if (!item.sourceWarehouseId.trim())
				return `Row ${i + 1}: Please select a source warehouse.`;
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
			const qty = item.quantity.trim() ? Number(item.quantity) : 0;
			const lossQty = item.lossQuantity.trim() ? Number(item.lossQuantity) : 0;
			if (
				(item.quantity.trim() && (!Number.isFinite(qty) || qty < 0)) ||
				(item.lossQuantity.trim() && (!Number.isFinite(lossQty) || lossQty < 0))
			) {
				return `Row ${i + 1}: Quantities must be non-negative numbers.`;
			}
			if (qty <= 0 && lossQty <= 0)
				return `Row ${i + 1}: At least one of ctn or Loss quantity must be greater than zero.`;
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
			quantity: item.quantity.trim() || "0",
			lossQuantity: item.lossQuantity.trim() || "0",
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
						Move stock between rack locations. Saving creates a draft — stock is
						not moved until an approver confirms the transfer.
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
									dialogOpen={open}
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
						{...dashboardAccentButtonProps}
						onClick={handleSubmit}
						disabled={loading}
					>
						{loading ? "Saving…" : "Send for Approval"}
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
	dialogOpen: boolean;
	onUpdate: (updates: Partial<TransferLineItem>) => void;
	onRemove: () => void;
};

function TransferLineEditor({
	item,
	rowIndex,
	canRemove,
	dialogOpen,
	onUpdate,
	onRemove,
}: TransferLineEditorProps) {
	const { data: selectedQuantData } = useQuery({
		queryKey: [...qk.stockQuants.all, "line-selected", item.sourceStockQuantId] as const,
		queryFn: () =>
			gqlRequest<StockQuantsQueryData, StockQuantsQueryVariables>(
				STOCK_QUANTS_QUERY,
				{
					filter: { id: item.sourceStockQuantId },
					pageSize: 1,
					pageNumber: 1,
				},
			),
		enabled: !!item.sourceStockQuantId,
	});

	const selectedQuant = selectedQuantData?.stockQuants?.query?.[0] ?? null;
	const availableCtn = selectedQuant
		? available(selectedQuant.quantity, selectedQuant.reservedQty)
		: 0;
	const availableLossQty = selectedQuant
		? availableLoss(selectedQuant.lossQty)
		: 0;

	const showBanner = !!item.sourceWarehouseId && !!item.destWarehouseId;
	const isSameWarehouse =
		showBanner && item.sourceWarehouseId === item.destWarehouseId;

	function handleSourceWarehouseChange(warehouseId: string) {
		onUpdate({
			sourceWarehouseId: warehouseId,
			sourceRackId: "",
			sourceRackLabel: "",
			sourceStockQuantId: "",
			quantity: "",
			lossQuantity: "",
		});
	}

	function handleSourceRackChange(rackId: string, rackLabel?: string) {
		onUpdate({
			sourceRackId: rackId,
			sourceRackLabel: rackLabel ?? "",
			sourceStockQuantId: "",
			quantity: "",
			lossQuantity: "",
		});
	}

	function handleQuantChange(quantId: string) {
		onUpdate({ sourceStockQuantId: quantId, quantity: "", lossQuantity: "" });
	}

	function handleQuantityChange(value: string) {
		if (value === "") {
			onUpdate({ quantity: "" });
			return;
		}
		const num = Number(value);
		if (Number.isNaN(num)) return;
		const clamped = num > availableCtn ? String(availableCtn) : value;
		onUpdate({ quantity: clamped });
	}

	function handleLossQuantityChange(value: string) {
		if (value === "") {
			onUpdate({ lossQuantity: "" });
			return;
		}
		const num = Number(value);
		if (Number.isNaN(num)) return;
		const clamped = num > availableLossQty ? String(availableLossQty) : value;
		onUpdate({ lossQuantity: clamped });
	}

	function handleDestWarehouseChange(warehouseId: string) {
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
						<Label className="text-xs text-muted-foreground">
							Source warehouse
						</Label>
						<WarehouseCombobox
							value={item.sourceWarehouseId}
							onChange={handleSourceWarehouseChange}
							enabled={dialogOpen}
							placeholder="Select source warehouse…"
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Source rack</Label>
						<RackLocationCombobox
							key={item.sourceWarehouseId || "no-warehouse"}
							remoteSearch
							warehouseId={item.sourceWarehouseId || undefined}
							enabled={dialogOpen}
							value={item.sourceRackId}
							onChange={handleSourceRackChange}
							disabled={!item.sourceWarehouseId}
							fallbackLabel={item.sourceRackLabel || null}
							placeholder={
								!item.sourceWarehouseId
									? "Select a warehouse first"
									: "Select source rack…"
							}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Stock to move</Label>
						<StockQuantCombobox
							value={item.sourceStockQuantId}
							onChange={handleQuantChange}
							rackId={item.sourceRackId}
							disabled={!item.sourceRackId}
							placeholder={
								!item.sourceRackId
									? "Select a source rack first"
									: "Select stock…"
							}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">
							Quantity (ctn | loss)
						</Label>
						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<Label
									htmlFor={`line-${rowIndex}-ctn`}
									className="text-[10px] font-normal text-muted-foreground"
								>
									ctn
									{selectedQuant?.stockUnitCode?.trim() ? (
										<span> ({selectedQuant.stockUnitCode.trim()})</span>
									) : null}
								</Label>
								<Input
									id={`line-${rowIndex}-ctn`}
									type="number"
									min={0}
									max={availableCtn || undefined}
									step={1}
									placeholder="0"
									value={item.quantity}
									onChange={(e) => handleQuantityChange(e.target.value)}
									disabled={
										!item.sourceStockQuantId || availableCtn <= 0
									}
									aria-label={`Line ${rowIndex + 1} ctn quantity`}
								/>
							</div>
							<div className="space-y-1">
								<Label
									htmlFor={`line-${rowIndex}-loss`}
									className="text-[10px] font-normal text-muted-foreground"
								>
									loss
								</Label>
								<Input
									id={`line-${rowIndex}-loss`}
									type="number"
									min={0}
									max={availableLossQty || undefined}
									step={1}
									placeholder="0"
									value={item.lossQuantity}
									onChange={(e) => handleLossQuantityChange(e.target.value)}
									disabled={
										!item.sourceStockQuantId || availableLossQty <= 0
									}
									aria-label={`Line ${rowIndex + 1} loss quantity`}
								/>
							</div>
						</div>
						{selectedQuant ? (
							<p className="text-[10px] text-muted-foreground">
								Available:{" "}
								{formatCtnLossPipe(availableCtn, availableLossQty)}
							</p>
						) : null}
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
							enabled={dialogOpen}
							placeholder="Select destination warehouse…"
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">
							Destination rack
						</Label>
						<RackLocationCombobox
							remoteSearch
							warehouseId={item.destWarehouseId || undefined}
							enabled={dialogOpen}
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
