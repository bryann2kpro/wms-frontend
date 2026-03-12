import {
	createContext,
	useContext,
	useState,
	useCallback,
	type ReactNode,
} from "react";
import { hasValidTokens, clearAuthTokens } from "./auth/auth-storage";
import {
	login as apiLogin,
	type LoginRequest,
	type LoginResponse,
	type ApiResponse,
} from "./auth/auth-api";

interface AuthContextType {
	isAuthenticated: boolean;
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

	const setAuthenticated = useCallback((value: boolean) => {
		setIsAuthenticated(value);
	}, []);

	const login = useCallback(async (credentials: LoginRequest) => {
		const loginResponse = await apiLogin(credentials);

		if (!loginResponse.success) {
			throw new Error(loginResponse.message || "Login failed");
		}

		// Tokens are saved by apiLogin
		setIsAuthenticated(true);

		return loginResponse;
	}, []);

	const logout = useCallback(() => {
		// Clear tokens
		clearAuthTokens();
		// Update state
		setIsAuthenticated(false);
	}, []);

	return (
		<AuthContext.Provider
			value={{
				isAuthenticated,
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
