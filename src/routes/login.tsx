import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { authenticateUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
});

const formSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

function RouteComponent() {
	const navigate = useNavigate();
	const { login } = useAuth();
	const [error, setError] = useState<string>("");
	const [showPassword, setShowPassword] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onBlur: formSchema,
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				const user = authenticateUser(value.email, value.password);
				if (user) {
					login(user);
					navigate({ to: "/admin/dashboard" });
				} else {
					setError("Invalid email or password");
				}
			} catch (err) {
				setError("An error occurred during login");
			}
		},
	});

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
			<Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
				<CardHeader className="space-y-1 pb-6">
					<CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-slate-800 bg-clip-text text-transparent">
						SME Ederan WMS
					</CardTitle>
					<CardDescription className="text-center text-base">
						Enter your credentials to access the warehouse system
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						id="login-form"
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<FieldGroup>
							<form.Field
								name="email"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Email</FieldLabel>
											<InputGroup>
												<InputGroupAddon align="inline-start">
													<Mail className="h-4 w-4" />
												</InputGroupAddon>
												<InputGroupInput
													id={field.name}
													name={field.name}
													type="email"
													placeholder="admin@smee.com.my"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													// disabled={form.state.isSubmitting}
													aria-invalid={isInvalid}
													autoComplete="email"
												/>
											</InputGroup>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
							<form.Field
								name="password"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<div className="flex items-center justify-between">
												<FieldLabel htmlFor={field.name}>Password</FieldLabel>
												<Link
													to="/forgot-password"
													className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors font-medium"
												>
													Forgot password?
												</Link>
											</div>
											<InputGroup>
												<InputGroupAddon align="inline-start">
													<Lock className="h-4 w-4" />
												</InputGroupAddon>
												<InputGroupInput
													id={field.name}
													name={field.name}
													type={showPassword ? "text" : "password"}
													placeholder="Enter your password"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													// disabled={form.state.isSubmitting}
													aria-invalid={isInvalid}
													autoComplete="current-password"
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
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
						</FieldGroup>

						{error && (
							<Alert
								variant="destructive"
								className="mt-4 animate-in fade-in-0 slide-in-from-top-2"
							>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<form.Subscribe
							selector={(state) => [state.isSubmitting, state.canSubmit]}
						>
							{([isSubmitting, canSubmit]) => (
								<Button
									type="submit"
									form="login-form"
									className="w-full mt-6 h-10 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200"
									disabled={isSubmitting || !canSubmit}
								>
									{isSubmitting ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Signing in...
										</>
									) : (
										"Sign in"
									)}
								</Button>
							)}
						</form.Subscribe>
					</form>

					<div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm">
						<p className="font-semibold mb-3 text-foreground">Demo accounts:</p>
						<ul className="space-y-2">
							<li className="flex items-start gap-2">
								<span className="text-muted-foreground">👤</span>
								<span className="text-muted-foreground">
									<span className="font-medium text-foreground">Admin:</span>{" "}
									admin@smee.com.my / demo123
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-muted-foreground">👤</span>
								<span className="text-muted-foreground">
									<span className="font-medium text-foreground">Finance:</span>{" "}
									finance@smee.com.my / demo123
								</span>
							</li>
						</ul>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
