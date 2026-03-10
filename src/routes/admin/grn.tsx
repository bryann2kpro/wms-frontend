import { useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
	useQuery,
	useMutation as useApolloMutation,
} from "@apollo/client/react";
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
	HelpCircle,
	ImageOff,
} from "lucide-react";
import type { GRNStatus, GRNStatusFilter } from "@/data/grn.mock-data";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import { GrnFormDialog } from "@/components/grn/grn-form-dialog";
import { useQuery as useApolloQuery } from "@apollo/client/react";
import {
	STOCK_UNITS_QUERY,
	type StockUnitsQueryData,
} from "@/lib/graphql/stock-units";
import {
	WAREHOUSES_QUERY,
	type WarehousesQueryData,
} from "@/lib/graphql/warehouses";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import {
	GRNS_QUERY,
	CREATE_GRN_MUTATION,
	CREATE_INBOUND_MUTATION,
	UPDATE_GRN_MUTATION,
	mapGrnsQueryToResult,
	UI_STATUS_TO_GQL,
	type GrnsQueryData,
} from "@/lib/graphql/grns";
import type { Skus, GrnDetailForList } from "@/lib/graphql/types";
import {
	SKUS_QUERY,
	type SkusQueryData,
	type SkusQueryVariables,
} from "@/lib/graphql/skus";
import { toast } from "sonner";
import { toUserFriendlyMessage } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

function getGrnErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (
			err as {
				graphQLErrors?: Array<{
					message?: string;
					extensions?: { code?: string };
				}>;
			}
		).graphQLErrors?.[0];
		if (first?.extensions?.code === "INTERNAL_SERVER_ERROR")
			return "Internal Server Error";
		const gql = first?.message;
		if (gql)
			return toUserFriendlyMessage(
				gql,
				"Failed to update GRN. Please try again.",
			);
	}
	if (err instanceof Error)
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	return "Something went wrong. Please try again.";
}

export const Route = createFileRoute("/admin/grn")({
	component: GRNRouteComponent,
});

const grnStatuses: GRNStatus[] = ["Draft", "Submitted", "Failed"];

const SEARCH_DEBOUNCE_MS = 350;

/** Base path for GRN help screenshots. Add step-1.png, step-2.png, etc. under public/help/grn/ */
const HELP_IMAGES_BASE = "/help/grn";

const GRN_HELP_STEPS: Array<{
	title: string;
	description: ReactNode;
	image: string;
}> = [
	{
		title: "What this page does",
		image: `${HELP_IMAGES_BASE}/step-1.png`,
		description: (
			<>
				Manage <strong>Goods Receipt Notes (GRN)</strong>: view the list, see
				counts by status (Draft, Submitted, Failed), and create new GRNs. Use
				this page to record incoming inventory and track receipts.
			</>
		),
	},
	{
		title: "Search, filter, and sort",
		image: `${HELP_IMAGES_BASE}/step-2.png`,
		description: (
			<>
				Search by <strong>GRN number</strong>, <strong>PO reference</strong>, or{" "}
				<strong>Supplier DO</strong> (debounced). Filter by{" "}
				<strong>Status</strong>. Use <strong>Sort by</strong> and{" "}
				<strong>Order</strong>. Pagination is at the bottom.
			</>
		),
	},
	{
		title: "Create GRN",
		image: `${HELP_IMAGES_BASE}/step-3.png`,
		description: (
			<>
				Click <strong>Create GRN</strong>, then enter GRN number, PO reference,
				supplier DO, received date, and line items (SKU, carton, loss, etc.).
				Save as <strong>Draft</strong> or <strong>Submit</strong> for approval.
			</>
		),
	},
	{
		title: "View, edit, and approve",
		image: `${HELP_IMAGES_BASE}/step-4.png`,
		description: (
			<>
				Use the <strong>eye</strong> icon to view details. From the view dialog
				you can <strong>Approve</strong> a Submitted GRN, or{" "}
				<strong>Send to ES</strong> when Approved. Use the <strong>edit</strong>{" "}
				icon to change Draft or Submitted GRNs.
			</>
		),
	},
];

/** Renders step screenshot with a placeholder when the image is missing or fails to load. */
function HelpStepImage({
	src,
	stepNumber,
	alt,
}: {
	src: string;
	stepNumber: number;
	alt?: string;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
					<ImageOff className="h-6 w-6" />
				</span>
				<span>Add screenshot: public/help/grn/step-{stepNumber}.png</span>
			</div>
		);
	}
	return (
		<img
			src={src}
			alt={alt ?? ""}
			className="h-full w-full object-contain object-top"
			onError={() => setFailed(true)}
		/>
	);
}

function GRNRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<GRNStatusFilter>("ALL");
	const [sortField, setSortField] = useState<string>("UPDATED_AT");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
	const debouncedSearchTerm = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const [selectedGRN, setSelectedGRN] = useState<GrnDetailForList | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);
	const { data: stockUnitsData } =
		useApolloQuery<StockUnitsQueryData>(STOCK_UNITS_QUERY);
	const stockUnits = stockUnitsData?.stockUnits?.query ?? [];
	const { data: skusData, refetch: refetchSkus } = useApolloQuery<
		SkusQueryData,
		SkusQueryVariables
	>(SKUS_QUERY, { variables: {} });
	const skuOptions: Skus[] = skusData?.skus?.query ?? [];
	const { data: warehousesData, refetch: refetchWarehouses } =
		useApolloQuery<WarehousesQueryData>(WAREHOUSES_QUERY, {
			variables: { pageSize: 500, pageNumber: 1 },
		});
	const warehouses = warehousesData?.warehouses?.query ?? [];

	const { data: racksData, refetch: refetchRacks } =
		useApolloQuery<RacksQueryData>(RACKS_QUERY, {
			variables: { pageSize: 500, pageNumber: 1 },
		});
	const racks = racksData?.racks?.query ?? [];

	const {
		data: grnsQueryData,
		loading: grnsLoading,
		refetch: refetchGRNs,
	} = useQuery<GrnsQueryData>(GRNS_QUERY, {
		variables: {
			filter: {
				page,
				pageSize,
				search: debouncedSearchTerm.trim() || undefined,
				status: statusFilter === "ALL" ? undefined : statusFilter,
				sortBy: sortField,
				sortOrder: sortDirection,
			},
		},
		fetchPolicy: "cache-and-network",
	});

	const emptyResult: import("@/lib/graphql/types").GrnListResult = {
		items: [],
		summary: {
			byStatus: {
				Draft: 0,
				Submitted: 0,
				Approved: 0,
				"Sent-to-ES": 0,
				Failed: 0,
			},
			total: 0,
		},
		page: 1,
		pageSize: 10,
		total: 0,
	};
	const data =
		grnsQueryData?.grns != null
			? mapGrnsQueryToResult(grnsQueryData.grns)
			: emptyResult;
	const isLoading = grnsLoading;

	const [createGRNApollo, { loading: createGrnLoading }] = useApolloMutation(
		CREATE_GRN_MUTATION,
		{
			onError: (err) => toast.error(getGrnErrorMessage(err)),
			onCompleted: () => {
				refetchGRNs();
				setIsCreateOpen(false);
			},
		},
	);
	const [createInboundApollo, { loading: createInboundLoading }] =
		useApolloMutation(CREATE_INBOUND_MUTATION, {
			onError: (err) => toast.error(getGrnErrorMessage(err)),
			onCompleted: () => {
				refetchGRNs();
				setIsCreateOpen(false);
			},
		});
	const useCreateInbound = true; // set false to use createGrn (no userId)
	const createLoading = useCreateInbound
		? createInboundLoading
		: createGrnLoading;

	const [updateGRNApollo, { loading: statusUpdating }] = useApolloMutation(
		UPDATE_GRN_MUTATION,
		{
			onError: (err) => {
				toast.error(getGrnErrorMessage(err));
			},
			onCompleted: () => {
				refetchGRNs();
			},
		},
	);

	const createMutation = {
		mutateAsync: async (payload: {
			grnNumber: string;
			poReference: string;
			supplierDO: string;
			receivedDate: Date;
			notes?: string;
			warehouseId?: string;
			/** Draft = save as draft, Submitted = submit for approval */
			submitIntent?: "draft" | "submit";
			items?: Array<{
				sku: string;
				description?: string;
				carton: number;
				loss: number;
				uom?: string;
				unitPrice?: number;
				expiryDate?: string;
				rackIds?: string[];
			}>;
		}) => {
			const status: GRNStatus =
				payload.submitIntent === "submit" ? "Submitted" : "Draft";
			/** Warehouse is hidden in UI; always use first warehouse from query. */
			const warehouseId =
				(warehouses[0]?.warehouseId ?? payload.warehouseId ?? "").trim() ||
				undefined;
			const items = payload.items?.map((i) => {
				const uomId = i.uom
					? (stockUnits.find((u) => u.unitCode === i.uom)?.stockUnitId ?? i.uom)
					: undefined;
				const rackIds = (i.rackIds ?? []).filter((id) => (id ?? "").trim());
				return {
					skuId:
						skuOptions.find((s) => s.skuCode === i.sku)?.skuId ?? undefined,
					skuCode: i.sku,
					skuDescription: i.description ?? undefined,
					qty: String(i.carton),
					lossQty: String(i.loss ?? 0),
					skuUom: uomId ?? undefined,
					expiryDate: (i.expiryDate ?? "").trim() || undefined,
					...(rackIds.length > 0 && { rackIds }),
				};
			});
			const baseInput = {
				grnNo: payload.grnNumber,
				supplierDeliveryNo: payload.supplierDO || undefined,
				poNo: payload.poReference?.trim() || undefined,
				receivedAt: payload.receivedDate.toISOString(),
				status: UI_STATUS_TO_GQL[status],
				notes: payload.notes?.trim() || undefined,
				warehouseId,
				items,
			};
			if (useCreateInbound) {
				const userId = user?.id ?? "";
				if (!userId) {
					toast.error("You must be signed in to create a GRN.");
					return;
				}
				await createInboundApollo({
					variables: { input: { userId, ...baseInput } },
				});
			} else {
				await createGRNApollo({
					variables: { input: baseInput },
				});
			}
		},
		isPending: createLoading,
	};

	const statusMutation = {
		mutateAsync: async ({ id, status }: { id: string; status: GRNStatus }) => {
			const input: {
				status: string;
				approvedBy?: string;
				approvedAt?: string;
			} = {
				status: UI_STATUS_TO_GQL[status],
			};
			if (status === "Approved" && user?.id) {
				input.approvedBy = user.id;
				input.approvedAt = new Date().toISOString();
			}
			await updateGRNApollo({
				variables: { id, input },
			});
			return undefined;
		},
		mutate: ({ id, status }: { id: string; status: GRNStatus }) => {
			const input: {
				status: string;
				approvedBy?: string;
				approvedAt?: string;
			} = {
				status: UI_STATUS_TO_GQL[status],
			};
			if (status === "Approved" && user?.id) {
				input.approvedBy = user.id;
				input.approvedAt = new Date().toISOString();
			}
			updateGRNApollo({
				variables: { id, input },
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
		const date =
			!isNaN(ms) && String(ms) === String(v).trim()
				? new Date(ms)
				: new Date(v);
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
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						aria-label="Open help"
						onClick={() => {
							setIsHelpOpen(true);
							setHelpStep(0);
						}}
					>
						<HelpCircle className="h-4 w-4" />
					</Button>
					<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
						<DialogContent className="sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>GRN help</DialogTitle>
								<DialogDescription>
									Step {helpStep + 1} of {GRN_HELP_STEPS.length}
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
									<HelpStepImage
										src={GRN_HELP_STEPS[helpStep].image}
										stepNumber={helpStep + 1}
									/>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-foreground mb-1">
										{GRN_HELP_STEPS[helpStep].title}
									</h3>
									<p className="text-sm text-muted-foreground leading-relaxed">
										{GRN_HELP_STEPS[helpStep].description}
									</p>
								</div>
								<div className="flex items-center justify-between gap-4 pt-2">
									<div className="flex gap-1">
										{GRN_HELP_STEPS.map((_, i) => (
											<button
												type="button"
												key={i}
												onClick={() => setHelpStep(i)}
												aria-label={`Go to step ${i + 1}`}
												className={`h-2 rounded-full transition-colors ${
													i === helpStep
														? "w-6 bg-primary"
														: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
												}`}
											/>
										))}
									</div>
									<div className="flex gap-2">
										{helpStep > 0 ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => setHelpStep((s) => s - 1)}
											>
												<ChevronLeft className="h-4 w-4 mr-0.5" />
												Previous
											</Button>
										) : null}
										{helpStep < GRN_HELP_STEPS.length - 1 ? (
											<Button
												size="sm"
												onClick={() => setHelpStep((s) => s + 1)}
											>
												Next
												<ChevronRight className="h-4 w-4 ml-0.5" />
											</Button>
										) : (
											<Button size="sm" onClick={() => setIsHelpOpen(false)}>
												Got it
											</Button>
										)}
									</div>
								</div>
							</div>
						</DialogContent>
					</Dialog>
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
							warehouses={warehouses}
							racks={racks}
							onCreateSubmit={async (payload) => {
								await createMutation.mutateAsync({
									grnNumber: payload.grnNumber,
									poReference: payload.poReference,
									supplierDO: payload.supplierDO,
									receivedDate: payload.receivedDate
										? new Date(payload.receivedDate)
										: new Date(),
									notes: payload.notes || undefined,
									warehouseId: payload.warehouseId || undefined,
									submitIntent: payload.submitIntent,
									items: payload.items.map((i) => ({
										sku: i.skuCode,
										description: i.description,
										carton: i.carton,
										loss: i.loss,
										uom: i.uom,
										unitPrice: i.unitPrice,
										expiryDate: i.expiryDate ?? "",
										rackIds: i.rackIds ?? [],
									})),
								});
							}}
							onSuccess={() => refetchGRNs()}
							onSkusRefetch={() => void refetchSkus()}
							onWarehouseCreated={async () => {
								await refetchWarehouses();
							}}
							onRackCreated={() => void refetchRacks()}
						/>
					)}
				</div>
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
									placeholder="Search GRN, PO, Supplier DO..."
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
							<Select
								value={sortField}
								onValueChange={(value) => {
									setSortField(value);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-44">
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="UPDATED_AT">Updated at</SelectItem>
									<SelectItem value="CREATED_AT">Created at</SelectItem>
									<SelectItem value="GRN_NO">GRN Number</SelectItem>
									<SelectItem value="RECEIVED_AT">Received date</SelectItem>
									<SelectItem value="STATUS">Status</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={sortDirection}
								onValueChange={(value: "ASC" | "DESC") => {
									setSortDirection(value);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-40">
									<SelectValue placeholder="Order" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="DESC">Newest first</SelectItem>
									<SelectItem value="ASC">Oldest first</SelectItem>
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
											hasPermission("grn:approve") &&
											grn.status === "Submitted";
										const showSend =
											hasPermission("grn:send_to_es") &&
											grn.status === "Approved";
										return (
											<TableRow key={grn.id}>
												<TableCell className="font-medium">
													{grn.grnNo || "-"}
												</TableCell>
												<TableCell>{grn.poNo ?? "-"}</TableCell>
												<TableCell>
													{grn.supplierDeliveryNo ??
														grn.supplierDeliveryId ??
														"-"}
												</TableCell>
												<TableCell>
													{formatGrnDate(grn.receivedAt) ?? "-"}
												</TableCell>
												<TableCell>
													{grn.status ? (
														<Badge
															variant="outline"
															className={getStatusColor(
																grn.status as GRNStatus,
															)}
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
													{(selectedGRN.supplierDeliveryNo ??
														selectedGRN.supplierDeliveryId) ||
														"-"}
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
													Warehouse
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.warehouse?.warehouseName
														? [
																selectedGRN.warehouse.warehouseName,
																selectedGRN.warehouse.warehouseCode,
															]
																.filter(Boolean)
																.join(" · ") ||
															selectedGRN.warehouse.warehouseName
														: "-"}
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
													<span className="text-sm text-muted-foreground">
														-
													</span>
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
															<TableHead>Carton</TableHead>
															<TableHead>Loss</TableHead>
															<TableHead>Total</TableHead>
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
																<TableCell>{item.lossQuantity}</TableCell>
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
				warehouses={warehouses}
				racks={racks}
				onSuccess={() => {
					refetchGRNs();
					setIsEditOpen(false);
					setSelectedGRN(null);
				}}
				onSkusRefetch={() => void refetchSkus()}
				onWarehouseCreated={async () => {
					await refetchWarehouses();
				}}
				onRackCreated={() => void refetchRacks()}
			/>
		</div>
	);
}
