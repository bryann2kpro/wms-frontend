import type { TransferOrder } from "./dashboard.mock-data";
import { mockTransferOrders as baseTransfers } from "./dashboard.mock-data";
import { BACKEND_DAY_OF_WEEK } from "@/lib/utils";

export type TransferStatus = "preparing" | "in-transit" | "to-ship" | "cancel" | "return" | "other";
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
	/** Region name (e.g. Klang Valley). Outlet belongs to one region. */
	regionName?: string | null;
	/** Region code (e.g. KV). */
	regionCode?: string | null;
}

export type TransferStatusFilter = TransferStatus | "ALL";

/** Default regions: Klang Valley (KV), Perlis, North, South, East Coast */
const REGIONS: { name: string; code: string }[] = [
	{ name: "Klang Valley", code: "KV" },
	{ name: "Perlis", code: "PRS" },
	{ name: "North", code: "N" },
	{ name: "South", code: "S" },
	{ name: "East Coast", code: "EC" },
];

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

/** Backend day-of-week: Monday = 1, ..., Sunday = 7. Get that day in the current week at midnight. */
function getDayInCurrentWeek(backendDayOfWeek: number): Date {
	const now = new Date();
	const d = new Date(now);
	const jsDay = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
	const backendCurrent = jsDay === 0 ? BACKEND_DAY_OF_WEEK.SUNDAY : jsDay;
	const diff = backendDayOfWeek - backendCurrent;
	const daysToAdd = diff >= 0 ? diff : diff + 7;
	d.setDate(d.getDate() + daysToAdd);
	// Keep result in current week (Monday–Sunday)
	const startOfThisWeek = new Date(now);
	startOfThisWeek.setDate(now.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
	const endOfThisWeek = new Date(startOfThisWeek);
	endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
	if (d > endOfThisWeek) d.setDate(d.getDate() - 7);
	else if (d < startOfThisWeek) d.setDate(d.getDate() + 7);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Get Tuesday or Thursday in a past week. weeksAgo = 1 is last week. */
function getDayInPastWeek(backendDayOfWeek: number, weeksAgo: number): Date {
	const d = getDayInCurrentWeek(backendDayOfWeek);
	d.setDate(d.getDate() - 7 * weeksAgo);
	return d;
}

/** Set date to midnight (local) so week comparison is timezone-safe */
function toMidnight(d: Date): Date {
	const out = new Date(d);
	out.setHours(0, 0, 0, 0);
	return out;
}

/** Build delivery dates for mock: current week Tue/Thu + past Tue/Thu (all at midnight) */
function getMockDeliveryDates(): Date[] {
	const now = new Date();
	const currentDay = now.getDay();
	const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
	const thisMonday = new Date(now);
	thisMonday.setDate(now.getDate() + mondayOffset);
	thisMonday.setHours(0, 0, 0, 0);
	const thisTuesday = new Date(thisMonday);
	thisTuesday.setDate(thisMonday.getDate() + 1);
	const thisThursday = new Date(thisMonday);
	thisThursday.setDate(thisMonday.getDate() + 3);

	const lastTue = new Date(thisTuesday);
	lastTue.setDate(thisTuesday.getDate() - 7);
	const lastThu = new Date(thisThursday);
	lastThu.setDate(thisThursday.getDate() - 7);
	const twoWeeksTue = new Date(thisTuesday);
	twoWeeksTue.setDate(thisTuesday.getDate() - 14);
	const twoWeeksThu = new Date(thisThursday);
	twoWeeksThu.setDate(thisThursday.getDate() - 14);

	return [
		toMidnight(thisTuesday),
		toMidnight(thisTuesday),
		toMidnight(thisThursday),
		toMidnight(thisThursday),
		toMidnight(thisThursday),
		toMidnight(lastTue),
		toMidnight(lastTue),
		toMidnight(lastThu),
		toMidnight(lastThu),
		toMidnight(twoWeeksTue),
		toMidnight(twoWeeksThu),
	];
}

const mockDeliveryDates = getMockDeliveryDates();

let transferDetails: TransferDetail[] = baseTransfers.map((transfer, index) => {
	const items: TransferItem[] = [
		{
			id: `${transfer.id}-1`,
			sku: `SKU-TO-${index + 1}01`,
			description: "Standard inventory item",
			quantity: 20,
			pickedQuantity:
				transfer.status === "to-ship" || transfer.status === "in-transit"
					? 20
					: transfer.status === "preparing"
						? 10
						: 0,
			packedQuantity:
				transfer.status === "to-ship" || transfer.status === "in-transit"
					? 20
					: transfer.status === "preparing"
						? 5
						: 0,
		},
		{
			id: `${transfer.id}-2`,
			sku: `SKU-TO-${index + 1}02`,
			description: "Secondary item",
			quantity: 15,
			pickedQuantity:
				transfer.status === "to-ship" || transfer.status === "in-transit"
					? 15
					: transfer.status === "preparing"
						? 8
						: 0,
			packedQuantity:
				transfer.status === "to-ship" || transfer.status === "in-transit"
					? 15
					: transfer.status === "preparing"
						? 3
						: 0,
		},
		{
			id: `${transfer.id}-3`,
			sku: `SKU-TO-${index + 1}03`,
			description: "Tertiary item",
			quantity: 10,
			pickedQuantity:
				transfer.status === "to-ship" || transfer.status === "in-transit"
					? 10
					: transfer.status === "preparing"
						? 5
						: 0,
			packedQuantity:
				transfer.status === "to-ship" || transfer.status === "in-transit"
					? 10
					: transfer.status === "preparing"
						? 2
						: 0,
		},
	];

	const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
	// Map old statuses to new ones for mock data
	const statusMap: Record<string, TransferStatus> = {
		"To Ship": "to-ship",
		"Cancel": "cancel",
		"in-transit": "in-transit",
		"preparing": "preparing",
		"return": "return",
		"other": "other",
	};
	const status: TransferStatus = statusMap[transfer.status] || "preparing";

	const netsuiteStatus: NetSuiteStatus =
		status === "to-ship"
			? index % 3 === 0
				? "synced"
				: index % 3 === 1
					? "error"
					: "pending"
			: status === "preparing"
				? index % 2 === 0
					? "synced"
					: "pending"
				: undefined;

	// Use precomputed Tuesday/Thursday delivery dates (cycle if more than dates length)
	const expectedDeliveryDate = mockDeliveryDates[index % mockDeliveryDates.length];
	const createdDate = new Date(expectedDeliveryDate);
	createdDate.setDate(createdDate.getDate() - 3);

	const region = REGIONS[index % REGIONS.length];
	return {
		...transfer,
		status,
		createdDate,
		expectedDeliveryDate: new Date(expectedDeliveryDate.getTime()),
		createdBy: index % 2 === 0 ? "John Doe" : "Jane Smith",
		notes: index % 2 === 0 ? "Handle with care. Fragile items." : undefined,
		items,
		totalItems,
		netsuiteStatus,
		regionName: region.name,
		regionCode: region.code,
	};
});

// Add extra mock transfers so Next Delivery and Past Deliveries both have several rows
const extraTransfersForNextAndPast: Omit<TransferDetail, "expectedDeliveryDate" | "createdDate">[] = [];
const nextTuesday = getDayInCurrentWeek(BACKEND_DAY_OF_WEEK.TUESDAY);
const nextThursday = getDayInCurrentWeek(BACKEND_DAY_OF_WEEK.THURSDAY);
const outlets = ["Outlet North", "Outlet South", "Outlet East", "Outlet West", "Outlet Central"];
const statuses: TransferStatus[] = ["preparing", "in-transit", "to-ship", "cancel", "return", "other"];
for (let i = 0; i < 4; i++) {
	const base = baseTransfers[i % baseTransfers.length];
	const region = REGIONS[i % REGIONS.length];
	extraTransfersForNextAndPast.push({
		id: `next-${i + 100}`,
		transferOrderNumber: `PO-2025-N${i + 1}`,
		fromLocation: base.fromLocation,
		toLocation: outlets[i % outlets.length],
		status: statuses[i % statuses.length],
		createdBy: "Jane Smith",
		notes: undefined,
		items: [
			{ id: `next-${i}-1`, sku: `SKU-N${i}01`, description: "Item", quantity: 10, pickedQuantity: 0, packedQuantity: 0 },
		],
		totalItems: 10,
		netsuiteStatus: i % 2 === 0 ? "pending" : "synced" as NetSuiteStatus,
		regionName: region.name,
		regionCode: region.code,
	} as TransferDetail);
}
const extraNextDeliveryDates: Date[] = [
	nextTuesday,
	nextTuesday,
	nextThursday,
	nextThursday,
];
for (let i = 0; i < extraTransfersForNextAndPast.length; i++) {
	const t = extraTransfersForNextAndPast[i];
	const expectedDeliveryDate = extraNextDeliveryDates[i];
	const createdDate = new Date(expectedDeliveryDate);
	createdDate.setDate(createdDate.getDate() - 2);
	transferDetails.push({
		...t,
		expectedDeliveryDate: new Date(expectedDeliveryDate.getTime()),
		createdDate,
	});
}
// Past deliveries: only Tuesday and Thursday
const pastTuesday1 = getDayInPastWeek(BACKEND_DAY_OF_WEEK.TUESDAY, 1);
const pastThursday1 = getDayInPastWeek(BACKEND_DAY_OF_WEEK.THURSDAY, 1);
const pastTuesday2 = getDayInPastWeek(BACKEND_DAY_OF_WEEK.TUESDAY, 2);
const pastThursday2 = getDayInPastWeek(BACKEND_DAY_OF_WEEK.THURSDAY, 2);
const pastDeliveryDates: Date[] = [pastTuesday1, pastTuesday1, pastThursday1, pastThursday1, pastTuesday2, pastThursday2];
const pastOutlets = ["Outlet Historic A", "Outlet Historic B", "Outlet Historic C", "Outlet Historic D", "Outlet Historic E", "Outlet Historic F"];
for (let i = 0; i < 6; i++) {
	const base = baseTransfers[i % baseTransfers.length];
	const expectedDeliveryDate = pastDeliveryDates[i];
	const createdDate = new Date(expectedDeliveryDate);
	createdDate.setDate(createdDate.getDate() - 2);
	const region = REGIONS[i % REGIONS.length];
	transferDetails.push({
		id: `past-${i + 200}`,
		transferOrderNumber: `PO-2025-P${i + 1}`,
		fromLocation: base.fromLocation,
		toLocation: pastOutlets[i],
		status: (["preparing", "in-transit", "to-ship", "cancel", "return", "other"] as TransferStatus[])[i],
		createdDate,
		expectedDeliveryDate: new Date(expectedDeliveryDate.getTime()),
		createdBy: i % 2 === 0 ? "John Doe" : "Jane Smith",
		notes: undefined,
		items: [
			{ id: `past-${i}-1`, sku: `SKU-P${i}01`, description: "Past item", quantity: 15, pickedQuantity: 15, packedQuantity: 15 },
		],
		totalItems: 15,
		netsuiteStatus: "synced" as NetSuiteStatus,
		regionName: region.name,
		regionCode: region.code,
	});
}

function buildSummary(source: TransferDetail[]): TransferSummary {
	const initial: Record<TransferStatus, number> = {
		"in-transit": 0,
		preparing: 0,
		"to-ship": 0,
		cancel: 0,
		return: 0,
		other: 0,
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
		status: "preparing",
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
