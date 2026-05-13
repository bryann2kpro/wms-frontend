import {
	AlertCircle,
	ChevronRight,
	Download,
	Loader2,
	Pencil,
	Plus,
	Trash2,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { OutletCombobox } from "@/components/outbound/outlet-combobox";
import { SkuCombobox, type SkuLineValue } from "@/components/grn/sku-combobox";
import type { PurchaseOrderDetail, UpdatePurchaseOrderInput } from "@/data/purchase-orders.types";
import {
	formatDeliveryOrderStepStatus,
	formatStatus,
	getDeliveryOrderStepStatusColor,
	getNetSuiteStatusColor,
	getStatusColor,
} from "@/lib/outbound";
import { formatDateOnly } from "@/lib/utils";
import {
	OUTLETS_QUERY,
	type OutletsQueryData,
	type OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import type { Outlet } from "@/lib/graphql/types";

interface ViewPurchaseOrderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	purchaseOrder: PurchaseOrderDetail | null;
	onAdvanceStep?: () => void;
	isAdvanceStepPending?: boolean;
	onEmergencyDelivery?: () => void;
	isEmergencyDeliveryPending?: boolean;
	onDownloadDoPdf?: () => void;
	isDownloadDoPdfPending?: boolean;
	onEdit?: (id: string, input: UpdatePurchaseOrderInput) => void;
	isEditPending?: boolean;
}

export function ViewPurchaseOrderDialog({
	open,
	onOpenChange,
	purchaseOrder,
	onAdvanceStep,
	isAdvanceStepPending,
	onEmergencyDelivery,
	isEmergencyDeliveryPending,
	onDownloadDoPdf,
	isDownloadDoPdfPending,
	onEdit,
	isEditPending,
}: ViewPurchaseOrderDialogProps) {
	const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editDeliveryDate, setEditDeliveryDate] = useState("");
	const [editOutletId, setEditOutletId] = useState("");
	const [editOutlet, setEditOutlet] = useState<Outlet | null>(null);
	const [editItemQtys, setEditItemQtys] = useState<Record<string, number>>({});

	type NewItemRow = { key: number; skuId: string; skuCode: string; description: string; qtyRequired: number };
	const [editNewItems, setEditNewItems] = useState<NewItemRow[]>([]);
	const [editRemovedItemIds, setEditRemovedItemIds] = useState<Set<string>>(new Set());

	const { data: outletsData, refetch: refetchOutlets } = useQuery({
		queryKey: [...qk.outlets.all, { pageSize: 500, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<OutletsQueryData, OutletsQueryVariables>(OUTLETS_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
		enabled: isEditMode,
	});

	const outlets = outletsData?.outlets?.query ?? [];

	// Reset edit state whenever the dialog opens with a new PO
	useEffect(() => {
		if (!open || !purchaseOrder) {
			setIsEditMode(false);
			return;
		}
		setEditDeliveryDate(
			purchaseOrder.expectedDeliveryDate.toISOString().split("T")[0],
		);
		setEditOutletId(purchaseOrder.outletId ?? "");
		setEditOutlet(null);
		setEditItemQtys(
			Object.fromEntries(purchaseOrder.items.map((i) => [i.id, i.quantity])),
		);
		setEditNewItems([]);
		setEditRemovedItemIds(new Set());
	}, [open, purchaseOrder]);

	// Sync editOutlet whenever outlet list loads or editOutletId changes
	useEffect(() => {
		if (!outlets.length || !editOutletId) return;
		const found = outlets.find((o) => o.outletId === editOutletId) ?? null;
		setEditOutlet(found);
	}, [outlets, editOutletId]);

	const handleOutletChange = (outletId: string) => {
		setEditOutletId(outletId);
		const found = outlets.find((o) => o.outletId === outletId) ?? null;
		setEditOutlet(found);
	};

	const handleSave = () => {
		if (!purchaseOrder) return;
		const input: UpdatePurchaseOrderInput = {};
		const originalDate = purchaseOrder.expectedDeliveryDate
			.toISOString()
			.split("T")[0];
		if (editDeliveryDate !== originalDate)
			input.scheduledDeliveryDate = new Date(editDeliveryDate).toISOString();
		if (editOutletId && editOutletId !== (purchaseOrder.outletId ?? ""))
			input.outletId = editOutletId;
		const changedItems = purchaseOrder.items
			.filter((item) => !editRemovedItemIds.has(item.id) && editItemQtys[item.id] !== item.quantity)
			.map((item) => ({ id: item.id, qtyRequired: editItemQtys[item.id] ?? item.quantity }));
		if (changedItems.length > 0) input.items = changedItems;
		const newItems = editNewItems
			.filter((i) => i.skuId && i.qtyRequired > 0)
			.map(({ skuId, skuCode, qtyRequired }) => ({ skuId, skuCode, qtyRequired }));
		if (newItems.length > 0) input.newItems = newItems;
		const removedItemIds = [...editRemovedItemIds];
		if (removedItemIds.length > 0) input.removedItemIds = removedItemIds;
		onEdit?.(purchaseOrder.id, input);
	};

	const handleCancelEdit = () => {
		if (!purchaseOrder) return;
		setEditDeliveryDate(
			purchaseOrder.expectedDeliveryDate.toISOString().split("T")[0],
		);
		setEditOutletId(purchaseOrder.outletId ?? "");
		setEditOutlet(null);
		setEditItemQtys(
			Object.fromEntries(purchaseOrder.items.map((i) => [i.id, i.quantity])),
		);
		setEditNewItems([]);
		setEditRemovedItemIds(new Set());
		setIsEditMode(false);
	};

	const canApplyEmergency =
		onEmergencyDelivery &&
		purchaseOrder &&
		purchaseOrder.status !== "cancel" &&
		purchaseOrder.status !== "return";

	const canEdit =
		onEdit &&
		purchaseOrder &&
		purchaseOrder.status !== "cancel" &&
		purchaseOrder.status !== "return";

	// Item qty / add / remove are blocked once DO picking has started
	const canEditItems =
		!purchaseOrder?.deliveryOrder ||
		purchaseOrder.deliveryOrder.status === "NEW" ||
		purchaseOrder.deliveryOrder.status === "CREATED";

	// SKU codes already on the PO (to show "Added" badge in SkuCombobox for new-item rows)
	const existingSkuCodes = purchaseOrder?.items
		.filter((i) => !editRemovedItemIds.has(i.id))
		.map((i) => i.sku) ?? [];

	// For region display in edit mode: prefer the selected outlet's data
	const displayRegionName = isEditMode && editOutlet
		? editOutlet.regionName
		: purchaseOrder?.regionName;
	const displayRegionCode = isEditMode && editOutlet
		? editOutlet.regionCode
		: purchaseOrder?.regionCode;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto"
				style={{ maxWidth: "min(95vw, 1400px)" }}
			>
				<DialogHeader>
					<DialogTitle>Purchase Order Details</DialogTitle>
					<DialogDescription>
						{isEditMode
							? "Edit purchase order information. Status, DO status, and creator cannot be changed."
							: "View and manage purchase order information"}
					</DialogDescription>
				</DialogHeader>
				{purchaseOrder && (
					<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
						<div className="space-y-6">
							<div className="grid gap-4 sm:grid-cols-3">
								<div>
									<Label className="text-xs text-muted-foreground">
										PO Number
									</Label>
									<p className="text-sm font-medium">
										{purchaseOrder.purchaseOrderNumber}
									</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Outlet
									</Label>
									{isEditMode ? (
										<OutletCombobox
											value={editOutletId}
											onChange={handleOutletChange}
											outlets={outlets.map((o) => ({
												outletId: o.outletId,
												outletName: o.outletName,
												outletCode: o.outletCode,
											}))}
											onOutletCreated={() => { refetchOutlets(); }}
											placeholder="Select outlet…"
										/>
									) : (
										<p className="text-sm font-medium">
											{purchaseOrder.toLocation}
										</p>
									)}
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Region
									</Label>
									<p className="text-sm font-medium">
										{displayRegionName
											? `${displayRegionName}${displayRegionCode ? ` (${displayRegionCode})` : ""}`
											: "—"}
									</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Scheduled Delivery
									</Label>
									{isEditMode ? (
										<Input
											type="date"
											value={editDeliveryDate}
											onChange={(e) => setEditDeliveryDate(e.target.value)}
											className="mt-1 h-8 text-sm"
										/>
									) : (
										<p className="text-sm font-medium">
											{formatDateOnly(
												purchaseOrder.expectedDeliveryDate.toISOString(),
											)}
										</p>
									)}
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Created Date
									</Label>
									<p className="text-sm font-medium">
										{formatDateOnly(purchaseOrder.createdDate.toISOString())}
									</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										PO Status
									</Label>
									<Badge
										variant="outline"
										className={getStatusColor(purchaseOrder.status)}
									>
										{formatStatus(purchaseOrder.status)}
									</Badge>
								</div>
								{purchaseOrder.deliveryOrder && (
									<div>
										<Label className="text-xs text-muted-foreground">
											DO Status
										</Label>
										<div className="flex items-center gap-2">
											<Badge
												variant="outline"
												className={getDeliveryOrderStepStatusColor(
													purchaseOrder.deliveryOrder.status,
												)}
											>
												{formatDeliveryOrderStepStatus(
													purchaseOrder.deliveryOrder.status,
												)}
											</Badge>
											{purchaseOrder.deliveryOrder.status === "NEW" ||
											purchaseOrder.deliveryOrder.status === "CREATED" ||
											purchaseOrder.deliveryOrder.status === "PICKING" ? (
												<span className="text-xs text-muted-foreground italic">
													Awaiting picking
												</span>
											) : onAdvanceStep &&
												purchaseOrder.deliveryOrder.status === "PACKING" ? (
												<Button
													variant="outline"
													size="sm"
													onClick={onAdvanceStep}
													disabled={isAdvanceStepPending}
													aria-label="Mark delivery order to next step"
												>
													{isAdvanceStepPending ? "Updating…" : "Next step"}
													<ChevronRight className="ml-1 h-4 w-4" />
												</Button>
											) : null}
										</div>
									</div>
								)}
								<div>
									<Label className="text-xs text-muted-foreground">
										NetSuite Status (API)
									</Label>
									<div className="flex items-center gap-2">
										<Badge
											variant="outline"
											className={getNetSuiteStatusColor(
												purchaseOrder.netsuiteStatus,
											)}
										>
											{purchaseOrder.netsuiteStatus || "N/A"}
										</Badge>
										{purchaseOrder.netsuiteStatus === "error" && (
											<AlertCircle className="h-4 w-4 text-red-600" />
										)}
									</div>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Created By
									</Label>
									<p className="text-sm font-medium">
										{purchaseOrder.createdBy}
									</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Total Items
									</Label>
									<p className="text-sm font-medium">
										{purchaseOrder.totalItems}
									</p>
								</div>
							</div>

							<div>
								<Label className="mb-2 block text-sm font-medium">Items</Label>
								<div className="rounded-lg border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>SKU</TableHead>
												<TableHead>Description</TableHead>
												<TableHead>Qty</TableHead>
												{!isEditMode && (
													<>
														<TableHead>Available Qty</TableHead>
														<TableHead>Status</TableHead>
													</>
												)}
												{isEditMode && canEditItems && <TableHead />}
											</TableRow>
										</TableHeader>
										<TableBody>
											{purchaseOrder.items
												.filter((item) => !editRemovedItemIds.has(item.id))
												.map((item) => {
												const availableQty =
													item.quantity + Math.floor(Math.random() * 10);
												const canFulfill = availableQty >= item.quantity;
												const visibleCount =
													purchaseOrder.items.filter((i) => !editRemovedItemIds.has(i.id)).length +
													editNewItems.length;

												return (
													<TableRow key={item.id}>
														<TableCell className="font-medium">
															{item.sku}
														</TableCell>
														<TableCell>{item.description}</TableCell>
														<TableCell>
															{isEditMode && canEditItems ? (
																<Input
																	type="number"
																	min={1}
																	value={editItemQtys[item.id] ?? item.quantity}
																	onChange={(e) =>
																		setEditItemQtys((prev) => ({
																			...prev,
																			[item.id]: Number(e.target.value),
																		}))
																	}
																	className="h-7 w-20 text-sm"
																/>
															) : (
																editItemQtys[item.id] ?? item.quantity
															)}
														</TableCell>
														{!isEditMode && (
															<>
																<TableCell>
																	<span
																		className={
																			canFulfill
																				? "text-green-600"
																				: "text-red-600"
																		}
																	>
																		{availableQty}
																	</span>
																</TableCell>
																<TableCell>
																	{canFulfill ? (
																		<Badge
																			variant="outline"
																			className="bg-green-500/10 text-green-600 border-green-500/20"
																		>
																			Available
																		</Badge>
																	) : (
																		<Badge
																			variant="outline"
																			className="bg-red-500/10 text-red-600 border-red-500/20"
																		>
																			Insufficient
																		</Badge>
																	)}
																</TableCell>
															</>
														)}
														{isEditMode && canEditItems && (
															<TableCell className="w-10">
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7"
																	disabled={visibleCount <= 1}
																	title="Remove item"
																	onClick={() =>
																		setEditRemovedItemIds(
																			(prev) => new Set([...prev, item.id]),
																		)
																	}
																>
																	<Trash2 className="h-4 w-4 text-destructive" />
																</Button>
															</TableCell>
														)}
													</TableRow>
												);
											})}
											{isEditMode && editNewItems.map((newItem, idx) => (
												<TableRow key={newItem.key}>
													<TableCell colSpan={2} className="py-2">
														<SkuCombobox
															value={
																newItem.skuId
																	? {
																			skuId: newItem.skuId,
																			skuCode: newItem.skuCode,
																			description: newItem.description,
																			sku: newItem.skuCode,
																			uom: "",
																			isActive: true,
																		}
																	: null
															}
															onChange={(v: SkuLineValue) =>
																setEditNewItems((prev) =>
																	prev.map((r, i) =>
																		i === idx
																			? { ...r, skuId: v.skuId, skuCode: v.skuCode, description: v.description }
																			: r,
																	),
																)
															}
															excludedSkuCodes={[
																...existingSkuCodes,
																...editNewItems
																	.filter((_, i) => i !== idx)
																	.map((r) => r.skuCode)
																	.filter(Boolean),
															]}
														/>
													</TableCell>
													<TableCell className="py-2">
														<Input
															type="number"
															min={1}
															value={newItem.qtyRequired}
															onChange={(e) =>
																setEditNewItems((prev) =>
																	prev.map((r, i) =>
																		i === idx
																			? { ...r, qtyRequired: Number(e.target.value) || 1 }
																			: r,
																	),
																)
															}
															className="h-7 w-20 text-sm"
														/>
													</TableCell>
													<TableCell className="w-10 py-2">
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-7 w-7"
															onClick={() =>
																setEditNewItems((prev) =>
																	prev.filter((_, i) => i !== idx),
																)
															}
														>
															<Trash2 className="h-4 w-4 text-destructive" />
														</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
								{isEditMode && canEditItems && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="mt-2"
										onClick={() =>
											setEditNewItems((prev) => [
												...prev,
												{ key: Date.now(), skuId: "", skuCode: "", description: "", qtyRequired: 1 },
											])
										}
									>
										<Plus className="mr-2 h-4 w-4" />
										Add line
									</Button>
								)}
							</div>

							{purchaseOrder.notes && (
								<div>
									<Label className="text-xs text-muted-foreground">Notes</Label>
									<p className="text-sm">{purchaseOrder.notes}</p>
								</div>
							)}

							{showEmergencyConfirm && (
								<div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
									<p className="text-sm font-medium text-amber-900">
										Apply Emergency Delivery?
									</p>
									<p className="mt-1 text-xs text-amber-700">
										This will move the scheduled delivery date to the next
										available slot, bypassing normal cutoff rules. This action
										cannot be undone.
									</p>
									<div className="mt-3 flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setShowEmergencyConfirm(false)}
											disabled={isEmergencyDeliveryPending}
										>
											Cancel
										</Button>
										<Button
											size="sm"
											className="bg-amber-600 hover:bg-amber-700 text-white"
											disabled={isEmergencyDeliveryPending}
											onClick={() => {
												onEmergencyDelivery?.();
												setShowEmergencyConfirm(false);
											}}
										>
											{isEmergencyDeliveryPending ? "Applying…" : "Confirm"}
										</Button>
									</div>
								</div>
							)}

							<DialogFooter>
								{purchaseOrder.deliveryOrder && onDownloadDoPdf ? (
									<Button
										type="button"
										variant="outline"
										className="mr-auto gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										onClick={() => onDownloadDoPdf()}
										disabled={isDownloadDoPdfPending}
										aria-busy={isDownloadDoPdfPending}
									>
										{isDownloadDoPdfPending ? (
											<Loader2
												className="h-4 w-4 animate-spin shrink-0"
												aria-hidden
											/>
										) : (
											<Download className="h-4 w-4 shrink-0" aria-hidden />
										)}
										{isDownloadDoPdfPending
											? "Preparing PDF…"
											: "Download DO PDF"}
									</Button>
								) : null}

								{isEditMode ? (
									<>
										<Button
											variant="outline"
											onClick={handleCancelEdit}
											disabled={isEditPending}
										>
											Cancel
										</Button>
										<Button
											onClick={handleSave}
											disabled={isEditPending}
										>
											{isEditPending ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Saving…
												</>
											) : (
												"Save"
											)}
										</Button>
									</>
								) : (
									<>
										<Button variant="outline" onClick={() => onOpenChange(false)}>
											Close
										</Button>
										{canEdit && !showEmergencyConfirm && (
											<Button
												variant="outline"
												onClick={() => setIsEditMode(true)}
											>
												<Pencil className="mr-2 h-4 w-4" />
												Edit
											</Button>
										)}
										{canApplyEmergency && !showEmergencyConfirm && (
											<Button
												variant="outline"
												className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
												onClick={() => setShowEmergencyConfirm(true)}
												disabled={isEmergencyDeliveryPending}
											>
												<Zap className="mr-2 h-4 w-4" />
												Emergency Delivery
											</Button>
										)}
									</>
								)}
							</DialogFooter>
						</div>
					</ScrollArea>
				)}
			</DialogContent>
		</Dialog>
	);
}
