import { useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
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
	ArrowRightLeft,
	Receipt,
	HelpCircle,
	ChevronLeft,
	ChevronRight,
	ImageOff,
	Package,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import * as XLSX from "xlsx";
import {
	GENERATE_REPORT_MUTATION,
	type GenerateReportMutationData,
	type GenerateReportMutationVariables,
	INVOICE_SUMMARY_REPORT_DATA_QUERY,
	type InvoiceSummaryReportDataQueryData,
	type InvoiceSummaryReportDataQueryVariables,
	INVENTORY_BALANCE_REPORT_DATA_QUERY,
	type InventoryBalanceReportDataQueryData,
	type InventoryBalanceReportDataQueryVariables,
	type InventoryBalanceReportType,
	GENERATE_STOCK_BALANCE_REPORT_MUTATION,
	type GenerateStockBalanceReportMutationData,
	type GenerateStockBalanceReportMutationVariables,
} from "@/lib/graphql/reports";
import { downloadPdfFromBase64 } from "@/lib/reports";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import request from "graphql-request";
import { toast } from "sonner";
import { env } from "@/env";
import { REGIONS_QUERY, type RegionsQueryData } from "@/lib/graphql/regions";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/reports")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Report"]);
	},
	component: ReportsComponent,
	head: () => ({
		meta: [
			{
				title: "Reports - SME Edaran WMS",
				description:
					"Generate and export warehouse operational reports including movement and invoice summaries.",
			},
		],
	}),
});

type ReportType = "Movement" | "InvoiceSummary" | "StockBalance";
type ExportFormat = "PDF" | "Excel";

type ReportFormValues = {
	selectedReport: ReportType | null;
	regionId: string;
	dateFrom: string;
	dateTo: string;
	format: ExportFormat;
	stockBalanceType: InventoryBalanceReportType;
};

const reportTypes: {
	value: ReportType;
	label: string;
	shortLabel: string;
	icon: React.ComponentType<{ className?: string }>;
	index: string;
}[] = [
	{
		value: "Movement",
		label: "Movement Reports",
		shortLabel: "Movement",
		icon: ArrowRightLeft,
		index: "01",
	},
	{
		value: "InvoiceSummary",
		label: "Proforma Invoice Summary",
		shortLabel: "Inv. Summary",
		icon: Receipt,
		index: "02",
	},
	{
		value: "StockBalance",
		label: "Stock Balance",
		shortLabel: "Stock Balance",
		icon: Package,
		index: "03",
	},
] satisfies { value: ReportType; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }>; index: string }[];

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
				<strong>Excel (XLSX)</strong>. Choose a report type, set region and date
				range, then click Generate & Download.
			</>
		),
	},
	{
		title: "Report types",
		image: `${HELP_IMAGES_BASE}/step-2.png`,
		description: (
			<>
				Available reports: <strong>Movement</strong> and{" "}
				<strong>Proforma Invoice Summary</strong>. Both require a region and
				date range when exporting as PDF.
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
}: {
	src: string;
	stepNumber: number;
	alt?: string;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
					<ImageOff className="h-6 w-6" />
				</span>
				<span>Add screenshot: public/help/reports/step-{stepNumber}.png</span>
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
		queryKey: ["regions"],
		queryFn: async () => {
			const headers = new Headers();
			headers.set(
				"Authorization",
				`Bearer ${localStorage.getItem("access_token")}`,
			);
			const data = await request<RegionsQueryData>(
				env.VITE_GRAPHQL_ENDPOINT,
				REGIONS_QUERY,
				{},
				headers,
			);
			return data;
		},
	});
	const {
		mutateAsync: generateReportMutation,
		isPending: generatingReport,
	} = useMutation({
		mutationFn: (vars: GenerateReportMutationVariables) =>
			gqlRequest<GenerateReportMutationData, GenerateReportMutationVariables>(
				GENERATE_REPORT_MUTATION,
				vars,
			),
	});

	const {
		mutateAsync: generateStockBalanceMutation,
		isPending: generatingStockBalance,
	} = useMutation({
		mutationFn: (vars: GenerateStockBalanceReportMutationVariables) =>
			gqlRequest<
				GenerateStockBalanceReportMutationData,
				GenerateStockBalanceReportMutationVariables
			>(GENERATE_STOCK_BALANCE_REPORT_MUTATION, vars),
	});

	const regions = data?.regions?.query ?? [];

	const form = useForm({
		defaultValues: {
			selectedReport: null as ReportType | null,
			regionId: "",
			dateFrom: "",
			dateTo: "",
			format: "PDF" as ExportFormat,
			stockBalanceType: "WITHOUT_RACK" as InventoryBalanceReportType,
		} satisfies ReportFormValues,
		onSubmit: async ({ value }) => {
			const { selectedReport, regionId, dateFrom, dateTo, format, stockBalanceType } = value;
			if (!selectedReport) return;

			// Stock Balance — PDF
			if (selectedReport === "StockBalance" && format === "PDF") {
				try {
					const result = await generateStockBalanceMutation({
						type: stockBalanceType,
					});
					const payload = result?.generateStockBalanceReport;
					if (!payload?.pdfBase64 || !payload?.filename) {
						toast.error("Report generated but no file was returned. Please try again.");
						return;
					}
					downloadPdfFromBase64(payload.pdfBase64, payload.filename);
					toast.success("Report downloaded.");
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed to generate report. Please try again.");
				}
				return;
			}

			// Stock Balance — Excel
			if (selectedReport === "StockBalance" && format === "Excel") {
				try {
					const headers = new Headers();
					headers.set("Authorization", `Bearer ${localStorage.getItem("access_token")}`);
					const reportData = await request<
						InventoryBalanceReportDataQueryData,
						InventoryBalanceReportDataQueryVariables
					>(env.VITE_GRAPHQL_ENDPOINT, INVENTORY_BALANCE_REPORT_DATA_QUERY, { type: stockBalanceType }, headers);
					const rows = reportData.inventoryBalanceReportData ?? [];
					if (rows.length === 0) {
						toast.error("No stock balance data found.");
						return;
					}
					const withRack = stockBalanceType === "WITH_RACK";
					const header = withRack
						? ["No.", "SKU Code", "Description", "UOM", "On-Hand Qty", "Rack Location(s)"]
						: ["No.", "SKU Code", "Description", "UOM", "On-Hand Qty"];
					const dataRows = rows.map((row, i) =>
						withRack
							? [i + 1, row.skuCode, row.skuDescription, row.unitCode, row.onHandQty, row.rackLocations.join(", ")]
							: [i + 1, row.skuCode, row.skuDescription, row.unitCode, row.onHandQty],
					);
					const wb = XLSX.utils.book_new();
					const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
					XLSX.utils.book_append_sheet(wb, ws, "Stock Balance");
					XLSX.writeFile(wb, `Stock_Balance_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
					toast.success("Excel report downloaded.");
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed to generate report. Please try again.");
				}
				return;
			}

			// PDF: Movement Report or Invoices Summary — fetch from backend, then download PDF
			if (
				format === "PDF" &&
				(selectedReport === "Movement" || selectedReport === "InvoiceSummary")
			) {
				if (!regionId?.trim()) {
					toast.error("Region is required for this report.");
					return;
				}
				if (!dateFrom?.trim() || !dateTo?.trim()) {
					toast.error("Date range (From and To) is required for this report.");
					return;
				}
				const reportType =
					selectedReport === "Movement" ? "MOVEMENT_REPORT" : "INVOICE_SUMMARY";
				const input: GenerateReportMutationVariables["input"] = {
					type: reportType,
					regionId: regionId.trim(),
					dateFrom: dateFrom.trim(),
					dateTo: dateTo.trim(),
					saveToS3: true,
				};
				try {
					const result = await generateReportMutation({ input });
					const payload = result?.generateReport;
					if (!payload?.pdfBase64 || !payload?.filename) {
						toast.error(
							"Report generated but no file was returned. Please try again.",
						);
						return;
					}
					downloadPdfFromBase64(payload.pdfBase64, payload.filename);
					toast.success("Report downloaded.");
				} catch (err) {
					const errObj = err as {
						response?: { errors?: Array<{ message?: string }> };
						graphQLErrors?: Array<{ message?: string }>;
						message?: string;
					};
					const message =
						errObj.response?.errors?.[0]?.message ??
						errObj.graphQLErrors?.[0]?.message ??
						errObj.message ??
						"Failed to generate report. Please try again.";
					toast.error(message);
				}
				return;
			}

			// Excel: generate a real XLSX file (not a text blob)
			if (format === "Excel") {
				if (selectedReport === "InvoiceSummary") {
					if (!regionId?.trim()) {
						toast.error("Region is required for this report.");
						return;
					}
					if (!dateFrom?.trim() || !dateTo?.trim()) {
						toast.error("Date range (From and To) is required for this report.");
						return;
					}
				}

				const wb = XLSX.utils.book_new();
				let summaryRows: Array<
					[
						string | number,
						string | number,
						string | number,
						string | number,
						string | number,
						string | number,
						string | number,
						string | number,
						string | number,
						string | number,
					]
				> = [
					[
						"Proforma Invoice No",
						"Invoice Date",
						"Delivery Date",
						"PO No",
						"DO No",
						"Outlet",
						"Region",
						"CTN",
						"Subtotal Excl. SST (RM)",
						"Total Incl. SST (RM)",
					],
				];

				if (selectedReport === "InvoiceSummary") {
					const headers = new Headers();
					headers.set(
						"Authorization",
						`Bearer ${localStorage.getItem("access_token")}`,
					);

					const reportData = await request<
						InvoiceSummaryReportDataQueryData,
						InvoiceSummaryReportDataQueryVariables
					>(
						env.VITE_GRAPHQL_ENDPOINT,
						INVOICE_SUMMARY_REPORT_DATA_QUERY,
						{
							regionId: regionId.trim(),
							dateFrom: dateFrom.trim(),
							dateTo: dateTo.trim(),
						},
						headers,
					);

					const rows = reportData.invoiceSummaryReportData ?? [];
					if (rows.length === 0) {
						toast.error(
							"No data found for selected region and date range.",
						);
						return;
					}

					summaryRows = [
						summaryRows[0],
						...rows.map((row) => [
							row.proformaId,
							row.invoiceDate,
							row.deliveryDate,
							row.poNumber,
							row.doNumber,
							row.outlet,
							row.region,
							row.ctn,
							Number(row.beforeTaxAmount ?? 0),
							Number(row.afterTaxAmount ?? row.amount ?? 0),
						] as [string | number, string | number, string | number, string | number, string | number, string | number, string | number, string | number, string | number, string | number]),
					];
				}

				const ws = XLSX.utils.aoa_to_sheet(summaryRows);
				XLSX.utils.book_append_sheet(wb, ws, "Invoice Summary");
				XLSX.writeFile(
					wb,
					`${selectedReport}_Report_${new Date().toISOString().split("T")[0]}.xlsx`,
				);
				toast.success("Excel report downloaded.");
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

	const isGenerating = generatingReport || generatingStockBalance || form.state.isSubmitting;

	return (
		<main
			className="reports-page container mx-auto p-6 space-y-6"
			aria-labelledby="reports-page-title"
			aria-describedby="reports-page-description"
			aria-busy={isGenerating}
		>
			{/* Generating overlay */}
			{isGenerating && (
				<div
					className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
					aria-hidden="true"
				>
					<div className="absolute inset-0 bg-background/50 backdrop-blur-[3px]" />
					<div className="relative rounded-2xl border bg-card shadow-xl px-8 py-7 flex flex-col items-center gap-5 min-w-[220px]">
						{/* Animated bar chart */}
						<div className="flex items-end gap-[5px] h-10" aria-hidden>
							{[0, 1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="reports-bar-wave w-[6px] rounded-full"
									style={{
										background: "var(--dashboard-accent)",
										animationDelay: `${i * 0.12}s`,
									}}
								/>
							))}
						</div>
						<div className="text-center space-y-1">
							<p
								className="text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Generating report…
							</p>
							<p className="text-xs text-muted-foreground">
								This may take a moment
							</p>
						</div>
					</div>
				</div>
			)}

			{/* ── Header ── */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<div className="flex items-center gap-2.5">
						<div
							className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
							style={{ background: "var(--dashboard-accent)" }}
						>
							<BarChart3 className="h-4.5 w-4.5 text-white" />
						</div>
						<h1
							id="reports-page-title"
							className="text-2xl font-bold tracking-tight"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Reports &amp; Exports
						</h1>
					</div>
					<div className="pl-11.5 space-y-1.5">
						<p
							id="reports-page-description"
							className="text-sm text-muted-foreground"
						>
							Generate and download operational reports in PDF or Excel.
						</p>
						<div className="reports-header-accent" />
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="gap-1.5 self-start"
					aria-label="Open help for Reports"
					onClick={() => {
						setIsHelpOpen(true);
						setHelpStep(0);
					}}
				>
					<HelpCircle className="h-3.5 w-3.5" />
					How to use
				</Button>
			</div>

			{/* ── Help dialog ── */}
			<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
				<DialogContent
					className="sm:max-w-lg"
					aria-describedby="reports-help-description"
				>
					<DialogHeader className="pb-1">
						<div className="flex items-center gap-2.5">
							<span
								className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold shrink-0"
								style={{ background: "var(--dashboard-accent)" }}
								aria-hidden
							>
								<HelpCircle className="h-3.5 w-3.5" />
							</span>
							<DialogTitle
								className="text-base"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Reports help
							</DialogTitle>
						</div>
						<DialogDescription
							id="reports-help-description"
							className="sr-only"
						>
							Step {helpStep + 1} of {REPORTS_HELP_STEPS.length}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 pt-1">
						{/* Screenshot area */}
						<div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
							<HelpStepImage
								src={REPORTS_HELP_STEPS[helpStep].image}
								stepNumber={helpStep + 1}
								alt={`Help step ${helpStep + 1}: ${REPORTS_HELP_STEPS[helpStep].title}`}
							/>
							{/* Step badge overlay */}
							<span
								className="absolute top-2.5 left-2.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md px-1.5 text-[10px] font-mono font-bold text-white shadow-sm"
								style={{ background: "var(--dashboard-accent)" }}
								aria-hidden
							>
								{String(helpStep + 1).padStart(2, "0")} /{" "}
								{REPORTS_HELP_STEPS.length}
							</span>
						</div>

						{/* Step text */}
						<div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 space-y-1">
							<h3
								className="text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{REPORTS_HELP_STEPS[helpStep].title}
							</h3>
							<p className="text-sm text-muted-foreground leading-relaxed">
								{REPORTS_HELP_STEPS[helpStep].description}
							</p>
						</div>

						{/* Navigation */}
						<div className="flex items-center justify-between gap-4 pt-1">
							{/* Step dots */}
							<div
								className="flex gap-1.5"
								role="tablist"
								aria-label="Help steps"
							>
								{REPORTS_HELP_STEPS.map((_, i) => (
									<button
										type="button"
										key={i}
										role="tab"
										aria-selected={i === helpStep}
										aria-label={`Go to step ${i + 1}`}
										onClick={() => setHelpStep(i)}
										className="h-2 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										style={
											i === helpStep
												? {
														width: "1.5rem",
														background: "var(--dashboard-accent)",
													}
												: {
														width: "0.5rem",
														background: "var(--muted-foreground)",
														opacity: 0.3,
													}
										}
									/>
								))}
							</div>

							{/* Prev / Next buttons */}
							<div className="flex gap-2">
								{helpStep > 0 && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setHelpStep((s) => s - 1)}
										aria-label="Previous help step"
									>
										<ChevronLeft className="h-4 w-4 mr-0.5" aria-hidden />
										Previous
									</Button>
								)}
								{helpStep < REPORTS_HELP_STEPS.length - 1 ? (
									<Button
										size="sm"
										onClick={() => setHelpStep((s) => s + 1)}
										aria-label="Next help step"
										className="text-white"
										style={{
											background: "var(--dashboard-accent)",
											borderColor: "var(--dashboard-accent)",
										}}
									>
										Next
										<ChevronRight className="h-4 w-4 ml-0.5" aria-hidden />
									</Button>
								) : (
									<Button
										size="sm"
										onClick={() => setIsHelpOpen(false)}
										aria-label="Close help"
										className="text-white"
										style={{
											background: "var(--dashboard-accent)",
											borderColor: "var(--dashboard-accent)",
										}}
									>
										Got it
									</Button>
								)}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* ── Form ── */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="flex flex-col gap-4">
					{/* ── Report Type Selector ── */}
					<Card className="dashboard-card">
						<CardHeader className="pb-3">
							<CardTitle
								id="report-type-label"
								className="text-base font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Available Reports
							</CardTitle>
							<CardDescription className="text-xs mt-0.5">
								Select a report type to generate
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form.Field name="selectedReport">
								{(field) => (
									<Field
										className="grid grid-cols-2 gap-3"
										role="group"
										aria-labelledby="report-type-label"
									>
										{reportTypes.map((report) => {
											const Icon = report.icon;
											const isSelected = field.state.value === report.value;
											return (
												<Field key={report.value}>
													<button
														id={report.value}
														name={report.value}
														type="button"
														onBlur={field.handleBlur}
														onClick={() => field.handleChange(report.value)}
														aria-pressed={isSelected}
														aria-label={`Select ${report.label}`}
														disabled={isGenerating}
														className="report-type-btn group relative flex w-full flex-col gap-3 rounded-xl border px-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-border bg-background text-muted-foreground"
													>
														{/* Index label */}
														<span
															className="text-[10px] font-mono font-semibold tracking-wider opacity-40 leading-none"
															aria-hidden
														>
															{report.index}
														</span>
														{/* Icon box */}
														<span className="report-icon-box flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors">
															<Icon className="h-5 w-5" aria-hidden />
														</span>
														{/* Label */}
														<span className="text-xs font-semibold leading-tight">
															{report.label}
														</span>
													</button>
												</Field>
											);
										})}
									</Field>
								)}
							</form.Field>
						</CardContent>
					</Card>

					{/* ── Report Configuration ── */}
					<Card className="dashboard-card">
						<CardHeader className="pb-3">
							<CardTitle
								className="text-base font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Report Configuration
							</CardTitle>
							<CardDescription className="text-xs mt-0.5">
								Configure parameters and export format
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col gap-4">
								{/* Fields row */}
								<div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] lg:grid-cols-[200px_1fr_160px] gap-4 items-end">
									{/* Region */}
									<form.Field name="regionId">
										{(field) => (
											<div className="space-y-1.5">
												<FieldLabel
													htmlFor="regionId"
													className="text-xs font-medium"
												>
													Region
												</FieldLabel>
												<Select
													value={field.state.value || "all"}
													onValueChange={(v) => {
														field.handleChange(v === "all" ? "" : v);
														field.handleBlur();
													}}
													disabled={isLoadingRegions}
												>
													<SelectTrigger
														id="regionId"
														className="h-9 text-sm"
														aria-label="Select region"
														aria-busy={isLoadingRegions}
													>
														<SelectValue
															placeholder={
																isLoadingRegions
																	? "Loading regions…"
																	: "Select Region"
															}
														/>
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all" disabled>
															Select Region
														</SelectItem>
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

									{/* Date Range */}
									<div
										className="space-y-1.5"
										role="group"
										aria-labelledby="date-range-label"
									>
										<Label
											id="date-range-label"
											className="text-xs font-medium block"
										>
											Date Range
										</Label>
										<div className="flex items-center gap-2">
											<form.Field name="dateFrom">
												{(field) => (
													<Input
														id="dateFrom"
														type="date"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className="h-9 text-sm w-36 flex-shrink-0"
														aria-label="Report date from"
														disabled={isGenerating}
													/>
												)}
											</form.Field>
											<span className="text-xs text-muted-foreground/60 select-none">
												—
											</span>
											<form.Field name="dateTo">
												{(field) => (
													<Input
														id="dateTo"
														type="date"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className="h-9 text-sm w-36 flex-shrink-0"
														aria-label="Report date to"
														disabled={isGenerating}
													/>
												)}
											</form.Field>
										</div>
									</div>

									{/* Format */}
									<form.Field name="format">
										{(field) => (
											<div className="space-y-1.5">
												<FieldLabel
													htmlFor="format"
													className="text-xs font-medium"
												>
													Export Format
												</FieldLabel>
												<Select
													value={field.state.value}
													onValueChange={(v) => {
														field.handleChange(v as ExportFormat);
														field.handleBlur();
													}}
													disabled={isGenerating}
												>
													<SelectTrigger
														id="format"
														className="h-9 text-sm"
														aria-label="Export format (PDF or Excel)"
													>
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
								</div>

								{/* Stock Balance type selector — shown only when StockBalance is selected */}
								<form.Subscribe selector={(state) => state.values.selectedReport}>
									{(selectedReport) =>
										selectedReport === "StockBalance" ? (
											<form.Field name="stockBalanceType">
												{(field) => (
													<div className="space-y-1.5">
														<FieldLabel className="text-xs font-medium">
															Report Variant
														</FieldLabel>
														<Select
															value={field.state.value}
															onValueChange={(v) => {
																field.handleChange(v as InventoryBalanceReportType);
																field.handleBlur();
															}}
															disabled={isGenerating}
														>
															<SelectTrigger className="h-9 text-sm w-56" aria-label="Stock balance report variant">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="WITHOUT_RACK">Without Rack (for principals)</SelectItem>
																<SelectItem value="WITH_RACK">With Rack (internal)</SelectItem>
															</SelectContent>
														</Select>
													</div>
												)}
											</form.Field>
										) : null
									}
								</form.Subscribe>

								{/* Divider */}
								<div className="border-t border-border/60" />

								{/* Submit button row */}
								<form.Subscribe
									selector={(state) => ({
										selectedReport: state.values.selectedReport,
										regionId: state.values.regionId,
										dateFrom: state.values.dateFrom,
										dateTo: state.values.dateTo,
										format: state.values.format,
									})}
								>
									{({ selectedReport, regionId, dateFrom, dateTo, format }) => {
										const needsRegionAndDateRange =
											selectedReport === "Movement" ||
											selectedReport === "InvoiceSummary";
										const missingRequiredRegion =
											format === "PDF" &&
											needsRegionAndDateRange &&
											!regionId?.trim();
										const missingRequiredDateRange =
											format === "PDF" &&
											needsRegionAndDateRange &&
											(!dateFrom?.trim() || !dateTo?.trim());
										const missingRequired =
											missingRequiredRegion || missingRequiredDateRange;

										const selectedMeta = reportTypes.find(
											(r) => r.value === selectedReport,
										);

										return (
											<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
												{/* Status hint */}
												<p className="text-xs text-muted-foreground">
													{!selectedReport ? (
														<span>Select a report type above to continue.</span>
													) : missingRequiredRegion ? (
														<span className="text-amber-600 dark:text-amber-400 font-medium">
															Region required for{" "}
															{selectedMeta?.label ?? "this report"} (PDF).
														</span>
													) : missingRequiredDateRange ? (
														<span className="text-amber-600 dark:text-amber-400 font-medium">
															Date range (From and To) required for{" "}
															{selectedMeta?.label ?? "this report"} (PDF).
														</span>
													) : (
														<span>
															Ready to generate{" "}
															<strong>{selectedMeta?.label}</strong> as{" "}
															<strong>
																{format === "Excel" ? "Excel (XLSX)" : format}
															</strong>
															.
														</span>
													)}
												</p>
												<Button
													type="submit"
													disabled={
														!selectedReport || missingRequired || isGenerating
													}
													className="gap-2 shrink-0 text-white disabled:opacity-50"
													style={{
														background: "var(--dashboard-accent)",
														borderColor: "var(--dashboard-accent)",
													}}
													aria-busy={isGenerating}
													aria-label={
														isGenerating
															? "Generating report"
															: "Generate and download report"
													}
												>
													<Download className="h-4 w-4" aria-hidden />
													{isGenerating ? "Generating…" : "Generate & Download"}
												</Button>
											</div>
										);
									}}
								</form.Subscribe>
							</div>
						</CardContent>
					</Card>
				</FieldGroup>
			</form>
		</main>
	);
}
