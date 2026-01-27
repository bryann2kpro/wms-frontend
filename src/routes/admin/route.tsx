
import { AdminLayout } from "@/components/layout/admin-layout";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
	component: AdminRoot,
});

function AdminRoot() {
	return (
		<AdminLayout />
	);
}
