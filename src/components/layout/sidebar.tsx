import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useAuthActions } from "@/lib/auth/use-auth-actions";
import { usePermissions } from "@/lib/permissions";
import { getPrimaryRole } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import {
	LayoutDashboard,
	Package,
	ArrowRightLeft,
	Settings,
	LogOut,
	Warehouse,
	ClipboardCheck,
	FileCheck,
	CheckCircle2,
	FileText,
	BarChart3,
	PackageSearch,
	Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavigationItem {
	name: string;
	to: string;
	icon: React.ComponentType<{ className?: string }>;
	permission?: Permission;
}

const allNavigationItems: NavigationItem[] = [
	{
		name: "Dashboard",
		to: "/admin/dashboard",
		icon: LayoutDashboard,
	},
	{
		name: "Inbound (GRN)",
		to: "/admin/grn",
		icon: Package,
		permission: "grn:view",
	},
	{
		name: "Outbound (TO / DO)",
		to: "/admin/transfers",
		icon: ArrowRightLeft,
		permission: "to:view",
	},
	{
		name: "Warehouse Execution",
		to: "/admin/do-work-queue",
		icon: Warehouse,
		permission: "do:view",
	},
	{
		name: "Delivery Proof",
		to: "/admin/delivery-proof",
		icon: FileCheck,
		permission: "delivery_proof:view",
	},
	{
		name: "Settlement",
		to: "/admin/settlement",
		icon: CheckCircle2,
		permission: "settlement:view",
	},
	{
		name: "Exceptions",
		to: "/admin/exceptions",
		icon: ClipboardCheck,
		permission: "exception:view",
	},
	{
		name: "Invoices",
		to: "/admin/invoices",
		icon: FileText,
		permission: "invoice:view",
	},
	{
		name: "Inventory",
		to: "/admin/inventory",
		icon: PackageSearch,
		permission: "inventory:view",
	},
	{
		name: "Reports / Exports",
		to: "/admin/reports",
		icon: BarChart3,
		permission: "reports:view",
	},
	{
		name: "User Management",
		to: "/admin/user-management",
		icon: Users,
		permission: "admin:users",
	},
	{
		name: "Admin / Settings",
		to: "/admin/settings",
		icon: Settings,
		permission: "admin:users",
	},
];

export function Sidebar() {
	const location = useLocation();
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { logout } = useAuthActions();
	const { hasPermission } = usePermissions(user);

	console.log("user", user);

	const handleLogout = () => {
		logout();
		navigate({ to: "/login" });
	};

	// Filter navigation based on permissions
	const navigation = allNavigationItems.filter((item) => {
		if (!item.permission) return true; // Dashboard is always visible
		return hasPermission(item.permission);
	});

	const formatRoleName = (role: string) => {
		return role
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
					<p className="text-sm font-medium">{user?.displayName}</p>
					<p className="text-xs text-muted-foreground">{user?.email}</p>
					<p className="mt-1 text-xs font-medium text-primary">
						{user ? formatRoleName(getPrimaryRole(user.roles)) : ""}
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
