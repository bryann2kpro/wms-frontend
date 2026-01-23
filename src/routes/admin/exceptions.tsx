import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
	Search,
	Eye,
	CheckCircle2,
	XCircle,
	ChevronLeft,
	ChevronRight,
	AlertTriangle,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { usePermissions } from "@/lib/permissions";
import {
	type Exception,
	type ExceptionStatusFilter,
	type ExceptionType,
	getExceptions,
	approveException,
	rejectException,
} from "@/data/exceptions.mock-data";

export const Route = createFileRoute("/admin/exceptions")({
	component: ExceptionsComponent,
});

const exceptionStatuses: Array<ExceptionStatusFilter> = [
	"ALL",
	"pending",
	"approved",
	"rejected",
];

const exceptionTypes: Array<ExceptionType | "ALL"> = [
	"ALL",
	"SHORTAGE",
	"DAMAGE",
];

function ExceptionsComponent() {
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<ExceptionStatusFilter>("ALL");
	const [typeFilter, setTypeFilter] = useState<ExceptionType | "ALL">("ALL");
	const [selectedException, setSelectedException] = useState<Exception | null>(
		null,
	);
	const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: [
			"exceptions",
			{ page, pageSize, searchTerm, statusFilter, typeFilter },
		],
		queryFn: () =>
			getExceptions({
				page,
				pageSize,
				search: searchTerm,
				status: statusFilter,
				type: typeFilter,
			}),
		staleTime: 30_000,
	});

	const approveMutation = useMutation({
		mutationFn: (id: string) =>
			approveException(id, user?.id || "", user?.name || ""),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["exceptions"] });
			setIsApproveDialogOpen(false);
			setSelectedException(null);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			rejectException(id, reason, user?.id || "", user?.name || ""),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["exceptions"] });
			setIsRejectDialogOpen(false);
			setSelectedException(null);
		},
	});

	const exceptions = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			approved: "bg-green-500/10 text-green-600 border-green-500/20",
			rejected: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const getTypeColor = (type: ExceptionType) => {
		return type === "SHORTAGE"
			? "bg-blue-500/10 text-blue-600 border-blue-500/20"
			: "bg-orange-500/10 text-orange-600 border-orange-500/20";
	};

	const formatStatus = (status: string) => {
		return status.charAt(0).toUpperCase() + status.slice(1);
	};

	const handleApprove = () => {
		if (selectedException) {
			approveMutation.mutate(selectedException.id);
		}
	};

	const handleReject = (reason: string) => {
		if (selectedException) {
			rejectMutation.mutate({ id: selectedException.id, reason });
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Exceptions</h1>
					<p className="text-muted-foreground">
						Manage shortage and damage reports
					</p>
				</div>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Pending</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.pending ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Approved</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.approved ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Rejected</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byStatus.rejected ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Total</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{summary.total}</div>
						</CardContent>
					</Card>
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Exception List</CardTitle>
							<CardDescription>
								View and manage all exception reports
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search exceptions..."
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
									setStatusFilter(value as ExceptionStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									{exceptionStatuses.map((status) => (
										<SelectItem key={status} value={status}>
											{formatStatus(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={typeFilter}
								onValueChange={(value) => {
									setTypeFilter(value as ExceptionType | "ALL");
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by type" />
								</SelectTrigger>
								<SelectContent>
									{exceptionTypes.map((type) => (
										<SelectItem key={type} value={type}>
											{type === "ALL" ? "All Types" : type}
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
									<TableHead>DO Number</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Quantity</TableHead>
									<TableHead>Reported By</TableHead>
									<TableHead>Reported At</TableHead>
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
											Loading exceptions...
										</TableCell>
									</TableRow>
								) : exceptions.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-24 text-center text-muted-foreground"
										>
											No exceptions found.
										</TableCell>
									</TableRow>
								) : (
									exceptions.map((exc) => (
										<TableRow key={exc.id}>
											<TableCell className="font-medium">
												{exc.doNumber}
											</TableCell>
											<TableCell>{exc.sku}</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getTypeColor(exc.type)}
												>
													{exc.type}
												</Badge>
											</TableCell>
											<TableCell>{exc.quantity}</TableCell>
											<TableCell>{exc.reportedByName}</TableCell>
											<TableCell>
												{exc.reportedAt.toLocaleDateString()}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getStatusColor(exc.status)}
												>
													{formatStatus(exc.status)}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														onClick={() =>
															navigate({
																to: "/admin/exceptions/$id",
																params: { id: exc.id },
															})
														}
													>
														<Eye className="h-4 w-4" />
													</Button>
													{hasPermission("exception:approve") &&
														exc.status === "pending" && (
															<>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => {
																		setSelectedException(exc);
																		setIsApproveDialogOpen(true);
																	}}
																>
																	<CheckCircle2 className="h-4 w-4 text-green-600" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => {
																		setSelectedException(exc);
																		setIsRejectDialogOpen(true);
																	}}
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
								of <span className="font-medium">{data.total}</span> exceptions
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

			{/* Approve Dialog */}
			<Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Approve Exception</DialogTitle>
						<DialogDescription>
							Are you sure you want to approve this exception? This will trigger
							an inventory adjustment.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsApproveDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleApprove}
							disabled={approveMutation.isPending}
						>
							{approveMutation.isPending ? "Approving..." : "Approve"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reject Dialog */}
			<Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject Exception</DialogTitle>
						<DialogDescription>
							Please provide a reason for rejecting this exception.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const reason = formData.get("reason") as string;
							if (reason) {
								handleReject(reason);
							}
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel>Rejection Reason</FieldLabel>
								<Textarea
									name="reason"
									placeholder="Enter rejection reason..."
									required
									rows={3}
								/>
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsRejectDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="destructive"
								disabled={rejectMutation.isPending}
							>
								{rejectMutation.isPending ? "Rejecting..." : "Reject"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
