import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	DRIVERS_QUERY,
	SET_DRIVER_CLOCK_MUTATION,
	type DriversQueryData,
	type DriversQueryVariables,
	type SetDriverClockMutationData,
	type SetDriverClockMutationVariables,
} from "@/lib/graphql/drivers";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { toUserFriendlyMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/tms/drivers")({
	component: TmsDriversPage,
	head: () => ({
		meta: [
			{
				title: "Drivers - SME Edaran WMS",
				description: "Driver roster, vehicle assignments, and clock in/out — synced from TMS.",
			},
		],
	}),
});

const SEARCH_DEBOUNCE_MS = 350;

function dash(v: string | null | undefined): string {
	return v && v.trim() ? v : "—";
}

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string }> })
			.graphQLErrors?.[0];
		if (first?.message) {
			return toUserFriendlyMessage(
				first.message,
				"Something went wrong. Please try again.",
			);
		}
	}
	if (err instanceof Error) {
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	}
	return "Something went wrong. Please try again.";
}

function TmsDriversPage() {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);

	const queryVars: DriversQueryVariables = {
		filter: debouncedSearch.trim() ? { name: debouncedSearch.trim() } : undefined,
		pageSize: 500,
		pageNumber: 1,
	};

	const { data, isLoading, isFetching } = useQuery({
		queryKey: qk.drivers.list(queryVars),
		queryFn: () =>
			gqlRequest<DriversQueryData, DriversQueryVariables>(DRIVERS_QUERY, queryVars),
	});

	const clockMutation = useMutation({
		mutationFn: (vars: SetDriverClockMutationVariables) =>
			gqlRequest<SetDriverClockMutationData, SetDriverClockMutationVariables>(
				SET_DRIVER_CLOCK_MUTATION,
				vars,
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: qk.drivers.all });
		},
		onError: (err) => {
			toast.error(getErrorMessage(err));
		},
	});

	const drivers = data?.drivers.query ?? [];
	const loading = isLoading || isFetching;

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="tms-drivers-title"
			aria-describedby="tms-drivers-description"
			aria-busy={loading}
		>
			<GlobalLoadingShadow />
			<AdminPageHeader
				icon={Users}
				title="Drivers"
				description="Driver roster, vehicle assignments, and clock in/out — synced from TMS."
				titleId="tms-drivers-title"
				descriptionId="tms-drivers-description"
			/>

			<Card className="rounded-2xl border-2 border-border">
				<CardHeader className="flex flex-row items-center justify-between gap-4">
					<div>
						<CardTitle>Driver roster</CardTitle>
						<CardDescription>
							{data?.drivers.pagination.totalCount ?? 0} driver
							{data?.drivers.pagination.totalCount === 1 ? "" : "s"}
						</CardDescription>
					</div>
					<div className="relative w-64">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Search by name..."
							className="pl-8"
						/>
					</div>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Driver</TableHead>
									<TableHead>Plate No.</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Barcode</TableHead>
									<TableHead>BTM</TableHead>
									<TableHead>BDM</TableHead>
									<TableHead>Payload</TableHead>
									<TableHead>Length</TableHead>
									<TableHead>Width</TableHead>
									<TableHead>Height</TableHead>
									<TableHead>Pallet 4x3</TableHead>
									<TableHead>Clock</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{drivers.length === 0 && !loading ? (
									<TableRow>
										<TableCell colSpan={12} className="text-center text-muted-foreground py-8">
											No drivers found.
										</TableCell>
									</TableRow>
								) : (
									drivers.map((d) => {
										const clockedIn = Boolean(d.clockedInAt);
										return (
											<TableRow key={d.id}>
												<TableCell>
													<div className="font-medium">{d.name}</div>
													<div className="text-xs text-muted-foreground">{d.phone}</div>
												</TableCell>
												<TableCell className="font-mono text-xs">
													{dash(d.plateNumber)}
												</TableCell>
												<TableCell>{dash(d.vehicleType)}</TableCell>
												<TableCell className="font-mono text-xs">{dash(d.barcode)}</TableCell>
												<TableCell>{dash(d.btm)}</TableCell>
												<TableCell>{dash(d.bdm)}</TableCell>
												<TableCell>{dash(d.payload)}</TableCell>
												<TableCell>{dash(d.length)}</TableCell>
												<TableCell>{dash(d.width)}</TableCell>
												<TableCell>{dash(d.height)}</TableCell>
												<TableCell>{dash(d.pallet4x3)}</TableCell>
												<TableCell>
													<Button
														type="button"
														size="sm"
														variant={clockedIn ? "secondary" : "outline"}
														className={
															clockedIn
																? ""
																: "border-emerald-500/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
														}
														disabled={clockMutation.isPending}
														onClick={() =>
															clockMutation.mutate({ id: d.id, clockedIn: !clockedIn })
														}
													>
														{clockedIn ? "Clock Out" : "Clock In"}
													</Button>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
