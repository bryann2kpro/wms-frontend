import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
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
	RACKS_QUERY,
	CREATE_RACK_MUTATION,
	UPDATE_RACK_MUTATION,
	DELETE_RACK_MUTATION,
	type RacksQueryData,
	type RacksQueryVariables,
	type CreateRackMutationData,
	type UpdateRackMutationData,
	type DeleteRackMutationData,
} from "@/lib/graphql/racks";
import type { Rack } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";
import { ImportDialog } from "./import-dialog";

export function RackSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [editing, setEditing] = useState<Rack | null>(null);
	const [deleting, setDeleting] = useState<Rack | null>(null);

	const { data, loading, refetch } = useQuery<
		RacksQueryData,
		RacksQueryVariables
	>(RACKS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim() ? { filter: { rackRow: search.trim() } } : {}),
		},
	});

	const [createRack, { loading: createLoading }] =
		useMutation<CreateRackMutationData>(CREATE_RACK_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateRack, { loading: updateLoading }] =
		useMutation<UpdateRackMutationData>(UPDATE_RACK_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [deleteRack, { loading: deleteLoading }] =
		useMutation<DeleteRackMutationData>(DELETE_RACK_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.racks?.query ?? [];
	const pagination = data?.racks?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	const rackDisplayName = (rack: Rack) =>
		`${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`;

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Racks
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Warehouse rack locations (row, column, level)
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by row..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="w-full rounded-lg border-muted-foreground/20 pl-9 sm:w-48"
							/>
						</div>
						<Button
							variant="outline"
							onClick={() => setIsImportOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to import" : undefined}
							className="rounded-lg"
						>
							Import Excel
						</Button>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Rack
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
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Row
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Column
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Level
								</TableHead>
								<TableHead
									className="px-6 text-right"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No racks found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow
										key={row.rackId}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6">{row.rackRow}</TableCell>
										<TableCell className="px-6">{row.rackColumn}</TableCell>
										<TableCell className="px-6">{row.rackLevel}</TableCell>
										<TableCell className="px-6 text-right">
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

			<RackFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createRack({
						variables: {
							input: {
								rackRow: values.rackRow,
								rackColumn: values.rackColumn,
								rackLevel: values.rackLevel,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Rack"
				description="Create a new rack location (row, column, level)."
			/>

			{editing && (
				<RackFormDialog
					key={editing.rackId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						rackRow: editing.rackRow,
						rackColumn: editing.rackColumn,
						rackLevel: editing.rackLevel,
					}}
					onSubmit={(values) =>
						updateRack({
							variables: {
								id: editing.rackId,
								input: {
									rackRow: values.rackRow,
									rackColumn: values.rackColumn,
									rackLevel: values.rackLevel,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Rack"
					description="Update rack location."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={rackDisplayName(deleting)}
					onConfirm={() => deleteRack({ variables: { id: deleting.rackId } })}
					loading={deleteLoading}
				/>
			)}

			<ImportDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				mode="racks"
				createdBy={createdBy}
				onImported={() => {
					void refetch();
				}}
			/>
		</Card>
	);
}

function RackFormDialog({
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
	initial?: { rackRow: string; rackColumn: string; rackLevel: string };
	onSubmit: (v: {
		rackRow: string;
		rackColumn: string;
		rackLevel: string;
	}) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [rackRow, setRackRow] = useState(initial?.rackRow ?? "");
	const [rackColumn, setRackColumn] = useState(initial?.rackColumn ?? "");
	const [rackLevel, setRackLevel] = useState(initial?.rackLevel ?? "");

	useEffect(() => {
		if (open) {
			setRackRow(initial?.rackRow ?? "");
			setRackColumn(initial?.rackColumn ?? "");
			setRackLevel(initial?.rackLevel ?? "");
		}
	}, [open, initial?.rackRow, initial?.rackColumn, initial?.rackLevel]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setRackRow(initial?.rackRow ?? "");
			setRackColumn(initial?.rackColumn ?? "");
			setRackLevel(initial?.rackLevel ?? "");
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
							htmlFor="rack-row"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Row
						</Label>
						<Input
							id="rack-row"
							value={rackRow}
							onChange={(e) => setRackRow(e.target.value)}
							placeholder="e.g. A, B, 1"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="rack-column"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Column
						</Label>
						<Input
							id="rack-column"
							value={rackColumn}
							onChange={(e) => setRackColumn(e.target.value)}
							placeholder="e.g. 01, 02"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="rack-level"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Level
						</Label>
						<Input
							id="rack-level"
							value={rackLevel}
							onChange={(e) => setRackLevel(e.target.value)}
							placeholder="e.g. 01, 02"
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
						disabled={
							!rackRow.trim() ||
							!rackColumn.trim() ||
							!rackLevel.trim() ||
							loading
						}
						onClick={() =>
							onSubmit({
								rackRow: rackRow.trim(),
								rackColumn: rackColumn.trim(),
								rackLevel: rackLevel.trim(),
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
