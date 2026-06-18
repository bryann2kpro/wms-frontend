import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
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
	RACKS_QUERY,
	type RacksQueryData,
	type RacksQueryVariables,
} from "@/lib/graphql/racks";
import type { Rack } from "@/lib/graphql/types";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

/** Display: `rackRow-rackLevel-rackColumn` (matches stock quant `rackLabel` / DB convention). */
export function formatRackLocationLabel(
	rack: Pick<Rack, "rackRow" | "rackColumn" | "rackLevel">,
): string {
	return `${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`;
}

function compareRacks(a: Rack, b: Rack): number {
	const byRow = a.rackRow.localeCompare(b.rackRow, undefined, {
		numeric: true,
	});
	if (byRow !== 0) return byRow;
	const byLevel = a.rackLevel.localeCompare(b.rackLevel, undefined, {
		numeric: true,
	});
	if (byLevel !== 0) return byLevel;
	return a.rackColumn.localeCompare(b.rackColumn, undefined, { numeric: true });
}

export function sortRacksByLocation(racks: Rack[]): Rack[] {
	return [...racks].sort(compareRacks);
}

export type RackLocationComboboxProps = {
	/** Client-side list; ignored when `remoteSearch` is true. */
	racks?: Rack[];
	value: string;
	onChange: (rackId: string, rackLabel?: string) => void;
	disabled?: boolean;
	placeholder?: string;
	id?: string;
	className?: string;
	/** Show a “Clear” action when a rack is selected. */
	allowClear?: boolean;
	/** Query racks from the API as the user types (avoids loading the full rack list). */
	remoteSearch?: boolean;
	/** When set with `remoteSearch`, limits API results to this warehouse. */
	warehouseId?: string;
	/** When set with `remoteSearch`, limits API results to racks of this bin type. */
	binType?: string;
	/** Label shown when `value` is set but the rack is not in the loaded list. */
	fallbackLabel?: string | null;
	/** Show a loading state in the trigger (e.g. while suggesting a rack). */
	loading?: boolean;
	loadingPlaceholder?: string;
	/** When false, skips fetching until the popover opens. */
	enabled?: boolean;
};

export function RackLocationCombobox({
	racks: racksProp = [],
	value,
	onChange,
	disabled = false,
	placeholder = "Search or select rack…",
	id,
	className,
	allowClear = false,
	remoteSearch = false,
	warehouseId,
	binType,
	fallbackLabel = null,
	loading = false,
	loadingPlaceholder = "Loading…",
	enabled = true,
}: RackLocationComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
	const sentinelRef = useRef<HTMLDivElement | null>(null);

	const searchTerm = debouncedSearch.trim();

	const remoteQueryFilter = useMemo((): RacksQueryVariables["filter"] => {
		const filter: NonNullable<RacksQueryVariables["filter"]> = {};
		if (warehouseId) filter.warehouseId = warehouseId;
		if (binType) filter.binType = binType;
		if (searchTerm) filter.search = searchTerm;
		return Object.keys(filter).length > 0 ? filter : undefined;
	}, [searchTerm, warehouseId, binType]);

	const {
		data: remoteData,
		isLoading: remoteIsLoading,
		isFetching: remoteIsFetching,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
	} = useInfiniteQuery({
		queryKey: [
			...qk.racks.all,
			"location-combobox",
			remoteQueryFilter ?? {},
		] as const,
		queryFn: async ({ pageParam }) =>
			gqlRequest<RacksQueryData, RacksQueryVariables>(RACKS_QUERY, {
				pageSize: PAGE_SIZE,
				pageNumber: pageParam,
				...(remoteQueryFilter ? { filter: remoteQueryFilter } : {}),
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const p = lastPage.racks.pagination;
			return p.hasNextPage ? p.currentPage + 1 : undefined;
		},
		enabled: remoteSearch && enabled && open && !disabled,
	});

	const remoteRacks = useMemo(
		() => remoteData?.pages.flatMap((page) => page.racks.query) ?? [],
		[remoteData],
	);
	const racks = remoteSearch ? remoteRacks : racksProp;

	const filtered = useMemo(() => {
		if (remoteSearch) return sortRacksByLocation(racks);
		const q = search.trim().toLowerCase();
		const base = q
			? racks.filter((r) => {
					const label = formatRackLocationLabel(r).toLowerCase();
					return (
						label.includes(q) ||
						r.rackId.toLowerCase().includes(q) ||
						r.rackRow.toLowerCase().includes(q) ||
						r.rackColumn.toLowerCase().includes(q) ||
						r.rackLevel.toLowerCase().includes(q)
					);
				})
			: racks;
		return sortRacksByLocation(base);
	}, [racks, search, remoteSearch]);

	const selected = racks.find((r) => r.rackId === value);
	const displayLabel =
		selected != null
			? formatRackLocationLabel(selected)
			: value && fallbackLabel
				? fallbackLabel
				: null;

	const handleSelect = (rackId: string, rack?: Rack) => {
		onChange(rackId, rack ? formatRackLocationLabel(rack) : undefined);
		setOpen(false);
		setSearch("");
	};

	const showLoadingTrigger = loading && !displayLabel;
	const triggerDisabled = disabled || showLoadingTrigger;
	const listLoading =
		remoteIsLoading || (remoteIsFetching && !isFetchingNextPage);

	const handleFetchNext = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !open || !remoteSearch) return;
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
	}, [handleFetchNext, open, remoteSearch, filtered.length]);

	const emptyMessage = listLoading
		? "Loading racks…"
		: search.trim()
			? "No racks match your search."
			: remoteSearch && warehouseId
				? "No racks in this warehouse."
				: remoteSearch
					? "Type to search racks…"
					: "No racks available.";

	return (
		<Popover
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) setSearch("");
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-busy={showLoadingTrigger}
					disabled={triggerDisabled}
					className={cn(
						"h-9 w-full justify-between gap-1 font-normal text-xs",
						showLoadingTrigger ? "font-sans" : "font-mono",
						className,
					)}
					id={id}
				>
					{showLoadingTrigger ? (
						<span className="flex min-w-0 items-center gap-2 truncate text-left text-muted-foreground">
							<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
							<span className="truncate">{loadingPlaceholder}</span>
						</span>
					) : (
						<span className="truncate text-left">
							{displayLabel ?? placeholder}
						</span>
					)}
					<ChevronsUpDown
						className={cn(
							"h-3.5 w-3.5 shrink-0 opacity-50",
							showLoadingTrigger && "opacity-30",
						)}
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="min-w-[280px] w-(--radix-popover-trigger-width) max-w-[min(100vw-2rem,420px)] p-0 shadow-md"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex flex-col rounded-md">
					<div className="border-b bg-muted/30 px-2 py-1.5">
						<Input
							placeholder="Type to filter racks…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-8 border-0 bg-background text-sm focus-visible:ring-2"
							autoFocus
						/>
					</div>
					<div className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain">
						{allowClear && value ? (
							<div className="border-b px-1 py-1">
								<button
									type="button"
									className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									onClick={() => handleSelect("")}
								>
									Clear selection
								</button>
							</div>
						) : null}
						{listLoading && filtered.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading racks…
							</div>
						) : filtered.length === 0 ? (
							<div className="py-6 text-center text-xs text-muted-foreground">
								{emptyMessage}
							</div>
						) : (
							<ul className="py-1 px-1">
								{filtered.map((r) => {
									const label = formatRackLocationLabel(r);
									const isSelected = value === r.rackId;
									return (
										<li key={r.rackId}>
											<button
												type="button"
												title={label}
												className={cn(
													"flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent",
													isSelected && "bg-accent",
												)}
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => handleSelect(r.rackId, r)}
											>
												{isSelected ? (
													<Check className="h-3.5 w-3.5 shrink-0 text-primary" />
												) : (
													<span className="w-3.5 shrink-0" />
												)}
												<span className="font-mono text-xs">{label}</span>
											</button>
										</li>
									);
								})}
								{remoteSearch ? (
									<>
										<li aria-hidden className="h-px">
											<div ref={sentinelRef} className="h-px" />
										</li>
										{isFetchingNextPage ? (
											<li className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
												Loading more…
											</li>
										) : null}
									</>
								) : null}
							</ul>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
