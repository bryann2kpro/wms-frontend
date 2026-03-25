import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useQuery, useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Search, Loader2, Truck, PackageOpen, AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	DELIVERY_ORDER_ITEMS_QUERY,
	MARK_DELIVERY_ORDER_ITEM_PICKED_MUTATION,
	ADVANCE_DELIVERY_ORDER_STATUS_MUTATION,
	ALLOCATE_PICK_LIST_MUTATION,
	type DeliveryOrderItemsQueryVariables,
	type DeliveryOrderItemsQueryData,
	type MarkDeliveryOrderItemPickedMutationVariables,
	type MarkDeliveryOrderItemPickedMutationData,
	type AdvanceDeliveryOrderStatusMutationVariables,
	type AdvanceDeliveryOrderStatusMutationData,
	type AllocatePickListMutationVariables,
	type AllocatePickListMutationData,
} from "@/lib/graphql/delivery-orders";
import type { DeliveryOrderItemWithDetails, DoItemAllocation } from "@/lib/graphql/types";
import { formatDate } from "@/lib/utils";
import { useProfile } from "@/lib/auth/use-profile";

const PAGE_TITLE = "Empire Sushi DO Work Queue";
const PAGE_DESCRIPTION =
	"Delivery order work queue for Empire Sushi — stock movement based on DO.";

/** Only show DOs in these statuses on the work queue. */
const ACTIVE_DO_STATUSES = new Set(["CREATED", "NEW", "PICKING", "PACKING"]);

export const Route = createFileRoute("/admin/es-do")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Delivery Order"]);
	},
	component: EmpireSushiDOComponent,
});

function formatQty(qty: string | number | null | undefined): string {
	if (qty == null) return "0";
	const num = typeof qty === "number" ? qty : parseFloat(qty as string);
	if (Number.isNaN(num)) return "0";
	return Number.isInteger(num) ? String(num) : num.toFixed(2);
}


function getStatusBadgeVariant(
	status: string | null | undefined,
): "default" | "secondary" | "outline" | "destructive" {
	switch (status) {
		case "CREATED":
		case "NEW":
			return "secondary";
		case "PICKING":
			return "default";
		case "PACKING":
			return "outline";
		case "PACKED":
		case "READY_FOR_COLLECTION":
		case "COLLECTED":
			return "outline";
		case "CANCELLED":
			return "destructive";
		default:
			return "secondary";
	}
}

interface DOGroup {
	doId: string;
	doNo: string;
	doStatus: string;
	items: DeliveryOrderItemWithDetails[];
}

function AllocationGuide({ allocations }: { allocations: DoItemAllocation[] }) {
	if (!allocations || allocations.length === 0) return null;
	return (
		<div className="mt-1 space-y-0.5">
			{allocations.map((alloc) => (
				<div
					key={alloc.id}
					className="flex items-center gap-1.5 text-xs text-muted-foreground"
				>
					{alloc.priorityFlag && (
						<span
							className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
							title="Priority batch"
						/>
					)}
					<span>
						{alloc.rackName ? `Rack ${alloc.rackName} · ` : ""}
						{alloc.grnNo ?? "—"}
						{alloc.expiryDate ? ` · Exp: ${formatDate(alloc.expiryDate)}` : ""}
						{" · Qty: "}
						{formatQty(alloc.qtyAllocated)}
					</span>
				</div>
			))}
		</div>
	);
}

const TABLE_COLS = 9;

function EmpireSushiDOComponent() {
	const [searchTerm, setSearchTerm] = useState("");
	const trimmedSearchTerm = searchTerm.trim();
	// Optimistic picked state — items checked in this session before API confirms
	const [optimisticPicked, setOptimisticPicked] = useState<Set<string>>(
		new Set(),
	);
	const [processingItems, setProcessingItems] = useState<Set<string>>(
		new Set(),
	);
	const [advancingDOs, setAdvancingDOs] = useState<Set<string>>(new Set());
	const [bulkPickingDOs, setBulkPickingDOs] = useState<Set<string>>(new Set());

	const { data: profile } = useProfile();
	const canApprove =
		profile?.roles.some((r) => r.toLowerCase() === "super admin") ||
		(profile?.approvePermission ?? []).includes("Delivery Order");

	// Refs avoid stale closures in async handlers
	const optimisticPickedRef = useRef<Set<string>>(new Set());
	/** DOs that have had allocatePickList called — prevents duplicate calls. */
	const allocatedDOs = useRef<Set<string>>(new Set());
	/** DOs that have been auto-advanced to PACKING. */
	const advancedDOs = useRef<Set<string>>(new Set());

	useEffect(() => {
		document.title = `${PAGE_TITLE} | SME Ederan`;
		return () => {
			document.title = "SME Ederan";
		};
	}, []);

	const {
		data,
		loading: queryLoading,
		error: queryError,
		refetch,
	} = useQuery<DeliveryOrderItemsQueryData, DeliveryOrderItemsQueryVariables>(
		DELIVERY_ORDER_ITEMS_QUERY,
		{
			variables: {
				pageSize: 200,
				pageNumber: 1,
				filter: {
					doStatuses: Array.from(ACTIVE_DO_STATUSES),
					search: trimmedSearchTerm || undefined,
				},
			},
			fetchPolicy: "cache-and-network",
			notifyOnNetworkStatusChange: true,
		},
	);

	const [markPicked] = useMutation<
		MarkDeliveryOrderItemPickedMutationData,
		MarkDeliveryOrderItemPickedMutationVariables
	>(MARK_DELIVERY_ORDER_ITEM_PICKED_MUTATION);

	const [advanceStatus] = useMutation<
		AdvanceDeliveryOrderStatusMutationData,
		AdvanceDeliveryOrderStatusMutationVariables
	>(ADVANCE_DELIVERY_ORDER_STATUS_MUTATION);

	const [allocatePickListMutation] = useMutation<
		AllocatePickListMutationData,
		AllocatePickListMutationVariables
	>(ALLOCATE_PICK_LIST_MUTATION);

	const allItems = useMemo(
		() => data?.deliveryOrderItems?.query ?? [],
		[data],
	);

	/** Items grouped by DO (filtering is done by GraphQL query). */
	const groups = useMemo<DOGroup[]>(() => {
		const grouped = new Map<string, DOGroup>();
		for (const item of allItems) {
			const key = item.doId ?? "no-do";
			if (!grouped.has(key)) {
				grouped.set(key, {
					doId: item.doId ?? "",
					doNo: item.doNo ?? "—",
					doStatus: item.doStatus ?? "UNKNOWN",
					items: [],
				});
			}
			grouped.get(key)!.items.push(item);
		}
		return Array.from(grouped.values());
	}, [allItems]);

	const isItemPicked = useCallback(
		(item: DeliveryOrderItemWithDetails): boolean =>
			Number(item.qtyPicked ?? 0) > 0 || optimisticPicked.has(item.id),
		[optimisticPicked],
	);

	const handleCheckItem = useCallback(
		async (item: DeliveryOrderItemWithDetails) => {
			if (!item.doId) return;
			const { id: itemId, doId, qtyRequired } = item;
			if (processingItems.has(itemId)) return;

			// Optimistic UI
			optimisticPickedRef.current.add(itemId);
			setOptimisticPicked(new Set(optimisticPickedRef.current));
			setProcessingItems((prev) => new Set(prev).add(itemId));

			try {
				const doItems = allItems.filter((i) => i.doId === doId);

				// On the first pick in a DO, allocate the pick list (guidance for warehouse keeper)
				const anyAlreadyPicked = doItems.some(
					(i) =>
						i.id !== itemId &&
						(Number(i.qtyPicked ?? 0) > 0 ||
							optimisticPickedRef.current.has(i.id)),
				);

				// Check now (before any awaits) whether this is the last item to pick
				const allDOItemsPicked = doItems.every(
					(i) =>
						Number(i.qtyPicked ?? 0) > 0 || optimisticPickedRef.current.has(i.id),
				);

				const isFirstPick = !anyAlreadyPicked && !allocatedDOs.current.has(doId);
				if (isFirstPick) {
					allocatedDOs.current.add(doId);
					if (allDOItemsPicked) {
						// Single-item DO: must await so DO is in PICKING before we advance to PACKING
						try {
							await allocatePickListMutation({ variables: { deliveryOrderId: doId } });
						} catch {
							/* non-fatal — allocation guidance only */
						}
					} else {
						// Multi-item DO: fire-and-forget is safe, last pick is not this one
						allocatePickListMutation({ variables: { deliveryOrderId: doId } })
							.then(() => refetch())
							.catch(() => {
								/* non-fatal — allocation guidance only */
							});
					}
				}

				// Mark this item as picked (qty = qty required)
				await markPicked({ variables: { id: itemId, qtyPicked: qtyRequired } });

				// Auto-advance DO to PACKING when all items are picked
				if (allDOItemsPicked && !advancedDOs.current.has(doId)) {
					advancedDOs.current.add(doId);
					await advanceStatus({ variables: { id: doId } });
					await refetch();
				}
			} catch {
				// Rollback optimistic state on error
				optimisticPickedRef.current.delete(itemId);
				setOptimisticPicked(new Set(optimisticPickedRef.current));
			} finally {
				setProcessingItems((prev) => {
					const next = new Set(prev);
					next.delete(itemId);
					return next;
				});
			}
		},
		[
			allItems,
			processingItems,
			markPicked,
			advanceStatus,
			allocatePickListMutation,
			refetch,
		],
	);

	const handleBulkPickAll = useCallback(
		async (group: DOGroup) => {
			const { doId } = group;
			if (bulkPickingDOs.has(doId)) return;
			setBulkPickingDOs((prev) => new Set(prev).add(doId));

			const unpickedItems = group.items.filter((i) => !isItemPicked(i));

			// Optimistic: mark all unpicked items immediately
			for (const item of unpickedItems) {
				optimisticPickedRef.current.add(item.id);
			}
			setOptimisticPicked(new Set(optimisticPickedRef.current));

			try {
				// 1. allocatePickList first (await) — ensures DO is in PICKING before advancing
				if (!allocatedDOs.current.has(doId)) {
					allocatedDOs.current.add(doId);
					try {
						await allocatePickListMutation({
							variables: { deliveryOrderId: doId },
						});
					} catch {
						/* non-fatal — allocation guidance only */
					}
				}

				// 2. Mark all unpicked items as picked in parallel
				if (unpickedItems.length > 0) {
					await Promise.all(
						unpickedItems.map((item) =>
							markPicked({
								variables: { id: item.id, qtyPicked: item.qtyRequired },
							}),
						),
					);
				}

				// 3. Advance DO to PACKING (PICKING → PACKING)
				if (!advancedDOs.current.has(doId)) {
					advancedDOs.current.add(doId);
					await advanceStatus({ variables: { id: doId } });
				}

				await refetch();
			} catch {
				// Rollback optimistic state on error
				for (const item of unpickedItems) {
					optimisticPickedRef.current.delete(item.id);
				}
				setOptimisticPicked(new Set(optimisticPickedRef.current));
			} finally {
				setBulkPickingDOs((prev) => {
					const next = new Set(prev);
					next.delete(doId);
					return next;
				});
			}
		},
		[
			bulkPickingDOs,
			isItemPicked,
			allocatePickListMutation,
			markPicked,
			advanceStatus,
			refetch,
		],
	);

	const handleAdvanceToShipped = useCallback(
		async (doId: string) => {
			if (advancingDOs.has(doId)) return;
			setAdvancingDOs((prev) => new Set(prev).add(doId));
			try {
				await advanceStatus({ variables: { id: doId } });
				await refetch();
			} finally {
				setAdvancingDOs((prev) => {
					const next = new Set(prev);
					next.delete(doId);
					return next;
				});
			}
		},
		[advancingDOs, advanceStatus, refetch],
	);

	return (
		<div className="es-do-page min-h-screen bg-[var(--dashboard-surface)]">
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				id="main-content"
				className="container relative mx-auto p-6 space-y-6"
				aria-labelledby="es-do-page-title"
				aria-describedby="es-do-page-description"
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
							? "No active delivery orders found."
							: `Showing ${groups.length} delivery order${groups.length === 1 ? "" : "s"}.`}
				</div>

				<AdminPageHeader
					icon={Truck}
					title={PAGE_TITLE}
					description={PAGE_DESCRIPTION}
					titleId="es-do-page-title"
					descriptionId="es-do-page-description"
					rightSlot={
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
								aria-hidden
							/>
							<Input
								aria-label="Search items by SKU, description, DO or PO number"
								placeholder="Search items..."
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
						<span>Failed to load items: {queryError.message}</span>
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
					aria-label="Delivery order items work queue"
					aria-busy={queryLoading}
				>
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table aria-label="Empire Sushi DO work queue — items grouped by delivery order">
							<TableHeader>
								<TableRow>
									<TableHead className="w-10">#</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>PO</TableHead>
									<TableHead className="text-center">Qty Required</TableHead>
									<TableHead className="text-center">Qty Picked</TableHead>
									<TableHead className="text-center">On Hand</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-center">Picked</TableHead>
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
													No active delivery orders
												</p>
												<p className="text-sm text-muted-foreground">
													Items from DOs with status NEW or PICKING will appear
													here.
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									groups.flatMap((group) => {
										const pickedCount =
											group.items.filter(isItemPicked).length;
										const totalCount = group.items.length;
										const allPicked = pickedCount === totalCount;

										return [
											// DO group header row
											<TableRow
												key={`group-${group.doId}`}
												className="bg-muted/50 hover:bg-muted/60 border-l-4 border-l-primary/40"
											>
												<TableCell colSpan={TABLE_COLS} className="px-4 py-2.5">
													<div className="flex items-center gap-3">
														<span className="font-semibold text-sm">
															{group.doNo}
														</span>
														<Badge
															variant={getStatusBadgeVariant(group.doStatus)}
															className="text-xs"
														>
															{group.doStatus}
														</Badge>
														<span
															className={`text-xs font-medium ${allPicked ? "text-green-600" : "text-muted-foreground"}`}
														>
															{pickedCount}/{totalCount} picked
														</span>
														{allPicked && group.doStatus !== "PACKING" && (
															<span className="text-xs text-green-600 font-medium">
																· Advancing to Packing…
															</span>
														)}
														{(group.doStatus === "NEW" ||
															group.doStatus === "CREATED") && (
															<Button
																size="sm"
																variant="secondary"
																onClick={() => handleBulkPickAll(group)}
																disabled={bulkPickingDOs.has(group.doId) || !canApprove}
																className="ml-auto text-xs h-7"
															>
																{bulkPickingDOs.has(group.doId) ? (
																	<Loader2 className="h-3 w-3 animate-spin mr-1" aria-hidden />
																) : null}
																Mark all as Picked
															</Button>
														)}
														{group.doStatus === "PACKING" && (
															<Button
																size="sm"
																variant="default"
																onClick={() => handleAdvanceToShipped(group.doId)}
																disabled={advancingDOs.has(group.doId) || !canApprove}
																className="ml-auto text-xs h-7"
															>
																{advancingDOs.has(group.doId) ? (
																	<Loader2 className="h-3 w-3 animate-spin mr-1" aria-hidden />
																) : null}
																Mark as Shipped
															</Button>
														)}
													</div>
												</TableCell>
											</TableRow>,

											// Item rows
											...group.items.map((item, idx) => {
												const picked = isItemPicked(item);
												const isProcessing = processingItems.has(item.id);

												return (
													<TableRow
														key={item.id}
														className={
															picked
																? "bg-green-50/50 dark:bg-green-950/10"
																: ""
														}
													>
														<TableCell className="font-medium text-muted-foreground text-xs">
															{idx + 1}
														</TableCell>
														<TableCell className="font-mono text-sm">
															{item.skuCode ?? "—"}
														</TableCell>
														<TableCell className="max-w-[220px]">
															<div className="truncate text-sm">
																{item.skuDescription ?? "—"}
															</div>
															<AllocationGuide
																allocations={item.allocations}
															/>
														</TableCell>
														<TableCell className="font-mono text-xs text-muted-foreground">
															{item.purchaseOrderNo}
														</TableCell>
														<TableCell className="text-center">
															{formatQty(item.qtyRequired)}
														</TableCell>
														<TableCell className="text-center">
															{formatQty(item.qtyPicked)}
														</TableCell>
														<TableCell className="text-center text-sm text-muted-foreground">
															{formatQty(item.onHandQty)}
														</TableCell>
														<TableCell>
															<Badge
																variant={getStatusBadgeVariant(item.doStatus)}
																className="text-xs"
															>
																{item.doStatus ?? "—"}
															</Badge>
														</TableCell>
														<TableCell className="text-center">
															{isProcessing ? (
																<Loader2
																	className="h-4 w-4 animate-spin mx-auto text-muted-foreground"
																	aria-hidden
																/>
															) : (
																<Checkbox
																	checked={picked}
																	disabled={picked || !item.doId || !canApprove}
																	onCheckedChange={() => handleCheckItem(item)}
																	aria-label={`Mark ${item.skuCode ?? "item"} as picked`}
																/>
															)}
														</TableCell>
													</TableRow>
												);
											}),
										];
									})
								)}
							</TableBody>
						</Table>
					</div>
				</section>
			</main>
		</div>
	);
}
