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
			className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:gap-5 md:p-5 lg:max-h-[calc(100vh-4rem)]"
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
			<div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] xl:items-start xl:gap-5">
				<ReservationListCard className="min-h-0 xl:min-h-[28rem]" />
				<CustomerPriorityRanking className="xl:sticky xl:top-4" />
			</div>
		</main>
	);
}
