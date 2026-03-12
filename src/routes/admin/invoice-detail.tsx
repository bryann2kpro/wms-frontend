import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ChevronLeft, Download, FileText, Send } from "lucide-react";
import {
	getInvoiceById,
	markInvoiceAsSent,
	exportInvoicePDF,
	exportInvoiceExcel,
	exportInvoiceTXT,
} from "@/data/invoices.mock-data";

export const Route = createFileRoute("/admin/invoice-detail")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Invoice"]);
	},
	component: InvoiceDetailComponent,
});

function InvoiceDetailComponent() {
	const { id } = useParams({ from: "/admin/invoices/$id" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: invoice, isLoading } = useQuery({
		queryKey: ["invoice", id],
		queryFn: () => getInvoiceById(id),
		staleTime: 30_000,
	});

	const markSentMutation = useMutation({
		mutationFn: () => markInvoiceAsSent(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["invoice", id] });
			queryClient.invalidateQueries({ queryKey: ["invoices"] });
		},
	});

	const handleExportPDF = async () => {
		const blob = await exportInvoicePDF(id);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${invoice?.invoiceNumber || "invoice"}.pdf`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleExportExcel = async () => {
		const blob = await exportInvoiceExcel(id);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${invoice?.invoiceNumber || "invoice"}.xlsx`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleExportTXT = async () => {
		const blob = await exportInvoiceTXT(id);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${invoice?.invoiceNumber || "invoice"}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	};

	if (isLoading || !invoice) {
		return (
			<div className="container mx-auto p-6">
				<div className="text-center">Loading...</div>
			</div>
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

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/admin/invoices" })}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="flex-1">
					<h1 className="text-3xl font-bold tracking-tight">
						{invoice.invoiceNumber}
					</h1>
					<p className="text-muted-foreground">Invoice Details</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={handleExportPDF}>
						<Download className="mr-2 h-4 w-4" />
						Export PDF
					</Button>
					<Button variant="outline" onClick={handleExportExcel}>
						<Download className="mr-2 h-4 w-4" />
						Export Excel
					</Button>
					<Button variant="outline" onClick={handleExportTXT}>
						<Download className="mr-2 h-4 w-4" />
						Export TXT
					</Button>
					{invoice.status === "Issued" && (
						<Button
							onClick={() => markSentMutation.mutate()}
							disabled={markSentMutation.isPending}
						>
							<Send className="mr-2 h-4 w-4" />
							Mark Sent
						</Button>
					)}
				</div>
			</div>

			{/* Header Info */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Status</CardTitle>
					</CardHeader>
					<CardContent>
						<Badge variant="outline" className={getStatusColor(invoice.status)}>
							{invoice.status}
						</Badge>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">DO Number</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm font-medium">{invoice.doNumber}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">TO Number</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm font-medium">{invoice.toNumber}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Issued Date</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">{invoice.issuedDate.toLocaleDateString()}</p>
					</CardContent>
				</Card>
			</div>

			{/* Invoice Items */}
			<Card>
				<CardHeader>
					<CardTitle>Invoice Items</CardTitle>
					<CardDescription>Line items for this invoice</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>SKU</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Quantity</TableHead>
									{invoice.items[0]?.unitPrice && (
										<>
											<TableHead>Unit Price</TableHead>
											<TableHead>Total Price</TableHead>
										</>
									)}
								</TableRow>
							</TableHeader>
							<TableBody>
								{invoice.items.map((item) => (
									<TableRow key={item.id}>
										<TableCell className="font-medium">{item.sku}</TableCell>
										<TableCell>{item.description}</TableCell>
										<TableCell>{item.quantity}</TableCell>
										{item.unitPrice && (
											<>
												<TableCell>
													${item.unitPrice.toLocaleString()}
												</TableCell>
												<TableCell>
													${(item.totalPrice || 0).toLocaleString()}
												</TableCell>
											</>
										)}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					{invoice.subtotal && (
						<div className="mt-4 flex justify-end">
							<div className="w-64 space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Subtotal:</span>
									<span className="font-medium">
										${invoice.subtotal.toLocaleString()}
									</span>
								</div>
								{invoice.tax && (
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Tax:</span>
										<span className="font-medium">
											${invoice.tax.toLocaleString()}
										</span>
									</div>
								)}
								<div className="flex justify-between border-t pt-2 text-base font-bold">
									<span>Total:</span>
									<span>${invoice.totalAmount.toLocaleString()}</span>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Integration Log */}
			<IntegrationLogPanel
				entityId={invoice.id}
				entityType="invoice"
				onRetry={(logId) => {
					console.log("Retry log:", logId);
				}}
			/>
		</div>
	);
}
