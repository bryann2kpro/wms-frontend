import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { profileQueryKey, fetchProfileFn } from "@/lib/auth/use-profile";

function isAdminRole(role: string): boolean {
	const lower = role.toLowerCase();
	return lower === "admin" || lower === "super admin";
}

/**
 * Route guard for Admin-only pages (Company Admin or Super Admin).
 */
export async function requireAdminRole(queryClient: QueryClient): Promise<void> {
	if (typeof window === "undefined") return;

	const profile = await queryClient.ensureQueryData({
		queryKey: profileQueryKey,
		queryFn: fetchProfileFn,
		staleTime: 5 * 60 * 1000,
	});

	const allowed = profile.roles.some(isAdminRole);
	if (!allowed) {
		throw redirect({ to: "/admin/forbidden" });
	}
}

export function hasAdminRole(roles: string[] | undefined): boolean {
	return (roles ?? []).some(isAdminRole);
}
