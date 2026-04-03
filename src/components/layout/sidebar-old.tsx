import {
	Link,
	useLocation,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useAuthActions } from "@/lib/auth/use-auth-actions";
import { allNavigationItems, type NavLinkSchemaType } from "@/constants/links";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut } from "lucide-react";

export function Sidebar() {
	const location = useLocation();
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { logout } = useAuthActions();
	const searchParams = useSearch({
		from: "/admin",
	});

	const handleLogout = () => {
		logout();
		navigate({ to: "/login" });
	};

	// Filter navigation based on permissions
	const accessControl = (link: NavLinkSchemaType) => {
		if (!user?.readPermission) return false;

		return link.allowedPermission.some(
			(permission) =>
				permission === "*" ||
				user.readPermission.includes(permission) ||
				user.createPermission?.includes(permission),
		);
	};

	return (
		<div className="flex h-full w-64 flex-col border-r bg-background">
			<div className="flex h-16 items-center border-b px-6">
				<h1 className="text-xl font-bold">SME Edaran WMS</h1>
			</div>

			<ScrollArea className="flex-1 px-3 py-4">
				<nav className="space-y-1">
					{allNavigationItems.map((item) => {
						const isActive = location.pathname === item.to;
						return (
							<Link
								key={item.key}
								to={item.href}
								className={cn(
									"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
									isActive
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
								)}
							>
								<item.icon className="h-5 w-5" />
								{item.title}
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
						{/* {user ? formatRoleName(getPrimaryRole(user.roles)) : ""} */}
						{user?.roles?.[0]}
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
