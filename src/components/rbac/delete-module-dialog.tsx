import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../ui/dialog";
import { AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import type { RbacModule } from "@/lib/rbac";
import type { UpdateModuleInput } from "@/lib/rbac";

// Delete (Deactivate) Module Dialog Component
interface DeleteModuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	module: RbacModule | null;
	onConfirm: (input: UpdateModuleInput) => void;
	isSubmitting: boolean;
	error: Error | null;
	currentUserIdentifier: string;
}

function DeleteModuleDialog({
	open,
	onOpenChange,
	module,
	onConfirm,
	isSubmitting,
	error,
	currentUserIdentifier,
}: DeleteModuleDialogProps) {
	const handleConfirm = () => {
		if (!module) return;

		// Get moduleId from the first permission
		const moduleId = module.permission[0]?.moduleId;
		if (!moduleId) return;

		onConfirm({
			moduleId,
			status: "inactive",
			updatedBy: currentUserIdentifier,
		});
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
		}
	};

	if (!module) return null;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Deactivate Module</DialogTitle>
					<DialogDescription>
						Are you sure you want to deactivate this module? This will set the
						module status to inactive.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
						<div className="flex items-start gap-3">
							<AlertCircle
								className="h-5 w-5 text-amber-600 mt-0.5"
								aria-hidden="true"
							/>
							<div>
								<p className="font-medium text-amber-800 dark:text-amber-200">
									Module: {module.moduleName}
								</p>
								<p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
									This module has {module.permission.length} permission
									{module.permission.length !== 1 ? "s" : ""} associated with
									it.
								</p>
							</div>
						</div>
					</div>

					{error && (
						<div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
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
					<Button
						type="button"
						variant="destructive"
						onClick={handleConfirm}
						disabled={isSubmitting}
					>
						{isSubmitting ? (
							<>
								<Loader2
									className="mr-2 h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
								Deactivating...
							</>
						) : (
							"Deactivate Module"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export { DeleteModuleDialog, type DeleteModuleDialogProps };
