import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { Move } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
	type PutawayLinesQueryVariables,
	REJECT_PUTAWAY_LINE_MUTATION,
	type RejectPutawayLineMutationData,
	type RejectPutawayLineMutationVariables,
} from "@/lib/graphql/putaway";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import {
	STOCK_QUANTS_QUERY,
	type StockQuant,
	type StockQuantsQueryData,
	type StockQuantsQueryVariables,
} from "@/lib/graphql/stock-quant";
import { requirePermission } from "@/lib/rbac";

const RACKS_PAGE_SIZE = 500;
const STOCK_QUANTS_PAGE_SIZE = 500;

const STOCK_QUANT_SELECT_NONE = "__none__";

export const Route = createFileRoute("/admin/putaway")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: PutawayComponent,
	head: () => ({
		meta: [
			{
				title: "Putaway - SME Edaran WMS",
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

function PutawayComponent() {
	const [sourceRackId, setSourceRackId] = useState("");
	const [sourceStockQuantId, setSourceStockQuantId] = useState("");
	const [quantity, setQuantity] = useState("");
	const [destinationRackId, setDestinationRackId] = useState("");

	const { data: racksData, loading: racksLoading } = useQuery<RacksQueryData>(
		RACKS_QUERY,
		{
			variables: { pageSize: RACKS_PAGE_SIZE, pageNumber: 1 },
			fetchPolicy: "cache-first",
		},
	);

	const {
		data: quantsData,
		loading: quantsLoading,
		refetch: refetchQuants,
	} = useQuery<StockQuantsQueryData, StockQuantsQueryVariables>(
		STOCK_QUANTS_QUERY,
		{
			skip: !sourceRackId,
			variables: {
				filter: { rackId: sourceRackId },
				pageSize: STOCK_QUANTS_PAGE_SIZE,
				pageNumber: 1,
			},
			fetchPolicy: "cache-and-network",
		},
	);

	const {
		data: draftsData,
		loading: draftsLoading,
		refetch: refetchDrafts,
	} = useQuery<PutawayLinesQueryData, PutawayLinesQueryVariables>(
		PUTAWAY_LINES_QUERY,
		{
			variables: {
				filter: { status: "DRAFT" },
				limit: 100,
			},
			fetchPolicy: "cache-and-network",
		},
	);

	const draftLines: PutawayLineGql[] = draftsData?.putawayLines ?? [];

	const [createPutawayDraft, { loading: createDraftLoading }] = useMutation<
		CreatePutawayDraftMutationData,
		CreatePutawayDraftMutationVariables
	>(CREATE_PUTAWAY_DRAFT_MUTATION);

	const [approvePutawayLine, { loading: approveLoading }] = useMutation<
		ApprovePutawayLineMutationData,
		ApprovePutawayLineMutationVariables
	>(APPROVE_PUTAWAY_LINE_MUTATION);

	const [rejectPutawayLineMutation, { loading: rejectLoading }] = useMutation<
		RejectPutawayLineMutationData,
		RejectPutawayLineMutationVariables
	>(REJECT_PUTAWAY_LINE_MUTATION);

	const racksSorted = useMemo(
		() => sortRacksByLocation(racksData?.racks?.query ?? []),
		[racksData?.racks?.query],
	);

	const stockQuantsInRack = useMemo(() => {
		const rows = quantsData?.stockQuants?.query ?? [];
		const positive = rows.filter((r) => stockQuantOnHand(r) > 0);
		return [...positive].sort((a, b) => {
			const codeA = (a.skuCode ?? a.skuId).toLowerCase();
			const codeB = (b.skuCode ?? b.skuId).toLowerCase();
			return codeA.localeCompare(codeB, undefined, { numeric: true });
		});
	}, [quantsData?.stockQuants?.query]);

	const selectedStockQuant = useMemo(
		() => stockQuantsInRack.find((q) => q.id === sourceStockQuantId),
		[stockQuantsInRack, sourceStockQuantId],
	);

	const maxQtyForSelection = selectedStockQuant
		? stockQuantOnHand(selectedStockQuant)
		: undefined;

	const handleAddToList = useCallback(async () => {
		const qtyRaw = quantity.trim();

		if (!sourceRackId || !destinationRackId || !sourceStockQuantId || !qtyRaw) {
			toast.error("Missing fields", {
				description:
					"Select source rack, a SKU from stock in that rack, destination rack, and quantity.",
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

		const quant = stockQuantsInRack.find((q) => q.id === sourceStockQuantId);
		if (!quant) {
			toast.error("Data out of date", {
				description: "Re-select source rack and SKU, then try again.",
			});
			return;
		}

		const maxAllowed = stockQuantOnHand(quant);
		if (qtyNum > maxAllowed) {
			toast.error("Quantity too high", {
				description: `At most ${maxAllowed.toLocaleString()} for this SKU on the source rack.`,
			});
			return;
		}

		try {
			await createPutawayDraft({
				variables: {
					input: {
						sourceStockQuantId: quant.id,
						destinationRackId,
						quantity: String(qtyNum),
					},
				},
			});
			toast.success("Saved as draft in putaway.");
			await refetchDrafts();
			await refetchQuants();
		} catch (err: unknown) {
			const gqlMsg =
				err &&
				typeof err === "object" &&
				"graphQLErrors" in err &&
				Array.isArray(
					(err as { graphQLErrors?: { message?: string }[] }).graphQLErrors,
				)
					? (err as { graphQLErrors: { message?: string }[] }).graphQLErrors[0]
							?.message
					: undefined;
			toast.error(
				gqlMsg ??
					(err instanceof Error
						? err.message
						: "Could not save putaway draft."),
			);
		}
	}, [
		createPutawayDraft,
		destinationRackId,
		quantity,
		refetchDrafts,
		refetchQuants,
		sourceRackId,
		sourceStockQuantId,
		stockQuantsInRack,
	]);

	const handleTransfer = useCallback(
		async (line: PutawayLineGql) => {
			try {
				const { data } = await approvePutawayLine({
					variables: { id: line.id },
				});
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
				const gqlMsg =
					err &&
					typeof err === "object" &&
					"graphQLErrors" in err &&
					Array.isArray(
						(err as { graphQLErrors?: { message?: string }[] }).graphQLErrors,
					)
						? (err as { graphQLErrors: { message?: string }[] })
								.graphQLErrors[0]?.message
						: undefined;
				toast.error(
					gqlMsg ??
						(err instanceof Error
							? err.message
							: "Transfer failed. Please try again."),
				);
				await refetchDrafts();
			}
		},
		[approvePutawayLine, refetchDrafts, refetchQuants],
	);

	const handleRejectLine = useCallback(
		async (lineId: string) => {
			try {
				const { data } = await rejectPutawayLineMutation({
					variables: { id: lineId },
				});
				if (data?.rejectPutawayLine?.status === "REJECT") {
					toast.success("Putaway line rejected; no stock was moved.");
				} else {
					toast.error("Could not reject this line.");
				}
				await refetchDrafts();
			} catch (err: unknown) {
				const gqlMsg =
					err &&
					typeof err === "object" &&
					"graphQLErrors" in err &&
					Array.isArray(
						(err as { graphQLErrors?: { message?: string }[] }).graphQLErrors,
					)
						? (err as { graphQLErrors: { message?: string }[] })
								.graphQLErrors[0]?.message
						: undefined;
				toast.error(gqlMsg ?? "Could not reject this line.");
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
				title="Putaway"
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
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="putaway-source-rack">Source Rack</Label>
							<RackLocationCombobox
								id="putaway-source-rack"
								racks={racksSorted}
								value={sourceRackId}
								onChange={(id) => {
									setSourceRackId(id);
									setSourceStockQuantId("");
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
								value={sourceStockQuantId || STOCK_QUANT_SELECT_NONE}
								onValueChange={(val) => {
									const id = val === STOCK_QUANT_SELECT_NONE ? "" : val;
									setSourceStockQuantId(id);
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
									<SelectItem value={STOCK_QUANT_SELECT_NONE}>
										Select SKU…
									</SelectItem>
									{stockQuantsInRack.map((q) => {
										const code = q.skuCode ?? q.skuId;
										const onHand = stockQuantOnHand(q);
										return (
											<SelectItem key={q.id} value={q.id}>
												{code} — {onHand.toLocaleString()} on hand
											</SelectItem>
										);
									})}
								</SelectContent>
							</Select>
							{sourceRackId &&
							!quantsLoading &&
							stockQuantsInRack.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									No stock quant rows with quantity for this rack.
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
						Putaway list
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
											colSpan={6}
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
