"use client";

import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Package, Calendar, FileText, Upload, XCircle, Plus, Send, Trash2 } from "lucide-react";
import type { GrnDetailForList } from "@/lib/graphql/types";
import type { Skus } from "@/lib/graphql/types";
import {
	UPDATE_GRN_MUTATION,
	DELETE_GRN_MUTATION,
	UI_STATUS_TO_GQL,
} from "@/lib/graphql/grns";
import type { GRNStatus } from "@/data/grn.mock-data";

export type EditGRNLineItem = {
	skuCode: string;
	description: string;
	qty: number;
	uom: string;
	unitPrice: number;
};

function toDatetimeLocal(value: string | null | undefined): string {
	if (value == null || value === "") return "";
	const ms = Number(value);
	const date = !isNaN(ms) && String(ms) === String(value).trim()
		? new Date(ms)
		: new Date(value);
	return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function EditGRNLineRow({
	item,
	index,
	items,
	onItemsChange,
	skuCodes,
	skuOptions,
	stockUnits,
}: {
	item: EditGRNLineItem;
	index: number;
	items: EditGRNLineItem[];
	onItemsChange: (newItems: EditGRNLineItem[]) => void;
	skuCodes: string[];
	skuOptions: Skus[];
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
}) {
	const usedByOthersKey = items
		.filter((_, i) => i !== index)
		.map((it) => it.skuCode)
		.filter(Boolean)
		.sort()
		.join(",");
	const availableSkuCodes = useMemo(() => {
		const usedByOthers = new Set(
			usedByOthersKey ? usedByOthersKey.split(",") : [],
		);
		return skuCodes.filter(
			(code) => !usedByOthers.has(code) || code === (item.skuCode ?? ""),
		);
	}, [usedByOthersKey, item.skuCode, skuCodes]);

	const itemsWithCustom = useMemo(() => {
		const current = item.skuCode?.trim() ?? "";
		if (!current || availableSkuCodes.includes(current)) return availableSkuCodes;
		return [...availableSkuCodes, current];
	}, [availableSkuCodes, item.skuCode]);

	const inputValueChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onInputValueChange = useCallback(
		(inputValue: string) => {
			const trimmed = inputValue?.trim() ?? "";
			if (trimmed === (item.skuCode ?? "")) return;
			if (inputValueChangeTimeoutRef.current) {
				clearTimeout(inputValueChangeTimeoutRef.current);
			}
			inputValueChangeTimeoutRef.current = setTimeout(() => {
				inputValueChangeTimeoutRef.current = null;
				const newItems = [...items];
				newItems[index] = { ...newItems[index], skuCode: trimmed };
				onItemsChange(newItems);
			}, 400);
		},
		[item.skuCode, index, items, onItemsChange],
	);

	useEffect(
		() => () => {
			if (inputValueChangeTimeoutRef.current) {
				clearTimeout(inputValueChangeTimeoutRef.current);
			}
		},
		[],
	);

	return (
		<TableRow key={`line-${index}-${item.skuCode || "new"}`}>
			<TableCell>
				<Combobox
					items={itemsWithCustom}
					value={item.skuCode ?? ""}
					onValueChange={(value) => {
						if (inputValueChangeTimeoutRef.current) {
							clearTimeout(inputValueChangeTimeoutRef.current);
							inputValueChangeTimeoutRef.current = null;
						}
						const sku = skuOptions.find((s: Skus) => s.skuCode === value);
						const uomUnit = sku
							? stockUnits.find(
									(u) =>
										u.stockUnitId === sku.skuUom ||
										u.unitCode === sku.skuUom,
								)
							: undefined;
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							skuCode: value ?? "",
							description: sku?.skuDescription ?? newItems[index].description ?? "",
							uom:
								uomUnit?.unitCode ??
								sku?.skuUom ??
								newItems[index].uom ??
								"",
						};
						onItemsChange(newItems);
					}}
					onInputValueChange={onInputValueChange}
				>
					<ComboboxInput
						placeholder="SKU code"
						className="font-medium min-w-[160px]"
					/>
					<ComboboxContent>
						<ComboboxList>
							{(skuCode: string) => {
								const s = skuOptions.find((o) => o.skuCode === skuCode);
								return (
									<ComboboxItem key={skuCode} value={skuCode}>
										{s?.skuDescription ?? skuCode}
									</ComboboxItem>
								);
							}}
						</ComboboxList>
						<ComboboxEmpty>No SKU found.</ComboboxEmpty>
					</ComboboxContent>
				</Combobox>
			</TableCell>
			<TableCell>
				<Input
					value={item.description}
					onChange={(e) => {
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							description: e.target.value,
						};
						onItemsChange(newItems);
					}}
					placeholder="Description"
				/>
			</TableCell>
			<TableCell>
				<Input
					type="number"
					min={1}
					value={item.qty}
					onChange={(e) => {
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							qty: Number(e.target.value) || 1,
						};
						onItemsChange(newItems);
					}}
					className="w-20"
				/>
			</TableCell>
			<TableCell>
				<Select
					value={item.uom}
					onValueChange={(value) => {
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							uom: value,
						};
						onItemsChange(newItems);
					}}
				>
					<SelectTrigger className="w-[120px]">
						<SelectValue placeholder="UOM" />
					</SelectTrigger>
					<SelectContent>
						{stockUnits.map((unit) => (
							<SelectItem key={unit.stockUnitId} value={unit.unitCode}>
								{unit.unitCode}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell className="text-right">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
					className="text-destructive hover:text-destructive"
				>
					<XCircle className="h-4 w-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
}

export type EditGrnDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	grn: GrnDetailForList | null;
	onSuccess: () => void;
	skuOptions: Skus[];
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
};

export function EditGrnDialog({
	open,
	onOpenChange,
	grn,
	onSuccess,
	skuOptions,
	stockUnits,
}: EditGrnDialogProps) {
	const skuCodes = useMemo(() => skuOptions.map((s) => s.skuCode), [skuOptions]);
	const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);

	const [updateGRN] = useMutation(UPDATE_GRN_MUTATION, {
		onCompleted: () => {
			onSuccess();
		},
	});

	const [deleteGRN, { loading: deleteLoading }] = useMutation(DELETE_GRN_MUTATION, {
		onCompleted: () => {
			onSuccess();
		},
	});

	const handleSubmitForApproval = () => {
		if (!grn?.id || grn.status !== "Draft") return;
		updateGRN({
			variables: {
				id: grn.id,
				input: {
					status: UI_STATUS_TO_GQL["Submitted"],
				},
			},
		});
	};

	const handleDelete = () => {
		if (!grn?.id) return;
		if (!window.confirm("Delete this GRN and all its items? This cannot be undone.")) return;
		deleteGRN({ variables: { id: grn.id } });
	};

	const form = useForm({
		defaultValues: {
			grnNumber: "",
			poReference: "",
			supplierDO: "",
			supplierDeliveryNo: "",
			receivedDate: "",
			notes: "",
			items: [] as EditGRNLineItem[],
		},
		onSubmit: async ({ value }) => {
			if (!grn?.id) return;
			const parsedDate = value.receivedDate ? new Date(value.receivedDate) : null;
			const status = (grn.status ?? "Draft") as GRNStatus;
			await updateGRN({
				variables: {
					id: grn.id,
					input: {
						grnNo: value.grnNumber || undefined,
						supplierId: value.supplierDO || undefined,
						supplierDeliveryNo: value.supplierDeliveryNo || undefined,
						poNo: value.poReference || undefined,
						receivedAt: parsedDate?.toISOString() ?? undefined,
						status: UI_STATUS_TO_GQL[status],
						notes: value.notes || undefined,
						items: (value.items ?? []).map((i) => {
							const uomId = i.uom
								? stockUnits.find((u) => u.unitCode === i.uom)?.stockUnitId ?? i.uom
								: undefined;
							return {
								skuId: skuOptions.find((s) => s.skuCode === i.skuCode)?.skuId ?? undefined,
								skuCode: i.skuCode,
								skuDescription: i.description ?? undefined,
								qty: String(i.qty),
								skuUom: uomId ?? undefined,
							};
						}),
					},
				},
			});
		},
	});

	useEffect(() => {
		if (open && grn) {
			const initialItems: EditGRNLineItem[] = grn.items.map((it) => {
				const sku = skuOptions.find((s) => s.skuCode === it.skuCode);
				const uomUnit = sku
					? stockUnits.find(
							(u) => u.stockUnitId === sku.skuUom || u.unitCode === sku.skuUom,
						)
					: undefined;
				return {
					skuCode: it.skuCode ?? "",
					description: it.skuDescription ?? "",
					qty: it.expectedQuantity ?? 0,
					uom: uomUnit?.unitCode ?? sku?.skuUom ?? "",
					unitPrice: 0,
				};
			});
			form.reset({
				grnNumber: grn.grnNo ?? "",
				poReference: grn.poNo ?? "",
				supplierDO: grn.supplierId ?? "",
				supplierDeliveryNo: grn.supplierDeliveryId ?? "",
				receivedDate: toDatetimeLocal(grn.receivedAt),
				notes: grn.notes ?? "",
				items: initialItems,
			});
		}
	}, [open, grn?.id]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			(document.activeElement as HTMLElement | null)?.blur();
			setProofFiles([]);
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto"
				style={{ maxWidth: "min(95vw, 1400px)" }}
			>
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-semibold flex items-center gap-2">
						<Package className="h-5 w-5 text-primary" />
						Edit GRN
					</DialogTitle>
					<DialogDescription className="text-base">
						Update the goods receipt note details
					</DialogDescription>
				</DialogHeader>
				<Separator />
				{grn && (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-6 py-4"
					>
						<div className="space-y-6">
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base font-semibold flex items-center gap-2">
										<FileText className="h-4 w-4 text-muted-foreground" />
										Basic Information
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<FieldGroup>
										<div className="grid gap-4 sm:grid-cols-2">
											<form.Field name="grnNumber">
												{(field) => (
													<Field>
														<FieldLabel htmlFor={field.name}>GRN Number</FieldLabel>
														<Input
															id={field.name}
															value={field.state.value}
															placeholder="GRN-2024-001"
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.value)}
														/>
													</Field>
												)}
											</form.Field>
											<form.Field name="poReference">
												{(field) => (
													<Field>
														<FieldLabel htmlFor={field.name}>PO Reference</FieldLabel>
														<Input
															id={field.name}
															value={field.state.value}
															placeholder="PO-2024-001"
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.value)}
														/>
													</Field>
												)}
											</form.Field>
										</div>
										<form.Field name="supplierDO">
											{(field) => (
												<Field>
													<FieldLabel htmlFor={field.name}>Supplier ID</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="Supplier ID"
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
													/>
												</Field>
											)}
										</form.Field>
										<form.Field name="supplierDeliveryNo">
											{(field) => (
												<Field>
													<FieldLabel htmlFor={field.name}>Supplier DO</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="DO-2024-001"
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
													/>
												</Field>
											)}
										</form.Field>
										<form.Field name="receivedDate">
											{(field) => (
												<Field>
													<FieldLabel htmlFor={field.name} className="flex items-center gap-2">
														<Calendar className="h-4 w-4 text-muted-foreground" />
														Received Date/Time
													</FieldLabel>
													<Input
														id={field.name}
														type="datetime-local"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
													/>
												</Field>
											)}
										</form.Field>
									</FieldGroup>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between gap-4">
										<div>
											<CardTitle className="text-base font-semibold flex items-center gap-2">
												<Package className="h-4 w-4 text-muted-foreground" />
												Line Items
											</CardTitle>
											<CardDescription className="text-xs mt-1">
												Edit line items below
											</CardDescription>
										</div>
										<form.Field name="items">
											{(field) => {
												const items = (field.state.value ?? []) as EditGRNLineItem[];
												return (
													<Button
														type="button"
														variant="default"
														size="sm"
														onClick={() => {
															field.handleChange([
																...items,
																{
																	skuCode: "",
																	description: "",
																	uom: "",
																	unitPrice: 0,
																	qty: 1,
																},
															]);
														}}
													>
														<Plus className="mr-2 h-4 w-4" />
														Add Line Item
													</Button>
												);
											}}
										</form.Field>
									</div>
								</CardHeader>
								<CardContent>
									<form.Field name="items">
										{(field) => {
											const items = (field.state.value ?? []) as EditGRNLineItem[];
											return (
												<div className="rounded-lg border">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>SKU</TableHead>
																<TableHead>Description</TableHead>
																<TableHead>Qty</TableHead>
																<TableHead>UOM</TableHead>
																<TableHead className="text-right w-[80px]">Actions</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{items.length === 0 ? (
																<TableRow>
																	<TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
																		No line items. Add one above.
																	</TableCell>
																</TableRow>
															) : (
																items.map((item, index) => (
																	<EditGRNLineRow
																		key={`line-${index}-${item.skuCode || "new"}`}
																		item={item}
																		index={index}
																		items={items}
																		onItemsChange={field.handleChange}
																		skuCodes={skuCodes}
																		skuOptions={skuOptions}
																		stockUnits={stockUnits}
																	/>
																))
															)}
														</TableBody>
													</Table>
												</div>
											);
										}}
									</form.Field>
								</CardContent>
							</Card>

							{/* Proof Upload */}
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base font-semibold flex items-center gap-2">
										<Upload className="h-4 w-4 text-muted-foreground" />
										Proof Upload
									</CardTitle>
									<CardDescription className="text-xs">
										Upload supporting documents (max 5 files)
									</CardDescription>
								</CardHeader>
								<CardContent>
									<FileUpload
										files={proofFiles}
										onFilesChange={setProofFiles}
										maxFiles={5}
										accept="image/*,application/pdf"
									/>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base font-semibold flex items-center gap-2">
										<FileText className="h-4 w-4 text-muted-foreground" />
										Additional Notes
									</CardTitle>
								</CardHeader>
								<CardContent>
									<form.Field name="notes">
										{(field) => (
											<Field>
												<FieldLabel htmlFor={field.name} className="sr-only">
													Notes
												</FieldLabel>
												<Textarea
													id={field.name}
													value={field.state.value}
													placeholder="Enter any additional notes or comments..."
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													className="min-h-[100px] resize-none"
												/>
											</Field>
										)}
									</form.Field>
								</CardContent>
							</Card>
						</div>

						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<>
									<Separator className="mt-6" />
									<DialogFooter className="pt-4 flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => onOpenChange(false)}
											disabled={isSubmitting || deleteLoading}
										>
											Cancel
										</Button>
										{grn?.status === "Draft" && (
											<>
												<Button
													type="button"
													variant="outline"
													className="text-destructive hover:text-destructive"
													onClick={handleDelete}
													disabled={isSubmitting || deleteLoading}
												>
													<Trash2 className="mr-2 h-4 w-4" />
													{deleteLoading ? "Deleting..." : "Delete"}
												</Button>
												<Button
													type="button"
													variant="outline"
													onClick={handleSubmitForApproval}
													disabled={isSubmitting || deleteLoading}
												>
													<Send className="mr-2 h-4 w-4" />
													Submit for Approval
												</Button>
											</>
										)}
										<Button type="submit" disabled={isSubmitting || deleteLoading}>
											{isSubmitting ? "Saving..." : "Save changes"}
										</Button>
									</DialogFooter>
								</>
							)}
						</form.Subscribe>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
