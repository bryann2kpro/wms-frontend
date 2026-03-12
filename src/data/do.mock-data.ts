import { faker } from "@faker-js/faker";

export type DOStatus =
	| "CREATED"
	| "PICKING"
	| "PACKED"
	| "READY_FOR_COLLECTION"
	| "COLLECTED"
	| "DELIVERED_PENDING_PROOF"
	| "DELIVERED_CONFIRMED"
	| "CANCELLED";

const regions = ["Klang Valley", "Perlis", "North", "South", "East Coast"];

export type ExceptionType = "SHORTAGE" | "DAMAGE";

export interface DOItem {
	id: string;
	sku: string;
	description: string;
	grnNumber: string;
	doNumber: string;
	deliveryDate: Date;
	requiredQuantity: number;
	pickedQuantity: number;
	packedQuantity: number;
	location?: string;
	// Stock reconciliation fields
	openingQtyDozen: number;
	openingQtyLoss: number;
	stockInDozen: number;
	stockInLoss: number;
	stockOutDozen: number;
	stockOutLoss: number;
	closeQtyDozen: number;
	closeQtyLoss: number;
	storageRack: string;
}

export interface ShortageDamageReport {
	id: string;
	doId: string;
	itemId: string;
	type: ExceptionType;
	quantity: number;
	notes?: string;
	photoUrl?: string;
	reportedBy: string;
	reportedAt: Date;
	status: "pending" | "approved" | "rejected";
	approvedBy?: string;
	approvedAt?: Date;
	rejectionReason?: string;
}

export interface DeliveryOrder {
	id: string;
	doNumber: string;
	/** PO Number (not nullable) */
	toNumber: string;
	region: string;
	outlet: string;
	outletAddress?: string;
	status: DOStatus;
	/** When true, order was created as emergency (bypassed cutoff for next delivery day). */
	isEmergency?: boolean;
	assignedTo?: string; // Store Keeper or Logistic user ID
	createdAt: Date;
	scheduledDeliveryDate: Date;
	dispatchedAt?: Date;
	deliveredAt?: Date;
	items: DOItem[];
	shortageDamageReports?: ShortageDamageReport[];
	notes?: string;
}

export type DOStatusFilter = DOStatus | "ALL";

export interface DOListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: DOStatusFilter;
	assignedTo?: string;
}

export interface DOSummary {
	byStatus: Record<DOStatus, number>;
	total: number;
}

export interface DOListResult {
	items: DeliveryOrder[];
	summary: DOSummary;
	page: number;
	pageSize: number;
	total: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate mock DOs
const doList: DeliveryOrder[] = Array.from({ length: 30 }, (_, i) => {
	const statuses: DOStatus[] = [
		"CREATED",
		"PICKING",
		"PACKED",
		"READY_FOR_COLLECTION",
		"COLLECTED",
		"DELIVERED_PENDING_PROOF",
		"DELIVERED_CONFIRMED",
	];
	const status = statuses[i % statuses.length];

	const items: DOItem[] = Array.from({ length: 3 + (i % 3) }, (_, j) => {
		const grnNumber = `GRN-2024-${String(i + 1).padStart(4, "0")}`;
		const doNumber = `DO-2024-${String(i + 1).padStart(4, "0")}`;
		const deliveryDate = new Date(Date.now() + (i % 7) * 86400000);
		const openingQtyDozen = faker.number.int({ min: 10, max: 100 });
		const openingQtyLoss = faker.number.int({ min: 0, max: 5 });
		const stockInDozen = faker.number.int({ min: 0, max: 20 });
		const stockInLoss = faker.number.int({ min: 0, max: 3 });
		const stockOutDozen = faker.number.int({ min: 0, max: 15 });
		const stockOutLoss = faker.number.int({ min: 0, max: 2 });
		const closeQtyDozen = openingQtyDozen + stockInDozen - stockOutDozen;
		const closeQtyLoss = openingQtyLoss + stockInLoss - stockOutLoss;
		const rackRow = String.fromCharCode(65 + (j % 6)); // A-F
		const rackCol = String(Math.floor(Math.random() * 10) + 1).padStart(2, "0");
		const rackLevel = Math.floor(Math.random() * 4) + 1;

		return {
			id: `${i}-${j}`,
			sku: `SKU-${String(i + 1).padStart(3, "0")}-${String(j + 1).padStart(2, "0")}`,
			description: faker.commerce.productName(),
			grnNumber: grnNumber as string,
			doNumber: doNumber as string,
			deliveryDate: deliveryDate as Date,
			requiredQuantity: 10 + j * 5,
			pickedQuantity:
				status === "CREATED"
					? 0
					: status === "PICKING"
						? Math.floor((10 + j * 5) * 0.5)
						: 10 + j * 5,
			packedQuantity:
				status === "PACKED" ||
				status === "READY_FOR_COLLECTION" ||
				status === "COLLECTED" ||
				status === "DELIVERED_PENDING_PROOF" ||
				status === "DELIVERED_CONFIRMED"
					? 10 + j * 5
					: status === "PICKING"
						? Math.floor((10 + j * 5) * 0.3)
						: 0,
			location: `A-${String(Math.floor(Math.random() * 10)).padStart(2, "0")}-${String(Math.floor(Math.random() * 10)).padStart(2, "0")}`,
			// Stock reconciliation fields
			openingQtyDozen,
			openingQtyLoss,
			stockInDozen,
			stockInLoss,
			stockOutDozen,
			stockOutLoss,
			closeQtyDozen,
			closeQtyLoss,
			storageRack: `${rackRow}-${rackCol}-${rackLevel}`,
		};
	});

	const shortageDamageReports: ShortageDamageReport[] =
		i % 5 === 0 && status !== "CREATED"
			? [
					{
						id: `report-${i}`,
						doId: `do-${i}`,
						itemId: items[0].id,
						type: i % 2 === 0 ? "SHORTAGE" : "DAMAGE",
						quantity: 2,
						notes: "Item damaged during picking",
						reportedBy: "store_keeper_1",
						reportedAt: new Date(Date.now() - 3600000),
						status:
							i % 3 === 0 ? "pending" : i % 3 === 1 ? "approved" : "rejected",
					},
				]
			: [];

	return {
		id: `do-${i}`,
		doNumber: `DO-2024-${String(i + 1).padStart(4, "0")}`,
		toNumber: `PO-2024-${String(i + 1).padStart(4, "0")}`,
		region: regions[i % regions.length],
		isEmergency: i % 5 === 0,
		outlet: faker.company.name(),
		outletAddress: faker.location.streetAddress(),
		status,
		assignedTo:
			i % 3 === 0 ? "store_keeper_1" : i % 3 === 1 ? "logistic_1" : undefined,
		createdAt: new Date(Date.now() - i * 86400000),
		scheduledDeliveryDate: new Date(Date.now() + (i % 7) * 86400000),
		dispatchedAt:
			status === "COLLECTED" ||
			status === "DELIVERED_PENDING_PROOF" ||
			status === "DELIVERED_CONFIRMED"
				? new Date(Date.now() - (i % 3) * 3600000)
				: undefined,
		deliveredAt:
			status === "DELIVERED_PENDING_PROOF" || status === "DELIVERED_CONFIRMED"
				? new Date(Date.now() - (i % 2) * 3600000)
				: undefined,
		items,
		shortageDamageReports,
		notes: i % 4 === 0 ? faker.lorem.sentence() : undefined,
	};
});

function buildSummary(source: DeliveryOrder[]): DOSummary {
	const initial: Record<DOStatus, number> = {
		CREATED: 0,
		PICKING: 0,
		PACKED: 0,
		READY_FOR_COLLECTION: 0,
		COLLECTED: 0,
		DELIVERED_PENDING_PROOF: 0,
		DELIVERED_CONFIRMED: 0,
		CANCELLED: 0,
	};

	const byStatus = source.reduce((acc, do_) => {
		acc[do_.status] = (acc[do_.status] ?? 0) + 1;
		return acc;
	}, initial);

	return {
		byStatus,
		total: source.length,
	};
}

export async function getDOs(filters: DOListFilters): Promise<DOListResult> {
	await delay(300);

	const { page, pageSize, search, status, assignedTo } = filters;

	let filtered = [...doList];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((do_) => {
			return (
				do_.doNumber.toLowerCase().includes(term) ||
				do_.outlet.toLowerCase().includes(term) ||
				do_.toNumber.toLowerCase().includes(term)
			);
		});
	}

	if (status && status !== "ALL") {
		filtered = filtered.filter((do_) => do_.status === status);
	}

	if (assignedTo) {
		filtered = filtered.filter((do_) => do_.assignedTo === assignedTo);
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		summary: buildSummary(doList),
		page,
		pageSize,
		total,
	};
}

export async function getDOById(
	id: string,
): Promise<DeliveryOrder | undefined> {
	await delay(200);
	return doList.find((do_) => do_.id === id);
}

export async function updateDOStatus(
	id: string,
	status: DOStatus,
): Promise<DeliveryOrder | undefined> {
	await delay(200);

	const index = doList.findIndex((do_) => do_.id === id);
	if (index === -1) return undefined;

	const current = doList[index];
	const updated: DeliveryOrder = {
		...current,
		status,
		dispatchedAt:
			status === "COLLECTED" ||
			status === "DELIVERED_PENDING_PROOF" ||
			status === "DELIVERED_CONFIRMED"
				? current.dispatchedAt || new Date()
				: current.dispatchedAt,
		deliveredAt:
			status === "DELIVERED_PENDING_PROOF" || status === "DELIVERED_CONFIRMED"
				? current.deliveredAt || new Date()
				: current.deliveredAt,
	};

	doList[index] = updated;
	return updated;
}

export async function reportShortageDamage(
	doId: string,
	itemId: string,
	type: ExceptionType,
	quantity: number,
	reportedBy: string,
	notes?: string,
	photoUrl?: string,
): Promise<ShortageDamageReport> {
	await delay(300);

	const report: ShortageDamageReport = {
		id: `report-${Date.now()}`,
		doId,
		itemId,
		type,
		quantity,
		notes,
		photoUrl,
		reportedBy,
		reportedAt: new Date(),
		status: "pending",
	};

	const doIndex = doList.findIndex((do_) => do_.id === doId);
	if (doIndex !== -1) {
		if (!doList[doIndex].shortageDamageReports) {
			doList[doIndex].shortageDamageReports = [];
		}
		doList[doIndex].shortageDamageReports!.push(report);
	}

	return report;
}
