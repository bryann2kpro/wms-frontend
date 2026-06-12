import type { ReactNode } from "react";
import {
	ClientOnly,
	Link,
	useLocation,
	useSearch,
} from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	Sidebar as SidebarUi,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
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

		if (link.allowedRoles?.length) {
			const roleMatch = link.allowedRoles.some((role) =>
				user.roles?.some((r) => r.toLowerCase() === role.toLowerCase()),
			);
			if (!roleMatch) return false;
		}

		if (!link.allowedPermission.length) {
			return Boolean(link.allowedRoles?.length);
		}

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
			<SidebarMenuItem key={`nav-${link.key}`}>
				<SidebarMenuButton
					asChild
					isActive={active}
					tooltip={link.title}
					className={cn(
						"border-l-4 border-transparent group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
						active &&
							"bg-amber-600 text-white border-amber-700 hover:bg-amber-700 hover:text-white dark:bg-amber-600 dark:border-amber-500 dark:hover:bg-amber-700",
					)}
				>
					<Link
						to={link.href}
						style={{ fontFamily: '"Figtree", sans-serif' }}
					>
						<link.icon className="shrink-0" />
						<span className="group-data-[collapsible=icon]:hidden">
							{link.title}
						</span>
					</Link>
				</SidebarMenuButton>
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
			<SidebarGroup
				key={groupKey}
				className="space-y-1 group-data-[collapsible=icon]:p-0"
			>
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
		if (
			SIDEBAR_GROUP_ORDER.includes(groupKey as SidebarGroupKey) ||
			!links.length
		)
			continue;
		navSections.push(
			<SidebarGroup
				key={groupKey}
				className="space-y-1 group-data-[collapsible=icon]:p-0"
			>
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
		<ClientOnly>
			<SidebarUi
				className="app-sidebar space-y-4 rounded-none border-r border-sidebar-border"
				collapsible="icon"
			>
				<SidebarHeader className="border-b border-sidebar-border bg-muted/30 px-3 py-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
					<div className="relative z-20 flex items-center justify-center">
						<div className="flex flex-col">
							<img
								src="https://sme-public-bucket.s3.ap-southeast-5.amazonaws.com/sme-ederan/sme-logo.jpg"
								alt="SME Logo"
								width={56}
								height={56}
								className="rounded-lg object-contain group-data-[collapsible=icon]:hidden"
							/>
						</div>
					</div>
				</SidebarHeader>
				<SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:overflow-y-auto group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
					<div className="flex flex-col gap-6 group-data-[collapsible=icon]:gap-2">
						{navSections}
					</div>
				</SidebarContent>
				<SidebarRail />
			</SidebarUi>
		</ClientOnly>
	);
}
