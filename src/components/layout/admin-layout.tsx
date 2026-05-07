import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { clearAuthTokens, hasValidTokens } from "@/lib/auth/auth-storage";

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

	const isNarrow = useMediaQuery("(max-width: 1279px)");
	const [open, setOpen] = useState(!isNarrow);
	const lastIsNarrow = useRef(isNarrow);
	useEffect(() => {
		if (lastIsNarrow.current !== isNarrow) {
			setOpen(!isNarrow);
			lastIsNarrow.current = isNarrow;
		}
	}, [isNarrow]);

	return (
		<SidebarProvider open={open} onOpenChange={setOpen}>
			<div className="flex h-screen w-full overflow-hidden">
				<Sidebar />
				<div className="flex flex-1 min-w-0 flex-col">
					<Header />
					<main className="flex-1 overflow-y-auto overflow-x-hidden">
						<Outlet />
						<div className="mt-10 p-5"></div>
					</main>
				</div>
				<GlobalLoadingShadow />
			</div>
		</SidebarProvider>
	);
}
