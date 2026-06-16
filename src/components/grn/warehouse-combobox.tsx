"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	CREATE_WAREHOUSE_MUTATION,
	WAREHOUSE_QUERY,
	WAREHOUSES_QUERY,
	type CreateWarehouseMutationData,
	type WarehouseQueryData,
	type WarehousesQueryData,
	type WarehousesQueryVariables,
} from "@/lib/graphql/warehouses";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { toast } from "sonner";
import { toUserFriendlyMessage } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string }> })
			.graphQLErrors?.[0];
		if (first?.message)
			return toUserFriendlyMessage(first.message, "Something went wrong.");
	}
	if (err && typeof err === "object" && "response" in err) {
		const first = (
			err as { response?: { errors?: Array<{ message?: string }> } }
		).response?.errors?.[0];
		if (first?.message)
			return toUserFriendlyMessage(first.message, "Something went wrong.");
	}
	if (err instanceof Error)
		return toUserFriendlyMessage(err.message, "Something went wrong.");
	return "Something went wrong.";
}

export type WarehouseOption = {
	warehouseId: string;
	warehouseName: string;
	warehouseCode?: string | null;
};

export type WarehouseComboboxProps = {
	value: string;
	onChange: (warehouseId: string) => void;
	/** @deprecated Warehouses are loaded via infinite query; use query invalidation instead. */
	onWarehouseCreated?: () => void | Promise<void>;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	/** When false, skips fetching until the popover opens. */
	enabled?: boolean;
};

function CreateWarehouseDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (v: {
		warehouseName: string;
		warehouseCode: string;
		warehouseAddress: string;
	}) => void;
	loading: boolean;
}) {
	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [address, setAddress] = useState("");
	useEffect(() => {
		if (open) {
			setName("");
			setCode("");
			setAddress("");
		}
	}, [open]);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create warehouse</DialogTitle>
					<DialogDescription>Add a new warehouse for GRN.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="wh-name">Name *</Label>
						<Input
							id="wh-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Warehouse name"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="wh-code">Code</Label>
						<Input
							id="wh-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="Optional code"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="wh-address">Address</Label>
						<Input
							id="wh-address"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							placeholder="Optional address"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || loading}
						onClick={() =>
							onSubmit({
								warehouseName: name,
								warehouseCode: code,
								warehouseAddress: address,
							})
						}
					>
						{loading ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function WarehouseCombobox({
	value,
	onChange,
	onWarehouseCreated,
	placeholder = "Search or select warehouse...",
	disabled = false,
	id,
	className,
	enabled = true,
}: WarehouseComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const queryClient = useQueryClient();

	const searchTerm = debouncedSearch.trim();

	const {
		data,
		isLoading,
		isFetching,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
	} = useInfiniteQuery({
		queryKey: [...qk.warehouses.all, "combobox", searchTerm] as const,
		queryFn: async ({ pageParam }) =>
			gqlRequest<WarehousesQueryData, WarehousesQueryVariables>(
				WAREHOUSES_QUERY,
				{
					pageSize: PAGE_SIZE,
					pageNumber: pageParam,
					...(searchTerm
						? { filter: { warehouseName: searchTerm } }
						: {}),
				},
			),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const p = lastPage.warehouses.pagination;
			return p.hasNextPage ? p.currentPage + 1 : undefined;
		},
		enabled: enabled && open && !disabled,
	});

	const warehouses = useMemo(
		() => data?.pages.flatMap((page) => page.warehouses.query) ?? [],
		[data],
	);

	const { data: selectedWarehouseData } = useQuery({
		queryKey: [...qk.warehouses.all, "by-id", value] as const,
		queryFn: () => gqlRequest<WarehouseQueryData>(WAREHOUSE_QUERY, { id: value }),
		enabled: Boolean(value) && !warehouses.some((w) => w.warehouseId === value),
	});

	const selectedFromList = warehouses.find((w) => w.warehouseId === value);
	const selectedWarehouse =
		selectedFromList ?? selectedWarehouseData?.warehouse ?? null;

	const displayLabel = selectedWarehouse
		? `${selectedWarehouse.warehouseName}${selectedWarehouse.warehouseCode ? ` (${selectedWarehouse.warehouseCode})` : ""}`
		: null;

	const listLoading = isLoading || (isFetching && !isFetchingNextPage);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return warehouses;
		return warehouses.filter(
			(w) =>
				w.warehouseName.toLowerCase().includes(q) ||
				(w.warehouseCode && w.warehouseCode.toLowerCase().includes(q)),
		);
	}, [warehouses, search]);

	const { mutate: createWarehouse, isPending: createLoading } = useMutation({
		mutationFn: (input: {
			warehouseName: string;
			warehouseCode?: string;
			warehouseAddress?: string;
		}) =>
			gqlRequest<CreateWarehouseMutationData>(CREATE_WAREHOUSE_MUTATION, {
				input,
			}),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: async (data) => {
			const newId = data?.createWarehouse?.warehouseId;
			if (!newId) return;
			await queryClient.invalidateQueries({ queryKey: qk.warehouses.all });
			await onWarehouseCreated?.();
			onChange(newId);
			setCreateOpen(false);
			setOpen(false);
			toast.success("Warehouse created.");
		},
	});

	const handleSelect = (warehouseId: string) => {
		onChange(warehouseId);
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
	}, [handleFetchNext, open, filtered.length]);

	const handleCreateSubmit = (values: {
		warehouseName: string;
		warehouseCode: string;
		warehouseAddress: string;
	}) => {
		createWarehouse({
			warehouseName: values.warehouseName.trim(),
			warehouseCode: values.warehouseCode.trim() || undefined,
			warehouseAddress: values.warehouseAddress.trim() || undefined,
		});
	};

	const emptyMessage = listLoading
		? "Loading warehouses…"
		: searchTerm
			? "No warehouses match your search."
			: "No warehouses in the system.";

	return (
		<div className={cn("flex gap-1", className)}>
			<Popover
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setSearch("");
				}}
			>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className="h-8 w-full justify-between gap-1 font-normal text-sm"
						id={id}
					>
						<span className="truncate text-left">
							{displayLabel ?? placeholder}
						</span>
						<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="min-w-[280px] w-[var(--radix-popover-trigger-width)] max-w-[360px] p-0 shadow-md"
					align="start"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<div className="flex flex-col rounded-md">
						<div className="border-b bg-muted/30 px-2 py-1.5">
							<Input
								placeholder="Search warehouse..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="h-7 border-0 bg-background text-sm focus-visible:ring-2"
								autoFocus
							/>
						</div>
						<div className="max-h-[240px] overflow-y-auto overscroll-contain">
							{listLoading && filtered.length === 0 ? (
								<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Loading warehouses…
								</div>
							) : filtered.length === 0 ? (
								<div className="py-6 text-center text-xs text-muted-foreground">
									{emptyMessage}
								</div>
							) : (
								<ul className="py-1 px-1">
									{filtered.map((w) => (
										<li key={w.warehouseId}>
											<button
												type="button"
												title={`${w.warehouseName}${w.warehouseCode ? ` (${w.warehouseCode})` : ""}`}
												className={cn(
													"flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent",
													value === w.warehouseId && "bg-accent",
												)}
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => handleSelect(w.warehouseId)}
											>
												{value === w.warehouseId ? (
													<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
												) : (
													<span className="mt-0.5 w-3.5 shrink-0" />
												)}
												<div className="min-w-0 flex-1 overflow-hidden">
													<div className="text-sm font-semibold text-foreground">
														{w.warehouseName}
													</div>
													{w.warehouseCode && (
														<div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
															{w.warehouseCode}
														</div>
													)}
												</div>
											</button>
										</li>
									))}
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
						<div className="border-t bg-muted/20 px-2 py-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 w-full justify-start gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
								onClick={() => setCreateOpen(true)}
							>
								<Plus className="h-3.5 w-3.5 shrink-0" />
								Create new warehouse
							</Button>
							<CreateWarehouseDialog
								open={createOpen}
								onOpenChange={setCreateOpen}
								onSubmit={handleCreateSubmit}
								loading={createLoading}
							/>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
