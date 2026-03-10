import { faker } from "@faker-js/faker";

export interface InventoryItem {
	id: string;
	sku: string;
	description: string;
	location: string;
	quantity: number;
	reservedQuantity: number;
	availableQuantity: number;
	minimumStockLevel: number;
	maximumStockLevel: number;
	unitCost?: number;
	lastUpdated: Date;
}

export interface StockSyncStatus {
	lastSyncTime: Date;
	status: "OK" | "Fail";
	errorMessage?: string;
	nextSyncTime?: Date;
}

export interface InventoryListFilters {
	page: number;
	pageSize: number;
	search?: string;
	location?: string;
	lowStock?: boolean;
	lowStockThreshold?: number;
}

export interface InventoryListResult {
	items: InventoryItem[];
	page: number;
	pageSize: number;
	total: number;
	syncStatus: StockSyncStatus;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate mock inventory
const inventoryItems: InventoryItem[] = Array.from({ length: 50 }, (_, i) => {
	const quantity = 50 + i * 10;
	const reservedQuantity = i % 5 === 0 ? 10 + (i % 20) : 0;
	const minimumStockLevel = 20;
	const maximumStockLevel = 200;

	return {
		id: `inv-${i}`,
		sku: `SKU-${String(i + 1).padStart(3, "0")}`,
		description: faker.commerce.productName(),
		location: `A-${String(Math.floor(i / 10)).padStart(2, "0")}-${String(i % 10).padStart(2, "0")}`,
		quantity,
		reservedQuantity,
		availableQuantity: quantity - reservedQuantity,
		minimumStockLevel,
		maximumStockLevel,
		unitCost: 10 + i * 2,
		lastUpdated: new Date(Date.now() - i * 3600000),
	};
});

// Mock sync status
let syncStatus: StockSyncStatus = {
	lastSyncTime: new Date(Date.now() - 3600000), // 1 hour ago
	status: "OK",
	nextSyncTime: new Date(Date.now() + 11 * 3600000), // Next sync in 11 hours (12pm daily)
};

export async function getInventory(
	filters: InventoryListFilters,
): Promise<InventoryListResult> {
	await delay(300);

	const { page, pageSize, search, location, lowStock, lowStockThreshold } =
		filters;

	let filtered = [...inventoryItems];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((item) => {
			return (
				item.sku.toLowerCase().includes(term) ||
				item.description.toLowerCase().includes(term)
			);
		});
	}

	if (location) {
		filtered = filtered.filter((item) => item.location === location);
	}

	if (lowStock) {
		filtered = filtered.filter((item) => {
			const threshold = lowStockThreshold ?? item.minimumStockLevel;
			return item.availableQuantity <= threshold;
		});
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		page,
		pageSize,
		total,
		syncStatus,
	};
}

export async function getInventoryItemBySKU(
	sku: string,
): Promise<InventoryItem | undefined> {
	await delay(200);
	return inventoryItems.find((item) => item.sku === sku);
}

export async function updateStockSyncStatus(
	status: "OK" | "Fail",
	errorMessage?: string,
): Promise<StockSyncStatus> {
	await delay(200);

	syncStatus = {
		...syncStatus,
		lastSyncTime: new Date(),
		status,
		errorMessage,
		nextSyncTime: new Date(Date.now() + 24 * 3600000), // Next sync in 24 hours
	};

	return syncStatus;
}
