import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	STOCK_UNITS_SIMPLE_QUERY,
	type StockUnitsSimpleQueryData,
} from "@/lib/graphql/stock-units";

export const Route = createFileRoute("/demo/apollo-client")({
	component: RouteComponent,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: qk.stockUnits.all,
			queryFn: () =>
				gqlRequest<StockUnitsSimpleQueryData>(STOCK_UNITS_SIMPLE_QUERY),
		});
	},
});

function RouteComponent() {
	const { data, isLoading, error } = useQuery({
		queryKey: qk.stockUnits.all,
		queryFn: () =>
			gqlRequest<StockUnitsSimpleQueryData>(STOCK_UNITS_SIMPLE_QUERY),
		staleTime: 5 * 60 * 1000,
	});

	return (
		<div className="p-4">
			<h2 className="text-2xl font-bold mb-4">GraphQL + TanStack Query demo</h2>
			<div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
				<p className="font-bold">Data is prefetched in the route loader</p>
				<p className="text-sm mt-2">
					The loader calls{" "}
					<code className="bg-blue-200 px-1 rounded">queryClient.ensureQueryData</code>{" "}
					and the component uses{" "}
					<code className="bg-blue-200 px-1 rounded">useQuery</code> with the same{" "}
					<code className="bg-blue-200 px-1 rounded">queryKey</code>.
				</p>
			</div>
			<div className="bg-gray-100 p-4 rounded">
				<h3 className="font-bold mb-2">Stock units (example query)</h3>
				{isLoading && <p className="text-sm">Loading…</p>}
				{error && (
					<p className="text-sm text-red-600">
						{error instanceof Error ? error.message : "Request failed"}
					</p>
				)}
				{data && (
					<pre className="text-sm overflow-x-auto">
						{JSON.stringify(data, null, 2)}
					</pre>
				)}
			</div>
		</div>
	);
}
