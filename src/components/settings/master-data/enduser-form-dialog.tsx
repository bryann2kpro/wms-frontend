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

export interface EndUserFormValues {
	userName: string;
}

export function EndUserFormDialog({
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
	initial?: EndUserFormValues;
	onSubmit: (v: EndUserFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [userName, setUserName] = useState(initial?.userName ?? "");

	useEffect(() => {
		if (open) {
			setUserName(initial?.userName ?? "");
		}
	}, [open, initial?.userName]);

	const handleOpenChange = (next: boolean) => {
		if (!next) setUserName(initial?.userName ?? "");
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
						<Label htmlFor="user-name" style={{ fontFamily: '"Figtree", sans-serif' }}>
							User Name
						</Label>
						<Input
							id="user-name"
							value={userName}
							onChange={(e) => setUserName(e.target.value)}
							placeholder="Enter user name"
							className="rounded-lg border-muted-foreground/20"
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
						disabled={!userName.trim() || loading}
						onClick={() => onSubmit({ userName: userName.trim() })}
						className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
