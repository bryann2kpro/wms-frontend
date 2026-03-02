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
import type { TransferDetail, TransferStatusFilter } from "@/data/transfers.types";
import {
  transferStatuses,
  getStatusColor,
  getNetSuiteStatusColor,
  formatStatus,
  getTransferStatusColor,
} from "@/lib/outbound";
import { formatDeliveryDateHeader } from "@/lib/utils";
import type { DeliveryTab } from "@/lib/outbound";

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
                <TableHead>DO Created?</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>NetSuite (API)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
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
              ) : dateKeys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No delivery orders found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDateKeys.flatMap((dateKey) => {
                  const dateTransfers = transfersByDate[dateKey] ?? [];
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
                      const doCreated =
                        transfer.status === "to-ship" ||
                        transfer.status === "in-transit";
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-medium">
                            {transfer.transferOrderNumber}
                          </TableCell>
                          <TableCell>{transfer.toLocation}</TableCell>
                          <TableCell>
                            {transfer.regionName
                              ? `${transfer.regionName}${transfer.regionCode ? ` (${transfer.regionCode})` : ""}`
                              : "—"}
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
                  of <span className="font-medium">{totalDateGroups}</span> (
                  <span className="font-medium">{filteredTotal}</span> orders)
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
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
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
