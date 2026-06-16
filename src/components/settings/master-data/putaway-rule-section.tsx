import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	PUTAWAY_RULES_QUERY,
	CREATE_PUTAWAY_RULE_MUTATION,
	UPDATE_PUTAWAY_RULE_MUTATION,
	DELETE_PUTAWAY_RULE_MUTATION,
	type PutawayRulesQueryData,
	type PutawayRulesQueryVariables,
	type CreatePutawayRuleMutationData,
	type UpdatePutawayRuleMutationData,
	type DeletePutawayRuleMutationData,
} from "@/lib/graphql/putaway-rules";
import {
	WAREHOUSES_QUERY,
	type WarehousesQueryData,
} from "@/lib/graphql/warehouses";
import type { PutawayRule, ZonePurpose } from "@/lib/graphql/types";
import { Plus, Edit, Trash2 } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";

const ZONE_PURPOSES: ZonePurpose[] = [
	"GENERAL",
	"WET",
	"DRY",
	"AMBIENT",
	"DAMAGED",
];

export function PutawayRuleSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [warehouseFilter, setWarehouseFilter] = useState<string>("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<PutawayRule | null>(null);
	const [deleting, setDeleting] = useState<PutawayRule | null>(null);

	const rulesVars: PutawayRulesQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		filter: {
			...(warehouseFilter ? { warehouseId: warehouseFilter } : {}),
		},
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.putawayRules.all, rulesVars],
		queryFn: () =>
			gqlRequest<PutawayRulesQueryData, PutawayRulesQueryVariables>(
				PUTAWAY_RULES_QUERY,
				rulesVars,
			),
	});

	const { data: warehousesData } = useQuery({
		queryKey: [...qk.warehouses.all, "putaway-rule-section"],
		queryFn: () =>
			gqlRequest<WarehousesQueryData>(WAREHOUSES_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
	});

	const { mutate: createRule, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreatePutawayRuleMutationData>(
				CREATE_PUTAWAY_RULE_MUTATION,
				{ input },
			),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateRule, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdatePutawayRuleMutationData>(
				UPDATE_PUTAWAY_RULE_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: deleteRule, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeletePutawayRuleMutationData>(
				DELETE_PUTAWAY_RULE_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});

	const list = data?.putawayRules?.query ?? [];
	const pagination = data?.putawayRules?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const warehouses = warehousesData?.warehouses?.query ?? [];
	const createdBy = user?.id ?? "";

	const warehouseName = (id: string) =>
		warehouses.find((w) => w.warehouseId === id)?.warehouseName ?? id;

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Putaway Rules
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Route incoming goods to zones by item attribute
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Select
							value={warehouseFilter}
							onValueChange={(v) => {
								setWarehouseFilter(v === "all" ? "" : v);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-40 rounded-lg border-muted-foreground/20">
								<SelectValue placeholder="All warehouses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All warehouses</SelectItem>
								{warehouses.map((w) => (
									<SelectItem key={w.warehouseId} value={w.warehouseId}>
										{w.warehouseName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Rule
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative px-0 pb-6">
				<GlobalLoadingShadow />
				<div className="mx-6 overflow-x-auto rounded-xl border">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Warehouse
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Attribute Key
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Attribute Value
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Target Zone
								</TableHead>
								<TableHead className="px-6 text-center" style={{ fontFamily: "var(--dashboard-body)" }}>
									Priority
								</TableHead>
								<TableHead className="px-6 text-right" style={{ fontFamily: "var(--dashboard-body)" }}>
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={6} className="h-24 px-6 text-center text-muted-foreground">
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6} className="h-24 px-6 text-center text-muted-foreground">
										No putaway rules found.
									</TableCell>
								</TableRow>
							) : (
								list.map((rule) => (
									<TableRow key={rule.putawayRuleId} className="transition-colors hover:bg-muted/50">
										<TableCell className="px-6 text-sm">
											{warehouseName(rule.warehouseId)}
										</TableCell>
										<TableCell className="px-6 font-mono text-sm">
											{rule.itemAttributeKey}
										</TableCell>
										<TableCell className="px-6 font-mono text-sm">
											{rule.itemAttributeValue}
										</TableCell>
										<TableCell className="px-6">
											<span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
												{rule.targetZonePurpose}
											</span>
										</TableCell>
										<TableCell className="px-6 text-center text-sm tabular-nums">
											{rule.priority}
										</TableCell>
										<TableCell className="px-6 text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(rule)}
												className="rounded-lg"
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive rounded-lg"
												onClick={() => setDeleting(rule)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{pagination && totalPages > 1 && (
					<div className="mx-6 mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--dashboard-body)" }}>
							Page{" "}
							<span className="font-semibold tabular-nums text-foreground">
								{currentPage}
							</span>{" "}
							of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								className="rounded-lg"
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								className="rounded-lg"
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<PutawayRuleFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				warehouses={warehouses}
				onSubmit={(values) =>
					createRule({ ...values, createdBy, updatedBy: createdBy })
				}
				loading={createLoading}
				title="Add Putaway Rule"
				description="Define a rule to route goods to a zone by item attribute."
			/>

			{editing && (
				<PutawayRuleFormDialog
					key={editing.putawayRuleId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					warehouses={warehouses}
					initial={editing}
					onSubmit={(values) =>
						updateRule({
							id: editing.putawayRuleId,
							input: {
								itemAttributeKey: values.itemAttributeKey,
								itemAttributeValue: values.itemAttributeValue,
								targetZonePurpose: values.targetZonePurpose,
								priority: values.priority,
								updatedBy: createdBy,
							},
						})
					}
					loading={updateLoading}
					title="Edit Putaway Rule"
					description="Update rule details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={`${deleting.itemAttributeKey} = ${deleting.itemAttributeValue}`}
					onConfirm={() => deleteRule({ id: deleting.putawayRuleId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

type PutawayRuleFormValues = {
	warehouseId: string;
	itemAttributeKey: string;
	itemAttributeValue: string;
	targetZonePurpose: string;
	priority: number;
};

function PutawayRuleFormDialog({
	open,
	onOpenChange,
	warehouses,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	warehouses: { warehouseId: string; warehouseName: string }[];
	initial?: PutawayRule;
	onSubmit: (v: PutawayRuleFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? "");
	const [itemAttributeKey, setItemAttributeKey] = useState(
		initial?.itemAttributeKey ?? "",
	);
	const [itemAttributeValue, setItemAttributeValue] = useState(
		initial?.itemAttributeValue ?? "",
	);
	const [targetZonePurpose, setTargetZonePurpose] = useState(
		initial?.targetZonePurpose ?? "GENERAL",
	);
	const [priority, setPriority] = useState<string>(
		String(initial?.priority ?? 100),
	);

	const isEdit = !!initial;

	useEffect(() => {
		if (open) {
			setWarehouseId(initial?.warehouseId ?? "");
			setItemAttributeKey(initial?.itemAttributeKey ?? "");
			setItemAttributeValue(initial?.itemAttributeValue ?? "");
			setTargetZonePurpose(initial?.targetZonePurpose ?? "GENERAL");
			setPriority(String(initial?.priority ?? 100));
		}
	}, [open]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setWarehouseId("");
			setItemAttributeKey("");
			setItemAttributeValue("");
			setTargetZonePurpose("GENERAL");
			setPriority("100");
		}
		onOpenChange(next);
	};

	const canSubmit =
		(isEdit || warehouseId) &&
		itemAttributeKey.trim() &&
		itemAttributeValue.trim() &&
		targetZonePurpose &&
		!loading;

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
					{!isEdit && (
						<div className="grid gap-2">
							<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
								Warehouse
							</Label>
							<Select value={warehouseId} onValueChange={setWarehouseId}>
								<SelectTrigger className="rounded-lg border-muted-foreground/20">
									<SelectValue placeholder="Select warehouse" />
								</SelectTrigger>
								<SelectContent>
									{warehouses.map((w) => (
										<SelectItem key={w.warehouseId} value={w.warehouseId}>
											{w.warehouseName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Attribute Key
						</Label>
						<Input
							value={itemAttributeKey}
							onChange={(e) => setItemAttributeKey(e.target.value)}
							placeholder="e.g. category"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Attribute Value
						</Label>
						<Input
							value={itemAttributeValue}
							onChange={(e) => setItemAttributeValue(e.target.value)}
							placeholder="e.g. wet"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Target Zone Purpose
						</Label>
						<Select
							value={targetZonePurpose}
							onValueChange={setTargetZonePurpose}
						>
							<SelectTrigger className="rounded-lg border-muted-foreground/20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ZONE_PURPOSES.map((p) => (
									<SelectItem key={p} value={p}>
										{p}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Priority (lower = higher priority)
						</Label>
						<Input
							type="number"
							value={priority}
							onChange={(e) => setPriority(e.target.value)}
							placeholder="100"
							min={1}
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
						disabled={!canSubmit}
						onClick={() =>
							onSubmit({
								warehouseId,
								itemAttributeKey: itemAttributeKey.trim(),
								itemAttributeValue: itemAttributeValue.trim(),
								targetZonePurpose,
								priority: Number(priority) || 100,
							})
						}
						className="rounded-lg bg-purple-600 text-white hover:bg-purple-700"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
