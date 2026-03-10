"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@apollo/client/react";
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
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	CREATE_WAREHOUSE_MUTATION,
	type CreateWarehouseMutationData,
} from "@/lib/graphql/warehouses";
import { toast } from "sonner";
import { toUserFriendlyMessage } from "@/lib/utils";

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string }> })
			.graphQLErrors?.[0];
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
	warehouses: WarehouseOption[];
	/** Call to refetch warehouse list; awaited before setting new value so the new warehouse appears in the list */
	onWarehouseCreated?: () => void | Promise<void>;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
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
	warehouses,
	onWarehouseCreated,
	placeholder = "Search or select warehouse...",
	disabled = false,
	id,
	className,
}: WarehouseComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [createOpen, setCreateOpen] = useState(false);

	const [createWarehouse, { loading: createLoading }] =
		useMutation<CreateWarehouseMutationData>(CREATE_WAREHOUSE_MUTATION, {
			onError: (err) => toast.error(getErrorMessage(err)),
			onCompleted: async (data) => {
				const newId = data?.createWarehouse?.warehouseId;
				if (!newId) return;
				await onWarehouseCreated?.();
				onChange(newId);
				setCreateOpen(false);
				setOpen(false);
				toast.success("Warehouse created.");
			},
		});

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return warehouses;
		return warehouses.filter(
			(w) =>
				w.warehouseName.toLowerCase().includes(q) ||
				(w.warehouseCode && w.warehouseCode.toLowerCase().includes(q)),
		);
	}, [warehouses, search]);

	const selectedWarehouse = useMemo(
		() => warehouses.find((w) => w.warehouseId === value),
		[warehouses, value],
	);
	const displayLabel = selectedWarehouse
		? `${selectedWarehouse.warehouseName}${selectedWarehouse.warehouseCode ? ` (${selectedWarehouse.warehouseCode})` : ""}`
		: null;

	const handleSelect = (warehouseId: string) => {
		onChange(warehouseId);
		setOpen(false);
	};

	const handleCreateSubmit = (values: {
		warehouseName: string;
		warehouseCode: string;
		warehouseAddress: string;
	}) => {
		createWarehouse({
			variables: {
				input: {
					warehouseName: values.warehouseName.trim(),
					warehouseCode: values.warehouseCode.trim() || undefined,
					warehouseAddress: values.warehouseAddress.trim() || undefined,
				},
			},
		});
	};

	return (
		<div className={cn("flex gap-1", className)}>
			<Popover open={open} onOpenChange={setOpen}>
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
						<div className="h-[240px] overflow-y-auto overscroll-contain">
							{filtered.length === 0 ? (
								<div className="py-6 text-center text-xs text-muted-foreground">
									{search.trim()
										? "No warehouses match your search."
										: "No warehouses in the system."}
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
