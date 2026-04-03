import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	Lock,
	Eye,
	EyeOff,
	Loader2,
	AlertCircle,
	Package,
	CircleCheck,
	ArrowLeft,
} from "lucide-react";
import { resetPassword } from "@/lib/auth/auth-api";
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

export const Route = createFileRoute("/reset-password")({
	validateSearch: z.object({
		token: z.string().min(1),
	}),
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "Set new password — SME Edaran WMS" },
			{
				name: "description",
				content: "Set a new password for your SME Edaran WMS account.",
			},
		],
	}),
});

const formSchema = z
	.object({
		password: z.string().min(6, "Password must be at least 6 characters"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((d) => d.password === d.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

function RouteComponent() {
	const navigate = useNavigate();
	const { token } = Route.useSearch();
	const [error, setError] = useState<string>("");
	const [done, setDone] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const form = useForm({
		defaultValues: { password: "", confirmPassword: "" },
		validators: {
			onChange: formSchema,
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				await resetPassword(token, value.password);
				setDone(true);
			} catch (err) {
				if (axios.isAxiosError(err)) {
					const message =
						(err.response?.data as { message?: string })?.message ||
						"Something went wrong. Please try again.";
					setError(message);
				} else {
					setError("Something went wrong. Please try again.");
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
						SME Edaran WMS
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
					© {new Date().getFullYear()} SME Edaran. All rights reserved.
				</p>
			</aside>

			{/* ── Reset panel ── */}
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
						SME Edaran WMS
					</span>
				</div>

				<div className="w-full max-w-[400px] space-y-6">
					{done ? (
						/* ── Success state ── */
						<>
							<div className="space-y-1">
								<h1 className="text-[22px] font-semibold leading-tight text-foreground">
									Password updated
								</h1>
								<p className="text-[13px] text-muted-foreground">
									Your password has been reset successfully.
								</p>
							</div>

							<div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-4">
								<div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
									<CircleCheck className="mt-px h-4 w-4 shrink-0 text-foreground" />
									<p className="text-[13px] text-foreground leading-snug">
										You can now sign in with your new password.
									</p>
								</div>

								<Button
									className="w-full h-10 text-sm font-medium mt-2"
									onClick={() => navigate({ to: "/login" })}
								>
									Go to sign in
								</Button>
							</div>
						</>
					) : (
						/* ── New password form ── */
						<>
							<div className="space-y-1">
								<h1 className="text-[22px] font-semibold leading-tight text-foreground">
									Set new password
								</h1>
								<p className="text-[13px] text-muted-foreground">
									Choose a strong password for your account.
								</p>
							</div>

							<div className="rounded-xl border border-border bg-card shadow-sm p-6">
								<form
									id="reset-password-form"
									aria-label="Set new password form"
									onSubmit={(e) => {
										e.preventDefault();
										form.handleSubmit();
									}}
								>
									<FieldGroup className="gap-4">
										{/* New password */}
										<form.Field name="password">
											{(field) => {
												const isInvalid =
													field.state.meta.isDirty && !field.state.meta.isValid;
												const errorId = `${field.name}-error`;
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															New password
														</FieldLabel>
														<InputGroup>
															<InputGroupAddon align="inline-start">
																<Lock className="h-4 w-4 text-muted-foreground" />
															</InputGroupAddon>
															<InputGroupInput
																id={field.name}
																name={field.name}
																type={showPassword ? "text" : "password"}
																placeholder="At least 6 characters"
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
																autoComplete="new-password"
																autoFocus
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

										{/* Confirm password */}
										<form.Field name="confirmPassword">
											{(field) => {
												const isInvalid =
													field.state.meta.isDirty && !field.state.meta.isValid;
												const errorId = `${field.name}-error`;
												return (
													<Field data-invalid={isInvalid}>
														<FieldLabel htmlFor={field.name}>
															Confirm new password
														</FieldLabel>
														<InputGroup>
															<InputGroupAddon align="inline-start">
																<Lock className="h-4 w-4 text-muted-foreground" />
															</InputGroupAddon>
															<InputGroupInput
																id={field.name}
																name={field.name}
																type={showConfirm ? "text" : "password"}
																placeholder="Re-enter your password"
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
																autoComplete="new-password"
															/>
															<InputGroupAddon align="inline-end">
																<InputGroupButton
																	type="button"
																	onClick={() => setShowConfirm(!showConfirm)}
																	aria-label={
																		showConfirm
																			? "Hide password"
																			: "Show password"
																	}
																	disabled={form.state.isSubmitting}
																	variant="ghost"
																	size="icon-xs"
																>
																	{showConfirm ? (
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

									<form.Subscribe
										selector={(state) => [state.isSubmitting, state.canSubmit]}
									>
										{([isSubmitting, canSubmit]) => (
											<Button
												type="submit"
												form="reset-password-form"
												className="w-full mt-5 h-10 text-sm font-medium"
												disabled={isSubmitting || !canSubmit}
												aria-busy={isSubmitting}
											>
												{isSubmitting ? (
													<>
														<Loader2 className="h-4 w-4 animate-spin" />
														Saving…
													</>
												) : (
													"Set new password"
												)}
											</Button>
										)}
									</form.Subscribe>
								</form>
							</div>

							<div className="text-center">
								<Link
									to="/login"
									className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
								>
									<ArrowLeft className="h-3.5 w-3.5" />
									Back to sign in
								</Link>
							</div>
						</>
					)}
				</div>
			</main>
		</div>
	);
}
