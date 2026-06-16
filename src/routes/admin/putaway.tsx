import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Move } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	RackLocationCombobox,
	sortRacksByLocation,
} from "@/components/grn/rack-location-combobox";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
	APPROVE_PUTAWAY_LINE_MUTATION,
	type ApprovePutawayLineMutationData,
	type ApprovePutawayLineMutationVariables,
	CREATE_PUTAWAY_DRAFT_MUTATION,
	type CreatePutawayDraftMutationData,
	type CreatePutawayDraftMutationVariables,
	PUTAWAY_LINES_QUERY,
	type PutawayLineGql,
	type PutawayLinesQueryData,
	REJECT_PUTAWAY_LINE_MUTATION,
	type RejectPutawayLineMutationData,
	type RejectPutawayLineMutationVariables,
} from "@/lib/graphql/putaway";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	SUGGEST_INBOUND_RACK_QUERY,
	type RackSkuCapacityGql,
	type SuggestInboundRackQueryData,
} from "@/lib/graphql/inbound-putaway";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import {
	STOCK_QUANTS_QUERY,
	type StockQuant,
	type StockQuantsQueryData,
} from "@/lib/graphql/stock-quant";
import { requirePermission } from "@/lib/rbac";

const RACKS_PAGE_SIZE = 500;
const STOCK_QUANTS_PAGE_SIZE = 500;

const SKU_SELECT_NONE = "__none__";
const LOT_SELECT_NONE = "__none__";
/** Stock quant rows with no lot number recorded. */
const LOT_NO_LOT_KEY = "__no_lot__";

export const Route = createFileRoute("/admin/putaway")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: PutawayComponent,
	head: () => ({
		meta: [
			{
				title: "Bin to Bin - SME Edaran WMS",
				description:
					"Queue internal bin transfers from source rack to destination rack.",
			},
		],
	}),
});

function stockQuantOnHand(q: StockQuant): number {
	const n = Number(q.quantity ?? "0");
	return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function normalizeLotNo(lot: string | null | undefined): string {
	return (lot ?? "").trim();
}

function stockQuantsForSku(quants: StockQuant[], skuId: string): StockQuant[] {
	return quants.filter((q) => q.skuId === skuId);
}

function skuRowsLotProfile(rows: StockQuant[]) {
	const withLot = rows.filter((q) => normalizeLotNo(q.lotNo) !== "");
	const withoutLot = rows.filter((q) => normalizeLotNo(q.lotNo) === "");
	return {
		hasWithLot: withLot.length > 0,
		hasWithoutLot: withoutLot.length > 0,
		allHaveLot: rows.length > 0 && withoutLot.length === 0,
		hasMixedLotTracking: withLot.length > 0 && withoutLot.length > 0,
	};
}

function sumOnHand(rows: StockQuant[]): number {
	return rows.reduce((sum, q) => sum + stockQuantOnHand(q), 0);
}

type SkuOption = {
	skuId: string;
	skuCode: string;
	totalOnHand: number;
};

type LotOption = {
	key: string;
	label: string;
	onHand: number;
};

function buildSkuOptions(quants: StockQuant[]): SkuOption[] {
	const map = new Map<string, SkuOption>();
	for (const q of quants) {
		const code = q.skuCode ?? q.skuId;
		const onHand = stockQuantOnHand(q);
		const existing = map.get(q.skuId);
		if (existing) {
			existing.totalOnHand += onHand;
		} else {
			map.set(q.skuId, { skuId: q.skuId, skuCode: code, totalOnHand: onHand });
		}
	}
	return [...map.values()].sort((a, b) =>
		a.skuCode.localeCompare(b.skuCode, undefined, { numeric: true }),
	);
}

function buildLotOptions(quants: StockQuant[], skuId: string): LotOption[] {
	const rows = stockQuantsForSku(quants, skuId);
	const options: LotOption[] = [];

	const noLotRows = rows.filter((q) => normalizeLotNo(q.lotNo) === "");
	if (noLotRows.length > 0) {
		options.push({
			key: LOT_NO_LOT_KEY,
			label: "No lot",
			onHand: sumOnHand(noLotRows),
		});
	}

	const byLot = new Map<string, StockQuant[]>();
	for (const q of rows) {
		const lot = normalizeLotNo(q.lotNo);
		if (!lot) continue;
		const list = byLot.get(lot) ?? [];
		list.push(q);
		byLot.set(lot, list);
	}
	for (const [lot, lotRows] of [...byLot.entries()].sort(([a], [b]) =>
		a.localeCompare(b, undefined, { numeric: true }),
	)) {
		options.push({
			key: lot,
			label: lot,
			onHand: sumOnHand(lotRows),
		});
	}

	return options;
}

/** Lot snapshot for putaway draft: null when user chose No lot or stock has no lot. */
function lotNoForPutawayDraft(
	quant: StockQuant,
	lotChoice: string,
): string | null {
	if (lotChoice === LOT_NO_LOT_KEY) return null;
	if (lotChoice !== LOT_SELECT_NONE && lotChoice !== LOT_NO_LOT_KEY) {
		return lotChoice;
	}
	const fromQuant = normalizeLotNo(quant.lotNo);
	return fromQuant === "" ? null : fromQuant;
}

function resolveStockQuant(
	quants: StockQuant[],
	skuId: string,
	lotChoice: string,
): StockQuant | undefined {
	const rows = stockQuantsForSku(quants, skuId);
	if (rows.length === 0) return undefined;
	if (rows.length === 1) return rows[0];

	if (lotChoice === LOT_SELECT_NONE) return undefined;

	if (lotChoice === LOT_NO_LOT_KEY) {
		const noLot = rows.filter((q) => normalizeLotNo(q.lotNo) === "");
		return noLot.length === 1 ? noLot[0] : noLot[0];
	}

	const matched = rows.filter((q) => normalizeLotNo(q.lotNo) === lotChoice);
	return matched[0];
}

/** Capacity hint for the destination rack, given the SKU's case dims and quantity to move. */
function formatDestinationCapacityHint(
	cap: RackSkuCapacityGql | null | undefined,
	incomingQty: number,
): string | null {
	if (!cap) return null;
	const used = cap.currentQuantity ?? 0;
	if (cap.maxCapacity == null) {
		if (used > 0) {
			return `${used.toLocaleString()} carton(s) already in this rack. Add rack/SKU dimensions to see remaining capacity.`;
		}
		return null;
	}
	const available = cap.availableCapacity ?? Math.max(0, cap.maxCapacity - used);
	let text = `${available.toLocaleString()} of ${cap.maxCapacity.toLocaleString()} carton(s) available (${used.toLocaleString()} in use)`;
	if (incomingQty > 0 && incomingQty > available) {
		text += ` — moving ${incomingQty.toLocaleString()} would exceed capacity`;
	}
	return text;
}

function getPutawayErrorMessage(err: unknown, fallback: string): string {
	if (err && typeof err === "object") {
		const responseErrors = (
			err as { response?: { errors?: Array<{ message?: string }> } }
		).response?.errors;
		if (responseErrors?.[0]?.message) return responseErrors[0].message;

		const gqlErrors = (err as { graphQLErrors?: Array<{ message?: string }> })
			.graphQLErrors;
		if (gqlErrors?.[0]?.message) return gqlErrors[0].message;
	}
	if (err instanceof Error) return err.message;
	return fallback;
}

function PutawayComponent() {
	const [sourceRackId, setSourceRackId] = useState("");
	const [selectedSkuId, setSelectedSkuId] = useState("");
	const [selectedLotChoice, setSelectedLotChoice] = useState(LOT_SELECT_NONE);
	const [quantity, setQuantity] = useState("");
	const [destinationRackId, setDestinationRackId] = useState("");

	const racksVars = { pageSize: RACKS_PAGE_SIZE, pageNumber: 1 };
	const { data: racksData, isLoading: racksLoading } = useQuery({
		queryKey: [...qk.racks.all, "putaway"] as const,
		queryFn: () => gqlRequest<RacksQueryData>(RACKS_QUERY, racksVars),
	});

	const quantsVars = {
		filter: { rackId: sourceRackId },
		pageSize: STOCK_QUANTS_PAGE_SIZE,
		pageNumber: 1,
	};
	const {
		data: quantsData,
		isLoading: quantsLoading,
		refetch: refetchQuants,
	} = useQuery({
		queryKey: qk.stockQuants.list(quantsVars),
		queryFn: () =>
			gqlRequest<StockQuantsQueryData>(STOCK_QUANTS_QUERY, quantsVars),
		enabled: !!sourceRackId,
	});

	const draftsVars = {
		filter: { status: "DRAFT" as const },
		limit: 100,
	};
	const {
		data: draftsData,
		isLoading: draftsLoading,
		refetch: refetchDrafts,
	} = useQuery({
		queryKey: qk.putaway.drafts(draftsVars),
		queryFn: () =>
			gqlRequest<PutawayLinesQueryData>(PUTAWAY_LINES_QUERY, draftsVars),
	});

	const draftLines: PutawayLineGql[] = draftsData?.putawayLines ?? [];

	const {
		data: destinationCapacityData,
		isFetching: destinationCapacityLoading,
	} = useQuery({
		queryKey: [
			...qk.putaway.all,
			"destination-capacity",
			selectedSkuId,
			destinationRackId,
		] as const,
		queryFn: () =>
			gqlRequest<SuggestInboundRackQueryData>(SUGGEST_INBOUND_RACK_QUERY, {
				skuId: selectedSkuId,
				quantity: 1,
				forRackId: destinationRackId,
			}),
		enabled: !!selectedSkuId && !!destinationRackId,
	});

	const destinationCapacity: RackSkuCapacityGql | null =
		destinationCapacityData?.suggestInboundRack?.capacityForRack ?? null;

	const { mutateAsync: createPutawayDraft, isPending: createDraftLoading } =
		useMutation({
			mutationFn: (vars: CreatePutawayDraftMutationVariables) =>
				gqlRequest<CreatePutawayDraftMutationData>(
					CREATE_PUTAWAY_DRAFT_MUTATION,
					vars,
				),
		});

	const { mutateAsync: approvePutawayLine, isPending: approveLoading } =
		useMutation({
			mutationFn: (vars: ApprovePutawayLineMutationVariables) =>
				gqlRequest<ApprovePutawayLineMutationData>(
					APPROVE_PUTAWAY_LINE_MUTATION,
					vars,
				),
		});

	const { mutateAsync: rejectPutawayLineMutation, isPending: rejectLoading } =
		useMutation({
			mutationFn: (vars: RejectPutawayLineMutationVariables) =>
				gqlRequest<RejectPutawayLineMutationData>(
					REJECT_PUTAWAY_LINE_MUTATION,
					vars,
				),
		});

	const racksSorted = useMemo(
		() => sortRacksByLocation(racksData?.racks?.query ?? []),
		[racksData?.racks?.query],
	);

	const stockQuantsInRack = useMemo(() => {
		const rows = quantsData?.stockQuants?.query ?? [];
		return rows.filter((r) => stockQuantOnHand(r) > 0);
	}, [quantsData?.stockQuants?.query]);

	const skuOptions = useMemo(
		() => buildSkuOptions(stockQuantsInRack),
		[stockQuantsInRack],
	);

	const lotOptions = useMemo(
		() =>
			selectedSkuId ? buildLotOptions(stockQuantsInRack, selectedSkuId) : [],
		[stockQuantsInRack, selectedSkuId],
	);

	const skuRowsForSelection = useMemo(
		() =>
			selectedSkuId
				? stockQuantsForSku(stockQuantsInRack, selectedSkuId)
				: [],
		[stockQuantsInRack, selectedSkuId],
	);

	const skuLotProfile = useMemo(
		() => skuRowsLotProfile(skuRowsForSelection),
		[skuRowsForSelection],
	);

	const needsLotDisambiguation = skuRowsForSelection.length > 1;

	const isLotRequired =
		needsLotDisambiguation && skuLotProfile.allHaveLot;

	const isLotOptional =
		needsLotDisambiguation && skuLotProfile.hasMixedLotTracking;

	useEffect(() => {
		if (!selectedSkuId) {
			setSelectedLotChoice(LOT_SELECT_NONE);
			return;
		}
		const rows = skuRowsForSelection;
		if (rows.length <= 1) {
			const row = rows[0];
			if (!row) {
				setSelectedLotChoice(LOT_SELECT_NONE);
				return;
			}
			const lot = normalizeLotNo(row.lotNo);
			setSelectedLotChoice(lot === "" ? LOT_NO_LOT_KEY : lot);
			return;
		}
		const profile = skuRowsLotProfile(rows);
		if (profile.allHaveLot) {
			setSelectedLotChoice(LOT_SELECT_NONE);
			return;
		}
		if (profile.hasMixedLotTracking) {
			setSelectedLotChoice(LOT_NO_LOT_KEY);
			return;
		}
		setSelectedLotChoice(LOT_NO_LOT_KEY);
	}, [selectedSkuId, skuRowsForSelection]);

	const selectedStockQuant = useMemo(
		() =>
			selectedSkuId
				? resolveStockQuant(
						stockQuantsInRack,
						selectedSkuId,
						selectedLotChoice,
					)
				: undefined,
		[stockQuantsInRack, selectedSkuId, selectedLotChoice],
	);

	const maxQtyForSelection = selectedStockQuant
		? stockQuantOnHand(selectedStockQuant)
		: undefined;

	const quantityNum = Number(quantity.trim());
	const incomingQtyForCapacity =
		Number.isFinite(quantityNum) && quantityNum > 0 ? quantityNum : 0;

	const destinationCapacityHint = useMemo(
		() => formatDestinationCapacityHint(destinationCapacity, incomingQtyForCapacity),
		[destinationCapacity, incomingQtyForCapacity],
	);

	const destinationOverCapacity =
		destinationCapacity?.availableCapacity != null &&
		incomingQtyForCapacity > destinationCapacity.availableCapacity;

	const handleAddToList = useCallback(async () => {
		const qtyRaw = quantity.trim();

		if (isLotRequired && selectedLotChoice === LOT_SELECT_NONE) {
			toast.error("Select lot", {
				description:
					"All stock for this SKU on the rack has a lot number. Select which lot to transfer.",
			});
			return;
		}

		if (isLotOptional && selectedLotChoice === LOT_SELECT_NONE) {
			toast.error("Select lot", {
				description:
					"Pick a lot number, or choose No lot for stock without a lot.",
			});
			return;
		}

		if (!sourceRackId || !destinationRackId || !selectedSkuId || !qtyRaw) {
			toast.error("Missing fields", {
				description:
					"Select source rack, SKU, destination rack, and quantity.",
			});
			return;
		}

		if (sourceRackId === destinationRackId) {
			toast.error("Invalid racks", {
				description: "Source and destination rack must be different.",
			});
			return;
		}

		const qtyNum = Number(qtyRaw);
		if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
			toast.error("Invalid quantity", {
				description: "Enter a positive number for quantity.",
			});
			return;
		}

		const quant = resolveStockQuant(
			stockQuantsInRack,
			selectedSkuId,
			selectedLotChoice,
		);
		if (!quant) {
			toast.error("Data out of date", {
				description:
					"Re-select source rack, SKU, and lot (if shown), then try again.",
			});
			return;
		}

		const maxAllowed = stockQuantOnHand(quant);
		if (qtyNum > maxAllowed) {
			const lotHint = normalizeLotNo(quant.lotNo)
				? ` (lot ${normalizeLotNo(quant.lotNo)})`
				: "";
			toast.error("Quantity too high", {
				description: `At most ${maxAllowed.toLocaleString()} for this SKU${lotHint} on the source rack.`,
			});
			return;
		}

		if (
			destinationCapacity?.availableCapacity != null &&
			qtyNum > destinationCapacity.availableCapacity
		) {
			toast.error("Not enough capacity", {
				description: `Destination rack has ${destinationCapacity.availableCapacity.toLocaleString()} of ${destinationCapacity.maxCapacity?.toLocaleString() ?? "?"} carton(s) available; cannot move ${qtyNum.toLocaleString()}.`,
			});
			return;
		}

		try {
			await createPutawayDraft({
				input: {
					sourceStockQuantId: quant.id,
					destinationRackId,
					quantity: String(qtyNum),
					sourceLotNo: lotNoForPutawayDraft(quant, selectedLotChoice),
				},
			});
			toast.success("Saved as draft in putaway.");
			await refetchDrafts();
			await refetchQuants();
		} catch (err: unknown) {
			toast.error(
				getPutawayErrorMessage(err, "Could not save putaway draft."),
			);
		}
	}, [
		createPutawayDraft,
		destinationCapacity,
		destinationRackId,
		quantity,
		refetchDrafts,
		refetchQuants,
		isLotOptional,
		isLotRequired,
		selectedLotChoice,
		selectedSkuId,
		sourceRackId,
		stockQuantsInRack,
	]);

	const handleTransfer = useCallback(
		async (line: PutawayLineGql) => {
			try {
				const data = await approvePutawayLine({ id: line.id });
				const res = data?.approvePutawayLine;
				if (res?.success) {
					toast.success(res.message);
					await refetchDrafts();
					await refetchQuants();
				} else {
					toast.error(res?.message ?? "Transfer was not completed.");
					await refetchDrafts();
				}
			} catch (err: unknown) {
				toast.error(
					getPutawayErrorMessage(err, "Transfer failed. Please try again."),
				);
				await refetchDrafts();
			}
		},
		[approvePutawayLine, refetchDrafts, refetchQuants],
	);

	const handleRejectLine = useCallback(
		async (lineId: string) => {
			try {
				const data = await rejectPutawayLineMutation({ id: lineId });
				if (data?.rejectPutawayLine?.status === "REJECT") {
					toast.success("Bin to Bin line rejected; no stock was moved.");
				} else {
					toast.error("Could not reject this line.");
				}
				await refetchDrafts();
			} catch (err: unknown) {
				toast.error(getPutawayErrorMessage(err, "Could not reject this line."));
				await refetchDrafts();
			}
		},
		[rejectPutawayLineMutation, refetchDrafts],
	);

	return (
		<main
			className="container mx-auto space-y-6 p-6"
			aria-labelledby="putaway-page-title"
			aria-describedby="putaway-page-description"
			aria-busy={
				racksLoading ||
				(!!sourceRackId && quantsLoading) ||
				draftsLoading ||
				createDraftLoading ||
				approveLoading ||
				rejectLoading
			}
		>
			<AdminPageHeader
				icon={Move}
				title="Bin to Bin"
				description="Internal bin transfers: move stock from a source rack to a destination rack."
				titleId="putaway-page-title"
				descriptionId="putaway-page-description"
			/>

			<Card className="dashboard-card">
				<CardHeader>
					<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						New transfer
					</CardTitle>
					<CardDescription>
						Pick a source rack and SKU, set quantity (capped by on-hand),
						destination rack — Add to list saves a Draft in the database.
						Approve moves stock; Reject keeps the record with status REJECT.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<div className="space-y-2">
							<Label htmlFor="putaway-source-rack">Source Rack</Label>
							<RackLocationCombobox
								id="putaway-source-rack"
								racks={racksSorted}
								value={sourceRackId}
								onChange={(id) => {
									setSourceRackId(id);
									setSelectedSkuId("");
									setSelectedLotChoice(LOT_SELECT_NONE);
									setQuantity("");
								}}
								disabled={racksLoading}
								placeholder={
									racksLoading
										? "Loading racks…"
										: "Search or select source rack…"
								}
								allowClear
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="putaway-sku">SKU (stock in source rack)</Label>
							<Select
								value={selectedSkuId || SKU_SELECT_NONE}
								onValueChange={(val) => {
									const id = val === SKU_SELECT_NONE ? "" : val;
									setSelectedSkuId(id);
									setSelectedLotChoice(LOT_SELECT_NONE);
									setQuantity("");
								}}
								disabled={!sourceRackId || quantsLoading}
							>
								<SelectTrigger
									id="putaway-sku"
									className="w-full font-mono text-xs"
								>
									<SelectValue
										placeholder={
											!sourceRackId
												? "Select source rack first…"
												: quantsLoading
													? "Loading stock…"
													: "Select SKU…"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={SKU_SELECT_NONE}>
										Select SKU…
									</SelectItem>
									{skuOptions.map((opt) => (
										<SelectItem key={opt.skuId} value={opt.skuId}>
											{opt.skuCode} — {opt.totalOnHand.toLocaleString()} on
											hand
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{sourceRackId && !quantsLoading && skuOptions.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									No stock quant rows with quantity for this rack.
								</p>
							) : null}
						</div>
						<div className="space-y-2">
							<Label htmlFor="putaway-lot">
								{isLotRequired ? "Lot No" : "Lot No (optional)"}
							</Label>
							<Select
								value={selectedLotChoice || LOT_SELECT_NONE}
								onValueChange={(val) => {
									setSelectedLotChoice(
										val === LOT_SELECT_NONE ? LOT_SELECT_NONE : val,
									);
									setQuantity("");
								}}
								disabled={
									!selectedSkuId ||
									quantsLoading ||
									!needsLotDisambiguation
								}
							>
								<SelectTrigger
									id="putaway-lot"
									className="w-full font-mono text-xs"
								>
									<SelectValue
										placeholder={
											!selectedSkuId
												? "Select SKU first…"
												: !needsLotDisambiguation
													? selectedStockQuant
														? normalizeLotNo(selectedStockQuant.lotNo) ||
															"No lot"
														: "—"
													: isLotRequired
														? "Select lot…"
														: "Select lot (optional)…"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{needsLotDisambiguation ? (
										<SelectItem value={LOT_SELECT_NONE}>
											{isLotRequired
												? "Select lot…"
												: "Select lot (optional)…"}
										</SelectItem>
									) : null}
									{lotOptions.map((opt) => (
										<SelectItem key={opt.key} value={opt.key}>
											{opt.label} — {opt.onHand.toLocaleString()} on hand
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{selectedSkuId && isLotRequired ? (
								<p className="text-xs text-muted-foreground">
									All stock for this SKU on the rack is lot-tracked. Select
									which lot to transfer.
								</p>
							) : selectedSkuId && isLotOptional ? (
								<p className="text-xs text-muted-foreground">
									Some rows have a lot and some do not. Choose No lot for
									non-lot stock, or pick a lot number.
								</p>
							) : null}
						</div>
						<div className="space-y-2">
							<Label htmlFor="putaway-qty">Quantity</Label>
							<Input
								id="putaway-qty"
								type="number"
								min={1}
								max={maxQtyForSelection ?? undefined}
								step={1}
								inputMode="numeric"
								placeholder={
									maxQtyForSelection != null
										? `1–${maxQtyForSelection.toLocaleString()}`
										: "—"
								}
								value={quantity}
								onChange={(e) => setQuantity(e.target.value)}
								disabled={!selectedStockQuant || maxQtyForSelection === 0}
							/>
							{maxQtyForSelection != null && maxQtyForSelection > 0 ? (
								<p className="text-xs text-muted-foreground">
									Maximum {maxQtyForSelection.toLocaleString()} (stock quant on
									this rack).
								</p>
							) : selectedStockQuant && maxQtyForSelection === 0 ? (
								<p className="text-xs text-muted-foreground">
									No quantity available.
								</p>
							) : null}
						</div>
					</div>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end">
						<div className="w-full max-w-md space-y-2">
							<Label htmlFor="putaway-dest-rack">Destination Rack</Label>
							<RackLocationCombobox
								id="putaway-dest-rack"
								racks={racksSorted}
								value={destinationRackId}
								onChange={setDestinationRackId}
								disabled={racksLoading}
								placeholder={
									racksLoading
										? "Loading racks…"
										: "Search or select destination rack…"
								}
								allowClear
							/>
							{selectedSkuId && destinationRackId ? (
								destinationCapacityLoading && !destinationCapacityHint ? (
									<p className="text-xs text-muted-foreground">
										Checking capacity…
									</p>
								) : destinationCapacityHint ? (
									<p
										className={
											destinationOverCapacity
												? "text-xs font-medium text-destructive"
												: "text-xs text-muted-foreground"
										}
									>
										{destinationCapacityHint}
									</p>
								) : null
							) : null}
						</div>
						<Button
							type="button"
							disabled={createDraftLoading}
							onClick={() => void handleAddToList()}
							className="sm:mb-0.5"
						>
							Add to list
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card className="dashboard-card">
				<CardHeader>
					<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Bin to Bin list
					</CardTitle>
					<CardDescription>
						Draft lines on the server. Approve runs the transfer (APPROVED or
						FAIL). Reject sets REJECT without moving stock; the row stays in the
						database for audit.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>SKU Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Source Rack</TableHead>
									<TableHead>Lot No</TableHead>
									<TableHead>Destination Rack</TableHead>
									<TableHead className="text-right">Quantity</TableHead>
									<TableHead className="min-w-[200px] text-right">
										Action
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{draftLines.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No putaway lines yet. Add a transfer using the form above.
										</TableCell>
									</TableRow>
								) : (
									draftLines.map((line) => (
										<TableRow key={line.id}>
											<TableCell className="font-mono text-xs">
												{line.skuCode ?? line.skuId}
											</TableCell>
											<TableCell className="max-w-[280px] truncate">
												{line.description?.trim() || "—"}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{line.sourceRackLabel ?? "—"}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{line.sourceLotNo?.trim() ? line.sourceLotNo : "—"}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{line.destinationRackLabel ?? "—"}
											</TableCell>
											<TableCell className="text-right font-medium">
												{Number(line.quantity).toLocaleString()}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex flex-wrap items-center justify-end gap-2">
													<Button
														type="button"
														size="sm"
														variant="default"
														disabled={approveLoading}
														onClick={() => void handleTransfer(line)}
													>
														Approve
													</Button>
													<Button
														type="button"
														size="sm"
														variant="outline"
														className="text-destructive hover:bg-destructive/10 hover:text-destructive"
														disabled={rejectLoading}
														onClick={() => void handleRejectLine(line.id)}
													>
														Reject
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
