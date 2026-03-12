import { AdminLayout } from "@/components/layout/admin-layout";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
	beforeLoad: async ({ context }) => {
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
