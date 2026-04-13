import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "../ui/select";
import { Button } from "../ui/button";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import type { RbacModule } from "@/lib/rbac";
import type { UpdateModuleInput } from "@/lib/rbac";

const AVAILABLE_PERMISSION_TYPES = [
	"Read",
	"Create",
	"Update",
	"Delete",
	"Approve",
] as const;

const PERMISSION_TYPE_HINTS: Record<
	(typeof AVAILABLE_PERMISSION_TYPES)[number],
	string
> = {
	Read: "View module data",
	Create: "Add new records",
	Update: "Edit existing records",
	Delete: "Remove records",
	Approve: "Approve workflow actions",
};

// Edit Module Dialog Component
interface EditModuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	module: RbacModule | null;
	onSubmit: (
		input: UpdateModuleInput,
		addPermissionTypes: Array<(typeof AVAILABLE_PERMISSION_TYPES)[number]>,
	) => void;
	isSubmitting: boolean;
	error: Error | null;
	currentUserIdentifier: string;
}

function EditModuleDialog({
	open,
	onOpenChange,
	module,
	onSubmit,
	isSubmitting,
	error,
	currentUserIdentifier,
}: EditModuleDialogProps) {
	const [moduleName, setModuleName] = useState("");
	const [status, setStatus] = useState<"active" | "inactive">("active");
	const [addPermissionTypes, setAddPermissionTypes] = useState<
		Array<(typeof AVAILABLE_PERMISSION_TYPES)[number]>
	>([]);
	const [validationErrors, setValidationErrors] = useState<
		Record<string, string>
	>({});

	// Update form when selected module changes
	useEffect(() => {
		if (!module) return;
		setModuleName(module.moduleName);
		setStatus(module.status);
		setAddPermissionTypes([]);
		setValidationErrors({});
	}, [module]);

	// Reset form when dialog opens with a module
	const handleOpenChange = (newOpen: boolean) => {
		if (newOpen && module) {
			setModuleName(module.moduleName);
			setStatus(module.status);
			setAddPermissionTypes([]);
			setValidationErrors({});
		}
		onOpenChange(newOpen);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!module) return;

		const errors: Record<string, string> = {};

		if (!moduleName.trim()) {
			errors.moduleName = "Module name is required";
		}

		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}

		// Get moduleId from the first permission (since module doesn't have its own ID in the response)
		const moduleId = module.permission[0]?.moduleId;
		if (!moduleId) {
			setValidationErrors({
				moduleName: "Unable to identify module for update",
			});
			return;
		}

		onSubmit(
			{
				moduleId,
				moduleName: moduleName.trim(),
				status,
				updatedBy: currentUserIdentifier,
			},
			addPermissionTypes,
		);
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
			setValidationErrors({});
		}
	};

	if (!module) return null;
	const existingPermissionTypes = new Set(
		module.permission.map((p) => p.permissionType),
	);
	const addablePermissionTypes = AVAILABLE_PERMISSION_TYPES.filter(
		(type) => !existingPermissionTypes.has(type),
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Edit Module</DialogTitle>
					<DialogDescription>
						Update the module details. Changes will be applied immediately.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-moduleName">Module Name *</Label>
							<Input
								id="edit-moduleName"
								placeholder="Enter module name"
								value={moduleName}
								onChange={(e) => {
									setModuleName(e.target.value);
									if (validationErrors.moduleName) {
										setValidationErrors({
											...validationErrors,
											moduleName: "",
										});
									}
								}}
								disabled={isSubmitting}
								aria-invalid={!!validationErrors.moduleName}
							/>
							{validationErrors.moduleName && (
								<p className="text-sm text-destructive">
									{validationErrors.moduleName}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-status">Status</Label>
							<Select
								value={status}
								onValueChange={(value) =>
									setStatus(value as "active" | "inactive")
								}
								disabled={isSubmitting}
							>
								<SelectTrigger id="edit-status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Add Permission Types</Label>
							{addablePermissionTypes.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									All standard permission types are already configured for this
									module.
								</p>
							) : (
								<div className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-3">
									{addablePermissionTypes.map((type) => {
										const checked = addPermissionTypes.includes(type);
										return (
											<label
												key={type}
												className={`group flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 transition-colors ${
													checked
														? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
														: "border-border bg-background hover:bg-muted/50"
												} ${isSubmitting ? "opacity-70" : ""}`}
											>
												<div className="flex min-w-0 items-start gap-2.5">
													<span
														className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
															checked
																? "bg-amber-500 text-white"
																: "bg-muted text-muted-foreground group-hover:bg-amber-100 group-hover:text-amber-700 dark:group-hover:bg-amber-950 dark:group-hover:text-amber-300"
														}`}
													>
														{checked ? (
															<CheckCircle2
																className="h-3.5 w-3.5"
																aria-hidden="true"
															/>
														) : (
															<ShieldCheck
																className="h-3.5 w-3.5"
																aria-hidden="true"
															/>
														)}
													</span>
													<span className="min-w-0">
														<span className="block text-sm font-medium text-foreground">
															{type}
														</span>
														<span className="block text-xs text-muted-foreground">
															{PERMISSION_TYPE_HINTS[type]}
														</span>
													</span>
												</div>
												<input
													type="checkbox"
													checked={checked}
													onChange={(e) => {
														if (e.target.checked) {
															setAddPermissionTypes((prev) => [...prev, type]);
															return;
														}
														setAddPermissionTypes((prev) =>
															prev.filter((v) => v !== type),
														);
													}}
													disabled={isSubmitting}
													className="h-4 w-4 accent-amber-600"
												/>
											</label>
										);
									})}
								</div>
							)}
							<p className="text-xs text-muted-foreground">
								Selected types will be added when you update this module.
							</p>
						</div>

						{error && (
							<div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
								{getErrorMessage(error)}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={isSubmitting}
							className="rounded-lg border-border/70 bg-background hover:bg-[var(--dashboard-accent-muted)]/35"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting}
							className="rounded-lg text-white shadow-sm hover:opacity-90"
							style={{
								background: "var(--dashboard-accent)",
								borderColor: "var(--dashboard-accent)",
							}}
						>
							{isSubmitting ? (
								<>
									<Loader2
										className="mr-2 h-4 w-4 animate-spin"
										aria-hidden="true"
									/>
									Updating...
								</>
							) : (
								"Update Module"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export { EditModuleDialog, type EditModuleDialogProps };
