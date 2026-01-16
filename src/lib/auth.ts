export type WMSRole = "store_keeper" | "logistic" | "supervisor";

// Legacy role mapping for backward compatibility
export type LegacyRole = "admin" | "finance" | "warehouse" | "user";

export interface User {
	id: string;
	email: string;
	name: string;
	role: WMSRole;
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

// Mock user database
const mockUsers: User[] = [
	{
		id: "1",
		email: "admin@smee.com.my",
		name: "Eric Ng",
		role: "supervisor",
	},
	{
		id: "2",
		email: "finance@smee.com.my",
		name: "Logistic User",
		role: "logistic",
	},
	{
		id: "3",
		email: "warehouse@smee.com.my",
		name: "Store Keeper User",
		role: "store_keeper",
	},
];

export function authenticateUser(email: string, password: string): User | null {
	// Mock authentication - in production, this would call an API
	// For demo purposes, accept any password for known emails
	const user = mockUsers.find((u) => u.email === email);
	if (user && password === "demo123") {
		return user;
	}
	return null;
}

export function getUserFromStorage(): User | null {
	if (typeof window === "undefined") return null;
	const stored = localStorage.getItem("user");
	if (!stored) return null;
	try {
		return JSON.parse(stored) as User;
	} catch {
		return null;
	}
}

export function saveUserToStorage(user: User): void {
	if (typeof window === "undefined") return;
	localStorage.setItem("user", JSON.stringify(user));
}

export function removeUserFromStorage(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem("user");
}
