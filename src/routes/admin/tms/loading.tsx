import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, PackageCheck, Truck, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { DRIVERS_QUERY, type DriversQueryData, type DriversQueryVariables } from "@/lib/graphql/drivers";
import {
	ASSIGN_BATCH_DRIVER_MUTATION,
	COMPLETE_BATCH_MUTATION,
	CONFIRM_BATCH_LOADING_MUTATION,
	LOAD_BATCHES_QUERY,
	UNASSIGN_BATCH_DRIVER_MUTATION,
	UNDO_LOAD_BATCH_MUTATION,
	type AssignBatchDriverData,
	type AssignBatchDriverVariables,
	type CompleteBatchData,
	type CompleteBatchVariables,
	type ConfirmBatchLoadingData,
	type ConfirmBatchLoadingVariables,
	type LoadBatchesQueryData,
	type LoadBatchesQueryVariables,
	type UnassignBatchDriverData,
	type UnassignBatchDriverVariables,
	type UndoLoadBatchData,
	type UndoLoadBatchVariables,
} from "@/lib/graphql/loading";
import type { LoadBatch } from "@/lib/graphql/types";
import { toUserFriendlyMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/tms/loading")({
	component: TmsLoadingPage,
	head: () => ({
		meta: [
			{
				title: "Loading - SME Edaran WMS",
				description: "Assign drivers and confirm vehicle loading per batch.",
			},
		],
	}),
});

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string }> })
			.graphQLErrors?.[0];
		if (first?.message) {
			return toUserFriendlyMessage(
				first.message,
				"Something went wrong. Please try again.",
			);
		}
	}
	if (err instanceof Error) {
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	}
	return "Something went wrong. Please try again.";
}

function StatusBadge({ status }: { status: string }) {
	const variant =
		status === "DONE" ? "secondary" : status === "LOADING" ? "default" : "outline";
	return (
		<Badge variant={variant} className="text-xs">
			{status}
		</Badge>
	);
}

function LoadingBayDialog({
	batch,
	open,
	onOpenChange,
	onConfirm,
	confirming,
}: {
	batch: LoadBatch;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (doIds: string[]) => void;
	confirming: boolean;
}) {
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const capacity = batch.driver?.pallet4x3 ? Math.round(Number(batch.driver.pallet4x3)) : 10;
	const count = selected.size;
	const isFull = count >= capacity;
	const allSelected = batch.stops.length > 0 && batch.stops.every((s) => selected.has(s.doId));

	function toggle(doId: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(doId)) next.delete(doId);
			else next.add(doId);
			return next;
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (v) setSelected(new Set());
				onOpenChange(v);
			}}
		>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Truck className="h-4 w-4" />
						Loading Bay
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Vehicle capacity</span>
						<span className={isFull ? "text-red-600 font-semibold" : "font-medium"}>
							{count} / {capacity} selected
						</span>
					</div>
					<div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className={`h-full rounded-full transition-all ${isFull ? "bg-red-500" : "bg-blue-500"}`}
							style={{ width: `${Math.min((count / capacity) * 100, 100)}%` }}
						/>
					</div>
				</div>
				<div className="max-h-72 overflow-y-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-14 text-center">Load #</TableHead>
								<TableHead>DO / Outlet</TableHead>
								<TableHead className="w-20">Bin</TableHead>
								<TableHead className="w-10 text-center">
									<Checkbox
										checked={allSelected}
										onCheckedChange={(v) =>
											setSelected(v ? new Set(batch.stops.map((s) => s.doId)) : new Set())
										}
									/>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{batch.stops.map((stop) => {
								const checked = selected.has(stop.doId);
								return (
									<TableRow
										key={stop.doId}
										className={checked ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}
										onClick={() => toggle(stop.doId)}
									>
										<TableCell className="text-center font-mono text-sm font-bold">
											{stop.loadOrder ?? "—"}
										</TableCell>
										<TableCell>
											<div className="text-sm font-medium">{stop.outletName ?? "—"}</div>
											<div className="font-mono text-xs text-muted-foreground">
												{stop.doNo}
											</div>
										</TableCell>
										<TableCell className="font-mono text-xs">{stop.stagingBin ?? "—"}</TableCell>
										<TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
											<Checkbox checked={checked} onCheckedChange={() => toggle(stop.doId)} />
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={count === 0 || confirming} onClick={() => onConfirm([...selected])}>
						<PackageCheck className="mr-1.5 h-3.5 w-3.5" />
						{confirming ? "Confirming…" : `Done (${count} loaded)`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function BatchCard({
	batch,
	drivers,
	assignedDriverIds,
}: {
	batch: LoadBatch;
	drivers: { id: string; name: string; plateNumber?: string | null; vehicleType?: string | null }[];
	assignedDriverIds: Set<string>;
}) {
	const queryClient = useQueryClient();
	const [collapsed, setCollapsed] = useState(true);
	const [selectedDriverId, setSelectedDriverId] = useState("");
	const [bayOpen, setBayOpen] = useState(false);

	const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.loadBatches.all });

	const assignMutation = useMutation({
		mutationFn: (vars: AssignBatchDriverVariables) =>
			gqlRequest<AssignBatchDriverData, AssignBatchDriverVariables>(
				ASSIGN_BATCH_DRIVER_MUTATION,
				vars,
			),
		onSuccess: () => {
			toast.success("Driver assigned");
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const unassignMutation = useMutation({
		mutationFn: (vars: UnassignBatchDriverVariables) =>
			gqlRequest<UnassignBatchDriverData, UnassignBatchDriverVariables>(
				UNASSIGN_BATCH_DRIVER_MUTATION,
				vars,
			),
		onSuccess: () => {
			toast.success("Driver removed");
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const confirmMutation = useMutation({
		mutationFn: (vars: ConfirmBatchLoadingVariables) =>
			gqlRequest<ConfirmBatchLoadingData, ConfirmBatchLoadingVariables>(
				CONFIRM_BATCH_LOADING_MUTATION,
				vars,
			),
		onSuccess: () => {
			toast.success("Load confirmed");
			setBayOpen(false);
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const completeMutation = useMutation({
		mutationFn: (vars: CompleteBatchVariables) =>
			gqlRequest<CompleteBatchData, CompleteBatchVariables>(COMPLETE_BATCH_MUTATION, vars),
		onSuccess: () => {
			toast.success("Batch completed");
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const undoMutation = useMutation({
		mutationFn: (vars: UndoLoadBatchVariables) =>
			gqlRequest<UndoLoadBatchData, UndoLoadBatchVariables>(UNDO_LOAD_BATCH_MUTATION, vars),
		onSuccess: () => {
			toast.success("Reverted to pending");
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const availableDrivers = drivers.filter(
		(d) => !assignedDriverIds.has(d.id) || d.id === batch.driver?.id,
	);
	const done = batch.status === "DONE";
	const allLoaded = batch.stops.length > 0 && batch.stops.every((s) => s.loadedAt);

	return (
		<div
			className={`overflow-hidden rounded-md ${done ? "border border-border opacity-70" : "border-2 border-emerald-300 dark:border-emerald-800"}`}
		>
			<div
				role="button"
				tabIndex={0}
				onClick={() => setCollapsed((c) => !c)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setCollapsed((c) => !c);
					}
				}}
				className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left ${done ? "bg-muted/40" : "bg-emerald-50 dark:bg-emerald-950/20"}`}
			>
				<ChevronRight
					className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-90"}`}
				/>
				<span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
					{batch.regionName ?? "Unknown"} {batch.regionCode ? `(${batch.regionCode})` : ""}
				</span>
				<div className="min-w-0 flex-1">
					{batch.status === "PENDING_DRIVER" ? (
						<span className="text-xs italic text-muted-foreground">No driver assigned</span>
					) : (
						<div className="flex items-center gap-2">
							<span className="truncate text-sm font-semibold">{batch.driver?.name}</span>
							{batch.driver?.plateNumber && (
								<span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
									{batch.driver.plateNumber}
								</span>
							)}
						</div>
					)}
				</div>
				<StatusBadge status={batch.status} />
				{batch.status === "LOADING" && (
					<div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
						{!allLoaded && (
							<Button size="sm" onClick={() => setBayOpen(true)}>
								Load
							</Button>
						)}
						{allLoaded && (
							<Button
								size="sm"
								disabled={completeMutation.isPending}
								onClick={() => completeMutation.mutate({ batchId: batch.id })}
							>
								{completeMutation.isPending ? "Completing…" : "Complete"}
							</Button>
						)}
						<Button
							size="sm"
							variant="outline"
							disabled={unassignMutation.isPending}
							onClick={() => unassignMutation.mutate({ batchId: batch.id })}
						>
							Reassign
						</Button>
					</div>
				)}
			</div>

			{!collapsed && (
				<>
					{batch.status === "PENDING_DRIVER" && (
						<div
							className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2.5"
							onClick={(e) => e.stopPropagation()}
						>
							<Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
								<SelectTrigger className="h-8 w-56 text-sm">
									<SelectValue placeholder="Select driver…" />
								</SelectTrigger>
								<SelectContent>
									{availableDrivers.map((d) => (
										<SelectItem key={d.id} value={d.id}>
											<div className="flex items-center gap-2">
												{d.name}
												{d.plateNumber && (
													<span className="font-mono text-xs text-muted-foreground">
														{d.plateNumber}
													</span>
												)}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								size="sm"
								disabled={!selectedDriverId || assignMutation.isPending}
								onClick={() =>
									assignMutation.mutate({ batchId: batch.id, driverId: selectedDriverId })
								}
							>
								<Truck className="mr-1.5 h-3.5 w-3.5" />
								{assignMutation.isPending ? "Assigning…" : "Assign"}
							</Button>
						</div>
					)}

					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-14 text-center">Load #</TableHead>
									<TableHead className="w-48">DO / Outlet</TableHead>
									<TableHead className="w-80">Address</TableHead>
									<TableHead className="w-24">Staging Bin</TableHead>
									<TableHead className="w-24">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{[...batch.stops]
									.sort((a, b) => (a.loadOrder ?? 9999) - (b.loadOrder ?? 9999))
									.map((stop) => (
										<TableRow key={stop.doId}>
											<TableCell className="text-center font-mono text-sm font-bold">
												{stop.loadOrder ?? "—"}
											</TableCell>
											<TableCell className="w-48">
												<div className="truncate text-sm font-medium">
													{stop.outletName ?? "—"}
												</div>
												<div className="font-mono text-xs text-muted-foreground">
													{stop.doNo}
												</div>
											</TableCell>
											<TableCell className="w-64 whitespace-normal break-words text-xs text-muted-foreground">
												{stop.outletAddress ?? "—"}
											</TableCell>
											<TableCell>
												{stop.stagingBin ? (
													<span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
														{stop.stagingBin}
													</span>
												) : (
													<span className="text-xs text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell>
												{stop.loadedAt ? (
													<span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-950/20 dark:text-green-400">
														Loaded
													</span>
												) : (
													<span className="text-xs text-muted-foreground">—</span>
												)}
											</TableCell>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</div>

					{!done && (
						<div className="flex justify-end border-t bg-muted/20 px-4 py-2">
							<button
								type="button"
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
								disabled={undoMutation.isPending}
								onClick={() => undoMutation.mutate({ batchId: batch.id })}
							>
								<Undo2 className="h-3.5 w-3.5" />
								{undoMutation.isPending ? "Undoing…" : "Undo"}
							</button>
						</div>
					)}

					<LoadingBayDialog
						batch={batch}
						open={bayOpen}
						onOpenChange={setBayOpen}
						confirming={confirmMutation.isPending}
						onConfirm={(doIds) => confirmMutation.mutate({ batchId: batch.id, loadedDoIds: doIds })}
					/>
				</>
			)}
		</div>
	);
}

function TmsLoadingPage() {
	const queryVars: LoadBatchesQueryVariables = {};

	const { data, isLoading, isFetching } = useQuery({
		queryKey: qk.loadBatches.list(queryVars),
		queryFn: () =>
			gqlRequest<LoadBatchesQueryData, LoadBatchesQueryVariables>(LOAD_BATCHES_QUERY, queryVars),
	});

	const { data: driversData } = useQuery({
		queryKey: qk.drivers.list({}),
		queryFn: () =>
			gqlRequest<DriversQueryData, DriversQueryVariables>(DRIVERS_QUERY, { status: "ACTIVE" }),
	});

	const batches = data?.loadBatches ?? [];
	const drivers = (driversData?.drivers ?? []).filter((d) => d.clockedInAt != null);
	const loading = isLoading || isFetching;

	const assignedDriverIds = new Set(
		batches.filter((b) => b.driver?.id).map((b) => b.driver!.id),
	);

	const pending = batches.filter((b) => b.status === "PENDING_DRIVER");
	const active = batches.filter((b) => b.status === "LOADING");
	const done = batches.filter((b) => b.status === "DONE");

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="tms-loading-title"
			aria-describedby="tms-loading-description"
			aria-busy={loading}
		>
			<GlobalLoadingShadow />
			<AdminPageHeader
				icon={Truck}
				title="Loading"
				description="Assign drivers and confirm vehicle loading per batch."
				titleId="tms-loading-title"
				descriptionId="tms-loading-description"
			/>

			{batches.length === 0 && !loading ? (
				<Card className="rounded-2xl border-2 border-border">
					<CardContent className="py-16 text-center text-muted-foreground">
						No load batches yet — assign a staging bin in Packing first.
					</CardContent>
				</Card>
			) : (
				<div className="space-y-8">
					{pending.length > 0 && (
						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<div className="h-px flex-1 bg-amber-200" />
								<span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
									Pending Driver
								</span>
								<div className="h-px flex-1 bg-amber-200" />
							</div>
							{pending.map((b) => (
								<BatchCard key={b.id} batch={b} drivers={drivers} assignedDriverIds={assignedDriverIds} />
							))}
						</section>
					)}

					{active.length > 0 && (
						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<div className="h-px flex-1 bg-border" />
								<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
									Assigned
								</span>
								<div className="h-px flex-1 bg-border" />
							</div>
							{active.map((b) => (
								<BatchCard key={b.id} batch={b} drivers={drivers} assignedDriverIds={assignedDriverIds} />
							))}
						</section>
					)}

					{done.length > 0 && (
						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<div className="h-px flex-1 bg-green-200" />
								<span className="text-xs font-semibold uppercase tracking-widest text-green-600">
									Completed
								</span>
								<div className="h-px flex-1 bg-green-200" />
							</div>
							{done.map((b) => (
								<BatchCard key={b.id} batch={b} drivers={drivers} assignedDriverIds={assignedDriverIds} />
							))}
						</section>
					)}
				</div>
			)}

			<Card className="rounded-2xl border-2 border-border">
				<CardHeader>
					<CardTitle className="text-sm">About staging bins → batches</CardTitle>
					<CardDescription>
						A load batch is created automatically the moment a DO gets a staging bin
						assigned in Packing — one batch per staging bin per day.
					</CardDescription>
				</CardHeader>
			</Card>
		</main>
	);
}
