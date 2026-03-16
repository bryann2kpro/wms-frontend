import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { hasValidTokens, clearAuthTokens } from "@/lib/auth/auth-storage";
import { toast } from "sonner";

export function AdminLayout() {
	const navigate = useNavigate();

	// Client-side guard — catches the SSR hydration case where beforeLoad was
	// skipped on the server (localStorage is unavailable server-side).
	useEffect(() => {
		if (!hasValidTokens()) {
			clearAuthTokens();
			toast.warning("Session expired", { description: "Logging you out…" });
			navigate({ to: "/login", replace: true });
		}
	}, [navigate]);

	return (
		<div className="flex h-screen w-full overflow-hidden">
			<Sidebar />
			<div className="w-full">
				<Header />
				<main className="w-full h-full overflow-y-auto">
					<Outlet />
					<div className="mt-10 p-5"></div>
				</main>
			</div>
			<GlobalLoadingShadow />
		</div>
	);
}
