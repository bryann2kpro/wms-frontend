import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Search,
	Eye,
	ChevronRight,
	FileText,
	FileSpreadsheet,
	Receipt,
	Printer,
	FolderOpen,
	Folder,
	Loader2,
	Download,
	FileArchive,
	Files,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
	endOfISOWeek,
	format,
	getISOWeek,
	getISOWeekYear,
	startOfISOWeek,
} from "date-fns";
import { useBulkProformaPdf } from "@/hooks/useBulkProformaPdf";
import {
	INVOICES_QUERY,
	type InvoicesQueryData,
	type InvoicesQueryVariables,
	type InvoiceStatusFilter,
	gqlStatusToUI,
	uiStatusToGql,
	GENERATE_PROFORMA_INVOICE_PDF_MUTATION,
	type GenerateProformaInvoicePdfData,
	type GenerateProformaInvoicePdfVariables,
} from "@/lib/graphql/invoices";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadPdfFromBase64 } from "@/lib/reports/report-pdf";
import { AdminPageHeader } from "@/components/admin-page-header";
import { formatCurrency, formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/admin/invoices")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Invoice"]);
	},
	component: InvoicesComponent,
	head: () => ({
		meta: [
			{
				title: "Invoices - SME Edaran WMS",
				description:
					"Review and manage proforma invoices, statuses, and billing details across outlets.",
			},
		],
	}),
});

const invoiceStatuses: InvoiceStatusFilter[] = [
	"ALL",
	"Issued",
	"Sent",
	"Cancelled",
];

function InvoicesComponent() {
	const navigate = useNavigate();
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("ALL");
	const [summaryMode, setSummaryMode] = useState<"Monthly" | "Weekly">(
		"Monthly",
	);
	const [summaryDateFrom, setSummaryDateFrom] = useState("");
	const [summaryDateTo, setSummaryDateTo] = useState("");
	const [issuedFrom, setIssuedFrom] = useState("");
	const [issuedTo, setIssuedTo] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		new Set(),
	);
	const { state: bulkPdfState, startBulkExport } = useBulkProformaPdf();
	const isGenerating = bulkPdfState.status === "generating";
	const [generatingGroupKey, setGeneratingGroupKey] = useState<string | null>(
		null,
	);

	const fetchAllInvoices = (variables: InvoicesQueryVariables) =>
		gqlRequest<InvoicesQueryData, InvoicesQueryVariables>(
			INVOICES_QUERY,
			variables,
		);
	const [isDownloadingAll, setIsDownloadingAll] = useState(false);
	const [isDownloadingAllIndividual, setIsDownloadingAllIndividual] = useState(false);
	const [isDownloadingSelectedIndividual, setIsDownloadingSelectedIndividual] = useState(false);

	const { mutateAsync: generateSinglePdf } = useMutation({
		mutationFn: (vars: GenerateProformaInvoicePdfVariables) =>
			gqlRequest<
				GenerateProformaInvoicePdfData,
				GenerateProformaInvoicePdfVariables
			>(GENERATE_PROFORMA_INVOICE_PDF_MUTATION, vars),
	});

	// Build the current active filter (shared between main query and download-all)
	const activeFilter = useMemo(() => ({
		...(debouncedSearch ? { search: debouncedSearch } : {}),
		...(() => {
			const gqlStatus = uiStatusToGql(statusFilter);
			if (!gqlStatus || statusFilter === "ALL") return {};
			return Array.isArray(gqlStatus)
				? { statuses: gqlStatus }
				: { status: gqlStatus };
		})(),
		...(issuedFrom ? { dateIssuedFrom: issuedFrom } : {}),
		...(issuedTo ? { dateIssuedTo: issuedTo } : {}),
	}), [debouncedSearch, statusFilter, issuedFrom, issuedTo]);

	async function generateAllForGroup(key: string) {
		if (isGenerating || generatingGroupKey) return;
		setGeneratingGroupKey(key);
		try {
			const result = await fetchAllInvoices({
				filter:
					key === "__none__"
						? {} // can't filter by null delivery date; fall back to visible IDs
						: { deliveryDateFrom: key, deliveryDateTo: key },
				pageSize: 500,
				pageNumber: 1,
			});
			const ids =
				key === "__none__"
					? groupedInvoices[key].map((inv) => inv.id)
					: (result?.invoices.query ?? []).map((inv) => inv.id);
			if (ids.length > 0) await startBulkExport(ids);
		} finally {
			setGeneratingGroupKey(null);
		}
	}

	async function downloadAllFiltered() {
		if (isGenerating || isDownloadingAll) return;
		setIsDownloadingAll(true);
		try {
			const result = await fetchAllInvoices({
				filter: activeFilter,
				pageSize: 500,
				pageNumber: 1,
			});
			const ids = (result?.invoices.query ?? []).map((inv) => inv.id);
			if (ids.length > 0) await startBulkExport(ids);
		} finally {
			setIsDownloadingAll(false);
		}
	}

	async function downloadIndividually(ids: string[]) {
		if (ids.length === 0) return;
		let successCount = 0;
		let failCount = 0;
		for (const invoiceId of ids) {
			try {
				const res = await generateSinglePdf({ invoiceId });
				const pdf = res?.generateProformaInvoicePdf;
				if (pdf) downloadPdfFromBase64(pdf.pdfBase64, pdf.filename);
				successCount++;
			} catch {
				failCount++;
			}
		}
		if (failCount > 0) {
			toast.warning(`Downloaded ${successCount} PDF(s). ${failCount} failed.`);
		} else {
			toast.success(`${successCount} Proforma PDF(s) downloaded`);
		}
	}

	async function downloadAllFilteredIndividually() {
		if (isGenerating || isDownloadingAllIndividual) return;
		setIsDownloadingAllIndividual(true);
		try {
			const result = await fetchAllInvoices({
				filter: activeFilter,
				pageSize: 500,
				pageNumber: 1,
			});
			const ids = (result?.invoices.query ?? []).map((inv) => inv.id);
			await downloadIndividually(ids);
		} finally {
			setIsDownloadingAllIndividual(false);
		}
	}

	async function downloadSelectedIndividually() {
		if (isGenerating || isDownloadingSelectedIndividual) return;
		setIsDownloadingSelectedIndividual(true);
		try {
			await downloadIndividually(Array.from(selectedIds));
		} finally {
			setIsDownloadingSelectedIndividual(false);
		}
	}

	useEffect(() => {
		const handle = setTimeout(() => {
			setDebouncedSearch(searchTerm.trim());
		}, 300);
		return () => clearTimeout(handle);
	}, [searchTerm]);

	// Clear selection whenever filters change
	useEffect(() => {
		setSelectedIds(new Set());
	}, [debouncedSearch, statusFilter, issuedFrom, issuedTo]);

	const invoicesVars: InvoicesQueryVariables = {
		filter: activeFilter,
		pageSize: 500,
		pageNumber: 1,
	};
	const { data, isLoading: loading } = useQuery({
		queryKey: qk.invoices.list(invoicesVars),
		queryFn: () =>
			gqlRequest<InvoicesQueryData, InvoicesQueryVariables>(
				INVOICES_QUERY,
				invoicesVars,
			),
	});

	const invoices = (data?.invoices.query ?? []).map((inv) => ({
		...inv,
		status: gqlStatusToUI(inv.status),
		issuedDate: inv.dateIssued ? new Date(inv.dateIssued) : null,
		deliveryDate: inv.deliveryDate ? new Date(inv.deliveryDate) : null,
		invoiceNumber: inv.invoiceNo,
		doNumber: inv.doNo,
		toNumber: inv.poNo,
		totalAmount: parseFloat(inv.poAmount ?? "0") || 0,
		sstRate:
			typeof inv.poAmountCalcSnapshot === "object" &&
			inv.poAmountCalcSnapshot &&
			"sstRate" in inv.poAmountCalcSnapshot
				? Number(inv.poAmountCalcSnapshot.sstRate)
				: null,
	}));

	// Group by delivery date
	const groupedInvoices = useMemo(() => {
		const groups: Record<string, typeof invoices> = {};
		for (const inv of invoices) {
			const key = inv.deliveryDate
				? inv.deliveryDate.toISOString().slice(0, 10)
				: "__none__";
			(groups[key] ??= []).push(inv);
		}
		return groups;
	}, [invoices]);

	const groupKeys = useMemo(
		() =>
			Object.keys(groupedInvoices).sort((a, b) =>
				a === "__none__" ? 1 : b === "__none__" ? -1 : a.localeCompare(b),
			),
		[groupedInvoices],
	);

	const summary = data?.invoices.summary;
	const pagination = data?.invoices.pagination;

	// Bulk-select helpers
	const allIds = invoices.map((inv) => inv.id);
	const allSelected =
		allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
	const someSelected = allIds.some((id) => selectedIds.has(id));

	function toggleAll() {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(allIds));
		}
	}

	function toggleOne(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleGroup(key: string) {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	function toggleGroupSelect(key: string) {
		const groupIds = groupedInvoices[key].map((inv) => inv.id);
		const allGroupSelected = groupIds.every((id) => selectedIds.has(id));
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (allGroupSelected) {
				for (const id of groupIds) next.delete(id);
			} else {
				for (const id of groupIds) next.add(id);
			}
			return next;
		});
	}

	function getGroupTotal(key: string) {
		return (groupedInvoices[key] ?? []).reduce(
			(sum, inv) => sum + inv.totalAmount,
			0,
		);
	}

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			Issued: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			Sent: "bg-green-500/10 text-green-600 border-green-500/20",
			Cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	// Derive which delivery-date groups the current selection spans
	const selectedGroupLabels = useMemo(() => {
		if (selectedIds.size === 0) return [];
		const labels: string[] = [];
		for (const key of groupKeys) {
			const groupIds = groupedInvoices[key].map((inv) => inv.id);
			const count = groupIds.filter((id) => selectedIds.has(id)).length;
			if (count > 0) {
				const label =
					key === "__none__"
						? "No Delivery Date"
						: formatDateOnly(new Date(key));
				labels.push(`${label} (${count})`);
			}
		}
		return labels;
	}, [selectedIds, groupKeys, groupedInvoices]);

	const summaryFilteredInvoices = useMemo(() => {
		const fromDate = summaryDateFrom ? new Date(`${summaryDateFrom}T00:00:00`) : null;
		const toDate = summaryDateTo ? new Date(`${summaryDateTo}T23:59:59`) : null;

		return invoices.filter((inv) => {
			if (!fromDate && !toDate) return true;
			if (!inv.issuedDate) return false;
			if (fromDate && inv.issuedDate < fromDate) return false;
			if (toDate && inv.issuedDate > toDate) return false;
			return true;
		});
	}, [invoices, summaryDateFrom, summaryDateTo]);

	const billingPeriods = useMemo(() => {
		type PeriodSummary = {
			label: string;
			sortValue: number;
			count: number;
			totalExcl: number;
			taxAmount: number;
			totalIncl: number;
			issued: number;
			sent: number;
			cancelled: number;
		};

		const groups = new Map<string, PeriodSummary>();
		const noDateKey = "__none__";

		for (const inv of summaryFilteredInvoices) {
			const invoiceExcl = parseFloat(inv.totalExclTax ?? "0") || 0;
			const invoiceTax = parseFloat(inv.taxAmount ?? "0") || 0;
			const invoiceIncl = parseFloat(inv.totalInclTax ?? "0") || 0;

			const key = (() => {
				if (!inv.issuedDate) return noDateKey;
				if (summaryMode === "Monthly") return format(inv.issuedDate, "yyyy-MM");
				return `${getISOWeekYear(inv.issuedDate)}-W${String(
					getISOWeek(inv.issuedDate),
				).padStart(2, "0")}`;
			})();

			const label = (() => {
				if (!inv.issuedDate) return "No Issued Date";
				if (summaryMode === "Monthly") return format(inv.issuedDate, "MMMM yyyy");
				const weekStart = startOfISOWeek(inv.issuedDate);
				const weekEnd = endOfISOWeek(inv.issuedDate);
				return `${format(weekStart, "dd MMM")} to ${format(weekEnd, "dd MMM")}`;
			})();

			const sortValue = inv.issuedDate?.getTime() ?? Number.NEGATIVE_INFINITY;
			if (!groups.has(key)) {
				groups.set(key, {
					label,
					sortValue,
					count: 0,
					totalExcl: 0,
					taxAmount: 0,
					totalIncl: 0,
					issued: 0,
					sent: 0,
					cancelled: 0,
				});
			}

			const period = groups.get(key);
			if (!period) continue;

			period.count += 1;
			period.totalExcl += invoiceExcl;
			period.taxAmount += invoiceTax;
			period.totalIncl += invoiceIncl;
			if (inv.status === "Issued") period.issued += 1;
			if (inv.status === "Sent") period.sent += 1;
			if (inv.status === "Cancelled") period.cancelled += 1;
			if (sortValue > period.sortValue) period.sortValue = sortValue;
		}

		return [...groups.entries()].sort(([leftKey, left], [rightKey, right]) => {
			if (leftKey === noDateKey) return 1;
			if (rightKey === noDateKey) return -1;
			return right.sortValue - left.sortValue;
		});
	}, [summaryFilteredInvoices, summaryMode]);

	const billingTotals = useMemo(
		() =>
			billingPeriods.reduce(
				(acc, [, period]) => ({
					count: acc.count + period.count,
					totalExcl: acc.totalExcl + period.totalExcl,
					taxAmount: acc.taxAmount + period.taxAmount,
					totalIncl: acc.totalIncl + period.totalIncl,
					issued: acc.issued + period.issued,
					sent: acc.sent + period.sent,
					cancelled: acc.cancelled + period.cancelled,
				}),
				{
					count: 0,
					totalExcl: 0,
					taxAmount: 0,
					totalIncl: 0,
					issued: 0,
					sent: 0,
					cancelled: 0,
				},
			),
		[billingPeriods],
	);

	function exportBillingToExcel() {
		const workbook = XLSX.utils.book_new();
		const summaryRows = [
			[
				"Period",
				"# Invoices",
				"Subtotal (excl. SST)",
				"SST",
				"Total (incl. SST)",
				"Issued",
				"Sent",
				"Cancelled",
			],
			...billingPeriods.map(([, period]) => [
				period.label,
				period.count,
				Number(period.totalExcl.toFixed(2)),
				Number(period.taxAmount.toFixed(2)),
				Number(period.totalIncl.toFixed(2)),
				period.issued,
				period.sent,
				period.cancelled,
			]),
			[
				"TOTAL",
				billingTotals.count,
				Number(billingTotals.totalExcl.toFixed(2)),
				Number(billingTotals.taxAmount.toFixed(2)),
				Number(billingTotals.totalIncl.toFixed(2)),
				billingTotals.issued,
				billingTotals.sent,
				billingTotals.cancelled,
			],
		];
		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet(summaryRows),
			"Billing Summary",
		);

		const detailRows = [
			[
				"No.",
				"Invoice No",
				"PO No",
				"DO No",
				"Qty",
				"Unit",
				"Subtotal (excl. SST)",
				"SST",
				"Total (incl. SST)",
				"Amount",
				"SST Rate",
				"Issued Date",
				"Delivery Date",
				"Status",
			],
			...summaryFilteredInvoices.map((inv, index) => {
				const snapshot =
					typeof inv.poAmountCalcSnapshot === "object" && inv.poAmountCalcSnapshot
						? (inv.poAmountCalcSnapshot as Record<string, unknown>)
						: null;
				const qty =
					Number(snapshot?.totalQty ?? snapshot?.effectiveQty ?? snapshot?.qty ?? 0) ||
					0;
				const subtotal = Number((parseFloat(inv.totalExclTax ?? "0") || 0).toFixed(2));
				const sst = Number((parseFloat(inv.taxAmount ?? "0") || 0).toFixed(2));
				const totalIncl = Number((parseFloat(inv.totalInclTax ?? "0") || 0).toFixed(2));

				return [
					index + 1,
					inv.invoiceNumber ?? "",
					inv.toNumber ?? "",
					inv.doNumber ?? "",
					qty,
					"CTN",
					subtotal,
					sst,
					totalIncl,
					totalIncl,
					`${Math.round(((inv.sstRate ?? 0.06) as number) * 100)}%`,
					inv.issuedDate ? formatDateOnly(inv.issuedDate) : "",
					inv.deliveryDate ? formatDateOnly(inv.deliveryDate) : "",
					inv.status,
				];
			}),
			[
				"",
				"TOTAL",
				"",
				"",
				summaryFilteredInvoices.reduce((sum, inv) => {
					const snapshot =
						typeof inv.poAmountCalcSnapshot === "object" && inv.poAmountCalcSnapshot
							? (inv.poAmountCalcSnapshot as Record<string, unknown>)
							: null;
					const qty =
						Number(
							snapshot?.totalQty ?? snapshot?.effectiveQty ?? snapshot?.qty ?? 0,
						) || 0;
					return sum + qty;
				}, 0),
				"CTN",
				Number(
					summaryFilteredInvoices
						.reduce((sum, inv) => sum + (parseFloat(inv.totalExclTax ?? "0") || 0), 0)
						.toFixed(2),
				),
				Number(
					summaryFilteredInvoices
						.reduce((sum, inv) => sum + (parseFloat(inv.taxAmount ?? "0") || 0), 0)
						.toFixed(2),
				),
				Number(
					summaryFilteredInvoices
						.reduce((sum, inv) => sum + (parseFloat(inv.totalInclTax ?? "0") || 0), 0)
						.toFixed(2),
				),
				Number(
					summaryFilteredInvoices
						.reduce((sum, inv) => sum + (parseFloat(inv.totalInclTax ?? "0") || 0), 0)
						.toFixed(2),
				),
				"",
				"",
				"",
				"",
			],
		];
		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet(detailRows),
			"Invoice Details",
		);

		XLSX.writeFile(
			workbook,
			`Billing_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`,
		);
	}

	return (
		<main
			className="invoices-page container mx-auto p-6 space-y-6"
			aria-labelledby="invoices-page-title"
			aria-describedby="invoices-page-description"
			aria-busy={loading}
		>
			<AdminPageHeader
				icon={Receipt}
				title="Proforma Invoices"
				description="Manage and export proforma invoices for all outlets."
				titleId="invoices-page-title"
				descriptionId="invoices-page-description"
			/>

			{summary && (
				<div className="grid gap-4 md:grid-cols-4">
					{/* Issued */}
					<Card className="dashboard-card relative overflow-hidden">
						<div className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-blue-500" />
						<CardHeader className="pb-2 pl-5">
							<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Issued
							</CardTitle>
						</CardHeader>
						<CardContent className="pl-5">
							<div
								className="text-2xl font-bold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{summary.issued ?? 0}
							</div>
							<p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">
								Pending delivery
							</p>
						</CardContent>
					</Card>

					{/* Sent */}
					<Card className="dashboard-card relative overflow-hidden">
						<div className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-emerald-500" />
						<CardHeader className="pb-2 pl-5">
							<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Sent
							</CardTitle>
						</CardHeader>
						<CardContent className="pl-5">
							<div
								className="text-2xl font-bold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{summary.sent ?? 0}
							</div>
							<p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
								Delivered to outlet
							</p>
						</CardContent>
					</Card>

					{/* Cancelled */}
					<Card className="dashboard-card relative overflow-hidden">
						<div className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-red-500" />
						<CardHeader className="pb-2 pl-5">
							<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Cancelled
							</CardTitle>
						</CardHeader>
						<CardContent className="pl-5">
							<div
								className="text-2xl font-bold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{summary.cancelled ?? 0}
							</div>
							<p className="mt-0.5 text-xs text-red-500 dark:text-red-400">
								Voided invoices
							</p>
						</CardContent>
					</Card>

					{/* Total Value */}
					<Card className="dashboard-card relative overflow-hidden border-[color-mix(in_oklch,var(--dashboard-accent)_30%,transparent)]">
						<div
							className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
							style={{ background: "var(--dashboard-accent)" }}
						/>
						<CardHeader className="pb-2 pl-5">
							<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Total Value
							</CardTitle>
						</CardHeader>
						<CardContent className="pl-5">
							<div
								className="text-2xl font-bold"
								style={{
									fontFamily: "var(--dashboard-display)",
									color: "var(--dashboard-accent)",
								}}
							>
								{formatCurrency(parseFloat(summary.totalAmount ?? "0"))}
							</div>
							<p className="mt-0.5 text-xs text-muted-foreground">
								All active invoices
							</p>
						</CardContent>
					</Card>
				</div>
			)}

			<Card className="dashboard-card" style={{ animationDelay: "160ms" }}>
				<CardHeader className="pb-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div className="space-y-1">
							<CardTitle
								className="text-base font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Billing Summary
							</CardTitle>
							<CardDescription className="text-xs">
								Totals grouped by{" "}
								{summaryMode === "Monthly" ? "calendar month" : "ISO week"} for{" "}
								{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}.
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-1.5">
								{(["Monthly", "Weekly"] as const).map((mode) => (
									<button
										key={mode}
										type="button"
										className={`invoice-status-tab${summaryMode === mode ? " active" : ""}`}
										onClick={() => setSummaryMode(mode)}
									>
										{mode}
									</button>
								))}
							</div>
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<span>Issued:</span>
								<Input
									type="date"
									value={summaryDateFrom}
									onChange={(e) => setSummaryDateFrom(e.target.value)}
									className="h-8 w-32"
								/>
								<span className="text-[10px] text-muted-foreground/80">to</span>
								<Input
									type="date"
									value={summaryDateTo}
									onChange={(e) => setSummaryDateTo(e.target.value)}
									className="h-8 w-32"
								/>
							</div>
							<Button
								size="sm"
								className="h-8 text-xs gap-1.5"
								style={{
									background: "var(--dashboard-accent)",
									borderColor: "var(--dashboard-accent)",
									color: "#fff",
								}}
								disabled={summaryFilteredInvoices.length === 0}
								onClick={exportBillingToExcel}
							>
								<FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
								Export Excel
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Period
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										# Inv
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Subtotal (excl. SST)
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										SST
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Total (incl. SST)
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Issued
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Sent
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Cancelled
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{billingPeriods.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-20 text-center text-sm text-muted-foreground"
										>
											No billing data available for current filters.
										</TableCell>
									</TableRow>
								) : (
									<>
										{billingPeriods.map(([key, period]) => (
											<TableRow key={key}>
												<TableCell className="font-medium">
													<span
														className="inline-block rounded-sm border-l-[3px] px-2 py-0.5"
														style={{
															borderLeftColor: "var(--dashboard-accent)",
															fontFamily: "var(--dashboard-display)",
														}}
													>
														{period.label}
													</span>
												</TableCell>
												<TableCell className="tabular-nums">{period.count}</TableCell>
												<TableCell
													className="tabular-nums"
													style={{ fontFamily: "var(--dashboard-display)" }}
												>
													{formatCurrency(period.totalExcl)}
												</TableCell>
												<TableCell className="tabular-nums">
													{formatCurrency(period.taxAmount)}
												</TableCell>
												<TableCell
													className="tabular-nums font-semibold"
													style={{
														fontFamily: "var(--dashboard-display)",
														color: "var(--dashboard-accent)",
													}}
												>
													{formatCurrency(period.totalIncl)}
												</TableCell>
												<TableCell className="tabular-nums">{period.issued}</TableCell>
												<TableCell className="tabular-nums">{period.sent}</TableCell>
												<TableCell className="tabular-nums">{period.cancelled}</TableCell>
											</TableRow>
										))}
										<TableRow className="bg-muted/30">
											<TableCell
												className="font-semibold"
												style={{ fontFamily: "var(--dashboard-display)" }}
											>
												TOTAL
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{billingTotals.count}
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{formatCurrency(billingTotals.totalExcl)}
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{formatCurrency(billingTotals.taxAmount)}
											</TableCell>
											<TableCell
												className="font-semibold tabular-nums"
												style={{ color: "var(--dashboard-accent)" }}
											>
												{formatCurrency(billingTotals.totalIncl)}
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{billingTotals.issued}
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{billingTotals.sent}
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{billingTotals.cancelled}
											</TableCell>
										</TableRow>
									</>
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<Card className="dashboard-card">
				<CardHeader className="pb-4">
					<div className="flex flex-col gap-4">
						{/* Top row: title + search */}
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<CardTitle
									className="text-base font-semibold"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Proforma Invoices
								</CardTitle>
								<CardDescription className="text-xs mt-0.5">
									{pagination
										? `${pagination.totalCount} invoice${pagination.totalCount !== 1 ? "s" : ""} total`
										: "View and manage all proforma invoices"}
								</CardDescription>
							</div>
							<div className="flex items-center gap-2">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="Search by invoice, DO…"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="pl-8 h-8 text-sm sm:w-72"
									/>
								</div>
								{isDownloadingAll || isDownloadingAllIndividual || (isGenerating && !generatingGroupKey && selectedIds.size === 0) ? (
									<Button
										size="sm"
										className="h-8 text-xs gap-1.5 shrink-0"
										style={{
											background: "var(--dashboard-accent)",
											borderColor: "var(--dashboard-accent)",
											color: "#fff",
										}}
										disabled
									>
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
										Generating…
									</Button>
								) : (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												size="sm"
												className="h-8 text-xs gap-1.5 shrink-0"
												style={{
													background: "var(--dashboard-accent)",
													borderColor: "var(--dashboard-accent)",
													color: "#fff",
												}}
												disabled={!pagination?.totalCount}
											>
												<Download className="h-3.5 w-3.5" aria-hidden />
												Download All{pagination ? ` (${pagination.totalCount})` : ""}
												<ChevronRight className="h-3 w-3 opacity-80 rotate-90" aria-hidden />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => void downloadAllFiltered()}>
												<FileArchive className="mr-2 h-4 w-4" aria-hidden />
												Download as ZIP
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => void downloadAllFilteredIndividually()}>
												<Files className="mr-2 h-4 w-4" aria-hidden />
												Download individually
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						</div>
						{/* Status pill tabs + issued date filter */}
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div className="flex items-center gap-1.5 flex-wrap">
								{invoiceStatuses.map((status) => (
									<button
										key={status}
										type="button"
										className={`invoice-status-tab${statusFilter === status ? " active" : ""}`}
										onClick={() => setStatusFilter(status)}
									>
										{status === "ALL" ? "All" : status}
									</button>
								))}
							</div>
							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<span>Issued date:</span>
								<Input
									type="date"
									value={issuedFrom}
									onChange={(e) => setIssuedFrom(e.target.value)}
									className="h-8 w-32"
								/>
								<span className="text-[10px] text-muted-foreground/80">to</span>
								<Input
									type="date"
									value={issuedTo}
									onChange={(e) => setIssuedTo(e.target.value)}
									className="h-8 w-32"
								/>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative pt-0">
					<GlobalLoadingShadow />

					{/* Bulk action bar — now rendered as sticky bottom bar below */}

					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="w-10">
										<Checkbox
											checked={
												allSelected
													? true
													: someSelected
														? "indeterminate"
														: false
											}
											onCheckedChange={toggleAll}
											aria-label="Select all invoices on this page"
											disabled={invoices.length === 0}
										/>
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Invoice #
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										DO #
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										PO #
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Amount
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Issued
									</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Status
									</TableHead>
									<TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && invoices.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground text-sm"
										>
											Loading invoices…
										</TableCell>
									</TableRow>
								) : invoices.length === 0 ? (
									<TableRow>
										<TableCell colSpan={8} className="h-32 text-center">
											<div className="flex flex-col items-center gap-2 text-muted-foreground">
												<FileText className="h-8 w-8 opacity-30" />
												<p className="text-sm font-medium">No invoices found</p>
												<p className="text-xs">
													Try adjusting your search or filter
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									groupKeys.map((key) => {
										const isCollapsed = collapsedGroups.has(key);
										const groupRows = groupedInvoices[key];
										const groupIds = groupRows.map((inv) => inv.id);
										const allGroupSelected =
											groupIds.length > 0 &&
											groupIds.every((id) => selectedIds.has(id));
										const someGroupSelected = groupIds.some((id) =>
											selectedIds.has(id),
										);
										const label =
											key === "__none__"
												? "No Delivery Date"
												: `Delivery  ${formatDateOnly(new Date(key))}`;

										return (
											<>
												{/* ── Folder header row ── */}
												<TableRow
													key={`group-${key}`}
													className="border-t-0 hover:bg-transparent"
												>
													<TableCell colSpan={8} className="py-1.5 px-2">
														<div
															className="group/folder flex items-center gap-2.5 rounded-md cursor-pointer select-none transition-colors"
															style={{
																background:
																	"color-mix(in oklch, var(--muted) 60%, transparent)",
																borderLeft: "3px solid var(--dashboard-accent)",
																padding: "7px 12px 7px 10px",
															}}
															onClick={() => toggleGroup(key)}
															role="button"
															aria-expanded={!isCollapsed}
															aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${label}`}
														>
															{/* Group checkbox — stops propagation so click doesn't toggle collapse */}
															<span onClick={(e) => e.stopPropagation()}>
																<Checkbox
																	checked={
																		allGroupSelected
																			? true
																			: someGroupSelected
																				? "indeterminate"
																				: false
																	}
																	onCheckedChange={() => toggleGroupSelect(key)}
																	aria-label={`Select all invoices in ${label}`}
																/>
															</span>

															{/* Folder icon — swaps on open/close */}
															{isCollapsed ? (
																<Folder
																	className="h-3.5 w-3.5 shrink-0"
																	style={{ color: "var(--dashboard-accent)" }}
																	aria-hidden
																/>
															) : (
																<FolderOpen
																	className="h-3.5 w-3.5 shrink-0"
																	style={{ color: "var(--dashboard-accent)" }}
																	aria-hidden
																/>
															)}

															{/* Date label */}
															<span
																className="text-sm font-semibold tracking-tight"
																style={{
																	fontFamily: "var(--dashboard-display)",
																}}
															>
																{label}
															</span>

															<div className="flex-1" />

															{/* Stats */}
															<span className="text-[11px] text-muted-foreground tabular-nums">
																{groupRows.length} invoice
																{groupRows.length !== 1 ? "s" : ""}
															</span>
															<span className="mx-1.5 text-muted-foreground/30 text-xs">
																·
															</span>
															<span
																className="text-[11px] font-semibold tabular-nums"
																style={{ color: "var(--dashboard-accent)" }}
															>
																{formatCurrency(getGroupTotal(key))}
															</span>

															{/* Generate all for this day */}
															<span onClick={(e) => e.stopPropagation()}>
																<Button
																	size="sm"
																	className="h-6 text-[11px] gap-1 px-2 ml-2"
																	style={{
																		background: "var(--dashboard-accent)",
																		borderColor: "var(--dashboard-accent)",
																		color: "#fff",
																	}}
																	disabled={
																		isGenerating || generatingGroupKey !== null
																	}
																	onClick={() => void generateAllForGroup(key)}
																	aria-label={`Generate all invoices for ${label}`}
																>
																	{generatingGroupKey === key ? (
																		<Loader2
																			className="h-3 w-3 animate-spin"
																			aria-hidden
																		/>
																	) : (
																		<Printer className="h-3 w-3" aria-hidden />
																	)}
																	Generate All
																</Button>
															</span>

															{/* Chevron */}
															<ChevronRight
																className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ml-1"
																style={{
																	transform: isCollapsed
																		? "rotate(0deg)"
																		: "rotate(90deg)",
																}}
																aria-hidden
															/>
														</div>
													</TableCell>
												</TableRow>

												{/* ── Invoice rows (hidden when collapsed) ── */}
												{!isCollapsed &&
													groupRows.map((invoice) => (
														<TableRow
															key={invoice.id}
															className="invoice-row border-l-0"
															data-state={
																selectedIds.has(invoice.id)
																	? "selected"
																	: undefined
															}
															onClick={() =>
																navigate({
																	to: "/admin/invoice-detail",
																	search: { id: invoice.id },
																})
															}
														>
															<TableCell onClick={(e) => e.stopPropagation()}>
																<Checkbox
																	checked={selectedIds.has(invoice.id)}
																	onCheckedChange={() => toggleOne(invoice.id)}
																	aria-label={`Select invoice ${invoice.invoiceNumber}`}
																/>
															</TableCell>
															<TableCell
																className="font-semibold text-sm pl-8"
																style={{
																	fontFamily: "var(--dashboard-display)",
																}}
															>
																{invoice.invoiceNumber}
															</TableCell>
															<TableCell className="text-sm text-muted-foreground">
																{invoice.doNumber ?? "—"}
															</TableCell>
															<TableCell className="text-sm text-muted-foreground">
																{invoice.toNumber ?? "—"}
															</TableCell>
															<TableCell
																className="text-sm font-semibold"
																style={{
																	fontFamily: "var(--dashboard-display)",
																}}
															>
																{formatCurrency(invoice.totalAmount)}
																<div className="text-[11px] font-normal text-muted-foreground">
																	{`${Math.round(((invoice.sstRate ?? 0.06) as number) * 100)}% SST included`}
																</div>
															</TableCell>
															<TableCell className="text-sm text-muted-foreground">
																{invoice.issuedDate
																	? formatDateOnly(invoice.issuedDate)
																	: "—"}
															</TableCell>
															<TableCell>
																<Badge
																	variant="outline"
																	className={getStatusColor(invoice.status)}
																>
																	{invoice.status}
																</Badge>
															</TableCell>
															<TableCell
																className="text-right"
																onClick={(e) => e.stopPropagation()}
															>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 opacity-60 hover:opacity-100"
																	onClick={() =>
																		navigate({
																			to: "/admin/invoice-detail",
																			search: { id: invoice.id },
																		})
																	}
																>
																	<Eye className="h-3.5 w-3.5" />
																</Button>
															</TableCell>
														</TableRow>
													))}
											</>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>

					{invoices.length > 0 && (
						<p className="mt-4 text-xs text-muted-foreground">
							Showing{" "}
							<span className="font-medium text-foreground">
								{invoices.length}
							</span>{" "}
							invoice{invoices.length !== 1 ? "s" : ""} across{" "}
							<span className="font-medium text-foreground">
								{groupKeys.length}
							</span>{" "}
							delivery date{groupKeys.length !== 1 ? "s" : ""}
						</p>
					)}
				</CardContent>
			</Card>

			{/* ── Sticky bulk-action bar ── */}
			{selectedIds.size > 0 && (
				<div
					className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
					role="status"
					aria-live="polite"
				>
					<div className="container mx-auto flex items-center justify-between gap-4 px-6 py-3">
						<div className="flex flex-col gap-0.5 min-w-0">
							<span className="text-sm">
								<span className="font-semibold text-foreground">
									{selectedIds.size}
								</span>{" "}
								<span className="text-muted-foreground">
									invoice{selectedIds.size !== 1 ? "s" : ""} selected
								</span>
							</span>
							{selectedGroupLabels.length > 0 && (
								<span className="text-xs text-muted-foreground truncate">
									From: {selectedGroupLabels.join(", ")}
								</span>
							)}
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<Button
								variant="outline"
								size="sm"
								className="h-8 text-xs"
								onClick={() => setSelectedIds(new Set())}
							>
								Clear selection
							</Button>
							{isGenerating || isDownloadingSelectedIndividual ? (
								<Button
									size="sm"
									className="h-8 text-xs gap-1.5"
									style={{
										background: "var(--dashboard-accent)",
										borderColor: "var(--dashboard-accent)",
										color: "#fff",
									}}
									disabled
								>
									<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
									{isGenerating
										? `Generating ${bulkPdfState.progress}/${bulkPdfState.total}…`
										: "Downloading…"}
								</Button>
							) : (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											size="sm"
											className="h-8 text-xs gap-1.5"
											style={{
												background: "var(--dashboard-accent)",
												borderColor: "var(--dashboard-accent)",
												color: "#fff",
											}}
										>
											<Download className="h-3.5 w-3.5" aria-hidden />
											Download {selectedIds.size} PDF{selectedIds.size !== 1 ? "s" : ""}
											<ChevronRight className="h-3 w-3 opacity-80 rotate-90" aria-hidden />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => void startBulkExport(Array.from(selectedIds))}>
											<FileArchive className="mr-2 h-4 w-4" aria-hidden />
											Download as ZIP
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={() => void downloadSelectedIndividually()}>
											<Files className="mr-2 h-4 w-4" aria-hidden />
											Download individually
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
