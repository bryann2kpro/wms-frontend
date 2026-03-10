import { useState } from "react";
import type { ReactNode } from "react";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Download,
	BarChart3,
	Package,
	Truck,
	ArrowRightLeft,
	Receipt,
	HelpCircle,
	ChevronLeft,
	ChevronRight,
	ImageOff,
} from "lucide-react";
import { useMutation } from "@apollo/client/react";
import {
	GENERATE_REPORT_MUTATION,
	type GenerateReportMutationData,
	type GenerateReportMutationVariables,
} from "@/lib/graphql/reports";
import { downloadPdfFromBase64 } from "@/lib/reports";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import request from "graphql-request";
import { toast } from "sonner";
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

/** Base path for Reports help screenshots. Add step-1.png, step-2.png, etc. under public/help/reports/ */
const HELP_IMAGES_BASE = "/help/reports";

const REPORTS_HELP_STEPS: Array<{
	title: string;
	description: ReactNode;
	image: string;
}> = [
	{
		title: "What this page does",
		image: `${HELP_IMAGES_BASE}/step-1.png`,
		description: (
			<>
				Generate and download reports in <strong>PDF</strong> or{" "}
				<strong>Excel (XLSX)</strong>. Choose a report type, set region and
				date range, then click Generate & Download.
			</>
		),
	},
	{
		title: "Report types",
		image: `${HELP_IMAGES_BASE}/step-2.png`,
		description: (
			<>
				<strong>GRN</strong>, <strong>DO</strong>, <strong>Inventory</strong>,{" "}
				<strong>Movement</strong>, and <strong>Invoices Summary</strong>.
				Movement and Invoices Summary (PDF) require a region; others can use
				optional filters.
			</>
		),
	},
	{
		title: "Configuration",
		image: `${HELP_IMAGES_BASE}/step-3.png`,
		description: (
			<>
				Select <strong>Region</strong> (required for some reports), set{" "}
				<strong>Date range</strong> (From / To), and choose{" "}
				<strong>Export format</strong> (PDF or Excel). Then click Generate &
				Download.
			</>
		),
	},
];

/** Renders step screenshot with a placeholder when the image is missing or fails to load. */
function HelpStepImage({
	src,
	stepNumber,
	alt,
}: { src: string; stepNumber: number; alt?: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
					<ImageOff className="h-6 w-6" />
				</span>
				<span>
					Add screenshot: public/help/reports/step-{stepNumber}.png
				</span>
			</div>
		);
	}
	return (
		<img
			src={src}
			alt={alt ?? ""}
			className="h-full w-full object-contain object-top"
			onError={() => setFailed(true)}
		/>
	);
}

function ReportsComponent() {
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);

	const { data, isLoading: isLoadingRegions } = useQuery({
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
				if (!regionId?.trim()) {
					toast.error("Region is required for this report.");
					return;
				}
				const reportType = selectedReport === "Movement" ? "MOVEMENT_REPORT" : "INVOICE_SUMMARY";
				const input: GenerateReportMutationVariables["input"] = {
					type: reportType,
					regionId: regionId.trim(),
					...(dateFrom && { dateFrom }),
					...(dateTo && { dateTo }),
					saveToS3: true,
				};
				try {
					const result = await generateReportMutation({ variables: { input } });
					if (result.error) {
						const err = result.error as { graphQLErrors?: Array<{ message: string }>; message: string };
						const message =
							err.graphQLErrors?.[0]?.message ?? err.message ?? "Failed to generate report.";
						toast.error(message);
						return;
					}
					const payload = result.data?.generateReport;
					if (!payload?.pdfBase64 || !payload?.filename) {
						toast.error("Report generated but no file was returned. Please try again.");
						return;
					}
					downloadPdfFromBase64(payload.pdfBase64, payload.filename);
					toast.success(
						"Report downloaded."
					);
				} catch (err) {
					const message = err instanceof Error ? err.message : "Failed to generate report. Please try again.";
					toast.error(message);
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

	const isGenerating = generatingReport || form.state.isSubmitting;

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="reports-page-title"
			aria-describedby="reports-page-description"
			aria-busy={isGenerating}
		>
			{/* Visual feedback overlay when generating report */}
			{isGenerating && (
				<div
					className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
					aria-hidden="true"
				>
					<div className="absolute inset-0 bg-background/35 backdrop-blur-[2px]" />
					<div className="relative rounded-lg border bg-card/90 px-4 py-3 shadow-sm flex items-center gap-3">
						<div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
						<span className="text-sm text-muted-foreground">
							Generating report…
						</span>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1
						id="reports-page-title"
						className="text-3xl font-bold tracking-tight"
					>
						Reports / Exports
					</h1>
					<p id="reports-page-description" className="text-muted-foreground">
						Generate and export reports in PDF or Excel.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						aria-label="Open help for Reports"
						onClick={() => {
							setIsHelpOpen(true);
							setHelpStep(0);
						}}
					>
						<HelpCircle className="h-4 w-4" />
					</Button>
					<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
						<DialogContent className="sm:max-w-lg" aria-describedby="reports-help-description">
							<DialogHeader>
								<DialogTitle>Reports help</DialogTitle>
								<DialogDescription id="reports-help-description">
									Step {helpStep + 1} of {REPORTS_HELP_STEPS.length}
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
									<HelpStepImage
										src={REPORTS_HELP_STEPS[helpStep].image}
										stepNumber={helpStep + 1}
										alt={`Help step ${helpStep + 1}: ${REPORTS_HELP_STEPS[helpStep].title}`}
									/>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-foreground mb-1">
										{REPORTS_HELP_STEPS[helpStep].title}
									</h3>
									<p className="text-sm text-muted-foreground leading-relaxed">
										{REPORTS_HELP_STEPS[helpStep].description}
									</p>
								</div>
								<div className="flex items-center justify-between gap-4 pt-2">
									<div className="flex gap-1" role="tablist" aria-label="Help steps">
										{REPORTS_HELP_STEPS.map((_, i) => (
											<button
												type="button"
												key={i}
												role="tab"
												aria-selected={i === helpStep}
												aria-label={`Go to step ${i + 1}`}
												onClick={() => setHelpStep(i)}
												className={`h-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
													i === helpStep
														? "w-6 bg-primary"
														: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
												}`}
											/>
										))}
									</div>
									<div className="flex gap-2">
										{helpStep > 0 ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => setHelpStep((s) => s - 1)}
												aria-label="Previous help step"
											>
												<ChevronLeft className="h-4 w-4 mr-0.5" aria-hidden />
												Previous
											</Button>
										) : null}
										{helpStep < REPORTS_HELP_STEPS.length - 1 ? (
											<Button
												size="sm"
												onClick={() => setHelpStep((s) => s + 1)}
												aria-label="Next help step"
											>
												Next
												<ChevronRight className="h-4 w-4 ml-0.5" aria-hidden />
											</Button>
										) : (
											<Button
												size="sm"
												onClick={() => setIsHelpOpen(false)}
												aria-label="Close help"
											>
												Got it
											</Button>
										)}
									</div>
								</div>
							</div>
						</DialogContent>
					</Dialog>
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
						<CardTitle id="report-type-label">Available Reports</CardTitle>
						<CardDescription>Select a report type to generate</CardDescription>
					</CardHeader>
						<CardContent>
							<form.Field name="selectedReport">
								{(field) => (
									<Field className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby="report-type-label">
										{reportTypes.map((report) => {
											const Icon = report.icon;
											const isSelected = field.state.value === report.value;
											return (
												<Field key={report.value}>
													<Button
														id={report.value}
														name={report.value}
														value={report.value}
														onBlur={field.handleBlur}
														type="button"
														variant={isSelected ? "default" : "outline"}
														className="h-auto flex-col gap-2 p-4"
														onClick={() => field.handleChange(report.value)}
														aria-pressed={isSelected}
														aria-label={`Select ${report.label}`}
														disabled={isGenerating}
													>
														<Icon className="h-6 w-6" aria-hidden />
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
											disabled={isLoadingRegions}
										>
											<SelectTrigger id="regionId" aria-label="Select region" aria-busy={isLoadingRegions}>
												<SelectValue placeholder={isLoadingRegions ? "Loading regions…" : "Select Region"} />
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
							<div className="space-y-2" role="group" aria-labelledby="date-range-label">
								<Label id="date-range-label">Date Range</Label>
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
													aria-label="Report date from"
													disabled={isGenerating}
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
													aria-label="Report date to"
													disabled={isGenerating}
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
											disabled={isGenerating}
										>
											<SelectTrigger id="format" aria-label="Export format (PDF or Excel)">
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
									regionId: state.values.regionId,
									format: state.values.format,
								})}
							>
								{({ selectedReport, regionId, format }) => {
									const needsRegion =
										selectedReport === "Movement" || selectedReport === "InvoiceSummary";
									const missingRequiredRegion =
										format === "PDF" && needsRegion && !regionId?.trim();
									return (
									<Button
										type="submit"
										disabled={
											!selectedReport ||
											missingRequiredRegion ||
											isGenerating
										}
										className="w-full"
										aria-busy={isGenerating}
										aria-label={isGenerating ? "Generating report" : "Generate and download report"}
									>
										<Download className="mr-2 h-4 w-4" aria-hidden />
										{isGenerating
											? "Generating…"
											: "Generate & Download Report"}
									</Button>
									);
								}}
							</form.Subscribe>
						</CardContent>
					</Card>
				</FieldGroup>
			</form>
		</main>
	);
}
