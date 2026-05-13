import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { Edit, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	CREATE_REGION_MUTATION,
	type CreateRegionMutationData,
	DELETE_REGION_MUTATION,
	type DeleteRegionMutationData,
	REGIONS_QUERY,
	type RegionsQueryData,
	type RegionsQueryVariables,
	UPDATE_REGION_MUTATION,
	UPSERT_REGION_PRICING_MUTATION,
	type UpdateRegionMutationData,
	type UpsertRegionPricingMutationData,
} from "@/lib/graphql/regions";
import type { Region } from "@/lib/graphql/types";
import { ConfirmDeleteDialog, PAGE_SIZE } from "./shared";

export function RegionSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Region | null>(null);
	const [deleting, setDeleting] = useState<Region | null>(null);

	const queryVars: RegionsQueryVariables = {
		pageSize: PAGE_SIZE,
		pageNumber: page,
		...(search.trim() ? { filter: { regionName: search.trim() } } : {}),
	};

	const {
		data,
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [...qk.regions.all, queryVars],
		queryFn: () =>
			gqlRequest<RegionsQueryData, RegionsQueryVariables>(
				REGIONS_QUERY,
				queryVars,
			),
	});

	const { mutateAsync: createRegion, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateRegionMutationData>(CREATE_REGION_MUTATION, { input }),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutateAsync: updateRegion, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateRegionMutationData>(UPDATE_REGION_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: deleteRegion, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteRegionMutationData>(DELETE_REGION_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});
	const { mutateAsync: upsertPricing, isPending: pricingLoading } = useMutation(
		{
			mutationFn: (variables: { regionId: string; input: object }) =>
				gqlRequest<UpsertRegionPricingMutationData>(
					UPSERT_REGION_PRICING_MUTATION,
					variables,
				),
			onSuccess: () => refetch(),
		},
	);

	const list = data?.regions?.query ?? [];
	const pagination = data?.regions?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const createdBy = user?.id ?? "";

	const handleCreateSubmit = async (values: RegionFormValues) => {
		await createRegion({
			regionName: values.regionName,
			regionCode: values.regionCode,
			createdBy,
			updatedBy: createdBy,
		});
		if (values.rate) {
			// Pricing upsert is a no-op here since we don't have the regionId yet.
			// The user can set pricing by editing the region right after creation.
		}
	};

	const handleEditSubmit = async (
		values: RegionFormValues,
		regionId: string,
	) => {
		await updateRegion({
			id: regionId,
			input: {
				regionName: values.regionName,
				regionCode: values.regionCode,
				updatedBy: createdBy,
			},
		});
		if (values.rate) {
			await upsertPricing({
				regionId,
				input: {
					rate: parseFloat(values.rate),
					minQty: values.minQty ? parseFloat(values.minQty) : 5,
					sstRate: values.sstRate ? parseFloat(values.sstRate) / 100 : 0.06,
				},
			});
		}
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
							Regions
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Manage delivery region master data and pricing rates
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 w-48 rounded-lg border-muted-foreground/20"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							title={!createdBy ? "Sign in to create" : undefined}
							className="rounded-lg text-white"
							style={{ background: "var(--dashboard-accent)" }}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Region
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
									Code
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Name
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Rate (MYR/CTN)
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									Min Qty
								</TableHead>
								<TableHead
									className="px-6"
									style={{ fontFamily: "var(--dashboard-body)" }}
								>
									SST
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
										colSpan={6}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : list.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="h-24 px-6 text-center text-muted-foreground"
									>
										No regions found.
									</TableCell>
								</TableRow>
							) : (
								list.map((row) => (
									<TableRow
										key={row.regionId}
										className="transition-colors hover:bg-muted/50"
									>
										<TableCell className="px-6 font-mono text-sm">
											{row.regionCode}
										</TableCell>
										<TableCell className="px-6 font-medium">
											{row.regionName}
										</TableCell>
										<TableCell className="px-6">
											{row.pricing ? (
												<span className="font-medium tabular-nums">
													{parseFloat(row.pricing.rate).toFixed(2)}
												</span>
											) : (
												<Badge
													variant="outline"
													className="text-xs text-muted-foreground border-dashed"
												>
													Not set
												</Badge>
											)}
										</TableCell>
										<TableCell className="px-6 tabular-nums text-sm text-muted-foreground">
											{row.pricing
												? parseFloat(row.pricing.minQty).toFixed(0)
												: "—"}
										</TableCell>
										<TableCell className="px-6 tabular-nums text-sm text-muted-foreground">
											{row.pricing
												? `${(parseFloat(row.pricing.sstRate) * 100).toFixed(0)}%`
												: "—"}
										</TableCell>
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

			{/* Create dialog — pricing can be added after creation via edit */}
			<RegionFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) => handleCreateSubmit(values)}
				loading={createLoading || pricingLoading}
				title="Add Region"
				description="Create a new delivery region."
			/>

			{editing && (
				<RegionFormDialog
					key={editing.regionId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					initial={{
						regionName: editing.regionName,
						regionCode: editing.regionCode,
						rate: editing.pricing?.rate
							? parseFloat(editing.pricing.rate).toFixed(2)
							: "",
						minQty: editing.pricing?.minQty
							? parseFloat(editing.pricing.minQty).toFixed(0)
							: "5",
						sstRate: editing.pricing?.sstRate
							? (parseFloat(editing.pricing.sstRate) * 100).toFixed(0)
							: "6",
					}}
					onSubmit={(values) => handleEditSubmit(values, editing.regionId)}
					loading={updateLoading || pricingLoading}
					title="Edit Region"
					description="Update region details and delivery pricing."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.regionName}
					onConfirm={() => deleteRegion({ id: deleting.regionId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

// ============================================
// Form Types
// ============================================

interface RegionFormValues {
	regionName: string;
	regionCode: string;
	rate: string;
	minQty: string;
	sstRate: string;
}

// ============================================
// Region Form Dialog
// ============================================

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
	initial?: RegionFormValues;
	onSubmit: (v: RegionFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [name, setName] = useState(initial?.regionName ?? "");
	const [code, setCode] = useState(initial?.regionCode ?? "");
	const [rate, setRate] = useState(initial?.rate ?? "");
	const [minQty, setMinQty] = useState(initial?.minQty ?? "5");
	const [sstRate, setSstRate] = useState(initial?.sstRate ?? "6");

	useEffect(() => {
		if (open) {
			setName(initial?.regionName ?? "");
			setCode(initial?.regionCode ?? "");
			setRate(initial?.rate ?? "");
			setMinQty(initial?.minQty ?? "5");
			setSstRate(initial?.sstRate ?? "6");
		}
	}, [
		open,
		initial?.regionName,
		initial?.regionCode,
		initial?.rate,
		initial?.minQty,
		initial?.sstRate,
	]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName(initial?.regionName ?? "");
			setCode(initial?.regionCode ?? "");
			setRate(initial?.rate ?? "");
			setMinQty(initial?.minQty ?? "5");
			setSstRate(initial?.sstRate ?? "6");
		}
		onOpenChange(next);
	};

	const rateValid =
		rate === "" || (!Number.isNaN(parseFloat(rate)) && parseFloat(rate) >= 0);
	const minQtyValid =
		minQty === "" ||
		(!Number.isNaN(parseFloat(minQty)) && parseFloat(minQty) >= 0);
	const sstValid =
		sstRate === "" ||
		(!Number.isNaN(parseFloat(sstRate)) &&
			parseFloat(sstRate) >= 0 &&
			parseFloat(sstRate) <= 100);
	const canSave =
		name.trim() && code.trim() && rateValid && minQtyValid && sstValid;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl sm:max-w-md">
				<DialogHeader className="border-b bg-muted/50 pb-4">
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
					{/* Region identity */}
					<div className="grid gap-2">
						<Label
							htmlFor="region-code"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Code
						</Label>
						<Input
							id="region-code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. KV"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="region-name"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Name
						</Label>
						<Input
							id="region-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Region name"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>

					<Separator className="my-1" />

					{/* Pricing section */}
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<span
								className="flex h-5 w-5 items-center justify-center rounded"
								style={{ background: "var(--dashboard-accent-muted)" }}
								aria-hidden
							>
								<Tag
									className="h-3 w-3"
									style={{ color: "var(--dashboard-accent)" }}
								/>
							</span>
							<p
								className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
								style={{ fontFamily: '"Figtree", sans-serif' }}
							>
								Delivery Pricing
							</p>
						</div>
						<p
							className="text-xs text-muted-foreground pl-7"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							If total qty &lt; Min Qty, charge as Min Qty × Rate. SST applied
							on top.
						</p>
					</div>

					<div className="grid grid-cols-3 gap-3">
						<div className="grid gap-2 col-span-1">
							<Label
								htmlFor="region-rate"
								style={{ fontFamily: '"Figtree", sans-serif' }}
								className="text-xs"
							>
								Rate (MYR/CTN)
							</Label>
							<Input
								id="region-rate"
								type="number"
								min="0"
								step="0.01"
								value={rate}
								onChange={(e) => setRate(e.target.value)}
								placeholder="e.g. 12.50"
								className={`rounded-lg border-muted-foreground/20 ${!rateValid ? "border-destructive" : ""}`}
							/>
						</div>
						<div className="grid gap-2 col-span-1">
							<Label
								htmlFor="region-min-qty"
								style={{ fontFamily: '"Figtree", sans-serif' }}
								className="text-xs"
							>
								Min Qty (CTN)
							</Label>
							<Input
								id="region-min-qty"
								type="number"
								min="0"
								step="1"
								value={minQty}
								onChange={(e) => setMinQty(e.target.value)}
								placeholder="5"
								className={`rounded-lg border-muted-foreground/20 ${!minQtyValid ? "border-destructive" : ""}`}
							/>
						</div>
						<div className="grid gap-2 col-span-1">
							<Label
								htmlFor="region-sst"
								style={{ fontFamily: '"Figtree", sans-serif' }}
								className="text-xs"
							>
								SST (%)
							</Label>
							<Input
								id="region-sst"
								type="number"
								min="0"
								max="100"
								step="0.01"
								value={sstRate}
								onChange={(e) => setSstRate(e.target.value)}
								placeholder="6"
								className={`rounded-lg border-muted-foreground/20 ${!sstValid ? "border-destructive" : ""}`}
							/>
						</div>
					</div>

					{rate &&
						rateValid &&
						minQty &&
						minQtyValid &&
						sstRate &&
						sstValid && (
							<div
								className="rounded-lg px-3 py-2 text-xs text-muted-foreground"
								style={{
									background: "var(--dashboard-accent-muted)",
									fontFamily: '"Figtree", sans-serif',
								}}
							>
								Example: 3 CTN order → charge{" "}
								{parseFloat(minQty || "5").toFixed(0)} CTN × MYR{" "}
								{parseFloat(rate).toFixed(2)} = MYR{" "}
								{(parseFloat(minQty || "5") * parseFloat(rate)).toFixed(2)}{" "}
								excl. SST
							</div>
						)}
				</div>

				<DialogFooter className="border-t bg-muted/20 pt-4">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						disabled={!canSave || loading}
						onClick={() =>
							onSubmit({
								regionName: name.trim(),
								regionCode: code.trim(),
								rate: rate.trim(),
								minQty: minQty.trim(),
								sstRate: sstRate.trim(),
							})
						}
						className="rounded-lg text-white disabled:opacity-50"
						style={{ background: "var(--dashboard-accent)" }}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
