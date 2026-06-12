import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { fetchCustomerPriorities } from "@/data/customer-priority";
import { qk } from "@/lib/api/query-keys";
import type { CustomerPriority } from "@/lib/graphql/customer-priority";
import { cn } from "@/lib/utils";

type ReservationCustomerComboboxProps = {
	value: string;
	onChange: (customerCode: string) => void;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	/** When false, skips fetching until the popover opens. */
	enabled?: boolean;
	/** Optional preloaded list; when omitted, loads from customer priorities query. */
	customers?: CustomerPriority[];
};

function formatCustomerLabel(customer: CustomerPriority): string {
	return customer.customerName
		? `${customer.customerCode} — ${customer.customerName}`
		: customer.customerCode;
}

function matchesSearch(customer: CustomerPriority, term: string): boolean {
	const haystack = [customer.customerCode, customer.customerName ?? ""]
		.join(" ")
		.toLowerCase();
	return haystack.includes(term);
}

export function ReservationCustomerCombobox({
	value,
	onChange,
	placeholder = "Search or select customer…",
	disabled = false,
	id,
	className,
	enabled = true,
	customers: customersProp,
}: ReservationCustomerComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const { data: fetchedCustomers, isLoading } = useQuery({
		queryKey: qk.customerPriorities.all,
		queryFn: fetchCustomerPriorities,
		enabled: enabled && open && !customersProp,
	});

	const customers = customersProp ?? fetchedCustomers ?? [];
	const searchTerm = search.trim().toLowerCase();

	const filtered = useMemo(() => {
		const active = customers.filter((c) => c.isActive);
		if (!searchTerm) return active;
		return active.filter((c) => matchesSearch(c, searchTerm));
	}, [customers, searchTerm]);

	const selected = customers.find((c) => c.customerCode === value);
	const displayLabel = selected ? formatCustomerLabel(selected) : null;

	const handleSelect = (customer: CustomerPriority) => {
		onChange(customer.customerCode);
		setOpen(false);
		setSearch("");
	};

	const emptyMessage = isLoading
		? "Loading customers…"
		: searchTerm
			? "No customers match your search."
			: "No active customers in priority list.";

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
				className="z-200 min-w-[300px] w-(--radix-popover-trigger-width) max-w-[min(92vw,480px)] p-0 shadow-md"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex flex-col rounded-md">
					<div className="border-b bg-muted/30 px-2 py-1.5">
						<Input
							placeholder="Search code or name…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-8 border-0 bg-background text-sm focus-visible:ring-2 focus-visible:ring-amber-500/30"
							autoFocus
						/>
					</div>
					<div className="max-h-[260px] overflow-y-auto overscroll-contain">
						{isLoading && filtered.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading customers…
							</div>
						) : filtered.length === 0 ? (
							<div className="py-6 text-center text-xs text-muted-foreground">
								{emptyMessage}
							</div>
						) : (
							<ul className="px-1 py-1">
								{filtered.map((customer) => {
									const label = formatCustomerLabel(customer);
									const isSelected = value === customer.customerCode;
									return (
										<li key={customer.id}>
											<button
												type="button"
												title={label}
												className={cn(
													"flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
													isSelected && "bg-accent",
												)}
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => handleSelect(customer)}
											>
												{isSelected ? (
													<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
												) : (
													<span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
												)}
												<span className="flex min-w-0 flex-1 items-center gap-2">
													<span className="min-w-0 flex-1 truncate">
														<span className="font-mono text-xs font-semibold text-foreground">
															{customer.customerCode}
														</span>
														{customer.customerName ? (
															<span className="ml-1.5 text-muted-foreground">
																{customer.customerName}
															</span>
														) : null}
													</span>
													<Badge
														variant="outline"
														className="shrink-0 font-mono text-[10px] tabular-nums"
													>
														#{customer.rank}
													</Badge>
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
