import type { ReactNode } from "react";
import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sidebar as SidebarUi,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	allNavigationItems,
	type NavLinkSchemaType,
	SIDEBAR_GROUP_ORDER,
	SIDEBAR_GROUP_LABELS,
	type SidebarGroupKey,
} from "@/constants/links";
import { cn } from "@/lib/utils";

export function Sidebar() {
	const location = useLocation();

	const { user } = useCurrentUser();
	const searchParams = useSearch({
		from: "/admin",
	});

	const isActive = (href: string) => {
		// Remove /en prefix if it exists in the pathname
		const cleanPathname = location.pathname.replace(/^\/en/, "");
		// Remove /en prefix if it exists in the href
		const cleanHref = href.replace(/^\/en/, "");

		// Build the full URL with search params for comparison
		const currentUrl =
			cleanPathname +
			(searchParams.toString() ? `?${searchParams.toString()}` : "");

		// Normalize URLs by removing trailing slashes and handling query parameters
		const normalizedCurrentUrl = currentUrl
			.replace(/\/\?/, "?")
			.replace(/\/$/, "");
		const normalizedCleanHref = cleanHref
			.replace(/\/\?/, "?")
			.replace(/\/$/, "");

		// Handle query parameters by extracting the path part
		const pathnameWithoutQuery = cleanPathname.split("?")[0];
		const hrefWithoutQuery = cleanHref.split("?")[0];

		if (href === "/admin/master-data") {
			return pathnameWithoutQuery === hrefWithoutQuery;
		}

		// For exact matches (including query parameters) - this should catch child items
		if (normalizedCurrentUrl === normalizedCleanHref) {
			// console.log('Exact match found:', { normalizedCurrentUrl, normalizedCleanHref });
			return true;
		}

		// For parent items, check if we're on a child page
		// Only consider parent active if we're on a child page with the same base path
		if (hrefWithoutQuery !== "/admin/application") {
			return (
				pathnameWithoutQuery === hrefWithoutQuery ||
				pathnameWithoutQuery.startsWith(`${hrefWithoutQuery}/`)
			);
		}

		// Special handling for application parent - only active if we're on application page
		return pathnameWithoutQuery === hrefWithoutQuery;
	};

	// Filter navigation based on permissions
	const accessControl = (link: NavLinkSchemaType) => {
		if (!user?.readPermission) return false;

		// Super admin sees everything
		const isSuperAdmin = user.roles?.some(
			(r) => r.toLowerCase() === "super admin",
		);
		if (isSuperAdmin) return true;

		return link.allowedPermission.some(
			(permission) =>
				permission === "*" ||
				user.readPermission.includes(permission) ||
				user.createPermission?.includes(permission),
		);
	};

	const visibleItems = allNavigationItems.filter(accessControl);

	// Partition by group, preserving item order within each group
	const byGroup = new Map<SidebarGroupKey | string, NavLinkSchemaType[]>();
	for (const link of visibleItems) {
		const group = link.group ?? "overview";
		if (!byGroup.has(group)) byGroup.set(group, []);
		byGroup.get(group)!.push(link);
	}

	const renderNavLink = (link: NavLinkSchemaType) => {
		const active = isActive(link.href);
		return (
			<SidebarMenuItem key={`nav-${link.key}`} title={link.title}>
				<Link
					to={link.href}
					className={cn(
						"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none border-l-4 border-transparent",
						active
							? "bg-amber-600 text-white border-amber-700 hover:bg-amber-700 hover:text-white dark:bg-amber-600 dark:text-white dark:border-amber-500 dark:hover:bg-amber-700"
							: "text-muted-foreground border-l-transparent hover:bg-muted/60 hover:text-foreground",
					)}
					style={{ fontFamily: '"Figtree", sans-serif' }}
				>
					<link.icon className="h-5 w-5 shrink-0" />
					{link.title}
				</Link>
			</SidebarMenuItem>
		);
	};

	// Render groups in defined order, each with a label (like Work Queues)
	const navSections: ReactNode[] = [];
	for (const groupKey of SIDEBAR_GROUP_ORDER) {
		const links = byGroup.get(groupKey);
		if (!links?.length) continue;
		const label = SIDEBAR_GROUP_LABELS[groupKey];
		navSections.push(
			<SidebarGroup key={groupKey} className="space-y-1">
				<SidebarGroupLabel
					className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
					style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
				>
					{label}
				</SidebarGroupLabel>
				<SidebarMenu>{links.map((l) => renderNavLink(l))}</SidebarMenu>
			</SidebarGroup>,
		);
	}
	// If any items have a group not in SIDEBAR_GROUP_ORDER, render them at the end
	for (const [groupKey, links] of byGroup) {
		if (SIDEBAR_GROUP_ORDER.includes(groupKey as SidebarGroupKey) || !links.length)
			continue;
		navSections.push(
			<SidebarGroup key={groupKey} className="space-y-1">
				<SidebarGroupLabel
					className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
					style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
				>
					{groupKey}
				</SidebarGroupLabel>
				<SidebarMenu>{links.map((l) => renderNavLink(l))}</SidebarMenu>
			</SidebarGroup>,
		);
	}

	return (
		<SidebarUi
			className="app-sidebar space-y-4 rounded-none border-r border-sidebar-border"
			collapsible="icon"
		>
			<SidebarHeader className="border-b border-sidebar-border bg-muted/30 px-4 py-4">
				<div className="relative z-20 flex items-center justify-center">
					<div className="flex flex-col">
						<img
							src="https://sme-public-bucket.s3.ap-southeast-5.amazonaws.com/sme-ederan/sme-logo.jpg"
							alt="SME Logo"
							width={100}
							height={100}
							className="rounded-lg object-contain"
						/>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<ScrollArea className="flex-1 px-3 py-4">
					<div className="flex flex-col gap-6">{navSections}</div>
				</ScrollArea>
			</SidebarContent>
		</SidebarUi>
	);
}
