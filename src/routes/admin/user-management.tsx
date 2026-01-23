import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Search,
	UserPlus,
	Edit,
	ChevronLeft,
	ChevronRight,
	Mail,
	Key,
} from "lucide-react";
import type { WMSRole } from "@/lib/auth";
import { getPrimaryRole } from "@/lib/auth";
import {
	type UserRoleFilter,
	type CreateUserInput,
	type UpdateUserInput,
	getUsers,
	createUser,
	updateUser,
} from "@/data/users.mock-data";

export const Route = createFileRoute("/admin/user-management")({
	component: UserManagementComponent,
});

const userRoles: WMSRole[] = ["supervisor", "logistic", "store_keeper"];

const roleLabels: Record<WMSRole, string> = {
	supervisor: "Supervisor",
	logistic: "Logistic",
	store_keeper: "Store Keeper",
};

const roleColors: Record<WMSRole, string> = {
	supervisor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
	logistic: "bg-blue-500/10 text-blue-600 border-blue-500/20",
	store_keeper: "bg-green-500/10 text-green-600 border-green-500/20",
};

function UserManagementComponent() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("ALL");
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<{
		id: string;
		name: string;
		email: string;
		currentRole: WMSRole;
	} | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["users", { page, pageSize, searchTerm, roleFilter }],
		queryFn: () =>
			getUsers({
				page,
				pageSize,
				search: searchTerm,
				role: roleFilter,
			}),
		staleTime: 30_000,
	});

	const createMutation = useMutation({
		mutationFn: createUser,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users"] });
			setIsCreateDialogOpen(false);
		},
	});

	const updateUserMutation = useMutation({
		mutationFn: updateUser,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users"] });
			setIsEditRoleDialogOpen(false);
			setSelectedUser(null);
		},
	});

	const users = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const handleEditRole = (user: {
		id: string;
		displayName: string;
		email: string;
		roles: string[];
	}) => {
		setSelectedUser({
			id: user.id,
			name: user.displayName,
			email: user.email,
			currentRole: getPrimaryRole(user.roles),
		});
		setIsEditRoleDialogOpen(true);
	};

	const handleConfirmUserUpdate = (input: UpdateUserInput) => {
		if (!selectedUser) return;
		updateUserMutation.mutate(input);
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">User Management</h1>
					<p className="text-muted-foreground">
						Manage users and assign roles
					</p>
				</div>
				<Button onClick={() => setIsCreateDialogOpen(true)}>
					<UserPlus className="h-4 w-4 mr-2" />
					Create User
				</Button>
			</div>

			{summary && (
				<div className="grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Supervisors</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byRole.supervisor ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Logistic</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byRole.logistic ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Store Keepers</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{summary.byRole.store_keeper ?? 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Total Users</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{summary.total}</div>
						</CardContent>
					</Card>
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>User List</CardTitle>
							<CardDescription>View and manage all users</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search by name or email..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 sm:w-64"
								/>
							</div>
							<Select
								value={roleFilter}
								onValueChange={(value) => {
									setRoleFilter(value as UserRoleFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by role" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Roles</SelectItem>
									{userRoles.map((role) => (
										<SelectItem key={role} value={role}>
											{roleLabels[role]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Role</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="h-24 text-center text-muted-foreground"
										>
											Loading users...
										</TableCell>
									</TableRow>
								) : users.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="h-24 text-center text-muted-foreground"
										>
											No users found.
										</TableCell>
									</TableRow>
								) : (
									users.map((user) => {
									const primaryRole = getPrimaryRole(user.roles);
									return (
										<TableRow key={user.id}>
											<TableCell className="font-medium">
												{user.displayName}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{user.email}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={roleColors[primaryRole]}
												>
													{roleLabels[primaryRole]}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="ghost"
													size="icon"
													onClick={() =>
														handleEditRole({
															id: user.id,
															displayName: user.displayName,
															email: user.email,
															roles: user.roles,
														})
													}
												>
													<Edit className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									);
								})
								)}
							</TableBody>
						</Table>
					</div>

					{data && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								Showing{" "}
								<span className="font-medium">
									{(data.page - 1) * data.pageSize + 1}
								</span>{" "}
								-{" "}
								<span className="font-medium">
									{Math.min(data.page * data.pageSize, data.total)}
								</span>{" "}
								of <span className="font-medium">{data.total}</span> users
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page === 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span>
									Page {page} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={page === totalPages}
									onClick={() =>
										setPage((p) => (data ? Math.min(totalPages, p + 1) : p))
									}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create User Dialog */}
			<CreateUserDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onSubmit={(input) => {
					createMutation.mutate(input);
				}}
				isSubmitting={createMutation.isPending}
			/>

			{/* Edit User Dialog */}
			<EditUserDialog
				open={isEditRoleDialogOpen}
				onOpenChange={(open) => {
					setIsEditRoleDialogOpen(open);
					if (!open) {
						setSelectedUser(null);
					}
				}}
				user={selectedUser}
				onRoleChange={(role) => {
					if (selectedUser) {
						setSelectedUser({ ...selectedUser, currentRole: role });
					}
				}}
				onConfirm={handleConfirmUserUpdate}
				isSubmitting={updateUserMutation.isPending}
			/>
		</div>
	);
}

interface CreateUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: CreateUserInput) => void;
	isSubmitting: boolean;
}

function CreateUserDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting,
}: CreateUserDialogProps) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<WMSRole>("store_keeper");
	const [passwordOption, setPasswordOption] = useState<"email" | "manual">(
		"email",
	);
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const newErrors: Record<string, string> = {};

		if (!email.trim()) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			newErrors.email = "Invalid email format";
		}

		if (!name.trim()) {
			newErrors.name = "Name is required";
		}

		if (passwordOption === "manual" && !password.trim()) {
			newErrors.password = "Password is required when setting manually";
		} else if (passwordOption === "manual" && password.length < 6) {
			newErrors.password = "Password must be at least 6 characters";
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		onSubmit({
			email: email.trim(),
			name: name.trim(),
			role,
			passwordOption,
			password: passwordOption === "manual" ? password : undefined,
		});

		// Reset form
		setEmail("");
		setName("");
		setRole("store_keeper");
		setPasswordOption("email");
		setPassword("");
		setErrors({});
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
			setEmail("");
			setName("");
			setRole("store_keeper");
			setPasswordOption("email");
			setPassword("");
			setErrors({});
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Create New User</DialogTitle>
					<DialogDescription>
						Add a new user to the system. Choose how to set their password.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="email">Email *</Label>
							<Input
								id="email"
								type="email"
								placeholder="user@example.com"
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									if (errors.email) setErrors({ ...errors, email: "" });
								}}
								aria-invalid={!!errors.email}
							/>
							{errors.email && (
								<p className="text-sm text-destructive">{errors.email}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="name">Name *</Label>
							<Input
								id="name"
								type="text"
								placeholder="Full Name"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									if (errors.name) setErrors({ ...errors, name: "" });
								}}
								aria-invalid={!!errors.name}
							/>
							{errors.name && (
								<p className="text-sm text-destructive">{errors.name}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="role">Role *</Label>
							<Select
								value={role}
								onValueChange={(value) => setRole(value as WMSRole)}
							>
								<SelectTrigger id="role">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{userRoles.map((r) => (
										<SelectItem key={r} value={r}>
											{roleLabels[r]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-4 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="password-option">Password Setup</Label>
									<p className="text-sm text-muted-foreground">
										Choose how to set the user's password
									</p>
								</div>
								<div className="flex items-center gap-3">
									<span className="text-sm text-muted-foreground">
										{passwordOption === "email" ? (
											<span className="flex items-center gap-1">
												<Mail className="h-4 w-4" />
												Email
											</span>
										) : (
											<span className="flex items-center gap-1">
												<Key className="h-4 w-4" />
												Manual
											</span>
										)}
									</span>
									<Switch
										id="password-option"
										checked={passwordOption === "manual"}
										onCheckedChange={(checked) => {
											setPasswordOption(checked ? "manual" : "email");
											setPassword("");
											if (errors.password) setErrors({ ...errors, password: "" });
										}}
									/>
								</div>
							</div>

							{passwordOption === "manual" && (
								<div className="space-y-2">
									<Label htmlFor="password">Password *</Label>
									<Input
										id="password"
										type="password"
										placeholder="Enter password"
										value={password}
										onChange={(e) => {
											setPassword(e.target.value);
											if (errors.password)
												setErrors({ ...errors, password: "" });
										}}
										aria-invalid={!!errors.password}
									/>
									{errors.password && (
										<p className="text-sm text-destructive">{errors.password}</p>
									)}
									<p className="text-xs text-muted-foreground">
										Password must be at least 6 characters long
									</p>
								</div>
							)}

							{passwordOption === "email" && (
								<div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-900 dark:text-blue-200">
									<p>
										A system-generated password will be sent to the user's email
										address.
									</p>
								</div>
							)}
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Creating..." : "Create User"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

interface EditUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: { id: string; name: string; email: string; currentRole: WMSRole } | null;
	onRoleChange: (role: WMSRole) => void;
	onConfirm: (input: UpdateUserInput) => void;
	isSubmitting: boolean;
}

function EditUserDialog({
	open,
	onOpenChange,
	user,
	onRoleChange,
	onConfirm,
	isSubmitting,
}: EditUserDialogProps) {
	const [passwordOption, setPasswordOption] = useState<"email" | "manual" | null>(
		null,
	);
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});

	if (!user) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const newErrors: Record<string, string> = {};

		if (passwordOption === "manual" && !password.trim()) {
			newErrors.password = "Password is required when setting manually";
		} else if (passwordOption === "manual" && password.length < 6) {
			newErrors.password = "Password must be at least 6 characters";
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		onConfirm({
			userId: user.id,
			role: user.currentRole,
			passwordOption: passwordOption || undefined,
			password: passwordOption === "manual" ? password : undefined,
		});

		// Reset form
		setPasswordOption(null);
		setPassword("");
		setErrors({});
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
			setPasswordOption(null);
			setPassword("");
			setErrors({});
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit User</DialogTitle>
					<DialogDescription>
						Update role and password for <strong>{user.name}</strong>
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-role">Role</Label>
							<Select
								value={user.currentRole}
								onValueChange={(value) => onRoleChange(value as WMSRole)}
							>
								<SelectTrigger id="edit-role">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{userRoles.map((r) => (
										<SelectItem key={r} value={r}>
											{roleLabels[r]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-4 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="edit-password-option">
										Update Password (Optional)
									</Label>
									<p className="text-sm text-muted-foreground">
										Leave unchecked to keep current password
									</p>
								</div>
								<Switch
									id="edit-password-option"
									checked={passwordOption !== null}
									onCheckedChange={(checked) => {
										if (checked) {
											setPasswordOption("email");
										} else {
											setPasswordOption(null);
											setPassword("");
											if (errors.password) setErrors({ ...errors, password: "" });
										}
									}}
								/>
							</div>

							{passwordOption !== null && (
								<>
									<div className="flex items-center justify-between">
										<div className="space-y-0.5">
											<Label htmlFor="edit-password-method">
												Password Method
											</Label>
											<p className="text-sm text-muted-foreground">
												Choose how to set the password
											</p>
										</div>
										<div className="flex items-center gap-3">
											<span className="text-sm text-muted-foreground">
												{passwordOption === "email" ? (
													<span className="flex items-center gap-1">
														<Mail className="h-4 w-4" />
														Email
													</span>
												) : (
													<span className="flex items-center gap-1">
														<Key className="h-4 w-4" />
														Manual
													</span>
												)}
											</span>
											<Switch
												id="edit-password-method"
												checked={passwordOption === "manual"}
												onCheckedChange={(checked) => {
													setPasswordOption(checked ? "manual" : "email");
													setPassword("");
													if (errors.password)
														setErrors({ ...errors, password: "" });
												}}
											/>
										</div>
									</div>

									{passwordOption === "manual" && (
										<div className="space-y-2">
											<Label htmlFor="edit-password">New Password *</Label>
											<Input
												id="edit-password"
												type="password"
												placeholder="Enter new password"
												value={password}
												onChange={(e) => {
													setPassword(e.target.value);
													if (errors.password)
														setErrors({ ...errors, password: "" });
												}}
												aria-invalid={!!errors.password}
											/>
											{errors.password && (
												<p className="text-sm text-destructive">
													{errors.password}
												</p>
											)}
											<p className="text-xs text-muted-foreground">
												Password must be at least 6 characters long
											</p>
										</div>
									)}

									{passwordOption === "email" && (
										<div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-900 dark:text-blue-200">
											<p>
												A system-generated password will be sent to{" "}
												<strong>{user.email}</strong>
											</p>
										</div>
									)}
								</>
							)}

							{passwordOption === null && (
								<div className="rounded-md bg-gray-50 dark:bg-gray-950/20 p-3 text-sm text-gray-600 dark:text-gray-400">
									<p>Password will remain unchanged.</p>
								</div>
							)}
						</div>

						<div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-900 dark:text-yellow-200">
							<p>
								Changes will be applied immediately. This will update the user's
								permissions and/or password.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Updating..." : "Update User"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
