import { useAuth } from "@/lib/auth-context";
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: () => {
		const { isAuthenticated } = useAuth();
		if (isAuthenticated) {
			return <Navigate to="/admin/dashboard" />;
		}
		return <Navigate to="/login" />;
	},
});
