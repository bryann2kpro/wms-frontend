import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
	Download,
	BarChart3,
	Package,
	Truck,
	ArrowRightLeft,
	Receipt,
} from "lucide-react";
import { useMutation } from "@apollo/client/react";
import {
	GENERATE_REPORT_MUTATION,
	type GenerateReportMutationData,
	type GenerateReportMutationVariables,
} from "@/lib/graphql/reports";
import { downloadPdfFromBase64 } from "@/lib/reports";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { getAccessToken } from "@/lib/auth/auth-storage";
import request from "graphql-request";
import { env } from "@/env";
import {
	REGIONS_QUERY,
	type RegionsQueryData,
} from "@/lib/graphql/regions";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/reports")({
	component: ReportsComponent,
});

type ReportType = "GRN" | "DO" | "Inventory" | "Movement" | "InvoiceSummary";
type ExportFormat = "PDF" | "Excel";

type ReportFormValues = {
	selectedReport: ReportType | null;
	regionId: string;
	dateFrom: string;
	dateTo: string;
	format: ExportFormat;
};

const reportTypes: {
	value: ReportType;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}[] = [
	{ value: "GRN", label: "GRN Reports", icon: Package },
	{ value: "DO", label: "DO Reports", icon: Truck },
	{ value: "Inventory", label: "Inventory Reports", icon: BarChart3 },
	{ value: "Movement", label: "Movement Reports", icon: ArrowRightLeft },
	{ value: "InvoiceSummary", label: "Invoices Summary", icon: Receipt },
];

function ReportsComponent() {
	const { data } = useQuery({
		queryKey: ['regions'],
		queryFn: async () => {
			const headers = new Headers();
			headers.set('Authorization', `Bearer ${localStorage.getItem('access_token')}`);
			const data = await request<RegionsQueryData>(env.VITE_GRAPHQL_ENDPOINT, REGIONS_QUERY, { }, headers);
			return data;
		},
	});
	const [generateReportMutation, { loading: generatingReport }] = useMutation<
		GenerateReportMutationData,
		GenerateReportMutationVariables
	>(GENERATE_REPORT_MUTATION);

	const regions = data?.regions?.query ?? [];

	const form = useForm({
		defaultValues: {
			selectedReport: null as ReportType | null,
			regionId: "",
			dateFrom: "",
			dateTo: "",
			format: "PDF" as ExportFormat,
		} satisfies ReportFormValues,
		onSubmit: async ({ value }) => {
			const { selectedReport, regionId, dateFrom, dateTo, format } = value;
			if (!selectedReport) return;

			// PDF: Movement Report or Invoices Summary — fetch from backend, then download PDF
			if (format === "PDF" && (selectedReport === "Movement" || selectedReport === "InvoiceSummary")) {
				const reportType = selectedReport === "Movement" ? "MOVEMENT_REPORT" : "INVOICE_SUMMARY";
				const input: GenerateReportMutationVariables["input"] = {
					type: reportType,
					...(regionId && { regionId }),
					...(dateFrom && { dateFrom }),
					...(dateTo && { dateTo }),
				};
				const result = await generateReportMutation({ variables: { input } });
				const payload = result.data?.generateReport;
				if (payload?.pdfBase64 && payload?.filename) {
					downloadPdfFromBase64(payload.pdfBase64, payload.filename);
				}
				return;
			}

			// Other report types or formats: mock download
			await new Promise((resolve) => setTimeout(resolve, 800));
			const blob = new Blob([`Mock ${selectedReport} Report`], {
				type:
					format === "PDF"
						? "application/pdf"
						: format === "Excel"
							? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							: "text/plain",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${selectedReport}_Report_${new Date().toISOString().split("T")[0]}.${format.toLowerCase() === "excel" ? "xlsx" : format.toLowerCase()}`;
			a.click();
			URL.revokeObjectURL(url);
		},
	});

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Reports / Exports
					</h1>
					<p className="text-muted-foreground">Generate and export reports</p>
				</div>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid gap-6 lg:grid-cols-2">
					{/* Report Types */}
					<Card>
						<CardHeader>
							<CardTitle>Available Reports</CardTitle>
							<CardDescription>Select a report type to generate</CardDescription>
						</CardHeader>
						<CardContent>
							<form.Field name="selectedReport">
								{(field) => (
									<Field className="grid gap-3 sm:grid-cols-2">
										{reportTypes.map((report) => {
											const Icon = report.icon;
											return (
												<Field key={report.value}>
													<Button
														id={report.value}
														name={report.value}
														value={report.value}
														onBlur={field.handleBlur}
														type="button"
														variant={
															field.state.value === report.value
																? "default"
																: "outline"
														}
														className="h-auto flex-col gap-2 p-4"
														onClick={() => field.handleChange(report.value)}
													>
														<Icon className="h-6 w-6" />
														<span>{report.label}</span>
													</Button>
												</Field>
											);
										})}
									</Field>
								)}
							</form.Field>
						</CardContent>
					</Card>

					{/* Report Configuration */}
					<Card>
						<CardHeader>
							<CardTitle>Report Configuration</CardTitle>
							<CardDescription>
								Configure report parameters and export format
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<form.Field name="regionId">
								{(field) => (
									<div className="space-y-2">
										<FieldLabel htmlFor="regionId">Region</FieldLabel>
										<Select
											value={field.state.value || "all"}
											onValueChange={(v) => {
												field.handleChange(v === "all" ? "" : v);
												field.handleBlur();
											}}
										>
											<SelectTrigger id="regionId">
												<SelectValue placeholder="Select Region" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all" disabled>Select Region</SelectItem>
												{regions.map((r) => (
													<SelectItem key={r.regionId} value={r.regionId}>
														{r.regionName}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
							<div className="space-y-2">
								<Label>Date Range</Label>
								<div className="grid gap-2 sm:grid-cols-2">
									<form.Field name="dateFrom">
										{(field) => (
											<Field>
												<FieldLabel htmlFor="dateFrom" className="text-xs">
													From
												</FieldLabel>
												<Input
													id="dateFrom"
													type="date"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
												/>
											</Field>
										)}
									</form.Field>
									<form.Field name="dateTo">
										{(field) => (
											<Field>
												<FieldLabel htmlFor="dateTo" className="text-xs">
													To
												</FieldLabel>
												<Input
													id="dateTo"
													type="date"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
												/>
											</Field>
										)}
									</form.Field>
								</div>
							</div>
							<form.Field name="format">
								{(field) => (
									<div className="space-y-2">
										<FieldLabel htmlFor="format">Export Format</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(v) => {
												field.handleChange(v as ExportFormat);
												field.handleBlur();
											}}
										>
											<SelectTrigger id="format">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="PDF">PDF</SelectItem>
												<SelectItem value="Excel">Excel (XLSX)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
							<form.Subscribe
								selector={(state) => ({
									selectedReport: state.values.selectedReport,
									isSubmitting: state.isSubmitting,
								})}
							>
								{({ selectedReport, isSubmitting }) => (
									<Button
										type="submit"
										disabled={
											!selectedReport || isSubmitting || generatingReport
										}
										className="w-full"
									>
										<Download className="mr-2 h-4 w-4" />
										{generatingReport || isSubmitting
											? "Generating…"
											: "Generate & Download Report"}
									</Button>
								)}
							</form.Subscribe>
						</CardContent>
					</Card>
				</FieldGroup>
			</form>
		</div>
	);
}
