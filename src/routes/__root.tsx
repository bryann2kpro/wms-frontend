import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "@/components/ui/sonner";
import { getLocale } from "@/paraglide/runtime";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { AuthProvider } from "../lib/auth-context";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
	isAuthenticated: () => boolean;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async () => {
		// Other redirect strategies are possible; see
		// https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#offline-redirect
		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("lang", getLocale());
		}
	},

	notFoundComponent: NotFound,

	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "SME Edaran WMS",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const locale = getLocale();
	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<AuthProvider>{children}</AuthProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}

function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
			<div className="text-center">
				<h1 className="text-8xl font-bold text-primary">404</h1>
				<h2 className="mt-4 text-2xl font-semibold text-foreground">
					Page Not Found
				</h2>
				<p className="mt-2 text-muted-foreground">
					Sorry, the page you're looking for doesn't exist or has been moved.
				</p>
				<Link
					to="/"
					className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					Go back home
				</Link>
			</div>
		</div>
	);
}
