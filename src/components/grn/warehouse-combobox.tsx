"use client";

import { useState, useEffect } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import {
	CREATE_WAREHOUSE_MUTATION,
	type CreateWarehouseMutationData,
} from "@/lib/graphql/warehouses";
import { toast } from "sonner";
import { toUserFriendlyMessage } from "@/lib/utils";

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string }> }).graphQLErrors?.[0];
		if (first?.message) return toUserFriendlyMessage(first.message, "Something went wrong.");
	}
	if (err instanceof Error) return toUserFriendlyMessage(err.message, "Something went wrong.");
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
	/** Call to refetch warehouse list; awaited before setting new value so the new warehouse appears in the select */
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
	onSubmit: (v: { warehouseName: string; warehouseCode: string; warehouseAddress: string }) => void;
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
	placeholder = "Select warehouse",
	disabled = false,
	id,
	className,
}: WarehouseComboboxProps) {
	const [createOpen, setCreateOpen] = useState(false);

	const [createWarehouse, { loading: createLoading }] = useMutation<CreateWarehouseMutationData>(
		CREATE_WAREHOUSE_MUTATION,
		{
			onError: (err) => toast.error(getErrorMessage(err)),
			onCompleted: async (data) => {
				const newId = data?.createWarehouse?.warehouseId;
				if (!newId) return;
				// Refetch first so the new warehouse appears in the list, then set selection
				await onWarehouseCreated?.();
				onChange(newId);
				setCreateOpen(false);
				toast.success("Warehouse created.");
			},
		}
	);

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
		<div className={className}>
			<div className="flex gap-2">
				<Select
					value={value || undefined}
					onValueChange={(v) => onChange(v)}
					disabled={disabled}
				>
					<SelectTrigger id={id} className="flex-1">
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>
						{warehouses.map((w) => (
							<SelectItem key={w.warehouseId} value={w.warehouseId}>
								{w.warehouseName}
								{w.warehouseCode ? ` (${w.warehouseCode})` : ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setCreateOpen(true)}
					className="shrink-0"
					disabled={disabled}
				>
					<Plus className="h-4 w-4 mr-1" />
					New
				</Button>
			</div>
			<CreateWarehouseDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onSubmit={handleCreateSubmit}
				loading={createLoading}
			/>
		</div>
	);
}
