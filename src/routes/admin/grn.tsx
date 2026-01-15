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
	XCircle,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import {
	type GRNDetail,
	type GRNStatus,
	type GRNStatusFilter,
	getGRNs,
	createGRN,
	updateGRNStatus,
} from "@/data/grn.mock-data";

export const Route = createFileRoute("/admin/grn")({
	component: GRNRouteComponent,
});

const grnStatuses: GRNStatus[] = [
	"pending",
	"partially_received",
	"completed",
	"cancelled",
];

const createGRNSchema = z.object({
	grnNumber: z
		.string()
		.min(1, "GRN number is required")
		.regex(/^GRN-20\d{2}-[A-Z0-9]+$/, "Use format like GRN-2024-001"),
	transferOrderNumber: z.string(),
	supplier: z.string().min(1, "Supplier name is required"),
	receivedDate: z.string().min(1, "Received date is required"),
	notes: z.string(),
});

function GRNRouteComponent() {
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<GRNStatusFilter>("ALL");
	const [selectedGRN, setSelectedGRN] = useState<GRNDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);

	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["grns", { page, pageSize, searchTerm, statusFilter }],
		queryFn: () =>
			getGRNs({
				page,
				pageSize,
				search: searchTerm,
				status: statusFilter,
			}),
		staleTime: 30_000,
	});

	const createMutation = useMutation({
		mutationFn: createGRN,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["grns"] });
			setIsCreateOpen(false);
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: GRNStatus }) =>
			updateGRNStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["grns"] });
		},
	});

	const form = useForm({
		defaultValues: {
			grnNumber: "",
			transferOrderNumber: "",
			supplier: "",
			receivedDate: "",
			notes: "",
		},
		validators: {
			onBlur: createGRNSchema,
			onSubmit: createGRNSchema,
		},
		onSubmit: async ({ value }) => {
			const parsedDate = new Date(value.receivedDate);
			await createMutation.mutateAsync({
				grnNumber: value.grnNumber,
				transferOrderNumber: value.transferOrderNumber || undefined,
				supplier: value.supplier,
				receivedDate: parsedDate,
				notes: value.notes || undefined,
			});
			form.reset();
		},
	});

	const grns = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const getStatusColor = (status: GRNStatus) => {
		const colors: Record<GRNStatus, string> = {
			pending: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			partially_received: "bg-amber-500/10 text-amber-600 border-amber-500/20",
			completed: "bg-green-500/10 text-green-600 border-green-500/20",
			cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status];
	};

	const formatStatus = (status: string) =>
		status
			.toLowerCase()
			.replace("_", " ")
			.replace(/\b\w/g, (l) => l.toUpperCase());

	const handleViewGRN = (grn: GRNDetail) => {
		setSelectedGRN(grn);
		setIsViewOpen(true);
	};

	const handleUpdateStatus = (id: string, status: GRNStatus) => {
		statusMutation.mutate({ id, status });
		if (isViewOpen) {
			setIsViewOpen(false);
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Goods Receipt Notes (GRN)
					</h1>
					<p className="text-muted-foreground">
						Manage incoming inventory and track receipts
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
							Create GRN
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Create New GRN</DialogTitle>
							<DialogDescription>
								Enter the details for the new goods receipt note
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
										name="grnNumber"
										children={(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														GRN Number
													</FieldLabel>
													<Input
														id={field.name}
														value={field.state.value}
														placeholder="GRN-2024-001"
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
										name="transferOrderNumber"
										children={(field) => (
											<Field>
												<FieldLabel htmlFor={field.name}>
													Transfer Order Number
												</FieldLabel>
												<Input
													id={field.name}
													value={field.state.value}
													placeholder="TO-2024-001"
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
											</Field>
										)}
									/>
								</div>

								<form.Field
									name="supplier"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>Supplier</FieldLabel>
												<Input
													id={field.name}
													value={field.state.value}
													placeholder="Enter supplier name"
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
									name="receivedDate"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>
													Received Date
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
										<Button type="submit" disabled={isSubmitting || !canSubmit}>
											{isSubmitting ? "Creating..." : "Create GRN"}
										</Button>
									</DialogFooter>
								)}
							</form.Subscribe>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-4">
					{grnStatuses.map((status) => (
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
							<CardTitle>GRN List</CardTitle>
							<CardDescription>
								View and manage all goods receipt notes
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search GRNs..."
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
									setStatusFilter(value as GRNStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Status</SelectItem>
									{grnStatuses.map((status) => (
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
									<TableHead>GRN Number</TableHead>
									<TableHead>Transfer Order</TableHead>
									<TableHead>Supplier</TableHead>
									<TableHead>Received Date</TableHead>
									<TableHead>Items</TableHead>
									<TableHead>Status</TableHead>
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
											Loading GRNs...
										</TableCell>
									</TableRow>
								) : grns.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No GRNs found.
										</TableCell>
									</TableRow>
								) : (
									grns.map((grn) => (
										<TableRow key={grn.id}>
											<TableCell className="font-medium">
												{grn.grnNumber}
											</TableCell>
											<TableCell>{grn.transferOrderNumber || "-"}</TableCell>
											<TableCell>{grn.supplier}</TableCell>
											<TableCell>
												{grn.receivedDate.toLocaleDateString()}
											</TableCell>
											<TableCell>
												{grn.receivedItems}/{grn.totalItems}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getStatusColor(grn.status)}
												>
													{formatStatus(grn.status)}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleViewGRN(grn)}
													>
														<Eye className="h-4 w-4" />
													</Button>
													{grn.status === "pending" && (
														<>
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "completed")
																}
																disabled={statusMutation.status === "pending"}
															>
																<CheckCircle className="h-4 w-4 text-green-600" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "cancelled")
																}
																disabled={statusMutation.status === "pending"}
															>
																<XCircle className="h-4 w-4 text-red-600" />
															</Button>
														</>
													)}
												</div>
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
								of <span className="font-medium">{data.total}</span> GRNs
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

			{/* View GRN Dialog */}
			<Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>GRN Details</DialogTitle>
						<DialogDescription>
							View detailed information about this goods receipt note
						</DialogDescription>
					</DialogHeader>
					{selectedGRN && (
						<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
							<div className="space-y-6">
								<div className="grid gap-4 sm:grid-cols-2">
									<div>
										<Label className="text-xs text-muted-foreground">
											GRN Number
										</Label>
										<p className="text-sm font-medium">
											{selectedGRN.grnNumber}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Transfer Order
										</Label>
										<p className="text-sm font-medium">
											{selectedGRN.transferOrderNumber || "-"}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Supplier
										</Label>
										<p className="text-sm font-medium">
											{selectedGRN.supplier}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Received Date
										</Label>
										<p className="text-sm font-medium">
											{selectedGRN.receivedDate.toLocaleDateString()}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Status
										</Label>
										<Badge
											variant="outline"
											className={getStatusColor(selectedGRN.status)}
										>
											{formatStatus(selectedGRN.status)}
										</Badge>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Created By
										</Label>
										<p className="text-sm font-medium">
											{selectedGRN.createdBy}
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
													<TableHead>Expected</TableHead>
													<TableHead>Received</TableHead>
													<TableHead>Location</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{selectedGRN.items.map((item) => (
													<TableRow key={item.id}>
														<TableCell className="font-medium">
															{item.sku}
														</TableCell>
														<TableCell>{item.description}</TableCell>
														<TableCell>{item.expectedQuantity}</TableCell>
														<TableCell>{item.receivedQuantity}</TableCell>
														<TableCell>
															{item.location || "Not assigned"}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</div>

								{selectedGRN.notes && (
									<div>
										<Label className="text-xs text-muted-foreground">
											Notes
										</Label>
										<p className="text-sm">{selectedGRN.notes}</p>
									</div>
								)}

								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setIsViewOpen(false)}
									>
										Close
									</Button>
									{selectedGRN.status === "pending" && (
										<Button
											onClick={() => {
												handleUpdateStatus(selectedGRN.id, "completed");
											}}
											disabled={statusMutation.status === "pending"}
										>
											Mark as Completed
										</Button>
									)}
								</DialogFooter>
							</div>
						</ScrollArea>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
