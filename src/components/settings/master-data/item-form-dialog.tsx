import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { StockUnit } from "@/lib/graphql/types";
import { SkusFormStep3 } from "./skus-form-steps";

export interface ItemFormValues {
	skuCode: string;
	skuDescription: string;
	skuUom: string;
	barcode?: string | null;
	brand?: string | null;
	category?: string | null;
	manufacturer?: string | null;
	caseRate?: number | null;
	caseExtLengthMm?: number | null;
	caseExtWidthMm?: number | null;
	caseExtHeightMm?: number | null;
	caseGrossWeightKg?: number | null;
	casesPerLayer?: number | null;
	noOfLayers?: number | null;
	isActive?: boolean;
}

export interface ItemFormInitial {
	skuCode: string;
	skuDescription: string;
	skuUom: string;
	barcode?: string | null;
	brand?: string | null;
	category?: string | null;
	manufacturer?: string | null;
	caseRate?: number | null;
	caseExtLengthMm?: number | null;
	caseExtWidthMm?: number | null;
	caseExtHeightMm?: number | null;
	caseGrossWeightKg?: number | null;
	casesPerLayer?: number | null;
	noOfLayers?: number | null;
	isActive?: boolean;
}

function parseOptionalFloat(v: string): number | null {
	const t = v.trim();
	if (t === "") return null;
	const n = parseFloat(t);
	return isNaN(n) ? null : n;
}

export function ItemFormDialog({
	open,
	onOpenChange,
	stockUnits,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	stockUnits: StockUnit[];
	initial?: ItemFormInitial;
	onSubmit: (v: ItemFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [skuCode, setSkuCode] = useState(initial?.skuCode ?? "");
	const [skuDescription, setSkuDescription] = useState(
		initial?.skuDescription ?? "",
	);
	const [skuUom, setSkuUom] = useState(initial?.skuUom ?? "");
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);
	const [barcode, setBarcode] = useState(initial?.barcode ?? "");
	const [brand, setBrand] = useState(initial?.brand ?? "");
	const [category, setCategory] = useState(initial?.category ?? "");
	const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
	const [caseRate, setCaseRate] = useState(initial?.caseRate?.toString() ?? "");
	const [caseExtLengthMm, setCaseExtLengthMm] = useState(
		initial?.caseExtLengthMm?.toString() ?? "",
	);
	const [caseExtWidthMm, setCaseExtWidthMm] = useState(
		initial?.caseExtWidthMm?.toString() ?? "",
	);
	const [caseExtHeightMm, setCaseExtHeightMm] = useState(
		initial?.caseExtHeightMm?.toString() ?? "",
	);
	const [caseGrossWeightKg, setCaseGrossWeightKg] = useState(
		initial?.caseGrossWeightKg?.toString() ?? "",
	);
	const [casesPerLayer, setCasesPerLayer] = useState(
		initial?.casesPerLayer?.toString() ?? "",
	);
	const [noOfLayers, setNoOfLayers] = useState(
		initial?.noOfLayers?.toString() ?? "",
	);
	const [errors, setErrors] = useState<{
		skuCode?: string;
		skuDescription?: string;
		skuUom?: string;
	}>({});

	const initialRef = useRef(initial);
	initialRef.current = initial;

	const resetFormFromInitial = () => {
		const i = initialRef.current;
		setSkuCode(i?.skuCode ?? "");
		setSkuDescription(i?.skuDescription ?? "");
		setSkuUom(i?.skuUom ?? "");
		setIsActive(i?.isActive ?? true);
		setBarcode(i?.barcode ?? "");
		setBrand(i?.brand ?? "");
		setCategory(i?.category ?? "");
		setManufacturer(i?.manufacturer ?? "");
		setCaseRate(i?.caseRate?.toString() ?? "");
		setCaseExtLengthMm(i?.caseExtLengthMm?.toString() ?? "");
		setCaseExtWidthMm(i?.caseExtWidthMm?.toString() ?? "");
		setCaseExtHeightMm(i?.caseExtHeightMm?.toString() ?? "");
		setCaseGrossWeightKg(i?.caseGrossWeightKg?.toString() ?? "");
		setCasesPerLayer(i?.casesPerLayer?.toString() ?? "");
		setNoOfLayers(i?.noOfLayers?.toString() ?? "");
		setErrors({});
	};

	useEffect(() => {
		if (open) {
			resetFormFromInitial();
		}
	}, [open]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			resetFormFromInitial();
		}
		onOpenChange(next);
	};

	const validate = () => {
		const newErrors: typeof errors = {};
		if (!skuCode.trim()) newErrors.skuCode = "Code is required";
		if (!skuDescription.trim())
			newErrors.skuDescription = "Description is required";
		if (!skuUom) newErrors.skuUom = "Unit of measure is required";
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = () => {
		if (!validate()) return;
		onSubmit({
			skuCode: skuCode.trim(),
			skuDescription: skuDescription.trim(),
			skuUom,
			barcode: barcode.trim() || null,
			brand: brand.trim() || null,
			category: category.trim() || null,
			manufacturer: manufacturer.trim() || null,
			caseRate: parseOptionalFloat(caseRate),
			caseExtLengthMm: parseOptionalFloat(caseExtLengthMm),
			caseExtWidthMm: parseOptionalFloat(caseExtWidthMm),
			caseExtHeightMm: parseOptionalFloat(caseExtHeightMm),
			caseGrossWeightKg: parseOptionalFloat(caseGrossWeightKg),
			casesPerLayer: parseOptionalFloat(casesPerLayer),
			noOfLayers: parseOptionalFloat(noOfLayers),
			isActive,
		});
	};

	const hasErrors = Object.keys(errors).length > 0;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						{title}
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						{description}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-6 py-2">
					{hasErrors && (
						<div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
							<p className="text-sm text-destructive font-medium mb-1">
								Please fix the following errors:
							</p>
							<ul className="text-sm text-destructive list-disc list-inside space-y-1">
								{errors.skuCode && <li>Code is required</li>}
								{errors.skuDescription && <li>Description is required</li>}
								{errors.skuUom && <li>Unit of measure is required</li>}
							</ul>
						</div>
					)}

					<section className="grid gap-4">
						<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
							Basic Information
						</h3>
						<div className="grid gap-2">
							<Label htmlFor="item-code">Code</Label>
							<Input
								id="item-code"
								value={skuCode}
								onChange={(e) => {
									setSkuCode(e.target.value);
									if (errors.skuCode)
										setErrors((prev) => ({ ...prev, skuCode: undefined }));
								}}
								placeholder="Item code"
								className={`rounded-lg border-muted-foreground/20 ${errors.skuCode ? "border-destructive" : ""}`}
							/>
							{errors.skuCode && (
								<p className="text-sm text-destructive">{errors.skuCode}</p>
							)}
						</div>
						<div className="grid gap-2">
							<Label htmlFor="item-description">Description</Label>
							<Input
								id="item-description"
								value={skuDescription}
								onChange={(e) => {
									setSkuDescription(e.target.value);
									if (errors.skuDescription)
										setErrors((prev) => ({
											...prev,
											skuDescription: undefined,
										}));
								}}
								placeholder="Item description"
								className={`rounded-lg border-muted-foreground/20 ${errors.skuDescription ? "border-destructive" : ""}`}
							/>
							{errors.skuDescription && (
								<p className="text-sm text-destructive">
									{errors.skuDescription}
								</p>
							)}
						</div>
						<div className="grid gap-2">
							<Label htmlFor="item-uom">Unit of Measure</Label>
							<Select
								value={skuUom}
								onValueChange={(value) => {
									setSkuUom(value);
									if (errors.skuUom)
										setErrors((prev) => ({ ...prev, skuUom: undefined }));
								}}
							>
								<SelectTrigger
									id="item-uom"
									className={`rounded-lg border-muted-foreground/20 ${errors.skuUom ? "border-destructive" : ""}`}
								>
									<SelectValue placeholder="Select UOM" />
								</SelectTrigger>
								<SelectContent>
									{stockUnits
										.filter((u) => u.isActive)
										.map((unit) => (
											<SelectItem
												key={unit.stockUnitId}
												value={unit.stockUnitId}
											>
												{unit.unitName} ({unit.unitCode})
											</SelectItem>
										))}
								</SelectContent>
							</Select>
							{errors.skuUom && (
								<p className="text-sm text-destructive">{errors.skuUom}</p>
							)}
						</div>
					</section>

					<section className="grid gap-4">
						<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
							Product &amp; Logistics
						</h3>
						<SkusFormStep3
							barcode={barcode}
							setBarcode={setBarcode}
							brand={brand}
							setBrand={setBrand}
							category={category}
							setCategory={setCategory}
							manufacturer={manufacturer}
							setManufacturer={setManufacturer}
							caseRate={caseRate}
							setCaseRate={setCaseRate}
							caseExtLengthMm={caseExtLengthMm}
							setCaseExtLengthMm={setCaseExtLengthMm}
							caseExtWidthMm={caseExtWidthMm}
							setCaseExtWidthMm={setCaseExtWidthMm}
							caseExtHeightMm={caseExtHeightMm}
							setCaseExtHeightMm={setCaseExtHeightMm}
							caseGrossWeightKg={caseGrossWeightKg}
							setCaseGrossWeightKg={setCaseGrossWeightKg}
							casesPerLayer={casesPerLayer}
							setCasesPerLayer={setCasesPerLayer}
							noOfLayers={noOfLayers}
							setNoOfLayers={setNoOfLayers}
						/>
					</section>
				</div>

				{initial && (
					<div className="flex items-center justify-between border-t pt-4">
						<Label htmlFor="item-active">Active Status</Label>
						<Switch
							id="item-active"
							checked={isActive}
							onCheckedChange={setIsActive}
						/>
					</div>
				)}

				<DialogFooter className="border-t bg-muted/20">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={loading}
						className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
					>
						{loading ? "Saving..." : initial ? "Save Changes" : "Create Item"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
