import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { ChevronLeft, Download, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	GENERATE_PROFORMA_INVOICE_PDF_MUTATION,
	type GenerateProformaInvoicePdfData,
	type GenerateProformaInvoicePdfVariables,
	gqlStatusToUI,
	INVOICE_QUERY,
	type InvoiceQueryData,
	type InvoiceQueryVariables,
	UPDATE_INVOICE_STATUS_MUTATION,
	type UpdateInvoiceStatusData,
	type UpdateInvoiceStatusVariables,
} from "@/lib/graphql/invoices";
import { requirePermission } from "@/lib/rbac";
import { downloadPdfFromBase64 } from "@/lib/reports";
import { formatCurrency, formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/admin/invoice-detail")({
	validateSearch: (search: Record<string, unknown>) => ({
		id: (search.id as string) ?? "",
	}),
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Invoice"]);
	},
	component: InvoiceDetailComponent,
	head: () => ({
		meta: [
			{
				title: "Invoice Detail - SME Edaran WMS",
				description:
					"View invoice line items, totals, and document details for a selected proforma invoice.",
			},
		],
	}),
});

function InvoiceDetailComponent() {
	"use no memo";
	const { id } = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data, isLoading: loading, refetch } = useQuery({
		queryKey: [...qk.invoices.all, "detail", id] as const,
		queryFn: () =>
			gqlRequest<InvoiceQueryData, InvoiceQueryVariables>(INVOICE_QUERY, {
				id,
			}),
		enabled: !!id,
	});

	const { mutate: updateStatus, isPending: updating } = useMutation({
		mutationFn: (vars: UpdateInvoiceStatusVariables) =>
			gqlRequest<UpdateInvoiceStatusData, UpdateInvoiceStatusVariables>(
				UPDATE_INVOICE_STATUS_MUTATION,
				vars,
			),
		onSuccess: () => {
			refetch();
			queryClient.invalidateQueries({ queryKey: qk.invoices.all });
		},
	});

	const { mutate: generateProformaPdf, isPending: exportPdfLoading } =
		useMutation({
			mutationFn: (vars: GenerateProformaInvoicePdfVariables) =>
				gqlRequest<
					GenerateProformaInvoicePdfData,
					GenerateProformaInvoicePdfVariables
				>(GENERATE_PROFORMA_INVOICE_PDF_MUTATION, vars),
		});

	const parseSnapshotNumber = (
		snapshot: Record<string, unknown> | null | undefined,
		key: string,
	): number | null => {
		if (!snapshot) return null;
		const value = snapshot[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string") {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}
		return null;
	};

	const raw = data?.invoice;
	const invoice = raw
		? {
				...raw,
				invoiceNumber: raw.invoiceNo,
				doNumber: raw.doNo,
				poNumber: raw.poNo,
				status: gqlStatusToUI(raw.status),
				issuedDate: raw.dateIssued ? new Date(raw.dateIssued) : null,
				totalAmount: parseFloat(raw.poAmount ?? "0") || 0,
				sstRate:
					typeof raw.poAmountCalcSnapshot === "object" &&
					raw.poAmountCalcSnapshot &&
					"sstRate" in raw.poAmountCalcSnapshot
						? Number(raw.poAmountCalcSnapshot.sstRate)
						: null,
				regionRate:
					typeof raw.poAmountCalcSnapshot === "object"
						? parseSnapshotNumber(raw.poAmountCalcSnapshot, "rate")
						: null,
				minQty:
					typeof raw.poAmountCalcSnapshot === "object"
						? parseSnapshotNumber(raw.poAmountCalcSnapshot, "minQty")
						: null,
				subtotal: parseFloat(raw.totalExclTax ?? "0") || 0,
				tax: parseFloat(raw.taxAmount ?? "0") || 0,
				taxRate: parseFloat(raw.taxRate ?? "0") || 0,
				items: (raw.items ?? []).map((item) => ({
					...item,
					skuCode: item.skuCode ?? null,
					quantity: parseFloat(item.qty) || 0,
					unitPrice: parseFloat(item.unitPrice) || 0,
					totalPrice: parseFloat(item.subTotal) || 0,
				})),
			}
		: null;

	const lineItemsTaxRate = invoice?.taxRate || invoice?.sstRate || 0;
	const computedLineItems = invoice
		? invoice.items.map((item) => {
				const hasStoredPricing = item.unitPrice > 0 || item.totalPrice > 0;
				const canFallbackFromRegion =
					(invoice.regionRate ?? 0) > 0 && (invoice.minQty ?? 0) > 0;

				if (hasStoredPricing || !canFallbackFromRegion) {
					return item;
				}

				const rate = invoice.regionRate ?? 0;
				const minQty = invoice.minQty ?? 0;
				const effectiveQty = Math.max(item.quantity, minQty);
				const fallbackSubtotal = effectiveQty * rate;

				return {
					...item,
					unitPrice: rate,
					totalPrice: fallbackSubtotal,
				};
			})
		: [];
	const taxRatePercent = Math.round(lineItemsTaxRate * 100);
	const taxRateLabel = taxRatePercent > 0 ? `Tax (${taxRatePercent}%)` : "Tax";
	const lineItemsSummary = computedLineItems.reduce(
		(acc, item) => {
			const lineTax = item.totalPrice * lineItemsTaxRate;
			acc.subtotal += item.totalPrice;
			acc.tax += lineTax;
			acc.total += item.totalPrice + lineTax;
			return acc;
		},
		{ subtotal: 0, tax: 0, total: 0 },
	);

	if (loading && !invoice) {
		return (
			<main
				className="invoice-detail-page min-h-screen bg-background"
				aria-busy={true}
				aria-labelledby="invoice-detail-page-title"
				aria-describedby="invoice-detail-page-description"
			>
				<div className="container mx-auto p-6 space-y-8">
					{/* Header skeleton */}
					<header className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex items-start gap-4">
							<Skeleton className="h-9 w-9 rounded-lg shrink-0" aria-hidden />
							<div className="space-y-2">
								<div className="flex items-center gap-2.5">
									<Skeleton
										className="h-9 w-9 rounded-lg shrink-0"
										aria-hidden
									/>
									<Skeleton className="h-8 w-56" aria-hidden />
								</div>
								<Skeleton className="ml-[2.875rem] h-4 w-44" aria-hidden />
							</div>
						</div>
						<Skeleton className="h-9 w-24 rounded-md" aria-hidden />
					</header>

					{/* Meta card skeletons */}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
						{Array.from({ length: 5 }).map((_, i) => (
							<Card
								key={i}
								className="border-[var(--invoice-detail-doc-border)]"
								aria-hidden
							>
								<CardHeader className="pb-2 pt-5">
									<Skeleton className="h-3 w-16" />
								</CardHeader>
								<CardContent className="pb-5 pt-0">
									<Skeleton className="h-5 w-24" />
								</CardContent>
							</Card>
						))}
					</div>

					{/* Line items card skeleton */}
					<Card
						className="border-[var(--invoice-detail-doc-border)]"
						aria-hidden
					>
						<CardHeader className="invoice-detail-doc-strip pl-6">
							<div className="flex items-center gap-3">
								<Skeleton className="h-5 w-24" />
								<Skeleton className="h-5 w-14 rounded-full" />
							</div>
							<Skeleton className="h-4 w-40 mt-1" />
						</CardHeader>
						<CardContent className="px-0 sm:px-6 pt-4">
							<div className="overflow-x-auto">
								<div className="flex gap-4 px-4 py-2 border-b border-[var(--invoice-detail-doc-border)]">
									<Skeleton className="h-3 w-4 shrink-0" />
									<Skeleton className="h-3 w-16 shrink-0" />
									<Skeleton className="h-3 w-32 grow" />
									<Skeleton className="h-3 w-8 shrink-0" />
									<Skeleton className="h-3 w-14 shrink-0" />
									<Skeleton className="h-3 w-14 shrink-0" />
									<Skeleton className="h-3 w-14 shrink-0" />
									<Skeleton className="h-3 w-14 shrink-0" />
									<Skeleton className="h-3 w-14 shrink-0" />
									<Skeleton className="h-3 w-14 shrink-0" />
								</div>
								{Array.from({ length: 4 }).map((_, i) => (
									<div
										key={i}
										className="flex gap-4 px-4 py-3 border-b border-[var(--invoice-detail-doc-border)]"
									>
										<Skeleton className="h-4 w-4 shrink-0" />
										<Skeleton className="h-4 w-16 shrink-0" />
										<Skeleton className="h-4 w-40 grow" />
										<Skeleton className="h-4 w-6 shrink-0" />
										<Skeleton className="h-4 w-16 shrink-0" />
										<Skeleton className="h-4 w-14 shrink-0" />
										<Skeleton className="h-4 w-14 shrink-0" />
										<Skeleton className="h-4 w-14 shrink-0" />
										<Skeleton className="h-4 w-14 shrink-0" />
										<Skeleton className="h-4 w-14 shrink-0" />
									</div>
								))}
							</div>
							<div className="mt-6 flex justify-end px-6">
								<div className="w-full max-w-xs space-y-2 rounded-lg bg-muted/50 px-5 py-4">
									{Array.from({ length: 3 }).map((_, i) => (
										<div key={i} className="flex justify-between">
											<Skeleton className="h-4 w-16" />
											<Skeleton className="h-4 w-20" />
										</div>
									))}
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
				<p id="invoice-detail-page-description" className="sr-only">
					Loading invoice…
				</p>
			</main>
		);
	}

	if (!invoice) {
		return (
			<main
				className="invoice-detail-page container mx-auto p-6"
				aria-labelledby="invoice-detail-page-title"
				aria-describedby="invoice-detail-page-description"
				aria-busy={false}
			>
				<div
					className="invoice-detail-doc-strip rounded-lg border bg-card px-6 py-10 text-center"
					style={{ fontFamily: "var(--invoice-detail-body)" }}
				>
					<FileText className="mx-auto h-12 w-12 text-muted-foreground/60" />
					<p className="mt-3 text-sm font-medium text-foreground">
						Invoice not found
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						The invoice may have been removed or the link is invalid.
					</p>
					<Button
						variant="outline"
						className="mt-6"
						onClick={() => navigate({ to: "/admin/invoices" })}
					>
						<ChevronLeft className="mr-2 h-4 w-4" />
						Back to invoices
					</Button>
				</div>
			</main>
		);
	}

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			Issued:
				"bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
			Sent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
			Cancelled:
				"bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
		};
		return colors[status] || "bg-muted text-muted-foreground border-border";
	};

	return (
		<main
			className="invoice-detail-page min-h-screen bg-background"
			aria-labelledby="invoice-detail-page-title"
			aria-describedby="invoice-detail-page-description"
			aria-busy={loading || updating || exportPdfLoading}
		>
			<div className="container mx-auto p-6">
				{/* Document header */}
				<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
					<div className="flex min-w-0 items-start gap-4">
						<Button
							variant="ghost"
							size="icon"
							className="shrink-0 rounded-lg"
							onClick={() => navigate({ to: "/admin/invoices" })}
							aria-label="Back to invoices"
						>
							<ChevronLeft className="h-5 w-5" />
						</Button>
						<div className="min-w-0 space-y-2">
							<div className="flex items-center gap-2.5">
								<div
									className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
									style={{ background: "var(--invoice-detail-accent)" }}
								>
									<FileText className="h-4.5 w-4.5 text-white" />
								</div>
								<h1
									id="invoice-detail-page-title"
									className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
									style={{ fontFamily: "var(--invoice-detail-display)" }}
								>
									Invoice {invoice.invoiceNumber}
								</h1>
							</div>
							<div className="pl-11.5 space-y-1.5">
								<p
									id="invoice-detail-page-description"
									className="text-sm text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									Proforma invoice details and line items.
								</p>
								<div
									style={{
										height: "3px",
										width: "3rem",
										borderRadius: "9999px",
										background:
											"linear-gradient(to right, var(--invoice-detail-accent), transparent)",
									}}
								/>
							</div>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={exportPdfLoading}
							className="gap-2"
							onClick={() => {
								generateProformaPdf(
									{ invoiceId: invoice.id },
									{
										onSuccess: (res) => {
											const p = res?.generateProformaInvoicePdf;
											if (p?.pdfBase64) {
												downloadPdfFromBase64(p.pdfBase64, p.filename);
												toast.success("Proforma PDF downloaded");
											} else {
												toast.error("No PDF returned");
											}
										},
										onError: (err: Error) => {
											toast.error(err.message ?? "Failed to export PDF");
										},
									},
								);
							}}
						>
							<Download className="h-4 w-4" aria-hidden />
							{exportPdfLoading ? "Exporting…" : "Export"}
						</Button>
						{invoice.status === "Issued" && (
							<Button
								size="sm"
								className="gap-2 text-white disabled:opacity-50"
								style={{
									background: "var(--invoice-detail-accent)",
									borderColor: "var(--invoice-detail-accent)",
								}}
								onClick={() =>
									updateStatus({ id: invoice.id, status: "SENT" })
								}
								disabled={updating}
							>
								<Send className="h-4 w-4" />
								Mark sent
							</Button>
						)}
					</div>
				</header>

				{/* Meta cards */}
				<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
					<Card className="invoice-detail-meta-card border-[var(--invoice-detail-doc-border)]">
						<CardHeader className="pb-2 pt-5">
							<CardTitle
								className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								Status
							</CardTitle>
						</CardHeader>
						<CardContent className="pb-5 pt-0">
							<Badge
								variant="outline"
								className={getStatusColor(invoice.status)}
							>
								{invoice.status}
							</Badge>
						</CardContent>
					</Card>
					<Card className="invoice-detail-meta-card border-[var(--invoice-detail-doc-border)]">
						<CardHeader className="pb-2 pt-5">
							<CardTitle
								className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								PO number
							</CardTitle>
						</CardHeader>
						<CardContent className="pb-5 pt-0">
							<p
								className="text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--invoice-detail-display)" }}
							>
								{invoice.poNumber ?? "—"}
							</p>
						</CardContent>
					</Card>
					<Card className="invoice-detail-meta-card border-[var(--invoice-detail-doc-border)]">
						<CardHeader className="pb-2 pt-5">
							<CardTitle
								className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								DO number
							</CardTitle>
						</CardHeader>
						<CardContent className="pb-5 pt-0">
							<p
								className="text-sm font-semibold text-foreground"
								style={{ fontFamily: "var(--invoice-detail-display)" }}
							>
								{invoice.doNumber ?? "—"}
							</p>
						</CardContent>
					</Card>
					<Card className="invoice-detail-meta-card border-[var(--invoice-detail-doc-border)]">
						<CardHeader className="pb-2 pt-5">
							<CardTitle
								className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								Issued date
							</CardTitle>
						</CardHeader>
						<CardContent className="pb-5 pt-0">
							<p
								className="text-sm text-foreground"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								{invoice.issuedDate ? formatDateOnly(invoice.issuedDate) : "—"}
							</p>
						</CardContent>
					</Card>
					<Card className="invoice-detail-meta-card border-[var(--invoice-detail-doc-border)] sm:col-span-2 lg:col-span-3 xl:col-span-2">
						<CardHeader className="pb-2 pt-5">
							<CardTitle
								className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								Amounts
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 pb-5 pt-0">
							<dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-xs">
								<dt
									className="text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									Subtotal
								</dt>
								<dd
									className="text-right font-semibold tabular-nums text-foreground"
									style={{ fontFamily: "var(--invoice-detail-display)" }}
								>
									{formatCurrency(lineItemsSummary.subtotal)}
								</dd>
								<dt
									className="text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									Total (excl. tax)
								</dt>
								<dd
									className="text-right font-semibold tabular-nums text-foreground"
									style={{ fontFamily: "var(--invoice-detail-display)" }}
								>
									{formatCurrency(
										invoice.subtotal > 0
											? invoice.subtotal
											: lineItemsSummary.subtotal,
									)}
								</dd>
								<dt
									className="text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									Tax rate
								</dt>
								<dd
									className="text-right font-semibold text-foreground"
									style={{ fontFamily: "var(--invoice-detail-display)" }}
								>
									{taxRatePercent > 0 ? `${taxRatePercent}%` : "—"}
								</dd>
								<dt
									className="text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									Tax amount
								</dt>
								<dd
									className="text-right font-semibold tabular-nums text-foreground"
									style={{ fontFamily: "var(--invoice-detail-display)" }}
								>
									{formatCurrency(
										invoice.tax > 0 ? invoice.tax : lineItemsSummary.tax,
									)}
								</dd>
							</dl>
							<div
								className="border-t border-[var(--invoice-detail-doc-border)] pt-2"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								<p
									className="text-[11px] text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									PO total (reference)
								</p>
								<p
									className="text-base font-bold tabular-nums"
									style={{
										fontFamily: "var(--invoice-detail-display)",
										color: "var(--invoice-detail-accent)",
									}}
								>
									{formatCurrency(invoice.totalAmount)}
								</p>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									{taxRateLabel}
									{" · "}
									Line total (incl. tax){" "}
									<span className="font-medium text-foreground tabular-nums">
										{formatCurrency(lineItemsSummary.total)}
									</span>
								</p>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Line items */}
				<Card className="invoice-detail-items-card mb-8 border-[var(--invoice-detail-doc-border)]">
					<CardHeader className="invoice-detail-doc-strip pl-6">
						<div className="flex items-center gap-2.5">
							<CardTitle
								className="text-lg"
								style={{ fontFamily: "var(--invoice-detail-display)" }}
							>
								Line items
							</CardTitle>
							{invoice.items.length > 0 && (
								<Badge
									variant="outline"
									className="text-xs font-medium tabular-nums border-[var(--invoice-detail-doc-border)] text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									{invoice.items.length}{" "}
									{invoice.items.length === 1 ? "item" : "items"}
								</Badge>
							)}
						</div>
						<CardDescription
							style={{ fontFamily: "var(--invoice-detail-body)" }}
						>
							Items included in this invoice
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0 sm:px-6">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="border-[var(--invoice-detail-doc-border)] hover:bg-transparent">
										<TableHead
											className="text-muted-foreground text-xs font-medium uppercase tracking-wider"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											#
										</TableHead>
										<TableHead
											className="text-muted-foreground text-xs font-medium uppercase tracking-wider"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											SKU code
										</TableHead>
										<TableHead
											className="text-muted-foreground text-xs font-medium uppercase tracking-wider"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Description
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Qty
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider whitespace-nowrap"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Price/Unit (RM)
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider whitespace-nowrap"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Subtotal (RM)
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider whitespace-nowrap"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Total excl. tax (RM)
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider whitespace-nowrap"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Tax Amt (RM)
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider whitespace-nowrap"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Total Incl. Tax (RM)
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider whitespace-nowrap"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Tax Rate
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{computedLineItems.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={10}
												className="h-28 text-center text-muted-foreground text-sm"
												style={{ fontFamily: "var(--invoice-detail-body)" }}
											>
												No line items
											</TableCell>
										</TableRow>
									) : (
										computedLineItems.map((item, idx) => (
											<TableRow
												key={item.id}
												className="invoice-detail-row border-[var(--invoice-detail-doc-border)]"
											>
												<TableCell
													className="text-muted-foreground text-sm"
													style={{ fontFamily: "var(--invoice-detail-body)" }}
												>
													{item.itemNo ?? idx + 1}
												</TableCell>
												<TableCell
													className="font-medium text-sm"
													style={{
														fontFamily: "var(--invoice-detail-display)",
													}}
												>
													{item.skuCode ?? item.skuId}
												</TableCell>
												<TableCell
													className="text-sm text-foreground"
													style={{ fontFamily: "var(--invoice-detail-body)" }}
												>
													{item.description ?? "—"}
												</TableCell>
												<TableCell
													className="text-right text-sm tabular-nums"
													style={{ fontFamily: "var(--invoice-detail-body)" }}
												>
													{item.quantity}
												</TableCell>
												<TableCell
													className="text-right text-sm tabular-nums"
													style={{ fontFamily: "var(--invoice-detail-body)" }}
												>
													{formatCurrency(item.unitPrice)}
												</TableCell>
												<TableCell
													className="text-right text-sm font-medium tabular-nums"
													style={{
														fontFamily: "var(--invoice-detail-display)",
													}}
												>
													{formatCurrency(item.totalPrice)}
												</TableCell>
												<TableCell
													className="text-right text-sm tabular-nums"
													style={{ fontFamily: "var(--invoice-detail-body)" }}
												>
													{formatCurrency(item.totalPrice)}
												</TableCell>
												<TableCell
													className="text-right text-sm tabular-nums"
													style={{ fontFamily: "var(--invoice-detail-body)" }}
												>
													{formatCurrency(item.totalPrice * lineItemsTaxRate)}
												</TableCell>
												<TableCell
													className="text-right text-sm font-semibold tabular-nums"
													style={{
														fontFamily: "var(--invoice-detail-display)",
														color: "var(--invoice-detail-accent)",
													}}
												>
													{formatCurrency(
														item.totalPrice +
															item.totalPrice * lineItemsTaxRate,
													)}
												</TableCell>
												<TableCell
													className="text-right text-sm tabular-nums"
													style={{ fontFamily: "var(--invoice-detail-body)" }}
												>
													{taxRatePercent > 0 ? `${taxRatePercent}%` : "—"}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
						<div className="mt-6 flex justify-end border-t border-[var(--invoice-detail-doc-border)] px-6 pt-6">
							<div
								className="w-full max-w-xs space-y-2 rounded-lg bg-muted/50 px-5 py-4"
								style={{ fontFamily: "var(--invoice-detail-body)" }}
							>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Subtotal</span>
									<span className="font-medium tabular-nums">
										{formatCurrency(lineItemsSummary.subtotal)}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">{taxRateLabel}</span>
									<span className="font-medium tabular-nums">
										{formatCurrency(lineItemsSummary.tax)}
									</span>
								</div>
								<div
									className="flex justify-between border-t border-[var(--invoice-detail-doc-border)] pt-3 text-base font-bold"
									style={{
										fontFamily: "var(--invoice-detail-display)",
										color: "var(--invoice-detail-accent)",
									}}
								>
									<span>Total (incl. tax)</span>
									<span className="tabular-nums">
										{formatCurrency(lineItemsSummary.total)}
									</span>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
