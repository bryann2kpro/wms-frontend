import {
	createFileRoute,
	useNavigate,
} from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useQuery, useMutation } from "@apollo/client/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import { ChevronLeft, Download, Send, FileText } from "lucide-react";
import {
	INVOICE_QUERY,
	UPDATE_INVOICE_STATUS_MUTATION,
	type InvoiceQueryData,
	type InvoiceQueryVariables,
	type UpdateInvoiceStatusData,
	type UpdateInvoiceStatusVariables,
	gqlStatusToUI,
} from "@/lib/graphql/invoices";
import { formatCurrency, formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/admin/invoice-detail")({
	validateSearch: (search: Record<string, unknown>) => ({
		id: (search.id as string) ?? "",
	}),
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Invoice"]);
	},
	component: InvoiceDetailComponent,
});

function InvoiceDetailComponent() {
	const { id } = Route.useSearch();
	const navigate = useNavigate();

	const { data, loading, refetch } = useQuery<InvoiceQueryData, InvoiceQueryVariables>(
		INVOICE_QUERY,
		{
			variables: { id },
			skip: !id,
			fetchPolicy: "cache-and-network",
		},
	);

	const [updateStatus, { loading: updating }] = useMutation<
		UpdateInvoiceStatusData,
		UpdateInvoiceStatusVariables
	>(UPDATE_INVOICE_STATUS_MUTATION, {
		onCompleted: () => refetch(),
	});

	const raw = data?.invoice;
	const invoice = raw
		? {
				...raw,
				invoiceNumber: raw.invoiceNo,
				doNumber: raw.doNo,
				poNumber: raw.poNo,
				status: gqlStatusToUI(raw.status),
				issuedDate: raw.dateIssued ? new Date(raw.dateIssued) : null,
				totalAmount: parseFloat(raw.totalInclTax ?? "0") || 0,
				subtotal: parseFloat(raw.totalExclTax ?? "0") || 0,
				tax: parseFloat(raw.taxAmount ?? "0") || 0,
				items: (raw.items ?? []).map((item) => ({
					...item,
					skuCode: item.skuCode ?? null,
					quantity: parseFloat(item.qty) || 0,
					unitPrice: parseFloat(item.unitPrice) || 0,
					totalPrice: parseFloat(item.subTotal) || 0,
				})),
		  }
		: null;

	if (loading && !invoice) {
		return (
			<div className="invoice-detail-page min-h-[60vh] flex items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<div
						className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
						aria-hidden
					/>
					<p className="text-sm" style={{ fontFamily: "var(--invoice-detail-body)" }}>
						Loading invoice…
					</p>
				</div>
			</div>
		);
	}

	if (!invoice) {
		return (
			<div className="invoice-detail-page container mx-auto max-w-4xl px-6 py-12">
				<div
					className="invoice-detail-doc-strip rounded-lg border bg-card px-6 py-10 text-center"
					style={{ fontFamily: "var(--invoice-detail-body)" }}
				>
					<FileText className="mx-auto h-12 w-12 text-muted-foreground/60" />
					<p className="mt-3 text-sm font-medium text-foreground">Invoice not found</p>
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
			</div>
		);
	}

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			Issued: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
			Sent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
			Cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
		};
		return colors[status] || "bg-muted text-muted-foreground border-border";
	};

	return (
		<div className="invoice-detail-page min-h-screen bg-background">
			<div className="container mx-auto max-w-5xl px-6 py-8">
				{/* Document header */}
				<header className="mb-8">
					<div className="flex flex-wrap items-start justify-between gap-4">
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
							<div className="min-w-0">
								<h1
									className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
									style={{ fontFamily: "var(--invoice-detail-display)" }}
								>
									{invoice.invoiceNumber}
								</h1>
								<p
									className="mt-1 text-sm text-muted-foreground"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									Invoice details
								</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled
								title="PDF export coming soon"
								className="gap-2"
							>
								<Download className="h-4 w-4" />
								PDF
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled
								title="Excel export coming soon"
								className="gap-2"
							>
								<Download className="h-4 w-4" />
								Excel
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled
								title="TXT export coming soon"
								className="gap-2"
							>
								<Download className="h-4 w-4" />
								TXT
							</Button>
							{invoice.status === "Issued" && (
								<Button
									size="sm"
									className="gap-2 bg-[var(--invoice-detail-accent)] text-white hover:opacity-90 dark:bg-[var(--invoice-detail-accent)] dark:text-gray-950"
									onClick={() =>
										updateStatus({ variables: { id: invoice.id, status: "SENT" } })
									}
									disabled={updating}
								>
									<Send className="h-4 w-4" />
									Mark sent
								</Button>
							)}
						</div>
					</div>
				</header>

				{/* Meta cards */}
				<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
							<Badge variant="outline" className={getStatusColor(invoice.status)}>
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
				</div>

				{/* Line items */}
				<Card className="invoice-detail-items-card mb-8 border-[var(--invoice-detail-doc-border)]">
					<CardHeader className="invoice-detail-doc-strip pl-6">
						<CardTitle
							className="text-lg"
							style={{ fontFamily: "var(--invoice-detail-display)" }}
						>
							Line items
						</CardTitle>
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
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Unit price
										</TableHead>
										<TableHead
											className="text-right text-muted-foreground text-xs font-medium uppercase tracking-wider"
											style={{ fontFamily: "var(--invoice-detail-body)" }}
										>
											Subtotal
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{invoice.items.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="h-28 text-center text-muted-foreground text-sm"
												style={{ fontFamily: "var(--invoice-detail-body)" }}
											>
												No line items
											</TableCell>
										</TableRow>
									) : (
										invoice.items.map((item, idx) => (
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
													style={{ fontFamily: "var(--invoice-detail-display)" }}
												>
													{item.skuCode ?? item.skuId}
												</TableCell>
												<TableCell
													className="max-w-[200px] text-sm text-foreground"
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
													style={{ fontFamily: "var(--invoice-detail-display)" }}
												>
													{formatCurrency(item.totalPrice)}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
						{invoice.totalAmount > 0 && (
							<div className="mt-6 flex justify-end border-t border-[var(--invoice-detail-doc-border)] px-6 pt-6">
								<div
									className="w-full max-w-xs space-y-2 rounded-lg bg-muted/50 px-5 py-4"
									style={{ fontFamily: "var(--invoice-detail-body)" }}
								>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Subtotal</span>
										<span className="font-medium tabular-nums">
											{formatCurrency(invoice.subtotal)}
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Tax</span>
										<span className="font-medium tabular-nums">
											{formatCurrency(invoice.tax)}
										</span>
									</div>
									<div
										className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground"
										style={{ fontFamily: "var(--invoice-detail-display)" }}
									>
										<span>Total</span>
										<span className="tabular-nums">
											{formatCurrency(invoice.totalAmount)}
										</span>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Integration log */}
				<IntegrationLogPanel
					entityId={invoice.id}
					entityType="invoice"
					onRetry={(logId) => {
						console.log("Retry log:", logId);
					}}
				/>
			</div>
		</div>
	);
}
