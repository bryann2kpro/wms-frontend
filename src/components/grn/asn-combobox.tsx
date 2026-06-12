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
import { Badge } from "@/components/ui/badge";
import { gqlRequest } from "@/lib/api/gql";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
	LIST_PENDING_ADVANCE_NOTICES_QUERY,
	type AdvanceNotice,
	type ListPendingAdvanceNoticesQueryData,
	type ListPendingAdvanceNoticesQueryVariables,
} from "@/lib/graphql/grns";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

export function formatAsnLabel(asn: AdvanceNotice): string {
	return `${asn.tranid} — ${asn.entity} (${asn.duedate})`;
}

type AsnComboboxProps = {
	value: AdvanceNotice | null;
	onChange: (asn: AdvanceNotice) => void;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	/** When false, skips fetching until the popover opens. */
	enabled?: boolean;
};

export function AsnCombobox({
	value,
	onChange,
	placeholder = "Search or select an ASN…",
	disabled = false,
	id,
	className,
	enabled = true,
}: AsnComboboxProps) {
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
		queryKey: ["pending-advance-notices", searchTerm] as const,
		queryFn: async ({ pageParam }) =>
			gqlRequest<
				ListPendingAdvanceNoticesQueryData,
				ListPendingAdvanceNoticesQueryVariables
			>(LIST_PENDING_ADVANCE_NOTICES_QUERY, {
				search: searchTerm || null,
				pageSize: PAGE_SIZE,
				pageNumber: pageParam,
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const p = lastPage.listPendingAdvanceNotices.pagination;
			return p.hasNextPage ? p.currentPage + 1 : undefined;
		},
		enabled: enabled && open,
	});

	const asns = useMemo(
		() =>
			data?.pages.flatMap((page) => page.listPendingAdvanceNotices.query) ??
			[],
		[data],
	);

	const displayLabel = value ? formatAsnLabel(value) : null;
	const listLoading = isLoading || (isFetching && !isFetchingNextPage);

	const handleSelect = (asn: AdvanceNotice) => {
		onChange(asn);
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
	}, [handleFetchNext, open, asns.length]);

	const emptyMessage = listLoading
		? "Loading ASNs…"
		: searchTerm
			? "No ASNs match your search."
			: "No outstanding advance notices.";

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
						"h-9 w-full justify-between gap-1 rounded-lg border-muted-foreground/20 font-normal text-sm",
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
				className="z-[200] min-w-[320px] w-(--radix-popover-trigger-width) max-w-[min(92vw,720px)] p-0 shadow-md"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex flex-col rounded-md">
					<div className="border-b bg-muted/30 px-2 py-1.5">
						<Input
							placeholder="Search PO, entity, due date, or SKU…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-8 border-0 bg-background text-sm focus-visible:ring-2"
							autoFocus
						/>
						{!searchTerm ? (
							<p className="mt-1 px-0.5 text-[11px] text-muted-foreground">
								Type a PO number to include partially fulfilled ASNs.
							</p>
						) : null}
					</div>
					<div className="max-h-[280px] overflow-y-auto overscroll-contain">
						{listLoading && asns.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading ASNs…
							</div>
						) : asns.length === 0 ? (
							<div className="py-6 text-center text-xs text-muted-foreground">
								{emptyMessage}
							</div>
						) : (
							<ul className="px-1 py-1">
								{asns.map((asn) => {
									const label = formatAsnLabel(asn);
									const isSelected = value?.id === asn.id;
									return (
										<li key={asn.id}>
											<button
												type="button"
												title={
													asn.fulfillmentStatus === "PARTIAL"
														? `${label} — Partially fulfilled`
														: label
												}
												className={cn(
													"flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
													isSelected && "bg-accent",
												)}
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => handleSelect(asn)}
											>
												{isSelected ? (
													<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
												) : (
													<span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
												)}
												<span className="flex min-w-0 flex-1 items-center gap-1.5">
													<span className="truncate">{label}</span>
													{asn.fulfillmentStatus === "PARTIAL" ? (
														<Badge
															variant="outline"
															className="shrink-0 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"
														>
															Partially fulfilled
														</Badge>
													) : null}
												</span>
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
