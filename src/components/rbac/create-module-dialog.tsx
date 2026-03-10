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
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";

// Create Module Dialog Component
interface CreateModuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: CreateModuleInput) => void;
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

		onSubmit({
			moduleName: moduleName.trim(),
			status,
			createdBy: currentUserIdentifier,
			updatedBy: currentUserIdentifier,
		});
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
			setModuleName("");
			setStatus("active");
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
