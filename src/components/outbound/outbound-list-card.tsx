import { useState, useMemo } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Search,
	Eye,
	CheckCircle,
	Calendar,
	Clock,
	PackageOpen,
	AlertCircle,
	ChevronRight,
	FlaskConical,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { PurchaseOrderDetail } from "@/data/purchase-orders.types";
import {
	purchaseOrderStatuses,
	getStatusColor,
	getNetSuiteStatusColor,
	formatStatus,
	getPurchaseOrderStatusColor,
	formatDeliveryOrderStepStatus,
	getDeliveryOrderStepStatusColor,
} from "@/lib/outbound";
import type { DeliveryTab } from "@/lib/outbound";
import { formatDeliveryDateHeader, formatWeekRange } from "@/lib/utils";
import {
	usePurchaseOrders,
	type PurchaseOrderStatusFilter,
} from "@/lib/hooks/use-purchase-orders";

interface OutboundListCardProps {
	onViewPurchaseOrder: (purchaseOrder: PurchaseOrderDetail) => void;
	onAcceptClick?: (purchaseOrder: PurchaseOrderDetail) => void;
	onAdvanceStep?: (purchaseOrder: PurchaseOrderDetail) => void;
	isAdvanceStepPending?: boolean;
	advancingDeliveryOrderId?: string | null;
	hasAcceptPermission?: boolean;
	cardClassName?: string;
}

export function OutboundListCard({
	onViewPurchaseOrder,
	onAcceptClick,
	onAdvanceStep,
	isAdvanceStepPending,
	advancingDeliveryOrderId,
	hasAcceptPermission,
	cardClassName,
}: OutboundListCardProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<PurchaseOrderStatusFilter>("ALL");
	const [activeTab, setActiveTab] = useState<DeliveryTab>("current-week");
	const [isTesting, setIsTesting] = useState(false);

	/** Today's date key in YYYY-MM-DD format, using UTC+8 business timezone. */
	const todayKey = useMemo(() => {
		const now = new Date();
		const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
		return `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, "0")}-${String(utc8.getUTCDate()).padStart(2, "0")}`;
	}, []);

	const { data, isLoading, isFetching, error, refetch } = usePurchaseOrders({
		searchTerm,
		statusFilter,
		activeTab,
		page: 1,
	});

	const purchaseOrdersByDate = data?.purchaseOrdersByDate ?? {};
	const allDateKeys = data?.paginatedDateKeys ?? [];
	const dateKeys = data?.dateKeys ?? [];

	const paginatedDateKeys = allDateKeys;

	const loading = isLoading || isFetching;
	const weekRangeLabel =
		activeTab === "current-week" && dateKeys.length > 0
			? formatWeekRange(dateKeys[0], dateKeys[dateKeys.length - 1])
			: null;

	return (
		<Card
			role="region"
			aria-labelledby="purchase-order-title"
			className={cardClassName}
		>
			<CardHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle
								id="purchase-order-title"
								className="text-xl font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								Delivery Order List
							</CardTitle>
							<CardDescription
								className="text-sm text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{weekRangeLabel
									? `This week: ${weekRangeLabel}`
									: "View and manage all purchase orders"}
							</CardDescription>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative">
								<Search
									className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									id="search-purchase-orders"
									placeholder="Search purchase orders..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-9 sm:w-64 rounded-lg border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									aria-label="Search purchase orders by PO number, outlet, or region"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(value) =>
									setStatusFilter(value as PurchaseOrderStatusFilter)
								}
							>
								<SelectTrigger
									className="sm:w-48 rounded-lg border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									aria-label="Filter by status"
								>
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Status</SelectItem>
									{purchaseOrderStatuses.map((status) => (
										<SelectItem
											key={status}
											value={status}
											className={getPurchaseOrderStatusColor(status)}
										>
											{formatStatus(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div
								className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30 px-3 py-1.5"
								title="Testing mode: show all scheduled dates, not just today"
							>
								<FlaskConical className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
								<span className="text-xs font-medium text-amber-700 select-none">Testing</span>
								<Switch
									id="testing-mode-toggle"
									checked={isTesting}
									onCheckedChange={setIsTesting}
									aria-label="Toggle testing mode to show all scheduled dates"
									className="data-[state=checked]:bg-amber-500"
								/>
							</div>
						</div>
					</div>
					<div
						className="flex gap-2 border-b"
						role="tablist"
						aria-label="Delivery period tabs"
					>
						<Button
							variant={activeTab === "current-week" ? "default" : "ghost"}
							onClick={() => setActiveTab("current-week")}
							className="rounded-lg rounded-b-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							role="tab"
							aria-selected={activeTab === "current-week"}
							aria-controls="purchase-order-table"
						>
							<Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
							Next Delivery
						</Button>
						<Button
							variant={activeTab === "past-weeks" ? "default" : "ghost"}
							onClick={() => setActiveTab("past-weeks")}
							className="rounded-lg rounded-b-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							role="tab"
							aria-selected={activeTab === "past-weeks"}
							aria-controls="purchase-order-table"
						>
							<Clock className="mr-2 h-4 w-4" aria-hidden="true" />
							Past Deliveries
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent
				className="relative px-0 pb-6"
				role="tabpanel"
				id="purchase-order-table"
				aria-labelledby="purchase-order-title"
			>
				<GlobalLoadingShadow />
				<div className="overflow-x-auto rounded-lg border mx-6">
					<Table aria-label="Purchase orders list">
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead scope="col" className="px-6">PO Number</TableHead>
								<TableHead scope="col" className="px-6">Outlet</TableHead>
								<TableHead scope="col" className="px-6">Region</TableHead>
								<TableHead scope="col" className="px-6">PO Status</TableHead>
								<TableHead scope="col" className="px-6">DO Status</TableHead>
								<TableHead scope="col" className="px-6">NetSuite (API)</TableHead>
								<TableHead scope="col" className="px-6 text-right">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<>
									<TableRow aria-hidden="true">
										<TableCell
											colSpan={7}
											className="sr-only px-6"
											role="status"
											aria-live="polite"
										>
											Loading purchase orders…
										</TableCell>
									</TableRow>
									{Array.from({ length: 8 }).map((_, i) => (
										<TableRow key={i}>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-24" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-32" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-20" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-16" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-20" />
											</TableCell>
											<TableCell className="px-6">
												<Skeleton className="h-5 w-12" />
											</TableCell>
											<TableCell className="px-6 text-right">
												<Skeleton className="h-8 w-20 ml-auto" />
											</TableCell>
										</TableRow>
									))}
								</>
							) : error ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="px-6 py-12 text-center"
										role="alert"
										aria-live="assertive"
									>
										<div className="flex flex-col items-center gap-4">
											<div className="rounded-full bg-destructive/10 p-3">
												<AlertCircle
													className="h-8 w-8 text-destructive"
													aria-hidden
												/>
											</div>
											<div>
												<p className="font-medium text-foreground">
													Failed to load purchase orders
												</p>
												<p className="mt-1 text-sm text-muted-foreground">
													{error instanceof Error
														? error.message
														: "Something went wrong."}
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
												onClick={() => refetch()}
											>
												Try again
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : paginatedDateKeys.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="px-6 py-12 text-center"
										role="status"
									>
										<div className="flex flex-col items-center gap-3">
											<div className="rounded-full bg-muted p-3">
												<PackageOpen
													className="h-10 w-10 text-muted-foreground"
													aria-hidden
												/>
											</div>
											<div>
												<p className="font-medium text-foreground">
													{activeTab === "current-week"
														? "No orders scheduled for this week"
														: "No purchase orders found"}
												</p>
												<p className="mt-1 text-sm text-muted-foreground">
													{activeTab === "current-week"
														? "Orders will appear here when they are scheduled for delivery."
														: "Try adjusting your search or filters."}
												</p>
											</div>
										</div>
									</TableCell>
								</TableRow>
							) : (
								paginatedDateKeys.flatMap((dateKey) => {
									const datePurchaseOrders =
										purchaseOrdersByDate[dateKey] ?? [];
									const deliveryDate = new Date(dateKey + "T12:00:00");
									const headerLabel = formatDeliveryDateHeader(deliveryDate);
									return [
										<TableRow
											key={dateKey}
											className="hover:bg-transparent bg-muted/50 border-l-4 border-l-primary/30"
										>
											<TableCell
												colSpan={7}
												className="px-6 font-semibold text-foreground py-3"
											>
												{headerLabel}
												{datePurchaseOrders.length > 0 && (
													<span className="ml-2 text-muted-foreground font-normal">
														({datePurchaseOrders.length}{" "}
														{datePurchaseOrders.length === 1
															? "order"
															: "orders"}
														)
													</span>
												)}
											</TableCell>
										</TableRow>,
										...(datePurchaseOrders.length === 0
											? [
													<TableRow key={`${dateKey}-empty`}>
														<TableCell
															colSpan={7}
															className="px-6 py-4 text-center text-sm text-muted-foreground italic"
														>
															No orders for this day
														</TableCell>
													</TableRow>,
												]
											: []),
										...datePurchaseOrders.map((purchaseOrder) => {
											return (
												<TableRow
													key={purchaseOrder.id}
													className="transition-colors hover:bg-muted/50"
												>
													<TableCell className="px-6 font-medium">
														{purchaseOrder.purchaseOrderNumber}
													</TableCell>
													<TableCell className="px-6">{purchaseOrder.toLocation}</TableCell>
													<TableCell className="px-6">
														{purchaseOrder.regionName ? (
															<div className="flex flex-col">
																<span>
																	{purchaseOrder.regionName}
																	{purchaseOrder.regionCode
																		? ` (${purchaseOrder.regionCode})`
																		: ""}
																</span>
															</div>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="px-6">
														<Badge
															variant="outline"
															className={getStatusColor(purchaseOrder.status)}
														>
															{formatStatus(purchaseOrder.status)}
														</Badge>
													</TableCell>
													<TableCell className="px-6">
														{purchaseOrder.deliveryOrder ? (
															<div className="flex items-center gap-2">
																<Badge
																	variant="outline"
																	className={getDeliveryOrderStepStatusColor(
																		purchaseOrder.deliveryOrder.status,
																	)}
																>
																	{formatDeliveryOrderStepStatus(
																		purchaseOrder.deliveryOrder.status,
																	)}
																</Badge>
																{onAdvanceStep &&
																	purchaseOrder.deliveryOrder.status !==
																		"DELIVERED" &&
																	purchaseOrder.deliveryOrder.status !==
																		"SHIPPED" &&
																(isTesting || dateKey === todayKey) && (
																		<Button
																			variant="outline"
																			size="sm"
																			className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
																			onClick={() =>
																				onAdvanceStep(purchaseOrder)
																			}
																			disabled={
																				isAdvanceStepPending &&
																				advancingDeliveryOrderId ===
																					purchaseOrder.deliveryOrder?.id
																			}
																			aria-label={`Mark ${purchaseOrder.purchaseOrderNumber} to next step`}
																		>
																			{isAdvanceStepPending &&
																			advancingDeliveryOrderId ===
																				purchaseOrder.deliveryOrder?.id
																				? "Updating…"
																				: "Next step"}
																			<ChevronRight className="ml-1 h-4 w-4" />
																		</Button>
																	)}
															</div>
														) : (
															<span className="text-muted-foreground text-sm">—</span>
														)}
													</TableCell>
													<TableCell className="px-6">
														<Badge
															variant="outline"
															className={getNetSuiteStatusColor(
																purchaseOrder.netsuiteStatus,
															)}
														>
															{purchaseOrder.netsuiteStatus || "N/A"}
														</Badge>
													</TableCell>
													<TableCell className="px-6 text-right">
														<div
															className="flex justify-end gap-1"
															role="group"
															aria-label={`Actions for ${purchaseOrder.purchaseOrderNumber}`}
														>
															<Button
																variant="ghost"
																size="icon"
																onClick={() =>
																	onViewPurchaseOrder(purchaseOrder)
																}
																className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
																aria-label={`View details for ${purchaseOrder.purchaseOrderNumber}`}
															>
																<Eye className="h-4 w-4" aria-hidden="true" />
															</Button>
															{hasAcceptPermission &&
																purchaseOrder.status === "preparing" && (
																	<Button
																		variant="ghost"
																		size="icon"
																		onClick={() => onAcceptClick?.(purchaseOrder)}
																		className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
																		aria-label={`Accept ${purchaseOrder.purchaseOrderNumber}`}
																	>
																		<CheckCircle
																			className="h-4 w-4 text-green-600"
																			aria-hidden="true"
																		/>
																	</Button>
																)}
														</div>
													</TableCell>
												</TableRow>
											);
										}),
									];
								})
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

export function useOutboundSummary() {
	const { data, isLoading } = usePurchaseOrders({ page: 1 });
	return { summary: data?.summary, isLoading };
}
