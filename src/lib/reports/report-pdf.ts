/**
 * Report PDF helpers. Used to download PDF from backend (base64).
 */

/** Trigger browser download of a PDF from base64 (e.g. from backend generateReport). */
export function downloadPdfFromBase64(pdfBase64: string, filename: string): void {
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
