import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";

export const Route = createFileRoute("/admin/tms/drivers")({
	component: TmsDriversPage,
});

function TmsDriversPage() {
	return (
		<div className="space-y-6">
			<AdminPageHeader
				icon={Users}
				title="Drivers"
				description="Driver management — coming soon."
				titleId="tms-drivers-title"
				descriptionId="tms-drivers-description"
			/>
			<p className="text-sm text-muted-foreground">Not yet implemented.</p>
		</div>
	);
}
