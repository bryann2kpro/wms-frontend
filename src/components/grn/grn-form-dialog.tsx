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
	DialogTrigger,
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
import {
	Package,
	Calendar,
	FileText,
	Upload,
	XCircle,
	Plus,
	Send,
	Trash2,
	Clock,
} from "lucide-react";
import type { GrnDetailForList } from "@/lib/graphql/types";
import type { Skus } from "@/lib/graphql/types";
import {
	UPDATE_GRN_MUTATION,
	DELETE_GRN_MUTATION,
	UI_STATUS_TO_GQL,
} from "@/lib/graphql/grns";
import {
	CREATE_SKU_MUTATION,
	type CreateSkuInput,
} from "@/lib/graphql/skus";
import type { GRNStatus } from "@/data/grn.mock-data";

export type GRNLineItemForm = {
	skuCode: string;
	description: string;
	qty: number;
	uom: string;
	unitPrice: number;
};

function toDatetimeLocal(value: string | null | undefined): string {
	if (value == null || value === "") return "";
	const ms = Number(value);
	const date =
		!isNaN(ms) && String(ms) === String(value).trim()
			? new Date(ms)
			: new Date(value);
	return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

/** Dialog to create a new SKU; on success calls onSuccess with new SKU and optionally onRefetch. */
function CreateSkuDialog({
	open,
	onOpenChange,
	stockUnits,
	onSuccess,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
	onSuccess: (newSku: { skuCode: string; skuDescription: string; skuUom: string }) => void;
}) {
	const [createSku, { loading: creating }] = useMutation(CREATE_SKU_MUTATION, {
		onCompleted: (data: unknown) => {
			const created = (data as { createSku?: { skuCode: string; skuDescription: string; skuUom: string } })
				?.createSku;
			if (created) {
				onSuccess({
					skuCode: created.skuCode,
					skuDescription: created.skuDescription ?? "",
					skuUom: created.skuUom,
				});
			}
			onOpenChange(false);
		},
	});

	const createForm = useForm({
		defaultValues: {
			skuCode: "",
			skuDescription: "",
			skuQuantity: 0,
			skuUom: stockUnits[0]?.stockUnitId ?? "",
		},
		onSubmit: async ({ value }) => {
			const input: CreateSkuInput = {
				skuCode: value.skuCode,
				skuDescription: value.skuDescription,
				skuQuantity: value.skuQuantity,
				skuUom: value.skuUom,
			};
			await createSku({ variables: { input } });
			createForm.reset();
		},
	});

	useEffect(() => {
		if (open) {
			createForm.reset({
				skuCode: "",
				skuDescription: "",
				skuQuantity: 0,
				skuUom: stockUnits[0]?.stockUnitId ?? "",
			});
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create new SKU</DialogTitle>
					<DialogDescription>
						Add a new stock keeping unit. It will be available for selection in line items.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						createForm.handleSubmit();
					}}
					className="space-y-4 py-2"
				>
					<FieldGroup>
						<createForm.Field name="skuCode">
							{(field) => (
								<Field>
									<FieldLabel>Code</FieldLabel>
									<Input
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="e.g. SKU-001"
									/>
								</Field>
							)}
						</createForm.Field>
						<createForm.Field name="skuDescription">
							{(field) => (
								<Field>
									<FieldLabel>Description</FieldLabel>
									<Input
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Product description"
									/>
								</Field>
							)}
						</createForm.Field>
						<div className="grid grid-cols-2 gap-2">
							<createForm.Field name="skuQuantity">
								{(field) => (
									<Field>
										<FieldLabel>Quantity</FieldLabel>
										<Input
											type="number"
											min={0}
											value={field.state.value}
											onChange={(e) => field.handleChange(Number(e.target.value) || 0)}
										/>
									</Field>
								)}
							</createForm.Field>
							<createForm.Field name="skuUom">
								{(field) => (
									<Field>
										<FieldLabel>UOM</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={field.handleChange}
										>
											<SelectTrigger>
												<SelectValue placeholder="UOM" />
											</SelectTrigger>
											<SelectContent>
												{stockUnits.map((u) => (
													<SelectItem key={u.stockUnitId} value={u.stockUnitId}>
														{u.unitCode}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							</createForm.Field>
						</div>
					</FieldGroup>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={creating}>
							{creating ? "Creating..." : "Create SKU"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function GRNLineRow({
	item,
	index,
	items,
	onItemsChange,
	skuCodes,
	skuOptions,
	stockUnits,
	onOpenCreateSku,
}: {
	item: GRNLineItemForm;
	index: number;
	items: GRNLineItemForm[];
	onItemsChange: (newItems: GRNLineItemForm[]) => void;
	skuCodes: string[];
	skuOptions: Skus[];
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
	/** Called when user clicks "Create new SKU" in the combobox dropdown */
	onOpenCreateSku?: () => void;
}) {
	const usedByOthersKey = items
		.filter((_, i) => i !== index)
		.map((it) => it.skuCode)
		.filter(Boolean)
		.sort()
		.join(",");
	const availableSkuCodes = useMemo(() => {
		const usedByOthers = new Set(
			usedByOthersKey ? usedByOthersKey.split(",") : []
		);
		return skuCodes.filter(
			(code) => !usedByOthers.has(code) || code === (item.skuCode ?? "")
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
		[item.skuCode, index, items, onItemsChange]
	);

	useEffect(
		() => () => {
			if (inputValueChangeTimeoutRef.current) {
				clearTimeout(inputValueChangeTimeoutRef.current);
			}
		},
		[]
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
										u.unitCode === sku.skuUom
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
						{onOpenCreateSku && (
							<div className="border-t p-1">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-full justify-start gap-2"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onOpenCreateSku();
									}}
								>
									<Plus className="h-4 w-4" />
									Create new SKU
								</Button>
							</div>
						)}
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

/** Payload for create mode submit */
export type GrnCreateSubmitPayload = {
	grnNumber: string;
	poReference: string;
	supplierDO: string;
	receivedDate: string;
	notes: string;
	submitIntent: "draft" | "submit";
	items: GRNLineItemForm[];
};

export type GrnFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	/** Required when mode is "edit" */
	grn?: GrnDetailForList | null;
	skuOptions: Skus[];
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
	/** Called after successful create; optional close/refetch handled by parent */
	onCreateSubmit?: (payload: GrnCreateSubmitPayload) => Promise<void>;
	/** Called after successful edit (save/update/delete) */
	onSuccess?: () => void;
	/** Only for create: show trigger button (e.g. "Create GRN") */
	trigger?: React.ReactNode;
	/** Permission to show create actions in footer (create mode) */
	canCreate?: boolean;
	/** Called after a new SKU is created so parent can refetch SKU list */
	onSkusRefetch?: () => void | Promise<void>;
};

export function GrnFormDialog({
	open,
	onOpenChange,
	mode,
	grn = null,
	skuOptions,
	stockUnits,
	onCreateSubmit,
	onSuccess,
	trigger,
	canCreate = true,
	onSkusRefetch,
}: GrnFormDialogProps) {
	const skuCodes = useMemo(() => skuOptions.map((s) => s.skuCode), [skuOptions]);
	const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
	const [createSkuOpen, setCreateSkuOpen] = useState(false);
	const [createSkuForRowIndex, setCreateSkuForRowIndex] = useState<number | null>(null);
	const createIntentRef = useRef<"draft" | "submit">("draft");

	const [updateGRN] = useMutation(UPDATE_GRN_MUTATION, {
		onCompleted: () => {
			onSuccess?.();
			if (mode === "edit") onOpenChange(false);
		},
	});

	const [deleteGRN, { loading: deleteLoading }] = useMutation(DELETE_GRN_MUTATION, {
		onCompleted: () => {
			onSuccess?.();
			onOpenChange(false);
		},
	});

	const form = useForm({
		defaultValues: {
			grnNumber: "",
			poReference: "",
			supplierDO: "",
			receivedDate: "",
			notes: "",
			items: [] as GRNLineItemForm[],
		},
		onSubmit: async ({ value }) => {
			if (mode === "create") {
				const payload: GrnCreateSubmitPayload = {
					grnNumber: value.grnNumber,
					poReference: value.poReference,
					supplierDO: value.supplierDO,
					receivedDate: value.receivedDate,
					notes: value.notes ?? "",
					submitIntent: createIntentRef.current,
					items: (value.items ?? []).map((i) => ({
						skuCode: i.skuCode,
						description: i.description,
						qty: i.qty,
						uom: i.uom,
						unitPrice: i.unitPrice,
					})),
				};
				await onCreateSubmit?.(payload);
				form.reset();
				form.setFieldValue("items", []);
				onOpenChange(false);
				return;
			}
			// Edit mode
			if (!grn?.id) return;
			const parsedDate = value.receivedDate ? new Date(value.receivedDate) : null;
			const status = (grn.status ?? "Draft") as GRNStatus;
			await updateGRN({
				variables: {
					id: grn.id,
					input: {
						grnNo: value.grnNumber || undefined,
						supplierId: grn.supplierId,
						supplierDeliveryId: grn.supplierDeliveryId ?? null,
						supplierDeliveryNo: value.supplierDO || undefined,
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
		if (!open) return;
		if (mode === "edit" && grn) {
			const initialItems: GRNLineItemForm[] = grn.items.map((it) => {
				const sku = skuOptions.find((s) => s.skuCode === it.skuCode);
				const uomUnit = sku
					? stockUnits.find(
							(u) => u.stockUnitId === sku.skuUom || u.unitCode === sku.skuUom
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
				supplierDO: (grn.supplierDeliveryNo ?? grn.supplierDeliveryId) ?? "",
				receivedDate: toDatetimeLocal(grn.receivedAt),
				notes: grn.notes ?? "",
				items: initialItems,
			});
		} else if (mode === "create") {
			form.reset();
			form.setFieldValue("items", []);
			setProofFiles([]);
		}
	}, [open, mode, grn?.id]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			(document.activeElement as HTMLElement | null)?.blur();
			setProofFiles([]);
			if (mode === "create") {
				form.setFieldValue("items", []);
			}
		}
		onOpenChange(next);
	};

	const handleSubmitForApproval = () => {
		if (!grn?.id || grn.status !== "Draft") return;
		updateGRN({
			variables: {
				id: grn.id,
				input: { status: UI_STATUS_TO_GQL["Submitted"] },
			},
		});
	};

	const handleDelete = () => {
		if (!grn?.id) return;
		if (!window.confirm("Delete this GRN and all its items? This cannot be undone."))
			return;
		deleteGRN({ variables: { id: grn.id } });
	};

	const handleCreateSkuSuccess = useCallback(
		(newSku: { skuCode: string; skuDescription: string; skuUom: string }) => {
			void onSkusRefetch?.();
			if (createSkuForRowIndex !== null) {
				const items = form.state.values.items ?? [];
				const unitCode =
					stockUnits.find((u) => u.stockUnitId === newSku.skuUom)?.unitCode ?? "";
				const updated = [...items];
				if (updated[createSkuForRowIndex]) {
					updated[createSkuForRowIndex] = {
						...updated[createSkuForRowIndex],
						skuCode: newSku.skuCode,
						description: newSku.skuDescription,
						uom: unitCode,
					};
					form.setFieldValue("items", updated);
				}
				setCreateSkuForRowIndex(null);
			}
		},
		[createSkuForRowIndex, stockUnits, onSkusRefetch, form]
	);

	const isCreate = mode === "create";
	const title = isCreate ? "Create New GRN" : "Edit GRN";
	const description = isCreate
		? "Enter the details for the new goods receipt note"
		: "Update the goods receipt note details";

	const dialogContent = (
		<DialogContent
			className="max-h-[90vh] overflow-y-auto"
			style={{ maxWidth: "min(95vw, 1400px)" }}
		>
			<DialogHeader className="pb-4">
				<DialogTitle className="text-2xl font-semibold flex items-center gap-2">
					<Package className="h-5 w-5 text-primary" />
					{title}
				</DialogTitle>
				<DialogDescription className="text-base">{description}</DialogDescription>
			</DialogHeader>
			<Separator />
			{(isCreate || grn) && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-6 py-4"
				>
					<div className="lg:grid-cols-3">
						<div className="lg:col-span-2 space-y-6">
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
												{(field) => {
													const isInvalid =
														field.state.meta.isTouched && !field.state.meta.isValid;
													return (
														<Field data-invalid={isInvalid}>
															<FieldLabel htmlFor={field.name}>GRN Number</FieldLabel>
															<Input
																id={field.name}
																value={field.state.value}
																placeholder="GRN-2024-001"
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
											</form.Field>
											<form.Field name="poReference">
												{(field) => {
													const isInvalid =
														field.state.meta.isTouched && !field.state.meta.isValid;
													return (
														<Field data-invalid={isInvalid}>
															<FieldLabel htmlFor={field.name}>PO Reference</FieldLabel>
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
											</form.Field>
										</div>
										<form.Field name="supplierDO">
											{(field) => {
												const isInvalid =
													field.state.meta.isTouched && !field.state.meta.isValid;
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>Supplier DO</FieldLabel>
														<Input
															id={field.name}
															value={field.state.value}
															placeholder="DO-2024-001"
															onBlur={field.handleBlur}
															required={isCreate}
															onChange={(e) => field.handleChange(e.target.value)}
															aria-invalid={isInvalid}
														/>
														{isInvalid && (
															<FieldError errors={field.state.meta.errors} />
														)}
													</Field>
												);
											}}
										</form.Field>
										<form.Field name="receivedDate">
											{(field) => {
												const isInvalid =
													field.state.meta.isTouched && !field.state.meta.isValid;
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel
															htmlFor={field.name}
															className="flex items-center gap-2"
														>
															<Calendar className="h-4 w-4 text-muted-foreground" />
															Received Date/Time
														</FieldLabel>
														<Input
															id={field.name}
															type="datetime-local"
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
												Add line items and fill in the details below
											</CardDescription>
										</div>
										<form.Field name="items">
											{(field) => {
												const items = (field.state.value ?? []) as GRNLineItemForm[];
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
											const items = (field.state.value ?? []) as GRNLineItemForm[];
											return (
												<div className="rounded-lg border">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>SKU</TableHead>
																<TableHead>Description</TableHead>
																<TableHead>Qty</TableHead>
																<TableHead>UOM</TableHead>
																<TableHead className="text-right w-[80px]">
																	Actions
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{items.length === 0 ? (
																<TableRow>
																	<TableCell
																		colSpan={5}
																		className="h-40 text-center"
																	>
																		<div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
																			<div className="rounded-full bg-muted p-3">
																				<Package className="h-10 w-10 opacity-60" />
																			</div>
																			<div>
																				<p className="text-sm font-medium">No line items yet</p>
																				<p className="text-xs mt-1">
																					Click &quot;Add Line Item&quot; above to add your first
																					item, then fill in the table
																				</p>
																			</div>
																		</div>
																	</TableCell>
																</TableRow>
															) : (
																items.map((item, index) => (
																	<GRNLineRow
																		key={`line-${index}-${item.skuCode || "new"}`}
																		item={item}
																		index={index}
																		items={items}
																		onItemsChange={field.handleChange}
																		skuCodes={skuCodes}
																		skuOptions={skuOptions}
																		stockUnits={stockUnits}
																		onOpenCreateSku={() => {
																			setCreateSkuForRowIndex(index);
																			setCreateSkuOpen(true);
																		}}
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
					</div>

					<form.Subscribe selector={(state) => [state.isSubmitting, state.canSubmit]}>
						{([isSubmitting, canSubmit]) => (
							<>
								<Separator className="mt-6" />
								<DialogFooter className="pt-4 flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => handleOpenChange(false)}
										disabled={isSubmitting || deleteLoading}
									>
										Cancel
									</Button>
									{isCreate && canCreate && (
										<>
											<Button
												type="button"
												variant="outline"
												onClick={() => {
													createIntentRef.current = "draft";
													form.handleSubmit();
												}}
												disabled={isSubmitting}
											>
												Save Draft
											</Button>
											<Button
												type="button"
												disabled={isSubmitting || !canSubmit}
												className="min-w-[140px]"
												onClick={() => {
													createIntentRef.current = "submit";
													form.handleSubmit();
												}}
											>
												{isSubmitting ? (
													<>
														<Clock className="mr-2 h-4 w-4 animate-spin" />
														Submitting...
													</>
												) : (
													<>
														<Send className="mr-2 h-4 w-4" />
														Submit for Approval
													</>
												)}
											</Button>
										</>
									)}
									{!isCreate && grn && (
										<>
											{grn.status === "Draft" && (
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
											<Button
												type="submit"
												disabled={isSubmitting || deleteLoading}
											>
												{isSubmitting ? "Saving..." : "Save changes"}
											</Button>
										</>
									)}
								</DialogFooter>
							</>
						)}
					</form.Subscribe>
				</form>
			)}
		</DialogContent>
	);

	const createSkuDialog = (
		<CreateSkuDialog
			open={createSkuOpen}
			onOpenChange={setCreateSkuOpen}
			stockUnits={stockUnits}
			onSuccess={handleCreateSkuSuccess}
		/>
	);

	if (isCreate && trigger) {
		return (
			<>
				<Dialog open={open} onOpenChange={handleOpenChange}>
					<DialogTrigger asChild>{trigger}</DialogTrigger>
					{dialogContent}
				</Dialog>
				{createSkuDialog}
			</>
		);
	}

	return (
		<>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				{dialogContent}
			</Dialog>
			{createSkuDialog}
		</>
	);
}
