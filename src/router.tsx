import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import { hasValidTokens } from "@/lib/auth/auth-storage";
import { routeTree } from "./routeTree.gen";
import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";

export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();
	const router = createRouter({
		routeTree,
		context: { ...rqContext, isAuthenticated: () => hasValidTokens() },
		rewrite: { input: ({ url }) => deLocalizeUrl(url), output: ({ url }) => localizeUrl(url) },
		defaultPreload: "intent",
	});
	setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient });
	return router;
};
