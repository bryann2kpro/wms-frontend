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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Region } from "@/lib/graphql/types";

export interface OutletFormValues {
	outletName: string;
	outletCode: string;
	regionId?: string;
}

export function OutletFormDialog({
	open,
	onOpenChange,
	regions,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	regions: Region[];
	initial?: OutletFormValues;
	onSubmit: (v: OutletFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [outletName, setOutletName] = useState(initial?.outletName ?? "");
	const [outletCode, setOutletCode] = useState(initial?.outletCode ?? "");
	const [regionId, setRegionId] = useState<string>(initial?.regionId ?? "");

	useEffect(() => {
		if (open) {
			setOutletName(initial?.outletName ?? "");
			setOutletCode(initial?.outletCode ?? "");
			setRegionId(initial?.regionId ?? "");
		}
	}, [open, initial?.outletName, initial?.outletCode, initial?.regionId]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setOutletName(initial?.outletName ?? "");
			setOutletCode(initial?.outletCode ?? "");
			setRegionId(initial?.regionId ?? "");
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
							htmlFor="outlet-code"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Code
						</Label>
						<Input
							id="outlet-code"
							value={outletCode}
							onChange={(e) => setOutletCode(e.target.value)}
							placeholder="e.g. OUT001"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="outlet-name"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Name
						</Label>
						<Input
							id="outlet-name"
							value={outletName}
							onChange={(e) => setOutletName(e.target.value)}
							placeholder="Outlet name"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Region (optional)
						</Label>
						<Select
							value={regionId || "none"}
							onValueChange={(v) => setRegionId(v === "none" ? "" : v)}
						>
							<SelectTrigger className="rounded-lg border-muted-foreground/20">
								<SelectValue placeholder="Unassigned" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Unassigned</SelectItem>
								{regions.map((r) => (
									<SelectItem key={r.regionId} value={r.regionId}>
										{r.regionName} ({r.regionCode})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
						disabled={!outletName.trim() || !outletCode.trim() || loading}
						onClick={() =>
							onSubmit({
								outletName: outletName.trim(),
								outletCode: outletCode.trim(),
								regionId: regionId || undefined,
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
