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
	ZONES_QUERY,
	CREATE_ZONE_MUTATION,
	UPDATE_ZONE_MUTATION,
	DELETE_ZONE_MUTATION,
	type ZonesQueryData,
	type ZonesQueryVariables,
	type CreateZoneMutationData,
	type UpdateZoneMutationData,
	type DeleteZoneMutationData,
} from "@/lib/graphql/zones";
import {
	WAREHOUSES_QUERY,
	type WarehousesQueryData,
} from "@/lib/graphql/warehouses";
import type { Zone, ZonePurpose } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { PAGE_SIZE, ConfirmDeleteDialog } from "./shared";

const ZONE_PURPOSES: ZonePurpose[] = [
	"GENERAL",
	"WET",
	"DRY",
	"AMBIENT",
	"DAMAGED",
];

const PURPOSE_BADGE_STYLE: Record<ZonePurpose, { bg: string; text: string }> =
	{
		GENERAL: { bg: "bg-gray-100", text: "text-gray-700" },
		WET: { bg: "bg-blue-100", text: "text-blue-700" },
		DRY: { bg: "bg-amber-100", text: "text-amber-700" },
		AMBIENT: { bg: "bg-green-100", text: "text-green-700" },
		DAMAGED: { bg: "bg-red-100", text: "text-red-700" },
	};

function PurposeBadge({ purpose }: { purpose: ZonePurpose }) {
	const style = PURPOSE_BADGE_STYLE[purpose];
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
		>
			{purpose}
		</span>
	);
}

export function ZoneSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [warehouseFilter, setWarehouseFilter] = useState<string>("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Zone | null>(null);
	const [deleting, setDeleting] = useState<Zone | null>(null);

	const zonesVars: ZonesQueryVariables = {
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
		queryKey: [...qk.zones.all, zonesVars],
		queryFn: () =>
			gqlRequest<ZonesQueryData, ZonesQueryVariables>(ZONES_QUERY, zonesVars),
	});

	const { data: warehousesData } = useQuery({
		queryKey: [...qk.warehouses.all, "zone-section"],
		queryFn: () =>
			gqlRequest<WarehousesQueryData>(WAREHOUSES_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
	});

	const { mutate: createZone, isPending: createLoading } = useMutation({
		mutationFn: (input: object) =>
			gqlRequest<CreateZoneMutationData>(CREATE_ZONE_MUTATION, { input }),
		onSuccess: () => {
			refetch();
			setIsCreateOpen(false);
		},
	});
	const { mutate: updateZone, isPending: updateLoading } = useMutation({
		mutationFn: (variables: { id: string; input: object }) =>
			gqlRequest<UpdateZoneMutationData>(UPDATE_ZONE_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setEditing(null);
		},
	});
	const { mutate: deleteZone, isPending: deleteLoading } = useMutation({
		mutationFn: (variables: { id: string }) =>
			gqlRequest<DeleteZoneMutationData>(DELETE_ZONE_MUTATION, variables),
		onSuccess: () => {
			refetch();
			setDeleting(null);
		},
	});

	const list = data?.zones?.query ?? [];
	const pagination = data?.zones?.pagination;
	const totalPages = pagination?.totalPages ?? 1;
	const currentPage = pagination?.currentPage ?? 1;
	const warehouses = warehousesData?.warehouses?.query ?? [];
	const createdBy = user?.id ?? "";

	const filteredList = search.trim()
		? list.filter(
				(z) =>
					z.zoneName.toLowerCase().includes(search.toLowerCase()) ||
					z.zoneCode.toLowerCase().includes(search.toLowerCase()),
			)
		: list;

	return (
		<Card className="dashboard-card">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle
							className="text-xl"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Zones
						</CardTitle>
						<CardDescription
							className="text-muted-foreground"
							style={{ fontFamily: "var(--dashboard-body)" }}
						>
							Warehouse zones with purpose classification
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
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search zones..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="w-full rounded-lg border-muted-foreground/20 pl-9 sm:w-48"
							/>
						</div>
						<Button
							onClick={() => setIsCreateOpen(true)}
							disabled={!createdBy}
							className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Zone
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
									Name
								</TableHead>
								<TableHead className="px-6" style={{ fontFamily: "var(--dashboard-body)" }}>
									Purpose
								</TableHead>
								<TableHead className="px-6 text-right" style={{ fontFamily: "var(--dashboard-body)" }}>
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={4} className="h-24 px-6 text-center text-muted-foreground">
										Loading...
									</TableCell>
								</TableRow>
							) : filteredList.length === 0 ? (
								<TableRow>
									<TableCell colSpan={4} className="h-24 px-6 text-center text-muted-foreground">
										No zones found.
									</TableCell>
								</TableRow>
							) : (
								filteredList.map((zone) => (
									<TableRow key={zone.zoneId} className="transition-colors hover:bg-muted/50">
										<TableCell className="px-6 font-mono text-sm">{zone.zoneCode}</TableCell>
										<TableCell className="px-6">{zone.zoneName}</TableCell>
										<TableCell className="px-6">
											<PurposeBadge purpose={zone.purpose} />
										</TableCell>
										<TableCell className="px-6 text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setEditing(zone)}
												className="rounded-lg"
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive rounded-lg"
												onClick={() => setDeleting(zone)}
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

			<ZoneFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				warehouses={warehouses}
				onSubmit={(values) =>
					createZone({ ...values, createdBy, updatedBy: createdBy })
				}
				loading={createLoading}
				title="Add Zone"
				description="Create a new warehouse zone."
			/>

			{editing && (
				<ZoneFormDialog
					key={editing.zoneId}
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					warehouses={warehouses}
					initial={{
						warehouseId: editing.warehouseId,
						zoneCode: editing.zoneCode,
						zoneName: editing.zoneName,
						purpose: editing.purpose,
					}}
					onSubmit={(values) =>
						updateZone({
							id: editing.zoneId,
							input: {
								zoneCode: values.zoneCode,
								zoneName: values.zoneName,
								purpose: values.purpose,
								updatedBy: createdBy,
							},
						})
					}
					loading={updateLoading}
					title="Edit Zone"
					description="Update zone details."
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={`${deleting.zoneName} (${deleting.zoneCode})`}
					onConfirm={() => deleteZone({ id: deleting.zoneId })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}

type ZoneFormValues = {
	warehouseId: string;
	zoneCode: string;
	zoneName: string;
	purpose: ZonePurpose;
};

function ZoneFormDialog({
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
	initial?: ZoneFormValues;
	onSubmit: (v: ZoneFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
}) {
	const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? "");
	const [zoneCode, setZoneCode] = useState(initial?.zoneCode ?? "");
	const [zoneName, setZoneName] = useState(initial?.zoneName ?? "");
	const [purpose, setPurpose] = useState<ZonePurpose>(
		initial?.purpose ?? "GENERAL",
	);

	useEffect(() => {
		if (open) {
			setWarehouseId(initial?.warehouseId ?? "");
			setZoneCode(initial?.zoneCode ?? "");
			setZoneName(initial?.zoneName ?? "");
			setPurpose(initial?.purpose ?? "GENERAL");
		}
	}, [open]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setWarehouseId(initial?.warehouseId ?? "");
			setZoneCode(initial?.zoneCode ?? "");
			setZoneName(initial?.zoneName ?? "");
			setPurpose(initial?.purpose ?? "GENERAL");
		}
		onOpenChange(next);
	};

	const isEdit = !!initial;
	const canSubmit = (isEdit || warehouseId) && zoneCode.trim() && zoneName.trim() && !loading;

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
							Zone Code
						</Label>
						<Input
							value={zoneCode}
							onChange={(e) => setZoneCode(e.target.value)}
							placeholder="e.g. Z-WET-01"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Zone Name
						</Label>
						<Input
							value={zoneName}
							onChange={(e) => setZoneName(e.target.value)}
							placeholder="e.g. Wet Storage Zone"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Purpose
						</Label>
						<Select
							value={purpose}
							onValueChange={(v) => setPurpose(v as ZonePurpose)}
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
								zoneCode: zoneCode.trim(),
								zoneName: zoneName.trim(),
								purpose,
							})
						}
						className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
