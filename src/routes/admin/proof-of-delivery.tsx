import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Search, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { usePermissions } from "@/lib/permissions";
import {
	getDOs,
	updateDOStatus,
	type DeliveryOrder,
} from "@/data/do.mock-data";

export const Route = createFileRoute("/admin/proof-of-delivery")({
	component: DeliveryProofComponent,
});

function DeliveryProofComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedDO, setSelectedDO] = useState<DeliveryOrder | null>(null);
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
	const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);

	// Get DOs with DELIVERED_PENDING_PROOF status
	const { data, isLoading } = useQuery({
		queryKey: ["dos-proof", { page, pageSize, searchTerm }],
		queryFn: () =>
			getDOs({
				page,
				pageSize,
				search: searchTerm,
				status: "DELIVERED_PENDING_PROOF",
			}),
		staleTime: 30_000,
	})

	const uploadMutation = useMutation({
		mutationFn: (doId: string) => updateDOStatus(doId, "DELIVERED_CONFIRMED"),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["dos-proof"] });
			queryClient.invalidateQueries({ queryKey: ["dos"] });
			setIsUploadDialogOpen(false);
			setProofFiles([]);
			setSelectedDO(null);
		},
	})

	const dos = data?.items ?? [];
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1

	const calculateDaysPending = (deliveredAt?: Date) => {
		if (!deliveredAt) return 0;
		const diff = Date.now() - deliveredAt.getTime();
		return Math.floor(diff / (1000 * 60 * 60 * 24));
	}

	const handleUploadProof = (do_: DeliveryOrder) => {
		setSelectedDO(do_);
		setIsUploadDialogOpen(true);
	}

	const handleSubmitProof = () => {
		if (selectedDO && proofFiles.length > 0) {
			uploadMutation.mutate(selectedDO.id);
		}
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Proof of Delivery</h1>
					<p className="text-muted-foreground">
						Upload signed delivery orders awaiting proof
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Pending Proof Queue</CardTitle>
							<CardDescription>
								DOs delivered but missing signed DO upload
							</CardDescription>
						</div>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search DOs..."
								value={searchTerm}
								onChange={(e) => {
									setSearchTerm(e.target.value);
									setPage(1)
								}}
								className="pl-9 sm:w-64"
							/>
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
									<TableHead>DO Number</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead>Dispatched Time</TableHead>
									<TableHead>Delivered Time</TableHead>
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
											Loading pending proof...
										</TableCell>
									</TableRow>
								) : dos.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No pending proof found.
										</TableCell>
									</TableRow>
								) : (
									dos.map((do_) => {
										const daysPending = calculateDaysPending(do_.deliveredAt);
										return (
											<TableRow key={do_.id}>
												<TableCell>{do_.toNumber}</TableCell>
												<TableCell className="font-medium">
													{do_.doNumber}
												</TableCell>
												
												<TableCell>{do_.outlet}</TableCell>
												<TableCell>
													{do_.dispatchedAt
														? do_.dispatchedAt.toLocaleString()
														: "-"}
												</TableCell>
												<TableCell>
													{do_.deliveredAt
														? do_.deliveredAt.toLocaleString()
														: "-"}
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleUploadProof(do_)}
													>
														<Upload className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										)
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
								of <span className="font-medium">{data.total}</span> DOs
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

			{/* Upload Proof Dialog */}
			<Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Upload Signed DO Proof</DialogTitle>
						<DialogDescription>
							Upload the signed delivery order photo or PDF for{" "}
							{selectedDO?.doNumber}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<FileUpload
							files={proofFiles}
							onFilesChange={setProofFiles}
							maxFiles={1}
							accept="image/*,application/pdf"
						/>
						{selectedDO && (
							<IntegrationLogPanel
								entityId={selectedDO.id}
								entityType="do"
								onRetry={(logId) => {
									// Handle retry
									console.log("Retry log:", logId);
								}}
							/>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsUploadDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSubmitProof}
							disabled={uploadMutation.isPending || proofFiles.length === 0}
						>
							{uploadMutation.isPending
								? "Uploading..."
								: "Confirm & Upload Proof"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
