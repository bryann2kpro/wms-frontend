import type * as React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery, type UseMutationResult } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
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
import { Input } from "@/components/ui/input";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Zap } from "lucide-react";
import {
	OUTLETS_QUERY,
	type OutletsQueryData,
	type OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import { SkuCombobox, type SkuLineValue } from "@/components/grn/sku-combobox";
import { OutletCombobox } from "@/components/outbound/outlet-combobox";
import type { CreatePurchaseOrderLineItem } from "@/lib/outbound";
import {
	STOCK_QUANTS_QUERY,
	sortStockQuantsByPickingStrategy,
	type StockQuantsQueryData,
} from "@/lib/graphql/stock-quant";
import { SKUS_QUERY, type SkusQueryData } from "@/lib/graphql/skus";
import { cn } from "@/lib/utils";

const LIVE_STOCK_QUERY_OPTIONS = {
	staleTime: 0,
	refetchOnMount: "always" as const,
};

interface CreatePurchaseOrderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: any;
	createMutation: UseMutationResult<any, any, any>;
	trigger?: React.ReactNode;
}

export function CreatePurchaseOrderDialog({
	open,
	onOpenChange,
	form,
	trigger,
}: CreatePurchaseOrderDialogProps) {
	const { data: outletsData, refetch: refetchOutlets } = useQuery({
		queryKey: [...qk.outlets.all, { pageSize: 500, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<OutletsQueryData, OutletsQueryVariables>(OUTLETS_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
		enabled: open,
	});

	const outlets = outletsData?.outlets?.query ?? [];

	const { data: skusData } = useQuery({
		queryKey: qk.skus.all,
		queryFn: () => gqlRequest<SkusQueryData>(SKUS_QUERY),
		enabled: open,
	});

	const pickingStrategyBySkuId = useMemo(() => {
		const map = new Map<string, string>();
		for (const sku of skusData?.skus?.query ?? []) {
			map.set(sku.skuId, sku.pickingStrategy ?? "FIFO");
		}
		return map;
	}, [skusData]);

	const handleOpenChange = (next: boolean) => {
		// Keep dialog open and show loading until create finishes (prevent Escape/overlay/X from closing)
		if (next === false && form.state.isSubmitting) return;
		onOpenChange(next);
		if (!next) form.reset();
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{trigger != null ? (
				<DialogTrigger asChild>{trigger}</DialogTrigger>
			) : null}
			<DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="space-y-1.5 px-6 pt-6 pb-4 border-b bg-muted/50">
					<DialogTitle
						id="create-po-dialog-title"
						className="text-[22px] leading-tight font-semibold"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						Process New Purchase Order
					</DialogTitle>
					<DialogDescription
						id="create-po-dialog-description"
						className="text-[13px] text-muted-foreground"
						style={{ fontFamily: "var(--dashboard-body)" }}
					>
						Enter the purchase order number, select an outlet, and add line
						items (stock and quantity). Delivery date is set automatically by
						the system.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="relative flex flex-col min-h-0"
					aria-labelledby="create-po-dialog-title"
					aria-describedby="create-po-dialog-description"
				>
					<form.Subscribe selector={(state: any) => state.isSubmitting}>
						{(isSubmitting: boolean) => (
							<>
								{isSubmitting && (
									<>
										<div
											role="status"
											aria-live="polite"
											aria-busy="true"
											className="sr-only"
										>
											Processing purchase order...
										</div>
										<div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px]">
											<div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-4 shadow-sm">
												<Loader2
													className="h-10 w-10 animate-spin text-primary"
													aria-hidden
												/>
												<p className="text-sm font-medium text-foreground">
													Processing purchase order...
												</p>
												<p className="text-xs text-muted-foreground">
													Please wait
												</p>
											</div>
										</div>
									</>
								)}
								<fieldset
									disabled={isSubmitting}
									className="flex flex-col gap-0 border-0 p-0 m-0 min-w-0 disabled:opacity-70 disabled:pointer-events-none flex-1 overflow-hidden"
									aria-busy={isSubmitting}
								>
									<FieldGroup className="flex flex-col gap-0 flex-1 min-h-0 overflow-hidden">
										{/* Order details: two columns — 8px grid spacing (16/24) */}
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-6">
											<form.Field
												name="purchaseOrderNumber"
												children={(field: any) => {
													const isInvalid =
														field.state.meta.isTouched &&
														!field.state.meta.isValid;
													return (
														<Field
															data-invalid={isInvalid}
															className="space-y-2"
														>
															<FieldLabel
																htmlFor={field.name}
																style={{ fontFamily: "var(--dashboard-body)" }}
															>
																Purchase Order Number
															</FieldLabel>
															<Input
																id={field.name}
																value={field.state.value}
																placeholder="PO-2024-001"
																onBlur={field.handleBlur}
																onChange={(e) =>
																	field.handleChange(e.target.value)
																}
																aria-invalid={isInvalid}
																className="h-10 text-[13px] rounded-lg border-muted-foreground/20"
															/>
															{isInvalid && (
																<FieldError errors={field.state.meta.errors} />
															)}
														</Field>
													);
												}}
											/>

											<form.Field
												name="outletId"
												children={(field: any) => {
													const isInvalid =
														field.state.meta.isTouched &&
														!field.state.meta.isValid;
													return (
														<Field
															data-invalid={isInvalid}
															className="space-y-2"
														>
															<FieldLabel
																htmlFor={field.name}
																style={{ fontFamily: "var(--dashboard-body)" }}
															>
																Outlet
															</FieldLabel>
															<OutletCombobox
																id={field.name}
																value={field.state.value}
																outlets={outlets}
																onOutletCreated={async () => {
																	await refetchOutlets();
																}}
																placeholder="Search or select outlet..."
																aria-invalid={isInvalid}
																onChange={(value) => {
																	const outlet = outlets.find(
																		(o: { outletId: string }) =>
																			o.outletId === value,
																	);
																	field.handleChange(value);
																	if (outlet) {
																		form.setFieldValue(
																			"outletName",
																			(outlet as { outletName: string })
																				.outletName ?? value,
																		);
																	}
																	field.handleBlur();
																}}
															/>
															{isInvalid && (
																<FieldError errors={field.state.meta.errors} />
															)}
														</Field>
													);
												}}
											/>

											<form.Field
												name="isEmergency"
												children={(field: any) => (
													<div className="flex flex-row items-start gap-3 pt-2 sm:col-span-2">
														<Checkbox
															id={field.name}
															checked={Boolean(field.state.value)}
															onCheckedChange={(checked) =>
																field.handleChange(checked === true)
															}
															onBlur={field.handleBlur}
															aria-describedby="isEmergency-description"
															className="mt-0.5 shrink-0"
														/>
														<div className="grid gap-1.5 leading-none min-w-0">
															<FieldLabel
																htmlFor={field.name}
																className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
																style={{ fontFamily: "var(--dashboard-body)" }}
															>
																<Zap
																	className="h-4 w-4 text-amber-500 shrink-0"
																	aria-hidden
																/>
																Emergency delivery
															</FieldLabel>
															<p
																id="isEmergency-description"
																className="text-xs text-muted-foreground"
															>
																Assign to the next delivery day even if the
																normal cutoff has passed.
															</p>
														</div>
													</div>
												)}
											/>
										</div>

										{/* Line items section */}
										<form.Subscribe
											selector={(state: any) => state.values.items ?? []}
										>
											{(items: CreatePurchaseOrderLineItem[]) => (
												<Field className="flex flex-col flex-1 min-h-0 px-6 pb-4">
													<div className="flex items-center justify-between gap-2 mb-2">
														<FieldLabel
															className="text-[14px] font-semibold"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															Line items (Stock &amp; Amount)
														</FieldLabel>
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="rounded-lg"
															onClick={() => {
																form.setFieldValue("items", [
																	...(items ?? []),
																	{ skuId: "", quantity: 1, stockQuantId: "" },
																]);
															}}
														>
															<Plus className="mr-2 h-4 w-4" />
															Add line
														</Button>
													</div>
													<div className="rounded-xl border bg-card overflow-hidden flex-1 min-h-[140px] flex flex-col">
														<Table>
															<TableHeader>
																<TableRow className="hover:bg-transparent border-b h-12">
																	<TableHead
																		className="font-semibold text-[14px] px-6"
																		style={{
																			fontFamily: "var(--dashboard-body)",
																		}}
																	>
																		Stock (SKU)
																	</TableHead>
																	<TableHead
																		className="w-32 font-semibold text-[14px] px-6"
																		style={{
																			fontFamily: "var(--dashboard-body)",
																		}}
																	>
																		Quantity
																	</TableHead>
																	<TableHead className="w-12 px-6" />
																</TableRow>
															</TableHeader>
															<TableBody>
																{(items ?? []).map((item, index) => (
																<LineItemRow
																	key={index}
																	index={index}
																	item={item}
																	items={items ?? []}
																	form={form}
																	canRemove={(items ?? []).length > 1}
																	pickingStrategy={
																		item.skuId
																			? (pickingStrategyBySkuId.get(item.skuId) ??
																				"FIFO")
																			: "FIFO"
																	}
																/>
															))}
															</TableBody>
														</Table>
													</div>
												</Field>
											)}
										</form.Subscribe>

										{/* Notes */}
										<form.Field
											name="notes"
											children={(field: any) => (
												<Field className="px-6 pb-6 space-y-2">
													<FieldLabel
														htmlFor={field.name}
														className="text-[14px] font-semibold"
														style={{ fontFamily: "var(--dashboard-display)" }}
													>
														Notes
													</FieldLabel>
													<Textarea
														id={field.name}
														value={field.state.value}
														placeholder="Enter any additional notes..."
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														className="min-h-[72px] resize-none text-[13px] rounded-lg border-muted-foreground/20"
													/>
												</Field>
											)}
										/>
									</FieldGroup>
								</fieldset>
							</>
						)}
					</form.Subscribe>

					<form.Subscribe
						selector={(state: any) => [state.isSubmitting, state.canSubmit]}
					>
						{([isSubmitting, canSubmit]: any) => (
							<DialogFooter className="px-6 py-4 border-t bg-muted/20 gap-2 sm:gap-0">
								<Button
									type="button"
									variant="outline"
									className="rounded-lg"
									onClick={() => onOpenChange(false)}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
									disabled={isSubmitting || !canSubmit}
								>
									{isSubmitting ? (
										<>
											<Loader2
												className="mr-2 h-4 w-4 animate-spin"
												aria-hidden
											/>
											Creating purchase order...
										</>
									) : (
										"Create Purchase Order"
									)}
								</Button>
							</DialogFooter>
						)}
					</form.Subscribe>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function LineItemRow({
	index,
	item,
	items,
	form,
	canRemove,
	pickingStrategy,
}: {
	index: number;
	item: CreatePurchaseOrderLineItem & {
		skuCode?: string;
		description?: string;
		stockQuantId?: string;
	};
	items: (CreatePurchaseOrderLineItem & {
		skuCode?: string;
		description?: string;
		stockQuantId?: string;
	})[];
	form: any;
	canRemove: boolean;
	pickingStrategy: string;
}) {
	const stockQuantVars = {
		filter: { skuId: item.skuId },
		pageSize: 9999,
		pageNumber: 1,
	};

	const { data: stockQuantData, isLoading: stockQuantLoading } = useQuery({
		queryKey: qk.stockQuants.list(stockQuantVars),
		queryFn: () =>
			gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, stockQuantVars),
		enabled: !!item.skuId,
		...LIVE_STOCK_QUERY_OPTIONS,
	});

	const stockQuantBatches = useMemo(
		() =>
			sortStockQuantsByPickingStrategy(
				(stockQuantData?.stockQuants?.query ?? []).filter((row) => {
					const onHand = Number(row.quantity ?? "0");
					const reserved = Number(row.reservedQty ?? "0");
					return onHand - reserved > 0;
				}),
				pickingStrategy,
			),
		[stockQuantData, pickingStrategy],
	);

	const totalAvailable = useMemo(
		() =>
			stockQuantBatches.reduce((sum, row) => {
				const onHand = Number(row.quantity ?? "0");
				const reserved = Number(row.reservedQty ?? "0");
				return sum + (onHand - reserved);
			}, 0),
		[stockQuantBatches],
	);

	const selectedBatch = stockQuantBatches.find(
		(batch) => batch.id === item.stockQuantId,
	);
	const selectedAvailable = selectedBatch
		? Number(selectedBatch.quantity ?? "0") -
			Number(selectedBatch.reservedQty ?? "0")
		: 0;

	const updateRow = useCallback(
		(patch: Partial<typeof item>) => {
			const next = items.map((it, i) =>
				i === index ? { ...it, ...patch } : it,
			);
			form.setFieldValue("items", next);
		},
		[form, index, items],
	);

	useEffect(() => {
		if (!item.skuId || stockQuantLoading) return;
		if (stockQuantBatches.length === 0) {
			if (item.stockQuantId) {
				updateRow({ stockQuantId: "" });
			}
			return;
		}
		const stillValid = stockQuantBatches.some(
			(batch) => batch.id === item.stockQuantId,
		);
		if (!stillValid) {
			updateRow({ stockQuantId: stockQuantBatches[0].id });
		}
	}, [
		item.skuId,
		item.stockQuantId,
		stockQuantBatches,
		stockQuantLoading,
		updateRow,
	]);

	const skuValue: SkuLineValue | null = item.skuId
		? {
				skuId: item.skuId,
				skuCode: item.skuCode ?? item.skuId,
				description: item.description ?? "",
				sku: item.skuCode ?? item.skuId,
				uom: "",
				isActive: true,
			}
		: null;

	return (
		<>
			<TableRow className="h-12 transition-colors hover:bg-muted/50">
				<TableCell className="align-middle py-2 px-6 text-[13px]">
					<SkuCombobox
						value={skuValue}
						onChange={(v) => {
							updateRow({
								skuId: v.skuId,
								skuCode: v.skuCode,
								description: v.description,
								stockQuantId: "",
							});
						}}
						placeholder="Select SKU..."
						usedSkuCodes={
							items
								.filter((_, i) => i !== index)
								.map((it) => it.skuCode)
								.filter(Boolean) as string[]
						}
					/>
				</TableCell>
				<TableCell className="align-middle py-2 px-6">
					<Input
						type="number"
						min={1}
						max={
							selectedBatch && selectedAvailable > 0
								? selectedAvailable
								: undefined
						}
						value={item.quantity}
						onChange={(e) =>
							updateRow({ quantity: Number(e.target.value) || 1 })
						}
						className="h-10 w-24 text-[13px] rounded-lg border-muted-foreground/20"
					/>
					{item.skuId &&
					selectedBatch &&
					item.quantity > selectedAvailable ? (
						<p className="mt-1 text-[11px] text-destructive">
							Exceeds selected batch ({selectedAvailable.toLocaleString()})
						</p>
					) : null}
					{item.skuId && stockQuantBatches.length > 0 && !item.stockQuantId ? (
						<p className="mt-1 text-[11px] text-destructive">
							Select a stock quant batch below
						</p>
					) : null}
				</TableCell>
				<TableCell className="align-middle py-2 w-12 px-6">
					{canRemove ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="rounded-lg"
							aria-label="Remove line"
							onClick={() => {
								form.setFieldValue(
									"items",
									items.filter((_, i) => i !== index),
								);
							}}
						>
							<Trash2 className="h-4 w-4 text-destructive" aria-hidden />
						</Button>
					) : null}
				</TableCell>
			</TableRow>
			{item.skuId ? (
				<TableRow className="bg-muted/20 hover:bg-muted/20">
					<TableCell colSpan={3} className="px-6 py-3">
						{stockQuantLoading ? (
							<p className="text-xs text-muted-foreground">
								Loading stock quant batches...
							</p>
						) : stockQuantBatches.length === 0 ? (
							<p className="text-xs text-amber-600 dark:text-amber-400">
								No available stock quant for this SKU at rack locations.
							</p>
						) : (
							<div className="space-y-2">
								<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
									Select stock quant batch ({pickingStrategy}) · Total available:{" "}
									{totalAvailable.toLocaleString()}
								</p>
								<div className="overflow-x-auto rounded-lg border bg-background">
									<Table>
										<TableHeader>
											<TableRow className="hover:bg-transparent">
												<TableHead className="w-10 text-xs">Select</TableHead>
												<TableHead className="text-xs">Lot No</TableHead>
												<TableHead className="text-xs">Rack</TableHead>
												<TableHead className="text-xs">Expiry</TableHead>
												<TableHead className="text-xs text-right">
													On Hand
												</TableHead>
												<TableHead className="text-xs text-right">
													Reserved
												</TableHead>
												<TableHead className="text-xs text-right">
													Available
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{stockQuantBatches.map((batch) => {
												const onHand = Number(batch.quantity ?? "0");
												const reserved = Number(batch.reservedQty ?? "0");
												const available = onHand - reserved;
												const isSelected = item.stockQuantId === batch.id;
												return (
													<TableRow
														key={batch.id}
														role="radio"
														aria-checked={isSelected}
														tabIndex={0}
														className={cn(
															"cursor-pointer transition-colors",
															isSelected
																? "bg-amber-500/10 hover:bg-amber-500/15"
																: "hover:bg-muted/50",
														)}
														onClick={(e) => {
															e.preventDefault();
															updateRow({ stockQuantId: batch.id });
														}}
														onKeyDown={(e) => {
															if (e.key === "Enter" || e.key === " ") {
																e.preventDefault();
																updateRow({ stockQuantId: batch.id });
															}
														}}
													>
														<TableCell className="w-10">
															<input
																type="radio"
																name={`stock-quant-${index}`}
																checked={isSelected}
																onClick={(e) => e.stopPropagation()}
																onChange={() =>
																	updateRow({ stockQuantId: batch.id })
																}
																className="h-4 w-4 accent-amber-600"
																aria-label={`Select batch ${batch.lotNo?.trim() || "no lot"} at ${batch.rackLabel || "rack"}`}
															/>
														</TableCell>
														<TableCell className="font-mono text-xs">
															{batch.lotNo?.trim() ? (
																batch.lotNo
															) : (
																<span className="italic text-muted-foreground">
																	No lot
																</span>
															)}
														</TableCell>
														<TableCell className="text-xs">
															{batch.rackLabel?.trim() || "Unassigned"}
														</TableCell>
														<TableCell className="text-xs text-muted-foreground">
															{batch.expiryDate
																? new Date(batch.expiryDate).toLocaleDateString(
																		"en-GB",
																	)
																: "—"}
														</TableCell>
														<TableCell className="text-right text-xs">
															{onHand.toLocaleString()}
														</TableCell>
														<TableCell className="text-right text-xs text-amber-600 dark:text-amber-400">
															{reserved.toLocaleString()}
														</TableCell>
														<TableCell className="text-right text-xs font-semibold">
															{available.toLocaleString()}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							</div>
						)}
					</TableCell>
				</TableRow>
			) : null}
		</>
	);
}

export function CreatePurchaseOrderDialogTrigger({
	open,
	onOpenChange,
	form,
	createMutation,
	triggerClassName,
}: Omit<CreatePurchaseOrderDialogProps, "trigger"> & {
	triggerClassName?: string;
}) {
	return (
		<CreatePurchaseOrderDialog
			open={open}
			onOpenChange={onOpenChange}
			form={form}
			createMutation={createMutation}
			trigger={
				<Button className={triggerClassName}>
					<Plus className="mr-2 h-4 w-4" />
					Process PO
				</Button>
			}
		/>
	);
}
