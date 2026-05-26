import { z } from "zod";
import type { PurchaseOrderStatus } from "@/data/purchase-orders.types";

export type DeliveryTab = "current-week" | "past-weeks";

export const purchaseOrderStatuses: PurchaseOrderStatus[] = [
	"preparing",
	"in-transit",
	"to-ship",
	"cancel",
	"return",
	"other",
];

export const locations = [
	{ value: "main", label: "Main Warehouse" },
	{ value: "dist-a", label: "Distribution Center A" },
	{ value: "dist-b", label: "Distribution Center B" },
	{ value: "warehouse-a", label: "Warehouse A" },
	{ value: "warehouse-b", label: "Warehouse B" },
	{ value: "warehouse-c", label: "Warehouse C" },
	{ value: "warehouse-d", label: "Warehouse D" },
];

const createPurchaseOrderLineItemSchema = z.object({
  skuId: z.string().min(1, "Stock is required"),
  quantity: z.coerce.number().min(1, "Amount must be at least 1"),
  stockQuantId: z.string().min(1, "Select a stock quant batch"),
});

export type CreatePurchaseOrderLineItem = z.infer<
	typeof createPurchaseOrderLineItemSchema
>;

export const createPurchaseOrderSchema = z.object({
	purchaseOrderNumber: z.string().min(1, "Purchase order number is required"),
	outletId: z.string().min(1, "Outlet is required"),
	outletName: z.string().default(""),
	notes: z.string(),
	items: z
		.array(createPurchaseOrderLineItemSchema)
		.min(1, "Add at least one line (stock and amount)"),
	isEmergency: z.boolean().optional().default(false),
});

export function getStatusColor(status: PurchaseOrderStatus): string {
	const colors: Record<PurchaseOrderStatus, string> = {
		preparing: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
		"in-transit": "bg-blue-500/10 text-blue-600 border-blue-500/20",
		"to-ship": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
		cancel: "bg-red-500/10 text-red-600 border-red-500/20",
		return: "bg-orange-500/10 text-orange-600 border-orange-500/20",
		other: "bg-gray-500/10 text-gray-600 border-gray-500/20",
	};
	return colors[status] ?? "bg-gray-500/10 text-gray-600 border-gray-500/20";
}

export function getNetSuiteStatusColor(status?: string): string {
	if (!status) return "bg-gray-500/10 text-gray-600 border-gray-500/20";
	const colors: Record<string, string> = {
		synced: "bg-green-500/10 text-green-600 border-green-500/20",
		pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
		error: "bg-red-500/10 text-red-600 border-red-500/20",
	};
	return colors[status] ?? "bg-gray-500/10 text-gray-600 border-gray-500/20";
}

export function formatStatus(status: string): string {
	if (status === "to-ship") return "To Ship";
	if (status === "in-transit") return "In Transit";
	if (status === "preparing") return "Preparing";
	if (status === "cancel") return "Cancel";
	if (status === "return") return "Return";
	if (status === "other") return "Other";
	return status;
}

/** Delivery order step status labels (NEW -> PACKING -> SHIPPED -> DELIVERED). */
export function formatDeliveryOrderStepStatus(
	status:
		| "CREATED"
		| "NEW"
		| "PICKING"
		| "PACKING"
		| "SHIPPED"
		| "DELIVERED",
): string {
	if (status === "CREATED") return "Created";
	if (status === "NEW") return "New";
	if (status === "PICKING") return "Picking";
	if (status === "PACKING") return "Packing";
	if (status === "SHIPPED") return "Shipped";
	if (status === "DELIVERED") return "Delivered";
	return status;
}

/** Tailwind classes for delivery order step badge. */
export function getDeliveryOrderStepStatusColor(
	status:
		| "CREATED"
		| "NEW"
		| "PICKING"
		| "PACKING"
		| "SHIPPED"
		| "DELIVERED",
): string {
	const colors: Record<
		"CREATED" | "NEW" | "PICKING" | "PACKING" | "SHIPPED" | "DELIVERED",
		string
	> = {
		CREATED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
		NEW: "bg-amber-500/10 text-amber-600 border-amber-500/20",
		PICKING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
		PACKING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
		SHIPPED: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
		DELIVERED: "bg-green-500/10 text-green-600 border-green-500/20",
	};
	return colors[status] ?? "bg-gray-500/10 text-gray-600 border-gray-500/20";
}

export function getPurchaseOrderStatusColor(
	status: PurchaseOrderStatus,
): string {
	const colors: Record<PurchaseOrderStatus, string> = {
		preparing:
			"!text-yellow-600 data-[highlighted]:!bg-yellow-500/10 data-[highlighted]:!text-yellow-700 focus:!bg-yellow-500/10 focus:!text-yellow-700",
		"in-transit":
			"!text-blue-600 data-[highlighted]:!bg-blue-500/10 data-[highlighted]:!text-blue-700 focus:!bg-blue-500/10 focus:!text-blue-700",
		"to-ship":
			"!text-indigo-600 data-[highlighted]:!bg-indigo-500/10 data-[highlighted]:!text-indigo-700 focus:!bg-indigo-500/10 focus:!text-indigo-700",
		cancel:
			"!text-red-600 data-[highlighted]:!bg-red-500/10 data-[highlighted]:!text-red-700 focus:!bg-red-500/10 focus:!text-red-700",
		return:
			"!text-orange-600 data-[highlighted]:!bg-orange-500/10 data-[highlighted]:!text-orange-700 focus:!bg-orange-500/10 focus:!text-orange-700",
		other:
			"!text-gray-600 data-[highlighted]:!bg-gray-500/10 data-[highlighted]:!text-gray-700 focus:!bg-gray-500/10 focus:!text-gray-700",
	};
	return colors[status] ?? "text-gray-600";
}

/** Number of delivery date groups to show per page in the list. */
export const DATE_GROUPS_PER_PAGE = 5;
