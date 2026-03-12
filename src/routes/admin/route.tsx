import { AdminLayout } from "@/components/layout/admin-layout";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
	beforeLoad: async ({ context }) => {
		if (!context.isAuthenticated()) {
			throw redirect({ to: "/login" });
		}
	},
	component: AdminRoot,
});

function AdminRoot() {
	return <AdminLayout />;
}
