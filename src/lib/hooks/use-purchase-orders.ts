import { useQuery } from "@tanstack/react-query";
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
	activeTab?: DeliveryTab;
	page?: number;
	pageSize?: number;
	enabled?: boolean;
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
		queryKey: ["purchase-orders-list", pageSize, activeTab],
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
			const options = { searchTerm, statusFilter, activeTab, page };
			if (raw.tab === "current-week") {
				return processPurchaseOrdersFromWeek(raw.entries, options);
			}
			const result = mapGqlToPurchaseOrderList(raw.data.purchaseOrders);
			return processPurchaseOrders(result.items, result.summary, options);
		},
	});
}

interface ProcessOptions {
	searchTerm: string;
	statusFilter: PurchaseOrderStatusFilter;
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
	const { searchTerm, statusFilter, page } = options;

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
			return matchesSearch && matchesStatus;
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
	summary: PurchaseOrderSummary,
	options: ProcessOptions,
): PurchaseOrdersResult {
	const { searchTerm, statusFilter, activeTab, page } = options;

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

		return matchesSearch && matchesStatus;
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
