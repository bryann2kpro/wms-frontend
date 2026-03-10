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
import type { Supplier, Skus } from "@/lib/graphql/types";

export function SkusSuppliersViewDialog({
	open,
	onOpenChange,
	sku,
	suppliers,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sku: Skus | null;
	suppliers: Supplier[];
}) {
	if (!sku) return null;

	const safeSuppliers = suppliers ?? [];
	const supplierDetails = (sku.skuSuppliers ?? []).map((skuSupplier) => {
		const supplier = safeSuppliers.find(
			(s) => s.supplierId === skuSupplier.supplierId,
		);
		return {
			...skuSupplier,
			supplierName: supplier?.supplierName || "Unknown",
			supplierCode: supplier?.supplierCode || "Unknown",
		};
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Suppliers for {sku.skuCode}</DialogTitle>
					<DialogDescription>
						View all suppliers associated with this SKU
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					{supplierDetails.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-8">
							No suppliers associated with this SKU.
						</p>
					) : (
						<div className="space-y-4">
							{supplierDetails.map((item) => (
								<div
									key={item.supplierId}
									className="border rounded-md p-4 space-y-2"
								>
									<div className="flex items-center justify-between">
										<div>
											<div className="font-medium text-sm">
												{item.supplierName}
											</div>
											<div className="text-xs text-muted-foreground">
												Code: {item.supplierCode}
											</div>
										</div>
									</div>
									{item.originalSkuCode && (
										<div className="pt-2 border-t">
											<Label className="text-xs text-muted-foreground">
												Original SKU Code
											</Label>
											<div className="text-sm mt-1">{item.originalSkuCode}</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
