import type { TransferOrder } from "./dashboard.mock-data";
import { mockTransferOrders as baseTransfers } from "./dashboard.mock-data";

export type TransferStatus = "New" | "Accepted" | "Rejected" | "DO_Created";
export type NetSuiteStatus = "synced" | "pending" | "error" | undefined;

export interface TransferItem {
	id: string;
	sku: string;
	description: string;
	quantity: number;
	pickedQuantity: number;
	packedQuantity: number;
}

export interface TransferDetail
	extends Omit<TransferOrder, "status" | "createdAt" | "itemCount"> {
	status: TransferStatus;
	createdDate: Date;
	expectedDeliveryDate: Date;
	createdBy: string;
	notes?: string;
	items: TransferItem[];
	totalItems: number;
	netsuiteStatus?: NetSuiteStatus;
}

export type TransferStatusFilter = TransferStatus | "ALL";

export interface TransferListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: TransferStatusFilter;
}

export interface TransferSummary {
	byStatus: Record<TransferStatus, number>;
	total: number;
}

export interface TransferListResult {
	items: TransferDetail[];
	summary: TransferSummary;
	page: number;
	pageSize: number;
	total: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let transferDetails: TransferDetail[] = baseTransfers.map((transfer, index) => {
	const items: TransferItem[] = [
		{
			id: `${transfer.id}-1`,
			sku: `SKU-TO-${index + 1}01`,
			description: "Standard inventory item",
			quantity: 20,
			pickedQuantity:
				transfer.status === "completed" || transfer.status === "in_transit"
					? 20
					: transfer.status === "pending"
						? 10
						: 0,
			packedQuantity:
				transfer.status === "completed" || transfer.status === "in_transit"
					? 20
					: transfer.status === "pending"
						? 5
						: 0,
		},
		{
			id: `${transfer.id}-2`,
			sku: `SKU-TO-${index + 1}02`,
			description: "Secondary item",
			quantity: 15,
			pickedQuantity:
				transfer.status === "completed" || transfer.status === "in_transit"
					? 15
					: transfer.status === "pending"
						? 8
						: 0,
			packedQuantity:
				transfer.status === "completed" || transfer.status === "in_transit"
					? 15
					: transfer.status === "pending"
						? 3
						: 0,
		},
		{
			id: `${transfer.id}-3`,
			sku: `SKU-TO-${index + 1}03`,
			description: "Tertiary item",
			quantity: 10,
			pickedQuantity:
				transfer.status === "completed" || transfer.status === "in_transit"
					? 10
					: transfer.status === "pending"
						? 5
						: 0,
			packedQuantity:
				transfer.status === "completed" || transfer.status === "in_transit"
					? 10
					: transfer.status === "pending"
						? 2
						: 0,
		},
	];

	const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
	// Map old statuses to new ones for mock data
	const statusMap: Record<string, TransferStatus> = {
		completed: "DO_Created",
		cancelled: "Rejected",
		in_transit: "Accepted",
		pending: "Accepted",
		draft: "New",
	};
	const status: TransferStatus = statusMap[transfer.status] || "New";

	const netsuiteStatus: NetSuiteStatus =
		status === "DO_Created"
			? index % 3 === 0
				? "synced"
				: index % 3 === 1
					? "error"
					: "pending"
			: status === "Accepted"
				? index % 2 === 0
					? "synced"
					: "pending"
				: undefined;

	const createdDate = transfer.createdAt;
	const expectedDeliveryDate = new Date(createdDate);
	expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 3);

	return {
		...transfer,
		status,
		createdDate,
		expectedDeliveryDate,
		createdBy: index % 2 === 0 ? "John Doe" : "Jane Smith",
		notes: index % 2 === 0 ? "Handle with care. Fragile items." : undefined,
		items,
		totalItems,
		netsuiteStatus,
	};
});

function buildSummary(source: TransferDetail[]): TransferSummary {
	const initial: Record<TransferStatus, number> = {
		New: 0,
		Accepted: 0,
		Rejected: 0,
		DO_Created: 0,
	};

	const byStatus = source.reduce((acc, transfer) => {
		acc[transfer.status] = (acc[transfer.status] ?? 0) + 1;
		return acc;
	}, initial);

	return {
		byStatus,
		total: source.length,
	};
}

export async function getTransfers(
	filters: TransferListFilters,
): Promise<TransferListResult> {
	await delay(300);

	const { page, pageSize, search, status } = filters;

	let filtered = [...transferDetails];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((transfer) => {
			return (
				transfer.transferOrderNumber.toLowerCase().includes(term) ||
				transfer.fromLocation.toLowerCase().includes(term) ||
				transfer.toLocation.toLowerCase().includes(term)
			);
		});
	}

	if (status && status !== "ALL") {
		filtered = filtered.filter((transfer) => transfer.status === status);
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		summary: buildSummary(transferDetails),
		page,
		pageSize,
		total,
	};
}

export interface CreateTransferInput {
	transferOrderNumber: string;
	fromLocation: string;
	toLocation: string;
	expectedDeliveryDate: Date;
	notes?: string;
}

export async function createTransfer(
	input: CreateTransferInput,
): Promise<TransferDetail> {
	await delay(300);

	const now = new Date();
	const newTransfer: TransferDetail = {
		id: (transferDetails.length + 1).toString(),
		transferOrderNumber: input.transferOrderNumber,
		fromLocation: input.fromLocation,
		toLocation: input.toLocation,
		status: "New",
		createdDate: now,
		expectedDeliveryDate: input.expectedDeliveryDate,
		createdBy: "Current User",
		notes: input.notes,
		items: [
			{
				id: `${transferDetails.length + 1}-1`,
				sku: "SKU-NEW-001",
				description: "Newly created item",
				quantity: 1,
				pickedQuantity: 0,
				packedQuantity: 0,
			},
		],
		totalItems: 1,
		netsuiteStatus: undefined,
	};

	transferDetails = [newTransfer, ...transferDetails];

	return newTransfer;
}

export async function updateTransferStatus(
	id: string,
	status: TransferStatus,
): Promise<TransferDetail | undefined> {
	await delay(200);

	const index = transferDetails.findIndex((t) => t.id === id);
	if (index === -1) return undefined;

	const current = transferDetails[index];
	const updated: TransferDetail = {
		...current,
		status,
	};

	transferDetails[index] = updated;
	return updated;
}
