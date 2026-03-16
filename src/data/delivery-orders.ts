/**
 * Delivery Orders API. Advance status via GraphQL.
 */

import request from "graphql-request";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	ADVANCE_DELIVERY_ORDER_STATUS_MUTATION,
	SUBMIT_DELIVERY_PROOF_MUTATION,
	type AdvanceDeliveryOrderStatusMutationData,
	type AdvanceDeliveryOrderStatusMutationVariables,
	type SubmitDeliveryProofMutationData,
	type SubmitDeliveryProofMutationVariables,
} from "@/lib/graphql/delivery-orders";
import type { DeliveryOrder } from "@/lib/graphql/types";

const getAuthHeaders = (): Headers => {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
};

/**
 * Advance a delivery order to the next step: NEW -> PACKING -> SHIPPED.
 * (SHIPPED -> DELIVERED requires proof upload via submitDeliveryProof.)
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

/**
 * Submit proof of delivery for a SHIPPED DO.
 * Saves the signed DO document and advances status to DELIVERED.
 */
export async function submitDeliveryProof(
	doId: string,
	fileUrl: string,
	fileName: string,
	fileSizeBytes: number,
	mimeType: string,
): Promise<DeliveryOrder> {
	const data = await request<
		SubmitDeliveryProofMutationData,
		SubmitDeliveryProofMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		SUBMIT_DELIVERY_PROOF_MUTATION,
		{ doId, fileUrl, fileName, fileSizeBytes, mimeType },
		getAuthHeaders(),
	);
	return data.submitDeliveryProof;
}
