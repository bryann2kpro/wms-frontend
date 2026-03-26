// Auth API functions using getPublicClient
import { getPublicClient } from "@/lib/axios-v1";
import { saveAuthTokens, clearAuthTokens } from "./auth-storage";

// API Response types
export interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
}

// Login types
export interface LoginRequest {
	username: string;
	password: string;
}

export interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	expiredAt: number;
}

// Profile types
export interface ProfileResponse {
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

/**
 * Login with username and password
 * POST /auth/login
 */
export async function login(
	credentials: LoginRequest,
): Promise<ApiResponse<LoginResponse>> {
	const client = getPublicClient();
	const response = await client.post<ApiResponse<LoginResponse>>(
		"/auth/login",
		credentials,
	);

	// Save tokens on successful login
	if (response.data.success && response.data.data) {
		const { accessToken, refreshToken, expiredAt } = response.data.data;
		saveAuthTokens(accessToken, refreshToken, expiredAt);
	}

	return response.data;
}

/**
 * Fetch current user profile
 * GET /auth/profile
 * Note: This requires authentication, so use getClient instead of getPublicClient
 */
export async function fetchProfile(
	accessToken: string,
): Promise<ApiResponse<ProfileResponse>> {
	const client = getPublicClient();
	const response = await client.get<ApiResponse<ProfileResponse>>(
		"/auth/profile",
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);

	return response.data;
}

/**
 * Logout - clear all auth tokens
 */
export function logout(): void {
	clearAuthTokens();
}

/**
 * Request a password reset email
 * POST /auth/forgot-password
 */
export async function requestPasswordReset(
	email: string,
): Promise<ApiResponse<null>> {
	const client = getPublicClient();
	const response = await client.post<ApiResponse<null>>(
		"/auth/forgot-password",
		{ email },
	);
	return response.data;
}

/**
 * Reset password using a token from the reset email
 * POST /auth/reset-password
 */
export async function resetPassword(
	token: string,
	password: string,
): Promise<ApiResponse<null>> {
	const client = getPublicClient();
	const response = await client.post<ApiResponse<null>>(
		"/auth/reset-password",
		{
			token,
			password,
		},
	);
	return response.data;
}
