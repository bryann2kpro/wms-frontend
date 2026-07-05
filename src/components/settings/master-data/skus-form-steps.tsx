import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Supplier, StockUnit } from "@/lib/graphql/types";
import { Search, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
	getAvailablePickingStrategies,
	PICKING_STRATEGY_LABELS,
} from "@/lib/picking-strategy";

export function SkusFormStep1({
	skuCode,
	setSkuCode,
	skuDescription,
	setSkuDescription,
	skuUom,
	setSkuUom,
	looseQuantity,
	setLooseQuantity,
	pickingStrategy,
	setPickingStrategy,
	isLotControlled,
	setIsLotControlled,
	isExpiryControlled,
	setIsExpiryControlled,
	stockUnits,
	errors,
	setErrors,
}: {
	skuCode: string;
	setSkuCode: (v: string) => void;
	skuDescription: string;
	setSkuDescription: (v: string) => void;
	skuUom: string;
	setSkuUom: (v: string) => void;
	looseQuantity: string;
	setLooseQuantity: (v: string) => void;
	pickingStrategy: string;
	setPickingStrategy: (v: string) => void;
	isLotControlled: boolean;
	setIsLotControlled: (v: boolean) => void;
	isExpiryControlled: boolean;
	setIsExpiryControlled: (v: boolean) => void;
	stockUnits: StockUnit[];
	errors: Record<string, string | undefined>;
	setErrors: (
		fn: (
			prev: Record<string, string | undefined>,
		) => Record<string, string | undefined>,
	) => void;
}) {
	const hasErrors = Object.keys(errors).length > 0;

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
				hypothesisId: "H5",
				location: "src/components/settings/master-data/skus-form-steps.tsx:SkusFormStep1",
				message: "step1 render bindings",
				data: {
					isExpiryControlled,
					pickingStrategy,
				},
				timestamp: Date.now(),
			}),
		}).catch(() => {});
		// #endregion
	}, [isExpiryControlled, pickingStrategy]);

	return (
		<div className="grid gap-4 py-4">
			{hasErrors && (
				<div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
					<p className="text-sm text-destructive font-medium mb-1">
						Please fix the following errors to continue:
					</p>
					<ul className="text-sm text-destructive list-disc list-inside space-y-1">
						{errors.skuCode && <li>Code is required</li>}
						{errors.skuDescription && <li>Description is required</li>}
						{errors.skuUom && <li>Unit of measure is required</li>}
					</ul>
				</div>
			)}
			<div className="grid gap-2">
				<Label htmlFor="sku-code">Code</Label>
				<Input
					id="sku-code"
					value={skuCode}
					onChange={(e) => {
						setSkuCode(e.target.value);
						if (errors.skuCode)
							setErrors((prev) => ({ ...prev, skuCode: undefined }));
					}}
					placeholder="SKU name"
					className={`rounded-lg border-muted-foreground/20 ${errors.skuCode ? "border-destructive" : ""}`}
				/>
				{errors.skuCode && (
					<p className="text-sm text-destructive">{errors.skuCode}</p>
				)}
			</div>
			<div className="grid gap-2">
				<Label htmlFor="sku-description">Description</Label>
				<Input
					id="sku-description"
					value={skuDescription}
					onChange={(e) => {
						setSkuDescription(e.target.value);
						if (errors.skuDescription)
							setErrors((prev) => ({ ...prev, skuDescription: undefined }));
					}}
					placeholder="SKU description"
					className={`rounded-lg border-muted-foreground/20 ${errors.skuDescription ? "border-destructive" : ""}`}
				/>
				{errors.skuDescription && (
					<p className="text-sm text-destructive">{errors.skuDescription}</p>
				)}
			</div>
			<div className="grid gap-2">
				<Label htmlFor="sku-uom">Unit of Measure</Label>
				<Select
					value={skuUom}
					onValueChange={(value) => {
						setSkuUom(value);
						if (errors.skuUom)
							setErrors((prev) => ({ ...prev, skuUom: undefined }));
					}}
				>
					<SelectTrigger
						className={`rounded-lg border-muted-foreground/20 ${errors.skuUom ? "border-destructive" : ""}`}
					>
						<SelectValue placeholder="Select UOM" />
					</SelectTrigger>
					<SelectContent>
						{stockUnits
							.filter((u) => u.isActive)
							.map((unit) => (
								<SelectItem key={unit.stockUnitId} value={unit.stockUnitId}>
									{unit.unitName} ({unit.unitCode})
								</SelectItem>
							))}
					</SelectContent>
				</Select>
				{errors.skuUom && (
					<p className="text-sm text-destructive">{errors.skuUom}</p>
				)}
			</div>
			<div className="grid gap-2">
				<Label htmlFor="sku-loose-quantity">Loose Quantity</Label>
				<Input
					id="sku-loose-quantity"
					type="number"
					min={0}
					step={1}
					value={looseQuantity}
					onChange={(e) => setLooseQuantity(e.target.value)}
					placeholder="e.g. 24"
					className="rounded-lg border-muted-foreground/20"
				/>
				<p className="text-xs text-muted-foreground">
					Number of loose items per unit of measure (e.g. pieces per carton).
				</p>
			</div>
			<div className="flex items-center justify-between gap-4 rounded-lg border border-muted-foreground/20 px-3 py-2">
				<div className="space-y-0.5">
					<Label htmlFor="sku-lot-controlled">Lot controlled</Label>
					<p className="text-xs text-muted-foreground">
						Require lot numbers for this SKU during inbound and picking.
					</p>
				</div>
				<Switch
					id="sku-lot-controlled"
					checked={isLotControlled}
					onCheckedChange={setIsLotControlled}
				/>
			</div>
			<div className="flex items-center justify-between gap-4 rounded-lg border border-muted-foreground/20 px-3 py-2">
				<div className="space-y-0.5">
					<Label htmlFor="sku-expiry-controlled">Expiry controlled</Label>
					<p className="text-xs text-muted-foreground">
						Require expiry dates for this SKU; enables FEFO picking strategy.
					</p>
				</div>
				<Switch
					id="sku-expiry-controlled"
					checked={isExpiryControlled}
					onCheckedChange={(checked) => {
						setIsExpiryControlled(checked);
						if (!checked && pickingStrategy === "FEFO") {
							setPickingStrategy("FIFO");
						}
					}}
				/>
			</div>
			<div className="grid gap-2">
				<Label htmlFor="sku-picking-strategy">Picking Strategy</Label>
				<Select value={pickingStrategy} onValueChange={setPickingStrategy}>
					<SelectTrigger
						id="sku-picking-strategy"
						className="rounded-lg border-muted-foreground/20"
					>
						<SelectValue placeholder="Select picking strategy" />
					</SelectTrigger>
					<SelectContent>
						{getAvailablePickingStrategies(isExpiryControlled).map((strategy) => (
							<SelectItem key={strategy} value={strategy}>
								{PICKING_STRATEGY_LABELS[strategy]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-xs text-muted-foreground">
					Determines which GRN batch to pick from first during outbound picking.
				</p>
			</div>
		</div>
	);
}

export function SkusFormStep3({
	barcode,
	setBarcode,
	brand,
	setBrand,
	category,
	setCategory,
	manufacturer,
	setManufacturer,
	caseRate,
	setCaseRate,
	caseExtLengthMm,
	setCaseExtLengthMm,
	caseExtWidthMm,
	setCaseExtWidthMm,
	caseExtHeightMm,
	setCaseExtHeightMm,
	caseGrossWeightKg,
	setCaseGrossWeightKg,
	casesPerLayer,
	setCasesPerLayer,
	noOfLayers,
	setNoOfLayers,
}: {
	barcode: string;
	setBarcode: (v: string) => void;
	brand: string;
	setBrand: (v: string) => void;
	category: string;
	setCategory: (v: string) => void;
	manufacturer: string;
	setManufacturer: (v: string) => void;
	caseRate: string;
	setCaseRate: (v: string) => void;
	caseExtLengthMm: string;
	setCaseExtLengthMm: (v: string) => void;
	caseExtWidthMm: string;
	setCaseExtWidthMm: (v: string) => void;
	caseExtHeightMm: string;
	setCaseExtHeightMm: (v: string) => void;
	caseGrossWeightKg: string;
	setCaseGrossWeightKg: (v: string) => void;
	casesPerLayer: string;
	setCasesPerLayer: (v: string) => void;
	noOfLayers: string;
	setNoOfLayers: (v: string) => void;
}) {
	return (
		<div className="grid gap-4 py-4">
			<div className="grid grid-cols-2 gap-4">
				<div className="grid gap-2">
					<Label htmlFor="sku-barcode">Barcode</Label>
					<Input
						id="sku-barcode"
						value={barcode}
						onChange={(e) => setBarcode(e.target.value)}
						placeholder="e.g. 9781234567897"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="sku-brand">Brand</Label>
					<Input
						id="sku-brand"
						value={brand}
						onChange={(e) => setBrand(e.target.value)}
						placeholder="Brand name"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="grid gap-2">
					<Label htmlFor="sku-category">Category</Label>
					<Input
						id="sku-category"
						value={category}
						onChange={(e) => setCategory(e.target.value)}
						placeholder="Product category"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="sku-manufacturer">Manufacturer</Label>
					<Input
						id="sku-manufacturer"
						value={manufacturer}
						onChange={(e) => setManufacturer(e.target.value)}
						placeholder="Manufacturer name"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
			</div>
			<div className="grid gap-2">
				<Label htmlFor="sku-case-rate">Case Rate</Label>
				<Input
					id="sku-case-rate"
					type="number"
					step="0.01"
					value={caseRate}
					onChange={(e) => setCaseRate(e.target.value)}
					placeholder="0.00"
					className="rounded-lg border-muted-foreground/20"
				/>
			</div>
			<div className="grid grid-cols-3 gap-4">
				<div className="grid gap-2">
					<Label htmlFor="sku-case-length">Ext Length (mm)</Label>
					<Input
						id="sku-case-length"
						type="number"
						step="0.001"
						value={caseExtLengthMm}
						onChange={(e) => setCaseExtLengthMm(e.target.value)}
						placeholder="0.000"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="sku-case-width">Ext Width (mm)</Label>
					<Input
						id="sku-case-width"
						type="number"
						step="0.001"
						value={caseExtWidthMm}
						onChange={(e) => setCaseExtWidthMm(e.target.value)}
						placeholder="0.000"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="sku-case-height">Ext Height (mm)</Label>
					<Input
						id="sku-case-height"
						type="number"
						step="0.001"
						value={caseExtHeightMm}
						onChange={(e) => setCaseExtHeightMm(e.target.value)}
						placeholder="0.000"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
			</div>
			<div className="grid grid-cols-3 gap-4">
				<div className="grid gap-2">
					<Label htmlFor="sku-gross-weight">Gross Weight (kg)</Label>
					<Input
						id="sku-gross-weight"
						type="number"
						step="0.001"
						value={caseGrossWeightKg}
						onChange={(e) => setCaseGrossWeightKg(e.target.value)}
						placeholder="0.000"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="sku-cases-per-layer">Cases Per Layer</Label>
					<Input
						id="sku-cases-per-layer"
						type="number"
						step="0.001"
						value={casesPerLayer}
						onChange={(e) => setCasesPerLayer(e.target.value)}
						placeholder="0.000"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="sku-no-of-layers">No of Layers</Label>
					<Input
						id="sku-no-of-layers"
						type="number"
						step="0.001"
						value={noOfLayers}
						onChange={(e) => setNoOfLayers(e.target.value)}
						placeholder="0.000"
						className="rounded-lg border-muted-foreground/20"
					/>
				</div>
			</div>
		</div>
	);
}

export function SkusFormStep2({
	suppliers,
	skuSuppliers,
	supplierSearch,
	setSupplierSearch,
	filteredSuppliers,
	toggleSupplier,
	getOriginalSkuCode,
	updateOriginalSkuCode,
}: {
	suppliers: Supplier[];
	skuSuppliers: Array<{ supplierId: string; originalSkuCode: string | null }>;
	supplierSearch: string;
	setSupplierSearch: (v: string) => void;
	filteredSuppliers: Supplier[];
	toggleSupplier: (id: string) => void;
	getOriginalSkuCode: (id: string) => string;
	updateOriginalSkuCode: (id: string, code: string) => void;
}) {
	return (
		<div className="grid gap-4 py-4">
			<div className="grid gap-2">
				<Label htmlFor="supplier-search">Add Supplier</Label>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						id="supplier-search"
						placeholder="Search by supplier name or code..."
						value={supplierSearch}
						onChange={(e) => setSupplierSearch(e.target.value)}
						className="pl-9 rounded-lg border-muted-foreground/20"
					/>
				</div>
				{filteredSuppliers.length > 0 ? (
					<div className="border rounded-md mt-2 h-40 overflow-y-auto">
						{filteredSuppliers.map((supplier) => (
							<button
								key={supplier.supplierId}
								type="button"
								onClick={() => {
									toggleSupplier(supplier.supplierId);
									setSupplierSearch("");
								}}
								className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
							>
								<div className="text-sm">
									{supplier.supplierName} ({supplier.supplierCode})
								</div>
							</button>
						))}
					</div>
				) : supplierSearch.trim() ? (
					<p className="text-sm text-muted-foreground mt-2">
						No suppliers found matching &quot;{supplierSearch}&quot;
					</p>
				) : null}
			</div>
			<div className="grid gap-2">
				<Label>
					Added Suppliers
					{skuSuppliers.length > 0 && ` (${skuSuppliers.length})`}
				</Label>
				{skuSuppliers.length === 0 ? (
					<p className="text-sm text-muted-foreground border rounded-md p-3">
						No suppliers added yet. Search and select suppliers above.
					</p>
				) : (
					<div className="border rounded-md p-3 space-y-3 max-h-60 overflow-y-auto">
						{skuSuppliers.map((selectedSupplier) => {
							const supplier = suppliers.find(
								(s) => s.supplierId === selectedSupplier.supplierId,
							);
							if (!supplier) return null;
							return (
								<div
									key={supplier.supplierId}
									className="space-y-2 py-2 border-b last:border-b-0"
								>
									<div className="flex items-center justify-between">
										<div className="text-sm font-medium">
											{supplier.supplierName} ({supplier.supplierCode})
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-6 w-6"
											onClick={() => toggleSupplier(supplier.supplierId)}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
									<div>
										<Label
											htmlFor={`original-sku-${supplier.supplierId}`}
											className="text-xs text-muted-foreground"
										>
											Original SKU Code (optional)
										</Label>
										<Input
											id={`original-sku-${supplier.supplierId}`}
											value={getOriginalSkuCode(supplier.supplierId)}
											onChange={(e) =>
												updateOriginalSkuCode(
													supplier.supplierId,
													e.target.value,
												)
											}
											placeholder="Supplier's original SKU code"
											className="mt-1 rounded-lg border-muted-foreground/20"
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
