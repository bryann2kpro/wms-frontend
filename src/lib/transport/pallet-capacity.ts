/**
 * Pallet capacity for warehouse delivery vehicles (mirrors backend transport-pallet.util).
 *
 * Pallet 4x3 = 4 ft × 3 ft floor slots. No stacking on warehouse delivery.
 */

export const PALLET_SLOT_LENGTH_FT = 4;
export const PALLET_SLOT_WIDTH_FT = 3;

export type PalletCapacityInput = {
	lengthFt: number;
	widthFt: number;
};

export type PalletCapacityResult = {
	count: number;
	slotsAlongLength: number;
	slotsAlongWidth: number;
};

function floorFit(container: number, unit: number): number {
	if (!Number.isFinite(container) || !Number.isFinite(unit) || unit <= 0) return 0;
	return Math.max(0, Math.floor(container / unit));
}

export function computeWarehouseDeliveryPalletCount(
	input: PalletCapacityInput,
): PalletCapacityResult {
	const slotsAlongLength = floorFit(input.lengthFt, PALLET_SLOT_LENGTH_FT);
	const slotsAlongWidth = floorFit(input.widthFt, PALLET_SLOT_WIDTH_FT);
	return {
		count: slotsAlongLength * slotsAlongWidth,
		slotsAlongLength,
		slotsAlongWidth,
	};
}

export type PalletCountValidation = {
	resolvedCount: number | null;
	warning?: string;
};

export function resolveWarehouseDeliveryPalletCount(
	lengthFt: number | null,
	widthFt: number | null,
	explicitPallets: number | null,
): PalletCountValidation {
	const computed =
		lengthFt != null && widthFt != null
			? computeWarehouseDeliveryPalletCount({ lengthFt, widthFt })
			: null;

	if (explicitPallets != null) {
		if (computed != null && explicitPallets > computed.count) {
			return {
				resolvedCount: computed.count,
				warning: `Pallet 4x3 value ${explicitPallets} exceeds single-layer capacity ${computed.count} (no warehouse stacking). Using ${computed.count}.`,
			};
		}
		return { resolvedCount: explicitPallets };
	}

	if (computed != null && computed.count > 0) {
		return { resolvedCount: computed.count };
	}

	return { resolvedCount: null };
}
