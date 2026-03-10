import { faker } from "@faker-js/faker";

export type InvoiceStatus = "Issued" | "Sent" | "Cancelled";

export interface InvoiceItem {
	id: string;
	sku: string;
	description: string;
	quantity: number;
	unitPrice?: number;
	totalPrice?: number;
}

const regions = ["Klang Valley", "Perlis", "North", "South", "East Coast"];

export interface Invoice {
	id: string;
	invoiceNumber: string;
	doNumber: string;
	doId: string;
	/** PO Number (not nullable) */
	toNumber: string;
	region: string;
	outlet: string;
	outletAddress?: string;
	status: InvoiceStatus;
	issuedDate: Date;
	sentDate?: Date;
	cancelledDate?: Date;
	cancelledReason?: string;
	items: InvoiceItem[];
	subtotal?: number;
	tax?: number;
	totalAmount: number;
	notes?: string;
}

export type InvoiceStatusFilter = InvoiceStatus | "ALL";

export interface InvoiceListFilters {
	page: number;
	pageSize: number;
	search?: string;
	status?: InvoiceStatusFilter;
	outlet?: string;
	region?: string;
	dateFrom?: Date;
	dateTo?: Date;
}

export interface InvoiceSummary {
	byStatus: Record<InvoiceStatus, number>;
	total: number;
	totalAmount: number;
}

export interface InvoiceListResult {
	items: Invoice[];
	summary: InvoiceSummary;
	page: number;
	pageSize: number;
	total: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate mock invoices
let invoices: Invoice[] = Array.from({ length: 25 }, (_, i) => {
	const statuses: InvoiceStatus[] = ["Issued", "Sent", "Cancelled"];
	const status = statuses[i % statuses.length];

	const items: InvoiceItem[] = Array.from({ length: 2 + (i % 3) }, (_, j) => {
		const quantity = 5 + j * 3;
		const unitPrice = 10 + j * 5;
		return {
			id: `${i}-${j}`,
			sku: `SKU-${String(i + 1).padStart(3, "0")}-${String(j + 1).padStart(2, "0")}`,
			description: faker.commerce.productName(),
			quantity,
			unitPrice,
			totalPrice: quantity * unitPrice,
		};
	});

	const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
	const tax = subtotal * 0.1; // 10% tax
	const totalAmount = subtotal + tax;

	return {
		id: `inv-${i}`,
		invoiceNumber: `INV-2024-${String(i + 1).padStart(4, "0")}`,
		doNumber: `DO-2024-${String(i + 1).padStart(4, "0")}`,
		doId: `do-${i}`,
		toNumber: `PO-2024-${String(i + 1).padStart(4, "0")}`,
		region: regions[i % regions.length],
		outlet: faker.company.name(),
		outletAddress: faker.location.streetAddress(),
		status,
		issuedDate: new Date(Date.now() - i * 86400000),
		sentDate:
			status === "Sent"
				? new Date(Date.now() - i * 86400000 + 3600000)
				: undefined,
		cancelledDate:
			status === "Cancelled"
				? new Date(Date.now() - i * 86400000 + 7200000)
				: undefined,
		cancelledReason:
			status === "Cancelled" ? "Customer requested cancellation" : undefined,
		items,
		subtotal,
		tax,
		totalAmount,
		notes: i % 5 === 0 ? faker.lorem.sentence() : undefined,
	};
});

function buildSummary(source: Invoice[]): InvoiceSummary {
	const initial: Record<InvoiceStatus, number> = {
		Issued: 0,
		Sent: 0,
		Cancelled: 0,
	};

	const byStatus = source.reduce((acc, inv) => {
		acc[inv.status] = (acc[inv.status] ?? 0) + 1;
		return acc;
	}, initial);

	const totalAmount = source.reduce((sum, inv) => sum + inv.totalAmount, 0);

	return {
		byStatus,
		total: source.length,
		totalAmount,
	};
}

export async function getInvoices(
	filters: InvoiceListFilters,
): Promise<InvoiceListResult> {
	await delay(300);

	const { page, pageSize, search, status, region, outlet, dateFrom, dateTo } =
		filters;

	let filtered = [...invoices];

	if (search && search.trim()) {
		const term = search.toLowerCase();
		filtered = filtered.filter((inv) => {
			return (
				inv.invoiceNumber.toLowerCase().includes(term) ||
				inv.doNumber.toLowerCase().includes(term) ||
				inv.outlet.toLowerCase().includes(term)
			);
		});
	}

	if (status && status !== "ALL") {
		filtered = filtered.filter((inv) => inv.status === status);
	}

	if (outlet) {
		filtered = filtered.filter((inv) => inv.outlet === outlet);
	}

	if (region) {
		filtered = filtered.filter((inv) => inv.region === region);
	}

	if (dateFrom) {
		filtered = filtered.filter((inv) => inv.issuedDate >= dateFrom);
	}

	if (dateTo) {
		filtered = filtered.filter((inv) => inv.issuedDate <= dateTo);
	}

	const total = filtered.length;
	const start = (page - 1) * pageSize;
	const end = start + pageSize;
	const items = filtered.slice(start, end);

	return {
		items,
		summary: buildSummary(invoices),
		page,
		pageSize,
		total,
	};
}

export interface CreateInvoiceInput {
	invoiceNumber: string;
	doNumber: string;
	doId: string;
	/** PO Number (not nullable) */
	toNumber: string;
	outlet: string;
	outletAddress?: string;
	issuedDate: Date;
	items: Array<{
		sku: string;
		description: string;
		quantity: number;
		unitPrice: number;
	}>;
	subtotal?: number;
	tax?: number;
	notes?: string;
}

export async function createInvoice(
	input: CreateInvoiceInput,
): Promise<Invoice> {
	await delay(300);

	const subtotal =
		input.subtotal ??
		input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
	const tax = input.tax ?? subtotal * 0.1; // 10% tax
	const totalAmount = subtotal + tax;

	const items: InvoiceItem[] = input.items.map((item, index) => ({
		id: `${invoices.length}-${index}`,
		sku: item.sku,
		description: item.description,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		totalPrice: item.quantity * item.unitPrice,
	}));

	const newInvoice: Invoice = {
		id: `inv-${invoices.length}`,
		invoiceNumber: input.invoiceNumber,
		doNumber: input.doNumber,
		doId: input.doId,
		toNumber: input.toNumber,
		region: faker.location.state(),
		outlet: input.outlet,
		outletAddress: input.outletAddress,
		status: "Issued",
		issuedDate: input.issuedDate,
		items,
		subtotal,
		tax,
		totalAmount,
		notes: input.notes,
	};

	invoices = [newInvoice, ...invoices];

	return newInvoice;
}

export async function getInvoiceById(id: string): Promise<Invoice | undefined> {
	await delay(200);
	return invoices.find((inv) => inv.id === id);
}

export async function markInvoiceAsSent(
	id: string,
): Promise<Invoice | undefined> {
	await delay(300);

	const index = invoices.findIndex((inv) => inv.id === id);
	if (index === -1) return undefined;

	const current = invoices[index];
	if (current.status !== "Issued") return undefined;

	const updated: Invoice = {
		...current,
		status: "Sent",
		sentDate: new Date(),
	};

	invoices[index] = updated;
	return updated;
}

export async function cancelInvoice(
	id: string,
	reason: string,
): Promise<Invoice | undefined> {
	await delay(300);

	const index = invoices.findIndex((inv) => inv.id === id);
	if (index === -1) return undefined;

	const current = invoices[index];
	if (current.status === "Cancelled") return undefined;

	const updated: Invoice = {
		...current,
		status: "Cancelled",
		cancelledDate: new Date(),
		cancelledReason: reason,
	};

	invoices[index] = updated;
	return updated;
}

// Mock export functions
export async function exportInvoicePDF(id: string): Promise<Blob> {
	await delay(500);
	// In real implementation, this would generate a PDF
	return new Blob(["Mock PDF content"], { type: "application/pdf" });
}

export async function exportInvoiceExcel(id: string): Promise<Blob> {
	await delay(500);
	// In real implementation, this would generate an Excel file
	return new Blob(["Mock Excel content"], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
}

export async function exportInvoiceTXT(id: string): Promise<Blob> {
	await delay(500);
	// In real implementation, this would generate a text file
	return new Blob(["Mock TXT content"], { type: "text/plain" });
}
