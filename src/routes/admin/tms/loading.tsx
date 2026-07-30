import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Truck, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
	UNASSIGN_BATCH_DRIVER_MUTATION,
	UNDO_LOAD_BATCH_MUTATION,
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

function BatchCard({ batch }: { batch: LoadBatch }) {
	const queryClient = useQueryClient();
	const [collapsed, setCollapsed] = useState(true);

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
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-14 text-center">Load #</TableHead>
									<TableHead className="w-48">DO / Outlet</TableHead>
									<TableHead className="w-80">Address</TableHead>
									<TableHead className="w-24">Staging Bin</TableHead>
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
								<BatchCard key={b.id} batch={b} />
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
								<BatchCard key={b.id} batch={b} />
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
								<BatchCard key={b.id} batch={b} />
							))}
						</section>
					)}
				</div>
			)}
		</main>
	);
}
