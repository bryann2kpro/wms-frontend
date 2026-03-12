import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Outlet } from "@tanstack/react-router";

export function AdminLayout() {
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
