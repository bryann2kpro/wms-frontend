import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
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
import { Search, X, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
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
	skuExpiryDate,
	setSkuExpiryDate,
	skuUom,
	setSkuUom,
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
	skuExpiryDate: Date | undefined;
	setSkuExpiryDate: (v: Date | undefined) => void;
	skuUom: string;
	setSkuUom: (v: string) => void;
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
						{errors.skuExpiryDate && <li>Expiry date is required</li>}
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
				<Label htmlFor="sku-expiry-date">Expiry Date</Label>
				<Popover>
					<PopoverTrigger asChild>
						<Button
							id="sku-expiry-date"
							variant="outline"
							className={`w-full justify-start rounded-lg border-muted-foreground/20 text-left font-normal h-10 hover:bg-accent hover:text-accent-foreground transition-colors ${!skuExpiryDate ? "text-muted-foreground" : "text-foreground"} ${errors.skuExpiryDate ? "border-destructive" : ""}`}
						>
							<CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
							<span className="truncate">
								{skuExpiryDate && !isNaN(skuExpiryDate.getTime())
									? format(skuExpiryDate, "PPP")
									: "Select expiry date"}
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
							selected={skuExpiryDate}
							onSelect={(date) => {
								if (date) {
									setSkuExpiryDate(date);
									if (errors.skuExpiryDate)
										setErrors((prev) => ({
											...prev,
											skuExpiryDate: undefined,
										}));
								}
							}}
							defaultMonth={skuExpiryDate || new Date()}
							captionLayout="dropdown"
							showOutsideDays={true}
							fromYear={new Date().getFullYear()}
							toYear={new Date().getFullYear() + 10}
						/>
					</PopoverContent>
				</Popover>
				{errors.skuExpiryDate && (
					<p className="text-sm text-destructive">{errors.skuExpiryDate}</p>
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
