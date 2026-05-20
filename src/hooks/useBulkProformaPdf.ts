import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { gqlRequest } from "@/lib/api/gql";
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

	const { mutateAsync } = useMutation({
		mutationFn: (variables: BulkGenerateProformaInvoicesPdfVariables) =>
			gqlRequest<
				BulkGenerateProformaInvoicesPdfData,
				BulkGenerateProformaInvoicesPdfVariables
			>(BULK_GENERATE_PROFORMA_INVOICES_PDF_MUTATION, variables),
	});

	const startBulkExport = useCallback(
		async (invoiceIds: string[]) => {
			if (invoiceIds.length === 0) return;

			setState({ status: "generating", progress: 0, total: invoiceIds.length });

			const socket = getSocket();
			if (!socket.connected) socket.connect();

			try {
				const data = await mutateAsync({ invoiceIds });
				const jobId = data.bulkGenerateProformaInvoicesPdf.jobId;

				socket.emit("join-room", `job:${jobId}`);

				await new Promise<void>((resolve, reject) => {
					const onProgress = (event: BulkProgressEvent) => {
						if (event.jobId !== jobId) return;
						setState((s) => ({ ...s, progress: event.completed }));
					};

					const cleanup = () => {
						socket.off("bulk-pdf:progress", onProgress);
						socket.off("bulk-pdf:complete", onComplete);
						socket.off("bulk-pdf:error", onError);
						socket.emit("leave-room", `job:${jobId}`);
					};

					const onComplete = (event: BulkCompleteEvent) => {
						if (event.jobId !== jobId) return;
						cleanup();
						setState((s) => ({ ...s, status: "done" }));
						downloadZip(event.zipBase64, event.zipFilename);
						if (event.failedCount > 0) {
							toast.warning(
								`Downloaded ${event.successCount} PDF(s). ${event.failedCount} failed.`,
							);
						} else {
							toast.success(`${event.successCount} Proforma PDF(s) downloaded`);
						}
						resolve();
					};

					const onError = (event: BulkErrorEvent) => {
						if (event.jobId !== jobId) return;
						cleanup();
						reject(new Error(event.message));
					};

					socket.on("bulk-pdf:progress", onProgress);
					socket.on("bulk-pdf:complete", onComplete);
					socket.on("bulk-pdf:error", onError);
				});
			} catch (err: unknown) {
				setState((s) => ({ ...s, status: "error" }));
				toast.error(
					err instanceof Error ? err.message : "Failed to start bulk export",
				);
			}
		},
		[mutateAsync],
	);

	const reset = useCallback(
		() => setState({ status: "idle", progress: 0, total: 0 }),
		[],
	);

	return { state, startBulkExport, reset };
}
