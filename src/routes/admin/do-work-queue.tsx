import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Loader2, PackageOpen, Search, Truck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { useProfile } from "@/lib/auth/use-profile";
import {
	GRNS_WORK_QUEUE_QUERY,
	type GrnsWorkQueueQueryData,
	UPDATE_GRN_MUTATION,
	type UpdateGrnMutationData,
	type UpdateGrnMutationVariables,
} from "@/lib/graphql/grns";
import { requirePermission } from "@/lib/rbac";
import { formatDateOnly } from "@/lib/utils";

const PAGE_TITLE = "GRN Inbound Work Queue";
const PAGE_DESCRIPTION =
	"Storekeeper queue for inbound GRN stock movement into rack locations.";

export const Route = createFileRoute("/admin/do-work-queue")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Supplier Delivery"]);
	},
	component: DOWorkQueueComponent,
	head: () => ({
		meta: [
			{
				title: "DO Work Queue - SME Edaran WMS",
				description:
					"Handle inbound GRN movement tasks and rack allocation workflow in the storekeeper queue.",
			},
		],
	}),
});

function formatQty(qty: string | null): string {
	if (!qty) return "0";
	const num = parseFloat(qty);
	return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function getGrnStatusBadgeVariant(
	status: string,
): "default" | "secondary" | "outline" | "destructive" {
	switch (status) {
		case "Approved":
		case "APPROVED":
			return "default";
		case "Submitted":
		case "SUBMITTED":
			return "outline";
		case "Failed":
		case "FAILED":
			return "destructive";
		default:
			return "secondary";
	}
}

function formatRackLocation(
	rack: {
		rackRow: string;
		rackColumn: string;
		rackLevel: string | number;
	} | null,
): string {
	if (!rack) return "-";
	return `${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`;
}

type GRNGroupItem =
	GrnsWorkQueueQueryData["grns"]["query"][number]["items"][number];

interface GRNGroup {
	grnId: string;
	grnNo: string;
	grnStatus: string;
	receivedAt: string | null;
	manualInbound: boolean;
	items: GRNGroupItem[];
}

const TABLE_COLS = 8;

function DOWorkQueueComponent() {
	const [searchTerm, setSearchTerm] = useState("");
	const trimmedSearchTerm = searchTerm.trim();
	const [advancingGRNs, setAdvancingGRNs] = useState<Set<string>>(new Set());

	const { data: profile } = useProfile();
	const canApprove =
		profile?.roles.some((r) => r.toLowerCase() === "super admin") ||
		(profile?.approvePermission ?? []).includes("Supplier Delivery");

	const queryClient = useQueryClient();
	const queryVars = {
		filter: {
			excludeDraft: true,
			search: trimmedSearchTerm || null,
		},
		pageSize: 200,
		pageNumber: 1,
	};
	const {
		data,
		isLoading: queryLoading,
		error: queryError,
		refetch,
	} = useQuery({
		queryKey: qk.grns.list(queryVars),
		queryFn: () =>
			gqlRequest<GrnsWorkQueueQueryData>(GRNS_WORK_QUEUE_QUERY, queryVars),
	});

	const { mutateAsync: updateGrn } = useMutation({
		mutationFn: (vars: UpdateGrnMutationVariables) =>
			gqlRequest<UpdateGrnMutationData, UpdateGrnMutationVariables>(
				UPDATE_GRN_MUTATION,
				vars,
			),
	});

	const groups = useMemo<GRNGroup[]>(() => {
		const grns = data?.grns?.query ?? [];
		return grns.map((grn) => ({
			grnId: grn.id,
			grnNo: grn.grnNo,
			grnStatus: grn.status,
			receivedAt: grn.receivedAt ?? null,
			manualInbound: grn.manualInbound ?? false,
			items: grn.items ?? [],
		}));
	}, [data]);

	const handleAdvanceStatus = useCallback(
		async (grnId: string, targetStatus: string) => {
			if (advancingGRNs.has(grnId)) return;
			setAdvancingGRNs((prev) => new Set(prev).add(grnId));
			try {
				await updateGrn({ id: grnId, input: { status: targetStatus } });
				await queryClient.invalidateQueries({ queryKey: qk.grns.all });
			} finally {
				setAdvancingGRNs((prev) => {
					const next = new Set(prev);
					next.delete(grnId);
					return next;
				});
			}
		},
		[advancingGRNs, updateGrn, queryClient],
	);

	return (
		<div className="do-work-queue-page min-h-screen bg-[var(--dashboard-surface)]">
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				id="main-content"
				className="container relative mx-auto p-6 space-y-6"
				aria-labelledby="do-work-queue-page-title"
				aria-describedby="do-work-queue-page-description"
			>
				<div
					aria-live="polite"
					aria-atomic="true"
					className="sr-only"
					role="status"
				>
					{queryLoading
						? "Loading items…"
						: groups.length === 0
							? "No inbound GRNs found."
							: `Showing ${groups.length} GRN${groups.length === 1 ? "" : "s"}.`}
				</div>

				<AdminPageHeader
					icon={Truck}
					title={PAGE_TITLE}
					description={PAGE_DESCRIPTION}
					titleId="do-work-queue-page-title"
					descriptionId="do-work-queue-page-description"
					rightSlot={
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
								aria-hidden
							/>
							<Input
								aria-label="Search inbound GRNs by GRN number, PO number, or supplier delivery"
								placeholder="Search inbound GRNs..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9 sm:w-64 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							/>
						</div>
					}
				/>

				{queryLoading && (
					<div
						className="flex items-center gap-2 text-muted-foreground text-sm"
						role="status"
						aria-live="polite"
					>
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						<span>Loading items…</span>
					</div>
				)}

				{queryError && (
					<div
						className="flex items-center gap-2 text-destructive text-sm rounded-lg border border-destructive/20 bg-destructive/5 p-4"
						role="alert"
					>
						<AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
						<span>Failed to load items: {(queryError as Error).message}</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
							className="ml-auto"
						>
							Retry
						</Button>
					</div>
				)}

				<section
					className="relative"
					aria-label="Inbound GRN work queue table"
					aria-busy={queryLoading}
				>
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table aria-label="Inbound GRN items grouped by GRN for stock movement">
							<TableHeader>
								<TableRow>
									<TableHead className="w-10">#</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="text-center">Qty Received</TableHead>
									<TableHead className="text-center">Loss Qty</TableHead>
									<TableHead>Rack/Location</TableHead>
									<TableHead>Expiry Date</TableHead>
									<TableHead>Lot No.</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{!queryLoading && groups.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={TABLE_COLS}
											className="py-16 text-center"
										>
											<div className="flex flex-col items-center gap-3">
												<div className="rounded-full bg-muted p-3">
													<PackageOpen
														className="h-8 w-8 text-muted-foreground"
														aria-hidden
													/>
												</div>
												<p className="font-medium text-foreground">
													No inbound GRNs in queue
												</p>
												<p className="text-sm text-muted-foreground">
													Non-draft GRNs (Submitted, Approved) will appear here
													for processing.
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									groups.flatMap((group) => [
										<TableRow
											key={`group-${group.grnId}`}
											className="bg-muted/50 hover:bg-muted/60 border-l-4 border-l-primary/40"
										>
											<TableCell colSpan={TABLE_COLS} className="px-4 py-2.5">
												<div className="flex items-center gap-3">
													<span className="font-semibold text-sm">
														{group.grnNo}
													</span>
													<Badge
														variant={getGrnStatusBadgeVariant(group.grnStatus)}
														className="text-xs"
													>
														{group.grnStatus}
													</Badge>
													<span className="text-xs text-muted-foreground">
														{group.items.length} item
														{group.items.length === 1 ? "" : "s"}
													</span>
													{group.receivedAt && (
														<span className="text-xs text-muted-foreground">
															· Received: {formatDateOnly(group.receivedAt)}
														</span>
													)}
													{group.grnStatus === "Submitted" && canApprove && (
														<Button
															size="sm"
															variant="secondary"
															onClick={() =>
																handleAdvanceStatus(group.grnId, "Approved")
															}
															disabled={advancingGRNs.has(group.grnId)}
															className="ml-auto text-xs h-7"
														>
															{advancingGRNs.has(group.grnId) ? (
																<Loader2
																	className="h-3 w-3 animate-spin mr-1"
																	aria-hidden
																/>
															) : null}
															Approve
														</Button>
													)}
													{group.grnStatus === "Approved" &&
														canApprove &&
														!group.manualInbound && (
														<Button
															size="sm"
															variant="default"
															onClick={() =>
																handleAdvanceStatus(group.grnId, "SentToES")
															}
															disabled={advancingGRNs.has(group.grnId)}
															className="ml-auto text-xs h-7"
														>
															{advancingGRNs.has(group.grnId) ? (
																<Loader2
																	className="h-3 w-3 animate-spin mr-1"
																	aria-hidden
																/>
															) : null}
															Send to ES
														</Button>
													)}
												</div>
											</TableCell>
										</TableRow>,

										...group.items.map((item, idx) => (
											<TableRow key={item.id}>
												<TableCell className="font-medium text-muted-foreground text-xs">
													{idx + 1}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{item.skuCode ?? "—"}
												</TableCell>
												<TableCell className="max-w-[240px]">
													<div className="truncate text-sm">
														{item.skuDescription ?? "—"}
													</div>
												</TableCell>
												<TableCell className="text-center">
													{formatQty(item.qty)}
												</TableCell>
												<TableCell className="text-center">
													{formatQty(item.lossQty ?? null)}
												</TableCell>
												<TableCell>{formatRackLocation(item.rack)}</TableCell>
												<TableCell>
													{item.expiryDate
														? formatDateOnly(item.expiryDate)
														: "—"}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{item.lotNo ?? "—"}
												</TableCell>
											</TableRow>
										)),
									])
								)}
							</TableBody>
						</Table>
					</div>
				</section>
			</main>
		</div>
	);
}
