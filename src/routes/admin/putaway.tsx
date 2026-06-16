import { createFileRoute, redirect } from "@tanstack/react-router";

/** @deprecated Use /admin/stock-transfer — putaway is merged into Bin to Bin. */
export const Route = createFileRoute("/admin/putaway")({
	beforeLoad: () => {
		throw redirect({ to: "/admin/stock-transfer" });
	},
});
