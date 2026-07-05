import { Eye } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";

/** Primary dashboard CTA — matches Multi-line transfer / Create Adjustment buttons. */
export const dashboardAccentButtonClassName =
	"gap-2 text-white shrink-0 disabled:opacity-50";

export const dashboardAccentButtonStyle: CSSProperties = {
	background: "var(--dashboard-accent)",
	borderColor: "var(--dashboard-accent)",
};

export const dashboardAccentButtonProps = {
	className: dashboardAccentButtonClassName,
	style: dashboardAccentButtonStyle,
} as const;

export const transferTableWrapperClassName = "overflow-x-auto rounded-lg border";

export const transferTableEmptyCellClassName =
	"text-center py-8 text-muted-foreground";

export const transferTableMonoCellClassName = "font-mono text-sm";

/** Format quantity with optional SKU UOM code (e.g. "12 CTN"). */
export function formatQtyWithUom(
	qty: number,
	stockUnitCode?: string | null,
): string {
	const amount = qty.toLocaleString();
	const uom = stockUnitCode?.trim();
	return uom ? `${amount} ${uom}` : amount;
}

/** Combobox availability — always shows both parts (e.g. "12 CTN, 0 Loss"). */
export function formatCtnLossComma(ctn: number, loss: number): string {
	const safeCtn = Number.isFinite(ctn) ? Math.max(0, Math.floor(ctn)) : 0;
	const safeLoss = Number.isFinite(loss) ? Math.max(0, Math.floor(loss)) : 0;
	return `${safeCtn.toLocaleString()} CTN, ${safeLoss.toLocaleString()} Loss`;
}

/** Available / quantity labels — pipe-separated (e.g. "12 ctn | 5 loss"). */
export function formatCtnLossPipe(ctn: number, loss: number): string {
	const safeCtn = Number.isFinite(ctn) ? Math.max(0, Math.floor(ctn)) : 0;
	const safeLoss = Number.isFinite(loss) ? Math.max(0, Math.floor(loss)) : 0;
	return `${safeCtn.toLocaleString()} ctn | ${safeLoss.toLocaleString()} loss`;
}

/** Draft queue / work-queue quantity cell (e.g. "12 CTN + 5 Loss"). */
export function formatTransferQtyDisplay(item: {
	quantity: string;
	lossQuantity?: string | null;
}): string {
	const carton = Number(item.quantity ?? 0);
	const loss = Number(item.lossQuantity ?? 0);
	const parts: string[] = [];
	if (Number.isFinite(carton) && carton > 0) {
		parts.push(`${carton.toLocaleString()} CTN`);
	}
	if (Number.isFinite(loss) && loss > 0) {
		parts.push(`${loss.toLocaleString()} Loss`);
	}
	return parts.length > 0 ? parts.join(" + ") : "0";
}

type TransferDraftActionsProps = {
	onApprove: () => void;
	onReject: () => void;
	onView?: () => void;
	disabled?: boolean;
};

/** Approve / Reject / View — shared between draft queue and records table. */
export function TransferDraftActions({
	onApprove,
	onReject,
	onView,
	disabled = false,
}: TransferDraftActionsProps) {
	return (
		<div className="flex flex-wrap items-center justify-end gap-2">
			<Button
				type="button"
				size="sm"
				{...dashboardAccentButtonProps}
				disabled={disabled}
				onClick={onApprove}
			>
				Approve
			</Button>
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="text-destructive hover:bg-destructive/10 hover:text-destructive"
				disabled={disabled}
				onClick={onReject}
			>
				Reject
			</Button>
			{onView ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0"
					disabled={disabled}
					onClick={onView}
					title="View details"
				>
					<Eye className="h-4 w-4" />
				</Button>
			) : null}
		</div>
	);
}
