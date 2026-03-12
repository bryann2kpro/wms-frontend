import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { profileQueryKey, fetchProfileFn } from "@/lib/auth/use-profile";

/**
 * Permission guard for use in TanStack Router beforeLoad.
 * Fetches (or reuses cached) user profile and checks if the user has
 * read or create permission for any of the given module names.
 *
 * Pass ["*"] to allow any authenticated user through.
 *
 * Throws a redirect to /admin/forbidden if the check fails.
 */
export async function requirePermission(
	queryClient: QueryClient,
	modules: string[],
): Promise<void> {
	// localStorage is unavailable during SSR — skip permission check server-side.
	// The parent /admin route guard handles auth; this runs correctly on the client.
	if (typeof window === "undefined") return;

	if (modules.includes("*")) return;

	const profile = await queryClient.ensureQueryData({
		queryKey: profileQueryKey,
		queryFn: fetchProfileFn,
		staleTime: 5 * 60 * 1000,
	});

	const isSuperAdmin = profile.roles.some(
		(r) => r.toLowerCase() === "super admin",
	);
	if (isSuperAdmin) return;

	const hasAccess = modules.some(
		(m) =>
			profile.readPermission.includes(m) ||
			profile.createPermission?.includes(m),
	);

	if (!hasAccess) {
		throw redirect({ to: "/admin/forbidden" });
	}
}
