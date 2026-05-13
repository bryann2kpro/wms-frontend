"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	WAREHOUSES_QUERY,
	CREATE_WAREHOUSE_MUTATION,
	UPDATE_WAREHOUSE_MUTATION,
	DELETE_WAREHOUSE_MUTATION,
	type WarehousesQueryData,
	type WarehousesQueryVariables,
	type CreateWarehouseMutationData,
	type UpdateWarehouseMutationData,
	type DeleteWarehouseMutationData,
} from "@/lib/graphql/warehouses";
import type { Warehouse } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search } from "lucide-react";

const PAGE_SIZE = 10;

export function WarehouseSection() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Warehouse | null>(null);
	const [deleting, setDeleting] = useState<Warehouse | null>(null);

	const warehousesVars: WarehousesQueryVariables = {
		pageSize: PAGE_SIZE * 4,
		pageNumber: 1,
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.warehouses.all, warehousesVars],
		queryFn: () =>
			gqlRequest<WarehousesQueryData, WarehousesQueryVariables>(
				WAREHOUSES_QUERY,
				warehousesVars,
			),
	});

	const { mutate: createWarehouse, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateWarehouseMutationData>(CREATE_WAREHOUSE_MUTATION, {
				input,
			}),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateWarehouse, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateWarehouseMutationData>(
				UPDATE_WAREHOUSE_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: deleteWarehouse, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteWarehouseMutationData>(
				DELETE_WAREHOUSE_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});

	const list = data?.warehouses?.query ?? [];

	const filteredList = search.trim()
		? list.filter(
				(w) =>
					w.warehouseCode
						?.toLowerCase()
						.includes(search.toLowerCase().trim()) ||
					w.warehouseName.toLowerCase().includes(search.toLowerCase().trim()) ||
					w.warehouseAddress
						?.toLowerCase()
						.includes(search.toLowerCase().trim()),
			)
		: list;

	const paginatedList = filteredList.slice(
		(page - 1) * PAGE_SIZE,
		page * PAGE_SIZE,
	);
	const totalFiltered = filteredList.length;
	const totalFilteredPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Warehouses</CardTitle>
						<CardDescription>
							Manage warehouse master data (code and name).
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by code or name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button onClick={() => setIsCreateOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add Warehouse
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : filteredList.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										No warehouses found.
									</TableCell>
								</TableRow>
							) : (
								paginatedList.map((row) => (
									<TableRow key={row.warehouseId}>
										<TableCell className="text-sm">
											{row.warehouseCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.warehouseName}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{totalFilteredPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {page} of {totalFilteredPages} ({totalFiltered} shown)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalFilteredPages}
								onClick={() =>
									setPage((p) => Math.min(totalFilteredPages, p + 1))
								}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<WarehouseFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createWarehouse({
						warehouseName: values.warehouseName,
						warehouseCode: values.warehouseCode.trim() || undefined,
						warehouseAddress: values.warehouseAddress.trim() || undefined,
					})
				}
				loading={createLoading}
				title="Add Warehouse"
				description="Create a new warehouse."
			/>

			{editing && (
				<WarehouseFormDialog
					key={editing.warehouseId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						warehouseCode: editing.warehouseCode ?? "",
						warehouseName: editing.warehouseName,
						warehouseAddress: editing.warehouseAddress ?? "",
					}}
					onSubmit={(values) =>
						updateWarehouse({
							id: editing.warehouseId,
							input: {
								warehouseName: values.warehouseName.trim(),
								warehouseCode: values.warehouseCode.trim() || undefined,
								warehouseAddress: values.warehouseAddress.trim() || undefined,
							},
						})
					}
					loading={updateLoading}
					title="Edit Warehouse"
					description="Update warehouse details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.warehouseName}
					onConfirm={() => deleteWarehouse({ id: deleting.warehouseId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function WarehouseFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: {
		warehouseCode: string;
		warehouseName: string;
		warehouseAddress: string;
	};
	onSubmit: (v: {
		warehouseCode: string;
		warehouseName: string;
		warehouseAddress: string;
	}) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [code, setCode] = useState(initial?.warehouseCode ?? "");
	const [name, setName] = useState(initial?.warehouseName ?? "");
	const [address, setAddress] = useState(initial?.warehouseAddress ?? "");

	useEffect(() => {
		if (open) {
			setCode(initial?.warehouseCode ?? "");
			setName(initial?.warehouseName ?? "");
			setAddress(initial?.warehouseAddress ?? "");
		}
	}, [
		open,
		initial?.warehouseCode,
		initial?.warehouseName,
		initial?.warehouseAddress,
	]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setCode(initial?.warehouseCode ?? "");
			setName(initial?.warehouseName ?? "");
			setAddress(initial?.warehouseAddress ?? "");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="warehouse-name">Name</Label>
						<Input
							id="warehouse-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Warehouse name"
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="warehouse-code">Code (optional)</Label>
						<Input
							id="warehouse-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. WH001"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="warehouse-address">Address (optional)</Label>
						<Input
							id="warehouse-address"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							placeholder="Warehouse address"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || loading}
						onClick={() =>
							onSubmit({
								warehouseName: name.trim(),
								warehouseCode: code.trim(),
								warehouseAddress: address.trim(),
							})
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ConfirmDeleteDialog({
	open,
	onOpenChange,
	itemName,
	onConfirm,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	itemName: string;
	onConfirm: () => void;
	loading: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete warehouse</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete &quot;{itemName}&quot;? This action
						cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={loading}
						onClick={() => onConfirm()}
					>
						{loading ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
