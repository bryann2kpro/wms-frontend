import request from "graphql-request";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	CUSTOMER_PRIORITIES_QUERY,
	REORDER_CUSTOMER_PRIORITIES_MUTATION,
	UPSERT_CUSTOMER_PRIORITY_MUTATION,
	type CustomerPrioritiesQueryData,
	type CustomerPriority,
	type ReorderCustomerPrioritiesMutationData,
	type ReorderCustomerPrioritiesMutationVariables,
	type UpsertCustomerPriorityInput,
	type UpsertCustomerPriorityMutationData,
	type UpsertCustomerPriorityMutationVariables,
} from "@/lib/graphql/customer-priority";

const getAuthHeaders = (): Headers => {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
};

export async function fetchCustomerPriorities(): Promise<CustomerPriority[]> {
	const data = await request<CustomerPrioritiesQueryData>(
		env.VITE_GRAPHQL_ENDPOINT,
		CUSTOMER_PRIORITIES_QUERY,
		undefined,
		getAuthHeaders(),
	);
	return data.customerPriorities;
}

export async function upsertCustomerPriority(
	input: UpsertCustomerPriorityInput,
): Promise<CustomerPriority> {
	const data = await request<
		UpsertCustomerPriorityMutationData,
		UpsertCustomerPriorityMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		UPSERT_CUSTOMER_PRIORITY_MUTATION,
		{ input },
		getAuthHeaders(),
	);
	return data.upsertCustomerPriority;
}

export async function reorderCustomerPriorities(
	ranking: Array<{ customerCode: string }>,
): Promise<CustomerPriority[]> {
	const data = await request<
		ReorderCustomerPrioritiesMutationData,
		ReorderCustomerPrioritiesMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		REORDER_CUSTOMER_PRIORITIES_MUTATION,
		{ ranking },
		getAuthHeaders(),
	);
	return data.reorderCustomerPriorities;
}
