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
	warehouseId: string | null;
};

function rackLocationLabel(rack: RackRow): string {
	return `${rack.rackRow}-${rack.rackLevel}-${rack.rackColumn}`;
}

function normalizeLotNo(lot: string | null | undefined): string {
	return (lot ?? "").trim();
}

function warehouseKey(warehouseId: string | null | undefined): string {
	return warehouseId ?? "__unzoned__";
}

function buildBinToBinRackPairs(
	racks: RackRow[],
): Map<string, { source: RackRow; dest: RackRow }> {
	const byWarehouse = new Map<string, RackRow[]>();
	for (const rack of racks) {
		const key = warehouseKey(rack.warehouseId);
		const group = byWarehouse.get(key) ?? [];
		group.push(rack);
		byWarehouse.set(key, group);
	}

	const pairs = new Map<string, { source: RackRow; dest: RackRow }>();
	for (const group of byWarehouse.values()) {
		if (group.length < 2) continue;
		for (let i = 0; i < group.length; i++) {
			for (let j = 0; j < group.length; j++) {
				if (i === j) continue;
				const source = group[i]!;
				const dest = group[j]!;
				pairs.set(rackLocationLabel(source), { source, dest });
			}
		}
	}
	return pairs;
}

function pickSeedQuantForBinToBin(
	rows: StockQuantRow[],
	binToBinPairs: Map<string, { source: RackRow; dest: RackRow }>,
	preferredRackLabel?: string,
	preferredDestRackLabel?: string,
): { quant: StockQuantRow; destRackLabel: string } | undefined {
	const withCarton = rows.filter(
		(row) =>
			Number(row.quantity) > 0 &&
			row.rackLabel &&
			binToBinPairs.has(row.rackLabel) &&
			(!preferredRackLabel || row.rackLabel === preferredRackLabel),
	);

	const byRackSku = new Map<string, StockQuantRow[]>();
	for (const row of withCarton) {
		const key = `${row.rackLabel ?? ""}::${row.skuId}`;
		const group = byRackSku.get(key) ?? [];
		group.push(row);
		byRackSku.set(key, group);
	}

	const candidates = [...byRackSku.values()]
		.filter((group) => group.length === 1)
		.map((group) => group[0]!);

	const ordered = candidates.length > 0 ? candidates : withCarton;
	for (const quant of ordered) {
		const pair = binToBinPairs.get(quant.rackLabel!);
		if (!pair) continue;
		const destLabel = preferredDestRackLabel ?? rackLocationLabel(pair.dest);
		if (destLabel === quant.rackLabel) continue;
		const destInSameWarehouse = [...binToBinPairs.entries()].some(
			([sourceLabel, p]) =>
				sourceLabel === quant.rackLabel &&
				rackLocationLabel(p.dest) === destLabel,
		);
		if (!destInSameWarehouse && preferredDestRackLabel) continue;
		return { quant, destRackLabel: destLabel };
	}
	return undefined;
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
	const preferredDestRackLabel = options?.destRackLabel?.trim() || undefined;

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
						warehouseId
					}
				}
			}
		`,
		{ pageSize: 500 },
	);

	const binToBinPairs = buildBinToBinRackPairs(racksData.racks.query ?? []);
	if (binToBinPairs.size === 0) {
		throw new Error(
			"No bin-to-bin rack pairs found (need two racks in the same warehouse).",
		);
	}

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

	const picked = pickSeedQuantForBinToBin(
		rows,
		binToBinPairs,
		preferredRackLabel,
		preferredDestRackLabel,
	);
	if (!picked) {
		throw new Error(
			preferredRackLabel
				? `No bin-to-bin seed quant on rack "${preferredRackLabel}" with a same-warehouse destination.`
				: "No stock quant with carton stock on a rack that supports bin-to-bin transfer.",
		);
	}

	const { quant, destRackLabel } = picked;
	if (!quant.rackLabel || !quant.skuCode) {
		throw new Error("Seed quant is missing rack label or SKU code.");
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

function buildW2WRackPairs(
	racks: RackRow[],
): Array<{ source: RackRow; dest: RackRow }> {
	const zoned = racks.filter((r) => r.warehouseId);
	const pairs: Array<{ source: RackRow; dest: RackRow }> = [];
	for (let i = 0; i < zoned.length; i++) {
		for (let j = 0; j < zoned.length; j++) {
			if (i === j) continue;
			if (zoned[i]!.warehouseId !== zoned[j]!.warehouseId) {
				pairs.push({ source: zoned[i]!, dest: zoned[j]! });
			}
		}
	}
	return pairs;
}

export type W2WStockSeedResult = {
	quantId: string;
	skuCode: string;
	skuId: string;
	sourceRackLabel: string;
	destRackLabel: string;
	sourceWarehouseId: string;
	destWarehouseId: string;
	transferQty: string;
	sourceQtyBefore: string;
};

/**
 * Finds a cross-warehouse rack pair with carton stock on the source quant.
 */
export async function seedStockForW2WTransfer(options?: {
	sourceRackLabel?: string;
	destRackLabel?: string;
	transferQty?: string;
}): Promise<W2WStockSeedResult> {
	const accessToken = await loginForE2E();
	const transferQty = options?.transferQty ?? "1";

	const racksData = await gql<{
		racks: { query: RackRow[] };
	}>(
		accessToken,
		`
			query RacksForW2W($pageSize: Int) {
				racks(pageSize: $pageSize, pageNumber: 1) {
					query {
						rackId
						rackRow
						rackLevel
						rackColumn
						warehouseId
					}
				}
			}
		`,
		{ pageSize: 500 },
	);

	const w2wPairs = buildW2WRackPairs(racksData.racks.query ?? []);
	if (w2wPairs.length === 0) {
		throw new Error(
			"No warehouse-to-warehouse rack pairs found (need racks in two different warehouses).",
		);
	}

	const quantData = await gql<{
		stockQuants: { query: StockQuantRow[] };
	}>(
		accessToken,
		`
			query StockQuantsForW2WSeed($pageSize: Int) {
				stockQuants(pageSize: $pageSize, pageNumber: 1) {
					query {
						id
						skuId
						skuCode
						quantity
						rackId
						rackLabel
						lotNo
					}
				}
			}
		`,
		{ pageSize: 500 },
	);

	const rows = quantData.stockQuants.query ?? [];
	const preferredSource = options?.sourceRackLabel?.trim();
	const preferredDest = options?.destRackLabel?.trim();

	for (const pair of w2wPairs) {
		const sourceLabel = rackLocationLabel(pair.source);
		const destLabel = rackLocationLabel(pair.dest);
		if (preferredSource && sourceLabel !== preferredSource) continue;
		if (preferredDest && destLabel !== preferredDest) continue;

		const quant = rows.find(
			(r) =>
				r.rackLabel === sourceLabel &&
				Number(r.quantity) >= Number(transferQty) &&
				r.skuCode,
		);
		if (!quant?.rackLabel || !quant.skuCode || !pair.source.warehouseId || !pair.dest.warehouseId) {
			continue;
		}

		return {
			quantId: quant.id,
			skuId: quant.skuId,
			skuCode: quant.skuCode,
			sourceRackLabel: sourceLabel,
			destRackLabel: destLabel,
			sourceWarehouseId: pair.source.warehouseId,
			destWarehouseId: pair.dest.warehouseId,
			transferQty,
			sourceQtyBefore: quant.quantity,
		};
	}

	throw new Error(
		preferredSource
			? `No W2W seed quant on rack "${preferredSource}" with qty >= ${transferQty}.`
			: "No stock quant with sufficient carton stock on a cross-warehouse source rack.",
	);
}

export async function getStockQuantQuantity(quantId: string): Promise<string> {
	const accessToken = await loginForE2E();
	const data = await gql<{
		stockQuant: { quantity: string } | null;
	}>(
		accessToken,
		`
			query StockQuantQty($id: ID!) {
				stockQuant(id: $id) {
					quantity
				}
			}
		`,
		{ id: quantId },
	);
	if (!data.stockQuant) {
		throw new Error(`Stock quant not found (id=${quantId}).`);
	}
	return data.stockQuant.quantity;
}

export async function createAndApproveW2WTransfer(seed: W2WStockSeedResult): Promise<{
	transferId: string;
	transferNo: string;
	status: string;
}> {
	const accessToken = await loginForE2E();

	const racksData = await gql<{
		racks: { query: RackRow[] };
	}>(
		accessToken,
		`
			query RacksByLabel($filter: RackFilterInput, $pageSize: Int) {
				racks(filter: $filter, pageSize: $pageSize, pageNumber: 1) {
					query {
						rackId
						rackRow
						rackLevel
						rackColumn
					}
				}
			}
		`,
		{
			filter: { search: seed.destRackLabel },
			pageSize: 20,
		},
	);

	const destRack = racksData.racks.query?.find(
		(r) => rackLocationLabel(r) === seed.destRackLabel,
	);
	if (!destRack) {
		throw new Error(`Destination rack not found: ${seed.destRackLabel}`);
	}

	const created = await gql<{
		createStockTransfer: { id: string; transferNo: string; status: string; type: string };
	}>(
		accessToken,
		`
			mutation CreateW2WTransfer($input: CreateStockTransferInput!) {
				createStockTransfer(input: $input) {
					id
					transferNo
					status
					type
				}
			}
		`,
		{
			input: {
				lines: [
					{
						sourceStockQuantId: seed.quantId,
						destinationRackId: destRack.rackId,
						quantity: seed.transferQty,
					},
				],
			},
		},
	);

	if (created.createStockTransfer.type !== "WAREHOUSE_TO_WAREHOUSE") {
		throw new Error("Expected WAREHOUSE_TO_WAREHOUSE transfer type.");
	}

	const approved = await gql<{
		approveStockTransfer: { id: string; transferNo: string; status: string };
	}>(
		accessToken,
		`
			mutation ApproveW2WTransfer($id: ID!) {
				approveStockTransfer(id: $id) {
					id
					transferNo
					status
				}
			}
		`,
		{ id: created.createStockTransfer.id },
	);

	return {
		transferId: approved.approveStockTransfer.id,
		transferNo: approved.approveStockTransfer.transferNo,
		status: approved.approveStockTransfer.status,
	};
}
