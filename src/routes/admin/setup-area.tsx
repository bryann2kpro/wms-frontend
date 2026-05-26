import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	Edit,
	LayoutGrid,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	SetupAreaFormDialog,
	toCreateSetupAreaInput,
	toUpdateSetupAreaInput,
} from "@/components/setup-area/setup-area-form-dialog";
import { ConfirmDeleteDialog } from "@/components/settings/master-data/shared";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	CREATE_SETUP_AREA_MUTATION,
	DELETE_SETUP_AREA_MUTATION,
	SETUP_AREAS_QUERY,
	UPDATE_SETUP_AREA_MUTATION,
	type CreateSetupAreaMutationData,
	type DeleteSetupAreaMutationData,
	type SetupArea,
	type SetupAreasQueryData,
	type SetupAreasQueryVariables,
	type UpdateSetupAreaMutationData,
} from "@/lib/graphql/setup-areas";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { requirePermission } from "@/lib/rbac";
import { formatDate, toUserFriendlyMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/setup-area")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: SetupAreaPage,
	head: () => ({
		meta: [
			{
				title: "Area - SME Edaran WMS",
				description: "Manage area master data with code and description.",
			},
		],
	}),
});

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 10;

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string }> })
			.graphQLErrors?.[0];
		if (first?.message) {
			return toUserFriendlyMessage(
				first.message,
				"Something went wrong. Please try again.",
			);
		}
	}
	if (err instanceof Error) {
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	}
	return "Something went wrong. Please try again.";
}

function SetupAreaPage() {
	const { user } = useCurrentUser();
	const userId = user?.id ?? "";

	const [page, setPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<SetupArea | null>(null);
	const [deleting, setDeleting] = useState<SetupArea | null>(null);

	const queryVars: SetupAreasQueryVariables = {
		filter: debouncedSearch.trim()
			? { code: debouncedSearch.trim() }
			: undefined,
		pageSize: PAGE_SIZE,
		pageNumber: page,
	};

	const {
		data: queryData,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: qk.setupAreas.list(queryVars),
		queryFn: () =>
			gqlRequest<SetupAreasQueryData, SetupAreasQueryVariables>(
				SETUP_AREAS_QUERY,
				queryVars,
			),
	});

	const { mutate: createSetupArea, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateSetupAreaMutationData>(CREATE_SETUP_AREA_MUTATION, {
				input,
			}),
		onSuccess: () => {
			toast.success("Area created successfully");
			refetch();
			setIsCreateOpen(false);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const { mutate: updateSetupArea, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateSetupAreaMutationData>(
				UPDATE_SETUP_AREA_MUTATION,
				variables,
			),
		onSuccess: () => {
			toast.success("Area updated successfully");
			refetch();
			setEditing(null);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const { mutate: deleteSetupArea, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteSetupAreaMutationData>(
				DELETE_SETUP_AREA_MUTATION,
				variables,
			),
		onSuccess: () => {
			toast.success("Area deleted successfully");
			refetch();
			setDeleting(null);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const setupAreas = queryData?.setupAreas?.query ?? [];
	const pagination = queryData?.setupAreas?.pagination;
	const totalPages = pagination?.totalPages ?? 1;

	return (
		<main
			className="setup-area-page container mx-auto p-6 space-y-6"
			aria-labelledby="setup-area-page-title"
			aria-describedby="setup-area-page-description"
			aria-busy={loading}
		>
			<AdminPageHeader
				icon={LayoutGrid}
				title="Area"
				description="Manage area master data with code and description."
				titleId="setup-area-page-title"
				descriptionId="setup-area-page-description"
			/>

			<Card className="dashboard-card" style={{ animationDelay: "0ms" }}>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Area records
							</CardTitle>
							<CardDescription>
								Search by code and manage area configurations
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
							<div className="relative flex-1 sm:flex-initial sm:w-64 max-w-md">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search by code..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 w-full"
								/>
							</div>
							<Button
								type="button"
								className="gap-2 text-white shrink-0 disabled:opacity-50"
								style={{
									background: "var(--dashboard-accent)",
									borderColor: "var(--dashboard-accent)",
								}}
								disabled={!userId}
								onClick={() => setIsCreateOpen(true)}
							>
								<Plus className="h-4 w-4" aria-hidden />
								Add Area
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
									<TableHead>Description</TableHead>
									<TableHead>Updated At</TableHead>
									<TableHead className="w-[90px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{setupAreas.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="text-center py-8 text-muted-foreground"
										>
											{loading ? "Loading..." : "No area records found."}
										</TableCell>
									</TableRow>
								) : (
									setupAreas.map((area) => (
										<TableRow key={area.id}>
											<TableCell className="font-mono text-sm">
												{area.code}
											</TableCell>
											<TableCell className="max-w-[280px] truncate">
												{area.description}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground whitespace-nowrap">
												{formatDate(area.updatedAt)}
											</TableCell>
											<TableCell>
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => setEditing(area)}
														title="Edit area"
													>
														<Edit className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="text-destructive"
														onClick={() => setDeleting(area)}
														title="Delete area"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{totalPages > 1 && (
						<div className="flex items-center justify-between pt-4">
							<p className="text-sm text-muted-foreground">
								Page {page} of {totalPages}
								{pagination?.totalCount
									? ` (${pagination.totalCount} total)`
									: ""}
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page <= 1}
									onClick={() => setPage((p) => p - 1)}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => p + 1)}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<SetupAreaFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createSetupArea(toCreateSetupAreaInput(values, userId))
				}
				loading={createLoading}
				title="Add Area"
				description="Create a new area with code and description."
			/>

			{editing && (
				<SetupAreaFormDialog
					key={editing.id}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={editing}
					onSubmit={(values) =>
						updateSetupArea({
							id: editing.id,
							input: toUpdateSetupAreaInput(values, userId),
						})
					}
					loading={updateLoading}
					title="Edit Area"
					description="Update area code and description."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.code}
					onConfirm={() => deleteSetupArea({ id: deleting.id })}
					loading={deleteLoading}
				/>
			)}
		</main>
	);
}
