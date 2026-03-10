import { LayoutDashboard, Package, ArrowRightLeft, Warehouse, FileCheck, ClipboardCheck, FileText, PackageSearch, BarChart3, Users, Settings, Shield } from "lucide-react";
import { z } from "zod";

/** Sidebar group keys – order here defines display order. */
export const SIDEBAR_GROUP_ORDER = [
	"overview",
	"inbound",
	"outbound",
	"work-queues",
	"operations",
	"documents",
	"administration",
] as const;

export type SidebarGroupKey = (typeof SIDEBAR_GROUP_ORDER)[number];

/** Display labels for each sidebar group. */
export const SIDEBAR_GROUP_LABELS: Record<SidebarGroupKey, string> = {
	overview: "Overview",
	inbound: "Inbound",
	outbound: "Outbound",
	"work-queues": "Work Queues",
	operations: "Operations",
	documents: "Documents",
	administration: "Administration",
};

const ChildNavLinkSchema = z.object({
	key: z.string(),
	title: z.string(),
	label: z.string().optional(),
	icon: z.any(),
	variant: z.enum(["default", "ghost"]),
	href: z.string(),
	allowedPermission: z.array(z.string()),
	/** Group key – items with the same group are shown under one labeled section. */
	group: z.string().optional(),
});

type NavLinkSchemaType = z.infer<typeof ChildNavLinkSchema> & {
    children?: NavLinkSchemaType[];
};

const NavLinkSchema: z.ZodType<NavLinkSchemaType[]> = z.array(
  ChildNavLinkSchema.extend({
    children: z.lazy(() => NavLinkSchema.optional()),
  })
);

export { NavLinkSchema, type NavLinkSchemaType };


/**
 * Sidebar navigation: each item has a group. Groups are rendered in SIDEBAR_GROUP_ORDER
 * with labels from SIDEBAR_GROUP_LABELS (Overview, Inbound, Outbound, Work Queues, etc.).
 */
export const allNavigationItems: NavLinkSchemaType[] = [
	{
		key: "sidebar-dashboard",
		title: "Dashboard",
		href: "/admin/dashboard",
		icon: LayoutDashboard,
		allowedPermission: ["*"],
		variant: "default",
		group: "overview",
	},
	{
		key: "sidebar-grn",
		title: "Inbound (GRN)",
		href: "/admin/grn",
		icon: Package,
		allowedPermission: ["*"],
		variant: "default",
		group: "inbound",
	},
	{
		key: "sidebar-transfers",
		title: "Outbound (PO / DO)",
		href: "/admin/outbound",
		icon: ArrowRightLeft,
		allowedPermission: ["*"],
		variant: "default",
		group: "outbound",
	},
	{
		key: "sidebar-do-work-queue",
		title: "Supplier DO Work Queue",
		href: "/admin/do-work-queue",
		icon: Warehouse,
		allowedPermission: ["*"],
		variant: "default",
		group: "work-queues",
	},
	{
		key: "sidebar-es-do",
		title: "ES DO Work Queue",
		href: "/admin/es-do",
		icon: ClipboardCheck,
		allowedPermission: ["*"],
		variant: "default",
		group: "work-queues",
	},
	{
		key: "sidebar-proof-of-delivery",
		title: "Settlement",
		href: "/admin/proof-of-delivery",
		icon: FileCheck,
		allowedPermission: ["*"],
		variant: "default",
		group: "operations",
	},
	{
		key: "sidebar-stock-count",
		title: "Stock Count",
		href: "/admin/exceptions",
		icon: PackageSearch,
		allowedPermission: ["*"],
		variant: "default",
		group: "operations",
	},
	{
		key: "sidebar-invoices",
		title: "Proforma Invoices",
		href: "/admin/invoices",
		icon: FileText,
		allowedPermission: ["*"],
		variant: "default",
		group: "documents",
	},
	{
		key: "sidebar-reports",
		title: "Reports / Exports",
		href: "/admin/reports",
		icon: BarChart3,
		allowedPermission: ["*"],
		variant: "default",
		group: "documents",
	},
	{
		key: "sidebar-user-management",
		title: "User Management",
		href: "/admin/user-management",
		icon: Users,
		allowedPermission: ["*"],
		variant: "default",
		group: "administration",
	},
	{
		key: "sidebar-rbac",
		title: "RBAC",
		href: "/admin/rbac",
		icon: Shield,
		allowedPermission: ["Role"],
		variant: "default",
		group: "administration",
	},
	{
		key: "sidebar-settings",
		title: "Admin / Settings",
		href: "/admin/settings",
		icon: Settings,
		allowedPermission: ["*"],
		variant: "default",
		group: "administration",
	},
	{
		key: "sidebar-audit-log",
		title: "Audit Log",
		href: "/admin/audit-log",
		icon: FileText,
		allowedPermission: ["Audit Log"],
		variant: "default",
		group: "administration",
	},
];