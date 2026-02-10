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


const createSkuSchema = z.object({
	skuName: z.string().min(1),
	skuDescription: z.string().min(1),
	skuQuantity: z.number().min(0),
	skuUom: z.uuid().min(1),
});

export type SkuLineValue = {
	sku: string;
	description: string;
	uom: string;
	unitPrice: number;
	skuId: string;
};

type SkuComboboxProps = {
	value: SkuLineValue | null;
	onChange: (value: SkuLineValue) => void;
	placeholder?: string;
	className?: string;
	createdBy?: string;
	stockUnitCodes?: string[];
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
}: SkuComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data: { skus, stockUnits: { query: uoms } }, isLoading: loading } = useQuery({
		queryKey: ['skus'],
		queryFn: () => {

			const headers = new Headers();
			headers.set('Authorization', `Bearer ${localStorage.getItem('access_token')}`);

			return request(env.VITE_GRAPHQL_ENDPOINT, SKUS_AND_UOM_QUERY, {}, headers)
		},
	});

	const createSku = useMutation({
		mutationFn: (input: CreateSkuInput) => {

			const headers = new Headers();
			headers.set('Authorization', `Bearer ${localStorage.getItem('access_token')}`);

			return request(
				env.VITE_GRAPHQL_ENDPOINT, 
				CREATE_SKU_MUTATION, 
				{ input },
				headers
			)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['skus'] });
			toast.success('SKU created successfully');
		},
	});

	const form = useForm({
		defaultValues: {
			skuCode: "",
			skuDescription: "",
			skuQuantity: 0,
			skuUom: uoms[0].stockUnitId,
		},
		validators: {
			onBlur: createSkuSchema.safeParse,
			onSubmit: createSkuSchema.safeParseAsync,
		},
		onSubmit: async ({ value }) => {
			createSku.mutate(value);
		},
	})

	const filtered = useMemo(() => {
		if (!search.trim()) return skus;
		const q = search.toLowerCase();
		return skus.filter(
			(s) =>
				s.skuName.toLowerCase().includes(q) ||
				s.skuDescription?.toLowerCase().includes(q),
		);
	}, [skus, search]);

	function handleSelect(sku: Sku) {
		onChange({
			sku: sku.skuName,
			description: sku.skuDescription,
			uom: sku.skuUom,
			unitPrice: sku.skuPrice,
			skuId: sku.skuId,
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
									{filtered.map((sku) => (
										<li key={sku.skuId}>
											<button
												type="button"
												className={cn(
													"flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
													value?.skuId === sku.skuId && "bg-accent",
												)}
												onClick={() => handleSelect(sku)}
											>
												{value?.skuId === sku.skuId ? (
													<Check className="h-4 w-4 shrink-0" />
												) : (
													<span className="w-4" />
												)}
												<span className="truncate font-medium">
													{sku.skuName}
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

									<form 
										id="create-sku-form"
										onSubmit={(e) => {
											e.preventDefault()
											form.handleSubmit()
										}}
									>
										<FieldGroup>
											<div className="grid gap-4 py-4">
												<form.Field
													name="skuName"
													children={(field) => (
														<UiField className="grid gap-2">
															<FieldLabel htmlFor={field.name}>Name</FieldLabel>
															<Input
																id={field.name}
																name={field.name}
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
													{/* <form.Field
														name="skuPrice"
														children={(field) => (
															<UiField className="grid gap-2">
																<FieldLabel htmlFor={field.name}>Unit price</FieldLabel>
																<Input
																	id={field.name}
																	name={field.name}
																	value={field.state.value}
																	onBlur={field.handleBlur}
																	onChange={(e) => field.handleChange(e.target.value)}
																	placeholder="0.00"
																/>
																{field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
															</UiField>
														)}
													/> */}
													<form.Field
														name="skuQuantity"
														children={(field) => (
															<UiField className="grid gap-2">
																<FieldLabel htmlFor={field.name}>Quantity</FieldLabel>
																<Input
																	id={field.name}
																	name={field.name}
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

																console.log("field", field.state.value, uoms[0]?.stockUnitId);

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
									</form>
									
									<DialogFooter>
										<Button
											type="button"
											variant="outline"
											onClick={() => setCreateOpen(false)}
										>
											Cancel
										</Button>
										<Button
											type="button"
											onClick={form.handleSubmit}
											disabled={form.state.isSubmitting}
										>
											{form.state.isSubmitting ? "Creating..." : "Create SKU"}
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
