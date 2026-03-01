import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation as useApolloMutation } from "@apollo/client/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Plus,
	Search,
	Eye,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Edit,
	Send,
} from "lucide-react";
import { type GRNStatus, type GRNStatusFilter } from "@/data/grn.mock-data";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import { GrnFormDialog } from "@/components/grn/grn-form-dialog";
import { useQuery as useApolloQuery } from "@apollo/client/react";
import { STOCK_UNITS_QUERY, type StockUnitsQueryData } from "@/lib/graphql/stock-units";
import {
	GRNS_QUERY,
	CREATE_GRN_MUTATION,
	UPDATE_GRN_MUTATION,
	mapGrnsQueryToResult,
	UI_STATUS_TO_GQL,
	type GrnsQueryData,
} from "@/lib/graphql/grns";
import { Skus, type GrnDetailForList } from "@/lib/graphql/types";
import { SKUS_QUERY, type SkusQueryData, type SkusQueryVariables } from "@/lib/graphql/skus";
import { toast } from "sonner";
import { toUserFriendlyMessage } from "@/lib/utils";

function getGrnErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string; extensions?: { code?: string } }> })
			.graphQLErrors?.[0];
		if (first?.extensions?.code === "INTERNAL_SERVER_ERROR") return "Internal Server Error";
		const gql = first?.message;
		if (gql) return toUserFriendlyMessage(gql, "Failed to update GRN. Please try again.");
	}
	if (err instanceof Error)
		return toUserFriendlyMessage(err.message, "Something went wrong. Please try again.");
	return "Something went wrong. Please try again.";
}

export const Route = createFileRoute("/admin/grn")({
	component: GRNRouteComponent,
});

const grnStatuses: GRNStatus[] = [
	"Draft",
	"Submitted",
	"Failed",
];

function GRNRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<GRNStatusFilter>("ALL");
	const [selectedGRN, setSelectedGRN] = useState<GrnDetailForList | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const { data: stockUnitsData } = useApolloQuery<
		StockUnitsQueryData
	>(STOCK_UNITS_QUERY);
	const stockUnits = stockUnitsData?.stockUnits?.query ?? [];
	const { data: skusData, refetch: refetchSkus } = useApolloQuery<SkusQueryData, SkusQueryVariables>(
		SKUS_QUERY,
		{ variables: {} }
	);
	const skuOptions: Skus[] = skusData?.skus?.query ?? [];

	const {
		data: grnsQueryData,
		loading: grnsLoading,
		refetch: refetchGRNs,
	} = useQuery<GrnsQueryData>(GRNS_QUERY, {
		variables: {
			filter: {
				page,
				pageSize,
				grnNo: searchTerm || undefined,
				status: statusFilter === "ALL" ? undefined : statusFilter,
			},
		},
		fetchPolicy: "cache-and-network",
	});

	const emptyResult: import("@/lib/graphql/types").GrnListResult = {
		items: [],
		summary: { byStatus: { Draft: 0, Submitted: 0, Approved: 0, "Sent-to-ES": 0, Failed: 0 }, total: 0 },
		page: 1,
		pageSize: 10,
		total: 0,
	};
	const data = grnsQueryData?.grns != null ? mapGrnsQueryToResult(grnsQueryData.grns) : emptyResult;
	const isLoading = grnsLoading;

	const [createGRNApollo, { loading: createLoading }] = useApolloMutation(
		CREATE_GRN_MUTATION,
		{
			onCompleted: () => {
				refetchGRNs();
				setIsCreateOpen(false);
			},
		}
	);

	const [updateGRNApollo, { loading: statusUpdating }] = useApolloMutation(
		UPDATE_GRN_MUTATION,
		{
			onError: (err) => {
				toast.error(getGrnErrorMessage(err));
			},
			onCompleted: () => {
				refetchGRNs();
			},
		}
	);

	const createMutation = {
		mutateAsync: async (payload: {
			grnNumber: string;
			poReference: string;
			supplierDO: string;
			receivedDate: Date;
			notes?: string;
			/** Draft = save as draft, Submitted = submit for approval */
			submitIntent?: "draft" | "submit";
			items?: Array<{ sku: string; description?: string; qty: number; uom?: string; unitPrice?: number }>;
		}) => {
			const status: GRNStatus = payload.submitIntent === "submit" ? "Submitted" : "Draft";
			await createGRNApollo({
				variables: {
					input: {
						grnNo: payload.grnNumber,
						supplierDeliveryNo: payload.supplierDO,
						poNo: payload.poReference || undefined,
						receivedAt: payload.receivedDate.toISOString(),
						status: UI_STATUS_TO_GQL[status],
						items: payload.items?.map((i) => {
							const uomId = i.uom
								? stockUnits.find((u) => u.unitCode === i.uom)?.stockUnitId ?? i.uom
								: undefined;
							return {
								skuId: skuOptions.find((s) => s.skuCode === i.sku)?.skuId ?? undefined,
								skuCode: i.sku,
								skuDescription: i.description ?? undefined,
								qty: String(i.qty),
								skuUom: uomId ?? undefined,
							};
						}),
					},
				},
			});
		},
		isPending: createLoading,
	};

	const statusMutation = {
		mutateAsync: async ({ id, status }: { id: string; status: GRNStatus }) => {
			await updateGRNApollo({
				variables: { id, input: { status: UI_STATUS_TO_GQL[status] } },
			});
			return undefined;
		},
		mutate: ({ id, status }: { id: string; status: GRNStatus }) => {
			updateGRNApollo({
				variables: { id, input: { status: UI_STATUS_TO_GQL[status] } },
			});
		},
		isPending: statusUpdating,
		status: statusUpdating ? ("pending" as const) : ("idle" as const),
	};

	const grns = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const getStatusColor = (status: GRNStatus | null | undefined) => {
		if (!status) return "bg-gray-500/10 text-gray-600 border-gray-500/20";
		const colors: Record<GRNStatus, string> = {
			Draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
			Submitted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			Approved: "bg-green-500/10 text-green-600 border-green-500/20",
			"Sent-to-ES": "bg-purple-500/10 text-purple-600 border-purple-500/20",
			Failed: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const formatStatus = (status: string) =>
		status
			.toLowerCase()
			.replace("_", " ")
			.replace(/\b\w/g, (l) => l.toUpperCase());

	/** Parse API date (numeric timestamp or ISO string) and format for display. */
	const formatGrnDate = (v: string | null | undefined): string | null => {
		if (v == null || v === "") return null;
		const ms = Number(v);
		const date = !isNaN(ms) && String(ms) === String(v).trim() ? new Date(ms) : new Date(v);
		return isNaN(date.getTime()) ? null : date.toLocaleString();
	};

	const handleViewGRN = (grn: GrnDetailForList) => {
		setSelectedGRN(grn);
		setIsViewOpen(true);
	};

	const handleUpdateStatus = (id: string, status: GRNStatus) => {
		statusMutation.mutate({ id, status });
		if (isViewOpen) {
			setIsViewOpen(false);
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Goods Receipt Notes (GRN)
					</h1>
					<p className="text-muted-foreground">
						Manage incoming inventory and track receipts
					</p>
				</div>
				{hasPermission("grn:create") && (
					<GrnFormDialog
						mode="create"
						open={isCreateOpen}
						onOpenChange={setIsCreateOpen}
						skuOptions={skuOptions}
						stockUnits={stockUnits}
						canCreate={hasPermission("grn:create")}
						trigger={
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Create GRN
							</Button>
						}
						onCreateSubmit={async (payload) => {
							await createMutation.mutateAsync({
								grnNumber: payload.grnNumber,
								poReference: payload.poReference,
								supplierDO: payload.supplierDO,
								receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : new Date(),
								notes: payload.notes || undefined,
								submitIntent: payload.submitIntent,
								items: payload.items.map((i) => ({
									sku: i.skuCode,
									description: i.description,
									qty: i.qty,
									uom: i.uom,
									unitPrice: i.unitPrice,
								})),
							});
						}}
						onSuccess={() => refetchGRNs()}
						onSkusRefetch={() => void refetchSkus()}
					/>
				)}
			</div>

			{summary && summary.byStatus && (
				<div className="grid gap-3 md:grid-cols-3">
					{grnStatuses.map((status) => (
						<Card key={status}>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">
									{formatStatus(status)}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{summary.byStatus[status] ?? 0}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>GRN List</CardTitle>
							<CardDescription>
								View and manage all goods receipt notes
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search GRNs..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 sm:w-64"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(value) => {
									setStatusFilter(value as GRNStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Status</SelectItem>
									{grnStatuses.map((status) => (
										<SelectItem key={status} value={status}>
											{formatStatus(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>GRN Number</TableHead>
									<TableHead>PO Reference</TableHead>
									<TableHead>Supplier DO</TableHead>
									<TableHead>Received Date</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											Loading GRNs...
										</TableCell>
									</TableRow>
								) : grns.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No GRNs found.
										</TableCell>
									</TableRow>
								) : (
									grns.map((grn: GrnDetailForList) => {
										const showEdit =
											hasPermission("grn:edit") &&
											grn.status &&
											(grn.status === "Draft" || grn.status === "Submitted");
										const showApprove =
											hasPermission("grn:approve") && grn.status === "Submitted";
										const showSend =
											hasPermission("grn:send_to_es") && grn.status === "Approved";
										return (
											<TableRow key={grn.id}>
												<TableCell className="font-medium">
													{grn.grnNo || "-"}
												</TableCell>
												<TableCell>{grn.poNo ?? "-"}</TableCell>
												<TableCell>{(grn.supplierDeliveryNo ?? grn.supplierDeliveryId) ?? "-"}</TableCell>
												<TableCell>
													{formatGrnDate(grn.receivedAt) ?? "-"}
												</TableCell>
												<TableCell>
													{grn.status ? (
														<Badge
															variant="outline"
															className={getStatusColor(grn.status as GRNStatus)}
														>
															{formatStatus(grn.status)}
														</Badge>
													) : (
														<span className="text-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-1">
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleViewGRN(grn)}
														>
															<Eye className="h-4 w-4" />
														</Button>
														{showEdit && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() => {
																	setSelectedGRN(grn);
																	setIsEditOpen(true);
																}}
															>
																<Edit className="h-4 w-4" />
															</Button>
														)}
														{showApprove && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "Approved")
																}
																disabled={statusMutation.status === "pending"}
															>
																<CheckCircle className="h-4 w-4 text-green-600" />
															</Button>
														)}
														{showSend && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "Sent-to-ES")
																}
																disabled={statusMutation.status === "pending"}
															>
																<Send className="h-4 w-4 text-purple-600" />
															</Button>
														)}
													</div>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>

					{data && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								Showing{" "}
								<span className="font-medium">
									{(data.page - 1) * data.pageSize + 1}
								</span>{" "}
								-{" "}
								<span className="font-medium">
									{Math.min(data.page * data.pageSize, data.total)}
								</span>{" "}
								of <span className="font-medium">{data.total}</span> GRNs
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page === 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span>
									Page {page} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={page === totalPages}
									onClick={() =>
										setPage((p) => (data ? Math.min(totalPages, p + 1) : p))
									}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* View GRN Dialog */}
			<Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
				<DialogContent
					className="max-h-[90vh] overflow-y-auto"
					style={{ maxWidth: "min(95vw, 1400px)" }}
				>
					<DialogHeader>
						<DialogTitle>GRN Details</DialogTitle>
						<DialogDescription>
							View detailed information about this goods receipt note
						</DialogDescription>
					</DialogHeader>
					{selectedGRN && (
						<div className="grid gap-6 lg:grid-cols-3">
							<div className="lg:col-span-2 space-y-6">
								<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
									<div className="space-y-6">
										<div className="grid gap-4 sm:grid-cols-2">
											<div>
												<Label className="text-xs text-muted-foreground">
													GRN Number
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.grnNo}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													PO Reference
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.poNo || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Supplier DO
												</Label>
												<p className="text-sm font-medium">
													{(selectedGRN.supplierDeliveryNo ?? selectedGRN.supplierDeliveryId) || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Received Date
												</Label>
												<p className="text-sm font-medium">
													{formatGrnDate(selectedGRN.receivedAt) ?? "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Status
												</Label>
												{selectedGRN.status ? (
													<Badge
														variant="outline"
														className={getStatusColor(selectedGRN.status)}
													>
														{formatStatus(selectedGRN.status)}
													</Badge>
												) : (
													<span className="text-sm text-muted-foreground">-</span>
												)}
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Created By
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.createdBy}
												</p>
											</div>
										</div>

										<div>
											<Label className="mb-2 block text-sm font-medium">
												Items
											</Label>
											<div className="rounded-lg border">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>SKU</TableHead>
															<TableHead>Description</TableHead>
															<TableHead>Expected</TableHead>
															<TableHead>Received</TableHead>
															<TableHead>Location</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{selectedGRN.items.map((item) => (
															<TableRow key={item.id}>
																<TableCell className="font-medium">
																	{item.skuCode}
																</TableCell>
																<TableCell>{item.skuDescription}</TableCell>
																<TableCell>{item.expectedQuantity}</TableCell>
																<TableCell>{item.receivedQuantity}</TableCell>
																<TableCell>
																	{item.location || "Not assigned"}
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>
										</div>

										{selectedGRN.notes && (
											<div>
												<Label className="text-xs text-muted-foreground">
													Notes
												</Label>
												<p className="text-sm">{selectedGRN.notes}</p>
											</div>
										)}
									</div>
								</ScrollArea>
							</div>

							{/* Right Panel: Audit Trail + Integration Status */}
							<div className="space-y-4">
								<Card>
									<CardHeader>
										<CardTitle className="text-sm">Audit Trail</CardTitle>
									</CardHeader>
									<CardContent className="text-xs space-y-2">
										<div>
											<p className="text-muted-foreground">Created By</p>
											<p className="font-medium">{selectedGRN.createdBy}</p>
										</div>
										<div>
											<p className="text-muted-foreground">Created At</p>
											<p className="font-medium">
												{formatGrnDate(selectedGRN.createdAt) ?? "-"}
											</p>
										</div>
									</CardContent>
								</Card>
								<IntegrationLogPanel
									entityId={selectedGRN.id}
									entityType="grn"
									onRetry={(logId) => {
										console.log("Retry log:", logId);
									}}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsViewOpen(false)}>
							Close
						</Button>
						{hasPermission("grn:approve") &&
							selectedGRN?.status === "Submitted" && (
								<Button
									onClick={() => {
										handleUpdateStatus(selectedGRN.id, "Approved");
									}}
									disabled={statusMutation.status === "pending"}
								>
									Approve
								</Button>
							)}
						{hasPermission("grn:send_to_es") &&
							selectedGRN?.status === "Approved" && (
								<Button
									onClick={() => {
										handleUpdateStatus(selectedGRN.id, "Sent-to-ES");
									}}
									disabled={statusMutation.status === "pending"}
								>
									<Send className="mr-2 h-4 w-4" />
									Send to ES
								</Button>
							)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit GRN – same form dialog as Create */}
			<GrnFormDialog
				mode="edit"
				open={isEditOpen}
				onOpenChange={setIsEditOpen}
				grn={selectedGRN}
				skuOptions={skuOptions}
				stockUnits={stockUnits}
				onSuccess={() => {
					refetchGRNs();
					setIsEditOpen(false);
					setSelectedGRN(null);
				}}
				onSkusRefetch={() => void refetchSkus()}
			/>
		</div>
	);
}
