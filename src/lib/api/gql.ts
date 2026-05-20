import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import request, { type RequestExtendedOptions } from "graphql-request";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";

function getAuthHeaders(): Headers {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
}

export function gqlRequest<TData, TVariables extends object = object>(
	document: TypedDocumentNode<TData, TVariables> | string,
	variables?: TVariables,
): Promise<TData> {
	return request({
		url: env.VITE_GRAPHQL_ENDPOINT,
		document,
		...(variables !== undefined ? { variables } : {}),
		requestHeaders: getAuthHeaders(),
	} as unknown as RequestExtendedOptions<TVariables, TData>);
}
