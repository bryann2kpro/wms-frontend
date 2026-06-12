import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	fetchCustomerPriorities,
	reorderCustomerPriorities,
	upsertCustomerPriority,
} from "@/data/customer-priority";
import { qk } from "@/lib/api/query-keys";
import type { CustomerPriority } from "@/lib/graphql/customer-priority";
import { cn, getErrorMessage } from "@/lib/utils";

export function CustomerPriorityRanking({ className }: { className?: string }) {
	const queryClient = useQueryClient();
	const [ordered, setOrdered] = useState<CustomerPriority[]>([]);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [newCode, setNewCode] = useState("");
	const [newName, setNewName] = useState("");

	const { data, isLoading } = useQuery({
		queryKey: qk.customerPriorities.all,
		queryFn: fetchCustomerPriorities,
	});

	useEffect(() => {
		if (data) {
			setOrdered([...data].sort((a, b) => a.rank - b.rank));
		}
	}, [data]);

	const reorderMutation = useMutation({
		mutationFn: (ranking: Array<{ customerCode: string }>) =>
			reorderCustomerPriorities(ranking),
		onSuccess: (rows) => {
			setOrdered([...rows].sort((a, b) => a.rank - b.rank));
			queryClient.invalidateQueries({ queryKey: qk.customerPriorities.all });
			toast.success("Customer priority order saved");
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const addMutation = useMutation({
		mutationFn: upsertCustomerPriority,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: qk.customerPriorities.all });
			setAddOpen(false);
			setNewCode("");
			setNewName("");
			toast.success("Customer priority added");
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const persistOrder = useCallback(
		(next: CustomerPriority[]) => {
			setOrdered(next);
			reorderMutation.mutate(next.map((row) => ({ customerCode: row.customerCode })));
		},
		[reorderMutation],
	);

	const handleDrop = (targetIndex: number) => {
		if (dragIndex == null || dragIndex === targetIndex) return;
		const next = [...ordered];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(targetIndex, 0, moved);
		setDragIndex(null);
		persistOrder(next);
	};

	return (
		<Card className={cn(className)}>
			<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
				<div>
					<CardTitle>Customer priority</CardTitle>
					<CardDescription>
						Drag to reorder who gets reserved stock first (1 = highest).
					</CardDescription>
				</div>
				<Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
					<Plus className="mr-1 h-4 w-4" />
					Add customer
				</Button>
			</CardHeader>
			<CardContent className="max-h-[min(40vh,16rem)] overflow-y-auto xl:max-h-[min(52vh,22rem)]">
				{isLoading ? (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : ordered.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No customer priorities yet. Add ES, LH, UAB, etc.
					</p>
				) : (
					<ul className="space-y-2">
						{ordered.map((row, index) => (
							<li
								key={row.id}
								draggable
								onDragStart={() => setDragIndex(index)}
								onDragOver={(e) => e.preventDefault()}
								onDrop={() => handleDrop(index)}
								className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 cursor-grab active:cursor-grabbing"
							>
								<GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
								<span className="font-mono text-sm w-6 text-muted-foreground">
									{index + 1}.
								</span>
								<span className="font-medium">{row.customerCode}</span>
								{row.customerName ? (
									<span className="text-sm text-muted-foreground">
										{row.customerName}
									</span>
								) : null}
							</li>
						))}
					</ul>
				)}
			</CardContent>

			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add customer priority</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label htmlFor="cp-code">Customer code</Label>
							<Input
								id="cp-code"
								placeholder="ES"
								value={newCode}
								onChange={(e) => setNewCode(e.target.value.toUpperCase())}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="cp-name">Display name (optional)</Label>
							<Input
								id="cp-name"
								placeholder="Econsave"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAddOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={!newCode.trim() || addMutation.isPending}
							onClick={() =>
								addMutation.mutate({
									customerCode: newCode.trim(),
									customerName: newName.trim() || null,
								})
							}
						>
							Add
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
