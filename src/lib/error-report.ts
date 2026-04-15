/**
 * Error report utilities.
 *
 * Builds a structured JSON report from a caught error and copies it to the
 * clipboard so users can paste it into a support ticket or share it with
 * developers without needing direct access to the server logs.
 */

export interface ErrorReportContext {
	/** GraphQL mutation / REST operation that failed */
	operation: string;
	/** Logged-in user's email, for triage */
	userEmail?: string;
}

interface GqlError {
	message?: string;
	extensions?: Record<string, unknown>;
}

/**
 * Serialises all available error detail into a plain JSON string.
 * Safe to show / copy — no sensitive credentials are included.
 */
export function buildErrorReport(
	err: unknown,
	ctx: ErrorReportContext,
): string {
	const timestamp = new Date().toISOString();
	const url =
		typeof window !== "undefined" ? window.location.href : "unknown";

	let message = "Unknown error";
	let stack: string | undefined;
	let graphQLErrors: GqlError[] | undefined;
	let cause: unknown;

	if (err instanceof Error) {
		// Use only the first line of err.message — graphql-request appends
		// the full request/response JSON after the first .: separator.
		message = err.message.split(/\.: \{/)[0].trim();
		stack = err.stack;
		cause = (err as Error & { cause?: unknown }).cause;
	} else if (typeof err === "string") {
		message = err;
	}

	if (err && typeof err === "object") {
		// graphql-request: errors at .response.errors
		const responseErrors = (
			err as { response?: { errors?: GqlError[] } }
		).response?.errors;
		if (responseErrors?.length) {
			graphQLErrors = responseErrors;
			message = responseErrors[0]?.message ?? message;
		} else if ("graphQLErrors" in err) {
			// Apollo Client fallback
			graphQLErrors =
				(err as { graphQLErrors?: GqlError[] }).graphQLErrors ?? [];
			if (graphQLErrors.length) message = graphQLErrors[0]?.message ?? message;
		}
	}

	const report = {
		timestamp,
		operation: ctx.operation,
		user: ctx.userEmail ?? "unknown",
		url,
		message,
		...(graphQLErrors?.length ? { graphQLErrors } : {}),
		...(cause !== undefined ? { cause } : {}),
		...(stack ? { stack } : {}),
	};

	return JSON.stringify(report, null, 2);
}

/**
 * Writes the report string to the system clipboard.
 * Returns true on success, false if the Clipboard API is unavailable
 * (e.g. non-HTTPS context or user denied permission).
 */
export async function copyErrorReport(report: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(report);
		return true;
	} catch {
		return false;
	}
}
