import { useAuth } from "@/lib/auth-context";
import { useProfile } from "./use-profile";
import type { User } from "@/lib/auth";

interface CurrentUserResult {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	isError: boolean;
	error: Error | null;
}

/**
 * Hook to get the current user profile
 * Combines auth state with profile query
 */
export function useCurrentUser(): CurrentUserResult {
	const { isAuthenticated } = useAuth();
	const { data: user, isLoading, isError, error } = useProfile();

	return {
		user: user ?? null,
		isLoading,
		isAuthenticated,
		isError,
		error: error as Error | null,
	};
}
