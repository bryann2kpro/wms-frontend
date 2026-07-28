import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, PackageCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
	DELIVERY_ORDER_ITEMS_QUERY,
	SET_DELIVERY_ORDER_STAGING_BIN_MUTATION,
	type DeliveryOrderItemsQueryData,
	type DeliveryOrderItemsQueryVariables,
	type SetDeliveryOrderStagingBinData,
	type SetDeliveryOrderStagingBinVariables,
} from "@/lib/graphql/delivery-orders";
import type { DeliveryOrderItemWithDetails } from "@/lib/graphql/types";
import { toUserFriendlyMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/tms/packing")({
	component: TmsPackingPage,
	head: () => ({
		meta: [
			{
				title: "Packing - SME Edaran WMS",
				description: "Delivery orders ready for packing — assign staging bins.",
			},
		],
	}),
});

const ACTIVE_DO_STATUSES = ["CREATED", "NEW", "PICKING", "PACKING"];

function dash(v: string | null | undefined): string {
	return v && v.trim() ? v : "—";
}

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

type PackingGroup = {
	doId: string;
	doNo: string;
	outletName: string | null;
	outletAddress: string | null;
	stagingBin: string | null;
	items: DeliveryOrderItemWithDetails[];
};

const ZONE_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ZONE_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function ZonePicker({
	value,
	onChange,
	occupiedZones,
}: {
	value: string;
	onChange: (v: string) => void;
	occupiedZones?: Set<string>;
}) {
	const [open, setOpen] = useState(false);

	function select(col: string, row: number) {
		const next = `${col}${row}`;
		if (occupiedZones?.has(next)) return;
		onChange(next === value ? "" : next);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={`h-7 min-w-[3rem] rounded border px-2 text-xs font-mono font-semibold transition-colors ${
						value
							? "border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300"
							: "border-muted-foreground/30 bg-background text-muted-foreground hover:border-muted-foreground/60"
					}`}
				>
					{value || "—"}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-3 max-w-[calc(100vw-2rem)]" align="end">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1">
						<span className="w-4 text-[10px] text-muted-foreground" />
						{ZONE_COLS.map((col) => (
							<span
								key={col}
								className="w-7 text-center text-[10px] font-semibold text-muted-foreground"
							>
								{col}
							</span>
						))}
					</div>
					{ZONE_ROWS.map((row) => (
						<div key={row} className="flex items-center gap-1">
							<span className="w-4 text-center text-[10px] font-semibold text-muted-foreground">
								{row}
							</span>
							{ZONE_COLS.map((col) => {
								const cell = `${col}${row}`;
								const selected = value === cell;
								const occupied = occupiedZones?.has(cell) ?? false;
								return (
									<button
										type="button"
										key={col}
										onClick={() => select(col, row)}
										disabled={occupied}
										className={`flex h-7 w-7 items-center justify-center rounded border text-[10px] font-mono font-semibold transition-colors ${
											selected
												? "border-violet-500 bg-violet-500 text-white"
												: occupied
													? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed dark:bg-red-950/20"
													: "border-muted-foreground/30 bg-background text-muted-foreground hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/30"
										}`}
									>
										{selected ? cell : occupied ? "✕" : ""}
									</button>
								);
							})}
						</div>
					))}
					{value && (
						<button
							type="button"
							onClick={() => {
								onChange("");
								setOpen(false);
							}}
							className="mt-1 text-left text-[10px] text-muted-foreground underline"
						>
							Clear
						</button>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function TmsPackingPage() {
	const queryClient = useQueryClient();
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const queryVars: DeliveryOrderItemsQueryVariables = {
		filter: { doStatuses: ACTIVE_DO_STATUSES },
		pageSize: 1000,
		pageNumber: 1,
	};

	const { data, isLoading, isFetching } = useQuery({
		queryKey: qk.packingList.list(queryVars),
		queryFn: () =>
			gqlRequest<DeliveryOrderItemsQueryData, DeliveryOrderItemsQueryVariables>(
				DELIVERY_ORDER_ITEMS_QUERY,
				queryVars,
			),
	});

	const stagingBinMutation = useMutation({
		mutationFn: (vars: SetDeliveryOrderStagingBinVariables) =>
			gqlRequest<SetDeliveryOrderStagingBinData, SetDeliveryOrderStagingBinVariables>(
				SET_DELIVERY_ORDER_STAGING_BIN_MUTATION,
				vars,
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: qk.packingList.all });
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const groups = useMemo<PackingGroup[]>(() => {
		const items = data?.deliveryOrderItems.query ?? [];
		const map = new Map<string, PackingGroup>();
		for (const item of items) {
			if (!item.doId) continue;
			let group = map.get(item.doId);
			if (!group) {
				group = {
					doId: item.doId,
					doNo: item.doNo ?? "—",
					outletName: item.outletName,
					outletAddress: item.outletAddress,
					stagingBin: item.stagingBin,
					items: [],
				};
				map.set(item.doId, group);
			}
			group.items.push(item);
		}
		return Array.from(map.values()).sort((a, b) => a.doNo.localeCompare(b.doNo));
	}, [data]);

	const [localBins, setLocalBins] = useState<Map<string, string>>(new Map());

	const globalOccupiedZones = useMemo(() => {
		const set = new Set<string>();
		for (const group of groups) {
			const bin = localBins.has(group.doId) ? localBins.get(group.doId) : group.stagingBin;
			if (bin) set.add(bin);
		}
		return set;
	}, [groups, localBins]);

	const loading = isLoading || isFetching;

	function toggleExpand(doId: string) {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(doId)) next.delete(doId);
			else next.add(doId);
			return next;
		});
	}

	function handleZoneChange(doId: string, bin: string) {
		setLocalBins((prev) => new Map(prev).set(doId, bin));
		stagingBinMutation.mutate({ doId, stagingBin: bin || null });
	}

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="tms-packing-title"
			aria-describedby="tms-packing-description"
			aria-busy={loading}
		>
			<GlobalLoadingShadow />
			<AdminPageHeader
				icon={PackageCheck}
				title="Packing"
				description="Delivery orders ready for packing — assign staging bins."
				titleId="tms-packing-title"
				descriptionId="tms-packing-description"
			/>

			<Card className="rounded-2xl border-2 border-border">
				<CardHeader>
					<CardTitle>Segmentation</CardTitle>
					<CardDescription>
						{groups.length} delivery order{groups.length === 1 ? "" : "s"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-8" />
									<TableHead>DO No.</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead className="text-right">Staging Bin</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{groups.length === 0 && !loading ? (
									<TableRow>
										<TableCell colSpan={4} className="text-center text-muted-foreground py-8">
											No delivery orders in the picking/packing queue.
										</TableCell>
									</TableRow>
								) : (
									groups.flatMap((group) => {
										const expanded = expandedIds.has(group.doId);
										const zoneValue = localBins.has(group.doId)
											? (localBins.get(group.doId) ?? "")
											: (group.stagingBin ?? "");
										return [
											<TableRow
												key={`row-${group.doId}`}
												className="cursor-pointer hover:bg-muted/30"
												onClick={() => toggleExpand(group.doId)}
											>
												<TableCell>
													<ChevronRight
														className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
													/>
												</TableCell>
												<TableCell className="font-mono text-sm font-semibold">
													{group.doNo}
												</TableCell>
												<TableCell>
													<div className="text-sm font-medium">{dash(group.outletName)}</div>
													{group.outletAddress && (
														<div className="text-xs text-muted-foreground">
															{group.outletAddress}
														</div>
													)}
												</TableCell>
												<TableCell
													className="text-right"
													onClick={(e) => e.stopPropagation()}
												>
													<ZonePicker
														value={zoneValue}
														onChange={(v) => handleZoneChange(group.doId, v)}
														occupiedZones={
															new Set(
																[...globalOccupiedZones].filter((z) => z !== zoneValue),
															)
														}
													/>
												</TableCell>
											</TableRow>,
											expanded ? (
												<TableRow key={`detail-${group.doId}`} className="bg-muted/10">
													<TableCell colSpan={4} className="p-0">
														<div className="px-4 py-3">
															<table className="w-full text-xs border rounded-md overflow-hidden">
																<thead>
																	<tr className="bg-muted/50 text-muted-foreground">
																		<th className="px-3 py-1.5 text-left font-medium">
																			Item Code
																		</th>
																		<th className="px-3 py-1.5 text-left font-medium">
																			Description
																		</th>
																		<th className="px-3 py-1.5 text-right font-medium">
																			Qty
																		</th>
																		<th className="px-3 py-1.5 text-left font-medium">
																			Bin
																		</th>
																	</tr>
																</thead>
																<tbody className="divide-y">
																	{group.items.map((item) => (
																		<tr key={item.id} className="bg-background">
																			<td className="px-3 py-1.5 font-mono">
																				{dash(item.skuCode)}
																			</td>
																			<td className="px-3 py-1.5">
																				{dash(item.skuDescription)}
																			</td>
																			<td className="px-3 py-1.5 text-right font-mono">
																				{item.qtyRequired}
																			</td>
																			<td className="px-3 py-1.5">
																				{item.selectedRackLabel ? (
																					<span className="inline-block rounded bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono font-medium dark:bg-amber-950/30 dark:text-amber-300">
																						{item.selectedRackLabel}
																					</span>
																				) : (
																					<span className="text-muted-foreground">—</span>
																				)}
																			</td>
																		</tr>
																	))}
																</tbody>
															</table>
														</div>
													</TableCell>
												</TableRow>
											) : null,
										].filter(Boolean);
									})
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
