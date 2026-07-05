import { createFileRoute, redirect } from "@tanstack/react-router";

/** @deprecated Use /admin/inventory?tab=reservations — reservations live under Inventory. */
export const Route = createFileRoute("/admin/reservations")({
	beforeLoad: () => {
		throw redirect({ to: "/admin/inventory", search: { tab: "reservations" } });
	},
});
