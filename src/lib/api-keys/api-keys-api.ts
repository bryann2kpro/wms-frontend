import { getClient } from "@/lib/axios-v1";

// ============================================
// TYPES
// ============================================

export type ApiKey = {
	id: string;
	name: string;
	keyPrefix: string;
	organizationId: string | null;
	isActive: boolean;
	expiresAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
};

export type CreateApiKeyInput = {
	name: string;
	organizationId?: string;
	expiresAt?: string;
};

export type CreateApiKeyResponse = {
	success: boolean;
	message: string;
	data: ApiKey & { rawKey: string };
};

export type ListApiKeysResponse = {
	success: boolean;
	message: string;
	data: ApiKey[];
};

export type RevokeApiKeyResponse = {
	success: boolean;
	message: string;
	data: { id: string; isActive: boolean };
};

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch all API keys
 * GET /api-keys
 */
export async function fetchApiKeys(
	organizationId?: string,
): Promise<ListApiKeysResponse> {
	const client = getClient();
	const query = organizationId ? `?organizationId=${organizationId}` : "";
	const response = await client.get<ListApiKeysResponse>(`/api-keys${query}`);
	return response.data;
}

/**
 * Create a new API key
 * POST /api-keys
 * Returns the rawKey once — must be saved by the caller immediately.
 */
export async function createApiKey(
	input: CreateApiKeyInput,
): Promise<CreateApiKeyResponse> {
	const client = getClient();
	const response = await client.post<CreateApiKeyResponse>("/api-keys", input);
	if (!response.data.success) {
		throw new Error(response.data.message || "Failed to create API key");
	}
	return response.data;
}

/**
 * Revoke an API key (soft-delete)
 * DELETE /api-keys/:id
 */
export async function revokeApiKey(id: string): Promise<RevokeApiKeyResponse> {
	const client = getClient();
	const response = await client.delete<RevokeApiKeyResponse>(`/api-keys/${id}`);
	if (!response.data.success) {
		throw new Error(response.data.message || "Failed to revoke API key");
	}
	return response.data;
}
