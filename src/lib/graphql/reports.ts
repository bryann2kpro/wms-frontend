import { gql } from "graphql-request";

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
		$deliveryDateSortOrder: DeliveryDateSortOrder
	) {
		invoiceSummaryReportData(
			dateFrom: $dateFrom
			dateTo: $dateTo
			regionId: $regionId
			deliveryDateSortOrder: $deliveryDateSortOrder
		) {
			proformaId
			invoiceDate
			deliveryDate
			poNumber
			doNumber
			outlet
			region
			ctn
			beforeTaxAmount
			afterTaxAmount
			amount
		}
	}
`;

export type ReportType = "INVOICE_SUMMARY" | "MOVEMENT_REPORT";
export type DeliveryDateSortOrder = "ASC" | "DESC";

export type GenerateReportInput = {
	type: ReportType;
	regionId?: string;
	dateFrom?: string;
	dateTo?: string;
	deliveryDateSortOrder?: DeliveryDateSortOrder;
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
	deliveryDate: string;
	poNumber: string;
	doNumber: string;
	outlet: string;
	region: string;
	ctn: number;
	beforeTaxAmount: number;
	afterTaxAmount: number;
	amount: number;
};

export type InvoiceSummaryReportDataQueryData = {
	invoiceSummaryReportData: InvoiceSummaryReportDataRow[];
};

export type InvoiceSummaryReportDataQueryVariables = {
	dateFrom: string;
	dateTo: string;
	regionId: string;
	deliveryDateSortOrder?: DeliveryDateSortOrder;
};

export type InventoryBalanceReportType = "WITHOUT_RACK" | "WITH_RACK";
export type InventoryBalanceExpiryType = "WITHOUT_EXPIRY" | "WITH_EXPIRY";

export const INVENTORY_BALANCE_REPORT_DATA_QUERY = gql`
	query InventoryBalanceReportData($type: InventoryBalanceReportType!, $expiryType: InventoryBalanceExpiryType) {
		inventoryBalanceReportData(type: $type, expiryType: $expiryType) {
			skuCode
			skuDescription
			unitCode
			onHandQty
			rackBreakdown {
				rackLabel
				expiryDate
				qty
			}
		}
	}
`;

export const GENERATE_STOCK_BALANCE_REPORT_MUTATION = gql`
	mutation GenerateStockBalanceReport($type: InventoryBalanceReportType!, $expiryType: InventoryBalanceExpiryType) {
		generateStockBalanceReport(type: $type, expiryType: $expiryType) {
			pdfBase64
			filename
		}
	}
`;

export type InventoryBalanceReportRackBreakdown = {
	rackLabel: string | null;
	expiryDate: string | null;
	qty: number;
};

export type InventoryBalanceReportRow = {
	skuCode: string;
	skuDescription: string;
	unitCode: string;
	onHandQty: number;
	rackBreakdown: InventoryBalanceReportRackBreakdown[];
};

export type InventoryBalanceReportDataQueryData = {
	inventoryBalanceReportData: InventoryBalanceReportRow[];
};

export type InventoryBalanceReportDataQueryVariables = {
	type: InventoryBalanceReportType;
	expiryType?: InventoryBalanceExpiryType;
};

export type GenerateStockBalanceReportMutationData = {
	generateStockBalanceReport: GenerateReportPayload;
};

export type GenerateStockBalanceReportMutationVariables = {
	type: InventoryBalanceReportType;
	expiryType?: InventoryBalanceExpiryType;
};
