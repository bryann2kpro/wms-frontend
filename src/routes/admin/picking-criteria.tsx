import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { requirePermission } from "@/lib/rbac";
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
	PICKING_CRITERIAS_QUERY,
	CREATE_PICKING_CRITERIA_MUTATION,
	UPDATE_PICKING_CRITERIA_MUTATION,
	DELETE_PICKING_CRITERIA_MUTATION,
	type PickingCriteriasQueryData,
	type PickingCriteriasQueryVariables,
	type CreatePickingCriteriaMutationData,
	type UpdatePickingCriteriaMutationData,
	type DeletePickingCriteriaMutationData,
} from "@/lib/graphql/picking-criteria";
import type { PickingCriteria } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, FileSpreadsheet, ArrowUpDown, Upload } from "lucide-react";
import { ConfirmDeleteDialog, PAGE_SIZE } from "@/components/settings/master-data/shared";
import { PickingCriteriaImportDialog } from "@/components/settings/master-data/picking-criteria-import-dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/picking-criteria")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["*"]);
	},
	component: PickingCriteriaPage,
	head: () => ({
		meta: [{ title: "Picking Criteria - SME Edaran WMS" }],
	}),
});

type PageTab = "criteria" | "import-export";

function PickingCriteriaPage() {
	const [activeTab, setActiveTab] = useState<PageTab>("criteria");
	const [isImportOpen, setIsImportOpen] = useState(false);
	const { user } = useCurrentUser();

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex items-center gap-4 border-b pb-2">
				<button
					onClick={() => setActiveTab("criteria")}
					className={`rounded-t px-4 py-2 text-sm font-medium transition-colors ${
						activeTab === "criteria"
							? "border-b-2 border-[var(--dashboard-accent)] text-[var(--dashboard-accent)]"
							: "text-muted-foreground hover:text-foreground"
					}`}
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Picking Criteria
				</button>
				<button
					onClick={() => setActiveTab("import-export")}
					className={`flex items-center gap-2 rounded-t px-4 py-2 text-sm font-medium transition-colors ${
						activeTab === "import-export"
							? "border-b-2 border-[var(--dashboard-accent)] text-[var(--dashboard-accent)]"
							: "text-muted-foreground hover:text-foreground"
					}`}
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					<FileSpreadsheet className="h-4 w-4" />
					Import/Export Excel
				</button>
			</div>

			{activeTab === "criteria" && <PickingCriteriaSection />}
			{activeTab === "import-export" && (
				<Card className="dashboard-card">
					<CardHeader>
						<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>
							Import / Export Excel
						</CardTitle>
						<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
							Bulk import picking criteria via Excel.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							onClick={() => setIsImportOpen(true)}
							disabled={!user?.id}
							className="rounded-lg"
						>
							<Upload className="mr-2 h-4 w-4" />
							Import Excel
						</Button>
					</CardContent>
				</Card>
			)}

			<PickingCriteriaImportDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				createdBy={user?.id ?? ""}
				onImported={() => setActiveTab("criteria")}
			/>
		</div>
	);
}

function PickingCriteriaSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [sortField, setSortField] = useState<string>("UPDATED_AT");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<PickingCriteria | null>(null);
	const [deleting, setDeleting] = useState<PickingCriteria | null>(null);

	const queryVars: PickingCriteriasQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		sort: { sortBy: sortField, sortOrder: sortDirection },
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.pickingCriterias.all, queryVars],
		queryFn: () =>
			gqlRequest<PickingCriteriasQueryData, PickingCriteriasQueryVariables>(
				PICKING_CRITERIAS_QUERY,
				queryVars,
			),
	});

	const { mutate: createCriteria, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreatePickingCriteriaMutationData>(
				CREATE_PICKING_CRITERIA_MUTATION,
				{ input },
			),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});

	const { mutate: updateCriteria, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdatePickingCriteriaMutationData>(
				UPDATE_PICKING_CRITERIA_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});

	const { mutate: deleteCriteria, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeletePickingCriteriaMutationData>(
				DELETE_PICKING_CRITERIA_MUTATION,
				variables,
			),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});

	const list = data?.pickingCriterias?.query ?? [];
	const pagination = data?.pickingCriterias?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Picking Criteria
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Define picking assignment rules per user and item attributes
						</CardDescription>
					</div>
					<div className="flex items-center gap-1">
						<ArrowUpDown className="h-4 w-4 text-muted-foreground" />
						<Select
							value={sortField}
							onValueChange={(v) => {
								setSortField(v);
								setPage(1);
							}}
						>
							<SelectTrigger className="h-9 w-36 rounded-lg text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="USER_ID">User</SelectItem>
								<SelectItem value="CATEGORY">Category</SelectItem>
								<SelectItem value="CHAIN">Chain</SelectItem>
								<SelectItem value="CHANNEL">Channel</SelectItem>
								<SelectItem value="ITEM">Item</SelectItem>
								<SelectItem value="UPDATED_AT">Last Updated</SelectItem>
								<SelectItem value="CREATED_AT">Created</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={sortDirection}
							onValueChange={(v) => {
								setSortDirection(v as "ASC" | "DESC");
								setPage(1);
							}}
						>
							<SelectTrigger className="h-9 w-20 rounded-lg text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ASC">ASC</SelectItem>
								<SelectItem value="DESC">DESC</SelectItem>
							</SelectContent>
						</Select>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Criteria
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
								{[
									"User",
									"Category",
									"Chain",
									"Channel",
									"Debtor",
									"Delivery Point",
									"Storage Class",
									"Brand",
									"Item Category",
									"Manufacturer",
									"Item",
									"Min Expiry Month",
									"Actions",
								].map((h) => (
									<TableHead
										key={h}
										className={`px-4 ${h === "Actions" ? "text-right" : ""}`}
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										{h}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={13} className="h-24 px-6 text-center text-muted-foreground">
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell colSpan={13} className="h-24 px-6 text-center text-muted-foreground">
										No picking criteria found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.id} className="transition-colors hover:bg-muted/50">
										<TableCell className="px-4 text-sm">{row.userId}</TableCell>
										<TableCell className="px-4 text-sm">{row.category}</TableCell>
										<TableCell className="px-4 text-sm">{row.chain}</TableCell>
										<TableCell className="px-4 text-sm">{row.channel}</TableCell>
										<TableCell className="px-4 text-sm">{row.debtor}</TableCell>
										<TableCell className="px-4 text-sm">{row.deliveryPoint}</TableCell>
										<TableCell className="px-4 text-sm">{row.storageClass}</TableCell>
										<TableCell className="px-4 text-sm">{row.brand}</TableCell>
										<TableCell className="px-4 text-sm">{row.itemCategory}</TableCell>
										<TableCell className="px-4 text-sm">{row.manufacturer}</TableCell>
										<TableCell className="px-4 font-mono text-sm">{row.item}</TableCell>
										<TableCell className="px-4 text-center text-sm tabular-nums">
											{row.minExpiryMonth}
										</TableCell>
										<TableCell className="px-4 text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
												className="rounded-lg"
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive rounded-lg"
												onClick={() => setDeleting(row)}
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

			<PickingCriteriaFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createCriteria({ ...values, createdBy, updatedBy: createdBy })
				}
				loading={createLoading}
				title="Add Picking Criteria"
				description="Define a new picking assignment rule."
			/>

			{editing && (
				<PickingCriteriaFormDialog
					key={editing.id}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={editing}
					onSubmit={(values) =>
						updateCriteria({
							id: editing.id,
							input: { ...values, updatedBy: createdBy },
						})
					}
					loading={updateLoading}
					title="Edit Picking Criteria"
					description="Update picking criteria details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={`${deleting.userId} / ${deleting.deliveryPoint || deleting.item}`}
					onConfirm={() => deleteCriteria({ id: deleting.id })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

type PickingCriteriaFormValues = {
	userId: string;
	category: string;
	chain: string;
	channel: string;
	debtor: string;
	deliveryPoint: string;
	storageClass: string;
	brand: string;
	itemCategory: string;
	manufacturer: string;
	item: string;
	minExpiryMonth: number;
};

const EMPTY_FORM: PickingCriteriaFormValues = {
	userId: "",
	category: "",
	chain: "",
	channel: "",
	debtor: "",
	deliveryPoint: "",
	storageClass: "",
	brand: "",
	itemCategory: "",
	manufacturer: "",
	item: "",
	minExpiryMonth: 0,
};

function PickingCriteriaFormDialog({
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
	initial?: PickingCriteria;
	onSubmit: (v: PickingCriteriaFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [form, setForm] = useState<PickingCriteriaFormValues>(
		initial
			? {
					userId: initial.userId,
					category: initial.category,
					chain: initial.chain,
					channel: initial.channel,
					debtor: initial.debtor,
					deliveryPoint: initial.deliveryPoint,
					storageClass: initial.storageClass,
					brand: initial.brand,
					itemCategory: initial.itemCategory,
					manufacturer: initial.manufacturer,
					item: initial.item,
					minExpiryMonth: initial.minExpiryMonth,
				}
			: EMPTY_FORM,
	);

	useEffect(() => {
		if (open) {
			setForm(
				initial
					? {
							userId: initial.userId,
							category: initial.category,
							chain: initial.chain,
							channel: initial.channel,
							debtor: initial.debtor,
							deliveryPoint: initial.deliveryPoint,
							storageClass: initial.storageClass,
							brand: initial.brand,
							itemCategory: initial.itemCategory,
							manufacturer: initial.manufacturer,
							item: initial.item,
							minExpiryMonth: initial.minExpiryMonth,
						}
					: EMPTY_FORM,
			);
		}
	}, [open]);

	const set = (field: keyof PickingCriteriaFormValues) =>
		(e: React.ChangeEvent<HTMLInputElement>) =>
			setForm((prev) => ({ ...prev, [field]: e.target.value }));

	const canSubmit = form.userId.trim() && !loading;

	const handleSubmit = () => {
		onSubmit({
			...form,
			userId: form.userId.trim(),
			category: form.category.trim(),
			chain: form.chain.trim(),
			channel: form.channel.trim(),
			debtor: form.debtor.trim(),
			deliveryPoint: form.deliveryPoint.trim(),
			storageClass: form.storageClass.trim(),
			brand: form.brand.trim(),
			itemCategory: form.itemCategory.trim(),
			manufacturer: form.manufacturer.trim(),
			item: form.item.trim(),
			minExpiryMonth: Number(form.minExpiryMonth) || 0,
		});
	};

	const inputClass = "rounded-lg border-muted-foreground/20";
	const labelStyle = { fontFamily: '"Figtree", sans-serif' };

	const fields: { label: string; field: keyof PickingCriteriaFormValues; placeholder?: string }[] = [
		{ label: "User", field: "userId", placeholder: "User ID or username" },
		{ label: "Category", field: "category" },
		{ label: "Chain", field: "chain" },
		{ label: "Channel", field: "channel" },
		{ label: "Debtor", field: "debtor" },
		{ label: "Delivery Point", field: "deliveryPoint" },
		{ label: "Storage Class", field: "storageClass" },
		{ label: "Brand", field: "brand" },
		{ label: "Item Category", field: "itemCategory" },
		{ label: "Manufacturer", field: "manufacturer" },
		{ label: "Item (SKU)", field: "item", placeholder: "e.g. YS064CVG001" },
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-border bg-background shadow-xl sm:max-w-lg">
				<DialogHeader className="border-b bg-muted/50">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						{title}
					</DialogTitle>
					<DialogDescription style={labelStyle}>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 py-4">
					{fields.map(({ label, field, placeholder }) => (
						<div key={field} className="grid gap-1.5">
							<Label style={labelStyle}>{label}</Label>
							<Input
								value={String(form[field])}
								onChange={set(field)}
								placeholder={placeholder ?? label}
								className={inputClass}
							/>
						</div>
					))}
					<div className="grid gap-1.5">
						<Label style={labelStyle}>Min Expiry Month</Label>
						<Input
							type="number"
							value={form.minExpiryMonth}
							onChange={(e) =>
								setForm((prev) => ({
									...prev,
									minExpiryMonth: Number(e.target.value) || 0,
								}))
							}
							min={0}
							className={inputClass}
						/>
					</div>
				</div>
				<DialogFooter className="border-t bg-muted/20">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						disabled={!canSubmit}
						onClick={handleSubmit}
						className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
