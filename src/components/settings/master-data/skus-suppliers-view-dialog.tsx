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
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						Suppliers for {sku.skuCode}
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						View all suppliers associated with this SKU
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					{supplierDetails.length === 0 ? (
						<p
							className="py-8 text-center text-sm text-muted-foreground"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							No suppliers associated with this SKU.
						</p>
					) : (
						<div className="space-y-4">
							{supplierDetails.map((item) => (
								<div
									key={item.supplierId}
									className="space-y-2 rounded-xl border p-4"
								>
									<div className="flex items-center justify-between">
										<div>
											<div
												className="text-sm font-medium"
												style={{
													fontFamily: '"Plus Jakarta Sans", sans-serif',
												}}
											>
												{item.supplierName}
											</div>
											<div
												className="text-xs text-muted-foreground"
												style={{ fontFamily: '"Figtree", sans-serif' }}
											>
												Code: {item.supplierCode}
											</div>
										</div>
									</div>
									{item.originalSkuCode && (
										<div className="border-t pt-2">
											<Label
												className="text-xs text-muted-foreground"
												style={{ fontFamily: '"Figtree", sans-serif' }}
											>
												Original SKU Code
											</Label>
											<div className="mt-1 text-sm">{item.originalSkuCode}</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
				<DialogFooter className="border-t bg-muted/20">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						className="rounded-lg"
					>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
