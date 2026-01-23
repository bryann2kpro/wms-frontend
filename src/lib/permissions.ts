import type { WMSRole } from "./auth";

export type Permission =
	// DO (Delivery Order) permissions
	| "do:view"
	| "do:view_assigned"
	| "do:print"
	| "do:mark_picking"
	| "do:mark_packed"
	| "do:mark_ready"
	| "do:mark_collected"
	| "do:mark_delivered_pending"
	| "do:report_exception"
	// GRN permissions
	| "grn:view"
	| "grn:create"
	| "grn:edit"
	| "grn:approve"
	| "grn:send_to_es"
	// TO (Transfer Order) permissions
	| "to:view"
	| "to:refresh"
	| "to:accept"
	| "to:reject"
	// Delivery Proof permissions
	| "delivery_proof:view"
	| "delivery_proof:upload"
	// Settlement permissions
	| "settlement:view"
	| "settlement:settle"
	// Exception permissions
	| "exception:view"
	| "exception:report"
	| "exception:approve"
	| "exception:reject"
	// Invoice permissions
	| "invoice:view"
	| "invoice:create"
	| "invoice:export"
	| "invoice:mark_sent"
	// Inventory permissions
	| "inventory:view"
	// Reports permissions
	| "reports:view"
	| "reports:export"
	// Admin permissions
	| "admin:users"
	| "admin:master_data"
	| "admin:delivery_rules"
	| "admin:integration_status"
	| "admin:netsuite_sync";

const rolePermissions: Record<WMSRole, Permission[]> = {
	store_keeper: [
		"do:view",
		"do:view_assigned",
		"do:print",
		"do:mark_picking",
		"do:mark_packed",
		"do:mark_ready",
		"do:report_exception",
		"grn:view",
		"exception:report",
		"inventory:view",
	],
	logistic: [
		"do:view",
		"do:view_assigned",
		"do:mark_collected",
		"do:mark_delivered_pending",
		"to:view",
		"delivery_proof:view",
		"inventory:view",
	],
	supervisor: [
		// All permissions
		"do:view",
		"do:view_assigned",
		"do:print",
		"do:mark_picking",
		"do:mark_packed",
		"do:mark_ready",
		"do:mark_collected",
		"do:mark_delivered_pending",
		"do:report_exception",
		"grn:view",
		"grn:create",
		"grn:edit",
		"grn:approve",
		"grn:send_to_es",
		"to:view",
		"to:refresh",
		"to:accept",
		"to:reject",
		"delivery_proof:view",
		"delivery_proof:upload",
		"settlement:view",
		"settlement:settle",
		"exception:view",
		"exception:report",
		"exception:approve",
		"exception:reject",
		"invoice:view",
		"invoice:create",
		"invoice:export",
		"invoice:mark_sent",
		"inventory:view",
		"reports:view",
		"reports:export",
		"admin:users",
		"admin:master_data",
		"admin:delivery_rules",
		"admin:integration_status",
		"admin:netsuite_sync",
	],
};

export function hasPermission(role: WMSRole, permission: Permission): boolean {
	const permissions = rolePermissions[role] || [];
	return permissions.includes(permission);
}

export function getPermissions(role: WMSRole): Permission[] {
	return rolePermissions[role] || [];
}

// React hook for permissions
import { useMemo } from "react";
import type { User } from "./auth";
import { getPrimaryRole } from "./auth";

export function usePermissions(user: User | null) {
	return useMemo(() => {
		if (!user) return { hasPermission: () => false, permissions: [] };
		// Get primary role from roles array
		const primaryRole = getPrimaryRole(user.roles);
		const permissions = getPermissions(primaryRole);
		return {
			hasPermission: (permission: Permission) =>
				hasPermission(primaryRole, permission),
			permissions,
		};
	}, [user]);
}
