import type { CreateModuleInput } from "@/lib/rbac";
import { useState } from "react";
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

// Create Module Dialog Component
interface CreateModuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (
		input: CreateModuleInput,
		addPermissionTypes: Array<(typeof AVAILABLE_PERMISSION_TYPES)[number]>,
	) => void;
	isSubmitting: boolean;
	error: Error | null;
	currentUserIdentifier: string;
}

function CreateModuleDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting,
	error,
	currentUserIdentifier,
}: CreateModuleDialogProps) {
	const [moduleName, setModuleName] = useState("");
	const [status, setStatus] = useState<"active" | "inactive">("active");
	const [addPermissionTypes, setAddPermissionTypes] = useState<
		Array<(typeof AVAILABLE_PERMISSION_TYPES)[number]>
	>([]);
	const [validationErrors, setValidationErrors] = useState<
		Record<string, string>
	>({});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const errors: Record<string, string> = {};

		if (!moduleName.trim()) {
			errors.moduleName = "Module name is required";
		}

		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}

		onSubmit(
			{
				moduleName: moduleName.trim(),
				status,
				createdBy: currentUserIdentifier,
				updatedBy: currentUserIdentifier,
			},
			addPermissionTypes,
		);
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
			setModuleName("");
			setStatus("active");
			setAddPermissionTypes([]);
			setValidationErrors({});
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create New Module</DialogTitle>
					<DialogDescription>
						Add a new module to the system. Permissions can be configured after
						creation.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="moduleName">Module Name *</Label>
							<Input
								id="moduleName"
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
							<Label htmlFor="status">Status</Label>
							<Select
								value={status}
								onValueChange={(value) =>
									setStatus(value as "active" | "inactive")
								}
								disabled={isSubmitting}
							>
								<SelectTrigger id="status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Permission Types</Label>
							<div className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-3">
								{AVAILABLE_PERMISSION_TYPES.map((type) => {
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
							<p className="text-xs text-muted-foreground">
								Selected permission types will be ensured after module creation.
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
									Creating...
								</>
							) : (
								"Create Module"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export { CreateModuleDialog, type CreateModuleDialogProps };
