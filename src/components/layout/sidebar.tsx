import { useEffect, useState, type ReactNode } from "react";
import {
	ClientOnly,
	Link,
	useLocation,
	useSearch,
} from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Collapsible } from "radix-ui";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	Sidebar as SidebarUi,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
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

function getNavHref(link: Pick<NavLinkSchemaType, "href" | "search">): string {
	if (!link.search || Object.keys(link.search).length === 0) {
		return link.href;
	}
	const params = new URLSearchParams(link.search).toString();
	return params ? `${link.href}?${params}` : link.href;
}

function navLinkActiveClass(active: boolean) {
	return cn(
		active &&
			"bg-amber-600 text-white border-amber-700 hover:bg-amber-700 hover:text-white dark:bg-amber-600 dark:border-amber-500 dark:hover:bg-amber-700",
	);
}

type NavActiveFn = (href: string, search?: Record<string, string>) => boolean;

function CollapsibleNavMenuItem({
	link,
	visibleChildren,
	isActive,
}: {
	link: NavLinkSchemaType;
	visibleChildren: NavLinkSchemaType[];
	isActive: NavActiveFn;
}) {
	const childActive = visibleChildren.some((child) =>
		isActive(child.href, child.search),
	);
	const parentSectionActive = isActive(link.href, link.search);
	const parentButtonActive = parentSectionActive && !childActive;
	const [open, setOpen] = useState(childActive);

	useEffect(() => {
		if (childActive) setOpen(true);
	}, [childActive]);

	return (
		<Collapsible.Root
			open={open}
			onOpenChange={setOpen}
			className="group/collapsible"
		>
			<SidebarMenuItem>
				<SidebarMenuButton
					asChild
					isActive={parentButtonActive}
					tooltip={link.title}
					className={cn(
						"border-l-4 border-transparent group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
						navLinkActiveClass(parentButtonActive),
					)}
				>
					<Link
						to={link.href}
						search={link.search}
						style={{ fontFamily: '"Figtree", sans-serif' }}
					>
						<link.icon className="shrink-0" />
						<span className="group-data-[collapsible=icon]:hidden">
							{link.title}
						</span>
					</Link>
				</SidebarMenuButton>
				<Collapsible.Trigger asChild>
					<SidebarMenuAction
						className="transition-transform data-[state=open]:rotate-90"
						aria-label={`Toggle ${link.title} submenu`}
					>
						<ChevronRight />
					</SidebarMenuAction>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<SidebarMenuSub>
						{visibleChildren.map((child) => {
							const childIsActive = isActive(child.href, child.search);
							return (
								<SidebarMenuSubItem key={`nav-${child.key}`}>
									<SidebarMenuSubButton
										asChild
										isActive={childIsActive}
										className={navLinkActiveClass(childIsActive)}
									>
										<Link
											to={child.href}
											search={child.search}
											style={{ fontFamily: '"Figtree", sans-serif' }}
										>
											<span>{child.title}</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							);
						})}
					</SidebarMenuSub>
				</Collapsible.Content>
			</SidebarMenuItem>
		</Collapsible.Root>
	);
}

export function Sidebar() {
	const location = useLocation();

	const { user } = useCurrentUser();
	const searchParams = useSearch({
		from: "/admin",
	});

	const isActive = (href: string, search?: Record<string, string>) => {
		const fullHref = getNavHref({ href, search });
		// Remove /en prefix if it exists in the pathname
		const cleanPathname = location.pathname.replace(/^\/en/, "");
		// Remove /en prefix if it exists in the href
		const cleanHref = fullHref.replace(/^\/en/, "");

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

		if (search && Object.keys(search).length > 0) {
			return normalizedCurrentUrl === normalizedCleanHref;
		}

		if (href === "/admin/master-data") {
			return pathnameWithoutQuery === hrefWithoutQuery;
		}

		// For exact matches (including query parameters) - this should catch child items
		if (normalizedCurrentUrl === normalizedCleanHref) {
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

	const visibleItems = allNavigationItems
		.filter(accessControl)
		.map((link) => ({
			...link,
			children: link.children?.filter(accessControl),
		}));

	// Partition by group, preserving item order within each group
	const byGroup = new Map<SidebarGroupKey | string, NavLinkSchemaType[]>();
	for (const link of visibleItems) {
		const group = link.group ?? "overview";
		if (!byGroup.has(group)) byGroup.set(group, []);
		byGroup.get(group)!.push(link);
	}

	const renderNavLink = (link: NavLinkSchemaType) => {
		const visibleChildren = link.children ?? [];
		if (visibleChildren.length > 0) {
			return (
				<CollapsibleNavMenuItem
					key={`nav-${link.key}`}
					link={link}
					visibleChildren={visibleChildren}
					isActive={isActive}
				/>
			);
		}

		const active = isActive(link.href, link.search);

		return (
			<SidebarMenuItem key={`nav-${link.key}`}>
				<SidebarMenuButton
					asChild
					isActive={active}
					tooltip={link.title}
					className={cn(
						"border-l-4 border-transparent group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
						navLinkActiveClass(active),
					)}
				>
					<Link
						to={link.href}
						search={link.search}
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
								src="/sme-logo.jpg"
								alt="SME Edaran Sdn. Bhd."
								width={131}
								height={88}
								className="h-10 w-auto object-contain group-data-[collapsible=icon]:hidden"
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
