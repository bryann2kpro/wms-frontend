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

	const suppliersVars: SuppliersQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		...(search.trim() ? { filter: { supplierName: search.trim() } } : {}),
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.suppliers.all, suppliersVars],
		queryFn: () =>
			gqlRequest<SuppliersQueryData, SuppliersQueryVariables>(
				SUPPLIERS_QUERY,
				suppliersVars,
			),
	});

	const { mutate: createSupplier, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateSupplierMutationData>(CREATE_SUPPLIER_MUTATION, {
				input,
			}),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateSupplier, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateSupplierMutationData>(
				UPDATE_SUPPLIER_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: deleteSupplier, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteSupplierMutationData>(
				DELETE_SUPPLIER_MUTATION,
				variables,
			),
		onSuccess: () => {
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
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Suppliers
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Manage supplier master data
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48 rounded-lg border-muted-foreground/20"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Supplier
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative px-0 pb-6">
				<GlobalLoadingShadow />
				<div className="mx-6 overflow-x-auto rounded-xl border">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Code
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Name
								</TableHead>
								<TableHead
									className="px-6 text-right"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No suppliers found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow
										key={row.supplierId}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6 font-mono text-sm">
											{row.supplierCode}
										</TableCell>
										<TableCell className="px-6 font-medium">
											{row.supplierName}
										</TableCell>
										<TableCell className="px-6 text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
												className="rounded-lg"
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive rounded-lg"
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
					<div className="mx-6 mt-4 flex items-center justify-between">
						<p
							className="text-sm text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Page{" "}
							<span className="font-semibold tabular-nums text-foreground">
								{currentPage}
							</span>{" "}
							of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								className="rounded-lg"
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								className="rounded-lg"
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
						supplierName: values.supplierName,
						supplierCode: values.supplierCode,
						createdBy,
						updatedBy: createdBy,
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
							id: editing.supplierId,
							input: {
								supplierName: values.supplierName,
								supplierCode: values.supplierCode,
								updatedBy: createdBy,
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
					onConfirm={() => deleteSupplier({ id: deleting.supplierId })}
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
			<DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						{title}
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						{description}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label
							htmlFor="supplier-code"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Code
						</Label>
						<Input
							id="supplier-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. SUP001"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="supplier-name"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Name
						</Label>
						<Input
							id="supplier-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Supplier name"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
				</div>
				<DialogFooter className="border-t bg-muted/20">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || !code.trim() || loading}
						onClick={() =>
							onSubmit({ supplierName: name.trim(), supplierCode: code.trim() })
						}
						className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
