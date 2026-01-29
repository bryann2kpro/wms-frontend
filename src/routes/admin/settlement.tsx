import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Search,
	Eye,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	FileText,
	ExternalLink,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { usePermissions } from "@/lib/permissions";
import { getDOs, type DeliveryOrder, type DOStatus } from "@/data/do.mock-data";

export const Route = createFileRoute("/admin/settlement")({
	component: SettlementComponent,
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

function SettlementComponent() {
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { hasPermission } = usePermissions(user);
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const [searchTerm, setSearchTerm] = useState("");

	// Get DOs that are ready for settlement (collected or delivered)
	const { data, isLoading } = useQuery({
		queryKey: ["dos-settlement", { page, pageSize, searchTerm }],
		queryFn: () =>
			getDOs({
				page,
				pageSize,
				search: searchTerm,
				status: "ALL",
			}),
		staleTime: 30_000,
	});

	// Filter DOs that are in settlement status
	const settlementDOs =
		data?.items.filter(
			(do_) =>
				do_.status === "COLLECTED" ||
				do_.status === "DELIVERED_PENDING_PROOF" ||
				do_.status === "DELIVERED_CONFIRMED",
		) || [];

	const totalPages = data
		? Math.max(1, Math.ceil(settlementDOs.length / data.pageSize))
		: 1;

	const handleViewSettlement = (doId: string) => {
		navigate({
			to: "/admin/settlement/$id",
			params: { id: doId },
		});
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Settlement</h1>
					<p className="text-muted-foreground">
						Admin verification and DO settlement
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle>Settlement Queue</CardTitle>
							<CardDescription>
								DOs ready for settlement verification
							</CardDescription>
						</div>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search DOs..."
								value={searchTerm}
								onChange={(e) => {
									setSearchTerm(e.target.value);
									setPage(1);
								}}
								className="pl-9 sm:w-64"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent className="relative">
					<GlobalLoadingShadow />
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>DO Number</TableHead>
									<TableHead>TO Number</TableHead>
									<TableHead>Outlet</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Settlement Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="h-24 text-center text-muted-foreground"
										>
											Loading settlement queue...
										</TableCell>
									</TableRow>
								) : settlementDOs.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="h-24 text-center text-muted-foreground"
										>
											No DOs ready for settlement.
										</TableCell>
									</TableRow>
								) : (
									settlementDOs.map((do_) => {
										const checklist = getSettlementChecklist(do_);
										const settled = isFullySettled(checklist);
										return (
											<TableRow key={do_.id}>
												<TableCell className="font-medium">
													{do_.doNumber}
												</TableCell>
												<TableCell>{do_.toNumber}</TableCell>
												<TableCell>{do_.outlet}</TableCell>
												<TableCell>
													<Badge variant="outline">
														{do_.status.replace(/_/g, " ")}
													</Badge>
												</TableCell>
												<TableCell>
													{settled ? (
														<Badge
															variant="outline"
															className="bg-green-500/10 text-green-600 border-green-500/20"
														>
															<CheckCircle2 className="mr-1 h-3 w-3" />
															Settled
														</Badge>
													) : (
														<Badge
															variant="outline"
															className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
														>
															Pending
														</Badge>
													)}
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleViewSettlement(do_.id)}
													>
														<Eye className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
