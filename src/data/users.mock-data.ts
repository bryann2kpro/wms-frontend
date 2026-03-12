import type { User, WMSRole } from "@/lib/auth";
import { getPrimaryRole } from "@/lib/auth";

export type UserRoleFilter = WMSRole | "ALL";

export interface UserListFilters {
	page: number;
	pageSize: number;
	search?: string;
	role?: UserRoleFilter;
}

export interface UserSummary {
	byRole: Record<WMSRole, number>;
	total: number;
}

export interface UserListResult {
	items: User[];
	summary: UserSummary;
	page: number;
	pageSize: number;
	total: number;
}

export interface CreateUserInput {
	email: string;
	name: string;
	role: WMSRole;
	passwordOption: "email" | "manual";
	password?: string; // Required if passwordOption is "manual"
}

export interface UpdateUserRoleInput {
	userId: string;
	role: WMSRole;
}

export interface UpdateUserInput {
	userId: string;
	role: WMSRole;
	passwordOption?: "email" | "manual" | null; // null means don't update password
	password?: string; // Required if passwordOption is "manual"
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock users database - matching the API response structure
const users: User[] = [
	{
		id: "1",
		email: "admin@smee.com.my",
		displayName: "Eric Ng",
		contactNo: "+60123456789",
		isActive: true,
		roles: ["supervisor"],
		permissions: [],
	},
	{
		id: "2",
		email: "finance@smee.com.my",
		displayName: "Logistic User",
		contactNo: "+60123456790",
		isActive: true,
		roles: ["logistic"],
		permissions: [],
	},
	{
		id: "3",
		email: "warehouse@smee.com.my",
		displayName: "Store Keeper User",
		contactNo: "+60123456791",
		isActive: true,
		roles: ["store_keeper"],
		permissions: [],
	},
];

function buildSummary(source: User[]): UserSummary {
	const initial: Record<WMSRole, number> = {
		store_keeper: 0,
		logistic: 0,
		supervisor: 0,
	};

	const byRole = source.reduce((acc, user) => {
		// Use getPrimaryRole to get the main role from roles array
		const primaryRole = getPrimaryRole(user.roles);
		acc[primaryRole] = (acc[primaryRole] ?? 0) + 1;
		return acc;
	}, initial);

	return {
		byRole,
		total: source.length,
	};
}

export async function getUsers(
	filters: UserListFilters,
): Promise<UserListResult> {
	await delay(300);

	const { page, pageSize, search, role } = filters;

	let filtered = [...users];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((user) => {
			return (
				user.email.toLowerCase().includes(term) ||
				user.displayName.toLowerCase().includes(term)
			);
		});
	}

	if (role && role !== "ALL") {
		filtered = filtered.filter((user) => user.roles.includes(role));
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		summary: buildSummary(users),
		page,
		pageSize,
		total,
	};
}

export async function getUserById(id: string): Promise<User | undefined> {
	await delay(200);
	return users.find((user) => user.id === id);
}

export async function createUser(input: CreateUserInput): Promise<User> {
	await delay(500);

	// Check if email already exists
	if (users.some((u) => u.email === input.email)) {
		throw new Error("User with this email already exists");
	}

	// Generate new ID
	const newId = String(users.length + 1);

	const newUser: User = {
		id: newId,
		email: input.email,
		displayName: input.name,
		contactNo: "",
		isActive: true,
		roles: [input.role],
		permissions: [],
	};

	users.push(newUser);

	// In a real implementation:
	// - If passwordOption is "email", send email with generated password
	// - If passwordOption is "manual", save the password (hashed)

	return newUser;
}

export async function updateUserRole(
	input: UpdateUserRoleInput,
): Promise<User> {
	await delay(400);

	const index = users.findIndex((user) => user.id === input.userId);
	if (index === -1) {
		throw new Error("User not found");
	}

	const updated: User = {
		...users[index],
		roles: [input.role],
	};

	users[index] = updated;
	return updated;
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
	await delay(400);

	const index = users.findIndex((user) => user.id === input.userId);
	if (index === -1) {
		throw new Error("User not found");
	}

	const updated: User = {
		...users[index],
		roles: [input.role],
	};

	users[index] = updated;

	// In a real implementation:
	// - If passwordOption is "email", send email with generated password
	// - If passwordOption is "manual", save the password (hashed)

	return updated;
}

export async function deleteUser(id: string): Promise<boolean> {
	await delay(400);

	const index = users.findIndex((user) => user.id === id);
	if (index === -1) {
		throw new Error("User not found");
	}

	users.splice(index, 1);
	return true;
}
