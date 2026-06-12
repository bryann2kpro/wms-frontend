import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronLeft,
	ChevronRight,
	Edit,
	Plus,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cancelReservation, fetchReservations } from "@/data/reservations";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import type { StockReservation } from "@/lib/graphql/reservations";
import { SKUS_AND_UOM_QUERY, type SkusAndUomQueryData } from "@/lib/graphql/skus";
import { cn, formatDate, getErrorMessage } from "@/lib/utils";
import { ReservationFormDialog } from "./reservation-form-dialog";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
	ACTIVE: "bg-green-500/10 text-green-700 border-green-500/20",
	EXPIRED: "bg-amber-500/10 text-amber-700 border-amber-500/20",
	CANCELLED: "bg-red-500/10 text-red-700 border-red-500/20",
	CONSUMED: "bg-blue-500/10 text-blue-700 border-blue-500/20",
	RELEASED: "bg-gray-500/10 text-gray-700 border-gray-500/20",
};

type StatusFilter = "ALL" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export function ReservationListCard({ className }: { className?: string }) {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<StockReservation | null>(null);

	const queryVars = {
		filter:
			statusFilter === "ALL"
				? undefined
				: { status: statusFilter },
		pageSize: PAGE_SIZE,
		pageNumber: page,
	};

	const { data, isLoading } = useQuery({
		queryKey: qk.reservations.list(queryVars),
		queryFn: () => fetchReservations(queryVars),
	});

	const { data: skusData } = useQuery({
		queryKey: [...qk.skus.all, "reservation-list"] as const,
		queryFn: () =>
			gqlRequest<SkusAndUomQueryData>(SKUS_AND_UOM_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
	});

	const skuLabelById = new Map(
		(skusData?.skus?.query ?? []).map((s) => [s.skuId, s.skuCode]),
	);

	const cancelMutation = useMutation({
		mutationFn: cancelReservation,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: qk.reservations.all });
			toast.success("Reservation cancelled");
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const rows = data?.query ?? [];
	const pagination = data?.pagination;

	return (
		<Card className={cn("flex min-h-0 flex-col", className)}>
			<CardHeader className="shrink-0 flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
				<div>
					<CardTitle>Reservations</CardTitle>
					<CardDescription>
						Active and expired stock holds by customer and SKU.
					</CardDescription>
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={statusFilter}
						onValueChange={(v) => {
							setStatusFilter(v as StatusFilter);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-[140px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ACTIVE">Active</SelectItem>
							<SelectItem value="EXPIRED">Expired</SelectItem>
							<SelectItem value="CANCELLED">Cancelled</SelectItem>
							<SelectItem value="ALL">All</SelectItem>
						</SelectContent>
					</Select>
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="mr-1 h-4 w-4" />
						New reservation
					</Button>
				</div>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 overflow-x-auto">
				{isLoading ? (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : (
					<>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Reservation #</TableHead>
									<TableHead>Customer</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead>Qty</TableHead>
									<TableHead>Window</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell colSpan={7} className="text-center text-muted-foreground">
											No reservations found.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell className="font-mono text-sm">
												{row.reservationNo}
											</TableCell>
											<TableCell>{row.customerCode}</TableCell>
											<TableCell>
												{skuLabelById.get(row.skuId) ?? row.skuId.slice(0, 8)}
											</TableCell>
											<TableCell>{row.qtyReserved}</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDate(row.reserveStart)} → {formatDate(row.reserveEnd)}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={STATUS_STYLES[row.status] ?? ""}
												>
													{row.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													{row.status === "ACTIVE" ? (
														<>
															<Button
																size="icon"
																variant="ghost"
																onClick={() => setEditing(row)}
																aria-label="Edit reservation"
															>
																<Edit className="h-4 w-4" />
															</Button>
															<Button
																size="icon"
																variant="ghost"
																onClick={() => cancelMutation.mutate(row.id)}
																disabled={cancelMutation.isPending}
																aria-label="Cancel reservation"
															>
																<XCircle className="h-4 w-4 text-destructive" />
															</Button>
														</>
													) : null}
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>

						{pagination && pagination.totalPages > 1 ? (
							<div className="mt-4 flex items-center justify-between">
								<p className="text-sm text-muted-foreground">
									Page {pagination.currentPage} of {pagination.totalPages} (
									{pagination.totalCount} total)
								</p>
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										disabled={!pagination.hasPrevPage}
										onClick={() => setPage((p) => Math.max(1, p - 1))}
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="outline"
										disabled={!pagination.hasNextPage}
										onClick={() => setPage((p) => p + 1)}
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
						) : null}
					</>
				)}
			</CardContent>

			<ReservationFormDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onSuccess={() =>
					queryClient.invalidateQueries({ queryKey: qk.reservations.all })
				}
			/>
			<ReservationFormDialog
				open={Boolean(editing)}
				onOpenChange={(open) => !open && setEditing(null)}
				reservation={editing}
				onSuccess={() => {
					queryClient.invalidateQueries({ queryKey: qk.reservations.all });
					setEditing(null);
				}}
			/>
		</Card>
	);
}
