import type { GRN } from "./dashboard.mock-data";
import { mockGRNs as baseGRNs } from "./dashboard.mock-data";

export type GRNStatus =
	| "Draft"
	| "Submitted"
	| "Approved"
	| "Sent-to-ES"
	| "Failed";

export interface GRNItem {
	id: string;
	sku: string;
	description: string;
	expectedQuantity: number;
	receivedQuantity: number;
	location?: string;
}

export interface GRNDetail extends Omit<GRN, "status" | "createdAt"> {
	status: GRNStatus;
	poReference?: string;
	supplierDO?: string;
	receivedDate: Date;
	createdAt: Date;
	createdBy: string;
	notes?: string;
	items: GRNItem[];
	totalItems: number;
	receivedItems: number;
}

export type GRNStatusFilter = GRNStatus | "ALL";

export interface GRNListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: GRNStatusFilter;
}

export interface GRNSummary {
	byStatus: Record<GRNStatus, number>;
	total: number;
}

export interface GRNListResult {
	items: GRNDetail[];
	summary: GRNSummary;
	page: number;
	pageSize: number;
	total: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let grnDetails: GRNDetail[] = baseGRNs.map((grn, index) => {
	const items: GRNItem[] = [
		{
			id: `${grn.id}-1`,
			sku: `SKU-GRN-${index + 1}01`,
			description: "Standard inventory item",
			expectedQuantity: 20,
			receivedQuantity:
				grn.status === "completed"
					? 20
					: grn.status === "pending"
						? 0
						: Math.floor(20 * 0.6),
			location: index % 2 === 0 ? "A-01-02" : "B-03-01",
		},
		{
			id: `${grn.id}-2`,
			sku: `SKU-GRN-${index + 1}02`,
			description: "Secondary item",
			expectedQuantity: 15,
			receivedQuantity:
				grn.status === "completed"
					? 15
					: grn.status === "pending"
						? 0
						: Math.floor(15 * 0.5),
			location: index % 2 === 0 ? "A-01-03" : "B-03-02",
		},
		{
			id: `${grn.id}-3`,
			sku: `SKU-GRN-${index + 1}03`,
			description: "Tertiary item",
			expectedQuantity: 10,
			receivedQuantity:
				grn.status === "completed"
					? 10
					: grn.status === "pending"
						? 0
						: Math.floor(10 * 0.7),
			location: index % 2 === 0 ? "A-01-04" : undefined,
		},
	];

	const totalItems = items.reduce(
		(sum, item) => sum + item.expectedQuantity,
		0,
	);
	const receivedItems = items.reduce(
		(sum, item) => sum + item.receivedQuantity,
		0,
	);

	// Map old statuses to new ones for mock data
	const statusMap: Record<string, GRNStatus> = {
		completed: "Approved",
		cancelled: "Failed",
		pending: "Draft",
		partially_received: "Submitted",
	};
	const status: GRNStatus = statusMap[grn.status] || "Draft";

	return {
		...grn,
		status,
		poReference: `PO-2024-${String(index + 1).padStart(3, "0")}`,
		supplierDO: `DO-2024-${String(index + 1).padStart(3, "0")}`,
		receivedDate: grn.createdAt,
		createdAt: grn.createdAt,
		createdBy: index % 2 === 0 ? "John Doe" : "Jane Smith",
		notes: index % 2 === 0 ? "Handle with care. Fragile items." : undefined,
		items,
		totalItems,
		receivedItems,
	};
});

function buildSummary(source: GRNDetail[]): GRNSummary {
	const initial: Record<GRNStatus, number> = {
		Draft: 0,
		Submitted: 0,
		Approved: 0,
		"Sent-to-ES": 0,
		Failed: 0,
	};

	const byStatus = source.reduce((acc, grn) => {
		acc[grn.status] = (acc[grn.status] ?? 0) + 1;
		return acc;
	}, initial);

	return {
		byStatus,
		total: source.length,
	};
}

export async function getGRNs(filters: GRNListFilters): Promise<GRNListResult> {
	await delay(300);

	const { page, pageSize, search, status } = filters;

	let filtered = [...grnDetails];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((grn) => {
			return (
				grn.grnNumber.toLowerCase().includes(term) ||
				(grn.poReference && grn.poReference.toLowerCase().includes(term)) ||
				(grn.supplierDO && grn.supplierDO.toLowerCase().includes(term))
			);
		});
	}

	if (status && status !== "ALL") {
		filtered = filtered.filter((grn) => grn.status === status);
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		summary: buildSummary(grnDetails),
		page,
		pageSize,
		total,
	};
}

export interface CreateGRNLineItemInput {
	sku: string;
	description?: string;
	qty: number;
	uom?: string;
	unitPrice?: number;
}

export interface CreateGRNInput {
	grnNumber: string;
	poReference: string;
	supplierDO: string;
	receivedDate: Date;
	notes?: string;
	items?: CreateGRNLineItemInput[];
}

export async function createGRN(input: CreateGRNInput): Promise<GRNDetail> {
	await delay(300);

	const now = new Date();
	const lineItems = (input.items ?? []).filter((i) => i.sku?.trim());
	const grnItems: GRNItem[] =
		lineItems.length > 0
			? lineItems.map((it, idx) => ({
					id: `${grnDetails.length + 1}-${idx + 1}`,
					sku: it.sku.trim(),
					description: it.description ?? "Item",
					expectedQuantity: it.qty || 1,
					receivedQuantity: 0,
				}))
			: [
					{
						id: `${grnDetails.length + 1}-1`,
						sku: "SKU-NEW-001",
						description: "Newly created item",
						expectedQuantity: 1,
						receivedQuantity: 0,
					},
				];
	const totalItems = grnItems.reduce((s, i) => s + i.expectedQuantity, 0);
	const newGRN: GRNDetail = {
		id: (grnDetails.length + 1).toString(),
		grnNumber: input.grnNumber,
		supplier: "N/A", // Supplier field kept for backward compatibility but not used in form
		status: "Draft",
		poReference: input.poReference,
		supplierDO: input.supplierDO,
		receivedDate: input.receivedDate,
		createdAt: now,
		totalAmount: 0,
		createdBy: "Current User",
		notes: input.notes,
		items: grnItems,
		totalItems,
		receivedItems: 0,
	};

	grnDetails = [newGRN, ...grnDetails];

	return newGRN;
}

export async function updateGRNStatus(
	id: string,
	status: GRNStatus,
): Promise<GRNDetail | undefined> {
	await delay(200);

	const index = grnDetails.findIndex((g) => g.id === id);
	if (index === -1) return undefined;

	const current = grnDetails[index];
	let updated: GRNDetail = { ...current, status };

	if (status === "Approved" || status === "Sent-to-ES") {
		updated = {
			...updated,
			receivedItems: updated.totalItems,
			items: updated.items.map((item) => ({
				...item,
				receivedQuantity: item.expectedQuantity,
			})),
		};
	} else if (status === "Failed") {
		// Keep existing quantities on failure
	}

	grnDetails[index] = updated;
	return updated;
}
