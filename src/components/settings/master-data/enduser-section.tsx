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
import {
	END_USERS_QUERY,
	CREATE_END_USER_MUTATION,
	UPDATE_END_USER_MUTATION,
	DELETE_END_USER_MUTATION,
	type EndUsersQueryData,
	type EndUsersQueryVariables,
	type CreateEndUserMutationData,
	type UpdateEndUserMutationData,
	type DeleteEndUserMutationData,
} from "@/lib/graphql/end-users";
import type { EndUser } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";
import { EndUserFormDialog } from "./enduser-form-dialog";

export function EndUserSection() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<EndUser | null>(null);
	const [deleting, setDeleting] = useState<EndUser | null>(null);

	const vars: EndUsersQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		...(search.trim() ? { filter: { userName: search.trim() } } : {}),
	};

	const { data, isLoading: loading, refetch } = useQuery({
		queryKey: [...qk.endUsers.all, vars],
		queryFn: () =>
			gqlRequest<EndUsersQueryData, EndUsersQueryVariables>(END_USERS_QUERY, vars),
	});

	const { mutate: createEndUser, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateEndUserMutationData>(CREATE_END_USER_MUTATION, { input }),
		onSuccess: () => { refetch(); setIsCreateOpen(false); },
	});

	const { mutate: updateEndUser, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateEndUserMutationData>(UPDATE_END_USER_MUTATION, variables),
		onSuccess: () => { refetch(); setEditing(null); },
	});

	const { mutate: deleteEndUser, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteEndUserMutationData>(DELETE_END_USER_MUTATION, variables),
		onSuccess: () => { refetch(); setDeleting(null); },
	});

	const list = data?.endUsers?.query ?? [];
	const pagination = data?.endUsers?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							End Users
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Manage end user master data
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => { setSearch(e.target.value); setPage(1); }}
								className="pl-9 w-48 rounded-lg border-muted-foreground/20"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add End User
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
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									User Name
								</TableHead>
								<TableHead className="px-6 text-right" style={{ fontFamily: "var(--dashboard-body)" }}>
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={2} className="h-24 px-6 text-center text-muted-foreground">
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell colSpan={2} className="h-24 px-6 text-center text-muted-foreground">
										No end users found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.endUserId} className="transition-colors hover:bg-muted/50">
										<TableCell className="px-6 font-medium">{row.userName}</TableCell>
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
						<p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--dashboard-body)" }}>
							Page{" "}
							<span className="font-semibold tabular-nums text-foreground">{currentPage}</span>{" "}
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

			<EndUserFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) => createEndUser({ userName: values.userName })}
				loading={createLoading}
				title="Add End User"
				description="Create a new end user."
			/>

			{editing && (
				<EndUserFormDialog
					key={editing.endUserId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{ userName: editing.userName }}
					onSubmit={(values) =>
						updateEndUser({ id: editing.endUserId, input: { userName: values.userName } })
					}
					loading={updateLoading}
					title="Edit End User"
					description="Update end user details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.userName}
					onConfirm={() => deleteEndUser({ id: deleting.endUserId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}
