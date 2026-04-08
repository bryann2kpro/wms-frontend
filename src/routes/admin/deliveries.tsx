import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Plus,
	Search,
	Eye,
	Truck,
	CheckCircle,
	User,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import {
	type DeliveryDetail,
	type DeliveryStatus,
	type DeliveryStatusFilter,
	getDeliveries,
	createDelivery,
	updateDeliveryStatus,
} from "@/data/deliveries.mock-data";

export const Route = createFileRoute("/admin/deliveries")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Supplier Delivery"]);
	},
	component: DeliveriesRouteComponent,
	head: () => ({
		meta: [
			{
				title: "Deliveries - SME Edaran WMS",
				description:
					"Manage supplier deliveries, track statuses, and monitor inbound delivery execution.",
			},
		],
	}),
});

const deliveryStatuses: DeliveryStatus[] = [
	"CREATED",
	"PICKING",
	"PACKED",
	"DISPATCHED",
	"DELIVERED_CONFIRMED",
	"CANCELLED",
];

const createDeliverySchema = z.object({
	deliveryNumber: z
		.string()
		.min(1, "Delivery number is required")
		.regex(/^DEL-20\d{2}-[A-Z0-9]+$/, "Use format like DEL-2024-001"),
	customerName: z.string().min(1, "Customer name is required"),
	deliveryAddress: z.string().min(1, "Delivery address is required"),
	scheduledDate: z.string().min(1, "Scheduled date is required"),
	driver: z.string(),
	vehicle: z.string(),
	notes: z.string(),
});

function DeliveriesRouteComponent() {
	const [page, setPage] = useState(1);
	const pageSize = 5;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>("ALL");
	const [selectedDelivery, setSelectedDelivery] =
		useState<DeliveryDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["deliveries", { page, pageSize, searchTerm, statusFilter }],
		queryFn: () =>
			getDeliveries({
				page,
				pageSize,
				search: searchTerm,
				status: statusFilter,
			}),
		staleTime: 30_000,
	});

	const createMutation = useMutation({
		mutationFn: createDelivery,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["deliveries"] });
			setIsCreateOpen(false);
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) =>
			updateDeliveryStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["deliveries"] });
		},
	});

	const form = useForm({
		defaultValues: {
			deliveryNumber: "",
			customerName: "",
			deliveryAddress: "",
			scheduledDate: "",
			driver: "",
			vehicle: "",
			notes: "",
		},
		validators: {
			onBlur: createDeliverySchema,
			onSubmit: createDeliverySchema,
		},
		onSubmit: async ({ value }) => {
			const parsedDate = new Date(value.scheduledDate);
			await createMutation.mutateAsync({
				deliveryNumber: value.deliveryNumber,
				customerName: value.customerName,
				deliveryAddress: value.deliveryAddress,
				scheduledDate: parsedDate,
				driver: value.driver || undefined,
				vehicle: value.vehicle || undefined,
				notes: value.notes || undefined,
			});
			form.reset();
		},
	});

	const deliveries = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const getStatusColor = (status: DeliveryStatus) => {
		const colors: Record<DeliveryStatus, string> = {
			CREATED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			PICKING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
			PACKED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
			DISPATCHED: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
			DELIVERED_CONFIRMED: "bg-green-500/10 text-green-600 border-green-500/20",
			CANCELLED: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status];
	};

	const formatStatus = (status: string) =>
		status
			.toLowerCase()
			.replace("_", " ")
			.replace(/\b\w/g, (l) => l.toUpperCase());

	const handleUpdateStatus = (delivery: DeliveryDetail) => {
		const current = delivery.status;
		const nextStatusMap: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
			CREATED: "PICKING",
			PICKING: "PACKED",
			PACKED: "DISPATCHED",
			DISPATCHED: "DELIVERED_CONFIRMED",
		};
		const next = nextStatusMap[current];
		if (!next) return;
		statusMutation.mutate({ id: delivery.id, status: next });
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Deliveries</h1>
					<p className="text-muted-foreground">
						Manage deliveries, track shipments, and proof of delivery.
					</p>
				</div>
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
							Schedule Delivery
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Schedule New Delivery</DialogTitle>
							<DialogDescription>
								Enter the details for the new delivery.
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
								<div className="grid gap-4 sm:grid-cols-2">
									<form.Field
										name="deliveryNumber"
										children={(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														Delivery Number
													</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="DEL-2024-001"
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
										name="customerName"
										children={(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														Customer Name
													</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="Enter customer name"
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
								</div>

								<form.Field
									name="deliveryAddress"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>
													Delivery Address
												</FieldLabel>
												<Textarea
													id={field.name}
													value={field.state.value}
													placeholder="Enter full delivery address..."
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

								<div className="grid gap-4 sm:grid-cols-3">
									<form.Field
										name="scheduledDate"
										children={(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														Scheduled Date
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
										name="driver"
										children={(field) => (
											<Field>
												<FieldLabel htmlFor={field.name}>Driver</FieldLabel>
												<Input
													id={field.name}
													value={field.state.value}
													placeholder="John Doe"
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
											</Field>
										)}
									/>
									<form.Field
										name="vehicle"
										children={(field) => (
											<Field>
												<FieldLabel htmlFor={field.name}>Vehicle</FieldLabel>
												<Input
													id={field.name}
													value={field.state.value}
													placeholder="VAN-001"
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
											</Field>
										)}
									/>
								</div>

								<form.Field
									name="notes"
									children={(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>Notes</FieldLabel>
											<Textarea
												id={field.name}
												value={field.state.value}
												placeholder="Enter any delivery instructions..."
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
										<Button type="submit" disabled={isSubmitting || !canSubmit}>
											{isSubmitting ? "Scheduling..." : "Schedule Delivery"}
										</Button>
									</DialogFooter>
								)}
							</form.Subscribe>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-5">
					{deliveryStatuses.slice(0, 5).map((status) => (
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
							<CardTitle>Delivery List</CardTitle>
							<CardDescription>View and manage all deliveries.</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search deliveries..."
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
									setStatusFilter(value as DeliveryStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Status</SelectItem>
									{deliveryStatuses.map((status) => (
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
									<TableHead>Delivery Number</TableHead>
									<TableHead>Customer</TableHead>
									<TableHead>Scheduled Date</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Driver</TableHead>
									<TableHead>Vehicle</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											Loading deliveries...
										</TableCell>
									</TableRow>
								) : deliveries.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No deliveries found.
										</TableCell>
									</TableRow>
								) : (
									deliveries.map((delivery) => (
										<TableRow key={delivery.id}>
											<TableCell className="font-medium">
												{delivery.deliveryNumber}
											</TableCell>
											<TableCell>{delivery.customerName}</TableCell>
											<TableCell>
												{delivery.scheduledDate.toLocaleDateString()}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getStatusColor(delivery.status)}
												>
													{formatStatus(delivery.status)}
												</Badge>
											</TableCell>
											<TableCell>{delivery.driver ?? "-"}</TableCell>
											<TableCell>{delivery.vehicle ?? "-"}</TableCell>
											<TableCell className="text-right space-x-1">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => setSelectedDelivery(delivery)}
												>
													<Eye className="h-4 w-4" />
												</Button>
												{delivery.status !== "DELIVERED_CONFIRMED" &&
													delivery.status !== "CANCELLED" && (
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleUpdateStatus(delivery)}
															disabled={statusMutation.status === "pending"}
															aria-label="Advance status"
														>
															<Truck className="h-4 w-4" />
														</Button>
													)}
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
								of <span className="font-medium">{data.total}</span> deliveries
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

			{/* View Delivery Details */}
			{selectedDelivery && (
				<Card className="border-muted-foreground/20 shadow-lg">
					<CardHeader>
						<CardTitle>Delivery Details</CardTitle>
						<CardDescription>
							View and manage delivery information.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ScrollArea className="max-h-[480px] pr-4">
							<div className="space-y-6">
								<div className="grid gap-4 sm:grid-cols-3">
									<div>
										<Label className="text-xs text-muted-foreground">
											Delivery Number
										</Label>
										<p className="text-sm font-medium">
											{selectedDelivery.deliveryNumber}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Customer
										</Label>
										<p className="text-sm font-medium">
											{selectedDelivery.customerName}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Status
										</Label>
										<Badge
											variant="outline"
											className={getStatusColor(selectedDelivery.status)}
										>
											{formatStatus(selectedDelivery.status)}
										</Badge>
									</div>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<Card>
										<CardHeader className="pb-3">
											<CardTitle className="flex items-center gap-2 text-sm">
												<User className="h-4 w-4" />
												Customer Information
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2">
											<div>
												<Label className="text-xs text-muted-foreground">
													Name
												</Label>
												<p className="text-sm font-medium">
													{selectedDelivery.customerName}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Address
												</Label>
												<p className="text-sm">
													{selectedDelivery.deliveryAddress}
												</p>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardHeader className="pb-3">
											<CardTitle className="flex items-center gap-2 text-sm">
												<Truck className="h-4 w-4" />
												Delivery Information
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2">
											<div>
												<Label className="text-xs text-muted-foreground">
													Driver
												</Label>
												<p className="text-sm font-medium">
													{selectedDelivery.driver || "Not assigned"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Vehicle
												</Label>
												<p className="text-sm font-medium">
													{selectedDelivery.vehicle || "Not assigned"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Scheduled Date
												</Label>
												<p className="text-sm">
													{selectedDelivery.scheduledDate.toLocaleDateString()}
												</p>
											</div>
											{selectedDelivery.deliveryDate && (
												<div>
													<Label className="text-xs text-muted-foreground">
														Actual Delivery
													</Label>
													<p className="text-sm">
														{selectedDelivery.deliveryDate.toLocaleDateString()}
													</p>
												</div>
											)}
										</CardContent>
									</Card>
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
													<TableHead>Quantity</TableHead>
													<TableHead>Delivered</TableHead>
													<TableHead>Status</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{selectedDelivery.items.map((item) => (
													<TableRow key={item.id}>
														<TableCell className="font-medium">
															{item.sku}
														</TableCell>
														<TableCell>{item.description}</TableCell>
														<TableCell>{item.quantity}</TableCell>
														<TableCell>{item.deliveredQuantity}</TableCell>
														<TableCell>
															{item.deliveredQuantity === item.quantity ? (
																<div className="flex items-center gap-1 text-green-600">
																	<CheckCircle className="h-4 w-4" />
																	<span className="text-xs">Complete</span>
																</div>
															) : (
																<span className="text-xs text-muted-foreground">
																	Pending
																</span>
															)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</div>

								{selectedDelivery.proofOfDelivery && (
									<Card className="border-green-500/20 bg-green-500/5">
										<CardHeader className="pb-3">
											<CardTitle className="flex items-center gap-2 text-sm text-green-600">
												<CheckCircle className="h-4 w-4" />
												Proof of Delivery Received
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2">
											<div className="grid gap-4 sm:grid-cols-2">
												<div>
													<Label className="text-xs text-muted-foreground">
														Received By
													</Label>
													<p className="text-sm font-medium">
														{selectedDelivery.proofOfDelivery.receivedBy}
													</p>
												</div>
												<div>
													<Label className="text-xs text-muted-foreground">
														Received Date
													</Label>
													<p className="text-sm">
														{selectedDelivery.proofOfDelivery.receivedDate.toLocaleDateString()}
													</p>
												</div>
											</div>
											{selectedDelivery.proofOfDelivery.notes && (
												<div>
													<Label className="text-xs text-muted-foreground">
														Notes
													</Label>
													<p className="text-sm">
														{selectedDelivery.proofOfDelivery.notes}
													</p>
												</div>
											)}
										</CardContent>
									</Card>
								)}

								{selectedDelivery.notes && (
									<div>
										<Label className="text-xs text-muted-foreground">
											Delivery Notes
										</Label>
										<p className="text-sm">{selectedDelivery.notes}</p>
									</div>
								)}

								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => setSelectedDelivery(null)}
									>
										Close
									</Button>
									{selectedDelivery.status !== "DELIVERED_CONFIRMED" &&
										selectedDelivery.status !== "CANCELLED" && (
											<Button
												onClick={() => handleUpdateStatus(selectedDelivery)}
												disabled={statusMutation.status === "pending"}
											>
												{selectedDelivery.status === "DISPATCHED" ? (
													<>
														<CheckCircle className="mr-2 h-4 w-4" />
														Mark as Delivered
													</>
												) : (
													<>
														<Truck className="mr-2 h-4 w-4" />
														Advance Status
													</>
												)}
											</Button>
										)}
								</div>
							</div>
						</ScrollArea>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
