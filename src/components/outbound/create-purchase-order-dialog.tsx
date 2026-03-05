import * as React from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { Plus, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import {
	OUTLETS_QUERY,
	type OutletsQueryData,
	type OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import { SkuCombobox, type SkuLineValue } from "@/components/grn/sku-combobox";
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
	const { data: outletsData } = useQuery<
		OutletsQueryData,
		OutletsQueryVariables
	>(OUTLETS_QUERY, {
		variables: { pageSize: 500, pageNumber: 1 },
		skip: !open,
	});

	const outlets = outletsData?.outlets?.query ?? [];

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) form.reset();
			}}
		>
			{trigger != null ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle id="create-po-dialog-title">
						Create New Purchase Order
					</DialogTitle>
					<DialogDescription id="create-po-dialog-description">
						Enter the purchase order number, select an outlet, and add line items
						(stock and quantity). Delivery date is set automatically by the
						system.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-4"
					aria-labelledby="create-po-dialog-title"
					aria-describedby="create-po-dialog-description"
				>
					<form.Subscribe selector={(state: any) => state.isSubmitting}>
						{(isSubmitting: boolean) => (
							<>
								{isSubmitting && (
									<div
										role="status"
										aria-live="polite"
										aria-busy="true"
										className="sr-only"
									>
										Creating purchase order...
									</div>
								)}
								<fieldset
									disabled={isSubmitting}
									className="space-y-4 border-0 p-0 m-0 min-w-0 disabled:opacity-70 disabled:pointer-events-none"
									aria-busy={isSubmitting}
								>
					<FieldGroup>
						<form.Field
							name="purchaseOrderNumber"
							children={(field: any) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Purchase Order Number
										</FieldLabel>
										<Input
											id={field.name}
											value={field.state.value}
											placeholder="PO-2024-001"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
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
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Outlet</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(value) => {
												const outlet = outlets.find(
													(o: { outletId: string }) => o.outletId === value,
												);
												field.handleChange(value);
												if (outlet) {
													form.setFieldValue(
														"outletName",
														(outlet as { outletName: string }).outletName ?? value,
													);
												}
												field.handleBlur();
											}}
										>
											<SelectTrigger id={field.name}>
												<SelectValue placeholder="Select outlet" />
											</SelectTrigger>
											<SelectContent>
												{outlets.map(
													(
														o: {
															outletId: string;
															outletName: string;
															outletCode: string;
														},
													) => (
														<SelectItem key={o.outletId} value={o.outletId}>
															{o.outletName} ({o.outletCode})
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>

						<form.Subscribe
							selector={(state: any) => state.values.items ?? []}
						>
							{(items: CreatePurchaseOrderLineItem[]) => (
								<Field>
									<div className="flex items-center justify-between gap-2">
										<FieldLabel>Line items (Stock &amp; Amount)</FieldLabel>
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
									<div className="rounded-md border">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Stock (SKU)</TableHead>
													<TableHead className="w-28">Amount</TableHead>
													<TableHead className="w-10" />
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

						<form.Field
							name="notes"
							children={(field: any) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Notes</FieldLabel>
									<Textarea
										id={field.name}
										value={field.state.value}
										placeholder="Enter any additional notes..."
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
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
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => onOpenChange(false)}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isSubmitting || !canSubmit}>
									{isSubmitting ? "Creating purchase order..." : "Create Purchase Order"}
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
	item: CreatePurchaseOrderLineItem & { skuCode?: string; description?: string };
	items: (CreatePurchaseOrderLineItem & { skuCode?: string; description?: string })[];
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
		const next = items.map((it, i) =>
			i === index ? { ...it, ...patch } : it,
		);
		form.setFieldValue("items", next);
	};

	return (
		<TableRow>
			<TableCell>
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
					usedSkuCodes={items
						.filter((_, i) => i !== index)
						.map((it) => it.skuCode)
						.filter(Boolean) as string[]}
				/>
			</TableCell>
			<TableCell>
				<Input
					type="number"
					min={1}
					value={item.quantity}
					onChange={(e) =>
						updateRow({ quantity: Number(e.target.value) || 1 })
					}
				/>
			</TableCell>
			<TableCell>
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
