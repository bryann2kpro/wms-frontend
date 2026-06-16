import type { ReactNode } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Skus, StockUnit } from "@/lib/graphql/types";
import { statusColors } from "@/lib/utils";

function formatNum(val: number | null | undefined, decimals: number): string {
	if (val == null) return "—";
	return Number(val).toFixed(decimals);
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: ReactNode;
}) {
	return (
		<div className="grid grid-cols-[140px_1fr] gap-2 py-2 border-b border-border/50 last:border-0">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="text-sm font-medium">{value}</dd>
		</div>
	);
}

export function ItemViewDialog({
	open,
	onOpenChange,
	item,
	stockUnits,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: Skus | null;
	stockUnits: StockUnit[];
}) {
	if (!item) return null;

	const uom = stockUnits.find((u) => u.stockUnitId === item.skuUom);
	const uomLabel = uom ? `${uom.unitName} (${uom.unitCode})` : item.skuUom;
	const status = item.isActive ? "active" : "inactive";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
				<DialogHeader>
					<DialogTitle>{item.skuCode}</DialogTitle>
					<DialogDescription>{item.skuDescription}</DialogDescription>
				</DialogHeader>

				<dl className="mt-2">
					<DetailRow
						label="Status"
						value={
							<Badge variant="outline" className={statusColors[status]}>
								{item.isActive ? "Active" : "Inactive"}
							</Badge>
						}
					/>
					<DetailRow label="Barcode" value={item.barcode ?? "—"} />
					<DetailRow label="Brand" value={item.brand ?? "—"} />
					<DetailRow label="Category" value={item.category ?? "—"} />
					<DetailRow label="Manufacturer" value={item.manufacturer ?? "—"} />
					<DetailRow label="Unit of Measure" value={uomLabel} />
					<DetailRow
						label="Case Rate"
						value={formatNum(item.caseRate, 2)}
					/>
					<DetailRow
						label="Case Ext Length (mm)"
						value={formatNum(item.caseExtLengthMm, 3)}
					/>
					<DetailRow
						label="Case Ext Width (mm)"
						value={formatNum(item.caseExtWidthMm, 3)}
					/>
					<DetailRow
						label="Case Ext Height (mm)"
						value={formatNum(item.caseExtHeightMm, 3)}
					/>
					<DetailRow
						label="Case Gross Weight (kg)"
						value={formatNum(item.caseGrossWeightKg, 3)}
					/>
					<DetailRow
						label="Cases Per Layer"
						value={formatNum(item.casesPerLayer, 3)}
					/>
					<DetailRow
						label="No Of Layers"
						value={formatNum(item.noOfLayers, 3)}
					/>
				</dl>
			</DialogContent>
		</Dialog>
	);
}
