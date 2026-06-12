import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
	SKU_QUERY,
	SKUS_AND_UOM_QUERY,
	buildSkuSearchFilter,
	type SkuQueryData,
	type SkusAndUomQueryData,
	type SkusAndUomQueryVariables,
} from "@/lib/graphql/skus";
import type { Skus } from "@/lib/graphql/types";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

type ReservationSkuComboboxProps = {
	value: string;
	onChange: (skuId: string) => void;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	enabled?: boolean;
};

function formatSkuLabel(sku: Pick<Skus, "skuCode" | "skuDescription">): string {
	return sku.skuDescription
		? `${sku.skuCode} — ${sku.skuDescription}`
		: sku.skuCode;
}

export function ReservationSkuCombobox({
	value,
	onChange,
	placeholder = "Search or select SKU…",
	disabled = false,
	id,
	className,
	enabled = true,
}: ReservationSkuComboboxProps) {
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
		queryKey: [...qk.skus.all, "reservation-combobox", searchTerm] as const,
		queryFn: async ({ pageParam }) =>
			gqlRequest<SkusAndUomQueryData, SkusAndUomQueryVariables>(
				SKUS_AND_UOM_QUERY,
				{
					pageSize: PAGE_SIZE,
					pageNumber: pageParam,
					filter: buildSkuSearchFilter(searchTerm),
				},
			),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const p = lastPage.skus.pagination;
			return p.hasNextPage ? p.currentPage + 1 : undefined;
		},
		enabled: enabled && open && !disabled,
	});

	const skus = useMemo(
		() =>
			(data?.pages.flatMap((page) => page.skus.query) ?? []).filter(
				(sku) => sku.isActive,
			),
		[data],
	);

	const { data: selectedSkuData } = useQuery({
		queryKey: [...qk.skus.all, "by-id", value] as const,
		queryFn: () => gqlRequest<SkuQueryData>(SKU_QUERY, { id: value }),
		enabled: Boolean(value) && !skus.some((s) => s.skuId === value),
	});

	const selectedFromList = skus.find((s) => s.skuId === value);
	const selectedSku = selectedFromList ?? selectedSkuData?.sku ?? null;

	const displayLabel = selectedSku ? formatSkuLabel(selectedSku) : null;
	const listLoading = isLoading || (isFetching && !isFetchingNextPage);

	const handleSelect = (sku: Skus) => {
		onChange(sku.skuId);
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
	}, [handleFetchNext, open, skus.length]);

	const emptyMessage = listLoading
		? "Loading SKUs…"
		: searchTerm
			? "No SKUs match your search."
			: "No active SKUs found.";

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
					disabled={disabled}
					className={cn(
						"h-9 w-full justify-between gap-1 rounded-lg border-muted-foreground/20 bg-background font-normal text-sm transition-colors hover:border-amber-500/30 hover:bg-amber-500/3",
						disabled && "opacity-70",
						className,
					)}
					id={id}
				>
					<span className="truncate text-left">
						{displayLabel ?? placeholder}
					</span>
					<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="z-200 min-w-[320px] w-(--radix-popover-trigger-width) max-w-[min(92vw,560px)] p-0 shadow-md"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex flex-col rounded-md">
					<div className="border-b bg-muted/30 px-2 py-1.5">
						<Input
							placeholder="Search code or description…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-8 border-0 bg-background text-sm focus-visible:ring-2 focus-visible:ring-amber-500/30"
							autoFocus
						/>
					</div>
					<div className="max-h-[280px] overflow-y-auto overscroll-contain">
						{listLoading && skus.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading SKUs…
							</div>
						) : skus.length === 0 ? (
							<div className="py-6 text-center text-xs text-muted-foreground">
								{emptyMessage}
							</div>
						) : (
							<ul className="px-1 py-1">
								{skus.map((sku) => {
									const isSelected = value === sku.skuId;
									return (
										<li key={sku.skuId}>
											<button
												type="button"
												title={formatSkuLabel(sku)}
												className={cn(
													"flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent",
													isSelected && "bg-accent",
												)}
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => handleSelect(sku)}
											>
												{isSelected ? (
													<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
												) : (
													<span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
												)}
												<div className="min-w-0 flex-1 overflow-hidden">
													<div className="font-mono text-xs font-semibold text-foreground">
														{sku.skuCode}
													</div>
													{sku.skuDescription ? (
														<div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
															{sku.skuDescription}
														</div>
													) : null}
												</div>
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
