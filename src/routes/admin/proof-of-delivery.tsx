import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
	Undo2,
	PackageX,
	CalendarClock,
	Plus,
	Trash2,
	ArrowLeft,
	ArrowRight,
} from "lucide-react";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	DELIVERY_ORDERS_QUERY,
	DELIVERY_ORDER_ITEMS_QUERY,
	SUBMIT_DELIVERY_PROOF_MUTATION,
	type DeliveryOrdersQueryData,
	type DeliveryOrdersQueryVariables,
	type DeliveryOrderItemsQueryData,
	type DeliveryOrderItemsQueryVariables,
	type SubmitDeliveryProofMutationData,
	type SubmitDeliveryProofMutationVariables,
} from "@/lib/graphql/delivery-orders";
import type {
	ReturnLineInput,
	ReturnPhotoInput,
	ReturnReason,
} from "@/lib/graphql/returns";
import type {
	DeliveryOrder,
	DeliveryOrderItemWithDetails,
} from "@/lib/graphql/types";

export const Route = createFileRoute("/admin/proof-of-delivery")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Settlement"]);
	},
	component: DeliveryProofComponent,
	head: () => ({
		meta: [
			{
				title: "Proof of Delivery - SME Edaran WMS",
				description:
					"Submit and manage proof of delivery records for completed outbound shipments.",
			},
		],
	}),
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

/** Upload a file via the shared /v1/upload endpoint and return its metadata. */
async function uploadFileToServer(file: File): Promise<{
	url: string;
	originalName: string;
	size: number;
	mimetype: string;
}> {
	const formData = new FormData();
	formData.append("image", file);
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
	if (!body.data) {
		throw new Error("File upload failed");
	}
	return body.data;
}

/* ─── Return capture types ─────────────────────────────────── */

type ReturnRow = {
	key: string;
	doItemId: string;
	skuId: string;
	skuCode: string | null;
	skuDescription: string | null;
	lotNo: string | null;
	expiryDate: string | null;
	maxQty: number;
	qty: string;
	reason: ReturnReason;
	conditionNotes: string;
	photos: UploadedFile[];
};

function makeReturnRow(item: DeliveryOrderItemWithDetails): ReturnRow {
	return {
		key: `${item.id}-${Date.now()}-${Math.random()}`,
		doItemId: item.id,
		skuId: item.skuId,
		skuCode: item.skuCode,
		skuDescription: item.skuDescription,
		lotNo: item.lotNo,
		expiryDate: item.expiryDate,
		maxQty: Number(item.qtyRequired) || 0,
		qty: "",
		reason: "DAMAGED",
		conditionNotes: "",
		photos: [],
	};
}

function isRowQtyValid(row: ReturnRow): boolean {
	const qty = Number(row.qty);
	return Number.isFinite(qty) && qty > 0 && qty <= row.maxQty;
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

/** One returned-goods line in the capture step. */
function ReturnRowCard({
	row,
	onChange,
	onRemove,
	disabled,
}: {
	row: ReturnRow;
	onChange: (row: ReturnRow) => void;
	onRemove: () => void;
	disabled: boolean;
}) {
	const qtyInvalid = row.qty !== "" && !isRowQtyValid(row);
	return (
		<div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
			{/* SKU header + remove */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold text-slate-800">
						{row.skuCode ?? "Unknown SKU"}
					</p>
					{row.skuDescription && (
						<p className="truncate text-xs text-slate-500">
							{row.skuDescription}
						</p>
					)}
					{(row.lotNo || row.expiryDate) && (
						<p className="mt-0.5 text-[11px] text-slate-400">
							{row.lotNo ? `Lot ${row.lotNo}` : ""}
							{row.lotNo && row.expiryDate ? " · " : ""}
							{row.expiryDate
								? `Exp ${new Date(row.expiryDate).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`
								: ""}
						</p>
					)}
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 shrink-0 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
					onClick={onRemove}
					disabled={disabled}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			</div>

			{/* Reason pills */}
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange({ ...row, reason: "DAMAGED" })}
					className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
						row.reason === "DAMAGED"
							? "border-red-300 bg-red-50 text-red-700"
							: "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
					}`}
				>
					<PackageX className="h-3.5 w-3.5" />
					Damaged
				</button>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange({ ...row, reason: "ABOUT_TO_EXPIRE" })}
					className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
						row.reason === "ABOUT_TO_EXPIRE"
							? "border-amber-300 bg-amber-50 text-amber-700"
							: "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
					}`}
				>
					<CalendarClock className="h-3.5 w-3.5" />
					About to Expire
				</button>
			</div>

			{/* Qty */}
			<div className="space-y-1">
				<label className="text-xs font-medium text-slate-600">
					Quantity returned{" "}
					<span className="font-normal text-slate-400">
						(delivered {row.maxQty})
					</span>
				</label>
				<Input
					type="number"
					min={0}
					step="any"
					inputMode="decimal"
					value={row.qty}
					disabled={disabled}
					onChange={(e) => onChange({ ...row, qty: e.target.value })}
					placeholder="0"
					className={`h-9 rounded-lg bg-white text-sm ${
						qtyInvalid
							? "border-red-300 focus-visible:ring-red-400"
							: "border-slate-200 focus-visible:ring-amber-400"
					}`}
				/>
				{qtyInvalid && (
					<p className="text-[11px] text-red-600">
						Must be between 0 and {row.maxQty}.
					</p>
				)}
			</div>

			{/* Condition notes */}
			<Textarea
				value={row.conditionNotes}
				disabled={disabled}
				onChange={(e) => onChange({ ...row, conditionNotes: e.target.value })}
				placeholder="Condition notes (optional) — e.g. carton crushed, leaking…"
				className="min-h-[60px] rounded-lg border-slate-200 bg-white text-sm placeholder:text-slate-400 focus-visible:ring-amber-400"
			/>

			{/* Photos */}
			<FileUpload
				files={row.photos}
				onFilesChange={(photos) => onChange({ ...row, photos })}
				maxFiles={3}
				accept="image/*"
				disabled={disabled}
			/>
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

	// Returned-goods capture (step 2)
	const [dialogStep, setDialogStep] = useState<1 | 2>(1);
	const [hasReturns, setHasReturns] = useState(false);
	const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
	const [addItemId, setAddItemId] = useState<string>("");

	const queryVars: DeliveryOrdersQueryVariables = {
		filter: {
			status: "SHIPPED",
			...(searchTerm.trim() ? { doNo: searchTerm.trim() } : {}),
		},
		pageSize,
		pageNumber: page,
	};
	const {
		data,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: [...qk.dos.all, "proof-of-delivery", queryVars] as const,
		queryFn: () =>
			gqlRequest<DeliveryOrdersQueryData, DeliveryOrdersQueryVariables>(
				DELIVERY_ORDERS_QUERY,
				queryVars,
			),
	});

	// DO line items for the selected DO — prefill data for return rows
	const { data: doItemsData, isLoading: doItemsLoading } = useQuery({
		queryKey: [...qk.dos.all, "items-for-return", selectedDO?.doNo ?? ""] as const,
		queryFn: () =>
			gqlRequest<DeliveryOrderItemsQueryData, DeliveryOrderItemsQueryVariables>(
				DELIVERY_ORDER_ITEMS_QUERY,
				{
					filter: { doNo: selectedDO?.doNo ?? "" },
					pageSize: 200,
					pageNumber: 1,
				},
			),
		enabled: isUploadDialogOpen && !!selectedDO,
	});

	const doItems = useMemo(
		() =>
			(doItemsData?.deliveryOrderItems?.query ?? []).filter(
				(item) => item.doNo === selectedDO?.doNo,
			),
		[doItemsData, selectedDO],
	);

	const { mutateAsync: submitDeliveryProof } = useMutation({
		mutationFn: (vars: SubmitDeliveryProofMutationVariables) =>
			gqlRequest<
				SubmitDeliveryProofMutationData,
				SubmitDeliveryProofMutationVariables
			>(SUBMIT_DELIVERY_PROOF_MUTATION, vars),
	});

	const dos = data?.deliveryOrders?.query ?? [];
	const pagination = data?.deliveryOrders?.pagination;
	const totalPages = pagination ? Math.max(1, pagination.totalPages) : 1;
	const totalCount = pagination?.totalCount ?? 0;

	const resetDialogState = () => {
		setProofFiles([]);
		setSelectedDO(null);
		setSubmitError(null);
		setDialogStep(1);
		setHasReturns(false);
		setReturnRows([]);
		setAddItemId("");
	};

	const handleOpenUpload = (do_: DeliveryOrder) => {
		resetDialogState();
		setSelectedDO(do_);
		setIsUploadDialogOpen(true);
	};

	const handleCloseDialog = () => {
		if (isSubmitting) return;
		setIsUploadDialogOpen(false);
		resetDialogState();
	};

	const handleAddReturnRow = (doItemId: string) => {
		const item = doItems.find((i) => i.id === doItemId);
		if (!item) return;
		setReturnRows((rows) => [...rows, makeReturnRow(item)]);
		setAddItemId("");
	};

	const returnsValid =
		!hasReturns ||
		(returnRows.length > 0 && returnRows.every((row) => isRowQtyValid(row)));

	const handleSubmitProof = async () => {
		if (!selectedDO || proofFiles.length === 0) return;
		const file = proofFiles[0];
		if (!file.file) return;
		if (!returnsValid) return;

		setIsSubmitting(true);
		setSubmitError(null);

		try {
			// Step 1 — upload proof file
			const uploadData = await uploadFileToServer(file.file);

			// Step 2 — upload return photos and build return lines
			let returns: ReturnLineInput[] | null = null;
			if (hasReturns && returnRows.length > 0) {
				returns = [];
				for (const row of returnRows) {
					const photos: ReturnPhotoInput[] = [];
					for (const photo of row.photos) {
						if (!photo.file) continue;
						const uploaded = await uploadFileToServer(photo.file);
						photos.push({
							fileUrl: uploaded.url,
							fileName: uploaded.originalName,
							fileSizeBytes: uploaded.size,
							mimeType: uploaded.mimetype,
						});
					}
					returns.push({
						doItemId: row.doItemId,
						skuId: row.skuId,
						lotNo: row.lotNo,
						expiryDate: row.expiryDate,
						qtyReturned: String(Number(row.qty)),
						reason: row.reason,
						conditionNotes: row.conditionNotes.trim() || null,
						photos,
					});
				}
			}

			// Step 3 — one atomic call: proof + DELIVERED + return document
			await submitDeliveryProof({
				doId: selectedDO.id,
				fileUrl: uploadData.url,
				fileName: uploadData.originalName,
				fileSizeBytes: uploadData.size,
				mimeType: uploadData.mimetype,
				returns,
			});

			setJustCompleted(selectedDO.doNo);
			setTimeout(() => setJustCompleted(null), 3000);
			setIsUploadDialogOpen(false);
			resetDialogState();
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

	const totalReturnUnits = returnRows.reduce(
		(sum, row) => sum + (Number(row.qty) || 0),
		0,
	);

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
								{totalCount === 0
									? 0
									: (pagination.currentPage - 1) * pageSize + 1}
								–
								{totalCount === 0
									? 0
									: Math.min(
											pagination.currentPage * pageSize,
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

			{/* ── Upload Dialog (two steps: proof → returned goods) ── */}
			<Dialog open={isUploadDialogOpen} onOpenChange={handleCloseDialog}>
				<DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0 shadow-xl">
					{/* Coloured header band */}
					<div className="rounded-t-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-5">
						<DialogHeader>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm">
									{dialogStep === 1 ? (
										<Upload className="h-5 w-5" />
									) : (
										<Undo2 className="h-5 w-5" />
									)}
								</div>
								<div>
									<DialogTitle className="text-base font-bold text-white">
										{dialogStep === 1
											? "Upload Delivery Proof"
											: "Returned Goods"}
									</DialogTitle>
									<p className="mt-0.5 text-xs text-amber-100">
										{selectedDO?.doNo} · PO: {selectedDO?.poNo}
									</p>
								</div>
							</div>
							{/* Step indicator */}
							<div className="mt-3 flex items-center gap-1.5">
								<span
									className={`h-1.5 flex-1 rounded-full ${dialogStep === 1 ? "bg-white" : "bg-white/40"}`}
								/>
								<span
									className={`h-1.5 flex-1 rounded-full ${dialogStep === 2 ? "bg-white" : "bg-white/40"}`}
								/>
							</div>
							<p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-amber-100">
								Step {dialogStep} of 2
							</p>
						</DialogHeader>
					</div>

					{/* Body */}
					<div className="max-h-[55vh] space-y-5 overflow-y-auto px-6 py-5">
						{dialogStep === 1 ? (
							<>
								{/* Instruction */}
								<p className="text-sm text-slate-600">
									Take a clear photo of the signed delivery form, or attach a
									PDF. Make sure all signatures and stamps are visible.
								</p>

								<FileUpload
									files={proofFiles}
									onFilesChange={setProofFiles}
									maxFiles={1}
									accept="image/*,application/pdf"
								/>
							</>
						) : (
							<>
								{/* Returned goods toggle */}
								<div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
									<div className="space-y-0.5">
										<p className="text-sm font-semibold text-slate-800">
											Did the outlet hand back any goods?
										</p>
										<p className="text-xs text-slate-500">
											Damaged or about-to-expire stock returned to the lorry
										</p>
									</div>
									<Switch
										checked={hasReturns}
										onCheckedChange={(checked) => {
											setHasReturns(checked);
											if (!checked) setReturnRows([]);
										}}
										disabled={isSubmitting}
									/>
								</div>

								{hasReturns && (
									<div className="space-y-3">
										{/* Add item picker */}
										<div className="flex items-center gap-2">
											<Select
												value={addItemId}
												onValueChange={(value) => {
													setAddItemId(value);
													handleAddReturnRow(value);
												}}
												disabled={isSubmitting || doItemsLoading}
											>
												<SelectTrigger className="h-9 flex-1 rounded-lg border-slate-200 bg-white text-sm">
													<div className="flex items-center gap-1.5 text-slate-600">
														<Plus className="h-3.5 w-3.5" />
														<SelectValue
															placeholder={
																doItemsLoading
																	? "Loading items…"
																	: "Add a returned item from this DO"
															}
														/>
													</div>
												</SelectTrigger>
												<SelectContent>
													{doItems.length === 0 && (
														<div className="px-3 py-2 text-sm text-slate-400">
															No items on this delivery order
														</div>
													)}
													{doItems.map((item) => (
														<SelectItem key={item.id} value={item.id}>
															{item.skuCode ?? item.skuId}
															{item.skuDescription
																? ` — ${item.skuDescription}`
																: ""}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										{/* Rows */}
										{returnRows.length === 0 ? (
											<div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
												No returned items yet — add one above.
											</div>
										) : (
											<div className="space-y-3">
												{returnRows.map((row, idx) => (
													<ReturnRowCard
														key={row.key}
														row={row}
														disabled={isSubmitting}
														onChange={(updated) =>
															setReturnRows((rows) =>
																rows.map((r, i) => (i === idx ? updated : r)),
															)
														}
														onRemove={() =>
															setReturnRows((rows) =>
																rows.filter((_, i) => i !== idx),
															)
														}
													/>
												))}
											</div>
										)}
									</div>
								)}
							</>
						)}

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
						{dialogStep === 1 ? (
							<>
								<Button
									variant="ghost"
									onClick={handleCloseDialog}
									disabled={isSubmitting}
									className="rounded-xl text-slate-600 hover:bg-slate-100"
								>
									Cancel
								</Button>
								<Button
									onClick={() => setDialogStep(2)}
									disabled={proofFiles.length === 0}
									className="gap-2 rounded-xl bg-amber-500 px-6 text-white shadow hover:bg-amber-600 disabled:opacity-50"
								>
									Next
									<ArrowRight className="h-4 w-4" />
								</Button>
							</>
						) : (
							<>
								<Button
									variant="ghost"
									onClick={() => setDialogStep(1)}
									disabled={isSubmitting}
									className="gap-1.5 rounded-xl text-slate-600 hover:bg-slate-100"
								>
									<ArrowLeft className="h-4 w-4" />
									Back
								</Button>
								<Button
									onClick={handleSubmitProof}
									disabled={
										isSubmitting || proofFiles.length === 0 || !returnsValid
									}
									className="gap-2 rounded-xl bg-amber-500 px-6 text-white shadow hover:bg-amber-600 disabled:opacity-50"
								>
									{isSubmitting ? (
										<>
											<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
											Submitting…
										</>
									) : (
										<>
											<PackageCheck className="h-4 w-4" />
											Confirm Delivery
											{hasReturns && totalReturnUnits > 0
												? ` + ${returnRows.length} return${returnRows.length === 1 ? "" : "s"}`
												: ""}
										</>
									)}
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
