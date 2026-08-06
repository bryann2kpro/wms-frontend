import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Truck, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
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
import {
	LOAD_BATCHES_QUERY,
	MOVE_DO_TO_BATCH_MUTATION,
	UNASSIGN_BATCH_DRIVER_MUTATION,
	UNDO_LOAD_BATCH_MUTATION,
	type LoadBatchesQueryData,
	type LoadBatchesQueryVariables,
	type MoveDoToBatchData,
	type MoveDoToBatchVariables,
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
				description: "Drivers are auto-assigned on clock-in — confirm vehicle loading per batch.",
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

function EditLoadlistDialog({
	open,
	onOpenChange,
	batch,
	pendingBatch,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	batch: LoadBatch;
	pendingBatch: LoadBatch | null;
}) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.loadBatches.all });

	const moveMutation = useMutation({
		mutationFn: (vars: MoveDoToBatchVariables) =>
			gqlRequest<MoveDoToBatchData, MoveDoToBatchVariables>(MOVE_DO_TO_BATCH_MUTATION, vars),
		onSuccess: () => invalidate(),
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit Loadlist — {batch.driver?.name ?? "Unassigned"}</DialogTitle>
					<DialogDescription>
						Manually add or remove DOs for this driver. Vehicle capacity is not enforced here —
						you can intentionally add extra DOs beyond the driver's usual pallet limit.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<div className="mb-2 text-xs font-semibold text-muted-foreground">
							In this load ({batch.stops.length})
						</div>
						<div className="max-h-80 space-y-1 overflow-y-auto pr-1">
							{batch.stops.map((stop) => (
								<div
									key={stop.doId}
									className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs"
								>
									<div className="min-w-0">
										<div className="truncate font-medium">{stop.outletName ?? stop.doNo}</div>
										<div className="text-[10px] text-muted-foreground">{stop.doNo}</div>
									</div>
									<Button
										size="sm"
										variant="ghost"
										disabled={!pendingBatch || moveMutation.isPending}
										onClick={() =>
											pendingBatch &&
											moveMutation.mutate({ doId: stop.doId, targetBatchId: pendingBatch.id })
										}
									>
										Remove
									</Button>
								</div>
							))}
							{batch.stops.length === 0 && (
								<div className="py-4 text-center text-xs text-muted-foreground">
									No DOs in this load.
								</div>
							)}
						</div>
					</div>
					<div>
						<div className="mb-2 text-xs font-semibold text-muted-foreground">
							Available in {batch.regionName ?? "region"} ({pendingBatch?.stops.length ?? 0})
						</div>
						<div className="max-h-80 space-y-1 overflow-y-auto pr-1">
							{(pendingBatch?.stops ?? []).map((stop) => (
								<div
									key={stop.doId}
									className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs"
								>
									<div className="min-w-0">
										<div className="truncate font-medium">{stop.outletName ?? stop.doNo}</div>
										<div className="text-[10px] text-muted-foreground">{stop.doNo}</div>
									</div>
									<Button
										size="sm"
										variant="ghost"
										disabled={moveMutation.isPending}
										onClick={() => moveMutation.mutate({ doId: stop.doId, targetBatchId: batch.id })}
									>
										Add
									</Button>
								</div>
							))}
							{(!pendingBatch || pendingBatch.stops.length === 0) && (
								<div className="py-4 text-center text-xs text-muted-foreground">
									No pending DOs available in this region.
								</div>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function BatchCard({ batch, pendingBatch }: { batch: LoadBatch; pendingBatch: LoadBatch | null }) {
	const queryClient = useQueryClient();
	const [collapsed, setCollapsed] = useState(batch.status !== "LOADING");
	const [editOpen, setEditOpen] = useState(false);

	const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.loadBatches.all });

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

	const undoMutation = useMutation({
		mutationFn: (vars: UndoLoadBatchVariables) =>
			gqlRequest<UndoLoadBatchData, UndoLoadBatchVariables>(UNDO_LOAD_BATCH_MUTATION, vars),
		onSuccess: () => {
			toast.success("Reverted to pending");
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const done = batch.status === "DONE";
	const pending = batch.status === "PENDING_DRIVER";

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
						<Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
							Edit
						</Button>
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

			{batch.status === "LOADING" && (
				<EditLoadlistDialog
					open={editOpen}
					onOpenChange={setEditOpen}
					batch={batch}
					pendingBatch={pendingBatch}
				/>
			)}

			{!collapsed && (
				<>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									{!pending && <TableHead className="w-14 pl-4 text-center">Load #</TableHead>}
									<TableHead className={`w-48 ${pending ? "pl-4" : ""}`}>DO / Outlet</TableHead>
									<TableHead className="w-80">Address</TableHead>
									<TableHead className="w-24 pr-4">Staging Bin</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{[...batch.stops]
									.sort((a, b) => (a.loadOrder ?? 9999) - (b.loadOrder ?? 9999))
									.map((stop) => (
										<TableRow key={stop.doId}>
											{!pending && (
												<TableCell className="pl-4 text-center font-mono text-sm font-bold">
													{stop.loadOrder ?? "—"}
												</TableCell>
											)}
											<TableCell className={`w-48 ${pending ? "pl-4" : ""}`}>
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
											<TableCell className="pr-4">
												{stop.stagingBin ? (
													<span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
														{stop.stagingBin}
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

	const batches = data?.loadBatches ?? [];
	const loading = isLoading || isFetching;

	const pending = batches
		.filter((b) => b.status === "PENDING_DRIVER")
		.sort((a, b) => (a.regionCode ?? a.regionName ?? "").localeCompare(b.regionCode ?? b.regionName ?? ""));
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
				description="Drivers are auto-assigned on clock-in — confirm vehicle loading per batch."
				titleId="tms-loading-title"
				descriptionId="tms-loading-description"
			/>

			{batches.length === 0 && !loading ? (
				<Card className="rounded-2xl border-2 border-border">
					<CardContent className="py-16 text-center text-muted-foreground">
						No load batches yet — batches appear here automatically once a DO is
						created for an outlet with a region.
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
								<BatchCard key={b.id} batch={b} pendingBatch={null} />
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
								<BatchCard
									key={b.id}
									batch={b}
									pendingBatch={pending.find((p) => p.regionId === b.regionId) ?? null}
								/>
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
								<BatchCard key={b.id} batch={b} pendingBatch={null} />
							))}
						</section>
					)}
				</div>
			)}
		</main>
	);
}
