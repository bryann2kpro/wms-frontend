import { AdminLayout } from "@/components/layout/admin-layout";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
	beforeLoad: async ({ context }) => {
		// localStorage is unavailable during SSR — skip the check server-side.
		// The client will re-run beforeLoad on hydration and redirect if needed.
		if (typeof window === "undefined") return;

		if (!context.isAuthenticated()) {
			toast.warning("Session expired", {
				description: "Logging you out…",
			});
			throw redirect({ to: "/login" });
		}
	},
	component: AdminRoot,
});

function AdminRoot() {
	return <AdminLayout />;
}
