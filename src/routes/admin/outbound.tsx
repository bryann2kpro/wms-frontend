import { useState, useEffect } from "react";
import type { ComponentProps } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import {
	type PurchaseOrderDetail,
	type PurchaseOrderStatus,
	createPurchaseOrder,
	updatePurchaseOrderStatus,
} from "@/data/purchase-orders";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	purchaseOrderStatuses,
	createPurchaseOrderSchema,
	formatStatus,
} from "@/lib/outbound";
import {
	CreatePurchaseOrderDialog,
	CreatePurchaseOrderDialogTrigger,
	ViewPurchaseOrderDialog,
	AcceptPurchaseOrderDialog,
	RejectPurchaseOrderDialog,
	OutboundListCard,
	useOutboundSummary,
} from "@/components/outbound";

export const Route = createFileRoute("/admin/outbound")({
	component: OutboundRouteComponent,
});

function OutboundRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [selectedPurchaseOrder, setSelectedPurchaseOrder] =
		useState<PurchaseOrderDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
	const [rejectReason, setRejectReason] = useState("");

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

	const form = useForm({
		defaultValues: {
			purchaseOrderNumber: "",
			outletId: "",
			outletName: "",
			notes: "",
			items: [{ skuId: "", quantity: 1 }] as { skuId: string; skuCode?: string; description?: string; quantity: number }[],
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
						Manage purchase orders from ES. Create new orders or refresh from
						NetSuite. Delivery date is set automatically when you create an
						order.
					</p>
				</div>
				<div className="flex gap-2">
					{hasPermission("to:refresh") && (
						<Button
							variant="outline"
							onClick={() => {
								queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
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
						form={form as ComponentProps<typeof CreatePurchaseOrderDialog>["form"]}
						createMutation={createMutation}
					/>
				</div>
			</header>

			<div className="grid gap-4 md:grid-cols-5" role="region" aria-label="Purchase order summary by status">
				{isSummaryLoading ? (
					purchaseOrderStatuses.map((status) => (
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
				) : (
					purchaseOrderStatuses.map((status) => (
						<Card key={status} className="transition-colors hover:bg-muted/30">
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
					))
				)}
			</div>

			<OutboundListCard
				onViewPurchaseOrder={(purchaseOrder) => {
					setSelectedPurchaseOrder(purchaseOrder);
					setIsViewOpen(true);
				}}
				onAcceptClick={(purchaseOrder) => {
					setSelectedPurchaseOrder(purchaseOrder);
					setIsAcceptDialogOpen(true);
				}}
				onRejectClick={(purchaseOrder) => {
					setSelectedPurchaseOrder(purchaseOrder);
					setIsRejectDialogOpen(true);
				}}
				hasAcceptPermission={hasPermission("to:accept")}
				hasRejectPermission={hasPermission("to:reject")}
			/>

			<ViewPurchaseOrderDialog
				open={isViewOpen}
				onOpenChange={setIsViewOpen}
				purchaseOrder={selectedPurchaseOrder}
				onAcceptClick={() => {
					setIsViewOpen(false);
					setIsAcceptDialogOpen(true);
				}}
				onRejectClick={() => {
					setIsViewOpen(false);
					setIsRejectDialogOpen(true);
				}}
				hasAcceptPermission={hasPermission("to:accept")}
				hasRejectPermission={hasPermission("to:reject")}
			/>

			<AcceptPurchaseOrderDialog
				open={isAcceptDialogOpen}
				onOpenChange={setIsAcceptDialogOpen}
				purchaseOrder={selectedPurchaseOrder}
				onAccept={() => {
					if (selectedPurchaseOrder) {
						statusMutation.mutate({
							id: selectedPurchaseOrder.id,
							status: "to-ship",
						});
						setIsAcceptDialogOpen(false);
					}
				}}
				isPending={statusMutation.isPending}
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
