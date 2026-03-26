import {
	createContext,
	useContext,
	useState,
	useCallback,
	type ReactNode,
} from "react";
import {
	hasValidTokens,
	clearAuthTokens,
	getAccessToken,
} from "./auth/auth-storage";
import {
	login as apiLogin,
	type LoginRequest,
	type LoginResponse,
	type ApiResponse,
} from "./auth/auth-api";

// Helper function to decode JWT and extract payload
function decodeJWT(token: string): any {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const decoded = JSON.parse(atob(parts[1]));
		return decoded;
	} catch {
		return null;
	}
}

// Helper function to get organizationId from token
function getOrganizationIdFromToken(): string | null {
	const token = getAccessToken();
	if (!token) return null;
	const payload = decodeJWT(token);
	return payload?.organizationId || null;
}

interface AuthContextType {
	isAuthenticated: boolean;
	organizationId: string | null;
	setAuthenticated: (value: boolean) => void;
	login: (credentials: LoginRequest) => Promise<ApiResponse<LoginResponse>>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	// Lazy initializer: reads localStorage synchronously on the client so the
	// initial state is already correct, avoiding a one-frame "unauthenticated"
	// flash on hydration. Returns false on the server (no localStorage there).
	const [isAuthenticated, setIsAuthenticated] = useState(() =>
		typeof window !== "undefined" ? hasValidTokens() : false,
	);

	const [organizationId, setOrganizationId] = useState<string | null>(() =>
		typeof window !== "undefined" ? getOrganizationIdFromToken() : null,
	);

	const setAuthenticated = useCallback((value: boolean) => {
		setIsAuthenticated(value);
		if (!value) {
			setOrganizationId(null);
		} else {
			// Re-read organizationId from token
			setOrganizationId(getOrganizationIdFromToken());
		}
	}, []);

	const login = useCallback(async (credentials: LoginRequest) => {
		const loginResponse = await apiLogin(credentials);

		if (!loginResponse.success) {
			throw new Error(loginResponse.message || "Login failed");
		}

		// Tokens are saved by apiLogin
		setIsAuthenticated(true);
		setOrganizationId(getOrganizationIdFromToken());

		return loginResponse;
	}, []);

	const logout = useCallback(() => {
		// Clear tokens
		clearAuthTokens();
		// Update state
		setIsAuthenticated(false);
		setOrganizationId(null);
	}, []);

	return (
		<AuthContext.Provider
			value={{
				isAuthenticated,
				organizationId,
				setAuthenticated,
				login,
				logout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
