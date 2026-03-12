import { useQuery } from "@apollo/client/react";
import {
	STOCK_UNITS_SIMPLE_QUERY,
	type StockUnitsSimpleQueryData,
} from "@/lib/graphql/stock-units";

/**
 * Hook to fetch stock units and get the active unit name.
 * Returns the unit name of the first active stock unit, or "carton" as fallback.
 */
export function useStockUnitName(): string {
	const { data } = useQuery<StockUnitsSimpleQueryData>(
		STOCK_UNITS_SIMPLE_QUERY,
		{
			fetchPolicy: "cache-first",
		},
	);

	if (!data) {
		return "carton"; // Fallback while loading
	}

	const activeUnit = data.stockUnits.query.find((unit) => unit.isActive);

	// Return the active unit name, or "carton" as fallback
	return activeUnit?.unitName || "carton";
}

/**
 * Hook to get all stock units (for future use if needed)
 */
export function useStockUnits() {
	const { data } = useQuery<StockUnitsSimpleQueryData>(
		STOCK_UNITS_SIMPLE_QUERY,
		{
			fetchPolicy: "cache-first",
		},
	);
	return data?.stockUnits.query || [];
}
