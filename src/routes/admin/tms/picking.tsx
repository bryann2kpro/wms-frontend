import { createFileRoute } from "@tanstack/react-router";
import { EmpireSushiDOComponent } from "@/routes/admin/es-do";

function PickingPage() {
	return (
		<EmpireSushiDOComponent
			title="Picking"
			description="Delivery order work queue for picking — stock movement based on DO."
			singleDateMode
		/>
	);
}

export const Route = createFileRoute("/admin/tms/picking")({
	component: PickingPage,
	head: () => ({
		meta: [
			{
				title: "Picking - SME Edaran WMS",
				description: "Delivery order work queue for picking.",
			},
		],
	}),
});
