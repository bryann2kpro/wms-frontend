import type * as React from "react";
import { useQuery } from "@apollo/client/react";
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
import type { UseMutationResult } from "@tanstack/react-query";
import {
	OUTLETS_QUERY,
	type OutletsQueryData,
	type OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import { SkuCombobox, type SkuLineValue } from "@/components/grn/sku-combobox";
import { OutletCombobox } from "@/components/outbound/outlet-combobox";
import type { CreatePurchaseOrderLineItem } from "@/lib/outbound";

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
	const { data: outletsData, refetch: refetchOutlets } = useQuery<
		OutletsQueryData,
		OutletsQueryVariables
	>(OUTLETS_QUERY, {
		variables: { pageSize: 500, pageNumber: 1 },
		skip: !open,
	});

	const outlets = outletsData?.outlets?.query ?? [];

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
			<DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
				<DialogHeader className="space-y-1.5 px-6 pt-6 pb-4 border-b bg-muted/30">
					<DialogTitle
						id="create-po-dialog-title"
						className="text-[22px] leading-tight font-semibold"
					>
						Create New Purchase Order
					</DialogTitle>
					<DialogDescription
						id="create-po-dialog-description"
						className="text-[13px] text-muted-foreground"
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
											Creating purchase order...
										</div>
										<div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px]">
											<div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-4 shadow-sm">
												<Loader2
													className="h-10 w-10 animate-spin text-primary"
													aria-hidden
												/>
												<p className="text-sm font-medium text-foreground">
													Creating purchase order...
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
															<FieldLabel htmlFor={field.name}>
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
																className="h-10 text-[13px]"
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
															<FieldLabel htmlFor={field.name}>
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
															>
																<Zap className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
																Emergency delivery
															</FieldLabel>
															<p
																id="isEmergency-description"
																className="text-xs text-muted-foreground"
															>
																Assign to the next delivery day even if the normal cutoff has passed.
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
														<FieldLabel className="text-[14px] font-semibold">
															Line items (Stock &amp; Amount)
														</FieldLabel>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() => {
																form.setFieldValue("items", [
																	...(items ?? []),
																	{ skuId: "", quantity: 1 },
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
																	<TableHead className="font-semibold text-[14px]">
																		Stock (SKU)
																	</TableHead>
																	<TableHead className="w-32 font-semibold text-[14px]">
																		Quantity
																	</TableHead>
																	<TableHead className="w-12" />
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
													>
														Notes
													</FieldLabel>
													<Textarea
														id={field.name}
														value={field.state.value}
														placeholder="Enter any additional notes..."
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														className="min-h-[72px] resize-none text-[13px]"
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
									onClick={() => onOpenChange(false)}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isSubmitting || !canSubmit}>
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
}: {
	index: number;
	item: CreatePurchaseOrderLineItem & {
		skuCode?: string;
		description?: string;
	};
	items: (CreatePurchaseOrderLineItem & {
		skuCode?: string;
		description?: string;
	})[];
	form: any;
	canRemove: boolean;
}) {
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

	const updateRow = (patch: Partial<typeof item>) => {
		const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
		form.setFieldValue("items", next);
	};

	return (
		<TableRow className="h-12">
			<TableCell className="align-middle py-2 text-[13px]">
				<SkuCombobox
					value={skuValue}
					onChange={(v) => {
						updateRow({
							skuId: v.skuId,
							skuCode: v.skuCode,
							description: v.description,
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
			<TableCell className="align-middle py-2">
				<Input
					type="number"
					min={1}
					value={item.quantity}
					onChange={(e) => updateRow({ quantity: Number(e.target.value) || 1 })}
					className="h-10 w-24 text-[13px]"
				/>
			</TableCell>
			<TableCell className="align-middle py-2 w-12">
				{canRemove ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
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
	);
}

export function CreatePurchaseOrderDialogTrigger({
	open,
	onOpenChange,
	form,
	createMutation,
}: Omit<CreatePurchaseOrderDialogProps, "trigger">) {
	return (
		<CreatePurchaseOrderDialog
			open={open}
			onOpenChange={onOpenChange}
			form={form}
			createMutation={createMutation}
			trigger={
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Create Purchase Order
				</Button>
			}
		/>
	);
}
