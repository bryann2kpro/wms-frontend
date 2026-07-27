import { createFileRoute } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";

export const Route = createFileRoute("/admin/tms/routing")({
	component: TmsRoutingPage,
});

function TmsRoutingPage() {
	return (
		<main className="container mx-auto p-6 space-y-6">
			<AdminPageHeader
				icon={RouteIcon}
				title="Routing"
				description="TMS delivery routing — coming soon."
				titleId="tms-routing-title"
				descriptionId="tms-routing-description"
			/>
			<p className="text-sm text-muted-foreground">Not yet implemented.</p>
		</main>
	);
}
