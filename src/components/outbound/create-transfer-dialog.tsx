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
import type { CreateTransferLineItem } from "@/lib/outbound";

interface CreateTransferDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: any;
	createMutation: UseMutationResult<any, any, any>;
	trigger?: React.ReactNode;
}

export function CreateTransferDialog({
	open,
	onOpenChange,
	form,
	trigger,
}: CreateTransferDialogProps) {
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
					<DialogTitle>Create New Delivery Order</DialogTitle>
					<DialogDescription>
						Enter the details for the new Delivery order. Select outlet from
						GQL and add line items (stock and amount).
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<FieldGroup>
						<form.Field
							name="transferOrderNumber"
							children={(field: any) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Delivery Order Number
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

						<form.Field
							name="expectedDeliveryDate"
							children={(field: any) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Expected Delivery Date
										</FieldLabel>
										<Input
											id={field.name}
											type="date"
											value={field.state.value}
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

						<form.Subscribe
							selector={(state: any) => state.values.items ?? []}
						>
							{(items: CreateTransferLineItem[]) => (
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
									{isSubmitting ? "Creating..." : "Create Delivery Order"}
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
	item: CreateTransferLineItem & { skuCode?: string; description?: string };
	items: (CreateTransferLineItem & { skuCode?: string; description?: string })[];
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
						onClick={() => {
							form.setFieldValue(
								"items",
								items.filter((_, i) => i !== index),
							);
						}}
					>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				) : null}
			</TableCell>
		</TableRow>
	);
}

export function CreateTransferDialogTrigger({
	open,
	onOpenChange,
	form,
	createMutation,
}: Omit<CreateTransferDialogProps, "trigger">) {
	return (
		<CreateTransferDialog
			open={open}
			onOpenChange={onOpenChange}
			form={form}
			createMutation={createMutation}
			trigger={
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Create Delivery Order
				</Button>
			}
		/>
	);
}
