import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

interface RejectPurchaseOrderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	rejectReason: string;
	onRejectReasonChange: (value: string) => void;
	onReject: () => void;
	isPending: boolean;
}

export function RejectPurchaseOrderDialog({
	open,
	onOpenChange,
	rejectReason,
	onRejectReasonChange,
	onReject,
	isPending,
}: RejectPurchaseOrderDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Reject Purchase Order</DialogTitle>
					<DialogDescription>
						Please provide a reason for rejecting this purchase order.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<Field>
						<FieldLabel>Rejection Reason</FieldLabel>
						<Textarea
							value={rejectReason}
							onChange={(e) => onRejectReasonChange(e.target.value)}
							placeholder="Enter rejection reason..."
							required
							rows={3}
						/>
					</Field>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => {
							onOpenChange(false);
							onRejectReasonChange("");
						}}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={onReject}
						disabled={isPending || !rejectReason}
					>
						{isPending ? "Rejecting..." : "Reject PO"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
