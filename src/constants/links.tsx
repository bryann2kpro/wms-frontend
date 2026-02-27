import { LayoutDashboard, Package, ArrowRightLeft, Warehouse, FileCheck, CheckCircle2, ClipboardCheck, FileText, PackageSearch, BarChart3, Users, Settings, Shield } from "lucide-react";
import { z } from "zod";

const ChildNavLinkSchema= z.object({
    key: z.string(),
    title: z.string(),
    label: z.string().optional(),
    icon: z.any(),
    variant: z.enum(["default", "ghost"]),
    href: z.string(),
    allowedPermission: z.array(z.string()),
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


export const allNavigationItems: NavLinkSchemaType[] = [
	{
		key: "sidebar-dashboard",
		title: "Dashboard",
		href: "/admin/dashboard",
		icon: LayoutDashboard,
        allowedPermission: ["*"],
        variant: "default",
	},
	{
		key: "sidebar-grn",
		title: "Inbound (GRN)",
		href: "/admin/grn",
		icon: Package,
		allowedPermission: ["*"],
        variant: "default",
	},
	{
		key: "sidebar-transfers",
		title: "Outbound (PO / DO)",
		href: "/admin/outbound",
		icon: ArrowRightLeft,
		allowedPermission: ["*"],
		variant: "default",
	},
	{
		key: "sidebar-do-work-queue",
		title: "Warehouse Execution",
		href: "/admin/do-work-queue",
		icon: Warehouse,
		allowedPermission: ["*"],
		variant: "default",
	},
	{
		key: "sidebar-proof-of-delivery",
		title: "Settlement",
		href: "/admin/proof-of-delivery",
		icon: FileCheck,
		allowedPermission: ["*"],
		variant: "default",
	},
	// {
	// 	key: "sidebar-settlement",
	// 	title: "Settlement",
	// 	href: "/admin/settlement",
	// 	icon: CheckCircle2,
	// 	allowedPermission: ["*"],
	// 	variant: "default",
	// },
	{
		key: "sidebar-stock-count",
		title: "Stock Count",
		href: "/admin/exceptions",
		icon: PackageSearch,
		allowedPermission: ["*"],
		variant: "default",
	},
	{
		key: "sidebar-invoices",
		title: "Proforma Invoices",
		href: "/admin/invoices",
		icon: FileText,
		allowedPermission: ["*"],
		variant: "default",
	},
	// {
	// 	key: "sidebar-inventory",
	// 	title: "Inventory",
	// 	href: "/admin/inventory",
	// 	icon: PackageSearch,
	// 	allowedPermission: ["*"],
	// 	variant: "default",
	// },
	{
		key: "sidebar-reports",
		title: "Reports / Exports",
		href: "/admin/reports",
		icon: BarChart3,
		allowedPermission: ["*"],
		variant: "default",
	},
	{
		key: "sidebar-user-management",
		title: "User Management",
		href: "/admin/user-management",
		icon: Users,
		allowedPermission: ["*"],
		variant: "default",
	},
	{
		key: "sidebar-rbac",
		title: "RBAC",
		href: "/admin/rbac",
		icon: Shield,
		allowedPermission: ["Role"],
		variant: "default",
	},
	{
		key: "sidebar-settings",
		title: "Admin / Settings",
		href: "/admin/settings",
		icon: Settings,
		allowedPermission: ["*"],
		variant: "default",
	},
	{
		key: "sidebar-audit-log",
		title: "Audit Log",
		href: "/admin/audit-log",
		icon: FileText,
		allowedPermission: ["Audit Log"],
		variant: "default",
	}
];