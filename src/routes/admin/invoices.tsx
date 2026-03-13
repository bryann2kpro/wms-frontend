import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useQuery } from "@apollo/client/react";
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
	ChevronLeft,
	ChevronRight,
	FileText,
	Receipt,
} from "lucide-react";
import {
	INVOICES_QUERY,
	type InvoicesQueryData,
	type InvoicesQueryVariables,
	type InvoiceStatusFilter,
	gqlStatusToUI,
	uiStatusToGql,
} from "@/lib/graphql/invoices";
import { formatCurrency, formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/admin/invoices")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Invoice"]);
	},
	component: InvoicesComponent,
});

const invoiceStatuses: InvoiceStatusFilter[] = [
	"ALL",
	"Issued",
	"Sent",
	"Cancelled",
];

function InvoicesComponent() {
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("ALL");
	const [issuedFrom, setIssuedFrom] = useState("");
	const [issuedTo, setIssuedTo] = useState("");

	useEffect(() => {
		const handle = setTimeout(() => {
			setDebouncedSearch(searchTerm.trim());
		}, 300);
		return () => clearTimeout(handle);
	}, [searchTerm]);

	const { data, loading } = useQuery<InvoicesQueryData, InvoicesQueryVariables>(
		INVOICES_QUERY,
		{
			variables: {
				filter: {
					...(debouncedSearch ? { search: debouncedSearch } : {}),
					...(statusFilter !== "ALL"
						? { status: uiStatusToGql(statusFilter) }
						: {}),
					...(issuedFrom ? { dateIssuedFrom: issuedFrom } : {}),
					...(issuedTo ? { dateIssuedTo: issuedTo } : {}),
				},
				pageSize,
				pageNumber: page,
			},
			fetchPolicy: "cache-and-network",
		},
	);

	const invoices = (data?.invoices.query ?? []).map((inv) => ({
		...inv,
		status: gqlStatusToUI(inv.status),
		issuedDate: inv.dateIssued ? new Date(inv.dateIssued) : null,
		invoiceNumber: inv.invoiceNo,
		doNumber: inv.doNo,
		toNumber: inv.poNo,
		totalAmount: parseFloat(inv.totalInclTax ?? "0") || 0,
	}));

	const summary = data?.invoices.summary;
	const pagination = data?.invoices.pagination;
	const totalPages = pagination
		? Math.max(1, pagination.totalPages)
		: 1;

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			Issued: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			Sent: "bg-green-500/10 text-green-600 border-green-500/20",
			Cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	return (
		<div className="invoices-page container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2.5">
						<div
							className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
							style={{ background: "var(--dashboard-accent)" }}
						>
							<Receipt className="h-4.5 w-4.5 text-white" />
						</div>
						<h1
							className="text-2xl font-bold tracking-tight"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Proforma Invoices
						</h1>
					</div>
					<p className="text-sm text-muted-foreground pl-11.5">
						Manage and export proforma invoices for all outlets.
					</p>
				</div>
			</div>

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
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search by invoice, DO…"
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-8 h-8 text-sm sm:w-72"
								/>
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
										onClick={() => {
											setStatusFilter(status);
											setPage(1);
										}}
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
									onChange={(e) => {
										setIssuedFrom(e.target.value);
										setPage(1);
									}}
									className="h-8 w-32"
								/>
								<span className="text-[10px] text-muted-foreground/80">to</span>
								<Input
									type="date"
									value={issuedTo}
									onChange={(e) => {
										setIssuedTo(e.target.value);
										setPage(1);
									}}
									className="h-8 w-32"
								/>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative pt-0">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice #</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">DO #</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PO #</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Issued</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
									<TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && invoices.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground text-sm"
										>
											Loading invoices…
										</TableCell>
									</TableRow>
								) : invoices.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-32 text-center"
										>
											<div className="flex flex-col items-center gap-2 text-muted-foreground">
												<FileText className="h-8 w-8 opacity-30" />
												<p className="text-sm font-medium">No invoices found</p>
												<p className="text-xs">Try adjusting your search or filter</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									invoices.map((invoice) => (
										<TableRow
											key={invoice.id}
											className="invoice-row"
											onClick={() =>
												navigate({
													to: "/admin/invoice-detail",
													search: { id: invoice.id },
												})
											}
										>
											<TableCell className="font-semibold text-sm" style={{ fontFamily: "var(--dashboard-display)" }}>
												{invoice.invoiceNumber}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">{invoice.doNumber ?? "—"}</TableCell>
											<TableCell className="text-sm text-muted-foreground">{invoice.toNumber ?? "—"}</TableCell>
											<TableCell className="text-sm font-semibold" style={{ fontFamily: "var(--dashboard-display)" }}>
												{formatCurrency(invoice.totalAmount)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
											{invoice.issuedDate ? formatDateOnly(invoice.issuedDate) : "—"}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getStatusColor(invoice.status)}
												>
													{invoice.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
									))
								)}
							</TableBody>
						</Table>
					</div>

					{pagination && (
						<div className="mt-4 flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								Showing{" "}
								<span className="font-medium text-foreground">
									{(pagination.currentPage - 1) * pageSize + 1}
								</span>{" "}
								–{" "}
								<span className="font-medium text-foreground">
									{Math.min(pagination.currentPage * pageSize, pagination.totalCount)}
								</span>{" "}
								of{" "}
								<span className="font-medium text-foreground">{pagination.totalCount}</span>{" "}
								invoices
							</p>
							<div className="flex items-center gap-1.5">
								<Button
									variant="outline"
									size="icon"
									className="h-7 w-7"
									disabled={!pagination.hasPrevPage}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									<ChevronLeft className="h-3.5 w-3.5" />
								</Button>
								<span className="text-xs text-muted-foreground px-1">
									{page} / {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									className="h-7 w-7"
									disabled={!pagination.hasNextPage}
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								>
									<ChevronRight className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
