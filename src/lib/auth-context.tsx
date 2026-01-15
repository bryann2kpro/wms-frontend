import {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import type { User } from "./auth";
import {
	getUserFromStorage,
	saveUserToStorage,
	removeUserFromStorage,
} from "./auth";

interface AuthContextType {
	user: User | null;
	login: (user: User) => void;
	logout: () => void;
	isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);

	useEffect(() => {
		// Load user from storage on mount
		const storedUser = getUserFromStorage();
		if (storedUser) {
			setUser(storedUser);
		}
	}, []);

	const login = (userData: User) => {
		setUser(userData);
		saveUserToStorage(userData);
	};

	const logout = () => {
		setUser(null);
		removeUserFromStorage();
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				login,
				logout,
				isAuthenticated: !!user,
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
