import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { SkuCombobox, type SkuLineValue } from "@/components/grn/sku-combobox";
import { RackLocationCombobox } from "@/components/grn/rack-location-combobox";
import type { Rack } from "@/lib/graphql/types";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import {
	Package,
	Calendar as CalendarIcon,
	FileText,
	Upload,
	XCircle,
	Plus,
	Send,
	Trash2,
	Clock,
	CalendarDays,
	AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GrnDetailForList } from "@/lib/graphql/types";
import type { Skus } from "@/lib/graphql/types";
import {
	UPDATE_GRN_MUTATION,
	DELETE_GRN_MUTATION,
	UI_STATUS_TO_GQL,
	GQL_STATUS_TO_UI,
	GRNS_QUERY,
	type GrnsQueryData,
	ADVANCE_NOTICE_BY_PO_NO_QUERY,
	type AdvanceNoticeByPoNoQueryData,
} from "@/lib/graphql/grns";
import type { Grn, GrnItem } from "@/lib/graphql/types";
import {
	CREATE_RACK_MUTATION,
	type CreateRackMutationData,
} from "@/lib/graphql/racks";
import type { GRNStatus } from "@/data/grn.mock-data";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { formatDate, toUserFriendlyMessage } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Supplier } from "@/lib/graphql/types";
import {
	getGrnLineSkuControls,
	grnLineDuplicateKey,
} from "@/lib/grn-sku-line-controls";

function parseGrnExpiryDate(value: string): Date | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (iso) {
		const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
		if (!isNaN(date.getTime())) return date;
	}
	const parsed = new Date(trimmed);
	return isNaN(parsed.getTime()) ? undefined : parsed;
}

function GrnLineExpiryDatePicker({
	value,
	onChange,
	allowClear,
}: {
	value: string;
	onChange: (yyyyMmDd: string) => void;
	allowClear?: boolean;
}) {
	const selected = parseGrnExpiryDate(value);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className={cn(
						"h-8 w-full justify-start rounded-lg border-muted-foreground/20 px-2 text-left font-normal hover:bg-accent hover:text-accent-foreground",
						!selected && "text-muted-foreground",
					)}
				>
					<CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
					<span className="truncate font-mono text-xs">
						{selected ? format(selected, "yyyy-MM-dd") : "Select date"}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-auto p-0 rounded-lg border shadow-lg bg-background"
				align="start"
				sideOffset={4}
			>
				<Calendar
					mode="single"
					selected={selected}
					onSelect={(date) => {
						if (date) onChange(format(date, "yyyy-MM-dd"));
					}}
					defaultMonth={selected ?? new Date()}
					captionLayout="dropdown"
					showOutsideDays
					fromYear={new Date().getFullYear() - 1}
					toYear={new Date().getFullYear() + 15}
				/>
				{allowClear && selected ? (
					<div className="border-t p-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 w-full text-xs"
							onClick={() => onChange("")}
						>
							Clear date
						</Button>
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

/** Get a user-facing message from GraphQL or generic errors */
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
	if (
		err &&
		typeof err === "object" &&
		"message" in err &&
		typeof (err as Error).message === "string"
	)
		return toUserFriendlyMessage(
			(err as Error).message,
			"Something went wrong. Please try again.",
		);
	if (err instanceof Error)
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	return "Something went wrong. Please try again.";
}

export type GRNLineItemForm = {
	skuCode: string;
	description: string;
	/** Quantity in cartons */
	carton: number;
	/** Quantity lost */
	loss: number;
	uom: string;
	unitPrice: number;
	/** Expiry date (YYYY-MM-DD). Optional. */
	expiryDate: string;
	/** Lot number assigned by supplier/manufacturer. Optional. */
	lotNo: string;
	/** Rack location (one per line). Same SKU allowed with different expiry/rack. */
	rackId: string;
	/** True when this row was prefilled from a lot-tracked ASN line (UI hint only). */
	asnLotTracked?: boolean;
};

function grnApiRackIds(item: Pick<GRNLineItemForm, "rackId">): string[] {
	const id = item.rackId?.trim();
	return id ? [id] : [];
}

/** Normalize TanStack Form errors (string | { message? }) to FieldError's expected shape */
/** Status badge colors for the PO fulfillment-history hint (matches grn.tsx getStatusColor). */
function grnHistoryStatusColor(status: string | null | undefined): string {
	const colors: Record<string, string> = {
		Draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
		Submitted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
		Approved: "bg-green-500/10 text-green-600 border-green-500/20",
		"Sent-to-ES": "bg-purple-500/10 text-purple-600 border-purple-500/20",
		Failed: "bg-red-500/10 text-red-600 border-red-500/20",
	};
	return (status && colors[status]) || "bg-gray-500/10 text-gray-600 border-gray-500/20";
}

function normalizeFieldErrors(
	errors: unknown[],
): Array<{ message?: string } | undefined> {
	return errors.map((e) =>
		typeof e === "string"
			? { message: e }
			: (e as { message?: string } | undefined),
	);
}

function CreateRackDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (v: {
		rackRow: string;
		rackColumn: string;
		rackLevel: string;
	}) => void;
	loading: boolean;
}) {
	const [rackRow, setRackRow] = useState("");
	const [rackLevel, setRackLevel] = useState("");
	const [rackColumn, setRackColumn] = useState("");
	useEffect(() => {
		if (open) {
			setRackRow("");
			setRackLevel("");
			setRackColumn("");
		}
	}, [open]);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50 pb-4">
					<DialogTitle
						className="text-lg font-semibold"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						Create rack
					</DialogTitle>
					<DialogDescription
						className="text-sm text-muted-foreground"
						style={{ fontFamily: "var(--dashboard-body)" }}
					>
						Add a new rack location (row, level, column).
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label
							htmlFor="rack-row"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Row
						</Label>
						<Input
							id="rack-row"
							value={rackRow}
							onChange={(e) => setRackRow(e.target.value)}
							placeholder="e.g. A, B, 1"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="rack-level"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Level
						</Label>
						<Input
							id="rack-level"
							value={rackLevel}
							onChange={(e) => setRackLevel(e.target.value)}
							placeholder="e.g. 01, 02"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="rack-column"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Column
						</Label>
						<Input
							id="rack-column"
							value={rackColumn}
							onChange={(e) => setRackColumn(e.target.value)}
							placeholder="e.g. 01, 02"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						className="rounded-lg"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
						disabled={
							!rackRow.trim() ||
							!rackColumn.trim() ||
							!rackLevel.trim() ||
							loading
						}
						onClick={() =>
							onSubmit({
								rackRow: rackRow.trim(),
								rackColumn: rackColumn.trim(),
								rackLevel: rackLevel.trim(),
							})
						}
					>
						{loading ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function GRNLineRow({
	item,
	index,
	items,
	onItemsChange,
	skuOptions,
	stockUnits,
	racks,
	onOpenCreateRack,
	poAsnLines,
	poHistoricalReceivedBySku,
}: {
	item: GRNLineItemForm;
	index: number;
	items: GRNLineItemForm[];
	onItemsChange: (newItems: GRNLineItemForm[]) => void;
	skuOptions: Skus[];
	/** ASN expected qty per SKU for the linked PO — undefined/empty when no PO lookup applies. */
	poAsnLines?: Array<{ skuCode: string; displayName: string | null; expected: number; units: string }>;
	/** Qty already received by PRIOR saved GRNs for this PO, keyed by skuCode. */
	poHistoricalReceivedBySku?: Map<string, number>;
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
	racks: Array<{
		rackId: string;
		rackRow: string;
		rackColumn: string;
		rackLevel: string;
	}>;
	onOpenCreateRack?: (lineIndex: number) => void;
}) {
	const skuValue: SkuLineValue | null = useMemo(() => {
		if (!item.skuCode?.trim()) return null;
		const sku = skuOptions.find((s) => s.skuCode === item.skuCode);
		return {
			sku: item.skuCode,
			skuCode: item.skuCode,
			description: item.description ?? "",
			uom: item.uom ?? "",
			skuId: sku?.skuId ?? "",
			isActive: sku?.isActive ?? true,
		};
	}, [item.skuCode, item.description, item.uom, skuOptions]);

	const isUnknownSku = useMemo(() => {
		if (!item.skuCode?.trim()) return false;
		return !skuOptions.some((s) => s.skuCode === item.skuCode);
	}, [item.skuCode, skuOptions]);

	const uomLabel = useMemo(() => {
		if (!item.skuCode?.trim()) return null;
		const sku = skuOptions.find((s) => s.skuCode === item.skuCode);
		if (!sku?.skuUom) return null;
		const unit = stockUnits.find(
			(u) => u.stockUnitId === sku.skuUom || u.unitCode === sku.skuUom,
		);
		return unit?.unitCode ?? null;
	}, [item.skuCode, skuOptions, stockUnits]);

	const { requireLot, requireExpiry } = useMemo(
		() =>
			getGrnLineSkuControls(item.skuCode, skuOptions, item.asnLotTracked),
		[item.skuCode, skuOptions, item.asnLotTracked],
	);

	// Live "remaining to receive" gauge for this line's SKU against the linked PO/ASN —
	// nets out historical GRNs AND every in-progress row sharing this SKU (qty can be
	// split across multiple lines, e.g. different racks/lots).
	const poGauge = useMemo(() => {
		if (!item.skuCode?.trim() || !poAsnLines?.length) return null;
		const line = poAsnLines.find((l) => l.skuCode === item.skuCode);
		if (!line) return null;
		const historical = poHistoricalReceivedBySku?.get(item.skuCode) ?? 0;
		const inProgress = items.reduce((sum, it) => {
			if (it.skuCode !== item.skuCode) return sum;
			const carton = Number(it.carton);
			return Number.isFinite(carton) && carton > 0 ? sum + carton : sum;
		}, 0);
		const received = historical + inProgress;
		const expected = line.expected || 0;
		const span = Math.max(expected, received, 1);
		return {
			displayName: line.displayName,
			units: line.units,
			expected,
			historical,
			inProgress,
			received,
			remaining: expected - received,
			historicalPct: Math.min(100, (historical / span) * 100),
			inProgressPct: Math.min(100 - Math.min(100, (historical / span) * 100), (inProgress / span) * 100),
		};
	}, [item.skuCode, items, poAsnLines, poHistoricalReceivedBySku]);

	return (
		<div className="relative rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-border/90 hover:shadow-sm">
			<div className="flex items-start gap-2.5">
				{/* Index badge */}
				<span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-mono font-bold text-muted-foreground">
					{index + 1}
				</span>
				<div className="flex-1 space-y-2.5 min-w-0">
					{/* Row 1: SKU + UOM + remove */}
					<div className="flex items-center gap-2">
						<div className="flex-1 min-w-0">
							<SkuCombobox
								value={skuValue}
								onChange={(v: SkuLineValue) => {
									const newItems = [...items];
									newItems[index] = {
										...newItems[index],
										skuCode: v.skuCode ?? "",
										description: v.description ?? "",
										uom: v.uom ?? "",
									};
									onItemsChange(newItems);
								}}
								usedSkuCodes={items
									.filter((_, i) => i !== index)
									.map((it) => it.skuCode)
									.filter(Boolean)}
								placeholder="Search or select SKU..."
							/>
						</div>
						{isUnknownSku && (
							<Badge
								variant="outline"
								className="shrink-0 text-xs h-6 gap-1 border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
							>
								<AlertTriangle className="h-3 w-3" />
								New
							</Badge>
						)}
						{uomLabel && (
							<Badge
								variant="outline"
								className="shrink-0 font-mono text-xs h-6"
							>
								{uomLabel}
							</Badge>
						)}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
							className="h-7 w-7 shrink-0 p-0 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
							aria-label="Remove item"
						>
							<XCircle className="h-3.5 w-3.5" />
						</Button>
					</div>

					{poGauge ? (
						<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-[var(--dashboard-surface)] px-2 py-1.5">
							<span
								className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
								style={{ backgroundColor: "var(--dashboard-accent)" }}
							/>
							<span
								className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								PO
							</span>
							<div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
								<div
									className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/40"
									style={{ width: `${poGauge.historicalPct}%` }}
								/>
								<div
									className="absolute inset-y-0 rounded-full"
									style={{
										backgroundColor: "var(--dashboard-accent)",
										left: `${poGauge.historicalPct}%`,
										width: `${poGauge.inProgressPct}%`,
									}}
								/>
								{poGauge.remaining < 0 ? (
									<div className="absolute inset-y-0 right-0 w-1 animate-pulse rounded-r-full bg-rose-500" />
								) : null}
							</div>
							<span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
								<span className="font-medium text-foreground">{poGauge.received}</span>
								<span className="text-muted-foreground/60"> / {poGauge.expected}</span>{" "}
								{poGauge.units}
							</span>
							<span
								className={`shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
									poGauge.remaining < 0
										? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
										: poGauge.remaining === 0
											? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
											: "text-[var(--dashboard-accent)]"
								}`}
								style={
									poGauge.remaining > 0
										? { backgroundColor: "var(--dashboard-accent-muted)" }
										: undefined
								}
							>
								{poGauge.remaining < 0
									? `+${Math.abs(poGauge.remaining)} over`
									: poGauge.remaining === 0
										? "cleared"
										: `${poGauge.remaining} ${poGauge.units} left`}
							</span>
						</div>
					) : null}

					{(requireLot || requireExpiry) && item.skuCode?.trim() ? (
						<div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-50/50 px-2 py-1.5 dark:border-amber-600/40 dark:bg-amber-950/25">
							{item.asnLotTracked ? (
								<Badge
									variant="outline"
									className="h-5 border-amber-500/70 bg-amber-100/80 text-[10px] font-semibold text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/60 dark:text-amber-200"
								>
									Lot-tracked (ASN)
								</Badge>
							) : null}
							<p
								className="text-[10px] text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{requireLot && requireExpiry
									? "This SKU requires Lot No. and Expiry Date."
									: requireLot
										? "This SKU requires a Lot No."
										: "This SKU requires an Expiry Date."}
							</p>
						</div>
					) : null}

					{/* Row 2: Carton + Loss + Expiry + Lot No. */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
						<div className="space-y-1">
							<label
								className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Carton
							</label>
							<Input
								type="number"
								min={0}
								value={item.carton}
								onChange={(e) => {
									const newItems = [...items];
									const v = Number(e.target.value);
									newItems[index] = {
										...newItems[index],
										carton: Number.isFinite(v) && v >= 0 ? v : 0,
									};
									onItemsChange(newItems);
								}}
								placeholder="0"
								className="h-8 rounded-lg border-muted-foreground/20 font-mono text-sm"
							/>
						</div>
						<div className="space-y-1">
							<label
								className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Loss
							</label>
							<Input
								type="number"
								min={0}
								value={item.loss}
								onChange={(e) => {
									const newItems = [...items];
									const v = Number(e.target.value);
									newItems[index] = {
										...newItems[index],
										loss: Number.isFinite(v) && v >= 0 ? v : 0,
									};
									onItemsChange(newItems);
								}}
								placeholder="0"
								className="h-8 rounded-lg border-muted-foreground/20 font-mono text-sm"
							/>
						</div>
						<div className="space-y-1">
								<label
									className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									<CalendarDays className="h-2.5 w-2.5" />
									Expiry
									{requireExpiry ? (
										<span className="text-destructive">*</span>
									) : null}
								</label>
								<GrnLineExpiryDatePicker
									value={item.expiryDate ?? ""}
									allowClear={!requireExpiry}
									onChange={(expiryDate) => {
										const newItems = [...items];
										newItems[index] = {
											...newItems[index],
											expiryDate,
										};
										onItemsChange(newItems);
									}}
								/>
							</div>
						<div className="space-y-1">
								<label
									className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Lot No.
									{requireLot ? (
										<span className="text-destructive">*</span>
									) : null}
								</label>
								<Input
									type="text"
									value={item.lotNo ?? ""}
									onChange={(e) => {
										const newItems = [...items];
										newItems[index] = {
											...newItems[index],
											lotNo: e.target.value,
										};
										onItemsChange(newItems);
									}}
									placeholder="e.g. LOT-2026-001"
									className="h-8 rounded-lg border-muted-foreground/20 font-mono text-sm"
								/>
							</div>
					</div>

					{/* Row 3: Rack */}
					<div className="space-y-1">
						<label
							className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Rack <span className="text-destructive">*</span>
						</label>
						<div className="flex flex-wrap items-center gap-2">
							<div className="min-w-0 flex-1">
							<RackLocationCombobox
								racks={racks as Rack[]}
								value={item.rackId ?? ""}
								onChange={(rackId) => {
									const newItems = [...items];
									newItems[index] = {
										...newItems[index],
										rackId,
									};
									onItemsChange(newItems);
								}}
								placeholder="Select rack…"
								className="h-8"
							/>
							</div>
							{onOpenCreateRack ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 shrink-0 gap-1 rounded-lg px-2 text-xs"
									onClick={() => onOpenCreateRack(index)}
								>
									<Plus className="h-3 w-3" />
									New
								</Button>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

/** Payload for create mode submit */
export type GrnCreateSubmitPayload = {
	grnNumber: string;
	poReference: string;
	supplierId: string;
	supplierDO: string;
	receivedDate: string;
	notes: string;
	warehouseId: string;
	submitIntent: "draft" | "submit";
	items: GRNLineItemForm[];
};

export type GrnFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	/** Required when mode is "edit" */
	grn?: GrnDetailForList | null;
	skuOptions: Skus[];
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
	/** Warehouses for warehouse dropdown (create & edit) */
	warehouses: Array<{
		warehouseId: string;
		warehouseCode?: string | null;
		warehouseName: string;
	}>;
	/** Racks for rack dropdown per line item (create & edit) */
	racks: Array<{
		rackId: string;
		rackRow: string;
		rackColumn: string;
		rackLevel: string;
	}>;
	/** Suppliers from m_suppliers for receipt details */
	suppliers: Supplier[];
	/** When true (ASN create), supplier is optional — backend resolves from ASN entity */
	supplierSelectionOptional?: boolean;
	/** Called after successful create; optional close/refetch handled by parent */
	onCreateSubmit?: (payload: GrnCreateSubmitPayload) => Promise<void>;
	/** Called after successful edit (save/update/delete) */
	onSuccess?: () => void;
	/** Only for create: show trigger button (e.g. "Create GRN") */
	trigger?: React.ReactNode;
	/** Permission to show create actions in footer (create mode) */
	canCreate?: boolean;
	/** Called after a new SKU is created so parent can refetch SKU list */
	onSkusRefetch?: () => void | Promise<void>;
	/** Called after a new warehouse is created so parent can refetch warehouse list */
	onWarehouseCreated?: () => void | Promise<void>;
	/** Called after a new rack is created so parent can refetch rack list */
	onRackCreated?: () => void | Promise<void>;
	/** Pre-fill form fields from an ASN selection (create mode only). */
	initialValues?: {
		poReference?: string;
		receivedDate?: string;
		items?: GRNLineItemForm[];
	};
};

export function GrnFormDialog({
	open,
	onOpenChange,
	mode,
	grn = null,
	skuOptions,
	stockUnits,
	warehouses: _warehouses,
	racks,
	suppliers,
	supplierSelectionOptional = false,
	onCreateSubmit,
	onSuccess,
	trigger,
	canCreate = true,
	onSkusRefetch: _onSkusRefetch,
	onWarehouseCreated: _onWarehouseCreated,
	onRackCreated,
	initialValues,
}: GrnFormDialogProps) {
	const { user } = useCurrentUser();
	const queryClient = useQueryClient();
	const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
	const createIntentRef = useRef<"draft" | "submit">("draft");
	/** Prior GRNs found for a manually-typed PO — shown as a "fulfillment history" hint. */
	const [poHistory, setPoHistory] = useState<
		Array<
			Pick<Grn, "id" | "grnNo" | "status" | "receivedAt" | "supplierDeliveryNo"> & {
				items: Array<Pick<GrnItem, "skuId" | "skuCode" | "skuDescription" | "qty">>;
			}
		>
	>([]);
	const [poHistoryLoading, setPoHistoryLoading] = useState(false);
	/**
	 * Raw ingredients for the live "remaining to receive" calc — kept separate from the
	 * in-progress form items so the panel can recompute as the user types qty (see render
	 * below, via form.Subscribe on items). `poAsnLines` = ASN expected qty per SKU;
	 * `poHistoricalReceivedBySku` = qty already received by PRIOR saved GRNs for this PO.
	 */
	const [poAsnLines, setPoAsnLines] = useState<
		Array<{ skuCode: string; displayName: string | null; expected: number; units: string }>
	>([]);
	const [poHistoricalReceivedBySku, setPoHistoricalReceivedBySku] = useState<Map<string, number>>(new Map());
	const lastLookedUpPoRef = useRef<string>("");
	const lookupPoHistory = async (poNo: string) => {
		const trimmed = poNo.trim();
		if (!trimmed || trimmed === lastLookedUpPoRef.current) return;
		lastLookedUpPoRef.current = trimmed;
		setPoHistoryLoading(true);
		try {
			const [historyResult, asnResult] = await Promise.all([
				gqlRequest<GrnsQueryData>(GRNS_QUERY, {
					filter: { poNo: trimmed },
					pageSize: 10,
				}),
				gqlRequest<AdvanceNoticeByPoNoQueryData>(ADVANCE_NOTICE_BY_PO_NO_QUERY, {
					poNo: trimmed,
				}).catch(() => null),
			]);
			const history = historyResult?.grns?.query ?? [];
			setPoHistory(history);

			const asnLines = asnResult?.advanceNoticeByPoNo?.lines ?? [];
			if (asnLines.length > 0) {
				const receivedBySku = new Map<string, number>();
				for (const grn of history) {
					for (const item of grn.items ?? []) {
						if (!item.skuCode) continue;
						receivedBySku.set(
							item.skuCode,
							(receivedBySku.get(item.skuCode) ?? 0) + Number(item.qty || 0),
						);
					}
				}
				setPoHistoricalReceivedBySku(receivedBySku);
				setPoAsnLines(
					asnLines.map((line) => ({
						skuCode: line.itemid,
						displayName: line.displayname,
						expected: line.quantity,
						units: line.units,
					})),
				);
			} else {
				setPoAsnLines([]);
				setPoHistoricalReceivedBySku(new Map());
			}
		} catch {
			setPoHistory([]);
			setPoAsnLines([]);
			setPoHistoricalReceivedBySku(new Map());
		} finally {
			setPoHistoryLoading(false);
		}
	};
	const [createRackOpen, setCreateRackOpen] = useState(false);
	const [createRackForLineIndex, setCreateRackForLineIndex] = useState<
		number | null
	>(null);

	const { mutateAsync: updateGRN } = useMutation({
		mutationFn: (variables: { id: string; input: unknown }) =>
			gqlRequest(UPDATE_GRN_MUTATION, variables),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: qk.grns.all });
			onSuccess?.();
			if (mode === "edit") onOpenChange(false);
		},
	});

	const { mutate: deleteGRN, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest(DELETE_GRN_MUTATION, variables),
		onError: (err) => {
			toast.error(getErrorMessage(err));
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: qk.grns.all });
			onSuccess?.();
			onOpenChange(false);
		},
	});

	const createdBy = user?.id ?? "";
	const updateItemsWithRackRef = useRef<
		((lineIndex: number, rackId: string) => void) | null
	>(null);
	const { mutate: createRack, isPending: createRackLoading } = useMutation({
		mutationFn: (input: {
			rackRow: string;
			rackColumn: string;
			rackLevel: string;
			createdBy: string;
			updatedBy: string;
		}) =>
			gqlRequest<CreateRackMutationData>(CREATE_RACK_MUTATION, { input }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: (data) => {
			const rack = data?.createRack;
			if (rack && createRackForLineIndex != null) {
				updateItemsWithRackRef.current?.(createRackForLineIndex, rack.rackId);
				queryClient.invalidateQueries({ queryKey: qk.racks.all });
				onRackCreated?.();
				setCreateRackOpen(false);
				setCreateRackForLineIndex(null);
				toast.success("Rack created.");
			}
		},
	});

	const form = useForm({
		defaultValues: {
			grnNumber: "",
			poReference: initialValues?.poReference ?? "",
			supplierId: "",
			supplierDO: "",
			receivedDate: initialValues?.receivedDate ?? "",
			notes: "",
			warehouseId: "",
			items: (initialValues?.items ?? []) as GRNLineItemForm[],
		},
		validators: {
			onSubmit: ({ value }) => {
				const fields: Partial<Record<string, string>> = {};
				if (!value.poReference?.trim())
					fields.poReference = "PO Reference is required";
				if (
					!supplierSelectionOptional &&
					!(value.supplierId ?? "").trim()
				) {
					fields.supplierId = "Supplier is required";
				}
				if (!value.supplierDO?.trim())
					fields.supplierDO = "Supplier DO is required";
				if (!value.receivedDate?.trim())
					fields.receivedDate = "Received Date/Time is required";
				const items = value.items ?? [];
				if (items.length === 0) {
					fields.items = "At least one line item is required";
				} else {
					const invalidQty = items.find(
						(i) => (Number(i.carton) || 0) + (Number(i.loss) || 0) <= 0,
					);
					if (invalidQty) {
						fields.items =
							"Each line item must have total quantity (Carton + Loss) greater than zero.";
					} else {
						const missingControlledFields = items.find((i) => {
							if (!i.skuCode?.trim()) return false;
							const { requireLot, requireExpiry } = getGrnLineSkuControls(
								i.skuCode,
								skuOptions,
								i.asnLotTracked,
							);
							if (requireLot && !i.lotNo?.trim()) return true;
							if (requireExpiry && !i.expiryDate?.trim()) return true;
							return false;
						});
						if (missingControlledFields) {
							fields.items =
								"Line items require Lot No. and/or Expiry Date based on each SKU's lot/expiry control settings.";
						} else {
							const missingRack = items.find(
								(i) => !(i.rackId ?? "").trim(),
							);
							if (missingRack) {
								fields.items = "Each line item must have a rack.";
							} else {
								const seen = new Set<string>();
								const hasDuplicate = items.some((i) => {
									const key = grnLineDuplicateKey(
										i.skuCode,
										skuOptions,
										i.expiryDate ?? "",
										i.lotNo ?? "",
										i.asnLotTracked,
									);
									if (seen.has(key)) return true;
									seen.add(key);
									return false;
								});
								if (hasDuplicate) {
									fields.items =
										"Duplicate line items: two or more rows share the same SKU and batch identifiers. Use different lot/expiry values or merge quantities into one row.";
								}
							}
						}
					}
				}
				if (Object.keys(fields).length > 0) {
					toast.error(
						"Please enter all mandatory fields and ensure line item quantities are valid.",
					);
					return { fields };
				}
				return undefined;
			},
		},
		onSubmit: async ({ value }) => {
			if (mode === "create") {
				const payload: GrnCreateSubmitPayload = {
					grnNumber: value.grnNumber,
					poReference: value.poReference ?? "",
					supplierId: value.supplierId ?? "",
					supplierDO: value.supplierDO,
					receivedDate: value.receivedDate,
					notes: value.notes ?? "",
					warehouseId: value.warehouseId ?? "",
					submitIntent: createIntentRef.current,
					items: (value.items ?? []).map((i) => ({
						skuCode: i.skuCode,
						description: i.description,
						carton: i.carton,
						loss: i.loss,
						uom: i.uom,
						unitPrice: i.unitPrice,
						expiryDate: i.expiryDate ?? "",
						lotNo: i.lotNo ?? "",
						rackId: i.rackId ?? "",
					})),
				};


				try {
					await onCreateSubmit?.(payload);
					form.reset();
					form.setFieldValue("items", []);
					onOpenChange(false);
				} catch (err) {
					toast.error(getErrorMessage(err));
				}
				return;
			}
			// Edit mode
			if (!grn?.id) return;
			const parsedDate = value.receivedDate
				? new Date(value.receivedDate)
				: null;
			const status = (grn.status ?? "Draft") as GRNStatus;
			try {
				await updateGRN({
					id: grn.id,
					input: {
						grnNo: value.grnNumber || undefined,
						supplierId: grn.supplierId,
						supplierDeliveryId: grn.supplierDeliveryId ?? null,
						supplierDeliveryNo: value.supplierDO || undefined,
						poNo: value.poReference || undefined,
						receivedAt: parsedDate?.toISOString() ?? undefined,
						status: UI_STATUS_TO_GQL[status],
						notes: value.notes || undefined,
						warehouseId: value.warehouseId?.trim() || undefined,
						items: (value.items ?? []).map((i) => {
							const uomId = i.uom
								? (stockUnits.find((u) => u.unitCode === i.uom)
									?.stockUnitId ?? i.uom)
								: undefined;
							const rackIds = (i.rackIds ?? []).filter((id) =>
								(id ?? "").trim(),
							);
							return {
								skuId:
									skuOptions.find((s) => s.skuCode === i.skuCode)?.skuId ??
									undefined,
								skuCode: i.skuCode,
								skuDescription: i.description ?? undefined,
								qty: String(i.carton),
								lossQty: String(i.loss),
								skuUom: uomId ?? undefined,
								expiryDate: (i.expiryDate ?? "").trim() || undefined,
								lotNo: (i.lotNo ?? "").trim() || undefined,
								...(rackIds.length > 0 && { rackIds }),
							};
						}),
					},
				});
			} catch (err) {
				toast.error(getErrorMessage(err));
			}
		},
	});

	useEffect(() => {
		if (!open) return;
		if (mode === "edit" && grn) {
			const initialItems: GRNLineItemForm[] = grn.items.map((it) => {
				const sku = skuOptions.find((s) => s.skuCode === it.skuCode);
				const uomUnit = sku
					? stockUnits.find(
						(u) => u.stockUnitId === sku.skuUom || u.unitCode === sku.skuUom,
					)
					: undefined;
				const rack = it.rack;
				const legacyRackIds = (it as { rackIds?: string[] }).rackIds;
				const rackId =
					legacyRackIds?.[0] ?? rack?.rackId ?? (it as { rackId?: string }).rackId ?? "";
				const expiryDate = it.expiryDate ?? "";
				const lotNo = it.lotNo ?? "";
				return {
					skuCode: it.skuCode ?? "",
					description: it.skuDescription ?? "",
					carton: it.expectedQuantity ?? 0,
					loss: it.lossQuantity ?? 0,
					uom: uomUnit?.unitCode ?? sku?.skuUom ?? "",
					unitPrice: 0,
					expiryDate,
					lotNo,
					rackId,
				};
			});
			form.reset({
				grnNumber: grn.grnNo ?? "",
				poReference: grn.poNo ?? "",
				supplierId: grn.supplierId ?? "",
				supplierDO: grn.supplierDeliveryNo ?? grn.supplierDeliveryId ?? "",
				receivedDate: formatDate(grn.receivedAt ?? ""),
				notes: grn.notes ?? "",
				warehouseId: grn.warehouseId ?? "",
				items: initialItems,
			});
		} else if (mode === "create") {
			form.reset({
				grnNumber: "",
				poReference: initialValues?.poReference ?? "",
				supplierId: "",
				supplierDO: "",
				receivedDate: initialValues?.receivedDate ?? "",
				notes: "",
				warehouseId: "",
				items: (initialValues?.items ?? []) as GRNLineItemForm[],
			});
			setProofFiles([]);
		}
	}, [open, mode, grn?.id, initialValues]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			(document.activeElement as HTMLElement | null)?.blur();
			setProofFiles([]);
		}
		onOpenChange(next);
	};

	const handleSubmitForApproval = () => {
		if (!grn?.id || grn.status !== "Draft") return;
		const items = form.state.values.items ?? [];
		const missingRack = items.find(
			(i: { rackId?: string }) => !(i.rackId ?? "").trim(),
		);
		if (missingRack) {
			toast.error(
				"Each line item must have a rack before submitting for approval.",
			);
			return;
		}
		updateGRN({
			id: grn.id,
			input: { status: UI_STATUS_TO_GQL["Submitted"] },
		});
	};

	const handleDelete = () => {
		if (!grn?.id) return;
		if (
			!window.confirm(
				"Delete this GRN and all its items? This cannot be undone.",
			)
		)
			return;
		deleteGRN({ id: grn.id });
	};

	const isCreate = mode === "create";
	const isAsnPrefilledCreate =
		isCreate &&
		!!(
			initialValues?.poReference?.trim() ||
			initialValues?.receivedDate?.trim() ||
			(initialValues?.items?.length ?? 0) > 0
		);

	// ASN-prefilled creates skip the PO-field onBlur (field is disabled, prefilled),
	// so the "existing deliveries / remaining to receive" panels never got their data —
	// run the same lookup once up front from the prefilled poReference.
	useEffect(() => {
		if (open && isAsnPrefilledCreate && initialValues?.poReference?.trim()) {
			lookupPoHistory(initialValues.poReference);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, isAsnPrefilledCreate, initialValues?.poReference]);
	const sortedSuppliers = useMemo(
		() =>
			[...suppliers].sort((a, b) =>
				a.supplierName.localeCompare(b.supplierName, undefined, {
					sensitivity: "base",
				}),
			),
		[suppliers],
	);
	const title = isCreate ? "Create New GRN" : "Edit GRN";
	const description = isCreate
		? "Enter the details for the new goods receipt note"
		: "Update the goods receipt note details";

	const dialogContent = (
		<DialogContent
			className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-background shadow-2xl"
			style={{ maxWidth: "min(95vw, 1400px)" }}
		>
			<DialogHeader className="pb-0">
				<div className="flex items-center gap-3 pb-4 border-b border-border">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 shadow-sm">
						<Package className="h-[18px] w-[18px] text-white" />
					</div>
					<div className="min-w-0 flex-1">
						<DialogTitle
							className="text-lg font-semibold leading-tight"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{title}
						</DialogTitle>
						<DialogDescription
							className="text-sm text-muted-foreground mt-0.5"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							{description}
						</DialogDescription>
					</div>
					{!isCreate && grn && (
						<Badge
							variant="outline"
							className="shrink-0 text-xs font-medium uppercase tracking-wide"
						>
							{grn.status}
						</Badge>
					)}
				</div>
			</DialogHeader>
			{(isCreate || grn) && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-7 pt-5"
				>
					<div className="space-y-7">
						<div className="space-y-4">
							{/* Section: Receipt Details */}
							<div className="flex items-center gap-2.5 border-l-[3px] border-amber-500 pl-3">
								<FileText className="h-3.5 w-3.5 text-amber-600" />
								<h3
									className="text-xs font-semibold uppercase tracking-widest text-foreground"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Receipt Details
								</h3>
							</div>
							<FieldGroup>
								<div className="grid gap-4 sm:grid-cols-2">
									<form.Field name="poReference">
										{(field) => {
											const isInvalid = field.state.meta.errors.length > 0;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel
														htmlFor={field.name}
														style={{ fontFamily: "var(--dashboard-body)" }}
													>
														End User PO
													</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="PO-2024-001"
														onBlur={() => {
															field.handleBlur();
															if (isCreate && !isAsnPrefilledCreate) {
																lookupPoHistory(field.state.value);
															}
														}}
														onChange={(e) => field.handleChange(e.target.value)}
														disabled={isAsnPrefilledCreate}
														required
														aria-invalid={isInvalid}
														className="rounded-lg border-muted-foreground/20 font-mono text-sm"
													/>
													{isAsnPrefilledCreate ? (
														<p className="text-xs text-muted-foreground mt-1">
															Prefilled from selected ASN.
														</p>
													) : null}
													{isInvalid && (
														<FieldError
															errors={normalizeFieldErrors(
																field.state.meta.errors,
															)}
														/>
													)}
													{isCreate &&
													!poHistoryLoading &&
													poHistory.length > 0 ? (
														<div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
															<p className="mb-1.5 font-medium text-amber-700">
																Existing deliveries for this PO
															</p>
															<ul className="space-y-1">
																{poHistory.map((g) => (
																	<li
																		key={g.id}
																		className="flex flex-wrap items-center gap-1.5 text-muted-foreground"
																	>
																		<span className="font-mono font-medium text-foreground">
																			{g.grnNo}
																		</span>
																		{g.receivedAt && !Number.isNaN(new Date(g.receivedAt).getTime()) ? (
																			<span>
																				·{" "}
																				{format(
																					new Date(g.receivedAt),
																					"yyyy-MM-dd",
																				)}
																			</span>
																		) : null}
																		{g.supplierDeliveryNo ? (
																			<span className="font-mono">
																				· {g.supplierDeliveryNo}
																			</span>
																		) : null}
																		<Badge
																			variant="outline"
																			className={`text-[10px] ${grnHistoryStatusColor(GQL_STATUS_TO_UI[g.status ?? ""] ?? g.status)}`}
																		>
																			{GQL_STATUS_TO_UI[g.status ?? ""] ?? g.status}
																		</Badge>
																	</li>
																))}
															</ul>
														</div>
													) : null}
												</Field>
											);
										}}
									</form.Field>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<form.Field name="supplierId">
										{(field) => {
											const isInvalid = field.state.meta.errors.length > 0;
											const required =
												isCreate && !supplierSelectionOptional;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel
														htmlFor={field.name}
														style={{ fontFamily: "var(--dashboard-body)" }}
													>
														Supplier{" "}
														{required ? (
															<span className="text-destructive">*</span>
														) : null}
													</FieldLabel>
													<Select
														value={field.state.value || undefined}
														onValueChange={(v) => field.handleChange(v)}
													>
														<SelectTrigger
															id={field.name}
															className="rounded-lg border-muted-foreground/20 font-mono text-sm w-full"
															aria-invalid={isInvalid}
														>
															<SelectValue placeholder="Select supplier…" />
														</SelectTrigger>
														<SelectContent>
															{sortedSuppliers.map((s) => (
																<SelectItem
																	key={s.supplierId}
																	value={s.supplierId}
																>
																	{s.supplierCode} — {s.supplierName}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													{sortedSuppliers.length === 0 ? (
														<p className="text-xs text-amber-600 mt-1">
															No suppliers in master data. Add suppliers in
															Settings first.
														</p>
													) : null}
													{supplierSelectionOptional ? (
														<p className="text-xs text-muted-foreground mt-1">
															Optional when created from ASN; backend can
															resolve supplier from the notice.
														</p>
													) : null}
													{isInvalid && (
														<FieldError
															errors={normalizeFieldErrors(
																field.state.meta.errors,
															)}
														/>
													)}
												</Field>
											);
										}}
									</form.Field>
									<form.Field name="supplierDO">
										{(field) => {
											const isInvalid = field.state.meta.errors.length > 0;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel
														htmlFor={field.name}
														style={{ fontFamily: "var(--dashboard-body)" }}
													>
														Supplier DO{" "}
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="DO-2024-001"
														onBlur={field.handleBlur}
														required
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														className="rounded-lg border-muted-foreground/20 font-mono text-sm"
													/>
													{isInvalid && (
														<FieldError
															errors={normalizeFieldErrors(
																field.state.meta.errors,
															)}
														/>
													)}
												</Field>
											);
										}}
									</form.Field>
								</div>
								<form.Field name="receivedDate">
									{(field) => {
										const isInvalid = field.state.meta.errors.length > 0;
										return (
											<Field data-invalid={isInvalid} className="sm:max-w-xs">
												<FieldLabel
													htmlFor={field.name}
													className="flex items-center gap-1.5"
													style={{ fontFamily: "var(--dashboard-body)" }}
												>
													<CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
													Received Date/Time{" "}
													<span className="text-destructive">*</span>
												</FieldLabel>
												<Input
													id={field.name}
													type="datetime-local"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													required
													aria-invalid={isInvalid}
													className="rounded-lg border-muted-foreground/20 font-mono text-sm"
												/>
												{isInvalid && (
													<FieldError
														errors={normalizeFieldErrors(
															field.state.meta.errors,
														)}
													/>
												)}
											</Field>
										);
									}}
								</form.Field>
							</FieldGroup>
						</div>

						<div className="space-y-3">
							{/* Section: Line Items */}
							<div className="flex items-center justify-between gap-4">
								<div className="flex items-center gap-2.5 border-l-[3px] border-amber-500 pl-3">
									<Package className="h-3.5 w-3.5 text-amber-600" />
									<h3
										className="text-xs font-semibold uppercase tracking-widest text-foreground"
										style={{ fontFamily: "var(--dashboard-display)" }}
									>
										Line Items
									</h3>
								</div>
								<form.Field name="items">
									{(field) => {
										const items = (field.state.value ??
											[]) as GRNLineItemForm[];
										return (
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-8 gap-1.5 rounded-lg border-amber-500/60 text-amber-700 hover:bg-amber-50 hover:border-amber-500"
												onClick={() => {
													field.handleChange([
														...items,
														{
															skuCode: "",
															description: "",
															uom: "",
															unitPrice: 0,
															carton: 1,
															loss: 0,
															expiryDate: "",
															lotNo: "",
															rackId: "",
														},
													]);
												}}
											>
												<Plus className="h-3.5 w-3.5" />
												Add Item
											</Button>
										);
									}}
								</form.Field>
							</div>
							<form.Field name="items">
								{(field) => {
									const items = (field.state.value ?? []) as GRNLineItemForm[];
									updateItemsWithRackRef.current = (lineIndex, rackId) => {
										const current = (field.state.value ??
											[]) as GRNLineItemForm[];
										if (current[lineIndex] == null) return;
										const next = [...current];
										next[lineIndex] = {
											...next[lineIndex],
											rackId,
										};
										field.handleChange(next);
									};
									return (
										<>
											{items.length === 0 ? (
												<div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-200 bg-amber-50/40 text-muted-foreground">
													<Package className="h-7 w-7 text-amber-400/70" />
													<div className="text-center">
														<p
															className="text-sm font-medium text-amber-800/70"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															No line items
														</p>
														<p
															className="text-xs mt-0.5 text-amber-700/50"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Use &#34;Add Item&#34; above to add received goods
														</p>
													</div>
												</div>
											) : (
												<div className="flex flex-col gap-2">
													{items.map((item, index) => (
														<GRNLineRow
															key={`line-${index}-${item.skuCode || "new"}`}
															item={item}
															index={index}
															items={items}
															onItemsChange={field.handleChange}
															skuOptions={skuOptions}
															stockUnits={stockUnits}
															racks={racks}
															poAsnLines={isCreate ? poAsnLines : undefined}
															poHistoricalReceivedBySku={isCreate ? poHistoricalReceivedBySku : undefined}
															onOpenCreateRack={(lineIndex) => {
																setCreateRackForLineIndex(lineIndex);
																setCreateRackOpen(true);
															}}
														/>
													))}
												</div>
											)}
											{field.state.meta.errors.length > 0 && (
												<p className="text-sm text-destructive mt-2">
													{field.state.meta.errors
														.map((e) =>
															typeof e === "string"
																? e
																: (e as unknown as { message?: string })
																	.message,
														)
														.filter(Boolean)
														.join(" ")}
												</p>
											)}
											<CreateRackDialog
												open={createRackOpen}
												onOpenChange={(open) => {
													setCreateRackOpen(open);
													if (!open) setCreateRackForLineIndex(null);
												}}
												onSubmit={(values) =>
													createRack({
														rackRow: values.rackRow,
														rackColumn: values.rackColumn,
														rackLevel: values.rackLevel,
														createdBy,
														updatedBy: createdBy,
													})
												}
												loading={createRackLoading}
											/>
										</>
									);
								}}
							</form.Field>
						</div>

						<div className="space-y-3">
							{/* Section: Proof Upload */}
							<div className="flex items-center gap-2.5 border-l-[3px] border-amber-500 pl-3">
								<Upload className="h-3.5 w-3.5 text-amber-600" />
								<h3
									className="text-xs font-semibold uppercase tracking-widest text-foreground"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Proof Upload
									<span className="ml-1.5 normal-case text-muted-foreground font-normal text-[11px]">
										(max 5 files)
									</span>
								</h3>
							</div>
							<FileUpload
								files={proofFiles}
								onFilesChange={setProofFiles}
								maxFiles={5}
								accept="image/*,application/pdf"
							/>
						</div>

						<div className="space-y-3">
							{/* Section: Notes */}
							<div className="flex items-center gap-2.5 border-l-[3px] border-amber-500 pl-3">
								<FileText className="h-3.5 w-3.5 text-amber-600" />
								<h3
									className="text-xs font-semibold uppercase tracking-widest text-foreground"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Additional Notes
								</h3>
							</div>
							<form.Field name="notes">
								{(field) => (
									<Field>
										<FieldLabel htmlFor={field.name} className="sr-only">
											Notes
										</FieldLabel>
										<Textarea
											id={field.name}
											value={field.state.value}
											placeholder="Enter any additional notes or comments..."
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											className="min-h-[80px] resize-none rounded-lg border-muted-foreground/20 text-sm"
											style={{ fontFamily: "var(--dashboard-body)" }}
										/>
									</Field>
								)}
							</form.Field>
						</div>
					</div>

					<form.Subscribe
						selector={(state) => [state.isSubmitting, state.canSubmit]}
					>
						{([isSubmitting, canSubmit]) => (
							<div className="mt-2 border-t border-border pt-4 flex flex-wrap items-center justify-end gap-2">
								<Button
									type="button"
									variant="ghost"
									className="rounded-lg text-muted-foreground hover:text-foreground"
									onClick={() => handleOpenChange(false)}
									disabled={isSubmitting || deleteLoading}
								>
									Cancel
								</Button>
								{isCreate && canCreate && (
									<>
										<Button
											type="button"
											variant="outline"
											className="rounded-lg"
											onClick={() => {
												createIntentRef.current = "draft";
												form.handleSubmit();
											}}
											disabled={isSubmitting}
										>
											Save Draft
										</Button>
										<Button
											type="button"
											disabled={isSubmitting || !canSubmit}
											className="min-w-[150px] rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
											onClick={() => {
												createIntentRef.current = "submit";
												form.handleSubmit();
											}}
										>
											{isSubmitting ? (
												<>
													<Clock className="mr-2 h-4 w-4 animate-spin" />
													Submitting...
												</>
											) : (
												<>
													<Send className="mr-2 h-4 w-4" />
													Submit for Approval
												</>
											)}
										</Button>
									</>
								)}
								{!isCreate && grn && (
									<>
										{grn.status === "Draft" && (
											<>
												<Button
													type="button"
													variant="ghost"
													className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
													onClick={handleDelete}
													disabled={isSubmitting || deleteLoading}
												>
													<Trash2 className="mr-2 h-4 w-4" />
													{deleteLoading ? "Deleting..." : "Delete"}
												</Button>
												<Button
													type="button"
													variant="outline"
													className="rounded-lg"
													onClick={handleSubmitForApproval}
													disabled={isSubmitting || deleteLoading}
												>
													<Send className="mr-2 h-4 w-4" />
													Submit for Approval
												</Button>
											</>
										)}
										<Button
											type="submit"
											className="rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
											disabled={isSubmitting || deleteLoading}
										>
											{isSubmitting ? "Saving..." : "Save changes"}
										</Button>
									</>
								)}
							</div>
						)}
					</form.Subscribe>
				</form>
			)}
		</DialogContent>
	);

	if (isCreate && trigger) {
		return (
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogTrigger asChild>{trigger}</DialogTrigger>
				{dialogContent}
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{dialogContent}
		</Dialog>
	);
}