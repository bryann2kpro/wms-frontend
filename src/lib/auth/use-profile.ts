import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPublicClient } from "@/lib/axios-v1";
import { getAccessToken, hasValidTokens } from "./auth-storage";
import type { User } from "@/lib/auth";

// API Response type
interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
}

// Query key for profile
export const profileQueryKey = ["auth", "profile"] as const;

/**
 * Fetch user profile from API
 * Exported so it can be used in router beforeLoad via queryClient.ensureQueryData
 */
export async function fetchProfileFn(): Promise<User> {
	const accessToken = getAccessToken();
	if (!accessToken) {
		throw new Error("No access token available");
	}

	const client = getPublicClient();
	const response = await client.get<ApiResponse<User>>("/auth/profile", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.data.success || !response.data.data) {
		throw new Error(response.data.message || "Failed to fetch profile");
	}

	return response.data.data;
}

/**
 * Hook to get the current user's profile
 * Uses TanStack Query with persistence - profile is cached and restored from localStorage
 */
export function useProfile() {
	return useQuery({
		queryKey: profileQueryKey,
		queryFn: fetchProfileFn,
		// Only fetch if we have valid tokens
		enabled: hasValidTokens(),
		// Keep stale data while refetching
		staleTime: 5 * 60 * 1000, // 5 minutes
		// Retry once on failure
		retry: 1,
		// Don't refetch on window focus for auth data
		refetchOnWindowFocus: false,
	});
}

/**
 * Hook to invalidate and refetch profile
 */
export function useInvalidateProfile() {
	const queryClient = useQueryClient();

	return () => {
		return queryClient.invalidateQueries({ queryKey: profileQueryKey });
	};
}

/**
 * Hook to clear profile from cache (used on logout)
 */
export function useClearProfile() {
	const queryClient = useQueryClient();

	return () => {
		queryClient.removeQueries({ queryKey: profileQueryKey });
	};
}
