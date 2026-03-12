import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		// Skip during SSR — localStorage is unavailable server-side
		if (typeof window === "undefined") return;
		throw redirect({
			to: context.isAuthenticated() ? "/admin/dashboard" : "/login",
		});
	},
});
