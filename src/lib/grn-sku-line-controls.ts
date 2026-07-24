import type { Skus } from "@/lib/graphql/types";

export type GrnLineControlFlags = {
	requireLot: boolean;
	requireExpiry: boolean;
};

/** Lot/expiry required flags from SKU master (+ ASN lot-tracked overlay). Fields stay visible; only requiredness changes. */
export function getGrnLineSkuControls(
	skuCode: string,
	skuOptions: Skus[],
	asnLotTracked?: boolean,
): GrnLineControlFlags {
	const sku = skuOptions.find((s) => s.skuCode === skuCode);
	const requireLot = Boolean(sku?.isLotControlled) || Boolean(asnLotTracked);
	const requireExpiry =
		Boolean(sku?.isExpiryControlled) || Boolean(asnLotTracked);
	return { requireLot, requireExpiry };
}

export function grnLineDuplicateKey(
	skuCode: string,
	expiryDate: string,
	lotNo: string,
): string {
	// Two rows are only true duplicates if SKU, expiry, and lot all match. Whether a SKU is
	// officially "controlled" only affects whether these fields are *required* — it must not
	// gate whether they're used to tell batches apart, or different real batches of an
	// uncontrolled SKU get wrongly flagged as duplicates of each other.
	return `${skuCode.trim()}::exp:${expiryDate.trim()}::lot:${lotNo.trim()}`;
}
