import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
	LayoutDashboard,
	Package,
	ArrowRightLeft,
	Truck,
	Settings,
	LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navigation = [
	{ name: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
	{ name: "GRN", to: "/admin/grn", icon: Package },
	{ name: "Transfer Orders", to: "/admin/transfers", icon: ArrowRightLeft },
	{ name: "Deliveries", to: "/admin/deliveries", icon: Truck },
	{ name: "Settings", to: "/admin/settings", icon: Settings },
];

export function Sidebar() {
	const location = useLocation();
	const navigate = useNavigate();
	const { user, logout } = useAuth();

	const handleLogout = () => {
		logout();
		navigate({ to: "/login" });
	};

	return (
		<div className="flex h-full w-64 flex-col border-r bg-background">
			<div className="flex h-16 items-center border-b px-6">
				<h1 className="text-xl font-bold">SME Ederan WMS</h1>
			</div>

			<ScrollArea className="flex-1 px-3 py-4">
				<nav className="space-y-1">
					{navigation.map((item) => {
						const isActive = location.pathname === item.to;
						return (
							<Link
								key={item.name}
								to={item.to}
								className={cn(
									"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
									isActive
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
								)}
							>
								<item.icon className="h-5 w-5" />
								{item.name}
							</Link>
						);
					})}
				</nav>
			</ScrollArea>

			<div className="border-t p-4">
				<div className="mb-3 rounded-lg bg-muted p-3">
					<p className="text-sm font-medium">{user?.name}</p>
					<p className="text-xs text-muted-foreground">{user?.email}</p>
					<p className="mt-1 text-xs font-medium capitalize text-primary">
						{user?.role}
					</p>
				</div>
				<Button
					variant="outline"
					className="w-full justify-start gap-2 bg-transparent"
					onClick={handleLogout}
				>
					<LogOut className="h-4 w-4" />
					Logout
				</Button>
			</div>
		</div>
	);
}
