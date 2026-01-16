import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
	Plus,
	Search,
	Eye,
	Package,
	Truck,
	CheckCircle,
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	XCircle,
} from "lucide-react";
import {
	type TransferDetail,
	type TransferStatus,
	type TransferStatusFilter,
	getTransfers,
	createTransfer,
	updateTransferStatus,
} from "@/data/transfers.mock-data";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/auth-context";
import { IntegrationLogPanel } from "@/components/integration-log-panel";

export const Route = createFileRoute("/admin/transfers")({
	component: TransfersRouteComponent,
});

const transferStatuses: TransferStatus[] = [
	"New",
	"Accepted",
	"Rejected",
	"DO_Created",
];

const locations = [
	{ value: "main", label: "Main Warehouse" },
	{ value: "dist-a", label: "Distribution Center A" },
	{ value: "dist-b", label: "Distribution Center B" },
	{ value: "warehouse-a", label: "Warehouse A" },
	{ value: "warehouse-b", label: "Warehouse B" },
	{ value: "warehouse-c", label: "Warehouse C" },
	{ value: "warehouse-d", label: "Warehouse D" },
];

const createTransferSchema = z.object({
	transferOrderNumber: z
		.string()
		.min(1, "Transfer order number is required")
		.regex(/^TO-20\d{2}-[A-Z0-9]+$/, "Use format like TO-2024-001"),
	fromLocation: z.string().min(1, "From location is required"),
	toLocation: z.string().min(1, "To location is required"),
	expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
	notes: z.string(),
});

function TransfersRouteComponent() {
	const { user } = useAuth();
	const { hasPermission } = usePermissions(user);
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<TransferStatusFilter>("ALL");
	const [selectedTransfer, setSelectedTransfer] =
		useState<TransferDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
	const [rejectReason, setRejectReason] = useState("");

	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["transfers", { page, pageSize, searchTerm, statusFilter }],
		queryFn: () =>
			getTransfers({
				page,
				pageSize,
				search: searchTerm,
				status: statusFilter,
			}),
		staleTime: 30_000,
	});

	const createMutation = useMutation({
		mutationFn: createTransfer,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transfers"] });
			setIsCreateOpen(false);
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: TransferStatus }) =>
			updateTransferStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transfers"] });
		},
	});

	const form = useForm({
		defaultValues: {
			transferOrderNumber: "",
			fromLocation: "",
			toLocation: "",
			expectedDeliveryDate: "",
			notes: "",
		},
		validators: {
			onBlur: createTransferSchema,
			onSubmit: createTransferSchema,
		},
		onSubmit: async ({ value }) => {
			const parsedDate = new Date(value.expectedDeliveryDate);
			await createMutation.mutateAsync({
				transferOrderNumber: value.transferOrderNumber,
				fromLocation: value.fromLocation,
				toLocation: value.toLocation,
				expectedDeliveryDate: parsedDate,
				notes: value.notes || undefined,
			});
			form.reset();
		},
	});

	const transfers = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const getStatusColor = (status: TransferStatus) => {
		const colors: Record<TransferStatus, string> = {
			New: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			Accepted: "bg-green-500/10 text-green-600 border-green-500/20",
			Rejected: "bg-red-500/10 text-red-600 border-red-500/20",
			DO_Created: "bg-purple-500/10 text-purple-600 border-purple-500/20",
		};
		return colors[status];
	};

	const getNetSuiteStatusColor = (status?: string) => {
		if (!status) return "bg-gray-500/10 text-gray-600 border-gray-500/20";
		const colors: Record<string, string> = {
			synced: "bg-green-500/10 text-green-600 border-green-500/20",
			pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
			error: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const formatStatus = (status: string) => {
		if (status === "DO_Created") return "DO Created";
		return status;
	};

	const calculateProgress = (transfer: TransferDetail) => {
		const totalQuantity = transfer.items.reduce(
			(sum, item) => sum + item.quantity,
			0,
		);
		const pickedQuantity = transfer.items.reduce(
			(sum, item) => sum + item.pickedQuantity,
			0,
		);
		return totalQuantity > 0 ? (pickedQuantity / totalQuantity) * 100 : 0;
	};

	const handleViewTransfer = (transfer: TransferDetail) => {
		setSelectedTransfer(transfer);
		setIsViewOpen(true);
	};

	const handleUpdateStatus = (id: string, status: TransferStatus) => {
		statusMutation.mutate({ id, status });
		if (isViewOpen) {
			setIsViewOpen(false);
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Transfer Orders</h1>
					<p className="text-muted-foreground">
						Manage transfer orders from NetSuite and create delivery orders
					</p>
				</div>
				<div className="flex gap-2">
					{hasPermission("to:refresh") && (
						<Button
							variant="outline"
							onClick={() => {
								queryClient.invalidateQueries({ queryKey: ["transfers"] });
							}}
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							Refresh from NetSuite
						</Button>
					)}
					<Dialog
						open={isCreateOpen}
						onOpenChange={(open) => {
							setIsCreateOpen(open);
							if (!open) {
								form.reset();
							}
						}}
					>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Create Transfer Order
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Create New Transfer Order</DialogTitle>
								<DialogDescription>
									Enter the details for the new transfer order
								</DialogDescription>
							</DialogHeader>
							<form
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
								className="space-y-4"
							>
								<FieldGroup>
									<form.Field
										name="transferOrderNumber"
										children={(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														Transfer Order Number
													</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="TO-2024-001"
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									/>

									<div className="grid gap-4 sm:grid-cols-2">
										<form.Field
											name="fromLocation"
											children={(field) => {
												const isInvalid =
													field.state.meta.isTouched &&
													!field.state.meta.isValid;
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															From Location
														</FieldLabel>
														<Select
															value={field.state.value}
															onValueChange={(value) => {
																field.handleChange(value);
																field.handleBlur();
															}}
														>
															<SelectTrigger id={field.name}>
																<SelectValue placeholder="Select location" />
															</SelectTrigger>
															<SelectContent>
																{locations.map((loc) => (
																	<SelectItem key={loc.value} value={loc.value}>
																		{loc.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														{isInvalid && (
															<FieldError errors={field.state.meta.errors} />
														)}
													</Field>
												);
											}}
										/>
										<form.Field
											name="toLocation"
											children={(field) => {
												const isInvalid =
													field.state.meta.isTouched &&
													!field.state.meta.isValid;
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															To Location
														</FieldLabel>
														<Select
															value={field.state.value}
															onValueChange={(value) => {
																field.handleChange(value);
																field.handleBlur();
															}}
														>
															<SelectTrigger id={field.name}>
																<SelectValue placeholder="Select location" />
															</SelectTrigger>
															<SelectContent>
																{locations.map((loc) => (
																	<SelectItem key={loc.value} value={loc.value}>
																		{loc.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														{isInvalid && (
															<FieldError errors={field.state.meta.errors} />
														)}
													</Field>
												);
											}}
										/>
									</div>

									<form.Field
										name="expectedDeliveryDate"
										children={(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														Expected Delivery Date
													</FieldLabel>
													<Input
														id={field.name}
														type="date"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									/>

									<form.Field
										name="notes"
										children={(field) => (
											<Field>
												<FieldLabel htmlFor={field.name}>Notes</FieldLabel>
												<Textarea
													id={field.name}
													value={field.state.value}
													placeholder="Enter any additional notes..."
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
											</Field>
										)}
									/>
								</FieldGroup>

								<form.Subscribe
									selector={(state) => [state.isSubmitting, state.canSubmit]}
								>
									{([isSubmitting, canSubmit]) => (
										<DialogFooter>
											<Button
												type="button"
												variant="outline"
												onClick={() => {
													setIsCreateOpen(false);
												}}
												disabled={isSubmitting}
											>
												Cancel
											</Button>
											<Button
												type="submit"
												disabled={isSubmitting || !canSubmit}
											>
												{isSubmitting ? "Creating..." : "Create Transfer Order"}
											</Button>
										</DialogFooter>
									)}
								</form.Subscribe>
							</form>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-5">
					{transferStatuses.map((status) => (
						<Card key={status}>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">
									{formatStatus(status)}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{summary.byStatus[status] ?? 0}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Transfer Order List</CardTitle>
							<CardDescription>
								View and manage all transfer orders
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search transfers..."
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
									setStatusFilter(value as TransferStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Status</SelectItem>
									{transferStatuses.map((status) => (
										<SelectItem key={status} value={status}>
											{formatStatus(status)}
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
									<TableHead>TO Number</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead>Scheduled Delivery</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>DO Created?</TableHead>
									<TableHead>NetSuite</TableHead>
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
											Loading transfer orders...
										</TableCell>
									</TableRow>
								) : transfers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground"
										>
											No transfer orders found.
										</TableCell>
									</TableRow>
								) : (
									transfers.map((transfer) => {
										// Calculate scheduled delivery date (mock - would come from TO)
										const scheduledDeliveryDate = new Date(
											transfer.expectedDeliveryDate,
										);
										const doCreated = transfer.status === "DO_Created";

										return (
											<TableRow key={transfer.id}>
												<TableCell className="font-medium">
													{transfer.transferOrderNumber}
												</TableCell>
												<TableCell>
													{transfer.toLocation} {/* Outlet */}
												</TableCell>
												<TableCell>
													{scheduledDeliveryDate.toLocaleDateString()}
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={getStatusColor(transfer.status)}
													>
														{formatStatus(transfer.status)}
													</Badge>
												</TableCell>
												<TableCell>
													{doCreated ? (
														<Badge
															variant="outline"
															className="bg-green-500/10 text-green-600 border-green-500/20"
														>
															Yes
														</Badge>
													) : (
														<Badge
															variant="outline"
															className="bg-gray-500/10 text-gray-600 border-gray-500/20"
														>
															No
														</Badge>
													)}
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={getNetSuiteStatusColor(
															transfer.netsuiteStatus,
														)}
													>
														{transfer.netsuiteStatus || "N/A"}
													</Badge>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-1">
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleViewTransfer(transfer)}
														>
															<Eye className="h-4 w-4" />
														</Button>
														{hasPermission("to:accept") &&
															transfer.status === "New" && (
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => {
																		setSelectedTransfer(transfer);
																		setIsAcceptDialogOpen(true);
																	}}
																>
																	<CheckCircle className="h-4 w-4 text-green-600" />
																</Button>
															)}
														{hasPermission("to:reject") &&
															transfer.status === "New" && (
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => {
																		setSelectedTransfer(transfer);
																		setIsRejectDialogOpen(true);
																	}}
																>
																	<XCircle className="h-4 w-4 text-red-600" />
																</Button>
															)}
													</div>
												</TableCell>
											</TableRow>
										);
									})
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
								of <span className="font-medium">{data.total}</span> transfer
								orders
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

			{/* View Transfer Order Dialog */}
			<Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Transfer Order Details</DialogTitle>
						<DialogDescription>
							View and manage transfer order information
						</DialogDescription>
					</DialogHeader>
					{selectedTransfer && (
						<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
							<div className="space-y-6">
								<div className="grid gap-4 sm:grid-cols-3">
									<div>
										<Label className="text-xs text-muted-foreground">
											TO Number
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.transferOrderNumber}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Outlet
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.toLocation}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Scheduled Delivery
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.expectedDeliveryDate.toLocaleDateString()}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Created Date
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.createdDate.toLocaleDateString()}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Expected Delivery
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.expectedDeliveryDate.toLocaleDateString()}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Status
										</Label>
										<Badge
											variant="outline"
											className={getStatusColor(selectedTransfer.status)}
										>
											{formatStatus(selectedTransfer.status)}
										</Badge>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											NetSuite Status
										</Label>
										<div className="flex items-center gap-2">
											<Badge
												variant="outline"
												className={getNetSuiteStatusColor(
													selectedTransfer.netsuiteStatus,
												)}
											>
												{selectedTransfer.netsuiteStatus || "N/A"}
											</Badge>
											{selectedTransfer.netsuiteStatus === "error" && (
												<AlertCircle className="h-4 w-4 text-red-600" />
											)}
										</div>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Created By
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.createdBy}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Total Items
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.totalItems}
										</p>
									</div>
								</div>

								<div>
									<Label className="mb-2 block text-sm font-medium">
										Items
									</Label>
									<div className="rounded-lg border">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>SKU</TableHead>
													<TableHead>Description</TableHead>
													<TableHead>Qty</TableHead>
													<TableHead>Available Qty</TableHead>
													<TableHead>Status</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{selectedTransfer.items.map((item) => {
													// Mock available quantity (would come from inventory)
													const availableQty =
														item.quantity + Math.floor(Math.random() * 10);
													const canFulfill = availableQty >= item.quantity;

													return (
														<TableRow key={item.id}>
															<TableCell className="font-medium">
																{item.sku}
															</TableCell>
															<TableCell>{item.description}</TableCell>
															<TableCell>{item.quantity}</TableCell>
															<TableCell>
																<span
																	className={
																		canFulfill
																			? "text-green-600"
																			: "text-red-600"
																	}
																>
																	{availableQty}
																</span>
															</TableCell>
															<TableCell>
																{canFulfill ? (
																	<Badge
																		variant="outline"
																		className="bg-green-500/10 text-green-600 border-green-500/20"
																	>
																		Available
																	</Badge>
																) : (
																	<Badge
																		variant="outline"
																		className="bg-red-500/10 text-red-600 border-red-500/20"
																	>
																		Insufficient
																	</Badge>
																)}
															</TableCell>
														</TableRow>
													);
												})}
											</TableBody>
										</Table>
									</div>
								</div>

								{selectedTransfer.notes && (
									<div>
										<Label className="text-xs text-muted-foreground">
											Notes
										</Label>
										<p className="text-sm">{selectedTransfer.notes}</p>
									</div>
								)}

								{/* Integration Log */}
								<IntegrationLogPanel
									entityId={selectedTransfer.id}
									entityType="to"
									onRetry={(logId) => {
										console.log("Retry log:", logId);
									}}
								/>

								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setIsViewOpen(false)}
									>
										Close
									</Button>
									{hasPermission("to:accept") &&
										selectedTransfer.status === "New" && (
											<Button
												onClick={() => {
													setIsViewOpen(false);
													setIsAcceptDialogOpen(true);
												}}
											>
												<CheckCircle className="mr-2 h-4 w-4" />
												Accept & Create DO
											</Button>
										)}
									{hasPermission("to:reject") &&
										selectedTransfer.status === "New" && (
											<Button
												variant="destructive"
												onClick={() => {
													setIsViewOpen(false);
													setIsRejectDialogOpen(true);
												}}
											>
												<XCircle className="mr-2 h-4 w-4" />
												Reject
											</Button>
										)}
								</DialogFooter>
							</div>
						</ScrollArea>
					)}
				</DialogContent>
			</Dialog>

			{/* Accept TO Dialog */}
			<Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Accept Transfer Order</DialogTitle>
						<DialogDescription>
							Accepting this TO will create a Delivery Order and reserve
							stock. Must fulfill full quantity to accept (no partial, no
							backorder, no split delivery).
						</DialogDescription>
					</DialogHeader>
					{selectedTransfer && (
						<div className="space-y-4">
							<div className="rounded-lg border p-3 bg-muted/50">
								<p className="text-sm font-medium mb-2">
									TO: {selectedTransfer.transferOrderNumber}
								</p>
								<p className="text-xs text-muted-foreground">
									Outlet: {selectedTransfer.toLocation}
								</p>
								<p className="text-xs text-muted-foreground">
									Items: {selectedTransfer.items.length}
								</p>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsAcceptDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (selectedTransfer) {
									statusMutation.mutate({
										id: selectedTransfer.id,
										status: "Accepted",
									});
									setIsAcceptDialogOpen(false);
								}
							}}
							disabled={statusMutation.isPending}
						>
							{statusMutation.isPending
								? "Accepting..."
								: "Accept & Create DO"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reject TO Dialog */}
			<Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject Transfer Order</DialogTitle>
						<DialogDescription>
							Please provide a reason for rejecting this transfer order.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<Field>
							<FieldLabel>Rejection Reason</FieldLabel>
							<Textarea
								value={rejectReason}
								onChange={(e) => setRejectReason(e.target.value)}
								placeholder="Enter rejection reason..."
								required
								rows={3}
							/>
						</Field>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setIsRejectDialogOpen(false);
								setRejectReason("");
							}}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								if (selectedTransfer && rejectReason) {
									statusMutation.mutate({
										id: selectedTransfer.id,
										status: "Rejected",
									});
									setIsRejectDialogOpen(false);
									setRejectReason("");
								}
							}}
							disabled={statusMutation.isPending || !rejectReason}
						>
							{statusMutation.isPending ? "Rejecting..." : "Reject TO"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
