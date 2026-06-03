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
import { Checkbox } from "@/components/ui/checkbox";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	BINS_QUERY,
	CREATE_BIN_MUTATION,
	UPDATE_BIN_MUTATION,
	DELETE_BIN_MUTATION,
	type BinsQueryData,
	type BinsQueryVariables,
	type CreateBinMutationData,
	type UpdateBinMutationData,
	type DeleteBinMutationData,
} from "@/lib/graphql/bins";
import {
	RACKS_QUERY,
	type RacksQueryData,
} from "@/lib/graphql/racks";
import type { Bin } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Star } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";

export function BinSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [rackFilter, setRackFilter] = useState<string>("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Bin | null>(null);
	const [deleting, setDeleting] = useState<Bin | null>(null);

	const binsVars: BinsQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		filter: {
			...(rackFilter ? { rackId: rackFilter } : {}),
		},
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.bins.all, binsVars],
		queryFn: () =>
			gqlRequest<BinsQueryData, BinsQueryVariables>(BINS_QUERY, binsVars),
	});

	const { data: racksData } = useQuery({
		queryKey: [...qk.racks.all, "bin-section"],
		queryFn: () =>
			gqlRequest<RacksQueryData>(RACKS_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
	});

	const { mutate: createBin, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateBinMutationData>(CREATE_BIN_MUTATION, { input }),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateBin, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateBinMutationData>(UPDATE_BIN_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: deleteBin, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteBinMutationData>(DELETE_BIN_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});

	const list = data?.bins?.query ?? [];
	const pagination = data?.bins?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const racks = racksData?.racks?.query ?? [];
	const createdBy = user?.id ?? "";

	const rackLabel = (rackId: string) => {
		const r = racks.find((rack) => rack.rackId === rackId);
		return r ? `${r.rackRow}-${r.rackLevel}-${r.rackColumn}` : rackId;
	};

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Bins
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Rack slots with capacity and pick-face designation
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Select
							value={rackFilter}
							onValueChange={(v) => {
								setRackFilter(v === "all" ? "" : v);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-40 rounded-lg border-muted-foreground/20">
								<SelectValue placeholder="All racks" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All racks</SelectItem>
								{racks.map((r) => (
									<SelectItem key={r.rackId} value={r.rackId}>
										{r.rackRow}-{r.rackLevel}-{r.rackColumn}
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
							Add Bin
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
									Code
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Rack
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Level / Col
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Capacity (vol / wgt)
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Pick-face
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
										No bins found.
									</TableCell>
								</TableRow>
							) : (
								list.map((bin) => (
									<TableRow key={bin.binId} className="transition-colors hover:bg-muted/50">
										<TableCell className="px-6 font-mono text-sm">{bin.binCode}</TableCell>
										<TableCell className="px-6 text-sm text-muted-foreground">
											{rackLabel(bin.rackId)}
										</TableCell>
										<TableCell className="px-6 text-sm">
											{bin.level} / {bin.column}
										</TableCell>
										<TableCell className="px-6 text-sm">
											{bin.capacityVolume != null
												? `${bin.capacityVolume} m³`
												: "—"}{" "}
											/{" "}
											{bin.capacityWeight != null
												? `${bin.capacityWeight} kg`
												: "—"}
										</TableCell>
										<TableCell className="px-6">
											{bin.isPickFace ? (
												<Star className="h-4 w-4 fill-amber-400 text-amber-400" />
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="px-6 text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(bin)}
												className="rounded-lg"
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive rounded-lg"
												onClick={() => setDeleting(bin)}
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

			<BinFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				racks={racks}
				onSubmit={(values) =>
					createBin({ ...values, createdBy, updatedBy: createdBy })
				}
				loading={createLoading}
				title="Add Bin"
				description="Create a new bin slot within a rack."
			/>

			{editing && (
				<BinFormDialog
					key={editing.binId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					racks={racks}
					initial={editing}
					onSubmit={(values) =>
						updateBin({
							id: editing.binId,
							input: {
								binCode: values.binCode,
								level: values.level,
								column: values.column,
								capacityVolume: values.capacityVolume,
								capacityWeight: values.capacityWeight,
								isPickFace: values.isPickFace,
								updatedBy: createdBy,
							},
						})
					}
					loading={updateLoading}
					title="Edit Bin"
					description="Update bin details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={`Bin ${deleting.binCode}`}
					onConfirm={() => deleteBin({ id: deleting.binId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

type BinFormValues = {
	rackId: string;
	binCode: string;
	level: string;
	column: string;
	capacityVolume: number | null;
	capacityWeight: number | null;
	isPickFace: boolean;
};

function BinFormDialog({
	open,
	onOpenChange,
	racks,
	initial,
	onSubmit,
	loading,
	title,
	description,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	racks: { rackId: string; rackRow: string; rackColumn: string; rackLevel: string }[];
	initial?: Bin;
	onSubmit: (v: BinFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [rackId, setRackId] = useState(initial?.rackId ?? "");
	const [binCode, setBinCode] = useState(initial?.binCode ?? "");
	const [level, setLevel] = useState(initial?.level ?? "");
	const [column, setColumn] = useState(initial?.column ?? "");
	const [capacityVolume, setCapacityVolume] = useState<string>(
		initial?.capacityVolume != null ? String(initial.capacityVolume) : "",
	);
	const [capacityWeight, setCapacityWeight] = useState<string>(
		initial?.capacityWeight != null ? String(initial.capacityWeight) : "",
	);
	const [isPickFace, setIsPickFace] = useState(initial?.isPickFace ?? false);

	const isEdit = !!initial;

	useEffect(() => {
		if (open) {
			setRackId(initial?.rackId ?? "");
			setBinCode(initial?.binCode ?? "");
			setLevel(initial?.level ?? "");
			setColumn(initial?.column ?? "");
			setCapacityVolume(
				initial?.capacityVolume != null ? String(initial.capacityVolume) : "",
			);
			setCapacityWeight(
				initial?.capacityWeight != null ? String(initial.capacityWeight) : "",
			);
			setIsPickFace(initial?.isPickFace ?? false);
		}
	}, [open]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setRackId(initial?.rackId ?? "");
			setBinCode(initial?.binCode ?? "");
			setLevel(initial?.level ?? "");
			setColumn(initial?.column ?? "");
			setCapacityVolume("");
			setCapacityWeight("");
			setIsPickFace(false);
		}
		onOpenChange(next);
	};

	const canSubmit =
		(isEdit || rackId) &&
		binCode.trim() &&
		level.trim() &&
		column.trim() &&
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
							<Label style={{ fontFamily: '"Figtree", sans-serif' }}>Rack</Label>
							<Select value={rackId} onValueChange={setRackId}>
								<SelectTrigger className="rounded-lg border-muted-foreground/20">
									<SelectValue placeholder="Select rack" />
								</SelectTrigger>
								<SelectContent>
									{racks.map((r) => (
										<SelectItem key={r.rackId} value={r.rackId}>
											{r.rackRow}-{r.rackLevel}-{r.rackColumn}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>Bin Code</Label>
						<Input
							value={binCode}
							onChange={(e) => setBinCode(e.target.value)}
							placeholder="e.g. A-2-3"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label style={{ fontFamily: '"Figtree", sans-serif' }}>Level</Label>
							<Input
								value={level}
								onChange={(e) => setLevel(e.target.value)}
								placeholder="e.g. 1, 2"
								className="rounded-lg border-muted-foreground/20"
							/>
						</div>
						<div className="grid gap-2">
							<Label style={{ fontFamily: '"Figtree", sans-serif' }}>Column</Label>
							<Input
								value={column}
								onChange={(e) => setColumn(e.target.value)}
								placeholder="e.g. A, B"
								className="rounded-lg border-muted-foreground/20"
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
								Capacity Volume (m³)
							</Label>
							<Input
								type="number"
								value={capacityVolume}
								onChange={(e) => setCapacityVolume(e.target.value)}
								placeholder="Optional"
								className="rounded-lg border-muted-foreground/20"
							/>
						</div>
						<div className="grid gap-2">
							<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
								Capacity Weight (kg)
							</Label>
							<Input
								type="number"
								value={capacityWeight}
								onChange={(e) => setCapacityWeight(e.target.value)}
								placeholder="Optional"
								className="rounded-lg border-muted-foreground/20"
							/>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="isPickFace"
							checked={isPickFace}
							onCheckedChange={(v) => setIsPickFace(!!v)}
						/>
						<Label htmlFor="isPickFace" style={{ fontFamily: '"Figtree", sans-serif' }}>
							Pick-face (front-row accessible)
						</Label>
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
								rackId,
								binCode: binCode.trim(),
								level: level.trim(),
								column: column.trim(),
								capacityVolume: capacityVolume
									? Number(capacityVolume)
									: null,
								capacityWeight: capacityWeight
									? Number(capacityWeight)
									: null,
								isPickFace,
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
