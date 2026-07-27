import { createFileRoute } from "@tanstack/react-router";
import { PackageCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";

export const Route = createFileRoute("/admin/tms/packing")({
	component: TmsPackingPage,
});

function TmsPackingPage() {
	return (
		<main className="container mx-auto p-6 space-y-6">
			<AdminPageHeader
				icon={PackageCheck}
				title="Packing"
				description="TMS packing workflow — coming soon."
				titleId="tms-packing-title"
				descriptionId="tms-packing-description"
			/>
			<p className="text-sm text-muted-foreground">Not yet implemented.</p>
		</main>
	);
}
