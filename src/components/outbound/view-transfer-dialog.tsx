import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { TransferDetail } from "@/data/transfers.types";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import {
  getStatusColor,
  getNetSuiteStatusColor,
  formatStatus,
} from "@/lib/outbound";

interface ViewTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: TransferDetail | null;
  onAcceptClick: () => void;
  onRejectClick: () => void;
  hasAcceptPermission: boolean;
  hasRejectPermission: boolean;
}

export function ViewTransferDialog({
  open,
  onOpenChange,
  transfer,
  onAcceptClick,
  onRejectClick,
  hasAcceptPermission,
  hasRejectPermission,
}: ViewTransferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: "min(95vw, 1400px)" }}
      >
        <DialogHeader>
          <DialogTitle>Delivery Order Details</DialogTitle>
          <DialogDescription>
            View and manage Delivery order information
          </DialogDescription>
        </DialogHeader>
        {transfer && (
          <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">PO Number</Label>
                  <p className="text-sm font-medium">
                    {transfer.transferOrderNumber}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Outlet</Label>
                  <p className="text-sm font-medium">{transfer.toLocation}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Region</Label>
                  <p className="text-sm font-medium">
                    {transfer.regionName
                      ? `${transfer.regionName}${transfer.regionCode ? ` (${transfer.regionCode})` : ""}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Scheduled Delivery
                  </Label>
                  <p className="text-sm font-medium">
                    {transfer.expectedDeliveryDate.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created Date</Label>
                  <p className="text-sm font-medium">
                    {transfer.createdDate.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Expected Delivery
                  </Label>
                  <p className="text-sm font-medium">
                    {transfer.expectedDeliveryDate.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge
                    variant="outline"
                    className={getStatusColor(transfer.status)}
                  >
                    {formatStatus(transfer.status)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    NetSuite Status (API)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={getNetSuiteStatusColor(transfer.netsuiteStatus)}
                    >
                      {transfer.netsuiteStatus || "N/A"}
                    </Badge>
                    {transfer.netsuiteStatus === "error" && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created By</Label>
                  <p className="text-sm font-medium">{transfer.createdBy}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total Items</Label>
                  <p className="text-sm font-medium">{transfer.totalItems}</p>
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
                        <TableHead>Available Qty</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfer.items.map((item) => {
                        const availableQty =
                          item.quantity + Math.floor(Math.random() * 10);
                        const canFulfill = availableQty >= item.quantity;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.sku}
                            </TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>
                              <span
                                className={
                                  canFulfill ? "text-green-600" : "text-red-600"
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
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {transfer.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm">{transfer.notes}</p>
                </div>
              )}

              <IntegrationLogPanel
                entityId={transfer.id}
                entityType="po"
                onRetry={(logId) => {
                  console.log("Retry log:", logId);
                }}
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {hasAcceptPermission && transfer.status === "preparing" && (
                  <Button onClick={onAcceptClick}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept &amp; Create DO
                  </Button>
                )}
                {hasRejectPermission && transfer.status === "preparing" && (
                  <Button variant="destructive" onClick={onRejectClick}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                )}
              </DialogFooter>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
