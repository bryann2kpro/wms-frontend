import { useQuery } from "@tanstack/react-query";
import request from "graphql-request";
import { env } from "@/env";
import {
	PURCHASE_ORDERS_WITH_OUTLET_QUERY,
	mapGqlToPurchaseOrderList,
	type PurchaseOrdersQueryVariables,
	type PurchaseOrdersQueryData,
} from "@/lib/graphql/purchase-orders";
import type { PurchaseOrderDetail, PurchaseOrderStatus, PurchaseOrderSummary } from "@/data/purchase-orders.types";
import { isInNext7Days, isInPastDays, getDateKey } from "@/lib/utils";
import type { DeliveryTab } from "@/lib/outbound";
import { DATE_GROUPS_PER_PAGE } from "@/lib/outbound";

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
	const token = localStorage.getItem("access_token");
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

	return useQuery({
		queryKey: ["purchase-orders-list", pageSize],
		queryFn: async (): Promise<PurchaseOrdersResult> => {
			const headers = getAuthHeaders();
			const data = await request<PurchaseOrdersQueryData>(
				env.VITE_GRAPHQL_ENDPOINT,
				PURCHASE_ORDERS_WITH_OUTLET_QUERY,
				variables,
				headers,
			);

			const result = mapGqlToPurchaseOrderList(data.purchaseOrders);
			return processPurchaseOrders(result.items, result.summary, {
				searchTerm,
				statusFilter,
				activeTab,
				page,
			});
		},
		enabled,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		select: (data) => {
			return processPurchaseOrders(data.purchaseOrders, data.summary, {
				searchTerm,
				statusFilter,
				activeTab,
				page,
			});
		},
	});
}

interface ProcessOptions {
	searchTerm: string;
	statusFilter: PurchaseOrderStatusFilter;
	activeTab: DeliveryTab;
	page: number;
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
			po.purchaseOrderNumber
				.toLowerCase()
				.includes(searchTerm.toLowerCase()) ||
			po.toLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(po.regionName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

		const matchesStatus =
			statusFilter === "ALL" || po.status === statusFilter;

		return matchesSearch && matchesStatus;
	});

	const purchaseOrdersByDate = purchaseOrders.reduce<Record<string, PurchaseOrderDetail[]>>(
		(acc, po) => {
			const key = getDateKey(new Date(po.expectedDeliveryDate));
			if (!acc[key]) acc[key] = [];
			acc[key].push(po);
			return acc;
		},
		{},
	);

	const dateKeys = Object.keys(purchaseOrdersByDate).sort((a, b) =>
		activeTab === "current-week" ? a.localeCompare(b) : b.localeCompare(a),
	);

	const totalDateGroups = dateKeys.length;
	const startDateIndex = (page - 1) * DATE_GROUPS_PER_PAGE;
	const paginatedDateKeys = dateKeys.slice(
		startDateIndex,
		startDateIndex + DATE_GROUPS_PER_PAGE,
	);
	const totalPages = Math.max(1, Math.ceil(totalDateGroups / DATE_GROUPS_PER_PAGE));

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
