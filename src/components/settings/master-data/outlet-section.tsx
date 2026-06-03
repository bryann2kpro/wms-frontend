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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	REGIONS_QUERY,
	type RegionsQueryData,
	type RegionsQueryVariables,
} from "@/lib/graphql/regions";
import {
	OUTLETS_QUERY,
	CREATE_OUTLET_MUTATION,
	UPDATE_OUTLET_MUTATION,
	DELETE_OUTLET_MUTATION,
	type OutletsQueryData,
	type OutletsQueryVariables,
	type CreateOutletMutationData,
	type UpdateOutletMutationData,
	type DeleteOutletMutationData,
} from "@/lib/graphql/outlets";
import type { Outlet } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search, Upload } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";
import { OutletFormDialog } from "./outlet-form-dialog";
import { OutletImportDialog } from "./outlet-import-dialog";

export function OutletSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [regionIdFilter, setRegionIdFilter] = useState<string>("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [editing, setEditing] = useState<Outlet | null>(null);
	const [deleting, setDeleting] = useState<Outlet | null>(null);

	const { data: regionsData } = useQuery({
		queryKey: [...qk.regions.all, { pageSize: 200, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<RegionsQueryData, RegionsQueryVariables>(REGIONS_QUERY, {
				pageSize: 200,
				pageNumber: 1,
			}),
	});
	const regions = regionsData?.regions?.query ?? [];

	const filter: OutletsQueryVariables["filter"] = {
		...(search.trim() ? { outletName: search.trim() } : {}),
		...(regionIdFilter ? { regionId: regionIdFilter } : {}),
	};

	const outletsVars: OutletsQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		filter: Object.keys(filter).length > 0 ? filter : undefined,
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.outlets.all, outletsVars],
		queryFn: () =>
			gqlRequest<OutletsQueryData, OutletsQueryVariables>(
				OUTLETS_QUERY,
				outletsVars,
			),
	});

	const { mutate: createOutlet, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateOutletMutationData>(CREATE_OUTLET_MUTATION, { input }),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateOutlet, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateOutletMutationData>(UPDATE_OUTLET_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: deleteOutlet, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteOutletMutationData>(DELETE_OUTLET_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});

	const outletsList = data?.outlets?.query ?? [];
	const outletsPagination = data?.outlets?.pagination;
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
							Outlets
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Store/outlet locations; each outlet can be assigned to a region
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
						<Select
							value={regionIdFilter || "all"}
							onValueChange={(v) => {
								setRegionIdFilter(v === "all" ? "" : v);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-40 rounded-lg border-muted-foreground/20">
								<SelectValue placeholder="All regions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All regions</SelectItem>
								{regions.map((r) => (
									<SelectItem key={r.regionId} value={r.regionId}>
										{r.regionName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							variant="outline"
							onClick={() => setIsImportOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to import" : undefined}
							className="rounded-lg"
						>
							<Upload className="mr-2 h-4 w-4" />
							Import
						</Button>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Outlet
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
									Region
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
							) : outletsList.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No outlets found.
									</TableCell>
								</TableRow>
							) : (
								outletsList.map((row) => (
									<TableRow
										key={row.outletId}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6 font-mono text-sm">
											{row.outletCode}
										</TableCell>
										<TableCell className="px-6 font-medium">
											{row.outletName}
										</TableCell>
										<TableCell className="px-6 text-muted-foreground">
											{row.regionName
												? `${row.regionName} (${row.regionCode ?? ""})`
												: "Unassigned"}
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
				{outletsPagination && outletsPagination.totalPages > 1 && (
					<div className="mx-6 mt-4 flex items-center justify-between">
						<p
							className="text-sm text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Page{" "}
							<span className="font-semibold tabular-nums text-foreground">
								{outletsPagination.currentPage}
							</span>{" "}
							of {outletsPagination.totalPages} ({outletsPagination.totalCount}{" "}
							total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!outletsPagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								className="rounded-lg"
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!outletsPagination.hasNextPage}
								onClick={() =>
									setPage((p) => Math.min(outletsPagination.totalPages, p + 1))
								}
								className="rounded-lg"
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<OutletImportDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				regions={regions}
				createdBy={createdBy}
				onComplete={() => refetch()}
			/>

			<OutletFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				regions={regions}
				onSubmit={(values) =>
					createOutlet({
						outletName: values.outletName,
						outletCode: values.outletCode,
						address: values.address || undefined,
						regionId: values.regionId || null,
						createdBy,
						updatedBy: createdBy,
					})
				}
				loading={createLoading}
				title="Add Outlet"
				description="Create a new outlet. Region is optional."
			/>

			{editing && (
				<OutletFormDialog
					key={editing.outletId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					regions={regions}
					initial={{
						outletName: editing.outletName,
						outletCode: editing.outletCode,
						address: editing.address ?? undefined,
						regionId: editing.regionId ?? undefined,
					}}
					onSubmit={(values) =>
						updateOutlet({
							id: editing.outletId,
							input: {
								outletName: values.outletName,
								outletCode: values.outletCode,
								address: values.address || undefined,
								regionId: values.regionId || null,
								updatedBy: createdBy,
							},
						})
					}
					loading={updateLoading}
					title="Edit Outlet"
					description="Update outlet and assign to a region."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.outletName}
					onConfirm={() => deleteOutlet({ id: deleting.outletId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}
