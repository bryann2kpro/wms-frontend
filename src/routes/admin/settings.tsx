import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import {
	User,
	Building,
	Bell,
	Shield,
	Loader2,
	Users,
	Database,
	Route as RouteIcon,
	Plug,
	Plus,
	Edit,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WMSRole } from "@/lib/auth";

// Zod schemas for validation
const userProfileSchema = z.object({
	name: z.string().min(1, "Full name is required"),
});

const companySettingsSchema = z.object({
	companyName: z.string().min(1, "Company name is required"),
	defaultWarehouse: z.string().min(1, "Default warehouse is required"),
	timezone: z.string().min(1, "Timezone is required"),
});

const notificationsSchema = z.object({
	grnNotifications: z.boolean(),
	deliveryUpdates: z.boolean(),
	lowStockAlerts: z.boolean(),
});

const securitySchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export const Route = createFileRoute("/admin/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const { user } = useAuth();
	const { hasPermission } = usePermissions(user);
	const queryClient = useQueryClient();
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<
		"profile" | "users" | "master-data" | "delivery-rules" | "integration"
	>("profile");

	// Mock mutation functions
	const updateUserProfile = useMutation({
		mutationFn: async (data: z.infer<typeof userProfileSchema>) => {
			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 1000));
			return data;
		},
		onSuccess: () => {
			setSuccessMessage("Profile updated successfully");
			setTimeout(() => setSuccessMessage(null), 3000);
		},
	});

	const updateCompanySettings = useMutation({
		mutationFn: async (data: z.infer<typeof companySettingsSchema>) => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			return data;
		},
		onSuccess: () => {
			setSuccessMessage("Company settings updated successfully");
			setTimeout(() => setSuccessMessage(null), 3000);
		},
	});

	const updateNotifications = useMutation({
		mutationFn: async (data: z.infer<typeof notificationsSchema>) => {
			await new Promise((resolve) => setTimeout(resolve, 800));
			return data;
		},
		onSuccess: () => {
			setSuccessMessage("Notification preferences updated");
			setTimeout(() => setSuccessMessage(null), 3000);
		},
	});

	const updatePassword = useMutation({
		mutationFn: async (data: z.infer<typeof securitySchema>) => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			return data;
		},
		onSuccess: () => {
			setSuccessMessage("Password updated successfully");
			setTimeout(() => setSuccessMessage(null), 3000);
		},
	});

	const tabs = [
		{ id: "profile" as const, label: "Profile", icon: User },
		// ...(hasPermission("admin:users")
		// 	? [{ id: "users" as const, label: "Users/Roles", icon: Users }]
		// 	: []),
		...(hasPermission("admin:master_data")
			? [{ id: "master-data" as const, label: "Master Data", icon: Database }]
			: []),
		...(hasPermission("admin:delivery_rules")
			? [
					{
						id: "delivery-rules" as const,
						label: "Delivery Rules",
						icon: RouteIcon,
					},
				]
			: []),
		...(hasPermission("admin:integration_status")
			? [
					{
						id: "integration" as const,
						label: "Integration Status",
						icon: Plug,
					},
				]
			: []),
	];

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Admin / Settings</h1>
				<p className="text-muted-foreground">
					Manage users, master data, delivery rules, and integration settings
				</p>
			</div>

			{successMessage && (
				<div className="rounded-lg border bg-green-500/10 border-green-500/20 text-green-600 px-4 py-3">
					{successMessage}
				</div>
			)}

			{/* Tabs */}
			<div className="flex gap-2 border-b">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<Button
							key={tab.id}
							variant={activeTab === tab.id ? "default" : "ghost"}
							onClick={() => setActiveTab(tab.id)}
							className="rounded-b-none"
						>
							<Icon className="mr-2 h-4 w-4" />
							{tab.label}
						</Button>
					);
				})}
			</div>

			{/* Tab Content */}
			{activeTab === "profile" && (
				<div className="grid gap-6 lg:grid-cols-2">
					<UserProfileCard
						user={user}
						onSubmit={updateUserProfile.mutateAsync}
						isSubmitting={updateUserProfile.isPending}
					/>
					<SecurityCard
						onSubmit={updatePassword.mutateAsync}
						isSubmitting={updatePassword.isPending}
					/>
					<NotificationsCard
						onSubmit={updateNotifications.mutateAsync}
						isSubmitting={updateNotifications.isPending}
					/>
				</div>
			)}

			{activeTab === "users" && hasPermission("admin:users") && (
				<UsersRolesCard />
			)}

			{activeTab === "master-data" && hasPermission("admin:master_data") && (
				<MasterDataCard />
			)}

			{activeTab === "delivery-rules" &&
				hasPermission("admin:delivery_rules") && <DeliveryRulesCard />}

			{activeTab === "integration" &&
				hasPermission("admin:integration_status") && <IntegrationStatusCard />}
		</div>
	);
}

function UserProfileCard({
	user,
	onSubmit,
	isSubmitting,
}: {
	user: { name: string; email: string; role: string } | null;
	onSubmit: (data: z.infer<typeof userProfileSchema>) => Promise<unknown>;
	isSubmitting: boolean;
}) {
	const form = useForm({
		defaultValues: {
			name: user?.name || "",
		},
		validators: {
			onBlur: userProfileSchema,
			onSubmit: userProfileSchema,
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value);
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<User className="h-5 w-5" />
					User Profile
				</CardTitle>
				<CardDescription>Update your personal information</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="name">Full Name</Label>
								<Input
									id="name"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" value={user?.email || ""} disabled />
						<p className="text-xs text-muted-foreground">
							Email cannot be changed
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="role">Role</Label>
						<Input
							id="role"
							value={user?.role || ""}
							disabled
							className="capitalize"
						/>
						<p className="text-xs text-muted-foreground">
							Contact administrator to change roles
						</p>
					</div>

					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							"Save Changes"
						)}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function CompanySettingsCard({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: z.infer<typeof companySettingsSchema>) => Promise<unknown>;
	isSubmitting: boolean;
}) {
	const form = useForm({
		defaultValues: {
			companyName: "SME Ederan",
			defaultWarehouse: "Main Warehouse",
			timezone: "Asia/Kuala Lumpur",
		},
		validators: {
			onBlur: companySettingsSchema,
			onSubmit: companySettingsSchema,
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value);
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Building className="h-5 w-5" />
					Company Settings
				</CardTitle>
				<CardDescription>
					Configure warehouse locations and settings
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="companyName">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="company">Company Name</Label>
								<Input
									id="company"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<form.Field name="defaultWarehouse">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="warehouse">Default Warehouse</Label>
								<Input
									id="warehouse"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<form.Field name="timezone">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="timezone">Timezone</Label>
								<Input
									id="timezone"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							"Save Changes"
						)}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function NotificationsCard({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: z.infer<typeof notificationsSchema>) => Promise<unknown>;
	isSubmitting: boolean;
}) {
	const form = useForm({
		defaultValues: {
			grnNotifications: true,
			deliveryUpdates: true,
			lowStockAlerts: true,
		},
		validators: {
			onSubmit: notificationsSchema,
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value);
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Bell className="h-5 w-5" />
					Notifications
				</CardTitle>
				<CardDescription>Manage your notification preferences</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="grnNotifications">
						{(field) => (
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">GRN Notifications</p>
									<p className="text-xs text-muted-foreground">
										Receive alerts for new GRN entries
									</p>
								</div>
								<Switch
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked)}
									disabled={isSubmitting}
								/>
							</div>
						)}
					</form.Field>

					<Separator />

					<form.Field name="deliveryUpdates">
						{(field) => (
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">Delivery Updates</p>
									<p className="text-xs text-muted-foreground">
										Get notified about delivery status changes
									</p>
								</div>
								<Switch
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked)}
									disabled={isSubmitting}
								/>
							</div>
						)}
					</form.Field>

					<Separator />

					<form.Field name="lowStockAlerts">
						{(field) => (
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">Low Stock Alerts</p>
									<p className="text-xs text-muted-foreground">
										Alert when inventory is below threshold
									</p>
								</div>
								<Switch
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked)}
									disabled={isSubmitting}
								/>
							</div>
						)}
					</form.Field>

					<Button type="submit" disabled={isSubmitting} className="w-full">
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							"Save Preferences"
						)}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function SecurityCard({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: z.infer<typeof securitySchema>) => Promise<unknown>;
	isSubmitting: boolean;
}) {
	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		validators: {
			onBlur: securitySchema,
			onSubmit: securitySchema,
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value);
			// Reset form after successful submission
			form.reset();
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Shield className="h-5 w-5" />
					Security
				</CardTitle>
				<CardDescription>Manage your account security settings</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="currentPassword">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="current-password">Current Password</Label>
								<Input
									id="current-password"
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<form.Field name="newPassword">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="new-password">New Password</Label>
								<Input
									id="new-password"
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<form.Field name="confirmPassword">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="confirm-password">Confirm New Password</Label>
								<Input
									id="confirm-password"
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Updating...
							</>
						) : (
							"Update Password"
						)}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

// Mock users data
const mockUsersList = [
	{
		id: "1",
		name: "Eric Ng",
		email: "admin@smee.com.my",
		role: "supervisor" as WMSRole,
	},
	{
		id: "2",
		name: "Logistic User",
		email: "finance@smee.com.my",
		role: "logistic" as WMSRole,
	},
	{
		id: "3",
		name: "Store Keeper User",
		email: "warehouse@smee.com.my",
		role: "store_keeper" as WMSRole,
	},
];

function UsersRolesCard() {
	const [users] = useState(mockUsersList);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Users & Roles Management</CardTitle>
						<CardDescription>
							Manage system users and assign roles
						</CardDescription>
					</div>
					<Button>
						<Plus className="mr-2 h-4 w-4" />
						Add User
					</Button>
				</div>
			</CardHeader>
			<CardContent>
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
							{users.map((user) => (
								<TableRow key={user.id}>
									<TableCell className="font-medium">{user.name}</TableCell>
									<TableCell>{user.email}</TableCell>
									<TableCell>
										<Badge variant="outline">
											{user.role.replace("_", " ").toUpperCase()}
										</Badge>
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button variant="ghost" size="icon">
												<Edit className="h-4 w-4" />
											</Button>
											<Button variant="ghost" size="icon">
												<Trash2 className="h-4 w-4 text-red-600" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

function MasterDataCard() {
	return (
		<div className="grid gap-6 md:grid-cols-3">
			<Card>
				<CardHeader>
					<CardTitle>Suppliers</CardTitle>
					<CardDescription>Manage supplier master data</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant="outline" className="w-full">
						<Plus className="mr-2 h-4 w-4" />
						Add Supplier
					</Button>
					<div className="mt-4 text-sm text-muted-foreground">
						Suppliers: 15
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Outlets</CardTitle>
					<CardDescription>Manage outlet master data</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant="outline" className="w-full">
						<Plus className="mr-2 h-4 w-4" />
						Add Outlet
					</Button>
					<div className="mt-4 text-sm text-muted-foreground">Outlets: 8</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>SKUs</CardTitle>
					<CardDescription>Manage SKU master data</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant="outline" className="w-full">
						<Plus className="mr-2 h-4 w-4" />
						Add SKU
					</Button>
					<div className="mt-4 text-sm text-muted-foreground">SKUs: 245</div>
				</CardContent>
			</Card>
		</div>
	);
}

function DeliveryRulesCard() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Delivery Rules</CardTitle>
				<CardDescription>
					Configure delivery scheduling and routing rules
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg border p-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium">Default Delivery Window</p>
							<p className="text-sm text-muted-foreground">9:00 AM - 5:00 PM</p>
						</div>
						<Button variant="outline" size="sm">
							<Edit className="mr-2 h-4 w-4" />
							Edit
						</Button>
					</div>
				</div>
				<div className="rounded-lg border p-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium">Auto-Assign Delivery Routes</p>
							<p className="text-sm text-muted-foreground">Enabled</p>
						</div>
						<Switch defaultChecked />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function IntegrationStatusCard() {
	const [syncSchedule, setSyncSchedule] = useState("12:00");

	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>NetSuite Connection</CardTitle>
					<CardDescription>Integration connection status</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<span className="text-sm">Connection Status</span>
						<Badge
							variant="outline"
							className="bg-green-500/10 text-green-600 border-green-500/20"
						>
							Connected
						</Badge>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm">Last Test</span>
						<span className="text-sm text-muted-foreground">
							{new Date().toLocaleString()}
						</span>
					</div>
					<Button variant="outline" className="w-full">
						Test Connection
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Sync Schedules</CardTitle>
					<CardDescription>Configure automated sync schedules</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label>TO Pull Schedule</Label>
						<Input
							type="time"
							value={syncSchedule}
							onChange={(e) => setSyncSchedule(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Daily TO pull from NetSuite (12pm default)
						</p>
					</div>
					<div className="space-y-2">
						<Label>Stock Sync Schedule</Label>
						<Input type="time" value="12:00" disabled />
						<p className="text-xs text-muted-foreground">
							Daily stock sync to NetSuite
						</p>
					</div>
					<Button className="w-full">Save Schedule</Button>
				</CardContent>
			</Card>
		</div>
	);
}
