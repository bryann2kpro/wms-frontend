import { createFileRoute } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
	CustomerPriorityRanking,
	ReservationListCard,
} from "@/components/reservation";
import { requireAdminRole } from "@/lib/rbac/require-admin-role";

export const Route = createFileRoute("/admin/reservations")({
	beforeLoad: async ({ context }) => {
		await requireAdminRole(context.queryClient);
	},
	component: ReservationsPage,
	head: () => ({
		meta: [
			{
				title: "Order Reservations - SME Edaran WMS",
				description:
					"Manage stock reservations and customer priority ordering.",
			},
		],
	}),
});

function ReservationsPage() {
	return (
		<main
			className="flex flex-1 flex-col gap-6 p-4 md:p-6"
			aria-labelledby="reservations-page-title"
			aria-describedby="reservations-page-description"
		>
			<AdminPageHeader
				icon={Bookmark}
				title="Order Reservations"
				description="Hold stock for priority customers during a reserve window. Lower customer rank = higher allocation priority."
				titleId="reservations-page-title"
				descriptionId="reservations-page-description"
			/>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<ReservationListCard />
				<CustomerPriorityRanking />
			</div>
		</main>
	);
}
