import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";

import {
	routerWithApolloClient,
	ApolloClient,
	InMemoryCache,
} from "@apollo/client-integration-tanstack-start";
import { HttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import {
	getAccessToken,
	hasValidTokens,
	clearAuthTokens,
} from "@/lib/auth/auth-storage";
import { env } from "@/env";
import { toast } from "sonner";

import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

const graphqlUri =
	env.VITE_GRAPHQL_ENDPOINT ?? `${env.VITE_API_URL.replace(/\/$/, "")}/graphql`;

// Mirrors the handleAuthFailure pattern in axios-v1.ts
function handleGqlAuthFailure(): void {
	if (typeof window === "undefined") return; // SSR guard
	clearAuthTokens();
	toast.warning("Session expired", { description: "Logging you out…" });
	window.location.href = "/login";
}

const errorLink = onError(({ graphQLErrors, networkError }) => {
	// GraphQL-level auth error (HTTP 200 but UNAUTHENTICATED in body)
	if (graphQLErrors?.some((e) => e.extensions?.code === "UNAUTHENTICATED")) {
		handleGqlAuthFailure();
		return;
	}
	// Network-level 401 (server rejected the request outright)
	if (
		networkError &&
		"statusCode" in networkError &&
		networkError.statusCode === 401
	) {
		handleGqlAuthFailure();
	}
});

const authLink = setContext((_, { headers }) => {
	const token = getAccessToken();
	return {
		headers: {
			...headers,
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
	};
});

// Create a new router instance
export const getRouter = () => {
	// Configure Apollo Client
	const apolloClient = new ApolloClient({
		cache: new InMemoryCache(),
		link: errorLink.concat(
			authLink.concat(
				new HttpLink({
					uri: graphqlUri,
					headers: { "Content-Type": "application/json" },
				}),
			),
		),
	});

	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: {
			...routerWithApolloClient.defaultContext,

			...rqContext,
			isAuthenticated: () => hasValidTokens(),
		},

		// Paraglide URL rewrite docs: https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#rewrite-url
		rewrite: {
			input: ({ url }) => deLocalizeUrl(url),
			output: ({ url }) => localizeUrl(url),
		},

		defaultPreload: "intent",
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
	});

	return routerWithApolloClient(router, apolloClient);
};
