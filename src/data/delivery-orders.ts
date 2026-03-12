/**
 * Delivery Orders API. Advance status via GraphQL.
 */

import request from "graphql-request";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	ADVANCE_DELIVERY_ORDER_STATUS_MUTATION,
	type AdvanceDeliveryOrderStatusMutationData,
	type AdvanceDeliveryOrderStatusMutationVariables,
} from "@/lib/graphql/delivery-orders";
import type { DeliveryOrder } from "@/lib/graphql/types";

const getAuthHeaders = (): Headers => {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
};

/**
 * Advance a delivery order to the next step: NEW -> PACKING -> DELIVERED.
 * Invalidates purchase-orders-list so the list refreshes.
 */
export async function advanceDeliveryOrderStatus(
	deliveryOrderId: string,
): Promise<DeliveryOrder> {
	const data = await request<
		AdvanceDeliveryOrderStatusMutationData,
		AdvanceDeliveryOrderStatusMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		ADVANCE_DELIVERY_ORDER_STATUS_MUTATION,
		{ id: deliveryOrderId },
		getAuthHeaders(),
	);
	return data.advanceDeliveryOrderStatus;
}
