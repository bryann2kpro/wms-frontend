import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export interface StockUnitFormValues {
	unitName: string;
	unitCode: string;
	isActive?: boolean;
}

export function StockUnitFormDialog({
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
	initial?: StockUnitFormValues;
	onSubmit: (v: StockUnitFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [unitName, setUnitName] = useState(initial?.unitName ?? "");
	const [unitCode, setUnitCode] = useState(initial?.unitCode ?? "");
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);

	useEffect(() => {
		if (open) {
			setUnitName(initial?.unitName ?? "");
			setUnitCode(initial?.unitCode ?? "");
			setIsActive(initial?.isActive ?? true);
		}
	}, [open, initial?.unitName, initial?.unitCode, initial?.isActive]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setUnitName(initial?.unitName ?? "");
			setUnitCode(initial?.unitCode ?? "");
			setIsActive(initial?.isActive ?? true);
		}
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
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label
							htmlFor="unit-code"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Code
						</Label>
						<Input
							id="unit-code"
							value={unitCode}
							onChange={(e) => setUnitCode(e.target.value)}
							placeholder="e.g. EA, KG, CTN"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="unit-name"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Name
						</Label>
						<Input
							id="unit-name"
							value={unitName}
							onChange={(e) => setUnitName(e.target.value)}
							placeholder="Unit name"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label
							htmlFor="unit-active"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Active
						</Label>
						<Switch
							id="unit-active"
							checked={isActive}
							onCheckedChange={setIsActive}
						/>
					</div>
				</div>
				<DialogFooter className="border-t bg-muted/20">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						disabled={!unitName.trim() || !unitCode.trim() || loading}
						onClick={() =>
							onSubmit({
								unitName: unitName.trim(),
								unitCode: unitCode.trim(),
								isActive,
							})
						}
						className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
