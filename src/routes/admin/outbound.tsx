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
import {
	Plus,
	Search,
	Eye,
	CheckCircle,
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	XCircle,
	Calendar,
	Clock,
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
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import {
	BACKEND_DAY_OF_WEEK,
	getBackendDayOfWeek,
} from "@/lib/utils";

export const Route = createFileRoute("/admin/outbound")({
	component: TransfersRouteComponent,
});

const transferStatuses: TransferStatus[] = [
	"preparing",
	"in-transit",
	"to-ship",
	"cancel",
	"return",
	"other",
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
		.min(1, "Delivery order number is required")
		.regex(/^PO-20\d{2}-[A-Z0-9]+$/, "Use format like PO-2024-001"),
	fromLocation: z.string().min(1, "From location is required"),
	toLocation: z.string().min(1, "To location is required"),
	expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
	notes: z.string(),
});

type DeliveryTab = "current-week" | "past-weeks";

// Helper function to get the start of the current week (Monday) at midnight for comparison
function getStartOfWeek(date: Date = new Date()): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
	d.setDate(diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

// Backend day-of-week: Monday = 1, ..., Sunday = 7. Delivery days are Tuesday (2) and Thursday (4).
function isDeliveryDay(date: Date): boolean {
	const dayOfWeek = getBackendDayOfWeek(date);
	return (
		dayOfWeek === BACKEND_DAY_OF_WEEK.TUESDAY ||
		dayOfWeek === BACKEND_DAY_OF_WEEK.THURSDAY
	)
}

// Helper function to check if a date is in the current week (compare by week Monday at midnight)
function isInCurrentWeek(date: Date): boolean {
	const now = new Date();
	const startOfCurrentWeek = getStartOfWeek(now);
	const startOfDateWeek = getStartOfWeek(date);
	return (
		startOfCurrentWeek.getTime() === startOfDateWeek.getTime() &&
		isDeliveryDay(date)
	)
}

// Helper function to check if a date is in a past week
function isInPastWeeks(date: Date): boolean {
	const now = new Date();
	const startOfCurrentWeek = getStartOfWeek(now);
	const startOfDateWeek = getStartOfWeek(date);
	return (
		startOfDateWeek.getTime() < startOfCurrentWeek.getTime() &&
		isDeliveryDay(date)
	)
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatDeliveryDateHeader(date: Date): string {
	const dayName = DAY_NAMES[date.getDay()];
	const dd = String(date.getDate()).padStart(2, "0");
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const yyyy = date.getFullYear();
	return `${dayName} (${dd}/${mm}/${yyyy})`;
}

/** Date key in local date (YYYY-MM-DD). Use local, not UTC, so day-of-week stays correct. */
function getDateKey(date: Date): string {
	const d = new Date(date);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function TransfersRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [activeTab, setActiveTab] = useState<DeliveryTab>("current-week");
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
	})

	const createMutation = useMutation({
		mutationFn: createTransfer,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transfers"] });
			setIsCreateOpen(false);
		},
	})

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: TransferStatus }) =>
			updateTransferStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transfers"] });
		},
	})

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
			})
			form.reset();
		},
	})

	// Filter transfers based on active tab
	const allTransfers = data?.items ?? [];
	const filteredTransfers = allTransfers.filter((transfer) => {
		const deliveryDate = new Date(transfer.expectedDeliveryDate);
		if (activeTab === "current-week") {
			return isInCurrentWeek(deliveryDate);
		} else {
			return isInPastWeeks(deliveryDate);
		}
	})

	// Apply search and status filters to the filtered transfers
	const transfers = filteredTransfers.filter((transfer) => {
		const matchesSearch =
			!searchTerm ||
			transfer.transferOrderNumber
				.toLowerCase()
				.includes(searchTerm.toLowerCase()) ||
			transfer.toLocation.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus =
			statusFilter === "ALL" || transfer.status === statusFilter;
		return matchesSearch && matchesStatus;
	})

	// Group transfers by delivery date
	const transfersByDate = transfers.reduce<Record<string, TransferDetail[]>>(
		(acc, transfer) => {
			const key = getDateKey(new Date(transfer.expectedDeliveryDate));
			if (!acc[key]) acc[key] = [];
			acc[key].push(transfer);
			return acc;
		},
		{},
	)

	const dateKeys = Object.keys(transfersByDate).sort((a, b) =>
		activeTab === "current-week" ? a.localeCompare(b) : b.localeCompare(a),
	)

	// Paginate by date groups (each page shows a few delivery dates)
	const dateGroupsPerPage = 5;
	const totalDateGroups = dateKeys.length;
	const startDateIndex = (page - 1) * dateGroupsPerPage;
	const paginatedDateKeys = dateKeys.slice(
		startDateIndex,
		startDateIndex + dateGroupsPerPage,
	)
	const totalPages = Math.max(1, Math.ceil(totalDateGroups / dateGroupsPerPage));
	const filteredTotal = transfers.length;

	// Recalculate summary based on filtered transfers
	const summary = filteredTransfers.reduce(
		(acc, transfer) => {
			acc.byStatus[transfer.status] = (acc.byStatus[transfer.status] ?? 0) + 1;
			acc.total += 1;
			return acc;
		},
		{
			byStatus: {
				preparing: 0,
				"in-transit": 0,
				"to-ship": 0,
				cancel: 0,
				return: 0,
				other: 0,
			} as Record<TransferStatus, number>,
			total: 0,
		},
	)

	const getStatusColor = (status: TransferStatus) => {
		const colors: Record<TransferStatus, string> = {
			preparing: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			"in-transit": "bg-blue-500/10 text-blue-600 border-blue-500/20",
			"to-ship": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
			cancel: "bg-red-500/10 text-red-600 border-red-500/20",
			return: "bg-orange-500/10 text-orange-600 border-orange-500/20",
			other: "bg-gray-500/10 text-gray-600 border-gray-500/20",
		}
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	}

	const getNetSuiteStatusColor = (status?: string) => {
		if (!status) return "bg-gray-500/10 text-gray-600 border-gray-500/20";
		const colors: Record<string, string> = {
			synced: "bg-green-500/10 text-green-600 border-green-500/20",
			pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
			error: "bg-red-500/10 text-red-600 border-red-500/20",
		}
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	}

	const formatStatus = (status: string) => {
		if (status === "to-ship") return "To Ship";
		if (status === "in-transit") return "In Transit";
		if (status === "preparing") return "Preparing";
		if (status === "cancel") return "Cancel";
		if (status === "return") return "Return";
		if (status === "other") return "Other";
		return status;
	}

	const getTransferStatusColor = (status: TransferStatus) => {
		const colors: Record<TransferStatus, string> = {
			preparing:
				"!text-yellow-600 data-[highlighted]:!bg-yellow-500/10 data-[highlighted]:!text-yellow-700 focus:!bg-yellow-500/10 focus:!text-yellow-700",
			"in-transit":
				"!text-blue-600 data-[highlighted]:!bg-blue-500/10 data-[highlighted]:!text-blue-700 focus:!bg-blue-500/10 focus:!text-blue-700",
			"to-ship":
				"!text-indigo-600 data-[highlighted]:!bg-indigo-500/10 data-[highlighted]:!text-indigo-700 focus:!bg-indigo-500/10 focus:!text-indigo-700",
			cancel:
				"!text-red-600 data-[highlighted]:!bg-red-500/10 data-[highlighted]:!text-red-700 focus:!bg-red-500/10 focus:!text-red-700",
			"return":
				"!text-orange-600 data-[highlighted]:!bg-orange-500/10 data-[highlighted]:!text-orange-700 focus:!bg-orange-500/10 focus:!text-orange-700",
			other:
				"!text-gray-600 data-[highlighted]:!bg-gray-500/10 data-[highlighted]:!text-gray-700 focus:!bg-gray-500/10 focus:!text-gray-700",
		}
		return colors[status] || "text-gray-600";
	}

	const handleViewTransfer = (transfer: TransferDetail) => {
		setSelectedTransfer(transfer);
		setIsViewOpen(true);
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Pucrchase Orders from ES</h1>
					<p className="text-muted-foreground">
						Manage purchase orders from ES and create delivery orders
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
								form.reset()
							}
						}}
					>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Create Delivery Order
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Create New Delivery Order</DialogTitle>
								<DialogDescription>
									Enter the details for the new Delivery order
								</DialogDescription>
							</DialogHeader>
							<form
								onSubmit={(e) => {
									e.preventDefault()
									form.handleSubmit()
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
														Delivery Order Number
													</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="PO-2024-001"
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											)
										}}
									/>

									<div className="grid gap-4 sm:grid-cols-2">
										<form.Field
											name="fromLocation"
											children={(field) => {
												const isInvalid =
													field.state.meta.isTouched &&
													!field.state.meta.isValid
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															From Location
														</FieldLabel>
														<Select
															value={field.state.value}
															onValueChange={(value) => {
																field.handleChange(value)
																field.handleBlur()
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
												)
											}}
										/>
										<form.Field
											name="toLocation"
											children={(field) => {
												const isInvalid =
													field.state.meta.isTouched &&
													!field.state.meta.isValid
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															To Location
														</FieldLabel>
														<Select
															value={field.state.value}
															onValueChange={(value) => {
																field.handleChange(value)
																field.handleBlur()
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
												)
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
											)
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
													setIsCreateOpen(false)
												}}
												disabled={isSubmitting}
											>
												Cancel
											</Button>
											<Button
												type="submit"
												disabled={isSubmitting || !canSubmit}
											>
												{isSubmitting ? "Creating..." : "Create Delivery Order"}
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
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<CardTitle>Delivery Order List</CardTitle>
								<CardDescription>
									View and manage all delivery orders
								</CardDescription>
							</div>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="Search transfers..."
										value={searchTerm}
										onChange={(e) => {
											setSearchTerm(e.target.value)
											setPage(1)
										}}
										className="pl-9 sm:w-64"
									/>
								</div>
								<Select
									value={statusFilter}
									onValueChange={(value) => {
										setStatusFilter(value as TransferStatusFilter);
										setPage(1)
									}}
								>
									<SelectTrigger className="sm:w-48">
										<SelectValue placeholder="Filter by status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">All Status</SelectItem>
										{transferStatuses.map((status) => (
											<SelectItem
												key={status}
												value={status}
												className={getTransferStatusColor(status)}
											>
												{formatStatus(status)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						{/* Tabs */}
						<div className="flex gap-2 border-b">
							<Button
								variant={activeTab === "current-week" ? "default" : "ghost"}
								onClick={() => {
									setActiveTab("current-week");
									setPage(1)
								}}
								className="rounded-b-none"
							>
								<Calendar className="mr-2 h-4 w-4" />
								Next Delivery
							</Button>
							<Button
								variant={activeTab === "past-weeks" ? "default" : "ghost"}
								onClick={() => {
									setActiveTab("past-weeks")
									setPage(1)
								}}
								className="rounded-b-none"
							>
								<Clock className="mr-2 h-4 w-4" />
								Past Deliveries
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>PO Number</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead>Region</TableHead>
									<TableHead>DO Created?</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>NetSuite (API)</TableHead>
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
											Loading delivery orders...
										</TableCell>
									</TableRow>
								) : dateKeys.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground"
										>
											No delivery orders found.
										</TableCell>
									</TableRow>
								) : (
									paginatedDateKeys.flatMap((dateKey) => {
										const dateTransfers = transfersByDate[dateKey] ?? [];
										const deliveryDate = new Date(dateKey + "T12:00:00");
										const headerLabel = formatDeliveryDateHeader(deliveryDate);
										return [
											<TableRow key={dateKey} className="bg-muted/50 hover:bg-muted/50">
												<TableCell
													colSpan={8}
													className="font-semibold text-foreground py-3"
												>
													{headerLabel}
												</TableCell>
											</TableRow>,
											...dateTransfers.map((transfer) => {
												const doCreated =
													transfer.status === "to-ship" ||
													transfer.status === "in-transit"
												return (
													<TableRow key={transfer.id}>
														<TableCell className="font-medium">
															{transfer.transferOrderNumber}
														</TableCell>
														<TableCell>
															{transfer.toLocation}
														</TableCell>
														<TableCell>
															{transfer.regionName
																? `${transfer.regionName}${transfer.regionCode ? ` (${transfer.regionCode})` : ""}`
																: "—"}
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
																className={getStatusColor(transfer.status)}
															>
																{formatStatus(transfer.status)}
															</Badge>
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
																	transfer.status === "preparing" && (
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => {
																				setSelectedTransfer(transfer)
																				setIsAcceptDialogOpen(true)
																			}}
																		>
																			<CheckCircle className="h-4 w-4 text-green-600" />
																		</Button>
																	)}
																{hasPermission("to:reject") &&
																	transfer.status === "preparing" && (
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => {
																				setSelectedTransfer(transfer)
																				setIsRejectDialogOpen(true)
																			}}
																		>
																			<XCircle className="h-4 w-4 text-red-600" />
																		</Button>
																	)}
															</div>
														</TableCell>
													</TableRow>
												)
											}),
										]
									})
								)}
							</TableBody>
						</Table>
					</div>

					{(totalDateGroups > 0 || filteredTotal > 0) && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								{totalDateGroups > 0 ? (
									<>
										Showing delivery dates{" "}
										<span className="font-medium">
											{startDateIndex + 1}
										</span>{" "}
										-{" "}
										<span className="font-medium">
											{startDateIndex + paginatedDateKeys.length}
										</span>{" "}
										of <span className="font-medium">{totalDateGroups}</span>
										{" "}
										(<span className="font-medium">{filteredTotal}</span>{" "}
										orders)
									</>
								) : (
									<>
										<span className="font-medium">0</span> delivery dates (
										<span className="font-medium">{filteredTotal}</span> orders)
									</>
								)}
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
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* View Delivery Order Dialog */}
			<Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
					<DialogContent
						className="max-h-[90vh] overflow-y-auto"
						style={{ maxWidth: "min(95vw, 1400px)" }}
					>
					<DialogHeader>
						<DialogTitle>Delivery Order Details</DialogTitle>
						<DialogDescription>
							View and manage Delivery order information
						</DialogDescription>
					</DialogHeader>
					{selectedTransfer && (
						<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
							<div className="space-y-6">
								<div className="grid gap-4 sm:grid-cols-3">
									<div>
										<Label className="text-xs text-muted-foreground">
											PO Number
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
											Region
										</Label>
										<p className="text-sm font-medium">
											{selectedTransfer.regionName
												? `${selectedTransfer.regionName}${selectedTransfer.regionCode ? ` (${selectedTransfer.regionCode})` : ""}`
												: "—"}
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
											NetSuite Status (API)
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
													)
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
									entityType="po"
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
										selectedTransfer.status === "preparing" && (
											<Button
												onClick={() => {
													setIsViewOpen(false)
													setIsAcceptDialogOpen(true)
												}}
											>
												<CheckCircle className="mr-2 h-4 w-4" />
												Accept & Create DO
											</Button>
										)}
									{hasPermission("to:reject") &&
										selectedTransfer.status === "preparing" && (
											<Button
												variant="destructive"
												onClick={() => {
													setIsViewOpen(false)
													setIsRejectDialogOpen(true)
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
						<DialogTitle>Accept Delivery Order</DialogTitle>
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
								{selectedTransfer.regionName && (
									<p className="text-xs text-muted-foreground">
										Region: {selectedTransfer.regionName}
										{selectedTransfer.regionCode ? ` (${selectedTransfer.regionCode})` : ""}
									</p>
								)}
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
										status: "to-ship",
									})
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
						<DialogTitle>Reject Delivery Order</DialogTitle>
						<DialogDescription>
							Please provide a reason for rejecting this Delivery order.
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
								setRejectReason("")
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
										status: "cancel",
									})
									setIsRejectDialogOpen(false);
									setRejectReason("")
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
	)
}
