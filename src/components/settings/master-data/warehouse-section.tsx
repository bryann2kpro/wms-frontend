import { useState } from "react";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { useCurrentUser } from "@/lib/auth/use-current-user";
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
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";
import { WarehouseFormDialog } from "./warehouse-form-dialog";

export function WarehouseSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Warehouse | null>(null);
	const [deleting, setDeleting] = useState<Warehouse | null>(null);

	const warehousesVars: WarehousesQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		...(search.trim() ? { filter: { warehouseName: search.trim() } } : {}),
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
	const pagination = data?.warehouses?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const canEdit = !!user?.id;

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Warehouses
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Manage warehouse locations and addresses
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
							disabled={!canEdit}
							title={!canEdit ? "Sign in to create" : undefined}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Warehouse
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
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Address
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Created By
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
										colSpan={5}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No warehouses found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow
										key={row.warehouseId}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6 font-mono text-sm">
											{row.warehouseCode || "-"}
										</TableCell>
										<TableCell className="px-6 font-medium">
											{row.warehouseName}
										</TableCell>
										<TableCell className="max-w-xs truncate px-6">
											{row.warehouseAddress || "-"}
										</TableCell>
										<TableCell className="px-6">
											{row.createdByUser
												? row.createdByUser.displayName
												: row.createdBy}
										</TableCell>
										<TableCell className="px-6 text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
												aria-label={`Edit warehouse ${row.warehouseName}`}
												className="rounded-lg"
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive rounded-lg"
												onClick={() => setDeleting(row)}
												aria-label={`Delete warehouse ${row.warehouseName}`}
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

			<WarehouseFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				title="Add Warehouse"
				description="Create a new warehouse."
				loading={createLoading}
				onSubmit={(values) =>
					createWarehouse({
						warehouseName: values.warehouseName,
						warehouseCode: values.warehouseCode || undefined,
						warehouseAddress: values.warehouseAddress || undefined,
					})
				}
			/>

			{editing && (
				<WarehouseFormDialog
					key={editing.warehouseId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					title="Edit Warehouse"
					description="Update warehouse details."
					loading={updateLoading}
					initial={{
						warehouseName: editing.warehouseName,
						warehouseCode: editing.warehouseCode ?? "",
						warehouseAddress: editing.warehouseAddress ?? "",
					}}
					onSubmit={(values) =>
						updateWarehouse({
							id: editing.warehouseId,
							input: {
								warehouseName: values.warehouseName,
								warehouseCode: values.warehouseCode || undefined,
								warehouseAddress: values.warehouseAddress || undefined,
							},
						})
					}
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
