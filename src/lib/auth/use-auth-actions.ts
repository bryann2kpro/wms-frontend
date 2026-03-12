import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { profileQueryKey } from "./use-profile";
import type { LoginRequest } from "./auth-api";

/**
 * Hook for auth actions that interact with the query cache
 * Use this in components that are inside QueryClientProvider
 */
export function useAuthActions() {
	const { login: authLogin, logout: authLogout, isAuthenticated } = useAuth();
	const queryClient = useQueryClient();

	/**
	 * Login and invalidate profile query to trigger fresh fetch
	 */
	const login = useCallback(
		async (credentials: LoginRequest) => {
			const response = await authLogin(credentials);

			// Invalidate profile query to trigger fresh fetch
			// The profile will be fetched and cached by TanStack Query
			await queryClient.invalidateQueries({ queryKey: profileQueryKey });

			return response;
		},
		[authLogin, queryClient],
	);

	/**
	 * Logout and clear profile from cache
	 */
	const logout = useCallback(() => {
		// Remove profile from query cache
		queryClient.removeQueries({ queryKey: profileQueryKey });
		// Clear tokens and auth state
		authLogout();
	}, [authLogout, queryClient]);

	return {
		login,
		logout,
		isAuthenticated,
	};
}
