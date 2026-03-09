import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	RefreshCw,
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface IntegrationLog {
	id: string;
	action: string;
	endpoint?: string;
	status: "success" | "error" | "pending";
	timestamp: Date;
	errorMessage?: string;
	retryable?: boolean;
}

interface IntegrationLogPanelProps {
	entityId: string;
	entityType: "grn" | "po" | "do" | "invoice";
	onRetry?: (logId: string) => void;
	className?: string;
}

// Mock function to fetch integration logs
async function fetchIntegrationLogs(
	entityType: string,
	entityId: string,
): Promise<IntegrationLog[]> {
	// Simulate API call
	await new Promise((resolve) => setTimeout(resolve, 300));

	const now = new Date();
	const logs: IntegrationLog[] = [
		{
			id: "1",
			action: getActionName(entityType),
			endpoint: getEndpoint(entityType),
			status: "success",
			timestamp: new Date(now.getTime() - 3600000), // 1 hour ago
		},
		{
			id: "2",
			action: getActionName(entityType),
			endpoint: getEndpoint(entityType),
			status: "error",
			timestamp: new Date(now.getTime() - 7200000), // 2 hours ago
			errorMessage: "Connection timeout. Please try again.",
			retryable: true,
		},
		{
			id: "3",
			action: getActionName(entityType),
			endpoint: getEndpoint(entityType),
			status: "success",
			timestamp: new Date(now.getTime() - 86400000), // 1 day ago
		},
	];

	return logs;
}

function getActionName(entityType: string): string {
	const actions: Record<string, string> = {
		grn: "GRN Push to NetSuite",
		po: "PO Pull from NetSuite",
		do: "Delivery Confirmation Push",
		invoice: "Invoice Push to NetSuite",
	};
	return actions[entityType] || "Sync";
}

function getEndpoint(entityType: string): string {
	const endpoints: Record<string, string> = {
		grn: "/api/netsuite/grn",
		po: "/api/netsuite/purchase-orders",
		do: "/api/netsuite/delivery-confirmation",
		invoice: "/api/netsuite/invoice",
	};
	return endpoints[entityType] || "/api/netsuite/sync";
}

export function IntegrationLogPanel({
	entityId,
	entityType,
	onRetry,
	className,
}: IntegrationLogPanelProps) {
	const {
		data: logs,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["integration-logs", entityType, entityId],
		queryFn: () => fetchIntegrationLogs(entityType, entityId),
		staleTime: 30_000,
	});

	const getStatusIcon = (status: IntegrationLog["status"]) => {
		switch (status) {
			case "success":
				return <CheckCircle2 className="h-4 w-4 text-green-600" />;
			case "error":
				return <XCircle className="h-4 w-4 text-red-600" />;
			case "pending":
				return <Clock className="h-4 w-4 text-yellow-600" />;
		}
	};

	const getStatusColor = (status: IntegrationLog["status"]) => {
		switch (status) {
			case "success":
				return "bg-green-500/10 text-green-600 border-green-500/20";
			case "error":
				return "bg-red-500/10 text-red-600 border-red-500/20";
			case "pending":
				return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
		}
	};

	const formatTimestamp = (date: Date) => {
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	};

	const lastLog = logs && logs.length > 0 ? logs[0] : null;

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base">Integration Status</CardTitle>
						<CardDescription>NetSuite sync logs and status</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isLoading}
					>
						<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{lastLog && (
					<div className="rounded-lg border bg-muted/50 p-3">
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-2">
								{getStatusIcon(lastLog.status)}
								<span className="text-sm font-medium">Last Attempt</span>
							</div>
							<Badge
								variant="outline"
								className={getStatusColor(lastLog.status)}
							>
								{lastLog.status.toUpperCase()}
							</Badge>
						</div>
						<div className="space-y-1 text-xs text-muted-foreground">
							<p>
								<strong>Action:</strong> {lastLog.action}
							</p>
							{lastLog.endpoint && (
								<p>
									<strong>Endpoint:</strong> {lastLog.endpoint}
								</p>
							)}
							<p>
								<strong>Time:</strong> {formatTimestamp(lastLog.timestamp)}
							</p>
							{lastLog.errorMessage && (
								<div className="mt-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2">
									<AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
									<p className="text-red-600">{lastLog.errorMessage}</p>
								</div>
							)}
							{lastLog.retryable && onRetry && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => onRetry(lastLog.id)}
									className="mt-2 w-full"
								>
									<RefreshCw className="mr-2 h-3 w-3" />
									Retry
								</Button>
							)}
						</div>
					</div>
				)}

				{logs && logs.length > 1 && (
					<div>
						<p className="mb-2 text-sm font-medium">Recent Logs</p>
						<ScrollArea className="h-48">
							<div className="space-y-2">
								{logs.slice(1).map((log) => (
									<div
										key={log.id}
										className="flex items-start gap-3 rounded border bg-background p-2 text-xs"
									>
										{getStatusIcon(log.status)}
										<div className="flex-1 space-y-1">
											<div className="flex items-center justify-between">
												<span className="font-medium">{log.action}</span>
												<span className="text-muted-foreground">
													{formatTimestamp(log.timestamp)}
												</span>
											</div>
											{log.errorMessage && (
												<p className="text-red-600">{log.errorMessage}</p>
											)}
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>
				)}

				{isLoading && (
					<div className="text-center text-sm text-muted-foreground">
						Loading logs...
					</div>
				)}

				{!isLoading && (!logs || logs.length === 0) && (
					<div className="text-center text-sm text-muted-foreground">
						No integration logs available
					</div>
				)}
			</CardContent>
		</Card>
	);
}
