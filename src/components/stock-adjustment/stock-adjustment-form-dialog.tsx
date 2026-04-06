import { useMutation } from "@apollo/client/react";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { CREATE_STOCK_ADJUSTMENT_MUTATION } from "@/lib/graphql/stock-adjustment";
import { toUserFriendlyMessage } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type AdjustmentLineItem = {
	key: number;
	sku: SkuLineValue | null;
	movementType: "ADJUSTMENT" | "DAMAGED";
	quantity: string;
	remarks: string;
};

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

	const [createMutation, { loading }] = useMutation(
		CREATE_STOCK_ADJUSTMENT_MUTATION,
		{
			onError: (err) => toast.error(getErrorMessage(err)),
			onCompleted: () => {
				toast.success("Stock adjustment created successfully");
				resetForm();
				onSuccess();
			},
		},
	);

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
			const qty = Number(item.quantity);
			if (isNaN(qty) || qty === 0)
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

		await createMutation({
			variables: {
				input: {
					reason: reason.trim() || null,
					notes: notes.trim() || null,
					items: items.map((item) => ({
						skuId: item.sku!.skuId,
						movementType: item.movementType,
						quantity: item.quantity,
						remarks: item.remarks.trim() || null,
					})),
				},
			},
		});
	}

	const usedSkuCodes = items.filter((i) => i.sku).map((i) => i.sku!.skuCode);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-[min(96vw,900px)] max-w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border sm:max-w-[900px]"
				aria-busy={loading}
			>
				<DialogHeader className="border-b border-border/60 bg-muted/50 -mx-6 px-6 py-4">
					<DialogTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						Create Stock Adjustment
					</DialogTitle>
					<DialogDescription style={{ fontFamily: "var(--dashboard-body)" }}>
						Adjust inventory quantities. ADJUSTMENT adds/subtracts from on-hand
						stock. DAMAGED records broken items (reduces on-hand, increases
						loss).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
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
										<TableHead className="w-[240px]">SKU</TableHead>
										<TableHead className="w-[140px]">Type</TableHead>
										<TableHead className="w-[120px]">Quantity</TableHead>
										<TableHead>Remarks</TableHead>
										<TableHead className="w-[50px]" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((item, rowIndex) => (
										<TableRow key={item.key}>
											<TableCell>
												<SkuCombobox
													value={item.sku}
													onChange={(val) => updateItem(item.key, { sku: val })}
													placeholder="Select SKU..."
													usedSkuCodes={usedSkuCodes}
												/>
											</TableCell>
											<TableCell>
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
											<TableCell>
												<Input
													type="number"
													placeholder={
														item.movementType === "DAMAGED"
															? "e.g., 5"
															: "e.g., -3 or 5"
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
											<TableCell>
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
											<TableCell>
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

				<DialogFooter className="border-t border-border/60 -mx-6 px-6 pt-4 pb-0 gap-2">
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
