import { useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";

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
import { cn } from "@/lib/utils";
import {
	SKUS_AND_UOM_QUERY,
	CREATE_SKU_MUTATION,
	buildSkuSearchFilter,
	type CreateSkuInput,
	type SkusAndUomQueryVariables,
	type SkusAndUomQueryData,
} from "@/lib/graphql/skus";
import { useForm } from "@tanstack/react-form";
import z from "zod";
import {
	Field as UiField,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "../ui/field";
import { toast } from "sonner";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "../ui/select";
import type { Skus } from "@/lib/graphql/types";

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
	/** SKU codes already used in other rows. These are shown with an "Added" badge but can still be selected (same SKU is valid with different expiry date / rack). */
	usedSkuCodes?: string[];
	/** SKU codes to fully exclude from the dropdown (cannot be selected at all). */
	excludedSkuCodes?: string[];
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
	excludedSkuCodes,
}: SkuComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const searchTerm = debouncedSearch.trim();
	const [createOpen, setCreateOpen] = useState(false);
	const queryClient = useQueryClient();

	const {
		data: skusData,
		isLoading: loading,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	} = useInfiniteQuery<SkusAndUomQueryData>({
		queryKey: [...qk.skus.all, "infinite", searchTerm],
		queryFn: async ({ pageParam }) =>
			gqlRequest<SkusAndUomQueryData, SkusAndUomQueryVariables>(SKUS_AND_UOM_QUERY, {
				pageSize: 20,
				pageNumber: Number(pageParam),
				filter: buildSkuSearchFilter(searchTerm),
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const p = lastPage.skus.pagination;
			return p.hasNextPage ? p.currentPage + 1 : undefined;
		},
		enabled: open,
	});

	const skus = skusData?.pages.flatMap((page) => page.skus.query) ?? [];
	const uoms = skusData?.pages[0]?.stockUnits?.query ?? [];

	function getErrorMessage(err: unknown): string {
		if (err && typeof err === "object" && "response" in err) {
			const res = (
				err as { response?: { errors?: Array<{ message?: string }> } }
			).response;
			const msg = res?.errors?.[0]?.message;
			if (msg) return msg;
		}
		if (
			err &&
			typeof err === "object" &&
			"message" in err &&
			typeof (err as Error).message === "string"
		)
			return (err as Error).message;
		if (err instanceof Error) return err.message;
		return String(err ?? "Failed to create SKU");
	}

	const createSku = useMutation({
		mutationFn: (input: CreateSkuInput & { isActive: boolean }) =>
			gqlRequest(CREATE_SKU_MUTATION, { input }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: qk.skus.all });
			toast.success("SKU created successfully");
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
	});

	const filtered = skus;

	function handleSelect(sku: Skus) {
		const uomUnit = uoms?.find((u: StockUnit) => u.stockUnitId === sku.skuUom);
		const result: SkuLineValue = {
			sku: sku.skuCode ?? sku.skuDescription ?? sku.skuId,
			skuCode: sku.skuCode ?? "",
			description: sku.skuDescription ?? "",
			uom: uomUnit?.unitCode ?? sku.skuUom ?? "",
			skuId: sku.skuId,
			isActive: sku.isActive,
		};
		onChange(result);
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
						className="h-8 w-full justify-between gap-1 font-normal text-sm"
					>
						<span className="truncate text-left">
							{displayLabel ?? placeholder}
						</span>
						<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="min-w-[320px] w-[var(--radix-popover-trigger-width)] max-w-[min(92vw,560px)] p-0 shadow-md"
					align="start"
				>
					<div className="flex flex-col rounded-md">
						<div className="border-b bg-muted/30 px-2 py-1.5">
							<Input
								placeholder="Search SKU..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="h-7 border-0 bg-background text-sm focus-visible:ring-2"
								autoFocus
							/>
						</div>
						<div
							className="h-[240px] overflow-y-auto overscroll-contain"
							onScroll={(e) => {
								const el = e.currentTarget;
								if (
									hasNextPage &&
									!isFetchingNextPage &&
									el.scrollHeight - el.scrollTop - el.clientHeight < 48
								) {
									fetchNextPage();
								}
							}}
						>
							{loading ? (
								<div className="py-6 text-center text-xs text-muted-foreground">
									Loading SKUs...
								</div>
							) : filtered.length === 0 ? (
								<div className="py-6 text-center text-xs text-muted-foreground">
									{search.trim()
										? "No SKUs match your search."
										: "No SKUs in the system."}
								</div>
							) : (
								<ul className="py-1 px-1">
									{filtered.map((sku: Skus) => {
										const alreadyAdded =
											usedSkuCodes?.includes(sku.skuCode) &&
											value?.skuCode !== sku.skuCode;
										return (
											<li key={sku.skuId}>
												<button
													type="button"
													title={[sku.skuCode, sku.skuDescription]
														.filter(Boolean)
														.join(" – ")}
													className={cn(
														"flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent",
														value?.skuId === sku.skuId && "bg-accent",
													)}
													onClick={() => handleSelect(sku)}
												>
													{value?.skuId === sku.skuId ? (
														<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
													) : (
														<span className="mt-0.5 w-3.5 shrink-0" />
													)}
													<div className="min-w-0 flex-1 overflow-hidden">
														<div className="flex items-center gap-1.5">
															<span className="text-sm font-semibold text-foreground">
																{sku.skuCode}
															</span>
															{alreadyAdded && (
																<span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
																	Added
																</span>
															)}
														</div>
														{sku.skuDescription && (
															<div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
																{sku.skuDescription}
															</div>
														)}
													</div>
												</button>
											</li>
										);
									})}
									{isFetchingNextPage && (
										<li className="py-2 text-center text-[11px] text-muted-foreground">
											Loading more…
										</li>
									)}
								</ul>
							)}
						</div>
						<div className="border-t bg-muted/20 px-2 py-1">
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
											className="h-7 w-full justify-start gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
										>
											<Plus className="h-3.5 w-3.5 shrink-0" />
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
																onChange={(e) =>
																	field.handleChange(e.target.value)
																}
																placeholder="e.g. SKU-001"
															/>
															{field.state.meta.isTouched && (
																<FieldError errors={field.state.meta.errors} />
															)}
														</UiField>
													)}
												/>
												<form.Field
													name="skuDescription"
													children={(field) => (
														<UiField className="grid gap-2">
															<FieldLabel htmlFor="skuDescription">
																Description
															</FieldLabel>
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
															{field.state.meta.isTouched && (
																<FieldError errors={field.state.meta.errors} />
															)}
														</UiField>
													)}
												/>
												<div className="grid grid-cols-2 gap-2">
													<form.Field
														name="skuQuantity"
														children={(field) => (
															<UiField className="grid gap-2">
																<FieldLabel htmlFor={field.name}>
																	Quantity
																</FieldLabel>
																<Input
																	id={field.name}
																	name={field.name}
																	form="create-sku-form"
																	value={field.state.value}
																	onBlur={field.handleBlur}
																	onChange={(e) =>
																		field.handleChange(Number(e.target.value))
																	}
																	placeholder="0"
																/>
																{field.state.meta.isTouched && (
																	<FieldError
																		errors={field.state.meta.errors}
																	/>
																)}
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
																		<FieldLabel htmlFor={field.name}>
																			UOM
																		</FieldLabel>
																		<Select
																			name={field.name}
																			value={field.state.value}
																			onValueChange={(value) =>
																				field.handleChange(value)
																			}
																			disabled // Remove this if we want to allow selection of UOM
																			defaultValue={uoms[0]?.stockUnitId}
																		>
																			<SelectTrigger>
																				<SelectValue placeholder="Select UOM" />
																			</SelectTrigger>
																			<SelectContent>
																				{uoms.map((uom: StockUnit) => (
																					<SelectItem
																						key={`${uom.stockUnitId}-${uom.unitCode}`}
																						value={uom.stockUnitId}
																					>
																						{uom.unitCode}
																					</SelectItem>
																				))}
																			</SelectContent>
																		</Select>
																		{field.state.meta.isTouched && (
																			<FieldError
																				errors={field.state.meta.errors}
																			/>
																		)}
																	</UiField>
																);
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
