import { useState } from "react";
import type { ComponentProps } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
	type TransferDetail,
	type TransferStatus,
	type TransferStatusFilter,
	getTransfers,
	createTransfer,
	updateTransferStatus,
} from "@/data/transfers.mock-data";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	isInCurrentWeek,
	isInPastWeeks,
	getDateKey,
} from "@/lib/utils";
import {
	transferStatuses,
	createTransferSchema,
	formatStatus,
	DATE_GROUPS_PER_PAGE,
	type DeliveryTab,
} from "@/lib/outbound";
import {
	CreateTransferDialog,
	CreateTransferDialogTrigger,
	ViewTransferDialog,
	AcceptTransferDialog,
	RejectTransferDialog,
	OutboundListCard,
} from "@/components/outbound";

export const Route = createFileRoute("/admin/outbound")({
	component: TransfersRouteComponent,
});

function TransfersRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [activeTab, setActiveTab] = useState<DeliveryTab>("current-week");
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<TransferStatusFilter>("ALL");
	const [selectedTransfer, setSelectedTransfer] =
		useState<TransferDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
	const [rejectReason, setRejectReason] = useState("");

	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["transfers", { page, pageSize, searchTerm, statusFilter }],
		queryFn: () =>
			getTransfers({
				page,
				pageSize,
				search: searchTerm,
				status: statusFilter,
			}),
		staleTime: 30_000,
	});

	const createMutation = useMutation({
		mutationFn: createTransfer,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transfers"] });
			setIsCreateOpen(false);
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: TransferStatus }) =>
			updateTransferStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transfers"] });
		},
	});

	const form = useForm({
		defaultValues: {
			transferOrderNumber: "",
			outletId: "",
			outletName: "",
			expectedDeliveryDate: "",
			notes: "",
			items: [{ skuId: "", quantity: 1 }] as { skuId: string; skuCode?: string; description?: string; quantity: number }[],
		},
		validators: {
			onBlur: createTransferSchema as any,
			onSubmit: createTransferSchema as any,
		},
		onSubmit: async ({ value }) => {
			const parsedDate = new Date(value.expectedDeliveryDate);
			await createMutation.mutateAsync({
				transferOrderNumber: value.transferOrderNumber,
				outletId: value.outletId,
				outletName: value.outletName ?? "",
				expectedDeliveryDate: parsedDate,
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

	const allTransfers = data?.items ?? [];
	const filteredTransfers = allTransfers.filter((transfer) => {
		const deliveryDate = new Date(transfer.expectedDeliveryDate);
		if (activeTab === "current-week") {
			return isInCurrentWeek(deliveryDate);
		}
		return isInPastWeeks(deliveryDate);
	});

	const transfers = filteredTransfers.filter((transfer) => {
		const matchesSearch =
			!searchTerm ||
			transfer.transferOrderNumber
				.toLowerCase()
				.includes(searchTerm.toLowerCase()) ||
			transfer.toLocation.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus =
			statusFilter === "ALL" || transfer.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const transfersByDate = transfers.reduce<Record<string, TransferDetail[]>>(
		(acc, transfer) => {
			const key = getDateKey(new Date(transfer.expectedDeliveryDate));
			if (!acc[key]) acc[key] = [];
			acc[key].push(transfer);
			return acc;
		},
		{},
	);

	const dateKeys = Object.keys(transfersByDate).sort((a, b) =>
		activeTab === "current-week" ? a.localeCompare(b) : b.localeCompare(a),
	);

	const totalDateGroups = dateKeys.length;
	const startDateIndex = (page - 1) * DATE_GROUPS_PER_PAGE;
	const paginatedDateKeys = dateKeys.slice(
		startDateIndex,
		startDateIndex + DATE_GROUPS_PER_PAGE,
	);
	const totalPages = Math.max(1, Math.ceil(totalDateGroups / DATE_GROUPS_PER_PAGE));
	const filteredTotal = transfers.length;

	const summary = filteredTransfers.reduce(
		(acc, transfer) => {
			acc.byStatus[transfer.status] = (acc.byStatus[transfer.status] ?? 0) + 1;
			acc.total += 1;
			return acc;
		},
		{
			byStatus: {
				preparing: 0,
				"in-transit": 0,
				"to-ship": 0,
				cancel: 0,
				return: 0,
				other: 0,
			} as Record<TransferStatus, number>,
			total: 0,
		},
	);

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Pucrchase Orders from ES
					</h1>
					<p className="text-muted-foreground">
						Manage purchase orders from ES and create delivery orders
					</p>
				</div>
				<div className="flex gap-2">
					{hasPermission("to:refresh") && (
						<Button
							variant="outline"
							onClick={() => {
								queryClient.invalidateQueries({ queryKey: ["transfers"] });
							}}
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							Refresh from NetSuite
						</Button>
					)}
					<CreateTransferDialogTrigger
						open={isCreateOpen}
						onOpenChange={setIsCreateOpen}
						form={form as ComponentProps<typeof CreateTransferDialog>["form"]}
						createMutation={createMutation}
					/>
				</div>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-5">
					{transferStatuses.map((status) => (
						<Card key={status}>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">
									{formatStatus(status)}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{summary.byStatus[status] ?? 0}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<OutboundListCard
				searchTerm={searchTerm}
				onSearchTermChange={setSearchTerm}
				statusFilter={statusFilter}
				onStatusFilterChange={setStatusFilter}
				activeTab={activeTab}
				onActiveTabChange={setActiveTab}
				isLoading={isLoading}
				dateKeys={dateKeys}
				transfersByDate={transfersByDate}
				paginatedDateKeys={paginatedDateKeys}
				page={page}
				totalPages={totalPages}
				filteredTotal={filteredTotal}
				totalDateGroups={totalDateGroups}
				startDateIndex={startDateIndex}
				onPageChange={setPage}
				onViewTransfer={(transfer) => {
					setSelectedTransfer(transfer);
					setIsViewOpen(true);
				}}
				onAcceptClick={(transfer) => {
					setSelectedTransfer(transfer);
					setIsAcceptDialogOpen(true);
				}}
				onRejectClick={(transfer) => {
					setSelectedTransfer(transfer);
					setIsRejectDialogOpen(true);
				}}
				hasAcceptPermission={hasPermission("to:accept")}
				hasRejectPermission={hasPermission("to:reject")}
			/>

			<ViewTransferDialog
				open={isViewOpen}
				onOpenChange={setIsViewOpen}
				transfer={selectedTransfer}
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

			<AcceptTransferDialog
				open={isAcceptDialogOpen}
				onOpenChange={setIsAcceptDialogOpen}
				transfer={selectedTransfer}
				onAccept={() => {
								if (selectedTransfer) {
									statusMutation.mutate({
										id: selectedTransfer.id,
										status: "to-ship",
						});
									setIsAcceptDialogOpen(false);
								}
							}}
				isPending={statusMutation.isPending}
			/>

			<RejectTransferDialog
				open={isRejectDialogOpen}
				onOpenChange={setIsRejectDialogOpen}
				rejectReason={rejectReason}
				onRejectReasonChange={setRejectReason}
				onReject={() => {
								if (selectedTransfer && rejectReason) {
									statusMutation.mutate({
										id: selectedTransfer.id,
										status: "cancel",
						});
									setIsRejectDialogOpen(false);
						setRejectReason("");
					}
				}}
				isPending={statusMutation.isPending}
			/>
		</div>
	);
}
