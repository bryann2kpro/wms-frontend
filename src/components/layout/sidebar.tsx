import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar as SidebarUi, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { allNavigationItems, NavLinkSchemaType } from "@/constants/links";
import { cn } from "@/lib/utils";

export function Sidebar() {
	const location = useLocation();
	
	const { user } = useCurrentUser();
	const searchParams = useSearch({
		from: "/admin"
	});

	

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

		return link.allowedPermission.some(
			(permission) =>
				permission === "*" ||
				user.readPermission.includes(permission) ||
				user.createPermission?.includes(permission),
		);
	};

	const visibleItems = allNavigationItems.filter(accessControl);
	const mainItems = visibleItems.filter((link) => link.group !== "work-queues");
	const workQueueItems = visibleItems.filter(
		(link) => link.group === "work-queues",
	);

	const renderNavLinks = (links: NavLinkSchemaType[]) =>
		links.map((link) => (
			<SidebarMenuItem key={`nav-${link.key}`} title={link.title}>
				<Link
					to={link.href}
					className={cn(
						"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
						isActive(link.href)
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
					)}
				>
					<link.icon className="h-5 w-5" />
					{link.title}
				</Link>
			</SidebarMenuItem>
		));

	return (
		<SidebarUi className="space-y-4 rounded-lg" collapsible="icon">
			<SidebarHeader>
				<div className="relative z-20 flex items-center justify-center text-base font-medium">
					<div className="flex flex-col">
						<img
							src="https://sme-public-bucket.s3.ap-southeast-5.amazonaws.com/sme-ederan/sme-logo.jpg"
							alt="SME Logo"
							width={100}
							height={100}
						/>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<ScrollArea className="flex-1 px-3 py-4">
					<SidebarGroup className="space-y-1">
						<SidebarMenu>{renderNavLinks(mainItems)}</SidebarMenu>
					</SidebarGroup>
					{workQueueItems.length > 0 && (
						<SidebarGroup className="space-y-1">
							<SidebarGroupLabel>Work Queues</SidebarGroupLabel>
							<SidebarMenu>{renderNavLinks(workQueueItems)}</SidebarMenu>
						</SidebarGroup>
					)}
				</ScrollArea>
			</SidebarContent>
		</SidebarUi>
	);
}
