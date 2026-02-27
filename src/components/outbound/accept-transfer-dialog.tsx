import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TransferDetail } from "@/data/transfers.mock-data";

interface AcceptTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: TransferDetail | null;
  onAccept: () => void;
  isPending: boolean;
}

export function AcceptTransferDialog({
  open,
  onOpenChange,
  transfer,
  onAccept,
  isPending,
}: AcceptTransferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept Delivery Order</DialogTitle>
          <DialogDescription>
            Accepting this TO will create a Delivery Order and reserve stock.
            Must fulfill full quantity to accept (no partial, no backorder, no
            split delivery).
          </DialogDescription>
        </DialogHeader>
        {transfer && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-2">
                TO: {transfer.transferOrderNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                Outlet: {transfer.toLocation}
              </p>
              {transfer.regionName && (
                <p className="text-xs text-muted-foreground">
                  Region: {transfer.regionName}
                  {transfer.regionCode ? ` (${transfer.regionCode})` : ""}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Items: {transfer.items.length}
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
