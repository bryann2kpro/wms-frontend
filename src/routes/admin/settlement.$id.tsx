import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { requirePermission } from "@/lib/rbac";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { IntegrationLogPanel } from "@/components/integration-log-panel";
import {
	ChevronLeft,
	CheckCircle2,
	XCircle,
	FileText,
	ExternalLink,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { usePermissions } from "@/lib/permissions";
import {
	getDOById,
	updateDOStatus,
	type DeliveryOrder,
} from "@/data/do.mock-data";

export const Route = createFileRoute("/admin/settlement/$id")({
	beforeLoad: async ({ context }) => {
		await requirePermission(context.queryClient, ["Settlement"]);
	},
	component: SettlementDetailComponent,
	head: () => ({
		meta: [
			{
				title: "Settlement Detail - SME Edaran WMS",
				description:
					"Review detailed settlement checklist, delivery evidence, and final settlement decisions.",
			},
		],
	}),
});

interface SettlementChecklist {
	stockPickedPackedCollected: boolean;
	delivered: boolean;
	signedDOUploaded: boolean;
	exceptionsResolved: boolean;
	netsuiteUpdated: boolean;
	invoiceIssued: boolean;
}

function getSettlementChecklist(do_: DeliveryOrder): SettlementChecklist {
	return {
		stockPickedPackedCollected:
			do_.status === "COLLECTED" ||
			do_.status === "DELIVERED_PENDING_PROOF" ||
			do_.status === "DELIVERED_CONFIRMED",
		delivered:
			do_.status === "DELIVERED_PENDING_PROOF" ||
			do_.status === "DELIVERED_CONFIRMED",
		signedDOUploaded: do_.status === "DELIVERED_CONFIRMED",
		exceptionsResolved:
			!do_.shortageDamageReports ||
			do_.shortageDamageReports.every(
				(r) => r.status === "approved" || r.status === "rejected",
			),
		netsuiteUpdated: true, // Mock - would check integration status
		invoiceIssued: true, // Mock - would check invoice status
	};
}

function isFullySettled(checklist: SettlementChecklist): boolean {
	return Object.values(checklist).every((v) => v === true);
}

function SettlementDetailComponent() {
	const { id } = useParams({ from: "/admin/settlement/$id" });
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { approve } = usePermissions(user);
	const queryClient = useQueryClient();

	const { data: do_, isLoading } = useQuery({
		queryKey: ["do", id],
		queryFn: () => getDOById(id),
		staleTime: 30_000,
	});

	const settleMutation = useMutation({
		mutationFn: () => updateDOStatus(id, "DELIVERED_CONFIRMED"),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["do", id] });
			queryClient.invalidateQueries({ queryKey: ["dos-settlement"] });
		},
	});

	if (isLoading || !do_) {
		return (
			<div className="container mx-auto p-6">
				<div className="text-center">Loading...</div>
			</div>
		);
	}

	const checklist = getSettlementChecklist(do_);
	const settled = isFullySettled(checklist);

	const checklistItems = [
		{
			label: "Stock picked/packed/collected",
			checked: checklist.stockPickedPackedCollected,
		},
		{ label: "Delivered", checked: checklist.delivered },
		{ label: "Signed DO uploaded", checked: checklist.signedDOUploaded },
		{ label: "Exceptions resolved", checked: checklist.exceptionsResolved },
		{ label: "NetSuite updated", checked: checklist.netsuiteUpdated },
		{ label: "Invoice issued", checked: checklist.invoiceIssued },
	];

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/admin/settlement" })}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="flex-1">
					<h1 className="text-3xl font-bold tracking-tight">
						Settlement - {do_.doNumber}
					</h1>
					<p className="text-muted-foreground">DO settlement verification</p>
				</div>
			</div>

			{/* Settlement Checklist */}
			<Card>
				<CardHeader>
					<CardTitle>Settlement Checklist</CardTitle>
					<CardDescription>
						Verify all items are completed before settling
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{checklistItems.map((item, index) => (
							<div
								key={index}
								className="flex items-center justify-between rounded-lg border p-3"
							>
								<span className="text-sm font-medium">{item.label}</span>
								{item.checked ? (
									<CheckCircle2 className="h-5 w-5 text-green-600" />
								) : (
									<XCircle className="h-5 w-5 text-red-600" />
								)}
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Actions</CardTitle>
					<CardDescription>Settlement actions and links</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							onClick={() =>
								navigate({
									to: "/admin/do-detail/$id",
									params: { id: do_.id },
								})
							}
						>
							<ExternalLink className="mr-2 h-4 w-4" />
							View DO Details
						</Button>
						{do_.shortageDamageReports &&
							do_.shortageDamageReports.length > 0 && (
								<Button
									variant="outline"
									onClick={() => navigate({ to: "/admin/exceptions" })}
								>
									<ExternalLink className="mr-2 h-4 w-4" />
									View Exceptions
								</Button>
							)}
						<Button
							variant="outline"
							onClick={() => navigate({ to: "/admin/invoices" })}
						>
							<FileText className="mr-2 h-4 w-4" />
							View Invoice
						</Button>
					</div>
					{approve("Settlement") && settled && (
						<Button
							onClick={() => settleMutation.mutate()}
							disabled={settleMutation.isPending}
							className="w-full"
						>
							<CheckCircle2 className="mr-2 h-4 w-4" />
							{settleMutation.isPending ? "Settling..." : "Close / Settle DO"}
						</Button>
					)}
				</CardContent>
			</Card>

			{/* Integration Log */}
			<IntegrationLogPanel
				entityId={do_.id}
				entityType="do"
				onRetry={(logId) => {
					console.log("Retry log:", logId);
				}}
			/>
		</div>
	);
}
