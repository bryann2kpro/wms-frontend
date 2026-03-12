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
import { getAccessToken, hasValidTokens } from "@/lib/auth/auth-storage";
import { env } from "@/env";

import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

const graphqlUri =
	env.VITE_GRAPHQL_ENDPOINT ?? `${env.VITE_API_URL.replace(/\/$/, "")}/graphql`;

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
		link: authLink.concat(
			new HttpLink({
				uri: graphqlUri,
				headers: { "Content-Type": "application/json" },
			}),
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
