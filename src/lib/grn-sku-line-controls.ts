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
	skuOptions: Skus[],
	expiryDate: string,
	lotNo: string,
	asnLotTracked?: boolean,
): string {
	const { requireLot, requireExpiry } = getGrnLineSkuControls(
		skuCode,
		skuOptions,
		asnLotTracked,
	);
	let key = skuCode.trim();
	if (requireExpiry) key += `::exp:${expiryDate.trim()}`;
	if (requireLot) key += `::lot:${lotNo.trim()}`;
	return key;
}
