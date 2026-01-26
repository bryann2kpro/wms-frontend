import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useAuthActions } from "@/lib/auth/use-auth-actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Sidebar as SidebarOld } from "./sidebar-old";
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
	const searchParams = useSearch({
		from: "/admin"
	});

	const handleLogout = () => {
		logout();
		navigate({ to: "/login" });
	};

	const isActive = (href: string) => {
        // Remove /en prefix if it exists in the pathname
        const cleanPathname = location.pathname.replace(/^\/en/, '');
        // Remove /en prefix if it exists in the href
        const cleanHref = href.replace(/^\/en/, '');
        
        // Build the full URL with search params for comparison
        const currentUrl = cleanPathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
        
        // Normalize URLs by removing trailing slashes and handling query parameters
        const normalizedCurrentUrl = currentUrl.replace(/\/\?/, '?').replace(/\/$/, '');
        const normalizedCleanHref = cleanHref.replace(/\/\?/, '?').replace(/\/$/, '');
        
        // Handle query parameters by extracting the path part
        const pathnameWithoutQuery = cleanPathname.split('?')[0];
        const hrefWithoutQuery = cleanHref.split('?')[0];

        if (href === '/admin/master-data') {
            return pathnameWithoutQuery === hrefWithoutQuery;
        }
        
        // For exact matches (including query parameters) - this should catch child items
        if (normalizedCurrentUrl === normalizedCleanHref) {
            // console.log('Exact match found:', { normalizedCurrentUrl, normalizedCleanHref });
            return true;
        }
        
        // For parent items, check if we're on a child page
        // Only consider parent active if we're on a child page with the same base path
        if (hrefWithoutQuery !== '/admin/application') {
            return pathnameWithoutQuery === hrefWithoutQuery || pathnameWithoutQuery.startsWith(`${hrefWithoutQuery}/`);
        }
        
        // Special handling for application parent - only active if we're on application page
        return pathnameWithoutQuery === hrefWithoutQuery;
    };

	// Filter navigation based on permissions
	const accessControl = (link: NavLinkSchemaType) => {
		if (!user?.readPermission) return false;
		
		return link.allowedPermission.some(permission => 
			permission === '*' || user.readPermission.includes(permission) || user.createPermission?.includes(permission)
		);
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
                            <h2 className="text-xl font-bold">SME Ederan WMS</h2>
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
