import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	ChevronLeft,
	CheckCircle2,
	XCircle,
	AlertTriangle,
	Image as ImageIcon,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { usePermissions } from "@/lib/permissions";
import {
	getExceptionById,
	approveException,
	rejectException,
} from "@/data/exceptions.mock-data";

export const Route = createFileRoute("/admin/exception-detail")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Exception"]);
	},
	component: ExceptionDetailComponent,
	head: () => ({
		meta: [
			{
				title: "Exception Detail - SME Edaran WMS",
				description:
					"Inspect stock discrepancy details and take approval or rejection actions on exceptions.",
			},
		],
	}),
});

function ExceptionDetailComponent() {
	const { id } = useParams({ from: "/admin/exceptions/$id" });
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { approve } = usePermissions(user);
	const queryClient = useQueryClient();
	const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
	const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

	const { data: exception, isLoading } = useQuery({
		queryKey: ["exception", id],
		queryFn: () => getExceptionById(id),
		staleTime: 30_000,
	});

	const approveMutation = useMutation({
		mutationFn: () => approveException(id, user?.id || "", user?.name || ""),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["exception", id] });
			queryClient.invalidateQueries({ queryKey: ["exceptions"] });
			setIsApproveDialogOpen(false);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: (reason: string) =>
			rejectException(id, reason, user?.id || "", user?.name || ""),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["exception", id] });
			queryClient.invalidateQueries({ queryKey: ["exceptions"] });
			setIsRejectDialogOpen(false);
		},
	});

	if (isLoading || !exception) {
		return (
			<div className="container mx-auto p-6">
				<div className="text-center">Loading...</div>
			</div>
		);
	}

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			approved: "bg-green-500/10 text-green-600 border-green-500/20",
			rejected: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const getTypeColor = (type: string) => {
		return type === "SHORTAGE"
			? "bg-blue-500/10 text-blue-600 border-blue-500/20"
			: "bg-orange-500/10 text-orange-600 border-orange-500/20";
	};

	const formatStatus = (status: string) => {
		return status.charAt(0).toUpperCase() + status.slice(1);
	};

	const handleApprove = () => {
		approveMutation.mutate();
	};

	const handleReject = (reason: string) => {
		rejectMutation.mutate(reason);
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/admin/exceptions" })}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="flex-1">
					<h1 className="text-3xl font-bold tracking-tight">
						Exception Details
					</h1>
					<p className="text-muted-foreground">
						View exception report information
					</p>
				</div>
			</div>

			{/* Header Info */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Status</CardTitle>
					</CardHeader>
					<CardContent>
						<Badge
							variant="outline"
							className={getStatusColor(exception.status)}
						>
							{formatStatus(exception.status)}
						</Badge>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Type</CardTitle>
					</CardHeader>
					<CardContent>
						<Badge variant="outline" className={getTypeColor(exception.type)}>
							{exception.type}
						</Badge>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">DO Number</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm font-medium">{exception.doNumber}</p>
					</CardContent>
				</Card>
			</div>

			{/* Exception Details */}
			<Card>
				<CardHeader>
					<CardTitle>Exception Information</CardTitle>
					<CardDescription>
						Details about the reported exception
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<Label className="text-xs text-muted-foreground">SKU</Label>
							<p className="text-sm font-medium">{exception.sku}</p>
						</div>
						<div>
							<Label className="text-xs text-muted-foreground">
								Description
							</Label>
							<p className="text-sm font-medium">{exception.description}</p>
						</div>
						<div>
							<Label className="text-xs text-muted-foreground">Quantity</Label>
							<p className="text-sm font-medium">{exception.quantity}</p>
						</div>
						<div>
							<Label className="text-xs text-muted-foreground">
								Reported By
							</Label>
							<p className="text-sm font-medium">{exception.reportedByName}</p>
						</div>
						<div>
							<Label className="text-xs text-muted-foreground">
								Reported At
							</Label>
							<p className="text-sm">{exception.reportedAt.toLocaleString()}</p>
						</div>
					</div>
					{exception.notes && (
						<div>
							<Label className="text-xs text-muted-foreground">Notes</Label>
							<p className="text-sm">{exception.notes}</p>
						</div>
					)}
					{exception.photoUrl && (
						<div>
							<Label className="text-xs text-muted-foreground">
								Photo Evidence
							</Label>
							<div className="mt-2 rounded-lg border overflow-hidden">
								<img
									src={exception.photoUrl}
									alt="Exception evidence"
									className="w-full h-auto"
								/>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Approval Information */}
			{exception.status !== "pending" && (
				<Card>
					<CardHeader>
						<CardTitle>Decision Information</CardTitle>
						<CardDescription>Approval or rejection details</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{exception.status === "approved" && (
							<>
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<Label className="text-xs text-muted-foreground">
											Approved By
										</Label>
										<p className="text-sm font-medium">
											{exception.approvedByName}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Approved At
										</Label>
										<p className="text-sm">
											{exception.approvedAt?.toLocaleString()}
										</p>
									</div>
								</div>
							</>
						)}
						{exception.status === "rejected" && (
							<>
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<Label className="text-xs text-muted-foreground">
											Rejected By
										</Label>
										<p className="text-sm font-medium">
											{exception.rejectedByName}
										</p>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Rejected At
										</Label>
										<p className="text-sm">
											{exception.rejectedAt?.toLocaleString()}
										</p>
									</div>
								</div>
								{exception.rejectionReason && (
									<div>
										<Label className="text-xs text-muted-foreground">
											Rejection Reason
										</Label>
										<p className="text-sm">{exception.rejectionReason}</p>
									</div>
								)}
							</>
						)}
					</CardContent>
				</Card>
			)}

			{/* Action Buttons */}
			{approve("Exception") && exception.status === "pending" && (
				<Card>
					<CardHeader>
						<CardTitle>Actions</CardTitle>
						<CardDescription>Approve or reject this exception</CardDescription>
					</CardHeader>
					<CardContent className="flex gap-2">
						<Button
							onClick={() => setIsApproveDialogOpen(true)}
							disabled={approveMutation.isPending}
						>
							<CheckCircle2 className="mr-2 h-4 w-4" />
							Approve
						</Button>
						<Button
							variant="destructive"
							onClick={() => setIsRejectDialogOpen(true)}
							disabled={rejectMutation.isPending}
						>
							<XCircle className="mr-2 h-4 w-4" />
							Reject
						</Button>
					</CardContent>
				</Card>
			)}

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
