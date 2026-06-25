import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SkuCombobox, type SkuLineValue } from "@/components/grn/sku-combobox";
import {
	RackLocationCombobox,
	formatRackLocationLabel,
} from "@/components/grn/rack-location-combobox";
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
	AlertTriangle,
	Pencil,
	X,
	Sparkles,
	Loader2,
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
	RACKS_QUERY,
	type CreateRackMutationData,
	type RacksQueryData,
	type RacksQueryVariables,
} from "@/lib/graphql/racks";
import type { GRNStatus } from "@/data/grn.mock-data";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { formatDate, toUserFriendlyMessage } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
	applyRemainingQtyToLineItems,
	computeRemainingOwed,
	isRemainingComputable,
	remainingForSku,
	resolveOrderedCtnForDisplay,
	sumHistoricalLossBySku,
	sumHistoricalReceivedBySku,
} from "@/lib/grn/po-fulfillment";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Supplier, EndUser } from "@/lib/graphql/types";
import {
	getGrnLineSkuControls,
	grnLineDuplicateKey,
} from "@/lib/grn-sku-line-controls";
import {
	SUGGEST_INBOUND_PUTAWAY_PLAN_QUERY,
	LIST_RACKS_WITH_CAPACITY_QUERY,
	type GrnRackAllocationForm,
	type InboundPutawayPlanGql,
	type RackSkuCapacityGql,
	type SuggestInboundPutawayPlanQueryData,
	type ListRacksWithCapacityQueryData,
	type ListRacksWithCapacityQueryVariables,
} from "@/lib/graphql/inbound-putaway";

function formatRackCapacityHint(
	cap: RackSkuCapacityGql | null | undefined,
	unitLabel: string | null,
	incomingQty: number,
): string | null {
	if (!cap) return null;
	const unit = unitLabel ?? "cartons";
	const used = cap.currentQuantity ?? 0;
	if (cap.maxCapacity == null) {
		if (used > 0) {
			return `${used} ${unit} already in this rack. Add rack dimensions to see remaining capacity.`;
		}
		return "Add rack and SKU dimensions to calculate remaining capacity.";
	}
	const available =
		cap.availableCapacity ?? Math.max(0, cap.maxCapacity - used);
	const fits =
		incomingQty <= 0 || used + incomingQty <= cap.maxCapacity;
	let text = `${available} of ${cap.maxCapacity} ${unit} available (${used} in use on rack)`;
	if (incomingQty > 0 && !fits) {
		text += ` — receiving ${incomingQty} ${unit} would exceed capacity`;
	}
	return text;
}

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
	orderedQty?: number;
	/** Quantity lost */
	loss: number;
	uom: string;
	unitPrice: number;
	/** Expiry date (YYYY-MM-DD). Optional. */
	expiryDate: string;
	/** Lot number assigned by supplier/manufacturer. Optional. */
	lotNo: string;
	/** Primary rack (first allocation). Same SKU allowed with different expiry/rack. */
	rackId: string;
	/** Rack for loose/loss items — must be LOOSE_STORAGE bin type. */
	lossRackId?: string;
	/** Multi-rack putaway split when quantity exceeds single-rack capacity. */
	rackAllocations?: GrnRackAllocationForm[];
	/** Multi-rack loose/loss split when loss qty is spread across loose-storage racks. */
	lossRackAllocations?: GrnRackAllocationForm[];
	/** When true, rack was auto-filled from putaway suggestion (may refresh on SKU/qty change). */
	rackAutoSuggested?: boolean;
	/** True when this row was prefilled from a lot-tracked ASN line (UI hint only). */
	asnLotTracked?: boolean;
};

function resolveLineOrderedCtn(
	item: GRNLineItemForm,
	poAsnLines: Array<{ skuCode: string; expected: number }>,
): number | undefined {
	if (item.orderedQty != null && Number.isFinite(item.orderedQty)) {
		return item.orderedQty;
	}
	const code = item.skuCode?.trim();
	if (!code) return undefined;
	const asnLine = poAsnLines.find((l) => l.skuCode === code);
	return asnLine?.expected;
}

function buildGrnItemRackPayload(item: GRNLineItemForm): {
	rackAllocations?: Array<{ rackId: string; quantity: number }>;
} {
	const cartonQty = Math.max(0, Number(item.carton) || 0);
	if (cartonQty <= 0) return {};

	if (item.rackAllocations && item.rackAllocations.length > 1) {
		return {
			rackAllocations: item.rackAllocations.map((row) => ({
				rackId: row.rackId,
				quantity: row.quantity,
			})),
		};
	}

	const rackId = item.rackId?.trim();
	if (!rackId) return {};
	return { rackAllocations: [{ rackId, quantity: cartonQty }] };
}

function buildGrnItemLossRackPayload(item: GRNLineItemForm): {
	lossRackAllocations?: Array<{ rackId: string; quantity: number }>;
} {
	const lossQty = Math.max(0, Number(item.loss) || 0);
	if (lossQty <= 0) return {};

	if (item.lossRackAllocations && item.lossRackAllocations.length > 1) {
		return {
			lossRackAllocations: item.lossRackAllocations.map((row) => ({
				rackId: row.rackId,
				quantity: row.quantity,
			})),
		};
	}

	const lossRackId = item.lossRackId?.trim();
	if (!lossRackId) return {};
	return { lossRackAllocations: [{ rackId: lossRackId, quantity: lossQty }] };
}

/**
 * True when this line's loss qty can be folded into the Remaining figure — i.e. there's
 * no loss, or the SKU has loose_quantity (pieces/carton) configured to convert it.
 * Blocks "Submit for Approval" the same way isLossRackAllocationValid does.
 */
function isRemainingComputableForItem(item: GRNLineItemForm, skuOptions: Skus[]): boolean {
	const lossQty = Math.max(0, Number(item.loss) || 0);
	if (lossQty <= 0) return true;
	const sku = skuOptions.find((s) => s.skuCode === item.skuCode);
	const looseQuantity = sku?.looseQuantity != null ? Number(sku.looseQuantity) : null;
	return looseQuantity != null && Number.isFinite(looseQuantity) && looseQuantity > 0;
}

/** True when the loose/loss rack(s) for this line cover the full loss quantity (or there's no loss to cover). */
function isLossRackAllocationValid(item: GRNLineItemForm): boolean {
	const lossQty = Math.max(0, Number(item.loss) || 0);
	if (lossQty <= 0) return true;
	if (item.lossRackAllocations && item.lossRackAllocations.length > 0) {
		const allFilled = item.lossRackAllocations.every((row) =>
			(row.rackId ?? "").trim(),
		);
		const total = item.lossRackAllocations.reduce(
			(sum, row) => sum + (Number(row.quantity) || 0),
			0,
		);
		return allFilled && total === lossQty;
	}
	return !!item.lossRackId?.trim();
}

/** Map stock-unit id or code to a display unit code (never leak UUIDs in labels). */
function resolveDisplayUnitCode(
	units: string | null | undefined,
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>,
	fallback = "CTN",
): string {
	const raw = units?.trim();
	if (!raw) return fallback;
	const match = stockUnits.find(
		(u) =>
			u.stockUnitId === raw ||
			u.unitCode.toLowerCase() === raw.toLowerCase(),
	);
	if (match?.unitCode) return match.unitCode;
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
		return fallback;
	}
	return raw;
}

function formatPutawayPlanHint(
	plan: InboundPutawayPlanGql | null,
	unitLabel: string | null,
	incomingQty: number,
): string | null {
	if (!plan?.allocations.length || incomingQty <= 0) return null;
	const unit = unitLabel ?? "cartons";
	if (plan.remainingQty > 0) {
		return `Allocated ${plan.totalAllocated} of ${incomingQty} ${unit} across ${plan.allocations.length} rack(s). ${plan.remainingQty} ${unit} still need a location.`;
	}
	if (plan.allocations.length === 1) {
		return null;
	}
	return `${plan.allocations.length} rack locations suggested (${plan.totalAllocated} ${unit} total)`;
}

function putawayAllocationsFromPlan(
	plan: InboundPutawayPlanGql,
): GrnRackAllocationForm[] {
	return plan.allocations.map((row) => ({
		rackId: row.rackId,
		quantity: row.quantity,
		rackLabel: row.rackLabel,
	}));
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

function GrnQuantitiesTable({
	item,
	index,
	items,
	onItemsChange,
	orderedCtn,
	orderedCtnEditable,
	fulfilledCtn,
	fulfilledLoss,
	looseQuantity,
	cartonUomLabel,
	lossUomLabel,
}: {
	item: GRNLineItemForm;
	index: number;
	items: GRNLineItemForm[];
	onItemsChange: (newItems: GRNLineItemForm[]) => void;
	/** PO / ASN ordered carton qty; null when unknown. */
	orderedCtn: number | null;
	orderedCtnEditable: boolean;
	fulfilledCtn: number;
	fulfilledLoss: number;
	/** SKU's pieces-per-carton (m_skus.loose_quantity); null when not configured. */
	looseQuantity: number | null;
	cartonUomLabel: string;
	lossUomLabel: string;
}) {
	const inboundQty = Math.max(0, Number(item.carton) || 0);
	const lossQty = Math.max(0, Number(item.loss) || 0);
	const orderedCtnForDisplay = resolveOrderedCtnForDisplay(
		orderedCtn,
		item.orderedQty,
	);
	const remainingComputable = isRemainingComputable(fulfilledLoss, looseQuantity);
	const remaining = remainingComputable
		? computeRemainingOwed(orderedCtnForDisplay, fulfilledCtn, fulfilledLoss, looseQuantity)
		: null;
	const remainingCtnDisplay = remaining ? String(remaining.remainingCtn) : "—";
	const remainingLossDisplay = remaining ? String(remaining.remainingLoosePcs) : "—";

	const readOnlyCellClass =
		"h-8 rounded-lg border border-border/40 bg-muted/30 px-2 font-mono text-sm tabular-nums text-muted-foreground flex items-center justify-center";

	const subHeaderClass =
		"text-[9px] font-semibold uppercase tracking-wider text-muted-foreground text-center";

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[320px] border-collapse text-xs">
				<thead>
					<tr>
						<th
							colSpan={2}
							className="border-b border-border/50 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Ordered
						</th>
						<th
							colSpan={2}
							className="border-b border-border/50 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Delivered
						</th>
						<th
							colSpan={2}
							className="border-b border-border/50 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Fulfillment
						</th>
					</tr>
					<tr>
						<th className={subHeaderClass}>Ctn</th>
						<th className={subHeaderClass}>Loss</th>
						<th className={subHeaderClass}>Ctn</th>
						<th className={subHeaderClass}>Loss</th>
						<th className={subHeaderClass}>Ctn</th>
						<th className={subHeaderClass}>Loss</th>
					</tr>
				</thead>
				<tbody>
					<tr className="align-middle">
						<td className="p-0.5 pr-1">
							{orderedCtnEditable ? (
								<Input
									type="number"
									min={0}
									aria-label="Ordered carton quantity"
									value={item.orderedQty ?? ""}
									onChange={(e) => {
										const newItems = [...items];
										const v = Number(e.target.value);
										newItems[index] = {
											...newItems[index],
											orderedQty:
												e.target.value === ""
													? undefined
													: Number.isFinite(v) && v >= 0
														? v
														: 0,
										};
										onItemsChange(newItems);
									}}
									placeholder="0"
									className="h-8 rounded-lg border-muted-foreground/20 font-mono text-sm"
								/>
							) : (
								<div className={readOnlyCellClass} title={cartonUomLabel}>
									{orderedCtn != null ? orderedCtn : "—"}
								</div>
							)}
						</td>
						<td className="p-0.5 pr-1">
							<div className={readOnlyCellClass}>—</div>
						</td>
						<td className="p-0.5 pr-1">
							<Input
								type="number"
								min={0}
								aria-label="Delivered carton quantity"
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
						</td>
						<td className="p-0.5 pr-1">
							<Input
								type="number"
								min={0}
								aria-label="Delivered loss quantity"
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
						</td>
						<td className="p-0.5 pr-1">
							<div
								className={cn(readOnlyCellClass, "text-destructive")}
								title={
									!remainingComputable
										? "Cannot compute remaining — this SKU has no loose quantity (pieces/carton) configured"
										: orderedCtnForDisplay != null
											? `${remaining?.remainingCtn ?? 0} ${cartonUomLabel} still owed of ${orderedCtnForDisplay} ordered (after this delivery)`
											: "No PO/ASN line to compare against"
								}
							>
								{remainingCtnDisplay}
							</div>
						</td>
						<td className="p-0.5">
							<div
								className={cn(readOnlyCellClass, "text-destructive")}
								title={
									!remainingComputable
										? "Cannot compute remaining — this SKU has no loose quantity (pieces/carton) configured"
										: `${remaining?.remainingLoosePcs ?? 0} ${lossUomLabel} still owed (loss folded back in)`
								}
							>
								{remainingLossDisplay}
							</div>
						</td>
					</tr>
				</tbody>
			</table>
			{inboundQty > 0 || lossQty > 0 ? (
				<p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
					{inboundQty > 0 ? (
						<span className="font-semibold text-foreground">
							{inboundQty} {cartonUomLabel} delivered
						</span>
					) : null}
					{lossQty > 0 ? (
						<>
							{inboundQty > 0 ? " · " : null}
							<span className="font-semibold text-amber-600">
								{lossQty} {lossUomLabel} loss
							</span>
						</>
					) : null}
				</p>
			) : null}
		</div>
	);
}

function GrnFormSection({
	icon: Icon,
	title,
	subtitle,
	action,
	children,
	className,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("space-y-3", className)}>
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5 border-l-[3px] border-amber-500 pl-3">
					<Icon className="h-3.5 w-3.5 shrink-0 text-amber-600" />
					<div className="min-w-0">
						<h3
							className="text-xs font-semibold uppercase tracking-widest text-foreground"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{title}
						</h3>
						{subtitle ? (
							<p
								className="mt-0.5 text-[11px] text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{subtitle}
							</p>
						) : null}
					</div>
				</div>
				{action}
			</div>
			{children}
		</section>
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

function AllocationEditPicker({
	skuId,
	skuCode,
	currentRackId,
	quantity,
	excludeRackIds,
	onSelect,
	onCancel,
}: {
	skuId: string;
	skuCode: string;
	currentRackId: string;
	quantity: number;
	excludeRackIds: string[];
	onSelect: (rackId: string, rackLabel?: string) => void;
	onCancel: () => void;
}) {
	const { data, isLoading } = useQuery({
		queryKey: ["racks-with-capacity", skuId, skuCode, quantity, [...excludeRackIds].sort().join(",")],
		queryFn: () =>
			gqlRequest<ListRacksWithCapacityQueryData, ListRacksWithCapacityQueryVariables>(
				LIST_RACKS_WITH_CAPACITY_QUERY,
				{ skuId: skuId || null, skuCode: skuCode || null, quantity, excludeRackIds },
			),
		staleTime: 30_000,
	});

	// RackLocationCombobox uses only rackId/rackRow/rackLevel/rackColumn at runtime
	const racks = (data?.listRacksWithCapacity ?? []) as unknown as Rack[];

	return (
		<div className="flex items-center gap-1.5">
			<div className="min-w-0 flex-1">
				<RackLocationCombobox
					racks={racks}
					value={currentRackId}
					className="h-7"
					loading={isLoading}
					loadingPlaceholder="Loading racks…"
					onChange={onSelect}
				/>
			</div>
			<button
				type="button"
				title="Cancel"
				className="shrink-0 text-muted-foreground hover:text-foreground"
				onClick={onCancel}
			>
				<X className="h-3 w-3" />
			</button>
		</div>
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
	poAsnLines,
	poHistoricalReceivedBySku,
	poHistoricalLossBySku,
	showOrderedQty,
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
	/** Loss qty on PRIOR saved GRNs for this PO, keyed by skuCode. */
	poHistoricalLossBySku?: Map<string, number>;
	showOrderedQty?: boolean;
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
	racks: Array<{
		rackId: string;
		rackRow: string;
		rackColumn: string;
		rackLevel: string;
	}>;
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

	/** SKU base / inner stock UOM (e.g. PKT) — used for loss qty and the SKU badge. */
	const baseUomLabel = useMemo(() => {
		if (!item.skuCode?.trim()) return null;
		const sku = skuOptions.find((s) => s.skuCode === item.skuCode);
		if (!sku?.skuUom) return null;
		const unit = stockUnits.find(
			(u) => u.stockUnitId === sku.skuUom || u.unitCode === sku.skuUom,
		);
		return unit?.unitCode ?? null;
	}, [item.skuCode, skuOptions, stockUnits]);

	/** Pieces per carton (m_skus.loose_quantity) — converts loss into the Remaining figure. */
	const looseQuantity = useMemo(() => {
		if (!item.skuCode?.trim()) return null;
		const sku = skuOptions.find((s) => s.skuCode === item.skuCode);
		const lq = sku?.looseQuantity != null ? Number(sku.looseQuantity) : null;
		return lq != null && Number.isFinite(lq) && lq > 0 ? lq : null;
	}, [item.skuCode, skuOptions]);

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
			units: resolveDisplayUnitCode(line.units, stockUnits, "CTN"),
			expected,
			historical,
			inProgress,
			received,
			remaining: expected - received,
			historicalPct: Math.min(100, (historical / span) * 100),
			inProgressPct: Math.min(100 - Math.min(100, (historical / span) * 100), (inProgress / span) * 100),
		};
	}, [item.skuCode, items, poAsnLines, poHistoricalReceivedBySku, stockUnits]);

	/** Receiving / putaway unit — GRN carton qty and rack allocations are always in CTN. */
	const cartonUomLabel = poGauge?.units?.trim() || "CTN";

	const [putawayPlan, setPutawayPlan] = useState<InboundPutawayPlanGql | null>(
		null,
	);
	const [isSuggestingRack, setIsSuggestingRack] = useState(false);
	const [editingAllocationIdx, setEditingAllocationIdx] = useState<number | null>(null);
	const [editingLossAllocationIdx, setEditingLossAllocationIdx] = useState<number | null>(null);

	const { data: looseRacksData } = useQuery({
		queryKey: [...qk.racks.all, "loose-storage"],
		queryFn: () =>
			gqlRequest<RacksQueryData, RacksQueryVariables>(RACKS_QUERY, {
				filter: { binType: "LOOSE_STORAGE" },
				pageSize: 50,
				pageNumber: 1,
			}),
		staleTime: 5 * 60 * 1000,
	});
	const looseRacks = looseRacksData?.racks?.query ?? [];

	const resolvedSkuId = useMemo(() => {
		if (!item.skuCode?.trim()) return "";
		return skuOptions.find((s) => s.skuCode === item.skuCode)?.skuId ?? "";
	}, [item.skuCode, skuOptions]);

	const inboundQty = Math.max(0, Number(item.carton) || 0);
	const lossQty = Math.max(0, Number(item.loss) || 0);
	const debouncedSkuCode = useDebouncedValue(item.skuCode, 350);
	const debouncedInboundQty = useDebouncedValue(inboundQty, 350);
	const debouncedResolvedSkuId = useDebouncedValue(resolvedSkuId, 350);

	useEffect(() => {
		if (lossQty > 0 && !item.lossRackId && looseRacks.length > 0) {
			const first = looseRacks[0];
			onItemsChange(
				items.map((row, i) =>
					i === index ? { ...row, lossRackId: first.rackId } : row,
				),
			);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lossQty, looseRacks.length]);
	const netQty = Math.max(0, inboundQty - lossQty);
	const totalAllocQty = Math.round(
		((item.rackAllocations ?? []).reduce((s, a) => s + (Number(a.quantity) || 0), 0)) * 100,
	) / 100;
	const hasAllocations = (item.rackAllocations ?? []).length > 0;
	const lossRackAllocations = item.lossRackAllocations ?? [];
	const hasLossAllocations = lossRackAllocations.length > 0;
	const totalLossAllocQty = Math.round(
		lossRackAllocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0) * 100,
	) / 100;

	// Stable key representing rack IDs already assigned to other items in the same form.
	// Used to exclude those racks from this item's suggestion so each SKU gets distinct locations.
	const otherItemRackIdsKey = useMemo(
		() =>
			items
				.filter((_, i) => i !== index)
				.flatMap((it) => it.rackAllocations?.map((a) => a.rackId) ?? [])
				.sort()
				.join(","),
		[items, index],
	);

	const rackCapacityHint = useMemo(
		() =>
			item.rackId?.trim() && (putawayPlan?.allocations.length ?? 0) <= 1
				? formatRackCapacityHint(
						putawayPlan?.capacityForRack,
						cartonUomLabel,
						inboundQty,
					)
				: null,
		[putawayPlan?.capacityForRack, putawayPlan?.allocations.length, item.rackId, cartonUomLabel, inboundQty],
	);

	const putawayPlanHint = useMemo(
		() => formatPutawayPlanHint(putawayPlan, cartonUomLabel, inboundQty),
		[putawayPlan, cartonUomLabel, inboundQty],
	);

	const rackSuggestionMessage = putawayPlan?.message ?? null;

	const rackDisplayLabel = useMemo(() => {
		if (!item.rackId?.trim()) return null;
		const allocLabel = item.rackAllocations?.find(
			(a) => a.rackId === item.rackId,
		)?.rackLabel;
		if (allocLabel) return allocLabel;
		const planLabel = putawayPlan?.allocations.find(
			(a) => a.rackId === item.rackId,
		)?.rackLabel;
		if (planLabel) return planLabel;
		const rack = racks.find((r) => r.rackId === item.rackId);
		return rack ? formatRackLocationLabel(rack as Rack) : null;
	}, [item.rackId, item.rackAllocations, putawayPlan, racks]);

	const suggestForRackId =
		item.rackAutoSuggested === true ? null : item.rackId?.trim() || null;

	useEffect(() => {
		if (!debouncedSkuCode?.trim()) {
			setPutawayPlan(null);
			setIsSuggestingRack(false);
			return;
		}

		let cancelled = false;
		setIsSuggestingRack(true);
		(async () => {
			try {
				const excludeRackIds = otherItemRackIdsKey
					? otherItemRackIdsKey.split(",").filter(Boolean)
					: [];
				const data = await gqlRequest<SuggestInboundPutawayPlanQueryData>(
					SUGGEST_INBOUND_PUTAWAY_PLAN_QUERY,
					{
						skuId: debouncedResolvedSkuId || null,
						skuCode: debouncedSkuCode,
						quantity: debouncedInboundQty > 0 ? debouncedInboundQty : 1,
						forRackId: suggestForRackId,
						excludeRackIds: excludeRackIds.length > 0 ? excludeRackIds : null,
					},
				);
				if (cancelled) return;
				const plan = data.suggestInboundPutawayPlan;
				setPutawayPlan(plan);

				const canAutoApply =
					!(item.rackId ?? "").trim() || item.rackAutoSuggested === true;
				if (!plan.allocations.length || !canAutoApply) return;

				const nextAllocations = putawayAllocationsFromPlan(plan);
				const nextRackId = nextAllocations[0]?.rackId ?? "";
				const sameAllocations =
					item.rackAllocations?.length === nextAllocations.length &&
					item.rackAllocations.every(
						(row, idx) =>
							row.rackId === nextAllocations[idx]?.rackId &&
							row.quantity === nextAllocations[idx]?.quantity,
					);
				if (
					item.rackId === nextRackId &&
					item.rackAutoSuggested === true &&
					sameAllocations
				) {
					return;
				}

				onItemsChange(
					items.map((row, i) =>
						i === index
							? {
									...row,
									rackId: nextRackId,
									rackAllocations: nextAllocations,
									rackAutoSuggested: true,
								}
							: row,
					),
				);
			} catch {
				if (!cancelled) setPutawayPlan(null);
			} finally {
				if (!cancelled) setIsSuggestingRack(false);
			}
		})();

		return () => {
			cancelled = true;
			setIsSuggestingRack(false);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- re-suggest when SKU/qty/rack, auto-suggest state, or sibling rack assignments change
	}, [
		debouncedSkuCode,
		debouncedResolvedSkuId,
		debouncedInboundQty,
		suggestForRackId,
		item.rackAutoSuggested,
		index,
		otherItemRackIdsKey,
	]);

	const handleRecommendAssignRack = () => {
		if (!putawayPlan?.allocations.length) return;
		const nextAllocations = putawayAllocationsFromPlan(putawayPlan);
		const nextRackId = nextAllocations[0]?.rackId ?? "";
		onItemsChange(
			items.map((row, i) =>
				i === index
					? {
							...row,
							rackId: nextRackId,
							rackAllocations: nextAllocations,
							rackAutoSuggested: true,
						}
					: row,
			),
		);
		setEditingAllocationIdx(null);
	};

	const canRecommendRack =
		!!item.skuCode?.trim() && inboundQty > 0 && !!putawayPlan?.allocations.length;

	const orderedCtnFromPo =
		poGauge?.expected ??
		(poAsnLines?.length
			? poAsnLines.find((l) => l.skuCode === item.skuCode)?.expected ?? null
			: null);
	const orderedCtnEditable = Boolean(showOrderedQty && orderedCtnFromPo == null);
	const historicalCtn = poHistoricalReceivedBySku?.get(item.skuCode) ?? 0;
	const historicalLoss = poHistoricalLossBySku?.get(item.skuCode) ?? 0;
	const fulfilledCtn = historicalCtn + inboundQty;
	const fulfilledLoss = historicalLoss + lossQty;
	const lossUomLabel = baseUomLabel ?? "PKT";

	return (
		<div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-border/90 hover:shadow-sm">
			<div className="flex items-stretch">
				<div
					className="flex w-9 shrink-0 items-start justify-center border-r border-border/50 bg-muted/30 pt-3"
					aria-hidden
				>
					<span className="flex h-5 w-5 items-center justify-center rounded bg-background text-[10px] font-mono font-bold text-muted-foreground shadow-sm">
						{index + 1}
					</span>
				</div>
				<div className="min-w-0 flex-1 space-y-3 p-3">
					{/* Identity: SKU + badges + remove */}
					<div className="flex items-center gap-2">
						<div className="min-w-0 flex-1">
							<SkuCombobox
								value={skuValue}
								onChange={(v: SkuLineValue) => {
									const nextSkuCode = v.skuCode ?? "";
									// CREATE-only: prefill carton with remaining PO qty (expected −
									// already received) when ASN data is present. poAsnLines is undefined
									// in edit mode, so this never affects edits. Fall back to 1.
									const remaining = poAsnLines
										? remainingForSku(
												nextSkuCode,
												poAsnLines,
												poHistoricalReceivedBySku ?? new Map(),
											)
										: 0;
									const newItems = [...items];
									newItems[index] = {
										...newItems[index],
										skuCode: nextSkuCode,
										description: v.description ?? "",
										uom: v.uom ?? "",
										carton: remaining > 0 ? remaining : 1,
										orderedQty: undefined,
										rackId: "",
										rackAllocations: undefined,
										rackAutoSuggested: false,
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
						{baseUomLabel && (
							<Badge
								variant="outline"
								className="shrink-0 font-mono text-xs h-6"
							>
								{baseUomLabel}
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

					<div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
						{/* Quantities + batch traceability */}
						<div className="grid gap-2.5 sm:grid-cols-2">
							<div className="space-y-2 rounded-lg border border-border/50 bg-[var(--dashboard-surface)]/60 p-2.5 sm:col-span-2">
								<p
									className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Quantities
								</p>
								<GrnQuantitiesTable
									item={item}
									index={index}
									items={items}
									onItemsChange={onItemsChange}
									orderedCtn={orderedCtnFromPo}
									orderedCtnEditable={orderedCtnEditable}
									fulfilledCtn={fulfilledCtn}
									fulfilledLoss={fulfilledLoss}
									looseQuantity={looseQuantity}
									cartonUomLabel={cartonUomLabel}
									lossUomLabel={lossUomLabel}
								/>
							</div>
							<div className="space-y-1">
								<label
									className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
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

						{/* Putaway (CTN rack + loose/loss rack share one border) */}
						<div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 lg:col-start-2">
						<div className={cn("space-y-1.5", lossQty > 0 && "mb-2.5")}>
						<label
							className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Putaway / Rack <span className="text-destructive">*</span>
						</label>
						<div className="flex flex-wrap items-center gap-2">
							<div className="min-w-0 flex-1">
							<RackLocationCombobox
								remoteSearch
								disabled={hasAllocations}
								value={item.rackId ?? ""}
								fallbackLabel={rackDisplayLabel}
								loading={isSuggestingRack && !rackDisplayLabel}
								loadingPlaceholder="Suggesting rack…"
								onChange={(rackId, rackLabel) => {
									const newItems = [...items];
									const cartonQty = Math.max(0, Number(newItems[index].carton) || 0);
									newItems[index] = {
										...newItems[index],
										rackId,
										rackAllocations:
											rackId && cartonQty > 0
												? [{ rackId, quantity: cartonQty, rackLabel }]
												: [],
										rackAutoSuggested: false,
									};
									onItemsChange(newItems);
								}}
								placeholder="Select rack…"
								className="h-8"
							/>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs"
								disabled={
									isSuggestingRack ||
									!canRecommendRack ||
									!item.skuCode?.trim() ||
									netQty <= 0
								}
								title={
									canRecommendRack
										? "Apply the suggested putaway rack allocation for this line"
										: "Enter SKU and quantity to get a rack recommendation"
								}
								onClick={handleRecommendAssignRack}
							>
								{isSuggestingRack ? (
									<>
										<Loader2 className="h-3 w-3 animate-spin" />
										Suggesting…
									</>
								) : (
									<>
										<Sparkles className="h-3 w-3 shrink-0 text-amber-600" />
										Recommend assign rack
									</>
								)}
							</Button>
						</div>
						{putawayPlanHint ? (
							<p
								className="text-[11px] font-medium text-foreground/80 leading-snug"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{putawayPlanHint}
							</p>
						) : rackCapacityHint ? (
							<p
								className="text-[11px] font-medium text-foreground/80 leading-snug"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{rackCapacityHint}
							</p>
						) : null}
						{hasAllocations || lossQty > 0 ? (
							<div
								className={cn(
									"mt-1 rounded-lg border bg-muted/20",
									lossQty > 0 && !isLossRackAllocationValid(item)
										? "border-red-300 dark:border-red-800"
										: "border-border/60",
								)}
							>
								<ul className="divide-y divide-border/40">
									{(item.rackAllocations ?? []).map((allocation, allocIdx) => (
										<li
											key={`putaway-${allocIdx}`}
											className="flex items-center gap-1.5 px-2 py-1 text-[11px]"
										>
											{editingAllocationIdx === allocIdx ? (
												<>
													<div className="min-w-0 flex-1">
														<AllocationEditPicker
															skuId={resolvedSkuId}
															skuCode={item.skuCode}
															currentRackId={allocation.rackId}
															quantity={allocation.quantity}
															excludeRackIds={
																item.rackAllocations
																	?.filter((_, i) => i !== allocIdx)
																	.map((a) => a.rackId) ?? []
															}
															onSelect={(newRackId, newRackLabel) => {
																const newAllocations = item.rackAllocations!.map(
																	(a, i) =>
																		i === allocIdx
																			? { ...a, rackId: newRackId, rackLabel: newRackLabel }
																			: a,
																);
																const newItems = [...items];
																newItems[index] = {
																	...newItems[index],
																	rackAllocations: newAllocations,
																	rackId: allocIdx === 0 ? newRackId : newItems[index].rackId,
																	rackAutoSuggested: false,
																};
																onItemsChange(newItems);
																setEditingAllocationIdx(null);
															}}
															onCancel={() => {
																if (!allocation.rackId) {
																	const newAllocations = item.rackAllocations!.filter((_, i) => i !== allocIdx);
																	const newItems = [...items];
																	newItems[index] = { ...newItems[index], rackAllocations: newAllocations };
																	onItemsChange(newItems);
																}
																setEditingAllocationIdx(null);
															}}
														/>
													</div>
												</>
											) : (
												<>
													<span className="w-20 shrink-0 font-mono text-foreground/85 truncate" title={allocation.rackLabel ?? allocation.rackId}>
														{allocation.rackLabel ?? allocation.rackId}
													</span>
													<Input
														type="number"
														min={0}
														value={allocation.quantity}
														onChange={(e) => {
															const newQty = Math.max(0, Number(e.target.value) || 0);
															const newAllocations = item.rackAllocations!.map(
																(a, i) => i === allocIdx ? { ...a, quantity: newQty } : a,
															);
															const newItems = [...items];
															newItems[index] = {
																...newItems[index],
																rackAllocations: newAllocations,
																rackAutoSuggested: false,
															};
															onItemsChange(newItems);
														}}
														className="h-6 w-14 shrink-0 px-1 text-center font-mono text-[11px]"
													/>
													<span className="shrink-0 text-muted-foreground">{cartonUomLabel}</span>
													<div className="ml-auto flex shrink-0 items-center gap-1">
														<button
															type="button"
															title="Change rack"
															className="text-muted-foreground hover:text-foreground"
															onClick={() => setEditingAllocationIdx(allocIdx)}
														>
															<Pencil className="h-3 w-3" />
														</button>
														<button
															type="button"
															title="Remove rack"
															className="text-muted-foreground hover:text-destructive"
															onClick={() => {
																const newAllocations = item.rackAllocations!.filter((_, i) => i !== allocIdx);
																const newItems = [...items];
																newItems[index] = {
																	...newItems[index],
																	rackAllocations: newAllocations,
																	rackId: newAllocations[0]?.rackId ?? "",
																	rackAutoSuggested: false,
																};
																onItemsChange(newItems);
															}}
														>
															<Trash2 className="h-3 w-3" />
														</button>
													</div>
												</>
											)}
										</li>
									))}
									{lossQty > 0 &&
										(hasLossAllocations ? (
											lossRackAllocations.map((allocation, allocIdx) => {
												const usedElsewhere = lossRackAllocations
													.filter((_, i) => i !== allocIdx)
													.map((a) => a.rackId);
												const availableLooseRacks = looseRacks.filter(
													(r) => !usedElsewhere.includes(r.rackId),
												);
												return (
													<li
														key={`loss-${allocIdx}`}
														className="flex items-center gap-1.5 px-2 py-1 text-[11px]"
													>
														<Badge
															variant="outline"
															className="h-4 shrink-0 px-1 text-[10px] font-normal text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800"
														>
															Loss
														</Badge>
														{editingLossAllocationIdx === allocIdx ? (
															<div className="flex min-w-0 flex-1 items-center gap-1.5">
																<div className="min-w-0 flex-1">
																	<RackLocationCombobox
																		racks={availableLooseRacks}
																		value={allocation.rackId}
																		className="h-7"
																		onChange={(rackId, rackLabel) => {
																			const newAllocations = lossRackAllocations.map(
																				(a, i) =>
																					i === allocIdx
																						? { ...a, rackId, rackLabel }
																						: a,
																			);
																			const newItems = [...items];
																			newItems[index] = {
																				...newItems[index],
																				lossRackAllocations: newAllocations,
																			};
																			onItemsChange(newItems);
																			setEditingLossAllocationIdx(null);
																		}}
																	/>
																</div>
																<button
																	type="button"
																	title="Cancel"
																	className="shrink-0 text-muted-foreground hover:text-foreground"
																	onClick={() => {
																		if (!allocation.rackId) {
																			const newAllocations = lossRackAllocations.filter(
																				(_, i) => i !== allocIdx,
																			);
																			const newItems = [...items];
																			newItems[index] = {
																				...newItems[index],
																				lossRackAllocations: newAllocations,
																			};
																			onItemsChange(newItems);
																		}
																		setEditingLossAllocationIdx(null);
																	}}
																>
																	<X className="h-3 w-3" />
																</button>
															</div>
														) : (
															<>
																<span
																	className="w-20 shrink-0 font-mono text-foreground/85 truncate"
																	title={allocation.rackLabel ?? allocation.rackId}
																>
																	{allocation.rackLabel ?? allocation.rackId}
																</span>
																<Input
																	type="number"
																	min={0}
																	value={allocation.quantity}
																	onChange={(e) => {
																		const newQty = Math.max(0, Number(e.target.value) || 0);
																		const newAllocations = lossRackAllocations.map(
																			(a, i) => (i === allocIdx ? { ...a, quantity: newQty } : a),
																		);
																		const newItems = [...items];
																		newItems[index] = {
																			...newItems[index],
																			lossRackAllocations: newAllocations,
																		};
																		onItemsChange(newItems);
																	}}
																	className="h-6 w-14 shrink-0 px-1 text-center font-mono text-[11px]"
																/>
																<span className="shrink-0 text-muted-foreground">{lossUomLabel}</span>
																<div className="ml-auto flex shrink-0 items-center gap-1">
																	<button
																		type="button"
																		title="Change rack"
																		className="text-muted-foreground hover:text-foreground"
																		onClick={() => setEditingLossAllocationIdx(allocIdx)}
																	>
																		<Pencil className="h-3 w-3" />
																	</button>
																	<button
																		type="button"
																		title="Remove rack"
																		className="text-muted-foreground hover:text-destructive"
																		onClick={() => {
																			const newAllocations = lossRackAllocations.filter(
																				(_, i) => i !== allocIdx,
																			);
																			const newItems = [...items];
																			newItems[index] = {
																				...newItems[index],
																				lossRackAllocations: newAllocations,
																				lossRackId: newAllocations[0]?.rackId ?? "",
																			};
																			onItemsChange(newItems);
																		}}
																	>
																		<Trash2 className="h-3 w-3" />
																	</button>
																</div>
															</>
														)}
													</li>
												);
											})
										) : (
											<li className="flex items-center gap-1.5 px-2 py-1 text-[11px]">
												<Badge
													variant="outline"
													className="h-4 shrink-0 px-1 text-[10px] font-normal text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800"
												>
													Loss
												</Badge>
												<div className="min-w-0 flex-1">
													<RackLocationCombobox
														remoteSearch
														binType="LOOSE_STORAGE"
														value={item.lossRackId ?? ""}
														onChange={(rackId) => {
															const newItems = [...items];
															newItems[index] = { ...newItems[index], lossRackId: rackId };
															onItemsChange(newItems);
														}}
														placeholder="Select loose storage rack…"
														className="h-7"
													/>
												</div>
												<span className="shrink-0 font-mono text-foreground/85">
													{lossQty} {lossUomLabel}
												</span>
												<button
													type="button"
													title="Split the loss quantity across more than one loose storage rack"
													className="shrink-0 text-muted-foreground hover:text-foreground"
													onClick={() => {
														const current = (item.lossRackId ?? "").trim();
														const currentRack = looseRacks.find(
															(r) => r.rackId === current,
														);
														const currentLabel = currentRack
															? formatRackLocationLabel(currentRack)
															: undefined;
														const newAllocations = current
															? [
																{ rackId: current, quantity: lossQty, rackLabel: currentLabel },
																{ rackId: "", quantity: 0, rackLabel: undefined },
															]
															: [{ rackId: "", quantity: lossQty, rackLabel: undefined }];
														const newItems = [...items];
														newItems[index] = {
															...newItems[index],
															lossRackAllocations: newAllocations,
														};
														onItemsChange(newItems);
														setEditingLossAllocationIdx(newAllocations.length - 1);
													}}
												>
													<Plus className="h-3 w-3" />
												</button>
											</li>
									))}
								</ul>
								<div className="flex items-center justify-between border-t border-border/40 px-2 py-1">
									<button
										type="button"
										className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
										onClick={() => {
											const remaining = Math.max(0, inboundQty - totalAllocQty);
											const newAllocations = [
												...(item.rackAllocations ?? []),
												{ rackId: "", quantity: remaining, rackLabel: "" },
											];
											const newItems = [...items];
											newItems[index] = {
												...newItems[index],
												rackAllocations: newAllocations,
												rackAutoSuggested: false,
											};
											onItemsChange(newItems);
											setEditingAllocationIdx(newAllocations.length - 1);
										}}
									>
										<Plus className="h-3 w-3" />
										Add rack
									</button>
									<div className="flex shrink-0 items-center gap-2.5">
										<span
											className={cn(
												"font-mono text-[11px]",
												totalAllocQty === inboundQty
													? "text-green-600 dark:text-green-400"
													: "text-destructive",
											)}
										>
											{totalAllocQty} / {inboundQty} {cartonUomLabel}
										</span>
										{lossQty > 0 ? (
											<span
												className={cn(
													"font-mono text-[11px]",
													isLossRackAllocationValid(item)
														? "text-green-600 dark:text-green-400"
														: "text-destructive",
												)}
											>
												Loss{" "}
												{hasLossAllocations
													? totalLossAllocQty
													: item.lossRackId?.trim()
														? lossQty
														: 0}{" "}
												/ {lossQty} {lossUomLabel}
											</span>
										) : null}
									</div>
								</div>
							</div>
						) : null}
						{rackSuggestionMessage ? (
							<p className="text-[11px] text-muted-foreground leading-snug">
								{item.rackAutoSuggested ? (
									<Badge
										variant="outline"
										className="mr-1.5 h-4 px-1 text-[10px] font-normal"
									>
										Suggested
									</Badge>
								) : null}
								{rackSuggestionMessage}
							</p>
						) : null}
						</div>

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
	endUserId: string;
	poFulfilled: boolean;
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
	/** End users from m_end_user for receipt details */
	endUsers: EndUser[];
	/** When true (ASN create), supplier is optional — backend resolves from ASN entity */
	supplierSelectionOptional?: boolean;
	/** Show manual-GRN PO fulfillment checkbox. Hidden for ASN-backed creates. */
	showPoFulfilledToggle?: boolean;
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
		/** When true, skip auto-adjusting line cartons from PO/ASN history (PENDING ASN). */
		skipPoFulfillmentAdjust?: boolean;
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
	endUsers,
	supplierSelectionOptional = false,
	showPoFulfilledToggle = false,
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
	const [poFulfilledChecked, setPoFulfilledChecked] = useState(true);
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
	const [poHistoricalLossBySku, setPoHistoricalLossBySku] = useState<Map<string, number>>(new Map());
	const lastLookedUpPoRef = useRef<string>("");
	const poRemainingAppliedRef = useRef(false);
	const lookupPoHistory = async (poNo: string) => {
		const trimmed = poNo.trim();
		if (!trimmed || trimmed === lastLookedUpPoRef.current) return;
		lastLookedUpPoRef.current = trimmed;
		poRemainingAppliedRef.current = false;
		setPoHistoryLoading(true);
		try {
			const [historyResult, asnResult] = await Promise.all([
				gqlRequest<GrnsQueryData>(GRNS_QUERY, {
					filter: { poNo: trimmed },
					pageSize: 100,
				}),
				gqlRequest<AdvanceNoticeByPoNoQueryData>(ADVANCE_NOTICE_BY_PO_NO_QUERY, {
					poNo: trimmed,
				}).catch(() => null),
			]);
			const history = historyResult?.grns?.query ?? [];
			setPoHistory(history);

			const asnLines = asnResult?.advanceNoticeByPoNo?.lines ?? [];
			if (asnLines.length > 0) {
				const receivedBySku = sumHistoricalReceivedBySku(history);
				const lossBySku = sumHistoricalLossBySku(history);
				setPoHistoricalReceivedBySku(receivedBySku);
				setPoHistoricalLossBySku(lossBySku);
				const mappedLines = asnLines.map((line) => ({
					skuCode: line.itemid,
					displayName: line.displayname,
					expected: line.quantity,
					units: resolveDisplayUnitCode(line.units, stockUnits, "CTN"),
				}));
				setPoAsnLines(mappedLines);
			} else {
				setPoAsnLines([]);
				setPoHistoricalReceivedBySku(new Map());
				setPoHistoricalLossBySku(new Map());
			}
		} catch {
			setPoHistory([]);
			setPoAsnLines([]);
			setPoHistoricalReceivedBySku(new Map());
			setPoHistoricalLossBySku(new Map());
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
			endUserId: "",
			poFulfilled: true,
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
					const itemErrors: string[] = [];

					const invalidQty = items.find(
						(i) => (Number(i.carton) || 0) + (Number(i.loss) || 0) <= 0,
					);
					if (invalidQty) {
						itemErrors.push(
							"Each line item must have total quantity (Carton + Loss) greater than zero.",
						);
					}

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
						itemErrors.push(
							"Line items require Lot No. and/or Expiry Date based on each SKU's lot/expiry control settings.",
						);
					}

					const missingRack = items.find(
						(i) => !(i.rackId ?? "").trim(),
					);
					if (missingRack) {
						itemErrors.push("Each line item must have a rack.");
					}

					const missingLossRack = items.find(
						(i) => !isLossRackAllocationValid(i),
					);
					if (missingLossRack) {
						itemErrors.push(
							"Each line item with a loss quantity must have Loose / Loss Rack(s) covering the full loss quantity.",
						);
					}

					const missingLooseQuantity = items.find(
						(i) => !isRemainingComputableForItem(i, skuOptions),
					);
					if (missingLooseQuantity) {
						itemErrors.push(
							"Each line item with a loss quantity needs its SKU's loose quantity (pieces/carton) configured before the remaining qty can be computed.",
						);
					}

					if (value.poFulfilled === false) {
						const invalidOrderedQty = items.find((i) => {
							const orderedQty = resolveLineOrderedCtn(i, poAsnLines);
							const cartonQty = Number(i.carton) || 0;
							return (
								orderedQty == null ||
								!Number.isFinite(orderedQty) ||
								orderedQty < cartonQty
							);
						});
						if (invalidOrderedQty) {
							itemErrors.push(
								"Partial delivery requires an ordered quantity for every line, and each ordered quantity must be at least the received carton quantity.",
							);
						}
					}

					if (itemErrors.length === 0) {
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
							itemErrors.push(
								"Duplicate line items: two or more rows share the same SKU and batch identifiers. Use different lot/expiry values or merge quantities into one row.",
							);
						}
					}

					if (itemErrors.length > 0) {
						fields.items = itemErrors.join(" ");
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
				const missingLossRack = (value.items ?? []).find(
					(i) => !isLossRackAllocationValid(i),
				);
				if (missingLossRack) {
					toast.error(
						"Each line item with a loss quantity must have Loose / Loss Rack(s) covering the full loss quantity.",
					);
					return;
				}
				const missingLooseQuantity = (value.items ?? []).find(
					(i) => !isRemainingComputableForItem(i, skuOptions),
				);
				if (missingLooseQuantity) {
					toast.error(
						"Each line item with a loss quantity needs its SKU's loose quantity (pieces/carton) configured before the remaining qty can be computed.",
					);
					return;
				}
				const payload: GrnCreateSubmitPayload = {
					grnNumber: value.grnNumber,
					poReference: value.poReference ?? "",
					supplierId: value.supplierId ?? "",
					supplierDO: value.supplierDO,
					receivedDate: value.receivedDate,
					notes: value.notes ?? "",
					warehouseId: value.warehouseId ?? "",
					endUserId: value.endUserId ?? "",
					poFulfilled: value.poFulfilled !== false,
					submitIntent: createIntentRef.current,
					items: (value.items ?? []).map((i) => {
						const orderedCtn =
							value.poFulfilled === false
								? resolveLineOrderedCtn(i, poAsnLines)
								: undefined;
						return {
							...i,
							orderedQty: orderedCtn,
							...buildGrnItemRackPayload(i),
							...buildGrnItemLossRackPayload(i),
						};
					}),
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
							const rackPayload = buildGrnItemRackPayload(i);
							const lossRackPayload = buildGrnItemLossRackPayload(i);
							return {
								skuId:
									skuOptions.find((s) => s.skuCode === i.skuCode)?.skuId ??
									undefined,
								skuCode: i.skuCode,
								skuDescription: i.description ?? undefined,
								qty: String(i.carton),
								lossQty: String(i.loss),
								lossRackId: i.lossRackId?.trim() || undefined,
								skuUom: uomId ?? undefined,
								expiryDate: (i.expiryDate ?? "").trim() || undefined,
								lotNo: (i.lotNo ?? "").trim() || undefined,
								...rackPayload,
								...lossRackPayload,
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
				const legacyAllocations = (
					it as {
						rackAllocations?: Array<{
							rackId: string;
							quantity: number;
						}>;
					}
				).rackAllocations;
				const rackId =
					legacyAllocations?.[0]?.rackId ??
					legacyRackIds?.[0] ??
					rack?.rackId ??
					(it as { rackId?: string }).rackId ??
					"";
				const rackAllocations =
					legacyAllocations?.map((row) => ({
						rackId: row.rackId,
						quantity: row.quantity,
					})) ??
					(legacyRackIds?.length
						? legacyRackIds.map((id) => ({
								rackId: id,
								quantity: Math.max(
									0,
									(it.expectedQuantity ?? 0) - (it.lossQuantity ?? 0),
								),
							}))
						: undefined);
				const expiryDate = it.expiryDate ?? "";
				const lotNo = it.lotNo ?? "";
				const lossRackAllocationsSource = it.lossRackAllocations ?? undefined;
				const lossRackId =
					lossRackAllocationsSource?.[0]?.rackId ?? it.lossRackId ?? "";
				const lossRackAllocations = lossRackAllocationsSource?.map((row) => ({
					rackId: row.rackId,
					quantity: row.quantity,
				}));
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
					rackAllocations,
					lossRackId,
					lossRackAllocations,
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
				endUserId: (grn as { endUserId?: string | null }).endUserId ?? "",
				poFulfilled: true,
				items: initialItems,
			});
			setPoFulfilledChecked(true);
		} else if (mode === "create") {
			form.reset({
				grnNumber: "",
				poReference: initialValues?.poReference ?? "",
				supplierId: "",
				supplierDO: "",
				receivedDate: initialValues?.receivedDate ?? "",
				notes: "",
				warehouseId: "",
				endUserId: "",
				poFulfilled: true,
				items: (initialValues?.items ?? []) as GRNLineItemForm[],
			});
			setPoFulfilledChecked(true);
			setProofFiles([]);
		}
	}, [open, mode, grn?.id, initialValues]);

	// After PO/ASN history loads, prefill line carton qty with remaining (expected − prior receipts).
	useEffect(() => {
		if (
			!open ||
			mode !== "create" ||
			initialValues?.skipPoFulfillmentAdjust ||
			poHistoryLoading ||
			poAsnLines.length === 0
		) {
			return;
		}
		if (poRemainingAppliedRef.current) return;

		const items = (form.state.values.items ?? []) as GRNLineItemForm[];
		if (items.length === 0) return;

		const nextItems = applyRemainingQtyToLineItems(
			items,
			poAsnLines,
			poHistoricalReceivedBySku,
		);
		const changed = nextItems.some(
			(item, index) => item.carton !== items[index]?.carton,
		);
		if (changed) {
			form.setFieldValue("items", nextItems);
		}
		poRemainingAppliedRef.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run when PO fulfillment data loads, not on every form edit
	}, [open, mode, poHistoryLoading, poAsnLines, poHistoricalReceivedBySku, initialValues?.skipPoFulfillmentAdjust]);

	useEffect(() => {
		if (!open) {
			poRemainingAppliedRef.current = false;
			lastLookedUpPoRef.current = "";
		}
	}, [open]);

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
			className="flex max-h-[90vh] w-[min(96vw,1200px)] max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-background p-0 shadow-2xl sm:max-w-[1200px]"
		>
			<DialogHeader className="shrink-0 border-b border-border/60 bg-[var(--dashboard-surface)]/50 px-6 py-4">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 shadow-sm ring-1 ring-amber-700/20">
						<Package className="h-5 w-5 text-white" />
					</div>
					<div className="min-w-0 flex-1">
						<DialogTitle
							className="text-lg font-semibold leading-tight"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							{title}
						</DialogTitle>
						<DialogDescription
							className="mt-0.5 text-sm text-muted-foreground"
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
					className="flex min-h-0 flex-1 flex-col"
				>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
						<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
							{/* Left column: receipt metadata + attachments */}
							<div className="space-y-5 lg:sticky lg:top-0">
								<GrnFormSection icon={FileText} title="Receipt Details">
									<div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
										<FieldGroup className="gap-4">
											<form.Field name="endUserId">
										{(field) => (
											<Field>
												<FieldLabel
													htmlFor={field.name}
													style={{ fontFamily: "var(--dashboard-body)" }}
												>
													End User
												</FieldLabel>
												<Select
													value={field.state.value || undefined}
													onValueChange={(v) => field.handleChange(v)}
												>
													<SelectTrigger
														id={field.name}
														className="rounded-lg border-muted-foreground/20 font-mono text-sm w-full"
													>
														<SelectValue placeholder="Select end user…" />
													</SelectTrigger>
													<SelectContent>
														{endUsers.map((u) => (
															<SelectItem key={u.endUserId} value={u.endUserId}>
																{u.userName}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												{endUsers.length === 0 ? (
													<p className="text-xs text-amber-600 mt-1">
														No end users in master data. Add end users in Settings first.
													</p>
												) : null}
											</Field>
										)}
									</form.Field>
											<form.Field name="poReference">
										{(field) => {
											const isInvalid = field.state.meta.errors.length > 0;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel
														htmlFor={field.name}
														style={{ fontFamily: "var(--dashboard-body)" }}
													>
														End User PO{" "}
														<span className="text-destructive">*</span>
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
									{isCreate && showPoFulfilledToggle ? (
										<form.Field name="poFulfilled">
											{(field) => (
												<div className="flex flex-row items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
													<Checkbox
														id={field.name}
														checked={Boolean(field.state.value)}
														onCheckedChange={(checked) => {
															const next = checked === true;
															field.handleChange(next);
															setPoFulfilledChecked(next);
														}}
														onBlur={field.handleBlur}
														className="mt-0.5 shrink-0"
													/>
													<div className="grid gap-1.5 leading-none min-w-0">
														<FieldLabel
															htmlFor={field.name}
															className="cursor-pointer text-sm font-medium"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															PO fully fulfilled by this delivery
														</FieldLabel>
														<p className="text-xs text-muted-foreground">
															Uncheck for a partial PO delivery and enter ordered quantities per line.
														</p>
													</div>
												</div>
											)}
										</form.Field>
									) : null}
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
									<form.Field name="receivedDate">
									{(field) => {
										const isInvalid = field.state.meta.errors.length > 0;
										return (
											<Field data-invalid={isInvalid}>
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
								</GrnFormSection>

								<GrnFormSection
									icon={Upload}
									title="Proof Upload"
									subtitle="Up to 5 images or PDFs"
								>
									<div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
										<FileUpload
											files={proofFiles}
											onFilesChange={setProofFiles}
											maxFiles={5}
											accept="image/*,application/pdf"
										/>
									</div>
								</GrnFormSection>

								<GrnFormSection icon={FileText} title="Additional Notes">
									<div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
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
														className="min-h-[88px] resize-none rounded-lg border-muted-foreground/20 text-sm"
														style={{ fontFamily: "var(--dashboard-body)" }}
													/>
												</Field>
											)}
										</form.Field>
									</div>
								</GrnFormSection>
							</div>

							{/* Right column: line items */}
							<div className="min-w-0 space-y-3">
								<GrnFormSection
									icon={Package}
									title="Line Items"
									subtitle="Received SKUs, quantities, and putaway"
									action={
										<form.Field name="items">
											{(field) => {
												const items = (field.state.value ??
													[]) as GRNLineItemForm[];
												return (
													<div className="flex items-center gap-2">
														{items.length > 0 ? (
															<Badge
																variant="secondary"
																className="h-6 font-mono text-[10px] tabular-nums"
															>
																{items.length} {items.length === 1 ? "line" : "lines"}
															</Badge>
														) : null}
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="h-8 gap-1.5 rounded-lg border-amber-500/60 text-amber-700 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
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
													</div>
												);
											}}
										</form.Field>
									}
								>
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
												<div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-amber-300/60 bg-gradient-to-b from-amber-50/50 to-transparent px-6 py-10 text-muted-foreground dark:border-amber-700/40 dark:from-amber-950/20">
													<div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100/80 dark:bg-amber-950/50">
														<Package className="h-6 w-6 text-amber-500/80" />
													</div>
													<div className="max-w-xs text-center">
														<p
															className="text-sm font-medium text-foreground/80"
															style={{ fontFamily: "var(--dashboard-display)" }}
														>
															No line items yet
														</p>
														<p
															className="mt-1 text-xs text-muted-foreground"
															style={{ fontFamily: "var(--dashboard-body)" }}
														>
															Add SKUs received on this delivery, then assign putaway racks for each line.
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
															poHistoricalLossBySku={isCreate ? poHistoricalLossBySku : undefined}
															showOrderedQty={
																isCreate &&
																showPoFulfilledToggle &&
																!poFulfilledChecked
															}
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
								</GrnFormSection>
							</div>
						</div>
					</div>

					<form.Subscribe
						selector={(state) => [state.isSubmitting, state.canSubmit]}
					>
						{([isSubmitting, canSubmit]) => (
							<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-[var(--dashboard-surface)]/30 px-6 py-4">
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