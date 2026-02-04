/**
 * Reporting mock data and types for Movement Report and Invoices Summary.
 * Used for client-side PDF fallback and sample data.
 */

/** Movement Report row: Company Code, Item Code, Description, Count Adjustment Unit Qty */
export interface MovementReportRow {
	companyCode: string;
	itemCode: string;
	description: string;
	countAdjustmentQty: number;
}

/** Invoices Summary row: PONumber label, PO Number, Outlet, Expected Arrival Date, Ctn */
export interface InvoiceSummaryRow {
	poNumber: string;
	outlet: string;
	expectedArrivalDate: string; // DD/MM/YYYY
	ctn: number;
}

/** Sample data for Movement Report */
export const MOVEMENT_MOCK_ROWS: MovementReportRow[] = [
	{ companyCode: "EMPIRE SUSHI", itemCode: "RAW-E0012", description: "EMPIRE SUSHI BOX (LARGE) 200PCS/CTN (LOCAL)", countAdjustmentQty: -66 },
	{ companyCode: "EMPIRE SUSHI", itemCode: "RAW-E0011", description: "EMPIRE SUSHI BOX (MEDIUM) 300PCS/CTN (LOCAL)", countAdjustmentQty: -80 },
	{ companyCode: "EMPIRE SUSHI", itemCode: "RAW-E0013", description: "EMPIRE SUSHI BOX (SMALL) 300PCS/CTN (LOCAL)", countAdjustmentQty: -90 },
	{ companyCode: "EMPIRE SUSHI", itemCode: "RAW-P0017", description: "PLASTIC BAG BIODEGRADABLE 3000PC/CTN (LOCAL)", countAdjustmentQty: -5 },
	{ companyCode: "EMPIRE SUSHI", itemCode: "RAW-E0010", description: "EMPIRE COMBO BOX (60PCS/PKT) (LOCAL)", countAdjustmentQty: -1 },
];

/** Sample data for Invoices Summary */
export const INVOICE_SUMMARY_MOCK_ROWS: InvoiceSummaryRow[] = [
	{ poNumber: "#PO260170528", outlet: "Aeon Midtown Falim", expectedArrivalDate: "22/1/2026", ctn: 10 },
	{ poNumber: "#PO260173297", outlet: "Lotuss Taiping", expectedArrivalDate: "22/1/2026", ctn: 8 },
	{ poNumber: "#PO260173298", outlet: "Gurney Paragon", expectedArrivalDate: "22/1/2026", ctn: 5 },
	{ poNumber: "#PO260173299", outlet: "Amanjaya", expectedArrivalDate: "22/1/2026", ctn: 24 },
	{ poNumber: "#PO260173300", outlet: "AEON Bukit Mertajam", expectedArrivalDate: "22/1/2026", ctn: 18 },
	{ poNumber: "#PO260173301", outlet: "Aman Central LG", expectedArrivalDate: "22/1/2026", ctn: 15 },
	{ poNumber: "#PO260173302", outlet: "Lotuss Teluk Intan", expectedArrivalDate: "22/1/2026", ctn: 9 },
	{ poNumber: "#PO260173303", outlet: "Pearl City", expectedArrivalDate: "22/1/2026", ctn: 13 },
	{ poNumber: "#PO260173304", outlet: "Nibong Tebal", expectedArrivalDate: "22/1/2026", ctn: 6 },
	{ poNumber: "#PO260173305", outlet: "Lotuss Ipoh Bercham", expectedArrivalDate: "22/1/2026", ctn: 24 },
	{ poNumber: "#PO260173306", outlet: "Sunway Carnival", expectedArrivalDate: "22/1/2026", ctn: 5 },
	{ poNumber: "#PO260173307", outlet: "Sentra Mall", expectedArrivalDate: "22/1/2026", ctn: 8 },
	{ poNumber: "#PO260173308", outlet: "AEON Seri Manjung", expectedArrivalDate: "22/1/2026", ctn: 6 },
	{ poNumber: "#PO260173309", outlet: "AEON Taiping", expectedArrivalDate: "22/1/2026", ctn: 6 },
	{ poNumber: "#PO260173310", outlet: "AEON Ipoh S18", expectedArrivalDate: "22/1/2026", ctn: 13 },
	{ poNumber: "#PO260173311", outlet: "1st Avenue", expectedArrivalDate: "22/1/2026", ctn: 17 },
	{ poNumber: "#PO260173312", outlet: "Queensbay Mall", expectedArrivalDate: "22/1/2026", ctn: 10 },
	{ poNumber: "#PO260173313", outlet: "Mydin Bukit Mertajam", expectedArrivalDate: "22/1/2026", ctn: 12 },
	{ poNumber: "#PO260173314", outlet: "Gurney Plaza", expectedArrivalDate: "22/1/2026", ctn: 13 },
	{ poNumber: "#PO260173315", outlet: "Serai Wangi", expectedArrivalDate: "22/1/2026", ctn: 10 },
	{ poNumber: "#PO260173316", outlet: "AEON Kinta City", expectedArrivalDate: "22/1/2026", ctn: 12 },
];
