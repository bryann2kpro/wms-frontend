import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";

export interface ItemReceiptNsResponse {
	status: string;
	message: string;
	success: boolean;
	integrationLogId?: number;
}

export interface ItemReceiptLineLot {
	quantity: number;
	serialnumbers: string;
	expirationdate: string;
}

export interface ItemReceiptLine {
	lots: ItemReceiptLineLot[];
	units: string;
	itemid: string;
	location: string;
	quantity: number;
	lineuniquekey: number;
	abj_es_supplier_do?: string;
	custcol_abj_grn_linenum?: number;
}

export interface ItemReceiptPayload {
	lines: ItemReceiptLine[];
	entity: string;
	trandate: string;
	timeStamp: string;
	externalid: string;
	recordType: string;
	createdfrom: string;
}

export interface ItemReceiptData {
	id: string;
	poNumber: string;
	esAdvanceNoticeId?: string;
	payload: ItemReceiptPayload;
	sentAt: string;
	nsResponse: ItemReceiptNsResponse;
}

export interface ItemReceiptApiResponse {
	success: boolean;
	message: string;
	data?: ItemReceiptData;
}

export async function fetchItemReceipt(
	poNumber: string,
): Promise<ItemReceiptData> {
	const url = new URL(
		`${env.VITE_API_URL.replace(/\/$/, "")}/v1/es/item-receipt`,
	);
	url.searchParams.set("id", poNumber.trim());

	const headers = new Headers();
	headers.set("Accept", "application/json");
	const token = getAccessToken();
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	const res = await fetch(url.toString(), { headers });

	let body: unknown;
	try {
		body = await res.json();
	} catch {
		throw new Error(`Item receipt request failed (${res.status})`);
	}

	const parsed = body as ItemReceiptApiResponse;
	if (!res.ok) {
		throw new Error(parsed?.message ?? `Request failed (${res.status})`);
	}
	if (!parsed.success) {
		throw new Error(parsed.message ?? "Failed to fetch item receipt");
	}
	if (!parsed.data) {
		throw new Error(parsed.message ?? "No item receipt data returned");
	}
	return parsed.data;
}
