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
import type { Transport } from "@/lib/graphql/types";

export type TransportFormValues = {
	code: string;
	description: string;
	storageBinId: string;
	location: string;
	minLengthMm: string;
	minWidthMm: string;
	minHeightMm: string;
	minWeightKg: string;
	maxLengthMm: string;
	maxWidthMm: string;
	maxHeightMm: string;
	maxWeightKg: string;
	numberOfPallets: string;
};

const EMPTY_VALUES: TransportFormValues = {
	code: "",
	description: "",
	storageBinId: "",
	location: "",
	minLengthMm: "",
	minWidthMm: "",
	minHeightMm: "",
	minWeightKg: "",
	maxLengthMm: "",
	maxWidthMm: "",
	maxHeightMm: "",
	maxWeightKg: "",
	numberOfPallets: "",
};

function transportToFormValues(transport?: Transport | null): TransportFormValues {
	if (!transport) return { ...EMPTY_VALUES };
	return {
		code: transport.code ?? "",
		description: transport.description ?? "",
		storageBinId: transport.storageBinId ?? "",
		location: transport.location ?? "",
		minLengthMm: transport.minLengthMm ?? "",
		minWidthMm: transport.minWidthMm ?? "",
		minHeightMm: transport.minHeightMm ?? "",
		minWeightKg: transport.minWeightKg ?? "",
		maxLengthMm: transport.maxLengthMm ?? "",
		maxWidthMm: transport.maxWidthMm ?? "",
		maxHeightMm: transport.maxHeightMm ?? "",
		maxWeightKg: transport.maxWeightKg ?? "",
		numberOfPallets: transport.numberOfPallets != null ? String(transport.numberOfPallets) : "",
	};
}

function optionalField(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed || undefined;
}

export function toCreateTransportInput(
	values: TransportFormValues,
	userId: string,
) {
	return {
		code: values.code.trim(),
		description: optionalField(values.description),
		storageBinId: optionalField(values.storageBinId),
		location: optionalField(values.location),
		minLengthMm: optionalField(values.minLengthMm),
		minWidthMm: optionalField(values.minWidthMm),
		minHeightMm: optionalField(values.minHeightMm),
		minWeightKg: optionalField(values.minWeightKg),
		maxLengthMm: optionalField(values.maxLengthMm),
		maxWidthMm: optionalField(values.maxWidthMm),
		maxHeightMm: optionalField(values.maxHeightMm),
		maxWeightKg: optionalField(values.maxWeightKg),
		numberOfPallets: values.numberOfPallets.trim() ? Number(values.numberOfPallets) : undefined,
		createdBy: userId,
		updatedBy: userId,
	};
}

export function toUpdateTransportInput(
	values: TransportFormValues,
	userId: string,
) {
	return {
		code: values.code.trim(),
		description: optionalField(values.description),
		storageBinId: optionalField(values.storageBinId),
		location: optionalField(values.location),
		minLengthMm: optionalField(values.minLengthMm),
		minWidthMm: optionalField(values.minWidthMm),
		minHeightMm: optionalField(values.minHeightMm),
		minWeightKg: optionalField(values.minWeightKg),
		maxLengthMm: optionalField(values.maxLengthMm),
		maxWidthMm: optionalField(values.maxWidthMm),
		maxHeightMm: optionalField(values.maxHeightMm),
		maxWeightKg: optionalField(values.maxWeightKg),
		numberOfPallets: values.numberOfPallets.trim() ? Number(values.numberOfPallets) : undefined,
		updatedBy: userId,
	};
}

type TransportFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: Transport | null;
	onSubmit: (values: TransportFormValues) => void;
	loading?: boolean;
	title: string;
	description: string;
};

export function TransportFormDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	loading = false,
	title,
	description,
}: TransportFormDialogProps) {
	const [values, setValues] = useState<TransportFormValues>(() =>
		transportToFormValues(initial),
	);

	useEffect(() => {
		if (open) {
			setValues(transportToFormValues(initial));
		}
	}, [open, initial]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setValues(transportToFormValues(initial));
		}
		onOpenChange(next);
	};

	const setField = <K extends keyof TransportFormValues>(
		key: K,
		value: TransportFormValues[K],
	) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="w-[min(96vw,720px)] max-w-[720px] max-h-[90vh] overflow-y-auto rounded-2xl">
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
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="grid gap-2 sm:col-span-2">
							<Label htmlFor="transport-code">Code *</Label>
							<Input
								id="transport-code"
								value={values.code}
								onChange={(e) => setField("code", e.target.value)}
								placeholder="e.g. TRUCK-01"
							/>
						</div>
						<div className="grid gap-2 sm:col-span-2">
							<Label htmlFor="transport-description">Description</Label>
							<Textarea
								id="transport-description"
								value={values.description}
								onChange={(e) => setField("description", e.target.value)}
								placeholder="Optional description"
								rows={2}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="transport-location">Location</Label>
							<Input
								id="transport-location"
								value={values.location}
								onChange={(e) => setField("location", e.target.value)}
								placeholder="e.g. Bay A"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="transport-storage-bin">Storage Bin</Label>
							<Input
								id="transport-storage-bin"
								value={values.storageBinId}
								onChange={(e) => setField("storageBinId", e.target.value)}
								placeholder="e.g. BIN-01"
							/>
						</div>
					</div>

					<div className="space-y-3">
						<p className="text-sm font-medium text-muted-foreground">
							Minimum dimensions
						</p>
						<div className="grid gap-4 sm:grid-cols-4">
							<div className="grid gap-2">
								<Label htmlFor="min-length">Length (mm)</Label>
								<Input
									id="min-length"
									type="number"
									min={0}
									value={values.minLengthMm}
									onChange={(e) => setField("minLengthMm", e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="min-width">Width (mm)</Label>
								<Input
									id="min-width"
									type="number"
									min={0}
									value={values.minWidthMm}
									onChange={(e) => setField("minWidthMm", e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="min-height">Height (mm)</Label>
								<Input
									id="min-height"
									type="number"
									min={0}
									value={values.minHeightMm}
									onChange={(e) => setField("minHeightMm", e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="min-weight">Weight (kg)</Label>
								<Input
									id="min-weight"
									type="number"
									min={0}
									step="0.001"
									value={values.minWeightKg}
									onChange={(e) => setField("minWeightKg", e.target.value)}
								/>
							</div>
						</div>
					</div>

					<div className="space-y-3">
						<p className="text-sm font-medium text-muted-foreground">
							Maximum dimensions
						</p>
						<div className="grid gap-4 sm:grid-cols-4">
							<div className="grid gap-2">
								<Label htmlFor="max-length">Length (mm)</Label>
								<Input
									id="max-length"
									type="number"
									min={0}
									value={values.maxLengthMm}
									onChange={(e) => setField("maxLengthMm", e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="max-width">Width (mm)</Label>
								<Input
									id="max-width"
									type="number"
									min={0}
									value={values.maxWidthMm}
									onChange={(e) => setField("maxWidthMm", e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="max-height">Height (mm)</Label>
								<Input
									id="max-height"
									type="number"
									min={0}
									value={values.maxHeightMm}
									onChange={(e) => setField("maxHeightMm", e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="max-weight">Weight (kg)</Label>
								<Input
									id="max-weight"
									type="number"
									min={0}
									step="0.001"
									value={values.maxWeightKg}
									onChange={(e) => setField("maxWeightKg", e.target.value)}
								/>
							</div>
						</div>
					</div>

					<div className="grid gap-2 sm:w-1/4">
						<Label htmlFor="number-of-pallets">Number of Pallets</Label>
						<Input
							id="number-of-pallets"
							type="number"
							min={0}
							step={1}
							value={values.numberOfPallets}
							onChange={(e) => setField("numberOfPallets", e.target.value)}
							placeholder="e.g. 10"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!values.code.trim() || loading}
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
