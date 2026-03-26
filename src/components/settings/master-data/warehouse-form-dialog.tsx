import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";

const warehouseFormSchema = z.object({
	warehouseName: z.string().min(1, "Warehouse name is required"),
	warehouseCode: z.string(),
	warehouseAddress: z.string(),
});

export interface WarehouseFormValues {
	warehouseName: string;
	warehouseCode: string;
	warehouseAddress: string;
}

export function WarehouseFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: WarehouseFormValues;
	onSubmit: (v: WarehouseFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const form = useForm({
		defaultValues: {
			warehouseName: initial?.warehouseName ?? "",
			warehouseCode: initial?.warehouseCode ?? "",
			warehouseAddress: initial?.warehouseAddress ?? "",
		},
		validators: {
			onBlur: warehouseFormSchema as any,
			onSubmit: warehouseFormSchema as any,
		},
		onSubmit: async ({ value }) => {
			onSubmit({
				warehouseName: value.warehouseName.trim(),
				warehouseCode: value.warehouseCode.trim(),
				warehouseAddress: value.warehouseAddress.trim(),
			});
		},
	});

	const handleOpenChange = (next: boolean) => {
		if (!next) form.reset();
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						{title}
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						{description}
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<FieldGroup>
						<form.Field
							name="warehouseName"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Warehouse Name</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											placeholder="Main Warehouse"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											className="rounded-lg border-muted-foreground/20"
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
						<form.Field
							name="warehouseCode"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Warehouse Code (optional)
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											placeholder="WH-001"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											className="rounded-lg border-muted-foreground/20"
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
						<form.Field
							name="warehouseAddress"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Warehouse Address (optional)
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											placeholder="123 Warehouse St, Industrial Park"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											className="rounded-lg border-muted-foreground/20"
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
					</FieldGroup>

					<DialogFooter className="gap-2 border-t bg-muted/20">
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							className="rounded-lg"
						>
							Cancel
						</Button>
						<form.Subscribe
							selector={(state) => [state.isSubmitting, state.canSubmit]}
						>
							{([isSubmitting, canSubmit]) => (
								<Button
									type="submit"
									disabled={loading || isSubmitting || !canSubmit}
									className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
								>
									{loading || isSubmitting ? "Saving..." : "Save"}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
