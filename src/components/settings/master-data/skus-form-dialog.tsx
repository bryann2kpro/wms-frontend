import { useState, useEffect } from "react";
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
	skuPrice: number | null;
	skuQuantity: number;
	lossQuantity?: number;
	skuExpiryDate: string;
	skuUom: string;
	skuSuppliers?: Array<{ supplierId: string; originalSkuCode?: string | null }>;
	isActive?: boolean;
}

export interface SkusFormInitial {
	skuCode: string;
	skuDescription: string;
	skuPrice: number | null;
	skuQuantity: number;
	lossQuantity?: number;
	skuExpiryDate: string;
	skuUom: string;
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
	const [skuPrice, setSkuPrice] = useState(initial?.skuPrice?.toString() ?? "");
	const [skuQuantity, setSkuQuantity] = useState(
		initial?.skuQuantity?.toString() ?? "0",
	);
	const [lossQuantity, setLossQuantity] = useState(
		initial?.lossQuantity?.toString() ?? "0",
	);
	const [skuExpiryDate, setSkuExpiryDate] = useState<Date | undefined>(
		parseDate(initial?.skuExpiryDate),
	);
	const [skuUom, setSkuUom] = useState(initial?.skuUom ?? "");
	const [skuSuppliers, setSkuSuppliers] = useState<
		Array<{ supplierId: string; originalSkuCode: string | null }>
	>(initial?.skuSuppliers ?? []);
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);
	const [step, setStep] = useState(1);
	const [supplierSearch, setSupplierSearch] = useState("");
	const [errors, setErrors] = useState<{
		skuCode?: string;
		skuDescription?: string;
		skuQuantity?: string;
		lossQuantity?: string;
		skuExpiryDate?: string;
		skuUom?: string;
	}>({});

	useEffect(() => {
		if (open) {
			setSkuCode(initial?.skuCode ?? "");
			setSkuDescription(initial?.skuDescription ?? "");
			setSkuPrice(initial?.skuPrice?.toString() ?? "");
			setSkuQuantity(initial?.skuQuantity?.toString() ?? "0");
			setLossQuantity(initial?.lossQuantity?.toString() ?? "0");
			setSkuExpiryDate(parseDate(initial?.skuExpiryDate));
			setSkuUom(initial?.skuUom ?? "");
			setSkuSuppliers(initial?.skuSuppliers ?? []);
			setIsActive(initial?.isActive ?? true);
			setStep(1);
			setSupplierSearch("");
			setErrors({});
		}
	}, [open, initial]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setSkuCode(initial?.skuCode ?? "");
			setSkuDescription(initial?.skuDescription ?? "");
			setSkuPrice(initial?.skuPrice?.toString() ?? "");
			setSkuQuantity(initial?.skuQuantity?.toString() ?? "0");
			setLossQuantity(initial?.lossQuantity?.toString() ?? "0");
			setSkuExpiryDate(parseDate(initial?.skuExpiryDate));
			setSkuUom(initial?.skuUom ?? "");
			setSkuSuppliers(initial?.skuSuppliers ?? []);
			setIsActive(initial?.isActive ?? true);
			setStep(1);
			setSupplierSearch("");
			setErrors({});
		}
		onOpenChange(next);
	};

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
		const q = String(skuQuantity ?? "").trim();
		if (q !== "" && (isNaN(Number(q)) || Number(q) < 0)) {
			newErrors.skuQuantity = "Quantity must be 0 or more";
		}
		const lossQ = String(lossQuantity ?? "").trim();
		if (lossQ !== "" && (isNaN(Number(lossQ)) || Number(lossQ) < 0)) {
			newErrors.lossQuantity = "Loss quantity must be 0 or more";
		}
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
		let priceValue: number | null = null;
		if (skuPrice.trim() !== "") {
			const parsed = parseFloat(skuPrice);
			if (!isNaN(parsed)) priceValue = parsed;
		}
		onSubmit({
			skuCode: skuCode.trim(),
			skuDescription: skuDescription.trim(),
			skuPrice: priceValue,
			skuQuantity: Math.max(0, Number(skuQuantity) || 0),
			lossQuantity: Math.max(0, Number(lossQuantity) || 0),
			skuExpiryDate: expiryDateString,
			skuUom,
			skuSuppliers,
			isActive,
		});
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{step === 1 ? (
					<SkusFormStep1
						skuCode={skuCode}
						setSkuCode={setSkuCode}
						skuDescription={skuDescription}
						setSkuDescription={setSkuDescription}
						skuPrice={skuPrice}
						setSkuPrice={setSkuPrice}
						skuQuantity={skuQuantity}
						setSkuQuantity={setSkuQuantity}
						lossQuantity={lossQuantity}
						setLossQuantity={setLossQuantity}
						skuExpiryDate={skuExpiryDate}
						setSkuExpiryDate={setSkuExpiryDate}
						skuUom={skuUom}
						setSkuUom={setSkuUom}
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
						<Label htmlFor="sku-active">Active Status</Label>
						<Switch
							id="sku-active"
							checked={isActive}
							onCheckedChange={setIsActive}
						/>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					{step === 1 ? (
						<Button
							onClick={handleNext}
							className={
								!canProceedToStep2 ? "opacity-75 cursor-not-allowed" : ""
							}
						>
							Next
						</Button>
					) : (
						<>
							<Button variant="outline" onClick={() => setStep(1)}>
								Back
							</Button>
							<Button onClick={handleSubmit} disabled={loading}>
								{loading ? "Saving..." : "Save"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
