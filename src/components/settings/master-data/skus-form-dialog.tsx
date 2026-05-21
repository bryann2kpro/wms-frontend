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
import { SkusFormStep1, SkusFormStep2 } from "./skus-form-steps";

export interface SkusFormValues {
	skuCode: string;
	skuDescription: string;
	skuExpiryDate: string;
	skuUom: string;
	pickingStrategy: string;
	isLotControlled: boolean;
	isExpiryControlled: boolean;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	isActive?: boolean;
}

export interface SkusFormInitial {
	skuCode: string;
	skuDescription: string;
	skuExpiryDate: string;
	skuUom: string;
	pickingStrategy?: string;
	isLotControlled?: boolean;
	isExpiryControlled?: boolean;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode: string | null }>;
	isActive?: boolean;
}

function parseDate(dateValue: string | number | undefined): Date | undefined {
	if (!dateValue) return undefined;

	try {
		if (typeof dateValue === "number") {
			const date = new Date(dateValue);
			if (isNaN(date.getTime())) return undefined;
			return date;
		}

		if (typeof dateValue === "string" && /^\d+$/.test(dateValue.trim())) {
			const date = new Date(Number(dateValue));
			if (isNaN(date.getTime())) return undefined;
			return date;
		}

		const dateMatch = dateValue.match(/(\d{4}-\d{2}-\d{2})/);
		if (dateMatch) {
			const datePart = dateMatch[1];
			const [year, month, day] = datePart.split("-").map(Number);
			const date = new Date(year, month - 1, day);
			if (isNaN(date.getTime())) return undefined;
			return date;
		}

		const date = new Date(dateValue);
		if (isNaN(date.getTime())) return undefined;
		return date;
	} catch {
		return undefined;
	}
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
	const [skuExpiryDate, setSkuExpiryDate] = useState<Date | undefined>(
		parseDate(initial?.skuExpiryDate),
	);
	const [skuUom, setSkuUom] = useState(initial?.skuUom ?? "");
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
	const [step, setStep] = useState(1);
	const [supplierSearch, setSupplierSearch] = useState("");
	const [errors, setErrors] = useState<{
		skuCode?: string;
		skuDescription?: string;
		skuExpiryDate?: string;
		skuUom?: string;
	}>({});

	const initialRef = useRef(initial);
	initialRef.current = initial;

	const resetFormFromInitial = () => {
		const i = initialRef.current;
		setSkuCode(i?.skuCode ?? "");
		setSkuDescription(i?.skuDescription ?? "");
		setSkuExpiryDate(parseDate(i?.skuExpiryDate));
		setSkuUom(i?.skuUom ?? "");
		setPickingStrategy(i?.pickingStrategy ?? "FIFO");
		setIsLotControlled(i?.isLotControlled ?? false);
		setIsExpiryControlled(i?.isExpiryControlled ?? false);
		setSkuSuppliers(i?.skuSuppliers ?? []);
		setIsActive(i?.isActive ?? true);
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
		const expiryDateString =
			skuExpiryDate && !isNaN(skuExpiryDate.getTime())
				? skuExpiryDate.toISOString().split("T")[0]
				: "";
		onSubmit({
			skuCode: skuCode.trim(),
			skuDescription: skuDescription.trim(),
			skuExpiryDate: expiryDateString,
			skuUom,
			pickingStrategy,
			isLotControlled,
			isExpiryControlled,
			skuSuppliers,
			isActive,
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
						skuExpiryDate={skuExpiryDate}
						setSkuExpiryDate={setSkuExpiryDate}
						skuUom={skuUom}
						setSkuUom={setSkuUom}
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
				) : (
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
					) : (
						<>
							<Button
								variant="outline"
								onClick={() => setStep(1)}
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
