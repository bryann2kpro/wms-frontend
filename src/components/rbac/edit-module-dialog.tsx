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
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import type { RbacModule } from "@/lib/rbac";
import type { UpdateModuleInput } from "@/lib/rbac";

// Edit Module Dialog Component
interface EditModuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	module: RbacModule | null;
	onSubmit: (input: UpdateModuleInput) => void;
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
	const [validationErrors, setValidationErrors] = useState<
		Record<string, string>
	>({});

	// Update form when module changes
	useState(() => {
		if (module) {
			setModuleName(module.moduleName);
			setStatus(module.status);
		}
	});

	// Reset form when dialog opens with a module
	const handleOpenChange = (newOpen: boolean) => {
		if (newOpen && module) {
			setModuleName(module.moduleName);
			setStatus(module.status);
			setValidationErrors({});
		}
		onOpenChange(newOpen);
	};

	// Also reset when module changes while dialog is open
	if (open && module && moduleName !== module.moduleName && !isSubmitting) {
		setModuleName(module.moduleName);
		setStatus(module.status);
	}

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

		onSubmit({
			moduleId,
			moduleName: moduleName.trim(),
			status,
			updatedBy: currentUserIdentifier,
		});
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
			setValidationErrors({});
		}
	};

	if (!module) return null;

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
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
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
