import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	Edit,
	Plus,
	Search,
	Trash2,
	Truck,
	Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ConfirmDeleteDialog } from "@/components/settings/master-data/shared";
import {
	TransportFormDialog,
	toCreateTransportInput,
	toUpdateTransportInput,
} from "@/components/transport/transport-form-dialog";
import { TransportImportDialog } from "@/components/transport/transport-import-dialog";
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
	CREATE_TRANSPORT_MUTATION,
	DELETE_TRANSPORT_MUTATION,
	TRANSPORTS_QUERY,
	UPDATE_TRANSPORT_MUTATION,
	type CreateTransportMutationData,
	type DeleteTransportMutationData,
	type Transport,
	type TransportsQueryData,
	type TransportsQueryVariables,
	type UpdateTransportMutationData,
} from "@/lib/graphql/transports";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { requirePermission } from "@/lib/rbac";
import { formatDate, toUserFriendlyMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/transport")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: TransportPage,
	head: () => ({
		meta: [
			{
				title: "Transport - SME Edaran WMS",
				description:
					"Manage transport configurations with dimensional and weight constraints.",
			},
		],
	}),
});

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 10;

function formatDimensions(
	length?: string | null,
	width?: string | null,
	height?: string | null,
): string {
	const parts = [length, width, height].filter((v) => v?.trim());
	if (parts.length === 0) return "-";
	return `${parts.join(" × ")} mm`;
}

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

function TransportPage() {
	const { user } = useCurrentUser();
	const userId = user?.id ?? "";

	const [page, setPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [editing, setEditing] = useState<Transport | null>(null);
	const [deleting, setDeleting] = useState<Transport | null>(null);

	const queryVars: TransportsQueryVariables = {
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
		queryKey: qk.transports.list(queryVars),
		queryFn: () =>
			gqlRequest<TransportsQueryData, TransportsQueryVariables>(
				TRANSPORTS_QUERY,
				queryVars,
			),
	});

	const { mutate: createTransport, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateTransportMutationData>(CREATE_TRANSPORT_MUTATION, {
				input,
			}),
		onSuccess: () => {
			toast.success("Transport created successfully");
			refetch();
			setIsCreateOpen(false);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const { mutate: updateTransport, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateTransportMutationData>(UPDATE_TRANSPORT_MUTATION, variables),
		onSuccess: () => {
			toast.success("Transport updated successfully");
			refetch();
			setEditing(null);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const { mutate: deleteTransport, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteTransportMutationData>(DELETE_TRANSPORT_MUTATION, variables),
		onSuccess: () => {
			toast.success("Transport deleted successfully");
			refetch();
			setDeleting(null);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const transports = queryData?.transports?.query ?? [];
	const pagination = queryData?.transports?.pagination;
	const totalPages = pagination?.totalPages ?? 1;

	return (
		<main
			className="transport-page container mx-auto p-6 space-y-6"
			aria-labelledby="transport-page-title"
			aria-describedby="transport-page-description"
			aria-busy={loading}
		>
			<AdminPageHeader
				icon={Truck}
				title="Transport"
				description="Manage transport units with storage bins and dimensional constraints."
				titleId="transport-page-title"
				descriptionId="transport-page-description"
			/>

			<Card className="dashboard-card" style={{ animationDelay: "0ms" }}>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
								Transport records
							</CardTitle>
							<CardDescription>
								Search by code and manage transport configurations
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
								variant="outline"
								className="gap-2 shrink-0 disabled:opacity-50"
								disabled={!userId}
								onClick={() => setIsImportOpen(true)}
							>
								<Upload className="h-4 w-4" aria-hidden />
								Import
							</Button>
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
								Add Transport
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
									<TableHead>Class</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Location</TableHead>
									<TableHead>Storage Bin</TableHead>
									<TableHead>Min Length(mm)</TableHead>
									<TableHead>Min Width(mm)</TableHead>
									<TableHead>Min Height(mm)</TableHead>
									<TableHead>Min Weight(kg)</TableHead>
									<TableHead>Max Length(mm)</TableHead>
									<TableHead>Max Width(mm)</TableHead>
									<TableHead>Max Height(mm)</TableHead>
									<TableHead>Max Weight(kg)</TableHead>
									<TableHead>No. of Pallets</TableHead>
									<TableHead>Updated At</TableHead>
									<TableHead className="w-[90px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{transports.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={16}
											className="text-center py-8 text-muted-foreground"
										>
											{loading ? "Loading..." : "No transport records found."}
										</TableCell>
									</TableRow>
								) : (
									transports.map((transport) => (
										<TableRow key={transport.id}>
											<TableCell className="font-mono text-sm">
												{transport.code}
											</TableCell>
											<TableCell className="font-mono text-sm text-muted-foreground">
												{transport.capacityClass ?? "-"}
											</TableCell>
											<TableCell className="max-w-[180px] truncate">
												{transport.description || "-"}
											</TableCell>
											<TableCell>{transport.location || "-"}</TableCell>
											<TableCell className="font-mono text-sm">
												{transport.storageBinId || "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.minLengthMm ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.minWidthMm ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.minHeightMm ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.minWeightKg ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.maxLengthMm ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.maxWidthMm ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.maxHeightMm ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.maxWeightKg ?? "-"}
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap">
												{transport.numberOfPallets != null ? transport.numberOfPallets : "-"}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground whitespace-nowrap">
												{formatDate(transport.updatedAt)}
											</TableCell>
											<TableCell>
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => setEditing(transport)}
														title="Edit transport"
													>
														<Edit className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="text-destructive"
														onClick={() => setDeleting(transport)}
														title="Delete transport"
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

			<TransportImportDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				createdBy={userId}
				onImported={refetch}
			/>

			<TransportFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createTransport(toCreateTransportInput(values, userId))
				}
				loading={createLoading}
				title="Add Transport"
				description="Create a new transport configuration with optional size and weight limits."
			/>

			{editing && (
				<TransportFormDialog
					key={editing.id}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={editing}
					onSubmit={(values) =>
						updateTransport({
							id: editing.id,
							input: toUpdateTransportInput(values, userId),
						})
					}
					loading={updateLoading}
					title="Edit Transport"
					description="Update transport configuration."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.code}
					onConfirm={() => deleteTransport({ id: deleting.id })}
					loading={deleteLoading}
				/>
			)}
		</main>
	);
}
