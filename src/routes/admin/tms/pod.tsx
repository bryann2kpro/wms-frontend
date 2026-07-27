import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
	POD_RECORDS_QUERY,
	type PodRecordsQueryData,
	type PodRecordsQueryVariables,
} from "@/lib/graphql/pod";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/admin/tms/pod")({
	component: TmsPodPage,
	head: () => ({
		meta: [
			{
				title: "POD - SME Edaran WMS",
				description: "Proof of delivery photos submitted by drivers via tmsmobile.",
			},
		],
	}),
});

function dash(v: string | null | undefined): string {
	return v && v.trim() ? v : "—";
}

function TmsPodPage() {
	const queryVars: PodRecordsQueryVariables = {};

	const { data, isLoading, isFetching } = useQuery({
		queryKey: qk.podRecords.list(queryVars),
		queryFn: () =>
			gqlRequest<PodRecordsQueryData, PodRecordsQueryVariables>(
				POD_RECORDS_QUERY,
				queryVars,
			),
	});

	const records = data?.podRecords ?? [];
	const loading = isLoading || isFetching;

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="tms-pod-title"
			aria-describedby="tms-pod-description"
			aria-busy={loading}
		>
			<GlobalLoadingShadow />
			<AdminPageHeader
				icon={FileCheck}
				title="POD"
				description="Proof of delivery photos submitted by drivers via tmsmobile."
				titleId="tms-pod-title"
				descriptionId="tms-pod-description"
			/>

			<Card className="rounded-2xl border-2 border-border">
				<CardHeader>
					<CardTitle>Submitted PODs</CardTitle>
					<CardDescription>
						{records.length} record{records.length === 1 ? "" : "s"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Photo</TableHead>
									<TableHead>DO No.</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead>Driver</TableHead>
									<TableHead>Captured At</TableHead>
									<TableHead>Location</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{records.length === 0 && !loading ? (
									<TableRow>
										<TableCell colSpan={6} className="text-center text-muted-foreground py-8">
											No POD records found.
										</TableCell>
									</TableRow>
								) : (
									records.map((r) => (
										<TableRow key={r.id}>
											<TableCell>
												<a href={r.photoUrl} target="_blank" rel="noreferrer">
													<img
														src={r.photoUrl}
														alt={`POD for ${r.doNo}`}
														className="h-14 w-14 rounded-md object-cover border"
													/>
												</a>
											</TableCell>
											<TableCell className="font-mono text-xs">{r.doNo}</TableCell>
											<TableCell>{r.outletName}</TableCell>
											<TableCell>{dash(r.driverName)}</TableCell>
											<TableCell>{formatDate(r.capturedAt)}</TableCell>
											<TableCell className="font-mono text-xs">
												{r.lat && r.lng ? `${r.lat}, ${r.lng}` : "—"}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
