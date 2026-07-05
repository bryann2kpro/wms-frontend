import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Ban } from "lucide-react";
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
import { AsnCombobox } from "@/components/grn/asn-combobox";
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
	RotateCcw,
	Send,
	HelpCircle,
	ImageOff,
	ClipboardList,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Separator } from "@/components/ui/separator";
import type { GRNStatus, GRNStatusFilter } from "@/data/grn.mock-data";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useProfile } from "@/lib/auth/use-profile";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import {
	GrnFormDialog,
	type GRNLineItemForm,
} from "@/components/grn/grn-form-dialog";
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
	type GrnsQueryVariables,
	type AdvanceNotice,
} from "@/lib/graphql/grns";
import type { Skus, GrnDetailForList } from "@/lib/graphql/types";
import {
	SKUS_QUERY,
	type SkusQueryData,
	type SkusQueryVariables,
} from "@/lib/graphql/skus";
import {
	SUPPLIERS_QUERY,
	type SuppliersQueryData,
} from "@/lib/graphql/suppliers";
import {
	END_USERS_QUERY,
	type EndUsersQueryData,
} from "@/lib/graphql/end-users";
import { toast } from "sonner";
import { toUserFriendlyMessage } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
	computePoRemainingQty,
	sumHistoricalReceivedBySku,
} from "@/lib/grn/po-fulfillment";

/**
 * True when a GRN's send-to-ES was blocked server-side because its PO/ASN still has
 * outstanding qty (see grns.resolvers.ts `computePoFulfillment` — message format:
 * "PO <poNo> not fully received yet — outstanding: ..."). Distinguishes this from a
 * genuine NetSuite rejection so the UI can remind staff *why*: another GRN already
 * exists against this PO and it isn't done yet.
 */
function isPoFulfillmentBlock(nsError?: string | null): boolean {
	return !!nsError && nsError.includes("not fully received yet");
}

function getGrnErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "response" in err) {
		const first = (
			err as {
				response?: {
					errors?: Array<{
						message?: string;
						extensions?: { code?: string };
					}>;
				};
			}
		).response?.errors?.[0];
		if (first?.extensions?.code === "INTERNAL_SERVER_ERROR")
			return "Internal Server Error";
		const gql = first?.message;
		if (gql)
			return toUserFriendlyMessage(
				gql,
				"Failed to update GRN. Please try again.",
			);
	}
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
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["GRN"]);
	},
	component: GRNRouteComponent,
	head: () => ({
		meta: [
			{
				title: "Goods Receipt Notes - SME Edaran WMS",
				description:
					"Manage GRN submissions, approvals, and NetSuite sync status for inbound inventory.",
			},
		],
	}),
});

const grnStatuses: GRNStatus[] = ["Submitted", "Failed"];

/** All statuses shown in the tab filter (matches GRNStatus + ALL). Draft is omitted from the list UI. */
const GRN_STATUS_TABS: Array<GRNStatusFilter> = [
	"ALL",
	"Submitted",
	"Approved",
	"Sent-to-ES",
	"Failed",
];

/** All statuses for dropdown (same order as tabs, minus ALL). */
const GRN_STATUS_OPTIONS: GRNStatus[] = [
	"Submitted",
	"Approved",
	"Sent-to-ES",
	"Failed",
];

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
					counts by status (Submitted, Failed), and create new GRNs. Use this page
					to record incoming inventory and track receipts.
				</>
			),
		},
		{
			title: "Search, filter, and sort",
			image: `${HELP_IMAGES_BASE}/step-2.png`,
			description: (
				<>
					Search by <strong>GRN number</strong>, <strong>End User PO</strong>, or{" "}
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
			<div
				className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
				style={{ fontFamily: "var(--dashboard-body)" }}
			>
				<span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
					<ImageOff className="h-7 w-7" />
				</span>
				<span className="text-sm text-muted-foreground">
					Add screenshot:{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
						public/help/grn/step-{stepNumber}.png
					</code>
				</span>
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

// ============================================================
// ASN Picker Dialog — Step 1 of the 2-step Create GRN flow
// ============================================================

type AsnPickerDialogProps = {
	open: boolean;
	onSelect: (asn: AdvanceNotice) => void | Promise<void>;
	onSkip: () => void;
	onOpenChange: (open: boolean) => void;
};

function AsnPickerDialog({
	open,
	onSelect,
	onSkip,
	onOpenChange,
}: AsnPickerDialogProps) {
	const [selectedAsn, setSelectedAsn] = useState<AdvanceNotice | null>(null);
	const [selecting, setSelecting] = useState(false);
	const linePreview = useMemo(
		() => selectedAsn?.lines.slice(0, 6) ?? [],
		[selectedAsn],
	);

	useEffect(() => {
		if (!open) setSelectedAsn(null);
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[min(96vw,980px)] max-w-[980px] rounded-2xl border border-border/80 bg-background shadow-xl">
				<DialogHeader className="pb-0">
					<div className="flex items-center gap-3 pb-4 border-b border-border">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 shadow-sm">
							<Send className="h-[18px] w-[18px] text-white" />
						</div>
						<div className="min-w-0 flex-1">
							<DialogTitle
								className="text-lg font-semibold leading-tight"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Select Advance Shipping Notice
							</DialogTitle>
							<DialogDescription
								className="text-sm text-muted-foreground mt-0.5"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Pick an outstanding ASN — pending or partially fulfilled — to prefill End User PO, due date, and expected
								line items.
							</DialogDescription>
						</div>
						{selectedAsn && (
							<>
								<Badge variant="outline" className="shrink-0 font-mono text-xs">
									{selectedAsn.lines.length} line(s)
								</Badge>
								{selectedAsn.fulfillmentStatus === "PARTIAL" ? (
									<Badge
										variant="outline"
										className="shrink-0 text-xs bg-amber-500/10 text-amber-600 border-amber-500/20"
									>
										Partially fulfilled
									</Badge>
								) : null}
							</>
						)}
					</div>
				</DialogHeader>

				<div className="space-y-4 pt-5 min-w-0">
					<p
						className="text-sm text-muted-foreground"
						style={{ fontFamily: "var(--dashboard-body)" }}
					>
						Choose the ASN from NetSuite that matches the delivery you are
						receiving, then click <strong>Continue</strong>. If no ASN exists
						for this delivery, click <strong>Skip</strong> to fill in manually.
					</p>
					<>
						<Label
							htmlFor="asn-select"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Advance Notice (PO / Entity / Due Date)
						</Label>
						<AsnCombobox
							id="asn-select"
							enabled={open}
							value={selectedAsn}
							onChange={setSelectedAsn}
							placeholder="Search or select an ASN…"
						/>
						{selectedAsn ? (
								<div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-4">
									<div className="grid gap-2 sm:grid-cols-3">
										<div className="rounded-lg border bg-background/70 p-2.5">
											<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
												End User PO
											</p>
											<p className="font-mono text-sm mt-0.5">
												{selectedAsn.tranid || "-"}
											</p>
										</div>
										<div className="rounded-lg border bg-background/70 p-2.5">
											<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
												Entity
											</p>
											<p className="text-sm mt-0.5 truncate">
												{selectedAsn.entity || "-"}
											</p>
										</div>
										<div className="rounded-lg border bg-background/70 p-2.5">
											<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
												Due Date
											</p>
											<p className="font-mono text-sm mt-0.5">
												{selectedAsn.duedate || "-"}
											</p>
										</div>
									</div>

									<div className="space-y-2">
										<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
											Expected line items preview
										</p>
										<div className="rounded-lg border bg-background/70 divide-y">
											{linePreview.map((l) => (
												<div
													key={l.lineuniquekey}
													className="flex items-start justify-between gap-3 p-2.5 text-sm"
												>
													<div className="min-w-0">
														<p className="font-mono">{l.itemid}</p>
														{l.displayname ? (
															<p className="text-xs text-muted-foreground truncate">
																{l.displayname}
															</p>
														) : null}
													</div>
													<Badge
														variant="outline"
														className="shrink-0 font-mono text-xs"
													>
														{l.quantity} {l.units}
													</Badge>
												</div>
											))}
											{selectedAsn.lines.length > linePreview.length ? (
												<p className="px-2.5 py-2 text-xs text-muted-foreground">
													+{selectedAsn.lines.length - linePreview.length} more
													line(s)
												</p>
											) : null}
										</div>
									</div>
								</div>
						) : null}
					</>
				</div>

				<DialogFooter className="mt-2 gap-2 border-t border-border pt-4">
					<Button variant="outline" onClick={onSkip} className="rounded-lg">
						Skip — Enter manually
					</Button>
					<Button
						className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
						disabled={!selectedAsn || selecting}
						onClick={async () => {
							if (!selectedAsn || selecting) return;
							setSelecting(true);
							try {
								await onSelect(selectedAsn);
							} finally {
								setSelecting(false);
							}
						}}
					>
						{selecting ? "Loadingâ€¦" : "Continue"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function GRNRouteComponent() {
	const { user } = useCurrentUser();
	const { data: profile } = useProfile();
	const { create, update } = usePermissions(user);
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<GRNStatusFilter>("ALL");
	const [sortField, setSortField] = useState<string>("UPDATED_AT");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
	const debouncedSearchTerm = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const statusFilterForQuery =
		statusFilter === "ALL"
			? undefined
			: (UI_STATUS_TO_GQL[statusFilter as GRNStatus] ?? statusFilter);
	const [selectedGRN, setSelectedGRN] = useState<GrnDetailForList | null>(null);
	const [isAsnPickerOpen, setIsAsnPickerOpen] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [selectedAsnId, setSelectedAsnId] = useState<string | null>(null);
	const [asnInitialValues, setAsnInitialValues] = useState<
		| {
			poReference?: string;
			receivedDate?: string;
			items?: GRNLineItemForm[];
			/** PENDING ASNs are not linked yet — do not subtract prior GRN qty in the form. */
			skipPoFulfillmentAdjust?: boolean;
		}
		| undefined
	>(undefined);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);
	const { data: stockUnitsData } = useQuery({
		queryKey: qk.stockUnits.all,
		queryFn: () => gqlRequest<StockUnitsQueryData>(STOCK_UNITS_QUERY),
	});
	const stockUnits = stockUnitsData?.stockUnits?.query ?? [];

	const skusVariables: SkusQueryVariables = {};
	const { data: skusData, refetch: refetchSkus } = useQuery({
		queryKey: [...qk.skus.all, "list", skusVariables] as const,
		queryFn: () =>
			gqlRequest<SkusQueryData, SkusQueryVariables>(SKUS_QUERY, skusVariables),
	});
	const skuOptions: Skus[] = skusData?.skus?.query ?? [];

	const warehousesVariables = { pageSize: 500, pageNumber: 1 };
	const { data: warehousesData, refetch: refetchWarehouses } = useQuery({
		queryKey: [...qk.warehouses.all, "list", warehousesVariables] as const,
		queryFn: () =>
			gqlRequest<WarehousesQueryData>(WAREHOUSES_QUERY, warehousesVariables),
	});
	const warehouses = warehousesData?.warehouses?.query ?? [];

	const racksVariables = { pageSize: 500, pageNumber: 1 };
	const { data: racksData, refetch: refetchRacks } = useQuery({
		queryKey: [...qk.racks.all, "list", racksVariables] as const,
		queryFn: () => gqlRequest<RacksQueryData>(RACKS_QUERY, racksVariables),
	});
	const racks = racksData?.racks?.query ?? [];

	const suppliersVariables = { pageSize: 500, pageNumber: 1 };
	const { data: suppliersData } = useQuery({
		queryKey: [...qk.suppliers.all, "list", suppliersVariables] as const,
		queryFn: () =>
			gqlRequest<SuppliersQueryData>(SUPPLIERS_QUERY, suppliersVariables),
	});
	const suppliers = suppliersData?.suppliers?.query ?? [];

	const { data: endUsersData } = useQuery({
		queryKey: [...qk.endUsers.all, "list"],
		queryFn: () => gqlRequest<EndUsersQueryData>(END_USERS_QUERY, { pageSize: 500, pageNumber: 1 }),
	});
	const endUsers = endUsersData?.endUsers?.query ?? [];

	const grnsQueryVars: GrnsQueryVariables = {
		filter: {
			search: debouncedSearchTerm.trim() || undefined,
			status: statusFilterForQuery,
			/** Draft GRNs are hidden from this page; backend excludes them when not filtering by status. */
			excludeDraft: true,
			sortBy: sortField,
			sortOrder: sortDirection,
		},
		pageSize,
		pageNumber: page,
	};
	const {
		data: grnsQueryData,
		isLoading: grnsLoading,
		refetch: refetchGRNs,
	} = useQuery({
		queryKey: qk.grns.list(grnsQueryVars),
		queryFn: () =>
			gqlRequest<GrnsQueryData, GrnsQueryVariables>(GRNS_QUERY, grnsQueryVars),
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
		totalPages: 1,
	};
	const data =
		grnsQueryData?.grns != null
			? mapGrnsQueryToResult(grnsQueryData.grns, {
					requestedPageSize: pageSize,
				})
			: emptyResult;
	const isLoading = grnsLoading;

	const { mutateAsync: createGRNApollo, isPending: createGrnLoading } =
		useMutation({
			mutationFn: (vars: { input: Record<string, unknown> }) =>
				gqlRequest(CREATE_GRN_MUTATION, vars),
			onError: (err) => toast.error(getGrnErrorMessage(err)),
			onSuccess: () => {
				refetchGRNs();
				setIsCreateOpen(false);
				toast.success("GRN created");
			},
		});
	const { mutateAsync: createInboundApollo, isPending: createInboundLoading } =
		useMutation({
			mutationFn: (vars: { input: Record<string, unknown> }) =>
				gqlRequest(CREATE_INBOUND_MUTATION, vars),
			onError: (err) => toast.error(getGrnErrorMessage(err)),
			onSuccess: () => {
				refetchGRNs();
				setIsCreateOpen(false);
				toast.success("GRN created");
			},
		});
	const useCreateInbound = true; // set false to use createGrn (no userId)
	const createLoading = useCreateInbound
		? createInboundLoading
		: createGrnLoading;

	const [pendingStatusAction, setPendingStatusAction] = useState<
		GRNStatus | null
	>(null);
	const { mutate: updateGRNApollo, isPending: statusUpdating } = useMutation({
		mutationFn: (vars: { id: string; input: Record<string, unknown> }) =>
			gqlRequest(UPDATE_GRN_MUTATION, vars),
		onError: (err) => {
			toast.error(getGrnErrorMessage(err));
			setPendingStatusAction(null);
		},
		onSuccess: () => {
			refetchGRNs();
			const action = pendingStatusAction;
			setPendingStatusAction(null);
			if (action === "Approved") toast.success("GRN approved");
			else if (action === "Sent-to-ES") toast.success("GRN sent to ES");
			else toast.success("GRN status updated");
		},
	});

	const createMutation = {
		mutateAsync: async (payload: {
			grnNumber: string;
			poReference: string;
			supplierDO: string;
			receivedDate: Date;
			notes?: string;
			warehouseId?: string;
			poFulfilled?: boolean;
			/** Draft = save as draft, Submitted = submit for approval */
			submitIntent?: "draft" | "submit";
			items?: Array<{
				sku: string;
				description?: string;
				carton: number;
				orderedQty?: number;
				loss: number;
				uom?: string;
				unitPrice?: number;
				expiryDate?: string;
				lotNo?: string;
				lossRackId?: string;
				rackIds?: string[];
				rackAllocations?: Array<{ rackId: string; quantity: number }>;
				lossRackAllocations?: Array<{ rackId: string; quantity: number }>;
			}>;
			/** ID of advance notice this GRN was created from. */
			advanceNoticeId?: string | null;
			supplierId?: string;
			endUserId?: string;
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
				const rackAllocations = (i.rackAllocations ?? []).filter(
					(row) => (row.rackId ?? "").trim() && row.quantity > 0,
				);
				const rackIds = (i.rackIds ?? []).filter((id) => (id ?? "").trim());
				const lossRackAllocations = (i.lossRackAllocations ?? []).filter(
					(row) => (row.rackId ?? "").trim() && row.quantity > 0,
				);
				return {
					skuId:
						skuOptions.find((s) => s.skuCode === i.sku)?.skuId ?? undefined,
					skuCode: i.sku,
					skuDescription: i.description ?? undefined,
					qty: String(i.carton),
					orderedQty: i.orderedQty == null ? undefined : String(i.orderedQty),
					lossQty: String(i.loss ?? 0),
					lossRackId: (i.lossRackId ?? "").trim() || undefined,
					skuUom: uomId ?? undefined,
					expiryDate: (i.expiryDate ?? "").trim() || undefined,
					lotNo: (i.lotNo ?? "").trim() || undefined,
					...(rackAllocations.length > 0
						? { rackAllocations }
						: rackIds.length > 0
							? { rackIds }
							: {}),
					...(lossRackAllocations.length > 0 ? { lossRackAllocations } : {}),
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
				endUserId: payload.endUserId?.trim() || undefined,
				items,
			};
			if (useCreateInbound) {
				const userId = user?.id ?? "";
				if (!userId) {
					toast.error("You must be signed in to create a GRN.");
					return;
				}
				await createInboundApollo({
					input: {
						userId,
						...baseInput,
						supplierId: payload.supplierId?.trim() || undefined,
						poFulfilled: payload.poFulfilled ?? true,
						advanceNoticeId: payload.advanceNoticeId ?? undefined,
					},
				});
			} else {
				await createGRNApollo({ input: baseInput });
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
			updateGRNApollo({ id, input });
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
			updateGRNApollo({ id, input });
		},
		isPending: statusUpdating,
		status: statusUpdating ? ("pending" as const) : ("idle" as const),
	};

	const grns = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data?.totalPages ?? 1;
	const canApproveGrn = (profile?.approvePermission ?? []).includes("GRN");

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

	/** Parse API date (numeric timestamp or ISO string) and format for display (Malaysian DD/MM/YYYY). */
	const formatGrnDate = (v: string | null | undefined): string | null => {
		if (v == null || v === "") return null;
		const ms = Number(v);
		const date =
			!isNaN(ms) && String(ms) === String(v).trim()
				? new Date(ms)
				: new Date(v);
		if (isNaN(date.getTime())) return null;
		const day = String(date.getDate()).padStart(2, "0");
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	};

	const handleViewGRN = (grn: GrnDetailForList) => {
		setSelectedGRN(grn);
		setIsViewOpen(true);
	};

	const handleUpdateStatus = (id: string, status: GRNStatus) => {
		setPendingStatusAction(status);
		statusMutation.mutate({ id, status });
		if (isViewOpen) {
			setIsViewOpen(false);
		}
	};

	const summaryDelays = [0, 80, 160];
	const isPageBusy =
		isLoading || createLoading || statusMutation.status === "pending";

	return (
		<ClientOnly>
			<div className="grn-page min-h-screen bg-[var(--dashboard-surface)]">
				<div
					className="pointer-events-none fixed left-0 right-0 top-0 h-[320px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/25 via-transparent to-transparent"
					aria-hidden
				/>
				<main
					className="container relative mx-auto px-6 py-8 space-y-8"
					aria-labelledby="grn-page-title"
					aria-describedby="grn-page-description"
					aria-busy={isPageBusy}
				>
					<AdminPageHeader
						icon={CheckCircle}
						title="Goods Receipt Notes (GRN)"
						description="Manage incoming inventory and track receipts."
						titleId="grn-page-title"
						descriptionId="grn-page-description"
						rightSlot={
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									aria-label="Open help"
									className="rounded-lg"
									onClick={() => {
										setIsHelpOpen(true);
										setHelpStep(0);
									}}
								>
									<HelpCircle className="h-4 w-4" />
								</Button>
								<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
									<DialogContent className="sm:max-w-lg rounded-2xl border-2 border-border bg-background p-0 overflow-hidden shadow-xl">
										<DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/50">
											<div className="flex items-center gap-3">
												<div
													className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-sm font-bold text-white tabular-nums"
													style={{ fontFamily: "var(--dashboard-display)" }}
												>
													{helpStep + 1}
												</div>
												<div>
													<DialogTitle
														className="text-lg"
														style={{ fontFamily: "var(--dashboard-display)" }}
													>
														GRN help
													</DialogTitle>
													<DialogDescription
														className="mt-0.5"
														style={{ fontFamily: "var(--dashboard-body)" }}
													>
														Step {helpStep + 1} of {GRN_HELP_STEPS.length}
													</DialogDescription>
												</div>
											</div>
										</DialogHeader>
										<div className="space-y-5 px-6 py-5">
											<div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/50 shadow-inner">
												<HelpStepImage
													src={GRN_HELP_STEPS[helpStep].image}
													stepNumber={helpStep + 1}
												/>
											</div>
											<div className="rounded-xl border bg-card p-4">
												<h3
													className="text-sm font-semibold text-foreground mb-2"
													style={{ fontFamily: "var(--dashboard-display)" }}
												>
													{GRN_HELP_STEPS[helpStep].title}
												</h3>
												<p
													className="text-sm text-muted-foreground leading-relaxed"
													style={{ fontFamily: "var(--dashboard-body)" }}
												>
													{GRN_HELP_STEPS[helpStep].description}
												</p>
											</div>
											<div className="flex items-center justify-between gap-4 pt-1">
												<div
													className="flex gap-1.5"
													role="tablist"
													aria-label="Help steps"
												>
													{GRN_HELP_STEPS.map((_, i) => (
														<button
															type="button"
															key={i}
															role="tab"
															aria-selected={i === helpStep}
															aria-label={`Step ${i + 1}: ${GRN_HELP_STEPS[i].title}`}
															onClick={() => setHelpStep(i)}
															className={`h-2 rounded-full transition-all duration-200 ${i === helpStep
																	? "w-6 bg-amber-600"
																	: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50 hover:w-3"
																}`}
														/>
													))}
												</div>
												<div className="flex gap-2">
													{helpStep > 0 ? (
														<Button
															variant="outline"
															size="sm"
															className="rounded-lg"
															onClick={() => setHelpStep((s) => s - 1)}
														>
															<ChevronLeft className="h-4 w-4 mr-0.5" />
															Previous
														</Button>
													) : null}
													{helpStep < GRN_HELP_STEPS.length - 1 ? (
														<Button
															size="sm"
															className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
															onClick={() => setHelpStep((s) => s + 1)}
														>
															Next
															<ChevronRight className="h-4 w-4 ml-0.5" />
														</Button>
													) : (
														<Button
															size="sm"
															className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
															onClick={() => setIsHelpOpen(false)}
														>
															Got it
														</Button>
													)}
												</div>
											</div>
										</div>
									</DialogContent>
								</Dialog>
								{create("GRN") && (
									<>
										{/* Step 1: ASN Picker */}
										<AsnPickerDialog
											open={isAsnPickerOpen}
											onSkip={() => {
												setSelectedAsnId(null);
												setAsnInitialValues(undefined);
												setIsAsnPickerOpen(false);
												setIsCreateOpen(true);
											}}
											onSelect={async (asn) => {
												setSelectedAsnId(asn.id);
												const deductPriorReceipts =
													asn.fulfillmentStatus === "PARTIAL";
												let receivedBySku = new Map<string, number>();
												if (deductPriorReceipts) {
													try {
														const historyResult =
															await gqlRequest<GrnsQueryData>(GRNS_QUERY, {
																filter: { poNo: asn.tranid },
																pageSize: 100,
															});
														receivedBySku = sumHistoricalReceivedBySku(
															historyResult?.grns?.query ?? [],
														);
													} catch {
														// Fall back to full ASN qty if history lookup fails.
													}
												}
												const mapAsnLineToFormItem = (
													l: (typeof asn.lines)[number],
													carton: number,
												) => {
													const isLotTracked =
														(l.islotitem ?? "").trim().toUpperCase() === "T";
													const unitMatch = stockUnits.find(
														(u) =>
															u.unitCode.toLowerCase() ===
															l.units.toLowerCase(),
													);
													return {
														skuCode: l.itemid,
														description: l.displayname ?? "",
														carton,
														loss: 0,
														uom: unitMatch?.stockUnitId ?? l.units,
														unitPrice: 0,
														expiryDate: l.expiryDate ?? "",
														lotNo: l.lotNo ?? "",
														rackId: "",
														asnLotTracked: isLotTracked,
													};
												};
												let prefilledItems = asn.lines
													.map((l) =>
														mapAsnLineToFormItem(
															l,
															deductPriorReceipts
																? computePoRemainingQty(
																		l.quantity,
																		receivedBySku.get(l.itemid) ?? 0,
																	)
																: l.quantity,
														),
													)
													.filter((item) => item.carton > 0);
												// PARTIAL ASNs should always have outstanding qty; if the
												// client-side deduction zeroes every line, fall back to full ASN qty.
												if (
													prefilledItems.length === 0 &&
													asn.lines.length > 0
												) {
													prefilledItems = asn.lines.map((l) =>
														mapAsnLineToFormItem(l, l.quantity),
													);
												}
												setAsnInitialValues({
													poReference: asn.tranid,
													receivedDate: asn.duedate,
													items: prefilledItems,
													skipPoFulfillmentAdjust: !deductPriorReceipts,
												});
												setIsAsnPickerOpen(false);
												setIsCreateOpen(true);
											}}
											onOpenChange={(open) => {
												if (!open) setIsAsnPickerOpen(false);
											}}
										/>
										{/* Step 2: GRN Form */}
										<GrnFormDialog
											key={selectedAsnId ?? "manual"}
											mode="create"
											open={isCreateOpen}
											onOpenChange={(open) => {
												setIsCreateOpen(open);
												if (!open) {
													setSelectedAsnId(null);
													setAsnInitialValues(undefined);
												}
											}}
											skuOptions={skuOptions}
											stockUnits={stockUnits}
											canCreate={create("GRN")}
											trigger={
												<Button
													className="bg-[var(--dashboard-accent)] text-white hover:opacity-90 rounded-lg"
													onClick={(e) => {
														e.preventDefault();
														setIsAsnPickerOpen(true);
													}}
												>
													<Plus className="mr-2 h-4 w-4" />
													Create GRN
												</Button>
											}
											warehouses={warehouses}
											racks={racks}
											suppliers={suppliers}
											endUsers={endUsers}
											supplierSelectionOptional={!!selectedAsnId}
											showPoFulfilledToggle={!selectedAsnId}
											initialValues={asnInitialValues}
											onCreateSubmit={async (payload) => {
												await createMutation.mutateAsync({
													grnNumber: payload.grnNumber,
													poReference: payload.poReference,
													supplierId: payload.supplierId,
													supplierDO: payload.supplierDO,
													receivedDate: payload.receivedDate
														? new Date(payload.receivedDate)
														: new Date(),
													notes: payload.notes || undefined,
													warehouseId: payload.warehouseId || undefined,
													endUserId: payload.endUserId || undefined,
													poFulfilled: payload.poFulfilled,
													submitIntent: payload.submitIntent,
													advanceNoticeId: selectedAsnId ?? undefined,
													items: payload.items.map((i) => ({
														sku: i.skuCode,
														description: i.description,
														carton: i.carton,
														orderedQty: i.orderedQty,
														loss: i.loss,
														uom: i.uom,
														unitPrice: i.unitPrice,
														expiryDate: i.expiryDate ?? "",
														lotNo: i.lotNo ?? "",
														lossRackId: i.lossRackId?.trim() || undefined,
														rackIds: i.rackId?.trim() ? [i.rackId.trim()] : [],
														rackAllocations: i.rackAllocations,
														lossRackAllocations: i.lossRackAllocations,
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
									</>
								)}
							</div>
						}
					/>

					{summary && summary.byStatus && (
						<div className="grid gap-5 md:grid-cols-2">
							{grnStatuses.map((status, i) => (
								<Card
									key={status}
									className={`dashboard-card shadow-md hover:shadow-lg cursor-pointer transition-all ${statusFilter === status ? "ring-2 ring-[var(--dashboard-accent)] ring-offset-2" : ""}`}
									style={{ animationDelay: `${summaryDelays[i]}ms` }}
									onClick={() => {
										setStatusFilter((prev) =>
											prev === status ? "ALL" : status,
										);
										setPage(1);
									}}
									role="button"
									tabIndex={0}
									aria-pressed={statusFilter === status}
									aria-label={`Filter by ${formatStatus(status)}`}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setStatusFilter((prev) =>
												prev === status ? "ALL" : status,
											);
											setPage(1);
										}
									}}
								>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle
											className="text-sm font-semibold"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											{formatStatus(status)}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div
											className="text-3xl font-bold tabular-nums"
											style={{ fontFamily: "var(--dashboard-display)" }}
										>
											{summary.byStatus[status] ?? 0}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}

					<Card className="dashboard-card shadow-md hover:shadow-lg">
						<CardHeader>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<CardTitle
										className="text-lg"
										style={{ fontFamily: "var(--dashboard-display)" }}
									>
										GRN List
									</CardTitle>
									<CardDescription
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										View and manage all goods receipt notes
									</CardDescription>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<div className="relative">
										<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
										<Input
											placeholder="Search GRN, PO, Supplier DO..."
											value={searchTerm}
											onChange={(e) => {
												setSearchTerm(e.target.value);
												setPage(1);
											}}
											className="pl-9 sm:w-64 rounded-lg border-muted-foreground/20"
										/>
									</div>
									<Select
										value={statusFilter}
										onValueChange={(value) => {
											setStatusFilter(value as GRNStatusFilter);
											setPage(1);
										}}
									>
										<SelectTrigger className="sm:w-48 rounded-lg border-muted-foreground/20">
											<SelectValue placeholder="Filter by status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ALL">All Status</SelectItem>
											{GRN_STATUS_OPTIONS.map((status) => (
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
										<SelectTrigger className="sm:w-44 rounded-lg border-muted-foreground/20">
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
										<SelectTrigger className="sm:w-40 rounded-lg border-muted-foreground/20">
											<SelectValue placeholder="Order" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="DESC">Newest first</SelectItem>
											<SelectItem value="ASC">Oldest first</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							{/* Status tabs */}
							<div className="flex flex-wrap gap-2 border-b pt-2">
								{GRN_STATUS_TABS.map((value) => (
									<Button
										key={value}
										variant="ghost"
										size="sm"
										onClick={() => {
											setStatusFilter(value);
											setPage(1);
										}}
										className="rounded-lg rounded-b-none border border-transparent transition-colors hover:bg-[var(--dashboard-accent-muted)]/60"
										style={{
											fontFamily: "var(--dashboard-body)",
											...(statusFilter === value
												? {
													background: "var(--dashboard-accent)",
													borderColor: "var(--dashboard-accent)",
													color: "white",
												}
												: {
													background: "transparent",
													color: "inherit",
												}),
										}}
									>
										{value === "ALL" ? "All" : formatStatus(value)}
									</Button>
								))}
							</div>
						</CardHeader>
						<CardContent className="relative px-0 pb-6">
							<GlobalLoadingShadow />
							<div className="overflow-x-auto rounded-lg border mx-6">
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead className="px-6">GRN Number</TableHead>
											<TableHead className="px-6">End User PO</TableHead>
											<TableHead className="px-6">Supplier DO</TableHead>
											<TableHead className="px-6">Received Date</TableHead>
											<TableHead className="px-6">Status</TableHead>
											<TableHead className="text-right px-6">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{isLoading ? (
											<TableRow>
												<TableCell
													colSpan={6}
													className="h-24 px-6 text-center text-muted-foreground"
												>
													Loading GRNs...
												</TableCell>
											</TableRow>
										) : grns.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={6}
													className="h-24 px-6 text-center text-muted-foreground"
												>
													No GRNs found.
												</TableCell>
											</TableRow>
										) : (
											grns.map((grn: GrnDetailForList) => {
												const showEdit =
													update("GRN") &&
													grn.status &&
													(grn.status === "Draft" || grn.status === "Submitted");
												const showApprove =
													canApproveGrn && grn.status === "Submitted";
												// poFulfilled === false means the PO/ASN still has outstanding qty —
												// sending now is guaranteed to be rejected by NetSuite (see
												// computePoFulfillment on the backend). Hide the action entirely
												// rather than let staff hit a doomed send.
												const poBlocked = grn.poFulfilled === false;
												const showSend =
													canApproveGrn &&
													grn.status === "Approved" &&
													!poBlocked &&
													!grn.manualInbound;
												const showRetry = canApproveGrn && grn.status === "Failed";
												return (
													<TableRow
														key={grn.id}
														className="transition-colors hover:bg-muted/50"
													>
														<TableCell className="font-medium px-6">
															{grn.grnNo || "-"}
														</TableCell>
														<TableCell className="px-6">
															{grn.poNo ?? "-"}
														</TableCell>
														<TableCell className="px-6">
															{grn.supplierDeliveryNo ??
																grn.supplierDeliveryId ??
																"-"}
														</TableCell>
														<TableCell className="px-6">
															{formatGrnDate(grn.receivedAt) ?? "-"}
														</TableCell>
														<TableCell className="px-6">
															{grn.status ? (
																<div className="flex items-center gap-1.5">
																	<Badge
																		variant="outline"
																		className={getStatusColor(
																			grn.status as GRNStatus,
																		)}
																	>
																		{formatStatus(grn.status)}
																	</Badge>
																	{isPoFulfillmentBlock(grn.nsError) ? (
																		<span
																			title={grn.nsError ?? undefined}
																			className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
																		>
																			<Ban className="h-3 w-3" />
																			PO not fully received
																		</span>
																	) : null}
																</div>
															) : (
																<span className="text-muted-foreground">-</span>
															)}
														</TableCell>
														<TableCell className="text-right px-6">
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
																{canApproveGrn &&
																grn.status === "Approved" &&
																poBlocked ? (
																	<span
																		title={`PO ${grn.poNo ?? ""} still has another delivery outstanding — wait until it's fully received before sending to ES.`}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-500/70"
																	>
																		<Ban className="h-4 w-4" />
																	</span>
																) : null}
																{showRetry && (
																	<Button
																		variant="ghost"
																		size="icon"
																		onClick={() =>
																			handleUpdateStatus(grn.id, "Approved")
																		}
																		disabled={statusMutation.status === "pending"}
																		aria-label="Retry sync"
																	>
																		<RotateCcw className="h-4 w-4 text-amber-600" />
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
								<div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-6 text-xs text-muted-foreground">
									<div style={{ fontFamily: "var(--dashboard-body)" }}>
										Showing{" "}
										<span className="font-semibold tabular-nums text-foreground">
											{data.total === 0
												? 0
												: (data.page - 1) * data.pageSize + 1}
										</span>{" "}
										â€“{" "}
										<span className="font-semibold tabular-nums text-foreground">
											{data.total === 0
												? 0
												: Math.min(data.page * data.pageSize, data.total)}
										</span>{" "}
										of{" "}
										<span className="font-semibold tabular-nums text-foreground">
											{data.total}
										</span>{" "}
										GRNs
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="icon"
											className="rounded-lg h-8 w-8"
											disabled={page === 1}
											onClick={() => setPage((p) => Math.max(1, p - 1))}
										>
											<ChevronLeft className="h-4 w-4" />
										</Button>
										<span className="tabular-nums min-w-[6rem] text-center">
											Page {page} of {totalPages}
										</span>
										<Button
											variant="outline"
											size="icon"
											className="rounded-lg h-8 w-8"
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
							className="max-h-[90vh] overflow-y-auto rounded-xl"
							style={{ maxWidth: "min(95vw, 1400px)" }}
						>
							{/* Accent strip */}
							<div
								className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
								style={{ background: "linear-gradient(to right, var(--dashboard-accent), transparent)" }}
							/>

							<DialogHeader className="pb-0">
								<div className="flex items-center gap-3">
									<div
										className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
										style={{ background: "var(--dashboard-accent)" }}
									>
										<ClipboardList className="h-4.5 w-4.5 text-white" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2.5">
											<DialogTitle
												className="text-xl font-bold tracking-tight"
												style={{ fontFamily: "var(--dashboard-display)" }}
											>
												{selectedGRN?.grnNo || "GRN Details"}
											</DialogTitle>
											{selectedGRN?.status && (
												<Badge
													variant="outline"
													className={getStatusColor(selectedGRN.status)}
												>
													{formatStatus(selectedGRN.status)}
												</Badge>
											)}
										</div>
										<DialogDescription
											className="text-sm"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											Goods Receipt Note
										</DialogDescription>
									</div>
								</div>
							</DialogHeader>

							{selectedGRN && (
								<div className="grid gap-6 lg:grid-cols-3">
									<div className="lg:col-span-2 space-y-5">
										<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
											<div className="space-y-5">
												{/* Metadata grid */}
												<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
													<div>
														<p
															className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															End User PO
														</p>
														<p
															className="text-sm font-semibold"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															{selectedGRN.poNo || "-"}
														</p>
													</div>
													<div>
														<p
															className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Supplier DO
														</p>
														<p
															className="text-sm font-semibold"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															{(selectedGRN.supplierDeliveryNo ??
																selectedGRN.supplierDeliveryId) ||
																"-"}
														</p>
													</div>
													<div>
														<p
															className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Received Date
														</p>
														<p
															className="text-sm font-semibold"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															{formatGrnDate(selectedGRN.receivedAt) ?? "-"}
														</p>
													</div>
													<div>
														<p
															className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Warehouse
														</p>
														<p
															className="text-sm font-semibold"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															{selectedGRN.warehouse?.warehouseName
																? [
																	selectedGRN.warehouse.warehouseName,
																	selectedGRN.warehouse.warehouseCode,
																]
																	.filter(Boolean)
																	.join(" Â· ") ||
																selectedGRN.warehouse.warehouseName
																: "-"}
														</p>
													</div>
													<div>
														<p
															className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Created By
														</p>
														<p
															className="text-sm font-semibold"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															{selectedGRN.createdBy}
														</p>
													</div>
												</div>

												<Separator />

												{/* Items table */}
												<div>
													<div className="flex items-center gap-2 mb-3">
														<p
															className="text-sm font-semibold"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															Line Items
														</p>
														<Badge
															variant="secondary"
															className="text-[10px] px-1.5 py-0"
															style={{ background: "var(--dashboard-accent-muted)", color: "var(--dashboard-accent)" }}
														>
															{selectedGRN.items.length} items
														</Badge>
													</div>
													<div className="rounded-xl border bg-card overflow-hidden">
														<Table>
															<TableHeader>
																<TableRow className="bg-muted/50">
																	<TableHead>SKU</TableHead>
																	<TableHead>Description</TableHead>
																	<TableHead>Carton</TableHead>
																	<TableHead>Loss</TableHead>
																	<TableHead>Total</TableHead>
																	<TableHead>Expiry Date</TableHead>
																	<TableHead>Lot No</TableHead>
																	<TableHead>Location</TableHead>
																</TableRow>
															</TableHeader>
															<TableBody>
																{selectedGRN.items.map((item) => (
																	<TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
																		<TableCell className="font-mono text-xs font-medium">
																			{item.skuCode}
																		</TableCell>
																		<TableCell>{item.skuDescription}</TableCell>
																		<TableCell>{item.expectedQuantity}</TableCell>
																		<TableCell>{item.lossQuantity}</TableCell>
																		<TableCell>{item.receivedQuantity}</TableCell>
																		<TableCell>
																			{item.expiryDate
																				? (formatGrnDate(item.expiryDate) ?? "—")
																				: "—"}
																		</TableCell>
																		<TableCell>{item.lotNo || "—"}</TableCell>
																		<TableCell>
																			{item.rackAllocations && item.rackAllocations.length > 0 ? (
																				<ul className="space-y-0.5">
																					{item.rackAllocations.map((alloc, i) => {
																						const label = alloc.rackLabel || (() => { const r = racks.find((r) => r.rackId === alloc.rackId); return r ? `${r.rackRow}-${r.rackLevel}-${r.rackColumn}` : alloc.rackId; })();
																						return (
																							<li key={i} className="flex items-center gap-1.5 text-xs">
																								<span className="font-mono">{label}</span>
																								<span className="text-muted-foreground">{alloc.quantity} CTN</span>
																							</li>
																						);
																					})}
																				</ul>
																			) : (
																				item.location || "Not assigned"
																			)}
																		</TableCell>
																	</TableRow>
																))}
															</TableBody>
														</Table>
													</div>
												</div>

												{/* Notes */}
												{selectedGRN.notes && (
													<div
														className="rounded-lg bg-muted/30 p-3"
														style={{ borderLeft: "3px solid var(--dashboard-accent)" }}
													>
														<p
															className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Notes
														</p>
														<p className="text-sm">{selectedGRN.notes}</p>
													</div>
												)}
											</div>
										</ScrollArea>
									</div>

									{/* Right Panel: Audit Trail + Integration Status */}
									<div className="space-y-5">
										{/* Audit Trail */}
										<div
											className="space-y-2.5 pl-3"
											style={{ borderLeft: "2px solid oklch(0.706 0.158 70.697 / 0.3)" }}
										>
											<p
												className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
												style={{ fontFamily: "var(--dashboard-body)" }}
											>
												Audit Trail
											</p>
											<div className="text-xs space-y-2">
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
											</div>
										</div>
										{(selectedGRN.status === "Sent-to-ES" ||
											selectedGRN.status === "Failed") && (
											<>
												<Separator />

												{/* Integration */}
												<IntegrationLogPanel
													entityId={selectedGRN.id}
													entityType="grn"
													poNo={selectedGRN.poNo}
													onRetry={(logId) => {
														console.log("Retry log:", logId);
													}}
												/>
											</>
										)}
									</div>
								</div>
							)}

							<DialogFooter className="flex justify-between sm:justify-between">
								<Button variant="outline" onClick={() => setIsViewOpen(false)}>
									Close
								</Button>
								<div className="flex gap-2">
									{canApproveGrn && selectedGRN?.status === "Submitted" && (
										<Button
											onClick={() => {
												handleUpdateStatus(selectedGRN.id, "Approved");
											}}
											disabled={statusMutation.status === "pending"}
											style={{ background: "var(--dashboard-accent)" }}
											className="text-white hover:opacity-90"
										>
											{statusMutation.status === "pending"
												? "Approvingâ€¦"
												: "Approve"}
										</Button>
									)}
									{canApproveGrn &&
									selectedGRN?.status === "Approved" &&
									!selectedGRN.manualInbound &&
									selectedGRN.poFulfilled !== false && (
										<Button
											onClick={() => {
												handleUpdateStatus(selectedGRN.id, "Sent-to-ES");
											}}
											disabled={statusMutation.status === "pending"}
											variant="outline"
											style={{ borderColor: "var(--dashboard-accent)", color: "var(--dashboard-accent)" }}
										>
											<Send className="mr-2 h-4 w-4" />
											{statusMutation.status === "pending"
												? "Sendingâ€¦"
												: "Send to ES"}
										</Button>
									)}
									{canApproveGrn &&
									selectedGRN?.status === "Approved" &&
									!selectedGRN.manualInbound &&
									selectedGRN.poFulfilled === false && (
										<div
											title={`PO ${selectedGRN.poNo ?? ""} still has another delivery outstanding — wait until it's fully received before sending to ES.`}
											className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700"
										>
											<Ban className="h-3.5 w-3.5" />
											Send to ES blocked — PO not fully received
										</div>
									)}
									{canApproveGrn && selectedGRN?.status === "Failed" && (
										<Button
											onClick={() => {
												handleUpdateStatus(selectedGRN.id, "Approved");
											}}
											disabled={statusMutation.status === "pending"}
										>
											<RotateCcw className={`mr-2 h-4 w-4 ${statusMutation.status === "pending" ? "animate-spin" : ""}`} />
											{statusMutation.status === "pending"
												? "Retryingâ€¦"
												: "Retry"}
										</Button>
									)}
								</div>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					{/* Edit GRN â€“ same form dialog as Create */}
					<GrnFormDialog
						mode="edit"
						open={isEditOpen}
						onOpenChange={setIsEditOpen}
						grn={selectedGRN}
						skuOptions={skuOptions}
						stockUnits={stockUnits}
						warehouses={warehouses}
						racks={racks}
						suppliers={suppliers}
						endUsers={endUsers}
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
				</main>
			</div>
		</ClientOnly>
	);
}
