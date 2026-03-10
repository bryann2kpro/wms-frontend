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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import {
	Plus,
	Edit,
	Trash2,
	Search,
	Eye,
	HelpCircle,
	ChevronLeft,
	ChevronRight,
	ImageOff,
	ArrowUpDown,
} from "lucide-react";
import { formatDateOnly, statusColors } from "@/lib/utils";
import { ConfirmDeleteDialog } from "./shared";
import { SkusFormDialog } from "./skus-form-dialog";
import { SkusSuppliersViewDialog } from "./skus-suppliers-view-dialog";

const SKUS_HELP_IMAGES_BASE = "/help/skus";

const SKUS_HELP_STEPS: Array<{
	title: string;
	description: string;
	image: string;
}> = [
	{
		title: "What this section does",
		image: `${SKUS_HELP_IMAGES_BASE}/step-1.png`,
		description:
			"View and manage all Stock Keeping Units (SKUs) used in your warehouse.",
	},
	{
		title: "Search and filter",
		image: `${SKUS_HELP_IMAGES_BASE}/step-2.png`,
		description:
			"Use the search box to quickly find SKUs by code or description.",
	},
	{
		title: "Create new SKU",
		image: `${SKUS_HELP_IMAGES_BASE}/step-3.png`,
		description:
			"Click Add SKU to create a new record with pricing, quantity, UOM, and suppliers.",
	},
	{
		title: "Edit and suppliers",
		image: `${SKUS_HELP_IMAGES_BASE}/step-4.png`,
		description:
			"Use the action buttons to edit SKU details, view suppliers, or remove inactive SKUs.",
	},
];

type SkuSortField = "CODE" | "DESCRIPTION" | "PRICE" | "QUANTITY" | "EXPIRY_DATE";

const SKU_SORT_FIELDS: Array<{ value: SkuSortField; label: string }> = [
	{ value: "CODE", label: "Code" },
	{ value: "DESCRIPTION", label: "Description" },
	{ value: "PRICE", label: "Price" },
	{ value: "QUANTITY", label: "Quantity" },
	{ value: "EXPIRY_DATE", label: "Expiry date" },
];

function HelpStepImage({
	src,
	stepNumber,
	alt,
}: {
	src: string;
	stepNumber: number;
	alt?: string;
}) {
	const [failed, setFailed] = useState(false);

	if (failed) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
					<ImageOff className="h-6 w-6" />
				</span>
				<span>
					Add screenshot: public/help/skus/step-{stepNumber}.png
				</span>
			</div>
		);
	}

	return (
		<img
			src={src}
			alt={alt ?? ""}
			className="h-full w-full object-contain object-top"
			onError={() => setFailed(true)}
		/>
	);
}

export function SkusSection() {
	const { user } = useCurrentUser();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [search, setSearch] = useState("");
	const [showLowStockOnly, setShowLowStockOnly] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editing, setEditing] = useState<Skus | null>(null);
	const [deleting, setDeleting] = useState<Skus | null>(null);
	const [viewingSuppliers, setViewingSuppliers] = useState<Skus | null>(null);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [helpStep, setHelpStep] = useState(0);
	const [sortField, setSortField] = useState<SkuSortField>("CODE");
	const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");

	const { data, loading, refetch } = useQuery<
		SkusQueryData,
		SkusQueryVariables
	>(SKUS_QUERY, {
		variables: {},
		fetchPolicy: "cache-and-network",
	});
	const allSkus: Skus[] = data?.skus?.query ?? [];

	const LOW_STOCK_THRESHOLD = 10;

	const list = allSkus
		.filter((sku) =>
			showLowStockOnly ? Number(sku.skuQuantity ?? 0) <= LOW_STOCK_THRESHOLD : true,
		)
		.filter((sku) => {
			if (!search.trim()) return true;
			const query = search.toLowerCase().trim();
			return (
				sku.skuCode.toLowerCase().includes(query) ||
				sku.skuDescription.toLowerCase().includes(query)
			);
		});

	const sortedList = [...list].sort((a, b) => {
		const direction = sortDirection === "ASC" ? 1 : -1;

		switch (sortField) {
			case "DESCRIPTION": {
				const aVal = a.skuDescription ?? "";
				const bVal = b.skuDescription ?? "";
				return aVal.localeCompare(bVal) * direction;
			}
			case "PRICE": {
				const aVal = a.skuPrice ?? 0;
				const bVal = b.skuPrice ?? 0;
				return (aVal - bVal) * direction;
			}
			case "QUANTITY": {
				const aVal = Number(a.skuQuantity ?? 0);
				const bVal = Number(b.skuQuantity ?? 0);
				return (aVal - bVal) * direction;
			}
			case "EXPIRY_DATE": {
				const aVal = a.skuExpiryDate ? new Date(a.skuExpiryDate).getTime() : 0;
				const bVal = b.skuExpiryDate ? new Date(b.skuExpiryDate).getTime() : 0;
				return (aVal - bVal) * direction;
			}
			case "CODE":
			default: {
				const aVal = a.skuCode ?? "";
				const bVal = b.skuCode ?? "";
				return aVal.localeCompare(bVal) * direction;
			}
		}
	});

	const totalItems = sortedList.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const currentPage = Math.min(page, totalPages);
	const startIndex = (currentPage - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	const paginatedList = sortedList.slice(startIndex, endIndex);

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
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							aria-label="Open help for SKUs"
							onClick={() => {
								setIsHelpOpen(true);
								setHelpStep(0);
							}}
						>
							<HelpCircle className="h-4 w-4" />
						</Button>
						<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
							<DialogContent className="sm:max-w-lg">
								<DialogHeader>
									<DialogTitle>SKU Management help</DialogTitle>
									<DialogDescription>
										Step {helpStep + 1} of {SKUS_HELP_STEPS.length}
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4">
									<div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
										<HelpStepImage
											src={SKUS_HELP_STEPS[helpStep].image}
											stepNumber={helpStep + 1}
											alt={SKUS_HELP_STEPS[helpStep].title}
										/>
									</div>
									<div>
										<h3 className="mb-1 text-sm font-semibold text-foreground">
											{SKUS_HELP_STEPS[helpStep].title}
										</h3>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{SKUS_HELP_STEPS[helpStep].description}
										</p>
									</div>
									<div className="flex items-center justify-between gap-4 pt-2">
										<div className="flex gap-1">
											{SKUS_HELP_STEPS.map((_, i) => (
												<button
													type="button"
													key={i}
													onClick={() => setHelpStep(i)}
													aria-label={`Go to help step ${i + 1}`}
													className={`h-2 rounded-full transition-colors ${
														i === helpStep
															? "w-6 bg-primary"
															: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
													}`}
												/>
											))}
										</div>
										<div className="flex gap-2">
											{helpStep > 0 ? (
												<Button
													variant="outline"
													size="sm"
													onClick={() => setHelpStep((s) => s - 1)}
												>
													<ChevronLeft className="mr-0.5 h-4 w-4" />
													Previous
												</Button>
											) : null}
											{helpStep < SKUS_HELP_STEPS.length - 1 ? (
												<Button
													size="sm"
													onClick={() => setHelpStep((s) => s + 1)}
												>
													Next
													<ChevronRight className="ml-0.5 h-4 w-4" />
												</Button>
											) : (
												<Button size="sm" onClick={() => setIsHelpOpen(false)}>
													Got it
												</Button>
											)}
										</div>
									</div>
								</div>
							</DialogContent>
						</Dialog>
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden
							/>
							<Input
								placeholder="Search by code or description..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="w-52 pl-9"
								aria-label="Search SKUs by code or description"
							/>
						</div>
						<Button
							variant={showLowStockOnly ? "secondary" : "outline"}
							size="sm"
							onClick={() => {
								setShowLowStockOnly((v) => !v);
								setPage(1);
							}}
							aria-pressed={showLowStockOnly}
						>
							Low stock only
						</Button>
						<div className="flex items-center gap-1.5">
							<ArrowUpDown
								className="h-4 w-4 text-muted-foreground"
								aria-hidden
							/>
							<Select
								value={sortField}
								onValueChange={(value: SkuSortField) => {
									setSortField(value);
									setPage(1);
								}}
							>
								<SelectTrigger
									className="w-36"
									aria-label="Sort SKUs by field"
								>
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									{SKU_SORT_FIELDS.map((f) => (
										<SelectItem key={f.value} value={f.value}>
											{f.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={sortDirection}
								onValueChange={(value: "ASC" | "DESC") => {
									setSortDirection(value);
									setPage(1);
								}}
							>
								<SelectTrigger
									className="w-32"
									aria-label="Sort SKUs direction"
								>
									<SelectValue placeholder="Order" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ASC">Ascending</SelectItem>
									<SelectItem value="DESC">Descending</SelectItem>
								</SelectContent>
							</Select>
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
											aria-live="polite"
										>
											Loading SKUs...
										</TableCell>
									</TableRow>
								);
							}
							if (paginatedList.length === 0) {
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
							return paginatedList.map((row: Skus) => {
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
				{!loading && totalItems > 0 && (
					<div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
						<div>
							Showing{" "}
							<span className="font-medium">
								{startIndex + 1}
							</span>{" "}
							-{" "}
							<span className="font-medium">
								{Math.min(endIndex, totalItems)}
							</span>{" "}
							of <span className="font-medium">{totalItems}</span> SKUs
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								disabled={currentPage === 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								aria-label="Previous page"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span>
								Page {currentPage} of {totalPages}
							</span>
							<Button
								variant="outline"
								size="icon"
								disabled={currentPage === totalPages}
								onClick={() =>
									setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p))
								}
								aria-label="Next page"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
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
