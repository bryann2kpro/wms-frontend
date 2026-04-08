import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/forbidden")({
	component: ForbiddenComponent,
	head: () => ({
		meta: [
			{
				title: "Access Denied - SME Edaran WMS",
				description:
					"You do not have permission to access this page in SME Edaran WMS.",
			},
		],
	}),
});

function ForbiddenComponent() {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
			<ShieldX className="h-16 w-16 text-destructive" />
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
				<p className="text-muted-foreground max-w-sm">
					You don't have permission to view this page. Contact your
					administrator if you believe this is a mistake.
				</p>
			</div>
			<Button asChild>
				<Link to="/admin/dashboard">Go to Dashboard</Link>
			</Button>
		</div>
	);
}
