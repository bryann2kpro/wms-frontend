import { gql } from "@apollo/client";

export const GENERATE_REPORT_MUTATION = gql`
	mutation GenerateReport($input: GenerateReportInput!) {
		generateReport(input: $input) {
			pdfBase64
			filename
		}
	}
`;

export type ReportType = "INVOICE_SUMMARY" | "MOVEMENT_REPORT";

export type GenerateReportInput = {
	type: ReportType;
	regionId?: string;
	dateFrom?: string;
	dateTo?: string;
};

export type GenerateReportPayload = {
	pdfBase64: string;
	filename: string;
};

export type GenerateReportMutationData = {
	generateReport: GenerateReportPayload;
};

export type GenerateReportMutationVariables = {
	input: GenerateReportInput;
};
