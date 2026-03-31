/**
 * Report PDF helpers. Used to download PDF from backend (base64) or remote URL.
 */

/** Safe segment for a download filename (PO/DO numbers). */
export function sanitizePdfFilenameSegment(segment: string): string {
	const cleaned = segment.replace(/[/\\?%*:|"<>]/g, "-").trim();
	return cleaned.length > 0 ? cleaned : "delivery-order";
}

/** Fetch a PDF from a URL (e.g. S3/CDN) and trigger a file download in the browser. */
export async function downloadPdfFromUrl(
	url: string,
	filename: string,
): Promise<void> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to download PDF (${res.status})`);
	}
	const blob = await res.blob();
	const objectUrl = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = objectUrl;
	a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
	a.click();
	URL.revokeObjectURL(objectUrl);
}

/** Trigger browser download of a PDF from base64 (e.g. from backend generateReport). */
export function downloadPdfFromBase64(
	pdfBase64: string,
	filename: string,
): void {
	const binary = atob(pdfBase64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const blob = new Blob([bytes], { type: "application/pdf" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
