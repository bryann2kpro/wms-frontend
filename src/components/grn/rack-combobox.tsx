"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Rack = {
	rackId: string;
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
};

type RackComboboxProps = {
	racks: Rack[];
	selectedRackIds: string[];
	onToggle: (rackId: string) => void;
	onCreateRack?: () => void;
};

export function RackCombobox({
	racks,
	selectedRackIds,
	onToggle,
	onCreateRack,
}: RackComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		if (!search.trim()) return racks;
		const q = search.toLowerCase();
		return racks.filter((r) => {
			const label = `${r.rackRow}-${r.rackLevel}-${r.rackColumn}`;
			return label.toLowerCase().includes(q);
		});
	}, [racks, search]);

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
					size="sm"
					className="h-6 gap-1 rounded-lg px-2 text-xs border-dashed"
				>
					<Plus className="h-3 w-3" />
					Rack
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[220px] p-0 shadow-md rounded-xl"
				align="start"
			>
				<div className="flex flex-col rounded-md">
					<div className="border-b bg-muted/30 px-2 py-1.5">
						<Input
							placeholder="Search rack..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-7 border-0 bg-background text-sm focus-visible:ring-2"
							autoFocus
						/>
					</div>
					<div className="h-[200px] overflow-y-auto overscroll-contain">
						{filtered.length === 0 ? (
							<div className="py-6 text-center text-xs text-muted-foreground">
								{search.trim()
									? "No racks match your search."
									: "No racks available."}
							</div>
						) : (
							<ul className="py-1 px-1">
								{filtered.map((r) => {
									const label = `${r.rackRow}-${r.rackLevel}-${r.rackColumn}`;
									const isSelected = selectedRackIds.includes(r.rackId);
									return (
										<li key={r.rackId}>
											<button
												type="button"
												title={label}
												className={cn(
													"flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent",
													isSelected && "bg-accent",
												)}
												onClick={() => onToggle(r.rackId)}
											>
												{isSelected ? (
													<Check className="h-3.5 w-3.5 shrink-0 text-primary" />
												) : (
													<span className="w-3.5 shrink-0" />
												)}
												<span className="font-mono text-sm">{label}</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
					{onCreateRack && (
						<div className="border-t bg-muted/20 px-2 py-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 w-full justify-start gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
								onClick={onCreateRack}
							>
								<Plus className="h-3.5 w-3.5 shrink-0" />
								Create new rack
							</Button>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
