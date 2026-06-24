import { gql } from "graphql-request";
import type {
	Transport,
	TransportPaginatedResponse,
	CreateTransportInput,
	UpdateTransportInput,
} from "./types";

export const TRANSPORT_FRAGMENT = gql`
	fragment TransportFields on Transport {
		id
		code
		description
		storageBinId
		location
		minLengthMm
		minWidthMm
		minHeightMm
		minWeightKg
		maxLengthMm
		maxWidthMm
		maxHeightMm
		maxWeightKg
		numberOfPallets
		capacityClass
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const TRANSPORTS_QUERY = gql`
	query Transports(
		$filter: TransportFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		transports(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...TransportFields
			}
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
		}
	}
	${TRANSPORT_FRAGMENT}
`;

export const CREATE_TRANSPORT_MUTATION = gql`
	mutation CreateTransport($input: CreateTransportInput!) {
		createTransport(input: $input) {
			...TransportFields
		}
	}
	${TRANSPORT_FRAGMENT}
`;

export const UPDATE_TRANSPORT_MUTATION = gql`
	mutation UpdateTransport($id: ID!, $input: UpdateTransportInput!) {
		updateTransport(id: $id, input: $input) {
			...TransportFields
		}
	}
	${TRANSPORT_FRAGMENT}
`;

export const DELETE_TRANSPORT_MUTATION = gql`
	mutation DeleteTransport($id: ID!) {
		deleteTransport(id: $id)
	}
`;

export type TransportsQueryVariables = {
	filter?: {
		id?: string;
		code?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type TransportsQueryData = {
	transports: TransportPaginatedResponse;
};

export type CreateTransportMutationVariables = { input: CreateTransportInput };
export type CreateTransportMutationData = { createTransport: Transport };

export type UpdateTransportMutationVariables = {
	id: string;
	input: UpdateTransportInput;
};
export type UpdateTransportMutationData = { updateTransport: Transport | null };

export type DeleteTransportMutationVariables = { id: string };
export type DeleteTransportMutationData = { deleteTransport: boolean };

export type { Transport };
