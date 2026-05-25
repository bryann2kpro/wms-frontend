import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	HelpCircle,
	ImageOff,
	RefreshCw,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	type CreatePurchaseOrderDialog,
	CreatePurchaseOrderDialogTrigger,
	ImportExcelDialog,
	type ImportRowResult,
	OutboundListCard,
	RejectPurchaseOrderDialog,
	useOutboundSummary,
	ViewPurchaseOrderDialog,
} from "@/components/outbound";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { advanceDeliveryOrderStatus } from "@/data/delivery-orders";
import { generateDeliveryOrderPdfUrl } from "@/data/documents";
import {
	applyEmergencyDelivery,
	type CreatePurchaseOrderInput,
	createPurchaseOrder,
	type PurchaseOrderDetail,
	type PurchaseOrderStatus,
	type UpdatePurchaseOrderInput,
	updatePurchaseOrder,
	updatePurchaseOrderStatus,
} from "@/data/purchase-orders";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { PurchaseOrderStatusFilter } from "@/lib/hooks/use-purchase-orders";
import {
	createPurchaseOrderSchema,
	formatStatus,
	purchaseOrderStatuses,
} from "@/lib/outbound";
import { usePermissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/rbac";
import { useBulkDeliveryOrderPdf } from "@/hooks/useBulkDeliveryOrderPdf";
import {
	downloadPdfFromUrl,
	sanitizePdfFilenameSegment,
} from "@/lib/reports/report-pdf";
import { buildErrorReport, copyErrorReport } from "@/lib/error-report";
import { getErrorMessage } from "@/lib/utils";

const STATUS_BORDER_COLOR: Record<string, string> = {
	preparing: "border-l-yellow-500",
	"in-transit": "border-l-blue-500",
	"to-ship": "border-l-indigo-500",
	cancel: "border-l-red-500",
	return: "border-l-orange-500",
	other: "border-l-gray-400",
};

export const Route = createFileRoute("/admin/outbound")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Delivery Order"]);
	},
	component: OutboundRouteComponent,
	head: () => ({
		meta: [
			{
				title: "Outbound - SME Edaran WMS",
				description:
					"Track outbound purchase orders and delivery orders from preparation to delivery.",
			},
		],
	}),
});

/** Base path for Outbound help screenshots. Add step-1.png, step-2.png, etc. under public/help/outbound/ */
const HELP_IMAGES_BASE = "/help/outbound";

const OUTBOUND_HELP_STEPS: Array<{
	title: string;
	description: ReactNode;
	image: string;
}> = [
	{
		title: "What this page does",
		image: `${HELP_IMAGES_BASE}/step-1.png`,
		description: (
			<>
				View all outbound purchase orders. The summary cards at the top show
				counts grouped by status — Preparing, To Ship, In Transit, and more.
				When a purchase order is created, a Delivery Order (DO) is automatically
				generated to track the shipment.
			</>
		),
	},
	{
		title: "Create a purchase order",
		image: `${HELP_IMAGES_BASE}/step-2.png`,
		description: (
			<>
				Click <strong>Create Purchase Order</strong> to add a new order. Select
				the outlet, enter the PO number, and add line items with stock and
				quantity. Enable <strong>Emergency Delivery</strong> if the order needs
				to be fulfilled urgently outside the regular schedule.
			</>
		),
	},
	{
		title: "View order details",
		image: `${HELP_IMAGES_BASE}/step-3.png`,
		description: (
			<>
				Click on any row to open the full order details — line items, outlet
				info, and current status. From the detail view you can also{" "}
				<strong>Advance</strong> the delivery step or trigger an{" "}
				<strong>Emergency Delivery</strong> if needed.
			</>
		),
	},
	{
		title: "Accept or reject orders",
		image: `${HELP_IMAGES_BASE}/step-4.png`,
		description: (
			<>
				Use <strong>Accept</strong> on a pending order to move it to "To Ship"
				status, signalling it is ready for dispatch. Use <strong>Reject</strong>{" "}
				to cancel an order — you will be prompted to enter a reason before
				confirming.
			</>
		),
	},
	{
		title: "Refresh from NetSuite",
		image: `${HELP_IMAGES_BASE}/step-5.png`,
		description: (
			<>
				Click <strong>Refresh from NetSuite</strong> to pull the latest purchase
				orders from the ERP system. Use this whenever you expect new or updated
				orders that are not yet showing in the list.
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
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
				<span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
					<ImageOff className="h-7 w-7" />
				</span>
				<span className="text-sm text-muted-foreground">
					Add screenshot:{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
						public/help/outbound/step-{stepNumber}.png
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

/**
 * Extract the first clean GraphQL error message from a graphql-request ClientError.
 * graphql-request puts errors at err.response.errors (not err.graphQLErrors like Apollo).
 * Falls back to err.graphQLErrors for Apollo-style errors, then to err.message
 * only when neither structured location is available.
 */
function extractGqlMessage(err: unknown): string | undefined {
	if (!err || typeof err !== "object") return undefined;

	// graphql-request: { response: { errors: [{ message }] }, request: { ... } }
	const responseErrors = (
		err as { response?: { errors?: Array<{ message?: string }> } }
	).response?.errors;
	if (responseErrors?.[0]?.message) return responseErrors[0].message;

	// Apollo Client: { graphQLErrors: [{ message }] }
	const gqlErrors = (err as { graphQLErrors?: Array<{ message?: string }> })
		.graphQLErrors;
	if (gqlErrors?.[0]?.message) return gqlErrors[0].message;

	return undefined;
}

/**
 * Parse "Insufficient stock for SKU "RAW-T0001": required 3, available 0 (onHand: 0, reserved: 0)."
 * into a readable sentence: "RAW-T0001: 3 required, 0 available (0 on hand)"
 */
function formatInsufficientStockMessage(raw: string): string {
	const match = raw.match(
		/Insufficient stock for SKU "([^"]+)": required ([\d.]+), available ([\d.]+) \(onHand: ([\d.]+), reserved: ([\d.]+)\)/,
	);
	if (!match) return raw;
	const [, sku, required, available, onHand, reserved] = match;
	const parts = [`${sku}: ${required} required, ${available} available`];
	if (Number(reserved) > 0) {
		parts.push(`(${onHand} on hand, ${reserved} reserved)`);
	} else {
		parts.push(`(${onHand} on hand)`);
	}
	return parts.join(" ");
}

/**
 * Extract a user-friendly title + optional description from a createPurchaseOrder error.
 * Handles the two most common server-side failures:
 *   1. Duplicate PO number  → DB unique constraint violation
 *   2. Insufficient stock   → service-level assertion
 */
function parseCreatePoError(err: unknown): { title: string; description?: string } {
	const rawMessage = extractGqlMessage(err);

	if (rawMessage) {
		if (
			rawMessage.includes("duplicate key value") ||
			rawMessage.includes("unique constraint") ||
			rawMessage.toLowerCase().includes("already exists")
		) {
			return {
				title: "Purchase order number already exists",
				description: "Use a different PO number and try again.",
			};
		}
		if (rawMessage.includes("Insufficient stock for SKU")) {
			return {
				title: "Insufficient stock",
				description: formatInsufficientStockMessage(rawMessage),
			};
		}
	}

	return { title: getErrorMessage(err as Error) };
}

function OutboundRouteComponent() {
	const { user } = useCurrentUser();
	const { update } = usePermissions(user);
	const [selectedPurchaseOrder, setSelectedPurchaseOrder] =
		useState<PurchaseOrderDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
	const [rejectReason, setRejectReason] = useState("");
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);
	const [pendingDoPdfDeliveryOrderId, setPendingDoPdfDeliveryOrderId] =
		useState<string | null>(null);
	const { state: bulkDoPdfState, startBulkExport: startBulkDoPdfExport } =
		useBulkDeliveryOrderPdf();
	const [isIndividualBulkDownloading, setIsIndividualBulkDownloading] = useState(false);
	const [isBulkStatusUpdating, setIsBulkStatusUpdating] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [activeStatusFilter, setActiveStatusFilter] =
		useState<PurchaseOrderStatusFilter>("ALL");

	const queryClient = useQueryClient();
	const { summary, isLoading: isSummaryLoading } = useOutboundSummary();

	const createMutation = useMutation({
		mutationFn: createPurchaseOrder,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			setIsCreateOpen(false);
			toast.success("Purchase order created");
		},
		onError: (err) => {
			const { title, description } = parseCreatePoError(err);
			const report = buildErrorReport(err, {
				operation: "createPurchaseOrder",
				userEmail: user?.email ?? undefined,
			});
			toast.error(title, {
				description,
				action: {
					label: "Copy error details",
					onClick: async () => {
						const ok = await copyErrorReport(report);
						if (ok) {
							toast.success("Error details copied to clipboard");
						} else {
							toast.error("Could not access clipboard");
						}
					},
				},
			});
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: PurchaseOrderStatus }) =>
			updatePurchaseOrderStatus(id, status),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			toast.success(
				variables.status === "cancel"
					? "Purchase order rejected"
					: "Purchase order accepted",
			);
		},
		onError: (err) => toast.error(getErrorMessage(err as Error)),
	});

	const advanceStepMutation = useMutation({
		mutationFn: (deliveryOrderId: string) =>
			advanceDeliveryOrderStatus(deliveryOrderId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			toast.success("Delivery order advanced to next step");
			setIsViewOpen(false);
			setSelectedPurchaseOrder(null);
		},
		onError: (err) => toast.error(getErrorMessage(err as Error)),
	});

	const emergencyDeliveryMutation = useMutation({
		mutationFn: (poId: string) => applyEmergencyDelivery(poId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			toast.success("Emergency delivery applied");
			setIsViewOpen(false);
			setSelectedPurchaseOrder(null);
		},
		onError: (err) => toast.error(getErrorMessage(err as Error)),
	});

	const editMutation = useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdatePurchaseOrderInput }) =>
			updatePurchaseOrder(id, input),
		onSuccess: (updated) => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			setSelectedPurchaseOrder(updated);
			toast.success("Purchase order updated");
		},
		onError: (err) => toast.error(getErrorMessage(err as Error)),
	});

	const downloadDoPdf = useCallback(async (po: PurchaseOrderDetail) => {
		const doId = po.deliveryOrder?.id;
		if (!doId) return;
		setPendingDoPdfDeliveryOrderId(doId);
		try {
			const url = await generateDeliveryOrderPdfUrl(doId);
			const doNo = po.deliveryOrder?.doNo?.trim();
			const filenameBase = doNo || po.purchaseOrderNumber.trim();
			const filenamePrefix = doNo ? "" : "DO-";
			const filename = `${filenamePrefix}${sanitizePdfFilenameSegment(filenameBase)}.pdf`;
			await downloadPdfFromUrl(url, filename);
			toast.success("Delivery order PDF downloaded");
		} catch {
			toast.error("Could not generate delivery order PDF");
		} finally {
			setPendingDoPdfDeliveryOrderId(null);
		}
	}, []);

	const handleExcelImport = useCallback(
		async (inputs: CreatePurchaseOrderInput[]): Promise<ImportRowResult[]> => {
			const results: ImportRowResult[] = [];
			for (const input of inputs) {
				try {
					await createPurchaseOrder(input);
					results.push({
						purchaseOrderNumber: input.purchaseOrderNumber,
						success: true,
					});
				} catch (err) {
					const { title, description } = parseCreatePoError(err);
					const message = description ? `${title}: ${description}` : title;
					const report = buildErrorReport(err, {
						operation: "createPurchaseOrder",
						userEmail: user?.email ?? undefined,
					});
					results.push({
						purchaseOrderNumber: input.purchaseOrderNumber,
						success: false,
						error: message,
						report,
					});
				}
			}
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			return results;
		},
		[queryClient],
	);

	const bulkDownloadDoPdf = useCallback(
		async (orders: PurchaseOrderDetail[]) => {
			const deliveryOrderIds = orders
				.map((po) => po.deliveryOrder?.id)
				.filter((id): id is string => Boolean(id));
			await startBulkDoPdfExport(deliveryOrderIds);
		},
		[startBulkDoPdfExport],
	);

	const bulkDownloadDoPdfIndividual = useCallback(
		async (orders: PurchaseOrderDetail[]) => {
			const ordersWithDo = orders.filter((po) => Boolean(po.deliveryOrder?.id));
			if (ordersWithDo.length === 0) return;
			setIsIndividualBulkDownloading(true);
			let successCount = 0;
			let failCount = 0;
			try {
				for (const po of ordersWithDo) {
					const doId = po.deliveryOrder!.id;
					try {
						const url = await generateDeliveryOrderPdfUrl(doId);
						const doNo = po.deliveryOrder?.doNo?.trim();
						const filenameBase = doNo || po.purchaseOrderNumber.trim();
						const filenamePrefix = doNo ? "" : "DO-";
						const filename = `${filenamePrefix}${sanitizePdfFilenameSegment(filenameBase)}.pdf`;
						await downloadPdfFromUrl(url, filename);
						successCount++;
					} catch {
						failCount++;
					}
				}
			} finally {
				setIsIndividualBulkDownloading(false);
			}
			if (failCount > 0) {
				toast.warning(`Downloaded ${successCount} PDF(s). ${failCount} failed.`);
			} else {
				toast.success(`${successCount} Delivery Order PDF(s) downloaded`);
			}
		},
		[],
	);

	const bulkMarkAllPicked = useCallback(
		async (orders: PurchaseOrderDetail[]) => {
			const shippedCount = orders.filter(
				(po) => po.deliveryOrder?.status === "SHIPPED",
			).length;
			const selected = orders.filter(
				(po) =>
					Boolean(po.deliveryOrder?.id) &&
					po.deliveryOrder?.status !== "SHIPPED",
			);
			if (selected.length === 0) return;
			setIsBulkStatusUpdating(true);
			let successCount = 0;
			let failCount = 0;
			try {
				for (const po of selected) {
					const deliveryOrder = po.deliveryOrder;
					if (!deliveryOrder) continue;
					if (!["CREATED", "NEW", "PICKING"].includes(deliveryOrder.status)) continue;
					try {
						let currentStatus = deliveryOrder.status;
						for (let i = 0; i < 2; i++) {
							if (currentStatus === "PACKING" || currentStatus === "SHIPPED") break;
							const updated = await advanceDeliveryOrderStatus(deliveryOrder.id);
							currentStatus = updated.status as
								| "CREATED"
								| "NEW"
								| "PICKING"
								| "PACKING"
								| "SHIPPED"
								| "DELIVERED";
						}
						successCount++;
					} catch {
						failCount++;
					}
				}
			} finally {
				setIsBulkStatusUpdating(false);
				await queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			}
			if (failCount > 0) {
				toast.warning(
					`Marked ${successCount} delivery order(s) as picked. ${failCount} failed.`,
				);
			} else {
				toast.success(`Marked ${successCount} delivery order(s) as picked`);
			}
			if (shippedCount > 0) {
				toast.info(`${shippedCount} SHIPPED delivery order(s) were skipped.`);
			}
		},
		[queryClient],
	);

	const bulkMarkAsShipped = useCallback(
		async (orders: PurchaseOrderDetail[]) => {
			const shippedCount = orders.filter(
				(po) => po.deliveryOrder?.status === "SHIPPED",
			).length;
			const selected = orders.filter((po) => po.deliveryOrder?.status === "PACKING");
			if (selected.length === 0) {
				toast.info("No selected delivery orders are in PACKING status");
				if (shippedCount > 0) {
					toast.info(`${shippedCount} SHIPPED delivery order(s) were skipped.`);
				}
				return;
			}
			setIsBulkStatusUpdating(true);
			let successCount = 0;
			let failCount = 0;
			try {
				for (const po of selected) {
					const doId = po.deliveryOrder?.id;
					if (!doId) continue;
					try {
						await advanceDeliveryOrderStatus(doId);
						successCount++;
					} catch {
						failCount++;
					}
				}
			} finally {
				setIsBulkStatusUpdating(false);
				await queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			}
			if (failCount > 0) {
				toast.warning(`Marked ${successCount} as shipped. ${failCount} failed.`);
			} else {
				toast.success(`Marked ${successCount} delivery order(s) as shipped`);
			}
			if (shippedCount > 0) {
				toast.info(`${shippedCount} SHIPPED delivery order(s) were skipped.`);
			}
		},
		[queryClient],
	);

	const bulkProcessSelected = useCallback(
		async (orders: PurchaseOrderDetail[]) => {
			const shippedCount = orders.filter(
				(po) => po.deliveryOrder?.status === "SHIPPED",
			).length;
			const selected = orders.filter(
				(po) =>
					Boolean(po.deliveryOrder?.id) &&
					po.deliveryOrder?.status !== "SHIPPED",
			);
			if (selected.length === 0) return;
			setIsBulkStatusUpdating(true);
			let successCount = 0;
			let failCount = 0;
			try {
				for (const po of selected) {
					const doId = po.deliveryOrder?.id;
					if (!doId) continue;
					try {
						await advanceDeliveryOrderStatus(doId);
						successCount++;
					} catch {
						failCount++;
					}
				}
			} finally {
				setIsBulkStatusUpdating(false);
				await queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			}
			if (failCount > 0) {
				toast.warning(
					`Processed ${successCount} delivery order(s) to next step. ${failCount} failed.`,
				);
			} else {
				toast.success(
					`Processed ${successCount} delivery order(s) to their next step`,
				);
			}
			if (shippedCount > 0) {
				toast.info(`${shippedCount} SHIPPED delivery order(s) were skipped.`);
			}
		},
		[queryClient],
	);

	const form = useForm({
		defaultValues: {
			purchaseOrderNumber: "",
			outletId: "",
			outletName: "",
			notes: "",
			items: [{ skuId: "", quantity: 1, stockQuantId: "" }] as {
				skuId: string;
				skuCode?: string;
				description?: string;
				quantity: number;
				stockQuantId: string;
			}[],
			isEmergency: false,
		},
		validators: {
			onChange: createPurchaseOrderSchema as any,
			onBlur: createPurchaseOrderSchema as any,
			onSubmit: createPurchaseOrderSchema as any,
		},
		onSubmit: async ({ value }) => {
			await createMutation.mutateAsync({
				purchaseOrderNumber: value.purchaseOrderNumber,
				outletId: value.outletId,
				outletName: value.outletName ?? "",
				expectedDeliveryDate: new Date(),
				notes: value.notes || undefined,
				isEmergency: value.isEmergency ?? false,
				items: value.items.map((line) => ({
					skuId: line.skuId,
					skuCode: line.skuCode,
					description: line.description,
					quantity: line.quantity,
					stockQuantId: line.stockQuantId,
				})),
			});
			form.reset();
		},
	});

	useEffect(() => {
		if (!isHelpOpen) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight")
				setHelpStep((s) => Math.min(s + 1, OUTBOUND_HELP_STEPS.length - 1));
			if (e.key === "ArrowLeft") setHelpStep((s) => Math.max(s - 1, 0));
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isHelpOpen]);

	return (
		<div className="outbound-page min-h-screen bg-[var(--dashboard-surface)]">
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				className="container relative mx-auto space-y-6 p-6"
				aria-labelledby="outbound-page-title"
				aria-describedby="outbound-page-description"
			>
				<AdminPageHeader
					icon={RefreshCw}
					title="Outbound Delivery Orders"
					description="Manage outbound purchase orders. Create new orders or refresh from NetSuite. A Delivery Order is automatically generated when an order is created."
					titleId="outbound-page-title"
					descriptionId="outbound-page-description"
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
													Outbound help
												</DialogTitle>
												<DialogDescription
													className="mt-0.5"
													style={{ fontFamily: "var(--dashboard-body)" }}
												>
													Step {helpStep + 1} of {OUTBOUND_HELP_STEPS.length}
												</DialogDescription>
											</div>
										</div>
									</DialogHeader>
									<div className="space-y-5 px-6 py-5">
										<div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/50 shadow-inner">
											<HelpStepImage
												src={OUTBOUND_HELP_STEPS[helpStep].image}
												stepNumber={helpStep + 1}
											/>
										</div>
										<div className="rounded-xl border bg-card p-4">
											<h3
												className="mb-2 text-sm font-semibold text-foreground"
												style={{ fontFamily: "var(--dashboard-display)" }}
											>
												{OUTBOUND_HELP_STEPS[helpStep].title}
											</h3>
											<p
												className="text-sm text-muted-foreground leading-relaxed"
												style={{ fontFamily: "var(--dashboard-body)" }}
											>
												{OUTBOUND_HELP_STEPS[helpStep].description}
											</p>
										</div>
										<div className="flex items-center justify-between gap-4 pt-1">
											<div
												className="flex gap-1.5"
												role="tablist"
												aria-label="Help steps"
											>
												{OUTBOUND_HELP_STEPS.map((_, i) => (
													<button
														type="button"
														key={i}
														role="tab"
														aria-selected={i === helpStep}
														aria-label={`Step ${i + 1}: ${OUTBOUND_HELP_STEPS[i].title}`}
														onClick={() => setHelpStep(i)}
														className={`h-2 rounded-full transition-all duration-200 ${
															i === helpStep
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
														<ChevronLeft className="mr-0.5 h-4 w-4" />
														Previous
													</Button>
												) : null}
												{helpStep < OUTBOUND_HELP_STEPS.length - 1 ? (
													<Button
														size="sm"
														className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
														onClick={() => setHelpStep((s) => s + 1)}
													>
														Next
														<ChevronRight className="ml-0.5 h-4 w-4" />
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
							{update("Outbound") && (
								<Button
									variant="outline"
									className="rounded-lg"
									disabled={isRefreshing}
									onClick={async () => {
										setIsRefreshing(true);
										await queryClient.invalidateQueries({
											queryKey: ["purchase-orders-list"],
										});
										setIsRefreshing(false);
										toast.success("Refreshed from NetSuite");
									}}
									aria-label="Refresh purchase orders from NetSuite"
								>
									<RefreshCw
										className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
										aria-hidden
									/>
									{isRefreshing ? "Refreshing…" : "Refresh from NetSuite"}
								</Button>
							)}
							<ImportExcelDialog onImport={handleExcelImport} />
							<CreatePurchaseOrderDialogTrigger
								open={isCreateOpen}
								onOpenChange={setIsCreateOpen}
								form={
									form as ComponentProps<
										typeof CreatePurchaseOrderDialog
									>["form"]
								}
								createMutation={createMutation}
								triggerClassName="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
							/>
						</div>
					}
				/>

				<div
					className="grid gap-4 md:grid-cols-5"
					role="region"
					aria-label="Purchase order summary by status"
				>
					{isSummaryLoading
						? purchaseOrderStatuses.map((status) => (
								<Card key={status}>
									<CardHeader className="pb-2">
										<CardTitle
											className="text-sm font-medium"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											{formatStatus(status)}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<Skeleton className="h-8 w-12" aria-hidden />
									</CardContent>
								</Card>
							))
						: purchaseOrderStatuses.map((status, i) => (
								<Card
									key={status}
									className={`dashboard-card border-l-4 transition-colors hover:bg-muted/30 cursor-pointer ${activeStatusFilter === status ? "ring-2 ring-[var(--dashboard-accent)] ring-offset-2" : ""} ${i === 0 ? "border-l-[var(--dashboard-accent)]" : (STATUS_BORDER_COLOR[status] ?? "border-l-gray-400")}`}
									style={{
										animationDelay: `${i * 60}ms`,
									}}
									onClick={() =>
										setActiveStatusFilter((prev) =>
											prev === status ? "ALL" : status,
										)
									}
									role="button"
									tabIndex={0}
									aria-pressed={activeStatusFilter === status}
									aria-label={`Filter by ${formatStatus(status)}`}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setActiveStatusFilter((prev) =>
												prev === status ? "ALL" : status,
											);
										}
									}}
								>
									<CardHeader className="pb-2">
										<CardTitle
											className="text-sm font-medium"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											{formatStatus(status)}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div
											className="text-2xl font-bold tabular-nums"
											style={{ fontFamily: "var(--dashboard-display)" }}
										>
											{summary?.byStatus[status] ?? 0}
										</div>
									</CardContent>
								</Card>
							))}
				</div>

				<OutboundListCard
					cardClassName="dashboard-card"
					initialStatusFilter={activeStatusFilter}
					onViewPurchaseOrder={(purchaseOrder) => {
						setSelectedPurchaseOrder(purchaseOrder);
						setIsViewOpen(true);
					}}
					onAdvanceStep={(purchaseOrder) => {
						if (purchaseOrder.deliveryOrder?.id) {
							advanceStepMutation.mutate(purchaseOrder.deliveryOrder.id);
						}
					}}
					isAdvanceStepPending={advanceStepMutation.isPending}
					advancingDeliveryOrderId={advanceStepMutation.variables ?? null}
					onDownloadDoPdf={downloadDoPdf}
					pendingDoPdfDeliveryOrderId={pendingDoPdfDeliveryOrderId}
					onBulkDownloadDoPdf={bulkDownloadDoPdf}
					onBulkDownloadDoPdfIndividual={bulkDownloadDoPdfIndividual}
					onBulkMarkAllPicked={bulkMarkAllPicked}
					onBulkMarkAsShipped={bulkMarkAsShipped}
					onBulkProcessSelected={bulkProcessSelected}
					isBulkStatusActionPending={isBulkStatusUpdating}
					isBulkDoPdfPending={bulkDoPdfState.status === "generating" || isIndividualBulkDownloading}
					bulkDoPdfProgress={bulkDoPdfState.progress}
					bulkDoPdfTotal={bulkDoPdfState.total}
				/>

				<ViewPurchaseOrderDialog
					open={isViewOpen}
					onOpenChange={setIsViewOpen}
					purchaseOrder={selectedPurchaseOrder}
					onAdvanceStep={
						selectedPurchaseOrder?.deliveryOrder?.id
							? () => {
									advanceStepMutation.mutate(
										selectedPurchaseOrder.deliveryOrder!.id,
									);
								}
							: undefined
					}
					isAdvanceStepPending={advanceStepMutation.isPending}
					onEmergencyDelivery={
						selectedPurchaseOrder
							? () => emergencyDeliveryMutation.mutate(selectedPurchaseOrder.id)
							: undefined
					}
					isEmergencyDeliveryPending={emergencyDeliveryMutation.isPending}
					onDownloadDoPdf={
						selectedPurchaseOrder?.deliveryOrder?.id
							? () => {
									const po = selectedPurchaseOrder;
									if (po) void downloadDoPdf(po);
								}
							: undefined
					}
					isDownloadDoPdfPending={
						Boolean(selectedPurchaseOrder?.deliveryOrder?.id) &&
						pendingDoPdfDeliveryOrderId ===
							selectedPurchaseOrder?.deliveryOrder?.id
					}
					onEdit={(id, input) => editMutation.mutate({ id, input })}
					isEditPending={editMutation.isPending}
				/>

				<RejectPurchaseOrderDialog
					open={isRejectDialogOpen}
					onOpenChange={setIsRejectDialogOpen}
					rejectReason={rejectReason}
					onRejectReasonChange={setRejectReason}
					onReject={() => {
						if (selectedPurchaseOrder && rejectReason) {
							statusMutation.mutate({
								id: selectedPurchaseOrder.id,
								status: "cancel",
							});
							setIsRejectDialogOpen(false);
							setRejectReason("");
						}
					}}
					isPending={statusMutation.isPending}
				/>
			</main>
		</div>
	);
}
