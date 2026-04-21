import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import request from "graphql-request";
import { env } from "@/env";
import {
	PURCHASE_ORDERS_WITH_OUTLET_QUERY,
	PURCHASE_ORDERS_BY_WEEK_QUERY,
	mapGqlToPurchaseOrderList,
	mapGqlToPurchaseOrderDetail,
	type PurchaseOrdersQueryVariables,
	type PurchaseOrdersQueryData,
	type PurchaseOrdersByWeekQueryData,
} from "@/lib/graphql/purchase-orders";
import type {
	PurchaseOrderDetail,
	PurchaseOrderStatus,
	PurchaseOrderSummary,
} from "@/data/purchase-orders.types";
import {
	isInNext7Days,
	isInPastDays,
	getDateKey,
	dateKeyFromDDMMYYYY,
} from "@/lib/utils";
import type { DeliveryTab } from "@/lib/outbound";
import { getAccessToken } from "@/lib/auth/auth-storage";

export type PurchaseOrderStatusFilter = PurchaseOrderStatus | "ALL";

export interface UsePurchaseOrdersOptions {
	searchTerm?: string;
	statusFilter?: PurchaseOrderStatusFilter;
	regionFilter?: string;
	activeTab?: DeliveryTab;
	page?: number;
	pageSize?: number;
	enabled?: boolean;
}

export interface UseInfinitePurchaseOrdersOptions
	extends Omit<UsePurchaseOrdersOptions, "page"> {
	dateGroupPageSize?: number;
}

export interface PurchaseOrdersResult {
	purchaseOrders: PurchaseOrderDetail[];
	purchaseOrdersByDate: Record<string, PurchaseOrderDetail[]>;
	dateKeys: string[];
	paginatedDateKeys: string[];
	totalDateGroups: number;
	startDateIndex: number;
	totalPages: number;
	filteredTotal: number;
	summary: PurchaseOrderSummary;
}

export interface PurchaseOrdersInfinitePage {
	result: PurchaseOrdersResult;
	hasNextPage: boolean;
}

function getAuthHeaders(): Headers {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	return headers;
}

export function usePurchaseOrders(options: UsePurchaseOrdersOptions = {}) {
	const {
		searchTerm = "",
		statusFilter = "ALL",
		regionFilter = "ALL",
		activeTab = "current-week",
		page = 1,
		pageSize = 100,
		enabled = true,
	} = options;

	const variables: PurchaseOrdersQueryVariables = {
		filter: undefined,
		pageSize,
		pageNumber: 1,
	};

	type RawWeek = {
		tab: "current-week";
		entries: PurchaseOrdersByWeekQueryData["purchaseOrdersByWeek"];
	};
	type RawList = { tab: "past-weeks"; data: PurchaseOrdersQueryData };
	type RawData = RawWeek | RawList;

	return useQuery({
		queryKey: ["purchase-orders-list", pageSize, activeTab, regionFilter],
		queryFn: async (): Promise<RawData> => {
			const headers = getAuthHeaders();
			if (activeTab === "current-week") {
				const data = await request<PurchaseOrdersByWeekQueryData>(
					env.VITE_GRAPHQL_ENDPOINT,
					PURCHASE_ORDERS_BY_WEEK_QUERY,
					{ filter: null },
					headers,
				);
				return { tab: "current-week", entries: data.purchaseOrdersByWeek };
			}
			const data = await request<PurchaseOrdersQueryData>(
				env.VITE_GRAPHQL_ENDPOINT,
				PURCHASE_ORDERS_WITH_OUTLET_QUERY,
				variables,
				headers,
			);
			return { tab: "past-weeks", data };
		},
		enabled,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		select: (raw: RawData): PurchaseOrdersResult => {
			const options = {
				searchTerm,
				statusFilter,
				regionFilter,
				activeTab,
				page,
			};
			if (raw.tab === "current-week") {
				return processPurchaseOrdersFromWeek(raw.entries, options);
			}
			const result = mapGqlToPurchaseOrderList(raw.data.purchaseOrders);
			return processPurchaseOrders(result.items, result.summary, options);
		},
	});
}

/** Max weeks of history to offer for the Past Deliveries infinite scroll (≈ 1 year). */
const MAX_PAST_WEEKS = 52;

/**
 * Compute a UTC date-range window for a given week offset going backwards from today.
 * weekOffset=1 → yesterday back 7 days (the most-recent past week).
 * weekOffset=2 → 8–14 days ago, and so on.
 * Dates are aligned to UTC+8 business timezone midnight.
 */
function getPastWeekWindow(weekOffset: number): {
	fromDate: Date;
	toDate: Date;
} {
	const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
	const now = new Date();
	// Today in UTC+8, then snap to UTC midnight of that day
	const todayUTC8 = new Date(now.getTime() + UTC8_OFFSET_MS);
	todayUTC8.setUTCHours(0, 0, 0, 0);
	const todayMidnightUTC = new Date(todayUTC8.getTime() - UTC8_OFFSET_MS);

	// toDate: end of day for (weekOffset * 7) days ago, relative to yesterday
	// page 1 → yesterday (today-1), page 2 → today-8, etc.
	const daysBackTo = (weekOffset - 1) * 7 + 1;
	const toDate = new Date(todayMidnightUTC);
	toDate.setUTCDate(todayMidnightUTC.getUTCDate() - daysBackTo);
	toDate.setUTCHours(23, 59, 59, 999);

	// fromDate: 6 days before toDate → 7-day window total
	const fromDate = new Date(toDate);
	fromDate.setUTCDate(toDate.getUTCDate() - 6);
	fromDate.setUTCHours(0, 0, 0, 0);

	return { fromDate, toDate };
}

export function useInfinitePurchaseOrders(
	options: UseInfinitePurchaseOrdersOptions = {},
) {
	const {
		searchTerm = "",
		statusFilter = "ALL",
		regionFilter = "ALL",
		activeTab = "current-week",
		enabled = true,
		dateGroupPageSize = 6,
	} = options;

	return useInfiniteQuery({
		queryKey: [
			"purchase-orders-list",
			"infinite",
			activeTab,
			regionFilter,
			statusFilter,
			searchTerm,
			dateGroupPageSize,
		],
		initialPageParam: 1,
		queryFn: async ({ pageParam }): Promise<PurchaseOrdersInfinitePage> => {
			const headers = getAuthHeaders();
			const pageNumber = Number(pageParam);

			if (activeTab === "current-week") {
				// Fetch entire current week at once; reveal date groups in chunks client-side
				const data = await request<PurchaseOrdersByWeekQueryData>(
					env.VITE_GRAPHQL_ENDPOINT,
					PURCHASE_ORDERS_BY_WEEK_QUERY,
					{ filter: null },
					headers,
				);
				const fullResult = processPurchaseOrdersFromWeek(
					data.purchaseOrdersByWeek,
					{ searchTerm, statusFilter, regionFilter, activeTab, page: pageNumber },
				);
				const startIndex = (pageNumber - 1) * dateGroupPageSize;
				const paginatedDateKeys = fullResult.dateKeys.slice(
					startIndex,
					startIndex + dateGroupPageSize,
				);
				return {
					result: {
						...fullResult,
						paginatedDateKeys,
						startDateIndex: startIndex,
						totalPages: Math.max(
							1,
							Math.ceil(fullResult.dateKeys.length / dateGroupPageSize),
						),
					},
					hasNextPage: startIndex + dateGroupPageSize < fullResult.dateKeys.length,
				};
			}

			// past-weeks: one 7-day window per page, sliding backwards.
			// page 1 → yesterday…7 days ago
			// page 2 → 8…14 days ago
			// Stops when the window contains zero raw orders OR MAX_PAST_WEEKS is hit.
			const { fromDate, toDate } = getPastWeekWindow(pageNumber);

			const data = await request<PurchaseOrdersByWeekQueryData>(
				env.VITE_GRAPHQL_ENDPOINT,
				PURCHASE_ORDERS_BY_WEEK_QUERY,
				{
					filter: {
						scheduledDeliveryDateFrom: fromDate.toISOString(),
						scheduledDeliveryDateTo: toDate.toISOString(),
					},
				},
				headers,
			);

			const fullResult = processPurchaseOrdersFromWeek(
				data.purchaseOrdersByWeek,
				{ searchTerm, statusFilter, regionFilter, activeTab, page: pageNumber },
			);

			// Stop when the raw API returned no orders for this window (gone far enough back)
			// or when we've hit the safety limit.
			const hasAnyRawOrders = data.purchaseOrdersByWeek.some(
				(e) => e.orders.length > 0,
			);

			return {
				result: fullResult,
				hasNextPage: hasAnyRawOrders && pageNumber < MAX_PAST_WEEKS,
			};
		},
		getNextPageParam: (lastPage, allPages) =>
			lastPage.hasNextPage ? allPages.length + 1 : undefined,
		enabled,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});
}

interface ProcessOptions {
	searchTerm: string;
	statusFilter: PurchaseOrderStatusFilter;
	regionFilter: string;
	activeTab: DeliveryTab;
	page: number;
}

/**
 * Process purchaseOrdersByWeek API response into PurchaseOrdersResult.
 * Converts backend date keys (DD/MM/YYYY UTC) to YYYY-MM-DD for consistent table headers.
 */
function processPurchaseOrdersFromWeek(
	entries: PurchaseOrdersByWeekQueryData["purchaseOrdersByWeek"],
	options: ProcessOptions,
): PurchaseOrdersResult {
	const { searchTerm, statusFilter, regionFilter } = options;

	const purchaseOrdersByDate: Record<string, PurchaseOrderDetail[]> = {};
	const allDetails: PurchaseOrderDetail[] = [];

	for (const entry of entries) {
		const dateKey = dateKeyFromDDMMYYYY(entry.date);
		const details = (entry.orders ?? []).map(mapGqlToPurchaseOrderDetail);
		const filtered = details.filter((po) => {
			const matchesSearch =
				!searchTerm ||
				po.purchaseOrderNumber
					.toLowerCase()
					.includes(searchTerm.toLowerCase()) ||
				po.toLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(po.regionName?.toLowerCase().includes(searchTerm.toLowerCase()) ??
					false);
			const matchesStatus =
				statusFilter === "ALL" || po.status === statusFilter;
			const matchesRegion =
				regionFilter === "ALL" ||
				po.regionName === regionFilter ||
				po.regionCode === regionFilter;
			return matchesSearch && matchesStatus && matchesRegion;
		});
		purchaseOrdersByDate[dateKey] = filtered;
		allDetails.push(...filtered);
	}

	const dateKeys = entries.map((e) => dateKeyFromDDMMYYYY(e.date));
	const totalDateGroups = dateKeys.length;
	const paginatedDateKeys = dateKeys;
	const totalPages = 1;
	const startDateIndex = 0;

	const summary: PurchaseOrderSummary = {
		byStatus: {
			preparing: 0,
			"in-transit": 0,
			"to-ship": 0,
			cancel: 0,
			return: 0,
			other: 0,
		},
		total: allDetails.length,
	};
	for (const po of allDetails) {
		summary.byStatus[po.status] = (summary.byStatus[po.status] ?? 0) + 1;
	}

	return {
		purchaseOrders: allDetails,
		purchaseOrdersByDate,
		dateKeys,
		paginatedDateKeys,
		totalDateGroups,
		startDateIndex,
		totalPages,
		filteredTotal: allDetails.length,
		summary,
	};
}

function processPurchaseOrders(
	allPurchaseOrders: PurchaseOrderDetail[],
	_summary: PurchaseOrderSummary,
	options: ProcessOptions,
): PurchaseOrdersResult {
	const { searchTerm, statusFilter, regionFilter, activeTab } = options;

	const tabFilteredOrders = allPurchaseOrders.filter((po) => {
		const deliveryDate = new Date(po.expectedDeliveryDate);
		if (activeTab === "current-week") {
			return isInNext7Days(deliveryDate);
		}
		return isInPastDays(deliveryDate);
	});

	const purchaseOrders = tabFilteredOrders.filter((po) => {
		const matchesSearch =
			!searchTerm ||
			po.purchaseOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
			po.toLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(po.regionName?.toLowerCase().includes(searchTerm.toLowerCase()) ??
				false);

		const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;
		const matchesRegion =
			regionFilter === "ALL" ||
			po.regionName === regionFilter ||
			po.regionCode === regionFilter;

		return matchesSearch && matchesStatus && matchesRegion;
	});

	const purchaseOrdersByDate = purchaseOrders.reduce<
		Record<string, PurchaseOrderDetail[]>
	>((acc, po) => {
		const key = getDateKey(new Date(po.expectedDeliveryDate));
		if (!acc[key]) acc[key] = [];
		acc[key].push(po);
		return acc;
	}, {});

	const dateKeys = Object.keys(purchaseOrdersByDate).sort((a, b) =>
		activeTab === "current-week" ? a.localeCompare(b) : b.localeCompare(a),
	);

	const totalDateGroups = dateKeys.length;
	const paginatedDateKeys = dateKeys;
	const totalPages = 1;
	const startDateIndex = 0;

	const tabSummary = tabFilteredOrders.reduce(
		(acc, po) => {
			acc.byStatus[po.status] = (acc.byStatus[po.status] ?? 0) + 1;
			acc.total += 1;
			return acc;
		},
		{
			byStatus: {
				preparing: 0,
				"in-transit": 0,
				"to-ship": 0,
				cancel: 0,
				return: 0,
				other: 0,
			} as Record<PurchaseOrderStatus, number>,
			total: 0,
		},
	);

	return {
		purchaseOrders,
		purchaseOrdersByDate,
		dateKeys,
		paginatedDateKeys,
		totalDateGroups,
		startDateIndex,
		totalPages,
		filteredTotal: purchaseOrders.length,
		summary: tabSummary,
	};
}

export type UsePurchaseOrdersReturn = ReturnType<typeof usePurchaseOrders>;
