import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
	Download,
	BarChart3,
	Package,
	Truck,
	ArrowRightLeft,
	Receipt,
} from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
	component: ReportsComponent,
});

type ReportType = "GRN" | "DO" | "Inventory" | "Movement" | "InvoiceSummary";

interface ReportConfig {
	type: ReportType;
	dateFrom?: Date;
	dateTo?: Date;
	format: "PDF" | "Excel" | "TXT";
}

const reportTypes: {
	value: ReportType;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}[] = [
	{ value: "GRN", label: "GRN Reports", icon: Package },
	{ value: "DO", label: "DO Reports", icon: Truck },
	{ value: "Inventory", label: "Inventory Reports", icon: BarChart3 },
	{ value: "Movement", label: "Movement Reports", icon: ArrowRightLeft },
	{ value: "InvoiceSummary", label: "Invoices Summary", icon: Receipt },
];

function ReportsComponent() {
	const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [format, setFormat] = useState<"PDF" | "Excel" | "TXT">("PDF");

	const handleGenerateReport = async () => {
		if (!selectedReport) return;

		// Mock report generation
		const config: ReportConfig = {
			type: selectedReport,
			dateFrom: dateFrom ? new Date(dateFrom) : undefined,
			dateTo: dateTo ? new Date(dateTo) : undefined,
			format,
		};

		// Simulate report generation
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Mock download
		const blob = new Blob([`Mock ${selectedReport} Report`], {
			type:
				format === "PDF"
					? "application/pdf"
					: format === "Excel"
						? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						: "text/plain",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${selectedReport}_Report_${new Date().toISOString().split("T")[0]}.${format.toLowerCase() === "excel" ? "xlsx" : format.toLowerCase()}`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Reports / Exports
					</h1>
					<p className="text-muted-foreground">Generate and export reports</p>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Report Types */}
				<Card>
					<CardHeader>
						<CardTitle>Available Reports</CardTitle>
						<CardDescription>Select a report type to generate</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-3 sm:grid-cols-2">
							{reportTypes.map((report) => {
								const Icon = report.icon;
								return (
									<Button
										key={report.value}
										variant={
											selectedReport === report.value ? "default" : "outline"
										}
										className="h-auto flex-col gap-2 p-4"
										onClick={() => setSelectedReport(report.value)}
									>
										<Icon className="h-6 w-6" />
										<span>{report.label}</span>
									</Button>
								);
							})}
						</div>
					</CardContent>
				</Card>

				{/* Report Configuration */}
				<Card>
					<CardHeader>
						<CardTitle>Report Configuration</CardTitle>
						<CardDescription>
							Configure report parameters and export format
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label>Date Range (Optional)</Label>
							<div className="grid gap-2 sm:grid-cols-2">
								<div>
									<Label htmlFor="dateFrom" className="text-xs">
										From
									</Label>
									<Input
										id="dateFrom"
										type="date"
										value={dateFrom}
										onChange={(e) => setDateFrom(e.target.value)}
									/>
								</div>
								<div>
									<Label htmlFor="dateTo" className="text-xs">
										To
									</Label>
									<Input
										id="dateTo"
										type="date"
										value={dateTo}
										onChange={(e) => setDateTo(e.target.value)}
									/>
								</div>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Export Format</Label>
							<Select
								value={format}
								onValueChange={(v) => setFormat(v as "PDF" | "Excel" | "TXT")}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="PDF">PDF</SelectItem>
									<SelectItem value="Excel">Excel (XLSX)</SelectItem>
									<SelectItem value="TXT">Text (TXT)</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Button
							onClick={handleGenerateReport}
							disabled={!selectedReport}
							className="w-full"
						>
							<Download className="mr-2 h-4 w-4" />
							Generate & Download Report
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
