import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	REGIONS_QUERY,
	type RegionsQueryData,
	type RegionsQueryVariables,
} from "@/lib/graphql/regions";
import {
	DELIVERY_SCHEDULES_QUERY,
	CREATE_DELIVERY_SCHEDULE_MUTATION,
	UPDATE_DELIVERY_SCHEDULE_MUTATION,
	TOGGLE_DELIVERY_SCHEDULE_ACTIVE_MUTATION,
	DELETE_DELIVERY_SCHEDULE_MUTATION,
	type DeliverySchedulesQueryData,
	type DeliverySchedulesQueryVariables,
	type CreateDeliveryScheduleMutationData,
	type UpdateDeliveryScheduleMutationData,
	type ToggleDeliveryScheduleActiveMutationData,
	type DeleteDeliveryScheduleMutationData,
} from "@/lib/graphql/delivery-schedules";
import type { DeliverySchedule } from "@/lib/graphql/types";
import { Plus, Edit, Trash2 } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";
import { DeliveryScheduleFormDialog } from "./delivery-schedule-form-dialog";

export function DeliveryScheduleSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [regionIdFilter, setRegionIdFilter] = useState<string>("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<DeliverySchedule | null>(null);
	const [deleting, setDeleting] = useState<DeliverySchedule | null>(null);

	const { data: regionsData } = useQuery({
		queryKey: [...qk.regions.all, { pageSize: 200, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<RegionsQueryData, RegionsQueryVariables>(REGIONS_QUERY, {
				pageSize: 200,
				pageNumber: 1,
			}),
	});
	const regions = regionsData?.regions?.query ?? [];

	const schedulesVars: DeliverySchedulesQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		...(regionIdFilter ? { filter: { regionId: regionIdFilter } } : {}),
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.deliverySchedules.all, schedulesVars],
		queryFn: () =>
			gqlRequest<DeliverySchedulesQueryData, DeliverySchedulesQueryVariables>(
				DELIVERY_SCHEDULES_QUERY,
				schedulesVars,
			),
	});

	const { mutate: createSchedule, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateDeliveryScheduleMutationData>(
				CREATE_DELIVERY_SCHEDULE_MUTATION,
				{ input },
			),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateSchedule, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateDeliveryScheduleMutationData>(
				UPDATE_DELIVERY_SCHEDULE_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: toggleActive } = useMutation({
		mutationFn: (variables: {
			id: string;
			isActive: boolean;
			updatedBy: string;
		}) =>
			gqlRequest<ToggleDeliveryScheduleActiveMutationData>(
				TOGGLE_DELIVERY_SCHEDULE_ACTIVE_MUTATION,
				variables,
			),
		onSuccess: () => refetch(),
	});
	const { mutate: deleteSchedule, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteDeliveryScheduleMutationData>(
				DELETE_DELIVERY_SCHEDULE_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});

	const list = data?.deliverySchedules?.query ?? [];
	const pagination = data?.deliverySchedules?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Delivery Schedules
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Recurring delivery days and cutoffs by region
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={regionIdFilter || "all"}
							onValueChange={(v) => {
								setRegionIdFilter(v === "all" ? "" : v);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-48 rounded-lg border-muted-foreground/20">
								<SelectValue placeholder="All regions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All regions</SelectItem>
								{regions.map((r) => (
									<SelectItem key={r.regionId} value={r.regionId}>
										{r.regionName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Schedule
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative px-0 pb-6">
				<GlobalLoadingShadow />
				<div className="mx-6 overflow-x-auto rounded-xl border">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Region
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Day
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Cutoff (days before)
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Cutoff time
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Active
								</TableHead>
								<TableHead
									className="px-6 text-right"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No delivery schedules found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow
										key={row.scheduleId}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6 font-medium">
											{row.regionName}
											<span className="ml-1 font-normal text-muted-foreground">
												({row.regionCode})
											</span>
										</TableCell>
										<TableCell className="px-6">{row.dayName}</TableCell>
										<TableCell className="px-6">
											{row.cutoffDaysBefore}
										</TableCell>
										<TableCell className="px-6 font-mono text-sm">
											{row.cutoffTime}
										</TableCell>
										<TableCell className="px-6">
											<Badge
												variant="outline"
												className={
													row.isActive
														? "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-950/30 dark:border-green-500/30"
														: "bg-muted text-muted-foreground"
												}
											>
												{row.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="px-6 text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													toggleActive({
														id: row.scheduleId,
														isActive: !row.isActive,
														updatedBy: createdBy,
													})
												}
												title={row.isActive ? "Deactivate" : "Activate"}
												className="rounded-lg"
											>
												{row.isActive ? "Deactivate" : "Activate"}
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
												className="rounded-lg"
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive rounded-lg"
												onClick={() => setDeleting(row)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{pagination && totalPages > 1 && (
					<div className="mx-6 mt-4 flex items-center justify-between">
						<p
							className="text-sm text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Page{" "}
							<span className="font-semibold tabular-nums text-foreground">
								{currentPage}
							</span>{" "}
							of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								className="rounded-lg"
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								className="rounded-lg"
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<DeliveryScheduleFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				regions={regions}
				onSubmit={(values) =>
					createSchedule({
						regionId: values.regionId,
						dayOfWeek: values.dayOfWeek,
						cutoffDaysBefore: values.cutoffDaysBefore,
						cutoffTime: values.cutoffTime,
						isActive: values.isActive ?? true,
						createdBy,
						updatedBy: createdBy,
					})
				}
				loading={createLoading}
				title="Add Delivery Schedule"
				description="Add a recurring delivery day for a region."
			/>

			{editing && (
				<DeliveryScheduleFormDialog
					key={editing.scheduleId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					regions={regions}
					initial={{
						dayOfWeek: editing.dayOfWeek,
						cutoffDaysBefore: editing.cutoffDaysBefore,
						cutoffTime: editing.cutoffTime,
						isActive: editing.isActive,
					}}
					onSubmit={(values) =>
						updateSchedule({
							id: editing.scheduleId,
							input: {
								dayOfWeek: values.dayOfWeek,
								cutoffDaysBefore: values.cutoffDaysBefore,
								cutoffTime: values.cutoffTime,
								isActive: values.isActive,
								updatedBy: createdBy,
							},
						})
					}
					loading={updateLoading}
					title="Edit Delivery Schedule"
					description="Update schedule details."
					hideRegion
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={`${deleting.regionName} - ${deleting.dayName}`}
					onConfirm={() => deleteSchedule({ id: deleting.scheduleId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}
