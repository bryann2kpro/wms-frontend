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
	REGIONS_QUERY,
	CREATE_REGION_MUTATION,
	UPDATE_REGION_MUTATION,
	DELETE_REGION_MUTATION,
	type RegionsQueryData,
	type RegionsQueryVariables,
	type CreateRegionMutationData,
	type UpdateRegionMutationData,
	type DeleteRegionMutationData,
} from "@/lib/graphql/regions";
import type { Region } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";

export function RegionSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Region | null>(null);
	const [deleting, setDeleting] = useState<Region | null>(null);

	const { data, loading, refetch } = useQuery<
		RegionsQueryData,
		RegionsQueryVariables
	>(REGIONS_QUERY, {
		variables: {
			pageSize: PAGE_SIZE,
			pageNumber: page,
			...(search.trim() ? { filter: { regionName: search.trim() } } : {}),
		},
	});

	const [createRegion, { loading: createLoading }] =
		useMutation<CreateRegionMutationData>(CREATE_REGION_MUTATION, {
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});
	const [updateRegion, { loading: updateLoading }] =
		useMutation<UpdateRegionMutationData>(UPDATE_REGION_MUTATION, {
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});
	const [deleteRegion, { loading: deleteLoading }] =
		useMutation<DeleteRegionMutationData>(DELETE_REGION_MUTATION, {
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	const list = data?.regions?.query ?? [];
	const pagination = data?.regions?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Regions</CardTitle>
						<CardDescription>
							Manage delivery region master data
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Region
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="relative">
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-24 text-center text-muted-foreground"
									>
										No regions found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow key={row.regionId}>
										<TableCell className="font-mono text-sm">
											{row.regionCode}
										</TableCell>
										<TableCell className="font-medium">
											{row.regionName}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(row)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive"
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
					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Page {currentPage} of {totalPages} ({pagination.totalCount} total)
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasPrevPage}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!pagination.hasNextPage}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<RegionFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) =>
					createRegion({
						variables: {
							input: {
								regionName: values.regionName,
								regionCode: values.regionCode,
								createdBy,
								updatedBy: createdBy,
							},
						},
					})
				}
				loading={createLoading}
				title="Add Region"
				description="Create a new region."
			/>

			{editing && (
				<RegionFormDialog
					key={editing.regionId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						regionName: editing.regionName,
						regionCode: editing.regionCode,
					}}
					onSubmit={(values) =>
						updateRegion({
							variables: {
								id: editing.regionId,
								input: {
									regionName: values.regionName,
									regionCode: values.regionCode,
									updatedBy: createdBy,
								},
							},
						})
					}
					loading={updateLoading}
					title="Edit Region"
					description="Update region details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.regionName}
					onConfirm={() =>
						deleteRegion({ variables: { id: deleting.regionId } })
					}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

function RegionFormDialog({
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
	initial?: { regionName: string; regionCode: string };
	onSubmit: (v: { regionName: string; regionCode: string }) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [name, setName] = useState(initial?.regionName ?? "");
	const [code, setCode] = useState(initial?.regionCode ?? "");

	useEffect(() => {
		if (open) {
			setName(initial?.regionName ?? "");
			setCode(initial?.regionCode ?? "");
		}
	}, [open, initial?.regionName, initial?.regionCode]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName(initial?.regionName ?? "");
			setCode(initial?.regionCode ?? "");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="region-code">Code</Label>
						<Input
							id="region-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. REG001"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="region-name">Name</Label>
						<Input
							id="region-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Region name"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || !code.trim() || loading}
						onClick={() =>
							onSubmit({ regionName: name.trim(), regionCode: code.trim() })
						}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
