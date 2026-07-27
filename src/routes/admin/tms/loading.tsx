import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";

export const Route = createFileRoute("/admin/tms/loading")({
	component: TmsLoadingPage,
});

function TmsLoadingPage() {
	return (
		<div className="space-y-6">
			<AdminPageHeader
				icon={Boxes}
				title="Loading"
				description="TMS loading workflow — coming soon."
				titleId="tms-loading-title"
				descriptionId="tms-loading-description"
			/>
			<p className="text-sm text-muted-foreground">Not yet implemented.</p>
		</div>
	);
}
