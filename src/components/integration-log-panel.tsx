import { useQuery } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	Clock,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchItemReceipt, type ItemReceiptData } from "@/lib/es/item-receipt";
import { cn } from "@/lib/utils";

interface IntegrationLogResult {
	id: string;
	status: "success" | "error" | "pending";
	/** Overrides default label from statusConfig when set */
	headlineLabel?: string;
	action: string;
	endpoint: string;
	timestamp: Date;
	errorMessage?: string;
	retryable?: boolean;
	/** Item receipt body (lines, entity, externalid, etc.) */
	itemReceiptPayload: Record<string, unknown>;
	/** Integration / NetSuite callback (`nsResponse`) */
	esResponse: Record<string, unknown>;
}

interface IntegrationLogPanelProps {
	entityId: string;
	entityType: "grn" | "po" | "do" | "invoice";
	/** End User PO number — required for GRN item receipt lookup */
	poNo?: string | null;
	onRetry?: (logId: string) => void;
	className?: string;
}

function mapItemReceiptToLog(data: ItemReceiptData): IntegrationLogResult {
	const ns = data.nsResponse;
	let status: IntegrationLogResult["status"];
	let errorMessage: string | undefined;
	let headlineLabel: string | undefined;

	if (!ns.success) {
		status = "error";
		errorMessage = ns.message;
		headlineLabel = "Sync failed";
	} else {
		status = "success";
		headlineLabel = "Item receipt synced";
	}

	const timestamp = data.sentAt
		? new Date(data.sentAt)
		: data.payload?.timeStamp
			? new Date(data.payload.timeStamp)
			: new Date();

	return {
		id: data.id,
		status,
		headlineLabel,
		action: "Item receipt (NetSuite ES)",
		endpoint: "/v1/es/item-receipt",
		timestamp,
		errorMessage,
		itemReceiptPayload: data.payload as unknown as Record<string, unknown>,
		esResponse: data.nsResponse as unknown as Record<string, unknown>,
	};
}

const statusConfig = {
	success: {
		icon: CheckCircle2,
		label: "Synced to NetSuite",
		color: "text-green-600",
		badgeClass: "bg-green-500/10 text-green-600 border-green-500/20",
	},
	error: {
		icon: XCircle,
		label: "Sync failed",
		color: "text-red-600",
		badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
	},
	pending: {
		icon: Clock,
		label: "Pending sync",
		color: "text-yellow-600",
		badgeClass: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
	},
} as const;

function formatTimestamp(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

export function IntegrationLogPanel({
	entityId,
	entityType,
	poNo,
	onRetry,
	className,
}: IntegrationLogPanelProps) {
	const [isPayloadOpen, setIsPayloadOpen] = useState(false);
	const [isEsResponseOpen, setIsEsResponseOpen] = useState(false);

	const shouldFetchItemReceipt = entityType === "grn" && Boolean(poNo?.trim());

	const {
		data: log,
		isLoading,
		isError,
		error,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: ["integration-log", "item-receipt", entityType, entityId, poNo],
		queryFn: async () => {
			const po = poNo?.trim();
			if (!po) {
				throw new Error("Missing PO number for item receipt lookup.");
			}
			const data = await fetchItemReceipt(po);
			return mapItemReceiptToLog(data);
		},
		enabled: shouldFetchItemReceipt,
		staleTime: 30_000,
	});

	if (!shouldFetchItemReceipt) {
		const emptyMessage =
			entityType === "grn"
				? "No PO number on this GRN — item receipt status is unavailable."
				: "Integration details are not available for this record.";
		return (
			<div className={cn("space-y-2", className)}>
				<p
					className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Integration
				</p>
				<p className="text-xs text-muted-foreground">{emptyMessage}</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className={cn("space-y-3", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-6 w-6 rounded" />
				</div>
				<Skeleton className="h-10 w-full rounded-lg" />
				<p className="text-[11px] text-muted-foreground">
					Loading integration…
				</p>
			</div>
		);
	}

	if (isError) {
		const message =
			error instanceof Error ? error.message : "Failed to load item receipt.";
		return (
			<div className={cn("space-y-3", className)}>
				<div className="flex items-center justify-between">
					<p
						className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
						style={{ fontFamily: "var(--dashboard-body)" }}
					>
						Integration
					</p>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={() => refetch()}
						disabled={isFetching}
						aria-busy={isFetching}
					>
						<RefreshCw
							className={cn("h-3 w-3", isFetching && "animate-spin")}
						/>
					</Button>
				</div>
				<div className="flex items-start gap-1.5">
					<AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
					<p className="text-xs text-red-600">{message}</p>
				</div>
			</div>
		);
	}

	if (!log) {
		return (
			<div className={cn("space-y-2", className)}>
				<p
					className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Integration
				</p>
				<p className="text-xs text-muted-foreground">No integration data</p>
			</div>
		);
	}

	const config = statusConfig[log.status];
	const StatusIcon = config.icon;
	const headline = log.headlineLabel ?? config.label;

	return (
		<div className={cn("space-y-3", className)}>
			<div className="flex items-center justify-between">
				<p
					className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
					style={{ fontFamily: "var(--dashboard-body)" }}
				>
					Integration
				</p>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={() => refetch()}
					disabled={isFetching}
					aria-busy={isFetching}
				>
					<RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
				</Button>
			</div>

			<p className="text-[11px] text-muted-foreground -mt-1">{log.action}</p>

			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<StatusIcon className={cn("h-4 w-4", config.color)} />
					<span
						className="text-sm font-medium"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						{headline}
					</span>
					<Badge
						variant="outline"
						className={cn("ml-auto text-[10px]", config.badgeClass)}
					>
						{log.status.toUpperCase()}
					</Badge>
				</div>
				<p className="text-[11px] text-muted-foreground pl-6">
					{formatTimestamp(log.timestamp)}
				</p>

				<p className="text-[11px] text-muted-foreground pl-6 font-mono">
					{log.endpoint}
				</p>

				{log.errorMessage && (
					<div className="flex items-start gap-1.5 pl-6">
						<AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
						<p className="text-[11px] text-red-600">{log.errorMessage}</p>
					</div>
				)}
			</div>

			{log.retryable && onRetry && (
				<Button
					variant="outline"
					size="sm"
					onClick={() => onRetry(log.id)}
					className="w-full h-7 text-xs"
				>
					<RefreshCw className="mr-1.5 h-3 w-3" />
					Retry sync
				</Button>
			)}

			<div className="integration-payload-details space-y-2">
				<div>
					<button
						type="button"
						onClick={() => setIsPayloadOpen(!isPayloadOpen)}
						className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						aria-expanded={isPayloadOpen}
					>
						<ChevronRight
							className={cn(
								"h-3 w-3 transition-transform duration-200 shrink-0",
								isPayloadOpen && "rotate-90",
							)}
						/>
						View payload
					</button>
					{isPayloadOpen && (
						<section aria-label="Item receipt payload JSON" className="mt-2">
							<pre className="text-[11px] leading-relaxed font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
								{JSON.stringify(log.itemReceiptPayload, null, 2)}
							</pre>
						</section>
					)}
				</div>
				<div>
					<button
						type="button"
						onClick={() => setIsEsResponseOpen(!isEsResponseOpen)}
						className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						aria-expanded={isEsResponseOpen}
					>
						<ChevronRight
							className={cn(
								"h-3 w-3 transition-transform duration-200 shrink-0",
								isEsResponseOpen && "rotate-90",
							)}
						/>
						View ES response
					</button>
					{isEsResponseOpen && (
						<section aria-label="ES integration response JSON" className="mt-2">
							<pre className="text-[11px] leading-relaxed font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
								{JSON.stringify(log.esResponse, null, 2)}
							</pre>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
