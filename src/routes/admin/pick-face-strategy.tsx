import { useState, useEffect } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { AdminPageHeader } from "@/components/admin-page-header";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	PICK_FACE_STRATEGIES_QUERY,
	CREATE_PICK_FACE_STRATEGY_MUTATION,
	UPDATE_PICK_FACE_STRATEGY_MUTATION,
	DELETE_PICK_FACE_STRATEGY_MUTATION,
	type PickFaceStrategy,
	type PickFaceStrategiesQueryData,
	type PickFaceStrategiesQueryVariables,
	type CreatePickFaceStrategyMutationData,
	type UpdatePickFaceStrategyMutationData,
	type DeletePickFaceStrategyMutationData,
} from "@/lib/graphql/pick-face-strategy";
import { SKUS_QUERY, type SkusQueryData } from "@/lib/graphql/skus";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { Plus, Edit, Trash2, Search, PackageSearch, ArrowUpDown, Upload } from "lucide-react";
import { RackLocationCombobox } from "@/components/grn/rack-location-combobox";
import { PickFaceImportDialog } from "@/components/settings/master-data/pick-face-import-dialog";
import { SkuCombobox } from "@/components/grn/sku-combobox";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const BIN_TYPES = ["FIXED_BIN", "DYNAMIC_BIN"] as const;

export const Route = createFileRoute("/admin/pick-face-strategy")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Inventory"]);
	},
	component: PickFaceStrategyPage,
	head: () => ({
		meta: [{ title: "Pick Face Strategy - SME Edaran WMS" }],
	}),
});

function PickFaceStrategyPage() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
	const [sortField, setSortField] = useState<string>("STORAGE_BIN");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [editing, setEditing] = useState<PickFaceStrategy | null>(null);
	const [deleting, setDeleting] = useState<PickFaceStrategy | null>(null);

	const queryVars: PickFaceStrategiesQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		sort: { sortBy: sortField, sortOrder: sortDirection },
		...(debouncedSearch.trim()
			? { filter: { search: debouncedSearch.trim() } }
			: {}),
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.pickFaceStrategies.all, queryVars],
		queryFn: () =>
			gqlRequest<PickFaceStrategiesQueryData, PickFaceStrategiesQueryVariables>(
				PICK_FACE_STRATEGIES_QUERY,
				queryVars,
			),
	});

	const { data: skusData } = useQuery({
		queryKey: [...qk.skus.all, "pick-face-page"],
		queryFn: () => gqlRequest<SkusQueryData>(SKUS_QUERY),
	});


	const { mutate: createStrategy, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreatePickFaceStrategyMutationData>(
				CREATE_PICK_FACE_STRATEGY_MUTATION,
				{ input },
			),
		onSuccess: () => {
			void refetch();
			setIsCreateOpen(false);
		},
	});

	const { mutate: updateStrategy, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdatePickFaceStrategyMutationData>(
				UPDATE_PICK_FACE_STRATEGY_MUTATION,
				variables,
			),
		onSuccess: () => {
			void refetch();
			setEditing(null);
		},
	});

	const { mutate: deleteStrategy, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeletePickFaceStrategyMutationData>(
				DELETE_PICK_FACE_STRATEGY_MUTATION,
				variables,
			),
		onSuccess: () => {
			void refetch();
			setDeleting(null);
		},
	});

	const list = data?.pickFaceStrategies?.query ?? [];
	const pagination = data?.pickFaceStrategies?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;

	const skus = skusData?.skus?.query ?? [];
	const createdBy = user?.id ?? "";

	return (
		<ClientOnly>
			<div className="space-y-6 p-6">
				<AdminPageHeader
					icon={PackageSearch}
					title="Pick Face Strategy"
					description="Assign storage bins to items for efficient picking"
					titleId="pick-face-strategy-title"
					descriptionId="pick-face-strategy-description"
				/>
				<Card className="dashboard-card">
					<CardHeader>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<CardTitle
									className="text-xl"
									style={{ fontFamily: "var(--dashboard-display)" }}
								>
									Pick Face Assignments
								</CardTitle>
								<CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
									Manage item-to-storage-bin assignments
								</CardDescription>
							</div>
							<div className="flex flex-wrap items-center justify-end gap-2">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="Search by item code..."
										value={search}
										onChange={(e) => {
											setSearch(e.target.value);
											setPage(1);
										}}
										className="w-full rounded-lg border-muted-foreground/20 pl-9 sm:w-56"
									/>
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
											<SelectItem value="STORAGE_BIN">Storage Bin</SelectItem>
											<SelectItem value="ITEM_CODE">Item Code</SelectItem>
											<SelectItem value="BIN_TYPE">Bin Type</SelectItem>
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
								</div>
								<Button
									variant="outline"
									onClick={() => setIsImportOpen(true)}
									disabled={!createdBy}
									className="rounded-lg"
								>
									<Upload className="mr-2 h-4 w-4" />
									Import Excel
								</Button>
								<Button
									onClick={() => setIsCreateOpen(true)}
									disabled={!createdBy}
									className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Assignment
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
										<TableHead className="w-10 px-4">
											<Checkbox disabled />
										</TableHead>
										<TableHead
											className="w-10 px-4 text-xs font-medium"
											style={{ fontFamily: "var(--dashboard-body)" }}
										>
											#
										</TableHead>
										{[
											"Storage Bin",
											"Item Code",
											"Description",
											"Item Desc 02",
										].map((col) => (
											<TableHead
												key={col}
												className="px-4 text-xs font-medium"
												style={{ fontFamily: "var(--dashboard-body)" }}
											>
												{col}
											</TableHead>
										))}
										<TableHead className="px-4 text-right text-xs font-medium">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loading ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="h-24 text-center text-muted-foreground"
											>
												Loading...
											</TableCell>
										</TableRow>
									) : list.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="h-24 text-center text-muted-foreground"
											>
												No pick face assignments found.
											</TableCell>
										</TableRow>
									) : (
										list.map((row, idx) => (
											<TableRow
												key={row.id}
												className="transition-colors hover:bg-muted/50"
											>
												<TableCell className="px-4">
													<Checkbox />
												</TableCell>
												<TableCell className="px-4 text-sm text-muted-foreground">
													{(currentPage - 1) * PAGE_SIZE + idx + 1}
												</TableCell>
												<TableCell className="px-4 font-mono text-sm">
													{row.storageBin ?? (
														<span className="opacity-30">—</span>
													)}
												</TableCell>
												<TableCell className="px-4 font-mono text-sm">
													{row.itemCode}
												</TableCell>
												<TableCell className="px-4 text-sm text-muted-foreground">
													{row.skuDescription ?? (
														<span className="opacity-30">—</span>
													)}
												</TableCell>
												<TableCell className="px-4">
													<span className="opacity-30">—</span>
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
														className="rounded-lg text-destructive"
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
						{pagination && (totalPages > 1 || debouncedSearch.trim()) && (
							<div className="mx-6 mt-4 flex items-center justify-between">
								<p
									className="text-sm text-muted-foreground"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
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
				</Card>

				<PickFaceImportDialog
					open={isImportOpen}
					onOpenChange={setIsImportOpen}
					createdBy={createdBy}
					onImported={() => void refetch()}
				/>

				<PickFaceStrategyFormDialog
					open={isCreateOpen}
					onOpenChange={setIsCreateOpen}
					skus={skus}
					onSubmit={(values) => {
						const { isActive, ...rest } = values;
						createStrategy({ ...rest, createdBy, updatedBy: createdBy });
					}}
					loading={createLoading}
					title="Add Pick Face Assignment"
					description="Assign a storage bin to an item for picking."
				/>

				{editing && (
					<PickFaceStrategyFormDialog
						key={editing.id}
						open={!!editing}
						onOpenChange={(open) => !open && setEditing(null)}
						skus={skus}
						initial={editing}
						onSubmit={(values) => {
							const { itemCode, ...rest } = values;
							updateStrategy({
								id: editing.id,
								input: { ...rest, updatedBy: createdBy },
							});
						}}
						loading={updateLoading}
						title="Edit Pick Face Assignment"
						description="Update storage bin assignment details."
					/>
				)}

				{deleting && (
					<ConfirmDeleteDialog
						open={!!deleting}
						onOpenChange={(open) => !open && setDeleting(null)}
						itemName={deleting.itemCode}
						onConfirm={() => deleteStrategy({ id: deleting.id })}
						loading={deleteLoading}
					/>
				)}
			</div>
		</ClientOnly>
	);
}

// ─── Form Dialog ─────────────────────────────────────────────────────────────

type Sku = { skuId: string; skuCode: string; skuDescription: string };

type FormValues = {
	storageBinId: string;
	skuId: string;
	itemCode: string;
	binType: string;
	isActive: boolean;
};

function PickFaceStrategyFormDialog({
	open,
	onOpenChange,
	initial,
	skus,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: PickFaceStrategy;
	skus: Sku[];
	onSubmit: (v: Omit<FormValues, "isActive"> & { isActive?: boolean }) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [storageBinId, setStorageBinId] = useState(initial?.storageBinId ?? "");
	const [skuId, setSkuId] = useState(initial?.skuId ?? "");
	const [itemCode, setItemCode] = useState(initial?.itemCode ?? "");
	const [binType, setBinType] = useState(initial?.binType ?? "FIXED_BIN");
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);

	useEffect(() => {
		if (open) {
			setStorageBinId(initial?.storageBinId ?? "");
			setSkuId(initial?.skuId ?? "");
			setItemCode(initial?.itemCode ?? "");
			setBinType(initial?.binType ?? "FIXED_BIN");
			setIsActive(initial?.isActive ?? true);
		}
	}, [open, initial?.id]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setStorageBinId(initial?.storageBinId ?? "");
			setSkuId(initial?.skuId ?? "");
			setItemCode(initial?.itemCode ?? "");
			setBinType(initial?.binType ?? "FIXED_BIN");
			setIsActive(initial?.isActive ?? true);
		}
		onOpenChange(next);
	};

	const canSubmit = storageBinId && skuId && itemCode.trim() && !loading;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50 px-6 py-4">
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
				<div className="grid gap-4 px-6 py-4">
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Rack Location <span className="text-destructive">*</span>
						</Label>
						{/* <Select value={storageBinId} onValueChange={setStorageBinId}>
							<SelectTrigger className="rounded-lg border-muted-foreground/20">
								<SelectValue placeholder="Select a rack location..." />
							</SelectTrigger>
							<SelectContent>
								{racks.map((r) => (
									<SelectItem key={r.rackId} value={r.rackId}>
										{rackLabel(r)}
									</SelectItem>
								))}
							</SelectContent>
						</Select> */}
						<RackLocationCombobox
							// racks={racks}
							remoteSearch
							value={storageBinId}
							onChange={(rackId) => setStorageBinId(rackId)}
							fallbackLabel={initial?.storageBin}
							placeholder="Select a rack location..."
							className="h-8"
						/>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							SKU <span className="text-destructive">*</span>
						</Label>
						{/* <Select value={skuId} onValueChange={handleSkuChange}>
							<SelectTrigger className="rounded-lg border-muted-foreground/20">
								<SelectValue placeholder="Select a SKU..." />
							</SelectTrigger>
							<SelectContent>
								{skus.map((s) => (
									<SelectItem key={s.skuId} value={s.skuId}>
										{s.skuCode} — {s.skuDescription}
									</SelectItem>
								))}
							</SelectContent>
						</Select> */}
						<SkuCombobox
							onChange={(v) => {
								setSkuId(v.skuId);
								setItemCode(v.skuCode);
							}}
							value={(() => {
								if (!skuId) return null;
								const s = skus.find((x) => x.skuId === skuId);
								return {
									skuId,
									sku: s?.skuCode ?? skuId,
									skuCode: s?.skuCode ?? skuId,
									description: s?.skuDescription ?? "",
									uom: "",
									isActive: s?.isActive ?? true,
								};
							})()}
							placeholder="Select a SKU..."
							className="h-8"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="item-code" style={{ fontFamily: '"Figtree", sans-serif' }}>
							Item Code <span className="text-destructive">*</span>
						</Label>
						<Input
							id="item-code"
							value={itemCode}
							onChange={(e) => setItemCode(e.target.value)}
							placeholder="e.g. 80694404"
							className="rounded-lg border-muted-foreground/20 font-mono"
						/>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Bin Type
						</Label>
						<Select value={binType} onValueChange={setBinType}>
							<SelectTrigger className="rounded-lg border-muted-foreground/20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{BIN_TYPES.map((t) => (
									<SelectItem key={t} value={t}>
										{t}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{initial && (
						<div className="flex items-center gap-2">
							<Checkbox
								id="is-active"
								checked={isActive}
								onCheckedChange={(v) => setIsActive(!!v)}
							/>
							<Label htmlFor="is-active" style={{ fontFamily: '"Figtree", sans-serif' }}>
								Active
							</Label>
						</div>
					)}
				</div>
				<DialogFooter className="border-t px-6 py-4">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={loading}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						disabled={!canSubmit}
						onClick={() =>
							onSubmit({ storageBinId, skuId, itemCode, binType, isActive })
						}
						className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDeleteDialog({
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
			<DialogContent className="max-w-sm rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50 px-6 py-4">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						Delete Assignment
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						Remove pick face assignment for{" "}
						<span className="font-mono font-semibold">{itemName}</span>? This
						cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="border-t px-6 py-4">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={onConfirm}
						disabled={loading}
						className="rounded-lg"
					>
						{loading ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
