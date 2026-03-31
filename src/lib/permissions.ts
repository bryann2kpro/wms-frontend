import { useMemo } from "react";
import type { User } from "./auth";

export interface UsePermissionsResult {
	/** True if `module` is in `readPermission` (or Super Admin). */
	read: (module: string) => boolean;
	/** True if `module` is in `createPermission` (or Super Admin). */
	create: (module: string) => boolean;
	/** True if `module` is in `updatePermission` (or Super Admin). */
	update: (module: string) => boolean;
	/** True if `module` is in `approvePermission` (or Super Admin). */
	approve: (module: string) => boolean;
	isSuperAdmin: boolean;
}

function matchesModule(module: string, list: string[]): boolean {
	const m = module.toLowerCase();
	return list.some((p) => p.toLowerCase() === m);
}

/**
 * Maps JWT profile module lists (`readPermission`, `createPermission`, etc.)
 * to simple checks by backend module name (e.g. `"GRN"`, `"Delivery Order"`).
 */
export function usePermissions(user: User | null): UsePermissionsResult {
	return useMemo(() => {
		if (!user) {
			const deny = () => false;
			return {
				read: deny,
				create: deny,
				update: deny,
				approve: deny,
				isSuperAdmin: false,
			};
		}

		const isSuperAdmin = user.roles.some(
			(r) => r.toLowerCase() === "super admin",
		);

		const can = (module: string, list: string[]) =>
			isSuperAdmin || matchesModule(module, list);

		return {
			read: (module: string) => can(module, user.readPermission ?? []),
			create: (module: string) => can(module, user.createPermission ?? []),
			update: (module: string) => can(module, user.updatePermission ?? []),
			approve: (module: string) => can(module, user.approvePermission ?? []),
			isSuperAdmin,
		};
	}, [user]);
}
