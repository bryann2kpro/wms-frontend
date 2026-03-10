import { useState } from "react";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	SUPPLIERS_QUERY,
	type SuppliersQueryData,
	type SuppliersQueryVariables,
} from "@/lib/graphql/suppliers";
import {
	STOCK_UNITS_QUERY,
	type StockUnitsQueryData,
	type StockUnitsQueryVariables,
} from "@/lib/graphql/stock-units";
import {
	SKUS_QUERY,
	CREATE_SKUS_MUTATION,
	UPDATE_SKUS_MUTATION,
	DELETE_SKUS_MUTATION,
	type SkusQueryData,
	type SkusQueryVariables,
	type CreateSkusMutationData,
	type UpdateSkusMutationData,
	type DeleteSkusMutationData,
} from "@/lib/graphql/skus";
import type { Skus } from "@/lib/graphql/types";
import { Plus, Edit, Trash2, Search, Eye } from "lucide-react";
import { formatDateOnly, statusColors } from "@/lib/utils";
import { ConfirmDeleteDialog } from "./shared";
import { SkusFormDialog } from "./skus-form-dialog";
import { SkusSuppliersViewDialog } from "./skus-suppliers-view-dialog";

export function SkusSection() {
	const { user } = useCurrentUser();
	const [_page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Skus | null>(null);
	const [deleting, setDeleting] = useState<Skus | null>(null);
	const [viewingSuppliers, setViewingSuppliers] = useState<Skus | null>(null);

	const { data, loading, refetch } = useQuery<
		SkusQueryData,
		SkusQueryVariables
	>(SKUS_QUERY, {
		variables: {},
		fetchPolicy: "cache-and-network",
	});
	const allSkus: Skus[] = data?.skus?.query ?? [];

	const list = search.trim()
		? allSkus.filter(
				(sku: Skus) =>
					sku.skuCode.toLowerCase().includes(search.toLowerCase().trim()) ||
					sku.skuDescription
						.toLowerCase()
						.includes(search.toLowerCase().trim()),
			)
		: allSkus;

	const createdBy = user?.id ?? "";

	const { data: suppliersData } = useQuery<
		SuppliersQueryData,
		SuppliersQueryVariables
	>(SUPPLIERS_QUERY, { variables: {} });
	const suppliers = suppliersData?.suppliers.query ?? [];

	const { data: stockUnitsData } = useQuery<
		StockUnitsQueryData,
		StockUnitsQueryVariables
	>(STOCK_UNITS_QUERY, { variables: {} });
	const stockUnits = stockUnitsData?.stockUnits.query ?? [];

	const [createSkus, { loading: createLoading }] =
		useMutation<CreateSkusMutationData>(CREATE_SKUS_MUTATION, {
			refetchQueries: [{ query: SKUS_QUERY }],
			awaitRefetchQueries: true,
			onCompleted: () => {
				refetch();
				setIsCreateOpen(false);
			},
		});

	const [updateSkus, { loading: updateLoading }] =
		useMutation<UpdateSkusMutationData>(UPDATE_SKUS_MUTATION, {
			refetchQueries: [{ query: SKUS_QUERY }],
			awaitRefetchQueries: true,
			onCompleted: () => {
				refetch();
				setEditing(null);
			},
		});

	const [deleteSkus, { loading: deleteLoading }] =
		useMutation<DeleteSkusMutationData>(DELETE_SKUS_MUTATION, {
			refetchQueries: [{ query: SKUS_QUERY }],
			awaitRefetchQueries: true,
			onCompleted: () => {
				refetch();
				setDeleting(null);
			},
		});

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Skus</CardTitle>
						<CardDescription>Stock Keeping Units</CardDescription>
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
							Add Skus
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Code</TableHead>
							<TableHead>Description</TableHead>
							<TableHead>Price (RM)</TableHead>
							<TableHead>Quantity</TableHead>
							<TableHead>Loss</TableHead>
							<TableHead>Expiry Date</TableHead>
							<TableHead>UOM</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{(() => {
							if (loading) {
								return (
									<TableRow>
										<TableCell
											colSpan={9}
											className="h-24 text-center text-muted-foreground"
										>
											Loading...
										</TableCell>
									</TableRow>
								);
							}
							if (list.length === 0) {
								return (
									<TableRow>
										<TableCell
											colSpan={9}
											className="h-24 text-center text-muted-foreground"
										>
											No data found.
										</TableCell>
									</TableRow>
								);
							}
							return list.map((row: Skus) => {
								const status = row.isActive ? "active" : "inactive";
								const badgeStyle = statusColors[status];
								const uom = stockUnits.find(
									(unit) => unit.stockUnitId === row.skuUom,
								);
								const uomName = uom
									? `${uom.unitName} (${uom.unitCode})`
									: row.skuUom;
								const price =
									row.skuPrice != null
										? Number(row.skuPrice).toFixed(2)
										: "N/A";
								const expiryDate = row.skuExpiryDate
									? formatDateOnly(row.skuExpiryDate)
									: "N/A";

								return (
									<TableRow key={row.skuId}>
										<TableCell>{row.skuCode}</TableCell>
										<TableCell>{row.skuDescription}</TableCell>
										<TableCell>{price}</TableCell>
										<TableCell>{Number(row.skuQuantity).toFixed(2)}</TableCell>
										<TableCell>
											{Number(row.lossQuantity ?? 0).toFixed(2)}
										</TableCell>
										<TableCell>{expiryDate}</TableCell>
										<TableCell>{uomName}</TableCell>
										<TableCell>
											<Badge variant="outline" className={badgeStyle}>
												{row.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setViewingSuppliers(row)}
												title="View Suppliers"
											>
												<Eye className="h-4 w-4" />
											</Button>
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
								);
							});
						})()}
					</TableBody>
				</Table>
			</CardContent>

			<SkusSuppliersViewDialog
				open={viewingSuppliers !== null}
				onOpenChange={(open) => {
					if (!open) setViewingSuppliers(null);
				}}
				sku={viewingSuppliers}
				suppliers={suppliers}
			/>

			<SkusFormDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				suppliers={suppliers}
				stockUnits={stockUnits}
				onSubmit={(values) => {
					const expiryDate = values.skuExpiryDate
						? `${values.skuExpiryDate} 00:00:00.000000`
						: "";
					createSkus({
						variables: {
							input: {
								skuCode: values.skuCode,
								skuDescription: values.skuDescription,
								skuPrice:
									values.skuPrice === 0 || values.skuPrice === null
										? null
										: Number(values.skuPrice),
								skuQuantity: Number(values.skuQuantity),
								skuExpiryDate: expiryDate,
								skuUom: values.skuUom,
								skuSuppliers:
									values.skuSuppliers?.map((s) => ({
										supplierId: s.supplierId,
										originalSkuCode: s.originalSkuCode || null,
									})) || [],
								isActive: true,
							},
						},
					});
				}}
				loading={createLoading}
				title="Add SKU"
				description="Create a new Stock Keeping Unit"
			/>

			{editing && (
				<SkusFormDialog
					open={!!editing}
					onOpenChange={(open) => !open && setEditing(null)}
					suppliers={suppliers}
					stockUnits={stockUnits}
					initial={{
						skuCode: editing.skuCode,
						skuDescription: editing.skuDescription,
						skuPrice: editing.skuPrice,
						skuQuantity: editing.skuQuantity,
						lossQuantity: editing.lossQuantity ?? 0,
						skuExpiryDate: editing.skuExpiryDate,
						skuUom: editing.skuUom,
						skuSuppliers: editing.skuSuppliers,
						isActive: editing.isActive,
					}}
					onSubmit={(values) => {
						const expiryDate = values.skuExpiryDate
							? `${values.skuExpiryDate} 00:00:00.000000`
							: "";
						updateSkus({
							variables: {
								id: editing.skuId,
								input: {
									skuCode: values.skuCode,
									skuDescription: values.skuDescription,
									skuPrice:
										values.skuPrice === 0 || values.skuPrice === null
											? null
											: Number(values.skuPrice),
									skuQuantity: Number(values.skuQuantity),
									lossQuantity: Number(values.lossQuantity ?? 0),
									skuExpiryDate: expiryDate,
									skuUom: values.skuUom,
									skuSuppliers:
										values.skuSuppliers?.map((s) => ({
											supplierId: s.supplierId,
											originalSkuCode: s.originalSkuCode || null,
										})) || [],
									isActive: values.isActive,
								},
							},
						});
					}}
					loading={updateLoading}
					title="Edit SKU"
					description="Update Stock Keeping Unit details"
				/>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					open={!!deleting}
					onOpenChange={(open) => !open && setDeleting(null)}
					itemName={deleting.skuCode}
					onConfirm={() => deleteSkus({ variables: { id: deleting.skuId } })}
					loading={deleteLoading}
				/>
			)}
		</Card>
	);
}
