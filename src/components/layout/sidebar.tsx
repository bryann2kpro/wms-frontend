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
import { Sidebar as SidebarUi, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenuItem } from "@/components/ui/sidebar";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { allNavigationItems, NavLinkSchemaType } from "@/constants/links";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { Button } from "../ui/button";

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
		<SidebarUi className="space-y-4 rounded-lg" collapsible="icon">
            <SidebarHeader>
                <div className="relative z-20 flex items-center justify-center text-base font-medium">
                    <Avatar className="w-8 h-8 mr-2">
                        <AvatarImage src="/mdeal.svg" alt="Mdeal Logo" width={32} height={32} />
                    </Avatar>
                    {/* {!state || state === "expanded" ? ( */}
                        <div className="flex flex-col">
                            {/* <h2 className="text-xl font-bold">SME Ederan WMS</h2> */}
                            <img src="/smg-logo.jpg" alt="SMG Logo" width={100} height={100} />
                        </div>
                    {/* ) : null} */}
                </div>
            </SidebarHeader>
            <SidebarContent>
                <ScrollArea className="flex-1 px-3 py-4">
                    <SidebarGroup className="space-y-1">
                        {allNavigationItems.map(
                            (link) =>
                                accessControl(link) && (
                                    <SidebarMenuItem 
                                            key={`nav-${link.key}`} 
                                            title={link.title} 
                                        >
                                            {(
                                                <Link
                                                    key={link.key}
                                                    to={link.href}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                                        isActive(link.href)
                                                            ? "bg-primary text-primary-foreground"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                                    )}
                                                >
                                                    <link.icon className="h-5 w-5" />
                                                    {link.title}
                                                </Link>
                                            )}
                                    </SidebarMenuItem>
                                )
                        )}
                    </SidebarGroup>
                </ScrollArea>
            </SidebarContent>
            <SidebarFooter>
                <div>
                    <div className="mb-3 rounded-lg bg-muted p-3">
                        <p className="text-sm font-medium">{user?.displayName}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                        <p className="mt-1 text-xs font-medium text-primary">
                            {/* {user ? formatRoleName(getPrimaryRole(user.roles)) : ""} */}
                            {/* {user?.roles[0].roleName} */}
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
            </SidebarFooter>
        </SidebarUi>
	);
}
