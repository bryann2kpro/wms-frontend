import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Loader2,
  PackageOpen,
  AlertCircle,
} from "lucide-react";
import type { PurchaseOrderDetail } from "@/data/purchase-orders.types";
import {
  purchaseOrderStatuses,
  getStatusColor,
  getNetSuiteStatusColor,
  formatStatus,
  getPurchaseOrderStatusColor,
} from "@/lib/outbound";
import type { DeliveryTab } from "@/lib/outbound";
import { formatDateOnly, formatDeliveryDateHeader, formatWeekRange } from "@/lib/utils";
import {
  usePurchaseOrders,
  type PurchaseOrderStatusFilter,
} from "@/lib/hooks/use-purchase-orders";

interface OutboundListCardProps {
  onViewPurchaseOrder: (purchaseOrder: PurchaseOrderDetail) => void;
  onAcceptClick: (purchaseOrder: PurchaseOrderDetail) => void;
  onRejectClick: (purchaseOrder: PurchaseOrderDetail) => void;
  hasAcceptPermission: boolean;
  hasRejectPermission: boolean;
}

export function OutboundListCard({
  onViewPurchaseOrder,
  onAcceptClick,
  onRejectClick,
  hasAcceptPermission,
  hasRejectPermission,
}: OutboundListCardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatusFilter>("ALL");
  const [activeTab, setActiveTab] = useState<DeliveryTab>("current-week");

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePurchaseOrders({
    searchTerm,
    statusFilter,
    activeTab,
    page: 1,
  });

  const purchaseOrdersByDate = data?.purchaseOrdersByDate ?? {};
  const paginatedDateKeys = data?.paginatedDateKeys ?? [];
  const dateKeys = data?.dateKeys ?? [];

  const loading = isLoading || isFetching;
  const weekRangeLabel =
    activeTab === "current-week" && dateKeys.length > 0
      ? formatWeekRange(dateKeys[0], dateKeys[dateKeys.length - 1])
      : null;

  return (
    <Card role="region" aria-labelledby="purchase-order-title">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle id="purchase-order-title" className="text-xl font-semibold">
                Purchase Order List
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {weekRangeLabel
                  ? `This week: ${weekRangeLabel}`
                  : "View and manage all purchase orders"}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search 
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" 
                  aria-hidden="true"
                />
                <Input
                  id="search-purchase-orders"
                  placeholder="Search purchase orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 sm:w-64 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Search purchase orders by PO number, outlet, or region"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as PurchaseOrderStatusFilter)}
              >
                <SelectTrigger 
                  className="sm:w-48 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  {purchaseOrderStatuses.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}
                      className={getPurchaseOrderStatusColor(status)}
                    >
                      {formatStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 border-b" role="tablist" aria-label="Delivery period tabs">
            <Button
              variant={activeTab === "current-week" ? "default" : "ghost"}
              onClick={() => setActiveTab("current-week")}
              className="rounded-b-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="tab"
              aria-selected={activeTab === "current-week"}
              aria-controls="purchase-order-table"
            >
              <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
              Next Delivery
            </Button>
            <Button
              variant={activeTab === "past-weeks" ? "default" : "ghost"}
              onClick={() => setActiveTab("past-weeks")}
              className="rounded-b-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="tab"
              aria-selected={activeTab === "past-weeks"}
              aria-controls="purchase-order-table"
            >
              <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
              Past Deliveries
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative" role="tabpanel" id="purchase-order-table" aria-labelledby="purchase-order-title">
        <GlobalLoadingShadow />
        <div className="overflow-x-auto rounded-lg border">
          <Table aria-label="Purchase orders list">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">PO Number</TableHead>
                <TableHead scope="col">Outlet</TableHead>
                <TableHead scope="col">Region</TableHead>
                <TableHead scope="col">Schedule Delivery Date</TableHead>
                <TableHead scope="col">DO Created?</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">NetSuite (API)</TableHead>
                <TableHead scope="col" className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <>
                  <TableRow aria-hidden="true">
                    <TableCell colSpan={8} className="sr-only" role="status" aria-live="polite">
                      Loading purchase orders…
                    </TableCell>
                  </TableRow>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="rounded-full bg-destructive/10 p-3">
                        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Failed to load purchase orders</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {error instanceof Error ? error.message : "Something went wrong."}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        Try again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedDateKeys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center"
                    role="status"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-full bg-muted p-3">
                        <PackageOpen className="h-10 w-10 text-muted-foreground" aria-hidden />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {activeTab === "current-week"
                            ? "No orders scheduled for this week"
                            : "No purchase orders found"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {activeTab === "current-week"
                            ? "Orders will appear here when they are scheduled for delivery."
                            : "Try adjusting your search or filters."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDateKeys.flatMap((dateKey) => {
                  const datePurchaseOrders = purchaseOrdersByDate[dateKey] ?? [];
                  const deliveryDate = new Date(dateKey + "T12:00:00");
                  const headerLabel = formatDeliveryDateHeader(deliveryDate);
                  return [
                    <TableRow
                      key={dateKey}
                      className="bg-muted/50 hover:bg-muted/50 border-l-4 border-l-primary/30"
                    >
                      <TableCell
                        colSpan={8}
                        className="font-semibold text-foreground py-3"
                      >
                        {headerLabel}
                        {datePurchaseOrders.length > 0 && (
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({datePurchaseOrders.length} {datePurchaseOrders.length === 1 ? "order" : "orders"})
                          </span>
                        )}
                      </TableCell>
                    </TableRow>,
                    ...(datePurchaseOrders.length === 0
                      ? [
                          <TableRow key={`${dateKey}-empty`}>
                            <TableCell
                              colSpan={8}
                              className="py-4 text-center text-sm text-muted-foreground italic"
                            >
                              No orders for this day
                            </TableCell>
                          </TableRow>,
                        ]
                      : []),
                    ...datePurchaseOrders.map((purchaseOrder) => {
                      const doCreated =
                        purchaseOrder.status === "to-ship" ||
                        purchaseOrder.status === "in-transit";

                      return (
                        <TableRow key={purchaseOrder.id}>
                          <TableCell className="font-medium">
                            {purchaseOrder.purchaseOrderNumber}
                          </TableCell>
                          <TableCell>
                            {purchaseOrder.toLocation}
                          </TableCell>
                          <TableCell>
                            {purchaseOrder.regionName ? (
                              <div className="flex flex-col">
                                <span>
                                  {purchaseOrder.regionName}
                                  {purchaseOrder.regionCode ? ` (${purchaseOrder.regionCode})` : ""}
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDateOnly(purchaseOrder.expectedDeliveryDate)}
                          </TableCell>
                          <TableCell>
                            {doCreated ? (
                              <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-600 border-green-500/20"
                              >
                                Yes
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-gray-500/10 text-gray-600 border-gray-500/20"
                              >
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getStatusColor(purchaseOrder.status)}
                            >
                              {formatStatus(purchaseOrder.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getNetSuiteStatusColor(
                                purchaseOrder.netsuiteStatus,
                              )}
                            >
                              {purchaseOrder.netsuiteStatus || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" role="group" aria-label={`Actions for ${purchaseOrder.purchaseOrderNumber}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onViewPurchaseOrder(purchaseOrder)}
                                className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-label={`View details for ${purchaseOrder.purchaseOrderNumber}`}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              {hasAcceptPermission &&
                                purchaseOrder.status === "preparing" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onAcceptClick(purchaseOrder)}
                                    className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    aria-label={`Accept ${purchaseOrder.purchaseOrderNumber}`}
                                  >
                                    <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                                  </Button>
                                )}
                              {hasRejectPermission &&
                                purchaseOrder.status === "preparing" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onRejectClick(purchaseOrder)}
                                    className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    aria-label={`Reject ${purchaseOrder.purchaseOrderNumber}`}
                                  >
                                    <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                                  </Button>
                                )}
                            </div>
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
      </CardContent>
    </Card>
  );
}

export function useOutboundSummary() {
  const { data, isLoading } = usePurchaseOrders({ page: 1 });
  return { summary: data?.summary, isLoading };
}
