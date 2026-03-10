import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Search,
	Eye,
	ChevronLeft,
	ChevronRight,
	FileText,
	Plus,
	Package,
	Calendar,
	Building2,
	Receipt,
	Clock,
	Info,
	Send,
	DollarSign,
	Trash2,
} from "lucide-react";
import {
	type InvoiceStatusFilter,
	getInvoices,
	createInvoice,
} from "@/data/invoices.mock-data";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/admin/invoices")({
	component: InvoicesComponent,
});

const invoiceStatuses: InvoiceStatusFilter[] = [
	"ALL",
	"Issued",
	"Sent",
	"Cancelled",
];

const createInvoiceSchema = z.object({
	invoiceNumber: z.string(),
	// .min(1, "Invoice number is required"),
	// .regex(/^INV-20\d{2}-[A-Z0-9]+$/, "Use format like INV-2024-001"),
	doNumber: z.string().min(1, "DO Number is required"),
	doId: z.string().min(1, "DO ID is required"),
	toNumber: z.string().min(1, "PO Number is required"),
	outlet: z.string().min(1, "Outlet is required"),
	outletAddress: z.string(),
	issuedDate: z.string().min(1, "Issued date is required"),
	notes: z.string(),
});

function InvoicesComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("ALL");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [invoiceItems, setInvoiceItems] = useState<
		Array<{
			sku: string;
			description: string;
			quantity: number;
			unitPrice: number;
		}>
	>([]);
	const [itemSearch, setItemSearch] = useState("");
	const [itemDescription, setItemDescription] = useState("");
	const [itemQuantity, setItemQuantity] = useState(1);
	const [itemUnitPrice, setItemUnitPrice] = useState(0);

	const { data, isLoading } = useQuery({
		queryKey: ["invoices", { page, pageSize, searchTerm, statusFilter }],
		queryFn: () =>
			getInvoices({
				page,
				pageSize,
				search: searchTerm,
				status: statusFilter,
			}),
		staleTime: 30_000,
	});

	const createMutation = useMutation({
		mutationFn: createInvoice,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["invoices"] });
			setIsCreateOpen(false);
			form.reset();
			setInvoiceItems([]);
		},
	});

	const form = useForm({
		defaultValues: {
			invoiceNumber: "",
			doNumber: "",
			doId: "",
			toNumber: "",
			outlet: "",
			outletAddress: "",
			issuedDate: "",
			notes: "",
		},
		validators: {
			onBlur: createInvoiceSchema,
			onSubmit: createInvoiceSchema,
		},
		onSubmit: async ({ value }) => {
			if (invoiceItems.length === 0) {
				alert("Please add at least one item to the invoice");
				return;
			}
			const parsedDate = new Date(value.issuedDate);
			await createMutation.mutateAsync({
				invoiceNumber: value.invoiceNumber,
				doNumber: value.doNumber,
				doId: value.doId,
				toNumber: value.toNumber,
				outlet: value.outlet,
				outletAddress: value.outletAddress || undefined,
				issuedDate: parsedDate,
				items: invoiceItems,
				notes: value.notes || undefined,
			});
		},
	});

	const invoices = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
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
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Proforma Invoices
					</h1>
					<p className="text-muted-foreground">
						Manage proforma invoices and export proforma invoices.
					</p>
				</div>
				<Dialog
					open={isCreateOpen}
					onOpenChange={(open) => {
						setIsCreateOpen(open);
						if (!open) {
							form.reset();
							setInvoiceItems([]);
							setItemSearch("");
							setItemDescription("");
							setItemQuantity(1);
							setItemUnitPrice(0);
						}
					}}
				>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Create Proforma Invoice
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
						<DialogHeader className="pb-4">
							<DialogTitle className="text-2xl font-semibold flex items-center gap-2">
								<Receipt className="h-5 w-5 text-primary" />
								Create New Proforma Invoice
							</DialogTitle>
							<DialogDescription className="text-base">
								Enter the details for the new invoice
							</DialogDescription>
						</DialogHeader>
						<Separator />
						<ScrollArea className="flex-1 pr-4 h-full overflow-y-auto">
							<form
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
								className="space-y-6 py-4"
							>
								<div className="lg:grid-cols-3">
									<div className="lg:col-span-2 space-y-6">
										{/* Invoice Details Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<FileText className="h-4 w-4 text-muted-foreground" />
													Proforma Invoice Details
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<FieldGroup>
													<div className="grid gap-4 sm:grid-cols-2">
														<form.Field
															name="invoiceNumber"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
																return (
																	<Field data-invalid={isInvalid}>
																		<FieldLabel htmlFor={field.name}>
																			Proforma Invoice Number
																		</FieldLabel>
																		<Input
																			id={field.name}
																			value={field.state.value}
																			placeholder="INV-2024-001"
																			onBlur={field.handleBlur}
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
																			aria-invalid={isInvalid}
																		/>
																		{isInvalid && (
																			<FieldError
																				errors={field.state.meta.errors}
																			/>
																		)}
																	</Field>
																);
															}}
														/>
														<form.Field
															name="issuedDate"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
																return (
																	<Field data-invalid={isInvalid}>
																		<FieldLabel
																			htmlFor={field.name}
																			className="flex items-center gap-2"
																		>
																			<Calendar className="h-4 w-4 text-muted-foreground" />
																			Issued Date
																		</FieldLabel>
																		<Input
																			id={field.name}
																			type="date"
																			value={field.state.value}
																			onBlur={field.handleBlur}
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
																			aria-invalid={isInvalid}
																		/>
																		{isInvalid && (
																			<FieldError
																				errors={field.state.meta.errors}
																			/>
																		)}
																	</Field>
																);
															}}
														/>
													</div>

													<div className="grid gap-4 sm:grid-cols-2">
														<form.Field
															name="doNumber"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
																return (
																	<Field data-invalid={isInvalid}>
																		<FieldLabel htmlFor={field.name}>
																			DO Number
																		</FieldLabel>
																		<Input
																			id={field.name}
																			value={field.state.value}
																			placeholder="DO-2024-001"
																			onBlur={field.handleBlur}
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
																			aria-invalid={isInvalid}
																		/>
																		{isInvalid && (
																			<FieldError
																				errors={field.state.meta.errors}
																			/>
																		)}
																	</Field>
																);
															}}
														/>
														<form.Field
															name="doId"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
																return (
																	<Field data-invalid={isInvalid}>
																		<FieldLabel htmlFor={field.name}>
																			DO ID
																		</FieldLabel>
																		<Input
																			id={field.name}
																			value={field.state.value}
																			placeholder="do-123"
																			onBlur={field.handleBlur}
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
																			aria-invalid={isInvalid}
																		/>
																		{isInvalid && (
																			<FieldError
																				errors={field.state.meta.errors}
																			/>
																		)}
																	</Field>
																);
															}}
														/>
													</div>

													<form.Field
														name="toNumber"
														children={(field) => (
															<Field>
																<FieldLabel htmlFor={field.name}>
																	PO Number (Optional)
																</FieldLabel>
																<Input
																	id={field.name}
																	value={field.state.value}
																	placeholder="PO-2024-001"
																	onBlur={field.handleBlur}
																	onChange={(e) =>
																		field.handleChange(e.target.value)
																	}
																/>
															</Field>
														)}
													/>
												</FieldGroup>
											</CardContent>
										</Card>

										{/* Outlet Information Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<Building2 className="h-4 w-4 text-muted-foreground" />
													Outlet Information
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<FieldGroup>
													<form.Field
														name="outlet"
														children={(field) => {
															const isInvalid =
																field.state.meta.isTouched &&
																!field.state.meta.isValid;
															return (
																<Field data-invalid={isInvalid}>
																	<FieldLabel htmlFor={field.name}>
																		Outlet Name
																	</FieldLabel>
																	<Input
																		id={field.name}
																		value={field.state.value}
																		placeholder="Enter outlet name"
																		onBlur={field.handleBlur}
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
																		aria-invalid={isInvalid}
																	/>
																	{isInvalid && (
																		<FieldError
																			errors={field.state.meta.errors}
																		/>
																	)}
																</Field>
															);
														}}
													/>

													<form.Field
														name="outletAddress"
														children={(field) => (
															<Field>
																<FieldLabel htmlFor={field.name}>
																	Outlet Address (Optional)
																</FieldLabel>
																<Textarea
																	id={field.name}
																	value={field.state.value}
																	placeholder="Enter outlet address"
																	onBlur={field.handleBlur}
																	onChange={(e) =>
																		field.handleChange(e.target.value)
																	}
																	className="min-h-[80px] resize-none"
																/>
															</Field>
														)}
													/>
												</FieldGroup>
											</CardContent>
										</Card>

										{/* Line Items Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<Package className="h-4 w-4 text-muted-foreground" />
													Line Items
												</CardTitle>
												<CardDescription className="text-xs">
													Add products/services to this invoice
												</CardDescription>
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="grid gap-4 sm:grid-cols-4">
													<div className="sm:col-span-1">
														<Label className="text-xs text-muted-foreground mb-1.5 block">
															SKU
														</Label>
														<Input
															placeholder="SKU-001"
															value={itemSearch}
															onChange={(e) => setItemSearch(e.target.value)}
														/>
													</div>
													<div className="sm:col-span-1">
														<Label className="text-xs text-muted-foreground mb-1.5 block">
															Description
														</Label>
														<Input
															placeholder="Product description"
															value={itemDescription}
															onChange={(e) =>
																setItemDescription(e.target.value)
															}
														/>
													</div>
													<div>
														<Label className="text-xs text-muted-foreground mb-1.5 block">
															Qty
														</Label>
														<Input
															type="number"
															min="1"
															placeholder="1"
															value={itemQuantity}
															onChange={(e) =>
																setItemQuantity(Number(e.target.value))
															}
														/>
													</div>
													<div>
														<Label className="text-xs text-muted-foreground mb-1.5 block">
															Unit Price
														</Label>
														<Input
															type="number"
															min="0"
															step="0.01"
															placeholder="0.00"
															value={itemUnitPrice}
															onChange={(e) =>
																setItemUnitPrice(Number(e.target.value))
															}
														/>
													</div>
												</div>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														if (
															itemSearch.trim() &&
															itemDescription.trim() &&
															itemQuantity > 0 &&
															itemUnitPrice >= 0
														) {
															setInvoiceItems([
																...invoiceItems,
																{
																	sku: itemSearch.trim(),
																	description: itemDescription.trim(),
																	quantity: itemQuantity,
																	unitPrice: itemUnitPrice,
																},
															]);
															setItemSearch("");
															setItemDescription("");
															setItemQuantity(1);
															setItemUnitPrice(0);
														}
													}}
													disabled={
														!itemSearch.trim() ||
														!itemDescription.trim() ||
														itemQuantity <= 0
													}
													className="w-full"
												>
													<Plus className="mr-2 h-4 w-4" />
													Add Item
												</Button>

												<div className="rounded-lg border">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>SKU</TableHead>
																<TableHead>Description</TableHead>
																<TableHead className="text-right">
																	Qty
																</TableHead>
																<TableHead className="text-right">
																	Unit Price
																</TableHead>
																<TableHead className="text-right">
																	Total
																</TableHead>
																<TableHead className="w-[60px]" />
															</TableRow>
														</TableHeader>
														<TableBody>
															{invoiceItems.length === 0 ? (
																<TableRow>
																	<TableCell
																		colSpan={6}
																		className="h-32 text-center"
																	>
																		<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
																			<Package className="h-8 w-8 opacity-50" />
																			<p className="text-sm">
																				No items added yet
																			</p>
																			<p className="text-xs">
																				Fill in the fields above and click Add
																				Item
																			</p>
																		</div>
																	</TableCell>
																</TableRow>
															) : (
																<>
																	{invoiceItems.map((item, index) => (
																		<TableRow key={index}>
																			<TableCell className="font-medium">
																				{item.sku}
																			</TableCell>
																			<TableCell className="max-w-[200px] truncate">
																				{item.description}
																			</TableCell>
																			<TableCell className="text-right">
																				{item.quantity}
																			</TableCell>
																			<TableCell className="text-right">
																				${item.unitPrice.toFixed(2)}
																			</TableCell>
																			<TableCell className="text-right font-medium">
																				$
																				{(
																					item.quantity * item.unitPrice
																				).toFixed(2)}
																			</TableCell>
																			<TableCell>
																				<Button
																					type="button"
																					variant="ghost"
																					size="icon"
																					onClick={() => {
																						setInvoiceItems(
																							invoiceItems.filter(
																								(_, i) => i !== index,
																							),
																						);
																					}}
																					className="text-destructive hover:text-destructive h-8 w-8"
																				>
																					<Trash2 className="h-4 w-4" />
																				</Button>
																			</TableCell>
																		</TableRow>
																	))}
																	<TableRow className="bg-muted/50">
																		<TableCell
																			colSpan={4}
																			className="text-right font-medium"
																		>
																			Subtotal
																		</TableCell>
																		<TableCell className="text-right font-medium">
																			{formatCurrency(
																				invoiceItems.reduce(
																					(sum, item) =>
																						sum +
																						item.quantity * item.unitPrice,
																					0,
																				),
																			)}
																		</TableCell>
																		<TableCell />
																	</TableRow>
																	<TableRow className="bg-muted/50">
																		<TableCell
																			colSpan={4}
																			className="text-right font-medium"
																		>
																			Tax (10%)
																		</TableCell>
																		<TableCell className="text-right font-medium">
																			{formatCurrency(
																				invoiceItems.reduce(
																					(sum, item) =>
																						sum +
																						item.quantity * item.unitPrice,
																					0,
																				) * 0.1,
																			)}
																		</TableCell>
																		<TableCell />
																	</TableRow>
																	<TableRow className="bg-primary/5">
																		<TableCell
																			colSpan={4}
																			className="text-right font-semibold"
																		>
																			Total
																		</TableCell>
																		<TableCell className="text-right font-semibold text-primary">
																			{formatCurrency(
																				invoiceItems.reduce(
																					(sum, item) =>
																						sum +
																						item.quantity * item.unitPrice,
																					0,
																				) * 1.1,
																			)}
																		</TableCell>
																		<TableCell />
																	</TableRow>
																</>
															)}
														</TableBody>
													</Table>
												</div>
											</CardContent>
										</Card>

										{/* Notes Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<FileText className="h-4 w-4 text-muted-foreground" />
													Additional Notes
												</CardTitle>
											</CardHeader>
											<CardContent>
												<form.Field
													name="notes"
													children={(field) => (
														<Field>
															<FieldLabel
																htmlFor={field.name}
																className="sr-only"
															>
																Notes
															</FieldLabel>
															<Textarea
																id={field.name}
																value={field.state.value}
																placeholder="Enter any additional notes or comments..."
																onBlur={field.handleBlur}
																onChange={(e) =>
																	field.handleChange(e.target.value)
																}
																className="min-h-[100px] resize-none"
															/>
														</Field>
													)}
												/>
											</CardContent>
										</Card>

										{/* Invoice Summary */}
										<Card className="sticky top-4">
											<CardHeader className="pb-3">
												<CardTitle className="text-sm font-semibold flex items-center gap-2">
													<DollarSign className="h-4 w-4 text-muted-foreground" />
													Invoice Summary
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="space-y-2">
													<div className="flex justify-between text-sm">
														<span className="text-muted-foreground">Items</span>
														<span className="font-medium">
															{invoiceItems.length}
														</span>
													</div>
													<div className="flex justify-between text-sm">
														<span className="text-muted-foreground">
															Subtotal
														</span>
														<span className="font-medium">
															{formatCurrency(
																invoiceItems.reduce(
																	(sum, item) =>
																		sum + item.quantity * item.unitPrice,
																	0,
																),
															)}
														</span>
													</div>
													<div className="flex justify-between text-sm">
														<span className="text-muted-foreground">
															Tax (10%)
														</span>
														<span className="font-medium">
															{formatCurrency(
																invoiceItems.reduce(
																	(sum, item) =>
																		sum + item.quantity * item.unitPrice,
																	0,
																) * 0.1,
															)}
														</span>
													</div>
													<Separator />
													<div className="flex justify-between">
														<span className="font-semibold">Total</span>
														<span className="font-semibold text-primary text-lg">
															{formatCurrency(
																invoiceItems.reduce(
																	(sum, item) =>
																		sum + item.quantity * item.unitPrice,
																	0,
																) * 1.1,
															)}
														</span>
													</div>
												</div>
											</CardContent>
										</Card>
									</div>
								</div>

								<form.Subscribe
									selector={(state) => [state.isSubmitting, state.canSubmit]}
								>
									{([isSubmitting, canSubmit]) => (
										<>
											<Separator className="mt-6" />
											<DialogFooter className="pt-4">
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setIsCreateOpen(false);
														setInvoiceItems([]);
													}}
													disabled={isSubmitting}
												>
													Cancel
												</Button>
												<Button
													type="submit"
													disabled={
														isSubmitting ||
														!canSubmit ||
														invoiceItems.length === 0
													}
													className="min-w-[140px]"
												>
													{isSubmitting ? (
														<>
															<Clock className="mr-2 h-4 w-4 animate-spin" />
															Creating...
														</>
													) : (
														<>
															<Send className="mr-2 h-4 w-4" />
															Create Proforma Invoice
														</>
													)}
												</Button>
											</DialogFooter>
										</>
									)}
								</form.Subscribe>
							</form>
						</ScrollArea>
					</DialogContent>
				</Dialog>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Issued</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.Issued ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Sent</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.Sent ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Cancelled</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.Cancelled ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">
								Total Amount
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{formatCurrency(summary.totalAmount)}
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Proforma Invoices List</CardTitle>
							<CardDescription>
								View and manage all proforma invoices
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search invoices..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 sm:w-64"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(value) => {
									setStatusFilter(value as InvoiceStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									{invoiceStatuses.map((status) => (
										<SelectItem key={status} value={status}>
											{status === "ALL" ? "All Status" : status}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Invoice Number</TableHead>
									<TableHead>DO Number</TableHead>
									<TableHead>PO Number</TableHead>
									<TableHead>Region</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Issued Date</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground"
										>
											Loading invoices...
										</TableCell>
									</TableRow>
								) : invoices.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground"
										>
											No invoices found.
										</TableCell>
									</TableRow>
								) : (
									invoices.map((invoice) => (
										<TableRow key={invoice.id}>
											<TableCell className="font-medium">
												{invoice.invoiceNumber}
											</TableCell>
											<TableCell>{invoice.doNumber}</TableCell>
											<TableCell>{invoice.toNumber}</TableCell>
											<TableCell>{invoice.region}</TableCell>
											<TableCell>{invoice.outlet}</TableCell>
											<TableCell>
												{formatCurrency(invoice.totalAmount)}
											</TableCell>
											<TableCell>
												{invoice.issuedDate.toLocaleDateString()}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getStatusColor(invoice.status)}
												>
													{invoice.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="ghost"
													size="icon"
													onClick={() =>
														navigate({
															to: "/admin/invoice-detail",
															search: { id: invoice.id },
														})
													}
												>
													<Eye className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{data && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								Showing{" "}
								<span className="font-medium">
									{(data.page - 1) * data.pageSize + 1}
								</span>{" "}
								-{" "}
								<span className="font-medium">
									{Math.min(data.page * data.pageSize, data.total)}
								</span>{" "}
								of <span className="font-medium">{data.total}</span> invoices
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page === 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span>
									Page {page} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={page === totalPages}
									onClick={() =>
										setPage((p) => (data ? Math.min(totalPages, p + 1) : p))
									}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
