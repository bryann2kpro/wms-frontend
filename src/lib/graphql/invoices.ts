import { gql } from "graphql-request";

// ---------------------------------------------------------------------------
// GraphQL Queries & Mutations
// ---------------------------------------------------------------------------

export const INVOICES_QUERY = gql`
	query Invoices($filter: InvoiceFilterInput, $pageSize: Int, $pageNumber: Int) {
		invoices(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				id
				invoiceNo
				doId
				doNo
				poId
				poNo
				poAmount
				poAmountCalcSnapshot
				dateIssued
				deliveryDate
				totalExclTax
				taxAmount
				totalInclTax
				taxRate
				status
				createdAt
				updatedAt
			}
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
			summary {
				issued
				sent
				cancelled
				totalAmount
			}
		}
	}
`;

export const INVOICE_QUERY = gql`
	query Invoice($id: ID!) {
		invoice(id: $id) {
			id
			invoiceNo
			doId
			doNo
			poId
			poNo
			poAmount
			poAmountCalcSnapshot
			dateIssued
			totalExclTax
			taxAmount
			totalInclTax
			taxRate
			status
			issuedAt
			createdAt
			updatedAt
			items {
				id
				invoiceId
				itemNo
				skuId
				skuCode
				description
				qty
				unitPrice
				subTotal
			}
		}
	}
`;

export const UPDATE_INVOICE_STATUS_MUTATION = gql`
	mutation UpdateInvoiceStatus($id: ID!, $status: String!) {
		updateInvoiceStatus(id: $id, status: $status) {
			id
			status
			updatedAt
		}
	}
`;

export const GENERATE_PROFORMA_INVOICE_PDF_MUTATION = gql`
	mutation GenerateProformaInvoicePdf($invoiceId: ID!) {
		generateProformaInvoicePdf(invoiceId: $invoiceId) {
			pdfBase64
			filename
		}
	}
`;

export const BULK_GENERATE_PROFORMA_INVOICES_PDF_MUTATION = gql`
	mutation BulkGenerateProformaInvoicesPdf($invoiceIds: [ID!]!) {
		bulkGenerateProformaInvoicesPdf(invoiceIds: $invoiceIds) {
			jobId
		}
	}
`;

// ---------------------------------------------------------------------------
// TypeScript types (aligned with GraphQL schema)
// ---------------------------------------------------------------------------

export interface InvoiceItemGQL {
	id: string;
	invoiceId: string;
	itemNo: string | null;
	skuId: string;
	skuCode: string | null;
	description: string | null;
	qty: string;
	unitPrice: string;
	subTotal: string;
}

export interface InvoiceSummaryGQL {
	issued: number;
	sent: number;
	cancelled: number;
	totalAmount: string;
}

export interface InvoiceGQL {
	id: string;
	invoiceNo: string;
	doId: string;
	doNo: string | null;
	poId: string | null;
	poNo: string | null;
	poAmount?: string | null;
	poAmountCalcSnapshot?: Record<string, unknown> | null;
	dateIssued: string | null;
	deliveryDate: string | null;
	totalExclTax: string | null;
	taxAmount: string | null;
	totalInclTax: string | null;
	taxRate: string | null;
	status: string;
	issuedAt: string | null;
	createdAt: string;
	updatedAt: string;
	items?: InvoiceItemGQL[];
}

export interface PaginationGQL {
	count: number;
	totalCount: number;
	currentPage: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface InvoicesPaginatedResponseGQL {
	query: InvoiceGQL[];
	pagination: PaginationGQL;
	summary: InvoiceSummaryGQL;
}

export type InvoicesQueryVariables = {
	filter?: {
		status?: string;
		statuses?: string[];
		search?: string;
		invoiceNo?: string;
		doId?: string;
		dateIssuedFrom?: string;
		dateIssuedTo?: string;
		deliveryDateFrom?: string;
		deliveryDateTo?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type InvoicesQueryData = {
	invoices: InvoicesPaginatedResponseGQL;
};

export type InvoiceQueryVariables = { id: string };
export type InvoiceQueryData = { invoice: InvoiceGQL | null };

export type UpdateInvoiceStatusVariables = { id: string; status: string };
export type UpdateInvoiceStatusData = {
	updateInvoiceStatus: InvoiceGQL | null;
};

export type GenerateProformaInvoicePdfVariables = { invoiceId: string };
export type GenerateProformaInvoicePdfData = {
	generateProformaInvoicePdf: {
		pdfBase64: string;
		filename: string;
	};
};

export type BulkGenerateProformaInvoicesPdfVariables = { invoiceIds: string[] };
export type BulkGenerateProformaInvoicesPdfData = {
	bulkGenerateProformaInvoicesPdf: { jobId: string };
};

// ---------------------------------------------------------------------------
// Status mapping: backend (UPPERCASE) ↔ frontend UI (Title Case)
// ---------------------------------------------------------------------------

export type InvoiceStatusUI = "Issued" | "Sent" | "Cancelled";
export type InvoiceStatusFilter = InvoiceStatusUI | "ALL";

/** Map backend status strings to UI display values */
export function gqlStatusToUI(status: string): InvoiceStatusUI {
	const map: Record<string, InvoiceStatusUI> = {
		DRAFT: "Issued",
		GENERATED: "Issued",
		ISSUED: "Issued",
		SENT: "Sent",
		CANCELLED: "Cancelled",
	};
	return map[status?.toUpperCase()] ?? "Issued";
}

/** Map UI filter value to backend status string(s). Returns array for multi-status mapping. */
export function uiStatusToGql(
	status: InvoiceStatusFilter,
): string | string[] | undefined {
	if (status === "ALL") return undefined;
	// "Issued" covers DRAFT, GENERATED, and ISSUED backend statuses
	if (status === "Issued") return ["DRAFT", "GENERATED", "ISSUED"];
	if (status === "Sent") return "SENT";
	if (status === "Cancelled") return "CANCELLED";
	return undefined;
}

// ---------------------------------------------------------------------------
// Mapper: InvoiceGQL → UI Invoice shape
// ---------------------------------------------------------------------------

export interface InvoiceUI {
	id: string;
	invoiceNumber: string;
	doNumber: string | null;
	poNumber: string | null;
	doId: string;
	status: InvoiceStatusUI;
	issuedDate: Date | null;
	totalAmount: number;
	subtotal: number;
	tax: number;
	items: InvoiceItemUI[];
}

export interface InvoiceItemUI {
	id: string;
	itemNo: string | null;
	skuId: string;
	skuCode: string | null;
	description: string | null;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
}

export function mapInvoiceItemToUI(item: InvoiceItemGQL): InvoiceItemUI {
	const qty = parseFloat(item.qty) || 0;
	const unit = parseFloat(item.unitPrice) || 0;
	return {
		id: item.id,
		itemNo: item.itemNo,
		skuId: item.skuId,
		skuCode: item.skuCode ?? null,
		description: item.description,
		quantity: qty,
		unitPrice: unit,
		totalPrice: parseFloat(item.subTotal) || qty * unit,
	};
}

export function mapInvoiceToUI(inv: InvoiceGQL): InvoiceUI {
	const totalInclTax = parseFloat(inv.totalInclTax ?? "0") || 0;
	const totalExclTax = parseFloat(inv.totalExclTax ?? "0") || 0;
	const taxAmount = parseFloat(inv.taxAmount ?? "0") || 0;
	return {
		id: inv.id,
		invoiceNumber: inv.invoiceNo,
		doNumber: inv.doNo,
		poNumber: inv.poNo,
		doId: inv.doId,
		status: gqlStatusToUI(inv.status),
		issuedDate: inv.dateIssued ? new Date(inv.dateIssued) : null,
		totalAmount: totalInclTax,
		subtotal: totalExclTax,
		tax: taxAmount,
		items: (inv.items ?? []).map(mapInvoiceItemToUI),
	};
}
