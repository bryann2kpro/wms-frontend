import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { SkuCombobox, type SkuLineValue } from "@/components/grn/sku-combobox";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import { CREATE_STOCK_ADJUSTMENT_MUTATION } from "@/lib/graphql/stock-adjustment";
import { toUserFriendlyMessage } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type AdjustmentLineItem = {
	key: number;
	sku: SkuLineValue | null;
	rackId: string;
	lotNo: string;
	expiryDate: string;
	movementType: "ADJUSTMENT" | "DAMAGED";
	quantity: string;
	remarks: string;
};

/** Send date-only (YYYY-MM-DD) or existing ISO as UTC midnight for the API. */
function expiryDateToApi(value: string): string | null {
	const t = value.trim();
	if (!t) return null;
	if (t.includes("T")) return t;
	return `${t}T00:00:00.000Z`;
}

type StockAdjustmentFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (
			err as {
				graphQLErrors?: Array<{
					message?: string;
					extensions?: { code?: string };
				}>;
			}
		).graphQLErrors?.[0];
		if (first?.extensions?.code === "INTERNAL_SERVER_ERROR")
			return "Internal Server Error";
		const gql = first?.message;
		if (gql)
			return toUserFriendlyMessage(
				gql,
				"Something went wrong. Please try again.",
			);
	}
	if (err && typeof err === "object" && "response" in err) {
		const first = (
			err as {
				response?: {
					errors?: Array<{
						message?: string;
						extensions?: { code?: string };
					}>;
				};
			}
		).response?.errors?.[0];
		if (first?.extensions?.code === "INTERNAL_SERVER_ERROR")
			return "Internal Server Error";
		const gql = first?.message;
		if (gql)
			return toUserFriendlyMessage(
				gql,
				"Something went wrong. Please try again.",
			);
	}
	if (err instanceof Error)
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	return "Something went wrong. Please try again.";
}

// ============================================
// COMPONENT
// ============================================

let lineKeyCounter = 0;

function createEmptyLine(): AdjustmentLineItem {
	return {
		key: ++lineKeyCounter,
		sku: null,
		rackId: "",
		lotNo: "",
		expiryDate: "",
		movementType: "ADJUSTMENT",
		quantity: "",
		remarks: "",
	};
}

export function StockAdjustmentFormDialog({
	open,
	onOpenChange,
	onSuccess,
}: StockAdjustmentFormDialogProps) {
	const [reason, setReason] = useState("");
	const [notes, setNotes] = useState("");
	const [items, setItems] = useState<AdjustmentLineItem[]>([createEmptyLine()]);

	const racksVars = { pageSize: 500, pageNumber: 1 };
	const { data: racksData } = useQuery({
		queryKey: [...qk.racks.all, racksVars],
		queryFn: () => gqlRequest<RacksQueryData>(RACKS_QUERY, racksVars),
	});
	const racks = racksData?.racks?.query ?? [];

	const { mutateAsync: createMutation, isPending: loading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest(CREATE_STOCK_ADJUSTMENT_MUTATION, { input }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: () => {
			toast.success("Stock adjustment created successfully");
			resetForm();
			onSuccess();
		},
	});

	function resetForm() {
		setReason("");
		setNotes("");
		setItems([createEmptyLine()]);
	}

	function handleOpenChange(val: boolean) {
		if (!val) resetForm();
		onOpenChange(val);
	}

	function updateItem(key: number, updates: Partial<AdjustmentLineItem>) {
		setItems((prev) =>
			prev.map((item) => (item.key === key ? { ...item, ...updates } : item)),
		);
	}

	function removeItem(key: number) {
		setItems((prev) => prev.filter((item) => item.key !== key));
	}

	function addItem() {
		setItems((prev) => [...prev, createEmptyLine()]);
	}

	function validate(): string | null {
		if (items.length === 0) return "At least one line item is required.";
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (!item.sku) return `Row ${i + 1}: Please select a SKU.`;
			if (!item.rackId.trim())
				return `Row ${i + 1}: Please select a rack location.`;
			const qty = Number(item.quantity);
			if (Number.isNaN(qty) || qty === 0)
				return `Row ${i + 1}: Quantity must be a non-zero number.`;
			if (item.movementType === "DAMAGED" && qty < 0)
				return `Row ${i + 1}: DAMAGED quantity must be positive.`;
		}
		return null;
	}

	async function handleSubmit() {
		const error = validate();
		if (error) {
			toast.error(error);
			return;
		}

		const payloadItems = items.map((item) => {
			if (!item.sku) {
				throw new Error("Invalid form state: missing SKU after validation");
			}
			return {
				skuId: item.sku.skuId,
				rackId: item.rackId.trim(),
				lotNo: item.lotNo.trim() || null,
				expiryDate: expiryDateToApi(item.expiryDate),
				movementType: item.movementType,
				quantity: item.quantity,
				remarks: item.remarks.trim() || null,
			};
		});

		await createMutation({
			reason: reason.trim() || null,
			notes: notes.trim() || null,
			items: payloadItems,
		});
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-[min(96vw,1100px)] max-w-[1100px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border-2 border-border sm:max-w-[1100px] p-0"
				aria-busy={loading}
			>
				<DialogHeader className="border-b border-border/60 bg-muted/50 px-6 py-4 shrink-0">
					<DialogTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Create Stock Adjustment
					</DialogTitle>
					<DialogDescription style={{ fontFamily: "var(--dashboard-body)" }}>
						Adjust per rack with optional lot and expiry. The same SKU can
						appear on multiple lines when lot or expiry differs. ADJUSTMENT
						changes on-hand; DAMAGED moves quantity to loss.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
					{/* Header fields */}
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="adj-reason">Reason</Label>
							<Input
								id="adj-reason"
								placeholder="e.g., Stock count correction"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="adj-notes">Notes</Label>
							<Textarea
								id="adj-notes"
								placeholder="Additional notes (optional)"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								rows={1}
							/>
						</div>
					</div>

					{/* Line items */}
					<div className="space-y-3">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<h3
								className="text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Line items
							</h3>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="gap-1 shrink-0 w-fit border-[color-mix(in_oklab,var(--dashboard-accent)_32%,transparent)] hover:bg-[var(--dashboard-accent-muted)]/35"
								onClick={addItem}
							>
								<Plus className="h-4 w-4" aria-hidden />
								Add item
							</Button>
						</div>

						<div className="overflow-x-auto rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[200px] min-w-[160px]">
											SKU
										</TableHead>
										<TableHead className="w-[140px] min-w-[120px]">
											Rack
										</TableHead>
										<TableHead className="w-[100px] min-w-[80px]">
											Lot no.
										</TableHead>
										<TableHead className="w-[120px] min-w-[110px]">
											Expiry
										</TableHead>
										<TableHead className="w-[115px] min-w-[100px]">
											Type
										</TableHead>
										<TableHead className="w-[80px] min-w-[72px]">Qty</TableHead>
										<TableHead className="min-w-[80px]">Remarks</TableHead>
										<TableHead className="w-[40px]" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((item, rowIndex) => (
										<TableRow key={item.key}>
											<TableCell className="p-1.5">
												<SkuCombobox
													value={item.sku}
													onChange={(val) => updateItem(item.key, { sku: val })}
													placeholder="Select SKU..."
												/>
											</TableCell>
											<TableCell className="p-1.5">
												<Select
													value={item.rackId || "__none__"}
													onValueChange={(val) =>
														updateItem(item.key, {
															rackId: val === "__none__" ? "" : val,
														})
													}
												>
													<SelectTrigger className="w-full">
														<SelectValue placeholder="Select rack…" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="__none__">
															Select rack…
														</SelectItem>
														{racks.map((r) => (
															<SelectItem key={r.rackId} value={r.rackId}>
																{r.rackRow}-{r.rackLevel}-{r.rackColumn}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</TableCell>
											<TableCell className="p-1.5">
												<Input
													placeholder="Optional"
													className="font-mono text-sm"
													value={item.lotNo}
													onChange={(e) =>
														updateItem(item.key, { lotNo: e.target.value })
													}
													aria-label={`Row ${rowIndex + 1} lot number`}
												/>
											</TableCell>
											<TableCell className="p-1.5">
												<Input
													type="date"
													className="w-full"
													value={item.expiryDate}
													onChange={(e) =>
														updateItem(item.key, {
															expiryDate: e.target.value,
														})
													}
													aria-label={`Row ${rowIndex + 1} expiry date`}
												/>
											</TableCell>
											<TableCell className="p-1.5">
												<Select
													value={item.movementType}
													onValueChange={(val) =>
														updateItem(item.key, {
															movementType: val as "ADJUSTMENT" | "DAMAGED",
														})
													}
												>
													<SelectTrigger className="w-full">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="ADJUSTMENT">
															Adjustment
														</SelectItem>
														<SelectItem value="DAMAGED">Damaged</SelectItem>
													</SelectContent>
												</Select>
											</TableCell>
											<TableCell className="p-1.5">
												<Input
													type="number"
													placeholder={
														item.movementType === "DAMAGED" ? "+5" : "±5"
													}
													value={item.quantity}
													onChange={(e) =>
														updateItem(item.key, {
															quantity: e.target.value,
														})
													}
													step="0.01"
												/>
											</TableCell>
											<TableCell className="p-1.5">
												<Input
													placeholder="Optional"
													value={item.remarks}
													onChange={(e) =>
														updateItem(item.key, {
															remarks: e.target.value,
														})
													}
												/>
											</TableCell>
											<TableCell className="p-1.5">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													onClick={() => removeItem(item.key)}
													disabled={items.length <= 1}
													className="text-destructive hover:text-destructive"
													aria-label={`Remove line ${rowIndex + 1}`}
												>
													<Trash2 className="h-4 w-4" aria-hidden />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						{items.length === 0 && (
							<p className="text-sm text-muted-foreground text-center py-4">
								No line items yet. Use the Add item button above.
							</p>
						)}
					</div>
				</div>

				<DialogFooter className="border-t border-border/60 px-6 pt-4 pb-4 gap-2 shrink-0">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button
						type="button"
						className="gap-2 text-white disabled:opacity-50"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
						onClick={handleSubmit}
						disabled={loading}
					>
						{loading ? "Creating…" : "Create adjustment"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
