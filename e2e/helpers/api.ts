/**
 * Lightweight helpers for calling the WMS backend directly from E2E tests.
 * Uses the Node.js fetch API (available in Playwright's Node context).
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:7777";
const API_KEY = process.env.E2E_API_KEY ?? "";

export interface AsnLine {
  lineuniquekey: number;
  itemid: string;
  quantity: number;
  units: string;
  displayname: string;
  islotitem: string;
  custrecord_r2o_order_code: string;
}

export interface AsnPayload {
  tranid: string;
  entity: string;
  duedate: string;
  trandate: string;
  timeStamp: string;
  lines: AsnLine[];
}

/**
 * POST an Advance Shipping Notice to the backend REST endpoint.
 * Throws if the response is not 200.
 */
export async function postAdvanceNotice(payload: AsnPayload): Promise<void> {
  if (!API_KEY) {
    throw new Error(
      "E2E_API_KEY is not set. Add it to your .env.e2e file.",
    );
  }

  const res = await fetch(`${BACKEND_URL}/api/v1/es/advance-notice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `POST /api/v1/es/advance-notice failed [${res.status}]: ${body}`,
    );
  }
}

/**
 * Generates a unique tranid by appending a timestamp suffix so concurrent
 * test runs (or re-runs) don't hit the duplicate-tranid guard.
 *
 * Example: "PO76040043" → "PO76040043-1712678400000"
 */
export function uniqueTranid(base: string): string {
  return `${base}-${Date.now()}`;
}

/**
 * Fetch the first supplierId from the backend GraphQL API using the admin token.
 * Returns null if no suppliers exist.
 *
 * Used by the manual GRN test to obtain a valid supplierId before form submission
 * (the manual creation path has no ASN entity to auto-resolve from).
 */
export async function fetchFirstSupplierId(accessToken: string): Promise<string | null> {
  const GRAPHQL_URL = process.env.E2E_GRAPHQL_URL ?? "http://localhost:7777/graphql";

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `
        query {
          suppliers(pageSize: 1, pageNumber: 1) {
            query { supplierId supplierName }
          }
        }
      `,
    }),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    data?: { suppliers?: { query?: Array<{ supplierId: string }> } };
  };

  return json.data?.suppliers?.query?.[0]?.supplierId ?? null;
}
