import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PurchaseOrderDetail } from "@/data/purchase-orders.types";

interface AcceptPurchaseOrderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	purchaseOrder: PurchaseOrderDetail | null;
	onAccept: () => void;
	isPending: boolean;
}

export function AcceptPurchaseOrderDialog({
	open,
	onOpenChange,
	purchaseOrder,
	onAccept,
	isPending,
}: AcceptPurchaseOrderDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Accept Purchase Order</DialogTitle>
					<DialogDescription>
						Accepting this PO will create a Delivery Order and reserve stock.
						Must fulfill full quantity to accept (no partial, no backorder, no
						split delivery).
					</DialogDescription>
				</DialogHeader>
				{purchaseOrder && (
					<div className="space-y-4">
						<div className="rounded-lg border p-3 bg-muted/50">
							<p className="text-sm font-medium mb-2">
								PO: {purchaseOrder.purchaseOrderNumber}
							</p>
							<p className="text-xs text-muted-foreground">
								Outlet: {purchaseOrder.toLocation}
							</p>
							{purchaseOrder.regionName && (
								<p className="text-xs text-muted-foreground">
									Region: {purchaseOrder.regionName}
									{purchaseOrder.regionCode
										? ` (${purchaseOrder.regionCode})`
										: ""}
								</p>
							)}
							<p className="text-xs text-muted-foreground">
								Items: {purchaseOrder.items.length}
							</p>
						</div>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onAccept} disabled={isPending}>
						{isPending ? "Accepting..." : "Accept & Create DO"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
