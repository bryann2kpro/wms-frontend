import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import {
	useQuery as useApolloQuery,
	useMutation as useApolloMutation,
} from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import {
	Search,
	Truck,
	PackageCheck,
	Upload,
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	Clock,
	FileText,
} from "lucide-react";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	DELIVERY_ORDERS_QUERY,
	SUBMIT_DELIVERY_PROOF_MUTATION,
	type DeliveryOrdersQueryData,
	type DeliveryOrdersQueryVariables,
	type SubmitDeliveryProofMutationData,
	type SubmitDeliveryProofMutationVariables,
} from "@/lib/graphql/delivery-orders";
import type { DeliveryOrder } from "@/lib/graphql/types";

export const Route = createFileRoute("/admin/proof-of-delivery")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Settlement"]);
	},
	component: DeliveryProofComponent,
});

/* ─── Helpers ─────────────────────────────────────────────── */

function formatRelativeDate(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffHours < 1) return "Less than an hour ago";
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;
	return date.toLocaleDateString("en-MY", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/* ─── Sub-components ───────────────────────────────────────── */

function PendingCard({
	do_,
	onUpload,
}: {
	do_: DeliveryOrder;
	onUpload: (do_: DeliveryOrder) => void;
}) {
	return (
		<div
			className="group relative flex flex-col gap-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-amber-400 hover:shadow-md"
			style={{ fontFamily: "'Figtree', sans-serif" }}
		>
			{/* Top row: icon + urgent badge */}
			<div className="flex items-start justify-between">
				<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Truck className="h-5 w-5" />
				</div>
				<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
					<span className="relative flex h-2 w-2">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
						<span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
					</span>
					Awaiting Proof
				</span>
			</div>

			{/* Order numbers */}
			<div className="space-y-1">
				<p
					className="text-xl font-bold tracking-tight text-slate-900"
					style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
				>
					{do_.doNo}
				</p>
				<p className="flex items-center gap-1.5 text-sm text-slate-500">
					<FileText className="h-3.5 w-3.5 shrink-0" />
					PO: <span className="font-medium text-slate-700">{do_.poNo}</span>
				</p>
			</div>

			{/* Divider */}
			<div className="h-px w-full bg-slate-100" />

			{/* Timestamp + action */}
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-1.5 text-xs text-slate-400">
					<Clock className="h-3.5 w-3.5 shrink-0" />
					<span>Shipped {formatRelativeDate(do_.updatedAt)}</span>
				</div>

				<Button
					size="sm"
					onClick={() => onUpload(do_)}
					className="shrink-0 gap-1.5 rounded-xl bg-amber-500 px-4 text-white shadow-sm hover:bg-amber-600 focus-visible:ring-amber-400"
				>
					<Upload className="h-3.5 w-3.5" />
					Upload Proof
				</Button>
			</div>
		</div>
	);
}

function LoadingSkeleton() {
	return (
		<>
			{[1, 2, 3, 4, 5, 6].map((i) => (
				<div
					key={i}
					className="rounded-2xl border border-slate-100 bg-white p-5"
					style={{ animationDelay: `${i * 80}ms` }}
				>
					<div className="animate-pulse space-y-4">
						<div className="flex items-start justify-between">
							<div className="h-11 w-11 rounded-xl bg-slate-100" />
							<div className="h-6 w-28 rounded-full bg-slate-100" />
						</div>
						<div className="space-y-2">
							<div className="h-6 w-40 rounded bg-slate-100" />
							<div className="h-4 w-32 rounded bg-slate-100" />
						</div>
						<div className="h-px bg-slate-100" />
						<div className="flex items-center justify-between">
							<div className="h-4 w-28 rounded bg-slate-100" />
							<div className="h-8 w-28 rounded-xl bg-slate-100" />
						</div>
					</div>
				</div>
			))}
		</>
	);
}

function AllClearState() {
	return (
		<div className="col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 py-20 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
				<PackageCheck className="h-8 w-8" />
			</div>
			<div className="space-y-1">
				<p
					className="text-lg font-semibold text-emerald-800"
					style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
				>
					All caught up!
				</p>
				<p className="text-sm text-emerald-600">
					No deliveries are waiting for proof right now.
				</p>
			</div>
		</div>
	);
}

/* ─── Main component ───────────────────────────────────────── */

function DeliveryProofComponent() {
	const [page, setPage] = useState(1);
	const pageSize = 12;
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedDO, setSelectedDO] = useState<DeliveryOrder | null>(null);
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
	const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [justCompleted, setJustCompleted] = useState<string | null>(null);

	const {
		data,
		loading: isLoading,
		refetch,
	} = useApolloQuery<DeliveryOrdersQueryData, DeliveryOrdersQueryVariables>(
		DELIVERY_ORDERS_QUERY,
		{
			variables: {
				filter: {
					status: "SHIPPED",
					...(searchTerm.trim() ? { doNo: searchTerm.trim() } : {}),
				},
				pageSize,
				pageNumber: page,
			},
			fetchPolicy: "cache-and-network",
		},
	);

	const [submitDeliveryProof] = useApolloMutation<
		SubmitDeliveryProofMutationData,
		SubmitDeliveryProofMutationVariables
	>(SUBMIT_DELIVERY_PROOF_MUTATION);

	const dos = data?.deliveryOrders?.query ?? [];
	const pagination = data?.deliveryOrders?.pagination;
	const totalPages = pagination ? Math.max(1, pagination.totalPages) : 1;
	const totalCount = pagination?.totalCount ?? 0;

	const handleOpenUpload = (do_: DeliveryOrder) => {
		setSelectedDO(do_);
		setProofFiles([]);
		setSubmitError(null);
		setIsUploadDialogOpen(true);
	};

	const handleCloseDialog = () => {
		if (isSubmitting) return;
		setIsUploadDialogOpen(false);
		setProofFiles([]);
		setSelectedDO(null);
		setSubmitError(null);
	};

	const handleSubmitProof = async () => {
		if (!selectedDO || proofFiles.length === 0) return;
		const file = proofFiles[0];
		if (!file.file) return;

		setIsSubmitting(true);
		setSubmitError(null);

		try {
			// Step 1 — upload file
			const formData = new FormData();
			formData.append("image", file.file);
			const token = getAccessToken();
			const uploadRes = await fetch(`${env.VITE_API_URL}/v1/upload`, {
				method: "POST",
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				body: formData,
			});

			if (!uploadRes.ok) {
				const err = await uploadRes.json().catch(() => ({}));
				throw new Error(
					(err as { message?: string }).message ?? "File upload failed",
				);
			}

			const body = (await uploadRes.json()) as {
				success: boolean;
				data: {
					url: string;
					originalName: string;
					size: number;
					mimetype: string;
				} | null;
			};
			const uploadData = body.data;
			if (!uploadData) {
				throw new Error("File upload failed");
			}

			// Step 2 — record proof + advance DO to DELIVERED
			await submitDeliveryProof({
				variables: {
					doId: selectedDO.id,
					fileUrl: uploadData.url,
					fileName: uploadData.originalName,
					fileSizeBytes: uploadData.size,
					mimeType: uploadData.mimetype,
				},
			});

			setJustCompleted(selectedDO.doNo);
			setTimeout(() => setJustCompleted(null), 3000);
			setIsUploadDialogOpen(false);
			setProofFiles([]);
			setSelectedDO(null);
			refetch();
		} catch (err) {
			setSubmitError(
				err instanceof Error
					? err.message
					: "Something went wrong. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div
			className="min-h-screen"
			style={{
				background: "linear-gradient(135deg, #fffbf0 0%, #f8fafc 60%)",
				fontFamily: "'Figtree', sans-serif",
			}}
		>
			<div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
				{/* ── Page Header ── */}
				<div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-200">
								<Truck className="h-6 w-6" />
							</div>
							<div>
								<h1
									className="text-3xl font-bold text-slate-900"
									style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
								>
									Proof of Delivery
								</h1>
								<p className="text-sm text-slate-500">
									Upload signed delivery confirmation for each shipment below
								</p>
							</div>
						</div>
					</div>

					{/* Pending count pill */}
					{totalCount > 0 && (
						<div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 shadow-sm">
							<span className="relative flex h-2.5 w-2.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
								<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
							</span>
							<span className="text-sm font-semibold text-amber-800">
								{totalCount} {totalCount === 1 ? "delivery" : "deliveries"} need
								your attention
							</span>
						</div>
					)}
				</div>

				{/* ── Success toast strip ── */}
				{justCompleted && (
					<div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
						<PackageCheck className="h-4 w-4 shrink-0 text-emerald-600" />
						<span>
							<span className="font-semibold">{justCompleted}</span> marked as
							delivered — great work!
						</span>
					</div>
				)}

				{/* ── Search ── */}
				<div className="relative max-w-xs">
					<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
					<Input
						placeholder="Search by DO number…"
						value={searchTerm}
						onChange={(e) => {
							setSearchTerm(e.target.value);
							setPage(1);
						}}
						className="rounded-xl border-slate-200 pl-10 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-amber-400"
					/>
				</div>

				{/* ── Card grid ── */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{isLoading && dos.length === 0 ? (
						<LoadingSkeleton />
					) : dos.length === 0 ? (
						<AllClearState />
					) : (
						dos.map((do_) => (
							<PendingCard key={do_.id} do_={do_} onUpload={handleOpenUpload} />
						))
					)}
				</div>

				{/* ── Pagination ── */}
				{pagination && totalPages > 1 && (
					<div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-5 py-3 shadow-sm">
						<p className="text-sm text-slate-500">
							Showing{" "}
							<span className="font-semibold text-slate-700">
								{(pagination.currentPage - 1) * pagination.count + 1}–
								{Math.min(
									pagination.currentPage * pagination.count,
									totalCount,
								)}
							</span>{" "}
							of{" "}
							<span className="font-semibold text-slate-700">{totalCount}</span>
						</p>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 rounded-lg"
								disabled={page === 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="px-1 text-sm font-medium text-slate-600">
								{page} / {totalPages}
							</span>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 rounded-lg"
								disabled={page === totalPages}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* ── Upload Dialog ── */}
			<Dialog open={isUploadDialogOpen} onOpenChange={handleCloseDialog}>
				<DialogContent className="max-w-lg rounded-2xl p-0 shadow-xl">
					{/* Coloured header band */}
					<div className="rounded-t-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-5">
						<DialogHeader>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm">
									<Upload className="h-5 w-5" />
								</div>
								<div>
									<DialogTitle className="text-base font-bold text-white">
										Upload Delivery Proof
									</DialogTitle>
									<p className="mt-0.5 text-xs text-amber-100">
										{selectedDO?.doNo} · PO: {selectedDO?.poNo}
									</p>
								</div>
							</div>
						</DialogHeader>
					</div>

					{/* Body */}
					<div className="space-y-5 px-6 py-5">
						{/* Instruction */}
						<p className="text-sm text-slate-600">
							Take a clear photo of the signed delivery form, or attach a PDF.
							Make sure all signatures and stamps are visible.
						</p>

						<FileUpload
							files={proofFiles}
							onFilesChange={setProofFiles}
							maxFiles={1}
							accept="image/*,application/pdf"
						/>

						{/* Error */}
						{submitError && (
							<div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
								<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
								<span>{submitError}</span>
							</div>
						)}
					</div>

					{/* Footer */}
					<DialogFooter className="rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4">
						<Button
							variant="ghost"
							onClick={handleCloseDialog}
							disabled={isSubmitting}
							className="rounded-xl text-slate-600 hover:bg-slate-100"
						>
							Cancel
						</Button>
						<Button
							onClick={handleSubmitProof}
							disabled={isSubmitting || proofFiles.length === 0}
							className="gap-2 rounded-xl bg-amber-500 px-6 text-white shadow hover:bg-amber-600 disabled:opacity-50"
						>
							{isSubmitting ? (
								<>
									<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Uploading…
								</>
							) : (
								<>
									<PackageCheck className="h-4 w-4" />
									Confirm Delivery
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
