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
