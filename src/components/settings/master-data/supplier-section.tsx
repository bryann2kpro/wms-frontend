import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
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
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	SUPPLIERS_QUERY,
	CREATE_SUPPLIER_MUTATION,
	UPDATE_SUPPLIER_MUTATION,
	DELETE_SUPPLIER_MUTATION,
	type SuppliersQueryData,
	type SuppliersQueryVariables,
	type CreateSupplierMutationData,
	type UpdateSupplierMutationData,
	type DeleteSupplierMutationData,
} from "@/lib/graphql/suppliers";
import type { Supplier } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";

export function SupplierSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Supplier | null>(null);
	const [deleting, setDeleting] = useState<Supplier | null>(null);

	const { data, loading, refetch } = useQuery<
		SuppliersQueryData,
		SuppliersQueryVariables
	>(SUPPLIERS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim() ? { filter: { supplierName: search.trim() } } : {}),
		},
	});

	const [createSupplier, { loading: createLoading }] =
		useMutation<CreateSupplierMutationData>(CREATE_SUPPLIER_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateSupplier, { loading: updateLoading }] =
		useMutation<UpdateSupplierMutationData>(UPDATE_SUPPLIER_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [deleteSupplier, { loading: deleteLoading }] =
		useMutation<DeleteSupplierMutationData>(DELETE_SUPPLIER_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.suppliers?.query ?? [];
	const pagination = data?.suppliers?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Suppliers</CardTitle>
						<CardDescription>Manage supplier master data</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Supplier
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
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										No suppliers found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.supplierId}>
										<TableCell className="font-mono text-sm">
											{row.supplierCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.supplierName}
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
				{pagination && totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {currentPage} of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<SupplierFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createSupplier({
						variables: {
							input: {
								supplierName: values.supplierName,
								supplierCode: values.supplierCode,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Supplier"
				description="Create a new supplier."
			/>

			{editing && (
				<SupplierFormDialog
					key={editing.supplierId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						supplierName: editing.supplierName,
						supplierCode: editing.supplierCode,
					}}
					onSubmit={(values) =>
						updateSupplier({
							variables: {
								id: editing.supplierId,
								input: {
									supplierName: values.supplierName,
									supplierCode: values.supplierCode,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Supplier"
					description="Update supplier details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.supplierName}
					onConfirm={() =>
						deleteSupplier({ variables: { id: deleting.supplierId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function SupplierFormDialog({
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
	initial?: { supplierName: string; supplierCode: string };
	onSubmit: (v: { supplierName: string; supplierCode: string }) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [name, setName] = useState(initial?.supplierName ?? "");
	const [code, setCode] = useState(initial?.supplierCode ?? "");

	useEffect(() => {
		if (open) {
			setName(initial?.supplierName ?? "");
			setCode(initial?.supplierCode ?? "");
		}
	}, [open, initial?.supplierName, initial?.supplierCode]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName(initial?.supplierName ?? "");
			setCode(initial?.supplierCode ?? "");
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
						<Label htmlFor="supplier-code">Code</Label>
						<Input
							id="supplier-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. SUP001"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="supplier-name">Name</Label>
						<Input
							id="supplier-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Supplier name"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || !code.trim() || loading}
						onClick={() =>
							onSubmit({ supplierName: name.trim(), supplierCode: code.trim() })
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
