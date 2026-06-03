import { gql } from "graphql-request";

export const PUTAWAY_LINES_QUERY = gql`
	query PutawayLines($filter: PutawayLinesFilterInput, $limit: Int) {
		putawayLines(filter: $filter, limit: $limit) {
			id
			status
			skuId
			skuCode
			description
			sourceRackId
			sourceRackLabel
			destinationRackId
			destinationRackLabel
			sourceStockQuantId
			sourceLotNo
			quantity
			failureMessage
			createdAt
			updatedAt
		}
	}
`;

export const CREATE_PUTAWAY_DRAFT_MUTATION = gql`
	mutation CreatePutawayDraft($input: CreatePutawayDraftInput!) {
		createPutawayDraft(input: $input) {
			id
			status
			skuId
			skuCode
			description
			sourceRackId
			sourceRackLabel
			destinationRackId
			destinationRackLabel
			sourceStockQuantId
			sourceLotNo
			quantity
			failureMessage
			createdAt
			updatedAt
		}
	}
`;

export const APPROVE_PUTAWAY_LINE_MUTATION = gql`
	mutation ApprovePutawayLine($id: ID!) {
		approvePutawayLine(id: $id) {
			success
			message
		}
	}
`;

export const REJECT_PUTAWAY_LINE_MUTATION = gql`
	mutation RejectPutawayLine($id: ID!) {
		rejectPutawayLine(id: $id) {
			id
			status
			skuId
			skuCode
			description
			sourceRackId
			sourceRackLabel
			destinationRackId
			destinationRackLabel
			sourceStockQuantId
			sourceLotNo
			quantity
			failureMessage
			createdAt
			updatedAt
		}
	}
`;

export type PutawayLineGql = {
	id: string;
	status: "DRAFT" | "APPROVED" | "FAIL" | "REJECT";
	skuId: string;
	skuCode: string | null;
	description: string | null;
	sourceRackId: string;
	sourceRackLabel: string | null;
	destinationRackId: string;
	destinationRackLabel: string | null;
	sourceStockQuantId: string;
	sourceLotNo: string | null;
	quantity: string;
	failureMessage: string | null;
	createdAt: string;
	updatedAt: string;
};

export type PutawayLinesQueryData = {
	putawayLines: PutawayLineGql[];
};

export type PutawayLinesQueryVariables = {
	filter?: { status?: string };
	limit?: number;
};

export type CreatePutawayDraftMutationData = {
	createPutawayDraft: PutawayLineGql;
};

export type CreatePutawayDraftMutationVariables = {
	input: {
		sourceStockQuantId: string;
		destinationRackId: string;
		quantity: string;
		sourceLotNo?: string | null;
	};
};

export type ApprovePutawayLineMutationData = {
	approvePutawayLine: {
		success: boolean;
		message: string;
	};
};

export type ApprovePutawayLineMutationVariables = {
	id: string;
};

export type RejectPutawayLineMutationData = {
	rejectPutawayLine: PutawayLineGql;
};

export type RejectPutawayLineMutationVariables = {
	id: string;
};
