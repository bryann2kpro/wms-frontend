import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
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
	ArrowUpDown,
	HelpCircle,
	ImageOff,
	Users,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import type { WMSRole } from "@/lib/auth";
import { getPrimaryRole } from "@/lib/auth";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
// GraphQL: list query, roles, create/update mutations (see src/lib/graphql/user-management.ts)
import {
	USERS_QUERY,
	ROLES_QUERY,
	CREATE_USER_MUTATION,
	UPDATE_USER_MUTATION,
	type UsersQueryData,
	type UsersQueryVariables,
	type RoleOption,
	type CreateUserMutationVariables,
	type CreateUserMutationData,
	type UpdateUserMutationVariables,
	type UpdateUserMutationData,
	type CreateUserInputGql,
	type UpdateUserInputGql,
} from "@/lib/graphql/user-management";

export const Route = createFileRoute("/admin/user-management")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["User"]);
	},
	component: UserManagementComponent,
	head: () => ({
		meta: [
			{
				title: "User Management - SME Edaran WMS",
				description:
					"Create, update, and manage users, roles, and account access across the system.",
			},
		],
	}),
});

/** Hide Super Admin from create/update and filter dropdowns (do not assign via UI). */
const HIDDEN_ROLE_NAME = "super admin";

/**
 * Emails of users to hide from the list (e.g. super admin).
 * Matching is case-insensitive. Add more emails here to hide additional users.
 */
const HIDDEN_USER_EMAILS = ["superadmin@smee.com.my"];

/** Display labels for each role in badges and dropdowns. */
const roleLabels: Partial<Record<WMSRole, string>> = {
	supervisor: "Supervisor",
	logistic: "Logistic",
	store_keeper: "Store Keeper",
};

/** Tailwind classes for role badges (background, text, border). */
const roleColors: Partial<Record<WMSRole, string>> = {
	supervisor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
	logistic: "bg-blue-500/10 text-blue-600 border-blue-500/20",
	store_keeper: "bg-green-500/10 text-green-600 border-green-500/20",
};

/** Maps backend roleName (e.g. "Supervisor") to WMSRole for labels/colors. */
function roleNameToWMSRole(roleName: string | undefined): WMSRole {
	if (!roleName) return "store_keeper";
	const r = roleName.toLowerCase();
	if (r.includes("supervisor") || r.includes("admin")) return "supervisor";
	if (r.includes("logistic") || r.includes("finance")) return "logistic";
	return "store_keeper";
}

/** Backend sort field names for UserSort. */
const SORT_FIELDS = [
	{ value: "UPDATED_AT", label: "Updated at" },
	{ value: "CREATED_AT", label: "Created at" },
	{ value: "DISPLAY_NAME", label: "Name" },
	{ value: "EMAIL", label: "Email" },
] as const;

const SORT_DIRECTIONS = [
	{ value: "DESC", label: "Newest / Z→A" },
	{ value: "ASC", label: "Oldest / A→Z" },
] as const;

type StatusFilterValue = "ALL" | "ACTIVE" | "INACTIVE";

const SEARCH_DEBOUNCE_MS = 350;

/** Base path for User Management help screenshots. Add step-1.png, step-2.png, etc. under public/help/user-management/ */
const HELP_IMAGES_BASE = "/help/user-management";

const USER_MANAGEMENT_HELP_STEPS: Array<{
	title: string;
	description: ReactNode;
	image: string;
}> = [
	{
		title: "What this page does",
		image: `${HELP_IMAGES_BASE}/step-1.png`,
		description: (
			<>
				View all users, create new ones, and change roles or passwords. The
				summary cards show counts by role (Supervisor, Logistic, Store Keeper)
				and total users.
			</>
		),
	},
	{
		title: "Search and filters",
		image: `${HELP_IMAGES_BASE}/step-2.png`,
		description: (
			<>
				Search by <strong>name</strong> or <strong>email</strong> (debounced).
				Filter by <strong>Role</strong> and <strong>Status</strong> (Active /
				Inactive). Use <strong>Sort</strong> to order by name, email, or date.
			</>
		),
	},
	{
		title: "Create user",
		image: `${HELP_IMAGES_BASE}/step-3.png`,
		description: (
			<>
				Click <strong>Create User</strong>, enter email, display name, and role.
				Set the password manually or send a system-generated one by email.
			</>
		),
	},
	{
		title: "Edit user",
		image: `${HELP_IMAGES_BASE}/step-4.png`,
		description: (
			<>
				Click the <strong>edit</strong> icon on a row to change that user’s role
				or password. Changes apply immediately.
			</>
		),
	},
];

/** Renders step screenshot with a placeholder when the image is missing or fails to load. */
function HelpStepImage({
	src,
	stepNumber,
	alt,
}: {
	src: string;
	stepNumber: number;
	alt?: string;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
				<span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
					<ImageOff className="h-7 w-7" />
				</span>
				<span className="text-sm text-muted-foreground">
					Add screenshot:{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
						public/help/user-management/step-{stepNumber}.png
					</code>
				</span>
			</div>
		);
	}
	return (
		<img
			src={src}
			alt={alt ?? ""}
			className="h-full w-full object-contain object-top"
			onError={() => setFailed(true)}
		/>
	);
}

/**
 * User Management page: list, create, update via GraphQL (USERS_QUERY, CREATE_USER_MUTATION, UPDATE_USER_MUTATION).
 * ROLES_QUERY provides roleId for filter and create/edit dropdowns.
 */
function UserManagementComponent() {
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearchTerm = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);
	const [roleFilterId, setRoleFilterId] = useState<string>("ALL");
	const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");
	const [sortField, setSortField] = useState<string>("UPDATED_AT");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);
	const [selectedUser, setSelectedUser] = useState<{
		id: string;
		name: string;
		email: string;
		currentRole: WMSRole;
		roleId: string;
	} | null>(null);

	const queryClient = useQueryClient();

	// GraphQL: roles for filter and create/edit dropdowns (backend expects roleId)
	const { data: rolesData } = useQuery({
		queryKey: qk.roles.all,
		queryFn: () => gqlRequest<{ roles: RoleOption[] }>(ROLES_QUERY),
	});
	const allRoles = rolesData?.roles ?? [];
	// Exclude Super Admin so it cannot be assigned in create/update or filter
	const displayRolesList = allRoles.filter(
		(r) => r.roleName.trim().toLowerCase() !== HIDDEN_ROLE_NAME,
	);

	// --- GraphQL: filter (search = email/displayName, role, isActive), sort, pagination — backend resolver uses repository
	const hasFilter =
		debouncedSearchTerm.trim() ||
		roleFilterId !== "ALL" ||
		statusFilter !== "ALL";
	const variables: UsersQueryVariables = {
		filter: hasFilter
			? {
					...(debouncedSearchTerm.trim() && {
						displayName: debouncedSearchTerm.trim(),
						email: debouncedSearchTerm.trim(),
					}),
					...(roleFilterId !== "ALL" && { roleId: roleFilterId }),
					...(statusFilter !== "ALL" && {
						isActive: statusFilter === "ACTIVE",
					}),
				}
			: undefined,
		sort: { field: sortField, direction: sortDirection },
		pagination: { page, pageSize },
	};

	const {
		data,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: qk.users.list(variables),
		queryFn: () =>
			gqlRequest<UsersQueryData, UsersQueryVariables>(USERS_QUERY, variables),
	});

	// GraphQL create user mutation (backend: CreateUserInput with email, displayName, password, roleId)
	const { mutate: createUserMutation, isPending: createLoading } = useMutation({
		mutationFn: (vars: CreateUserMutationVariables) =>
			gqlRequest<CreateUserMutationData, CreateUserMutationVariables>(
				CREATE_USER_MUTATION,
				vars,
			),
		onSuccess: () => {
			refetch();
			queryClient.invalidateQueries({ queryKey: qk.users.all });
			setIsCreateDialogOpen(false);
		},
	});

	// GraphQL update user mutation (backend: UpdateUserInput with displayName, roleId, password, etc.)
	const { mutate: updateUserMutation, isPending: updateLoading } = useMutation({
		mutationFn: (vars: UpdateUserMutationVariables) =>
			gqlRequest<UpdateUserMutationData, UpdateUserMutationVariables>(
				UPDATE_USER_MUTATION,
				vars,
			),
		onSuccess: () => {
			refetch();
			queryClient.invalidateQueries({ queryKey: qk.users.all });
			setIsEditRoleDialogOpen(false);
			setSelectedUser(null);
		},
	});

	// --- GraphQL response: users list is data.users.data; pagination is data.users.pagination (PaginationInfo, no count)
	// Exclude hidden users (e.g. super admin) from list and summary
	const rawUsers = data?.users?.data ?? [];
	const users = rawUsers.filter(
		(u) => !HIDDEN_USER_EMAILS.includes(u.email.toLowerCase()),
	);
	const pagination = data?.users?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	// Summary by role from visible users; total adjusted when hidden user is on current page
	const summary = pagination
		? {
				byRole: users.reduce<Record<WMSRole, number>>(
					(acc, u) => {
						const r = roleNameToWMSRole(u.roles[0]?.roleName);
						acc[r] = (acc[r] ?? 0) + 1;
						return acc;
					},
					{
						store_keeper: 0,
						logistic: 0,
						supervisor: 0,
						"Super Admin": 0,
					},
				),
				total: pagination.totalCount - (rawUsers.length - users.length),
			}
		: undefined;

	/** Open edit dialog with user's current role (primary = first in roles array); store roleId for GraphQL update. */
	const handleEditRole = (user: {
		id: string;
		displayName: string;
		email: string;
		roles: Array<{ roleId: string; roleName: string }>;
	}) => {
		const primaryRole = getPrimaryRole(user.roles.map((r) => r.roleName));
		setSelectedUser({
			id: user.id,
			name: user.displayName,
			email: user.email,
			currentRole: primaryRole,
			roleId: user.roles[0]?.roleId ?? "",
		});
		setIsEditRoleDialogOpen(true);
	};

	const handleConfirmUserUpdate = (input: {
		displayName?: string | null;
		roleId?: string | null;
		password?: string | null;
	}) => {
		if (!selectedUser) return;
		updateUserMutation({ id: selectedUser.id, input });
	};

	useEffect(() => {
		if (!isHelpOpen) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight")
				setHelpStep((s) =>
					Math.min(s + 1, USER_MANAGEMENT_HELP_STEPS.length - 1),
				);
			if (e.key === "ArrowLeft") setHelpStep((s) => Math.max(s - 1, 0));
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isHelpOpen]);

	const isPageBusy = isLoading || createLoading || updateLoading;

	return (
		<div className="user-management-page min-h-screen bg-[var(--dashboard-surface)]">
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<main
				className="container relative mx-auto space-y-6 p-6"
				aria-labelledby="user-management-page-title"
				aria-describedby="user-management-page-description"
				aria-busy={isPageBusy}
			>
				<AdminPageHeader
					icon={Users}
					title="User Management"
					description="Manage users, roles, and account access."
					titleId="user-management-page-title"
					descriptionId="user-management-page-description"
					rightSlot={
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								aria-label="Open help"
								className="rounded-lg"
								onClick={() => {
									setIsHelpOpen(true);
									setHelpStep(0);
								}}
							>
								<HelpCircle className="h-4 w-4" />
							</Button>
							<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
								<DialogContent className="sm:max-w-lg rounded-2xl border-2 border-border bg-background p-0 overflow-hidden shadow-xl">
									<DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/50">
										<div className="flex items-center gap-3">
											<div
												className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-sm font-bold text-white tabular-nums"
												style={{ fontFamily: "var(--dashboard-display)" }}
											>
												{helpStep + 1}
											</div>
											<div>
												<DialogTitle
													className="text-lg"
													style={{ fontFamily: "var(--dashboard-display)" }}
												>
													User Management help
												</DialogTitle>
												<DialogDescription
													className="mt-0.5"
													style={{ fontFamily: "var(--dashboard-body)" }}
												>
													Step {helpStep + 1} of{" "}
													{USER_MANAGEMENT_HELP_STEPS.length}
												</DialogDescription>
											</div>
										</div>
									</DialogHeader>
									<div className="space-y-5 px-6 py-5">
										<div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/50 shadow-inner">
											<HelpStepImage
												src={USER_MANAGEMENT_HELP_STEPS[helpStep].image}
												stepNumber={helpStep + 1}
											/>
										</div>
										<div className="rounded-xl border bg-card p-4">
											<h3
												className="mb-2 text-sm font-semibold text-foreground"
												style={{ fontFamily: "var(--dashboard-display)" }}
											>
												{USER_MANAGEMENT_HELP_STEPS[helpStep].title}
											</h3>
											<p
												className="text-sm text-muted-foreground leading-relaxed"
												style={{ fontFamily: "var(--dashboard-body)" }}
											>
												{USER_MANAGEMENT_HELP_STEPS[helpStep].description}
											</p>
										</div>
										<div className="flex items-center justify-between gap-4 pt-1">
											<div
												className="flex gap-1.5"
												role="tablist"
												aria-label="Help steps"
											>
												{USER_MANAGEMENT_HELP_STEPS.map((_, i) => (
													<button
														type="button"
														key={i}
														role="tab"
														aria-selected={i === helpStep}
														aria-label={`Step ${i + 1}: ${USER_MANAGEMENT_HELP_STEPS[i].title}`}
														onClick={() => setHelpStep(i)}
														className={`h-2 rounded-full transition-all duration-200 ${
															i === helpStep
																? "w-6 bg-amber-600"
																: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50 hover:w-3"
														}`}
													/>
												))}
											</div>
											<div className="flex gap-2">
												{helpStep > 0 ? (
													<Button
														variant="outline"
														size="sm"
														className="rounded-lg"
														onClick={() => setHelpStep((s) => s - 1)}
													>
														<ChevronLeft className="mr-0.5 h-4 w-4" />
														Previous
													</Button>
												) : null}
												{helpStep < USER_MANAGEMENT_HELP_STEPS.length - 1 ? (
													<Button
														size="sm"
														className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
														onClick={() => setHelpStep((s) => s + 1)}
													>
														Next
														<ChevronRight className="ml-0.5 h-4 w-4" />
													</Button>
												) : (
													<Button
														size="sm"
														className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
														onClick={() => setIsHelpOpen(false)}
													>
														Got it
													</Button>
												)}
											</div>
										</div>
									</div>
								</DialogContent>
							</Dialog>
							<Button
								className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
								onClick={() => setIsCreateDialogOpen(true)}
							>
								<UserPlus className="mr-2 h-4 w-4" />
								Create User
							</Button>
						</div>
					}
				/>

				{summary && (
					<div
						className="grid gap-4 md:grid-cols-4"
						role="region"
						aria-label="User summary by role"
					>
						{[
							{
								key: "supervisor",
								label: "Supervisors",
								value: summary.byRole.supervisor ?? 0,
							},
							{
								key: "logistic",
								label: "Logistic",
								value: summary.byRole.logistic ?? 0,
							},
							{
								key: "store_keeper",
								label: "Store Keepers",
								value: summary.byRole.store_keeper ?? 0,
							},
							{ key: "total", label: "Total Users", value: summary.total },
						].map((item, i) => (
							<Card
								key={item.key}
								className={`dashboard-card transition-colors hover:bg-muted/30 ${i === 0 ? "border-l-4 border-l-[var(--dashboard-accent)]" : ""}`}
								style={{ animationDelay: `${i * 60}ms` }}
							>
								<CardHeader className="pb-2">
									<CardTitle
										className="text-sm font-medium"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										{item.label}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div
										className="text-2xl font-bold tabular-nums"
										style={{ fontFamily: "var(--dashboard-display)" }}
									>
										{item.value}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}

				<Card className="dashboard-card">
					<CardHeader>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<CardTitle
									className="text-xl"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									User List
								</CardTitle>
								<CardDescription
									className="text-muted-foreground"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									View and manage all users
								</CardDescription>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="Search by name or email..."
										value={searchTerm}
										onChange={(e) => {
											setSearchTerm(e.target.value);
											setPage(1);
										}}
										className="pl-9 sm:w-64 rounded-lg border-muted-foreground/20"
										aria-label="Search users by name or email"
									/>
								</div>
								<Select
									value={roleFilterId}
									onValueChange={(value) => {
										setRoleFilterId(value);
										setPage(1);
									}}
								>
									<SelectTrigger
										className="sm:w-40 rounded-lg border-muted-foreground/20"
										aria-label="Filter by role"
									>
										<SelectValue placeholder="Filter by role" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">All Roles</SelectItem>
										{displayRolesList.map((r) => (
											<SelectItem key={r.roleId} value={r.roleId}>
												{r.roleName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={statusFilter}
									onValueChange={(value: StatusFilterValue) => {
										setStatusFilter(value);
										setPage(1);
									}}
								>
									<SelectTrigger
										className="sm:w-36 rounded-lg border-muted-foreground/20"
										aria-label="Filter by status"
									>
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">All statuses</SelectItem>
										<SelectItem value="ACTIVE">Active</SelectItem>
										<SelectItem value="INACTIVE">Inactive</SelectItem>
									</SelectContent>
								</Select>
								<div className="flex items-center gap-1.5 shrink-0">
									<ArrowUpDown
										className="h-4 w-4 text-muted-foreground shrink-0"
										aria-hidden
									/>
									<Select
										value={sortField}
										onValueChange={(value) => {
											setSortField(value);
											setPage(1);
										}}
									>
										<SelectTrigger
											className="sm:w-36 rounded-lg border-muted-foreground/20"
											aria-label="Sort by field"
										>
											<SelectValue placeholder="Sort by" />
										</SelectTrigger>
										<SelectContent>
											{SORT_FIELDS.map((f) => (
												<SelectItem key={f.value} value={f.value}>
													{f.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={sortDirection}
										onValueChange={(value: "ASC" | "DESC") => {
											setSortDirection(value);
											setPage(1);
										}}
									>
										<SelectTrigger
											className="sm:w-36 rounded-lg border-muted-foreground/20"
											aria-label="Sort direction"
										>
											<SelectValue placeholder="Order" />
										</SelectTrigger>
										<SelectContent>
											{SORT_DIRECTIONS.map((d) => (
												<SelectItem key={d.value} value={d.value}>
													{d.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent className="relative px-0 pb-6">
						<GlobalLoadingShadow />
						<div className="overflow-x-auto rounded-lg border mx-6">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="px-6">Name</TableHead>
										<TableHead className="px-6">Email</TableHead>
										<TableHead className="px-6">Role</TableHead>
										<TableHead className="px-6 text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{isLoading ? (
										<TableRow>
											<TableCell
												colSpan={4}
												className="h-24 px-6 text-center text-muted-foreground"
											>
												Loading users...
											</TableCell>
										</TableRow>
									) : users.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={4}
												className="h-24 px-6 text-center text-muted-foreground"
											>
												No users found.
											</TableCell>
										</TableRow>
									) : (
										users.map((user) => {
											const primaryRole = roleNameToWMSRole(
												user.roles[0]?.roleName,
											);
											return (
												<TableRow
													key={user.id}
													className="transition-colors hover:bg-muted/50"
												>
													<TableCell className="px-6 font-medium">
														{user.displayName}
													</TableCell>
													<TableCell className="px-6 text-muted-foreground">
														{user.email}
													</TableCell>
													<TableCell className="px-6">
														<Badge
															variant="outline"
															className={roleColors[primaryRole] ?? "bg-muted"}
														>
															{roleLabels[primaryRole] ??
																user.roles[0]?.roleName ??
																primaryRole}
														</Badge>
													</TableCell>
													<TableCell className="px-6 text-right">
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

						{pagination && (
							<div
								className="mt-4 flex items-center justify-between px-6 text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								<div>
									Showing{" "}
									<span className="font-semibold tabular-nums text-foreground">
										{(pagination.currentPage - 1) * pageSize + 1}
									</span>{" "}
									-{" "}
									<span className="font-semibold tabular-nums text-foreground">
										{Math.min(
											pagination.currentPage * pageSize,
											pagination.totalCount,
										)}
									</span>{" "}
									of{" "}
									<span className="font-semibold tabular-nums text-foreground">
										{pagination.totalCount}
									</span>{" "}
									users
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon"
										className="rounded-lg h-8 w-8"
										disabled={page === 1}
										onClick={() => setPage((p) => Math.max(1, p - 1))}
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<span>
										Page{" "}
										<span className="font-semibold tabular-nums text-foreground">
											{page}
										</span>{" "}
										of {totalPages}
									</span>
									<Button
										variant="outline"
										size="icon"
										className="rounded-lg h-8 w-8"
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
					roles={displayRolesList}
					onSubmit={(input) => {
						createUserMutation({ input });
					}}
					isSubmitting={createLoading}
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
					roles={displayRolesList}
					onConfirm={handleConfirmUserUpdate}
					isSubmitting={updateLoading}
				/>
			</main>
		</div>
	);
}

/** Generate a random temporary password (for "email" flow when backend doesn't send email yet). */
function generateTempPassword(length = 10): string {
	const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
	let s = "";
	for (let i = 0; i < length; i++)
		s += chars[Math.floor(Math.random() * chars.length)];
	return s;
}

interface CreateUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	roles: RoleOption[];
	onSubmit: (input: CreateUserInputGql) => void;
	isSubmitting: boolean;
}

function CreateUserDialog({
	open,
	onOpenChange,
	roles,
	onSubmit,
	isSubmitting,
}: CreateUserDialogProps) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [roleId, setRoleId] = useState("");
	const [passwordOption, setPasswordOption] = useState<"email" | "manual">(
		"manual",
	);
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Default role when dialog opens and roles are loaded
	useEffect(() => {
		if (open && roles.length > 0 && !roleId) {
			setRoleId(roles[0].roleId);
		}
	}, [open, roles, roleId]);

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

		if (!roleId) {
			newErrors.role = "Role is required";
		}

		const finalPassword =
			passwordOption === "manual" ? password : generateTempPassword();
		if (!finalPassword || finalPassword.length < 6) {
			newErrors.password =
				passwordOption === "manual"
					? "Password is required and must be at least 6 characters"
					: "Password is required";
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		onSubmit({
			email: email.trim(),
			displayName: name.trim(),
			password: finalPassword,
			roleId,
			contactNo: null,
		});

		// Reset form
		setEmail("");
		setName("");
		setRoleId(roles[0]?.roleId ?? "");
		setPasswordOption("manual");
		setPassword("");
		setErrors({});
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
			setEmail("");
			setName("");
			setRoleId(roles[0]?.roleId ?? "");
			setPasswordOption("manual");
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
								value={roleId}
								onValueChange={(value) => {
									setRoleId(value);
									if (errors.role) setErrors({ ...errors, role: "" });
								}}
							>
								<SelectTrigger id="role">
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{roles.map((r) => (
										<SelectItem key={r.roleId} value={r.roleId}>
											{r.roleName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.role && (
								<p className="text-sm text-destructive">{errors.role}</p>
							)}
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
											if (errors.password)
												setErrors({ ...errors, password: "" });
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
	user: {
		id: string;
		name: string;
		email: string;
		currentRole: WMSRole;
		roleId: string;
	} | null;
	roles: RoleOption[];
	onConfirm: (input: UpdateUserInputGql) => void;
	isSubmitting: boolean;
}

function EditUserDialog({
	open,
	onOpenChange,
	user,
	roles,
	onConfirm,
	isSubmitting,
}: EditUserDialogProps) {
	const [roleId, setRoleId] = useState(user?.roleId ?? "");
	const [passwordOption, setPasswordOption] = useState<
		"email" | "manual" | null
	>(null);
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		if (user) setRoleId(user.roleId);
	}, [user?.id, user?.roleId]);

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

		const input: UpdateUserInputGql = {
			displayName: user.name,
			roleId: roleId || undefined,
		};
		if (passwordOption === "manual" && password) {
			input.password = password;
		}

		onConfirm(input);

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
							<Select value={roleId} onValueChange={setRoleId}>
								<SelectTrigger id="edit-role">
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{roles.map((r) => (
										<SelectItem key={r.roleId} value={r.roleId}>
											{r.roleName}
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
											if (errors.password)
												setErrors({ ...errors, password: "" });
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
