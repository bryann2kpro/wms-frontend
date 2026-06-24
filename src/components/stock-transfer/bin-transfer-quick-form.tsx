import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	SUGGEST_INBOUND_RACK_QUERY,
	type RackSkuCapacityGql,
	type SuggestInboundRackQueryData,
} from "@/lib/graphql/inbound-putaway";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import { CREATE_STOCK_TRANSFER_MUTATION } from "@/lib/graphql/stock-transfer";
import {
	STOCK_QUANTS_QUERY,
	type StockQuant,
	type StockQuantsQueryData,
} from "@/lib/graphql/stock-quant";
import { toUserFriendlyMessage } from "@/lib/utils";
import {
	dashboardAccentButtonProps,
	formatCtnLossComma,
	formatCtnLossPipe,
	formatQtyWithUom,
} from "@/components/stock-transfer/stock-transfer-ui";

const RACKS_PAGE_SIZE = 500;
const STOCK_QUANTS_PAGE_SIZE = 500;

const SKU_SELECT_NONE = "__none__";
const LOT_SELECT_NONE = "__none__";
const LOT_NO_LOT_KEY = "__no_lot__";

function stockQuantOnHand(q: StockQuant): number {
	const n = Number(q.quantity ?? "0");
	return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function stockQuantOnHandLoss(q: StockQuant): number {
	const n = Number(q.lossQty ?? "0");
	return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function stockQuantHasStock(q: StockQuant): boolean {
	return stockQuantOnHand(q) > 0 || stockQuantOnHandLoss(q) > 0;
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

function sumOnHandLoss(rows: StockQuant[]): number {
	return rows.reduce((sum, q) => sum + stockQuantOnHandLoss(q), 0);
}

type SkuOption = {
	skuId: string;
	skuCode: string;
	totalOnHand: number;
	totalOnHandLoss: number;
	stockUnitCode: string | null;
};

type LotOption = {
	key: string;
	label: string;
	onHand: number;
	onHandLoss: number;
};

function buildSkuOptions(quants: StockQuant[]): SkuOption[] {
	const map = new Map<string, SkuOption>();
	for (const q of quants) {
		const code = q.skuCode ?? q.skuId;
		const onHand = stockQuantOnHand(q);
		const onHandLoss = stockQuantOnHandLoss(q);
		const existing = map.get(q.skuId);
		if (existing) {
			existing.totalOnHand += onHand;
			existing.totalOnHandLoss += onHandLoss;
		} else {
			map.set(q.skuId, {
				skuId: q.skuId,
				skuCode: code,
				totalOnHand: onHand,
				totalOnHandLoss: onHandLoss,
				stockUnitCode: q.stockUnitCode ?? null,
			});
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
			onHandLoss: sumOnHandLoss(noLotRows),
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
			onHandLoss: sumOnHandLoss(lotRows),
		});
	}

	return options;
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

function getErrorMessage(err: unknown, fallback: string): string {
	if (err && typeof err === "object") {
		const responseErrors = (
			err as { response?: { errors?: Array<{ message?: string }> } }
		).response?.errors;
		if (responseErrors?.[0]?.message) {
			return toUserFriendlyMessage(responseErrors[0].message, fallback);
		}
	}
	if (err instanceof Error) {
		return toUserFriendlyMessage(err.message, fallback);
	}
	return fallback;
}

type BinTransferQuickFormProps = {
	onDraftCreated: () => void;
	animationDelay?: string;
};

export function BinTransferQuickForm({
	onDraftCreated,
	animationDelay = "0ms",
}: BinTransferQuickFormProps) {
	const [sourceRackId, setSourceRackId] = useState("");
	const [selectedSkuId, setSelectedSkuId] = useState("");
	const [selectedLotChoice, setSelectedLotChoice] = useState(LOT_SELECT_NONE);
	const [quantity, setQuantity] = useState("");
	const [lossQuantity, setLossQuantity] = useState("");
	const [destinationRackId, setDestinationRackId] = useState("");

	const racksVars = { pageSize: RACKS_PAGE_SIZE, pageNumber: 1 };
	const { data: racksData, isLoading: racksLoading } = useQuery({
		queryKey: [...qk.racks.all, "bin-transfer-quick"] as const,
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

	const {
		data: destinationCapacityData,
		isFetching: destinationCapacityLoading,
	} = useQuery({
		queryKey: [
			...qk.stockTransfers.all,
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

	const { mutateAsync: createDraft, isPending: createDraftLoading } = useMutation(
		{
			mutationFn: (input: {
				lines: Array<{
					sourceStockQuantId: string;
					destinationRackId: string;
					quantity: string;
					lossQuantity?: string;
				}>;
			}) => gqlRequest(CREATE_STOCK_TRANSFER_MUTATION, { input }),
		},
	);

	const racksSorted = useMemo(
		() => sortRacksByLocation(racksData?.racks?.query ?? []),
		[racksData?.racks?.query],
	);

	const stockQuantsInRack = useMemo(() => {
		const rows = quantsData?.stockQuants?.query ?? [];
		return rows.filter((r) => stockQuantHasStock(r));
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

	const selectedSkuOption = useMemo(
		() => skuOptions.find((opt) => opt.skuId === selectedSkuId),
		[skuOptions, selectedSkuId],
	);

	const selectedUom =
		selectedStockQuant?.stockUnitCode?.trim() ||
		selectedSkuOption?.stockUnitCode?.trim() ||
		null;

	const maxQtyForSelection = selectedStockQuant
		? stockQuantOnHand(selectedStockQuant)
		: undefined;

	const maxLossQtyForSelection = selectedStockQuant
		? stockQuantOnHandLoss(selectedStockQuant)
		: undefined;

	const quantityNum = Number(quantity.trim());
	const incomingQtyForCapacity =
		Number.isFinite(quantityNum) && quantityNum > 0 ? quantityNum : 0;

	const destinationCapacity: RackSkuCapacityGql | null =
		destinationCapacityData?.suggestInboundRack?.capacityForRack ?? null;

	const destinationCapacityHint = useMemo(
		() => formatDestinationCapacityHint(destinationCapacity, incomingQtyForCapacity),
		[destinationCapacity, incomingQtyForCapacity],
	);

	const destinationOverCapacity =
		destinationCapacity?.availableCapacity != null &&
		incomingQtyForCapacity > destinationCapacity.availableCapacity;

	const handleAddToList = useCallback(async () => {
		const qtyRaw = quantity.trim();
		const lossQtyRaw = lossQuantity.trim();

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

		if (!sourceRackId || !destinationRackId || !selectedSkuId) {
			toast.error("Missing fields", {
				description:
					"Select source rack, SKU, destination rack, and at least one quantity.",
			});
			return;
		}

		if (!qtyRaw && !lossQtyRaw) {
			toast.error("Missing quantity", {
				description: "Enter a ctn quantity, Loss quantity, or both.",
			});
			return;
		}

		const qtyNum = qtyRaw ? Number(qtyRaw) : 0;
		const lossNum = lossQtyRaw ? Number(lossQtyRaw) : 0;
		if (
			(qtyRaw && (!Number.isFinite(qtyNum) || qtyNum < 0)) ||
			(lossQtyRaw && (!Number.isFinite(lossNum) || lossNum < 0))
		) {
			toast.error("Invalid quantity", {
				description: "Quantities must be non-negative numbers.",
			});
			return;
		}

		if (qtyNum <= 0 && lossNum <= 0) {
			toast.error("Invalid quantity", {
				description: "At least one of ctn or Loss quantity must be greater than zero.",
			});
			return;
		}

		if (sourceRackId === destinationRackId) {
			toast.error("Invalid racks", {
				description: "Source and destination rack must be different.",
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

		const maxCartonAllowed = stockQuantOnHand(quant);
		if (qtyNum > maxCartonAllowed) {
			const lotHint = normalizeLotNo(quant.lotNo)
				? ` (lot ${normalizeLotNo(quant.lotNo)})`
				: "";
			toast.error("Carton quantity too high", {
				description: `At most ${formatQtyWithUom(maxCartonAllowed, selectedUom)} for this SKU${lotHint} on the source rack.`,
			});
			return;
		}

		const maxLossAllowed = stockQuantOnHandLoss(quant);
		if (lossNum > maxLossAllowed) {
			const lotHint = normalizeLotNo(quant.lotNo)
				? ` (lot ${normalizeLotNo(quant.lotNo)})`
				: "";
			toast.error("Loss quantity too high", {
				description: `At most ${maxLossAllowed.toLocaleString()} Loss for this SKU${lotHint} on the source rack.`,
			});
			return;
		}

		if (
			qtyNum > 0 &&
			destinationCapacity?.availableCapacity != null &&
			qtyNum > destinationCapacity.availableCapacity
		) {
			toast.error("Not enough capacity", {
				description: `Destination rack has ${destinationCapacity.availableCapacity.toLocaleString()} of ${destinationCapacity.maxCapacity?.toLocaleString() ?? "?"} carton(s) available; cannot move ${qtyNum.toLocaleString()}.`,
			});
			return;
		}

		try {
			await createDraft({
				lines: [
					{
						sourceStockQuantId: quant.id,
						destinationRackId,
						quantity: String(qtyNum),
						lossQuantity: String(lossNum),
					},
				],
			});
			toast.success("Stock transfer saved as draft");
			setQuantity("");
			setLossQuantity("");
			await refetchQuants();
			onDraftCreated();
		} catch (err: unknown) {
			toast.error(
				getErrorMessage(err, "Could not save transfer draft."),
			);
		}
	}, [
		createDraft,
		destinationCapacity,
		destinationRackId,
		onDraftCreated,
		quantity,
		lossQuantity,
		isLotOptional,
		isLotRequired,
		selectedLotChoice,
		selectedSkuId,
		sourceRackId,
		stockQuantsInRack,
		refetchQuants,
	]);

	const formBusy =
		racksLoading || (!!sourceRackId && quantsLoading) || createDraftLoading;

	return (
		<Card
			className="dashboard-card"
			style={{ animationDelay }}
			aria-busy={formBusy}
		>
			<CardHeader>
				<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
					New transfer
				</CardTitle>
				<CardDescription>
					Pick a source rack and stock to move, set ctn and/or Loss quantity (capped
					by on-hand), and a destination rack — Add to list saves a draft in the
					queue below.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
								setLossQuantity("");
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
						<Label htmlFor="putaway-sku">Stock to move</Label>
						<Select
							value={selectedSkuId || SKU_SELECT_NONE}
							onValueChange={(val) => {
								const id = val === SKU_SELECT_NONE ? "" : val;
								setSelectedSkuId(id);
								setSelectedLotChoice(LOT_SELECT_NONE);
								setQuantity("");
								setLossQuantity("");
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
								<SelectItem value={SKU_SELECT_NONE}>Select SKU…</SelectItem>
								{skuOptions.map((opt) => (
									<SelectItem key={opt.skuId} value={opt.skuId}>
										{opt.skuCode} —{" "}
										{formatCtnLossComma(opt.totalOnHand, opt.totalOnHandLoss)}
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
								setLossQuantity("");
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
										{opt.label} —{" "}
										{formatCtnLossComma(opt.onHand, opt.onHandLoss)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2 md:col-span-2">
						<Label>Quantity (ctn | loss)</Label>
						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<Label
									htmlFor="putaway-qty"
									className="text-xs font-normal text-muted-foreground"
								>
									ctn
									{selectedUom ? (
										<span className="ml-1">({selectedUom})</span>
									) : null}
								</Label>
								<Input
									id="putaway-qty"
									type="number"
									min={0}
									max={maxQtyForSelection ?? undefined}
									step={1}
									inputMode="numeric"
									placeholder={
										maxQtyForSelection != null
											? `0–${maxQtyForSelection.toLocaleString()}`
											: "—"
									}
									value={quantity}
									onChange={(e) => setQuantity(e.target.value)}
									disabled={
										!selectedStockQuant ||
										maxQtyForSelection === 0 ||
										maxQtyForSelection == null
									}
								/>
							</div>
							<div className="space-y-1">
								<Label
									htmlFor="putaway-loss-qty"
									className="text-xs font-normal text-muted-foreground"
								>
									loss
								</Label>
								<Input
									id="putaway-loss-qty"
									type="number"
									min={0}
									max={maxLossQtyForSelection ?? undefined}
									step={1}
									inputMode="numeric"
									placeholder={
										maxLossQtyForSelection != null
											? `0–${maxLossQtyForSelection.toLocaleString()}`
											: "—"
									}
									value={lossQuantity}
									onChange={(e) => setLossQuantity(e.target.value)}
									disabled={
										!selectedStockQuant ||
										maxLossQtyForSelection === 0 ||
										maxLossQtyForSelection == null
									}
								/>
							</div>
						</div>
						{selectedStockQuant ? (
							<p className="text-xs text-muted-foreground">
								Available:{" "}
								{formatCtnLossPipe(
									maxQtyForSelection ?? 0,
									maxLossQtyForSelection ?? 0,
								)}
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
						{...dashboardAccentButtonProps}
						type="button"
						className={`sm:mb-0.5 ${dashboardAccentButtonProps.className}`}
						disabled={createDraftLoading}
						onClick={() => void handleAddToList()}
					>
						Add to list
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
