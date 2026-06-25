import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, FileWarning, Loader2, Printer } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Button } from "@/components/ui/button";
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
	GENERATE_GRN_REMAINING_REPORT_PDF_MUTATION,
	GRN_REMAINING_REPORT_QUERY,
	type GenerateGrnRemainingReportPdfMutationData,
	type GrnRemainingLine,
	type GrnRemainingReportQueryData,
} from "@/lib/graphql/grns";
import { requirePermission } from "@/lib/rbac";
import { downloadPdfFromBase64 } from "@/lib/reports/report-pdf";
import { formatDate, toUserFriendlyMessage } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_TITLE = "GRN Unfulfillment Report";
const PAGE_DESCRIPTION =
	"Cartons + loose pieces still owed against each PO/ASN line, as of the GRN that last reported a shortfall.";

export const Route = createFileRoute("/admin/grn-remaining-report")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["GRN"]);
	},
	component: GrnRemainingReportComponent,
	head: () => ({
		meta: [
			{
				title: "GRN Unfulfillment Report - SME Edaran WMS",
				description: PAGE_DESCRIPTION,
			},
		],
	}),
});

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "response" in err) {
		const first = (
			err as { response?: { errors?: Array<{ message?: string }> } }
		).response?.errors?.[0];
		if (first?.message) {
			return toUserFriendlyMessage(
				first.message,
				"Something went wrong. Please try again.",
			);
		}
	}
	return "Something went wrong. Please try again.";
}

function GrnRemainingReportComponent() {
	const {
		data,
		isLoading: queryLoading,
		isError,
		error: queryError,
		refetch,
	} = useQuery({
		queryKey: [...qk.grns.all, "remaining-report"] as const,
		queryFn: () =>
			gqlRequest<GrnRemainingReportQueryData>(GRN_REMAINING_REPORT_QUERY),
	});
	const lines = data?.grnRemainingReport ?? [];

	// GRNs are the unit of "outstanding" — group lines by grnId so a GRN's full item set
	// (fulfilled lines included) renders together under one header instead of isolated rows.
	const groups = useMemo(() => {
		const order: string[] = [];
		const byGrn = new Map<string, GrnRemainingLine[]>();
		for (const line of lines) {
			if (!byGrn.has(line.grnId)) {
				order.push(line.grnId);
				byGrn.set(line.grnId, []);
			}
			byGrn.get(line.grnId)!.push(line);
		}
		return order.map((grnId) => byGrn.get(grnId)!);
	}, [lines]);

	const { mutate: generateReport, isPending: generatingReport } = useMutation({
		mutationFn: () =>
			gqlRequest<GenerateGrnRemainingReportPdfMutationData>(
				GENERATE_GRN_REMAINING_REPORT_PDF_MUTATION,
			),
		onSuccess(data) {
			const { pdfBase64, filename } = data.generateGrnRemainingReportPdf;
			downloadPdfFromBase64(pdfBase64, filename);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const busy = queryLoading;

	return (
		<div className="grn-remaining-report-page min-h-screen bg-[var(--dashboard-surface)]">
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				id="main-content"
				className="container relative mx-auto p-6 space-y-6"
				aria-labelledby="grn-remaining-report-page-title"
				aria-describedby="grn-remaining-report-page-description"
			>
				<div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
					{queryLoading
						? "Loading outstanding lines…"
						: lines.length === 0
							? "No outstanding GRN lines found."
							: `Showing ${lines.length} outstanding line${lines.length === 1 ? "" : "s"}.`}
				</div>

				<AdminPageHeader
					icon={FileWarning}
					title={PAGE_TITLE}
					description={PAGE_DESCRIPTION}
					titleId="grn-remaining-report-page-title"
					descriptionId="grn-remaining-report-page-description"
				/>

				<div className="flex items-center justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={() => generateReport()}
						disabled={generatingReport || queryLoading}
						className="h-7 text-xs gap-1.5"
					>
						{generatingReport ? (
							<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
						) : (
							<Printer className="h-3 w-3" aria-hidden />
						)}
						{generatingReport ? "Generating…" : "Print Report"}
					</Button>
				</div>

				{queryLoading && (
					<div
						className="flex items-center gap-2 text-muted-foreground text-sm"
						role="status"
						aria-live="polite"
					>
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						<span>Loading outstanding lines…</span>
					</div>
				)}

				{isError && (
					<div
						className="flex items-center gap-2 text-destructive text-sm rounded-lg border border-destructive/20 bg-destructive/5 p-4"
						role="alert"
					>
						<AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
						<span>Failed to load report: {(queryError as Error).message}</span>
						<Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
							Retry
						</Button>
					</div>
				)}

				<section className="relative" aria-label="Outstanding GRN lines table" aria-busy={busy}>
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table aria-label="GRN lines still owed against their PO/ASN">
							<TableHeader>
								<TableRow>
									<TableHead>GRN No.</TableHead>
									<TableHead>PO No.</TableHead>
									<TableHead>SKU Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="text-center">Remaining</TableHead>
									<TableHead>Received</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{!queryLoading && groups.length === 0 ? (
									<TableRow>
										<TableCell colSpan={6} className="py-16 text-center">
											<div className="flex flex-col items-center gap-3">
												<div className="rounded-full bg-muted p-3">
													<FileWarning className="h-8 w-8 text-muted-foreground" aria-hidden />
												</div>
												<p className="font-medium text-foreground">No outstanding lines</p>
												<p className="text-sm text-muted-foreground">
													Every PO/ASN-linked GRN submitted so far has been fully received.
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									groups.flatMap((group) => {
										const first = group[0];
										return [
											<TableRow
												key={`group-${first.grnId}`}
												className="bg-muted/50 hover:bg-muted/60 border-l-4 border-l-primary/40"
											>
												<TableCell colSpan={6} className="px-4 py-2.5">
													<div className="flex flex-wrap items-center gap-3">
														<span className="font-mono text-sm font-semibold">
															{first.grnNo}
														</span>
														<span className="text-xs text-muted-foreground">
															PO {first.poNo ?? "—"}
														</span>
														<span className="text-xs text-muted-foreground">
															Received{" "}
															{first.receivedAt ? formatDate(first.receivedAt) : "—"}
														</span>
													</div>
												</TableCell>
											</TableRow>,
											...group.map((line, i) => (
												<TableRow key={`${first.grnId}-${line.skuCode}-${i}`}>
													<TableCell />
													<TableCell />
													<TableCell className="font-mono text-xs">{line.skuCode}</TableCell>
													<TableCell className="text-sm text-muted-foreground">
														{line.skuDescription}
													</TableCell>
													<TableCell className="text-center font-mono text-sm font-semibold text-amber-700">
														{line.remainingCtn ? (
															<>
																{line.remainingCtn} CTN
																{line.remainingLoosePcs
																	? ` + ${line.remainingLoosePcs} pcs`
																	: ""}
															</>
														) : (
															<span className="text-muted-foreground">—</span>
														)}
													</TableCell>
													<TableCell />
												</TableRow>
											)),
										];
									})
								)}
							</TableBody>
						</Table>
					</div>
				</section>
			</main>
		</div>
	);
}
