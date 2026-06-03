"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { Rack } from "@/lib/graphql/types";
import { cn } from "@/lib/utils";

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
	racks: Rack[];
	value: string;
	onChange: (rackId: string) => void;
	disabled?: boolean;
	placeholder?: string;
	id?: string;
	className?: string;
	/** Show a “Clear” action when a rack is selected. */
	allowClear?: boolean;
};

export function RackLocationCombobox({
	racks,
	value,
	onChange,
	disabled = false,
	placeholder = "Search or select rack…",
	id,
	className,
	allowClear = false,
}: RackLocationComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
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
	}, [racks, search]);

	const selected = racks.find((r) => r.rackId === value);
	const displayLabel = selected ? formatRackLocationLabel(selected) : null;

	const handleSelect = (rackId: string) => {
		onChange(rackId);
		setOpen(false);
	};

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
					disabled={disabled}
					className={cn(
						"h-9 w-full justify-between gap-1 font-normal font-mono text-xs",
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
				className="min-w-[280px] w-(--radix-popover-trigger-width) max-w-[min(100vw-2rem,420px)] p-0 shadow-md"
				align="start"
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
						{filtered.length === 0 ? (
							<div className="py-6 text-center text-xs text-muted-foreground">
								{search.trim()
									? "No racks match your search."
									: "No racks available."}
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
												onClick={() => handleSelect(r.rackId)}
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
							</ul>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
