export const PICKING_STRATEGIES = ["FIFO", "LIFO", "FEFO"] as const;

export type PickingStrategy = (typeof PICKING_STRATEGIES)[number];

export function getAvailablePickingStrategies(
	isExpiryControlled: boolean,
): PickingStrategy[] {
	return isExpiryControlled
		? [...PICKING_STRATEGIES]
		: PICKING_STRATEGIES.filter((s) => s !== "FEFO");
}

export const PICKING_STRATEGY_LABELS: Record<PickingStrategy, string> = {
	FIFO: "FIFO — First In, First Out",
	LIFO: "LIFO — Last In, First Out",
	FEFO: "FEFO — First Expired, First Out",
};
