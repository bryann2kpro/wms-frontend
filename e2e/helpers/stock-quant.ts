/**
 * E2E helpers for seeding rack-level loose (LOSS) stock via GraphQL.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:7777";
const GRAPHQL_URL = process.env.E2E_GRAPHQL_URL ?? `${BACKEND_URL}/graphql`;

type GqlResponse<T> = {
	data?: T;
	errors?: Array<{ message: string }>;
};

async function loginForE2E(): Promise<string> {
	const email = process.env.E2E_ADMIN_EMAIL;
	const password = process.env.E2E_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error(
			"E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in .env.e2e",
		);
	}

	const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username: email, password }),
	});
	if (!res.ok) {
		throw new Error(`Login failed [${res.status}]: ${await res.text()}`);
	}

	const json = (await res.json()) as {
		success: boolean;
		data?: { accessToken: string };
		message?: string;
	};
	if (!json.success || !json.data?.accessToken) {
		throw new Error(`Login failed: ${json.message ?? "no token"}`);
	}
	return json.data.accessToken;
}

async function gql<T>(
	accessToken: string,
	query: string,
	variables?: Record<string, unknown>,
): Promise<T> {
	const res = await fetch(GRAPHQL_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify({ query, variables }),
	});
	if (!res.ok) {
		throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
	}

	const json = (await res.json()) as GqlResponse<T>;
	if (json.errors?.length) {
		throw new Error(
			json.errors.map((e) => e.message).join("; ") || "GraphQL error",
		);
	}
	if (!json.data) {
		throw new Error("GraphQL response missing data");
	}
	return json.data;
}

type StockQuantRow = {
	id: string;
	skuId: string;
	skuCode: string | null;
	quantity: string;
	lossQty: string;
	rackId: string;
	rackLabel: string | null;
	lotNo: string | null;
};

type RackRow = {
	rackId: string;
	rackRow: string;
	rackLevel: string;
	rackColumn: string;
};

function rackLocationLabel(rack: RackRow): string {
	return `${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`;
}

function normalizeLotNo(lot: string | null | undefined): string {
	return (lot ?? "").trim();
}

function pickSeedQuant(
	rows: StockQuantRow[],
	preferredRackLabel?: string,
): StockQuantRow | undefined {
	const withCarton = rows.filter((row) => Number(row.quantity) > 0);
	const scoped = preferredRackLabel
		? withCarton.filter((row) => row.rackLabel === preferredRackLabel)
		: withCarton;

	const byRackSku = new Map<string, StockQuantRow[]>();
	for (const row of scoped) {
		const key = `${row.rackLabel ?? ""}::${row.skuId}`;
		const group = byRackSku.get(key) ?? [];
		group.push(row);
		byRackSku.set(key, group);
	}

	const unambiguous = [...byRackSku.values()]
		.filter((group) => group.length === 1)
		.map((group) => group[0]!);

	if (unambiguous.length > 0) {
		return unambiguous[0];
	}

	return scoped[0];
}

export type LooseStockSeedResult = {
	quantId: string;
	skuCode: string;
	skuId: string;
	sourceRackLabel: string;
	destRackLabel: string;
	lossQty: string;
	/** Empty string when the quant has no lot number. */
	lotNo: string;
};

/**
 * Ensures at least one stock_quant on a rack has loose units for bin-transfer E2E.
 * Prefers a SKU with a single quant row on the rack (no lot picker ambiguity).
 */
export async function seedLooseStockForBinTransfer(options?: {
	rackLabel?: string;
	lossQty?: string;
	destRackLabel?: string;
}): Promise<LooseStockSeedResult> {
	const accessToken = await loginForE2E();
	const lossQty = options?.lossQty ?? "5";
	const preferredRackLabel = options?.rackLabel?.trim() || undefined;

	const quantData = await gql<{
		stockQuants: { query: StockQuantRow[] };
	}>(
		accessToken,
		`
			query StockQuantsForLooseSeed($filter: StockQuantFilterInput, $pageSize: Int) {
				stockQuants(filter: $filter, pageSize: $pageSize, pageNumber: 1) {
					query {
						id
						skuId
						skuCode
						quantity
						lossQty
						rackId
						rackLabel
						lotNo
					}
				}
			}
		`,
		{
			filter: preferredRackLabel
				? { rackLabel: preferredRackLabel }
				: undefined,
			pageSize: preferredRackLabel ? 50 : 200,
		},
	);

	let rows = quantData.stockQuants.query ?? [];

	if (rows.length === 0 && !preferredRackLabel) {
		const anyData = await gql<{
			stockQuants: { query: StockQuantRow[] };
		}>(
			accessToken,
			`
				query {
					stockQuants(pageSize: 200, pageNumber: 1) {
						query {
							id
							skuId
							skuCode
							quantity
							lossQty
							rackId
							rackLabel
							lotNo
						}
					}
				}
			`,
		);
		rows = anyData.stockQuants.query ?? [];
	}

	const quant = pickSeedQuant(rows, preferredRackLabel);
	if (!quant?.rackLabel || !quant.skuCode) {
		throw new Error(
			preferredRackLabel
				? `No stock quant with carton stock on rack "${preferredRackLabel}".`
				: "No stock quant with carton stock found in the database.",
		);
	}

	const currentLoss = Number(quant.lossQty ?? 0);
	const targetLoss = Math.max(currentLoss, Number(lossQty));
	if (targetLoss > currentLoss) {
		const updated = await gql<{
			updateStockQuant: { id: string; lossQty: string } | null;
		}>(
			accessToken,
			`
				mutation UpdateStockQuantLoss($id: ID!, $lossQty: String!) {
					updateStockQuant(id: $id, input: { lossQty: $lossQty }) {
						id
						lossQty
					}
				}
			`,
			{ id: quant.id, lossQty: targetLoss.toFixed(2) },
		);
		if (Number(updated.updateStockQuant?.lossQty ?? 0) < targetLoss) {
			throw new Error(
				`Failed to seed lossQty on quant ${quant.id} (is loss_qty migrated?)`,
			);
		}
	}

	const racksData = await gql<{
		racks: { query: RackRow[] };
	}>(
		accessToken,
		`
			query RacksForDest($pageSize: Int) {
				racks(pageSize: $pageSize, pageNumber: 1) {
					query {
						rackId
						rackRow
						rackLevel
						rackColumn
					}
				}
			}
		`,
		{ pageSize: 100 },
	);

	const preferredDest = options?.destRackLabel?.trim();
	let destRackLabel = preferredDest;

	if (!destRackLabel) {
		const destRack = racksData.racks.query.find(
			(rack) => rackLocationLabel(rack) !== quant.rackLabel,
		);
		if (!destRack) {
			throw new Error("Need at least two racks for bin-to-bin transfer E2E.");
		}
		destRackLabel = rackLocationLabel(destRack);
	}

	return {
		quantId: quant.id,
		skuId: quant.skuId,
		skuCode: quant.skuCode,
		sourceRackLabel: quant.rackLabel,
		destRackLabel,
		lossQty: targetLoss.toFixed(2),
		lotNo: normalizeLotNo(quant.lotNo),
	};
}
