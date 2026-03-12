import { faker } from "@faker-js/faker";

export type ExceptionType = "SHORTAGE" | "DAMAGE";
export type ExceptionStatus = "pending" | "approved" | "rejected";

export type StockCountAction =
	| "tally_to_opening"
	| "tally_to_stock_count"
	| "manual_key_in";

export interface Exception {
	id: string;
	doNumber: string;
	doId: string;
	itemId: string;
	sku: string;
	description: string;
	type: ExceptionType;
	quantity: number;
	reason: string;
	// New fields for stock reconciliation
	openingQtyDozen: number;
	openingQtyLoss: number;
	stockCountDate: Date;
	closedQtyDozen: number;
	closedQtyLoss: number;
	action?: StockCountAction;
	isApproved: boolean;
	notes?: string;
	photoUrl?: string;
	reportedBy: string;
	reportedByName: string;
	reportedAt: Date;
	status: ExceptionStatus;
	approvedBy?: string;
	approvedByName?: string;
	approvedAt?: Date;
	rejectionReason?: string;
	rejectedBy?: string;
	rejectedByName?: string;
	rejectedAt?: Date;
}

export type ExceptionStatusFilter = ExceptionStatus | "ALL";

export interface ExceptionListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: ExceptionStatusFilter;
	type?: ExceptionType | "ALL";
}

export interface ExceptionSummary {
	byStatus: Record<ExceptionStatus, number>;
	byType: Record<ExceptionType, number>;
	total: number;
}

export interface ExceptionListResult {
	items: Exception[];
	summary: ExceptionSummary;
	page: number;
	pageSize: number;
	total: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate mock exceptions
const exceptions: Exception[] = Array.from({ length: 20 }, (_, i) => {
	const statuses: ExceptionStatus[] = ["pending", "approved", "rejected"];
	const status = statuses[i % statuses.length];
	const type: ExceptionType = i % 2 === 0 ? "SHORTAGE" : "DAMAGE";
	const reason = "Item damaged during delivery";
	// Generate random quantities for stock reconciliation
	const openingQtyDozen = faker.number.int({ min: 10, max: 100 });
	const openingQtyLoss = faker.number.int({ min: 0, max: 5 });
	const closedQtyDozen = faker.number.int({ min: 5, max: openingQtyDozen });
	const closedQtyLoss = faker.number.int({ min: 0, max: 8 });

	return {
		id: `exc-${i}`,
		doNumber: `DO-2024-${String(i + 1).padStart(4, "0")}`,
		doId: `do-${i}`,
		itemId: `item-${i}`,
		sku: `SKU-${String(i + 1).padStart(3, "0")}`,
		description: faker.commerce.productName(),
		type,
		quantity: 1 + (i % 5),
		reason,
		// New stock reconciliation fields
		openingQtyDozen,
		openingQtyLoss,
		stockCountDate: new Date(Date.now() - i * 86400000), // Different days
		closedQtyDozen,
		closedQtyLoss,
		action: undefined,
		isApproved: status === "approved",
		notes: faker.lorem.sentence(),
		reportedBy: "store_keeper_1",
		reportedByName: "Store Keeper User",
		reportedAt: new Date(Date.now() - i * 3600000),
		status,
		approvedBy: status === "approved" ? "supervisor_1" : undefined,
		approvedByName: status === "approved" ? "Eric Ng" : undefined,
		approvedAt:
			status === "approved" ? new Date(Date.now() - i * 1800000) : undefined,
		rejectionReason:
			status === "rejected" ? "Insufficient evidence provided" : undefined,
		rejectedBy: status === "rejected" ? "supervisor_1" : undefined,
		rejectedByName: status === "rejected" ? "Eric Ng" : undefined,
		rejectedAt:
			status === "rejected" ? new Date(Date.now() - i * 1800000) : undefined,
	};
});

function buildSummary(source: Exception[]): ExceptionSummary {
	const initialStatus: Record<ExceptionStatus, number> = {
		pending: 0,
		approved: 0,
		rejected: 0,
	};

	const initialType: Record<ExceptionType, number> = {
		SHORTAGE: 0,
		DAMAGE: 0,
	};

	const byStatus = source.reduce((acc, exc) => {
		acc[exc.status] = (acc[exc.status] ?? 0) + 1;
		return acc;
	}, initialStatus);

	const byType = source.reduce((acc, exc) => {
		acc[exc.type] = (acc[exc.type] ?? 0) + 1;
		return acc;
	}, initialType);

	return {
		byStatus,
		byType,
		total: source.length,
	};
}

export async function getExceptions(
	filters: ExceptionListFilters,
): Promise<ExceptionListResult> {
	await delay(300);

	const { page, pageSize, search, status, type } = filters;

	let filtered = [...exceptions];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((exc) => {
			return (
				exc.doNumber.toLowerCase().includes(term) ||
				exc.sku.toLowerCase().includes(term) ||
				exc.description.toLowerCase().includes(term)
			);
		});
	}

	if (status && status !== "ALL") {
		filtered = filtered.filter((exc) => exc.status === status);
	}

	if (type && type !== "ALL") {
		filtered = filtered.filter((exc) => exc.type === type);
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		summary: buildSummary(exceptions),
		page,
		pageSize,
		total,
	};
}

export async function getExceptionById(
	id: string,
): Promise<Exception | undefined> {
	await delay(200);
	return exceptions.find((exc) => exc.id === id);
}

export async function approveException(
	id: string,
	approvedBy: string,
	approvedByName: string,
): Promise<Exception | undefined> {
	await delay(300);

	const index = exceptions.findIndex((exc) => exc.id === id);
	if (index === -1) return undefined;

	const current = exceptions[index];
	if (current.status !== "pending") return undefined;

	const updated: Exception = {
		...current,
		status: "approved",
		approvedBy,
		approvedByName,
		approvedAt: new Date(),
	};

	exceptions[index] = updated;
	return updated;
}

export async function rejectException(
	id: string,
	rejectionReason: string,
	rejectedBy: string,
	rejectedByName: string,
): Promise<Exception | undefined> {
	await delay(300);

	const index = exceptions.findIndex((exc) => exc.id === id);
	if (index === -1) return undefined;

	const current = exceptions[index];
	if (current.status !== "pending") return undefined;

	const updated: Exception = {
		...current,
		status: "rejected",
		rejectionReason,
		rejectedBy,
		rejectedByName,
		rejectedAt: new Date(),
	};

	exceptions[index] = updated;
	return updated;
}
