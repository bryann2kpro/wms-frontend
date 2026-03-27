import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday" },
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
] as const;

export const PAGE_SIZE = 10;

export function ConfirmDeleteDialog({
	open,
	onOpenChange,
	itemName,
	onConfirm,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	itemName: string;
	onConfirm: () => void;
	loading: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						Delete
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						Are you sure you want to delete &quot;{itemName}&quot;? This action
						cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="border-t bg-muted/20">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={loading}
						onClick={() => onConfirm()}
						className="rounded-lg"
					>
						{loading ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
