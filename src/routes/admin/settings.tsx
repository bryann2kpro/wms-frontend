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
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getPrimaryRole } from "@/lib/auth";
import {
	canSeeEmailSettingsTab,
	canSeeMasterDataTab,
	canSeeWhatsAppSettingsTab,
	getAllowedMasterDataSubTabs,
} from "@/lib/settings-permissions";
import { MasterDataCard } from "@/components/settings/master-data-card";
import {
	User,
	Building,
	Bell,
	Shield,
	Loader2,
	Users,
	Database,
	Plug,
	Plus,
	Edit,
	Trash2,
	X,
	Mail,
	MessageCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WMSRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { gqlRequest } from "@/lib/api/gql";
import {
	ADVANCE_NOTICE_SETTING_KEY,
	EMAIL_NOTIFICATION_SETTINGS_QUERY,
	UPDATE_EMAIL_NOTIFICATION_SETTINGS_MUTATION,
	type EmailNotificationSettingsQueryData,
	type EmailNotificationSettingsQueryVariables,
	type UpdateEmailNotificationSettingsMutationData,
	type UpdateEmailNotificationSettingsMutationVariables,
} from "@/lib/graphql/email-settings";
import {
	RESET_WHATSAPP_SESSION_MUTATION,
	WHATSAPP_SETTINGS_QUERY,
	WHATSAPP_STATUS_QUERY,
	UPDATE_WHATSAPP_SETTINGS_MUTATION,
	type ResetWhatsAppSessionMutationData,
	type WhatsAppSettingsQueryData,
	type WhatsAppSettingsQueryVariables,
	type WhatsAppStatusQueryData,
	type UpdateWhatsAppSettingsMutationData,
	type UpdateWhatsAppSettingsMutationVariables,
} from "@/lib/graphql/whatsapp-settings";
import { QRCodeSVG } from "qrcode.react";
import { getSocket } from "@/lib/socket";

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
	head: () => ({
		meta: [
			{
				title: "Settings - SME Edaran WMS",
				description:
					"Configure account preferences, system settings, and integration options for warehouse operations.",
			},
		],
	}),
});

function SettingsPage() {
	const { user } = useCurrentUser();
	const queryClient = useQueryClient();
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<
		"profile" | "master-data" | "email-settings" | "whatsapp-settings"
	>("profile");

	const allowedMasterDataSubTabs = getAllowedMasterDataSubTabs(user);
	const showMasterDataTab = canSeeMasterDataTab(user);
	const showEmailSettingsTab = canSeeEmailSettingsTab(user);
	const showWhatsAppSettingsTab = canSeeWhatsAppSettingsTab(user);

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

	const isAnyMutationPending =
		updateUserProfile.isPending ||
		updateCompanySettings.isPending ||
		updateNotifications.isPending ||
		updatePassword.isPending;

	const tabs = [
		{ id: "profile" as const, label: "Profile", icon: User },
		...(showMasterDataTab
			? [{ id: "master-data" as const, label: "Master Data", icon: Database }]
			: []),
		...(showEmailSettingsTab
			? [
					{
						id: "email-settings" as const,
						label: "Email Settings",
						icon: Mail,
					},
				]
			: []),
		...(showWhatsAppSettingsTab
			? [
					{
						id: "whatsapp-settings" as const,
						label: "WhatsApp Settings",
						icon: MessageCircle,
					},
				]
			: []),
	];

	const visibleTabIds = tabs.map((t) => t.id);
	useEffect(() => {
		if (visibleTabIds.length > 0 && !visibleTabIds.includes(activeTab)) {
			setActiveTab(visibleTabIds[0]);
		}
	}, [activeTab, showMasterDataTab, showEmailSettingsTab, showWhatsAppSettingsTab]);

	return (
		<main
			className="settings-page min-h-screen overflow-x-hidden bg-[var(--dashboard-surface)]"
			aria-labelledby="settings-page-title"
			aria-describedby="settings-page-description"
			aria-busy={isAnyMutationPending}
		>
			<div
				className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
				aria-hidden
			/>
			<div className="container relative mx-auto min-w-0 space-y-6 p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2.5">
							<div
								className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
								style={{ background: "var(--dashboard-accent)" }}
							>
								<Users className="h-4.5 w-4.5 text-white" />
							</div>
							<h1
								id="settings-page-title"
								className="text-2xl font-bold tracking-tight"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Admin Settings
							</h1>
						</div>
						<div className="pl-11.5 space-y-1.5">
							<p
								id="settings-page-description"
								className="text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								Manage users, master data, and integration settings.
							</p>
							<div
								style={{
									height: "3px",
									width: "3rem",
									borderRadius: "9999px",
									background:
										"linear-gradient(to right, var(--dashboard-accent), transparent)",
								}}
							/>
						</div>
					</div>
				</div>

				{successMessage && (
					<div className="rounded-xl border border-green-500/20 bg-green-500/10 text-green-600 dark:bg-green-950/30 dark:border-green-500/30 px-4 py-3">
						{successMessage}
					</div>
				)}

				{/* Tabs */}
				<div
					className="flex gap-1 border-b border-border"
					role="tablist"
					aria-label="Settings sections"
				>
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;
						return (
							<Button
								key={tab.id}
								variant="ghost"
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									"settings-tab rounded-b-none border-b-2 border-transparent px-5 py-3 font-medium transition-colors hover:bg-muted/60",
									isActive && "settings-tab-active bg-transparent",
								)}
								role="tab"
								aria-selected={isActive}
								aria-controls={`settings-tabpanel-${tab.id}`}
								id={`settings-tab-${tab.id}`}
							>
								<Icon className="mr-2 h-4 w-4" />
								{tab.label}
							</Button>
						);
					})}
				</div>

				{/* Tab Content */}
				<div
					className="min-w-0"
					role="tabpanel"
					id={`settings-tabpanel-${activeTab}`}
					aria-labelledby={`settings-tab-${activeTab}`}
				>
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

					{/* {activeTab === "users" && <UsersRolesCard />} */}

					{activeTab === "master-data" && showMasterDataTab && (
						<MasterDataCard allowedSubTabs={allowedMasterDataSubTabs} />
					)}

					{activeTab === "email-settings" && showEmailSettingsTab && (
						<EmailNotificationsSettingsCard />
					)}
					{activeTab === "whatsapp-settings" && showWhatsAppSettingsTab && (
						<WhatsAppSettingsCard />
					)}
				</div>
			</div>
		</main>
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
		<Card className="dashboard-card">
			<CardHeader>
				<CardTitle
					className="flex items-center gap-2 text-xl"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					<User className="h-5 w-5" />
					User Profile
				</CardTitle>
				<CardDescription
					className="text-muted-foreground"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Update your personal information
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
					<form.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label
									htmlFor="name"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Full Name
								</Label>
								<Input
									id="name"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
									className="rounded-lg border-muted-foreground/20"
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
						<Label
							htmlFor="email"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Email
						</Label>
						<Input
							id="email"
							type="email"
							value={user?.email || ""}
							disabled
							className="rounded-lg border-muted-foreground/20"
						/>
						<p className="text-xs text-muted-foreground">
							Email cannot be changed
						</p>
					</div>

					<div className="space-y-2">
						<Label
							htmlFor="role"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Role
						</Label>
						<Input
							id="role"
							value={user ? getPrimaryRole(user.roles) : ""}
							disabled
							className="capitalize rounded-lg border-muted-foreground/20"
						/>
						<p className="text-xs text-muted-foreground">
							Contact administrator to change roles
						</p>
					</div>

					<Button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg text-white disabled:opacity-50"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
					>
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
			companyName: "SME Edaran",
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
		<Card className="dashboard-card">
			<CardHeader>
				<CardTitle
					className="flex items-center gap-2 text-xl"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					<Building className="h-5 w-5" />
					Company Settings
				</CardTitle>
				<CardDescription
					className="text-muted-foreground"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
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
								<Label
									htmlFor="company"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Company Name
								</Label>
								<Input
									id="company"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
									className="rounded-lg border-muted-foreground/20"
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
								<Label
									htmlFor="warehouse"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Default Warehouse
								</Label>
								<Input
									id="warehouse"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
									className="rounded-lg border-muted-foreground/20"
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
								<Label
									htmlFor="timezone"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Timezone
								</Label>
								<Input
									id="timezone"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
									className="rounded-lg border-muted-foreground/20"
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<Button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg text-white disabled:opacity-50"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
					>
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
		<Card className="dashboard-card">
			<CardHeader>
				<CardTitle
					className="flex items-center gap-2 text-xl"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					<Bell className="h-5 w-5" />
					Notifications
				</CardTitle>
				<CardDescription
					className="text-muted-foreground"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Manage your notification preferences
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
					<form.Field name="grnNotifications">
						{(field) => (
							<div className="flex items-center justify-between">
								<div>
									<p
										className="text-sm font-medium"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										GRN Notifications
									</p>
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
									<p
										className="text-sm font-medium"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										Delivery Updates
									</p>
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
									<p
										className="text-sm font-medium"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										Low Stock Alerts
									</p>
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

					<Button
						type="submit"
						disabled={isSubmitting}
						className="w-full rounded-lg text-white disabled:opacity-50"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
					>
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
		<Card className="dashboard-card">
			<CardHeader>
				<CardTitle
					className="flex items-center gap-2 text-xl"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					<Shield className="h-5 w-5" />
					Security
				</CardTitle>
				<CardDescription
					className="text-muted-foreground"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Manage your account security settings
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
					<form.Field name="currentPassword">
						{(field) => (
							<div className="space-y-2">
								<Label
									htmlFor="current-password"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Current Password
								</Label>
								<Input
									id="current-password"
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
									className="rounded-lg border-muted-foreground/20"
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
								<Label
									htmlFor="new-password"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									New Password
								</Label>
								<Input
									id="new-password"
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
									className="rounded-lg border-muted-foreground/20"
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
								<Label
									htmlFor="confirm-password"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Confirm New Password
								</Label>
								<Input
									id="confirm-password"
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={isSubmitting}
									className="rounded-lg border-muted-foreground/20"
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors[0]?.message}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<Button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg text-white disabled:opacity-50"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
					>
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

// Mock users data (using new User structure)
const mockUsersList = [
	{
		id: "1",
		displayName: "Eric Ng",
		email: "admin@smee.com.my",
		roles: ["supervisor"] as string[],
	},
	{
		id: "2",
		displayName: "Logistic User",
		email: "finance@smee.com.my",
		roles: ["logistic"] as string[],
	},
	{
		id: "3",
		displayName: "Store Keeper User",
		email: "warehouse@smee.com.my",
		roles: ["store_keeper"] as string[],
	},
];

function UsersRolesCard() {
	const [users] = useState(mockUsersList);

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Users & Roles Management
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Manage system users and assign roles
						</CardDescription>
					</div>
					<Button
						className="rounded-lg text-white"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add User
					</Button>
				</div>
			</CardHeader>
			<CardContent className="px-0 pb-6">
				<div className="mx-6 overflow-x-auto rounded-xl border">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Name
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Email
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Role
								</TableHead>
								<TableHead
									className="px-6 text-right"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{users.map((user) => {
								const primaryRole = getPrimaryRole(user.roles);
								return (
									<TableRow
										key={user.id}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6 font-medium">
											{user.displayName}
										</TableCell>
										<TableCell className="px-6">{user.email}</TableCell>
										<TableCell className="px-6">
											<Badge variant="outline">
												{primaryRole.replace("_", " ").toUpperCase()}
											</Badge>
										</TableCell>
										<TableCell className="px-6 text-right">
											<div className="flex justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="rounded-lg"
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="rounded-lg"
												>
													<Trash2 className="h-4 w-4 text-red-600" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

function EmailNotificationsSettingsCard() {
	const queryClient = useQueryClient();
	const [toInput, setToInput] = useState("");
	const [ccInput, setCcInput] = useState("");
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["emailNotificationSettings", ADVANCE_NOTICE_SETTING_KEY] as const,
		queryFn: async () => {
			const result = await gqlRequest<
				EmailNotificationSettingsQueryData,
				EmailNotificationSettingsQueryVariables
			>(EMAIL_NOTIFICATION_SETTINGS_QUERY, {
				settingKey: ADVANCE_NOTICE_SETTING_KEY,
			});
			return result?.emailNotificationSettings;
		},
	});

	const [toEmails, setToEmails] = useState<string[]>([]);
	const [ccEmails, setCcEmails] = useState<string[]>([]);

	useEffect(() => {
		if (data) {
			setToEmails(data.toEmails);
			setCcEmails(data.ccEmails);
		}
	}, [data]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			await gqlRequest<
				UpdateEmailNotificationSettingsMutationData,
				UpdateEmailNotificationSettingsMutationVariables
			>(UPDATE_EMAIL_NOTIFICATION_SETTINGS_MUTATION, {
				settingKey: ADVANCE_NOTICE_SETTING_KEY,
				input: { toEmails, ccEmails },
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["emailNotificationSettings", ADVANCE_NOTICE_SETTING_KEY],
			});
			setSaveSuccess(true);
			setSaveError(null);
			setTimeout(() => setSaveSuccess(false), 3000);
		},
		onError: (err: Error) => {
			setSaveError(err.message);
		},
	});

	function addEmail(
		list: string[],
		setList: (v: string[]) => void,
		input: string,
		setInput: (v: string) => void,
	) {
		const trimmed = input.trim().toLowerCase();
		if (!trimmed || list.includes(trimmed)) return;
		setList([...list, trimmed]);
		setInput("");
	}

	function removeEmail(
		list: string[],
		setList: (v: string[]) => void,
		email: string,
	) {
		setList(list.filter((e) => e !== email));
	}

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<CardTitle
					className="flex items-center gap-2 text-xl"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					<Mail className="h-5 w-5" />
					Advance Notice Email Recipients
				</CardTitle>
				<CardDescription
					className="text-muted-foreground"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Configure who receives email notifications when a new advance notice
					(PO) is received from NetSuite.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{isLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading settings...
					</div>
				) : (
					<>
						{/* To Emails */}
						<div className="space-y-3">
							<Label style={{ fontFamily: "var(--dashboard-body)" }}>
								To (Recipients)
							</Label>
							<div className="flex gap-2">
								<Input
									type="email"
									placeholder="email@example.com"
									value={toInput}
									onChange={(e) => setToInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addEmail(toEmails, setToEmails, toInput, setToInput);
										}
									}}
									className="rounded-lg border-muted-foreground/20"
								/>
								<Button
									type="button"
									variant="outline"
									className="rounded-lg shrink-0"
									onClick={() =>
										addEmail(toEmails, setToEmails, toInput, setToInput)
									}
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							{toEmails.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{toEmails.map((email) => (
										<Badge
											key={email}
											variant="secondary"
											className="flex items-center gap-1.5 pl-3 pr-1.5 py-1"
										>
											{email}
											<button
												type="button"
												onClick={() =>
													removeEmail(toEmails, setToEmails, email)
												}
												className="rounded hover:bg-muted-foreground/20 p-0.5"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
							)}
						</div>

						<Separator />

						{/* CC Emails */}
						<div className="space-y-3">
							<Label style={{ fontFamily: "var(--dashboard-body)" }}>
								CC (Carbon Copy)
							</Label>
							<div className="flex gap-2">
								<Input
									type="email"
									placeholder="email@example.com"
									value={ccInput}
									onChange={(e) => setCcInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addEmail(ccEmails, setCcEmails, ccInput, setCcInput);
										}
									}}
									className="rounded-lg border-muted-foreground/20"
								/>
								<Button
									type="button"
									variant="outline"
									className="rounded-lg shrink-0"
									onClick={() =>
										addEmail(ccEmails, setCcEmails, ccInput, setCcInput)
									}
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							{ccEmails.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{ccEmails.map((email) => (
										<Badge
											key={email}
											variant="secondary"
											className="flex items-center gap-1.5 pl-3 pr-1.5 py-1"
										>
											{email}
											<button
												type="button"
												onClick={() =>
													removeEmail(ccEmails, setCcEmails, email)
												}
												className="rounded hover:bg-muted-foreground/20 p-0.5"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
							)}
						</div>

						{saveError && (
							<p className="text-sm text-destructive">{saveError}</p>
						)}

						{saveSuccess && (
							<p className="text-sm text-green-600">
								Email settings saved successfully.
							</p>
						)}

						<Button
							onClick={() => saveMutation.mutate()}
							disabled={saveMutation.isPending}
							className="rounded-lg text-white disabled:opacity-50"
							style={{
								background: "var(--dashboard-accent)",
								borderColor: "var(--dashboard-accent)",
							}}
						>
							{saveMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								"Save Settings"
							)}
						</Button>
					</>
				)}
			</CardContent>
		</Card>
	);
}

function WhatsAppSettingsCard() {
	const queryClient = useQueryClient();
	const [phoneInput, setPhoneInput] = useState("");
	const [toPhones, setToPhones] = useState<string[]>([]);
	const [liveStatus, setLiveStatus] = useState<string | null>(null);
	const [liveQr, setLiveQr] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [sessionActionMessage, setSessionActionMessage] = useState<string | null>(
		null,
	);

	const { data: statusData, isLoading: isStatusLoading } = useQuery({
		queryKey: ["whatsAppStatus"] as const,
		queryFn: async () => {
			const result =
				await gqlRequest<WhatsAppStatusQueryData>(WHATSAPP_STATUS_QUERY);
			if (!result) {
				throw new Error("Unable to fetch WhatsApp status.");
			}
			return result.whatsAppStatus;
		},
	});

	const { data, isLoading } = useQuery({
		queryKey: ["whatsAppSettings", ADVANCE_NOTICE_SETTING_KEY] as const,
		queryFn: async () => {
			const result = await gqlRequest<
				WhatsAppSettingsQueryData,
				WhatsAppSettingsQueryVariables
			>(WHATSAPP_SETTINGS_QUERY, {
				settingKey: ADVANCE_NOTICE_SETTING_KEY,
			});
			return result?.whatsAppSettings;
		},
	});

	useEffect(() => {
		if (data) setToPhones(data.toPhones);
	}, [data]);

	useEffect(() => {
		const socket = getSocket();
		const syncWhatsAppState = () => {
			socket.emit("join-room", "whatsapp-admin");
			socket.emit("whatsapp:request-sync");
		};

		socket.on("connect", syncWhatsAppState);
		if (!socket.connected) {
			socket.connect();
		} else {
			syncWhatsAppState();
		}

		const onStatus = (payload: {
			status?: string;
			lastQr?: string | null;
		}) => {
			if (payload.status) setLiveStatus(payload.status);
			if (typeof payload.lastQr !== "undefined") setLiveQr(payload.lastQr ?? null);
		};
		const onQr = (payload: { qr?: string }) => {
			if (payload.qr) setLiveQr(payload.qr);
		};

		socket.on("whatsapp:status", onStatus);
		socket.on("whatsapp:qr", onQr);

		return () => {
			socket.off("connect", syncWhatsAppState);
			socket.off("whatsapp:status", onStatus);
			socket.off("whatsapp:qr", onQr);
			socket.emit("leave-room", "whatsapp-admin");
		};
	}, []);

	const saveMutation = useMutation({
		mutationFn: async () => {
			await gqlRequest<
				UpdateWhatsAppSettingsMutationData,
				UpdateWhatsAppSettingsMutationVariables
			>(UPDATE_WHATSAPP_SETTINGS_MUTATION, {
				settingKey: ADVANCE_NOTICE_SETTING_KEY,
				toPhones,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["whatsAppSettings", ADVANCE_NOTICE_SETTING_KEY],
			});
			setSaveSuccess(true);
			setSaveError(null);
			setTimeout(() => setSaveSuccess(false), 3000);
		},
		onError: (err: Error) => {
			setSaveError(err.message);
		},
	});

	const resetSessionMutation = useMutation({
		mutationFn: async () => {
			await gqlRequest<ResetWhatsAppSessionMutationData>(
				RESET_WHATSAPP_SESSION_MUTATION,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["whatsAppStatus"] });
			const socket = getSocket();
			socket.emit("whatsapp:request-sync");
			setSessionActionMessage(
				"WhatsApp session reset requested. A new QR code should appear shortly.",
			);
			setTimeout(() => setSessionActionMessage(null), 5000);
		},
		onError: (err: Error) => {
			setSessionActionMessage(`Failed to reset session: ${err.message}`);
		},
	});

	const effectiveStatus = liveStatus ?? statusData?.status ?? "disconnected";
	const effectiveQr = liveQr ?? statusData?.lastQr ?? null;

	function addPhone() {
		const normalized = phoneInput.trim();
		if (!normalized || toPhones.includes(normalized)) return;
		setToPhones([...toPhones, normalized]);
		setPhoneInput("");
	}

	function removePhone(phone: string) {
		setToPhones(toPhones.filter((value) => value !== phone));
	}

	const statusColor =
		effectiveStatus === "ready"
			? "bg-green-500"
			: effectiveStatus === "initializing"
				? "bg-yellow-500"
				: "bg-red-500";

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<CardTitle
					className="flex items-center gap-2 text-xl"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					<MessageCircle className="h-5 w-5" />
					Advance Notice WhatsApp Notifications
				</CardTitle>
				<CardDescription
					className="text-muted-foreground"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Configure WhatsApp recipients and monitor connection status for
					external API alerts.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="rounded-lg border p-4 space-y-4">
					<div className="flex items-center gap-2">
						<span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
						<p className="text-sm font-medium capitalize">
							Status: {effectiveStatus.replace("_", " ")}
						</p>
					</div>
					{isStatusLoading ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading WhatsApp status...
						</div>
					) : effectiveStatus === "qr_needed" && effectiveQr ? (
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								Scan this QR code with the WhatsApp account used for alerts.
							</p>
							<div className="inline-flex rounded-lg border bg-white p-3">
								<QRCodeSVG value={effectiveQr} size={180} />
							</div>
						</div>
					) : null}
					<div>
						<Button
							type="button"
							variant="outline"
							onClick={() => resetSessionMutation.mutate()}
							disabled={resetSessionMutation.isPending}
							className="rounded-lg"
						>
							{resetSessionMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Resetting Session...
								</>
							) : (
								"Reset WhatsApp Session"
							)}
						</Button>
					</div>
					{sessionActionMessage && (
						<p className="text-xs text-muted-foreground">{sessionActionMessage}</p>
					)}
				</div>

				<Separator />

				{isLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading settings...
					</div>
				) : (
					<div className="space-y-3">
						<Label style={{ fontFamily: "var(--dashboard-body)" }}>
							Recipient Phone Numbers
						</Label>
						<div className="flex gap-2">
							<Input
								placeholder="60123456789"
								value={phoneInput}
								onChange={(e) => setPhoneInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addPhone();
									}
								}}
								className="rounded-lg border-muted-foreground/20"
							/>
							<Button
								type="button"
								variant="outline"
								className="rounded-lg shrink-0"
								onClick={addPhone}
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
						{toPhones.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{toPhones.map((phone) => (
									<Badge
										key={phone}
										variant="secondary"
										className="flex items-center gap-1.5 pl-3 pr-1.5 py-1"
									>
										{phone}
										<button
											type="button"
											onClick={() => removePhone(phone)}
											className="rounded hover:bg-muted-foreground/20 p-0.5"
										>
											<X className="h-3 w-3" />
										</button>
									</Badge>
								))}
							</div>
						)}
					</div>
				)}

				{saveError && <p className="text-sm text-destructive">{saveError}</p>}
				{saveSuccess && (
					<p className="text-sm text-green-600">
						WhatsApp settings saved successfully.
					</p>
				)}

				<Button
					onClick={() => saveMutation.mutate()}
					disabled={saveMutation.isPending}
					className="rounded-lg text-white disabled:opacity-50"
					style={{
						background: "var(--dashboard-accent)",
						borderColor: "var(--dashboard-accent)",
					}}
				>
					{saveMutation.isPending ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Saving...
						</>
					) : (
						"Save Settings"
					)}
				</Button>
			</CardContent>
		</Card>
	);
}
