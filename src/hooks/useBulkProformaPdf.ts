import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket";
import {
	BULK_GENERATE_PROFORMA_INVOICES_PDF_MUTATION,
	type BulkGenerateProformaInvoicesPdfData,
	type BulkGenerateProformaInvoicesPdfVariables,
} from "@/lib/graphql/invoices";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BulkPdfStatus = "idle" | "generating" | "done" | "error";

export interface BulkPdfState {
	status: BulkPdfStatus;
	progress: number;
	total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadZip(zipBase64: string, filename: string): void {
	const binary = atob(zipBase64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const blob = new Blob([bytes], { type: "application/zip" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Socket event payload shapes
// ---------------------------------------------------------------------------

interface BulkProgressEvent {
	jobId: string;
	completed: number;
	total: number;
	currentFilename: string;
}

interface BulkCompleteEvent {
	jobId: string;
	zipBase64: string;
	zipFilename: string;
	successCount: number;
	failedCount: number;
}

interface BulkErrorEvent {
	jobId: string;
	message: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBulkProformaPdf() {
	const [state, setState] = useState<BulkPdfState>({
		status: "idle",
		progress: 0,
		total: 0,
	});

	const jobIdRef = useRef<string | null>(null);

	const [mutate] = useMutation<
		BulkGenerateProformaInvoicesPdfData,
		BulkGenerateProformaInvoicesPdfVariables
	>(BULK_GENERATE_PROFORMA_INVOICES_PDF_MUTATION);

	// Register socket event listeners once on mount
	useEffect(() => {
		const socket = getSocket();

		const onProgress = (data: BulkProgressEvent) => {
			if (data.jobId !== jobIdRef.current) return;
			setState((s) => ({ ...s, progress: data.completed, total: data.total }));
		};

		const onComplete = (data: BulkCompleteEvent) => {
			if (data.jobId !== jobIdRef.current) return;
			setState((s) => ({ ...s, status: "done" }));
			downloadZip(data.zipBase64, data.zipFilename);
			socket.emit("leave-room", `job:${data.jobId}`);
			if (data.failedCount > 0) {
				toast.warning(
					`Downloaded ${data.successCount} PDF(s). ${data.failedCount} failed.`,
				);
			} else {
				toast.success(`${data.successCount} Proforma PDF(s) downloaded`);
			}
		};

		const onError = (data: BulkErrorEvent) => {
			if (data.jobId !== jobIdRef.current) return;
			setState((s) => ({ ...s, status: "error" }));
			toast.error(`Bulk PDF export failed: ${data.message}`);
		};

		socket.on("bulk-pdf:progress", onProgress);
		socket.on("bulk-pdf:complete", onComplete);
		socket.on("bulk-pdf:error", onError);

		return () => {
			socket.off("bulk-pdf:progress", onProgress);
			socket.off("bulk-pdf:complete", onComplete);
			socket.off("bulk-pdf:error", onError);
		};
	}, []);

	const startBulkExport = useCallback(
		async (invoiceIds: string[]) => {
			if (invoiceIds.length === 0) return;

			setState({ status: "generating", progress: 0, total: invoiceIds.length });

			try {
				const socket = getSocket();
				if (!socket.connected) socket.connect();

				const { data } = await mutate({ variables: { invoiceIds } });
				const jobId = data!.bulkGenerateProformaInvoicesPdf.jobId;
				jobIdRef.current = jobId;

				// Join the job-specific room to receive progress events
				socket.emit("join-room", `job:${jobId}`);
			} catch (err: unknown) {
				setState((s) => ({ ...s, status: "error" }));
				toast.error(
					err instanceof Error ? err.message : "Failed to start bulk export",
				);
			}
		},
		[mutate],
	);

	const reset = useCallback(
		() => setState({ status: "idle", progress: 0, total: 0 }),
		[],
	);

	return { state, startBulkExport, reset };
}
