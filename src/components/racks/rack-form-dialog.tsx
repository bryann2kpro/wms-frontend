"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Rack, Area } from "@/lib/graphql/types";
import type { WarehouseOption } from "@/components/grn/warehouse-combobox";

export const BIN_TYPES = ["FIXED", "PICK_FACE", "RESERVE", "BULK"] as const;

/** Normalise a level string to a zero-padded 2-digit form (e.g. "1" -> "01"). */
export const formatLevel = (lvl: string | null | undefined): string => {
	if (!lvl) return "";
	const match = lvl.trim().match(/\d+/);
	return match ? match[0].padStart(2, "0") : lvl.trim();
};

/** Zero-pad bay/column numeric value to 2 digits (e.g. "3" -> "03"). */
export const formatBay = (bay: string | null | undefined): string => {
	if (!bay) return "";
	const trimmed = bay.trim();
	const match = trimmed.match(/\d+/);
	return match ? match[0].padStart(2, "0") : trimmed;
};

/** Build bin code as {row}-L{level}-{bayPadded}, e.g. A1-L3-03 */
export const computeBinCode = (
	row: string,
	level: string,
	bay: string,
): string => {
	const rowTrim = row.trim();
	const levelTrim = level.trim();
	const bayPadded = formatBay(bay);
	const parts: string[] = [];
	if (rowTrim) parts.push(rowTrim);
	if (levelTrim) parts.push(`L${levelTrim}`);
	if (bayPadded) parts.push(bayPadded);
	return parts.join("-");
};

/** Trim a numeric text input, returning null when empty. */
export const toNumericInput = (value: string): string | null => {
	const trimmed = value.trim();
	return trimmed || null;
};

type FormValues = {
	rackRow: string;
	rackColumn: string;
	rackLevel: string;
	binCode: string;
	barCode: string;
	binType: string;
	length: string;
	width: string;
	height: string;
	weight: string;
	maxPallet: string;
	warehouseId: string | null;
	areaId: string | null;
	isActive: boolean;
};

export type RackFormSubmitValues = Omit<
	FormValues,
	"binCode" | "barCode" | "length" | "width" | "height" | "weight" | "maxPallet"
> & {
	binCode?: string | null;
	barCode?: string | null;
	length?: string | null;
	width?: string | null;
	height?: string | null;
	weight?: string | null;
	maxPallet?: string | null;
};

function SectionHeading({ children }: { children: string }) {
	return (
		<h3
			className="text-sm font-semibold text-foreground"
			style={{ fontFamily: "var(--dashboard-display)" }}
		>
			{children}
		</h3>
	);
}

export function RackFormDialog({
	open,
	onOpenChange,
	initial,
	areas,
	warehouses,
	defaultWarehouseId,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: Rack;
	areas: Area[];
	warehouses: WarehouseOption[];
	/** Pre-selected warehouse for new racks (e.g. when creating from a warehouse row). */
	defaultWarehouseId?: string | null;
	onSubmit: (v: RackFormSubmitValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [rackRow, setRackRow] = useState(initial?.rackRow ?? "");
	const [rackColumn, setRackColumn] = useState(initial?.rackColumn ?? "");
	const [rackLevel, setRackLevel] = useState(initial?.rackLevel ?? "");
	const [barCode, setBarCode] = useState(initial?.barCode ?? "");
	const [binType, setBinType] = useState(initial?.binType ?? "FIXED");
	const [length, setLength] = useState(initial?.length ?? "");
	const [width, setWidth] = useState(initial?.width ?? "");
	const [height, setHeight] = useState(initial?.height ?? "");
	const [weight, setWeight] = useState(initial?.weight ?? "");
	const [maxPallet, setMaxPallet] = useState(initial?.maxPallet ?? "");
	const [areaId, setAreaId] = useState<string | null>(initial?.areaId ?? null);
	const [warehouseId, setWarehouseId] = useState<string | null>(
		initial?.warehouseId ?? defaultWarehouseId ?? null,
	);
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);

	const binCode = useMemo(
		() => computeBinCode(rackRow, rackLevel, rackColumn),
		[rackRow, rackLevel, rackColumn],
	);

	useEffect(() => {
		if (open) {
			setRackRow(initial?.rackRow ?? "");
			setRackColumn(initial?.rackColumn ?? "");
			setRackLevel(initial?.rackLevel ?? "");
			setBarCode(initial?.barCode ?? "");
			setBinType(initial?.binType ?? "FIXED");
			setLength(initial?.length ?? "");
			setWidth(initial?.width ?? "");
			setHeight(initial?.height ?? "");
			setWeight(initial?.weight ?? "");
			setMaxPallet(initial?.maxPallet ?? "");
			setAreaId(initial?.areaId ?? null);
			setWarehouseId(initial?.warehouseId ?? defaultWarehouseId ?? null);
			setIsActive(initial?.isActive ?? true);
		}
	}, [open, initial?.rackId, defaultWarehouseId]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setRackRow(initial?.rackRow ?? "");
			setRackColumn(initial?.rackColumn ?? "");
			setRackLevel(initial?.rackLevel ?? "");
			setBarCode(initial?.barCode ?? "");
			setBinType(initial?.binType ?? "FIXED");
			setLength(initial?.length ?? "");
			setWidth(initial?.width ?? "");
			setHeight(initial?.height ?? "");
			setWeight(initial?.weight ?? "");
			setMaxPallet(initial?.maxPallet ?? "");
			setAreaId(initial?.areaId ?? null);
			setWarehouseId(initial?.warehouseId ?? defaultWarehouseId ?? null);
			setIsActive(initial?.isActive ?? true);
		}
		onOpenChange(next);
	};

	const canSubmit =
		rackRow.trim() && rackColumn.trim() && rackLevel.trim() && !loading;

	const fieldLabelProps = {
		style: { fontFamily: '"Figtree", sans-serif' } as const,
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-[min(96vw,42rem)] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-background shadow-xl p-0 sm:max-w-2xl"
				aria-busy={loading}
			>
				<DialogHeader className="border-b border-border/60 bg-muted/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
					<DialogTitle
						className="text-lg sm:text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						{title}
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						{description}
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 min-h-0 sm:px-6 sm:py-5 sm:space-y-6">
					<section className="space-y-3">
						<SectionHeading>Location</SectionHeading>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div className="grid gap-2">
								<Label htmlFor="rack-row" {...fieldLabelProps}>
									Storage Row <span className="text-destructive">*</span>
								</Label>
								<Input
									id="rack-row"
									value={rackRow}
									onChange={(e) => setRackRow(e.target.value)}
									placeholder="e.g. A1"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rack-level" {...fieldLabelProps}>
									Level <span className="text-destructive">*</span>
								</Label>
								<Input
									id="rack-level"
									value={rackLevel}
									onChange={(e) => setRackLevel(e.target.value)}
									placeholder="e.g. 3"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rack-col" {...fieldLabelProps}>
									Storage Bay <span className="text-destructive">*</span>
								</Label>
								<Input
									id="rack-col"
									value={rackColumn}
									onChange={(e) => setRackColumn(e.target.value)}
									placeholder="e.g. 3"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
						</div>
					</section>

					<section className="space-y-3">
						<SectionHeading>Identification</SectionHeading>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="grid gap-2">
								<Label htmlFor="bin-code" {...fieldLabelProps}>
									Bin Code
								</Label>
								<Input
									id="bin-code"
									value={binCode}
									readOnly
									tabIndex={-1}
									placeholder="e.g. A1-L3-03"
									className="rounded-lg border-muted-foreground/20 bg-muted/40 font-mono text-muted-foreground"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="barcode" {...fieldLabelProps}>
									Barcode
								</Label>
								<Input
									id="barcode"
									value={barCode}
									onChange={(e) => setBarCode(e.target.value)}
									placeholder="e.g. ZZ000001"
									className="rounded-lg border-muted-foreground/20 font-mono"
								/>
							</div>
						</div>
					</section>

					<section className="space-y-3">
						<SectionHeading>Physical dimensions</SectionHeading>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
							<div className="grid gap-2">
								<Label htmlFor="rack-length" {...fieldLabelProps}>
									Length (mm)
								</Label>
								<Input
									id="rack-length"
									type="number"
									min={0}
									step="any"
									value={length}
									onChange={(e) => setLength(e.target.value)}
									placeholder="1200"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rack-width" {...fieldLabelProps}>
									Width (mm)
								</Label>
								<Input
									id="rack-width"
									type="number"
									min={0}
									step="any"
									value={width}
									onChange={(e) => setWidth(e.target.value)}
									placeholder="1000"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rack-height" {...fieldLabelProps}>
									Height (mm)
								</Label>
								<Input
									id="rack-height"
									type="number"
									min={0}
									step="any"
									value={height}
									onChange={(e) => setHeight(e.target.value)}
									placeholder="2000"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rack-weight" {...fieldLabelProps}>
									Weight (kg)
								</Label>
								<Input
									id="rack-weight"
									type="number"
									min={0}
									step="any"
									value={weight}
									onChange={(e) => setWeight(e.target.value)}
									placeholder="500"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rack-max-pallet" {...fieldLabelProps}>
									Max Pallets
								</Label>
								<Input
									id="rack-max-pallet"
									type="number"
									min={0}
									step="any"
									value={maxPallet}
									onChange={(e) => setMaxPallet(e.target.value)}
									placeholder="2"
									className="rounded-lg border-muted-foreground/20"
								/>
							</div>
						</div>
					</section>

					<section className="space-y-3">
						<SectionHeading>Warehouse & type</SectionHeading>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="grid gap-2">
								<Label {...fieldLabelProps}>Warehouse</Label>
								<Select
									value={warehouseId ?? "none"}
									onValueChange={(v) => setWarehouseId(v === "none" ? null : v)}
								>
									<SelectTrigger className="rounded-lg border-muted-foreground/20">
										<SelectValue placeholder="No warehouse" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">No warehouse</SelectItem>
										{warehouses.map((w) => (
											<SelectItem key={w.warehouseId} value={w.warehouseId}>
												{w.warehouseName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label {...fieldLabelProps}>Storage Type</Label>
								<Select value={binType} onValueChange={setBinType}>
									<SelectTrigger className="rounded-lg border-muted-foreground/20">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{BIN_TYPES.map((t) => (
											<SelectItem key={t} value={t}>
												{t}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2 sm:col-span-2">
								<Label {...fieldLabelProps}>Location (Area)</Label>
								<Select
									value={areaId ?? "none"}
									onValueChange={(v) => setAreaId(v === "none" ? null : v)}
								>
									<SelectTrigger className="rounded-lg border-muted-foreground/20">
										<SelectValue placeholder="No area" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">No area</SelectItem>
										{areas.map((a) => (
											<SelectItem key={a.areaId} value={a.areaId}>
												{a.areaCode} — {a.areaName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</section>

					<div className="flex items-center gap-2 pt-1">
						<Checkbox
							id="is-active"
							checked={isActive}
							onCheckedChange={(v) => setIsActive(!!v)}
						/>
						<Label
							htmlFor="is-active"
							className="cursor-pointer"
							{...fieldLabelProps}
						>
							Active
						</Label>
					</div>
				</div>

				<DialogFooter className="border-t border-border/60 bg-muted/20 px-4 py-3 gap-2 shrink-0 sm:px-6">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						disabled={!canSubmit}
						onClick={() =>
							onSubmit({
								rackRow: rackRow.trim(),
								rackColumn: rackColumn.trim(),
								rackLevel: formatLevel(rackLevel),
								binCode: binCode || null,
								barCode: barCode.trim() || null,
								binType,
								length: toNumericInput(length),
								width: toNumericInput(width),
								height: toNumericInput(height),
								weight: toNumericInput(weight),
								maxPallet: toNumericInput(maxPallet),
								warehouseId,
								areaId,
								isActive,
							})
						}
						className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
