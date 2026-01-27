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
import { Separator } from "@/components/ui/separator";
import {
	Plus,
	Search,
	Eye,
	CheckCircle,
	XCircle,
	ChevronLeft,
	ChevronRight,
	Edit,
	Send,
	Package,
	Calendar,
	FileText,
	Upload,
	User,
	Clock,
	Info,
} from "lucide-react";
import {
	type GRNDetail,
	type GRNStatus,
	type GRNStatusFilter,
	getGRNs,
	createGRN,
	updateGRNStatus,
} from "@/data/grn.mock-data";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { IntegrationLogPanel } from "@/components/integration-log-panel";

export const Route = createFileRoute("/admin/grn")({
	component: GRNRouteComponent,
});

const grnStatuses: GRNStatus[] = [
	"Draft",
	"Submitted",
	"Failed",
];

const createGRNSchema = z.object({
	grnNumber: z
		.string()
		.min(1, "GRN number is required")
		.regex(/^GRN-20\d{2}-[A-Z0-9]+$/, "Use format like GRN-2024-001"),
	poReference: z.string().min(1, "PO Reference is required"),
	supplierDO: z.string().min(1, "Supplier DO is required"),
	receivedDate: z.string().min(1, "Received date is required"),
	notes: z.string(),
});

function GRNRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<GRNStatusFilter>("ALL");
	const [selectedGRN, setSelectedGRN] = useState<GRNDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
	const [grnItems, setGrnItems] = useState<Array<{ sku: string; qty: number }>>(
		[],
	);
	const [skuSearch, setSkuSearch] = useState("");

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
			poReference: "",
			supplierDO: "",
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
				poReference: value.poReference,
				supplierDO: value.supplierDO,
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

	const getStatusColor = (status: GRNStatus | null | undefined) => {
		if (!status) return "bg-gray-500/10 text-gray-600 border-gray-500/20";
		const colors: Record<GRNStatus, string> = {
			Draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
			Submitted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			Approved: "bg-green-500/10 text-green-600 border-green-500/20",
			"Sent-to-ES": "bg-purple-500/10 text-purple-600 border-purple-500/20",
			Failed: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
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
					<DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
						<DialogHeader className="pb-4">
							<DialogTitle className="text-2xl font-semibold flex items-center gap-2">
								<Package className="h-5 w-5 text-primary" />
								Create New GRN
							</DialogTitle>
							<DialogDescription className="text-base">
								Enter the details for the new goods receipt note
							</DialogDescription>
						</DialogHeader>
						<Separator />
						<ScrollArea className="flex-1 pr-4">
							<form
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
								className="space-y-6 py-4"
							>
								<div className="grid gap-6 lg:grid-cols-3">
									<div className="lg:col-span-2 space-y-6">
										{/* Basic Information Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<FileText className="h-4 w-4 text-muted-foreground" />
													Basic Information
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<FieldGroup>
													<div className="grid gap-4 sm:grid-cols-2">
														<form.Field
															name="grnNumber"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
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
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
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
															name="poReference"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
																return (
																	<Field data-invalid={isInvalid}>
																		<FieldLabel htmlFor={field.name}>
																			PO Reference
																		</FieldLabel>
																		<Input
																			id={field.name}
																			value={field.state.value}
																			placeholder="PO-2024-001"
																			onBlur={field.handleBlur}
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
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
														name="supplierDO"
														children={(field) => {
															const isInvalid =
																field.state.meta.isTouched &&
																!field.state.meta.isValid;
															return (
																<Field data-invalid={isInvalid}>
																	<FieldLabel htmlFor={field.name}>
																		Supplier DO
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
																field.state.meta.isTouched &&
																!field.state.meta.isValid;
															return (
																<Field data-invalid={isInvalid}>
																	<FieldLabel htmlFor={field.name} className="flex items-center gap-2">
																		<Calendar className="h-4 w-4 text-muted-foreground" />
																		Received Date/Time
																	</FieldLabel>
																	<Input
																		id={field.name}
																		type="datetime-local"
																		value={field.state.value}
																		onBlur={field.handleBlur}
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
																		aria-invalid={isInvalid}
																	/>
																	{isInvalid && (
																		<FieldError errors={field.state.meta.errors} />
																	)}
																</Field>
															);
														}}
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
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="flex gap-2">
													<div className="relative flex-1">
														<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
														<Input
															placeholder="Search or enter SKU..."
															value={skuSearch}
															onChange={(e) => setSkuSearch(e.target.value)}
															className="pl-9"
															onKeyDown={(e) => {
																if (e.key === "Enter") {
																	e.preventDefault();
																	if (skuSearch.trim()) {
																		setGrnItems([
																			...grnItems,
																			{ sku: skuSearch.trim(), qty: 1 },
																		]);
																		setSkuSearch("");
																	}
																}
															}}
														/>
													</div>
													<Button
														type="button"
														variant="outline"
														onClick={() => {
															if (skuSearch.trim()) {
																setGrnItems([
																	...grnItems,
																	{ sku: skuSearch.trim(), qty: 1 },
																]);
																setSkuSearch("");
															}
														}}
														disabled={!skuSearch.trim()}
													>
														<Plus className="mr-2 h-4 w-4" />
														Add Item
													</Button>
												</div>
												<div className="rounded-lg border">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>SKU</TableHead>
																<TableHead>Quantity</TableHead>
																<TableHead className="text-right w-[80px]">
																	Actions
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{grnItems.length === 0 ? (
																<TableRow>
																	<TableCell
																		colSpan={3}
																		className="h-32 text-center"
																	>
																		<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
																			<Package className="h-8 w-8 opacity-50" />
																			<p className="text-sm">No items added yet</p>
																			<p className="text-xs">Search and add SKUs above</p>
																		</div>
																	</TableCell>
																</TableRow>
															) : (
																grnItems.map((item, index) => (
																	<TableRow key={index}>
																		<TableCell className="font-medium">
																			{item.sku}
																		</TableCell>
																		<TableCell>
																			<Input
																				type="number"
																				min="1"
																				value={item.qty}
																				onChange={(e) => {
																					const newItems = [...grnItems];
																					newItems[index].qty = Number(
																						e.target.value,
																					);
																					setGrnItems(newItems);
																				}}
																				className="w-24"
																			/>
																		</TableCell>
																		<TableCell className="text-right">
																			<Button
																				type="button"
																				variant="ghost"
																				size="icon"
																				onClick={() => {
																					setGrnItems(
																						grnItems.filter(
																							(_, i) => i !== index,
																						),
																					);
																				}}
																				className="text-destructive hover:text-destructive"
																			>
																				<XCircle className="h-4 w-4" />
																			</Button>
																		</TableCell>
																	</TableRow>
																))
															)}
														</TableBody>
													</Table>
												</div>
											</CardContent>
										</Card>

										{/* Proof Upload Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<Upload className="h-4 w-4 text-muted-foreground" />
													Proof Upload
												</CardTitle>
												<CardDescription className="text-xs">
													Upload supporting documents (max 5 files)
												</CardDescription>
											</CardHeader>
											<CardContent>
												<FileUpload
													files={proofFiles}
													onFilesChange={setProofFiles}
													maxFiles={5}
													accept="image/*,application/pdf"
												/>
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
															<FieldLabel htmlFor={field.name} className="sr-only">
																Notes
															</FieldLabel>
															<Textarea
																id={field.name}
																value={field.state.value}
																placeholder="Enter any additional notes or comments..."
																onBlur={field.handleBlur}
																onChange={(e) => field.handleChange(e.target.value)}
																className="min-h-[100px] resize-none"
															/>
														</Field>
													)}
												/>
											</CardContent>
										</Card>
									</div>

									{/* Right Panel: Audit Trail + Integration Status */}
									<div className="space-y-4">
										<Card className="sticky top-4">
											<CardHeader className="pb-3">
												<CardTitle className="text-sm font-semibold flex items-center gap-2">
													<User className="h-4 w-4 text-muted-foreground" />
													Audit Trail
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="space-y-1">
													<p className="text-xs text-muted-foreground flex items-center gap-2">
														<User className="h-3 w-3" />
														Created By
													</p>
													<p className="text-sm font-medium pl-5">
														{user?.displayName || "Current User"}
													</p>
												</div>
												<Separator />
												<div className="space-y-1">
													<p className="text-xs text-muted-foreground flex items-center gap-2">
														<Clock className="h-3 w-3" />
														Created At
													</p>
													<p className="text-sm font-medium pl-5">
														{new Date().toLocaleString()}
													</p>
												</div>
											</CardContent>
										</Card>
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-sm font-semibold flex items-center gap-2">
													<Info className="h-4 w-4 text-muted-foreground" />
													Integration Status
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-2">
												<div className="flex items-center gap-2">
													<div className="h-2 w-2 rounded-full bg-yellow-500" />
													<p className="text-xs font-medium">Not sent</p>
												</div>
												<p className="text-xs text-muted-foreground pl-4">
													GRN will be pushed to NetSuite after approval
												</p>
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
														setGrnItems([]);
														setProofFiles([]);
													}}
													disabled={isSubmitting}
												>
													Cancel
												</Button>
												{hasPermission("grn:create") && (
													<>
														<Button
															type="button"
															variant="outline"
															onClick={() => {
																// Save as draft
																form.handleSubmit();
															}}
															disabled={isSubmitting}
														>
															Save Draft
														</Button>
														<Button
															type="submit"
															disabled={isSubmitting || !canSubmit}
															className="min-w-[140px]"
														>
															{isSubmitting ? (
																<>
																	<Clock className="mr-2 h-4 w-4 animate-spin" />
																	Submitting...
																</>
															) : (
																<>
																	<Send className="mr-2 h-4 w-4" />
																	Submit for Approval
																</>
															)}
														</Button>
													</>
												)}
											</DialogFooter>
										</>
									)}
								</form.Subscribe>
							</form>
						</ScrollArea>
					</DialogContent>
				</Dialog>
			</div>

			{summary && summary.byStatus && (
				<div className="grid gap-3 md:grid-cols-3">
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
									<TableHead>PO Reference</TableHead>
									<TableHead>Supplier DO</TableHead>
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
											<TableCell>{grn.poReference || "-"}</TableCell>
											<TableCell>{grn.supplierDO || "-"}</TableCell>
											<TableCell>
												{grn.receivedDate?.toLocaleDateString() || "-"}
											</TableCell>
											<TableCell>
												{grn.receivedItems}/{grn.totalItems}
											</TableCell>
											<TableCell>
												{grn.status ? (
													<Badge
														variant="outline"
														className={getStatusColor(grn.status)}
													>
														{formatStatus(grn.status)}
													</Badge>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
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
													{hasPermission("grn:edit") &&
														grn.status &&
														(grn.status === "Draft" ||
															grn.status === "Submitted") && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() => {
																	setSelectedGRN(grn);
																	// setIsEditOpen(true);
																}}
															>
																<Edit className="h-4 w-4" />
															</Button>
														)}
													{hasPermission("grn:approve") &&
														grn.status === "Submitted" && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "Approved")
																}
																disabled={statusMutation.status === "pending"}
															>
																<CheckCircle className="h-4 w-4 text-green-600" />
															</Button>
														)}
													{hasPermission("grn:send_to_es") &&
														grn.status === "Approved" && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "Sent-to-ES")
																}
																disabled={statusMutation.status === "pending"}
															>
																<Send className="h-4 w-4 text-purple-600" />
															</Button>
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
				<DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>GRN Details</DialogTitle>
						<DialogDescription>
							View detailed information about this goods receipt note
						</DialogDescription>
					</DialogHeader>
					{selectedGRN && (
						<div className="grid gap-6 lg:grid-cols-3">
							<div className="lg:col-span-2 space-y-6">
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
													PO Reference
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.poReference || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Supplier DO
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.supplierDO || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Received Date
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.receivedDate?.toLocaleString() || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Status
												</Label>
												{selectedGRN.status ? (
													<Badge
														variant="outline"
														className={getStatusColor(selectedGRN.status)}
													>
														{formatStatus(selectedGRN.status)}
													</Badge>
												) : (
													<span className="text-sm text-muted-foreground">-</span>
												)}
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
									</div>
								</ScrollArea>
							</div>

							{/* Right Panel: Audit Trail + Integration Status */}
							<div className="space-y-4">
								<Card>
									<CardHeader>
										<CardTitle className="text-sm">Audit Trail</CardTitle>
									</CardHeader>
									<CardContent className="text-xs space-y-2">
										<div>
											<p className="text-muted-foreground">Created By</p>
											<p className="font-medium">{selectedGRN.createdBy}</p>
										</div>
										<div>
											<p className="text-muted-foreground">Created At</p>
											<p className="font-medium">
												{selectedGRN.createdAt?.toLocaleString() || "-"}
											</p>
										</div>
									</CardContent>
								</Card>
								<IntegrationLogPanel
									entityId={selectedGRN.id}
									entityType="grn"
									onRetry={(logId) => {
										console.log("Retry log:", logId);
									}}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsViewOpen(false)}>
							Close
						</Button>
						{hasPermission("grn:approve") &&
							selectedGRN?.status === "Submitted" && (
								<Button
									onClick={() => {
										handleUpdateStatus(selectedGRN.id, "Approved");
									}}
									disabled={statusMutation.status === "pending"}
								>
									Approve
								</Button>
							)}
						{hasPermission("grn:send_to_es") &&
							selectedGRN?.status === "Approved" && (
								<Button
									onClick={() => {
										handleUpdateStatus(selectedGRN.id, "Sent-to-ES");
									}}
									disabled={statusMutation.status === "pending"}
								>
									<Send className="mr-2 h-4 w-4" />
									Send to ES
								</Button>
							)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
