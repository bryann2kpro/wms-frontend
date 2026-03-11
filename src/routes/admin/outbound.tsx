import { useState, useEffect } from "react";
import type { ComponentProps, ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	RefreshCw,
	HelpCircle,
	ChevronLeft,
	ChevronRight,
	ImageOff,
} from "lucide-react";
import {
	type PurchaseOrderDetail,
	type PurchaseOrderStatus,
	createPurchaseOrder,
	updatePurchaseOrderStatus,
	applyEmergencyDelivery,
} from "@/data/purchase-orders";
import { advanceDeliveryOrderStatus } from "@/data/delivery-orders";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	purchaseOrderStatuses,
	createPurchaseOrderSchema,
	formatStatus,
} from "@/lib/outbound";
import {
	type CreatePurchaseOrderDialog,
	CreatePurchaseOrderDialogTrigger,
	ViewPurchaseOrderDialog,
	RejectPurchaseOrderDialog,
	OutboundListCard,
	useOutboundSummary,
} from "@/components/outbound";

const STATUS_BORDER_COLOR: Record<string, string> = {
	preparing: "border-l-yellow-500",
	"in-transit": "border-l-blue-500",
	"to-ship": "border-l-indigo-500",
	cancel: "border-l-red-500",
	return: "border-l-orange-500",
	other: "border-l-gray-400",
};

export const Route = createFileRoute("/admin/outbound")({
	component: OutboundRouteComponent,
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
				status, signalling it is ready for dispatch. Use{" "}
				<strong>Reject</strong> to cancel an order — you will be prompted to
				enter a reason before confirming.
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
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
					<ImageOff className="h-6 w-6" />
				</span>
				<span>Add screenshot: public/help/outbound/step-{stepNumber}.png</span>
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

function OutboundRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [selectedPurchaseOrder, setSelectedPurchaseOrder] =
		useState<PurchaseOrderDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
	const [rejectReason, setRejectReason] = useState("");
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);

	const queryClient = useQueryClient();
	const { summary, isLoading: isSummaryLoading } = useOutboundSummary();

	const createMutation = useMutation({
		mutationFn: createPurchaseOrder,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
			setIsCreateOpen(false);
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: PurchaseOrderStatus }) =>
			updatePurchaseOrderStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
		},
	});

	const advanceStepMutation = useMutation({
		mutationFn: (deliveryOrderId: string) =>
			advanceDeliveryOrderStatus(deliveryOrderId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
		},
	});

	const emergencyDeliveryMutation = useMutation({
		mutationFn: (poId: string) => applyEmergencyDelivery(poId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
		},
	});

	const form = useForm({
		defaultValues: {
			purchaseOrderNumber: "",
			outletId: "",
			outletName: "",
			notes: "",
			items: [{ skuId: "", quantity: 1 }] as {
				skuId: string;
				skuCode?: string;
				description?: string;
				quantity: number;
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
				})),
			});
			form.reset();
		},
	});

	const pageTitle = "Outbound Delivery Orders";
	useEffect(() => {
		document.title = `${pageTitle} | SME Ederan`;
		return () => {
			document.title = "SME Ederan";
		};
	}, []);

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
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="page-title"
			aria-describedby="page-description"
		>
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1
						id="page-title"
						className="text-3xl font-bold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						tabIndex={-1}
					>
						Outbound Delivery Orders
					</h1>
					<p id="page-description" className="text-muted-foreground mt-1">
						Manage outbound purchase orders. Create new orders or refresh from
						NetSuite. A Delivery Order is automatically generated when an order
						is created.
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
								<DialogTitle>Outbound Delivery Orders help</DialogTitle>
								<DialogDescription>
									Step {helpStep + 1} of {OUTBOUND_HELP_STEPS.length}
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
									<HelpStepImage
										src={OUTBOUND_HELP_STEPS[helpStep].image}
										stepNumber={helpStep + 1}
									/>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-foreground mb-1">
										{OUTBOUND_HELP_STEPS[helpStep].title}
									</h3>
									<p className="text-sm text-muted-foreground leading-relaxed">
										{OUTBOUND_HELP_STEPS[helpStep].description}
									</p>
								</div>
								<div className="flex items-center justify-between gap-4 pt-2">
									<div className="flex gap-1">
										{OUTBOUND_HELP_STEPS.map((_, i) => (
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
										{helpStep < OUTBOUND_HELP_STEPS.length - 1 ? (
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
					{hasPermission("to:refresh") && (
						<Button
							variant="outline"
							onClick={() => {
								queryClient.invalidateQueries({
									queryKey: ["purchase-orders-list"],
								});
							}}
							aria-label="Refresh purchase orders from NetSuite"
						>
							<RefreshCw className="mr-2 h-4 w-4" aria-hidden />
							Refresh from NetSuite
						</Button>
					)}
					<CreatePurchaseOrderDialogTrigger
						open={isCreateOpen}
						onOpenChange={setIsCreateOpen}
						form={
							form as ComponentProps<typeof CreatePurchaseOrderDialog>["form"]
						}
						createMutation={createMutation}
					/>
				</div>
			</header>

			<div
				className="grid gap-4 md:grid-cols-5"
				role="region"
				aria-label="Purchase order summary by status"
			>
				{isSummaryLoading
					? purchaseOrderStatuses.map((status) => (
							<Card key={status}>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium">
										{formatStatus(status)}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Skeleton className="h-8 w-12" aria-hidden />
								</CardContent>
							</Card>
						))
					: purchaseOrderStatuses.map((status) => (
							<Card
								key={status}
								className={`transition-colors hover:bg-muted/30 border-l-4 ${STATUS_BORDER_COLOR[status] ?? "border-l-gray-400"}`}
							>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium">
										{formatStatus(status)}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold tabular-nums">
										{summary?.byStatus[status] ?? 0}
									</div>
								</CardContent>
							</Card>
						))}
			</div>

			<OutboundListCard
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
	);
}
