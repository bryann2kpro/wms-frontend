import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	RefreshCw,
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
	ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationLogResult {
	id: string;
	status: "success" | "error" | "pending";
	action: string;
	endpoint: string;
	timestamp: Date;
	errorMessage?: string;
	retryable?: boolean;
	payload: Record<string, unknown>;
}

interface IntegrationLogPanelProps {
	entityId: string;
	entityType: "grn" | "po" | "do" | "invoice";
	onRetry?: (logId: string) => void;
	className?: string;
}

async function fetchIntegrationLog(
	entityType: string,
	entityId: string,
): Promise<IntegrationLogResult | null> {
	await new Promise((resolve) => setTimeout(resolve, 300));

	const actions: Record<string, string> = {
		grn: "GRN Push to NetSuite",
		po: "PO Pull from NetSuite",
		do: "Delivery Confirmation Push",
		invoice: "Invoice Push to NetSuite",
	};

	const endpoints: Record<string, string> = {
		grn: "/api/netsuite/grn",
		po: "/api/netsuite/purchase-orders",
		do: "/api/netsuite/delivery-confirmation",
		invoice: "/api/netsuite/invoice",
	};

	return {
		id: "1",
		status: "success",
		action: actions[entityType] || "Sync",
		endpoint: endpoints[entityType] || "/api/netsuite/sync",
		timestamp: new Date(Date.now() - 3600000),
		payload: {
			entityId,
			entityType,
			grnNo: "GRN-2024-0042",
			poNo: "PO-8812",
			warehouseCode: "WH-KL-01",
			receivedDate: "2024-12-15T08:30:00Z",
			items: [
				{
					skuCode: "SKU-001",
					description: "Widget A",
					expectedQty: 100,
					receivedQty: 98,
					lossQty: 2,
				},
				{
					skuCode: "SKU-002",
					description: "Widget B",
					expectedQty: 50,
					receivedQty: 50,
					lossQty: 0,
				},
			],
		},
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
	onRetry,
	className,
}: IntegrationLogPanelProps) {
	const [isPayloadOpen, setIsPayloadOpen] = useState(false);

	const {
		data: log,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["integration-log", entityType, entityId],
		queryFn: () => fetchIntegrationLog(entityType, entityId),
		staleTime: 30_000,
	});

	if (isLoading) {
		return (
			<div className={cn("space-y-3", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-6 w-6 rounded" />
				</div>
				<Skeleton className="h-10 w-full rounded-lg" />
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

	return (
		<div className={cn("space-y-3", className)}>
			{/* Heading */}
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
				>
					<RefreshCw className="h-3 w-3" />
				</Button>
			</div>

			{/* Status */}
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<StatusIcon className={cn("h-4 w-4", config.color)} />
					<span
						className="text-sm font-medium"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						{config.label}
					</span>
					<Badge variant="outline" className={cn("ml-auto text-[10px]", config.badgeClass)}>
						{log.status.toUpperCase()}
					</Badge>
				</div>
				<p className="text-[11px] text-muted-foreground pl-6">
					{formatTimestamp(log.timestamp)}
				</p>

				{log.errorMessage && (
					<div className="flex items-start gap-1.5 pl-6">
						<AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
						<p className="text-[11px] text-red-600">{log.errorMessage}</p>
					</div>
				)}
			</div>

			{/* Retry */}
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

			{/* Expandable JSON payload */}
			<div className="integration-payload-details">
				<button
					type="button"
					onClick={() => setIsPayloadOpen(!isPayloadOpen)}
					className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
				>
					<ChevronRight
						className={cn(
							"h-3 w-3 transition-transform duration-200",
							isPayloadOpen && "rotate-90",
						)}
					/>
					View payload
				</button>
				{isPayloadOpen && (
					<pre className="mt-2 text-[11px] leading-relaxed font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
						{JSON.stringify(log.payload, null, 2)}
					</pre>
				)}
			</div>
		</div>
	);
}
