import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/login")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "Sign in — SME Ederan WMS" },
			{
				name: "description",
				content: "Sign in to access the SME Ederan Warehouse Management System.",
			},
		],
	}),
});

const formSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});


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
				navigate({ to: "/admin/dashboard" });
			} catch (err) {
				if (axios.isAxiosError(err)) {
					const message =
						(err.response?.data as { message?: string })?.message ||
						"Invalid email or password. Please try again.";
					setError(message);
				} else if (err instanceof Error) {
					setError(err.message);
				} else {
					setError("An unexpected error occurred. Please try again.");
				}
			}
		},
	});

	return (
		<div className="flex min-h-screen w-screen bg-background">
			{/* ── Brand panel (hidden on mobile) ── */}
			<aside
				aria-hidden="true"
				className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between bg-foreground text-primary-foreground p-10 shrink-0"
			>
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/10">
						<Package className="h-5 w-5 text-primary-foreground" />
					</div>
					<span className="text-base font-semibold tracking-tight">
						SME Ederan WMS
					</span>
				</div>

				<div className="space-y-4">
					<p className="text-[13px] text-primary-foreground/50 leading-relaxed">
						Warehouse Management System
					</p>
					<blockquote className="text-xl font-semibold leading-snug text-primary-foreground/90">
						"Visibility across every movement — from goods receipt to final
						delivery."
					</blockquote>
					<ul className="space-y-2 text-[13px] text-primary-foreground/60">
						<li className="flex items-center gap-2">
							<span className="h-1 w-1 rounded-full bg-primary-foreground/40" />
							Goods Receipt &amp; Transfer Orders
						</li>
						<li className="flex items-center gap-2">
							<span className="h-1 w-1 rounded-full bg-primary-foreground/40" />
							Delivery &amp; Proof of Delivery
						</li>
						<li className="flex items-center gap-2">
							<span className="h-1 w-1 rounded-full bg-primary-foreground/40" />
							Invoicing &amp; Settlement
						</li>
					</ul>
				</div>

				<p className="text-[11px] text-primary-foreground/30">
					© {new Date().getFullYear()} SME Ederan. All rights reserved.
				</p>
			</aside>

			{/* ── Sign-in panel ── */}
			<main
				role="main"
				className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-muted/30"
			>
				{/* Mobile logo */}
				<div className="mb-8 flex items-center gap-2 lg:hidden">
					<div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground">
						<Package className="h-4 w-4 text-primary-foreground" />
					</div>
					<span className="text-sm font-semibold text-foreground">
						SME Ederan WMS
					</span>
				</div>

				<div className="w-full max-w-[400px] space-y-6">
					{/* Page header */}
					<div className="space-y-1">
						<h1 className="text-[22px] font-semibold leading-tight text-foreground">
							Sign in
						</h1>
						<p className="text-[13px] text-muted-foreground">
							Enter your credentials to access the warehouse system.
						</p>
					</div>

					{/* Form card */}
					<div className="rounded-xl border border-border bg-card shadow-sm p-6">
						<form
							id="login-form"
							aria-label="Sign in form"
							onSubmit={(e) => {
								e.preventDefault();
								form.handleSubmit();
							}}
						>
							<FieldGroup className="gap-4">
								{/* Email */}
								<form.Field name="email">
									{(field) => {
										const isInvalid =
											field.state.meta.isDirty &&
											!field.state.meta.isValid;
										const errorId = `${field.name}-error`;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>
													Email address
												</FieldLabel>
												<InputGroup>
													<InputGroupAddon align="inline-start">
														<Mail className="h-4 w-4 text-muted-foreground" />
													</InputGroupAddon>
													<InputGroupInput
														id={field.name}
														name={field.name}
														type="email"
														placeholder="you@smee.com.my"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) =>
															field.handleChange(e.target.value)
														}
														disabled={form.state.isSubmitting}
														aria-invalid={isInvalid}
														aria-describedby={
															isInvalid ? errorId : undefined
														}
														autoComplete="email"
														autoFocus
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

								{/* Password */}
								<form.Field name="password">
									{(field) => {
										const isInvalid =
											field.state.meta.isDirty &&
											!field.state.meta.isValid;
										const errorId = `${field.name}-error`;
										return (
											<Field data-invalid={isInvalid}>
												<div className="flex items-center justify-between">
													<FieldLabel htmlFor={field.name}>
														Password
													</FieldLabel>
													<Link
														to="/forgot-password"
														className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
													>
														Forgot password?
													</Link>
												</div>
												<InputGroup>
													<InputGroupAddon align="inline-start">
														<Lock className="h-4 w-4 text-muted-foreground" />
													</InputGroupAddon>
													<InputGroupInput
														id={field.name}
														name={field.name}
														type={showPassword ? "text" : "password"}
														placeholder="Enter your password"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) =>
															field.handleChange(e.target.value)
														}
														disabled={form.state.isSubmitting}
														aria-invalid={isInvalid}
														aria-describedby={
															isInvalid ? errorId : undefined
														}
														autoComplete="current-password"
													/>
													<InputGroupAddon align="inline-end">
														<InputGroupButton
															type="button"
															onClick={() => setShowPassword(!showPassword)}
															aria-label={
																showPassword
																	? "Hide password"
																	: "Show password"
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

							{/* Server-side error */}
							<div
								aria-live="polite"
								aria-atomic="true"
								className="mt-4 min-h-0"
							>
								{error && (
									<div
										role="alert"
										className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-150"
									>
										<AlertCircle className="mt-px h-4 w-4 shrink-0" />
										<span>{error}</span>
									</div>
								)}
							</div>

							{/* Submit */}
							<form.Subscribe
								selector={(state) => [state.isSubmitting, state.canSubmit]}
							>
								{([isSubmitting, canSubmit]) => (
									<Button
										type="submit"
										form="login-form"
										className="w-full mt-5 h-10 text-sm font-medium"
										disabled={isSubmitting || !canSubmit}
										aria-busy={isSubmitting}
									>
										{isSubmitting ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />
												Signing in…
											</>
										) : (
											"Sign in"
										)}
									</Button>
								)}
							</form.Subscribe>
						</form>
					</div>
				</div>
			</main>
		</div>
	);
}
