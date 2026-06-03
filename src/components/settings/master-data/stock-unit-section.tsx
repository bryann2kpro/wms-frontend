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

	const stockUnitsVars: StockUnitsQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		...(search.trim() ? { filter: { unitName: search.trim() } } : {}),
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.stockUnits.all, stockUnitsVars],
		queryFn: () =>
			gqlRequest<StockUnitsQueryData, StockUnitsQueryVariables>(
				STOCK_UNITS_QUERY,
				stockUnitsVars,
			),
	});

	const { mutate: createStockUnit, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateStockUnitMutationData>(CREATE_STOCK_UNIT_MUTATION, {
				input,
			}),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateStockUnit, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateStockUnitMutationData>(
				UPDATE_STOCK_UNIT_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: toggleActive } = useMutation({
		mutationFn: (variables: {
			id: string;
			isActive: boolean;
			updatedBy: string;
		}) =>
			gqlRequest<ToggleStockUnitActiveMutationData>(
				TOGGLE_STOCK_UNIT_ACTIVE_MUTATION,
				variables,
			),
		onSuccess: () => refetch(),
	});
	const { mutate: deleteStockUnit, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteStockUnitMutationData>(
				DELETE_STOCK_UNIT_MUTATION,
				variables,
			),
		onSuccess: () => {
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
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Stock Units (UOM)
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Units of measurement for inventory
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
							Add Stock Unit
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
									Active
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
										colSpan={4}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No stock units found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow
										key={row.stockUnitId}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6 font-mono text-sm">
											{row.unitCode}
										</TableCell>
										<TableCell className="px-6 font-medium">
											{row.unitName}
										</TableCell>
										<TableCell className="px-6">
											<Badge
												variant="outline"
												className={
													row.isActive
														? "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-950/30 dark:border-green-500/30"
														: "bg-muted text-muted-foreground"
												}
											>
												{row.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="px-6 text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													toggleActive({
														id: row.stockUnitId,
														isActive: !row.isActive,
														updatedBy: createdBy,
													})
												}
												title={row.isActive ? "Deactivate" : "Activate"}
												className="rounded-lg"
											>
												{row.isActive ? "Deactivate" : "Activate"}
											</Button>
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

			<StockUnitFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createStockUnit({
						unitName: values.unitName,
						unitCode: values.unitCode,
						isActive: values.isActive ?? true,
						createdBy,
						updatedBy: createdBy,
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
							id: editing.stockUnitId,
							input: {
								unitName: values.unitName,
								unitCode: values.unitCode,
								isActive: values.isActive,
								updatedBy: createdBy,
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
					onConfirm={() => deleteStockUnit({ id: deleting.stockUnitId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}
