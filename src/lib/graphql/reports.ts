import { gql } from "@apollo/client";

export const GENERATE_REPORT_MUTATION = gql`
	mutation GenerateReport($input: GenerateReportInput!) {
		generateReport(input: $input) {
			pdfBase64
			filename
			s3Url
		}
	}
`;

export const INVOICE_SUMMARY_REPORT_DATA_QUERY = gql`
	query InvoiceSummaryReportData(
		$dateFrom: String!
		$dateTo: String!
		$regionId: ID!
	) {
		invoiceSummaryReportData(
			dateFrom: $dateFrom
			dateTo: $dateTo
			regionId: $regionId
		) {
			proformaId
			invoiceDate
			poNumber
			doNumber
			outlet
			region
			ctn
			amount
		}
	}
`;

export type ReportType = "INVOICE_SUMMARY" | "MOVEMENT_REPORT";

export type GenerateReportInput = {
	type: ReportType;
	regionId?: string;
	dateFrom?: string;
	dateTo?: string;
	saveToS3?: boolean;
};

export type GenerateReportPayload = {
	pdfBase64: string;
	filename: string;
	s3Url?: string | null;
};

export type GenerateReportMutationData = {
	generateReport: GenerateReportPayload;
};

export type GenerateReportMutationVariables = {
	input: GenerateReportInput;
};

export type InvoiceSummaryReportDataRow = {
	proformaId: string;
	invoiceDate: string;
	poNumber: string;
	doNumber: string;
	outlet: string;
	region: string;
	ctn: number;
	amount: number;
};

export type InvoiceSummaryReportDataQueryData = {
	invoiceSummaryReportData: InvoiceSummaryReportDataRow[];
};

export type InvoiceSummaryReportDataQueryVariables = {
	dateFrom: string;
	dateTo: string;
	regionId: string;
};
