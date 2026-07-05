import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Supplier, StockUnit } from "@/lib/graphql/types";
import { SkusFormStep1, SkusFormStep2, SkusFormStep3 } from "./skus-form-steps";

export interface SkusFormValues {
	skuCode: string;
	skuDescription: string;
	skuUom: string;
	pickingStrategy: string;
	isLotControlled: boolean;
	isExpiryControlled: boolean;
	looseQuantity?: number | null;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	isActive?: boolean;
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
}

export interface SkusFormInitial {
	skuCode: string;
	skuDescription: string;
	skuUom: string;
	pickingStrategy?: string;
	isLotControlled?: boolean;
	isExpiryControlled?: boolean;
	looseQuantity?: number | null;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode: string | null }>;
	isActive?: boolean;
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
}

export function SkusFormDialog({
	open,
	onOpenChange,
	suppliers,
	stockUnits,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	suppliers: Supplier[];
	stockUnits: StockUnit[];
	initial?: SkusFormInitial;
	onSubmit: (v: SkusFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [skuCode, setSkuCode] = useState(initial?.skuCode ?? "");
	const [skuDescription, setSkuDescription] = useState(
		initial?.skuDescription ?? "",
	);
	const [skuUom, setSkuUom] = useState(initial?.skuUom ?? "");
	const [looseQuantity, setLooseQuantity] = useState(
		initial?.looseQuantity?.toString() ?? "",
	);
	const [pickingStrategy, setPickingStrategy] = useState(
		initial?.pickingStrategy ?? "FIFO",
	);
	const [isLotControlled, setIsLotControlled] = useState(
		initial?.isLotControlled ?? false,
	);
	const [isExpiryControlled, setIsExpiryControlled] = useState(
		initial?.isExpiryControlled ?? false,
	);
	const [skuSuppliers, setSkuSuppliers] = useState<
		Array<{ supplierId: string; originalSkuCode: string | null }>
	>(initial?.skuSuppliers ?? []);
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);
	const [barcode, setBarcode] = useState(initial?.barcode ?? "");
	const [brand, setBrand] = useState(initial?.brand ?? "");
	const [category, setCategory] = useState(initial?.category ?? "");
	const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
	const [caseRate, setCaseRate] = useState(initial?.caseRate?.toString() ?? "");
	const [caseExtLengthMm, setCaseExtLengthMm] = useState(initial?.caseExtLengthMm?.toString() ?? "");
	const [caseExtWidthMm, setCaseExtWidthMm] = useState(initial?.caseExtWidthMm?.toString() ?? "");
	const [caseExtHeightMm, setCaseExtHeightMm] = useState(initial?.caseExtHeightMm?.toString() ?? "");
	const [caseGrossWeightKg, setCaseGrossWeightKg] = useState(initial?.caseGrossWeightKg?.toString() ?? "");
	const [casesPerLayer, setCasesPerLayer] = useState(initial?.casesPerLayer?.toString() ?? "");
	const [noOfLayers, setNoOfLayers] = useState(initial?.noOfLayers?.toString() ?? "");
	const [step, setStep] = useState(1);
	const [supplierSearch, setSupplierSearch] = useState("");
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
		setLooseQuantity(i?.looseQuantity?.toString() ?? "");
		setPickingStrategy(i?.pickingStrategy ?? "FIFO");
		setIsLotControlled(i?.isLotControlled ?? false);
		setIsExpiryControlled(i?.isExpiryControlled ?? false);
		setSkuSuppliers(i?.skuSuppliers ?? []);
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
		setStep(1);
		setSupplierSearch("");
		setErrors({});
	};

	// Only reset when the dialog opens — not when parent re-renders (inline `initial` object).
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

	const isEditMode = Boolean(initial);

	const toggleSupplier = (supplierId: string) => {
		setSkuSuppliers((prev) => {
			const existing = prev.find((s) => s.supplierId === supplierId);
			if (existing) {
				return prev.filter((s) => s.supplierId !== supplierId);
			}
			return [...prev, { supplierId, originalSkuCode: null }];
		});
	};

	const updateOriginalSkuCode = (
		supplierId: string,
		originalSkuCode: string,
	) => {
		setSkuSuppliers((prev) =>
			prev.map((s) =>
				s.supplierId === supplierId
					? { ...s, originalSkuCode: originalSkuCode.trim() || null }
					: s,
			),
		);
	};

	const getOriginalSkuCode = (supplierId: string): string => {
		const supplier = skuSuppliers.find((s) => s.supplierId === supplierId);
		return supplier?.originalSkuCode || "";
	};

	const filteredSuppliers = suppliers.filter((supplier) => {
		if (skuSuppliers.some((s) => s.supplierId === supplier.supplierId)) {
			return false;
		}
		if (!supplierSearch.trim()) return true;
		const searchLower = supplierSearch.toLowerCase().trim();
		return (
			supplier.supplierName.toLowerCase().includes(searchLower) ||
			supplier.supplierCode.toLowerCase().includes(searchLower)
		);
	});

	const canProceedToStep2 = skuCode.trim() && skuDescription.trim() && skuUom;

	useEffect(() => {
		// #region agent log
		fetch("http://127.0.0.1:7725/ingest/20db73c8-0fb7-4781-a984-2cc888a5a871", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Debug-Session-Id": "8952bb",
			},
			body: JSON.stringify({
				sessionId: "8952bb",
				runId: "post-fix",
				hypothesisId: "H4",
				location: "src/components/settings/master-data/skus-form-dialog.tsx:SkusFormDialog",
				message: "skus form state snapshot",
				data: {
					open,
					step,
					skuCodeLength: skuCode.length,
				},
				timestamp: Date.now(),
			}),
		}).catch(() => {});
		// #endregion
	}, [open, step, skuCode.length]);

	const validateStep1 = () => {
		const newErrors: typeof errors = {};

		if (!skuCode.trim()) newErrors.skuCode = "Code is required";
		if (!skuDescription.trim())
			newErrors.skuDescription = "Description is required";
		if (!skuUom) newErrors.skuUom = "Unit of measure is required";

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleNext = () => {
		if (validateStep1()) {
			setErrors({});
			setStep(2);
		}
	};

	const handleSubmit = () => {
		const parseOptionalFloat = (v: string) => {
			const t = v.trim();
			if (t === "") return null;
			const n = parseFloat(t);
			return isNaN(n) ? null : n;
		};
		onSubmit({
			skuCode: skuCode.trim(),
			skuDescription: skuDescription.trim(),
			skuUom,
			pickingStrategy,
			isLotControlled,
			isExpiryControlled,
			looseQuantity: parseOptionalFloat(looseQuantity),
			skuSuppliers,
			isActive,
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
		});
	};

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
				{step === 1 ? (
					<SkusFormStep1
						skuCode={skuCode}
						setSkuCode={setSkuCode}
						skuDescription={skuDescription}
						setSkuDescription={setSkuDescription}
						skuUom={skuUom}
						setSkuUom={setSkuUom}
						looseQuantity={looseQuantity}
						setLooseQuantity={setLooseQuantity}
						pickingStrategy={pickingStrategy}
						setPickingStrategy={setPickingStrategy}
						isLotControlled={isLotControlled}
						setIsLotControlled={setIsLotControlled}
						isExpiryControlled={isExpiryControlled}
						setIsExpiryControlled={setIsExpiryControlled}
						stockUnits={stockUnits}
						errors={errors}
						setErrors={setErrors}
					/>
				) : step === 2 ? (
					<SkusFormStep2
						suppliers={suppliers}
						skuSuppliers={skuSuppliers}
						supplierSearch={supplierSearch}
						setSupplierSearch={setSupplierSearch}
						filteredSuppliers={filteredSuppliers}
						toggleSupplier={toggleSupplier}
						getOriginalSkuCode={getOriginalSkuCode}
						updateOriginalSkuCode={updateOriginalSkuCode}
					/>
				) : (
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
				)}
				{initial && (
					<div className="flex items-center justify-between border-t pt-4">
						<Label
							htmlFor="sku-active"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Active Status
						</Label>
						<Switch
							id="sku-active"
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
					{step === 1 ? (
						<>
							{isEditMode && (
								<Button
									onClick={() => {
										if (validateStep1()) {
											handleSubmit();
										}
									}}
									disabled={loading}
									className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
								>
									{loading ? "Saving..." : "Save"}
								</Button>
							)}
							<Button
								onClick={handleNext}
								variant={isEditMode ? "outline" : "default"}
								className={
									isEditMode
										? "rounded-lg"
										: `rounded-lg ${!canProceedToStep2 ? "opacity-75 cursor-not-allowed" : "bg-amber-600 text-white hover:bg-amber-700"}`
								}
							>
								{isEditMode ? "Suppliers" : "Next"}
							</Button>
						</>
					) : step === 2 ? (
						<>
							<Button
								variant="outline"
								onClick={() => setStep(1)}
								className="rounded-lg"
							>
								Back
							</Button>
							<Button
								onClick={() => setStep(3)}
								className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
							>
								Logistics
							</Button>
						</>
					) : (
						<>
							<Button
								variant="outline"
								onClick={() => setStep(2)}
								className="rounded-lg"
							>
								Back
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={loading}
								className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
							>
								{loading ? "Saving..." : "Save"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
