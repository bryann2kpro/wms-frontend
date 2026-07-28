import { createFileRoute } from "@tanstack/react-router";
import { EmpireSushiDOComponent } from "@/routes/admin/es-do";

export const Route = createFileRoute("/admin/tms/picking")({
	component: EmpireSushiDOComponent,
	head: () => ({
		meta: [
			{
				title: "Picking - SME Edaran WMS",
				description: "Delivery order work queue for picking — same view as Empire Sushi DO Work Queue.",
			},
		],
	}),
});
