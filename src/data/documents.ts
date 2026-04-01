/**
 * Document generation (PDF) via GraphQL.
 */

import request from "graphql-request";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	GENERATE_DELIVERY_ORDER_PDF_MUTATION,
	type GenerateDeliveryOrderPdfMutationData,
	type GenerateDeliveryOrderPdfMutationVariables,
} from "@/lib/graphql/documents";

const getAuthHeaders = (): Headers => {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
};

/** Returns the public HTTPS URL of the uploaded delivery order PDF. */
export async function generateDeliveryOrderPdfUrl(
	deliveryOrderId: string,
): Promise<string> {
	const data = await request<
		GenerateDeliveryOrderPdfMutationData,
		GenerateDeliveryOrderPdfMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		GENERATE_DELIVERY_ORDER_PDF_MUTATION,
		{ deliveryOrderId },
		getAuthHeaders(),
	);
	return data.generateDeliveryOrderPdf.s3Url;
}
