import { useState } from "react";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	STOCK_UNITS_QUERY,
	CREATE_STOCK_UNIT_MUTATION,
	UPDATE_STOCK_UNIT_MUTATION,
	TOGGLE_STOCK_UNIT_ACTIVE_MUTATION,
	DELETE_STOCK_UNIT_MUTATION,
	type StockUnitsQueryData,
	type StockUnitsQueryVariables,
	type CreateStockUnitMutationData,
	type UpdateStockUnitMutationData,
	type ToggleStockUnitActiveMutationData,
	type DeleteStockUnitMutationData,
} from "@/lib/graphql/stock-units";
import type { StockUnit } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";
import { StockUnitFormDialog } from "./stock-unit-form-dialog";

export function StockUnitSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<StockUnit | null>(null);
	const [deleting, setDeleting] = useState<StockUnit | null>(null);

	const { data, loading, refetch } = useQuery<
		StockUnitsQueryData,
		StockUnitsQueryVariables
	>(STOCK_UNITS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim() ? { filter: { unitName: search.trim() } } : {}),
		},
	});

	const [createStockUnit, { loading: createLoading }] =
		useMutation<CreateStockUnitMutationData>(CREATE_STOCK_UNIT_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateStockUnit, { loading: updateLoading }] =
		useMutation<UpdateStockUnitMutationData>(UPDATE_STOCK_UNIT_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [toggleActive] = useMutation<ToggleStockUnitActiveMutationData>(
		TOGGLE_STOCK_UNIT_ACTIVE_MUTATION,
		{ onCompleted: () => refetch() },
	);
	const [deleteStockUnit, { loading: deleteLoading }] =
		useMutation<DeleteStockUnitMutationData>(DELETE_STOCK_UNIT_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.stockUnits?.query ?? [];
	const pagination = data?.stockUnits?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Stock Units (UOM)</CardTitle>
						<CardDescription>
							Units of measurement for inventory
						</CardDescription>
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
							Add Stock Unit
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
								<TableHead>Active</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 text-center text-muted-foreground"
									>
										No stock units found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.stockUnitId}>
										<TableCell className="font-mono text-sm">
											{row.unitCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.unitName}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={
													row.isActive
														? "bg-green-500/10 text-green-600 border-green-500/20"
														: "bg-muted text-muted-foreground"
												}
											>
												{row.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													toggleActive({
														variables: {
															id: row.stockUnitId,
															isActive: !row.isActive,
															updatedBy: createdBy,
														},
													})
												}
												title={row.isActive ? "Deactivate" : "Activate"}
											>
												{row.isActive ? "Deactivate" : "Activate"}
											</Button>
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

			<StockUnitFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createStockUnit({
						variables: {
							input: {
								unitName: values.unitName,
								unitCode: values.unitCode,
								isActive: values.isActive ?? true,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Stock Unit"
				description="Create a new unit of measurement."
			/>

			{editing && (
				<StockUnitFormDialog
					key={editing.stockUnitId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						unitName: editing.unitName,
						unitCode: editing.unitCode,
						isActive: editing.isActive,
					}}
					onSubmit={(values) =>
						updateStockUnit({
							variables: {
								id: editing.stockUnitId,
								input: {
									unitName: values.unitName,
									unitCode: values.unitCode,
									isActive: values.isActive,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Stock Unit"
					description="Update unit details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.unitName}
					onConfirm={() =>
						deleteStockUnit({ variables: { id: deleting.stockUnitId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}
