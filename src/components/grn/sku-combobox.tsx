"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import request from 'graphql-request';
import { env } from "@/env";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
	SKUS_AND_UOM_QUERY,
	CREATE_SKU_MUTATION,
	type Sku,
	type CreateSkuInput,
} from "@/lib/graphql/skus";
import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Field as UiField, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Skus } from "@/lib/graphql/types";


const createSkuSchema = z.object({
	skuCode: z.string().min(1, "Code is required"),
	skuDescription: z.string().min(1, "Description is required"),
	skuQuantity: z.number().min(0),
	skuUom: z.uuid().min(1, "UOM is required"),
});

export type SkuLineValue = {
	sku: string;
	skuCode: string;
	description: string;
	uom: string;
	// unitPrice: number;
	skuId: string;
	isActive: boolean;
};

type SkuComboboxProps = {
	value: SkuLineValue | null;
	onChange: (value: SkuLineValue) => void;
	placeholder?: string;
	className?: string;
	createdBy?: string;
	stockUnitCodes?: string[];
	/** SKU codes already used in other rows (e.g. other line items). Those SKUs are hidden from the list so the same SKU cannot be added twice. */
	usedSkuCodes?: string[];
};

type StockUnit = {
	stockUnitId: string;
	unitCode: string;
};

export function SkuCombobox({
	value,
	onChange,
	placeholder = "Search or select SKU...",
	className,
	usedSkuCodes,
}: SkuComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data, isLoading: loading } = useQuery({
		queryKey: ['skus'],
		queryFn: () => {

			const headers = new Headers();
			headers.set('Authorization', `Bearer ${localStorage.getItem('access_token')}`);

			return request(env.VITE_GRAPHQL_ENDPOINT, SKUS_AND_UOM_QUERY, {}, headers)
		},
	});

	const skus = data?.skus.query ?? [];
	const uoms = data?.stockUnits?.query ?? [];

	function getErrorMessage(err: unknown): string {
		if (err && typeof err === "object" && "response" in err) {
			const res = (err as { response?: { errors?: Array<{ message?: string }> } }).response;
			const msg = res?.errors?.[0]?.message;
			if (msg) return msg;
		}
		if (err && typeof err === "object" && "message" in err && typeof (err as Error).message === "string")
			return (err as Error).message;
		if (err instanceof Error) return err.message;
		return String(err ?? "Failed to create SKU");
	}

	const createSku = useMutation({
		mutationFn: (input: CreateSkuInput & { isActive: boolean }) => {
			const headers = new Headers();
			headers.set('Authorization', `Bearer ${localStorage.getItem('access_token')}`);

			return request(
				env.VITE_GRAPHQL_ENDPOINT,
				CREATE_SKU_MUTATION,
				{ input },
				headers
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['skus'] });
			toast.success('SKU created successfully');
			setCreateOpen(false);
			form.reset();
		},
		onError: (err) => {
			toast.error(getErrorMessage(err));
		},
	});

	const form = useForm({
		defaultValues: {
			skuCode: "",
			skuDescription: "",
			skuQuantity: 0,
			skuUom: uoms[0]?.stockUnitId ?? "",
		},
		validators: {
			onSubmit: createSkuSchema,
		},
		onSubmit: async ({ value }) => {
			createSku.mutate({
				...value,
				isActive: true,
			});
		},
	})

	const filtered = useMemo(() => {
		// Exclude SKUs already used in other rows, but always include the current selection so it still displays
		const available =
			usedSkuCodes?.length ?
				skus.filter(
					(s: Skus) =>
						!usedSkuCodes.includes(s.skuCode) || s.skuCode === value?.skuCode,
				)
				: skus;
		if (!search.trim()) return available;
		const q = search.toLowerCase();
		return available.filter(
			(s: Skus) =>
				s.skuCode.toLowerCase().includes(q) ||
				s.skuDescription?.toLowerCase().includes(q),
		);
	}, [skus, search, usedSkuCodes, value?.skuCode]);

	function handleSelect(sku: Sku) {
		const s = sku as unknown as Skus;
		const uomUnit = uoms?.find((u: StockUnit) => u.stockUnitId === s.skuUom);
		onChange({
			sku: s.skuCode ?? s.skuDescription ?? sku.skuId,
			skuCode: s.skuCode ?? "",
			description: s.skuDescription ?? "",
			uom: uomUnit?.unitCode ?? s.skuUom ?? "",
			skuId: sku.skuId,
			isActive: s.isActive ?? true,
		});
		setOpen(false);
		setSearch("");
	}

	const displayLabel = value
		? `${value.sku}${value.description ? ` – ${value.description}` : ""}`
		: null;

	return (
		<div className={cn("flex gap-1", className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="w-full justify-between font-normal"
					>
						<span className="truncate">
							{displayLabel ?? placeholder}
						</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
					<div className="flex flex-col">
						<div className="border-b p-2">
							<Input
								placeholder="Search SKU..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="h-8"
								autoFocus
							/>
						</div>
						<ScrollArea className="max-h-[280px]">
							{loading ? (
								<div className="py-6 text-center text-sm text-muted-foreground">
									Loading SKUs...
								</div>
							) : filtered.length === 0 ? (
								<div className="py-6 text-center text-sm text-muted-foreground">
									{search.trim()
										? "No SKUs match your search."
										: "No SKUs in the system."}
								</div>
							) : (
								<ul className="p-1">
									{filtered.map((sku: Skus) => (
										<li key={sku.skuId}>
											<button
												type="button"
												className={cn(
													"flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
													value?.skuId === sku.skuId && "bg-accent",
												)}
												onClick={() => handleSelect(sku as unknown as Sku)}
											>
												{value?.skuId === sku.skuId ? (
													<Check className="h-4 w-4 shrink-0" />
												) : (
													<span className="w-4" />
												)}
												<span className="truncate font-medium">
													{sku.skuCode}
												</span>
												{sku.skuDescription && (
													<span className="truncate text-muted-foreground">
														– {sku.skuDescription}
													</span>
												)}
											</button>
										</li>
									))}
								</ul>
							)}
						</ScrollArea>
						<div className="border-t p-1">
							<form
								id="create-sku-form"
								onSubmit={(e) => {
									e.preventDefault();
									e.stopPropagation();
									form.handleSubmit();
								}}
							>
								<Dialog open={createOpen} onOpenChange={setCreateOpen}>
									<DialogTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="w-full justify-start gap-2"
										>
											<Plus className="h-4 w-4" />
											Create new SKU
										</Button>
									</DialogTrigger>
									<DialogContent className="sm:max-w-md">
										<DialogHeader>
											<DialogTitle>Create new SKU</DialogTitle>
											<DialogDescription>
												Add a new stock keeping unit. It will be available for
												selection in line items.
											</DialogDescription>
										</DialogHeader>


										<FieldGroup>
											<div className="grid gap-4 py-4">
												<form.Field
													name="skuCode"
													children={(field) => (
														<UiField className="grid gap-2">
															<FieldLabel htmlFor={field.name}>Code</FieldLabel>
															<Input
																id={field.name}
																name={field.name}
																form="create-sku-form"
																value={field.state.value}
																onBlur={field.handleBlur}
																onChange={(e) => field.handleChange(e.target.value)}
																placeholder="e.g. SKU-001"
															/>
															{field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
														</UiField>
													)}
												/>
												<form.Field
													name="skuDescription"
													children={(field) => (
														<UiField className="grid gap-2">
															<FieldLabel htmlFor="skuDescription">Description</FieldLabel>
															<Input
																id={field.name}
																name={field.name}
																form="create-sku-form"
																value={field.state.value}
																onBlur={field.handleBlur}
																onChange={(e) =>
																	field.handleChange(e.target.value)
																}
																placeholder="Product description"
															/>
															{field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
														</UiField>
													)}
												/>
												<div className="grid grid-cols-2 gap-2">
													<form.Field
														name="skuQuantity"
														children={(field) => (
															<UiField className="grid gap-2">
																<FieldLabel htmlFor={field.name}>Quantity</FieldLabel>
																<Input
																	id={field.name}
																	name={field.name}
																	form="create-sku-form"
																	value={field.state.value}
																	onBlur={field.handleBlur}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	placeholder="0"
																/>
																{field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
															</UiField>
														)}
													/>
													{/* <div className="grid gap-2">
														<Label htmlFor="skuPrice">Unit price</Label>
														<Input
															id="skuPrice"
															type="number"
															min="0"
															step="0.01"
															value={newSku.skuPrice || ""}
															onChange={(e) =>
																setNewSku((p) => ({
																	...p,
																	skuPrice: Number(e.target.value) || 0,
																}))
															}
															placeholder="0.00"
														/>
													</div>
													<div className="grid gap-2">
														<Label htmlFor="skuQuantity">Quantity</Label>
														<Input
															id="skuQuantity"
															type="number"
															min="0"
															value={newSku.skuQuantity || ""}
															onChange={(e) =>
																setNewSku((p) => ({
																	...p,
																	skuQuantity: Number(e.target.value) || 0,
																}))
															}
															placeholder="0"
														/>
													</div> */}
													<div className="grid gap-2">
														<form.Field
															name="skuUom"
															children={(field) => {
																return (
																	<UiField className="grid gap-2">
																		<FieldLabel htmlFor={field.name}>UOM</FieldLabel>
																		<Select
																			name={field.name}
																			value={field.state.value}
																			onValueChange={(value) => field.handleChange(value)}
																			disabled // Remove this if we want to allow selection of UOM
																			defaultValue={uoms[0]?.stockUnitId}
																		>
																			<SelectTrigger>
																				<SelectValue placeholder="Select UOM" />
																			</SelectTrigger>
																			<SelectContent>
																				{uoms.map((uom: StockUnit) => (
																					<SelectItem key={`${uom.stockUnitId}-${uom.unitCode}`} value={uom.stockUnitId}>{uom.unitCode}</SelectItem>
																				))}
																			</SelectContent>
																		</Select>
																		{field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
																	</UiField>
																)
															}}
														/>
													</div>
												</div>
											</div>
										</FieldGroup>


										<DialogFooter>
											<Button
												type="button"
												variant="outline"
												onClick={() => setCreateOpen(false)}
											>
												Cancel
											</Button>
											<Button
												type="submit"
												form="create-sku-form"
												disabled={form.state.isSubmitting}
											>
												{form.state.isSubmitting ? "Creating..." : "Create SKU"}
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</form>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
