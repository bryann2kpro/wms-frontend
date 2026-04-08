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
import { Input } from "@/components/ui/input";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Package,
	CheckCircle2,
	AlertTriangle,
	ChevronLeft,
	Printer,
	Zap,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { usePermissions } from "@/lib/permissions";
import {
	getDOById,
	updateDOStatus,
	reportShortageDamage,
	type DeliveryOrder,
	type DOStatus,
	type ExceptionType,
} from "@/data/do.mock-data";

export const Route = createFileRoute("/admin/do-detail")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Delivery Order"]);
	},
	component: DODetailComponent,
	head: () => ({
		meta: [
			{
				title: "Delivery Order Detail - SME Edaran WMS",
				description:
					"View delivery order item details, status timeline, and fulfillment progress.",
			},
		],
	}),
});

function DODetailComponent() {
	const { id } = useParams({ from: "/admin/do-detail/$id" });
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { read, create, update } = usePermissions(user);
	const queryClient = useQueryClient();
	const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [exceptionFiles, setExceptionFiles] = useState<UploadedFile[]>([]);

	const { data: do_, isLoading } = useQuery({
		queryKey: ["do", id],
		queryFn: () => getDOById(id),
		staleTime: 30_000,
	});

	const statusMutation = useMutation({
		mutationFn: (status: DOStatus) => updateDOStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["do", id] });
			queryClient.invalidateQueries({ queryKey: ["dos"] });
		},
	});

	const exceptionMutation = useMutation({
		mutationFn: ({
			itemId,
			type,
			quantity,
			notes,
		}: {
			itemId: string;
			type: ExceptionType;
			quantity: number;
			notes?: string;
		}) =>
			reportShortageDamage(
				id,
				itemId,
				type,
				quantity,
				notes,
				exceptionFiles[0]?.preview,
				user?.id || "",
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["do", id] });
			queryClient.invalidateQueries({ queryKey: ["exceptions"] });
			setIsExceptionDialogOpen(false);
			setExceptionFiles([]);
			setSelectedItemId(null);
		},
	});

	if (isLoading || !do_) {
		return (
			<div className="container mx-auto p-6">
				<div className="text-center">Loading...</div>
			</div>
		);
	}

	const getStatusColor = (status: DOStatus) => {
		const colors: Record<DOStatus, string> = {
			CREATED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			PICKING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
			PACKED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
			READY_FOR_COLLECTION:
				"bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
			COLLECTED: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
			DELIVERED_PENDING_PROOF:
				"bg-orange-500/10 text-orange-600 border-orange-500/20",
			DELIVERED_CONFIRMED: "bg-green-500/10 text-green-600 border-green-500/20",
			CANCELLED: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const formatStatus = (status: string) => {
		return status
			.replace(/_/g, " ")
			.toLowerCase()
			.replace(/\b\w/g, (l) => l.toUpperCase());
	};

	const handleStatusChange = (newStatus: DOStatus) => {
		statusMutation.mutate(newStatus);
	};

	const handleExceptionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const itemId = selectedItemId || "";
		const type = formData.get("type") as ExceptionType;
		const quantity = Number(formData.get("quantity"));
		const notes = formData.get("notes") as string;

		exceptionMutation.mutate({ itemId, type, quantity, notes });
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/admin/do-work-queue" })}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="flex-1">
					<h1 className="text-3xl font-bold tracking-tight">{do_.doNumber}</h1>
					<p className="text-muted-foreground">Delivery Order Details</p>
				</div>
				{read("Delivery Order") && (
					<Button variant="outline" onClick={() => window.print()}>
						<Printer className="mr-2 h-4 w-4" />
						Print DO
					</Button>
				)}
			</div>

			{/* Header Info */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Status</CardTitle>
					</CardHeader>
					<CardContent>
						<Badge variant="outline" className={getStatusColor(do_.status)}>
							{formatStatus(do_.status)}
						</Badge>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Outlet</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm font-medium">{do_.outlet}</p>
						{do_.outletAddress && (
							<p className="text-xs text-muted-foreground">
								{do_.outletAddress}
							</p>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Scheduled Delivery
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">
							{do_.scheduledDeliveryDate.toLocaleDateString()}
						</p>
					</CardContent>
				</Card>
				{do_.isEmergency && (
					<Card className="md:col-span-3 border-amber-500/30 bg-amber-500/5">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<Zap className="h-4 w-4 text-amber-600" aria-hidden />
								Delivery type
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Badge
								variant="outline"
								className="bg-amber-500/10 text-amber-700 border-amber-500/30"
							>
								Emergency delivery
							</Badge>
							<p className="text-xs text-muted-foreground mt-2">
								This order was assigned to the next delivery day regardless of
								cutoff time.
							</p>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Items Table */}
			<Card>
				<CardHeader>
					<CardTitle>Items</CardTitle>
					<CardDescription>Delivery order line items</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>SKU</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Required Qty</TableHead>
									<TableHead>Picked Qty</TableHead>
									<TableHead>Packed Qty</TableHead>
									<TableHead>Location</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{do_.items.map((item) => (
									<TableRow key={item.id}>
										<TableCell className="font-medium">{item.sku}</TableCell>
										<TableCell>{item.description}</TableCell>
										<TableCell>{item.requiredQuantity}</TableCell>
										<TableCell>{item.pickedQuantity}</TableCell>
										<TableCell>{item.packedQuantity}</TableCell>
										<TableCell>{item.location || "-"}</TableCell>
										<TableCell className="text-right">
											{create("Exception") && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														setSelectedItemId(item.id);
														setIsExceptionDialogOpen(true);
													}}
												>
													<AlertTriangle className="h-4 w-4" />
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Action Buttons */}
			<Card>
				<CardHeader>
					<CardTitle>Actions</CardTitle>
					<CardDescription>Update delivery order status</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{update("Delivery Order") && do_.status === "CREATED" && (
						<Button
							onClick={() => handleStatusChange("PICKING")}
							disabled={statusMutation.isPending}
						>
							<Package className="mr-2 h-4 w-4" />
							Mark Picking
						</Button>
					)}
					{update("Delivery Order") && do_.status === "PICKING" && (
						<Button
							onClick={() => handleStatusChange("PACKED")}
							disabled={statusMutation.isPending}
						>
							<Package className="mr-2 h-4 w-4" />
							Mark Packed
						</Button>
					)}
					{update("Delivery Order") && do_.status === "PACKED" && (
						<Button
							onClick={() => handleStatusChange("READY_FOR_COLLECTION")}
							disabled={statusMutation.isPending}
						>
							<CheckCircle2 className="mr-2 h-4 w-4" />
							Mark Ready for Collection
						</Button>
					)}
				</CardContent>
			</Card>

			{/* Shortage/Damage Reports */}
			{do_.shortageDamageReports && do_.shortageDamageReports.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Shortage/Damage Reports</CardTitle>
						<CardDescription>Exception reports for this DO</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{do_.shortageDamageReports.map((report) => (
								<div key={report.id} className="rounded-lg border p-3">
									<div className="flex items-center justify-between">
										<div>
											<p className="font-medium">
												{report.type} - Qty: {report.quantity}
											</p>
											{report.notes && (
												<p className="text-sm text-muted-foreground">
													{report.notes}
												</p>
											)}
										</div>
										<Badge
											variant="outline"
											className={
												report.status === "approved"
													? "bg-green-500/10 text-green-600"
													: report.status === "rejected"
														? "bg-red-500/10 text-red-600"
														: "bg-yellow-500/10 text-yellow-600"
											}
										>
											{report.status}
										</Badge>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Exception Dialog */}
			<Dialog
				open={isExceptionDialogOpen}
				onOpenChange={setIsExceptionDialogOpen}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Report Shortage/Damage</DialogTitle>
						<DialogDescription>
							Report an exception for the selected item
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleExceptionSubmit}>
						<FieldGroup className="space-y-4">
							<Field>
								<FieldLabel>Exception Type</FieldLabel>
								<Select name="type" required>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="SHORTAGE">Shortage</SelectItem>
										<SelectItem value="DAMAGE">Damage</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel>Quantity Affected</FieldLabel>
								<Input
									type="number"
									name="quantity"
									min="1"
									required
									placeholder="Enter quantity"
								/>
							</Field>
							<Field>
								<FieldLabel>Notes</FieldLabel>
								<Textarea
									name="notes"
									placeholder="Enter additional notes..."
									rows={3}
								/>
							</Field>
							<Field>
								<FieldLabel>Photo (Optional)</FieldLabel>
								<FileUpload
									files={exceptionFiles}
									onFilesChange={setExceptionFiles}
									maxFiles={1}
									accept="image/*"
								/>
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsExceptionDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={exceptionMutation.isPending}>
								{exceptionMutation.isPending
									? "Submitting..."
									: "Submit Report"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
