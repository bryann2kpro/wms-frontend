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
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
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
import { formatDateOnly, formatDeliveryDateHeader } from "@/lib/utils";
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
  const [page, setPage] = useState(1);

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = usePurchaseOrders({
    searchTerm,
    statusFilter,
    activeTab,
    page,
  });

  const purchaseOrdersByDate = data?.purchaseOrdersByDate ?? {};
  const paginatedDateKeys = data?.paginatedDateKeys ?? [];
  const totalDateGroups = data?.totalDateGroups ?? 0;
  const startDateIndex = data?.startDateIndex ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const filteredTotal = data?.filteredTotal ?? 0;

  const loading = isLoading || isFetching;

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
                View and manage all purchase orders
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
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 sm:w-64 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Search purchase orders by PO number, outlet, or region"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as PurchaseOrderStatusFilter);
                  setPage(1);
                }}
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
              onClick={() => {
                setActiveTab("current-week");
                setPage(1);
              }}
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
              onClick={() => {
                setActiveTab("past-weeks");
                setPage(1);
              }}
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
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Loading purchase orders...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-destructive"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span>Failed to load purchase orders</span>
                      <span className="text-sm text-muted-foreground">
                        {error instanceof Error ? error.message : "Please try again"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedDateKeys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No purchase orders found.
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
                      className="bg-muted/50 hover:bg-muted/50"
                    >
                      <TableCell
                        colSpan={8}
                        className="font-semibold text-foreground py-3"
                      >
                        {headerLabel}
                      </TableCell>
                    </TableRow>,
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

        {(totalDateGroups > 0 || filteredTotal > 0) && (
          <nav 
            className="mt-4 flex items-center justify-between text-xs text-muted-foreground"
            aria-label="Pagination"
          >
            <div aria-live="polite" aria-atomic="true">
              {totalDateGroups > 0 ? (
                <>
                  Showing delivery dates{" "}
                  <span className="font-medium">
                    {startDateIndex + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-medium">
                    {startDateIndex + paginatedDateKeys.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium">
                    {totalDateGroups}
                  </span>{" "}
                  (
                  <span className="font-medium">
                    {filteredTotal}
                  </span>{" "}
                  orders)
                </>
              ) : (
                <>
                  <span className="font-medium">0</span> delivery dates (
                  <span className="font-medium">{filteredTotal}</span> orders)
                </>
              )}
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="Page navigation">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span aria-current="page">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Go to next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}

export function useOutboundSummary() {
  const { data } = usePurchaseOrders({ page: 1 });
  return data?.summary;
}
