import { createFileRoute } from "@tanstack/react-router";
import { FileCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";

export const Route = createFileRoute("/admin/tms/pod")({
	component: TmsPodPage,
});

function TmsPodPage() {
	return (
		<main className="container mx-auto p-6 space-y-6">
			<AdminPageHeader
				icon={FileCheck}
				title="POD"
				description="Proof of delivery — coming soon."
				titleId="tms-pod-title"
				descriptionId="tms-pod-description"
			/>
			<p className="text-sm text-muted-foreground">Not yet implemented.</p>
		</main>
	);
}
