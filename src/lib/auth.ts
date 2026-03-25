export type WMSRole =
	| "store_keeper"
	| "logistic"
	| "supervisor"
	| "Super Admin";

// Legacy role mapping for backward compatibility
export type LegacyRole = "admin" | "finance" | "warehouse" | "user";

// User type matching the API response from /auth/profile
export interface User {
	id: string;
	email: string;
	displayName: string;
	contactNo: string;
	isActive: boolean;
	roles: string[];
	readPermission: string[];
	createPermission: string[];
	updatePermission: string[];
	approvePermission: string[];
}

// Map legacy roles to new WMS roles
export function mapLegacyRole(legacyRole: LegacyRole): WMSRole {
	const mapping: Record<LegacyRole, WMSRole> = {
		warehouse: "store_keeper",
		admin: "supervisor",
		finance: "logistic",
		user: "store_keeper", // Default fallback
	};
	return mapping[legacyRole] || "store_keeper";
}

// Helper to get primary role from roles array
export function getPrimaryRole(roles: string[]): WMSRole {
	if (!roles || roles.length === 0) return "store_keeper";

	const primaryRole = roles[0].toLowerCase();

	if (
		primaryRole.includes("supervisor") ||
		primaryRole.includes("admin") ||
		primaryRole.includes("management")
	) {
		return "supervisor";
	}
	if (primaryRole.includes("logistic") || primaryRole.includes("finance")) {
		return "logistic";
	}
	return "store_keeper";
}
