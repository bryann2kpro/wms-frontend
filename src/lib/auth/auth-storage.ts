// Auth token storage utilities
// Stores tokens in localStorage with type-safe getters/setters

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const TOKEN_EXPIRY_KEY = "token_expiry";

// Access Token
export function getAccessToken(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAccessToken(token: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function removeAccessToken(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// Refresh Token
export function getRefreshToken(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveRefreshToken(token: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeRefreshToken(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Token Expiry (stored as timestamp in milliseconds)
export function getTokenExpiry(): number | null {
	if (typeof window === "undefined") return null;
	const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
	return expiry ? parseInt(expiry, 10) : null;
}

export function saveTokenExpiry(expiry: number): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
}

export function removeTokenExpiry(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// Check if token is expired
export function isTokenExpired(): boolean {
	const expiry = getTokenExpiry();
	if (!expiry) return true;
	return Date.now() >= expiry;
}

// Clear all auth tokens
export function clearAuthTokens(): void {
	removeAccessToken();
	removeRefreshToken();
	removeTokenExpiry();
}

// Save all auth tokens at once
export function saveAuthTokens(
	accessToken: string,
	refreshToken: string,
	expiredAt: number,
): void {
	saveAccessToken(accessToken);
	saveRefreshToken(refreshToken);
	saveTokenExpiry(expiredAt);
}

// Check if user has valid tokens
export function hasValidTokens(): boolean {
	const accessToken = getAccessToken();
	const refreshToken = getRefreshToken();
	return !!accessToken && !!refreshToken && !isTokenExpired();
}
