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
} from "lucide-react";
import type {
  TransferDetail,
  TransferStatusFilter,
} from "@/data/transfers.types";
import {
  transferStatuses,
  getStatusColor,
  getNetSuiteStatusColor,
  formatStatus,
  getTransferStatusColor,
  DATE_GROUPS_PER_PAGE,
} from "@/lib/outbound";
import { formatDeliveryDateHeader, getDateKey } from "@/lib/utils";
import type { DeliveryTab } from "@/lib/outbound";
import { useQuery as useApolloQuery } from "@apollo/client/react";
import {
  DELIVERY_ORDERS_QUERY,
  type DeliveryOrdersQueryData,
  type DeliveryOrdersQueryVariables,
  mapDeliveryOrdersToTransfers,
} from "@/lib/graphql/delivery-orders";
import {
  PURCHASE_ORDERS_QUERY,
  type PurchaseOrdersQueryData,
  type PurchaseOrdersQueryVariables,
  mapPurchaseOrdersToTransfers,
} from "@/lib/graphql/purchase-orders";
import {
  OUTLETS_QUERY,
  type OutletsQueryData,
  type OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import {
  REGIONS_QUERY,
  type RegionsQueryData,
  type RegionsQueryVariables,
} from "@/lib/graphql/regions";
import {
  DELIVERY_SCHEDULES_QUERY,
  type DeliverySchedulesQueryData,
  type DeliverySchedulesQueryVariables,
} from "@/lib/graphql/delivery-schedules";

interface OutboundListCardProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: TransferStatusFilter;
  onStatusFilterChange: (value: TransferStatusFilter) => void;
  activeTab: DeliveryTab;
  onActiveTabChange: (tab: DeliveryTab) => void;
  isLoading: boolean;
  dateKeys: string[];
  transfersByDate: Record<string, TransferDetail[]>;
  paginatedDateKeys: string[];
  page: number;
  totalPages: number;
  filteredTotal: number;
  totalDateGroups: number;
  startDateIndex: number;
  onPageChange: (page: number) => void;
  onViewTransfer: (transfer: TransferDetail) => void;
  onAcceptClick: (transfer: TransferDetail) => void;
  onRejectClick: (transfer: TransferDetail) => void;
  hasAcceptPermission: boolean;
  hasRejectPermission: boolean;
}

export function OutboundListCard({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  activeTab,
  onActiveTabChange,
  isLoading,
  dateKeys,
  transfersByDate,
  paginatedDateKeys,
  page,
  totalPages,
  filteredTotal,
  totalDateGroups,
  startDateIndex,
  onPageChange,
  onViewTransfer,
  onAcceptClick,
  onRejectClick,
  hasAcceptPermission,
  hasRejectPermission,
}: OutboundListCardProps) {
  const {
    data: purchaseOrdersData,
    loading: purchaseOrdersLoading,
  } = useApolloQuery<PurchaseOrdersQueryData, PurchaseOrdersQueryVariables>(
    PURCHASE_ORDERS_QUERY,
    {
      variables: {
        filter: undefined,
        pageSize: 50,
        pageNumber: 1,
      },
      fetchPolicy: "cache-and-network",
    },
  );

  const {
    data: deliveryOrdersData,
    loading: deliveryOrdersLoading,
  } = useApolloQuery<DeliveryOrdersQueryData, DeliveryOrdersQueryVariables>(
    DELIVERY_ORDERS_QUERY,
    {
      variables: {
        filter: undefined,
        pageSize: 50,
        pageNumber: 1,
      },
      fetchPolicy: "cache-and-network",
    },
  );

  const { data: outletsData } = useApolloQuery<
    OutletsQueryData,
    OutletsQueryVariables
  >(OUTLETS_QUERY, {
    variables: { filter: {}, pageSize: 500, pageNumber: 1 },
    fetchPolicy: "cache-and-network",
  });

  const { data: regionsData } = useApolloQuery<
    RegionsQueryData,
    RegionsQueryVariables
  >(REGIONS_QUERY, {
    variables: { filter: {}, pageSize: 500, pageNumber: 1 },
    fetchPolicy: "cache-and-network",
  });

  const { data: schedulesData } = useApolloQuery<
    DeliverySchedulesQueryData,
    DeliverySchedulesQueryVariables
  >(DELIVERY_SCHEDULES_QUERY, {
    variables: { filter: {}, pageSize: 500, pageNumber: 1 },
    fetchPolicy: "cache-and-network",
  });

  const mapped =
    deliveryOrdersData?.deliveryOrders != null
      ? mapDeliveryOrdersToTransfers(deliveryOrdersData.deliveryOrders)
      : null;

  const graphqlTransfers: TransferDetail[] = mapped?.items ?? [];
  const purchaseTransfers: TransferDetail[] =
    purchaseOrdersData?.purchaseOrders != null
      ? mapPurchaseOrdersToTransfers(purchaseOrdersData.purchaseOrders).items
      : [];

  // Index PO and DO by PO number so we can enrich the main list rows
  const poByNumber = new Map<string, TransferDetail>();
  for (const po of purchaseTransfers) {
    poByNumber.set(po.transferOrderNumber, po);
  }
  const doByNumber = new Map<string, TransferDetail>();
  for (const order of graphqlTransfers) {
    doByNumber.set(order.transferOrderNumber, order);
  }

  // Map purchase order number -> outletId, and outletId -> outlet (for outletName)
  const outletIdByPoNo = new Map<string, string | undefined>();
  for (const po of purchaseOrdersData?.purchaseOrders.query ?? []) {
    outletIdByPoNo.set(po.purchaseOrderNo, po.outletId);
  }

  const outlets = outletsData?.outlets?.query ?? [];
  const outletById = new Map<string, (typeof outlets)[number]>();
  for (const o of outlets) {
    outletById.set(o.outletId, o);
  }

  // Map regionId -> region and regionId -> delivery schedules
  const regions = regionsData?.regions?.query ?? [];
  const regionById = new Map<string, (typeof regions)[number]>();
  for (const r of regions) {
    regionById.set(r.regionId, r);
  }

  const schedules = schedulesData?.deliverySchedules?.query ?? [];
  const schedulesByRegionId = new Map<
    string,
    (typeof schedules)[number][]
  >();
  for (const s of schedules) {
    const list = schedulesByRegionId.get(s.regionId) ?? [];
    list.push(s);
    schedulesByRegionId.set(s.regionId, list);
  }

  // If there are no transfer groups from the legacy source but we do have PO/DO data,
  // build fallback groups from GraphQL data so the table still shows rows.
  const useFallbackGroups =
    dateKeys.length === 0 &&
    (purchaseTransfers.length > 0 || graphqlTransfers.length > 0);

  let effectiveTransfersByDate: Record<string, TransferDetail[]> =
    transfersByDate;
  let effectiveDateKeys = dateKeys;
  let effectivePaginatedDateKeys = paginatedDateKeys;
  let effectiveTotalDateGroups = totalDateGroups;
  let effectiveFilteredTotal = filteredTotal;
  let effectiveStartDateIndex = startDateIndex;
  let effectiveTotalPages = totalPages;

  if (useFallbackGroups) {
    const base: TransferDetail[] =
      purchaseTransfers.length > 0 ? purchaseTransfers : graphqlTransfers;

    const grouped: Record<string, TransferDetail[]> = {};
    for (const t of base) {
      const key = getDateKey(new Date(t.expectedDeliveryDate));
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    }

    const keys = Object.keys(grouped).sort((a, b) =>
      activeTab === "current-week" ? a.localeCompare(b) : b.localeCompare(a),
    );

    const totalGroups = keys.length;
    const startIndex = (page - 1) * DATE_GROUPS_PER_PAGE;
    const pageKeys = keys.slice(
      startIndex,
      startIndex + DATE_GROUPS_PER_PAGE,
    );
    const totalPagesFallback = Math.max(
      1,
      Math.ceil(totalGroups / DATE_GROUPS_PER_PAGE),
    );

    effectiveTransfersByDate = grouped;
    effectiveDateKeys = keys;
    effectivePaginatedDateKeys = pageKeys;
    effectiveTotalDateGroups = totalGroups;
    effectiveFilteredTotal = base.length;
    effectiveStartDateIndex = startIndex;
    effectiveTotalPages = totalPagesFallback;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Delivery Order List</CardTitle>
              <CardDescription>
                View and manage all delivery orders
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search transfers..."
                  value={searchTerm}
                  onChange={(e) => {
                    onSearchTermChange(e.target.value);
                    onPageChange(1);
                  }}
                  className="pl-9 sm:w-64"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  onStatusFilterChange(value as TransferStatusFilter);
                  onPageChange(1);
                }}
              >
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  {transferStatuses.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}
                      className={getTransferStatusColor(status)}
                    >
                      {formatStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 border-b">
            <Button
              variant={activeTab === "current-week" ? "default" : "ghost"}
              onClick={() => {
                onActiveTabChange("current-week");
                onPageChange(1);
              }}
              className="rounded-b-none"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Next Delivery
            </Button>
            <Button
              variant={activeTab === "past-weeks" ? "default" : "ghost"}
              onClick={() => {
                onActiveTabChange("past-weeks");
                onPageChange(1);
              }}
              className="rounded-b-none"
            >
              <Clock className="mr-2 h-4 w-4" />
              Past Deliveries
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <GlobalLoadingShadow />
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Schedule Delivery Date</TableHead>
                <TableHead>DO Created?</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>NetSuite (API)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || purchaseOrdersLoading || deliveryOrdersLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    Loading delivery orders...
                  </TableCell>
                </TableRow>
              ) : effectiveDateKeys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No delivery orders found.
                  </TableCell>
                </TableRow>
              ) : (
                effectivePaginatedDateKeys.flatMap((dateKey) => {
                  const dateTransfers = effectiveTransfersByDate[dateKey] ?? [];
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
                    ...dateTransfers.map((transfer) => {
                      const linkedDo = doByNumber.get(
                        transfer.transferOrderNumber,
                      );
                      const outletIdForTransfer = outletIdByPoNo.get(
                        transfer.transferOrderNumber,
                      );
                      const outletForTransfer =
                        outletIdForTransfer != null
                          ? outletById.get(outletIdForTransfer)
                          : undefined;

                      const regionIdForTransfer =
                        outletForTransfer?.regionId ?? null;
                      const regionForTransfer =
                        regionIdForTransfer != null
                          ? regionById.get(regionIdForTransfer)
                          : undefined;

                      const schedulesForRegion =
                        regionIdForTransfer != null
                          ? schedulesByRegionId.get(regionIdForTransfer) ?? []
                          : [];

                      const scheduleLabel =
                        schedulesForRegion.length > 0
                          ? schedulesForRegion
                              .map((s) => s.dayName)
                              .join(", ")
                          : null;

                      const doCreated =
                        !!linkedDo ||
                        transfer.status === "to-ship" ||
                        transfer.status === "in-transit";
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-medium">
                            {transfer.transferOrderNumber}
                          </TableCell>
                          <TableCell>
                            {outletForTransfer?.outletName ??
                              transfer.toLocation}
                          </TableCell>
                          <TableCell>
                            {regionForTransfer?.regionName ||
                            outletForTransfer?.regionName ||
                            transfer.regionName ? (
                              <div className="flex flex-col">
                                <span>
                                  {regionForTransfer?.regionName ??
                                    outletForTransfer?.regionName ??
                                    transfer.regionName}
                                  {(() => {
                                    const code =
                                      regionForTransfer?.regionCode ??
                                      outletForTransfer?.regionCode ??
                                      transfer.regionCode;
                                    return code
                                      ? ` (${code})`
                                      : "";
                                  })()}
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(transfer.expectedDeliveryDate).toLocaleDateString()}
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
                              className={getStatusColor(transfer.status)}
                            >
                              {formatStatus(transfer.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getNetSuiteStatusColor(
                                transfer.netsuiteStatus,
                              )}
                            >
                              {transfer.netsuiteStatus || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onViewTransfer(transfer)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasAcceptPermission &&
                                transfer.status === "preparing" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onAcceptClick(transfer)}
                                  >
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                )}
                              {hasRejectPermission &&
                                transfer.status === "preparing" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onRejectClick(transfer)}
                                  >
                                    <XCircle className="h-4 w-4 text-red-600" />
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
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {effectiveTotalDateGroups > 0 ? (
                <>
                  Showing delivery dates{" "}
                  <span className="font-medium">
                    {effectiveStartDateIndex + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-medium">
                    {effectiveStartDateIndex + effectivePaginatedDateKeys.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium">
                    {effectiveTotalDateGroups}
                  </span>{" "}
                  (
                  <span className="font-medium">
                    {effectiveFilteredTotal}
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Page {page} of {effectiveTotalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page === effectiveTotalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
