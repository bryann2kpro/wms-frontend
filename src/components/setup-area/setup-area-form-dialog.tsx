import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SetupArea } from "@/lib/graphql/types";

export type SetupAreaFormValues = {
	code: string;
	description: string;
};

const EMPTY_VALUES: SetupAreaFormValues = {
	code: "",
	description: "",
};

function setupAreaToFormValues(area?: SetupArea | null): SetupAreaFormValues {
	if (!area) return { ...EMPTY_VALUES };
	return {
		code: area.code ?? "",
		description: area.description ?? "",
	};
}

export function toCreateSetupAreaInput(
	values: SetupAreaFormValues,
	userId: string,
) {
	return {
		code: values.code.trim(),
		description: values.description.trim(),
		createdBy: userId,
		updatedBy: userId,
	};
}

export function toUpdateSetupAreaInput(
	values: SetupAreaFormValues,
	userId: string,
) {
	return {
		code: values.code.trim(),
		description: values.description.trim(),
		updatedBy: userId,
	};
}

type SetupAreaFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: SetupArea | null;
	onSubmit: (values: SetupAreaFormValues) => void;
	loading?: boolean;
	title: string;
	description: string;
};

export function SetupAreaFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading = false,
	title,
	description,
}: SetupAreaFormDialogProps) {
	const [values, setValues] = useState<SetupAreaFormValues>(() =>
		setupAreaToFormValues(initial),
	);

	useEffect(() => {
		if (open) {
			setValues(setupAreaToFormValues(initial));
		}
	}, [open, initial]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setValues(setupAreaToFormValues(initial));
		}
		onOpenChange(next);
	};

	const isValid = values.code.trim().length > 0 && values.description.trim().length > 0;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="w-[min(96vw,480px)] max-w-[480px] rounded-2xl">
				<DialogHeader>
					<DialogTitle
						className="font-semibold"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						{title}
					</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-2">
					<div className="grid gap-2">
						<Label htmlFor="setup-area-code">Code *</Label>
						<Input
							id="setup-area-code"
							value={values.code}
							onChange={(e) =>
								setValues((prev) => ({ ...prev, code: e.target.value }))
							}
							placeholder="e.g. AMP"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="setup-area-description">Description *</Label>
						<Textarea
							id="setup-area-description"
							value={values.description}
							onChange={(e) =>
								setValues((prev) => ({ ...prev, description: e.target.value }))
							}
							placeholder="e.g. Ampang"
							rows={2}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!isValid || loading}
						onClick={() => onSubmit(values)}
						className="text-white"
						style={{
							background: "var(--dashboard-accent)",
							borderColor: "var(--dashboard-accent)",
						}}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
