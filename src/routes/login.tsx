import { useState } from "react";
import {
	createFileRoute,
	useNavigate,
	Link,
	redirect,
} from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	Mail,
	Lock,
	Eye,
	EyeOff,
	Loader2,
	AlertCircle,
	Package,
	Boxes,
	ClipboardList,
	Truck,
} from "lucide-react";
import { useAuthActions } from "@/lib/auth/use-auth-actions";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import axios from "axios";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
	beforeLoad: async ({ context }) => {
		if (typeof window === "undefined") return;
		if (context.isAuthenticated()) {
			throw redirect({ to: "/admin/dashboard" });
		}
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "Sign in — SME Edaran WMS" },
			{
				name: "description",
				content:
					"Sign in to access the SME Edaran Warehouse Management System.",
			},
		],
	}),
});

const formSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

// Warehouse shelf SVG illustration
function WarehouseIllustration() {
	return (
		<svg
			viewBox="0 0 320 240"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="w-full max-w-[320px] drop-shadow-lg"
			aria-hidden="true"
		>
			{/* ── Floor shadow ── */}
			<ellipse cx="160" cy="228" rx="130" ry="8" fill="black" opacity="0.25" />

			{/* ══════════════════════════════════
			    LEFT SHELF UNIT
			══════════════════════════════════ */}
			{/* Vertical posts */}
			<rect
				x="18"
				y="30"
				width="7"
				height="190"
				rx="3.5"
				fill="currentColor"
				opacity="0.55"
			/>
			<rect
				x="120"
				y="30"
				width="7"
				height="190"
				rx="3.5"
				fill="currentColor"
				opacity="0.55"
			/>

			{/* Diagonal cross-braces */}
			<line
				x1="25"
				y1="35"
				x2="120"
				y2="100"
				stroke="currentColor"
				strokeWidth="1.5"
				opacity="0.2"
			/>
			<line
				x1="25"
				y1="100"
				x2="120"
				y2="35"
				stroke="currentColor"
				strokeWidth="1.5"
				opacity="0.2"
			/>

			{/* Shelf planks */}
			<rect
				x="18"
				y="85"
				width="109"
				height="6"
				rx="3"
				fill="currentColor"
				opacity="0.7"
			/>
			<rect
				x="18"
				y="148"
				width="109"
				height="6"
				rx="3"
				fill="currentColor"
				opacity="0.7"
			/>
			<rect
				x="18"
				y="210"
				width="109"
				height="6"
				rx="3"
				fill="currentColor"
				opacity="0.5"
			/>

			{/* ── Top level boxes (left shelf) ── */}
			{/* Big box */}
			<rect
				x="26"
				y="50"
				width="38"
				height="33"
				rx="4"
				fill="var(--dashboard-accent)"
				opacity="0.9"
			/>
			<line
				x1="45"
				y1="50"
				x2="45"
				y2="83"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.25"
			/>
			<line
				x1="26"
				y1="66"
				x2="64"
				y2="66"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.25"
			/>
			{/* Small box */}
			<rect
				x="70"
				y="59"
				width="26"
				height="24"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.7"
			/>
			<line
				x1="83"
				y1="59"
				x2="83"
				y2="83"
				stroke="white"
				strokeWidth="0.6"
				opacity="0.2"
			/>
			{/* Tall box */}
			<rect
				x="100"
				y="44"
				width="20"
				height="39"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.55"
			/>

			{/* ── Middle level boxes (left shelf) ── */}
			<rect
				x="26"
				y="111"
				width="30"
				height="35"
				rx="4"
				fill="var(--dashboard-accent)"
				opacity="0.65"
			/>
			<line
				x1="41"
				y1="111"
				x2="41"
				y2="146"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.2"
			/>
			<rect
				x="62"
				y="118"
				width="24"
				height="28"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.85"
			/>
			<rect
				x="91"
				y="113"
				width="30"
				height="33"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.5"
			/>
			<line
				x1="106"
				y1="113"
				x2="106"
				y2="146"
				stroke="white"
				strokeWidth="0.6"
				opacity="0.2"
			/>

			{/* ── Bottom level boxes (left shelf) ── */}
			<rect
				x="26"
				y="170"
				width="44"
				height="38"
				rx="4"
				fill="var(--dashboard-accent)"
				opacity="0.75"
			/>
			<line
				x1="48"
				y1="170"
				x2="48"
				y2="208"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.25"
			/>
			<line
				x1="26"
				y1="189"
				x2="70"
				y2="189"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.2"
			/>
			<rect
				x="76"
				y="177"
				width="28"
				height="31"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.55"
			/>
			<rect
				x="109"
				y="174"
				width="14"
				height="34"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.4"
			/>

			{/* ══════════════════════════════════
			    RIGHT SHELF UNIT
			══════════════════════════════════ */}
			<rect
				x="185"
				y="30"
				width="7"
				height="190"
				rx="3.5"
				fill="currentColor"
				opacity="0.55"
			/>
			<rect
				x="297"
				y="30"
				width="7"
				height="190"
				rx="3.5"
				fill="currentColor"
				opacity="0.55"
			/>

			<line
				x1="192"
				y1="35"
				x2="297"
				y2="100"
				stroke="currentColor"
				strokeWidth="1.5"
				opacity="0.2"
			/>
			<line
				x1="192"
				y1="100"
				x2="297"
				y2="35"
				stroke="currentColor"
				strokeWidth="1.5"
				opacity="0.2"
			/>

			<rect
				x="185"
				y="85"
				width="119"
				height="6"
				rx="3"
				fill="currentColor"
				opacity="0.7"
			/>
			<rect
				x="185"
				y="148"
				width="119"
				height="6"
				rx="3"
				fill="currentColor"
				opacity="0.7"
			/>
			<rect
				x="185"
				y="210"
				width="119"
				height="6"
				rx="3"
				fill="currentColor"
				opacity="0.5"
			/>

			{/* ── Top level (right shelf) ── */}
			<rect
				x="193"
				y="46"
				width="46"
				height="37"
				rx="4"
				fill="var(--dashboard-accent)"
				opacity="0.8"
			/>
			<line
				x1="216"
				y1="46"
				x2="216"
				y2="83"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.25"
			/>
			<line
				x1="193"
				y1="64"
				x2="239"
				y2="64"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.2"
			/>
			<rect
				x="244"
				y="55"
				width="28"
				height="28"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.6"
			/>
			<rect
				x="277"
				y="50"
				width="18"
				height="33"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.45"
			/>

			{/* ── Middle level (right shelf) ── */}
			<rect
				x="193"
				y="109"
				width="32"
				height="37"
				rx="4"
				fill="var(--dashboard-accent)"
				opacity="0.55"
			/>
			<rect
				x="231"
				y="115"
				width="40"
				height="31"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.85"
			/>
			<line
				x1="251"
				y1="115"
				x2="251"
				y2="146"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.25"
			/>
			<line
				x1="231"
				y1="130"
				x2="271"
				y2="130"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.2"
			/>
			<rect
				x="277"
				y="112"
				width="18"
				height="34"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.65"
			/>

			{/* ── Bottom level (right shelf) ── */}
			<rect
				x="193"
				y="172"
				width="50"
				height="36"
				rx="4"
				fill="var(--dashboard-accent)"
				opacity="0.7"
			/>
			<line
				x1="218"
				y1="172"
				x2="218"
				y2="208"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.25"
			/>
			<line
				x1="193"
				y1="190"
				x2="243"
				y2="190"
				stroke="white"
				strokeWidth="0.8"
				opacity="0.2"
			/>
			<rect
				x="250"
				y="178"
				width="28"
				height="30"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.5"
			/>
			<rect
				x="283"
				y="175"
				width="16"
				height="33"
				rx="3"
				fill="var(--dashboard-accent)"
				opacity="0.8"
			/>

			{/* ══════════════════════════════════
			    PALLET JACK (foreground, decorative)
			══════════════════════════════════ */}
			{/* Handle */}
			<rect
				x="148"
				y="155"
				width="5"
				height="50"
				rx="2.5"
				fill="currentColor"
				opacity="0.4"
			/>
			<rect
				x="143"
				y="152"
				width="14"
				height="5"
				rx="2.5"
				fill="currentColor"
				opacity="0.4"
			/>
			{/* Body */}
			<rect
				x="136"
				y="198"
				width="28"
				height="10"
				rx="3"
				fill="currentColor"
				opacity="0.35"
			/>
			{/* Forks */}
			<rect
				x="134"
				y="205"
				width="6"
				height="20"
				rx="2"
				fill="currentColor"
				opacity="0.4"
			/>
			<rect
				x="158"
				y="205"
				width="6"
				height="20"
				rx="2"
				fill="currentColor"
				opacity="0.4"
			/>
			{/* Wheels */}
			<circle cx="136" cy="224" r="4" fill="currentColor" opacity="0.5" />
			<circle cx="163" cy="224" r="4" fill="currentColor" opacity="0.5" />
		</svg>
	);
}

function RouteComponent() {
	const navigate = useNavigate();
	const { login } = useAuthActions();
	const [error, setError] = useState<string>("");
	const [showPassword, setShowPassword] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onChange: formSchema,
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				await login({
					username: value.email,
					password: value.password,
				});
				toast.success("Welcome back!", {
					description: "You have signed in successfully.",
				});
				navigate({ to: "/admin/dashboard" });
			} catch (err) {
				if (axios.isAxiosError(err)) {
					const message =
						(err.response?.data as { message?: string })?.message ||
						"Wrong email or password. Please try again.";
					setError(message);
				} else if (err instanceof Error) {
					setError(err.message);
				} else {
					setError("Something went wrong. Please try again.");
				}
			}
		},
	});

	return (
		<div
			className="dashboard-page relative flex min-h-screen w-screen overflow-hidden"
			style={{
				background: "var(--dashboard-surface)",
				fontFamily: "var(--dashboard-body)",
			}}
		>
			{/* ── Ambient warm glow backdrop ── */}
			<div
				className="pointer-events-none absolute inset-0 opacity-100"
				style={{
					background: `
						radial-gradient(ellipse 60% 50% at 15% 50%, oklch(from var(--dashboard-accent) l c h / 0.08) 0%, transparent 70%),
						radial-gradient(ellipse 40% 40% at 85% 20%, oklch(from var(--dashboard-accent) l c h / 0.05) 0%, transparent 60%)
					`,
				}}
				aria-hidden
			/>

			{/* ── Subtle dot grid ── */}
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.035]"
				style={{
					backgroundImage: `radial-gradient(circle, var(--dashboard-accent) 1px, transparent 1px)`,
					backgroundSize: "28px 28px",
				}}
				aria-hidden
			/>

			{/* ══════════════════════════════════
			    BRAND PANEL  (desktop only)
			══════════════════════════════════ */}
			<aside
				aria-hidden="true"
				className="hidden lg:flex lg:w-[460px] xl:w-[500px] flex-col justify-between overflow-hidden relative"
				style={{
					borderRight:
						"1px solid oklch(from var(--dashboard-accent) l c h / 0.12)",
					background: `
						linear-gradient(
							160deg,
							oklch(from var(--dashboard-accent) l c h / 0.07) 0%,
							transparent 55%
						),
						var(--dashboard-surface)
					`,
				}}
			>
				{/* Top decorative stripe */}
				<div
					className="absolute inset-x-0 top-0 h-1"
					style={{
						background:
							"linear-gradient(90deg, transparent, var(--dashboard-accent), transparent)",
					}}
				/>

				{/* Content */}
				<div className="relative z-10 flex flex-col justify-between h-full p-10">
					{/* Logo mark */}
					<div className="flex items-center gap-3">
						<div
							className="flex h-9 w-9 items-center justify-center rounded-lg"
							style={{
								background: "oklch(from var(--dashboard-accent) l c h / 0.15)",
								border:
									"1px solid oklch(from var(--dashboard-accent) l c h / 0.3)",
							}}
						>
							<Package
								className="h-5 w-5"
								style={{ color: "var(--dashboard-accent)" }}
							/>
						</div>
						<div className="flex flex-col leading-none">
							<span
								className="text-[13px] font-bold tracking-widest uppercase"
								style={{
									fontFamily: "var(--dashboard-display)",
									color: "var(--foreground)",
								}}
							>
								SME Edaran
							</span>
							<span
								className="text-[11px] tracking-wider"
								style={{ color: "oklch(from var(--foreground) l c h / 0.45)" }}
							>
								Warehouse Management
							</span>
						</div>
					</div>

					{/* Illustration + headline */}
					<div className="flex flex-col items-start gap-8">
						{/* SVG illustration */}
						<div
							className="w-full flex justify-center"
							style={{ color: "var(--dashboard-accent)" }}
						>
							<WarehouseIllustration />
						</div>

						{/* Headline */}
						<div className="space-y-3 max-w-[340px]">
							<p
								className="text-[11px] font-semibold tracking-[0.22em] uppercase"
								style={{ color: "var(--dashboard-accent)" }}
							>
								All your warehouse operations
							</p>
							<h2
								className="text-[28px] font-bold leading-[1.2]"
								style={{
									fontFamily: "var(--dashboard-display)",
									color: "var(--foreground)",
								}}
							>
								Everything you need,
								<br />
								right here.
							</h2>
							<p
								className="text-[14px] leading-relaxed"
								style={{
									color: "oklch(from var(--foreground) l c h / 0.5)",
								}}
							>
								Receive goods, send deliveries, and track your stock — all in
								one simple place.
							</p>
						</div>

						{/* Feature pills */}
						<ul className="flex flex-col gap-2.5">
							{[
								{ icon: Boxes, label: "Stock & inventory tracking" },
								{ icon: ClipboardList, label: "Orders & delivery notes" },
								{ icon: Truck, label: "Delivery scheduling & POD" },
							].map(({ icon: Icon, label }) => (
								<li
									key={label}
									className="flex items-center gap-3 text-[13px]"
									style={{
										color: "oklch(from var(--foreground) l c h / 0.55)",
									}}
								>
									<span
										className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
										style={{
											background:
												"oklch(from var(--dashboard-accent) l c h / 0.1)",
											border:
												"1px solid oklch(from var(--dashboard-accent) l c h / 0.2)",
										}}
									>
										<Icon
											className="h-3.5 w-3.5"
											style={{ color: "var(--dashboard-accent)" }}
										/>
									</span>
									{label}
								</li>
							))}
						</ul>
					</div>

					{/* Footer */}
					<p
						className="text-[11px]"
						style={{
							color: "oklch(from var(--foreground) l c h / 0.3)",
						}}
					>
						© {new Date().getFullYear()} SME Edaran. All rights reserved.
					</p>
				</div>
			</aside>

			{/* ══════════════════════════════════
			    SIGN-IN PANEL
			══════════════════════════════════ */}
			<main
				role="main"
				className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10"
			>
				{/* Mobile logo */}
				<div className="mb-10 flex items-center gap-3 lg:hidden">
					<div
						className="flex h-9 w-9 items-center justify-center rounded-lg"
						style={{
							background: "oklch(from var(--dashboard-accent) l c h / 0.15)",
							border:
								"1px solid oklch(from var(--dashboard-accent) l c h / 0.3)",
						}}
					>
						<Package
							className="h-5 w-5"
							style={{ color: "var(--dashboard-accent)" }}
						/>
					</div>
					<div className="flex flex-col leading-none">
						<span
							className="text-[13px] font-bold tracking-widest uppercase"
							style={{
								fontFamily: "var(--dashboard-display)",
								color: "var(--foreground)",
							}}
						>
							SME Edaran
						</span>
						<span
							className="text-[11px] tracking-wider"
							style={{ color: "oklch(from var(--foreground) l c h / 0.45)" }}
						>
							Warehouse Management
						</span>
					</div>
				</div>

				<div className="w-full max-w-[400px] space-y-7">
					{/* Heading */}
					<div className="space-y-2">
						{/* Greeting badge */}
						<span
							className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-widest uppercase"
							style={{
								background: "oklch(from var(--dashboard-accent) l c h / 0.12)",
								border:
									"1px solid oklch(from var(--dashboard-accent) l c h / 0.25)",
								color: "var(--dashboard-accent)",
							}}
						>
							<span
								className="h-1.5 w-1.5 rounded-full"
								style={{
									background: "var(--dashboard-accent)",
									boxShadow:
										"0 0 6px 1px oklch(from var(--dashboard-accent) l c h / 0.5)",
								}}
							/>
							SME Edaran WMS
						</span>

						<h1
							className="text-[28px] font-bold leading-tight"
							style={{
								fontFamily: "var(--dashboard-display)",
								color: "var(--foreground)",
							}}
						>
							Welcome back
						</h1>
						<p
							className="text-[14px] leading-relaxed"
							style={{
								color: "oklch(from var(--foreground) l c h / 0.5)",
							}}
						>
							Sign in to manage your warehouse.
						</p>
					</div>

					{/* ── Form card ── */}
					<div
						className="relative overflow-hidden rounded-2xl p-6 shadow-lg"
						style={{
							background: "var(--card)",
							border:
								"1px solid oklch(from var(--dashboard-accent) l c h / 0.15)",
						}}
					>
						{/* Top highlight stripe */}
						<div
							className="pointer-events-none absolute inset-x-0 top-0 h-px"
							style={{
								background:
									"linear-gradient(90deg, transparent, oklch(from var(--dashboard-accent) l c h / 0.6), transparent)",
							}}
						/>

						<form
							id="login-form"
							aria-label="Sign in form"
							onSubmit={(e) => {
								e.preventDefault();
								form.handleSubmit();
							}}
							className="space-y-5"
						>
							<FieldGroup className="gap-5">
								{/* ── Email ── */}
								<form.Field name="email">
									{(field) => {
										const isInvalid =
											field.state.meta.isDirty && !field.state.meta.isValid;
										const errorId = `${field.name}-error`;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel
													htmlFor={field.name}
													className="text-[13px] font-semibold"
												>
													Email address
												</FieldLabel>
												<InputGroup>
													<InputGroupAddon align="inline-start">
														<Mail
															className="h-4 w-4"
															style={{
																color:
																	"oklch(from var(--foreground) l c h / 0.4)",
															}}
														/>
													</InputGroupAddon>
													<InputGroupInput
														id={field.name}
														name={field.name}
														type="email"
														placeholder="you@smee.com.my"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														disabled={form.state.isSubmitting}
														aria-invalid={isInvalid}
														aria-describedby={isInvalid ? errorId : undefined}
														autoComplete="email"
														autoFocus
														className="h-11 text-[14px]"
													/>
												</InputGroup>
												{isInvalid && (
													<FieldError
														id={errorId}
														errors={field.state.meta.errors}
													/>
												)}
											</Field>
										);
									}}
								</form.Field>

								{/* ── Password ── */}
								<form.Field name="password">
									{(field) => {
										const isInvalid =
											field.state.meta.isDirty && !field.state.meta.isValid;
										const errorId = `${field.name}-error`;
										return (
											<Field data-invalid={isInvalid}>
												<div className="flex items-center justify-between gap-3">
													<FieldLabel
														htmlFor={field.name}
														className="text-[13px] font-semibold"
													>
														Password
													</FieldLabel>
													<Link
														to="/forgot-password"
														className="text-[12px] underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 rounded-sm"
														style={{
															color: "var(--dashboard-accent)",
														}}
													>
														Forgot password?
													</Link>
												</div>
												<InputGroup>
													<InputGroupAddon align="inline-start">
														<Lock
															className="h-4 w-4"
															style={{
																color:
																	"oklch(from var(--foreground) l c h / 0.4)",
															}}
														/>
													</InputGroupAddon>
													<InputGroupInput
														id={field.name}
														name={field.name}
														type={showPassword ? "text" : "password"}
														placeholder="Enter your password"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														disabled={form.state.isSubmitting}
														aria-invalid={isInvalid}
														aria-describedby={isInvalid ? errorId : undefined}
														autoComplete="current-password"
														className="h-11 text-[14px]"
													/>
													<InputGroupAddon align="inline-end">
														<InputGroupButton
															type="button"
															onClick={() => setShowPassword(!showPassword)}
															aria-label={
																showPassword ? "Hide password" : "Show password"
															}
															disabled={form.state.isSubmitting}
															variant="ghost"
															size="icon-xs"
														>
															{showPassword ? (
																<EyeOff className="h-4 w-4" />
															) : (
																<Eye className="h-4 w-4" />
															)}
														</InputGroupButton>
													</InputGroupAddon>
												</InputGroup>
												{isInvalid && (
													<FieldError
														id={errorId}
														errors={field.state.meta.errors}
													/>
												)}
											</Field>
										);
									}}
								</form.Field>
							</FieldGroup>

							{/* ── Server-side error ── */}
							<div aria-live="polite" aria-atomic="true">
								{error && (
									<div
										role="alert"
										className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] animate-in fade-in-0 slide-in-from-top-1 duration-150"
										style={{
											background: "oklch(from var(--destructive) l c h / 0.08)",
											border:
												"1px solid oklch(from var(--destructive) l c h / 0.25)",
											color: "var(--destructive)",
										}}
									>
										<AlertCircle className="mt-px h-4 w-4 shrink-0" />
										<span>{error}</span>
									</div>
								)}
							</div>

							{/* ── Submit button ── */}
							<form.Subscribe
								selector={(state) => [state.isSubmitting, state.canSubmit]}
							>
								{([isSubmitting, canSubmit]) => (
									<Button
										type="submit"
										form="login-form"
										className="h-11 w-full gap-2 text-[14px] font-semibold rounded-xl transition-all duration-200"
										disabled={isSubmitting || !canSubmit}
										aria-busy={isSubmitting}
										style={{
											background:
												canSubmit && !isSubmitting
													? "var(--dashboard-accent)"
													: undefined,
											color:
												canSubmit && !isSubmitting
													? "oklch(0.145 0 0)"
													: undefined,
										}}
									>
										{isSubmitting ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />
												<span>Signing in…</span>
											</>
										) : (
											<span>Sign in</span>
										)}
									</Button>
								)}
							</form.Subscribe>
						</form>
					</div>

					{/* Footer hint */}
					<p
						className="text-center text-[12px]"
						style={{ color: "oklch(from var(--foreground) l c h / 0.3)" }}
					>
						Need help? Contact your system administrator.
					</p>
				</div>
			</main>
		</div>
	);
}
