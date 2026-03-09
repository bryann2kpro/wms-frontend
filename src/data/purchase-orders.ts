/**
 * Purchase Orders API. List and create via GraphQL.
 */

import request from "graphql-request";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	CREATE_PURCHASE_ORDER_MUTATION,
	mapGqlToPurchaseOrderDetail,
	type CreatePurchaseOrderMutationData,
	type CreatePurchaseOrderMutationVariables,
} from "@/lib/graphql/purchase-orders";
import type {
	PurchaseOrderDetail,
	PurchaseOrderListFilters,
	PurchaseOrderListResult,
	PurchaseOrderStatus,
	PurchaseOrderSummary,
	CreatePurchaseOrderInput,
} from "./purchase-orders.types";

const emptySummary: PurchaseOrderSummary = {
	byStatus: {
		preparing: 0,
		"in-transit": 0,
		"to-ship": 0,
		cancel: 0,
		return: 0,
		other: 0,
	},
	total: 0,
};

export type {
	PurchaseOrderDetail,
	PurchaseOrderStatus,
	PurchaseOrderStatusFilter,
	CreatePurchaseOrderInput,
	CreatePurchaseOrderLineItemInput,
} from "./purchase-orders.types";

/** List purchase orders. Use GraphQL via usePurchaseOrders hook; this is for legacy/custom filters. */
export async function getPurchaseOrders(
	filters: PurchaseOrderListFilters,
): Promise<PurchaseOrderListResult> {
	const { page, pageSize } = filters;
	return {
		items: [],
		summary: emptySummary,
		page,
		pageSize,
		total: 0,
	};
}

/** Create a purchase order via GraphQL. Persists to backend; invalidate purchase-orders-list to see it in the list. */
export async function createPurchaseOrder(
	input: CreatePurchaseOrderInput,
): Promise<PurchaseOrderDetail> {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);

	const variables: CreatePurchaseOrderMutationVariables["input"] = {
		purchaseOrderNo: input.purchaseOrderNumber,
		outletId: input.outletId,
		items: (input.items ?? []).map((line) => ({
			skuCode: line.skuCode ?? line.skuId ?? "",
			skuId: line.skuId || undefined,
			qtyRequired: line.quantity,
		})),
	};

	const data = await request<CreatePurchaseOrderMutationData>(
		env.VITE_GRAPHQL_ENDPOINT,
		CREATE_PURCHASE_ORDER_MUTATION,
		{ input: variables },
		headers,
	);

	const po = data.createPurchaseOrder;
	return mapGqlToPurchaseOrderDetail({ ...po, outlet: null });
}

/** Update purchase order status (e.g. accept / reject). No-op until backend is connected. */
export async function updatePurchaseOrderStatus(
	_id: string,
	_status: PurchaseOrderStatus,
): Promise<PurchaseOrderDetail | undefined> {
	return undefined;
}
