import type { Delivery } from "./dashboard.mock-data";
import { mockDeliveries as baseDeliveries } from "./dashboard.mock-data";

export type DeliveryStatus = Delivery["status"];

export interface DeliveryItem {
	id: string;
	sku: string;
	description: string;
	quantity: number;
	deliveredQuantity: number;
	/** Quantity lost */
	lossQty: number;
}

export interface ProofOfDelivery {
	receivedBy: string;
	receivedDate: Date;
	notes?: string;
}

export interface DeliveryDetail extends Delivery {
	driver?: string;
	vehicle?: string;
	deliveryAddress?: string;
	notes?: string;
	items: DeliveryItem[];
	proofOfDelivery?: ProofOfDelivery;
}

export type DeliveryStatusFilter = DeliveryStatus | "ALL";

export interface DeliveryListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: DeliveryStatusFilter;
}

export interface DeliverySummary {
	byStatus: Record<DeliveryStatus, number>;
	total: number;
}

export interface DeliveryListResult {
	items: DeliveryDetail[];
	summary: DeliverySummary;
	page: number;
	pageSize: number;
	total: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let deliveryDetails: DeliveryDetail[] = baseDeliveries.map(
	(delivery, index) => {
		const items: DeliveryItem[] = [
			{
				id: `${delivery.id}-1`,
				sku: `SKU-${index + 1}01`,
				description: "Standard inventory item",
				quantity: 10,
				deliveredQuantity:
					delivery.status === "DELIVERED_CONFIRMED"
						? 10
						: delivery.status === "DISPATCHED" || delivery.status === "PACKED"
							? 8
							: 0,
				lossQty: 0,
			},
			{
				id: `${delivery.id}-2`,
				sku: `SKU-${index + 1}02`,
				description: "Secondary item",
				quantity: 5,
				deliveredQuantity:
					delivery.status === "DELIVERED_CONFIRMED"
						? 5
						: delivery.status === "DISPATCHED" || delivery.status === "PACKED"
							? 3
							: 0,
				lossQty: 0,
			},
		];

		const proofOfDelivery: ProofOfDelivery | undefined =
			delivery.status === "DELIVERED_CONFIRMED"
				? {
						receivedBy: "Store Manager",
						receivedDate: delivery.deliveryDate ?? delivery.scheduledDate,
						notes: "Goods received in good condition.",
					}
				: undefined;

		return {
			...delivery,
			driver: index % 2 === 0 ? "John Doe" : "Jane Smith",
			vehicle: index % 2 === 0 ? "VAN-001" : "TRUCK-001",
			deliveryAddress: `${index + 1} Jalan Example, 50450 Kuala Lumpur`,
			notes: index % 2 === 0 ? "Handle with care." : "Deliver before 5pm.",
			items,
			proofOfDelivery,
		};
	},
);

function buildSummary(source: DeliveryDetail[]): DeliverySummary {
	const initial: Record<DeliveryStatus, number> = {
		CREATED: 0,
		PICKING: 0,
		PACKED: 0,
		DISPATCHED: 0,
		DELIVERED_CONFIRMED: 0,
		CANCELLED: 0,
	};

	const byStatus = source.reduce((acc, delivery) => {
		acc[delivery.status] = (acc[delivery.status] ?? 0) + 1;
		return acc;
	}, initial);

	return {
		byStatus,
		total: source.length,
	};
}

export async function getDeliveries(
	filters: DeliveryListFilters,
): Promise<DeliveryListResult> {
	await delay(300);

	const { page, pageSize, search, status } = filters;

	let filtered = [...deliveryDetails];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((delivery) => {
			return (
				delivery.deliveryNumber.toLowerCase().includes(term) ||
				delivery.customerName.toLowerCase().includes(term)
			);
		});
	}

	if (status && status !== "ALL") {
		filtered = filtered.filter((delivery) => delivery.status === status);
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		summary: buildSummary(deliveryDetails),
		page,
		pageSize,
		total,
	};
}

export interface CreateDeliveryInput {
	deliveryNumber: string;
	customerName: string;
	deliveryAddress: string;
	scheduledDate: Date;
	driver?: string;
	vehicle?: string;
	notes?: string;
}

export async function createDelivery(
	input: CreateDeliveryInput,
): Promise<DeliveryDetail> {
	await delay(300);

	const now = new Date();
	const newDelivery: DeliveryDetail = {
		id: (deliveryDetails.length + 1).toString(),
		deliveryNumber: input.deliveryNumber,
		customerName: input.customerName,
		status: "CREATED",
		scheduledDate: input.scheduledDate,
		totalAmount: 0,
		driver: input.driver,
		vehicle: input.vehicle,
		deliveryAddress: input.deliveryAddress,
		notes: input.notes,
		items: [
			{
				id: `${deliveryDetails.length + 1}-1`,
				sku: "SKU-NEW-001",
				description: "Newly scheduled item",
				quantity: 1,
				deliveredQuantity: 0,
				lossQty: 0,
			},
		],
		proofOfDelivery: undefined,
		deliveryDate: undefined,
	};

	deliveryDetails = [newDelivery, ...deliveryDetails];

	return newDelivery;
}

export async function updateDeliveryStatus(
	id: string,
	status: DeliveryStatus,
): Promise<DeliveryDetail | undefined> {
	await delay(200);

	const index = deliveryDetails.findIndex((d) => d.id === id);
	if (index === -1) return undefined;

	const current = deliveryDetails[index];
	const updated: DeliveryDetail = {
		...current,
		status,
		deliveryDate:
			status === "DELIVERED_CONFIRMED" ? new Date() : current.deliveryDate,
	};

	deliveryDetails[index] = updated;
	return updated;
}

/** Update line item loss quantities for a delivery */
export async function updateDeliveryItemsLoss(
	deliveryId: string,
	updates: Array<{ itemId: string; lossQty: number }>,
): Promise<DeliveryDetail | undefined> {
	await delay(200);

	const index = deliveryDetails.findIndex((d) => d.id === deliveryId);
	if (index === -1) return undefined;

	const current = deliveryDetails[index];
	const items = current.items.map((item) => {
		const u = updates.find((x) => x.itemId === item.id);
		return u != null ? { ...item, lossQty: u.lossQty } : item;
	});

	deliveryDetails[index] = { ...current, items };
	return deliveryDetails[index];
}
