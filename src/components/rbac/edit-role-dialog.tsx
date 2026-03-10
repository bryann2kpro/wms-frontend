import { useState, useEffect } from "react";
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
import { Loader2, AlertCircle } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import type { RbacRole, UpdateRoleInput } from "@/lib/rbac";

// Edit Role Dialog Component
interface EditRoleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	role: RbacRole | null;
	onSubmit: (input: UpdateRoleInput) => void;
	isSubmitting: boolean;
	error: Error | null;
	currentUserIdentifier: string;
}

function EditRoleDialog({
	open,
	onOpenChange,
	role,
	onSubmit,
	isSubmitting,
	error,
	currentUserIdentifier,
}: EditRoleDialogProps) {
	const [roleName, setRoleName] = useState("");
	const [status, setStatus] = useState<"active" | "inactive">("active");
	const [validationErrors, setValidationErrors] = useState<
		Record<string, string>
	>({});

	// Reset form when dialog opens with a role
	useEffect(() => {
		if (open && role) {
			setRoleName(role.roleName);
			setStatus(role.status);
			setValidationErrors({});
		}
	}, [open, role]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!role) return;

		const errors: Record<string, string> = {};

		if (!roleName.trim()) {
			errors.roleName = "Role name is required";
		}

		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}

		onSubmit({
			roleId: role.roleId,
			roleName: roleName.trim(),
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

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen && isSubmitting) return;
		onOpenChange(newOpen);
		if (!newOpen) {
			setValidationErrors({});
		}
	};

	if (!role) return null;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="sm:max-w-[425px]"
				aria-describedby="edit-role-description"
			>
				<DialogHeader>
					<DialogTitle>Edit Role</DialogTitle>
					<DialogDescription id="edit-role-description">
						Update the role details. Changes will be applied immediately.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-roleName">Role Name *</Label>
							<Input
								id="edit-roleName"
								placeholder="Enter role name"
								value={roleName}
								onChange={(e) => {
									setRoleName(e.target.value);
									if (validationErrors.roleName) {
										setValidationErrors({ ...validationErrors, roleName: "" });
									}
								}}
								disabled={isSubmitting}
								aria-invalid={!!validationErrors.roleName}
								aria-describedby={
									validationErrors.roleName ? "edit-roleName-error" : undefined
								}
							/>
							{validationErrors.roleName && (
								<p
									id="edit-roleName-error"
									className="text-sm text-destructive flex items-center gap-1"
									role="alert"
								>
									<AlertCircle className="h-3 w-3" aria-hidden="true" />
									{validationErrors.roleName}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-role-status">Status</Label>
							<Select
								value={status}
								onValueChange={(value) =>
									setStatus(value as "active" | "inactive")
								}
								disabled={isSubmitting}
							>
								<SelectTrigger
									id="edit-role-status"
									aria-label="Select role status"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{error && (
							<div
								className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2"
								role="alert"
								aria-live="polite"
							>
								<AlertCircle
									className="h-4 w-4 mt-0.5 flex-shrink-0"
									aria-hidden="true"
								/>
								<span>{getErrorMessage(error)}</span>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={isSubmitting}
							aria-label="Cancel editing role"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting}
							aria-label={isSubmitting ? "Updating role" : "Update role"}
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
								"Update Role"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export { EditRoleDialog, type EditRoleDialogProps };
