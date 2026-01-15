import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/forgot-password")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
			<Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
				<CardHeader className="space-y-1 pb-6">
					<CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-slate-800 bg-clip-text text-transparent">
						Forgot Password
					</CardTitle>
					<CardDescription className="text-center text-base">
						Enter your email to reset your password
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground text-center">
							Password reset functionality will be implemented here.
						</p>
						<Link to="/login">
							<Button variant="outline" className="w-full">
								Back to Login
							</Button>
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
