export type IntegrationAction =
	| "TO_PULL"
	| "STOCK_SYNC"
	| "GRN_PUSH"
	| "DELIVERY_PUSH"
	| "INVOICE_PUSH";

export type IntegrationStatus = "success" | "error" | "pending";

export interface IntegrationLog {
	id: string;
	action: IntegrationAction;
	endpoint: string;
	status: IntegrationStatus;
	timestamp: Date;
	errorMessage?: string;
	retryable?: boolean;
	entityId?: string;
	entityType?: "grn" | "to" | "do" | "invoice";
}

export interface IntegrationLogFilters {
	action?: IntegrationAction | "ALL";
	status?: IntegrationStatus | "ALL";
	entityType?: string;
	entityId?: string;
	limit?: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate mock integration logs
const integrationLogs: IntegrationLog[] = Array.from({ length: 50 }, (_, i) => {
	const actions: IntegrationAction[] = [
		"TO_PULL",
		"STOCK_SYNC",
		"GRN_PUSH",
		"DELIVERY_PUSH",
		"INVOICE_PUSH",
	];
	const action = actions[i % actions.length];
	const statuses: IntegrationStatus[] = ["success", "error", "pending"];
	const status = statuses[i % statuses.length];

	const endpoints: Record<IntegrationAction, string> = {
		TO_PULL: "/api/netsuite/transfer-orders",
		STOCK_SYNC: "/api/netsuite/stock-sync",
		GRN_PUSH: "/api/netsuite/grn",
		DELIVERY_PUSH: "/api/netsuite/delivery-confirmation",
		INVOICE_PUSH: "/api/netsuite/invoice",
	};

	return {
		id: `log-${i}`,
		action,
		endpoint: endpoints[action],
		status,
		timestamp: new Date(Date.now() - i * 3600000),
		errorMessage:
			status === "error" ? "Connection timeout. Please try again." : undefined,
		retryable: status === "error",
		entityId: i % 10 === 0 ? `entity-${i}` : undefined,
		entityType:
			action === "GRN_PUSH"
				? "grn"
				: action === "TO_PULL"
					? "to"
					: action === "DELIVERY_PUSH"
						? "do"
						: action === "INVOICE_PUSH"
							? "invoice"
							: undefined,
	};
});

export async function getIntegrationLogs(
	filters: IntegrationLogFilters = {},
): Promise<IntegrationLog[]> {
	await delay(300);

	const { action, status, entityType, entityId, limit = 50 } = filters;

	let filtered = [...integrationLogs];

	if (action && action !== "ALL") {
		filtered = filtered.filter((log) => log.action === action);
	}

	if (status && status !== "ALL") {
		filtered = filtered.filter((log) => log.status === status);
	}

	if (entityType) {
		filtered = filtered.filter((log) => log.entityType === entityType);
	}

	if (entityId) {
		filtered = filtered.filter((log) => log.entityId === entityId);
	}

	// Sort by timestamp descending
	filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

	return filtered.slice(0, limit);
}

export async function getLastIntegrationLog(
	action: IntegrationAction,
): Promise<IntegrationLog | undefined> {
	await delay(200);

	const logs = integrationLogs
		.filter((log) => log.action === action)
		.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

	return logs[0];
}

export async function retryIntegration(logId: string): Promise<IntegrationLog> {
	await delay(500);

	const index = integrationLogs.findIndex((log) => log.id === logId);
	if (index === -1) {
		throw new Error("Log not found");
	}

	const current = integrationLogs[index];
	const updated: IntegrationLog = {
		...current,
		id: `log-${Date.now()}`,
		status: "success", // Simulate successful retry
		timestamp: new Date(),
		errorMessage: undefined,
		retryable: false,
	};

	integrationLogs.unshift(updated); // Add to beginning
	return updated;
}
