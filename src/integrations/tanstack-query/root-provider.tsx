import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// ISO date string pattern for reviving dates
const dateReviver = (_key: string, value: unknown) => {
	// Check if value is an ISO date string
	if (
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
	) {
		const date = new Date(value);
		if (!isNaN(date.getTime())) {
			return date;
		}
	}
	return value;
};

// Create persister for localStorage (only in browser)
const persister =
	typeof window !== "undefined"
		? createSyncStoragePersister({
				storage: window.localStorage,
				key: "QUERY_CACHE",
				// Custom deserialize to convert ISO date strings back to Date objects
				deserialize: (cachedString) => JSON.parse(cachedString, dateReviver),
			})
		: undefined;

// Live operational data must not be served from persisted cache after DB changes.
const LIVE_QUERY_ROOTS = new Set([
	"stock-quants",
	"inventory",
	"inventory-movements",
]);

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// Keep data fresh for 5 minutes
				staleTime: 5 * 60 * 1000,
				// Keep data in cache for 24 hours (for persistence)
				gcTime: 24 * 60 * 60 * 1000,
			},
		},
	});

	// Set up persistence (imperative approach from docs)
	// https://tanstack.com/query/v5/docs/framework/react/plugins/createSyncStoragePersister
	if (persister) {
		persistQueryClient({
			queryClient,
			persister,
			// Bump when persisted query shape changes (e.g. stockQuant.reservedQty).
			buster: "2026-05-21-stock-quant-reserved",
			dehydrateOptions: {
				shouldDehydrateQuery: (query) => {
					const root = query.queryKey[0];
					if (typeof root === "string" && LIVE_QUERY_ROOTS.has(root)) {
						return false;
					}
					return query.state.status === "success";
				},
			},
		});
	}

	return {
		queryClient,
	};
}

export function Provider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
