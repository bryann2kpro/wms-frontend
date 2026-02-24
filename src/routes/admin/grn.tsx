import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation as useApolloMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Plus,
	Search,
	Eye,
	CheckCircle,
	XCircle,
	ChevronLeft,
	ChevronRight,
	Edit,
	Send,
	Package,
	Calendar,
	FileText,
	Upload,
	User,
	Clock,
	Info,
} from "lucide-react";
import {
	type GRNDetail,
	type GRNStatus,
	type GRNStatusFilter,
} from "@/data/grn.mock-data";
import { usePermissions } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import { SkuCombobox } from "@/components/grn/sku-combobox";
import { useQuery as useApolloQuery } from "@apollo/client/react";
import { STOCK_UNITS_QUERY, type StockUnitsQueryData } from "@/lib/graphql/stock-units";
import {
	GRNS_QUERY,
	CREATE_GRN_MUTATION,
	UPDATE_GRN_STATUS_MUTATION,
	mapGrnsQueryToResult,
	GQL_STATUS_TO_UI,
	UI_STATUS_TO_GQL,
	type GrnsQueryData,
} from "@/lib/graphql/grns";
import { Skus } from "@/lib/graphql/types";
import { SKUS_QUERY, type SkusQueryData, type SkusQueryVariables } from "@/lib/graphql/skus";

export const Route = createFileRoute("/admin/grn")({
	component: GRNRouteComponent,
});

const grnStatuses: GRNStatus[] = [
	"Draft",
	"Submitted",
	"Failed",
];

export type CreateGRNLineItem = {
	skuCode: string;
	description: string;
	qty: number;
	uom: string;
	unitPrice: number;
};

const createGRNSchema = z.object({
	grnNumber: z
		.string(),
	// .min(1, "GRN number is required")
	// .regex(/^GRN-20\d{2}-[A-Z0-9]+$/, "Use format like GRN-2024-001"),
	poReference: z.string().min(1, "PO Reference is required"),
	supplierDO: z.string().min(1, "Supplier DO is required"),
	receivedDate: z.string().min(1, "Received date is required"),
	notes: z.string(),
});

function CreateGRNLineRow({
	item,
	index,
	items,
	onItemsChange,
	skuCodes,
	skuOptions,
	stockUnits,
}: {
	item: CreateGRNLineItem;
	index: number;
	items: CreateGRNLineItem[];
	onItemsChange: (newItems: CreateGRNLineItem[]) => void;
	skuCodes: string[];
	skuOptions: Skus[];
	stockUnits: Array<{ stockUnitId: string; unitCode: string }>;
}) {
	const usedByOthersKey = items
		.filter((_, i) => i !== index)
		.map((it) => it.skuCode)
		.filter(Boolean)
		.sort()
		.join(",");
	const availableSkuCodes = useMemo(() => {
		const usedByOthers = new Set(
			usedByOthersKey ? usedByOthersKey.split(",") : [],
		);
		return skuCodes.filter(
			(code) => !usedByOthers.has(code) || code === (item.skuCode ?? ""),
		);
	}, [usedByOthersKey, item.skuCode, skuCodes]);

	const itemsWithCustom = useMemo(() => {
		const current = item.skuCode?.trim() ?? "";
		if (!current || availableSkuCodes.includes(current)) return availableSkuCodes;
		return [...availableSkuCodes, current];
	}, [availableSkuCodes, item.skuCode]);

	const inputValueChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onInputValueChange = useCallback(
		(inputValue: string) => {
			const trimmed = inputValue?.trim() ?? "";
			if (trimmed === (item.skuCode ?? "")) return;
			if (inputValueChangeTimeoutRef.current) {
				clearTimeout(inputValueChangeTimeoutRef.current);
			}
			inputValueChangeTimeoutRef.current = setTimeout(() => {
				inputValueChangeTimeoutRef.current = null;
				const newItems = [...items];
				newItems[index] = { ...newItems[index], skuCode: trimmed };
				onItemsChange(newItems);
			}, 400);
		},
		[item.skuCode
			, index, items, onItemsChange],
	);

	useEffect(
		() => () => {
			if (inputValueChangeTimeoutRef.current) {
				clearTimeout(inputValueChangeTimeoutRef.current);
			}
		},
		[],
	);

	return (
		<TableRow key={`line-${index}-${item.skuCode || "new"}`}>
			<TableCell>
				<Combobox
					items={itemsWithCustom}
					value={item.skuCode ?? ""}
					onValueChange={(value) => {
						if (inputValueChangeTimeoutRef.current) {
							clearTimeout(inputValueChangeTimeoutRef.current);
							inputValueChangeTimeoutRef.current = null;
						}
						const sku = skuOptions.find((s: Skus) => s.skuCode === value);
						const uomUnit = sku
							? stockUnits.find(
									(u) =>
										u.stockUnitId === sku.skuUom ||
										u.unitCode === sku.skuUom,
								)
							: undefined;
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							skuCode: value ?? "",
							description: sku?.skuDescription ?? newItems[index].description ?? "",
							uom:
								uomUnit?.unitCode ??
								sku?.skuUom ??
								newItems[index].uom ??
								"",
						};
						onItemsChange(newItems);
					}}
					onInputValueChange={onInputValueChange}
				>
					<ComboboxInput
						placeholder="SKU code"
						className="font-medium min-w-[160px]"
					/>
					<ComboboxContent>
						<ComboboxList>
							{(skuCode: string) => {
								const s = skuOptions.find((o) => o.skuCode === skuCode);
								return (
									<ComboboxItem key={skuCode} value={skuCode}>
										{s?.skuDescription ?? skuCode}
									</ComboboxItem>
								);
							}}
						</ComboboxList>
						<ComboboxEmpty>No SKU found.</ComboboxEmpty>
					</ComboboxContent>
				</Combobox>
			</TableCell>
			<TableCell>
				<Input
					value={item.description}
					onChange={(e) => {
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							skuCode: e.target.value,
						};
						onItemsChange(newItems);
					}}
					placeholder="SKU ID"
				/>
			</TableCell>
			<TableCell>
				<Input
					type="number"
					min={1}
					value={item.qty}
					onChange={(e) => {
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							qty: Number(e.target.value) || 1,
						};
						onItemsChange(newItems);
					}}
					className="w-20"
				/>
			</TableCell>
			<TableCell>
				<Select
					value={item.uom}
					onValueChange={(value) => {
						const newItems = [...items];
						newItems[index] = {
							...newItems[index],
							uom: value,
						};
						onItemsChange(newItems);
					}}
				>
					<SelectTrigger className="w-[120px]">
						<SelectValue placeholder="UOM" />
					</SelectTrigger>
					<SelectContent>
						{stockUnits.map((unit) => (
							<SelectItem key={unit.stockUnitId} value={unit.unitCode}>
								{unit.unitCode}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell className="text-right">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
					className="text-destructive hover:text-destructive"
				>
					<XCircle className="h-4 w-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
}

function GRNRouteComponent() {
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<GRNStatusFilter>("ALL");
	const [selectedGRN, setSelectedGRN] = useState<GRNDetail | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
	const { data: stockUnitsData } = useApolloQuery<
		StockUnitsQueryData
	>(STOCK_UNITS_QUERY);
	const stockUnits = stockUnitsData?.stockUnits?.query ?? [];
	const { data: skusData } = useApolloQuery<SkusQueryData, SkusQueryVariables>(SKUS_QUERY, { variables: {} });
	const skuOptions: Skus[] = skusData?.skus?.query ?? [];
	const skuCodes = useMemo(() => skuOptions.map((s) => s.skuCode), [skuOptions]);

	const {
		data: grnsQueryData,
		loading: grnsLoading,
		refetch: refetchGRNs,
	} = useQuery<GrnsQueryData>(GRNS_QUERY, {
		variables: {
			filters: {
				page,
				pageSize,
				search: searchTerm || undefined,
				status: statusFilter === "ALL" ? undefined : statusFilter,
			},
		},
		fetchPolicy: "cache-and-network",
	});

	const emptyResult: import("@/data/grn.mock-data").GRNListResult = {
		items: [],
		summary: { byStatus: { Draft: 0, Submitted: 0, Approved: 0, "Sent-to-ES": 0, Failed: 0 }, total: 0 },
		page: 1,
		pageSize: 10,
		total: 0,
	};
	const data = grnsQueryData?.grns != null ? mapGrnsQueryToResult(grnsQueryData.grns) : emptyResult;
	const isLoading = grnsLoading;

	const [createGRNApollo, { loading: createLoading }] = useApolloMutation(
		CREATE_GRN_MUTATION,
		{
			onCompleted: () => {
				refetchGRNs();
				setIsCreateOpen(false);
			},
		}
	);

	const [updateGRNStatusApollo, { loading: statusUpdating }] = useApolloMutation(
		UPDATE_GRN_STATUS_MUTATION,
		{
			onCompleted: () => {
				refetchGRNs();
			},
		}
	);

	function mapCreateGRNToDetail(g: {
		id: string;
		grnNumber: string;
		supplier: string;
		status: string;
		poReference: string | null;
		supplierDO: string | null;
		receivedDate: string;
		createdAt: string;
		createdBy: string;
		notes: string | null;
		totalItems: number;
		receivedItems: number;
		totalAmount: number;
		items: Array<{ id: string; sku: string; description: string; expectedQuantity: number; receivedQuantity: number; location: string | null }>;
	}): GRNDetail {
		return {
			...g,
			status: GQL_STATUS_TO_UI[g.status] ?? "Draft",
			poReference: g.poReference ?? undefined,
			supplierDO: g.supplierDO ?? undefined,
			receivedDate: new Date(g.receivedDate),
			createdAt: new Date(g.createdAt),
			notes: g.notes ?? undefined,
			items: g.items.map((i) => ({ ...i, location: i.location ?? undefined })),
		} as GRNDetail;
	}

	const createMutation = {
		mutateAsync: async (payload: {
			grnNumber: string;
			poReference: string;
			supplierDO: string;
			receivedDate: Date;
			notes?: string;
			items?: Array<{ sku: string; description?: string; qty: number; uom?: string; unitPrice?: number }>;
		}) => {
			const result = await createGRNApollo({
				variables: {
					input: {
						grnNumber: payload.grnNumber,
						poReference: payload.poReference,
						supplierDO: payload.supplierDO,
						receivedDate: payload.receivedDate.toISOString(),
						notes: payload.notes ?? null,
						items: payload.items?.map((i) => ({
							sku: i.sku,
							description: i.description ?? undefined,
							qty: i.qty,
							uom: i.uom,
							// unitPrice: i.unitPrice,
						})),
					},
				},
			});
			// if (!result.data?.createGRN) throw new Error("Create GRN failed");
			// return mapCreateGRNToDetail(result.data.createGRN as Parameters<typeof mapCreateGRNToDetail>[0]);
		},
		isPending: createLoading,
	};

	const statusMutation = {
		mutateAsync: async ({ id, status }: { id: string; status: GRNStatus }) => {
			await updateGRNStatusApollo({
				variables: { id, status: UI_STATUS_TO_GQL[status] },
			});
			return undefined;
		},
		mutate: ({ id, status }: { id: string; status: GRNStatus }) => {
			updateGRNStatusApollo({
				variables: { id, status: UI_STATUS_TO_GQL[status] },
			});
		},
		isPending: statusUpdating,
		status: statusUpdating ? ("pending" as const) : ("idle" as const),
	};

	const form = useForm({
		defaultValues: {
			grnNumber: "",
			poReference: "",
			supplierDO: "",
			receivedDate: "",
			notes: "",
			items: [] as CreateGRNLineItem[],
		},
		// validators: {
		// 	onBlur: createGRNSchema,
		// 	onSubmit: createGRNSchema,
		// },
		onSubmit: async ({ value }) => {
			const parsedDate = new Date(value.receivedDate);
			const payload = {
				grnNumber: value.grnNumber,
				poReference: value.poReference,
				supplierDO: value.supplierDO,
				receivedDate: parsedDate,
				notes: value.notes || undefined,
				items: (value.items ?? []).map((i) => ({
					sku: i.skuCode,
					description: i.description,
					qty: i.qty,
					uom: i.uom,
					unitPrice: i.unitPrice,
				})),
			};
			console.log("[GRN Submit] Form value (raw):", value);
			console.log("[GRN Submit] Payload passed to createMutation:", payload);
			await createMutation.mutateAsync(payload);
			form.reset();
		},
	});

	const grns = data?.items ?? [];
	const summary = data?.summary;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	const getStatusColor = (status: GRNStatus | null | undefined) => {
		if (!status) return "bg-gray-500/10 text-gray-600 border-gray-500/20";
		const colors: Record<GRNStatus, string> = {
			Draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
			Submitted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
			Approved: "bg-green-500/10 text-green-600 border-green-500/20",
			"Sent-to-ES": "bg-purple-500/10 text-purple-600 border-purple-500/20",
			Failed: "bg-red-500/10 text-red-600 border-red-500/20",
		};
		return colors[status] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
	};

	const formatStatus = (status: string) =>
		status
			.toLowerCase()
			.replace("_", " ")
			.replace(/\b\w/g, (l) => l.toUpperCase());

	const handleViewGRN = (grn: GRNDetail) => {
		setSelectedGRN(grn);
		setIsViewOpen(true);
	};

	const handleUpdateStatus = (id: string, status: GRNStatus) => {
		statusMutation.mutate({ id, status });
		if (isViewOpen) {
			setIsViewOpen(false);
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Goods Receipt Notes (GRN)
					</h1>
					<p className="text-muted-foreground">
						Manage incoming inventory and track receipts
					</p>
				</div>
				<Dialog
					open={isCreateOpen}

					onOpenChange={(open) => {
						if (!open) {
							(document.activeElement as HTMLElement | null)?.blur();
							form.reset();
							form.setFieldValue("items", []);
							setProofFiles([]);
						}
						setIsCreateOpen(open);
					}}
				>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Create GRN
						</Button>
					</DialogTrigger>
					<DialogContent
						className="max-h-[90vh] overflow-y-auto"
						style={{ maxWidth: "min(95vw, 1400px)" }}
					>
						<DialogHeader className="pb-4">
							<DialogTitle className="text-2xl font-semibold flex items-center gap-2">
								<Package className="h-5 w-5 text-primary" />
								Create New GRN
							</DialogTitle>
							<DialogDescription className="text-base">
								Enter the details for the new goods receipt note
							</DialogDescription>
						</DialogHeader>
						<Separator />
						<div className="flex-1 pr-4 h-full overflow-y-auto min-h-0">
							<form
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
								className="space-y-6 py-4"
							>
								<div className="lg:grid-cols-3">
									<div className="lg:col-span-2 space-y-6">
										{/* Basic Information Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<FileText className="h-4 w-4 text-muted-foreground" />
													Basic Information
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<FieldGroup>
													<div className="grid gap-4 sm:grid-cols-2">
														<form.Field
															name="grnNumber"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
																return (
																	<Field data-invalid={isInvalid}>
																		<FieldLabel htmlFor={field.name}>
																			GRN Number
																		</FieldLabel>
																		<Input
																			id={field.name}
																			value={field.state.value}
																			placeholder="GRN-2024-001"
																			onBlur={field.handleBlur}
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
																			aria-invalid={isInvalid}
																		/>
																		{isInvalid && (
																			<FieldError errors={field.state.meta.errors} />
																		)}
																	</Field>
																);
															}}
														/>
														<form.Field
															name="poReference"
															children={(field) => {
																const isInvalid =
																	field.state.meta.isTouched &&
																	!field.state.meta.isValid;
																return (
																	<Field data-invalid={isInvalid}>
																		<FieldLabel htmlFor={field.name}>
																			PO Reference
																		</FieldLabel>
																		<Input
																			id={field.name}
																			value={field.state.value}
																			placeholder="PO-2024-001"
																			onBlur={field.handleBlur}
																			onChange={(e) =>
																				field.handleChange(e.target.value)
																			}
																			aria-invalid={isInvalid}
																		/>
																		{isInvalid && (
																			<FieldError errors={field.state.meta.errors} />
																		)}
																	</Field>
																);
															}}
														/>
													</div>

													<form.Field
														name="supplierDO"
														children={(field) => {
															const isInvalid =
																field.state.meta.isTouched &&
																!field.state.meta.isValid;
															return (
																<Field data-invalid={isInvalid}>
																	<FieldLabel htmlFor={field.name}>
																		Supplier DO
																	</FieldLabel>
																	<Input
																		id={field.name}
																		value={field.state.value}
																		placeholder="DO-2024-001"
																		onBlur={field.handleBlur}
																		required
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
																		aria-invalid={isInvalid}
																	/>
																	{isInvalid && (
																		<FieldError errors={field.state.meta.errors} />
																	)}
																</Field>
															);
														}}
													/>

													<form.Field
														name="receivedDate"
														children={(field) => {
															const isInvalid =
																field.state.meta.isTouched &&
																!field.state.meta.isValid;
															return (
																<Field data-invalid={isInvalid}>
																	<FieldLabel htmlFor={field.name} className="flex items-center gap-2">
																		<Calendar className="h-4 w-4 text-muted-foreground" />
																		Received Date/Time
																	</FieldLabel>
																	<Input
																		id={field.name}
																		type="datetime-local"
																		value={field.state.value}
																		onBlur={field.handleBlur}
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
																		aria-invalid={isInvalid}
																	/>
																	{isInvalid && (
																		<FieldError errors={field.state.meta.errors} />
																	)}
																</Field>
															);
														}}
													/>
												</FieldGroup>
											</CardContent>
										</Card>

										{/* Line Items Section - Form-based */}
										<Card>
											<CardHeader className="pb-3">
												<div className="flex items-center justify-between gap-4">
													<div>
														<CardTitle className="text-base font-semibold flex items-center gap-2">
															<Package className="h-4 w-4 text-muted-foreground" />
															Line Items
														</CardTitle>
														<CardDescription className="text-xs mt-1">
															Add line items and fill in the details below
														</CardDescription>
													</div>
													<form.Field name="items">
														{(field) => {
															const items =
																(field.state.value as CreateGRNLineItem[]) ?? [];
															return (
																<Button
																	type="button"
																	variant="default"
																	size="sm"
																	onClick={() => {
																		field.handleChange([
																			...items,
																			{
																				skuCode: "",
																				description: "",
																				uom: "",
																				unitPrice: 0,
																				qty: 1,
																			},
																		]);
																	}}
																>
																	<Plus className="mr-2 h-4 w-4" />
																	Add Line Item
																</Button>
															);
														}}
													</form.Field>
												</div>
											</CardHeader>
											<CardContent>
												<form.Field name="items">
													{(field) => {
														const items =
															(field.state.value as CreateGRNLineItem[]) ?? [];
														return (
															<>
																<div className="rounded-lg border">
																	<Table>
																		<TableHeader>
																			<TableRow>
																				<TableHead>SKU</TableHead>
																				<TableHead>Description</TableHead>
																				<TableHead>Qty</TableHead>
																				<TableHead>UOM</TableHead>
																				<TableHead className="text-right w-[80px]">
																					Actions
																				</TableHead>
																			</TableRow>
																		</TableHeader>
																		<TableBody>
																			{items.length === 0 ? (
																				<TableRow>
																					<TableCell
																						colSpan={5}
																						className="h-40 text-center"
																					>
																						<div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
																							<div className="rounded-full bg-muted p-3">
																								<Package className="h-10 w-10 opacity-60" />
																							</div>
																							<div>
																								<p className="text-sm font-medium">
																									No line items yet
																								</p>
																								<p className="text-xs mt-1">
																									Click &quot;Add Line Item&quot; above to add your first item, then fill in the table
																								</p>
																							</div>
																						</div>
																					</TableCell>
																				</TableRow>
																			) : (
																				items.map((item, index) => (
																					<CreateGRNLineRow
																						key={`line-${index}-${item.skuCode || "new"}`}
																						item={item}
																						index={index}
																						items={items}
																						onItemsChange={field.handleChange}
																						skuCodes={skuCodes}
																						skuOptions={skuOptions}
																						stockUnits={stockUnits}
																					/>
																				))
																			)}
																		</TableBody>
																	</Table>
																</div>
															</>
														);
													}}
												</form.Field>
											</CardContent>
										</Card>

										{/* Proof Upload Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<Upload className="h-4 w-4 text-muted-foreground" />
													Proof Upload
												</CardTitle>
												<CardDescription className="text-xs">
													Upload supporting documents (max 5 files)
												</CardDescription>
											</CardHeader>
											<CardContent>
												<FileUpload
													files={proofFiles}
													onFilesChange={setProofFiles}
													maxFiles={5}
													accept="image/*,application/pdf"
												/>
											</CardContent>
										</Card>

										{/* Notes Section */}
										<Card>
											<CardHeader className="pb-3">
												<CardTitle className="text-base font-semibold flex items-center gap-2">
													<FileText className="h-4 w-4 text-muted-foreground" />
													Additional Notes
												</CardTitle>
											</CardHeader>
											<CardContent>
												<form.Field
													name="notes"
													children={(field) => (
														<Field>
															<FieldLabel htmlFor={field.name} className="sr-only">
																Notes
															</FieldLabel>
															<Textarea
																id={field.name}
																value={field.state.value}
																placeholder="Enter any additional notes or comments..."
																onBlur={field.handleBlur}
																onChange={(e) => field.handleChange(e.target.value)}
																className="min-h-[100px] resize-none"
															/>
														</Field>
													)}
												/>
											</CardContent>
										</Card>
									</div>
								</div>

								<form.Subscribe
									selector={(state) => [state.isSubmitting, state.canSubmit]}
								>
									{([isSubmitting, canSubmit]) => (
										<>
											<Separator className="mt-6" />
											<DialogFooter className="pt-4">
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setIsCreateOpen(false);
														form.setFieldValue("items", []);
														setProofFiles([]);
													}}
													disabled={isSubmitting}
												>
													Cancel
												</Button>
												{hasPermission("grn:create") && (
													<>
														<Button
															type="button"
															variant="outline"
															onClick={() => {
																// Save as draft
																form.handleSubmit();
															}}
															disabled={isSubmitting}
														>
															Save Draft
														</Button>
														<Button
															type="submit"
															disabled={isSubmitting || !canSubmit}
															className="min-w-[140px]"
														>
															{isSubmitting ? (
																<>
																	<Clock className="mr-2 h-4 w-4 animate-spin" />
																	Submitting...
																</>
															) : (
																<>
																	<Send className="mr-2 h-4 w-4" />
																	Submit for Approval
																</>
															)}
														</Button>
													</>
												)}
											</DialogFooter>
										</>
									)}
								</form.Subscribe>
							</form>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{summary && summary.byStatus && (
				<div className="grid gap-3 md:grid-cols-3">
					{grnStatuses.map((status) => (
						<Card key={status}>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">
									{formatStatus(status)}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{summary.byStatus[status] ?? 0}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>GRN List</CardTitle>
							<CardDescription>
								View and manage all goods receipt notes
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search GRNs..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setPage(1);
									}}
									className="pl-9 sm:w-64"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(value) => {
									setStatusFilter(value as GRNStatusFilter);
									setPage(1);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Status</SelectItem>
									{grnStatuses.map((status) => (
										<SelectItem key={status} value={status}>
											{formatStatus(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>GRN Number</TableHead>
									<TableHead>PO Reference</TableHead>
									<TableHead>Supplier DO</TableHead>
									<TableHead>Received Date</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											Loading GRNs...
										</TableCell>
									</TableRow>
								) : grns.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											No GRNs found.
										</TableCell>
									</TableRow>
								) : (
									grns.map((grn) => (
										<TableRow key={grn.id}>
											<TableCell className="font-medium">
												{grn.grnNumber}
											</TableCell>
											<TableCell>{grn.poReference || "-"}</TableCell>
											<TableCell>{grn.supplierDO || "-"}</TableCell>
											<TableCell>
												{grn.receivedDate?.toLocaleDateString() || "-"}
											</TableCell>
											<TableCell>
												{grn.status ? (
													<Badge
														variant="outline"
														className={getStatusColor(grn.status)}
													>
														{formatStatus(grn.status)}
													</Badge>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleViewGRN(grn)}
													>
														<Eye className="h-4 w-4" />
													</Button>
													{hasPermission("grn:edit") &&
														grn.status &&
														(grn.status === "Draft" ||
															grn.status === "Submitted") && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() => {
																	setSelectedGRN(grn);
																	// setIsEditOpen(true);
																}}
															>
																<Edit className="h-4 w-4" />
															</Button>
														)}
													{hasPermission("grn:approve") &&
														grn.status === "Submitted" && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "Approved")
																}
																disabled={statusMutation.status === "pending"}
															>
																<CheckCircle className="h-4 w-4 text-green-600" />
															</Button>
														)}
													{hasPermission("grn:send_to_es") &&
														grn.status === "Approved" && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	handleUpdateStatus(grn.id, "Sent-to-ES")
																}
																disabled={statusMutation.status === "pending"}
															>
																<Send className="h-4 w-4 text-purple-600" />
															</Button>
														)}
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{data && (
						<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
							<div>
								Showing{" "}
								<span className="font-medium">
									{(data.page - 1) * data.pageSize + 1}
								</span>{" "}
								-{" "}
								<span className="font-medium">
									{Math.min(data.page * data.pageSize, data.total)}
								</span>{" "}
								of <span className="font-medium">{data.total}</span> GRNs
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={page === 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span>
									Page {page} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={page === totalPages}
									onClick={() =>
										setPage((p) => (data ? Math.min(totalPages, p + 1) : p))
									}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* View GRN Dialog */}
			<Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
				<DialogContent
					className="max-h-[90vh] overflow-y-auto"
					style={{ maxWidth: "min(95vw, 1400px)" }}
				>
					<DialogHeader>
						<DialogTitle>GRN Details</DialogTitle>
						<DialogDescription>
							View detailed information about this goods receipt note
						</DialogDescription>
					</DialogHeader>
					{selectedGRN && (
						<div className="grid gap-6 lg:grid-cols-3">
							<div className="lg:col-span-2 space-y-6">
								<ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
									<div className="space-y-6">
										<div className="grid gap-4 sm:grid-cols-2">
											<div>
												<Label className="text-xs text-muted-foreground">
													GRN Number
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.grnNumber}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													PO Reference
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.poReference || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Supplier DO
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.supplierDO || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Received Date
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.receivedDate?.toLocaleString() || "-"}
												</p>
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Status
												</Label>
												{selectedGRN.status ? (
													<Badge
														variant="outline"
														className={getStatusColor(selectedGRN.status)}
													>
														{formatStatus(selectedGRN.status)}
													</Badge>
												) : (
													<span className="text-sm text-muted-foreground">-</span>
												)}
											</div>
											<div>
												<Label className="text-xs text-muted-foreground">
													Created By
												</Label>
												<p className="text-sm font-medium">
													{selectedGRN.createdBy}
												</p>
											</div>
										</div>

										<div>
											<Label className="mb-2 block text-sm font-medium">
												Items
											</Label>
											<div className="rounded-lg border">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>SKU</TableHead>
															<TableHead>Description</TableHead>
															<TableHead>Expected</TableHead>
															<TableHead>Received</TableHead>
															<TableHead>Location</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{selectedGRN.items.map((item) => (
															<TableRow key={item.id}>
																<TableCell className="font-medium">
																	{item.sku}
																</TableCell>
																<TableCell>{item.description}</TableCell>
																<TableCell>{item.expectedQuantity}</TableCell>
																<TableCell>{item.receivedQuantity}</TableCell>
																<TableCell>
																	{item.location || "Not assigned"}
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>
										</div>

										{selectedGRN.notes && (
											<div>
												<Label className="text-xs text-muted-foreground">
													Notes
												</Label>
												<p className="text-sm">{selectedGRN.notes}</p>
											</div>
										)}
									</div>
								</ScrollArea>
							</div>

							{/* Right Panel: Audit Trail + Integration Status */}
							<div className="space-y-4">
								<Card>
									<CardHeader>
										<CardTitle className="text-sm">Audit Trail</CardTitle>
									</CardHeader>
									<CardContent className="text-xs space-y-2">
										<div>
											<p className="text-muted-foreground">Created By</p>
											<p className="font-medium">{selectedGRN.createdBy}</p>
										</div>
										<div>
											<p className="text-muted-foreground">Created At</p>
											<p className="font-medium">
												{selectedGRN.createdAt?.toLocaleString() || "-"}
											</p>
										</div>
									</CardContent>
								</Card>
								<IntegrationLogPanel
									entityId={selectedGRN.id}
									entityType="grn"
									onRetry={(logId) => {
										console.log("Retry log:", logId);
									}}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsViewOpen(false)}>
							Close
						</Button>
						{hasPermission("grn:approve") &&
							selectedGRN?.status === "Submitted" && (
								<Button
									onClick={() => {
										handleUpdateStatus(selectedGRN.id, "Approved");
									}}
									disabled={statusMutation.status === "pending"}
								>
									Approve
								</Button>
							)}
						{hasPermission("grn:send_to_es") &&
							selectedGRN?.status === "Approved" && (
								<Button
									onClick={() => {
										handleUpdateStatus(selectedGRN.id, "Sent-to-ES");
									}}
									disabled={statusMutation.status === "pending"}
								>
									<Send className="mr-2 h-4 w-4" />
									Send to ES
								</Button>
							)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
