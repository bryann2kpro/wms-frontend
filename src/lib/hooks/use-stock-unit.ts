import { useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	STOCK_UNITS_SIMPLE_QUERY,
	type StockUnitsSimpleQueryData,
} from "@/lib/graphql/stock-units";

const stockUnitsSimpleQuery = {
	queryKey: qk.stockUnits.all,
	queryFn: () =>
		gqlRequest<StockUnitsSimpleQueryData>(STOCK_UNITS_SIMPLE_QUERY),
	staleTime: 5 * 60 * 1000,
} as const;

/**
 * Hook to fetch stock units and get the active unit name.
 * Returns the unit name of the first active stock unit, or "carton" as fallback.
 */
export function useStockUnitName(): string {
	const { data } = useQuery(stockUnitsSimpleQuery);

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
	const { data } = useQuery(stockUnitsSimpleQuery);
	return data?.stockUnits.query || [];
}
